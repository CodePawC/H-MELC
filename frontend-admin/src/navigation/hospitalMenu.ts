/**
 * H-MELC 管理端菜单（IOC + AI + 任务闭环 + 全生命周期运营，与 RBAC、供应商门户联动）
 */

import { hasAnyPermission } from '../auth/permission'
import type { AuthUserProfile } from '../types/authProfile'

/** 兼容旧版页面类型 + 医院注册表 preset */
export type AdminPageKind =
  | 'home'
  | 'assetsOverview'
  | 'assets'
  | 'assetCreate'
  | 'assetCodes'
  | 'repairCenter'
  | 'repairNew'
  | 'repairAssistant'
  | 'repairChannels'
  | 'repairPending'
  | 'repairRules'
  | 'repairs'
  | 'repairDispatch'
  | 'repairProcess'
  | 'repairAccept'
  | 'repairHistory'
  | 'repairFaultAnalysis'
  | 'financeInvoices'
  | 'financePayables'
  | 'financePayments'
  | 'financeAllocations'
  | 'financeAging'
  | 'financePriority'
  | 'auditLogs'
  | 'supplierProfiles'
  | 'supplierQualifications'
  | 'supplierProjects'
  | 'procurementWorkbench'
  | 'workflowConsole'
  | 'mdmDictionary'
  | 'masterDataSourceConfig'
  | 'masterDataObjects'
  | 'masterDataFieldMapping'
  | 'masterDataSyncTasks'
  | 'masterDataQualityCheck'
  | 'masterDataConflicts'
  | 'supplementRequests'
  | 'knowledgeDocuments'
  | 'aiGateway'
  | 'apiDirectory'
  | 'integrationCenter'
  | 'standardDataAccess'
  | 'businessInterfaces'
  | 'iotDevices'
  | 'apiAuth'
  | 'interfaceLogs'
  | 'messageQueue'
  | 'pmPlans'
  | 'pmTasks'
  | 'pmCalendar'
  | 'pmAlerts'
  | 'pmInspection'
  | 'metrologyWorkbench'
  | 'operationCenterOverview'
  | 'operationCenterScreen'
  | 'operationCenterCarousel'
  | 'operationCenterPublish'
  | 'operationCenterAccessKeys'
  | 'operationCenterTerminals'
  | 'operationCenterAccessLogs'
  | 'workspaceTodos'
  | 'workspaceRisks'
  | 'workspaceAi'
  | 'systemUsers'
  | 'systemRoles'
  | 'systemMenus'
  | 'aboutSystem'
  | 'portalHome'
  | 'portalInvoices'
  | 'portalPayments'
  | 'portalQuotations'

export type MenuAccess = 'internal' | 'supplier' | 'both'

export interface AdminMenuLeaf {
  path: string
  label: string
  icon?: string
  page?: AdminPageKind
  children?: AdminMenuLeaf[]
  /** 医院统一 Mock/业务页 */
  hospitalPreset?: string
  requiredPermissions?: string[]
  requiredRoles?: string[]
  access?: MenuAccess
}

export interface AdminMenuGroup {
  id: string
  label: string
  icon?: string
  items: AdminMenuLeaf[]
  access?: MenuAccess
  /** 具备其一角色可见该分组；未配置则仅按叶子权限过滤 */
  allowedRoles?: string[]
}

const RA = ['PLATFORM_ADMIN', 'SYS_ADMIN']
const RD = ['DEVICE_DIRECTOR', 'DEVICE_ADMIN']
const RE = ['DEVICE_ENGINEER', 'ENGINEER']
const RN = ['DEPT_HEAD_NURSE', 'DEPT_USER', 'DEPT_DIRECTOR']
const RF = ['FINANCE']
const RP = ['PROCUREMENT']
const RQ = ['AUDIT_QC', 'AUDIT_ADMIN']

const R_INT = [...RA, ...RD, ...RE, ...RN, ...RF, ...RP, ...RQ]
const R_QC = [...RA, ...RD, ...RQ]

/** 维修执行侧（不含一线报修护士） */
const R_REPAIR_OPS = [...RA, ...RD, ...RE]
/** 质控核心（不含临床） */
const R_QC_STAFF = [...RA, ...RD, ...RQ]
/** 设备台账配置类菜单（护士长仅看总览/档案） */
const R_ASSET_CFG = [...RA, ...RD, ...RE, ...RP, ...RQ, 'DEPT_DIRECTOR']
/** 可确认维修闭环的角色 */
const R_REPAIR_ACCEPT = [...RA, ...RD, ...RE, 'DEPT_HEAD_NURSE', 'DEPT_DIRECTOR']

const p = {
  dash: ['dashboard:home:view'],
  task: ['workflow:task:view', 'dashboard:home:view'],
  asset: ['equipment:asset:view'],
  repair: ['equipment:repair:view'],
  pm: ['equipment:pm:view'],
  meter: ['equipment:metrology:view'],
  pur: ['equipment:purchase:view'],
  fin: ['finance:payment:view', 'finance:invoice:view'],
  sup: ['supplier:profile:view', 'supplier:portal:access'],
  qc: ['equipment:qc:view'],
  ai: ['ai:task:view'],
  ioc: ['dashboard:home:view'],
  sys: ['system:user:view'],
}

function presetLeaf(
  path: string,
  label: string,
  requiredPermissions: string[] = p.dash,
  extra: Partial<AdminMenuLeaf> = {},
): AdminMenuLeaf {
  return {
    path,
    label,
    hospitalPreset: path.replace(/^\/+/, '').replace(/\W+/g, '_'),
    requiredPermissions,
    ...extra,
  }
}

function flattenMenuLeaves(items: AdminMenuLeaf[]): AdminMenuLeaf[] {
  return items.flatMap((item) => (item.children?.length ? flattenMenuLeaves(item.children) : [item]))
}

export function firstMenuLeafPath(items: AdminMenuLeaf[]): string | undefined {
  for (const item of items) {
    if (item.children?.length) {
      const childPath = firstMenuLeafPath(item.children)
      if (childPath) return childPath
      continue
    }
    return item.path
  }
  return undefined
}

const LEGACY_ADMIN_MENU_GROUPS: AdminMenuGroup[] = [
  {
    id: 'dashboard',
    label: '运营中心',
    allowedRoles: R_INT,
    items: [
      { path: '/dashboard', label: '运营总览', page: 'home', requiredPermissions: p.dash },
      presetLeaf('/dashboard/kpi', 'KPI中心', p.dash),
      presetLeaf('/analytics/bi', 'BI分析', p.dash),
      { path: '/dashboard/risk', label: '风险分析', page: 'workspaceRisks', requiredPermissions: p.dash },
      presetLeaf('/analytics/payment', '财务分析', ['finance:payment:view'], { hospitalPreset: 'analytics_pay' }),
      presetLeaf('/analytics/benefit', '效益分析', ['equipment:asset:view'], { hospitalPreset: 'analytics_benefit' }),
      presetLeaf('/dashboard/insight', 'AI运营洞察', p.ai),
      presetLeaf('/dashboard/reports', '运营报告', p.dash),
      presetLeaf('/dashboard/executive', '院长驾驶舱', p.dash),
    ],
  },
  {
    id: 'task-center',
    label: '任务运营中心',
    allowedRoles: R_INT,
    items: [
      presetLeaf('/task-center/all', '全部任务', p.task),
      { path: '/task-center/my', label: '我的待办', page: 'workspaceTodos', requiredPermissions: p.task },
      presetLeaf('/task-center/today', '今日督办', p.task),
      presetLeaf('/task-center/overtime', '超时任务', p.task),
      presetLeaf('/task-center/high-risk', '高风险任务', p.task),
      presetLeaf('/task-center/hospital', '院级督办', p.task),
      presetLeaf('/task-center/meetings', '会议决议', p.task),
      presetLeaf('/task-center/leadership', '领导交办', p.task),
      presetLeaf('/task-center/ai', 'AI自动任务', p.task),
      presetLeaf('/task-center/rules', '自动派单规则', ['workflow:config:view', 'system:param:view']),
      presetLeaf('/task-center/sla-rules', 'SLA升级规则', ['workflow:config:view', 'system:param:view']),
      presetLeaf('/task-center/escalation', '升级记录', p.task),
      presetLeaf('/task-center/acceptance', '闭环验收', p.task),
      presetLeaf('/task-center/calendar', '任务日历', p.task),
      presetLeaf('/task-center/templates', '任务模板', ['workflow:config:view', 'system:param:view']),
      presetLeaf('/task-center/statistics', '任务统计', p.task),
      presetLeaf('/task-center/closure-rate', '闭环率分析', p.task),
      presetLeaf('/task-center/overtime-analysis', '超时分析', p.task),
      presetLeaf('/task-center/knowledge', '任务知识库', ['knowledge:doc:view']),
    ],
  },
  {
    id: 'assets',
    label: '设备资产',
    allowedRoles: [...RA, ...RD, ...RE, ...RN, ...RP, ...RQ],
    items: [
      { path: '/assets/overview', label: '设备总览', page: 'assetsOverview', requiredPermissions: p.asset },
      { path: '/assets/archive', label: '设备档案', page: 'assets', requiredPermissions: p.asset },
      { path: '/assets/new', label: '智能建档', page: 'assetCreate', requiredPermissions: p.asset, requiredRoles: R_ASSET_CFG },
      presetLeaf('/assets/batch-intake', '批量建档', p.asset, { requiredRoles: R_ASSET_CFG }),
      presetLeaf('/assets/intake-review', '待审核建档', p.asset, { requiredRoles: R_ASSET_CFG }),
      presetLeaf('/assets/intake-drafts', '建档草稿', p.asset, { requiredRoles: R_ASSET_CFG }),
      presetLeaf('/assets/intake-records', '建档记录', p.asset, { requiredRoles: R_ASSET_CFG }),
      presetLeaf('/assets/categories', '分类管理', p.asset, { hospitalPreset: 'assets_category', requiredRoles: R_ASSET_CFG }),
      presetLeaf('/assets/dept-distribution', '科室分布', p.asset, { hospitalPreset: 'assets_dept', requiredRoles: R_ASSET_CFG }),
      presetLeaf('/assets/lifecycle', '生命周期管理', p.asset),
      { path: '/assets/qrcodes', label: '设备二维码', page: 'assetCodes', requiredPermissions: p.asset, requiredRoles: R_ASSET_CFG },
      presetLeaf('/assets/nameplates', '设备电子铭牌', p.asset),
      presetLeaf('/assets/status', '运行状态监测', p.asset),
      presetLeaf('/assets/uptime', '开机率分析', p.asset),
      presetLeaf('/assets/utilization', '使用率分析', p.asset),
      presetLeaf('/assets/depreciation', '折旧分析', p.asset),
      presetLeaf('/assets/replacement', '设备更新计划', p.asset),
      presetLeaf('/assets/large-equipment', '大型设备管理', p.asset),
      presetLeaf('/assets/special-equipment', '特种设备管理', p.asset),
      presetLeaf('/assets/imaging', '医学影像设备', p.asset),
      presetLeaf('/assets/life-support', '急救生命支持设备', p.asset),
      presetLeaf('/assets/attachments', '附件资料', p.asset, { hospitalPreset: 'assets_attach', requiredRoles: R_ASSET_CFG }),
      presetLeaf('/assets/graph', '设备知识图谱', p.asset),
    ],
  },
  {
    id: 'maintenance',
    label: '运维保障',
    allowedRoles: R_INT,
    items: [
      { path: '/repair/center', label: '统一报修中心', page: 'repairCenter', requiredPermissions: p.repair },
      { path: '/repair/new', label: '新建报修', page: 'repairNew', requiredPermissions: p.repair },
      { path: '/repair/ai-assistant', label: 'AI报修助手', page: 'repairAssistant', requiredPermissions: p.repair },
      { path: '/repair/channels', label: '多渠道接入', page: 'repairChannels', requiredPermissions: p.repair, requiredRoles: R_REPAIR_OPS },
      { path: '/repair/pending-confirmations', label: '待确认报修', page: 'repairPending', requiredPermissions: p.repair, requiredRoles: R_REPAIR_OPS },
      { path: '/repair/dispatch', label: '待派工工单', page: 'repairDispatch', requiredPermissions: ['equipment:repair:assign'], requiredRoles: R_REPAIR_OPS },
      { path: '/repair/process', label: '维修处理中', page: 'repairProcess', requiredPermissions: p.repair, requiredRoles: R_REPAIR_OPS },
      { path: '/repair/accept', label: '待验收工单', page: 'repairAccept', requiredPermissions: p.repair, requiredRoles: R_REPAIR_ACCEPT },
      { path: '/repair/tickets', label: '已完成工单', page: 'repairs', requiredPermissions: p.repair },
      { path: '/repair/rules', label: '报修规则配置', page: 'repairRules', requiredPermissions: p.repair, requiredRoles: R_REPAIR_OPS },
      { path: '/repair/history', label: '维修记录', page: 'repairHistory', requiredPermissions: p.repair, requiredRoles: R_REPAIR_OPS },
      { path: '/repair/fault-analysis', label: '故障分析', page: 'repairFaultAnalysis', requiredPermissions: p.repair, requiredRoles: R_REPAIR_OPS },
      presetLeaf('/repair/rca', '根因分析RCA', p.repair, { requiredRoles: R_REPAIR_OPS }),
      presetLeaf('/repair/parts', '配件管理', p.repair, { requiredRoles: R_REPAIR_OPS }),
      presetLeaf('/repair/schedule', '工程师排班', p.repair, { requiredRoles: R_REPAIR_OPS }),
      presetLeaf('/repair/vendor', '第三方维保', p.repair, { requiredRoles: R_REPAIR_OPS }),
      { path: '/pm/plans', label: '保养计划', page: 'pmPlans', requiredPermissions: p.pm },
      { path: '/pm/tasks', label: '保养任务', page: 'pmTasks', requiredPermissions: p.pm },
      { path: '/pm/inspection', label: '巡检记录', page: 'pmInspection', requiredPermissions: p.pm },
      presetLeaf('/pm/loop', 'PM闭环', p.pm),
      { path: '/pm/calendar', label: '维护日历', page: 'pmCalendar', requiredPermissions: p.pm },
      { path: '/pm/alerts', label: 'PM预警', page: 'pmAlerts', requiredPermissions: p.pm },
      presetLeaf('/pm/predictive', '预测性维护', p.pm),
      { path: '/meter/ledger', label: '计量台账', page: 'metrologyWorkbench', requiredPermissions: p.meter },
      { path: '/meter/plan', label: '检定计划', page: 'metrologyWorkbench', requiredPermissions: p.meter },
      { path: '/meter/records', label: '检定记录', page: 'metrologyWorkbench', requiredPermissions: p.meter },
      { path: '/meter/certificates', label: '校准证书', page: 'metrologyWorkbench', requiredPermissions: p.meter },
      { path: '/meter/alerts', label: '到期预警', page: 'metrologyWorkbench', requiredPermissions: p.meter },
      presetLeaf('/meter/mandatory', '强检设备', p.meter),
      presetLeaf('/meter/analytics', '计量质控分析', p.meter),
    ],
  },
  {
    id: 'supply-finance',
    label: '供应链与财务',
    allowedRoles: [...R_INT, 'SUPPLIER_PORTAL'],
    items: [
      { path: '/purchase/apply', label: '采购申请', page: 'procurementWorkbench', requiredPermissions: p.pur },
      { path: '/purchase/review', label: '采购论证', page: 'procurementWorkbench', requiredPermissions: p.pur },
      { path: '/purchase/plan', label: '采购计划', page: 'procurementWorkbench', requiredPermissions: p.pur },
      presetLeaf('/purchase/tender', '招标管理', p.pur),
      presetLeaf('/purchase/contracts', '合同管理', ['equipment:contract:view'], { hospitalPreset: 'pur_contract' }),
      presetLeaf('/purchase/arrival', '到货验收', ['equipment:acceptance:view'], { hospitalPreset: 'pur_arrive' }),
      presetLeaf('/purchase/training', '安装培训', p.pur, { hospitalPreset: 'pur_train' }),
      presetLeaf('/consumables/catalog', '耗材目录', ['equipment:consumable:view'], { hospitalPreset: 'cons_catalog' }),
      presetLeaf('/consumables/inbound', '入库管理', ['equipment:consumable:manage'], { hospitalPreset: 'cons_in' }),
      presetLeaf('/consumables/outbound', '出库管理', ['equipment:consumable:manage'], { hospitalPreset: 'cons_out' }),
      presetLeaf('/consumables/alerts', '库存预警', ['equipment:consumable:view'], { hospitalPreset: 'cons_alert' }),
      presetLeaf('/consumables/vbp', '带量采购', ['equipment:purchase:view'], { hospitalPreset: 'cons_vbp' }),
      presetLeaf('/consumables/spd', 'SPD对接', ['equipment:consumable:view'], { hospitalPreset: 'cons_spd' }),
      presetLeaf('/consumables/high-value', '高值耗材管理', ['equipment:consumable:view']),
      presetLeaf('/consumables/traceability', '追溯管理', ['equipment:consumable:view']),
      { path: '/supplier/profiles', label: '供应商档案', page: 'supplierProfiles', requiredPermissions: ['supplier:profile:view'] },
      { path: '/supplier/qualifications', label: '资质审核', page: 'supplierQualifications', requiredPermissions: ['supplier:qualification:view'] },
      { path: '/supplier/projects', label: '竞价项目', page: 'supplierProjects', requiredPermissions: ['supplier:project:view'] },
      presetLeaf('/supplier/scoring', '供应商评分', ['supplier:profile:view']),
      presetLeaf('/supplier/blacklist', '黑名单管理', ['supplier:profile:view']),
      { path: '/supplier-portal/dashboard', label: '供应商门户', page: 'portalHome', access: 'both', requiredPermissions: ['supplier:portal:access'] },
      presetLeaf('/supplier-portal/profile', '门户档案', ['supplier:profile:view'], { hospitalPreset: 'sp_profile', access: 'both' }),
      presetLeaf('/supplier-portal/invoices', '发票上传', ['supplier:invoice:upload'], { hospitalPreset: 'sp_invoice_up', access: 'supplier' }),
      presetLeaf('/supplier-portal/ocr', 'AI票据识别', ['supplier:invoice:upload', 'ai:task:view'], { access: 'both' }),
      presetLeaf('/supplier-portal/shipping', '随货同行单', ['supplier:invoice:view'], { hospitalPreset: 'sp_shipping', access: 'both' }),
      presetLeaf('/supplier-portal/quotes', '维修报价', ['supplier:quotation:upload'], { hospitalPreset: 'sp_quote', access: 'both' }),
      presetLeaf('/supplier-portal/reconciliation', '对账管理', ['finance:payment:view', 'supplier:payment:view'], { hospitalPreset: 'sp_recon', access: 'both' }),
      { path: '/supplier-portal/payments', label: '付款进度', page: 'portalPayments', access: 'both', requiredPermissions: ['supplier:payment:view', 'finance:payment:view'] },
      presetLeaf('/finance/apply', '付款申请', ['finance:payment:view'], { hospitalPreset: 'fin_apply' }),
      { path: '/finance/invoices', label: '发票管理', page: 'financeInvoices', requiredPermissions: ['finance:invoice:view'] },
      { path: '/finance/payables', label: '应付款台账', page: 'financePayables', requiredPermissions: p.fin },
      { path: '/finance/payments', label: '付款登记', page: 'financePayments', requiredPermissions: p.fin },
      { path: '/finance/allocations', label: '付款分摊', page: 'financeAllocations', requiredPermissions: p.fin },
      { path: '/finance/aging', label: '账龄分析', page: 'financeAging', requiredPermissions: ['finance:aging:view'] },
      presetLeaf('/finance/plan', '付款计划', ['finance:payment:view'], { hospitalPreset: 'fin_plan' }),
      presetLeaf('/finance/arrears', '欠款统计', ['finance:aging:view'], { hospitalPreset: 'fin_arrear' }),
      { path: '/finance/priority', label: '付款优先级', page: 'financePriority', requiredPermissions: ['finance:payment:view'] },
      presetLeaf('/finance/cost-center', '成本中心', ['finance:payment:view']),
      presetLeaf('/finance/analytics', '财务运营分析', ['finance:payment:view']),
    ],
  },
  {
    id: 'quality-safety',
    label: '质量安全',
    allowedRoles: [...R_QC, ...RE, 'DEPT_HEAD_NURSE', 'DEPT_USER', 'DEPT_DIRECTOR'],
    items: [
      presetLeaf('/qcsafety/check', '质量检查', p.qc, { hospitalPreset: 'qc_check', requiredRoles: R_QC_STAFF }),
      presetLeaf('/qcsafety/risk', '风险事件', p.qc, { hospitalPreset: 'qc_risk', requiredRoles: R_QC_STAFF }),
      presetLeaf('/qcsafety/adverse', '不良事件', p.qc, { hospitalPreset: 'qc_adverse', requiredRoles: R_QC_STAFF }),
      presetLeaf('/qcsafety/rca', 'RCA根因分析', p.qc, { requiredRoles: R_QC_STAFF }),
      presetLeaf('/qcsafety/capa', 'CAPA整改管理', p.qc, { requiredRoles: R_QC_STAFF }),
      presetLeaf('/qcsafety/emergency-devices', '应急设备', ['equipment:emergency:view'], { hospitalPreset: 'qc_emerge_dev', requiredRoles: [...RA, ...RD, ...RE, ...RQ] }),
      presetLeaf('/qcsafety/emergency-dispatch', '应急调配', ['equipment:emergency:view'], { hospitalPreset: 'qc_emerge_dispatch', requiredRoles: [...RA, ...RD, ...RE, 'DEPT_HEAD_NURSE', 'DEPT_DIRECTOR'] }),
      presetLeaf('/qcsafety/patrol', '安全巡查', p.qc, { hospitalPreset: 'qc_patrol', requiredRoles: R_QC_STAFF }),
      presetLeaf('/qcsafety/radiation', '辐射安全', p.qc, { hospitalPreset: 'quality_radiation' }),
      presetLeaf('/qcsafety/radiation-assets', '放射设备管理', p.qc),
      presetLeaf('/qcsafety/radiation-staff', '辐射人员管理', p.qc),
      presetLeaf('/qcsafety/radiation-dose', '辐射剂量监测', p.qc),
      presetLeaf('/qcsafety/gas', '医用气体', p.qc, { hospitalPreset: 'quality_gas' }),
      presetLeaf('/qcsafety/oxygen', '中心供氧监测', p.qc),
      presetLeaf('/qcsafety/negative-pressure', '负压系统监测', p.qc),
      presetLeaf('/qcsafety/ups', 'UPS供电监测', p.qc),
      presetLeaf('/qcsafety/lightning', '防雷监测', p.qc),
      presetLeaf('/qcsafety/environment', '环境监测', p.qc),
      presetLeaf('/qcsafety/safety-ledger', '安全生产台账', p.qc),
    ],
  },
  {
    id: 'ioc',
    label: 'IOC指挥中心',
    allowedRoles: R_INT,
    items: [
      { path: '/ioc/overview', label: '全院IOC总控', page: 'operationCenterOverview', requiredPermissions: p.ioc },
      { path: '/ioc/equipment-overview', label: '医学装备总览大屏', page: 'operationCenterScreen', requiredPermissions: p.ioc },
      { path: '/ioc/equipment-status', label: '设备运行态势大屏', page: 'operationCenterScreen', requiredPermissions: p.ioc },
      { path: '/ioc/repair-dispatch', label: '维修工单调度大屏', page: 'operationCenterScreen', requiredPermissions: p.ioc },
      { path: '/ioc/pm-loop', label: 'PM闭环大屏', page: 'operationCenterScreen', requiredPermissions: p.ioc },
      { path: '/ioc/qc-meter', label: '计量质控大屏', page: 'operationCenterScreen', requiredPermissions: p.ioc },
      { path: '/ioc/gas', label: '医用气体大屏', page: 'operationCenterScreen', requiredPermissions: p.ioc },
      { path: '/ioc/spd', label: 'SPD运营大屏', page: 'operationCenterScreen', requiredPermissions: p.ioc },
      { path: '/ioc/finance', label: '财务态势大屏', page: 'operationCenterScreen', requiredPermissions: p.ioc },
      { path: '/ioc/risk', label: '风险态势大屏', page: 'operationCenterScreen', requiredPermissions: p.ioc },
      { path: '/ioc/emergency', label: '应急战备大屏', page: 'operationCenterScreen', requiredPermissions: p.ioc },
      { path: '/ioc/radiation', label: '辐射安全大屏', page: 'operationCenterScreen', requiredPermissions: p.ioc },
      { path: '/ioc/payment', label: '供应商付款态势大屏', page: 'operationCenterScreen', requiredPermissions: p.ioc },
      { path: '/ioc/ai', label: 'AI运营决策大屏', page: 'operationCenterScreen', requiredPermissions: p.ai },
      { path: '/ioc/carousel', label: '大屏轮播配置', page: 'operationCenterCarousel', requiredPermissions: p.ioc },
      { path: '/ioc/publish', label: '发布与访问控制', page: 'operationCenterPublish', requiredPermissions: p.ioc },
      { path: '/ioc/terminals', label: '终端管理', page: 'operationCenterTerminals', requiredPermissions: p.ioc },
      { path: '/ioc/access-keys', label: '访问密钥管理', page: 'operationCenterAccessKeys', requiredPermissions: p.ioc },
      { path: '/ioc/access-logs', label: '访问日志', page: 'operationCenterAccessLogs', requiredPermissions: p.ioc },
    ],
  },
  {
    id: 'knowledge',
    label: '知识中心',
    allowedRoles: R_INT,
    items: [
      { path: '/knowledge/policies', label: '制度库', page: 'knowledgeDocuments', requiredPermissions: ['knowledge:doc:view'] },
      { path: '/knowledge/sop', label: 'SOP库', page: 'knowledgeDocuments', requiredPermissions: ['knowledge:doc:view'] },
      { path: '/knowledge/emergency', label: '应急预案', page: 'knowledgeDocuments', requiredPermissions: ['knowledge:doc:view'] },
      { path: '/knowledge/repair-cases', label: '维修案例', page: 'knowledgeDocuments', requiredPermissions: ['knowledge:doc:view'] },
      { path: '/knowledge/adverse-events', label: '不良事件案例', page: 'knowledgeDocuments', requiredPermissions: ['knowledge:doc:view'] },
      { path: '/knowledge/risk-cases', label: '风险案例库', page: 'knowledgeDocuments', requiredPermissions: ['knowledge:doc:view'] },
      presetLeaf('/knowledge/manuals', '操作手册', ['knowledge:doc:view'], { hospitalPreset: 'knowledge_manuals' }),
      presetLeaf('/knowledge/training', '培训中心', ['knowledge:doc:view'], { hospitalPreset: 'knowledge_training' }),
      presetLeaf('/knowledge/videos', '视频资料', ['knowledge:doc:view']),
      presetLeaf('/knowledge/graph', 'AI知识图谱', ['knowledge:doc:view']),
      presetLeaf('/knowledge/experts', '专家经验库', ['knowledge:doc:view']),
      { path: '/knowledge/qa', label: '智能问答', page: 'knowledgeDocuments', requiredPermissions: ['knowledge:doc:view'] },
      presetLeaf('/knowledge/learning', 'AI自动学习', ['knowledge:doc:view']),
    ],
  },
  {
    id: 'system',
    label: '系统管理',
    allowedRoles: R_INT,
    items: [
      {
        path: '/system/security',
        label: '用户与权限',
        children: [
          { path: '/system/users', label: '用户管理', page: 'systemUsers', requiredPermissions: ['system:user:view'] },
          { path: '/system/roles', label: '角色权限', page: 'systemRoles', requiredPermissions: ['system:role:view'] },
          { path: '/system/menus', label: '菜单管理', page: 'systemMenus', requiredPermissions: ['system:menu:assign'] },
          presetLeaf('/system/sso', '单点登录SSO', ['system:param:view']),
        ],
      },
      {
        path: '/system/basic',
        label: '基础设置',
        children: [
          { path: '/system/dictionary', label: '数据字典', page: 'mdmDictionary', requiredPermissions: ['mdm:dict:view'] },
          presetLeaf('/system/coding-rules', '编码规则', ['system:param:view']),
          presetLeaf('/system/parameters', '参数配置', ['system:param:view'], { hospitalPreset: 'sys_params' }),
          { path: '/system/workflows', label: '审批流配置', page: 'workflowConsole', requiredPermissions: ['workflow:config:view'] },
        ],
      },
      {
        path: '/system/master-data',
        label: '主数据服务',
        children: [
          { path: '/system/master-data/service-config', label: '主数据来源设置', page: 'masterDataSourceConfig', requiredPermissions: ['mdm:dict:view', 'system:param:view'] },
          { path: '/system/master-data/objects', label: '数据对象管理', page: 'masterDataObjects', requiredPermissions: ['mdm:dict:view', 'system:param:view'] },
          { path: '/system/master-data/field-mapping', label: '字段映射规则', page: 'masterDataFieldMapping', requiredPermissions: ['mdm:dict:view', 'system:param:view'] },
          { path: '/system/master-data/sync-tasks', label: '同步任务管理', page: 'masterDataSyncTasks', requiredPermissions: ['mdm:dict:view', 'system:param:view'] },
          { path: '/system/master-data/quality-check', label: '数据质量校验', page: 'masterDataQualityCheck', requiredPermissions: ['mdm:dict:view', 'system:param:view'] },
          { path: '/system/master-data/conflicts', label: '数据冲突处理', page: 'masterDataConflicts', requiredPermissions: ['mdm:dict:view', 'system:param:view'] },
          { path: '/system/master-data/supplement-requests', label: '补充申请管理', page: 'supplementRequests', requiredPermissions: ['mdm:dict:view', 'system:param:view'] },
        ],
      },
      {
        path: '/system/integration',
        label: '接入集成',
        children: [
          { path: '/system/integration/standard-data', label: '标准数据接入', page: 'standardDataAccess', requiredPermissions: ['system:param:view'] },
          { path: '/system/integration/business-interfaces', label: '业务系统接口', page: 'businessInterfaces', requiredPermissions: ['system:param:view'] },
          { path: '/system/integration/iot-devices', label: 'IoT设备接入', page: 'iotDevices', requiredPermissions: ['system:param:view'] },
          { path: '/system/integration/api-auth', label: 'API授权管理', page: 'apiAuth', requiredPermissions: ['system:param:view'] },
          { path: '/system/integration/interface-logs', label: '接口调用日志', page: 'interfaceLogs', requiredPermissions: ['system:param:view'] },
          { path: '/system/integration/message-queue', label: '消息队列配置', page: 'messageQueue', requiredPermissions: ['system:param:view'] },
        ],
      },
      {
        path: '/system/rules',
        label: '规则引擎',
        children: [
          presetLeaf('/system/rules/task-engine', '任务规则引擎', ['workflow:config:view', 'system:param:view']),
          presetLeaf('/system/rules/alert-engine', '告警规则引擎', ['system:param:view']),
          presetLeaf('/system/rules/sla', 'SLA规则配置', ['workflow:config:view', 'system:param:view']),
          presetLeaf('/system/rules/auto-dispatch', '自动派单规则', ['workflow:config:view', 'system:param:view']),
        ],
      },
      {
        path: '/system/notifications',
        label: '消息通知',
        children: [
          presetLeaf('/system/notifications/messages', '消息中心配置', ['system:param:view']),
          presetLeaf('/system/notifications/wechat', '微信通知配置', ['system:param:view']),
          presetLeaf('/system/notifications/sms', '短信通知配置', ['system:param:view']),
          presetLeaf('/system/notifications/email', '邮件通知配置', ['system:param:view']),
          presetLeaf('/system/notifications/robot', '机器人通知配置', ['system:param:view']),
        ],
      },
      {
        path: '/system/data-ops',
        label: '数据运维',
        children: [
          presetLeaf('/system/data-ops/backup', '数据备份', ['system:param:view']),
          presetLeaf('/system/data-ops/recovery', '数据恢复', ['system:param:view']),
          presetLeaf('/system/data-ops/op-logs', '操作日志', ['system:audit:view'], { hospitalPreset: 'sys_oplog' }),
          { path: '/system/data-ops/audit-logs', label: '审计日志', page: 'auditLogs', requiredPermissions: ['system:audit:view'] },
          presetLeaf('/system/data-ops/monitor', '系统监控', ['system:audit:view', 'system:param:view']),
        ],
      },
      { path: '/system/about', label: '关于系统', page: 'aboutSystem', requiredPermissions: ['dashboard:home:view'] },
    ],
  },
]

export const ADMIN_MENU_GROUPS: AdminMenuGroup[] = [
  {
    id: 'operation',
    label: '运营中心',
    icon: '1️⃣',
    allowedRoles: R_INT,
    items: [
      { path: '/dashboard', label: '运营总览', icon: '📊', page: 'home', requiredPermissions: p.dash },
      presetLeaf('/dashboard/kpi', 'KPI仪表盘', p.dash, { icon: '📈' }),
      presetLeaf('/analytics/bi', 'BI分析报告', p.dash, { icon: '📉' }),
      presetLeaf('/dashboard/insight', 'AI运营洞察', p.ai, { icon: '🤖' }),
      { path: '/dashboard/risk', label: '风险态势', icon: '⚠️', page: 'workspaceRisks', requiredPermissions: p.dash },
    ],
  },
  {
    id: 'equipment',
    label: '设备中心',
    icon: '2️⃣',
    allowedRoles: [...RA, ...RD, ...RE, ...RN, ...RP, ...RQ],
    items: [
      { path: '/assets/overview', label: '设备总览', icon: '📋', page: 'assetsOverview', requiredPermissions: p.asset },
      { path: '/assets/archive', label: '设备档案', icon: '📁', page: 'assets', requiredPermissions: p.asset },
      { path: '/assets/new', label: '智能建档', icon: '🤖', page: 'assetCreate', requiredPermissions: p.asset, requiredRoles: R_ASSET_CFG },
      { path: '/assets/qrcodes', label: '设备二维码', icon: '🏷️', page: 'assetCodes', requiredPermissions: p.asset, requiredRoles: R_ASSET_CFG },
      { path: '/pm/plans', label: '保养计划', icon: '🧰', page: 'pmPlans', requiredPermissions: p.pm },
      { path: '/pm/tasks', label: '保养任务', icon: '✅', page: 'pmTasks', requiredPermissions: p.pm },
      { path: '/pm/calendar', label: '维护日历', icon: '📅', page: 'pmCalendar', requiredPermissions: p.pm },
      { path: '/pm/inspection', label: '巡检记录', icon: '📝', page: 'pmInspection', requiredPermissions: p.pm },
      { path: '/meter/ledger', label: '计量台账', icon: '⚖️', page: 'metrologyWorkbench', requiredPermissions: p.meter },
    ],
  },
  {
    id: 'tasks',
    label: '任务中心',
    icon: '3️⃣',
    allowedRoles: R_INT,
    items: [
      presetLeaf('/task-center/all', '全部任务', p.task, { icon: '📋' }),
      { path: '/task-center/my', label: '我的待办', icon: '⏰', page: 'workspaceTodos', requiredPermissions: p.task },
      { path: '/repair/new', label: '新建报修', icon: '🛠️', page: 'repairNew', requiredPermissions: p.repair },
      { path: '/repair/ai-assistant', label: 'AI报修助手', icon: '🤖', page: 'repairAssistant', requiredPermissions: p.repair },
      { path: '/repair/center', label: '报修中心', icon: '🧾', page: 'repairCenter', requiredPermissions: p.repair },
      { path: '/repair/dispatch', label: '待派工工单', icon: '👷', page: 'repairDispatch', requiredPermissions: ['equipment:repair:assign'], requiredRoles: R_REPAIR_OPS },
      { path: '/repair/process', label: '维修处理中', icon: '🔧', page: 'repairProcess', requiredPermissions: p.repair, requiredRoles: R_REPAIR_OPS },
      { path: '/repair/accept', label: '待验收工单', icon: '🧪', page: 'repairAccept', requiredPermissions: p.repair, requiredRoles: R_REPAIR_ACCEPT },
      { path: '/repair/tickets', label: '维修记录', icon: '📄', page: 'repairs', requiredPermissions: p.repair },
      presetLeaf('/task-center/calendar', '任务日历', p.task, { icon: '📅' }),
      presetLeaf('/task-center/statistics', '任务统计', p.task, { icon: '📊' }),
    ],
  },
  {
    id: 'supply-finance',
    label: '供应链与财务',
    icon: '4️⃣',
    allowedRoles: [...R_INT, 'SUPPLIER_PORTAL'],
    items: [
      { path: '/purchase/apply', label: '采购管理', icon: '🛒', page: 'procurementWorkbench', requiredPermissions: p.pur },
      { path: '/supplier/profiles', label: '供应商管理', icon: '🤝', page: 'supplierProfiles', requiredPermissions: ['supplier:profile:view'] },
      { path: '/finance/payables', label: '财务管理', icon: '💰', page: 'financePayables', requiredPermissions: p.fin },
    ],
  },
  {
    id: 'system',
    label: '系统管理',
    icon: '5️⃣',
    allowedRoles: R_INT,
    items: [
      { path: '/system/users', label: '用户与权限', icon: '👥', page: 'systemUsers', requiredPermissions: ['system:user:view'] },
      { path: '/system/dictionary', label: '基础数据配置', icon: '⚙️', page: 'mdmDictionary', requiredPermissions: ['mdm:dict:view'] },
      { path: '/system/master-data/service-config', label: '主数据来源设置', icon: '🧭', page: 'masterDataSourceConfig', requiredPermissions: ['mdm:dict:view', 'system:param:view'] },
      { path: '/system/master-data/objects', label: '数据对象管理', icon: '🗂️', page: 'masterDataObjects', requiredPermissions: ['mdm:dict:view', 'system:param:view'] },
      { path: '/system/master-data/field-mapping', label: '字段映射规则', icon: '🧬', page: 'masterDataFieldMapping', requiredPermissions: ['mdm:dict:view', 'system:param:view'] },
      { path: '/system/master-data/sync-tasks', label: '同步任务管理', icon: '🔁', page: 'masterDataSyncTasks', requiredPermissions: ['mdm:dict:view', 'system:param:view'] },
      { path: '/system/master-data/quality-check', label: '数据质量校验', icon: '✅', page: 'masterDataQualityCheck', requiredPermissions: ['mdm:dict:view', 'system:param:view'] },
      { path: '/system/integration/standard-data', label: '接入集成', icon: '🔗', page: 'standardDataAccess', requiredPermissions: ['system:param:view'] },
      presetLeaf('/system/rules/task-engine', '规则引擎', ['workflow:config:view', 'system:param:view'], { icon: '📜' }),
      presetLeaf('/system/notifications/messages', '消息通知', ['system:param:view'], { icon: '🛎️' }),
      presetLeaf('/system/data-ops/backup', '数据运维', ['system:param:view'], { icon: '🗄️' }),
      { path: '/knowledge/policies', label: '知识中心', icon: '📚', page: 'knowledgeDocuments', requiredPermissions: ['knowledge:doc:view'] },
    ],
  },
]

export const ADMIN_MENU_LEAVES = ADMIN_MENU_GROUPS.flatMap((g) => flattenMenuLeaves(g.items))
const LEGACY_MENU_LEAVES = LEGACY_ADMIN_MENU_GROUPS.flatMap((g) => flattenMenuLeaves(g.items))

function uniqueRouteLeaves(...groups: AdminMenuLeaf[][]): AdminMenuLeaf[] {
  const seen = new Set<string>()
  const routes: AdminMenuLeaf[] = []
  for (const leaves of groups) {
    for (const leaf of leaves) {
      if (seen.has(leaf.path)) continue
      seen.add(leaf.path)
      routes.push(leaf)
    }
  }
  return routes
}

export const HIDDEN_ROUTE_LEAVES: AdminMenuLeaf[] = [
  { path: '/system/master-data-sources', label: '主数据来源设置', page: 'masterDataSourceConfig', requiredPermissions: ['mdm:dict:view', 'system:param:view'] },
  { path: '/system/hmdm-integration', label: '主数据来源设置', page: 'masterDataSourceConfig', requiredPermissions: ['mdm:dict:view', 'system:param:view'] },
  { path: '/system/api-config', label: '接入集成', page: 'businessInterfaces', requiredPermissions: ['system:param:view'] },
  { path: '/system/interface-integration', label: '业务系统接口', page: 'businessInterfaces', requiredPermissions: ['system:param:view'] },
  { path: '/system/iot', label: 'IoT设备接入', page: 'iotDevices', requiredPermissions: ['system:param:view'] },
  { path: '/system/iot-devices', label: 'IoT设备接入', page: 'iotDevices', requiredPermissions: ['system:param:view'] },
  { path: '/system/sso', label: '单点登录SSO', hospitalPreset: 'system_sso', requiredPermissions: ['system:param:view'] },
  { path: '/system/workflows', label: '审批流配置', page: 'workflowConsole', requiredPermissions: ['workflow:config:view'] },
  presetLeaf('/system/task-engine', '任务规则引擎', ['workflow:config:view', 'system:param:view']),
  presetLeaf('/system/alert-engine', '告警规则引擎', ['system:param:view']),
  presetLeaf('/system/sla', 'SLA规则配置', ['workflow:config:view', 'system:param:view']),
  presetLeaf('/system/messages', '消息中心配置', ['system:param:view']),
  presetLeaf('/system/wechat', '微信通知配置', ['system:param:view']),
  presetLeaf('/system/backup', '数据备份', ['system:param:view']),
  presetLeaf('/system/recovery', '数据恢复', ['system:param:view']),
  presetLeaf('/system/op-logs', '操作日志', ['system:audit:view'], { hospitalPreset: 'sys_oplog' }),
  { path: '/system/audit-logs', label: '审计日志', page: 'auditLogs', requiredPermissions: ['system:audit:view'] },
  presetLeaf('/system/monitor', '系统监控', ['system:audit:view', 'system:param:view']),
  presetLeaf('/dashboard/realtime', '实时运营态势', p.dash),
  presetLeaf('/dashboard/events', '实时事件中心', p.dash),
  presetLeaf('/dashboard/messages', '消息中心', p.dash),
  presetLeaf('/dashboard/daily-report', '今日运营简报', p.dash),
  presetLeaf('/analytics/repair-cost', '维修成本分析', ['equipment:repair:view'], { hospitalPreset: 'analytics_repair_cost' }),
  presetLeaf('/analytics/dept-usage', '科室使用分析', ['equipment:asset:view'], { hospitalPreset: 'analytics_dept' }),
  presetLeaf('/analytics/failure-rate', '故障率分析', ['equipment:repair:view']),
  presetLeaf('/analytics/downtime', '停机分析', ['equipment:repair:view']),
  presetLeaf('/analytics/pm-rate', 'PM完成率', p.pm),
  presetLeaf('/analytics/sla', 'SLA达成率', p.task),
  presetLeaf('/analytics/supplier', '供应商分析', ['supplier:profile:view'], { hospitalPreset: 'analytics_supplier' }),
  presetLeaf('/analytics/energy', '能耗分析', ['equipment:asset:view']),
  presetLeaf('/analytics/quality', '质量指标', p.qc, { hospitalPreset: 'analytics_qc' }),
  presetLeaf('/analytics/risk', '风险趋势分析', p.qc),
  presetLeaf('/analytics/forecast', 'AI预测分析', p.ai),
  { path: '/ai/ops', label: 'AI助手', page: 'workspaceAi', requiredPermissions: p.ai },
  { path: '/ai/decision', label: 'AI运营决策', page: 'aiGateway', requiredPermissions: p.ai },
  { path: '/ai/risk', label: 'AI风险预测', page: 'aiGateway', requiredPermissions: p.ai },
  { path: '/ai/predictive-maintenance', label: 'AI预测性维护', page: 'aiGateway', requiredPermissions: p.ai },
  { path: '/ai/repair', label: 'AI维修助手', page: 'aiGateway', requiredPermissions: p.ai },
  { path: '/ai/voice-dispatch', label: 'AI语音派单', page: 'aiGateway', requiredPermissions: p.ai },
  { path: '/ai/task', label: 'AI自动任务', page: 'aiGateway', requiredPermissions: p.ai },
  { path: '/ai/qa', label: 'AI知识问答', page: 'aiGateway', requiredPermissions: p.ai },
  { path: '/ai/analysis', label: 'AI运营分析', page: 'aiGateway', requiredPermissions: p.ai },
  { path: '/ai/rca', label: 'AI根因分析', page: 'aiGateway', requiredPermissions: p.ai },
  { path: '/ai/meeting', label: 'AI会议纪要', page: 'aiGateway', requiredPermissions: p.ai },
  { path: '/ai/report', label: 'AI报告生成', page: 'aiGateway', requiredPermissions: p.ai },
  { path: '/ai/executive-report', label: 'AI院长简报', page: 'aiGateway', requiredPermissions: p.ai },
  { path: '/ai/learning', label: 'AI知识学习', page: 'aiGateway', requiredPermissions: p.ai },
  { path: '/ai/agents', label: 'AI智能体中心', page: 'aiGateway', requiredPermissions: p.ai },
]

export const ADMIN_ROUTE_LEAVES = uniqueRouteLeaves(ADMIN_MENU_LEAVES, LEGACY_MENU_LEAVES, HIDDEN_ROUTE_LEAVES)

function groupAllowed(g: AdminMenuGroup, me: AuthUserProfile): boolean {
  if (me.permissions?.includes('*')) return true
  if (!g.allowedRoles?.length) return true
  return me.roles.some((r) => g.allowedRoles!.includes(r))
}

function effectiveAccess(leaf: AdminMenuLeaf, group: AdminMenuGroup): MenuAccess {
  return leaf.access ?? group.access ?? 'internal'
}

export function filterMenuForProfile(groups: AdminMenuGroup[], me: AuthUserProfile | null): AdminMenuGroup[] {
  if (!me) return []

  const perms = me.permissions ?? []

  const leafOk = (leaf: AdminMenuLeaf, group: AdminMenuGroup): boolean => {
    const eff = effectiveAccess(leaf, group)
    if (me.portalOnly) {
      if (eff === 'internal') return false
    } else {
      if (eff === 'supplier') return false
    }
    if (leaf.requiredPermissions?.length && !hasAnyPermission(perms, leaf.requiredPermissions)) {
      return false
    }
    if (leaf.requiredRoles?.length && !leaf.requiredRoles.some((r) => me.roles.includes(r))) {
      return false
    }
    return true
  }

  const filterLeaves = (items: AdminMenuLeaf[], group: AdminMenuGroup): AdminMenuLeaf[] => (
    items
      .map((item) => {
        if (item.children?.length) {
          const children = filterLeaves(item.children, group)
          return children.length ? { ...item, children } : null
        }
        return leafOk(item, group) ? item : null
      })
      .filter((item): item is AdminMenuLeaf => Boolean(item))
  )

  return groups
    .filter((g) => groupAllowed(g, me))
    .map((g) => ({
      ...g,
      items: filterLeaves(g.items, g),
    }))
    .filter((g) => g.items.length > 0)
}

function menuLeafContainsPath(leaf: AdminMenuLeaf, pathname: string): boolean {
  if (leaf.children?.length) {
    return leaf.children.some((item) => menuLeafContainsPath(item, pathname))
  }
  return pathname === leaf.path || pathname.startsWith(`${leaf.path}/`)
}

export function findMenuLeafByPath(items: AdminMenuLeaf[], pathname: string): AdminMenuLeaf | undefined {
  for (const item of items) {
    if (item.children?.length) {
      const matched = findMenuLeafByPath(item.children, pathname)
      if (matched) return matched
      continue
    }
    if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
      return item
    }
  }
  return undefined
}

export function menuGroupContainsPath(group: AdminMenuGroup, pathname: string): boolean {
  if (group.id === 'system' && pathname.startsWith('/knowledge/documents')) {
    return true
  }
  if (group.id === 'equipment' && /^\/(lifecycle\/assets|assets\/archive)\//.test(pathname)) {
    return true
  }
  if (group.id === 'tasks' && /^\/(maintenance\/tickets|repair\/tickets)\//.test(pathname)) {
    return true
  }
  if (group.id === 'supply-finance' && pathname.startsWith('/supplier/')) {
    return true
  }
  if (pathname.startsWith('/supplier-portal') && group.id === 'supply-finance') {
    return group.items.some((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
  }
  if (pathname.startsWith('/portal') && group.id === 'supply-finance') {
    return true
  }
  if (pathname.startsWith('/analytics') && group.id === 'operation') {
    return true
  }
  return group.items.some((item) => menuLeafContainsPath(item, pathname))
}
