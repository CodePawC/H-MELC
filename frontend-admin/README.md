# H-MELC 管理端（PC）

**技术栈**：React 19 · TypeScript · Vite 8 · **Ant Design 5** · **Ant Design Pro Components**（`ProLayout` / `ProTable`）· Axios · Zustand · ECharts（`echarts-for-react`）。整体 UI 取向：**企业级后台**（医疗科技蓝主色 `#1677ff`，深色侧栏，浅灰内容区 `#f5f7fa`，白底卡片）。

## 已实现（Phase 1 骨架）

- 统一走后端 **`/api/v1`**：`src/lib/api.ts` 解析 `{ code, message, data }`，并兼容 FastAPI **`{ detail }`** 报错体。
- **院内登录** `POST /api/v1/auth/login`，JWT 存 **`localStorage`**（`src/lib/token.ts`）。
- **设备台账分页** `GET /api/v1/assets`（需后端 PostgreSQL + `asset` 迁移；SQLite/未迁库时接口可能 **503**，页面提示文案承接）。
- **左侧菜单**：按 **`docs/05_前端设计/01`** 分组；与 **`docs/06_接口设计`** 已对接的页面包括（其余仍为占位）：
  - 设备台账列表与 **设备详情** `GET /assets/{id}`（标签：概览 / 一机一码 / 维修摘要 / 扩展占位）
  - 主数据字典 **`/mdm/category-entries`**（分类条目检索与新建；读 **RBAC_ASSET_READ** / 写 **RBAC_ASSET_WRITE**；**e006**）
  - 工作流 `GET/POST /workflows`（§八：发起、我的待办、同意/驳回；需 PostgreSQL **e008**）
  - 知识库：各子菜单共用 **`GET /knowledge/documents`** 列表 + **`/knowledge/documents/{id}`** 详情；列表页可 **`POST /knowledge/documents`** 上传（`multipart`，需 **RBAC_KNOWLEDGE_WRITE**）；**智能问答** 页可调 **`POST /knowledge/chat`**（**e007**）
  - 报修：**工单列表**（多条件筛选 + **地址栏查询同步** `?asset_id=` 等，可从设备详情维修标签链入）+ **工单详情** `GET /repairs/{id}`（概览 / 附件 / 过程 / 报告 / **运维动作**：抢单、派单、过程记录、结案、科室确认、外修/返厂标记，对应 docs/06 §二·4～8 与 §三·1～2）；设备详情「维修记录」中的工单号链到该详情
  - AI 中心菜单共用网关页：创建占位任务、按 ID 查任务/结果（**§六**）
  - **接口配置** 并联探测 `workflows`、`mdm`、`suppliers`、`ai`、`knowledge`、`finance` 模块根响应
- 工作台：设备/报修 **`total` 列表快照** + **Statistic / ECharts 示意**（无统计服务时的折中）
- **ProLayout**：左侧深色分组菜单（可折叠）、顶栏用户下拉与退出、内容区 24px 内边距
- 设备台账列表已用 **ProTable**（查询、刷新、密度、列设置、localStorage 列状态）
- 顶栏展示 **`/auth/me` 角色** 摘要
  - 另：发票/应付/付款/账龄与付款优先级 AI、供应商档案/资质/竞价、审计日志等（见历次迭代）
- 各页所需 **RBAC** 以后端为准（如财务 `RBAC_FINANCE_READ`、审计 `AUDIT_ADMIN`/`SYS_ADMIN`、报修 `RBAC_REPAIR_READ` 等）；权限不足时接口返回 **403**，页面展示错误文案。
- 旧路径 **`/assets`** 重定向至 **`/lifecycle/assets`**。

## 本地开发

```bash
cd frontend-admin
cp .env.example .env   # 默认关闭 Mock（`VITE_AUTH_MOCK=false`），按需改 API 地址
npm install
npm run dev            # 默认 http://127.0.0.1:5102
```

后端需在本机启动（`cd backend` 后 **`python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8102`**；Windows 未激活 venv 时勿直接敲 `uvicorn`）。**本地开发**推荐 `.env` 中 **`VITE_API_BASE_URL` 留空**：请求走 `http://127.0.0.1:5102/api/...`，由 Vite 代理到后端，避免浏览器直连 8102 未启动时的 `ERR_NETWORK`。生产或需跨域直连时再填写完整 API 根 URL。

院内账号须在 PostgreSQL 下预置（如 `backend/scripts/create_identity_user.py`），且具有设备台账可读角色（测试账号常用 `DEVICE_ADMIN` 等）。

**Mock 登录**（仅本地离线演示）：在 `.env` 中设置 `VITE_AUTH_MOCK=true`，此时不走后端 JWT，`fetchMe` 读会话缓存；对接真实环境时请保持 `false`。

**网关 API Key**：若接口前有 API 网关并返回 `API Key invalid or missing`：① 浏览器直连 `VITE_API_BASE_URL` 时配置 `VITE_API_KEY`（头名默认 `X-API-Key`，可改 `VITE_API_KEY_HEADER`）；② **本地走 Vite `/api` 代理**时推荐配置 `API_PROXY_GATEWAY_KEY`（及可选 `API_PROXY_GATEWAY_HEADER`），由开发服务器在转发时注入请求头，密钥不会进前端打包。改 `.env` 后须重启 `npm run dev`。具体头名以网关文档为准。

## 生产构建

```bash
npm run build
# 产出 dist/，可由 Nginx 托管；API 仍为独立域名或前缀反代。
```
