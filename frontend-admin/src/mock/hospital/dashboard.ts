/** 首页驾驶舱 KPI 与图表 Mock */

export type DashboardKpiTagVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'

/** 对齐静态原型：角标字形 + 底色（非通用图标） */
export type DashboardKpiTint = 'blue' | 'green' | 'orange' | 'red' | 'gray' | 'purple'

/** 环比行样式：down-orange 对应保养逾期（原型橙色负向） */
export type DashboardKpiWowTone = 'up' | 'down' | 'flat' | 'down-orange'

/** 对齐 dashboard-confirm.html 原型状态标签 */
export type DashboardKpi = {
  key: string
  title: string
  value: number | string
  unit: string
  wow: number
  wowTone?: DashboardKpiWowTone
  status?: 'success' | 'processing' | 'warning' | 'error'
  /** 单字角标，与静态原型 .kpi-icon 一致 */
  glyph: string
  tint: DashboardKpiTint
  tag: string
  tagVariant: DashboardKpiTagVariant
}

export const DASHBOARD_KPIS: DashboardKpi[] = [
  { key: 'total', title: '设备总数', value: 1842, unit: '台', wow: 2.35, glyph: '▣', tint: 'blue', status: 'success', tag: '', tagVariant: 'neutral' },
  { key: 'active', title: '在用设备', value: 1620, unit: '台', wow: 0.32, glyph: '▣', tint: 'green', status: 'processing', tag: '', tagVariant: 'neutral' },
  {
    key: 'icu',
    title: '急救生命支持类完好率',
    value: 99.2,
    unit: '%',
    wow: 0.12,
    glyph: '♡',
    tint: 'blue',
    status: 'success',
    tag: '',
    tagVariant: 'neutral',
  },
  { key: 'todayRepair', title: '今日报修', value: 7, unit: '单', wow: -12.4, glyph: '🔧', tint: 'orange', status: 'warning', tag: '', tagVariant: 'neutral' },
  { key: 'pendingWo', title: '待处理工单', value: 23, unit: '单', wow: 5.08, glyph: '▤', tint: 'purple', status: 'processing', tag: '', tagVariant: 'neutral' },
  { key: 'meterAlert', title: '计量到期预警', value: 14, unit: '台', wow: 2.18, glyph: '▣', tint: 'green', status: 'warning', tag: '', tagVariant: 'neutral' },
  { key: 'pmOverdue', title: '保养逾期任务', value: 6, unit: '项', wow: -1.05, wowTone: 'down-orange', glyph: '🛡', tint: 'orange', status: 'error', tag: '', tagVariant: 'neutral' },
  { key: 'unpaid', title: '待付款金额', value: 128.0, unit: '万元', wow: 3.21, glyph: '￥', tint: 'blue', status: 'warning', tag: '', tagVariant: 'neutral' },
  { key: 'recon', title: '供应商待对账', value: 5, unit: '家', wow: 0, wowTone: 'flat', glyph: '♙', tint: 'purple', tag: '', tagVariant: 'neutral' },
  { key: 'risk', title: '风险预警', value: 9, unit: '条', wow: 8.6, wowTone: 'down', glyph: '⚠', tint: 'red', status: 'error', tag: '', tagVariant: 'neutral' },
]

/** 已完成工单趋势（略低于报修量）— 对齐驾驶舱效果图双线 */
export const REPAIR_TREND_7 = [12, 18, 15, 22, 19, 8, 14]
const REPAIR_COMPLETE_GAP_7 = [2, 3, 2, 4, 3, 1, 2]
export const REPAIR_COMPLETED_TREND_7 = REPAIR_TREND_7.map((v, i) =>
  Math.max(0, v - (REPAIR_COMPLETE_GAP_7[i] ?? 2)),
)
export const REPAIR_TREND_30 = Array.from({ length: 30 }, (_, i) => 10 + Math.round(8 * Math.sin(i / 4) + (i % 5)))
export const REPAIR_COMPLETED_TREND_30 = REPAIR_TREND_30.map((v, i) => Math.max(0, v - (2 + (i % 3))))

/** KPI 卡片右下角迷你走势（演示） */
export const KPI_SPARKLINE_BY_KEY: Record<string, number[]> = Object.fromEntries(
  DASHBOARD_KPIS.map((k, i) => [
    k.key,
    Array.from({ length: 7 }, (_, j) =>
      Math.round(38 + 22 * Math.sin((j + i * 1.7) / 1.8) + ((j + i) % 4) * 4),
    ),
  ]),
)

/** 效益分析四宫格 — 对齐效果图 */
export const DASHBOARD_BENEFIT_TILES = [
  { key: 'util', title: '设备利用率', value: '78.6', unit: '%', wow: 4.32 },
  { key: 'mtbf', title: '平均故障间隔', value: '26.4', unit: '天', wow: 8.12 },
  { key: 'maint', title: '维修费用', value: '38.6', unit: '万元', wow: -6.21 },
  { key: 'daily', title: '单台日均成本', value: '52.3', unit: '元', wow: 3.87 },
] as const

/** 对齐静态原型甜甜圈图例 */
export const DEVICE_STATUS_DIST = [
  { name: '在用', value: 1620 },
  { name: '维修中', value: 98 },
  { name: '停用', value: 62 },
  { name: '报废', value: 32 },
  { name: '待验收', value: 30 },
]

/** 首页横向进度条四行（原型百分比与文案） */
export const DASHBOARD_CATEGORY_PROGRESS = [
  { name: '影像设备', widthPct: 82, label: '582 (31.60%)', fill: '#2563eb' },
  { name: '监护设备', widthPct: 60, label: '416 (22.58%)', fill: '#22c55e' },
  { name: '治疗设备', widthPct: 48, label: '312 (16.94%)', fill: '#f59e0b' },
  { name: '检验设备', widthPct: 36, label: '228 (12.38%)', fill: '#2563eb' },
] as const

export const PAYMENT_SUMMARY = [
  { name: '发票金额', value: 5642.3 },
  { name: '已付款', value: 3812.6 },
  { name: '未付款', value: 1204.8 },
  { name: '部分付款', value: 512.6 },
  { name: '逾期付款', value: 112.3 },
]
