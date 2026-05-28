# Docker部署与环境配置设计 V1.0

# 《Docker部署与环境配置设计 V1.0》
## 一、部署目标
一期采用：
```
Docker Compose 私有化部署
```

适合院内局域网、测试环境、试点上线。
---
# 二、推荐服务组成
```
H-MELC/├─ backend # FastAPI后端├─ frontend-admin # 管理端前端├─ frontend-supplier # 供应商门户├─ ai-service # AI服务├─ postgres # PostgreSQL 16├─ redis # Redis 7├─ minio # 文件对象存储└─ nginx # 统一入口
```

---
# 三、docker-compose.yml 结构
```
services: postgres: image: postgres:16 container_name: mep-postgres environment: POSTGRES_DB: mep POSTGRES_USER: mep_user POSTGRES_PASSWORD: mep_password volumes: - postgres_data:/var/lib/postgresql/data ports: - "5432:5432" redis: image: redis:7 container_name: mep-redis ports: - "6379:6379" minio: image: minio/minio container_name: mep-minio command: server /data --console-address ":9001" environment: MINIO_ROOT_USER: minioadmin MINIO_ROOT_PASSWORD: minioadmin123 volumes: - minio_data:/data ports: - "9000:9000" - "9001:9001" backend: build: ./backend container_name: mep-backend depends_on: - postgres - redis - minio env_file: - ./deploy/env/backend.env ports: - "8000:8000" ai-service: build: ./ai-service container_name: mep-ai-service depends_on: - postgres - redis - minio env_file: - ./deploy/env/ai.env ports: - "8010:8010" frontend-admin: build: ./frontend-admin container_name: mep-frontend-admin ports: - "3000:80" frontend-supplier: build: ./frontend-supplier container_name: mep-frontend-supplier ports: - "3001:80" nginx: image: nginx:latest container_name: mep-nginx volumes: - ./deploy/nginx/nginx.conf:/etc/nginx/nginx.conf depends_on: - backend - frontend-admin - frontend-supplier ports: - "80:80" - "443:443"volumes: postgres_data: minio_data:
```

---
# 四、后端 Dockerfile
```
FROM python:3.11-slimWORKDIR /appCOPY pyproject.toml .COPY app ./appCOPY alembic ./alembicCOPY alembic.ini .RUN pip install --no-cache-dir -U pip \ && pip install --no-cache-dir .CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---
# 五、前端 Dockerfile
```
FROM node:20-alpine AS buildWORKDIR /appCOPY package.json package-lock.json ./RUN npm ciCOPY . .RUN npm run buildFROM nginx:alpineCOPY --from=build /app/dist /usr/share/nginx/htmlCOPY nginx.conf /etc/nginx/conf.d/default.conf
```

---
# 六、环境变量设计
## backend.env
```
APP_NAME=H-MELC APP_ENV=productionSECRET_KEY=change_meDATABASE_URL=postgresql+psycopg://mep_user:mep_password@postgres:5432/mepREDIS_URL=redis://redis:6379/0MINIO_ENDPOINT=minio:9000MINIO_ACCESS_KEY=minioadminMINIO_SECRET_KEY=minioadmin123MINIO_BUCKET=mep-filesAI_SERVICE_URL=http://ai-service:8010
```

---
# 七、Nginx路由建议
```
server { listen 80; location / { proxy_pass http://frontend-admin:80; } location /supplier/ { proxy_pass http://frontend-supplier:80; } location /api/ { proxy_pass http://backend:8000; } location /ai-api/ { proxy_pass http://ai-service:8010; } location /files/ { proxy_pass http://minio:9000; }}
```

---
# 八、数据库初始化流程
```
启动PostgreSQL→ 创建schema→ 执行Alembic迁移→ 初始化系统字典→ 初始化管理员账号→ 初始化角色权限→ 初始化默认工作流
```

建议提供命令：
```
make init-dbmake migratemake seedmake upmake down
```

---
# 九、备份恢复方案
## 数据库备份
```
pg_dump -h postgres -U mep_user mep > backup.sql
```

## 文件备份
```
MinIO数据卷定期备份
```

## 建议策略
| 类型      | 频率    |
|---------|-------|
| 数据库全量备份 | 每日    |
| 文件存储备份  | 每日    |
| 配置文件备份  | 每次变更  |
| 备份保留    | 至少30天 |


---
# 十、生产环境建议
正式上线后建议：
  * 数据库不暴露公网端口
  * MinIO不直接开放外部访问
  * Nginx启用HTTPS
  * 所有管理后台限制院内访问
  * 供应商门户单独安全策略
  * 定期备份并做恢复演练
  * AI服务与业务服务隔离部署


---

# 十一、存活与就绪探针（`/health`、`/health/ready`）

后端实现见 `backend/app/main.py`。两路由**不使用**统一 API 信封 `code/message/data`，便于探针脚本与编排直接解析 JSON。

## 存活（liveness）

- **GET `/health`**：进程存活即可；响应体 `{ "status": "ok" }`，**HTTP 200**。

## 就绪（readiness）

- **GET `/health/ready`**：必选校验 **PostgreSQL** 连通（执行 `SELECT 1`）。
- **Redis**：未配置密钥/URL 时为 `skipped`；已配置则需 `PING` 成功，否则为 `error` 且整体 **not_ready**。
- **MinIO**：未配置访问密钥时为 `skipped`；已配置则需可达，否则 `error` 且整体 **not_ready**。
- 整体：`status` 为 `ready` / `not_ready`；任一必选/已配置依赖失败时 **HTTP 503**，否则 **HTTP 200**。
- **敏感信息**：响应中含脱敏后的 `database_url`，仅用于现场确认「连到哪套库」，生产网关建议按需屏蔽外网访问。

### 迁移观测字段 `checks.alembic_version`（不参与就绪门禁）

数据库探测为 **ok** 时，若方言为 **PostgreSQL**，后端会额外尝试读取 **`alembic_version`** 表中当前迁移版本摘要（单行 `ORDER BY version_num DESC LIMIT 1`），写入 **`checks["alembic_version"]`**：

| 取值 | 含义 |
|-----|------|
| 具体字符串（如迁移版本号前缀） | 库内存在 Alembic 版本记录 |
| `empty` | 表存在但无数据（尚未写入版本） |
| `unavailable` | 不可读（常见：尚未执行迁移、表不存在或非预期权限） |
| `n/a` | 非 PostgreSQL（如本地 SQLite），本字段不适用 |

说明：**就绪判定不依赖迁移是否已完成**。未迁库仅会导致业务 API 在具体模块上返回 **503**（缺表）；运维应结合 **`alembic_version`** 与本仓库 `backend/alembic/versions` 与 **`alembic upgrade head`** 流程（见上文「数据库初始化流程」）保证上线一致性。

---

下一步建议继续进入：
# 《CI/CD 与 GitHub Actions 设计 V1.0》