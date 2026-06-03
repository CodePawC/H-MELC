# H-MELC 医院医学装备全生命周期闭环管理平台

## 项目名称

- 正式中文名称：医院医学装备全生命周期闭环管理平台
- 英文名称：Hospital Medical Equipment Lifecycle Closed-loop Management Platform
- 项目简称：H-MELC
- 当前迁移版本：v0.1.0+20260527.017
- 历史内部代号：医学装备运营OS
- 历史目录/旧项目名：medical-equipment-platform

## 项目定位

H-MELC 面向医学装备管理业务，覆盖设备从申请论证、采购验收、建档使用、维修保养、计量监管、效益评价到报废处置的全生命周期闭环。

H-MELC 默认使用 `MASTER_DATA_MODE=hybrid` 混合模式，优先消费 H-UMDG 医院统一主数据治理平台，并保留本地缓存和业务快照；不部署 H-UMDG 时可显式切换为 `local` 独立运行。

## 功能概览

- 设备资产台账、资产建档、资产标签和档案管理
- 采购申请、论证、项目、合同、验收和财务关联
- 维修报修、派工、维修记录、费用和闭环确认
- 预防性保养计划、任务、执行记录和异常闭环
- 计量计划、计量证书、到期预警和监管记录
- 供应商门户、供应商资质、采购协同、发票、应付和付款进度
- 往来单位角色、科室、人员、设备分类等基础数据引用、快照和本地兜底
- AI 辅助建档、OCR 占位抽取、分类匹配、资料补全和人工审核
- 运营看板、风险监管、效益分析和审计追溯
- 接口接入中心，配置外部系统、接口端点、字段映射、校验规则、同步任务和运行日志
- 可选接入 H-UMDG，支持 `local`、`remote/service`、`hybrid` 三种主数据来源模式

## 项目结构

```text
H-MELC/
├─ backend/                 # FastAPI 后端
├─ frontend-admin/          # PC 管理端；当前也承载 /supplier-portal/* 供应商门户页面
├─ frontend-mobile/         # 移动扫码与标签补打 H5
├─ frontend-supplier/       # 仅 .gitkeep，占位预留；当前门户在 frontend-admin
├─ ai-service/              # 仅 .gitkeep，占位预留；正式 RAG / 异步推理后续承接
├─ docs/                    # 需求、架构、接口、测试、部署和规范文档
├─ deploy/                  # 当前仅 nginx 预留；Compose 在仓库根 docker-compose.yml
├─ scripts/                 # 历史对话整理辅助脚本；不是运行初始化/导入入口
└─ storage/                 # 本地上传、日志、备份、数据库目录
```

## 运行环境

- Python：3.11 或更高版本
- Node.js：CI 使用 Node.js 22；本地建议使用与 CI 兼容的当前稳定版本
- npm：随 Node.js 安装
- 管理端前端栈：React 19、Vite 8、TypeScript 6、Ant Design 5、Ant Design Pro Components、Axios、Zustand、ECharts
- 移动端前端栈：Vite 8、TypeScript 6、qrcode
- 数据库：**PostgreSQL 是硬性要求**。本地开发必须通过 `docker compose up -d postgres` 启动或配置自己的 PG 实例
- Redis：可选，配置 `REDIS_URL` 后 `/health/ready` 检查可达性
- MinIO 或兼容对象存储：可选，配置后用于文件归档和上传管理

## 安装步骤

后端：

```powershell
cd backend
python -m pip install -e ".[dev]"
```

PC 管理端：

```powershell
cd frontend-admin
npm install
```

首次运行前，请根据对应服务目录的 `.env.example` 创建本地配置。标准命令下，后端读取 `backend/.env`，管理端读取 `frontend-admin/.env` / `.env.local`，移动端读取 `frontend-mobile/.env` / `.env.local`。根目录 `.env.example` 是统一参考，不会被这些命令自动加载。后端细节见 `backend/README.md`。真实配置不要提交到 Git。

## 环境变量说明

根目录 `.env.example` 提供统一参考；实际运行配置应放在各服务目录的本地 env 文件中。

| 变量 | 默认/示例 | 说明 |
| --- | --- | --- |
| `APP_NAME` | `H-MELC` | 应用简称 |
| `APP_DISPLAY_NAME` | `医院医学装备全生命周期闭环管理平台` | 中文显示名称 |
| `APP_ENV` | `development` | 运行环境 |
| `SERVER_PORT` | `8102` | 后端服务端口 |
| `FRONTEND_PORT` | `5102` | 前端开发端口 |
| `DATABASE_URL` | 未设置或 PostgreSQL URL | 数据库连接字符串；不设置时使用代码默认 `sqlite:///./local.db`，不要保留空值 |
| `UPLOAD_DIR` | `./storage/uploads` | 上传文件目录 |
| `LOG_DIR` | `./storage/logs` | 日志目录 |
| `BACKUP_DIR` | `./storage/backups` | 备份目录 |
| `REDIS_URL` | `redis://127.0.0.1:16379/0` | Redis 地址；使用本仓库 compose 依赖时为宿主映射端口 |
| `MINIO_ENDPOINT` | `127.0.0.1:9002` | 宿主机直跑后端时的 MinIO API 地址；compose backend 容器内使用 `minio:9000` |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | `minioadmin` / `minioadmin123` | 本地 MinIO 访问凭据，生产必须替换 |
| `MINIO_BUCKET` / `MINIO_SECURE` / `MINIO_REGION` | `mep-files` / `false` / 空 | 对象存储桶名、是否使用 TLS 和可选区域 |
| `CORS_ORIGINS` | 管理端 `5102`、移动端 `5175` | 浏览器直连后端时允许的前端源；本地走 Vite 代理通常不需要改 |
| `JWT_SECRET_KEY` / `JWT_ALGORITHM` | 开发默认密钥 / `HS256` | JWT 签名配置；生产必须设置强随机 `JWT_SECRET_KEY` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `720` | 访问令牌有效期，单位分钟 |
| `MASTER_DATA_MODE` | `hybrid` | 主数据来源模式：`local`、`remote`、`hybrid`；`remote` 在代码内部归一为 `service` |
| `MASTER_DATA_PROVIDER` / `MASTER_DATA_AUTH_TYPE` | `h-umdg` / `api_key` | 标准主数据来源标识和认证方式 |
| `MASTER_DATA_BASE_URL` | `http://127.0.0.1:8101` | 推荐的新配置名，H-UMDG API 地址，`hybrid` / `remote` 使用 |
| `MASTER_DATA_API_KEY` | 本地开发密钥 | 推荐的新配置名，H-UMDG API 访问令牌 |
| `MASTER_DATA_TIMEOUT` | `5000` | 调用标准主数据服务超时，单位毫秒 |
| `MASTER_DATA_CACHE_ENABLED` | `true` | 是否启用主数据缓存 |
| `MASTER_DATA_CACHE_TTL` | `3600` | 推荐的新配置名，主数据缓存 TTL，单位秒 |
| `MASTER_DATA_ALLOW_LOCAL_OVERRIDE` / `MASTER_DATA_ALLOW_TEMP_MAINTAIN` | `false` / `true` | 是否允许本地覆盖标准主数据、是否允许临时维护本地基础数据 |
| `MASTER_DATA_CONFLICT_STRATEGY` / `MASTER_DATA_QUALITY_CHECK_ENABLED` | `standard_first` / `true` | 主数据冲突处理策略和质量检查开关 |
| `UMDG_API_BASE_URL` / `UMDG_API_TOKEN` | 空 | 兼容旧配置名，新部署优先使用 `MASTER_DATA_BASE_URL` / `MASTER_DATA_API_KEY` |
| `MASTER_DATA_CACHE_TTL_SECONDS` / `HMDM_*` | 空或旧值 | 历史兼容配置，新部署不优先使用 |
| `VITE_API_BASE_URL` | 空 | 管理端 API 根地址；本地开发推荐留空，浏览器请求同源 `/api/...` 并由 Vite 代理转发 |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8102` | 仅当 `VITE_API_BASE_URL` 为空时生效，Vite dev server 将 `/api`、`/screen-api` 代理到此后端 |
| `VITE_AUTH_MOCK` | `false` | 是否启用前端认证模拟 |
| `VITE_API_KEY` / `VITE_API_KEY_HEADER` | 空 / `X-API-Key` | 浏览器直连 API 网关时的可选固定网关 Key；会进入前端运行环境 |
| `API_PROXY_GATEWAY_KEY` / `API_PROXY_GATEWAY_HEADER` | 空 / `X-API-Key` | 本地走 Vite 代理时由 Node dev server 注入请求头，不进入浏览器打包 |

## 启动命令

后端：

```powershell
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8102
```

PC 管理端：

```powershell
cd frontend-admin
npm run dev
```

构建与测试：

```powershell
cd frontend-admin
npm run build

cd ..\backend
pytest -q

cd ..\frontend-mobile
npm run build
```

管理端与移动端 `npm run build` 均实际执行 `tsc -b && vite build`；CI 分别通过 `frontend-admin` 与 `frontend-mobile` job 执行 `npm ci` 后构建。

## 默认端口

- H-MELC PC 管理端：`http://127.0.0.1:5102`
- H-MELC 后端 API：`http://127.0.0.1:8102`

`GET /health/ready` 会检查数据库；配置了 `REDIS_URL`、MinIO 凭据时也会检查 Redis 和 MinIO。仅做纯 SQLite/无对象存储演示时，不要设置这些依赖变量，否则依赖不可达会使 `ready` 返回 503。

## 默认联调模式

本地默认按 H-UMDG + H-MELC 闭环运行：

```env
MASTER_DATA_MODE=hybrid
MASTER_DATA_PROVIDER=h-umdg
MASTER_DATA_BASE_URL=http://127.0.0.1:8101
MASTER_DATA_AUTH_TYPE=api_key
MASTER_DATA_API_KEY=hudmp-equipment-os-dev-20260525
MASTER_DATA_TIMEOUT=5000
MASTER_DATA_CACHE_ENABLED=true
MASTER_DATA_CACHE_TTL=3600
```

混合模式下：

- 优先调用 H-UMDG 人员、科室、空间位置、分类、通用名称、品牌型号、注册证、UDI、往来单位等权威主数据。
- H-UMDG 短暂不可用时使用本地缓存或业务快照兜底，已有设备档案仍可查看。
- 用户可在“主数据来源设置”页面调整 URL、API Key、模式、缓存 TTL，并导出对接包。

## 独立部署说明

只部署 H-MELC 且暂不接入 H-UMDG 时，显式使用本地模式：

```env
MASTER_DATA_MODE=local
MASTER_DATA_BASE_URL=
MASTER_DATA_API_KEY=
UMDG_API_BASE_URL=
UMDG_API_TOKEN=
```

本地模式下：

- 不需要启动 H-UMDG。
- H-MELC 后端和前端可独立启动。
- 往来单位及角色、科室、人员、设备分类、耗材、医保编码等基础数据使用 H-MELC 本地兜底能力；接入 H-UMDG 后仍以标准主数据为准。
- 业务记录仍应保存主数据来源、编码和名称快照，来源可标识为 `local`。

## 集成部署说明

H-MELC 可选接入 H-UMDG。接入方式通过 Master Data Adapter / `masterDataService` 完成，业务模块不得硬编码 H-UMDG 地址，也不得直接读取 H-UMDG 数据库。

远程模式：

```env
MASTER_DATA_MODE=remote
MASTER_DATA_BASE_URL=http://127.0.0.1:8101
MASTER_DATA_AUTH_TYPE=api_key
MASTER_DATA_API_KEY=hudmp-equipment-os-dev-20260525
```

`remote` 是文档模式名称，H-MELC 后端代码会归一为 `service`；试点生产过渡期推荐优先使用 `hybrid`。

混合模式：

```env
MASTER_DATA_MODE=hybrid
MASTER_DATA_BASE_URL=http://127.0.0.1:8101
MASTER_DATA_AUTH_TYPE=api_key
MASTER_DATA_API_KEY=hudmp-equipment-os-dev-20260525
MASTER_DATA_CACHE_ENABLED=true
MASTER_DATA_CACHE_TTL=3600
```

模式说明：

- `remote`：文档模式名称；后端代码会归一为 `service`，优先并依赖 H-UMDG 返回权威主数据。
- `hybrid`：优先调用 H-UMDG，调用失败时使用本地缓存或本地基础数据兜底，保证核心业务不中断。
- H-MELC 只保存主数据引用和业务时点快照，不把 H-UMDG 作为业务流程运行的强依赖。

## 常见问题

**不部署 H-UMDG，H-MELC 能运行吗？**

可以。将 `MASTER_DATA_MODE=local` 后，H-MELC 使用本地基础数据维护模块运行；默认交付配置为 `hybrid`，用于和 H-UMDG 尽快形成闭环。

**为什么不要在业务代码里直接调用 H-UMDG？**

为了保证 H-MELC 可独立部署，也方便在 `local`、`remote`、`hybrid` 之间切换，业务模块应通过 Master Data Adapter 或 `masterDataService` 获取主数据。

**`.env`、`.env.local` 能提交吗？**

不能。真实数据库密码、API Token、对象存储密钥等只放在本地配置或部署平台密钥中。

**后端测试失败提示需要 Alembic 怎么办？**

说明当前数据库 schema 未升级。请先备份数据库，再在 `backend` 目录执行对应 Alembic 迁移。

## 版本记录

- 当前版本：`v0.1.0+20260527.017`
- 版本文件：`VERSION.md`
- 变更记录：`CHANGELOG.md`
- 初始 Git tag：`v0.1.0+20260527.017`

## 开源协议

本项目基于 [MIT License](LICENSE) 开源。Copyright (c) 2026 CodePawC。

## 开源说明

当前项目尚未确定正式开源协议，见 `LICENSE_PENDING.md`。未经授权不得用于商业分发。

开源前请检查：

- `.env` / `.env.local`
- API Key、数据库密码、对象存储密钥
- 真实患者或医院敏感数据
- 上传文件、日志、备份、数据库文件
- 第三方 SDK、驱动、示例文件的再分发授权
- README、安装部署文档、版本记录和 License 状态
