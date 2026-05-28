# CI/CD与GitHub Actions设计 V1.0

# 《CI/CD 与 GitHub Actions 设计 V1.0》
## 一、CI/CD目标
实现：
  * 每次提交自动检查代码
  * 自动运行后端测试
  * 自动运行前端构建
  * 自动检查数据库迁移
  * 自动生成构建产物
  * 后期支持自动部署测试环境


---
# 二、推荐工作流
```
代码提交→ 后端格式检查→ 后端单元测试→ Alembic迁移检查→ 前端类型检查→ 前端构建→ Docker镜像构建→ 测试环境部署
```

---
# 三、GitHub Actions目录
```
.github/└─ workflows/ ├─ backend.yml ├─ frontend-admin.yml ├─ frontend-supplier.yml ├─ ai-service.yml └─ docker-build.yml
```

---
# 四、backend.yml
```
name: Backend CIon: push: paths: - "backend/**" pull_request: paths: - "backend/**"jobs: test: runs-on: ubuntu-latest services: postgres: image: postgres:16 env: POSTGRES_USER: mep_user POSTGRES_PASSWORD: mep_password POSTGRES_DB: mep_test ports: - 5432:5432 redis: image: redis:7 ports: - 6379:6379 steps: - uses: actions/checkout@v4 - name: Set up Python uses: actions/setup-python@v5 with: python-version: "3.11" - name: Install backend dependencies working-directory: backend run: | python -m pip install -U pip pip install -e ".[dev]" - name: Run Alembic migrations working-directory: backend env: DATABASE_URL: postgresql+psycopg://mep_user:mep_password@localhost:5432/mep_test REDIS_URL: redis://localhost:6379/0 run: | alembic upgrade head - name: Run tests working-directory: backend env: DATABASE_URL: postgresql+psycopg://mep_user:mep_password@localhost:5432/mep_test REDIS_URL: redis://localhost:6379/0 run: | pytest -q
```

---
# 五、frontend-admin.yml
```
name: Frontend Admin CIon: push: paths: - "frontend-admin/**" pull_request: paths: - "frontend-admin/**"jobs: build: runs-on: ubuntu-latest steps: - uses: actions/checkout@v4 - name: Set up Node uses: actions/setup-node@v4 with: node-version: "20" - name: Install dependencies working-directory: frontend-admin run: npm ci - name: Type check working-directory: frontend-admin run: npm run typecheck - name: Build working-directory: frontend-admin run: npm run build
```

---
# 六、frontend-supplier.yml
```
name: Frontend Supplier CIon: push: paths: - "frontend-supplier/**" pull_request: paths: - "frontend-supplier/**"jobs: build: runs-on: ubuntu-latest steps: - uses: actions/checkout@v4 - name: Set up Node uses: actions/setup-node@v4 with: node-version: "20" - name: Install dependencies working-directory: frontend-supplier run: npm ci - name: Type check working-directory: frontend-supplier run: npm run typecheck - name: Build working-directory: frontend-supplier run: npm run build
```

---
# 七、ai-service.yml
```
name: AI Service CIon: push: paths: - "ai-service/**" pull_request: paths: - "ai-service/**"jobs: test: runs-on: ubuntu-latest services: redis: image: redis:7 ports: - 6379:6379 steps: - uses: actions/checkout@v4 - name: Set up Python uses: actions/setup-python@v5 with: python-version: "3.11" - name: Install AI service dependencies working-directory: ai-service run: | python -m pip install -U pip pip install -e ".[dev]" - name: Run tests working-directory: ai-service env: REDIS_URL: redis://localhost:6379/0 run: | pytest -q
```

---
# 八、docker-build.yml
```
name: Docker Buildon: push: branches: - mainjobs: docker: runs-on: ubuntu-latest steps: - uses: actions/checkout@v4 - name: Build backend image run: docker build -t mep-backend:latest ./backend - name: Build ai-service image run: docker build -t mep-ai-service:latest ./ai-service - name: Build admin frontend image run: docker build -t mep-frontend-admin:latest ./frontend-admin - name: Build supplier frontend image run: docker build -t mep-frontend-supplier:latest ./frontend-supplier
```

---
# 九、建议增加的质量检查
| 类型         | 工具                    |
|------------|-----------------------|
| Python格式化  | ruff                  |
| Python类型检查 | mypy                  |
| 安全扫描       | bandit                |
| 前端Lint     | eslint                |
| 前端类型检查     | tsc                   |
| 依赖漏洞       | pip-audit / npm audit |
| Docker扫描   | trivy                 |


---
# 十、推荐 Makefile
```
up: docker compose up -ddown: docker compose downlogs: docker compose logs -fmigrate: docker compose exec backend alembic upgrade headtest-backend: cd backend && pytest -qtest-ai: cd ai-service && pytest -qbuild-admin: cd frontend-admin && npm run buildbuild-supplier: cd frontend-supplier && npm run build
```

联调可参考后端 **`GET /health`**、**`GET /health/ready`** 及 **`checks.alembic_version`**；说明见《Docker部署与环境配置设计》**第十一章**。CI 在 **`alembic upgrade head`** 后执行 **`pytest`** 时，`alembic_version` 在 PostgreSQL 上一般为具体迁移版本摘要。

---
# 十一、分支策略
建议：
| 分支        | 用途   |
|-----------|------|
| main      | 稳定版本 |
| develop   | 日常开发 |
| feature/* | 功能开发 |
| hotfix/*  | 紧急修复 |
| release/* | 发布准备 |


---
# 十二、发布版本规范
建议：
```
v1.0.0v1.1.0v1.1.1
```

规则：
| 类型   | 含义        |
|------|-----------|
| 主版本  | 架构或重大功能变化 |
| 次版本  | 新功能       |
| 修订版本 | Bug修复     |


---
# 十三、下一步建议
继续进入：
# 《PostgreSQL索引与性能优化设计 V1.0》