/**
 * 医学装备运营驾驶舱演示数据集。
 * 用于「设备总览」展示全院运营语义（中文标签、专业量级）；不与接口字段名绑定。
 * 后续可对接院内指标体系按比例替换本模块输出。
 */

export type OperationsKpi = {
  key: string
  title: string
  value: number
  suffix: string
  precision?: number
  wow: number
  wowLabel: string
  statusTag: string
  statusColor: 'success' | 'processing' | 'warning' | 'error' | 'default'
  icon: 'total' | 'active' | 'life' | 'repairNew' | 'repairOpen' | 'meter' | 'risk' | 'value'
  sparkline: number[]
}

/** 稳定伪随机（同一 seed 得到同一序列） */
function seededNoise(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function buildSparkline(seed: number, len = 14): number[] {
  return Array.from({ length: len }, (_, i) => Math.round(40 + seededNoise(seed, i) * 55))
}

const KPI_SEEDS = [11, 22, 33, 44, 55, 66, 77, 88]

export function getOperationsKpis(): OperationsKpi[] {
  const assetTotal = 1842
  const active = 1620
  const emergencyOk = 99.2
  const todayRepair = 18
  const pendingWo = 47
  const meterSoon = 26
  const highRisk = 11
  const assetValueYi = 5.32

  return [
    {
      key: 'total',
      title: '设备总数',
      value: assetTotal,
      suffix: '台',
      wow: 0.28,
      wowLabel: '环比',
      statusTag: '规模稳定',
      statusColor: 'processing',
      icon: 'total',
      sparkline: buildSparkline(KPI_SEEDS[0]),
    },
    {
      key: 'active',
      title: '在用设备',
      value: active,
      suffix: '台',
      wow: 0.35,
      wowLabel: '环比',
      statusTag: '运行良好',
      statusColor: 'success',
      icon: 'active',
      sparkline: buildSparkline(KPI_SEEDS[1]),
    },
    {
      key: 'life',
      title: '急救生命支持类完好率',
      value: emergencyOk,
      suffix: '%',
      precision: 1,
      wow: 0.12,
      wowLabel: '环比',
      statusTag: '质控达标',
      statusColor: 'success',
      icon: 'life',
      sparkline: buildSparkline(KPI_SEEDS[2]),
    },
    {
      key: 'repairNew',
      title: '今日新增报修',
      value: todayRepair,
      suffix: '单',
      wow: -4.2,
      wowLabel: '环比',
      statusTag: '需关注峰谷',
      statusColor: 'warning',
      icon: 'repairNew',
      sparkline: buildSparkline(KPI_SEEDS[3]),
    },
    {
      key: 'repairOpen',
      title: '待处理维修工单',
      value: pendingWo,
      suffix: '单',
      wow: 2.1,
      wowLabel: '环比',
      statusTag: '派工压力中等',
      statusColor: 'processing',
      icon: 'repairOpen',
      sparkline: buildSparkline(KPI_SEEDS[4]),
    },
    {
      key: 'meter',
      title: '计量到期预警',
      value: meterSoon,
      suffix: '台',
      wow: -6.5,
      wowLabel: '环比',
      statusTag: '预约检定中',
      statusColor: 'warning',
      icon: 'meter',
      sparkline: buildSparkline(KPI_SEEDS[5]),
    },
    {
      key: 'risk',
      title: '高风险设备',
      value: highRisk,
      suffix: '台',
      wow: 0,
      wowLabel: '环比',
      statusTag: '重点盯防',
      statusColor: 'error',
      icon: 'risk',
      sparkline: buildSparkline(KPI_SEEDS[6]),
    },
    {
      key: 'value',
      title: '设备资产总值',
      value: assetValueYi,
      suffix: '亿元',
      precision: 2,
      wow: 1.05,
      wowLabel: '环比',
      statusTag: '账实相符复核中',
      statusColor: 'processing',
      icon: 'value',
      sparkline: buildSparkline(KPI_SEEDS[7]),
    },
  ]
}

/** 设备状态分布（中文业务语义） */
export type StatusSlice = { name: string; value: number; color: string }

export function getStatusDistribution(): StatusSlice[] {
  return [
    { name: '在用', value: 1620, color: '#1677ff' },
    { name: '维修中', value: 98, color: '#22c55e' },
    { name: '停用', value: 62, color: '#94a3b8' },
    { name: '报废', value: 32, color: '#cbd5e1' },
    { name: '待验收', value: 28, color: '#f59e0b' },
    { name: '借用中', value: 18, color: '#a855f7' },
  ]
}

export type TrendDay = { label: string; repairNew: number; repairDone: number; pmDone: number; calDone: number }

export function getOperationsTrend(days: 7 | 30): TrendDay[] {
  const n = days === 7 ? 7 : 30
  const out: TrendDay[] = []
  const base = Date.now()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base - i * 86400000)
    const label = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const k = n - 1 - i
    out.push({
      label,
      repairNew: Math.round(14 + seededNoise(101, k) * 16 + Math.sin(k / 3) * 4),
      repairDone: Math.round(12 + seededNoise(202, k) * 14 + Math.cos(k / 4) * 5),
      pmDone: Math.round(6 + seededNoise(303, k) * 8),
      calDone: Math.round(3 + seededNoise(404, k) * 5),
    })
  }
  return out
}

export type RiskRow = {
  level: '高' | '中' | '低'
  title: string
  time: string
  dept: string
  device: string
}

export const OPERATIONS_RISK_ALERTS: RiskRow[] = [
  {
    level: '高',
    title: '急救呼吸机未按时 PM',
    time: '今日 08:40',
    dept: '急诊科',
    device: '德尔格 Savina 300 呼吸机',
  },
  {
    level: '中',
    title: '计量证书 30 日内到期',
    time: '昨日 16:20',
    dept: '影像科',
    device: '西门子 MAGNETOM 1.5T MRI',
  },
  {
    level: '高',
    title: '高风险设备运行异常提示',
    time: '今日 10:05',
    dept: '介入导管室',
    device: 'DSA 数字减影血管造影系统',
  },
  {
    level: '中',
    title: '工单响应超时预警',
    time: '今日 09:30',
    dept: '手术室',
    device: '麻醉工作站（欧美达）',
  },
  {
    level: '低',
    title: '长期停机设备复核',
    time: '本周',
    dept: '神经外科',
    device: '术中神经监护仪',
  },
]

export type TodoRow = { type: string; summary: string; count: number; priority: '高' | '中' | '低' }

export const OPERATIONS_TODOS: TodoRow[] = [
  { type: '待验收设备', summary: '影像科 CT 到货装机验收', count: 3, priority: '高' },
  { type: '待审批采购', summary: '内镜中心主机更新论证', count: 2, priority: '中' },
  { type: '待确认维修', summary: '科室闭环确认（重症方向）', count: 8, priority: '高' },
  { type: '待付款发票', summary: '供应商发票挂账待核销', count: 5, priority: '中' },
  { type: '待执行保养', summary: 'PM 季度计划待执行条目', count: 14, priority: '中' },
]

export type DeptBar = { dept: string; count: number }

export const OPERATIONS_DEPT_BAR: DeptBar[] = [
  { dept: 'ICU', count: 186 },
  { dept: '手术室', count: 224 },
  { dept: '影像科', count: 198 },
  { dept: '急诊科', count: 142 },
  { dept: '内镜中心', count: 118 },
  { dept: '检验科', count: 176 },
]

export type CategoryStat = { name: string; count: number }

export const OPERATIONS_CATEGORY_STATS: CategoryStat[] = [
  { name: '医学影像', count: 412 },
  { name: '生命支持', count: 356 },
  { name: '手术设备', count: 298 },
  { name: '检验设备', count: 271 },
  { name: '治疗设备', count: 318 },
  { name: '消毒供应', count: 187 },
]

export type HighValueRow = {
  name: string
  dept: string
  valueWan: number
  bootRate: number
  useRate: number
  revenueWan: number
}

export const OPERATIONS_HIGH_VALUE_TOP10: HighValueRow[] = [
  {
    name: '西门子 MAGNETOM 1.5T MRI',
    dept: '影像科',
    valueWan: 2680,
    bootRate: 92,
    useRate: 78,
    revenueWan: 412,
  },
  {
    name: 'GE Revolution CT',
    dept: '影像科',
    valueWan: 2150,
    bootRate: 95,
    useRate: 81,
    revenueWan: 498,
  },
  {
    name: '飞利浦 Azurion 7 DSA',
    dept: '介入导管室',
    valueWan: 1980,
    bootRate: 88,
    useRate: 72,
    revenueWan: 356,
  },
  {
    name: '奥林巴斯 CV-290 内镜主机',
    dept: '内镜中心',
    valueWan: 285,
    bootRate: 90,
    useRate: 76,
    revenueWan: 128,
  },
  {
    name: '德尔格 Fabius 麻醉机',
    dept: '手术室',
    valueWan: 168,
    bootRate: 91,
    useRate: 69,
    revenueWan: 42,
  },
  {
    name: '迈瑞 BeneVision N22 监护仪',
    dept: 'ICU',
    valueWan: 42,
    bootRate: 99,
    useRate: 88,
    revenueWan: 6,
  },
  {
    name: '德尔格 Savina 300 呼吸机',
    dept: '急诊科',
    valueWan: 58,
    bootRate: 97,
    useRate: 82,
    revenueWan: 9,
  },
  {
    name: '飞利浦 EPIQ 7 彩超',
    dept: '超声医学科',
    valueWan: 320,
    bootRate: 89,
    useRate: 74,
    revenueWan: 96,
  },
  {
    name: '史赛克 1688 摄像系统',
    dept: '手术室',
    valueWan: 198,
    bootRate: 93,
    useRate: 71,
    revenueWan: 54,
  },
  {
    name: '迈瑞 BeneHeart D6 除颤监护仪',
    dept: '心内科',
    valueWan: 26,
    bootRate: 98,
    useRate: 85,
    revenueWan: 4,
  },
]

export const OPERATIONS_REPAIR_COST_MONTHS = ['7月', '8月', '9月', '10月', '11月', '12月']
export const OPERATIONS_REPAIR_COST_SERIES = [42.6, 38.2, 51.4, 46.8, 44.1, 49.3]

export type RepairHeavyRow = { name: string; dept: string; costWan: number }

export const OPERATIONS_REPAIR_TOP5: RepairHeavyRow[] = [
  { name: 'MRI 液氦压缩机组件', dept: '影像科', costWan: 28.6 },
  { name: 'DSA 高压发生器维保', dept: '介入导管室', costWan: 19.2 },
  { name: '呼吸机涡轮模块更换', dept: 'ICU', costWan: 12.8 },
  { name: 'CT 球管大修', dept: '影像科', costWan: 56.4 },
  { name: '内镜冷光源总成', dept: '内镜中心', costWan: 9.7 },
]

export type AgeBucket = { range: string; count: number; pct: number }

export const OPERATIONS_AGE_STRUCTURE: AgeBucket[] = [
  { range: '0～3 年', count: 612, pct: 33.2 },
  { range: '3～5 年', count: 498, pct: 27.0 },
  { range: '5～8 年', count: 446, pct: 24.2 },
  { range: '8 年以上', count: 286, pct: 15.6 },
]

export type LifecycleCard = { label: string; count: number; hint: string; tone: 'blue' | 'orange' | 'red' | 'green' }

export const OPERATIONS_LIFECYCLE: LifecycleCard[] = [
  { label: '在用', count: 1620, hint: '常态运行与巡检覆盖', tone: 'blue' },
  { label: '即将淘汰', count: 86, hint: '列入更新论证清单', tone: 'orange' },
  { label: '已超年限', count: 54, hint: '强度检测与风险评估', tone: 'red' },
  { label: '待更新', count: 38, hint: '预算年度滚动储备', tone: 'green' },
]

/** 专业化增强指标（横幅） */
export const OPERATIONS_ENHANCEMENT_STRIPS = [
  { title: '急救生命支持类监控', value: '全覆盖 · 12 类重点清单', unit: '' },
  { title: '计量到期预警（90 天窗）', value: '26', unit: '台处置中' },
  { title: 'PM 保养执行率（滚动）', value: '94.6', unit: '%' },
  { title: '维修平均响应时长', value: '28', unit: '分钟' },
  { title: '设备完好率（加权）', value: '97.1', unit: '%' },
  { title: '高风险设备闭环巡检', value: '11', unit: '台周巡' },
  { title: '超年限设备专项', value: '54', unit: '台复核' },
  { title: '加权设备利用率', value: '76.8', unit: '%' },
  { title: '原值账实核对进度', value: '92', unit: '%' },
  { title: '供应商 SLA 达成', value: '96.4', unit: '%' },
]
