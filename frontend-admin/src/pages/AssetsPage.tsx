import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type Key, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  DatabaseOutlined,
  DownOutlined,
  EllipsisOutlined,
  EditOutlined,
  ExportOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  PartitionOutlined,
  PrinterOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Badge,
  Button,
  Checkbox,
  Col,
  ConfigProvider,
  DatePicker,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Popover,
  Progress,
  Pagination,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  Upload,
} from 'antd'
import type { TableColumnsType } from 'antd'
import type { InputRef } from 'antd/es/input'

import { fetchAssets } from '../api/assets'
import type { AssetReadJson, FetchAssetsParams } from '../api/assets'
import { IS_AUTH_MOCK } from '../config/authMode'
import { useAppShellStore } from '../stores/appShell'
import { AssetLabelPrintPanel, type AssetLabelPrintTarget } from './assets/AssetLabelPrintPanel'
import {
  ARCHIVE_CATEGORY_FILTERS,
  ARCHIVE_DEPARTMENT_OPTIONS,
  assetArchiveSeed,
  buildAssetLifecycleEvents,
  buildAssetTwinMetrics,
  buildMockArchiveRows,
  enrichAssetRow,
  formatArchiveAssetCode,
  type AssetArchiveDisplayRow,
  type MetrologyDisplayLabel,
  type PmStatusLabel,
  type RiskDisplayLabel,
  type RunDisplayLabel,
} from './assets/assetArchiveEnrichment'
import { mockCalRows, mockContractRows, mockPmRows } from './assets/assetArchiveDrawerMock'

import './assets/assetArchive.css'

const { RangePicker } = DatePicker
const { Text, Title } = Typography

type ArchiveStatus = '待建档' | '档案草稿' | '已建档' | '档案缺项' | '待审核' | '已归档'
  | '待补资料'
  | '附件缺失'
type CompletenessFilter = '完整' | '缺采购资料' | '缺验收资料' | '缺合同发票' | '缺计量记录' | '缺维修记录' | '缺使用科室确认'
type MissingDocFilter = '合同' | '发票' | '验收单' | '注册证' | '计量证书' | 'PM记录' | '维修记录' | '培训记录' | '补充质控记录'
type FilingSource = '单台建档' | '采购流程转档案' | '验收入库建档' | '历史台账导入' | '盘点补录' | '维修触发建档' | 'AI识别草稿'
type AuditStatus = '草稿' | '待审核' | '已审核' | '退回修改'
type CodeStatus = '正常' | '重复' | '缺失' | '规则不符'
type AttachmentStatus = '完整' | '部分缺失' | '无附件'

type ArchiveDocCheck = {
  label: string
  ok: boolean
  required: boolean
  weight: number
}

type ArchiveLifecycleNode = {
  title: string
  time: string
  handler: string
  document: string
  status: '已完成' | '可追溯' | '待处理' | '未触发' | '已归档'
  source: string
}

type ArchiveRectificationTask = {
  id: string
  title: string
  owner: string
  due: string
  status: '待处理' | '处理中' | '已完成'
  source: string
}

type ArchiveContractSnapshot = {
  contract_no: string
  supplier: string
  invoice_no: string
  amount: string
  pay_status: string
  acceptance_no?: string
  acceptance_date?: string
  enable_date?: string
}

type ArchiveRuntime = {
  status?: ArchiveStatus
  completeness?: number
  missing?: string[]
  docChecks?: ArchiveDocCheck[]
  filingSource?: FilingSource
  auditStatus?: AuditStatus
  codeStatus?: CodeStatus
  attachmentStatus?: AttachmentStatus
  updatedDate?: string
  engineer?: string
  duplicateSuspected?: boolean
  recentRepairDate?: string
  sourceLabel?: string
  supplementReason?: string
  lifecycleNodes?: ArchiveLifecycleNode[]
  tasks?: ArchiveRectificationTask[]
  contract?: ArchiveContractSnapshot
}

type RuntimeRow = AssetArchiveDisplayRow & { archiveRuntime?: ArchiveRuntime }

type AppliedFilters = {
  keyword: string
  department: string
  category_code: string
  main_status: RunDisplayLabel | ''
  archive_status: ArchiveStatus | ''
  risk_level: RiskDisplayLabel | ''
  metrology: MetrologyDisplayLabel | ''
  pm_status: PmStatusLabel | ''
  install_range: [Dayjs | null, Dayjs | null] | null
  completeness: CompletenessFilter | ''
  is_large_equipment: 'yes' | ''
  is_life_support: 'yes' | ''
  is_emergency: 'yes' | ''
  missing_doc: MissingDocFilter | ''
  filing_source: FilingSource | ''
  audit_status: AuditStatus | ''
  code_status: CodeStatus | ''
  attachment_status: AttachmentStatus | ''
  classification_match_status: string
  classification_change_status: string
  updated_range: [Dayjs | null, Dayjs | null] | null
  engineer: string
}

type ArchiveViewSelection = {
  key: string
  label: string
  match: (row: AssetArchiveDisplayRow) => boolean
} | null

type ArchiveViewItem = {
  key: string
  label: string
  count: number
  match: (row: AssetArchiveDisplayRow) => boolean
}

type LedgerSortMode = 'updated' | 'completeness' | 'risk' | 'purchase' | 'meter' | 'pm'

type ArchiveProfile = {
  status: ArchiveStatus
  completeness: number
  missing: string[]
  recentRepairDate: string
  docChecks: ArchiveDocCheck[]
  filingSource: FilingSource
  auditStatus: AuditStatus
  codeStatus: CodeStatus
  attachmentStatus: AttachmentStatus
  updatedDate: string
  engineer: string
  duplicateSuspected: boolean
}

const defaultApplied: AppliedFilters = {
  keyword: '',
  department: '',
  category_code: '',
  main_status: '',
  archive_status: '',
  risk_level: '',
  metrology: '',
  pm_status: '',
  install_range: null,
  completeness: '',
  is_large_equipment: '',
  is_life_support: '',
  is_emergency: '',
  missing_doc: '',
  filing_source: '',
  audit_status: '',
  code_status: '',
  attachment_status: '',
  classification_match_status: '',
  classification_change_status: '',
  updated_range: null,
  engineer: '',
}

const archiveStatusOptions: ArchiveStatus[] = ['待建档', '档案草稿', '已建档', '待补资料', '附件缺失', '档案缺项', '待审核', '已归档']
const filingSourceOptions: FilingSource[] = ['单台建档', '采购流程转档案', '验收入库建档', '历史台账导入', '盘点补录', '维修触发建档', 'AI识别草稿']
const engineerOptions = ['设备科工程师甲', '设备科工程师乙', '影像设备工程师', '生命支持设备工程师', '计量质控工程师']
const defaultSearchHistory = ['急诊科', 'IntelliVue MX800', 'Savina 300', '计量到期', '档案不完整', '高风险设备']
const recommendedSearches = ['档案不完整设备', '计量临期设备', 'PM逾期设备', '高风险设备', '生命支持类设备', '未关联 H-UMDG 分类']
const searchHistoryStorageKey = 'asset-ledger-floating-search-history-v1'
const ledgerColumnStorageKey = 'asset-ledger-visible-columns-v1'
const defaultLedgerVisibleColumns = ['index', 'device', 'department', 'status', 'quality', 'supervision', 'classification', 'change', 'meter', 'pm', 'completeness', 'updated']

const classificationStatusOptions = [
  { value: 'unclassified', label: '未分类设备' },
  { value: 'auto_recommended', label: '自动推荐待确认' },
  { value: 'pending_confirm', label: '待确认分类' },
  { value: 'confirmed', label: '已确认分类' },
  { value: 'need_review', label: '需复核分类' },
  { value: 'expired', label: '分类已失效' },
  { value: 'unable_to_match', label: '无法匹配' },
]

function classificationStatusLabel(value?: string | null) {
  return classificationStatusOptions.find((x) => x.value === value)?.label.replace('设备', '').replace('分类', '') || '未分类'
}

function classificationStatusColor(value?: string | null) {
  if (value === 'confirmed') return 'green'
  if (value === 'need_review' || value === 'pending_confirm' || value === 'auto_recommended') return 'gold'
  if (value === 'expired' || value === 'unable_to_match') return 'red'
  return 'default'
}

type SmartArchiveMode = 'inbox' | 'nameplate' | 'kit' | 'template' | 'model' | 'component' | 'confirm' | 'duplicate'

type ModelArchiveProfile = {
  key: string
  brand: string
  model: string
  commonDocs: string[]
  inheritedCount: number
  registrationNo: string
  maintenanceSpec: string
}

type ProjectArchiveProfile = {
  key: string
  name: string
  contractNo: string
  supplier: string
  amount: string
  quantity: number
  status: string
  linkedModel: string
}

type KitComponent = {
  name: string
  brand: string
  model: string
  serial: string
  independentCode: boolean
  independentRepair: boolean
  metrologyQc: boolean
  critical: boolean
  status: string
  system: string
  note: string
}

type AiInboxDocument = {
  id: string
  file: string
  type: string
  confidence: number
  extracted: string
  target: string
  status: string
}

type NameplateRecognitionRow = {
  id: string
  file: string
  brand: string
  model: string
  serial: string
  productionDate: string
  registrationNo: string
  department: string
  location: string
  engineer: string
  duplicateRisk: string
  confidence: number
}

const modelArchiveProfiles: ModelArchiveProfile[] = [
  {
    key: 'mindray-n15',
    brand: '迈瑞',
    model: 'BeneVision N15',
    commonDocs: ['说明书', '注册证', '合格证', '培训资料', '维护规范', '常见故障知识库'],
    inheritedCount: 200,
    registrationNo: '粤械注准20232070156',
    maintenanceSpec: 'N15年度PM规范 v3.2',
  },
  {
    key: 'siemens-avanto',
    brand: '西门子',
    model: 'MAGNETOM Avanto 1.5T',
    commonDocs: ['用户手册', '维修手册', '技术参数', '注册证', '磁体安全培训资料'],
    inheritedCount: 1,
    registrationNo: '国械注进20173060231',
    maintenanceSpec: 'MRI季度质控与年度保养规范',
  },
  {
    key: 'olympus-laparoscope',
    brand: '奥林巴斯',
    model: '腹腔镜系统组合',
    commonDocs: ['系统说明书', '装箱单', '组件注册证', '消毒维护规范', '培训记录'],
    inheritedCount: 2,
    registrationNo: '国械注进20213060118',
    maintenanceSpec: '内镜系统组件维护与质控规范',
  },
]

const projectArchiveProfiles: ProjectArchiveProfile[] = [
  { key: 'proj-monitor-200', name: '2026年度ICU监护仪批量采购项目', contractNo: 'HT-2026-ICU-N15-200', supplier: '深圳迈瑞生物医疗电子股份有限公司', amount: '1,960万元', quantity: 200, status: '批量建档确认中', linkedModel: 'BeneVision N15' },
  { key: 'proj-laparoscope', name: '外科中心腹腔镜系统采购项目', contractNo: 'HT-2026-OR-LAP-02', supplier: '奥林巴斯医疗销售服务有限公司', amount: '286万元', quantity: 2, status: '成套设备结构已确认', linkedModel: '腹腔镜系统组合' },
  { key: 'proj-mri', name: '影像科MRI更新论证采购项目', contractNo: 'HT-2025-MRI-AVANTO', supplier: '西门子医疗系统有限公司', amount: '760万元', quantity: 1, status: '已归档', linkedModel: 'MAGNETOM Avanto 1.5T' },
]

const laparoscopeComponents: KitComponent[] = [
  { name: '图像处理主机', brand: '奥林巴斯', model: 'CV-190', serial: 'CV190-26-0018', independentCode: true, independentRepair: true, metrologyQc: true, critical: true, status: '在用', system: '奥林巴斯腹腔镜系统', note: '系统核心主机，关联质控记录' },
  { name: '冷光源', brand: '奥林巴斯', model: 'CLV-190', serial: 'CLV190-26-0021', independentCode: true, independentRepair: true, metrologyQc: true, critical: true, status: '在用', system: '奥林巴斯腹腔镜系统', note: '需记录灯泡寿命与照度质控' },
  { name: 'CCD手柄/摄像头', brand: '奥林巴斯', model: 'CH-S190-XZ-E', serial: 'CCD-26077', independentCode: true, independentRepair: true, metrologyQc: false, critical: true, status: '在用', system: '奥林巴斯腹腔镜系统', note: '可单独返修和更换' },
  { name: '医用显示器', brand: '索尼', model: 'LMD-2765MD', serial: 'MON-26015', independentCode: true, independentRepair: true, metrologyQc: true, critical: true, status: '在用', system: '奥林巴斯腹腔镜系统', note: '图像显示质控关联' },
  { name: '腹腔镜镜头', brand: '奥林巴斯', model: 'WA53005A', serial: 'SCOPE-26112', independentCode: true, independentRepair: true, metrologyQc: false, critical: true, status: '在用', system: '奥林巴斯腹腔镜系统', note: '高值附件，消毒流转需追踪' },
  { name: '气腹机', brand: '奥林巴斯', model: 'UHI-4', serial: 'UHI4-26031', independentCode: true, independentRepair: true, metrologyQc: true, critical: true, status: '在用', system: '奥林巴斯腹腔镜系统', note: '压力/流量质控' },
  { name: '高频电刀', brand: '爱尔博', model: 'VIO 300D', serial: 'VIO-26009', independentCode: true, independentRepair: true, metrologyQc: true, critical: true, status: '在用', system: '奥林巴斯腹腔镜系统', note: '独立计量与电气安全检测' },
  { name: '台车', brand: '国产', model: 'OR-Trolley-4', serial: '无', independentCode: false, independentRepair: false, metrologyQc: false, critical: false, status: '在用', system: '奥林巴斯腹腔镜系统', note: '随机配件类附件' },
  { name: '导光束', brand: '奥林巴斯', model: 'WA03300A', serial: '无', independentCode: false, independentRepair: false, metrologyQc: false, critical: true, status: '在用', system: '奥林巴斯腹腔镜系统', note: '可更换附件，需记录更换批次' },
  { name: '连接线缆', brand: '奥林巴斯', model: 'Cable Kit', serial: '无', independentCode: false, independentRepair: false, metrologyQc: false, critical: false, status: '在用', system: '奥林巴斯腹腔镜系统', note: '随机配件' },
  { name: '脚踏开关', brand: '爱尔博', model: 'FS-ERBE', serial: 'FS-26042', independentCode: false, independentRepair: true, metrologyQc: false, critical: false, status: '在用', system: '奥林巴斯腹腔镜系统', note: '电刀配套附件' },
  { name: '消毒盒', brand: '奥林巴斯', model: 'Sterilization Tray', serial: '无', independentCode: false, independentRepair: false, metrologyQc: false, critical: false, status: '在用', system: '奥林巴斯腹腔镜系统', note: '消毒周转附件' },
  { name: '成套器械', brand: '国产', model: 'Lap Tool Set', serial: 'SET-26003', independentCode: false, independentRepair: false, metrologyQc: false, critical: false, status: '在用', system: '奥林巴斯腹腔镜系统', note: '可关联SPD耗材和器械包' },
]

const aiInboxDocuments: AiInboxDocument[] = [
  { id: 'doc-1', file: 'HT-2026-ICU-N15-200.pdf', type: '合同', confidence: 96, extracted: '合同号、供应商、金额、200台N15监护仪', target: '采购项目档案 / 2026年度ICU监护仪批量采购项目', status: '待人工确认' },
  { id: 'doc-2', file: 'N15-registration.pdf', type: '注册证', confidence: 94, extracted: '品牌迈瑞、型号BeneVision N15、注册证号', target: '型号档案 / BeneVision N15', status: '可归档' },
  { id: 'doc-3', file: 'laparoscope-packing-list.xlsx', type: '装箱单', confidence: 91, extracted: '图像处理主机、冷光源、CCD手柄、显示器、气腹机、电刀等13项', target: '组件/附件档案 / 奥林巴斯腹腔镜系统', status: '需确认组件结构' },
  { id: 'doc-4', file: 'nameplate_batch_icu.zip', type: '铭牌照片', confidence: 89, extracted: '识别198个序列号，2张照片需复核', target: '单台设备档案 / 批量建档确认', status: '待人工确认' },
  { id: 'doc-5', file: 'meter-cert-defib-2026.pdf', type: '计量证书', confidence: 93, extracted: '除颤监护仪、证书编号、到期日期', target: '单台设备档案 / 计量记录', status: '可归档' },
]

const nameplateRecognitionRows: NameplateRecognitionRow[] = [
  { id: 'n15-001', file: 'IMG_0012.jpg', brand: '迈瑞', model: 'BeneVision N15', serial: 'N15C260001', productionDate: '2026-03-18', registrationNo: '粤械注准20232070156', department: 'ICU一病区', location: 'ICU-01床旁', engineer: '生命支持设备工程师', duplicateRisk: '无重复', confidence: 97 },
  { id: 'n15-002', file: 'IMG_0013.jpg', brand: '迈瑞', model: 'BeneVision N15', serial: 'N15C260002', productionDate: '2026-03-18', registrationNo: '粤械注准20232070156', department: 'ICU一病区', location: 'ICU-02床旁', engineer: '生命支持设备工程师', duplicateRisk: '无重复', confidence: 96 },
  { id: 'n15-003', file: 'IMG_0014.jpg', brand: '迈瑞', model: 'BeneVision N15', serial: 'N15C260003', productionDate: '2026-03-19', registrationNo: '粤械注准20232070156', department: '急诊ICU', location: 'EICU-03床旁', engineer: '生命支持设备工程师', duplicateRisk: '疑似已有同序列号草稿', confidence: 88 },
  { id: 'n15-004', file: 'IMG_0015.jpg', brand: '迈瑞', model: 'BeneVision N15', serial: 'N15C260004', productionDate: '2026-03-19', registrationNo: '粤械注准20232070156', department: '麻醉科', location: '复苏室-04', engineer: '生命支持设备工程师', duplicateRisk: '无重复', confidence: 95 },
]

type SavedFilterPlan = {
  name: string
  scope: '我的方案' | '科室共享方案'
  patch: Partial<AppliedFilters>
  view?: ArchiveViewSelection
}

const initialSavedFilterPlans: SavedFilterPlan[] = [
  { name: '计量临期设备', scope: '我的方案', patch: { metrology: '即将到期' } },
  { name: '档案缺项设备', scope: '我的方案', patch: {}, view: { key: 'plan-missing', label: '档案缺项设备', match: (row) => buildArchiveProfile(row).missing.length > 0 } },
  { name: '本月待审核设备', scope: '我的方案', patch: { audit_status: '待审核' } },
  { name: '高风险生命支持设备', scope: '科室共享方案', patch: { risk_level: '高风险', is_life_support: 'yes' } },
  { name: '大型设备效益资料复核', scope: '科室共享方案', patch: { is_large_equipment: 'yes' }, view: { key: 'plan-benefit', label: '大型设备缺效益分析', match: (row) => buildArchiveProfile(row).missing.includes('效益分析') } },
]

function getArchiveRuntime(row: AssetArchiveDisplayRow): ArchiveRuntime {
  return (row as RuntimeRow).archiveRuntime ?? {}
}

function mergeArchiveRuntime(row: AssetArchiveDisplayRow, patch: ArchiveRuntime): AssetArchiveDisplayRow {
  const current = getArchiveRuntime(row)
  return {
    ...row,
    archiveRuntime: {
      ...current,
      ...patch,
      tasks: patch.tasks ?? current.tasks,
      lifecycleNodes: patch.lifecycleNodes ?? current.lifecycleNodes,
      contract: patch.contract ?? current.contract,
    },
  } as RuntimeRow
}

function mergeRowsPreservingRuntime(nextRows: AssetArchiveDisplayRow[], currentRows: AssetArchiveDisplayRow[]) {
  const currentById = new Map(currentRows.map((row) => [row.id, row]))
  const nextIds = new Set(nextRows.map((row) => row.id))
  const merged = nextRows.map((row) => {
    const current = currentById.get(row.id)
    return current ? ({ ...row, archiveRuntime: getArchiveRuntime(current) } as RuntimeRow) : row
  })
  currentRows.forEach((row) => {
    if (!nextIds.has(row.id)) merged.push(row)
  })
  return merged
}

function applyMissingToChecks(checks: ArchiveDocCheck[], missingOverride?: string[]) {
  if (!missingOverride) return checks
  const missing = new Set(missingOverride)
  const next = checks.map((item) => ({ ...item, ok: !missing.has(item.label) }))
  missingOverride.forEach((label) => {
    if (!next.some((item) => item.label === label)) {
      next.push({ label, ok: false, required: true, weight: label.includes('补充') ? 5 : 6 })
    }
  })
  return next
}

function scoreDocChecks(checks: ArchiveDocCheck[]) {
  const totalWeight = checks.reduce((sum, x) => sum + x.weight, 0)
  const completeWeight = checks.filter((x) => x.ok).reduce((sum, x) => sum + x.weight, 0)
  return totalWeight ? Math.round((completeWeight / totalWeight) * 100) : 100
}

function moneyCn(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? `¥ ${n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : String(v)
}

function formatDate(v: string | null | undefined) {
  return v?.slice(0, 10) || '—'
}

function toLabelPrintTarget(row: AssetArchiveDisplayRow): AssetLabelPrintTarget {
  return {
    asset_id: row.id,
    asset_code: formatArchiveAssetCode(row.asset_code, row.id),
    asset_name: row.asset_name,
    main_status: row.main_status,
  }
}

function apiSliceParams(f: AppliedFilters): FetchAssetsParams {
  const riskMap: Record<RiskDisplayLabel, string> = {
    高风险: 'HIGH',
    中风险: 'MEDIUM',
    低风险: 'LOW',
  }
  const statusMap: Record<RunDisplayLabel, string> = {
    在用: 'ACTIVE',
    维修中: 'UNDER_REPAIR',
    停用: 'IDLE',
    报废: 'DECOMMISSIONED',
    异常: 'ABNORMAL',
  }
  return {
    keyword: f.keyword || undefined,
    category_code: f.category_code || undefined,
    risk_level: f.risk_level ? riskMap[f.risk_level] : undefined,
    main_status: f.main_status ? statusMap[f.main_status] : undefined,
    classification_match_status: f.classification_match_status || undefined,
    classification_change_status: f.classification_change_status || undefined,
  }
}

function riskTagColor(risk: RiskDisplayLabel) {
  if (risk === '高风险') return 'volcano'
  if (risk === '中风险') return 'gold'
  return 'green'
}

function runTagColor(run: RunDisplayLabel) {
  if (run === '在用') return 'green'
  if (run === '维修中') return 'blue'
  if (run === '停用') return 'default'
  if (run === '报废') return 'default'
  return 'red'
}

function archiveStatusColor(status: ArchiveStatus) {
  if (status === '档案缺项') return 'gold'
  if (status === '待审核') return 'blue'
  if (status === '待建档' || status === '档案草稿') return 'default'
  if (status === '已归档') return 'cyan'
  return 'green'
}

function buildArchiveProfile(row: AssetArchiveDisplayRow): ArchiveProfile {
  const runtime = getArchiveRuntime(row)
  const seed = assetArchiveSeed(row.id)
  const metrics = buildAssetTwinMetrics(row)
  const filingSource = runtime.filingSource ?? filingSourceOptions[seed % filingSourceOptions.length]!
  const engineer = runtime.engineer ?? engineerOptions[seed % engineerOptions.length]!
  const doc = (label: string, weight: number, required = true, okSeed = 9): ArchiveDocCheck => ({
    label,
    weight,
    required,
    ok: (seed + label.length * 17) % okSeed !== 0,
  })
  let checks: ArchiveDocCheck[] = runtime.docChecks ?? [
    { label: '基本信息完整', weight: 12, required: true, ok: true },
    doc('采购申请资料', 7),
    doc('论证记录', 6),
    doc('合同', 8),
    doc('发票', 6),
    doc('到货验收单', 8),
    doc('安装调试报告', 6),
    { label: '注册证', weight: 8, required: true, ok: Boolean(row.registration_no) && seed % 11 !== 0 },
    doc('合格证', 5),
    { label: '使用说明书', weight: 4, required: true, ok: true },
    doc('维修手册', 4, false),
    doc('培训记录', 5),
    { label: 'PM记录', weight: 7, required: true, ok: metrics.pmStatus !== '超时' && seed % 7 !== 0 },
    { label: '维修记录', weight: 6, required: metrics.repairCount > 0, ok: metrics.repairCount === 0 || seed % 6 !== 0 },
    { label: '生命周期记录', weight: 7, required: true, ok: true },
  ]

  if (row.is_metrology_device) {
    checks.push({ label: '计量证书', weight: 8, required: true, ok: row.metrology_display === '正常' || seed % 5 !== 0 })
  }
  if (row.is_large_equipment) {
    checks.push(doc('配置许可', 5), doc('效益分析', 5))
  }
  if (row.category_code === 'MED_IMG') {
    checks.push(doc('放射许可证', 6), doc('性能检测资料', 5), doc('防护检测资料', 5))
  }
  if (row.is_critical_care) {
    checks.push(
      { label: '完好率检查记录', weight: 6, required: true, ok: metrics.bootRate >= 80 || seed % 4 !== 0 },
      doc('应急调配记录', 5),
    )
  }
  if (metrics.lifecycleStage === '已报废' || metrics.lifecycleStage === '待报废') {
    checks.push({ label: '报废资料', weight: 7, required: true, ok: metrics.lifecycleStage !== '已报废' || seed % 3 !== 0 })
  }

  checks = applyMissingToChecks(checks, runtime.missing)
  const missing = Array.from(new Set(checks.filter((x) => !x.ok).map((x) => x.label)))
  const completeness = runtime.completeness ?? scoreDocChecks(checks)
  const duplicateSuspected = runtime.duplicateSuspected ?? seed % 19 === 0
  const codeStatus: CodeStatus = runtime.codeStatus ?? (duplicateSuspected ? '重复' : seed % 23 === 0 ? '缺失' : seed % 17 === 0 ? '规则不符' : '正常')
  const attachmentStatus: AttachmentStatus =
    runtime.attachmentStatus ??
    (missing.length >= 5 ? '无附件' : missing.some((x) => ['合同', '发票', '到货验收单', '计量证书', '注册证'].includes(x)) ? '部分缺失' : '完整')
  const auditStatus: AuditStatus = runtime.auditStatus ?? (
    completeness < 70
      ? '退回修改'
      : metrics.lifecycleStage === '采购中' || metrics.lifecycleStage === '待验收'
        ? '草稿'
        : seed % 13 === 0
          ? '待审核'
          : '已审核'
  )
  const derivedStatus: ArchiveStatus =
    metrics.lifecycleStage === '采购中'
      ? '待建档'
      : metrics.lifecycleStage === '待验收'
        ? '档案草稿'
        : metrics.lifecycleStage === '已报废'
          ? '已归档'
          : auditStatus === '待审核'
            ? '待审核'
            : attachmentStatus !== '完整'
              ? '附件缺失'
              : missing.length
                ? '待补资料'
                : completeness < 88
                  ? '档案缺项'
                  : '已建档'
  const status = runtime.status ?? derivedStatus
  return {
    status,
    completeness,
    missing,
    recentRepairDate: runtime.recentRepairDate ?? (metrics.repairCount > 0 ? dayjs().subtract((seed % 120) + 8, 'day').format('YYYY-MM-DD') : '—'),
    docChecks: checks,
    filingSource,
    auditStatus,
    codeStatus,
    attachmentStatus,
    updatedDate: runtime.updatedDate ?? dayjs().subtract(seed % 90, 'day').format('YYYY-MM-DD'),
    engineer,
    duplicateSuspected,
  }
}

function withScenarioArchiveRuntime(rows: AssetArchiveDisplayRow[]) {
  return rows.map((row) => {
    const base = buildArchiveProfile(row)
    const name = row.asset_name
    let patch: ArchiveRuntime | null = null

    if (name.includes('MAGNETOM') || name.includes('MRI')) {
      patch = {
        status: '待补资料',
        completeness: 95,
        missing: ['补充质控记录'],
        filingSource: '采购流程转档案',
        auditStatus: '已审核',
        attachmentStatus: '完整',
        codeStatus: '正常',
        sourceLabel: '采购合同、验收入库单、影像大型设备配置论证',
      }
    } else if (name.includes('IntelliVue') || name.includes('监护仪')) {
      patch = {
        status: '附件缺失',
        completeness: 82,
        missing: name.includes('IntelliVue') ? ['合同', '发票'] : ['发票'],
        filingSource: '验收入库建档',
        auditStatus: '已审核',
        attachmentStatus: '部分缺失',
        codeStatus: '正常',
        sourceLabel: '验收单与铭牌照片已归档，合同/发票待财务补扫',
      }
    } else if (name.includes('Revolution CT')) {
      patch = {
        status: '待建档',
        completeness: 76,
        missing: ['安装调试报告', '培训记录', '补充质控记录'],
        filingSource: '采购流程转档案',
        auditStatus: '草稿',
        attachmentStatus: '部分缺失',
        codeStatus: '正常',
        sourceLabel: '已完成采购验收，等待档案管理员确认转档',
      }
    } else if (name.includes('Savina') || name.includes('呼吸机')) {
      patch = {
        status: '待补资料',
        completeness: 88,
        missing: ['PM记录'],
        filingSource: '采购流程转档案',
        auditStatus: '已审核',
        attachmentStatus: '完整',
        codeStatus: '正常',
        sourceLabel: '生命支持设备年度PM任务逾期未回写',
      }
    } else if (name.includes('除颤')) {
      patch = {
        status: '已建档',
        completeness: 96,
        missing: [],
        filingSource: '验收入库建档',
        auditStatus: '已审核',
        attachmentStatus: '完整',
        codeStatus: '正常',
        sourceLabel: '急救设备验收、计量与完好率检查资料齐全',
      }
    } else if (name.includes('注射泵')) {
      patch = {
        status: '待审核',
        completeness: 90,
        missing: ['批量入库清单'],
        filingSource: '盘点补录',
        auditStatus: '待审核',
        attachmentStatus: '完整',
        codeStatus: '规则不符',
        duplicateSuspected: true,
        supplementReason: '2026年二季度病区盘点发现批量注射泵与旧系统编码规则不一致',
        sourceLabel: '盘点补录单、病区设备清单、铭牌照片',
      }
    } else if (name.includes('麻醉机')) {
      patch = {
        status: '附件缺失',
        completeness: 84,
        missing: ['维修记录', '维修手册'],
        filingSource: '维修触发建档',
        auditStatus: '已审核',
        attachmentStatus: '部分缺失',
        codeStatus: '正常',
        recentRepairDate: dayjs().subtract(22, 'day').format('YYYY-MM-DD'),
        sourceLabel: '维修工单触发档案复核，部分维修附件未归档',
      }
    } else if (name.includes('灭菌器')) {
      patch = {
        status: '待审核',
        completeness: 86,
        missing: ['更新论证资料', '报废资料'],
        filingSource: '历史台账导入',
        auditStatus: '待审核',
        attachmentStatus: '部分缺失',
        codeStatus: '正常',
        sourceLabel: '旧系统台账导入，启用超过8年，待更新论证',
      }
    }

    if (!patch) return row
    const checks = applyMissingToChecks(base.docChecks, patch.missing)
    return mergeArchiveRuntime(row, {
      ...patch,
      docChecks: checks,
      updatedDate: dayjs().subtract(assetArchiveSeed(row.id) % 16, 'day').format('YYYY-MM-DD'),
      contract: mockContractRows(row)[0],
    })
  })
}

function completenessMatches(row: AssetArchiveDisplayRow, value: CompletenessFilter) {
  const profile = buildArchiveProfile(row)
  if (value === '完整') return profile.completeness >= 95
  if (value === '缺采购资料') return profile.missing.some((x) => ['采购申请资料', '论证记录'].includes(x))
  if (value === '缺验收资料') return profile.missing.some((x) => ['到货验收单', '安装调试报告'].includes(x))
  if (value === '缺合同发票') return profile.missing.some((x) => ['合同', '发票'].includes(x))
  if (value === '缺计量记录') return profile.missing.includes('计量证书')
  if (value === '缺维修记录') return profile.missing.includes('维修记录')
  return profile.missing.includes('培训记录')
}

function missingDocMatches(row: AssetArchiveDisplayRow, value: MissingDocFilter) {
  const missing = buildArchiveProfile(row).missing
  if (value === '验收单') return missing.includes('到货验收单')
  return missing.includes(value)
}

function parseAiArchiveQuery(keyword: string): { patch: Partial<AppliedFilters>; labels: string[] } {
  const text = keyword.trim().toLowerCase().replace(/\s+/g, '')
  const patch: Partial<AppliedFilters> = {}
  const labels: string[] = []
  if (!text) return { patch, labels }

  const add = <K extends keyof AppliedFilters>(key: K, value: AppliedFilters[K], label: string) => {
    patch[key] = value
    labels.push(label)
  }

  if (text.includes('影像科')) add('department', '影像科', '使用科室=影像科')
  if (text.includes('icu')) add('department', 'ICU', '使用科室=ICU')
  if (text.includes('急诊')) add('department', '急诊科', '使用科室=急诊科')
  if (text.includes('大型')) add('is_large_equipment', 'yes', '大型设备=是')
  if (text.includes('生命支持')) add('is_life_support', 'yes', '生命支持类=是')
  if (text.includes('急救')) add('is_emergency', 'yes', '急救设备=是')
  if (text.includes('高风险')) add('risk_level', '高风险', '风险等级=高风险')
  if (text.includes('在用')) add('main_status', '在用', '资产状态=在用')
  if (text.includes('待审核')) add('audit_status', '待审核', '审核状态=待审核')
  if (text.includes('计量临期')) add('metrology', '即将到期', '计量状态=即将到期')
  if (text.includes('计量超期') || text.includes('计量过期')) add('metrology', '已过期', '计量状态=已过期')
  if (text.includes('pm逾期') || text.includes('pm超期') || text.includes('pm超时')) add('pm_status', '超时', 'PM状态=超时')
  if (text.includes('缺合同') && text.includes('发票')) add('completeness', '缺合同发票', '完整度=缺合同发票')
  else if (text.includes('缺合同')) add('missing_doc', '合同', '缺失资料=合同')
  else if (text.includes('缺发票')) add('missing_doc', '发票', '缺失资料=发票')
  if (text.includes('附件缺失')) add('attachment_status', '部分缺失', '附件状态=部分缺失')
  if (text.includes('不完整') || text.includes('缺项')) labels.push('语义条件=档案不完整')
  if (text.includes('超过8年') || text.includes('超8年') || text.includes('八年')) labels.push('语义条件=启用超过8年')

  return { patch, labels }
}

function semanticKeywordMatches(row: AssetArchiveDisplayRow, keyword: string, profile: ArchiveProfile, metrics: ReturnType<typeof buildAssetTwinMetrics>) {
  const text = keyword.trim().toLowerCase().replace(/\s+/g, '')
  if (!text) return true
  const clauses: boolean[] = []
  if (text.includes('不完整') || text.includes('缺项')) clauses.push(profile.missing.length > 0 || profile.completeness < 95)
  if (text.includes('超过8年') || text.includes('超8年') || text.includes('八年')) clauses.push(metrics.serviceAgeYears >= 8)
  if (text.includes('仍在用') || text.includes('在用')) clauses.push(row.run_display === '在用')
  if (text.includes('缺合同')) clauses.push(profile.missing.includes('合同'))
  if (text.includes('缺发票')) clauses.push(profile.missing.includes('发票'))
  if (text.includes('附件缺失')) clauses.push(profile.attachmentStatus !== '完整')
  if (text.includes('待更新论证') || text.includes('更新论证')) clauses.push(metrics.serviceAgeYears >= 8 || metrics.lifecycleStage === '待报废')
  return clauses.length > 0 && clauses.every(Boolean)
}

function passesClientFilters(row: AssetArchiveDisplayRow, f: AppliedFilters, view: ArchiveViewSelection): boolean {
  const metrics = buildAssetTwinMetrics(row)
  const profile = buildArchiveProfile(row)
  const kw = f.keyword.trim().toLowerCase()
  if (view && !view.match(row)) return false
  if (kw) {
    const contracts = mockContractRows(row)
    const compactKw = kw.replace(/\s+/g, '')
    const identityText = [
      row.asset_name,
      row.asset_code,
      formatArchiveAssetCode(row.asset_code, row.id),
      row.serial_number ?? '',
      row.registration_no ?? '',
      row.brand_vendor,
      row.spec_model,
      row.department_name,
      row.category_label,
      row.classification_code,
      row.classification_name,
      row.hmdm_equipment_category_code,
      row.hmdm_standard_name,
      profile.engineer,
      profile.filingSource,
      metrics.rfid,
      metrics.qrCode,
      ...contracts.flatMap((x) => [x.contract_no, x.invoice_no, x.supplier]),
    ]
      .join(' ')
      .toLowerCase()
    const compactIdentityText = identityText.replace(/\s+/g, '')
    const semanticMatches = [
      kw.includes('缺合同') && profile.missing.includes('合同'),
      kw.includes('缺发票') && profile.missing.includes('发票'),
      kw.includes('缺验收') && profile.missing.includes('到货验收单'),
      kw.includes('缺计量') && profile.missing.includes('计量证书'),
      kw.includes('缺pm') && profile.missing.includes('PM记录'),
      kw.includes('附件缺失') && profile.attachmentStatus !== '完整',
      kw.includes('待审核') && profile.auditStatus === '待审核',
      kw.includes('高风险') && row.risk_display === '高风险',
      kw.includes('生命支持') && row.is_critical_care,
      kw.includes('大型') && row.is_large_equipment,
      kw.includes('计量临期') && row.metrology_display === '即将到期',
      kw.includes('计量超期') && row.metrology_display === '已过期',
      compactKw.includes('pm逾期') && metrics.pmStatus === '超时',
      kw.includes('超年限') && metrics.serviceAgeYears >= 8,
      kw.includes('报废') && metrics.lifecycleStage !== '已报废' && metrics.serviceAgeYears >= 8,
    ]
    const fieldMatched = identityText.includes(kw) || compactIdentityText.includes(compactKw)
    const semanticMatched = semanticMatches.some(Boolean) || semanticKeywordMatches(row, kw, profile, metrics)
    if (!fieldMatched && !semanticMatched) return false
  }
  if (f.department && row.department_name !== f.department) return false
  if (f.category_code && row.category_code !== f.category_code) return false
  if (f.main_status && row.run_display !== f.main_status) return false
  if (f.archive_status && profile.status !== f.archive_status) return false
  if (f.risk_level && row.risk_display !== f.risk_level) return false
  if (f.metrology && row.metrology_display !== f.metrology) return false
  if (f.pm_status && metrics.pmStatus !== f.pm_status) return false
  if (f.completeness && !completenessMatches(row, f.completeness)) return false
  if (f.is_large_equipment === 'yes' && !row.is_large_equipment) return false
  if (f.is_life_support === 'yes' && !row.is_critical_care) return false
  if (f.is_emergency === 'yes' && !(row.asset_name.includes('除颤') || row.department_name.includes('急诊') || row.is_critical_care)) return false
  if (f.missing_doc && !missingDocMatches(row, f.missing_doc)) return false
  if (f.filing_source && profile.filingSource !== f.filing_source) return false
  if (f.audit_status && profile.auditStatus !== f.audit_status) return false
  if (f.code_status && profile.codeStatus !== f.code_status) return false
  if (f.attachment_status && profile.attachmentStatus !== f.attachment_status) return false
  if (f.classification_match_status && row.classification_match_status !== f.classification_match_status) return false
  if (f.classification_change_status && row.classification_change_status !== f.classification_change_status) return false
  if (f.engineer && profile.engineer !== f.engineer) return false
  if (f.install_range?.[0] && f.install_range?.[1]) {
    const install = dayjs(row.install_display)
    if (!install.isValid() || install.isBefore(f.install_range[0], 'day') || install.isAfter(f.install_range[1], 'day')) return false
  }
  if (f.updated_range?.[0] && f.updated_range?.[1]) {
    const updated = dayjs(profile.updatedDate)
    if (!updated.isValid() || updated.isBefore(f.updated_range[0], 'day') || updated.isAfter(f.updated_range[1], 'day')) return false
  }
  return true
}

function buildQuickFilterChips(rows: AssetArchiveDisplayRow[]): ArchiveViewItem[] {
  const item = (key: string, label: string, match: (row: AssetArchiveDisplayRow) => boolean): ArchiveViewItem => ({
    key,
    label,
    match,
    count: rows.filter(match).length,
  })
  return [
    item('need-materials', '待补资料', (row) => buildArchiveProfile(row).missing.length > 0),
    item('attach-missing', '附件缺失', (row) => buildArchiveProfile(row).attachmentStatus !== '完整'),
    item('review', '待审核', (row) => buildArchiveProfile(row).auditStatus === '待审核'),
    item('high-risk', '高风险设备', (row) => row.risk_display === '高风险'),
    item('large', '大型设备', (row) => row.is_large_equipment),
    item('meter-due', '计量临期', (row) => row.metrology_display === '即将到期' || row.metrology_display === '已过期'),
    item('pm-overdue', 'PM逾期', (row) => buildAssetTwinMetrics(row).pmStatus === '超时'),
    item('code-abnormal', '编码异常', (row) => buildArchiveProfile(row).codeStatus !== '正常'),
    item('classification-review', '分类需复核', (row) => row.classification_match_status === 'need_review' || row.classification_change_status === 'pending'),
  ]
}

function buildLifecycleTimeline(row: AssetArchiveDisplayRow): ArchiveLifecycleNode[] {
  const runtime = getArchiveRuntime(row)
  if (runtime.lifecycleNodes?.length) return runtime.lifecycleNodes
  const events = buildAssetLifecycleEvents(row)
  const seed = assetArchiveSeed(row.id)
  const handler = ['设备科经办人', '采购办', '验收小组', '科室管理员', '维保工程师'][seed % 5]
  const profile = buildArchiveProfile(row)
  const metrics = buildAssetTwinMetrics(row)
  const install = dayjs(row.install_display)
  const purchase = dayjs(row.purchase_display)
  const time = (base: Dayjs, offset: number) => (base.isValid() ? base.add(offset, 'day').format('YYYY-MM-DD') : events[Math.abs(offset) % events.length]?.time ?? '—')
  const scrapPending = metrics.lifecycleStage === '待报废' || metrics.serviceAgeYears >= 8
  const scrapped = metrics.lifecycleStage === '已报废' || profile.status === '已归档'
  const nodes = [
    { title: '采购申请', time: time(purchase, -65), source: '采购申请单' },
    { title: '合同签订', time: time(purchase, -25), source: '合同系统' },
    { title: '验收入库', time: time(purchase, 0), source: '验收单/入库单' },
    { title: '启用', time: row.install_display, source: '科室启用确认' },
    { title: '首次PM', time: time(install, 96), source: 'PM计划' },
    { title: '最近维修', time: profile.recentRepairDate, source: '维修工单' },
    { title: '最近计量', time: row.is_metrology_device ? time(install, 320) : '不适用', source: row.is_metrology_device ? '计量证书' : '设备属性' },
    { title: '当前状态', time: dayjs().format('YYYY-MM-DD'), source: '资产台账' },
    { title: '报废申请', time: scrapPending || scrapped ? dayjs().subtract(18, 'day').format('YYYY-MM-DD') : '未触发', source: '更新报废流程' },
    { title: '报废审批', time: scrapped ? dayjs().subtract(8, 'day').format('YYYY-MM-DD') : '未触发', source: '审批流' },
    { title: '报废完成', time: scrapped ? dayjs().subtract(1, 'day').format('YYYY-MM-DD') : '未触发', source: '资产处置单' },
  ]
  return nodes.map((item, index) => ({
    ...item,
    handler,
    document: `WLX-${item.title.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '')}-${String(seed + index).slice(-5)}`,
    status:
      item.time === '未触发'
        ? '未触发'
        : item.title === '报废申请' && !scrapped
          ? '待处理'
          : index <= 7
            ? '已完成'
            : '可追溯',
  }))
}

function archiveContractRows(row: AssetArchiveDisplayRow): ArchiveContractSnapshot[] {
  const runtime = getArchiveRuntime(row)
  return [runtime.contract ?? mockContractRows(row)[0]!]
}

function mockRepairRows(row: AssetArchiveDisplayRow) {
  const metrics = buildAssetTwinMetrics(row)
  return [
    {
      code: `WX-${row.asset_code.slice(-4)}-01`,
      date: buildArchiveProfile(row).recentRepairDate,
      fault: row.category_code === 'MED_IMG' ? '图像链路异常' : row.is_critical_care ? '报警与供电异常' : '性能波动',
      cost: moneyCn(Math.round(metrics.repairCost * 0.46)),
      result: metrics.repairCount > 3 ? '需复查' : '已闭环',
    },
    {
      code: `WX-${row.asset_code.slice(-4)}-02`,
      date: '2025-10-21',
      fault: '科室报修 / 工程师现场确认',
      cost: moneyCn(Math.round(metrics.repairCost * 0.28)),
      result: '已闭环',
    },
  ]
}

function mockRiskRows(row: AssetArchiveDisplayRow) {
  const metrics = buildAssetTwinMetrics(row)
  return [
    { item: '风险等级', value: row.risk_display, status: row.risk_display === '高风险' ? '重点复核' : '常规监测' },
    { item: 'AI健康度', value: `${metrics.aiScore}%`, status: metrics.aiScore < 70 ? '预警' : '正常' },
    { item: 'PM状态', value: metrics.pmStatus, status: metrics.pmStatus === '正常' ? '正常' : '待处理' },
    { item: '计量状态', value: row.metrology_display, status: row.metrology_display === '正常' || row.metrology_display === '不适用' ? '正常' : '待处理' },
  ]
}

function completenessText(profile: ArchiveProfile) {
  if (profile.completeness >= 95) return '完整'
  const short = profile.missing.slice(0, 2).join('/')
  return short ? `缺${short}` : '待复核'
}

function dataCredibility(profile: ArchiveProfile) {
  if (profile.filingSource === '采购流程转档案' || profile.filingSource === '验收入库建档') return { label: '高', color: 'green' }
  if (profile.filingSource === '历史台账导入') return { label: '中', color: 'gold' }
  return { label: '待确认', color: 'orange' }
}

function criticalMissingDocs(row: AssetArchiveDisplayRow, profile: ArchiveProfile) {
  const critical = new Set(['合同', '到货验收单', '注册证'])
  if (row.is_metrology_device) critical.add('计量证书')
  if (row.is_critical_care || row.risk_display === '高风险') {
    critical.add('PM记录')
    critical.add('完好率检查记录')
  }
  if (row.is_critical_care) critical.add('应急调配记录')
  if (row.is_large_equipment) critical.add('配置许可')
  if (row.category_code === 'MED_IMG') {
    critical.add('放射许可证')
    critical.add('性能检测资料')
    critical.add('防护检测资料')
  }
  return profile.missing.filter((x) => critical.has(x))
}

function completenessSeverity(row: AssetArchiveDisplayRow, profile: ArchiveProfile) {
  const criticalMissing = criticalMissingDocs(row, profile)
  if (criticalMissing.length && (row.risk_display === '高风险' || row.is_critical_care)) return 'critical'
  if (criticalMissing.length) return 'serious'
  if (profile.completeness >= 90) return 'good'
  return 'warning'
}

function completenessStrokeColor(severity: string) {
  if (severity === 'critical') return '#ff4d4f'
  if (severity === 'serious') return '#fa8c16'
  if (severity === 'warning') return '#faad14'
  return '#52c41a'
}

function archivePendingTasks(profile: ArchiveProfile) {
  const tasks: string[] = []
  if (profile.missing.some((x) => ['采购申请资料', '论证记录', '合同', '发票', '到货验收单', '安装调试报告'].includes(x))) {
    tasks.push('补齐采购验收资料')
  }
  if (profile.missing.some((x) => ['注册证', '合格证', '使用说明书', '维修手册', '培训记录'].includes(x))) {
    tasks.push('补齐证照与培训资料')
  }
  if (profile.missing.includes('计量证书')) tasks.push('补齐计量证书')
  if (profile.missing.some((x) => ['PM记录', '维修记录', '完好率检查记录', '应急调配记录'].includes(x))) {
    tasks.push('补齐维保质控记录')
  }
  if (profile.auditStatus === '待审核') tasks.push('完成档案审核')
  if (profile.codeStatus !== '正常') tasks.push('处理编码异常')
  if (profile.attachmentStatus !== '完整') tasks.push('上传缺失附件')
  return tasks.length ? Array.from(new Set(tasks)) : ['暂无待处理事项']
}

function buildLifecycleSummary(row: AssetArchiveDisplayRow, profile: ArchiveProfile) {
  const metrics = buildAssetTwinMetrics(row)
  const timeline = buildLifecycleTimeline(row)
  const timeOf = (title: string) => timeline.find((item) => item.title === title)?.time ?? '—'
  return [
    { label: '采购申请', value: timeOf('采购申请') },
    { label: '合同签订', value: timeOf('合同签订') },
    { label: '验收入库', value: timeOf('验收入库') },
    { label: '启用', value: timeOf('启用') || row.install_display },
    { label: '首次PM', value: timeOf('首次PM') },
    { label: '最近维修', value: timeOf('最近维修') || profile.recentRepairDate },
    { label: '最近计量', value: row.is_metrology_device ? timeOf('最近计量') : '不适用' },
    { label: '当前状态', value: metrics.lifecycleStage },
  ]
}

function buildArchiveRiskTips(row: AssetArchiveDisplayRow, profile: ArchiveProfile, metrics: ReturnType<typeof buildAssetTwinMetrics>) {
  const tips: Array<{ level: 'high' | 'warning' | 'normal'; text: string }> = []
  if (row.is_critical_care || row.category_label.includes('生命支持')) tips.push({ level: 'high', text: '该设备属于生命支持相关设备，需纳入重点监管。' })
  if (profile.missing.length) tips.push({ level: criticalMissingDocs(row, profile).length ? 'high' : 'warning', text: `档案缺少${profile.missing.slice(0, 4).join('、')}，建议补齐。` })
  tips.push({ level: row.metrology_display === '正常' || row.metrology_display === '不适用' ? 'normal' : row.metrology_display === '已过期' ? 'high' : 'warning', text: `计量状态${row.metrology_display}，依据最近计量证书和到期日期判断。` })
  tips.push({ level: metrics.pmStatus === '正常' ? 'normal' : metrics.pmStatus === '超时' ? 'high' : 'warning', text: `PM状态${metrics.pmStatus}，依据PM计划应完成日期与最近记录判断。` })
  if (profile.attachmentStatus !== '完整') tips.push({ level: 'warning', text: `附件状态${profile.attachmentStatus}，需补齐后重新计算档案完整度。` })
  if (profile.codeStatus !== '正常' || profile.duplicateSuspected) tips.push({ level: 'warning', text: `编码状态${profile.codeStatus}，存在主数据治理或疑似重复校验风险。` })
  if (metrics.serviceAgeYears >= 8) tips.push({ level: 'warning', text: '启用超过8年，已达到更新论证或报废评估触发条件。' })
  tips.push({ level: 'normal', text: '建议定期核对使用科室、存放地点和责任工程师。' })
  return tips
}

function buildAttachmentRows(profile: ArchiveProfile) {
  return profile.docChecks.map((item) => ({
    type: item.required ? '必备资料' : '补充资料',
    name: item.label,
    status: item.ok ? (profile.auditStatus === '待审核' ? '待审核' : '已归档') : '缺失',
  }))
}

type AiInsight = {
  key: string
  title: string
  level: 'high' | 'warning' | 'normal'
  value: string
  detail: string
  action?: string
}

function isEmergencyAsset(row: AssetArchiveDisplayRow) {
  return row.asset_name.includes('除颤') || row.department_name.includes('急诊') || row.is_critical_care
}

function metrologyArchiveStatus(row: AssetArchiveDisplayRow) {
  if (!row.is_metrology_device) return '未纳入'
  if (row.metrology_display === '已过期') return '超期'
  if (row.metrology_display === '即将到期') return '临期'
  return assetArchiveSeed(row.id) % 3 === 0 ? '本年度已检' : '正常'
}

function pmArchiveStatus(row: AssetArchiveDisplayRow) {
  const pmStatus = buildAssetTwinMetrics(row).pmStatus
  if (!row.is_critical_care && !row.is_large_equipment && assetArchiveSeed(row.id) % 11 === 0) return '无计划'
  if (pmStatus === '超时') return '逾期'
  if (pmStatus === '临近') return '临期'
  return '正常'
}

function sourceModuleText(row: AssetArchiveDisplayRow, profile: ArchiveProfile) {
  if (profile.filingSource === '采购流程转档案' || profile.filingSource === '验收入库建档') return '采购验收'
  if (profile.filingSource === '盘点补录' || profile.codeStatus !== '正常') return '盘点治理'
  if (profile.missing.some((item) => item.includes('PM'))) return 'PM闭环'
  if (profile.missing.includes('计量证书') || row.metrology_display !== '正常') return '计量监管'
  if (profile.missing.includes('维修记录')) return '维修管理'
  return '档案库'
}

function relatedDocumentRows(row: AssetArchiveDisplayRow, profile: ArchiveProfile) {
  const missing = new Set(profile.missing)
  const status = (label: string) => {
    const missingMatched =
      label === '说明书'
        ? missing.has('使用说明书') || missing.has('维修手册')
        : label === '附件'
          ? profile.attachmentStatus !== '完整'
          : label === '验收报告'
            ? missing.has('到货验收单') || missing.has('安装调试报告')
            : missing.has(label)
    if (missingMatched) return '缺'
    if (profile.auditStatus === '待审核') return '审'
    return '有'
  }
  return ['合同', '发票', '说明书', '注册证', '附件', '验收报告', '计量证书', 'PM记录'].map((label) => ({
    label,
    status: label === '计量证书' && !row.is_metrology_device ? '—' : status(label),
  }))
}

function documentCompleteness(row: AssetArchiveDisplayRow, profile: ArchiveProfile) {
  const docs = relatedDocumentRows(row, profile).filter((doc) => doc.status !== '—')
  const complete = docs.filter((doc) => doc.status === '有').length
  return { docs, complete, total: docs.length, percent: docs.length ? Math.round((complete / docs.length) * 100) : 100 }
}

function progressTooltipContent(profile: ArchiveProfile) {
  const completed = profile.docChecks.filter((item) => item.ok).map((item) => item.label)
  const missing = profile.docChecks.filter((item) => !item.ok).map((item) => item.label)
  return (
    <div className="asset-ledger-quality-tooltip">
      <strong>当前完整度 {profile.completeness}%</strong>
      <div>
        <span>已完成项</span>
        <p>{completed.length ? completed.slice(0, 8).map((item) => <em className="ok" key={item}>✓ {item}</em>) : <em className="muted">暂无</em>}</p>
      </div>
      <div>
        <span>缺失项</span>
        <p>{missing.length ? missing.slice(0, 8).map((item) => <em className="missing" key={item}>✗ {item}</em>) : <em className="ok">✓ 无缺失</em>}</p>
      </div>
    </div>
  )
}

function completenessTone(percent: number) {
  if (percent < 70) return 'danger'
  if (percent < 90) return 'warning'
  return 'success'
}

function completenessColor(percent: number) {
  if (percent < 70) return '#E24B4A'
  if (percent < 90) return '#EF9F27'
  return '#639922'
}

function Sparkline({ values, tone }: { values: number[]; tone: string }) {
  const color = tone === 'danger' ? '#E24B4A' : tone === 'warning' ? '#EF9F27' : tone === 'success' ? '#639922' : '#1677ff'
  const option = useMemo(
    () => ({
      animation: false,
      grid: { left: 0, right: 0, top: 3, bottom: 2 },
      xAxis: { type: 'category' as const, show: false, boundaryGap: false, data: values.map((_, index) => index) },
      yAxis: { type: 'value' as const, show: false, min: 'dataMin', max: 'dataMax' },
      tooltip: { show: false },
      series: [
        {
          type: 'line' as const,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.8, color },
          areaStyle: { opacity: 0 },
          data: values,
        },
      ],
    }),
    [color, values],
  )
  return <ReactECharts className="asset-ledger-sparkline" option={option} style={{ height: 28, width: 70 }} notMerge lazyUpdate opts={{ renderer: 'svg' }} autoResize={false} />
}

function modelArchiveForRow(row: AssetArchiveDisplayRow) {
  if (row.asset_name.includes('监护') || row.spec_model.includes('BeneVision')) return modelArchiveProfiles[0]!
  if (row.asset_name.includes('MRI') || row.spec_model.includes('Avanto')) return modelArchiveProfiles[1]!
  if (row.asset_name.includes('腹腔镜') || row.asset_name.includes('内镜') || row.spec_model.includes('CV-290')) return modelArchiveProfiles[2]!
  return {
    key: `${row.brand_vendor}-${row.spec_model}`,
    brand: row.brand_vendor,
    model: row.spec_model,
    commonDocs: ['说明书', '注册证', '合格证', '维护规范'],
    inheritedCount: assetArchiveSeed(row.id) % 9 + 1,
    registrationNo: row.registration_no ?? '待维护',
    maintenanceSpec: `${row.spec_model} 维护规范`,
  } satisfies ModelArchiveProfile
}

function projectArchiveForRow(row: AssetArchiveDisplayRow) {
  if (row.asset_name.includes('监护') || row.spec_model.includes('BeneVision')) return projectArchiveProfiles[0]!
  if (row.asset_name.includes('腹腔镜') || row.asset_name.includes('内镜') || row.spec_model.includes('CV-290')) return projectArchiveProfiles[1]!
  if (row.asset_name.includes('MRI') || row.spec_model.includes('Avanto')) return projectArchiveProfiles[2]!
  return {
    key: `proj-${row.id}`,
    name: `${row.department_name}${row.asset_name}采购项目`,
    contractNo: archiveContractRows(row)[0]?.contract_no ?? `HT-${formatArchiveAssetCode(row.asset_code, row.id).slice(-6)}`,
    supplier: archiveContractRows(row)[0]?.supplier ?? row.supplier_demo_name,
    amount: moneyCn(row.original_value),
    quantity: 1,
    status: '已归集',
    linkedModel: row.spec_model,
  } satisfies ProjectArchiveProfile
}

function isKitArchiveRow(row: AssetArchiveDisplayRow) {
  return row.asset_name.includes('腹腔镜') || row.asset_name.includes('内镜') || row.spec_model.includes('CV-290')
}

function structureSummaryForRow(row: AssetArchiveDisplayRow) {
  const model = modelArchiveForRow(row)
  if (isKitArchiveRow(row)) {
    return {
      mode: '成套设备',
      inheritedDocs: model.commonDocs.length,
      ownDocs: 7,
      components: laparoscopeComponents.length,
      title: '设备系统',
    }
  }
  return {
    mode: model.inheritedCount > 1 ? '批量同型号' : '单台设备',
    inheritedDocs: model.commonDocs.length,
    ownDocs: 8,
    components: 0,
    title: '设备',
  }
}

function openModeTitle(mode: SmartArchiveMode) {
  const titles: Record<SmartArchiveMode, string> = {
    inbox: 'AI资料收件箱',
    nameplate: '批量铭牌识别建档',
    kit: '成套设备建档',
    template: '设备包模板',
    model: '型号资料库',
    component: '附件/组件管理',
    confirm: '智能归档确认',
    duplicate: '重复档案校验',
  }
  return titles[mode]
}

function checklistMeta(key: string, rows: AssetArchiveDisplayRow[]) {
  const matchers: Record<string, { title: string; scope: string; owner: string; match: (row: AssetArchiveDisplayRow) => boolean }> = {
    meter: { title: '计量检测清单', scope: '计量监管模块：年度检定计划 / 检定批次管理 / 证书批量归档', owner: '计量管理员', match: (row) => row.is_metrology_device && (row.metrology_display === '即将到期' || row.metrology_display === '已过期') },
    pm: { title: 'PM保养清单', scope: 'PM闭环模块：年度计划 / 月度任务 / 科室或责任工程师批量执行', owner: 'PM管理员', match: (row) => pmArchiveStatus(row) === '临期' || pmArchiveStatus(row) === '逾期' },
    missing: { title: '档案缺项清单', scope: '档案质量治理：按资料类型和责任模块分派补齐', owner: '档案管理员', match: (row) => buildArchiveProfile(row).missing.length > 0 },
    attachment: { title: '附件缺失清单', scope: '附件中心：合同、发票、验收、证照、PM、维修附件批量归档', owner: '档案管理员', match: (row) => buildArchiveProfile(row).attachmentStatus !== '完整' },
    risk: { title: '高风险设备清单', scope: '风险监管：生命支持、急救、高风险设备重点关注', owner: '设备科主任', match: (row) => row.risk_display === '高风险' },
    large: { title: '大型设备监管清单', scope: '大型设备监管：配置许可、效益分析、更新论证', owner: '大型设备管理员', match: (row) => row.is_large_equipment },
    department: { title: '科室设备台账', scope: '科室资产盘点：按使用科室汇总设备主档案', owner: '科室设备管理员', match: () => true },
    renewal: { title: '报废更新论证清单', scope: '更新报废模块：年限、维修成本、停机风险和效益情况综合论证', owner: '资产管理员', match: (row) => buildAssetTwinMetrics(row).serviceAgeYears >= 8 || buildAssetTwinMetrics(row).lifecycleStage === '待报废' },
  }
  const meta = matchers[key] ?? matchers.missing
  const items = rows.filter(meta.match)
  return { ...meta, items }
}

function buildAiInsights(rows: AssetArchiveDisplayRow[]): AiInsight[] {
  const issueRows = rows.map((row) => {
    const profile = buildArchiveProfile(row)
    const metrics = buildAssetTwinMetrics(row)
    const critical = criticalMissingDocs(row, profile)
    return { row, profile, metrics, critical }
  })
  const highRisk = issueRows.filter(({ row, profile, metrics, critical }) =>
    (row.risk_display === '高风险' && (row.metrology_display === '已过期' || critical.length > 0)) ||
    (row.is_critical_care && (metrics.pmStatus === '超时' || profile.missing.includes('PM记录'))),
  )
  const mediumRisk = issueRows.filter(({ row, profile }) =>
    row.is_large_equipment && (profile.missing.includes('效益分析') || profile.missing.includes('配置许可')),
  )
  const governance = issueRows.filter(({ profile }) => profile.codeStatus !== '正常' || profile.duplicateSuspected)
  const missingMaterials = issueRows.filter(({ profile }) => profile.missing.length)
  const attachmentIssues = issueRows.filter(({ profile }) => profile.attachmentStatus !== '完整')
  const codeIssues = issueRows.filter(({ profile }) => profile.codeStatus !== '正常' || profile.duplicateSuspected)
  const dateIssues = issueRows.filter(({ row }) => dayjs(row.purchase_display).isAfter(dayjs(row.install_display)))
  const meterIssues = issueRows.filter(({ row }) => row.metrology_display === '即将到期' || row.metrology_display === '已过期')
  const pmIssues = issueRows.filter(({ metrics }) => metrics.pmStatus === '超时')
  const largeNoBenefit = issueRows.filter(({ row, profile }) => row.is_large_equipment && profile.missing.includes('效益分析'))
  const lifeNoPm = issueRows.filter(({ row, profile, metrics }) => row.is_critical_care && (profile.missing.includes('PM记录') || metrics.pmStatus === '超时'))

  return [
    {
      key: 'health',
      title: 'AI档案体检',
      level: highRisk.length ? 'high' : 'normal',
      value: `${missingMaterials.length} 台需补档`,
      detail: '依据档案完整度、关键资料缺失、审核状态和附件状态综合判断。',
      action: missingMaterials.length ? '建议生成档案缺项清单或附件缺失清单，按关键资料优先级集中治理。' : '建议保持月度抽检。',
    },
    {
      key: 'risk',
      title: 'AI风险扫描',
      level: highRisk.length ? 'high' : mediumRisk.length ? 'warning' : 'normal',
      value: `${highRisk.length} 个高风险`,
      detail: '重点识别高风险设备计量超期、生命支持设备缺PM记录、大型设备缺效益分析。',
      action: highRisk.length ? '建议生成高风险设备清单，交由风险监管流程跟踪。' : '建议纳入常规监管。',
    },
    {
      key: 'governance',
      title: 'AI主数据治理',
      level: governance.length ? 'warning' : 'normal',
      value: `${governance.length} 项异常`,
      detail: '依据编码状态、疑似重复档案、品牌型号与分类字段规范性生成治理建议。',
      action: governance.length ? '建议生成主数据治理清单，按科室和编码规则集中复核。' : '主数据状态良好。',
    },
    {
      key: 'materials',
      title: '缺失资料',
      level: missingMaterials.some(({ critical }) => critical.length) ? 'high' : missingMaterials.length ? 'warning' : 'normal',
      value: `${missingMaterials.length} 台`,
      detail: missingMaterials.length ? missingMaterials.slice(0, 3).map(({ row, profile }) => `${row.asset_name}：${profile.missing.slice(0, 3).join('、')}`).join('；') : '当前列表未发现缺失资料。',
      action: '建议生成档案缺项清单，按资料类型和来源模块分组治理。',
    },
    {
      key: 'attachments',
      title: '附件异常',
      level: attachmentIssues.length ? 'warning' : 'normal',
      value: `${attachmentIssues.length} 台`,
      detail: attachmentIssues.length ? '存在部分缺失或无附件档案，需上传后触发完整度重算。' : '附件状态均为完整。',
      action: '建议生成附件缺失清单，交由附件中心批量归档。',
    },
    {
      key: 'code',
      title: '编码异常',
      level: codeIssues.length ? 'warning' : 'normal',
      value: `${codeIssues.length} 台`,
      detail: codeIssues.length ? '发现重复、缺失或规则不符编码，盘点补录设备需重点复核。' : '编码规则正常。',
      action: '建议生成主数据治理清单，由主数据管理员复核院内设备编号和一机一码绑定。',
    },
    {
      key: 'date',
      title: '日期逻辑异常',
      level: dateIssues.length ? 'warning' : 'normal',
      value: `${dateIssues.length} 台`,
      detail: dateIssues.length ? '存在购置日期晚于启用日期等逻辑异常。' : '采购、验收、启用日期逻辑未见异常。',
      action: '建议比对采购合同、验收入库单和科室启用确认。',
    },
    {
      key: 'meter',
      title: '计量临期/超期',
      level: issueRows.some(({ row }) => row.metrology_display === '已过期') ? 'high' : meterIssues.length ? 'warning' : 'normal',
      value: `${meterIssues.length} 台`,
      detail: meterIssues.length ? '存在计量即将到期或已过期设备，急救/生命支持设备优先处理。' : '当前列表计量状态正常或不适用。',
      action: '建议生成计量检测清单，后续进入计量监管模块批次处理。',
    },
    {
      key: 'pm',
      title: 'PM逾期',
      level: lifeNoPm.length ? 'high' : pmIssues.length ? 'warning' : 'normal',
      value: `${pmIssues.length} 台`,
      detail: pmIssues.length ? '存在PM计划超时未完成或记录未回写。' : 'PM状态正常。',
      action: '建议生成PM保养清单，后续进入PM闭环模块按计划执行。',
    },
    {
      key: 'large-benefit',
      title: '大型设备缺效益分析',
      level: largeNoBenefit.length ? 'warning' : 'normal',
      value: `${largeNoBenefit.length} 台`,
      detail: largeNoBenefit.length ? '大型设备档案存在效益分析资料缺失。' : '大型设备效益资料齐备或当前列表无此问题。',
      action: '建议生成大型设备监管清单，关联设备使用率、维修成本和ROI分析报告。',
    },
    {
      key: 'life-pm',
      title: '生命支持类设备缺PM记录',
      level: lifeNoPm.length ? 'high' : 'normal',
      value: `${lifeNoPm.length} 台`,
      detail: lifeNoPm.length ? '生命支持类设备存在PM记录缺失或PM逾期，直接影响风险监管。' : '生命支持类设备PM记录未见异常。',
      action: '建议生成高风险生命支持设备关注清单，并纳入急救设备完好率监管。',
    },
  ]
}

function buildDeviceAiSuggestions(row: AssetArchiveDisplayRow, profile: ArchiveProfile, metrics: ReturnType<typeof buildAssetTwinMetrics>) {
  const critical = criticalMissingDocs(row, profile)
  const missingText = profile.missing.length ? `缺少${profile.missing.slice(0, 4).join('、')}` : '关键资料完整'
  const riskBasis = [
    row.risk_display === '高风险' ? '高风险设备' : '',
    row.metrology_display !== '正常' && row.metrology_display !== '不适用' ? `计量${row.metrology_display}` : '',
    metrics.pmStatus !== '正常' ? `PM${metrics.pmStatus}` : '',
    profile.attachmentStatus !== '完整' ? `附件${profile.attachmentStatus}` : '',
    metrics.serviceAgeYears >= 8 ? '达到更新论证年限' : '',
  ].filter(Boolean).join('，') || '未触发高风险规则'
  return [
    {
      title: 'AI摘要',
      text: `该设备为${row.brand_vendor} ${row.spec_model} ${row.asset_name}，${row.department_name}${row.run_display}，${row.is_large_equipment ? '大型设备，' : ''}${row.is_critical_care ? '生命支持类设备，' : ''}档案完整度${profile.completeness}%。当前计量状态${row.metrology_display}，PM状态${metrics.pmStatus}，${missingText}。`,
      basis: '依据设备状态、档案完整度、缺失资料与最近更新时间生成。',
    },
    {
      title: 'AI补档建议',
      text: profile.missing.length ? `当前档案完整度${profile.completeness}%，建议优先上传${(critical.length ? critical : profile.missing).slice(0, 4).join('、')}，上传后自动重新计算完整度并刷新快捷视图。` : '当前档案完整度已满足要求，建议维持季度复核。',
      basis: '依据必填资料权重、关键资料清单和设备监管属性判断优先级。',
    },
    {
      title: 'AI风险分析',
      text: riskBasis.includes('未触发') ? '当前未发现高优先级风险。' : `当前风险依据：${riskBasis}。建议纳入相应治理清单，由业务模块按计划闭环。`,
      basis: '依据生命支持、高风险、计量状态、PM状态、附件缺失、日期逻辑和使用年限交叉识别。',
    },
    {
      title: 'AI生命周期建议',
      text: metrics.serviceAgeYears >= 8 ? '使用年限较长，建议进入更新论证或报废评估池。' : '生命周期状态正常，建议持续维护档案变更记录。',
      basis: '依据使用年限、维修次数、生命周期阶段与当前状态判断。',
    },
  ]
}

function buildGovernanceIssues(rows: AssetArchiveDisplayRow[]) {
  const count = (fn: (row: AssetArchiveDisplayRow) => boolean) => rows.filter(fn).length
  return [
    { title: '档案缺项治理', count: count((row) => buildArchiveProfile(row).status === '档案缺项'), owner: '医学装备科', priority: '高' },
    { title: '附件缺失治理', count: count((row) => buildArchiveProfile(row).attachmentStatus !== '完整'), owner: '档案管理员', priority: '高' },
    { title: '编码异常治理', count: count((row) => buildArchiveProfile(row).codeStatus !== '正常'), owner: '主数据管理员', priority: '中' },
    { title: '重复档案治理', count: count((row) => buildArchiveProfile(row).duplicateSuspected), owner: '主数据管理员', priority: '中' },
    { title: '状态不一致治理', count: count((row) => row.run_display === '报废' && buildAssetTwinMetrics(row).lifecycleStage !== '已报废'), owner: '设备科', priority: '中' },
    { title: '长期未更新档案', count: count((row) => dayjs().diff(dayjs(buildArchiveProfile(row).updatedDate), 'day') > 60), owner: '责任工程师', priority: '中' },
    { title: '高风险设备无责任人', count: count((row) => row.risk_display === '高风险' && !buildArchiveProfile(row).engineer), owner: '设备科主任', priority: '高' },
    { title: '计量过期仍在用', count: count((row) => row.metrology_display === '已过期' && row.run_display === '在用'), owner: '计量管理员', priority: '高' },
    { title: 'PM逾期仍在用', count: count((row) => buildAssetTwinMetrics(row).pmStatus === '超时' && row.run_display === '在用'), owner: 'PM管理员', priority: '高' },
    { title: '已报废但未归档处置资料', count: count((row) => buildAssetTwinMetrics(row).lifecycleStage === '已报废' && buildArchiveProfile(row).missing.includes('报废资料')), owner: '资产管理员', priority: '高' },
  ]
}

function buildLifecycleNodesForAction(row: AssetArchiveDisplayRow, source: FilingSource, status: ArchiveStatus): ArchiveLifecycleNode[] {
  const seed = assetArchiveSeed(row.id)
  const handler = source === '盘点补录' ? '盘点管理员' : source === '验收入库建档' ? '验收小组' : source === '单台建档' ? '档案管理员' : '采购办'
  const purchase = dayjs(row.purchase_display)
  const install = dayjs(row.install_display)
  const d = (base: Dayjs, offset: number) => (base.isValid() ? base.add(offset, 'day').format('YYYY-MM-DD') : dayjs().add(offset, 'day').format('YYYY-MM-DD'))
  if (source === '单台建档') {
    return [
      { title: '档案草稿', time: dayjs().format('YYYY-MM-DD'), handler, document: formatArchiveAssetCode(row.asset_code, row.id), status: '待处理', source: '档案库新建单台' },
      { title: '项目资料补齐', time: '待补齐', handler: '档案管理员', document: '项目/合同/验收资料', status: '待处理', source: '附件资料页' },
      { title: '型号资料继承', time: '待匹配', handler: '型号资料库', document: row.spec_model, status: '待处理', source: '型号资料库' },
      { title: '本机资料确认', time: '待确认', handler: row.department_name, document: row.serial_number ?? 'SN待维护', status: '待处理', source: '铭牌/OCR/科室确认' },
      { title: '当前状态', time: dayjs().format('YYYY-MM-DD'), handler: '医学装备科', document: formatArchiveAssetCode(row.asset_code, row.id), status: status === '已建档' || status === '已归档' ? '已完成' : '待处理', source: '档案状态自动更新' },
    ]
  }
  const completed: ArchiveLifecycleNode[] = [
    { title: '采购申请', time: d(purchase, -65), handler, document: `CGSQ-${String(seed).slice(-6)}`, status: source === '盘点补录' ? '可追溯' : '已完成', source: source === '盘点补录' ? '历史资料补录' : '采购申请单' },
    { title: '合同签订', time: d(purchase, -25), handler: '采购办', document: archiveContractRows(row)[0]?.contract_no ?? `HT-${String(seed).slice(-6)}`, status: source === '盘点补录' ? '可追溯' : '已完成', source: '合同系统' },
    { title: '验收入库', time: d(purchase, 0), handler: '验收小组', document: archiveContractRows(row)[0]?.acceptance_no ?? `YS-${String(seed).slice(-6)}`, status: '已完成', source: '验收单/入库单/验收照片' },
    { title: '启用', time: install.isValid() ? install.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'), handler: row.department_name, document: `QY-${String(seed).slice(-6)}`, status: status === '待建档' ? '待处理' : '已完成', source: '科室启用确认' },
    { title: '首次PM', time: d(install, 96), handler: 'PM管理员', document: `PM-${String(seed).slice(-6)}`, status: '可追溯', source: 'PM计划' },
    { title: '最近维修', time: buildArchiveProfile(row).recentRepairDate, handler: '维修工程师', document: `WX-${String(seed).slice(-6)}`, status: '可追溯', source: '维修工单' },
    { title: '最近计量', time: row.is_metrology_device ? d(install, 320) : '不适用', handler: '计量管理员', document: `JL-${String(seed).slice(-6)}`, status: row.is_metrology_device ? '可追溯' : '未触发', source: row.is_metrology_device ? '计量证书' : '设备属性' },
    { title: '当前状态', time: dayjs().format('YYYY-MM-DD'), handler: '医学装备科', document: formatArchiveAssetCode(row.asset_code, row.id), status: '已完成', source: '档案状态自动更新' },
    { title: '报废申请', time: buildAssetTwinMetrics(row).serviceAgeYears >= 8 ? dayjs().subtract(18, 'day').format('YYYY-MM-DD') : '未触发', handler: '资产管理员', document: `BF-${String(seed).slice(-6)}`, status: buildAssetTwinMetrics(row).serviceAgeYears >= 8 ? '待处理' : '未触发', source: '更新报废流程' },
    { title: '报废审批', time: '未触发', handler: '审批流', document: `BFSP-${String(seed).slice(-6)}`, status: '未触发', source: '审批流' },
    { title: '报废完成', time: '未触发', handler: '资产管理员', document: `BFWC-${String(seed).slice(-6)}`, status: '未触发', source: '资产处置单' },
  ]
  return completed
}

function buildRectificationTasks(row: AssetArchiveDisplayRow, reason = 'AI档案体检'): ArchiveRectificationTask[] {
  const profile = buildArchiveProfile(row)
  const metrics = buildAssetTwinMetrics(row)
  const tasks: ArchiveRectificationTask[] = []
  const push = (title: string, owner: string, days: number, source: string) => {
    tasks.push({
      id: `${row.id}-${tasks.length + 1}`,
      title,
      owner,
      due: dayjs().add(days, 'day').format('YYYY-MM-DD'),
      status: '待处理',
      source,
    })
  }
  if (profile.missing.length) push(`补齐档案资料：${profile.missing.slice(0, 4).join('、')}`, profile.engineer, criticalMissingDocs(row, profile).length ? 3 : 7, reason)
  if (profile.attachmentStatus !== '完整') push('上传缺失附件并复核文件来源', '档案管理员', 5, reason)
  if (profile.codeStatus !== '正常' || profile.duplicateSuspected) push('复核编码规则并处理疑似重复档案', '主数据管理员', 4, '盘点重复校验')
  if (metrics.pmStatus === '超时') push('纳入PM保养清单并回写最近一次PM记录', 'PM管理员', 2, 'PM逾期识别')
  if (row.metrology_display === '即将到期' || row.metrology_display === '已过期') push('纳入计量检测清单并批量归档证书', '计量管理员', row.metrology_display === '已过期' ? 1 : 10, '计量到期识别')
  if (metrics.serviceAgeYears >= 8) push('提交更新论证或报废评估资料', '资产管理员', 14, '生命周期年限规则')
  return tasks
}

function buildArchivePatch(row: AssetArchiveDisplayRow, source: FilingSource, mode: 'draft' | 'formal' | 'supplement' | 'reviewed'): ArchiveRuntime {
  const base = buildArchiveProfile(row)
  const missing =
    mode === 'formal'
      ? base.missing.filter((item) => !['采购申请资料', '合同', '发票', '到货验收单', '安装调试报告', '注册证', '合格证'].includes(item))
      : mode === 'reviewed'
        ? base.missing.filter((item) => item !== '批量入库清单')
        : base.missing
  const nextChecks = applyMissingToChecks(base.docChecks, missing)
  const scoredCompleteness = scoreDocChecks(nextChecks)
  const completeness = missing.length ? Math.min(94, scoredCompleteness) : 100
  const attachmentStatus: AttachmentStatus = missing.length >= 5 ? '无附件' : missing.some((x) => ['合同', '发票', '到货验收单', '计量证书', '注册证'].includes(x)) ? '部分缺失' : '完整'
  const auditStatus: AuditStatus =
    source === '盘点补录' && mode !== 'reviewed'
      ? '待审核'
      : mode === 'draft'
        ? '草稿'
        : '已审核'
  const status: ArchiveStatus =
    mode === 'draft'
      ? '档案草稿'
      : auditStatus === '待审核'
        ? '待审核'
        : missing.length
          ? attachmentStatus !== '完整'
            ? '附件缺失'
            : '待补资料'
          : '已建档'
  return {
    status,
    completeness,
    missing,
    docChecks: nextChecks,
    filingSource: source,
    auditStatus,
    attachmentStatus,
    codeStatus: mode === 'reviewed' ? '正常' : base.codeStatus,
    duplicateSuspected: mode === 'reviewed' ? false : base.duplicateSuspected,
    updatedDate: dayjs().format('YYYY-MM-DD'),
    lifecycleNodes: buildLifecycleNodesForAction(row, source, status),
    contract: {
      ...archiveContractRows(row)[0],
      acceptance_no: `YSRK-${formatArchiveAssetCode(row.asset_code, row.id).slice(-4)}`,
      acceptance_date: row.purchase_display,
      enable_date: row.install_display,
    },
  }
}

function FilingSourceModal({
  rows,
  open,
  initialSource,
  onClose,
  onConfirm,
}: {
  rows: AssetArchiveDisplayRow[]
  open: boolean
  initialSource: FilingSource
  onClose: () => void
  onConfirm: (row: AssetArchiveDisplayRow, source: FilingSource, mode: 'draft' | 'formal' | 'supplement' | 'reviewed', reason?: string) => void
}) {
  const [source, setSource] = useState<FilingSource>(initialSource)
  const [assetId, setAssetId] = useState<string>()
  const [reason, setReason] = useState('盘点发现历史设备未纳入系统档案，需补录并审核')

  useEffect(() => {
    if (!open) return
    setSource(initialSource)
    const preferred = rows.find((row) => {
      const profile = buildArchiveProfile(row)
      if (initialSource === '单台建档') return profile.status === '待建档' || profile.status === '档案草稿'
      if (initialSource === '采购流程转档案') return profile.status === '待建档' || row.asset_name.includes('CT')
      if (initialSource === '验收入库建档') return profile.attachmentStatus !== '完整' || profile.status === '档案草稿'
      if (initialSource === '盘点补录') return profile.filingSource === '盘点补录' || profile.codeStatus !== '正常'
      return true
    }) ?? rows[0]
    setAssetId(preferred?.id)
  }, [initialSource, open, rows])

  const selected = rows.find((row) => row.id === assetId) ?? rows[0]
  const profile = selected ? buildArchiveProfile(selected) : null
  const contract = selected ? archiveContractRows(selected)[0] : null
  const mode: 'draft' | 'formal' | 'supplement' | 'reviewed' =
    source === '盘点补录'
      ? 'supplement'
      : source === '单台建档'
        ? 'draft'
      : source === '采购流程转档案'
        ? profile?.status === '待建档'
          ? 'formal'
          : 'draft'
        : 'formal'
  const sources: Array<{ title: FilingSource; desc: string }> = [
    { title: '单台建档', desc: '适用于CT、MRI、彩超、麻醉机等单台设备，先生成档案草稿后补齐资料。' },
    { title: '采购流程转档案', desc: '从已完成采购/验收设备自动生成档案草稿，确认后转正式档案。' },
    { title: '验收入库建档', desc: '验收完成设备一键建档，关联验收单、照片、证照和注册证附件。' },
    { title: '历史台账导入', desc: '从Excel或旧系统导入存量设备档案。' },
    { title: '盘点补录', desc: '用于历史设备或漏建档设备补录，默认进入待审核。' },
    { title: '维修触发建档', desc: '报修过程中发现无档案设备，由维修工单触发建档。' },
    { title: 'AI识别草稿', desc: '通过发票、合同、验收单、图片或铭牌识别自动生成档案草稿。' },
  ]
  return (
    <Modal
      title="建档流程演示"
      open={open}
      onCancel={onClose}
      onOk={() => {
        if (selected) onConfirm(selected, source, mode, source === '盘点补录' ? reason : undefined)
      }}
      okText={source === '盘点补录' ? '提交补录审核' : source === '单台建档' ? '生成单台草稿' : '确认生成档案'}
      width={980}
      destroyOnHidden
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div className="asset-ledger-source-grid">
          {sources.map((item) => (
            <button type="button" key={item.title} className={`asset-ledger-source-card ${source === item.title ? 'active' : ''}`} onClick={() => setSource(item.title)}>
              <FileDoneOutlined />
              <strong>{item.title}</strong>
              <span>{item.desc}</span>
            </button>
          ))}
        </div>
        <Form layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="选择业务来源设备">
                <Select
                  value={assetId}
                  showSearch
                  optionFilterProp="label"
                  options={rows.map((row) => ({
                    label: `${row.asset_name} / ${row.department_name} / ${formatArchiveAssetCode(row.asset_code, row.id)}`,
                    value: row.id,
                  }))}
                  onChange={setAssetId}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="补录原因（盘点补录必填）">
                <Input value={reason} disabled={source !== '盘点补录'} onChange={(e) => setReason(e.target.value)} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        {selected && profile && contract ? (
          <div className="asset-ledger-flow-preview">
            <Alert
              type={profile.duplicateSuspected || profile.codeStatus !== '正常' ? 'warning' : 'info'}
              showIcon
              message={source === '盘点补录' ? '已执行疑似重复校验' : source === '单台建档' ? '将生成单台档案草稿' : '将自动带出采购/验收字段'}
              description={source === '盘点补录' ? `按设备名称、型号、序列号校验：${profile.duplicateSuspected || profile.codeStatus !== '正常' ? '发现疑似重复或编码异常，需审核确认。' : '未发现重复。'}` : source === '单台建档' ? '确认后进入档案草稿，可在详情抽屉补齐项目、型号、本机和组件资料。' : '确认后将写入正式档案或待补资料状态，并自动增加采购申请、合同签订、验收入库、启用等生命周期节点。'}
            />
            <Descriptions bordered size="small" column={3}>
              <Descriptions.Item label="设备名称">{selected.asset_name}</Descriptions.Item>
              <Descriptions.Item label="品牌">{selected.brand_vendor}</Descriptions.Item>
              <Descriptions.Item label="型号">{selected.spec_model}</Descriptions.Item>
              <Descriptions.Item label="序列号">{selected.serial_number}</Descriptions.Item>
              <Descriptions.Item label="使用科室">{selected.department_name}</Descriptions.Item>
              <Descriptions.Item label="供应商">{selected.supplier_demo_name}</Descriptions.Item>
              <Descriptions.Item label="合同编号">{contract.contract_no}</Descriptions.Item>
              <Descriptions.Item label="验收日期">{selected.purchase_display}</Descriptions.Item>
              <Descriptions.Item label="启用日期">{selected.install_display}</Descriptions.Item>
              <Descriptions.Item label="当前档案状态"><Tag color={archiveStatusColor(profile.status)}>{profile.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="确认后状态"><Tag color="blue">{source === '盘点补录' ? '待审核' : source === '单台建档' ? '档案草稿' : profile.missing.length ? '待补资料/附件缺失' : '已建档'}</Tag></Descriptions.Item>
              <Descriptions.Item label="完整度">{profile.completeness}%</Descriptions.Item>
            </Descriptions>
          </div>
        ) : null}
      </Space>
    </Modal>
  )
}

function GovernanceModal({
  rows,
  open,
  onClose,
}: {
  rows: AssetArchiveDisplayRow[]
  open: boolean
  onClose: () => void
}) {
  return (
    <Modal title="档案质量治理" open={open} onCancel={onClose} footer={null} width={980} destroyOnHidden>
      <Table
        size="small"
        pagination={false}
        rowKey="title"
        dataSource={buildGovernanceIssues(rows)}
        columns={[
          {
            title: '问题清单',
            dataIndex: 'title',
            render: (value: string) => (
              <Space>
                <AuditOutlined />
                <Text strong>{value}</Text>
              </Space>
            ),
          },
          { title: '问题数', dataIndex: 'count', width: 90, render: (value: number) => <Badge count={value} overflowCount={999} /> },
          { title: '责任角色', dataIndex: 'owner', width: 140 },
          {
            title: '优先级',
            dataIndex: 'priority',
            width: 90,
            render: (value: string) => <Tag color={value === '高' ? 'red' : 'gold'}>{value}</Tag>,
          },
          {
            title: '处理动作',
            width: 150,
            render: () => <Button size="small">纳入治理清单</Button>,
          },
        ]}
      />
    </Modal>
  )
}

function SmartArchiveModal({
  mode,
  open,
  onClose,
  onModeChange,
}: {
  mode: SmartArchiveMode
  open: boolean
  onClose: () => void
  onModeChange: (mode: SmartArchiveMode) => void
}) {
  const { message } = App.useApp()
  const modeTitle = openModeTitle(mode)
  const confidenceTag = (value: number) => <Tag color={value >= 95 ? 'green' : value >= 90 ? 'blue' : 'gold'}>{value}%</Tag>
  const yesNo = (value: boolean) => <Tag color={value ? 'blue' : 'default'}>{value ? '是' : '否'}</Tag>

  return (
    <Modal
      title={modeTitle}
      open={open}
      onCancel={onClose}
      width={1080}
      destroyOnHidden
      footer={[
        <Button key="close" onClick={onClose}>关闭</Button>,
        <Button key="confirm" type="primary" icon={<SafetyCertificateOutlined />} onClick={() => message.success(`${modeTitle}已进入人工确认队列`)}>
          提交人工确认
        </Button>,
      ]}
    >
      <div className="asset-ledger-smart-modal">
        <div className="asset-ledger-smart-mode-tabs">
          {(['inbox', 'nameplate', 'kit', 'template', 'model', 'component', 'confirm', 'duplicate'] as SmartArchiveMode[]).map((item) => (
            <button type="button" key={item} className={mode === item ? 'active' : ''} onClick={() => onModeChange(item)}>
              {openModeTitle(item)}
            </button>
          ))}
        </div>

        {mode === 'inbox' ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Upload.Dragger multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip" beforeUpload={() => false} showUploadList={false}>
              <p className="ant-upload-drag-icon"><FileSearchOutlined /></p>
              <p className="ant-upload-text">上传PDF、Word、Excel、图片或zip包，先进入AI资料收件箱</p>
              <p className="ant-upload-hint">AI识别文档类型、抽取关键字段，并建议归档到项目/型号/单机/组件/附件档案。</p>
            </Upload.Dragger>
            <Table<AiInboxDocument>
              size="small"
              rowKey="id"
              dataSource={aiInboxDocuments}
              pagination={false}
              columns={[
                { title: '文件', dataIndex: 'file', width: 220 },
                { title: '识别类型', dataIndex: 'type', width: 100, render: (value: string) => <Tag color="blue">{value}</Tag> },
                { title: '置信度', dataIndex: 'confidence', width: 90, render: confidenceTag },
                { title: '抽取结果', dataIndex: 'extracted' },
                { title: '建议归档位置', dataIndex: 'target', width: 260 },
                { title: '状态', dataIndex: 'status', width: 120, render: (value: string) => <Tag color={value.includes('待') || value.includes('需') ? 'gold' : 'green'}>{value}</Tag> },
              ]}
            />
          </Space>
        ) : null}

        {mode === 'nameplate' ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="批量铭牌识别建档流程"
              description="上传铭牌照片或zip包后，AI/OCR识别品牌、型号、序列号、生产日期、注册证号，自动匹配采购项目和型号档案；人工确认后批量生成设备编号、二维码，并通过表格分配科室、地点和责任工程师。"
            />
            <div className="asset-ledger-process-strip">
              {['上传照片/zip', 'OCR识别字段', '匹配项目与型号', '重复序列号校验', '批量编号/二维码', '人工确认建档'].map((item, index) => (
                <span key={item}><em>{index + 1}</em>{item}</span>
              ))}
            </div>
            <Table<NameplateRecognitionRow>
              size="small"
              rowKey="id"
              dataSource={nameplateRecognitionRows}
              pagination={false}
              columns={[
                { title: '铭牌照片', dataIndex: 'file', width: 120 },
                { title: '品牌', dataIndex: 'brand', width: 80 },
                { title: '型号', dataIndex: 'model', width: 140 },
                { title: '序列号', dataIndex: 'serial', width: 130 },
                { title: '生产日期', dataIndex: 'productionDate', width: 110 },
                { title: '注册证号', dataIndex: 'registrationNo', width: 170 },
                { title: '使用科室/地点', width: 180, render: (_, row) => `${row.department} / ${row.location}` },
                { title: '责任工程师', dataIndex: 'engineer', width: 150 },
                { title: '重复校验', dataIndex: 'duplicateRisk', width: 150, render: (value: string) => <Tag color={value.includes('疑似') ? 'gold' : 'green'}>{value}</Tag> },
                { title: '置信度', dataIndex: 'confidence', width: 90, render: confidenceTag },
              ]}
            />
          </Space>
        ) : null}

        {mode === 'kit' ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="奥林巴斯腹腔镜系统成套建档示例"
              description="系统主档案保留一套设备关系；图像处理主机、冷光源、CCD手柄、显示器、镜头、气腹机、电刀等组件可单独编号、维修、质控或归档。"
            />
            <Descriptions bordered size="small" column={3}>
              <Descriptions.Item label="系统主档案">奥林巴斯腹腔镜系统</Descriptions.Item>
              <Descriptions.Item label="采购项目">外科中心腹腔镜系统采购项目</Descriptions.Item>
              <Descriptions.Item label="发票口径">一套</Descriptions.Item>
              <Descriptions.Item label="系统级资料">合同、验收总表、装箱单、系统说明书</Descriptions.Item>
              <Descriptions.Item label="组件数量">{laparoscopeComponents.length}</Descriptions.Item>
              <Descriptions.Item label="结构状态">待人工确认后正式入档</Descriptions.Item>
            </Descriptions>
            <Table<KitComponent>
              size="small"
              rowKey={(row) => row.name}
              dataSource={laparoscopeComponents}
              pagination={{ pageSize: 6 }}
              columns={[
                { title: '组件名称', dataIndex: 'name', width: 130 },
                { title: '品牌', dataIndex: 'brand', width: 90 },
                { title: '型号', dataIndex: 'model', width: 130 },
                { title: '序列号', dataIndex: 'serial', width: 120 },
                { title: '独立编号', dataIndex: 'independentCode', width: 90, render: yesNo },
                { title: '独立维修', dataIndex: 'independentRepair', width: 90, render: yesNo },
                { title: '计量/质控', dataIndex: 'metrologyQc', width: 90, render: yesNo },
                { title: '关键组件', dataIndex: 'critical', width: 90, render: yesNo },
                { title: '状态', dataIndex: 'status', width: 80, render: (value: string) => <Tag color="green">{value}</Tag> },
                { title: '备注', dataIndex: 'note' },
              ]}
            />
          </Space>
        ) : null}

        {mode === 'model' ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert type="success" showIcon message="同型号资料继承机制" description="说明书、注册证、培训资料、维护规范等归入型号档案，200台同型号设备只需维护本机铭牌、序列号、科室、维修/PM/计量等个性化资料。" />
            <Table<ModelArchiveProfile>
              size="small"
              rowKey="key"
              dataSource={modelArchiveProfiles}
              pagination={false}
              columns={[
                { title: '品牌', dataIndex: 'brand', width: 100 },
                { title: '型号档案', dataIndex: 'model', width: 190 },
                { title: '注册证号', dataIndex: 'registrationNo', width: 190 },
                { title: '公共资料', dataIndex: 'commonDocs', render: (items: string[]) => <Space size={[4, 4]} wrap>{items.map((x) => <Tag key={x}>{x}</Tag>)}</Space> },
                { title: '继承设备数', dataIndex: 'inheritedCount', width: 110, render: (value: number) => <Tag color="blue">{value}台</Tag> },
                { title: '维护规范', dataIndex: 'maintenanceSpec', width: 180 },
              ]}
            />
          </Space>
        ) : null}

        {mode === 'component' || mode === 'template' ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div className="asset-ledger-attachment-taxonomy">
              {[
                ['资料类附件', '说明书、维修手册、注册证、合格证、培训资料'],
                ['随机配件类附件', '电源线、脚踏开关、台车、支架、连接线'],
                ['功能组件类附件', '摄像头、CCD手柄、冷光源、气腹机、显示器、电刀'],
                ['可更换部件类附件', '电池、探头、模块、主板、传感器、氧电池'],
                ['计量/质控相关附件', '影响计量、质控、检测结果的部件'],
                ['耗材/专用消耗附件', '一次性管路、电极、过滤器、刀头，可关联SPD'],
              ].map(([title, desc]) => (
                <section key={title}>
                  <strong>{title}</strong>
                  <span>{desc}</span>
                </section>
              ))}
            </div>
            {mode === 'template' ? (
              <Table
                size="small"
                rowKey="name"
                pagination={false}
                dataSource={[
                  { name: '腹腔镜系统模板', parts: '主机、冷光源、摄像头、显示器、气腹机、电刀、镜头、台车、导光束', scene: '手术室/外科中心' },
                  { name: '内镜系统模板', parts: '图像处理器、光源、内镜镜体、水瓶、台车、显示器、清洗适配器', scene: '消化内镜中心' },
                  { name: '中央监护系统模板', parts: '中央站、床旁监护仪、遥测盒、交换机、显示屏、打印机', scene: 'ICU/CCU' },
                  { name: '检验流水线模板', parts: '前处理、分析模块、轨道、离心模块、冷藏模块、控制工作站', scene: '检验科' },
                ]}
                columns={[
                  { title: '设备包模板', dataIndex: 'name', width: 170 },
                  { title: '默认组件结构', dataIndex: 'parts' },
                  { title: '适用场景', dataIndex: 'scene', width: 150 },
                ]}
              />
            ) : (
              <Table<KitComponent>
                size="small"
                rowKey={(row) => row.name}
                dataSource={laparoscopeComponents}
                pagination={{ pageSize: 6 }}
                columns={[
                  { title: '组件/附件', dataIndex: 'name', width: 130 },
                  { title: '所属系统', dataIndex: 'system', width: 170 },
                  { title: '型号', dataIndex: 'model', width: 140 },
                  { title: '独立编号', dataIndex: 'independentCode', width: 90, render: yesNo },
                  { title: '独立维修', dataIndex: 'independentRepair', width: 90, render: yesNo },
                  { title: '计量/质控', dataIndex: 'metrologyQc', width: 90, render: yesNo },
                  { title: '备注', dataIndex: 'note' },
                ]}
              />
            )}
          </Space>
        ) : null}

        {mode === 'confirm' || mode === 'duplicate' ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {mode === 'confirm' ? (
              <>
                <Alert type="warning" showIcon message="所有AI识别结果必须人工确认后正式归档" description="确认时可调整归档层级：项目档案、型号档案、单台设备档案、组件档案或附件档案。" />
                <Table<AiInboxDocument>
                  size="small"
                  rowKey="id"
                  dataSource={aiInboxDocuments}
                  pagination={false}
                  columns={[
                    { title: '文件', dataIndex: 'file', width: 220 },
                    { title: '识别类型', dataIndex: 'type', width: 100 },
                    { title: '建议位置', dataIndex: 'target' },
                    { title: '置信度', dataIndex: 'confidence', width: 90, render: confidenceTag },
                    { title: '确认动作', width: 130, render: () => <Button size="small" type="link">确认归档</Button> },
                  ]}
                />
              </>
            ) : (
              <>
                <Alert type="info" showIcon message="重复档案校验" description="按设备名称、品牌型号、序列号、注册证号、合同号和铭牌OCR结果交叉校验，避免同一设备重复建档。" />
                <Table
                  size="small"
                  rowKey="serial"
                  pagination={false}
                  dataSource={[
                    { serial: 'N15C260003', asset: '迈瑞 BeneVision N15 监护仪', source: '铭牌识别草稿 / 历史台账', risk: '高', suggestion: '合并草稿并保留原始识别图片' },
                    { serial: 'SCOPE-26112', asset: '奥林巴斯腹腔镜镜头', source: '装箱单 / 组件清单', risk: '中', suggestion: '确认是否为独立组件档案' },
                    { serial: 'SN-DEFIB-2408', asset: '迈瑞 BeneHeart D6 除颤监护仪', source: '计量证书 / 单台设备档案', risk: '低', suggestion: '自动关联计量证书' },
                  ]}
                  columns={[
                    { title: '序列号', dataIndex: 'serial', width: 140 },
                    { title: '设备/组件', dataIndex: 'asset' },
                    { title: '发现来源', dataIndex: 'source', width: 210 },
                    { title: '重复风险', dataIndex: 'risk', width: 90, render: (value: string) => <Tag color={value === '高' ? 'red' : value === '中' ? 'gold' : 'green'}>{value}</Tag> },
                    { title: '建议处理', dataIndex: 'suggestion', width: 260 },
                  ]}
                />
              </>
            )}
          </Space>
        ) : null}
      </div>
    </Modal>
  )
}

function InfoGrid({ rows }: { rows: Array<[string, ReactNode, string?, ReactNode?]> }) {
  return (
    <div className="asset-ledger-info-grid">
      {rows.map(([labelA, valueA, labelB, valueB], index) => (
        <Fragment key={`${labelA}-${labelB ?? 'single'}-${index}`}>
          <div className="asset-ledger-info-grid__label">{labelA}</div>
          <div className={`asset-ledger-info-grid__value${labelB ? '' : ' asset-ledger-info-grid__value--wide'}`}>{valueA}</div>
          {labelB ? (
            <>
              <div className="asset-ledger-info-grid__label">{labelB}</div>
              <div className="asset-ledger-info-grid__value">{valueB}</div>
            </>
          ) : null}
        </Fragment>
      ))}
    </div>
  )
}

/** 设备档案库：医学装备档案台账管理页。 */
export function AssetsPage() {
  const { message } = App.useApp()
  const defaultPageSize = useAppShellStore((s) => s.defaultPageSize)
  const [searchParams, setSearchParams] = useSearchParams()
  const [form] = Form.useForm()
  const [rows, setRows] = useState<AssetArchiveDisplayRow[]>([])
  const [filters, setFilters] = useState<AppliedFilters>(() => ({
    ...defaultApplied,
    keyword: searchParams.get('keyword') ?? '',
  }))
  const [viewSelection, setViewSelection] = useState<ArchiveViewSelection>(null)
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('asset_id'))
  const [highlightedId, setHighlightedId] = useState<string | null>(searchParams.get('asset_id'))
  const [drawerOpen, setDrawerOpen] = useState(Boolean(searchParams.get('asset_id')))
  const [drawerTab, setDrawerTab] = useState('base')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiPanelMode, setAiPanelMode] = useState('AI档案体检')
  const [statsDrawerOpen, setStatsDrawerOpen] = useState(false)
  const [smartHubDrawerOpen, setSmartHubDrawerOpen] = useState(false)
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false)
  const [filterViewOpen, setFilterViewOpen] = useState(false)
  const [savePlanOpen, setSavePlanOpen] = useState(false)
  const [activeChipKeys, setActiveChipKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerPageSize, setLedgerPageSize] = useState<number>(Math.max(defaultPageSize, 10))
  const [ledgerSortMode, setLedgerSortMode] = useState<LedgerSortMode>('updated')
  const [filingModalOpen, setFilingModalOpen] = useState(false)
  const [filingInitialSource, setFilingInitialSource] = useState<FilingSource>('单台建档')
  const [governanceModalOpen, setGovernanceModalOpen] = useState(false)
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printTargets, setPrintTargets] = useState<AssetLabelPrintTarget[]>([])
  const [qrRow, setQrRow] = useState<AssetArchiveDisplayRow | null>(null)
  const [savedPlans, setSavedPlans] = useState<SavedFilterPlan[]>(initialSavedFilterPlans)
  const [planName, setPlanName] = useState('')
  const [planScope, setPlanScope] = useState<'我的方案' | '科室共享方案'>('我的方案')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState(() => searchParams.get('keyword') ?? '')
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    if (typeof window === 'undefined') return defaultSearchHistory
    try {
      const parsed = JSON.parse(window.localStorage.getItem(searchHistoryStorageKey) || '[]') as string[]
      return parsed.length ? parsed.slice(0, 10) : defaultSearchHistory
    } catch {
      return defaultSearchHistory
    }
  })
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => {
    if (typeof window === 'undefined') return defaultLedgerVisibleColumns
    try {
      const parsed = JSON.parse(window.localStorage.getItem(ledgerColumnStorageKey) || '[]') as string[]
      return parsed.length ? parsed : defaultLedgerVisibleColumns
    } catch {
      return defaultLedgerVisibleColumns
    }
  })
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [checklistType, setChecklistType] = useState('missing')
  const [smartArchiveOpen, setSmartArchiveOpen] = useState(false)
  const [smartArchiveMode, setSmartArchiveMode] = useState<SmartArchiveMode>('inbox')
  const searchDebounceRef = useRef<number | null>(null)
  const searchInputRef = useRef<InputRef>(null)
  const loadAssets = useCallback(async () => {
    setLoading(true)
    try {
      if (IS_AUTH_MOCK) {
        setRows((prev) => mergeRowsPreservingRuntime(withScenarioArchiveRuntime(buildMockArchiveRows()), prev))
        return
      }
      const data = await fetchAssets({ ...apiSliceParams(filters), page: 1, page_size: Math.max(100, defaultPageSize) })
      setRows((prev) => mergeRowsPreservingRuntime(withScenarioArchiveRuntime(data.items.map((item: AssetReadJson) => enrichAssetRow(item))), prev))
    } catch (e) {
      message.warning(`设备档案接口暂不可用：${e instanceof Error ? e.message : String(e)}`)
      setRows((prev) => mergeRowsPreservingRuntime(withScenarioArchiveRuntime(buildMockArchiveRows()), prev))
    } finally {
      setLoading(false)
    }
  }, [defaultPageSize, filters, message])

  useEffect(() => {
    void loadAssets()
  }, [loadAssets])

  useEffect(() => {
    const nextKeyword = searchParams.get('keyword') ?? ''
    const nextAssetId = searchParams.get('asset_id')
    setSelectedId(nextAssetId)
    if (nextAssetId) {
      setHighlightedId(nextAssetId)
      setDrawerOpen(true)
    }
    setFilters((prev) => (prev.keyword === nextKeyword ? prev : { ...prev, keyword: nextKeyword }))
  }, [searchParams])

  useEffect(() => {
    form.setFieldsValue(filters)
  }, [filters, form])

  useEffect(() => {
    if (!searchOpen) return
    setSearchDraft(filters.keyword)
    const timer = window.setTimeout(() => searchInputRef.current?.focus({ cursor: 'end' }), 80)
    return () => window.clearTimeout(timer)
  }, [filters.keyword, searchOpen])

  useEffect(() => {
    try {
      window.localStorage.setItem(searchHistoryStorageKey, JSON.stringify(searchHistory.slice(0, 10)))
    } catch {
      /* ignore storage failures */
    }
  }, [searchHistory])

  useEffect(() => {
    try {
      window.localStorage.setItem(ledgerColumnStorageKey, JSON.stringify(visibleColumnKeys))
    } catch {
      /* ignore storage failures */
    }
  }, [visibleColumnKeys])

  const filteredRows = useMemo(
    () => {
      const chips = buildQuickFilterChips(rows).filter((chip) => activeChipKeys.includes(chip.key))
      const result = rows.filter((row) => passesClientFilters(row, filters, viewSelection) && chips.every((chip) => chip.match(row)))
      const riskWeight: Record<string, number> = { 高风险: 3, 中风险: 2, 低风险: 1 }
      return [...result].sort((a, b) => {
        if (ledgerSortMode === 'completeness') return buildArchiveProfile(a).completeness - buildArchiveProfile(b).completeness
        if (ledgerSortMode === 'risk') return (riskWeight[b.risk_display] ?? 0) - (riskWeight[a.risk_display] ?? 0)
        if (ledgerSortMode === 'purchase') return dayjs(b.purchase_date).valueOf() - dayjs(a.purchase_date).valueOf()
        if (ledgerSortMode === 'meter') return String(a.metrology_display).localeCompare(String(b.metrology_display), 'zh-CN')
        if (ledgerSortMode === 'pm') return String(pmArchiveStatus(b)).localeCompare(String(pmArchiveStatus(a)), 'zh-CN')
        return dayjs(buildArchiveProfile(b).updatedDate).valueOf() - dayjs(buildArchiveProfile(a).updatedDate).valueOf()
      })
    },
    [activeChipKeys, filters, ledgerSortMode, rows, viewSelection],
  )

  useEffect(() => {
    setLedgerPage(1)
  }, [activeChipKeys, filters, ledgerPageSize, viewSelection])

  const pagedRows = useMemo(
    () => (ledgerPageSize === 0 ? filteredRows : filteredRows.slice((ledgerPage - 1) * ledgerPageSize, ledgerPage * ledgerPageSize)),
    [filteredRows, ledgerPage, ledgerPageSize],
  )

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? filteredRows.find((row) => row.id === selectedId) ?? null,
    [filteredRows, rows, selectedId],
  )

  const quickChips = useMemo(() => buildQuickFilterChips(rows), [rows])
  const aiInsights = useMemo(() => buildAiInsights(filteredRows), [filteredRows])
  const checklist = useMemo(() => checklistMeta(checklistType, filteredRows), [checklistType, filteredRows])
  const kitRows = useMemo(() => rows.filter(isKitArchiveRow), [rows])
  const inheritedRows = useMemo(() => rows.filter((row) => modelArchiveForRow(row).inheritedCount > 1), [rows])

  const stats = useMemo(
    () => [
      { key: 'need-materials', label: '待补资料', value: rows.filter((row) => buildArchiveProfile(row).missing.length > 0).length, custom: 'need-materials', tone: 'warning', trend: [6, 7, 8, 8, 9, 10, 10], delta: 2 },
      { key: 'attach', label: '附件缺失', value: rows.filter((row) => buildArchiveProfile(row).attachmentStatus !== '完整').length, custom: 'attach', tone: 'warning', trend: [8, 8, 7, 7, 6, 6, 6], delta: -1 },
      { key: 'review', label: '待审核', value: rows.filter((row) => buildArchiveProfile(row).auditStatus === '待审核').length, filter: { audit_status: '待审核' as AuditStatus }, custom: 'review', tone: 'info', trend: [1, 2, 2, 3, 2, 2, 2], delta: 1 },
      { key: 'high-risk', label: '高风险设备', value: rows.filter((row) => row.risk_display === '高风险').length, filter: { risk_level: '高风险' as RiskDisplayLabel }, custom: 'high-risk', tone: 'danger', trend: [5, 5, 6, 6, 6, 7, 6], delta: -1 },
      { key: 'cls-unclassified', label: '未分类设备', value: rows.filter((row) => !row.classification_id || row.classification_match_status === 'unclassified').length, filter: { classification_match_status: 'unclassified' }, tone: 'warning', trend: [9, 8, 7, 7, 6, 5, 4], delta: -1 },
      { key: 'cls-pending', label: '待确认分类', value: rows.filter((row) => ['auto_recommended', 'pending_confirm'].includes(row.classification_match_status || '')).length, filter: { classification_match_status: 'pending_confirm' }, tone: 'info', trend: [3, 4, 4, 3, 3, 2, 2], delta: 0 },
      { key: 'cls-review', label: '需复核分类', value: rows.filter((row) => row.classification_match_status === 'need_review').length, filter: { classification_match_status: 'need_review' }, tone: 'warning', trend: [1, 1, 2, 2, 3, 3, 3], delta: 1 },
      { key: 'cls-expired', label: '分类已失效', value: rows.filter((row) => row.classification_match_status === 'expired').length, filter: { classification_match_status: 'expired' }, tone: 'danger', trend: [0, 0, 1, 1, 1, 1, 1], delta: 0 },
      { key: 'cls-high-impact', label: '高风险分类影响', value: rows.filter((row) => row.classification_change_status === 'pending' || row.classification_match_status === 'need_review').length, filter: { classification_change_status: 'pending' }, tone: 'danger', trend: [1, 1, 1, 2, 2, 3, 3], delta: 1 },
      { key: 'meter-due', label: '计量临期', value: rows.filter((row) => row.metrology_display === '即将到期' || row.metrology_display === '已过期').length, custom: 'meter', tone: 'danger', trend: [2, 3, 3, 4, 4, 4, 4], delta: 2 },
      { key: 'pm-overdue', label: 'PM临期', value: rows.filter((row) => ['临近', '超时'].includes(buildAssetTwinMetrics(row).pmStatus)).length, custom: 'pm', tone: 'danger', trend: [4, 4, 4, 3, 3, 3, 3], delta: -1 },
    ],
    [rows],
  )

  const compactStats = useMemo(() => {
    const built = rows.filter((row) => buildArchiveProfile(row).status === '已建档').length
    const avg = rows.length ? Math.round(rows.reduce((sum, row) => sum + buildArchiveProfile(row).completeness, 0) / rows.length) : 0
    return { total: rows.length, builtRate: rows.length ? Math.round((built / rows.length) * 100) : 0, avg }
  }, [rows])

  const smartArchiveStats = useMemo(
    () => [
      { label: '项目档案', value: projectArchiveProfiles.length, note: '合同/发票/验收总表' },
      { label: '型号档案', value: modelArchiveProfiles.length, note: '公共资料继承' },
      { label: '单台档案', value: rows.length, note: '铭牌/序列号/科室' },
      { label: '组件附件', value: laparoscopeComponents.length, note: '成套设备结构化' },
    ],
    [rows.length],
  )

  const applyFilters = useCallback(() => {
    const values = form.getFieldsValue() as AppliedFilters
    const next: AppliedFilters = {
      ...defaultApplied,
      ...values,
      keyword: values.keyword?.trim() ?? '',
      install_range: values.install_range ?? null,
      updated_range: values.updated_range ?? null,
    }
    setFilters(next)
    const sp = new URLSearchParams()
    if (next.keyword) sp.set('keyword', next.keyword)
    if (selectedId) sp.set('asset_id', selectedId)
    setSearchParams(sp, { replace: true })
  }, [form, selectedId, setSearchParams])

  const scheduleKeywordSearch = useCallback(
    (value: string, immediate = false) => {
      if (searchDebounceRef.current != null) {
        window.clearTimeout(searchDebounceRef.current)
      }
      const run = () => {
        const next = { ...filters, keyword: value.trim() }
        form.setFieldsValue({ keyword: next.keyword })
        setFilters(next)
        const sp = new URLSearchParams()
        if (next.keyword) sp.set('keyword', next.keyword)
        if (selectedId) sp.set('asset_id', selectedId)
        setSearchParams(sp, { replace: true })
      }
      if (immediate) {
        run()
        return
      }
      searchDebounceRef.current = window.setTimeout(run, 320)
    },
    [filters, form, selectedId, setSearchParams],
  )

  useEffect(() => () => {
    if (searchDebounceRef.current != null) {
      window.clearTimeout(searchDebounceRef.current)
    }
  }, [])

  const applyFilterPatch = useCallback(
    (patch: Partial<AppliedFilters>) => {
      const next = { ...filters, ...patch }
      form.setFieldsValue(next)
      setFilters(next)
    },
    [filters, form],
  )

  const resetFilters = useCallback(() => {
    form.setFieldsValue(defaultApplied)
    setFilters(defaultApplied)
    setSearchDraft('')
    setViewSelection(null)
    setActiveChipKeys([])
    setHighlightedId(null)
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [form, setSearchParams])

  const setStatFilter = useCallback(
    (patch: Partial<AppliedFilters>, custom?: string) => {
      const next = { ...defaultApplied, ...patch }
      form.setFieldsValue(next)
      setFilters(next)
      setActiveChipKeys([])
      setHighlightedId(null)
      setViewSelection(
        custom === 'review'
          ? {
              key: 'review',
              label: '待审核',
              match: (row) => buildArchiveProfile(row).auditStatus === '待审核',
            }
          : custom === 'high-risk'
            ? {
                key: 'high-risk',
                label: '高风险',
                match: (row) => row.risk_display === '高风险',
              }
          : custom === 'scrap'
          ? {
              key: 'stat-scrap',
              label: '待报废设备',
              match: (row) => buildAssetTwinMetrics(row).lifecycleStage === '待报废',
            }
          : custom === 'complete'
            ? {
                key: 'stat-complete',
                label: '完整档案',
                match: (row) => buildArchiveProfile(row).completeness >= 95,
              }
          : custom === 'attach'
            ? {
                key: 'attach-missing',
                label: '附件缺失',
                match: (row) => buildArchiveProfile(row).attachmentStatus !== '完整',
              }
            : custom === 'need-materials'
              ? {
                  key: 'need-materials',
                  label: '待补资料',
                  match: (row) => buildArchiveProfile(row).missing.length > 0,
                }
            : custom === 'meter'
              ? {
                  key: 'meter-due',
                  label: '计量临期',
                  match: (row) => row.metrology_display === '即将到期' || row.metrology_display === '已过期',
                }
            : custom === 'pm'
              ? {
                  key: 'pm-overdue',
                  label: 'PM临期',
                  match: (row) => ['临近', '超时'].includes(buildAssetTwinMetrics(row).pmStatus),
                }
          : custom === 'code'
            ? {
                key: 'stat-code',
                label: '编码异常',
                match: (row) => buildArchiveProfile(row).codeStatus !== '正常',
              }
          : null,
      )
    },
    [form],
  )

  const activeFilterTags = useMemo(() => {
    const tags: Array<{ key: string; label: string; onClose: () => void }> = []
    const parsed = parseAiArchiveQuery(filters.keyword)
    const field = <K extends keyof AppliedFilters>(key: K, label: string, formatter?: (value: NonNullable<AppliedFilters[K]>) => string) => {
      const value = filters[key]
      if (!value || Array.isArray(value)) return
      tags.push({
        key: String(key),
        label: `${label}: ${formatter ? formatter(value as NonNullable<AppliedFilters[K]>) : String(value)}`,
        onClose: () => applyFilterPatch({ [key]: defaultApplied[key] } as Partial<AppliedFilters>),
      })
    }
    field('keyword', '搜索')
    field('department', '使用科室')
    field('category_code', '设备分类')
    field('main_status', '资产状态')
    field('archive_status', '档案状态')
    field('risk_level', '风险等级')
    field('metrology', '计量状态')
    field('pm_status', 'PM状态')
    field('engineer', '责任工程师')
    field('is_large_equipment', '大型设备', () => '是')
    field('is_life_support', '生命支持类', () => '是')
    field('is_emergency', '急救设备', () => '是')
    field('attachment_status', '附件状态')
    field('code_status', '编码状态')
    field('filing_source', '建档来源')
    field('audit_status', '审核状态')
    field('classification_match_status', '标准分类', (value) => classificationStatusOptions.find((x) => x.value === value)?.label ?? String(value))
    field('classification_change_status', '变更提醒')
    parsed.labels.forEach((label, index) => {
      tags.push({ key: `ai-${index}`, label: `AI解析: ${label}`, onClose: () => applyFilterPatch({ keyword: '' }) })
    })
    activeChipKeys.forEach((key) => {
      const chip = quickChips.find((x) => x.key === key)
      if (chip) tags.push({ key: `chip-${key}`, label: chip.label, onClose: () => setActiveChipKeys((prev) => prev.filter((x) => x !== key)) })
    })
    if (viewSelection) tags.push({ key: 'view', label: `视图: ${viewSelection.label}`, onClose: () => setViewSelection(null) })
    return tags
  }, [activeChipKeys, applyFilterPatch, filters, quickChips, viewSelection])

  const rememberSearch = useCallback((keyword: string) => {
    const nextKeyword = keyword.trim()
    if (!nextKeyword) return
    setSearchHistory((prev) => [nextKeyword, ...prev.filter((item) => item !== nextKeyword)].slice(0, 10))
  }, [])

  const runFloatingSearch = useCallback(
    (keyword: string) => {
      const query = keyword.trim()
      setSearchDraft(query)
      form.setFieldValue('keyword', query)
      scheduleKeywordSearch(query, true)
      if (query) rememberSearch(query)
    },
    [form, rememberSearch, scheduleKeywordSearch],
  )

  const applyRecommendedSearch = useCallback(
    (label: string) => {
      if (label === '档案不完整设备') {
        applyFilterPatch({ completeness: '缺采购资料' })
        return
      }
      if (label === '计量临期设备') {
        setStatFilter({}, 'meter')
        return
      }
      if (label === 'PM逾期设备') {
        applyFilterPatch({ pm_status: '超时' })
        return
      }
      if (label === '高风险设备') {
        applyFilterPatch({ risk_level: '高风险' })
        return
      }
      if (label === '生命支持类设备') {
        applyFilterPatch({ is_life_support: 'yes' })
        return
      }
      if (label === '未关联 H-UMDG 分类' || label === '未关联 H-UMDG 分类') {
        applyFilterPatch({ classification_match_status: 'unclassified' })
      }
    },
    [applyFilterPatch, setStatFilter],
  )

  const removeSearchHistory = useCallback((keyword: string) => {
    setSearchHistory((prev) => prev.filter((item) => item !== keyword))
  }, [])

  const quickFilterItems = useMemo(
    () => [
      { key: 'active', label: '在用设备', active: filters.main_status === '在用', apply: () => applyFilterPatch({ main_status: '在用' }) },
      { key: 'risk', label: '高风险设备', active: filters.risk_level === '高风险', apply: () => applyFilterPatch({ risk_level: '高风险' }) },
      { key: 'life', label: '生命支持类', active: filters.is_life_support === 'yes', apply: () => applyFilterPatch({ is_life_support: 'yes' }) },
      { key: 'emergency', label: '急救设备', active: filters.is_emergency === 'yes', apply: () => applyFilterPatch({ is_emergency: 'yes' }) },
      { key: 'meter', label: '计量到期', active: filters.metrology === '已过期', apply: () => applyFilterPatch({ metrology: '已过期' }) },
      { key: 'pm', label: 'PM逾期', active: filters.pm_status === '超时', apply: () => applyFilterPatch({ pm_status: '超时' }) },
      { key: 'incomplete', label: '档案不完整', active: filters.completeness !== '', apply: () => applyFilterPatch({ completeness: '缺采购资料' }) },
      { key: 'h-mdm', label: '未关联 H-UMDG 分类', active: filters.classification_match_status === 'unclassified', apply: () => applyFilterPatch({ classification_match_status: 'unclassified' }) },
    ],
    [applyFilterPatch, filters],
  )

  const viewPanelItems = useMemo(
    () => [
      { key: 'all', label: '全部设备', active: viewSelection == null, apply: () => setViewSelection(null) },
      { key: 'er', label: '急诊科设备', active: filters.department === '急诊科', apply: () => applyFilterPatch({ department: '急诊科' }) },
      { key: 'risk', label: '高风险监管视图', active: viewSelection?.key === 'high-risk' || filters.risk_level === '高风险', apply: () => setStatFilter({ risk_level: '高风险' }, 'high-risk') },
      { key: 'meter', label: '计量监管视图', active: viewSelection?.key === 'meter-due', apply: () => setStatFilter({}, 'meter') },
      { key: 'pm', label: 'PM监管视图', active: viewSelection?.key === 'pm-overdue', apply: () => setStatFilter({}, 'pm') },
      { key: 'complete', label: '档案完整性视图', active: viewSelection?.key === 'need-materials', apply: () => setStatFilter({}, 'need-materials') },
      { key: 'life', label: '生命支持类设备视图', active: filters.is_life_support === 'yes', apply: () => applyFilterPatch({ is_life_support: 'yes' }) },
    ],
    [applyFilterPatch, filters, setStatFilter, viewSelection],
  )

  const openFilingModal = useCallback((source: FilingSource) => {
    setFilingInitialSource(source)
    setFilingModalOpen(true)
  }, [])

  const openChecklist = useCallback((type: string) => {
    setChecklistType(type)
    setChecklistOpen(true)
  }, [])

  const openSmartArchive = useCallback((mode: SmartArchiveMode) => {
    setSmartArchiveMode(mode)
    setSmartArchiveOpen(true)
  }, [])

  const updateRowRuntime = useCallback((rowId: string, patch: ArchiveRuntime) => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? mergeArchiveRuntime(row, patch) : row)))
  }, [])

  const handleFilingConfirm = useCallback(
    (row: AssetArchiveDisplayRow, source: FilingSource, mode: 'draft' | 'formal' | 'supplement' | 'reviewed', reason?: string) => {
      const patch = buildArchivePatch(row, source, mode)
      updateRowRuntime(row.id, {
        ...patch,
        supplementReason: reason,
        sourceLabel:
          source === '盘点补录'
            ? `${reason || '盘点补录'}；已按设备名称、型号、序列号进行疑似重复校验。`
            : source === '单台建档'
              ? '来源：档案库新建单台，后续补齐项目、型号和本机资料。'
            : source === '验收入库建档'
              ? '来源：验收单、验收照片、铭牌照片、合格证、注册证。'
              : '来源：采购申请、合同签订、验收入库与启用确认。',
      })
      setSelectedId(row.id)
      setHighlightedId(row.id)
      setDrawerTab(source === '盘点补录' || source === '单台建档' ? 'base' : 'lifecycle')
      setDrawerOpen(true)
      setFilingModalOpen(false)
      message.success(source === '盘点补录' ? '补录档案已提交待审核' : source === '单台建档' ? '单台设备档案草稿已生成' : '设备档案已生成，生命周期已自动更新')
    },
    [message, updateRowRuntime],
  )

  const handleUploadMissingAttachments = useCallback(
    (row: AssetArchiveDisplayRow, labels?: string[]) => {
      const profile = buildArchiveProfile(row)
      const uploadLabels = labels ?? profile.missing.slice(0, Math.max(1, Math.min(3, profile.missing.length)))
      const missing = profile.missing.filter((item) => !uploadLabels.includes(item))
      const checks = applyMissingToChecks(profile.docChecks, missing)
      const completeness = scoreDocChecks(checks)
      const attachmentStatus: AttachmentStatus = missing.some((x) => ['合同', '发票', '到货验收单', '计量证书', '注册证'].includes(x)) ? '部分缺失' : '完整'
      updateRowRuntime(row.id, {
        missing,
        docChecks: checks,
        completeness,
        attachmentStatus,
        auditStatus: missing.length ? profile.auditStatus : '待审核',
        status: missing.length ? (attachmentStatus === '完整' ? '待补资料' : '附件缺失') : '待审核',
        updatedDate: dayjs().format('YYYY-MM-DD'),
      })
      setDrawerTab(missing.length ? 'attachments' : 'quality-risk')
      message.success(`已模拟上传 ${uploadLabels.join('、')}，档案完整度已重新计算为 ${completeness}%`)
    },
    [message, updateRowRuntime],
  )

  const handleApproveArchive = useCallback(
    (row: AssetArchiveDisplayRow) => {
      const patch = buildArchivePatch(row, buildArchiveProfile(row).filingSource, 'reviewed')
      updateRowRuntime(row.id, {
        ...patch,
        tasks: getArchiveRuntime(row).tasks?.map((task) => task.title.includes('编码') ? { ...task, status: '已完成' as const } : task),
      })
      setDrawerTab('lifecycle')
      message.success('档案审核已通过，正式入档并刷新生命周期节点')
    },
    [message, updateRowRuntime],
  )

  const handleGenerateTasks = useCallback(
    (targetRows: AssetArchiveDisplayRow[], reason = 'AI档案体检') => {
      const candidates = targetRows.length ? targetRows : filteredRows
      let taskCount = 0
      setRows((prev) => prev.map((row) => {
        if (!candidates.some((target) => target.id === row.id)) return row
        const tasks = buildRectificationTasks(row, reason)
        taskCount += tasks.length
        return mergeArchiveRuntime(row, { tasks })
      }))
      message.success(taskCount ? `已生成 ${taskCount} 条档案治理事项` : '当前范围暂无需要生成的治理事项')
    },
    [filteredRows, message],
  )

  const applyAiSmartSearch = useCallback(
    (keyword?: string) => {
      const query = (keyword ?? form.getFieldValue('keyword') ?? '').trim()
      const parsed = parseAiArchiveQuery(query)
      const next = { ...filters, ...parsed.patch, keyword: query }
      form.setFieldsValue(next)
      setSearchDraft(query)
      setFilters(next)
      setAiPanelMode('AI智能检索')
      setAiPanelOpen(true)
      message.success(parsed.labels.length ? `AI已解析：${parsed.labels.join('，')}` : 'AI按关键词和语义条件刷新了档案列表')
    },
    [filters, form, message],
  )

  const openArchiveDrawer = useCallback(
    (row: AssetArchiveDisplayRow, tab = 'base') => {
      setSelectedId(row.id)
      setHighlightedId(row.id)
      setDrawerTab(tab)
      setDrawerOpen(true)
      const sp = new URLSearchParams(searchParams)
      sp.set('asset_id', row.id)
      setSearchParams(sp, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setHighlightedId(null)
    const sp = new URLSearchParams(searchParams)
    sp.delete('asset_id')
    setSearchParams(sp, { replace: true })
  }, [searchParams, setSearchParams])

  const openPrintPanel = useCallback(
    (targetRows: AssetArchiveDisplayRow[]) => {
      if (!targetRows.length) {
        message.warning('请先选择需要打印标签的设备')
        return
      }
      setPrintTargets(targetRows.map(toLabelPrintTarget))
      setPrintModalOpen(true)
    },
    [message],
  )

  const columnOptions = useMemo(
    () => [
      { key: 'index', label: '序号', locked: true },
      { key: 'device', label: '设备信息', locked: true },
      { key: 'department', label: '使用科室' },
      { key: 'status', label: '资产状态' },
      { key: 'quality', label: '档案质量' },
      { key: 'supervision', label: '监管属性' },
      { key: 'classification', label: '标准分类' },
      { key: 'change', label: '变更提醒' },
      { key: 'meter', label: '计量状态' },
      { key: 'pm', label: 'PM状态' },
      { key: 'completeness', label: '完整度' },
      { key: 'updated', label: '最近更新' },
    ],
    [],
  )

  const columns = useMemo<TableColumnsType<AssetArchiveDisplayRow>>(
    () => {
      const built: TableColumnsType<AssetArchiveDisplayRow> = [
      {
        key: 'index',
        title: '序号',
        width: 54,
        fixed: 'left',
        className: 'asset-ledger-index-column',
        align: 'center',
        render: (_value, _row, index) => (
          <span className="asset-ledger-row-index">
            {(ledgerPageSize === 0 ? 0 : (ledgerPage - 1) * ledgerPageSize) + index + 1}
          </span>
        ),
      },
      {
        key: 'device',
        title: '设备信息',
        width: 300,
        fixed: 'left',
        render: (_, row) => (
          <div className="asset-ledger-device-cell">
            <Text strong className="asset-ledger-name-text">
              {row.asset_name}
            </Text>
            <div>
              <Text code>{formatArchiveAssetCode(row.asset_code, row.id)}</Text>
              <Text type="secondary">SN {row.serial_number ?? '—'}</Text>
            </div>
            <Text type="secondary">{row.brand_vendor} / {row.spec_model}</Text>
          </div>
        ),
      },
      {
        key: 'department',
        title: '使用科室',
        width: 138,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Text>{row.department_name}</Text>
            <Text type="secondary">{row.location_text}</Text>
          </Space>
        ),
      },
      {
        key: 'status',
        title: '资产状态',
        width: 96,
        render: (_, row) => {
          const stage = buildAssetTwinMetrics(row).lifecycleStage
          const label = stage === '待报废' ? '待报废' : row.run_display
          const color = label === '在用' ? 'success' : label === '维修中' ? 'warning' : label === '待报废' ? 'error' : 'default'
          return <Tag className="asset-ledger-status-tag" color={color}>{label}</Tag>
        },
      },
      {
        key: 'quality',
        title: '档案质量',
        width: 180,
        render: (_, row) => {
          const profile = buildArchiveProfile(row)
          const progressColor = completenessColor(profile.completeness)
          return (
            <Tooltip
              placement="right"
              title={progressTooltipContent(profile)}
              overlayClassName="asset-ledger-quality-tooltip-overlay"
            >
              <div className="asset-ledger-quality-progress">
                <Progress percent={profile.completeness} showInfo={false} strokeColor={progressColor} trailColor="var(--color-border-tertiary)" />
                <Space size={4} wrap>
                  <Tag bordered className="asset-ledger-quality-tag">{profile.attachmentStatus}</Tag>
                  <Tag bordered className="asset-ledger-quality-tag">缺失{profile.missing.length}项</Tag>
                </Space>
              </div>
            </Tooltip>
          )
        },
      },
      {
        key: 'supervision',
        title: '监管属性',
        width: 210,
        render: (_, row) => (
          <Space className="asset-ledger-outline-tags" size={4} wrap>
            {row.risk_display === '高风险' ? <Tag bordered color="red" className="asset-ledger-outline-tag">高风险</Tag> : null}
            {row.is_critical_care ? <Tag bordered color="orange" className="asset-ledger-outline-tag">生命支持</Tag> : null}
            {isEmergencyAsset(row) ? <Tag bordered color="red" className="asset-ledger-outline-tag">急救</Tag> : null}
            {row.is_metrology_device ? <Tag bordered color="blue" className="asset-ledger-outline-tag">计量</Tag> : null}
            {row.is_large_equipment ? <Tag bordered color="blue" className="asset-ledger-outline-tag">大型</Tag> : null}
          </Space>
        ),
      },
      {
        key: 'classification',
        title: '标准分类',
        width: 230,
        render: (_, row) => (
          <Space direction="vertical" size={2}>
            <Text strong>{row.mdm_category_name || row.classification_name || row.hmdm_standard_name || '未关联 H-UMDG 分类'}</Text>
            <Space size={4} wrap>
              <Text code>{row.mdm_category_code || row.classification_code || row.hmdm_equipment_category_code || '—'}</Text>
              <Tag color={classificationStatusColor(row.classification_match_status)}>
                {classificationStatusLabel(row.classification_match_status)}
              </Tag>
            </Space>
            <Text type="secondary">版本 {row.mdm_category_version || row.classification_version_id || '—'} · {row.management_class || '管理类别待确认'}</Text>
          </Space>
        ),
      },
      {
        key: 'change',
        title: '变更提醒',
        width: 120,
        render: (_, row) => {
          if (row.classification_match_status === 'expired') return <Tag color="red">已失效</Tag>
          if (row.classification_change_status === 'pending' || row.classification_match_status === 'need_review') return <Tag color="orange">需复核</Tag>
          if (row.classification_match_status === 'confirmed') return <Tag color="green">无影响</Tag>
          return <Tag>待匹配</Tag>
        },
      },
      {
        key: 'meter',
        title: '计量状态',
        width: 118,
        render: (_, row) => {
          const status = metrologyArchiveStatus(row)
          const color = status === '超期' ? 'red' : status === '临期' ? 'gold' : status === '未纳入' ? 'default' : 'green'
          return <Tag color={color}>{status}</Tag>
        },
      },
      {
        key: 'pm',
        title: 'PM状态',
        width: 108,
        render: (_, row) => {
          const status = pmArchiveStatus(row)
          const color = status === '逾期' ? 'red' : status === '临期' ? 'gold' : status === '无计划' ? 'default' : 'green'
          return <Tag color={color}>{status}</Tag>
        },
      },
      {
        key: 'completeness',
        title: '完整度',
        width: 142,
        render: (_, row) => {
          const profile = buildArchiveProfile(row)
          const docSummary = documentCompleteness(row, profile)
          const tone = completenessTone(docSummary.percent)
          return (
            <Tooltip
              placement="left"
              title={(
                <div className="asset-ledger-doc-tooltip">
                  <div className="asset-ledger-doc-tooltip__grid">
                    {docSummary.docs.map((doc) => {
                      const missing = doc.status === '缺'
                      return (
                        <span className={missing ? 'missing' : 'ok'} key={doc.label}>
                          <em>{missing ? '✗' : '✓'}</em>
                          <b>{doc.label}{missing ? '（缺失）' : ''}</b>
                        </span>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      openArchiveDrawer(row, 'attachments')
                    }}
                  >
                    去补全 →
                  </button>
                </div>
              )}
              overlayClassName="asset-ledger-doc-tooltip-overlay"
            >
              <div className={`asset-ledger-doc-completeness asset-ledger-doc-completeness--${tone}`}>
                <span>
                  <b>{docSummary.complete}</b>
                  <em>/ {docSummary.total}</em>
                </span>
                <div className="asset-ledger-mini-progress">
                  <i style={{ width: `${docSummary.percent}%`, backgroundColor: completenessColor(docSummary.percent) }} />
                </div>
              </div>
            </Tooltip>
          )
        },
      },
      {
        key: 'updated',
        title: '最近更新',
        width: 128,
        render: (_, row) => {
          const profile = buildArchiveProfile(row)
          return (
            <div className="asset-ledger-update-cell">
              <span>{profile.updatedDate}</span>
              <strong>{sourceModuleText(row, profile)}</strong>
            </div>
          )
        },
      },
    ]
      const visible = new Set(visibleColumnKeys.length ? visibleColumnKeys : defaultLedgerVisibleColumns)
      return built.filter((column) => visible.has(String(column.key)))
    },
    [ledgerPage, ledgerPageSize, openArchiveDrawer, visibleColumnKeys],
  )

  const selectedProfile = selectedRow ? buildArchiveProfile(selectedRow) : null
  const selectedMetrics = selectedRow ? buildAssetTwinMetrics(selectedRow) : null
  const selectedCredibility = selectedProfile ? dataCredibility(selectedProfile) : null
  const sortItems: Array<{ key: LedgerSortMode; label: string }> = [
    { key: 'updated', label: '最近更新' },
    { key: 'completeness', label: '档案完整度' },
    { key: 'risk', label: '风险等级' },
    { key: 'purchase', label: '购置时间' },
    { key: 'meter', label: '计量到期时间' },
    { key: 'pm', label: 'PM到期时间' },
  ]
  const filterViewPanel = (
    <div className="asset-ledger-filter-view-panel">
      <section>
        <strong>快速筛选</strong>
        <div>
          {quickFilterItems.map((item) => (
            <button type="button" key={item.key} className={item.active ? 'active' : ''} onClick={() => { item.apply(); setFilterViewOpen(false) }}>
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <strong>当前视图</strong>
        <div>
          {viewPanelItems.map((item) => (
            <button type="button" key={item.key} className={item.active ? 'active' : ''} onClick={() => { item.apply(); setFilterViewOpen(false) }}>
              {item.label}
            </button>
          ))}
          {savedPlans.map((plan) => (
            <button
              type="button"
              key={`saved-${plan.name}`}
              onClick={() => {
                const next = { ...filters, ...plan.patch }
                form.setFieldsValue(next)
                setFilters(next)
                setViewSelection(plan.view ?? null)
                setFilterViewOpen(false)
              }}
            >
              {plan.name}
            </button>
          ))}
        </div>
      </section>
      <section>
        <strong>排序方式</strong>
        <div>
          {sortItems.map((item) => (
            <button type="button" key={item.key} className={ledgerSortMode === item.key ? 'active' : ''} onClick={() => { setLedgerSortMode(item.key); setFilterViewOpen(false) }}>
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <strong>视图管理</strong>
        <div>
          <button type="button" onClick={() => { setSavePlanOpen(true); setFilterViewOpen(false) }}>保存当前条件为常用视图</button>
          <button type="button" onClick={() => { setFilterViewOpen(false); message.info('常用视图管理已预留，将支持重命名、排序和共享范围设置') }}>管理常用视图</button>
        </div>
      </section>
    </div>
  )
  const searchPanel = (
    <div className="asset-ledger-floating-search-panel" onKeyDown={(event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setSearchOpen(false)
      }
    }}>
      <strong>搜索设备档案</strong>
      <Input
        ref={searchInputRef}
        allowClear
        size="large"
        prefix={<SearchOutlined />}
        suffix={<SearchOutlined onClick={() => runFloatingSearch(searchDraft)} />}
        value={searchDraft}
        placeholder="搜索设备名称 / 型号 / SN / 科室 / 分类 / 档案编号"
        onChange={(event) => {
          setSearchDraft(event.target.value)
        }}
        onPressEnter={() => runFloatingSearch(searchDraft)}
      />
      <section>
        <div className="asset-ledger-floating-search-section-head">
          <strong>最近搜索</strong>
          {searchHistory.length ? <button type="button" onClick={() => setSearchHistory([])}>清空搜索历史</button> : null}
        </div>
        {searchHistory.length ? (
          <div className="asset-ledger-floating-search-chips">
            {searchHistory.map((item) => (
              <span key={item}>
                <button type="button" onClick={() => runFloatingSearch(item)}>{item}</button>
                <button type="button" aria-label={`删除${item}`} onClick={() => removeSearchHistory(item)}>×</button>
              </span>
            ))}
          </div>
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无搜索历史" />}
      </section>
      <section>
        <strong>推荐搜索</strong>
        <div className="asset-ledger-floating-search-chips">
          {recommendedSearches.map((item) => (
            <span key={item}>
              <button type="button" onClick={() => applyRecommendedSearch(item)}>{item}</button>
            </span>
          ))}
        </div>
      </section>
      <p>将在主列表中展示匹配结果，并保留分页、排序与已启用筛选条件。</p>
      <footer>Enter 搜索 · Esc 关闭</footer>
    </div>
  )

  return (
    <div className="asset-ledger-page">
      <section className="asset-ledger-header">
        <div>
          <Title level={2}>医学装备档案库</Title>
          <Text>{filteredRows.length} / {rows.length} 台 · 建档率 {compactStats.builtRate}% · 平均完整度 {compactStats.avg}%</Text>
        </div>
        <Space className="asset-ledger-header-actions" size={8}>
          <Popover
            trigger="click"
            placement="bottomRight"
            open={searchOpen}
            onOpenChange={setSearchOpen}
            content={searchPanel}
            overlayClassName="asset-ledger-floating-search-popover"
          >
            <Button icon={<SearchOutlined />}>搜索</Button>
          </Popover>
          <Popover
            trigger="click"
            placement="bottomRight"
            open={filterViewOpen}
            onOpenChange={setFilterViewOpen}
            content={filterViewPanel}
            overlayClassName="asset-ledger-filter-view-popover"
          >
            <Button icon={<FilterOutlined />}>
              筛选与视图 <DownOutlined />
            </Button>
          </Popover>
          <Dropdown
            menu={{
              items: [
                { type: 'group', label: '主要操作', children: [
                  { key: 'create', label: <strong>补建设备档案</strong>, icon: <DatabaseOutlined /> },
                  { key: 'import', label: '批量导入档案', icon: <UploadOutlined /> },
                  { key: 'source', label: '来源文件归档', icon: <FolderOpenOutlined /> },
                ] },
                { type: 'group', label: '列表操作', children: [
                  { key: 'refresh', label: '刷新列表', icon: <ReloadOutlined /> },
                  { key: 'columns', label: '列设置', icon: <SettingOutlined /> },
                  { key: 'export', label: '导出当前列表', icon: <ExportOutlined /> },
                ] },
                { type: 'group', label: '批量操作', children: [
                  { key: 'dept', label: '批量修改使用科室', icon: <ApartmentOutlined /> },
                  { key: 'status', label: '批量修改资产状态', icon: <EditOutlined /> },
                  { key: 'qrcode', label: '批量生成设备二维码', icon: <QrcodeOutlined /> },
                  { key: 'archive-files', label: '批量归档来源文件', icon: <UploadOutlined /> },
                ] },
                { type: 'group', label: '审计与日志', children: [
                  { key: 'logs', label: '查看操作日志', icon: <AuditOutlined /> },
                  { key: 'changes', label: '查看档案变更记录', icon: <FileDoneOutlined /> },
                ] },
              ],
              onClick: ({ key }) => {
                if (key === 'create') openFilingModal('单台建档')
                if (key === 'import') openSmartArchive('inbox')
                if (key === 'source') openFilingModal('历史台账导入')
                if (key === 'refresh') void loadAssets()
                if (key === 'columns') setColumnSettingsOpen(true)
                if (key === 'export') message.info('导出当前档案列表将进入报表中心任务队列')
                if (key === 'dept') Modal.confirm({
                  title: '确认批量修改使用科室？',
                  content: `将对 ${selectedRowKeys.length} 台已选设备发起使用科室变更流程。`,
                  okText: '确认发起',
                  cancelText: '取消',
                  onOk: () => message.info(`已选择 ${selectedRowKeys.length} 台设备，批量修改使用科室将进入审批留痕流程`),
                })
                if (key === 'status') Modal.confirm({
                  title: '确认批量修改资产状态？',
                  content: `将对 ${selectedRowKeys.length} 台已选设备发起资产状态变更流程。`,
                  okText: '确认发起',
                  cancelText: '取消',
                  onOk: () => message.info(`已选择 ${selectedRowKeys.length} 台设备，批量修改资产状态将进入审批留痕流程`),
                })
                if (key === 'qrcode') Modal.confirm({
                  title: '确认批量生成设备二维码？',
                  content: selectedRowKeys.length ? `将为 ${selectedRowKeys.length} 台已选设备生成二维码。` : '未选择设备，将按当前列表前 10 台生成二维码。',
                  okText: '确认生成',
                  cancelText: '取消',
                  onOk: () => openPrintPanel(selectedRowKeys.length ? rows.filter((row) => selectedRowKeys.includes(row.id)) : filteredRows.slice(0, 10)),
                })
                if (key === 'archive-files') Modal.confirm({
                  title: '确认批量归档来源文件？',
                  content: '将把来源文件归入档案收件箱并保留操作痕迹。',
                  okText: '确认归档',
                  cancelText: '取消',
                  onOk: () => openSmartArchive('inbox'),
                })
                if (key === 'logs' || key === 'changes') setGovernanceModalOpen(true)
              },
            }}
          >
            <Button icon={<EllipsisOutlined />}>更多操作 <DownOutlined /></Button>
          </Dropdown>
        </Space>
      </section>

      <section className="asset-ledger-layout">
        <main className="asset-ledger-main">
          <section className="asset-ledger-active-filters">
            <span>当前条件</span>
            {activeFilterTags.length ? activeFilterTags.map((tag) => (
              <Tag closable key={tag.key} onClose={(e) => { e.preventDefault(); tag.onClose() }}>
                {tag.label}
              </Tag>
            )) : <Tag className="asset-ledger-active-filters__placeholder">全部档案</Tag>}
            <Button type="link" size="small" onClick={resetFilters} disabled={!activeFilterTags.length}>清空全部</Button>
          </section>

          <section className="asset-ledger-table-panel">
            <div className="asset-ledger-table-panel__head">
              <Space wrap>
                <Badge status="processing" text={`当前 ${filteredRows.length} 台`} />
                {viewSelection ? <Tag color="blue">{viewSelection.label}</Tag> : <Tag>全部档案</Tag>}
              </Space>
              <Space wrap className="asset-ledger-table-panel__tools">
                <Pagination
                  size="small"
                  current={ledgerPage}
                  pageSize={ledgerPageSize === 0 ? Math.max(filteredRows.length, 1) : ledgerPageSize}
                  pageSizeOptions={[10, 20, 50, 100, 0]}
                  total={filteredRows.length}
                  showSizeChanger={{
                    options: [
                      { value: 10, label: '10 条/页' },
                      { value: 20, label: '20 条/页' },
                      { value: 50, label: '50 条/页' },
                      { value: 100, label: '100 条/页' },
                      { value: 0, label: '全部' },
                    ],
                  }}
                  showQuickJumper={ledgerPageSize !== 0}
                  showTotal={(total, range) => (ledgerPageSize === 0 ? `全部 ${total}` : `${range[0]}-${range[1]} / ${total}`)}
                  onChange={(page, pageSize) => {
                    setLedgerPage(pageSize === 0 ? 1 : page)
                    setLedgerPageSize(pageSize)
                  }}
                  onShowSizeChange={(_page, pageSize) => {
                    setLedgerPage(1)
                    setLedgerPageSize(pageSize)
                  }}
                />
              </Space>
            </div>
            <ConfigProvider
              theme={{
                token: {
                  colorBgContainer: '#ffffff',
                  colorText: '#1f2937',
                  colorTextSecondary: '#64748b',
                  colorBorderSecondary: '#e5eaf3',
                },
                components: {
                  Table: {
                    headerBg: '#f7f9fc',
                    headerColor: '#334155',
                    rowHoverBg: '#f2f7ff',
                    rowSelectedBg: '#e6f4ff',
                    rowSelectedHoverBg: '#dbeafe',
                    bodySortBg: '#ffffff',
                    borderColor: '#e5eaf3',
                    fixedHeaderSortActiveBg: '#f7f9fc',
                    headerSortActiveBg: '#edf4ff',
                    headerSortHoverBg: '#edf4ff',
                  },
                },
              }}
            >
              <Table<AssetArchiveDisplayRow>
                className="asset-ledger-data-table"
                rowKey="id"
                loading={loading}
                dataSource={pagedRows}
                columns={columns}
                size="small"
                pagination={false}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={(
                        <div className="asset-ledger-empty-state">
                          <strong>未找到匹配设备</strong>
                          <span>可尝试更换设备名称、型号、SN、使用科室或档案编号关键词。</span>
                          <Space size={8}>
                            <Button size="small" onClick={() => applyFilterPatch({ keyword: '' })}>清空搜索条件</Button>
                            <Button size="small" type="primary" onClick={resetFilters}>返回全部档案</Button>
                          </Space>
                        </div>
                      )}
                    />
                  ),
                }}
                rowClassName={(row) => (selectedRowKeys.includes(row.id) || row.id === highlightedId ? 'asset-ledger-row-selected' : '')}
                rowSelection={{
                  selectedRowKeys,
                  fixed: true,
                  preserveSelectedRowKeys: true,
                  onChange: (keys) => setSelectedRowKeys(keys),
                  columnWidth: 40,
                }}
                onRow={(row) => ({
                  onClick: () => {
                    setSelectedId(row.id)
                    setHighlightedId(row.id)
                  },
                  onDoubleClick: () => openArchiveDrawer(row),
                })}
                sticky
                scroll={{ x: 1880, y: 'calc(100vh - 278px)' }}
              />
            </ConfigProvider>
          </section>
        </main>
      </section>

      <Drawer
        title="列设置"
        width={360}
        open={columnSettingsOpen}
        onClose={() => setColumnSettingsOpen(false)}
        destroyOnHidden
      >
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Text type="secondary">选择档案列表中需要显示的字段。序号和设备信息为固定基础列。</Text>
          <Checkbox.Group
            value={visibleColumnKeys}
            onChange={(keys) => {
              const next = Array.from(new Set(['index', 'device', ...keys.map(String)]))
              setVisibleColumnKeys(next)
            }}
            style={{ width: '100%' }}
          >
            <div className="asset-ledger-column-settings">
              {columnOptions.map((item) => (
                <Checkbox key={item.key} value={item.key} disabled={item.locked}>
                  {item.label}
                </Checkbox>
              ))}
            </div>
          </Checkbox.Group>
          <Space>
            <Button onClick={() => setVisibleColumnKeys(defaultLedgerVisibleColumns)}>恢复默认</Button>
            <Button type="primary" onClick={() => setColumnSettingsOpen(false)}>完成</Button>
          </Space>
        </Space>
      </Drawer>

      <Drawer
        title="高级筛选"
        width={560}
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="department" label="使用科室">
                <Select allowClear showSearch placeholder="全部" options={ARCHIVE_DEPARTMENT_OPTIONS.map((x) => ({ label: x, value: x }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category_code" label="设备分类">
                <Select allowClear placeholder="全部" options={ARCHIVE_CATEGORY_FILTERS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="archive_status" label="档案状态">
                <Select allowClear placeholder="全部" options={archiveStatusOptions.map((x) => ({ label: x, value: x }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="main_status" label="设备状态">
                <Select allowClear placeholder="全部" options={(['在用', '维修中', '停用', '待报废', '已报废'] as RunDisplayLabel[]).map((x) => ({ label: x, value: x }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="risk_level" label="风险等级">
                <Select allowClear placeholder="全部" options={(['高风险', '中风险', '低风险'] as RiskDisplayLabel[]).map((x) => ({ label: x, value: x }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="metrology" label="计量状态">
                <Select allowClear placeholder="全部" options={(['正常', '即将到期', '已过期', '不适用'] as MetrologyDisplayLabel[]).map((x) => ({ label: x, value: x }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pm_status" label="PM状态">
                <Select allowClear placeholder="全部" options={(['正常', '临近', '超时'] as PmStatusLabel[]).map((x) => ({ label: x, value: x }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="classification_match_status" label="分类匹配状态">
                <Select allowClear placeholder="全部" options={classificationStatusOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="classification_change_status" label="分类变更提醒">
                <Select
                  allowClear
                  placeholder="全部"
                  options={[
                    { label: '需处理', value: 'pending' },
                    { label: '已失效', value: 'expired' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="engineer" label="责任工程师">
                <Select allowClear showSearch placeholder="全部" options={engineerOptions.map((x) => ({ label: x, value: x }))} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="install_range" label="启用日期范围">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_large_equipment" label="大型设备">
                <Select allowClear placeholder="全部" options={[{ label: '是', value: 'yes' }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_life_support" label="生命支持类">
                <Select allowClear placeholder="全部" options={[{ label: '是', value: 'yes' }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_emergency" label="是否急救设备">
                <Select allowClear placeholder="全部" options={[{ label: '是', value: 'yes' }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="attachment_status" label="附件状态">
                <Select allowClear placeholder="全部" options={(['完整', '部分缺失', '无附件'] as AttachmentStatus[]).map((x) => ({ label: x, value: x }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="code_status" label="编码状态">
                <Select allowClear placeholder="全部" options={(['正常', '重复', '缺失', '规则不符'] as CodeStatus[]).map((x) => ({ label: x, value: x }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="filing_source" label="建档来源">
                <Select allowClear placeholder="全部" options={filingSourceOptions.map((x) => ({ label: x, value: x }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="audit_status" label="审核状态">
                <Select allowClear placeholder="全部" options={(['草稿', '待审核', '已审核', '退回修改'] as AuditStatus[]).map((x) => ({ label: x, value: x }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="completeness" label="档案完整性">
                <Select allowClear placeholder="全部" options={(['完整', '缺采购资料', '缺验收资料', '缺合同发票', '缺计量记录', '缺维修记录', '缺使用科室确认'] as CompletenessFilter[]).map((x) => ({ label: x, value: x }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="missing_doc" label="缺失资料">
                <Select allowClear placeholder="全部" options={(['合同', '发票', '验收单', '注册证', '计量证书', 'PM记录', '维修记录', '培训记录', '补充质控记录'] as MissingDocFilter[]).map((x) => ({ label: x, value: x }))} />
              </Form.Item>
            </Col>
          </Row>
          <Space className="asset-ledger-advanced-actions">
            <Button type="primary" icon={<SearchOutlined />} onClick={() => { applyFilters(); setAdvancedOpen(false) }}>应用筛选</Button>
            <Button onClick={resetFilters}>重置全部</Button>
          </Space>
        </Form>
      </Drawer>

      <Drawer
        className="asset-ledger-drawer"
        width={980}
        open={drawerOpen && selectedRow != null}
        onClose={closeDrawer}
        title={
          selectedRow && selectedProfile ? (
            <div className="asset-ledger-drawer-title">
              <div className="asset-ledger-drawer-top-grid">
                <section className="asset-ledger-drawer-top-card asset-ledger-drawer-top-card--identity">
                  <span className="asset-ledger-drawer-top-card__label">设备身份</span>
                  <div className="asset-ledger-drawer-title__identity">
                    <Title level={4}>{selectedRow.asset_name}</Title>
                    <Text code copyable>{formatArchiveAssetCode(selectedRow.asset_code, selectedRow.id)}</Text>
                  </div>
                  <div className="asset-ledger-drawer-identity-meta">
                    <span>品牌型号：{selectedRow.brand_vendor} / {selectedRow.spec_model}</span>
                    <span>使用科室：{selectedRow.department_name}</span>
                  </div>
                </section>

                <section className="asset-ledger-drawer-top-card">
                  <span className="asset-ledger-drawer-top-card__label">状态摘要</span>
                  <div className="asset-ledger-drawer-status-list">
                    <div>
                      <span>设备状态</span>
                      <Tag color={runTagColor(selectedRow.run_display)}>{selectedRow.run_display}</Tag>
                    </div>
                    <div>
                      <span>档案状态</span>
                      <Tag color={archiveStatusColor(selectedProfile.status)}>{selectedProfile.status}</Tag>
                    </div>
                    <div>
                      <span>风险等级</span>
                      <Tag color={riskTagColor(selectedRow.risk_display)}>{selectedRow.risk_display}</Tag>
                    </div>
                    <div>
                      <span>数据可信度</span>
                      {selectedCredibility ? <Tag color={selectedCredibility.color}>{selectedCredibility.label}</Tag> : <Tag>待确认</Tag>}
                    </div>
                    <div>
                      <span>责任工程师</span>
                      <strong>{selectedProfile.engineer}</strong>
                    </div>
                  </div>
                </section>

                <section className="asset-ledger-drawer-top-card asset-ledger-drawer-top-card--quality">
                  <span className="asset-ledger-drawer-top-card__label">档案质量</span>
                  <div className="asset-ledger-drawer-quality-main">
                    <Progress type="circle" percent={selectedProfile.completeness} size={48} strokeColor={completenessStrokeColor(completenessSeverity(selectedRow, selectedProfile))} />
                    <div>
                      <Space size={[4, 4]} wrap>
                        <Tag color={selectedProfile.completeness >= 95 ? 'green' : selectedProfile.completeness >= 80 ? 'gold' : 'red'}>
                          完整度 {selectedProfile.completeness}%
                        </Tag>
                        <Tag color={selectedProfile.missing.length ? 'gold' : 'green'}>{completenessText(selectedProfile)}</Tag>
                        <Tag color={selectedProfile.auditStatus === '已审核' ? 'green' : selectedProfile.auditStatus === '待审核' ? 'blue' : selectedProfile.auditStatus === '退回修改' ? 'red' : 'default'}>
                          {selectedProfile.auditStatus}
                        </Tag>
                      </Space>
                      <p>最近更新 {selectedProfile.updatedDate} ｜ 建档来源 {selectedProfile.filingSource}</p>
                    </div>
                  </div>
                  <div className="asset-ledger-drawer-quality-detail">
                    <div>
                      <span>缺失资料</span>
                      <Space size={[4, 4]} wrap>
                        {selectedProfile.missing.length ? (
                          selectedProfile.missing.slice(0, 5).map((x) => <Tag color="gold" key={x}>{x}</Tag>)
                        ) : (
                          <Tag color="green">资料齐全</Tag>
                        )}
                        {selectedProfile.missing.length > 5 ? <Tag>+{selectedProfile.missing.length - 5}</Tag> : null}
                      </Space>
                    </div>
                    <div>
                      <span>待处理事项</span>
                      <Space size={[4, 4]} wrap>
                        {archivePendingTasks(selectedProfile).map((x) => (
                          <Tag color={x === '暂无待处理事项' ? 'green' : 'orange'} key={x}>{x}</Tag>
                        ))}
                      </Space>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : null
        }
      >
        {selectedRow && selectedProfile && selectedMetrics ? (
          <>
            <div className="asset-ledger-drawer-action-bar">
              <div>
                <strong>档案操作</strong>
                <span>编辑、附件、打印与二维码操作均纳入档案留痕</span>
              </div>
              <Space size={8} wrap>
                <Button size="small" icon={<EditOutlined />} onClick={() => message.info('编辑档案将进入审批留痕流程')}>编辑档案</Button>
                <Button size="small" icon={<UploadOutlined />} onClick={() => handleUploadMissingAttachments(selectedRow)}>上传缺失附件</Button>
                <Button size="small" icon={<ThunderboltOutlined />} onClick={() => handleGenerateTasks([selectedRow], '单设备AI风险建议')}>生成治理事项</Button>
                <Button size="small" icon={<AuditOutlined />} onClick={() => handleApproveArchive(selectedRow)}>审核通过</Button>
                <Button size="small" icon={<PrinterOutlined />} onClick={() => openPrintPanel([selectedRow])}>打印档案卡</Button>
                <Button size="small" icon={<QrcodeOutlined />} onClick={() => setQrRow(selectedRow)}>查看二维码</Button>
              </Space>
            </div>
            <div className="asset-ledger-device-ai">
              {buildDeviceAiSuggestions(selectedRow, selectedProfile, selectedMetrics).map((item) => (
                <section key={item.title}>
                  <div>
                    <RobotOutlined />
                    <strong>{item.title}</strong>
                  </div>
                  <p>{item.text}</p>
                  <span>依据：{item.basis}</span>
                </section>
              ))}
            </div>
            <button type="button" className="asset-ledger-lifecycle-summary" onClick={() => setDrawerTab('lifecycle')}>
              {buildLifecycleSummary(selectedRow, selectedProfile).map((item) => (
                <span key={item.label}>
                  <em>{item.label}</em>
                  <strong>{item.value}</strong>
                </span>
              ))}
            </button>
            {getArchiveRuntime(selectedRow).tasks?.length ? (
              <section className="asset-ledger-task-strip">
                <div>
                  <strong>档案治理事项</strong>
                  <span>由AI体检或风险建议生成，随档案一并留痕；执行在对应业务模块闭环。</span>
                </div>
                <Space wrap>
                  {getArchiveRuntime(selectedRow).tasks!.slice(0, 4).map((task) => (
                    <Tag color={task.status === '已完成' ? 'green' : 'orange'} key={task.id}>
                      {task.title} · {task.owner} · {task.due}
                    </Tag>
                  ))}
                </Space>
              </section>
            ) : null}
            <Tabs
              activeKey={drawerTab}
              onChange={setDrawerTab}
              items={[
              {
                key: 'base',
                label: '基本信息',
                children: (
                  <div className="asset-ledger-info-groups">
                    <section>
                      <h5>设备身份</h5>
                      <InfoGrid rows={[
                        ['设备名称', selectedRow.asset_name, '设备分类', selectedRow.category_label],
                        ['品牌', selectedRow.brand_vendor, '型号', selectedRow.spec_model],
                        ['规格', selectedRow.spec_model, '序列号', selectedRow.serial_number ?? '—'],
                        ['注册证号', selectedRow.registration_no ?? '—'],
                      ]} />
                    </section>
                    <section>
                      <h5>院内编码</h5>
                      <InfoGrid rows={[
                        ['资产编号', selectedRow.asset_code, '院内设备编号', formatArchiveAssetCode(selectedRow.asset_code, selectedRow.id)],
                        ['RFID编码', selectedMetrics.rfid, '二维码', selectedMetrics.qrCode],
                      ]} />
                    </section>
                    <section>
                      <h5>使用归属</h5>
                      <InfoGrid rows={[
                        ['使用科室', selectedRow.department_name, '存放地点', selectedRow.location_text],
                        ['责任工程师', selectedProfile.engineer, '启用日期', selectedRow.install_display],
                      ]} />
                    </section>
                    <section>
                      <h5>监管属性</h5>
                      <InfoGrid rows={[
                        ['风险等级', selectedRow.risk_display, '是否急救设备', selectedRow.is_critical_care ? '是' : '否'],
                        ['是否生命支持类', selectedRow.is_critical_care ? '是' : '否', '是否大型医用设备', selectedRow.is_large_equipment ? '是' : '否'],
                        ['是否计量设备', selectedRow.is_metrology_device ? '是' : '否'],
                      ]} />
                    </section>
                    <section>
                      <h5>档案来源与审核</h5>
                      <InfoGrid rows={[
                        ['建档来源', selectedProfile.filingSource, '审核状态', selectedProfile.auditStatus],
                        ['附件状态', selectedProfile.attachmentStatus, '编码状态', selectedProfile.codeStatus],
                        ['补录原因', getArchiveRuntime(selectedRow).supplementReason ?? '—'],
                        ['数据来源', getArchiveRuntime(selectedRow).sourceLabel ?? '资产台账、采购验收、维修/PM/计量记录综合生成'],
                      ]} />
                    </section>
                  </div>
                ),
              },
              {
                key: 'classification',
                label: '标准分类',
                children: (
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    <Alert
                      showIcon
                      type={selectedRow.classification_match_status === 'need_review' || selectedRow.classification_change_status === 'pending' ? 'warning' : selectedRow.classification_match_status === 'expired' ? 'error' : 'info'}
                      message={selectedRow.mdm_category_name || selectedRow.classification_name || '尚未确认 H-UMDG 医疗器械分类'}
                      description="医学装备档案库仅保存 H-UMDG 分类目录引用和确认状态；目录变更后生成提醒和复核任务，不自动覆盖档案。"
                    />
                    <Descriptions bordered size="small" column={{ xs: 1, md: 2 }}>
                      <Descriptions.Item label="主数据来源">{selectedRow.mdm_source === 'h-mdm' ? 'H-UMDG' : '—'}</Descriptions.Item>
                      <Descriptions.Item label="分类编码">{selectedRow.mdm_category_code || selectedRow.classification_code || selectedRow.hmdm_equipment_category_code || '—'}</Descriptions.Item>
                      <Descriptions.Item label="分类名称">{selectedRow.mdm_category_name || selectedRow.classification_name || selectedRow.hmdm_standard_name || '—'}</Descriptions.Item>
                      <Descriptions.Item label="分类路径">{selectedRow.mdm_category_path || '—'}</Descriptions.Item>
                      <Descriptions.Item label="管理类别">{selectedRow.management_class || selectedRow.hmdm_management_class || '—'}</Descriptions.Item>
                      <Descriptions.Item label="主数据版本">{selectedRow.mdm_category_version || selectedRow.classification_version_id || '—'}</Descriptions.Item>
                      <Descriptions.Item label="最近同步时间">{selectedRow.mdm_synced_at?.slice(0, 19).replace('T', ' ') || '—'}</Descriptions.Item>
                      <Descriptions.Item label="分类状态">
                        <Tag color={classificationStatusColor(selectedRow.classification_match_status)}>
                          {classificationStatusLabel(selectedRow.classification_match_status)}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="匹配方式">{selectedRow.classification_match_method || '—'}</Descriptions.Item>
                      <Descriptions.Item label="匹配分数">{selectedRow.classification_match_score ?? '—'}</Descriptions.Item>
                      <Descriptions.Item label="确认人">{selectedRow.classification_confirmed_by || '—'}</Descriptions.Item>
                      <Descriptions.Item label="确认时间">{selectedRow.classification_confirmed_at?.slice(0, 19).replace('T', ' ') || '—'}</Descriptions.Item>
                      <Descriptions.Item label="最近变更提醒">
                        {selectedRow.classification_change_status === 'pending' || selectedRow.classification_match_status === 'need_review' ? <Tag color="orange">需复核</Tag> : selectedRow.classification_match_status === 'expired' ? <Tag color="red">原分类已失效</Tag> : <Tag color="green">暂无影响</Tag>}
                      </Descriptions.Item>
                    </Descriptions>
                    <Space wrap>
                      <Button icon={<DatabaseOutlined />} onClick={() => message.info('已记录查看 H-UMDG 标准目录详情动作；联调时打开外部 H-UMDG 详情页')}>
                        查看 H-UMDG 标准目录详情
                      </Button>
                      <Button icon={<SearchOutlined />} onClick={() => message.info('重新匹配将调用 /api/v1/master-data/device-classification/match 返回多个候选项')}>
                        重新匹配分类
                      </Button>
                      <Button onClick={() => message.info('确认当前分类将调用 classification-bind 并写入绑定日志')}>确认当前分类</Button>
                      <Button onClick={() => message.info('变更影响来自 equipment_classification_impact，需人工确认、调整或忽略')}>查看变更影响</Button>
                      <Button onClick={() => message.info('忽略本次变更将更新影响记录状态为 ignored')}>忽略本次变更</Button>
                      <Button type="primary" onClick={() => message.info('调整为新分类需要进入设备详情页，通过 H-UMDG 主数据选择器重新绑定')}>调整为新分类</Button>
                    </Space>
                  </Space>
                ),
              },
              {
                key: 'structure',
                label: '档案结构树',
                children: (() => {
                  const model = modelArchiveForRow(selectedRow)
                  const project = projectArchiveForRow(selectedRow)
                  const structure = structureSummaryForRow(selectedRow)
                  const kitMode = isKitArchiveRow(selectedRow)
                  return (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Alert
                        type="info"
                        showIcon
                        message={`${structure.mode} · ${structure.title}档案结构`}
                        description={kitMode ? '系统级资料、组件清单、随机附件、维修/PM/计量质控和生命周期记录分层管理。' : '项目资料、型号公共资料、本机个性化资料和业务记录分层管理，同型号公共资料自动继承。'}
                      />
                      <div className="asset-ledger-structure-tree">
                        <section>
                          <strong>{kitMode ? '设备系统' : '设备'}</strong>
                          <span>{selectedRow.asset_name}</span>
                          <small>{formatArchiveAssetCode(selectedRow.asset_code, selectedRow.id)} / SN {selectedRow.serial_number ?? '—'}</small>
                        </section>
                        <section>
                          <strong>采购项目档案</strong>
                          <span>{project.name}</span>
                          <small>合同 {project.contractNo} / {project.supplier} / {project.amount}</small>
                        </section>
                        <section>
                          <strong>型号资料档案</strong>
                          <span>{model.brand} {model.model}</span>
                          <small>公共资料：{model.commonDocs.join('、')}；已继承 {model.inheritedCount} 台</small>
                        </section>
                        <section>
                          <strong>{kitMode ? '系统/本机资料' : '单台设备档案'}</strong>
                          <span>铭牌照片、序列号、使用科室、存放地点、启用日期、责任工程师</span>
                          <small>本机独有资料，不重复保存型号说明书和注册证</small>
                        </section>
                        {kitMode ? (
                          <section>
                            <strong>组件/附件档案</strong>
                            <span>{laparoscopeComponents.length} 个组件与附件</span>
                            <small>图像处理主机、冷光源、CCD手柄、显示器、气腹机、电刀等可独立追踪</small>
                          </section>
                        ) : null}
                        <section>
                          <strong>生命周期记录</strong>
                          <span>维修记录、PM记录、计量记录、转科记录、报废记录</span>
                          <small>来源：维修、PM闭环、计量监管、资产处置等业务模块</small>
                        </section>
                      </div>
                      <Row gutter={12}>
                        <Col span={12}>
                          <section className="asset-ledger-inherited-docs">
                            <h5>公共资料：来自型号档案</h5>
                            <Space size={[4, 4]} wrap>
                              {model.commonDocs.map((item) => <Tag color="blue" key={item}>{item}</Tag>)}
                            </Space>
                          </section>
                        </Col>
                        <Col span={12}>
                          <section className="asset-ledger-inherited-docs">
                            <h5>本机资料：本机独有</h5>
                            <Space size={[4, 4]} wrap>
                              {['铭牌照片', '序列号', '设备编号', '使用科室', '维修记录', 'PM记录', '计量记录'].map((item) => <Tag color="green" key={item}>{item}</Tag>)}
                            </Space>
                          </section>
                        </Col>
                      </Row>
                      {kitMode ? (
                        <Table<KitComponent>
                          size="small"
                          rowKey={(row) => row.name}
                          dataSource={laparoscopeComponents}
                          pagination={false}
                          columns={[
                            { title: '组件名称', dataIndex: 'name', width: 130 },
                            { title: '型号', dataIndex: 'model', width: 130 },
                            { title: '序列号', dataIndex: 'serial', width: 120 },
                            { title: '独立编号', dataIndex: 'independentCode', width: 90, render: (value: boolean) => <Tag color={value ? 'blue' : 'default'}>{value ? '是' : '否'}</Tag> },
                            { title: '独立维修', dataIndex: 'independentRepair', width: 90, render: (value: boolean) => <Tag color={value ? 'blue' : 'default'}>{value ? '是' : '否'}</Tag> },
                            { title: '计量/质控', dataIndex: 'metrologyQc', width: 90, render: (value: boolean) => <Tag color={value ? 'purple' : 'default'}>{value ? '是' : '否'}</Tag> },
                            { title: '备注', dataIndex: 'note' },
                          ]}
                        />
                      ) : null}
                    </Space>
                  )
                })(),
              },
              {
                key: 'finance',
                label: '合同发票',
                children: (
                  <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="资产原值">{moneyCn(selectedRow.original_value)}</Descriptions.Item>
                    <Descriptions.Item label="购置日期">{formatDate(selectedRow.purchase_date)}</Descriptions.Item>
                    <Descriptions.Item label="合同编号">{archiveContractRows(selectedRow)[0]?.contract_no}</Descriptions.Item>
                    <Descriptions.Item label="供应商">{archiveContractRows(selectedRow)[0]?.supplier}</Descriptions.Item>
                    <Descriptions.Item label="发票号">{archiveContractRows(selectedRow)[0]?.invoice_no}</Descriptions.Item>
                    <Descriptions.Item label="付款状态">{archiveContractRows(selectedRow)[0]?.pay_status}</Descriptions.Item>
                    <Descriptions.Item label="数据来源">合同系统 / 发票OCR / 财务付款台账</Descriptions.Item>
                    <Descriptions.Item label="财务归口">财务科 / 医学装备科</Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'purchase',
                label: '采购验收',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Table
                      size="small"
                      pagination={false}
                      rowKey={(row) => row.contract_no}
                      dataSource={archiveContractRows(selectedRow)}
                      columns={[
                        { title: '合同编号', dataIndex: 'contract_no' },
                        { title: '供应商', dataIndex: 'supplier' },
                        { title: '发票号', dataIndex: 'invoice_no' },
                        { title: '金额', dataIndex: 'amount' },
                        { title: '验收单', dataIndex: 'acceptance_no', width: 130 },
                        { title: '验收日期', dataIndex: 'acceptance_date', width: 110 },
                        { title: '付款状态', dataIndex: 'pay_status', width: 120 },
                      ]}
                    />
                    <Descriptions bordered size="small" column={3}>
                      <Descriptions.Item label="验收照片">开箱照、铭牌照、安装现场照</Descriptions.Item>
                      <Descriptions.Item label="铭牌照片">{selectedRow.asset_code}_铭牌.jpg</Descriptions.Item>
                      <Descriptions.Item label="合格证">{selectedRow.asset_code}_合格证.jpg</Descriptions.Item>
                      <Descriptions.Item label="注册证">{selectedRow.registration_no ?? '—'}</Descriptions.Item>
                      <Descriptions.Item label="启用日期">{selectedRow.install_display}</Descriptions.Item>
                      <Descriptions.Item label="数据来源">验收单、附件中心、采购合同</Descriptions.Item>
                    </Descriptions>
                  </Space>
                ),
              },
              {
                key: 'repair',
                label: '维修记录',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Alert type="info" showIcon message="数据来源：维修工单、外修/返厂记录、维修附件归档" />
                    <Table
                      size="small"
                      pagination={false}
                      rowKey="code"
                      dataSource={mockRepairRows(selectedRow)}
                      columns={[
                        { title: '工单号', dataIndex: 'code', width: 130 },
                        { title: '维修日期', dataIndex: 'date', width: 110 },
                        { title: '故障描述', dataIndex: 'fault' },
                        { title: '费用', dataIndex: 'cost', width: 130 },
                        { title: '结果', dataIndex: 'result', width: 90 },
                      ]}
                    />
                  </Space>
                ),
              },
              {
                key: 'pm',
                label: 'PM保养',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Alert type={selectedMetrics.pmStatus === '超时' ? 'warning' : 'info'} showIcon message={`PM状态：${selectedMetrics.pmStatus}，数据来源：PM计划、PM执行记录、质控报告`} />
                    <Table
                      size="small"
                      pagination={false}
                      rowKey={(row) => `${row.plan}-${row.done_at}`}
                      dataSource={mockPmRows(selectedRow)}
                      columns={[
                        { title: '保养计划', dataIndex: 'plan' },
                        { title: '保养项目', dataIndex: 'item' },
                        { title: '执行人', dataIndex: 'executor', width: 170 },
                        { title: '执行日期', dataIndex: 'done_at', width: 110 },
                        { title: '结果', dataIndex: 'result', width: 90 },
                      ]}
                    />
                  </Space>
                ),
              },
              {
                key: 'meter',
                label: '计量校准',
                children: mockCalRows(selectedRow).length ? (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Alert type={selectedRow.metrology_display === '正常' ? 'info' : 'warning'} showIcon message={`计量状态：${selectedRow.metrology_display}，数据来源：计量台账、检定计划、证书管理`} />
                    <Table
                      size="small"
                      pagination={false}
                      rowKey={(row) => row.cert_no}
                      dataSource={mockCalRows(selectedRow)}
                      columns={[
                        { title: '检定日期', dataIndex: 'cal_date', width: 110 },
                        { title: '到期日期', dataIndex: 'due_date', width: 110 },
                        { title: '检定机构', dataIndex: 'org' },
                        { title: '证书编号', dataIndex: 'cert_no' },
                        { title: '结果', dataIndex: 'result', width: 80 },
                      ]}
                    />
                  </Space>
                ) : (
                  <Empty description="非计量设备或暂无证书记录" />
                ),
              },
              {
                key: 'quality-risk',
                label: '风险监管',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div className="asset-ledger-risk-summary-grid">
                      <section>
                        <span>风险等级</span>
                        <Tag color={riskTagColor(selectedRow.risk_display)}>{selectedRow.risk_display}</Tag>
                      </section>
                      <section>
                        <span>计量状态</span>
                        <Tag color={selectedRow.metrology_display === '已过期' ? 'red' : selectedRow.metrology_display === '即将到期' ? 'gold' : 'green'}>{selectedRow.metrology_display}</Tag>
                      </section>
                      <section>
                        <span>PM状态</span>
                        <Tag color={selectedMetrics.pmStatus === '超时' ? 'red' : selectedMetrics.pmStatus === '临近' ? 'gold' : 'green'}>{selectedMetrics.pmStatus}</Tag>
                      </section>
                      <section>
                        <span>档案完整度</span>
                        <Tag color={selectedProfile.completeness >= 95 ? 'green' : selectedProfile.completeness >= 80 ? 'gold' : 'red'}>{selectedProfile.completeness}%</Tag>
                      </section>
                    </div>
                    <Table
                      size="small"
                      pagination={false}
                      rowKey="item"
                      dataSource={mockRiskRows(selectedRow)}
                      columns={[
                        { title: '质控项', dataIndex: 'item', width: 130 },
                        { title: '当前值', dataIndex: 'value' },
                        { title: '状态', dataIndex: 'status', width: 110 },
                      ]}
                    />
                    <div className="asset-ledger-missing-list">
                      <strong>风险相关缺失项</strong>
                      {selectedProfile.missing.length ? (
                        <Space wrap>{selectedProfile.missing.slice(0, 8).map((x) => <Tag color="gold" key={x}>{x}</Tag>)}{selectedProfile.missing.length > 8 ? <Tag>+{selectedProfile.missing.length - 8}</Tag> : null}</Space>
                      ) : (
                        <Tag color="green">档案资料完整</Tag>
                      )}
                      <Text type="secondary">完整资料项清单已归入“附件资料”页，风险页仅展示影响监管判断的摘要。</Text>
                    </div>
                  </Space>
                ),
              },
              {
                key: 'attachments',
                label: '附件资料',
                children: (
                  <Table
                    size="small"
                    pagination={false}
                    rowKey={(row) => row.name}
                    dataSource={buildAttachmentRows(selectedProfile)}
                    columns={[
                      { title: '资料类型', dataIndex: 'type', width: 110 },
                      { title: '文件名', dataIndex: 'name', ellipsis: true },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        width: 110,
                        render: (value: string) => <Tag color={value === '缺失' ? 'gold' : value === '待审核' ? 'blue' : 'green'}>{value}</Tag>,
                      },
                      {
                        title: '操作',
                        width: 100,
                        render: (_, record) => record.status === '缺失' ? <Button type="link" size="small" onClick={() => handleUploadMissingAttachments(selectedRow, [record.name])}>上传</Button> : <Text type="secondary">可预览</Text>,
                      },
                    ]}
                  />
                ),
              },
              {
                key: 'lifecycle',
                label: '生命周期',
                children: (
                  <Timeline
                    items={buildLifecycleTimeline(selectedRow).map((item) => ({
                      color: item.status === '待处理' ? 'red' : item.status === '未触发' ? 'gray' : 'blue',
                      children: (
                        <div className="asset-ledger-timeline-item">
                          <strong>{item.title}</strong>
                          <p>{item.time} · 经办人：{item.handler}</p>
                          <p>关联单据：{item.document} · 当前状态：{item.status} · 数据来源：{item.source}</p>
                        </div>
                      ),
                    }))}
                  />
                ),
              },
              ]}
            />
            <section className="asset-ledger-risk-tips">
              <h5>风险提示</h5>
              <div>
                {buildArchiveRiskTips(selectedRow, selectedProfile, selectedMetrics).map((tip) => (
                  <p className={`asset-ledger-risk-tip asset-ledger-risk-tip--${tip.level}`} key={tip.text}>{tip.text}</p>
                ))}
              </div>
            </section>
          </>
        ) : (
          <Empty description="请选择设备档案" />
        )}
      </Drawer>

      <FilingSourceModal
        rows={rows}
        open={filingModalOpen}
        initialSource={filingInitialSource}
        onClose={() => setFilingModalOpen(false)}
        onConfirm={handleFilingConfirm}
      />
      <GovernanceModal rows={rows} open={governanceModalOpen} onClose={() => setGovernanceModalOpen(false)} />
      <SmartArchiveModal
        mode={smartArchiveMode}
        open={smartArchiveOpen}
        onClose={() => setSmartArchiveOpen(false)}
        onModeChange={setSmartArchiveMode}
      />

      <Modal
        title={checklist.title}
        open={checklistOpen}
        onCancel={() => setChecklistOpen(false)}
        width={940}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={() => setChecklistOpen(false)}>关闭</Button>,
          <Button
            key="confirm"
            type="primary"
            icon={<ExportOutlined />}
            onClick={() => message.success(`已生成${checklist.title}，共 ${checklist.items.length} 台，后续可导出或推送到对应业务模块`)}
          >
            生成清单
          </Button>,
        ]}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="info"
            message={`${checklist.title} · 当前筛选命中 ${checklist.items.length} 台`}
            description={`范围：${checklist.scope}；建议责任角色：${checklist.owner}。档案库只生成治理清单，计量、PM、维修、报废等处理在对应模块按批次和计划闭环。`}
          />
          <Table<AssetArchiveDisplayRow>
            size="small"
            rowKey="id"
            dataSource={checklist.items}
            pagination={{ pageSize: 5, showTotal: (total) => `共 ${total} 台` }}
            onRow={(row) => ({ onClick: () => openArchiveDrawer(row) })}
            columns={[
              {
                title: '设备信息',
                render: (_, row) => (
                  <Space direction="vertical" size={0}>
                    <Text strong>{row.asset_name}</Text>
                    <Text type="secondary">{formatArchiveAssetCode(row.asset_code, row.id)} / SN {row.serial_number ?? '—'}</Text>
                  </Space>
                ),
              },
              { title: '使用科室', width: 120, dataIndex: 'department_name' },
              {
                title: '档案质量',
                width: 160,
                render: (_, row) => {
                  const profile = buildArchiveProfile(row)
                  return (
                    <Space size={4} wrap>
                      <Tag color={archiveStatusColor(profile.status)}>{profile.status}</Tag>
                      <Tag color={profile.missing.length ? 'orange' : 'green'}>{profile.completeness}%</Tag>
                    </Space>
                  )
                },
              },
              {
                title: '监管属性',
                width: 150,
                render: (_, row) => (
                  <Space size={[4, 4]} wrap>
                    {row.risk_display === '高风险' ? <Tag color="red">高风险</Tag> : null}
                    {row.is_large_equipment ? <Tag color="blue">大型</Tag> : null}
                    {row.is_critical_care ? <Tag color="red">生命支持</Tag> : null}
                    {row.is_metrology_device ? <Tag color="purple">计量</Tag> : null}
                  </Space>
                ),
              },
              {
                title: '计量/PM',
                width: 150,
                render: (_, row) => (
                  <Space size={4} wrap>
                    <Tag color={metrologyArchiveStatus(row) === '超期' ? 'red' : metrologyArchiveStatus(row) === '临期' ? 'gold' : 'green'}>计量 {metrologyArchiveStatus(row)}</Tag>
                    <Tag color={pmArchiveStatus(row) === '逾期' ? 'red' : pmArchiveStatus(row) === '临期' ? 'gold' : 'green'}>PM {pmArchiveStatus(row)}</Tag>
                  </Space>
                ),
              },
              {
                title: '来源模块',
                width: 120,
                render: (_, row) => sourceModuleText(row, buildArchiveProfile(row)),
              },
            ]}
          />
        </Space>
      </Modal>

      <Modal
        title="保存筛选方案"
        open={savePlanOpen}
        onCancel={() => setSavePlanOpen(false)}
        onOk={() => {
          const name = planName.trim() || `筛选方案-${dayjs().format('MMDD-HHmm')}`
          setSavedPlans((prev) => [...prev, { name, scope: planScope, patch: { ...filters }, view: viewSelection }])
          setPlanName('')
          setSavePlanOpen(false)
          message.success(`筛选方案“${name}”已保存，可直接复用`)
        }}
        okText="保存方案"
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="方案名称，例如：高风险生命支持设备" />
          <Select value={planScope} onChange={setPlanScope} options={[{ label: '我的方案', value: '我的方案' }, { label: '科室共享方案', value: '科室共享方案' }]} />
          <div className="asset-ledger-plan-list">
            <strong>我的方案</strong>
            <Space wrap>
              {savedPlans.filter((x) => x.scope === '我的方案').map((plan) => (
                <Tag
                  color="blue"
                  key={plan.name}
                  onClick={() => {
                    const next = { ...defaultApplied, ...plan.patch }
                    form.setFieldsValue(next)
                    setFilters(next)
                    setViewSelection(plan.view ?? null)
                    setSavePlanOpen(false)
                  }}
                >
                  {plan.name}
                </Tag>
              ))}
            </Space>
          </div>
          <div className="asset-ledger-plan-list">
            <strong>科室共享方案</strong>
            <Space wrap>
              {savedPlans.filter((x) => x.scope === '科室共享方案').map((plan) => (
                <Tag
                  color="cyan"
                  key={plan.name}
                  onClick={() => {
                    const next = { ...defaultApplied, ...plan.patch }
                    form.setFieldsValue(next)
                    setFilters(next)
                    setViewSelection(plan.view ?? null)
                    setSavePlanOpen(false)
                  }}
                >
                  {plan.name}
                </Tag>
              ))}
            </Space>
          </div>
        </Space>
      </Modal>

      <Drawer
        title={aiPanelMode}
        width={520}
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        destroyOnHidden
      >
        <div className="asset-ledger-ai-panel">
          <div className="asset-ledger-ai-panel__summary">
            <RobotOutlined />
            <div>
              <strong>AI档案体检与批量治理建议</strong>
              <p>AI用于识别档案质量和监管风险，并建议生成批量治理清单；计量、PM、维修等执行动作在对应模块按计划闭环。</p>
            </div>
          </div>
          {aiInsights.map((item) => (
            <section className={`asset-ledger-ai-insight asset-ledger-ai-insight--${item.level}`} key={item.key}>
              <div>
                <strong>{item.title}</strong>
                <Tag color={item.level === 'high' ? 'red' : item.level === 'warning' ? 'gold' : 'green'}>{item.value}</Tag>
              </div>
              <p>{item.detail}</p>
              {item.action ? <span>{item.action}</span> : null}
            </section>
          ))}
          <Dropdown
            menu={{
              items: [
                { key: 'meter', label: '计量检测清单' },
                { key: 'pm', label: 'PM保养清单' },
                { key: 'missing', label: '档案缺项清单' },
                { key: 'attachment', label: '附件缺失清单' },
                { key: 'risk', label: '高风险设备清单' },
                { key: 'large', label: '大型设备监管清单' },
                { key: 'renewal', label: '报废更新论证清单' },
              ],
              onClick: ({ key }) => openChecklist(String(key)),
            }}
          >
            <Button type="primary" icon={<ThunderboltOutlined />}>
              生成治理清单 <DownOutlined />
            </Button>
          </Dropdown>
          <section className="asset-ledger-ai-examples">
            <strong>可直接输入的智能检索</strong>
            {['找出影像科档案不完整的大型设备', '哪些设备缺合同和发票', '找出PM逾期且计量临期的生命支持设备', '找出启用超过8年但仍在用的设备'].map((x) => (
              <button
                type="button"
                key={x}
                onClick={() => {
                  form.setFieldValue('keyword', x)
                  applyAiSmartSearch(x)
                }}
              >
                {x}
              </button>
            ))}
          </section>
        </div>
      </Drawer>

      <Drawer
        title="档案概览"
        width={720}
        open={statsDrawerOpen}
        onClose={() => setStatsDrawerOpen(false)}
        destroyOnHidden
      >
        <section className="asset-ledger-stat-strip asset-ledger-stat-strip--drawer">
          <div className="asset-ledger-stat-strip__meta">
            <span>设备总数 {compactStats.total}</span>
            <span>建档率 {compactStats.builtRate}%</span>
            <span>平均完整度 {compactStats.avg}%</span>
          </div>
          {stats.map((stat) => (
            <button
              type="button"
              key={stat.key}
              className={`asset-ledger-stat-pill asset-ledger-stat-pill--${stat.tone}`}
              onClick={() => {
                setStatFilter(('filter' in stat && stat.filter ? stat.filter : {}) as Partial<AppliedFilters>, 'custom' in stat ? stat.custom : undefined)
                setStatsDrawerOpen(false)
              }}
              aria-label={`筛选${stat.label}`}
            >
              <div className="asset-ledger-stat-pill__head">
                <span>{stat.label}</span>
              </div>
              <div className="asset-ledger-stat-pill__value">
                <strong>{stat.value}</strong>
                <em className={stat.delta >= 0 ? 'up' : 'down'}>{stat.delta >= 0 ? `↑${stat.delta}` : `↓${Math.abs(stat.delta)}`}</em>
              </div>
              <Sparkline values={stat.trend} tone={stat.tone} />
            </button>
          ))}
        </section>
      </Drawer>

      <Drawer
        title="智能档案能力"
        width={760}
        open={smartHubDrawerOpen}
        onClose={() => setSmartHubDrawerOpen(false)}
        destroyOnHidden
      >
        <section className="asset-ledger-smart-hub asset-ledger-smart-hub--drawer">
          <div className="asset-ledger-smart-hub__body-inner">
            <p>资料先进入AI收件箱，经识别、匹配、继承、人工确认后归档到项目/型号/单机/组件四级档案。</p>
            <div className="asset-ledger-smart-entry-grid">
              {[
                { key: 'inbox' as SmartArchiveMode, icon: <FileSearchOutlined />, title: 'AI资料收件箱', value: `${aiInboxDocuments.length} 份待识别`, note: '合同、发票、验收单、装箱单、证书、铭牌照片统一入口' },
                { key: 'nameplate' as SmartArchiveMode, icon: <QrcodeOutlined />, title: '批量铭牌识别建档', value: '200台同型号', note: 'OCR识别序列号，批量生成设备编号和二维码' },
                { key: 'kit' as SmartArchiveMode, icon: <PartitionOutlined />, title: '成套设备建档', value: `${kitRows.length || 1}套系统`, note: '系统主档案下挂组件、随机附件和可更换部件' },
                { key: 'model' as SmartArchiveMode, icon: <DatabaseOutlined />, title: '型号资料库', value: `${inheritedRows.length}台继承`, note: '说明书、注册证、培训资料按品牌型号共享继承' },
                { key: 'component' as SmartArchiveMode, icon: <AppstoreOutlined />, title: '附件/组件管理', value: `${laparoscopeComponents.length}个组件`, note: '区分资料、随机配件、功能组件、可更换部件和耗材附件' },
                { key: 'template' as SmartArchiveMode, icon: <FolderOpenOutlined />, title: '设备包模板', value: '腹腔镜模板', note: '内镜系统、检验流水线、中央监护等可复用结构' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className="asset-ledger-smart-entry"
                  onClick={() => {
                    setSmartHubDrawerOpen(false)
                    openSmartArchive(item.key)
                  }}
                >
                  <span>{item.icon}</span>
                  <strong>{item.title}</strong>
                  <em>{item.value}</em>
                  <small>{item.note}</small>
                </button>
              ))}
            </div>
            <div className="asset-ledger-archive-levels">
              {smartArchiveStats.map((item, index) => (
                <div key={item.label}>
                  <span>{index + 1}</span>
                  <strong>{item.label}</strong>
                  <em>{item.value}</em>
                  <small>{item.note}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Drawer>

      <Modal
        title="设备二维码"
        open={qrRow != null}
        onCancel={() => setQrRow(null)}
        footer={null}
        width={520}
        destroyOnHidden
      >
        {qrRow ? (
          <div className="asset-ledger-qr-card">
            <div className="asset-ledger-qr-card__code">
              <QrcodeOutlined />
            </div>
            <Space direction="vertical" size={6}>
              <Title level={5}>{qrRow.asset_name}</Title>
              <Text code>{formatArchiveAssetCode(qrRow.asset_code, qrRow.id)}</Text>
              <Text>RFID：{buildAssetTwinMetrics(qrRow).rfid}</Text>
              <Text>二维码内容：{buildAssetTwinMetrics(qrRow).qrCode}</Text>
              <Text type="secondary">用于设备档案卡、盘点扫码、维修工单和附件归档关联。</Text>
            </Space>
          </div>
        ) : null}
      </Modal>

      <Modal
        title={`打印档案卡${printTargets.length ? `（${printTargets.length}台）` : ''}`}
        open={printModalOpen}
        onCancel={() => setPrintModalOpen(false)}
        footer={null}
        width={920}
        destroyOnHidden
      >
        <AssetLabelPrintPanel targets={printTargets} title="设备档案标签打印" />
      </Modal>
    </div>
  )
}
