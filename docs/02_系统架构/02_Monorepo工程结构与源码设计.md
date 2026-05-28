# 项目源码工程结构设计 V1.0（Monorepo）

# 《项目源码工程结构设计 V1.0》
# Monorepo Engineering Architecture
现在开始进入：
# “真正可落地开发”
这一部分决定：
  * 后期是否容易维护
  * 是否容易扩展
  * 是否容易AI集成
  * 是否容易微服务拆分
  * 是否容易多人协作
  * 是否容易CI/CD


你的技术栈：
  * Python 3.11
  * FastAPI
  * PostgreSQL 16
  * Redis 7
  * React + TypeScript
  * Docker
  * GitHub Actions


非常适合：
# Monorepo + 模块化单体
---
# 一、总体工程结构
建议：
```
H-MELC/├─ backend/├─ frontend-admin/├─ frontend-mobile/├─ ai-service/├─ docs/├─ deploy/├─ scripts/├─ .github/├─ docker-compose.yml├─ Makefile└─ README.md
```

---
# 二、为什么必须 Monorepo
你的系统：
  * AI
  * 主业务
  * 供应商门户
  * 小程序
  * 移动端
  * 工作流


关联极强。
如果一开始拆：
# 多仓库
后期：
  * API版本失控
  * DTO不一致
  * 权限混乱
  * 部署困难


---
# 三、Backend 结构（核心）
建议：
```
backend/├─ app/│├─ main.py│├─ core/├─ db/├─ middleware/├─ common/├─ modules/├─ integrations/├─ ai/├─ workflows/├─ tasks/├─ websocket/├─ tests/└─ alembic/
```

---
# 四、core 核心层
```
core/├─ config.py├─ security.py├─ permissions.py├─ logging.py├─ audit.py├─ exceptions.py├─ constants.py├─ enums.py└─ lifecycle.py
```

负责：
  * 配置
  * JWT
  * 权限
  * 生命周期
  * 系统常量
  * 错误处理


---
# 五、db 数据层
```
db/├─ base.py├─ session.py├─ init_db.py├─ types.py└─ repositories/
```

---
# repositories 模式（建议）
不要：
# controller直接操作ORM
建议：
```
API→ Service→ Repository→ DB
```

这样后期：
  * AI
  * 审计
  * 缓存
  * 事件总线


容易插入。
---
# 六、modules 业务模块
核心。
建议：
```
modules/├─ asset/├─ repair/├─ maintenance/├─ calibration/├─ supplier/├─ finance/├─ workflow/├─ knowledge/├─ audit/├─ dashboard/└─ mdm/
```

---
# 七、每个模块内部结构（标准化）
例如：
```
modules/repair/├─ api/├─ service/├─ repository/├─ models/├─ schemas/├─ enums/├─ tasks/├─ workflows/├─ ai/└─ utils/
```

---
# 八、为什么这样设计
后期：
例如：
repair/
完全可以拆成：
# repair-service
不用重构。
---
# 九、FastAPI 路由结构
建议：
```
/api/v1
```

继续细分：
```
/api/v1/assets/api/v1/repairs/api/v1/finance/api/v1/suppliers/api/v1/ai
```

---
# 十、Schema 设计规范（重要）
严格：
# Pydantic DTO
分层：
```
schemas/├─ create.py├─ update.py├─ response.py└─ query.py
```

不要一个 schema 什么都干。
---
# 十一、Service层（核心）
Service：
# 负责业务逻辑
例如：
```
RepairService.create_order()
```

内部：
  * 创建工单
  * 生成事件
  * 写审计日志
  * 创建AI任务
  * 推送通知
  * 更新设备状态


---
# 十二、事件总线设计（重要）
你这个系统：
# 必须事件化。
---
# 建议：
```
common/events/
```

---
# 示例：
```
RepairOrderCreatedEventInvoiceUploadedEventPaymentCompletedEventAssetStatusChangedEvent
```

---
# 十三、Redis 消息队列用途
建议：
# 轻量级异步优先
一期：
Redis Queue / Celery 都可以。
---
# 异步任务：
| 任务    | 是否异步 |
|-------|------|
| OCR   | 是    |
| AI分析  | 是    |
| 报告生成  | 是    |
| 消息通知  | 是    |
| PDF生成 | 是    |
| ROI分析 | 是    |


---
# 十四、AI Service 独立（重要）
建议：
```
ai-service/├─ agents/├─ rag/├─ prompts/├─ embeddings/├─ ocr/├─ multimodal/├─ workflows/└─ api/
```

---
# 十五、AI Service 不直接写业务库
这是：
# 极重要原则。
AI：
只能：
```
返回分析结果
```

业务系统确认后：
再更新业务状态。
---
# 十六、知识库工程结构
```
knowledge/├─ ingestion/├─ chunking/├─ embedding/├─ retrieval/├─ ranking/└─ citations/
```

---
# 十七、前端结构（管理端）
```
frontend-admin/├─ src/│├─ pages/├─ layouts/├─ components/├─ hooks/├─ stores/├─ api/├─ permissions/├─ routes/├─ styles/└─ utils/
```

**与当前仓库对齐（一期）**：使用 **Vite**，顶层路由在 **`src/App.tsx`**（`react-router-dom`），HTTP 封装 **`src/lib/api.ts`**，业务请求 **`src/api/*.ts`**，侧栏菜单 **`src/navigation/menu.ts`**（对应 **`docs/05_前端设计/01`**）。已实现页面与 **`docs/06`** 映射的索引见 **`docs/05_前端设计/03_PC管理端一期实现对照.md`**。

---
# 十八、状态管理建议
推荐：
# Zustand
比 Redux 更轻。
---
# 十九、UI 组件建议
推荐：
| 类型  | 建议              |
|-----|-----------------|
| UI  | shadcn/ui       |
| 图标  | lucide-react    |
| 图表  | echarts         |
| 表格  | TanStack Table  |
| 表单  | react-hook-form |


---
# 二十、供应商门户建议独立前端
```
frontend-supplier/
```

原因：
  * 权限完全不同
  * 风格不同
  * 安全隔离


---
# 二十一、移动端建议
一期：
# H5 + PWA
不要急着：
原生APP。
---
# 二十二、WebSocket（重要）
用于：
  * 工单实时更新
  * 消息通知
  * AI任务进度
  * 竞价状态


---
# 二十三、文件服务设计
```
common/file-service/
```

统一：
  * 上传
  * 下载
  * 权限
  * 预览
  * 水印
  * hash
  * 病毒扫描


---
# 二十四、审计中间件（关键）
所有接口：
自动：
  * 记录用户
  * IP
  * before/after
  * 操作时间


---
# 二十五、权限中间件（关键）
建议：
# RBAC + 数据范围
例如：
```
@require_permission("repair.order.assign")
```

---
# 二十六、配置管理
建议：
# Pydantic Settings
结构：
```
.env.env.dev.env.test.env.prod
```

---
# 二十七、Docker 结构
```
deploy/├─ nginx/├─ postgres/├─ redis/├─ minio/├─ backend/├─ ai-service/└─ compose/
```

---
# 二十八、GitHub Actions（CI）
建议：
```
.github/workflows/├─ backend.yml├─ frontend.yml├─ ai.yml└─ deploy.yml
```

---
# 二十九、测试结构
```
tests/├─ unit/├─ integration/├─ e2e/└─ performance/
```

---
# 三十、必须增加：
# fixtures
医院系统：
测试数据非常重要。
---
# 三十一、API 文档
FastAPI：
自动：
# OpenAPI
建议：
  * 内部API
  * 外部供应商API


分离。
---
# 三十二、日志体系（重要）
必须：
# 结构化日志
推荐：
```
{ "event": "repair_created", "user_id": "...", "asset_id": "...", "timestamp": "..."}
```

---
# 三十三、下一步强烈建议
进入：
# 《AI Prompt体系与Agent设计规范》
因为你系统已经：
# AI深度嵌入业务。
必须提前定义：
  * Prompt模板
  * Agent边界
  * AI输出格式
  * 医疗安全约束
  * 多模态策略
  * AI审批限制
  * AI引用规范
  * AI知识库检索规范


否则后期AI会越来越混乱。