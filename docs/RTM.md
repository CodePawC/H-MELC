# H-MELC RTM v1.1.0

本 RTM 用于区分一期真实闭环、演示页和后续阶段。凡页面使用 `HospitalPresetPage` 统一演示页且未接真实后端接口，状态标记为 `Demo`，不作为 `Verified`。

| 需求编号 | 需求名称 | 需求描述 | 后端实现文件 | 前端实现文件 | 测试用例 | 当前状态 | 纳入一期 UAT | 备注 |
|---|---|---|---|---|---|---|---|---|
| MEOMS-REQ-001 | 平台路由与统一响应 | `/api/v1` 与 `{code,message,data}` | `backend/app/modules/__init__.py` | `frontend-admin/src/lib/api.ts` | `backend/tests/*contract*` | Implemented | 是 | docs/06 对齐 |
| MEOMS-REQ-002 | 登录认证与 RBAC | JWT、`/auth/me`、权限依赖 | `backend/app/modules/auth/*` | `frontend-admin/src/stores/authStore.ts` | `backend/tests/test_auth*` | Verified | 是 | 默认真实登录 |
| MEOMS-REQ-003 | 审计日志 | 记录关键操作 | `backend/app/modules/audit/*` | `frontend-admin/src/pages/*Audit*` | `backend/tests/test_audit*` | Implemented | 是 | 按迁移就绪验证 |
| MEOMS-REQ-004 | 健康探针 | `/health`、`/health/ready` | `backend/app/main.py` | 不适用 | `backend/tests/test_health*` | Verified | 是 | ready 包含迁移状态 |
| MEOMS-ASSET-001 | 设备台账 | 列表、筛选、资产读取 | `backend/app/modules/asset/*` | `frontend-admin/src/pages/AssetsPage.tsx` | `backend/tests/test_asset*` | Verified | 是 | 保留已验证档案与打印 |
| MEOMS-ASSET-002 | 设备详情 | 多标签详情、档案、维修摘要 | `backend/app/modules/asset/router.py` | `frontend-admin/src/pages/AssetDetailPage.tsx` | `backend/tests/test_asset*` | Verified | 是 | 已验证抽屉/档案不回退 |
| MEOMS-ASSET-002A | 设备新增 | 主数据引用 + 业务信息录入 | `backend/app/modules/asset/*`、`backend/app/modules/hmdm/*` | `frontend-admin/src/pages/AssetCreatePage.tsx` | `backend/tests/test_hmdm_contract.py`、前端 build | Implemented | 是 | 附件上传待正式接口 |
| MEOMS-ASSET-003 | 一机一码 | 标签模板、二维码打印载荷 | `backend/app/modules/asset/label_templates.py` | `frontend-admin/src/pages/assets/AssetLabelPrintPanel.tsx` | `backend/tests/test_asset_label*` | Verified | 是 | 精臣打印保留 |
| MEOMS-ASSET-004 | 扫码解析 | 解析二维码 token | `backend/app/modules/scan/*` | `frontend-admin/src/pages/AssetCodesPage.tsx` | `backend/tests/test_scan*` | Implemented | 是 |  |
| MEOMS-ASSET-005 | H-UMDG 设备分类引用 | 从 H-UMDG 获取分类树并缓存 | `backend/app/modules/hmdm/*` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 | 外部系统代理 |
| MEOMS-ASSET-006 | H-UMDG 设备标准名称引用 | 查询标准名称、别名、分类 | `backend/app/modules/hmdm/*` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 | 不维护权威库 |
| MEOMS-ASSET-007 | H-UMDG 医疗器械分类目录引用 | 只读展示监管大类/类别/管理类别 | `backend/app/modules/asset/schemas.py` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 | 设备新增页后续可嵌入 |
| MEOMS-ASSET-008 | H-UMDG 厂商机构引用 | 厂商/供应商/售后/服务商引用快照 | `backend/app/modules/hmdm/*` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 | H-UMDG 为权威来源 |
| MEOMS-REPAIR-001 | 报修工单 | 工单列表与详情 | `backend/app/modules/repair/*` | `frontend-admin/src/pages/RepairTicketsPage.tsx` | `backend/tests/test_repair*` | Verified | 是 |  |
| MEOMS-REPAIR-002 | 抢单 | 工程师抢单 | `backend/app/modules/repair/router.py` | `frontend-admin/src/pages/RepairDetailPage.tsx` | `backend/tests/test_repair*` | Implemented | 是 |  |
| MEOMS-REPAIR-003 | 派单 | 设备科派工 | `backend/app/modules/repair/router.py` | `frontend-admin/src/pages/RepairDispatchPage.tsx` | `backend/tests/test_repair*` | Implemented | 是 |  |
| MEOMS-REPAIR-004 | 维修过程 | 过程记录 | `backend/app/modules/repair/router.py` | `frontend-admin/src/pages/RepairDetailPage.tsx` | `backend/tests/test_repair*` | Implemented | 是 |  |
| MEOMS-REPAIR-005 | 完成维修 | 完工报告 | `backend/app/modules/repair/router.py` | `frontend-admin/src/pages/RepairDetailPage.tsx` | `backend/tests/test_repair*` | Implemented | 是 |  |
| MEOMS-REPAIR-006 | 科室确认 | 科室验收确认 | `backend/app/modules/repair/router.py` | `frontend-admin/src/pages/RepairDetailPage.tsx` | `backend/tests/test_repair*` | Implemented | 是 |  |
| MEOMS-REPAIR-007 | 外修返厂 | 外修/返厂标记 | `backend/app/modules/repair/router.py` | `frontend-admin/src/pages/RepairDetailPage.tsx` | `backend/tests/test_repair*` | Implemented | 是 |  |
| MEOMS-PM-001 | 保养计划 | PM 计划 | `backend/app/modules/pm/*` | `frontend-admin/src/pages/pm/PmPlansPage.tsx` | `backend/tests/test_pm*` | Implemented | 是 |  |
| MEOMS-PM-002 | 保养任务 | PM 任务 | `backend/app/modules/pm/*` | `frontend-admin/src/pages/pm/PmTasksPage.tsx` | `backend/tests/test_pm*` | Implemented | 是 |  |
| MEOMS-PM-003 | 巡检任务 | 巡检执行 | `backend/app/modules/pm/*` | `frontend-admin/src/pages/pm/PmInspectionPage.tsx` | `backend/tests/test_pm*` | Implemented | 是 |  |
| MEOMS-PM-004 | 维护日历 | PM/巡检日程 | `backend/app/modules/pm/*` | `frontend-admin/src/pages/pm/PmCalendarPage.tsx` | `backend/tests/test_pm*` | Implemented | 是 |  |
| MEOMS-PM-005 | 逾期预警 | PM/巡检逾期 | `backend/app/modules/pm/*` | `frontend-admin/src/pages/pm/PmAlertsPage.tsx` | `backend/tests/test_pm*` | Implemented | 是 |  |
| MEOMS-PM-006 | 急救设备完好率 | 急救设备统计 | `backend/app/modules/pm/*` | `frontend-admin/src/pages/pm/PmAlertsPage.tsx` | `backend/tests/test_pm*` | Implemented | 是 |  |
| MEOMS-MET-001 | 计量台账 | 计量设备台账 | `backend/app/modules/metrology/*` | `frontend-admin/src/pages/metrology/MetrologyWorkbenchPage.tsx` | `backend/tests/test_metrology*` | Implemented | 是 |  |
| MEOMS-MET-002 | 检定计划 | 检定计划 | `backend/app/modules/metrology/*` | `frontend-admin/src/pages/metrology/MetrologyWorkbenchPage.tsx` | `backend/tests/test_metrology*` | Implemented | 是 |  |
| MEOMS-MET-003 | 计量证书 | 证书管理 | `backend/app/modules/metrology/*` | `frontend-admin/src/pages/metrology/MetrologyWorkbenchPage.tsx` | `backend/tests/test_metrology*` | Implemented | 是 |  |
| MEOMS-MET-004 | 到期预警 | 证书到期提醒 | `backend/app/modules/metrology/*` | `frontend-admin/src/pages/metrology/MetrologyWorkbenchPage.tsx` | `backend/tests/test_metrology*` | Implemented | 是 |  |
| MEOMS-MET-005 | 专项视图 | 放射/压力容器等组合视图 | `backend/app/modules/metrology/*` | `frontend-admin/src/pages/metrology/MetrologyWorkbenchPage.tsx` | `backend/tests/test_metrology*` | Implemented | 是 |  |
| MEOMS-PUR-001 | 采购项目 | 项目发布 | `backend/app/modules/procurement/*` | `frontend-admin/src/pages/ProcurementWorkbenchPage.tsx` | `backend/tests/test_supplier_project*` | Implemented | 是 |  |
| MEOMS-PUR-002 | 供应商报价 | 报价提交/查看 | `backend/app/modules/procurement/*` | `frontend-admin/src/pages/ProcurementWorkbenchPage.tsx` | `backend/tests/test_supplier_project*` | Implemented | 是 |  |
| MEOMS-PUR-003 | 报价评审 | 评审收官与中标 | `backend/app/modules/procurement/*` | `frontend-admin/src/pages/ProcurementWorkbenchPage.tsx` | `backend/tests/test_supplier_project*` | Implemented | 是 |  |
| MEOMS-SUP-001 | 供应商门户登录 | 供应商门户认证 | `backend/app/modules/supplier_portal/*` | `frontend-admin/src/pages/SupplierPortalPage.tsx` | `backend/tests/test_supplier_portal*` | Implemented | 是 |  |
| MEOMS-SUP-002 | 供应商资质 | 资质上传/审核视图 | `backend/app/modules/supplier_portal/*` | `frontend-admin/src/pages/SupplierPortalPage.tsx` | `backend/tests/test_supplier_portal*` | Implemented | 是 | 首次注册不写权威厂商库 |
| MEOMS-FIN-001 | 发票上传 | 供应商发票上传 | `backend/app/modules/finance/*` | `frontend-admin/src/pages/finance/*` | `backend/tests/test_finance*` | Implemented | 是 |  |
| MEOMS-FIN-002 | 发票审核 | 发票审核 | `backend/app/modules/finance/*` | `frontend-admin/src/pages/finance/*` | `backend/tests/test_finance*` | Implemented | 是 |  |
| MEOMS-FIN-003 | 应付款台账 | 应付列表 | `backend/app/modules/finance/*` | `frontend-admin/src/pages/finance/*` | `backend/tests/test_finance*` | Implemented | 是 |  |
| MEOMS-FIN-004 | 付款登记 | 付款记录 | `backend/app/modules/finance/*` | `frontend-admin/src/pages/finance/*` | `backend/tests/test_finance*` | Implemented | 是 |  |
| MEOMS-FIN-005 | 账龄分析 | 应付账龄 | `backend/app/modules/finance/*` | `frontend-admin/src/pages/finance/*` | `backend/tests/test_finance*` | Implemented | 是 |  |
| MEOMS-FIN-006 | AI 付款优先级 | 付款优先级建议 | `backend/app/modules/finance/*` | `frontend-admin/src/pages/finance/*` | `backend/tests/test_finance*` | Implemented | 是 | 辅助建议，不自动审批 |
| MEOMS-HMDM-001 | H-UMDG API 配置 | H-UMDG URL/API Key/超时/缓存配置 | `backend/app/core/config.py` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 | H-UMDG 外部系统 |
| MEOMS-HMDM-002 | 设备分类树调用 | 代理 H-UMDG 分类树 | `backend/app/modules/hmdm/router.py` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 |  |
| MEOMS-HMDM-003 | 设备标准名称查询 | 代理标准名称检索 | `backend/app/modules/hmdm/router.py` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 |  |
| MEOMS-HMDM-004 | 设备标准名称详情 | 代理标准名称详情 | `backend/app/modules/hmdm/router.py` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 |  |
| MEOMS-HMDM-005 | 医疗器械分类目录信息展示 | 只读展示监管信息 | `backend/app/modules/asset/schemas.py` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 | 不允许本地修改 |
| MEOMS-HMDM-006 | 厂商机构查询 | 代理厂商机构查询 | `backend/app/modules/hmdm/router.py` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 |  |
| MEOMS-HMDM-007 | 厂商机构详情 | 代理厂商详情 | `backend/app/modules/hmdm/router.py` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 |  |
| MEOMS-HMDM-008 | 厂商关系查询 | 母子公司/授权代理/售后关系 | `backend/app/modules/hmdm/router.py` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 |  |
| MEOMS-HMDM-009 | 字典本地缓存 | 只读缓存与降级 | `backend/app/modules/hmdm/service.py` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 | 缓存非权威 |
| MEOMS-HMDM-010 | 设备标准名称新增申请 | 候选申请，不写权威库 | `backend/app/modules/hmdm/router.py` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 | 待同步 H-UMDG 审核 |
| MEOMS-HMDM-011 | 厂商机构新增申请 | 候选申请，不写权威库 | `backend/app/modules/hmdm/router.py` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 | 待同步 H-UMDG 审核 |
| MEOMS-HMDM-012 | H-UMDG 降级提示 | 不可用时返回缓存标记 | `backend/app/modules/hmdm/service.py` | `frontend-admin/src/pages/HmdmIntegrationPage.tsx` | `backend/tests/test_hmdm_contract.py` | Implemented | 是 | 页面提示降级 |
| MEOMS-FUTURE-001 | 合同管理 | 采购合同闭环 | 待定 | `HospitalPresetPage` | 不计入 | Demo | 否 | 后续阶段 |
| MEOMS-FUTURE-002 | 到货管理 | 到货验收完整闭环 | 待定 | `HospitalPresetPage` | 不计入 | Demo | 否 | 后续阶段 |
| MEOMS-FUTURE-003 | 培训管理 | 培训闭环 | 待定 | `HospitalPresetPage` | 不计入 | Demo | 否 | 后续阶段 |
| MEOMS-FUTURE-004 | 耗材管理 | 耗材完整业务 | 待定 | `HospitalPresetPage` | 不计入 | Demo | 否 | 后续阶段 |
| MEOMS-FUTURE-005 | 质控安全 | 质控安全完整闭环 | 待定 | `HospitalPresetPage` | 不计入 | Demo | 否 | 后续阶段 |
| MEOMS-FUTURE-006 | 知识库 RAG | 正式 RAG 问答 | 待定 | `frontend-admin/src/pages/Knowledge*` | 不计入 | Demo | 否 | 后续阶段 |
| MEOMS-FUTURE-007 | IoT 接入 | 设备物联接入 | 待定 | 待定 | 不计入 | Future | 否 | 后续阶段 |
| MEOMS-FUTURE-008 | RFID | RFID 资产识别 | 待定 | 待定 | 不计入 | Future | 否 | 后续阶段 |
| MEOMS-FUTURE-009 | 数字孪生 | 真实数字孪生 | 待定 | 待定 | 不计入 | Future | 否 | 后续阶段 |
| MEOMS-FUTURE-010 | 高级 BI | 高级经营分析 | 待定 | `HospitalPresetPage` | 不计入 | Demo | 否 | 后续阶段 |
