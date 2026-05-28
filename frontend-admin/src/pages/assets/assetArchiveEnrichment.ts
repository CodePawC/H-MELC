/**
 * 档案列表展示字段：在 AssetRead 之上按资产 id 确定性补齐医院业务常用展示列。
 * 后端未返回科室名称、规格型号等时由本模块补齐；同一 id 始终映射同一套模板。
 */

import type { AssetReadJson } from '../../api/assets'

export type RunDisplayLabel = '在用' | '维修中' | '停用' | '报废' | '异常'
export type RiskDisplayLabel = '高风险' | '中风险' | '低风险'
export type MetrologyDisplayLabel = '正常' | '即将到期' | '已过期' | '不适用'
export type LifecycleStageLabel = '采购中' | '待验收' | '在用' | '维修中' | '停机' | '待报废' | '已报废'
export type PmStatusLabel = '正常' | '临近' | '超时'

export type AssetArchiveDisplayRow = AssetReadJson & {
  /** 规格型号 */
  spec_model: string
  /** 品牌厂家（合并展示） */
  brand_vendor: string
  /** 生产厂家（全称） */
  manufacturer_full: string
  /** 设备分类（中文） */
  category_label: string
  /** 使用科室 */
  department_name: string
  /** 存放地点 */
  location_text: string
  /** 责任人 */
  owner_name: string
  run_display: RunDisplayLabel
  risk_display: RiskDisplayLabel
  metrology_display: MetrologyDisplayLabel
  /** 二维码摘录（列表「查看」用） */
  qr_hint: string
  /** 管理类别（演示） */
  management_class: string
  /** 购置日期展示 yyyy-mm-dd */
  purchase_display: string
  /** 启用日期展示 */
  install_display: string
  /** 使用年限（年，演示） */
  service_years: number
  /** 是否急救生命支持类 */
  is_critical_care: boolean
  /** 是否大型设备 */
  is_large_equipment: boolean
  /** 是否计量设备 */
  is_metrology_device: boolean
  /** 是否强检 */
  is_mandatory_inspection: boolean
  /** 供应商名称（演示补充，非后端字段） */
  supplier_demo_name: string
}

export type AssetTwinMetrics = {
  lifecycleStage: LifecycleStageLabel
  bootRate: number
  repairCount: number
  repairCost: number
  pmStatus: PmStatusLabel
  pmDueDays: number
  aiScore: number
  aiPrediction: string
  rfid: string
  qrCode: string
  highValue: boolean
  updatePlan: string
  remainingLifeMonths: number
  downtimeRisk: number
  serviceAgeYears: number
}

export type AssetLifecycleEvent = {
  time: string
  title: string
  detail: string
  tone: 'green' | 'blue' | 'orange' | 'red' | 'gray'
}

type Template = {
  asset_name: string
  spec_model: string
  brand_vendor: string
  manufacturer_full: string
  category_code: string
  category_label: string
  department_name: string
  location_text: string
  owner_name: string
  supplier_name: string
  serial_suffix: string
  registration_snippet: string
  risk_display: RiskDisplayLabel
  metrology_display: MetrologyDisplayLabel
  management_class: string
  service_years: number
  is_critical_care: boolean
  is_large_equipment: boolean
  is_metrology_device: boolean
  is_mandatory_inspection: boolean
  purchase_offset_days: number
  install_offset_days: number
}

/** 用户指定的 10 类真实医院设备命名示例 */
export const ARCHIVE_DEVICE_TEMPLATES: Template[] = [
  {
    asset_name: '飞利浦 IntelliVue MX800 病人监护仪',
    spec_model: 'IntelliVue MX800',
    brand_vendor: '飞利浦（Philips）',
    manufacturer_full: '飞利浦医疗系统荷兰有限公司',
    category_code: 'MONITOR',
    category_label: '监护设备',
    department_name: '急诊科',
    location_text: '抢救室 A 床旁',
    owner_name: '张某某',
    supplier_name: '飞利浦医疗设备（上海）有限公司',
    serial_suffix: '88051',
    registration_snippet: '国械注进20162370866',
    risk_display: '中风险',
    metrology_display: '正常',
    management_class: 'II 类',
    service_years: 8,
    is_critical_care: true,
    is_large_equipment: false,
    is_metrology_device: true,
    is_mandatory_inspection: false,
    purchase_offset_days: 920,
    install_offset_days: 900,
  },
  {
    asset_name: '迈瑞 BeneVision N17 监护仪',
    spec_model: 'BeneVision N17',
    brand_vendor: '迈瑞（Mindray）',
    manufacturer_full: '深圳迈瑞生物医疗电子股份有限公司',
    category_code: 'MONITOR',
    category_label: '监护设备',
    department_name: 'ICU',
    location_text: 'ICU 三区 08 床',
    owner_name: '李某某',
    supplier_name: '迈瑞医疗授权服务商',
    serial_suffix: 'MR25109',
    registration_snippet: '国械注准20173214356',
    risk_display: '中风险',
    metrology_display: '即将到期',
    management_class: 'II 类',
    service_years: 8,
    is_critical_care: true,
    is_large_equipment: false,
    is_metrology_device: true,
    is_mandatory_inspection: false,
    purchase_offset_days: 1460,
    install_offset_days: 1440,
  },
  {
    asset_name: '西门子 MAGNETOM Avanto 1.5T MRI',
    spec_model: 'MAGNETOM Avanto 1.5T',
    brand_vendor: '西门子（Siemens Healthineers）',
    manufacturer_full: '西门子医疗有限公司',
    category_code: 'MED_IMG',
    category_label: '医学影像',
    department_name: '影像科',
    location_text: 'MRI 机房 2',
    owner_name: '王某某',
    supplier_name: '西门子医疗系统有限公司',
    serial_suffix: 'SMS771',
    registration_snippet: '国械注进20153062478',
    risk_display: '高风险',
    metrology_display: '正常',
    management_class: 'III 类',
    service_years: 10,
    is_critical_care: false,
    is_large_equipment: true,
    is_metrology_device: true,
    is_mandatory_inspection: true,
    purchase_offset_days: 2190,
    install_offset_days: 2160,
  },
  {
    asset_name: 'GE Revolution CT',
    spec_model: 'Revolution CT',
    brand_vendor: '通用电气（GE Healthcare）',
    manufacturer_full: 'GE Medical Systems LLC',
    category_code: 'MED_IMG',
    category_label: '医学影像',
    department_name: '影像科',
    location_text: 'CT 室 1',
    owner_name: '赵某某',
    supplier_name: '通用电气医疗系统贸易发展（上海）有限公司',
    serial_suffix: 'GER992',
    registration_snippet: '国械注进20163305698',
    risk_display: '高风险',
    metrology_display: '正常',
    management_class: 'III 类',
    service_years: 10,
    is_critical_care: false,
    is_large_equipment: true,
    is_metrology_device: true,
    is_mandatory_inspection: true,
    purchase_offset_days: 1825,
    install_offset_days: 1800,
  },
  {
    asset_name: '奥林巴斯 CV-290 电子内镜主机',
    spec_model: 'CV-290',
    brand_vendor: '奥林巴斯（Olympus）',
    manufacturer_full: '奥林巴斯医疗株式会社',
    category_code: 'SURG_ENDO',
    category_label: '手术设备',
    department_name: '消化内镜中心',
    location_text: '内镜诊疗室 3',
    owner_name: '刘某某',
    supplier_name: '奥林巴斯（北京）销售服务有限公司',
    serial_suffix: 'OLY331',
    registration_snippet: '国械注进20162220789',
    risk_display: '高风险',
    metrology_display: '不适用',
    management_class: 'II 类',
    service_years: 8,
    is_critical_care: false,
    is_large_equipment: true,
    is_metrology_device: false,
    is_mandatory_inspection: false,
    purchase_offset_days: 1650,
    install_offset_days: 1620,
  },
  {
    asset_name: '德尔格 Fabius Plus 麻醉机',
    spec_model: 'Fabius Plus',
    brand_vendor: '德尔格（Dräger）',
    manufacturer_full: 'Dräger Medical GmbH',
    category_code: 'ANESTH',
    category_label: '麻醉设备',
    department_name: '手术室',
    location_text: 'OR05 麻醉位',
    owner_name: '陈某某',
    supplier_name: '德尔格医疗设备（上海）有限公司',
    serial_suffix: 'AN772',
    registration_snippet: '国械注进20163542188',
    risk_display: '高风险',
    metrology_display: '即将到期',
    management_class: 'III 类',
    service_years: 7,
    is_critical_care: true,
    is_large_equipment: false,
    is_metrology_device: true,
    is_mandatory_inspection: true,
    purchase_offset_days: 1380,
    install_offset_days: 1360,
  },
  {
    asset_name: '德尔格 Savina 300 呼吸机',
    spec_model: 'Savina 300',
    brand_vendor: '德尔格（Dräger）',
    manufacturer_full: 'Dräger Medical GmbH',
    category_code: 'LIFE_SUP',
    category_label: '生命支持',
    department_name: '急诊科',
    location_text: 'EICU 设备间',
    owner_name: '杨某某',
    supplier_name: '德尔格医疗设备（上海）有限公司',
    serial_suffix: 'DRG551',
    registration_snippet: '国械注进20163542109',
    risk_display: '高风险',
    metrology_display: '即将到期',
    management_class: 'III 类',
    service_years: 8,
    is_critical_care: true,
    is_large_equipment: false,
    is_metrology_device: true,
    is_mandatory_inspection: true,
    purchase_offset_days: 1100,
    install_offset_days: 1080,
  },
  {
    asset_name: '迈瑞 BeneHeart D6 除颤监护仪',
    spec_model: 'BeneHeart D6',
    brand_vendor: '迈瑞（Mindray）',
    manufacturer_full: '深圳迈瑞生物医疗电子股份有限公司',
    category_code: 'LIFE_SUP',
    category_label: '生命支持',
    department_name: '心内科',
    location_text: 'CCU 护士站旁',
    owner_name: '黄某某',
    supplier_name: '迈瑞医疗授权服务商',
    serial_suffix: 'MR77231',
    registration_snippet: '国械注准20173210987',
    risk_display: '高风险',
    metrology_display: '即将到期',
    management_class: 'III 类',
    service_years: 8,
    is_critical_care: true,
    is_large_equipment: false,
    is_metrology_device: true,
    is_mandatory_inspection: true,
    purchase_offset_days: 2100,
    install_offset_days: 2080,
  },
  {
    asset_name: '贝朗 Perfusor Space 注射泵',
    spec_model: 'Perfusor Space',
    brand_vendor: '贝朗（B. Braun）',
    manufacturer_full: 'B. Braun Melsungen AG',
    category_code: 'THERAPY',
    category_label: '治疗设备',
    department_name: '神经外科',
    location_text: '神外病区护士站',
    owner_name: '周某某',
    supplier_name: '贝朗医疗（上海）国际贸易有限公司',
    serial_suffix: 'BB44122',
    registration_snippet: '国械注进20162541309',
    risk_display: '中风险',
    metrology_display: '正常',
    management_class: 'II 类',
    service_years: 8,
    is_critical_care: false,
    is_large_equipment: false,
    is_metrology_device: true,
    is_mandatory_inspection: false,
    purchase_offset_days: 760,
    install_offset_days: 740,
  },
  {
    asset_name: '新华 MAST-A 脉动真空灭菌器',
    spec_model: 'MAST-A',
    brand_vendor: '新华医疗（SHINVA）',
    manufacturer_full: '山东新华医疗器械股份有限公司',
    category_code: 'CSSD',
    category_label: '消毒供应',
    department_name: '消毒供应中心',
    location_text: 'CSSD 去污区',
    owner_name: '吴某某',
    supplier_name: '新华医疗设备股份有限公司',
    serial_suffix: 'SHX889',
    registration_snippet: '鲁械注准20172660987',
    risk_display: '中风险',
    metrology_display: '正常',
    management_class: 'II 类',
    service_years: 10,
    is_critical_care: false,
    is_large_equipment: true,
    is_metrology_device: true,
    is_mandatory_inspection: true,
    purchase_offset_days: 2555,
    install_offset_days: 2520,
  },
]

export const ARCHIVE_DEPARTMENT_OPTIONS = Array.from(
  new Set(ARCHIVE_DEVICE_TEMPLATES.map((t) => t.department_name)),
).sort()

export const ARCHIVE_SUPPLIER_OPTIONS = Array.from(
  new Set(ARCHIVE_DEVICE_TEMPLATES.map((t) => t.supplier_name)),
).sort()

export const ARCHIVE_BRAND_OPTIONS = Array.from(
  new Set(ARCHIVE_DEVICE_TEMPLATES.map((t) => t.brand_vendor)),
).sort()

export const ARCHIVE_CATEGORY_FILTERS = ARCHIVE_DEVICE_TEMPLATES.reduce<{ label: string; value: string }[]>(
  (acc, t) => {
    if (!acc.some((x) => x.value === t.category_code)) acc.push({ label: t.category_label, value: t.category_code })
    return acc
  },
  [],
)

function hashId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function assetArchiveSeed(id: string): number {
  return hashId(id)
}

export function pickTemplate(id: string): Template {
  const idx = hashId(id) % ARCHIVE_DEVICE_TEMPLATES.length
  return ARCHIVE_DEVICE_TEMPLATES[idx]!
}

function mapMainStatusToRun(code: string): RunDisplayLabel {
  const u = code.toUpperCase()
  if (u === 'ACTIVE') return '在用'
  if (u === 'REPAIR' || u === 'UNDER_REPAIR') return '维修中'
  if (u === 'IDLE' || u === 'STANDBY') return '停用'
  if (u === 'DECOMMISSIONED' || u === 'SCRAPPED' || u === 'RETIRED') return '报废'
  return '异常'
}

function mapRiskApiToDisplay(api: string | null | undefined, fallback: RiskDisplayLabel): RiskDisplayLabel {
  if (!api) return fallback
  const u = api.toUpperCase()
  if (u.includes('高') || u === 'HIGH' || u === 'H') return '高风险'
  if (u.includes('中') || u === 'MEDIUM' || u === 'MID' || u === 'M') return '中风险'
  if (u.includes('低') || u === 'LOW' || u === 'L') return '低风险'
  return fallback
}

export function enrichAssetRow(asset: AssetReadJson, templateIndex?: number): AssetArchiveDisplayRow {
  const tpl =
    templateIndex != null
      ? ARCHIVE_DEVICE_TEMPLATES[templateIndex % ARCHIVE_DEVICE_TEMPLATES.length]!
      : pickTemplate(asset.id)
  const run_display = mapMainStatusToRun(asset.main_status)
  const risk_display = mapRiskApiToDisplay(asset.risk_level, tpl.risk_display)

  const purchase_display =
    asset.purchase_date?.slice(0, 10) ??
    dateMinusDays(new Date(), tpl.purchase_offset_days).slice(0, 10)
  const install_display =
    asset.install_date?.slice(0, 10) ?? dateMinusDays(new Date(), tpl.install_offset_days).slice(0, 10)

  const serial =
    asset.serial_number?.trim() ||
    `SN-${tpl.serial_suffix}-${String(hashId(asset.id)).slice(-4)}`

  const qr_hint = `${asset.asset_code?.slice(-8) ?? 'QR'}…`

  let metrology_display = tpl.metrology_display
  if (!tpl.is_metrology_device) metrology_display = '不适用'
  else if (risk_display === '高风险' && tpl.metrology_display === '即将到期') metrology_display = '即将到期'

  const original =
    asset.original_value != null && asset.original_value !== ''
      ? Number(asset.original_value)
      : 180000 + (hashId(asset.id) % 420) * 1000

  const merged: AssetReadJson = {
    ...asset,
    asset_name: asset.asset_name?.trim() || tpl.asset_name,
    category_code: asset.category_code ?? tpl.category_code,
    serial_number: serial,
    registration_no: asset.registration_no ?? tpl.registration_snippet,
    original_value: original,
    purchase_date: asset.purchase_date ?? `${purchase_display}T00:00:00Z`,
    install_date: asset.install_date ?? `${install_display}T00:00:00Z`,
  }

  return {
    ...merged,
    spec_model: tpl.spec_model,
    brand_vendor: tpl.brand_vendor,
    manufacturer_full: tpl.manufacturer_full,
    category_label: asset.mdm_category_name || asset.classification_name || asset.hmdm_equipment_category_name || tpl.category_label,
    department_name: tpl.department_name,
    location_text: tpl.location_text,
    owner_name: tpl.owner_name,
    run_display,
    risk_display,
    metrology_display,
    qr_hint,
    management_class: asset.management_class || asset.hmdm_management_class || tpl.management_class,
    purchase_display,
    install_display,
    service_years: tpl.service_years,
    is_critical_care: tpl.is_critical_care,
    is_large_equipment: tpl.is_large_equipment,
    is_metrology_device: tpl.is_metrology_device,
    is_mandatory_inspection: tpl.is_mandatory_inspection,
    supplier_demo_name: tpl.supplier_name,
  }
}

function dateMinusDays(d: Date, days: number): string {
  const x = new Date(d.getTime() - days * 86400000)
  return x.toISOString()
}

/** 资产编号专业化示例格式（WLX-SB-2026-NNNN），与后端编码并存时以前端展示为准 */
export function formatArchiveAssetCode(assetCode: string, id: string): string {
  if (/^WLX-SB-/i.test(assetCode)) return assetCode
  const n = (hashId(id) % 9000) + 1000
  return `WLX-SB-2026-${n}`
}

function lifecycleFromRow(row: AssetArchiveDisplayRow, seedValue: number): LifecycleStageLabel {
  const status = row.main_status.toUpperCase()
  const phase = row.lifecycle_phase?.toUpperCase() ?? ''
  if (status.includes('PROCUREMENT') || phase.includes('PROCUREMENT')) return '采购中'
  if (status.includes('ACCEPT') || phase.includes('ACCEPT')) return '待验收'
  if (row.run_display === '维修中') return '维修中'
  if (row.run_display === '停用' || row.run_display === '异常') return '停机'
  if (row.run_display === '报废') return '已报废'
  if (phase.includes('REPLACEMENT') || phase.includes('SCRAP') || row.service_years >= 9 || seedValue % 17 === 0) {
    return '待报废'
  }
  return '在用'
}

export function buildAssetTwinMetrics(row: AssetArchiveDisplayRow): AssetTwinMetrics {
  const seedValue = hashId(row.id)
  const assetValue = Number(row.original_value || 0)
  const highRisk = row.risk_display === '高风险'
  const mediumRisk = row.risk_display === '中风险'
  const stopped = row.run_display === '停用' || row.run_display === '报废' || row.run_display === '异常'
  const repairing = row.run_display === '维修中'
  const lifecycleStage = lifecycleFromRow(row, seedValue)
  const serviceAgeYears = Math.max(
    0,
    Number.isFinite(row.service_years)
      ? row.service_years
      : Math.floor((Date.now() - new Date(row.install_display).getTime()) / 31536000000),
  )
  const repairCount = Math.max(
    repairing ? 2 : 0,
    highRisk ? 4 + (seedValue % 6) : mediumRisk ? 2 + (seedValue % 4) : seedValue % 3,
  )
  const repairCost =
    repairCount * (highRisk ? 8600 : mediumRisk ? 4600 : 1800) +
    (row.is_large_equipment ? 18000 + (seedValue % 28000) : seedValue % 4200)
  const bootRate = stopped
    ? Math.max(0, 12 + (seedValue % 18))
    : repairing
      ? 42 + (seedValue % 18)
      : Math.max(54, 92 - repairCount * 3 - (highRisk ? 8 : 0) + (seedValue % 7))
  let pmStatus: PmStatusLabel =
    seedValue % 9 === 0 || (highRisk && seedValue % 3 === 0) ? '超时' : seedValue % 4 === 0 ? '临近' : '正常'
  if (row.asset_name.includes('呼吸机') || row.asset_name.includes('Savina')) pmStatus = '超时'
  const pmDueDays = pmStatus === '超时' ? -((seedValue % 18) + 3) : pmStatus === '临近' ? (seedValue % 10) + 1 : 28 + (seedValue % 50)
  const baseAi = Number(row.ai_health_score)
  const aiScore = Number.isFinite(baseAi)
    ? Math.max(0, Math.min(100, Math.round(baseAi)))
    : Math.max(48, Math.min(98, 96 - repairCount * 4 - (row.metrology_display === '已过期' ? 12 : 0) - serviceAgeYears))
  const downtimeRisk = Math.max(3, Math.min(94, 100 - aiScore + repairCount * 4 + (stopped ? 24 : 0)))
  const remainingLifeMonths = Math.max(6, 132 - serviceAgeYears * 12 - repairCount * 4 - (highRisk ? 12 : 0))
  const aiPrediction =
    aiScore < 62
      ? 'AI预测寿命下降，建议进入更新评估'
      : downtimeRisk > 48
        ? '未来30天停机风险偏高，建议专项巡检'
        : repairCost > 60000
          ? '维修成本异常，建议复核维保策略'
          : pmStatus === '超时'
            ? 'PM超时可能抬升故障率，建议自动派单'
            : '健康度稳定，维持常规PM策略'

  return {
    lifecycleStage,
    bootRate,
    repairCount,
    repairCost,
    pmStatus,
    pmDueDays,
    aiScore,
    aiPrediction,
    rfid: `RFID-${String(seedValue).slice(0, 3)}-${String(seedValue).slice(-5)}`,
    qrCode: `QR-${formatArchiveAssetCode(row.asset_code, row.id).replaceAll('-', '')}`,
    highValue: assetValue >= 500000 || row.is_large_equipment,
    updatePlan:
      lifecycleStage === '待报废' || aiScore < 62
        ? '2026-Q1 更新论证'
        : serviceAgeYears >= 7
          ? '2026-Q3 技术评估'
          : '常规滚动评估',
    remainingLifeMonths,
    downtimeRisk,
    serviceAgeYears,
  }
}

export function buildAssetTwinImage(row: AssetArchiveDisplayRow): string {
  const seedValue = hashId(row.id)
  const accent =
    row.risk_display === '高风险'
      ? '#ef4444'
      : row.risk_display === '中风险'
        ? '#f59e0b'
        : row.run_display === '停用'
          ? '#94a3b8'
          : '#22d3ee'
  const label = row.category_label.slice(0, 4)
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="240" viewBox="0 0 360 240">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#071a2f"/>
      <stop offset="1" stop-color="#0f766e"/>
    </linearGradient>
    <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e0faff"/>
      <stop offset="1" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>
  <rect width="360" height="240" rx="18" fill="url(#bg)"/>
  <g opacity="0.28" stroke="#67e8f9" stroke-width="1">
    <path d="M0 176H360M0 130H360M0 84H360M56 0V240M136 0V240M216 0V240M296 0V240"/>
  </g>
  <path d="M52 174C100 116 132 144 164 92C196 40 256 48 309 73" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
  <rect x="92" y="62" width="150" height="96" rx="14" fill="#dffbff" opacity="0.96"/>
  <rect x="106" y="76" width="122" height="62" rx="8" fill="url(#screen)"/>
  <path d="M116 113h20l9-17 16 34 13-25h42" fill="none" stroke="#082f49" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
  <rect x="144" y="158" width="46" height="28" rx="6" fill="#cbd5e1"/>
  <rect x="116" y="186" width="102" height="12" rx="6" fill="#94a3b8"/>
  <circle cx="262" cy="98" r="34" fill="none" stroke="${accent}" stroke-width="9" opacity="0.9"/>
  <circle cx="262" cy="98" r="15" fill="${accent}" opacity="0.75"/>
  <text x="26" y="36" fill="#dffbff" font-size="18" font-weight="700" font-family="Arial, sans-serif">${label}</text>
  <text x="26" y="58" fill="#93c5fd" font-size="12" font-family="Arial, sans-serif">DIGITAL TWIN ${seedValue % 97}</text>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function buildAssetLifecycleEvents(row: AssetArchiveDisplayRow): AssetLifecycleEvent[] {
  const installYear = Number(row.install_display.slice(0, 4)) || 2020
  const procurementYear = Math.max(2020, installYear - 1)
  const component = row.category_code === 'MED_IMG' ? '球管更换' : row.is_critical_care ? '电池与报警模块更换' : '关键部件更换'
  return [
    {
      time: `${procurementYear}-01`,
      title: '采购申请',
      detail: `${row.department_name} 发起 ${row.asset_name} 配置申请，进入采购论证`,
      tone: 'blue',
    },
    {
      time: `${procurementYear}-03`,
      title: '到货验收',
      detail: `${row.supplier_demo_name} 到货，完成开箱、合格证、注册证与序列号核验`,
      tone: 'green',
    },
    {
      time: `${installYear}-04`,
      title: '安装培训',
      detail: `完成安装调试、科室培训与一机一码绑定，自动生成设备档案`,
      tone: 'green',
    },
    {
      time: `${installYear + 1}-02`,
      title: 'PM保养',
      detail: '完成年度预防性维护，电气安全与性能测试合格',
      tone: 'green',
    },
    {
      time: `${installYear + 2}-07`,
      title: '更换UPS',
      detail: '完成备用供电链路维护，更新配件与供应商记录',
      tone: 'blue',
    },
    {
      time: `${installYear + 3}-01`,
      title: '维修',
      detail: `${row.category_label} 故障工单闭环，写入维修成本与停机时长`,
      tone: row.risk_display === '高风险' ? 'red' : 'orange',
    },
    {
      time: `${installYear + 4}-03`,
      title: component,
      detail: '关键部件更换后完成性能确认，关联配件批次与维保报告',
      tone: 'blue',
    },
    {
      time: `${installYear + 5}-01`,
      title: 'AI预测寿命下降',
      detail: 'AI模型基于故障频率、维修成本、开机率与年限给出风险提示',
      tone: 'orange',
    },
    {
      time: '2026-01',
      title: '更新评估',
      detail: `${buildAssetTwinMetrics(row).updatePlan}，纳入设备更新与预算滚动计划`,
      tone: 'red',
    },
  ]
}

/** 离线演示：10 台典型医学装备（与模板顺序一致） */
export function buildMockArchiveRows(): AssetArchiveDisplayRow[] {
  return ARCHIVE_DEVICE_TEMPLATES.map((_, i) => {
    const id = `aaaaaaaa-bbbb-4ccc-8ddd-${String(100000 + i).padStart(12, '0')}`
    const base: AssetReadJson = {
      id,
      asset_code: `WLX-SB-2026-${String(1001 + i)}`,
      asset_name: ARCHIVE_DEVICE_TEMPLATES[i]!.asset_name,
      category_code: ARCHIVE_DEVICE_TEMPLATES[i]!.category_code,
      main_status: i === 5 ? 'UNDER_REPAIR' : 'ACTIVE',
      risk_level: ARCHIVE_DEVICE_TEMPLATES[i]!.risk_display === '高风险' ? 'HIGH' : 'MEDIUM',
      serial_number: `SN-DEMO-${1001 + i}`,
      registration_no: ARCHIVE_DEVICE_TEMPLATES[i]!.registration_snippet,
      original_value: 280000 + i * 42000,
      purchase_date: dateMinusDays(new Date(), 800 + i * 60),
      install_date: dateMinusDays(new Date(), 780 + i * 60),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return enrichAssetRow(base, i)
  })
}
