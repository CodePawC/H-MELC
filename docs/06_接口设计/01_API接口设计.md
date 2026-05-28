# API接口设计 V1.0

# 《API接口设计 V1.0》
采用统一前缀：
```
/api/v1
```

建议所有接口统一返回：
```
{ "code": 0, "message": "success", "data": {}}
```

---
# H-UMDG 外部系统边界

H-UMDG（医院统一主数据治理平台）是另一个系统，负责设备分类目录、设备标准名称、医疗器械分类目录、监管属性、厂商机构标准身份、厂商关系和外部查询 API。

医院医学装备全生命周期闭环管理平台（H-MELC）只负责调用 H-UMDG、保存引用字段和必要快照、维护只读缓存和候选申请，不在本系统中维护设备分类、设备标准名称、医疗器械分类目录或厂商机构主数据的权威库。

一句话边界：H-UMDG 决定“设备叫什么、归哪类、监管属性是什么、厂家/供应商是谁”；H-MELC 决定“这台设备在哪里、谁用、怎么修、怎么保养、怎么计量、谁供货、开什么票、付多少钱”。

H-UMDG 接入配置：

| 配置项 | 说明 |
|--------|------|
| `HMDM_BASE_URL` | H-UMDG 外部服务地址 |
| `HMDM_API_KEY` | 外部调用 API Key |
| `HMDM_TIMEOUT` | 外部调用超时秒数 |
| `HMDM_CACHE_TTL` | 本地只读缓存 TTL |
| `HMDM_ENABLE_CACHE` | 是否启用缓存 |
| `HMDM_FALLBACK_TO_CACHE` | 外部不可用时是否允许缓存降级 |

---
# 一、设备台账接口
## 1\. 查询设备列表
```
GET /api/v1/assets
```

参数：
| 参数            | 说明          |
|---------------|-------------|
| keyword       | 设备名称/编码/序列号 |
| department_id | 科室          |
| category_code | 分类          |
| main_status   | 状态          |
| risk_level    | 风险等级        |
| page          | 页码          |
| page_size     | 每页数量        |


---
## 2\. 查询设备详情
```
GET /api/v1/assets/{asset_id}
```

返回：
  * 基础信息
  * 当前状态
  * 二维码
  * 生命周期事件
  * 维修记录
  * PM记录
  * 计量记录
  * 附件档案
  * AI健康评分
  * H-UMDG 引用信息：设备分类编码/名称、设备标准名称编码/名称、监管大类、一级产品类别、二级产品类别、管理类别、生产厂家/供应商/售后/维保服务商机构编码与名称快照
  * 数据治理信息：当前主数据来源、历史治理编码、OS 设备编码、固定资产/HIS/SPD 关联编码、最近同步时间、同步状态、数据质量评分、字段完整率、映射完成率、冲突记录、版本记录


---
## 3\. 新增设备
```
POST /api/v1/assets
```

用于具体设备入库、验收、建档。设备新增、验收、建档、二维码生成、附件资料维护均在 H-MELC 中完成；设备分类、设备标准名称、医疗器械分类目录监管信息、生产厂家、供应商、售后服务商等基础主数据从 H-UMDG 外部 API 引用。

说明：H-MELC 保存 H-UMDG 返回的引用字段和必要快照，不把设备分类、设备标准名称、医疗器械分类目录或厂商机构写成本系统权威库。找不到标准数据时，仅提交候选申请，后续由 H-UMDG 审核发布。

---
## 4\. 修改设备
```
PUT /api/v1/assets/{asset_id}
```

关键字段修改必须进入本系统审核流程。涉及设备分类、设备标准名称、医疗器械分类目录、厂商机构标准身份等基础主数据时，只更新 H-UMDG 引用字段和快照；找不到标准数据时提交候选申请，后续由 H-UMDG 审核发布。关键字段包括：设备唯一编码、资产编号、品牌、型号、规格、序列号 SN、注册证号、所属科室、供应商快照、生产厂家快照、风险等级快照、计量属性快照、设备状态。

普通字段可以直接保存，并按主数据来源配置决定是否更新本系统业务快照。普通字段包括：安装位置、联系人、使用备注、附件说明、维护说明、标签备注。

---
## 5\. 获取设备二维码信息
```
GET /api/v1/assets/{asset_id}/qrcode
```

---
## 6\. 扫码解析设备
```
POST /api/v1/scan/asset
```

请求：
```
{ "qr_token": "xxxxxx"}
```

返回根据用户权限动态展示入口。

---
## 7\. 获取设备标签打印载荷（精臣 PC Web SDK / 移动巡检端）
```
GET /api/v1/assets/{asset_id}/print-label?template_code=ASSET_QR_50X30_V1
```

用途：PC 管理端“设备档案 / 一机一码”页面与移动巡检端共用的平台标准标签载荷。PC 端浏览器连接本机精臣打印服务 `ws://127.0.0.1:37989` 完成 USB/有线打印机预览与打印（SDK 也保留 WiFi 搜索能力）；移动端用于 H5 预览、系统打印兜底，以及 App / 小程序原生桥接调用精臣移动 SDK 通过蓝牙或 WiFi 连接打印机。后端只生成标签数据，不直连终端打印机。

权限：同设备台账读权限（`RBAC_ASSET_READ`）。

请求参数：
| 参数 | 说明 |
|------|------|
| `template_code` | 可选；模板预设编码，默认 `ASSET_QR_50X30_V1`。前端应先调用 `GET /api/v1/assets/label-templates` 获取可选纸张类型、尺寸与版式。 |

响应 `data` 要点：
| 字段 | 说明 |
|------|------|
| `asset` | `asset_id`、`asset_code`、`asset_name`、`main_status` |
| `qr` | 与 `GET /assets/{asset_id}/qrcode` 对齐，含 `qr_token` |
| `sdk` | 精臣接入元数据：`package_version`、`service_ws_url`、安装提示、集成模式 |
| `template` | 标签模板参数：模板编码/名称、纸张类型、版式编码/名称、宽高（mm）、预览比例、打印浓度、精臣纸张类型、打印模式 |
| `print_data` | 精臣 PC Web SDK 单页打印结构：`InitDrawingBoardParam` 与 `elements[]`；移动端桥接层原样透传 |

错误与就绪：非 PostgreSQL 或台账表未迁移返回 `503`；设备不存在返回 `404`；模板不存在返回 `400`。

### 7a\. 获取设备标签模板预设
```
GET /api/v1/assets/label-templates
```

用途：返回平台统一维护的设备标签纸张类型、纸张尺寸、打印参数和版式预设。PC 管理端与移动巡检端均从该接口选择模板，再调用 `print-label` 获取按模板排版后的打印载荷。

响应 `data` 要点：
| 字段 | 说明 |
|------|------|
| `default_template_code` | 默认模板编码 |
| `items[]` | 模板列表；含 `template_code`、`template_name`、`paper_type_code`、`paper_type_name`、`layout_code`、`layout_name`、`label_width_mm`、`label_height_mm`、`print_density`、`print_label_type`、`print_mode`、`description`。当前包含标准间隙纸模板、60×40 单张适配模板、50×25 热敏/热转印模板，以及 50×20 / 40×30 / 30×20 等辅助版式。 |

移动端桥接约定（非 HTTP，由 App / 小程序 WebView 注入）：

| 方法 | 说明 |
|------|------|
| `window.JcMobilePrinter.scanPrinters({ mode })` | `mode` 为 `BLUETOOTH` 或 `WIFI`，返回可连接打印机数组 |
| `window.JcMobilePrinter.connectPrinter({ mode, printer })` | 原生层通过精臣移动 SDK 连接蓝牙或 WiFi 打印机 |
| `window.JcMobilePrinter.printLabel(job)` | `job.payload` 为本接口返回的完整 `data`，`job.connection` 含连接方式与打印机信息，`job.quantity` 为份数 |

桥接层返回打印机对象建议字段：`id`、`name`、`mode`、`address`、`port`、`model`、`rssi`、`online`。

### 7b\. 查询设备数据治理信息
```
GET /api/v1/assets/{asset_id}/data-governance
```

用于设备详情页“数据治理”Tab。响应 `data` 要点：

| 字段 | 说明 |
|------|------|
| `current_master_source` | 当前主数据来源，设备默认 `MEDICAL_EQUIPMENT_OS` |
| `hudmp_standard_code` | 历史治理编码；新建场景优先使用 H-UMDG 引用字段 |
| `os_asset_code` | 医学装备 OS 设备编码 |
| `fixed_asset_code` | 固定资产编码 |
| `his_mapping_code` | HIS 关联编码 |
| `spd_mapping_code` | SPD 关联编码 |
| `last_sync_at` | 最近同步时间 |
| `sync_status` | `UNSYNCED`、`SYNCING`、`SYNCED`、`FAILED`、`PENDING_REVIEW`、`CONFLICT` |
| `data_quality_score` | 数据质量评分 |
| `field_completeness_rate` | 字段完整率 |
| `mapping_completion_rate` | 映射完成率 |
| `conflicts[]` | 冲突记录：字段、H-MELC 业务值、H-UMDG 引用值、处理策略、状态 |
| `versions[]` | 版本记录：版本号、时间、操作人、动作、摘要 |

### 7c\. 设备删除/停用类动作
```
POST /api/v1/assets/{asset_id}/lifecycle-action
```

设备不允许物理删除。请求体：

| 字段 | 说明 |
|------|------|
| `action` | `VOID` 作废、`DISABLE` 停用、`PENDING_SCRAP` 待报废、`SCRAP` 已报废、`ARCHIVE` 归档、`HIDE` 隐藏 |
| `reason` | 原因 |
| `attachments[]` | 附件 |
| `metadata` | 扩展信息 |

所有状态变化必须保留操作日志、审批记录和版本记录；关键生命周期动作可绑定工作流审批。

--- 
## （工作台）院内首页汇总
```
GET /api/v1/dashboard/hospital-summary
```

权限：**Authorization Bearer**，角色集合与「§一 · 查询设备列表」一致（具备台账读权限即可）。

PostgreSQL 且已完成 **asset / repair** 相关迁移时返回 `code=0`；引擎非 PostgreSQL 或查询失败时返回 **`503`**。

响应 `data` 要点：
| 字段 | 说明 |
|------|------|
| `generated_at` | 汇总生成时间（UTC ISO8601） |
| `assets.total` | 未删除台账总数 |
| `assets.active_count` | `main_status = ACTIVE` 数量 |
| `assets.by_main_status[]` | `code`、`label`、`count` |
| `assets.top_categories[]` | `category_code`、`count`（TOP） |
| `repairs.today_created` | 本自然日新建工单数 |
| `repairs.open_orders` | 未闭环工单（非 `CLOSED`） |
| `repairs.by_order_status[]` | `status`、`label`、`count` |

### 工单趋势（按日聚合）
```
GET /api/v1/dashboard/repair-trend?days=7
```

权限：**Bearer**，与「§二 · 查询维修工单列表」可读角色一致（`RBAC_REPAIR_READ`）。

查询参数：`days`，默认 `7`，范围 `1`～`90`。

PostgreSQL 且 **repair** 域就绪时返回 `code=0`；非 PostgreSQL 或查询失败 **`503`**。

响应 `data` 要点：
| 字段 | 说明 |
|------|------|
| `generated_at` | 生成时间（UTC ISO8601） |
| `days` | 实际统计天数 |
| `labels[]` | 横轴日期标签（`MM-DD`） |
| `reported[]` | 每日「新建工单」数（按 `created_at` 落日） |
| `completed[]` | 每日「完成工单」数（`completed_at` 非空按日落日） |

### 财务付款汇总（柱状图）
```
GET /api/v1/dashboard/finance-payment-summary?days=30
```

权限：**Bearer**，与「§五」财务读权限一致（`RBAC_FINANCE_READ`）。

查询参数：`days`，默认 `30`，范围 `1`～`366`。

PostgreSQL 且 **finance.payable / finance.payment** 就绪时返回 `code=0`；否则 **`503`**。

响应 `data` 要点：
| 字段 | 说明 |
|------|------|
| `generated_at` | 生成时间 |
| `window_days` | 滑动窗口天数 |
| `amount_unit` | 固定 `CNY_WAN`（万元人民币） |
| `bars[]` | `key`、`name`、`value`（浮点万元）；名称顺序与院内首页演示一致：`发票金额`（窗口内新建应付面额之和）、`已付款`（窗口内付款流水合计）、`未付款`（状态 `OPEN` 且尚未付款的应付面额）、`部分付款`（`OPEN` 且部分核销后的余额）、`逾期付款`（`OPEN`、已过 `due_date` 且仍有余额） |

### 待办与工作流任务摘要
```
GET /api/v1/dashboard/workspace-tasks?task_limit=8
```

权限：**Bearer**，与台账读权限一致（`RBAC_ASSET_READ`）。

查询参数：`task_limit`，默认 `8`，范围 `1`～`30`（工作流待办条数上限）。

PostgreSQL 且 **repair / workflow** 就绪时返回 `code=0`；否则 **`503`**。

响应 `data` 要点：
| 字段 | 说明 |
|------|------|
| `generated_at` | 生成时间 |
| `workflow.total` | 当前用户待办任务总数 |
| `workflow.items[]` | `task_id`、`instance_id`、`summary`、`process_key`、`instance_title`、`created_at` |
| `repairs_preview[]` | 未闭环工单预览：`id`（工单 UUID）、`order_code`、`status`、`fault_preview`、`created_at` |

说明：**效益四宫格等**仍可前端演示占位，待专用分析接口补齐。

---
# （公开大屏）数字运营中心

内部管理接口统一位于 `/api/v1/operation-center/*`，用于维护大屏模板、访问密钥、终端与访问日志。

外部只读大屏不使用后台登录态，使用访问密钥鉴权：

```
GET /screen-api/{screen_code}?accessKey={access_key}
WS  /screen-ws/{screen_code}?accessKey={access_key}
```

说明：
| 项 | 说明 |
|----|------|
| `screen_code` | `equipment-overview`、`equipment-status`、`repair-dispatch`、`qc-meter-alert`、`medical-gas`、`spd-consumables`、`supplier-payment`、`carousel` |
| REST 响应 | `{code,message,data}`；`data` 含 `screen`、`generated_at`、`refresh_interval_seconds`、`kpis[]`、`charts[]`、`tables[]` 等 |
| WebSocket 首帧/推送 | 与 REST 同源 payload，同样使用 `{code,message,data}` 信封 |
| 鉴权失败 | REST 返回 401/403/404；WebSocket 使用 1008/1013 关闭 |
| 数据库要求 | PostgreSQL 且已完成 `operation_center` 迁移；非 PG 或表缺失返回/关闭为服务不可用 |

# 二、统一报修中心与报修维修接口

统一报修中心接口分两层：

1. 多渠道入口消息：电脑端、移动端、设备二维码、微信、企业微信、飞书、钉钉、AI聊天框、语音、图片、人工代录、系统预警等入口先写入 `repair.unified_repair_message`。
2. 标准维修工单：消息经 AI 识别、设备匹配、用户确认或设备科人工确认后，生成统一 `repair.repair_order` 并进入派工、维修、验收、关闭闭环。

AI不能绕过确认机制盲目生成工单。高置信度可由用户确认后生成；中置信度需选择疑似设备；低置信度进入待确认报修池；急救类、生命支持类设备即使信息不完整，也应优先推送设备科值班人员。

## 1\. 创建统一报修消息
```
POST /api/v1/repair-center/messages
```

用途：接收 PC、移动端、设备二维码、公众号、企业微信、飞书、钉钉、AI聊天框、语音、图片、人工代录、系统预警等入口的原始报修信息。

请求 `data` 要点：

| 字段 | 说明 |
|---|---|
| `source_channel` | 渠道类型：PC_ADMIN / MOBILE_LOGIN / DEVICE_QR / WECHAT_MP / WEWORK / FEISHU / DINGTALK / AI_CHAT / VOICE / IMAGE / MANUAL_ENTRY / SYSTEM_ALERT |
| `source_channel_name` | 渠道名称 |
| `sender_id` / `sender_name` / `sender_phone` | 发送人信息 |
| `sender_department` | 发送人科室或渠道侧科室 |
| `raw_message_type` | TEXT / VOICE / IMAGE / VIDEO / MIXED / ALERT |
| `raw_message_content` | 原始文本或消息摘要 |
| `voice_file_url` / `image_file_url` / `video_file_url` | 原始附件地址 |
| `transcribed_text` | 语音转写文本；语音消息处理后必须保留 |
| `asset_id` | 可选；设备二维码入口或后台选设备时传入 |
| `metadata` | 渠道原始 payload 摘要 |

响应 `data`：`unified_repair_message` 摘要，含 `message_no`、`confirm_status`、`matched_device_id`、`matched_confidence`、`converted_order_id`。

错误与就绪：非 PostgreSQL 或统一报修表未迁移返回 `503`；渠道禁用返回 `403` 或业务错误；非法签名返回 `401/403`。

---
## 2\. 查询统一报修消息 / 报修工作台
```
GET /api/v1/repair-center/messages
```

参数：

| 参数 | 说明 |
|---|---|
| `source_channel` | 报修来源 |
| `raw_message_type` | 消息类型 |
| `sender_department` | 发送科室 |
| `keyword` | 设备、位置、故障、发送人关键词 |
| `confirm_status` | PENDING / USER_CONFIRMED / STAFF_CONFIRMED / NEED_MORE_INFO / CONVERTED / IGNORED |
| `ai_match_status` | HIGH / MEDIUM / LOW / UNMATCHED |
| `is_emergency_device` | 是否急救设备 |
| `is_overdue` | 是否超时未处理 |
| `date_from` / `date_to` | 创建日期范围 |
| `page` / `page_size` | 分页 |

响应 `data`：`{items,total,page,page_size,stats}`。`stats` 用于报修工作台顶部卡片：今日报修、AI识别报修、微信报修、飞书报修、待确认消息、待派工工单、维修中工单、急救设备故障、超时未处理。

---
## 3\. 统一报修消息详情
```
GET /api/v1/repair-center/messages/{message_id}
```

响应 `data` 聚合：

- `message`：统一消息主表。
- `ai_extract_results[]`：AI识别结果版本。
- `candidate_devices[]`：疑似设备列表，含设备名称、型号、科室、位置、资产编号、状态、匹配度。
- `timeline[]`：原始消息、转写、AI识别、追问、确认、转工单、通知记录。
- `converted_order`：已转工单时返回工单摘要。

---
## 4\. AI识别报修消息
```
POST /api/v1/repair-center/messages/{message_id}/ai-extract
```

用途：对文本、语音转写、图片摘要和设备档案进行 AI 抽取与设备匹配。

响应 `data` 要点：

| 字段 | 说明 |
|---|---|
| `extracted_department` | 识别科室 |
| `extracted_location` | 识别位置 |
| `extracted_device_name` | 识别设备名称 |
| `extracted_fault_description` | 故障描述 |
| `extracted_fault_category` | 故障分类 |
| `extracted_urgency` | 紧急程度 |
| `affects_clinical_use` | 是否影响诊疗 |
| `suspected_emergency_device` | 是否疑似急救设备 |
| `suspected_life_support_device` | 是否疑似生命支持设备 |
| `matched_device_candidates[]` | 疑似设备列表和匹配度 |
| `matched_device_id` | 高置信度候选设备 |
| `matched_confidence` | 0-1 或 0-100 统一按实现约定 |
| `confirmation_strategy` | USER_CONFIRM / SELECT_CANDIDATE / STAFF_CONFIRM / EMERGENCY_NOTIFY |

---
## 5\. 确认识别结果并生成工单
```
POST /api/v1/repair-center/messages/{message_id}/confirm
```

请求：
```
{
  "confirm_action": "CREATE_ORDER",
  "selected_device_id": "uuid",
  "fault_description": "ICU 5床监护仪NIBP测量异常，一直报警",
  "urgency": "HIGH",
  "affects_clinical_use": true,
  "comment": "请立即处理"
}
```

`confirm_action`：

| 值 | 说明 |
|---|---|
| `CREATE_ORDER` | 确认并生成工单 |
| `SELECT_DEVICE` | 只确认设备，暂不生成 |
| `NEED_MORE_INFO` | 退回用户补充信息 |
| `MANUAL_REVIEW` | 转人工确认 |
| `IGNORE` | 忽略并留痕 |

响应 `data`：`message` 和 `repair_order` 摘要；生成工单后写入 `converted_order_id`。

---
## 6\. 待确认报修池
```
GET /api/v1/repair-center/pending-confirmations
POST /api/v1/repair-center/pending-confirmations/{message_id}/assign-reviewer
```

列表字段：消息来源、发送人、发送科室、发送时间、原始内容、语音转文字内容、图片附件、AI识别设备、AI识别科室、AI识别故障、匹配置信度、疑似设备列表、处理状态、操作。

指派核实请求：
```
{ "reviewer_id": "uuid", "comment": "请值班工程师现场确认设备身份" }
```

---
## 7\. AI报修助手会话
```
POST /api/v1/repair-center/ai-sessions
POST /api/v1/repair-center/ai-sessions/{session_id}/messages
GET /api/v1/repair-center/ai-sessions/{session_id}
```

用途：系统内右下角 AI报修助手和机器人多轮会话共用。会话消息可包含文字、语音转写、图片附件和按钮动作。

会话消息响应应返回：

- AI识别结果。
- 需要追问的问题。
- 候选设备列表。
- 可展示按钮：确认报修、更换设备、补充照片、取消、转人工。
- 若用户询问进度，返回本人或本科室最近工单状态。

---
## 8\. 报修进度查询
```
GET /api/v1/repair-center/progress
```

参数：

| 参数 | 说明 |
|---|---|
| `sender_id` | 渠道用户 ID |
| `sender_phone` | 手机号 |
| `department_id` | 科室 |
| `order_code` | 指定工单号 |
| `scope` | `mine` / `department` |

响应示例：
```
{
  "items": [
    {
      "order_code": "BX202605180001",
      "device_name": "病人监护仪",
      "status": "维修中",
      "engineer_name": "张工",
      "current_progress": "已到场，正在检测NIBP模块",
      "estimated_finish_at": "2026-05-18T16:30:00"
    }
  ]
}
```

---
## 9\. 报修渠道配置
```
GET /api/v1/repair-center/channel-configs
POST /api/v1/repair-center/channel-configs
PATCH /api/v1/repair-center/channel-configs/{channel_id}
```

字段包括：渠道名称、渠道类型、启用状态、机器人名称、Webhook地址、Token / Secret、消息回调地址、支持消息类型、默认处理规则、绑定科室范围、绑定用户范围、是否允许自动生成工单、是否需要人工确认。

---
## 10\. 报修规则配置
```
GET /api/v1/repair-center/rule-config
PATCH /api/v1/repair-center/rule-config
```

配置项包括：是否允许AI自动生成工单、不同渠道是否需要人工确认、急救设备是否自动升级紧急程度、夜间报修是否推送值班人员、超时未派工提醒规则、超时未验收提醒规则、高价值设备通知设备科主任、同一设备短期多次报修风险预警、生命支持类设备提示备用设备调配、是否允许临床用户查看维修进度。

---
## 11\. 外部渠道回调
```
POST /api/v1/repair-center/webhooks/wechat
POST /api/v1/repair-center/webhooks/wework
POST /api/v1/repair-center/webhooks/feishu
POST /api/v1/repair-center/webhooks/dingtalk
```

说明：回调接口负责签名校验、消息解密、附件下载、用户映射和幂等写入 `unified_repair_message`。外部平台原始 payload 不直接暴露给业务页面，只保存必要摘要和审计元数据。

---
## 12\. 科室扫码/后台直接创建标准工单（兼容接口）
```
POST /api/v1/repairs
```

说明：这是标准工单创建接口，保留兼容一期“扫码报修直接生成工单”的实现。升级为统一报修中心后，推荐入口是 `POST /api/v1/repair-center/messages`，由确认接口转工单。若直接调用 `/repairs`，服务端仍必须校验 `asset_id`、权限和状态，不得替代多渠道消息中枢。

支持：
  * 文本描述
  * 图片
  * 语音
  * 视频
  * 设备ID
  * 故障类型


---
## 13\. 查询维修工单列表
```
GET /api/v1/repairs
```

参数：
| 参数                   | 说明   |
|----------------------|------|
| order_status         | 工单状态 |
| asset_id             | 设备（UUID） |
| department_id        | 科室（UUID） |
| assigned_engineer_id | 工程师用户（UUID） |
| priority             | 优先级  |
| date_from/date_to    | **日期**范围（`YYYY-MM-DD`，按工单创建日 `created_at` 的日期比对） |
| page                 | 页码，默认 `1` |
| page_size            | 每页条数，默认 `20`，上限 **`100`** |

管理端 **PC**：列表筛选与地址栏查询可同步上述条件（便于自设备详情深链 `?asset_id=`），详见 **`docs/05_前端设计/03_PC管理端一期实现对照.md`**。

---
## 14\. 工单详情
```
GET /api/v1/repairs/{repair_order_id}
```

响应 `data` 为聚合体：`order`（工单主表）、`attachments`、`records`、`report`（无报告时可为 `null`）。管理端工单详情页按此四分屏展示，并在独立区域提供 **§二·4～8** 及 **§三·1～2** 对应 `POST` 操作入口（RBAC 与状态校验以服务端为准）。

---
## 15\. 工程师抢单
```
POST /api/v1/repairs/{repair_order_id}/claim
```

---
## 16\. 强制派单
```
POST /api/v1/repairs/{repair_order_id}/assign
```

请求：
```
{ "engineer_id": "uuid", "reason": "急救设备故障，强制派单"}
```

---
## 17\. 添加维修过程记录
```
POST /api/v1/repairs/{repair_order_id}/records
```

---
## 18\. 完成维修
```
POST /api/v1/repairs/{repair_order_id}/complete
```

---
## 19\. 科室确认维修结果
```
POST /api/v1/repairs/{repair_order_id}/confirm
```

请求：
```
{ "confirm_status": "ACCEPTED", "comment": "设备恢复正常"}
```

---
# 三、外修/返厂/竞价接口
## 1\. 发起外修申请
```
POST /api/v1/repairs/{repair_order_id}/outsourcing
```

---
## 2\. 发起返厂流程
```
POST /api/v1/repairs/{repair_order_id}/return-factory
```

---
## 3\. 发布第三方维修项目
```
POST /api/v1/supplier-projects
```

---
## 4\. 供应商查看公开项目
```
GET /api/v1/supplier-portal/projects
```

OPEN 中单条详情（非 OPEN 或不存在时对门户返回 404）：

```
GET /api/v1/supplier-portal/projects/{project_id}
```

---
## 5\. 供应商报名/报价
```
POST /api/v1/supplier-portal/projects/{project_id}/bids
```

门户查询本单位已提交的报价（无记录时 `items` 为空，`total` 为 0）：

```
GET /api/v1/supplier-portal/projects/{project_id}/bids
```

院内查询本项目收到的全部报价（`items[].selected` 为是否中选，`winning_bid_id` 在审核时选定）：

```
GET /api/v1/supplier-projects/{project_id}/bids
```

---
## 6\. 审计/财务审核报价
```
POST /api/v1/supplier-projects/{project_id}/review
```

请求（`decision` 缺省 `CLOSED`）：
```
{ "remark": "报价合理，准予收官", "decision": "CLOSED" }
```

`decision`：`CLOSED` 正常收官，`CANCELLED` 废止；均不再接受门户新报价（项目须为 `OPEN` 方可首次审核）。收官时可选用 `winning_bid_id` 指定本项目某一则报价为中选；与 `decision=CANCELLED` 互斥。

可选字段示例：

```
{ "remark": "采用最低价中标", "decision": "CLOSED", "winning_bid_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
```

本项目全部报价条目在列表中会通过布尔字段 `selected` 标出中选行（无中选则无 `true`）。

---
## 7\. 院内查询供应商资质
```
GET /api/v1/suppliers/qualifications
GET /api/v1/suppliers/qualifications/{qualification_id}
```

参数：列表接口可选 `organization_id`（同 `supplier.organization.id`）、`review_status`（`PENDING`/`ACCEPTED`/`REJECTED` 或 `ALL`）、`page`、`page_size`。

单条 `{qualification_id}` 返回与分页 `items[]` 中同一数据结构（含 `organization_legal_name`）。

---
## 8\. 院内审核供应商资质
```
POST /api/v1/suppliers/qualifications/{qualification_id}/review
```

请求（`confirm_status` 与发票 OCR 人工确认措辞一致：`ACCEPTED`/`REJECTED`）：
```
{ "confirm_status": "REJECTED", "comment": "授权书不清晰，请补扫描件" }
```

说明：已通过审核（`ACCEPTED`）的记录不可重复审核。

---
# 四、供应商门户接口
## 1\. 供应商登录
```
POST /api/v1/supplier-portal/auth/login
```

---
## 2\. 供应商首页统计
```
GET /api/v1/supplier-portal/dashboard
```

返回：
  * 未付款金额、已付款金额、待审核发票、付款进度（与 `finance` 域 e014+e015 对齐）
  * 待补材料（`missing_material_count`：资质 `review_status=REJECTED` 或尚未上传附件 `object_key` 为空的条目数）
  * 参与项目（`active_projects_count`：本企业已对至少一则报价的去重竞价项目数）


---
## 3\. 上传资质
```
POST /api/v1/supplier-portal/qualifications
```

---
## 4\. 查询资质列表
```
GET /api/v1/supplier-portal/qualifications
GET /api/v1/supplier-portal/qualifications/{qualification_id}
```

第二条与分页 `items[]` 单行结构一致；仅能查看本门户企业名下资质，否则 **404**。

---
## 5\. 查询应付款台账
```
GET /api/v1/supplier-portal/payables
GET /api/v1/supplier-portal/payables/{payable_id}
```

与院内 **五·5 / 五·5.2** 同一业务数据；门户列表不包含院内字段 `supplier_id`（仅存 `organization_id`）。可按 `status`（`OPEN`/`CLOSED`/`ALL`）筛选。非本企业 **404**（单条）。

---
## 6\. 查询自己发票
```
GET /api/v1/supplier-portal/invoices
GET /api/v1/supplier-portal/invoices/{invoice_id}
```

第二条与院内 **五·3** 发票详情字段一致（含 `ocr_review_status`、`ocr_result`），仅返回属于本门户企业 `supplier.organization` 的发票；否则 404。

---
## 7\. 查询自己付款进度
```
GET /api/v1/supplier-portal/payments
GET /api/v1/supplier-portal/payments/{payment_id}
```

列表与院内 **五·6.1** 按本企业维度过滤一致；第二条与列表单行字段一致（含核销 `allocations`），非本门户企业数据返回 404。

---
# 五、发票与付款接口

院内发票表 `finance.invoice`（迁移 `e014`）；应付款/付款 `finance.payable`/`finance.payment`（**e015**）；`/upload` 后轮询 `POST /finance/invoices/{invoice_id}/review` 把确认结果写回 OCR 对应的 `ai.ai_result` 占位记录。

## 1\. 上传发票
```
POST /api/v1/finance/invoices/upload
```

上传后自动创建 AI 识别任务。
---
## 2\. 查询发票列表
```
GET /api/v1/finance/invoices
```

---
## 3\. 发票详情
```
GET /api/v1/finance/invoices/{invoice_id}
```

---
## 4\. 人工审核AI识别结果
```
POST /api/v1/finance/invoices/{invoice_id}/review
```

---
## 5\. 查询应付款台账
```
GET /api/v1/finance/payables
```

### 5\.1 补录应付款台账（院内）
```
POST /api/v1/finance/payables
```

请求（`supplier_id` 与 `organization_id` 二选一；语义同 `supplier.organization.id`）：
```
{ "supplier_id": "uuid", "title": "采购合同尾款", "amount_due": 80000, "due_date": "2026-05-07" }
```

### 5\.2 单条应付详情
```
GET /api/v1/finance/payables/{payable_id}
```

---
## 6\. 登记付款
```
POST /api/v1/finance/payments
```

请求：
```
{ "supplier_id": "uuid", "payment_amount": 50000, "payment_date": "2026-05-07", "allocations": [ { "invoice_id": "uuid", "allocated_amount": 30000 }, { "payable_id": "uuid", "allocated_amount": 20000 } ]}
```

### 6\.1 查询付款登记列表
```
GET /api/v1/finance/payments
```

参数：可选 `supplier_id` / `organization_id`（与 §五·6 供应商主键一致）、`page`、`page_size`。

### 6\.2 单条付款登记详情
```
GET /api/v1/finance/payments/{payment_id}
```

---
## 7\. 账龄分析
```
GET /api/v1/finance/aging-analysis
```

---
## 8\. AI付款优先级建议
```
POST /api/v1/finance/payment-priority/ai-analyze
```

---
# 六、AI接口
## 1\. 创建AI任务
```
POST /api/v1/ai/tasks
```

任务类型：
| 类型                | 说明     |
|-------------------|--------|
| REPAIR_TRIAGE     | 报修分诊   |
| REPAIR_REPORT     | 维修报告   |
| INVOICE_OCR       | 发票识别   |
| DELIVERY_OCR      | 随货同行识别 |
| PAYMENT_PRIORITY  | 付款优先级  |
| INCIDENT_ANALYSIS | 不良事件分析 |
| ROI_ANALYSIS      | 效益分析   |


---
## 2\. 查询AI任务状态
```
GET /api/v1/ai/tasks/{task_id}
```

---
## 3\. 查询AI分析结果
```
GET /api/v1/ai/results/{result_id}
```

---
## 4\. 人工确认AI结果
```
POST /api/v1/ai/results/{result_id}/review
```

---
# 七、知识库接口
## 1\. 上传知识文档
```
POST /api/v1/knowledge/documents
```

- **Content-Type**：`multipart/form-data`
- **表单字段**：`title`（必填，字符串）、`source_type`（可选，默认 `UPLOAD`，最长按实现约束一般为 64 字符）、`file`（**可选**，二进制附件；过大时服务端拒绝）
- **权限**：写入类角色（如 **`RBAC_KNOWLEDGE_WRITE`**，以 `backend` 配置为准）
- **前置条件**：PostgreSQL 已迁移含知识库相关表（如 **e007**）；未就绪时可能返回 **`503`** 等不可用提示

---
## 2\. 查询知识库
```
GET /api/v1/knowledge/documents
```

单条文档元数据见本节 **§七·4**。

---
## 3\. 知识库问答
```
POST /api/v1/knowledge/chat
```

请求：
```
{ "question": "监护仪NIBP模块反复故障怎么排查？", "scope": "repair"}
```

响应 `data.stub === true` 表示仍为占位链路；**`interaction_id`** 为本次占位会话标识；**`references`** 为按问题中关键词对文档标题做模糊检索的去重条目（每项含 `id`/`title`/预留 `snippet`），**不等于**向量 RAG 结果。若 **`reference_search_degraded`** 为 `true`，表示知识库持久化不可用，题名检索已跳过（`references` 可能为空）。

---
## 4\. 查询单条知识文档
```
GET /api/v1/knowledge/documents/{document_id}
```

返回与 **§七·2** 列表项相同字段集（元数据 + `object_key` 等）。

---
# 八、工作流接口
## 1\. 启动流程
```
POST /api/v1/workflows/start
```

---
## 2\. 查询我的待办
```
GET /api/v1/workflows/tasks/my
```

---
## 3\. 审批任务
```
POST /api/v1/workflows/tasks/{task_id}/approve
```

---
## 4\. 驳回任务
```
POST /api/v1/workflows/tasks/{task_id}/reject
```

---
# 九、审计接口
## 1\. 查询操作日志
```
GET /api/v1/audit/logs
```

仅审计科、系统管理员可访问。
---
# 十、预防性维护与巡检（PM）接口

**说明**：本章为 **V1 契约**，用于支撑 PC 菜单「预防性维护与巡检」及工程师工作台 PM/巡检待办。持久化位于 PostgreSQL **`pm` schema**（**Alembic `e017_pm_core`**：`pm_plan`、`pm_task`、`pm_inspection_task`）；引擎非 PostgreSQL 或表未就绪时接口返回 **`503`**（与台账、报修等模块一致）。  
**权限（实现期）**：读操作为设备科/工程师等只读类角色（建议常量族 **`RBAC_PM_READ`**），写操作（建计划、登记执行）为设备科（建议 **`RBAC_PM_WRITE`**），与 `backend/app/modules/auth/rbac.py` 落地时对齐 **`docs/01_需求文档/03_角色权限与数据安全架构设计.md`**。

**通用列表参数**（未特别声明时）：`page`（默认 `1`）、`page_size`（默认 `20`，上限 `100`）；时间字段 ISO8601；主键均为 **UUID**。

---
## 1\. 查询 PM 计划列表
```
GET /api/v1/pm/plans
```

| 参数 | 说明 |
|------|------|
| keyword | 计划名称/编码模糊 |
| asset_id | 绑定设备（可选） |
| department_id | 责任科室（可选） |
| plan_status | 计划状态（实现期枚举，如 DRAFT/ACTIVE/SUSPENDED/ENDED） |
| date_from / date_to | 按「计划生效日」或「下次到期日」筛选（`YYYY-MM-DD`，具体字段以实现为准） |

响应 `data`：`{ "items": [...], "total", "page", "page_size" }`。

---
## 2\. 创建 PM 计划
```
POST /api/v1/pm/plans
```

请求体（示例字段，以实现期 Pydantic 模型为准）：
  * `title`、`code`（可选）、`asset_id` 或 `asset_group_rule`（二选一或组合策略由实现定）
  * `frequency`（周期策略：如 MONTHLY/QUARTERLY）、`next_due_date`
  * `owner_department_id`、`description`

---
## 3\. 查询 PM 计划详情
```
GET /api/v1/pm/plans/{plan_id}
```

---
## 4\. 修改 PM 计划
```
PATCH /api/v1/pm/plans/{plan_id}
```

部分更新；状态流转规则（如 ACTIVE→SUSPENDED）以实现期校验为准。

---
## 5\. 查询 PM 任务列表
```
GET /api/v1/pm/tasks
```

| 参数 | 说明 |
|------|------|
| plan_id | 所属计划 |
| asset_id | 设备 |
| task_status | 如 PENDING/IN_PROGRESS/DONE/OVERDUE |
| assigned_engineer_id | 责任人（用户 UUID） |
| date_from / date_to | 计划执行日或到期日 |

---
## 6\. 登记 PM 任务执行结果
```
POST /api/v1/pm/tasks/{task_id}/complete
```

请求体示例：`result_summary`、`executed_at`、`engineer_id`、`attachments`（文件引用，可选）。完成后生成/推进下一次任务规则由服务层定义。

---
## 7\. 查询巡检任务列表
```
GET /api/v1/pm/inspection-tasks
```

参数：`inspection_type`（如日常/急救专项）、`department_id`、`task_status`、`date_from`/`date_to`。

---
## 8\. 提交巡检记录
```
POST /api/v1/pm/inspection-tasks/{inspection_task_id}/records
```

请求体：`checklist_result`（结构化 JSON）、`remark`、`inspector_id`、`geo_tag`（可选）。

---
## 9\. 急救设备完好率统计
```
GET /api/v1/pm/stats/emergency-readiness
```

响应 `data` 建议含：统计口径时间、应检数、实检数、完好率、按科室分项（实现期可分页或截断）。

---
## 10\. PM/巡检逾期预警列表
```
GET /api/v1/pm/alerts/overdue
```

返回临近逾期或已逾期任务摘要（`task_id`、`type`：`PM`/`INSPECTION`、`due_date`、`asset_id` 等）。

---
# 十一、计量与合规接口

**说明**：V1 契约草案；支撑「计量设备台账、检定计划、证书管理及专项合规视图」。实体与 **`asset`** 台账关联（多对一或扩展属性）以实现为准。  
**权限**：建议 **`RBAC_METROLOGY_READ`** / **`RBAC_METROLOGY_WRITE`**（写入含证书上传、计划维护）；仅 **`SYS_ADMIN`**/**`DEVICE_ADMIN`** 可删改强检结论等敏感字段时以实现为准。

---
## 1\. 计量设备台账列表
```
GET /api/v1/metrology/devices
```

| 参数 | 说明 |
|------|------|
| keyword | 名称/编码/注册证号等 |
| department_id | 科室 |
| regulatory_class | 监管分类（如 STRONG_CHECK/RADIOLOGY/RADIATION/PRESSURE_VESSEL，枚举以实现为准） |
| calibration_status | 校准/检定状态 |
| page / page_size | 分页 |

列表项至少含：`asset_id`、计量属性摘要、最近检定日、下次到期日。

---
## 2\. 查询单设备计量档案
```
GET /api/v1/metrology/devices/{asset_id}
```

聚合证书列表摘要、当前有效检定结论、附属合规标签。

---
## 3\. 检定/校准计划列表
```
GET /api/v1/metrology/calibration-plans
```

---
## 4\. 创建或更新检定计划
```
POST /api/v1/metrology/calibration-plans
PATCH /api/v1/metrology/calibration-plans/{plan_id}
```

---
## 5\. 计量证书列表
```
GET /api/v1/metrology/certificates
```

参数：`asset_id`、`valid_to_before`（到期日前筛选）、`keyword`。

---
## 6\. 上传或补录证书元数据
```
POST /api/v1/metrology/certificates
```

可配合 **`multipart/form-data`** 上传扫描件（`file`）与元数据字段（`asset_id`、`certificate_no`、`issued_at`、`valid_to`、`issuing_body`）；与 **§六** `INVOICE_OCR` 类似，可后续扩展 **`METROLOGY_CERT_OCR`** AI 任务（非 V1 必选）。

---
## 7\. 单条证书详情
```
GET /api/v1/metrology/certificates/{certificate_id}
```

---
## 8\. 合规专项视图（放射诊疗 / 辐射安全 / 压力容器）
```
GET /api/v1/metrology/portfolios/{portfolio_code}
```

`portfolio_code` 建议枚举：`RADIOLOGY`、`RADIATION_SAFETY`、`PRESSURE_VESSEL`。响应为该类设备清单 + 关键合规字段摘要（与 **§十一·1** 列表互补，便于 PC 独立菜单）。

---
## 9\. 证照/检定到期预警
```
GET /api/v1/metrology/alerts/expiry
```

参数：`within_days`（默认 30）、`department_id`。`data.items` 含 `asset_id`、`alert_type`、`due_date`、`severity`。

---
# 十二、效益分析接口

**说明**：V1 契约草案；指标以 **`docs/05_前端设计/01`** 效益分析菜单为范围。数据源可来自 HIS/成本系统对接或离线导入，**未接入时接口可返回空序列或 `stub: true`**（与 **§七·3** 占位策略一致），不得伪造业务数值。  
**权限**：建议 **`RBAC_BENEFIT_READ`**，限定 **`SYS_ADMIN`**、**`DEVICE_ADMIN`**、院领导类角色（以 **`docs/01`** 为准）。

---
## 1\. 设备使用率分析
```
GET /api/v1/benefit/utilization
```

参数：`department_id`、`period`（如 `2026-Q1` 或 `2026-01`）、`asset_id`（可选）。

---
## 2\. ROI 分析
```
GET /api/v1/benefit/roi
```

参数：`department_id`、`period`；可与 **§六** 任务类型 **`ROI_ANALYSIS`** 结果关联，`data` 可含 `ai_result_id` 引用（可选）。

---
## 3\. 维修成本分析
```
GET /api/v1/benefit/repair-costs
```

参数：`department_id`、`date_from`/`date_to`、按设备/科室聚合 `group_by`。

---
## 4\. 科室配置分析
```
GET /api/v1/benefit/department-profile
```

参数：`department_id`（可选，缺省为全院对比摘要）。

---
## 5\. 闲置设备分析
```
GET /api/v1/benefit/idle-assets
```

参数：`department_id`、`idle_months_threshold`。

---
## 6\. 采购/调拨建议列表
```
GET /api/v1/benefit/procurement-suggestions
```

只读建议项（来源：规则引擎或 **§六** AI）；字段含 `suggestion_type`（PROCURE/TRANSFER/RETIRE）、`asset_id`、`reason`、`priority`。

---
# 十三、系统用户与角色接口

**说明**：V1 契约草案；与现有 **`POST /api/v1/auth/login`**、**`GET /api/v1/auth/me`** 并存。用户持久化以 **`identity.app_user`** 等为参考（**`docs/03`**、迁移 **e005** 及后续扩展）。**禁止在响应中返回密码哈希**；首次密码下发与重置策略需符合院感与等保要求（邮件/短信链路可二期）。  
**权限**：用户与角色维护建议仅 **`SYS_ADMIN`**（及文档规定的安全管理员角色）；查询列表可读范围以实现为准（如 **`DEVICE_ADMIN`** 只读本院用户）。

---
## 1\. 用户列表
```
GET /api/v1/system/users
```

| 参数 | 说明 |
|------|------|
| keyword | 登录名/姓名模糊 |
| role | 角色代码过滤（单角色） |
| is_active | 是否启用 |
| page / page_size | 分页 |

---
## 2\. 创建用户
```
POST /api/v1/system/users
```

请求体：`username`（唯一）、`display_name`、`initial_password`（可选，若缺省则走邀请重置流）、`role_codes[]`、`department_id`（可选）、`is_active`（默认 true）。

---
## 3\. 用户详情
```
GET /api/v1/system/users/{user_id}
```

---
## 4\. 修改用户资料
```
PATCH /api/v1/system/users/{user_id}
```

可改：`display_name`、`department_id`、`is_active` 等；**`username` 是否允许变更由实现期策略决定**（默认不建议）。

---
## 5\. 设置用户角色
```
PUT /api/v1/system/users/{user_id}/roles
```

请求体：`{ "role_codes": ["DEVICE_ADMIN", "ENGINEER"] }`（全量替换为该集合）。

---
## 6\. 管理员重置密码
```
POST /api/v1/system/users/{user_id}/password-reset
```

请求体：`new_password` 或 `generate_temporary: true`（返回一次性口令策略以实现为准）。

---
## 7\. 角色目录（含权限说明摘要）
```
GET /api/v1/system/roles
```

响应 `data.items`：`code`、`name`、`description`、`permission_summary[]`（或引用 **`docs/01`** 矩阵中的能力点编码）。

---
## 8\. 当前登录用户改密（可选）
```
POST /api/v1/system/me/password
```

请求体：`old_password`、`new_password`。需要有效 **Bearer JWT**；与管理员重置路径分离。

---
## 9\. 主数据来源配置
```
GET /api/v1/system/master-data-source-configs
POST /api/v1/system/master-data-source-configs
PATCH /api/v1/system/master-data-source-configs/{config_id}
POST /api/v1/system/master-data-source-configs/{config_id}/sync
GET /api/v1/system/master-data-source-configs/{config_id}/conflicts
GET /api/v1/system/master-data-source-configs/{config_id}/versions
```

用于系统设置 / 主数据来源配置。权限建议：读 `mdm:dict:view`；编辑、同步、冲突处理需 `system:param:view` 或主数据管理员。

配置对象包括：科室主数据、人员主数据、设备主数据、耗材主数据、供应商主数据、收费项目主数据、医保编码、设备分类字典、设备状态字典、计量属性字典、风险等级字典。

响应 `data.items[]` 要点：

| 字段 | 说明 |
|------|------|
| `object_code` / `object_name` | 主数据对象编码与名称 |
| `authority_source` | 当前权威来源 |
| `available_sources[]` | 可选数据来源 |
| `sync_mode` | API 实时调用、定时同步、只读缓存刷新、候选申请同步 |
| `sync_frequency` | 同步频率 |
| `allow_local_maintenance` | `YES`、`NO`、`PARTIAL` |
| `conflict_strategy` | `OS_WINS`、`HUDMP_WINS`、`KEEP_BOTH`、`MANUAL_MERGE`、`NEW_VERSION` |
| `last_sync_at` | 最近同步时间 |
| `sync_status` | `UNSYNCED`、`SYNCING`、`SYNCED`、`FAILED`、`PENDING_REVIEW`、`CONFLICT` |
| `quality_score` / `mapping_rate` | 数据质量评分、映射完成率 |

---
# 十四、统一任务引擎接口

统一任务引擎是“事件 → 任务 → 派工 → 执行 → 验收 → 闭环”的平台级接口层。详细架构、状态机、SLA、数据库与 IOC/AI 联动见 **`docs/02_系统架构/05_统一任务引擎设计.md`**。

## 1\. 查询任务列表
```
GET /api/v1/tasks
```

参数：

| 参数 | 说明 |
|------|------|
| keyword | 任务编号/标题/描述模糊查询 |
| task_type | 任务类型 |
| task_category_l1 / task_category_l2 | 一级/二级分类 |
| source_module | 来源模块，如 `repair`、`pm`、`safety`、`finance`、`ioc`、`ai` |
| source_type | 来源类型，如业务事件、AI、人工、IOC、微信、电话 |
| status | 统一任务状态 |
| risk_level | 风险等级 |
| priority | 优先级 |
| sla_level | SLA 等级 |
| overdue | 是否超时 |
| escalated | 是否已升级 |
| assignee_id | 责任人 |
| responsible_dept_id | 责任科室 |
| asset_id / supplier_id / ioc_event_id | 关联对象 |
| date_from / date_to | 创建日期范围（`YYYY-MM-DD`） |
| page / page_size | 分页 |

响应 `data.items[]` 要点：`id`、`task_no`、`title`、`task_type`、`task_category_l1`、`source_module`、`risk_level`、`priority`、`status`、`sla_countdown_seconds`、`overdue_flag`、`escalation_level`、`assignee`、`responsible_dept`、`related_objects[]`、`ai_suggestion`、`created_at`、`due_at`。

---
## 2\. 创建人工任务
```
POST /api/v1/tasks
```

请求体要点：`title`、`task_type`、`task_category_l1`、`task_category_l2`、`description`、`priority`、`risk_level`、`responsible_dept_id`、`assignee_id`、`due_at`、`related_objects[]`、`attachments[]`。

说明：人工任务默认 `source_type=MANUAL`。领导交办、会议决议、电话登记、临时应急任务均走此入口。

---
## 3\. 查询任务详情
```
GET /api/v1/tasks/{task_id}
```

响应 `data` 聚合：

- 任务基础信息。
- SLA 计时与升级状态。
- 关联设备、供应商、合同、工单、风险、不良事件、IOC 事件。
- 协同人员、附件、处理记录。
- AI 分析、审批记录、操作日志。

---
## 4\. 修改任务
```
PATCH /api/v1/tasks/{task_id}
```

可改：标题、描述、优先级、风险等级、责任科室、责任人、截止时间、关联对象、扩展字段。状态流转必须使用动作接口，不建议直接 PATCH `status`。

---
## 5\. 我的任务
```
GET /api/v1/tasks/my
```

参数：

| 参数 | 说明 |
|------|------|
| view | `todo`、`created`、`assigned`、`collaboration`、`acceptance`、`closed` |
| status | 状态过滤 |
| task_type | 类型过滤 |
| page / page_size | 分页 |

用于工作台、移动端、工程师首页和领导督办视图。

---
## 6\. 任务 KPI
```
GET /api/v1/tasks/kpis
```

响应 `data` 要点：`today_created`、`pending_count`、`overdue_count`、`high_risk_count`、`closure_rate`、`sla_achievement_rate`、`avg_response_minutes`、`avg_finish_minutes`。

---
## 7\. 任务状态动作
```
POST /api/v1/tasks/{task_id}/accept
POST /api/v1/tasks/{task_id}/dispatch
POST /api/v1/tasks/{task_id}/start
POST /api/v1/tasks/{task_id}/pause
POST /api/v1/tasks/{task_id}/resume
POST /api/v1/tasks/{task_id}/submit
POST /api/v1/tasks/{task_id}/acceptance
POST /api/v1/tasks/{task_id}/close
POST /api/v1/tasks/{task_id}/cancel
POST /api/v1/tasks/{task_id}/transfer
```

通用请求体：`comment`、`reason`、`attachments[]`、`metadata`。  
动作必须校验：当前状态、任务类型、处理人/验收人、角色权限、数据范围、工作流约束。

---
## 8\. 协同人员
```
POST /api/v1/tasks/{task_id}/collaborators
DELETE /api/v1/tasks/{task_id}/collaborators/{assignment_id}
```

用于添加工程师、科室人员、供应商、财务、采购、安全管理员等协同处理人。

---
## 9\. 批量派工
```
POST /api/v1/tasks/batch-dispatch
```

请求体：`task_ids[]`、`assignee_id`、`responsible_dept_id`、`comment`。  
高风险任务、已绑定工作流的任务、跨组织任务可要求二次确认或审批。

---
## 10\. 业务事件转任务
```
POST /api/v1/task-events
POST /api/v1/task-events/{event_id}/convert
```

`POST /api/v1/task-events` 用于维修、PM、巡检、计量、安全、供应链、IOC、AI 等模块接入标准事件，并由规则引擎自动生成任务。

请求体要点：
```
{
  "source_module": "ioc",
  "source_event_type": "ASSET_DOWNTIME_ALERT",
  "source_object_type": "ioc_event",
  "source_object_id": "uuid",
  "idempotency_key": "ioc:alarm:20260513:0001",
  "title": "ICU呼吸机停机告警",
  "risk_level": "L1",
  "payload": {}
}
```

响应 `data`：`event_id`、`converted`、`task_id`、`matched_rule_code`、`requires_human_review`。

---
## 11\. AI生成任务
```
POST /api/v1/tasks/ai/parse-command
POST /api/v1/tasks/ai/generate
GET /api/v1/tasks/{task_id}/ai-analyses
POST /api/v1/tasks/{task_id}/ai-analyses/{analysis_id}/confirm
```

典型用途：领导语音、会议纪要、微信文本、OCR、AI 风险预测、预测性维护自动生成任务。AI 只能生成任务草稿、任务候选或分析建议；高风险、采购、付款、CAPA 等场景需人工确认。

---
## 12\. IOC联动
```
GET /api/v1/tasks/{task_id}/ioc-links
POST /api/v1/tasks/{task_id}/ioc-links
WS /api/v1/task-ws
```

说明：

- 任务超时、一级风险、停机任务、医用气体异常、PM 超时均可触发 IOC 联动。
- 管理端任务实时刷新使用 `WS /api/v1/task-ws`。
- 公开大屏仍沿用 `/screen-api/{screen_code}` 与 `/screen-ws/{screen_code}`。

---
## 13\. 任务配置
```
GET /api/v1/task-templates
POST /api/v1/task-templates
GET /api/v1/task-sla-policies
POST /api/v1/task-sla-policies
GET /api/v1/task-escalation-policies
POST /api/v1/task-escalation-policies
GET /api/v1/task-state-machines
POST /api/v1/task-state-machines
GET /api/v1/task-auto-rules
POST /api/v1/task-auto-rules
```

配置接口归属系统中心，需系统管理员或平台运营管理员权限。配置变更必须写入审计日志，并建议支持版本号、启停状态和灰度发布。

---
# 十五、H-UMDG 外部接入接口

本章接口用于 H-MELC 调用另一个系统 H-UMDG 的基础主数据。接口只做代理、缓存状态、候选申请和降级提示，不把 H-UMDG 权威主数据落成本系统权威库。

## 1\. H-UMDG 配置状态
```
GET /api/v1/hmdm/status
```

返回：`hmdm_base_url`、`connected`、`last_success_at`、`last_failure_reason`、`api_key_configured`、`cache_enabled`、`cache_status`。

## 2\. 获取设备分类树
```
GET /api/v1/hmdm/equipment-categories/tree
```

代理 H-UMDG：`GET /api/external/equipment-categories/tree`。返回字段包括 `category_code`、`category_name`、`parent_code`、`children`。调用成功后刷新 `hmdm_dictionary_cache` 的设备分类缓存。

## 3\. 查询设备标准名称
```
GET /api/v1/hmdm/equipment-standard-names?keyword=&category_id=
```

代理 H-UMDG：`GET /api/external/equipment-standard-names`。支持标准名称、别名、关键词和设备分类检索。返回字段包括 `equipment_name_code`、`standard_name`、`alias_names`、`equipment_category_code`、`equipment_category_name`、`regulatory_major_category`、`primary_product_category`、`secondary_product_category`、`management_class`。

## 4\. 查询设备标准名称详情
```
GET /api/v1/hmdm/equipment-standard-names/{id}
```

代理 H-UMDG：`GET /api/external/equipment-standard-names/{id}`。详情中包含 `product_description`、`intended_use` 等只读监管目录信息。

## 5\. 查询厂商机构
```
GET /api/v1/hmdm/manufacturer-vendors?keyword=&role_type=&business_domain=
```

代理 H-UMDG：`GET /api/external/manufacturer-vendors`。支持标准名称、简称、英文名、别名、统一社会信用代码、外部系统原始名称、厂商角色和业务领域检索。返回字段包括 `organization_code`、`standard_name`、`english_name`、`short_name`、`alias_names`、`unified_social_credit_code`、`roles`、`country_region`、`status`。

## 6\. 查询厂商详情
```
GET /api/v1/hmdm/manufacturer-vendors/{id}
```

代理 H-UMDG：`GET /api/external/manufacturer-vendors/{id}`。返回 `relations`、`external_mappings` 等 H-UMDG 权威信息。

## 7\. 查询厂商关系
```
GET /api/v1/hmdm/manufacturer-vendors/{id}/relations
```

代理 H-UMDG：`GET /api/external/manufacturer-vendors/{id}/relations`。返回母公司、子公司、曾用名、收购关系、授权代理、授权售后、区域代理等。

## 8\. 提交新增设备标准名称申请
```
POST /api/v1/hmdm/equipment-standard-name-requests
```

请求字段：`proposed_name`、`alias_names`、`suggested_category`、`reason`。服务端补充 `submitted_by`、`submitted_at`、`status=PENDING`。该申请仅作为候选数据，后续同步给 H-UMDG 审核，不写入本系统权威设备标准名称库。

## 9\. 提交新增厂商机构申请
```
POST /api/v1/hmdm/manufacturer-vendor-requests
```

请求字段：`proposed_standard_name`、`english_name`、`short_name`、`alias_names`、`unified_social_credit_code`、`suggested_role_type`、`business_domain`、`contact_info`、`reason`。服务端补充 `submitted_by`、`submitted_at`、`status=PENDING`。该申请仅作为候选数据，后续同步给 H-UMDG 审核，不写入本系统权威厂商机构库。

## 10\. 获取本地缓存状态
```
GET /api/v1/hmdm/cache/status
```

返回设备分类、设备标准名称、厂商机构三类只读缓存的数量、最近同步时间和过期数量。

## 11\. 手动刷新 H-UMDG 缓存
```
POST /api/v1/hmdm/cache/refresh
```

手动刷新可直接预热设备分类和常用厂商机构缓存。若 H-UMDG 暂不可用且允许降级，返回最近缓存状态和错误原因。

## 12\. 医疗器械分类目录匹配
```
POST /api/v1/master-data/device-classification/match
```

用途：医学装备档案库导入历史设备时调用 H-UMDG 医疗器械分类目录，返回多个候选分类供人工确认。H-MELC 不复制维护目录，只保存确认后的 `classification_id`、`classification_code`、`classification_version_id` 等引用字段。

请求字段：`deviceName`、`brand`、`model`、`registrationName`、`registrationCertificateNo`、`managementClass`、`department`、`intendedUse`、`originalCategory`。

返回字段：`candidates[]`，每项包含 `classificationId`、`classificationCode`、`catalogItem`、`managementClass`、`matchScore`、`matchReason`、`versionId`、`productDescription`、`intendedUse`、`examples`。必须支持多个候选项，不允许只返回单一结果。

## 13\. 医疗器械分类目录变更
```
GET /api/v1/master-data/device-classification/changes?since=2026-05-25T00:00:00
```

用途：从 H-UMDG 拉取分类目录增量变更并缓存在 `integration.hmdm_classification_change`。变更类型包括 `description_changed`、`intended_use_changed`、`example_changed`、`management_class_changed`、`catalog_name_changed`、`code_changed`、`deprecated`、`merged`、`split`、`new_catalog`。

本地联调用：
```
POST /api/v1/master-data/device-classification/changes/mock
```

该接口仅用于模拟 H-UMDG 变更事件，生产环境应由真实 H-UMDG 变更接口或 Webhook 写入。

## 14\. 设备分类绑定
```
POST /api/v1/equipment/assets/{equipmentId}/classification-bind
```

绑定请求包含：`classificationId`、`classificationCode`、`classificationName`、`classificationVersionId`、`managementClass`、`confirmReason`、`matchMethod`、`matchScore`。绑定后更新设备档案分类字段，写入 `asset.equipment_classification_binding_log`，并写入审计日志 `ASSET_CLASSIFICATION_BIND`。

## 15\. 分类变更影响同步
```
POST /api/v1/equipment/assets/classification-impacts/sync
GET /api/v1/equipment/assets/classification-impacts?status=pending
```

用途：医学装备档案库读取已拉取的 H-UMDG 分类变更，按 `classification_id` 或 `classification_code` 命中本地设备，生成 `asset.equipment_classification_impact` 影响提醒。管理类别变化、编码变化、作废、合并、拆分为高风险，需人工确认；描述或用途变化只生成复核提醒，不自动覆盖档案。

## 16\. 分类变更影响处理
```
POST /api/v1/equipment/assets/classification-impacts/{impactId}/confirm
POST /api/v1/equipment/assets/classification-impacts/{impactId}/ignore
POST /api/v1/equipment/assets/classification-impacts/{impactId}/adjust
POST /api/v1/equipment/assets/{equipmentId}/classification-detail-viewed
```

用途：把已生成的分类变更影响从“待复核”推进到“已确认 / 已忽略 / 已调整”。`confirm` 表示人工确认当前分类仍适用；`ignore` 仅允许低/中风险影响，高风险或作废、合并、拆分类影响必须确认或调整；`adjust` 传入新的 `classificationId`、`classificationCode`、`classificationName`、`classificationVersionId`、`managementClass`、`confirmReason`、`matchMethod`、`matchScore`，调整后写入绑定日志并将设备状态标记为 `remapped`。查看 H-UMDG 标准目录详情需调用 `classification-detail-viewed` 写入审计日志。

---
# 下一步建议
继续进入：
# 《前端页面与菜单结构设计 V1.0》

**工程补充**：PC 管理端已实现范围与 **`docs/06`** 的接口对照见 **`docs/05_前端设计/03_PC管理端一期实现对照.md`**（与菜单树文档 **§七** 索引互链）。**本章新增 §十～§十四** 对应菜单中 PM、计量、效益、系统用户/角色与统一任务引擎；落地后请同步更新该对照表与 `backend/tests/` 契约用例。

这一步可以明确：
  * 管理端页面结构
  * 供应商门户页面结构
  * 手机扫码端页面结构
  * 工程师工作台
  * 院领导驾驶舱
  * 财务付款看板
  * AI知识库页面
