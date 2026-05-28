/**
 * 各业务列表 Mock 行（模拟真实医院资产与流程）
 */

import { DEVICE_NAMES, DEPTS, SUPPLIERS, pick } from './fixtures'

export type MockAssetRow = {
  id: string
  assetNo: string
  name: string
  spec: string
  brand: string
  category: string
  dept: string
  location: string
  startDate: string
  originalValue: number
  status: string
  owner: string
  qr: string
}

export type MockRepairRow = {
  id: string
  orderNo: string
  deviceName: string
  dept: string
  reporter: string
  fault: string
  urgent: string
  status: string
  engineer: string
  reportTime: string
  responseMin: number
  fee: number
}

export type MockPmRow = {
  id: string
  planName: string
  category: string
  dept: string
  cycle: string
  nextDate: string
  engineer: string
  status: string
  overdueDays: number
}

export type MockMeterRow = {
  id: string
  deviceName: string
  assetNo: string
  meterType: string
  cycleMonth: number
  lastDate: string
  nextDue: string
  certNo: string
  org: string
  status: string
}

export type MockPaymentRow = {
  id: string
  supplier: string
  invoiceNo: string
  invoiceAmt: number
  paidAmt: number
  unpaidAmt: number
  ratio: string
  invoiceDate: string
  payStatus: string
  priority: string
}

const cats = ['影像', '检验', '生命支持', '治疗', '手术', '消毒供应']

function mkAssets(): MockAssetRow[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: `a-${i}`,
    assetNo: `WLX-SB-2023-${String(i + 1).padStart(4, '0')}`,
    name: pick(DEVICE_NAMES, i),
    spec: i % 3 === 0 ? '标准配置' : '高配',
    brand: pick(SUPPLIERS, i),
    category: pick(cats, i),
    dept: pick(DEPTS, i),
    location: `${pick(DEPTS, i)} 病区`,
    startDate: `2021-${String((i % 12) + 1).padStart(2, '0')}-15`,
    originalValue: 800000 + i * 120000,
    status: ['IN_USE', 'IN_USE', 'REPAIR', 'IDLE', 'IN_USE', 'RETIRED', 'ABNORMAL'][i % 7],
    owner: `责任人${(i % 5) + 1}`,
    qr: `QR-${1000 + i}`,
  }))
}

function mkRepairs(): MockRepairRow[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `r-${i}`,
    orderNo: `WO-202605-${String(i + 1).padStart(4, '0')}`,
    deviceName: pick(DEVICE_NAMES, i + 2),
    dept: pick(DEPTS, i),
    reporter: `护士${(i % 4) + 1}`,
    fault: ['开机自检失败', '管路漏气', '图像伪影', '电池续航下降', '按键失灵'][i % 5],
    urgent: ['高', '中', '低'][i % 3],
    status: ['PENDING_ASSIGN', 'PROCESSING', 'PENDING_ACCEPT', 'DONE', 'CLOSED', 'TIMEOUT'][i % 6],
    engineer: i % 6 === 0 ? '—' : `工程师${(i % 3) + 1}`,
    reportTime: `2026-05-${String(10 - (i % 8)).padStart(2, '0')} 0${8 - (i % 6)}:30`,
    responseMin: 12 + i * 6,
    fee: i % 4 === 0 ? 0 : 800 + i * 120,
  }))
}

function mkPm(): MockPmRow[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `p-${i}`,
    planName: `2026年度保养计划-${(i % 3) + 1}`,
    category: pick(cats, i),
    dept: pick(DEPTS, i),
    cycle: ['月度', '季度', '半年'][i % 3],
    nextDate: `2026-05-${String(20 + (i % 8)).padStart(2, '0')}`,
    engineer: `工程师${(i % 3) + 1}`,
    status: ['NOT_START', 'DOING', 'DONE', 'OVERDUE'][i % 4],
    overdueDays: i % 4 === 3 ? 3 + i : 0,
  }))
}

function mkMeter(): MockMeterRow[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `m-${i}`,
    deviceName: pick(DEVICE_NAMES, i + 1),
    assetNo: `WLX-SB-2022-${String(100 + i)}`,
    meterType: ['强检', '非强检', '校准'][i % 3],
    cycleMonth: 12,
    lastDate: `2025-${String((i % 9) + 1).padStart(2, '0')}-10`,
    nextDue: `2026-${String((i % 9) + 1).padStart(2, '0')}-10`,
    certNo: `CERT-2025-${2000 + i}`,
    org: '市计量测试所',
    status: ['OK', 'SOON', 'EXPIRED', 'SENT', 'COMPLETED'][i % 5],
  }))
}

function mkPayments(): MockPaymentRow[] {
  return Array.from({ length: 10 }, (_, i) => {
    const inv = 500000 + i * 80000
    const paid = i % 3 === 0 ? inv : i % 3 === 1 ? Math.floor(inv * 0.6) : 0
    return {
      id: `pay-${i}`,
      supplier: pick(SUPPLIERS, i),
      invoiceNo: `INV-2026-${300 + i}`,
      invoiceAmt: inv,
      paidAmt: paid,
      unpaidAmt: inv - paid,
      ratio: `${Math.round((paid / inv) * 100)}%`,
      invoiceDate: `2026-04-${String(10 + (i % 15)).padStart(2, '0')}`,
      payStatus: ['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'PENDING_AUDIT'][i % 5],
      priority: ['P0', 'P1', 'P2'][i % 3],
    }
  })
}

export const MOCK_ASSETS = mkAssets()
export const MOCK_REPAIRS = mkRepairs()
export const MOCK_PM = mkPm()
export const MOCK_METER = mkMeter()
export const MOCK_PAYMENTS = mkPayments()

export type MockTodoRow = { id: string; type: string; title: string; due: string; status: string }
export const MOCK_TODOS: MockTodoRow[] = [
  { id: 't1', type: '维修验收', title: 'WO-202605-0003 呼吸机 · ICU · 截止 2026-05-11', due: '2026-05-11', status: '待办' },
  { id: 't2', type: '采购审批', title: '彩超 Resona 7 论证会签 · 截止 2026-05-12', due: '2026-05-12', status: '待办' },
  { id: 't3', type: '付款审核', title: '联影医疗 INV-2026-302 · 截止 2026-05-10', due: '2026-05-10', status: '待办' },
  { id: 't4', type: '计量到期', title: '除颤仪 WLX-SB-2022-105 · 已逾期', due: '2026-05-09', status: '逾期' },
  { id: 't5', type: '保养逾期', title: 'ICU 输液泵 PM 计划-2 · 已逾期', due: '2026-05-08', status: '逾期' },
]

export type MockRiskRow = { id: string; level: string; title: string; time: string }
export const MOCK_RISKS: MockRiskRow[] = [
  { id: 'k1', level: '高', title: '急救类呼吸机未按时 PM，完好率低于阈值', time: '2026-05-10 09:00' },
  { id: 'k2', level: '中', title: '计量证书 30 日内到期：DSA', time: '2026-05-10 08:30' },
  { id: 'k3', level: '中', title: '维修工单响应超时：WO-202605-0006', time: '2026-05-09 16:20' },
  { id: 'k4', level: '高', title: '供应商付款逾期：INV-2026-305', time: '2026-05-09 11:00' },
]

export type MockConsumableRow = { id: string; name: string; spec: string; stock: number; min: number; dept: string }
export const MOCK_CONSUMABLES: MockConsumableRow[] = Array.from({ length: 8 }, (_, i) => ({
  id: `c-${i}`,
  name: ['一次性管路', '电极片', '透析器', '造影剂', '高压注射器针筒', '试剂盒', '过滤器', '传感器'][i],
  spec: '标准型',
  stock: 20 + i * 5,
  min: 30,
  dept: pick(DEPTS, i),
}))

export type MockPurRow = { id: string; title: string; amount: number; dept: string; status: string; date: string }
export const MOCK_PURCHASE: MockPurRow[] = Array.from({ length: 8 }, (_, i) => ({
  id: `pur-${i}`,
  title: ['除颤仪更新', '输注工作站', '转运监护', '内镜清洗消毒机', '麻醉机维护合同', 'PACS 扩容', '质控检测仪', '急救设备批量检定'][i],
  amount: 120 + i * 35,
  dept: '医学装备科',
  status: ['论证中', '已立项', '招标中', '合同签署', '到货验收'][i % 5],
  date: `2026-05-${String(1 + i).padStart(2, '0')}`,
}))

export type MockContractRow = { id: string; no: string; name: string; supplier: string; amt: number; end: string }
export const MOCK_CONTRACTS: MockContractRow[] = Array.from({ length: 6 }, (_, i) => ({
  id: `ct-${i}`,
  no: `HT-2025-${400 + i}`,
  name: ['全保服务', '配件供应', '计量外包', '信息化运维', '培训服务', '急救设备巡检'][i],
  supplier: pick(SUPPLIERS, i),
  amt: 180 + i * 40,
  end: `2027-12-${10 + i}`,
}))
