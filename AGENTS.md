# 代理说明（医院医学装备数字化治理平台）

本仓库协作时请以 **`docs/`** 为优先级最高的需求与设计来源。

- **文档颗粒度与对齐**：`docs/00_项目总览/06_文档颗粒度与对齐矩阵.md`（需求、接口、前端实现、测试验收的同步规则）。
- **接口契约**：`docs/06_接口设计/01_API接口设计.md`（前缀 `/api/v1`，响应信封 `{code,message,data}`）。
- **PC管理端已实现与接口映射**：`docs/05_前端设计/03_PC管理端一期实现对照.md`（随 `frontend-admin` 迭代更新）。
- **前端架构**：`docs/05_前端设计/04-前端架构设计.md`（技术栈/组件库/目录结构/样式系统/数据流/路由/认证/复用规则/实施计划）。
- **开发与本地环境**：`docs/09_实施上线/02_开发实施指南.md`。
- **运行与基础设施**：`docs/07_部署运维/01_Docker部署与环境配置设计.md`（含 **`/health` / `/health/ready`** 探针与 **`checks.alembic_version`** 说明）、`docker-compose.yml`、`backend/.env.example`、`backend/README.md`。
- **测试**：后端在 `backend/tests/`；与文档对齐的契约用例文件名含 `contract`/`doc`。

本地开发：**后端**进入 `backend`，按 `backend/README.md` 配置 `.env` 后执行 `pip install -e ".[dev]"`、`pytest -q`，本地联调端口为 `8102`；完整业务能力需 PostgreSQL 并执行 `alembic upgrade head`。**管理端前端**进入 `frontend-admin`，见该目录 `README.md`（`npm install`、`npm run dev`，默认监听 `http://127.0.0.1:5102`，通过 `VITE_API_PROXY_TARGET=http://127.0.0.1:8102` 代理后端，默认 **`VITE_AUTH_MOCK=false`** 走后端登录与会话）。当前供应商门户页面也在 `frontend-admin` 的 `/supplier-portal/*` 路由中，`frontend-supplier` 仍为独立前端预留。

## 统一身份认证

H-MELC 支持两种认证模式（`backend/.env` 中配置 `AUTH_MODE`）：

| 模式 | 说明 |
|------|------|
| `standalone`（默认） | 本地 `identity.app_user` + JWT，完全独立 |
| `unified` | 接受 H-UMDG 统一身份 JWT，`systems.H-MELC.roles` 作为角色来源 |

**JWT 兼容性**：两种模式下签发的 JWT 格式不同，但验证入口 `deps.py` 自动适配。
**SSO 跳转**：H-MELC 前端 `main.tsx` 注册了 `postMessage` 监听器，
          可从 H-UMDG 统一工作台接收 JWT 并自动登录，无需输入密码。

详细方案见 H-UMDG 仓库 `docs/08-architecture/主数据驱动统一身份与权限管理方案.md`。
