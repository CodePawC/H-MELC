# 代理说明（医院医学装备数字化治理平台）

本仓库协作时请以 **`docs/`** 为优先级最高的需求与设计来源。

- **文档颗粒度与对齐**：`docs/00_项目总览/06_文档颗粒度与对齐矩阵.md`（需求、接口、前端实现、测试验收的同步规则）。
- **接口契约**：`docs/06_接口设计/01_API接口设计.md`（前缀 `/api/v1`，响应信封 `{code,message,data}`）。
- **PC管理端已实现与接口映射**：`docs/05_前端设计/03_PC管理端一期实现对照.md`（随 `frontend-admin` 迭代更新）。
- **开发与本地环境**：`docs/09_实施上线/02_开发实施指南.md`。
- **运行与基础设施**：`docs/07_部署运维/`（含 **十一章** **`/health` / `/health/ready`** 探针与 **`checks.alembic_version`** 说明）、`docker-compose.yml`、`backend/.env.example`。
- **测试**：后端在 `backend/tests/`；与文档对齐的契约用例文件名含 `contract`/`doc`。

本地开发：**后端**进入 `backend`，配置 `.env` 后执行 `pip install -e ".[dev]"`、`pytest`。**管理端前端**进入 `frontend-admin`，见该目录 `README.md`（`npm install`、`npm run dev`，默认对接 `http://127.0.0.1:8000`，默认 **`VITE_AUTH_MOCK=false`** 走后端登录与会话）。
