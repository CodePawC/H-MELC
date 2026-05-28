import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { motion } from 'framer-motion'
import {
  CheckCircleOutlined,
  CloudServerOutlined,
  DownloadOutlined,
  FullscreenOutlined,
  FundProjectionScreenOutlined,
  MedicineBoxOutlined,
  MonitorOutlined,
  RadarChartOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { Alert, Button, Select, Tooltip } from 'antd'

import {
  fetchDashboardFinancePaymentSummary,
  fetchDashboardRepairTrend,
  fetchDashboardWorkspaceTasks,
  fetchHospitalDashboardSummary,
  type DashboardFinancePaymentSummary,
  type DashboardRepairTrend,
  type DashboardWorkspaceTasks,
  type HospitalDashboardSummary,
} from '../../api/dashboard'
import { IS_AUTH_MOCK } from '../../config/authMode'
import { ApiClientError } from '../../lib/api'
import {
  PAYMENT_SUMMARY,
  REPAIR_COMPLETED_TREND_30,
  REPAIR_COMPLETED_TREND_7,
  REPAIR_TREND_30,
  REPAIR_TREND_7,
} from '../../mock/hospital/dashboard'
import { useAuthSession } from '../../stores/authSession'

import '../../styles/homeDashboard.css'

type TrendRange = 7 | 30 | 90
type Tone = 'blue' | 'cyan' | 'orange' | 'red' | 'gray'
type EventLevel = 'Critical' | 'High' | 'Medium' | 'Info'
type OperationModeKey = 'daily' | 'emergency' | 'surgery' | 'night' | 'assurance'
type RoleKey = 'director' | 'device' | 'engineer' | 'clinical' | 'duty'
type VisualMode = 'day' | 'night'

type TodoFeedRow = {
  mini: string
  bg: string
  title: string
  meta?: string
  pill: string
}

type RiskDevice = {
  code: string
  name: string
  vendor: string
  dept: string
  room: string
  level: EventLevel
  reason: string
  status: string
  alarm: string
  score: number
  onlineRate: number
  tone: Tone
}

type EventRow = {
  time: string
  level: EventLevel
  icon: string
  title: string
  target: string
  detail: string
  action: string
  tone: Tone
}

type HeatZone = {
  name: string
  x: number
  y: number
  w: number
  h: number
  online: number
  risk: number
  pm: string
  alarm: string
  tone: Tone
  status: 'online' | 'risk' | 'offline'
}

type AiAdvice = {
  title: string
  riskLevel: string
  scope: string
  action: string
  trend: string
  tone: Tone
}

type OperationMode = {
  key: OperationModeKey
  label: string
  en: string
  tone: Tone
  strategy: string
}

type RoleProfile = {
  key: RoleKey
  label: string
  subtitle: string
  metrics: Array<{ label: string; value: string; tone?: Tone }>
  focus: Array<{ title: string; meta: string; tone: Tone }>
}

const OPERATION_MODES: OperationMode[] = [
  { key: 'daily', label: '日常运行', en: 'DAILY', tone: 'blue', strategy: '标准阈值 · 优先闭环高风险设备' },
  { key: 'emergency', label: '应急模式', en: 'EMERGENCY', tone: 'red', strategy: '生命支持设备优先 · 自动锁定备用池' },
  { key: 'surgery', label: '手术高峰', en: 'SURGERY PEAK', tone: 'orange', strategy: '手术室 / 麻醉 / ICU 设备优先保障' },
  { key: 'night', label: '夜间值班', en: 'NIGHT DUTY', tone: 'cyan', strategy: '减少低优先级打扰 · 强化离线报警' },
  { key: 'assurance', label: '重大保障', en: 'ASSURANCE', tone: 'blue', strategy: '关键路径设备双人复核 · PACS/HIS联动巡检' },
]

const FALLBACK_TODO_ROWS: TodoFeedRow[] = [
  { mini: '修', bg: '#fa8c16', title: 'MRI-001 冷却循环组件复核', meta: '影像中心 · GE · 2小时内到场', pill: 'High' },
  { mini: '急', bg: '#ff4d4f', title: 'VENT-ICU-12 电池健康度低', meta: '急诊ICU · Mindray · 待战备确认', pill: 'Duty' },
  { mini: '计', bg: '#1677ff', title: 'DSA-003 强检证书到期', meta: '介入导管室 · Siemens · 30天内', pill: '31' },
]

const RISK_DEVICES: RiskDevice[] = [
  {
    code: 'MRI-001',
    name: 'MRI 3.0T',
    vendor: 'GE',
    dept: '影像中心',
    room: 'MRI二室',
    level: 'Critical',
    reason: '冷却系统压力波动',
    status: '风险观察',
    alarm: '15:42 冷却水流量低于阈值',
    score: 92,
    onlineRate: 87.2,
    tone: 'red',
  },
  {
    code: 'DSA-003',
    name: 'DSA血管机',
    vendor: 'Siemens',
    dept: '介入导管室',
    room: 'DSA一室',
    level: 'High',
    reason: '高压发生器报警',
    status: '待PM',
    alarm: '15:31 恢复运行，需复核',
    score: 84,
    onlineRate: 91.4,
    tone: 'orange',
  },
  {
    code: 'VENT-ICU-12',
    name: '呼吸机',
    vendor: 'Mindray',
    dept: '急诊ICU',
    room: 'ICU 12床',
    level: 'High',
    reason: '电池健康度下降',
    status: '待战备',
    alarm: '15:40 离线 42 秒后恢复',
    score: 76,
    onlineRate: 99.2,
    tone: 'orange',
  },
  {
    code: 'DEF-ER-05',
    name: '除颤仪',
    vendor: 'Philips',
    dept: '急诊科',
    room: '抢救室',
    level: 'Critical',
    reason: '自检失败',
    status: '离线',
    alarm: '15:18 自动派单 WO-0512',
    score: 89,
    onlineRate: 82.8,
    tone: 'red',
  },
]

const EVENT_STREAM: EventRow[] = [
  {
    time: '15:42',
    level: 'Critical',
    icon: 'MRI',
    title: 'MRI冷却报警',
    target: 'MRI-001 · 影像中心',
    detail: '冷却水流量低于阈值，建议检查循环组件',
    action: '已推送设备科值班工程师',
    tone: 'red',
  },
  {
    time: '15:40',
    level: 'High',
    icon: '网络',
    title: 'ICU监护仪短时离线',
    target: 'MON-ICU-09 · 急诊ICU',
    detail: 'IoT网关抖动 42 秒，已恢复在线',
    action: '纳入夜间网络巡检',
    tone: 'orange',
  },
  {
    time: '15:36',
    level: 'Info',
    icon: 'PM',
    title: 'PM任务完成',
    target: 'ENDO-006 · 内镜中心',
    detail: '预防性维护进入验收节点',
    action: '等待科室确认',
    tone: 'cyan',
  },
  {
    time: '15:31',
    level: 'Medium',
    icon: 'DSA',
    title: 'DSA恢复运行',
    target: 'DSA-003 · 介入导管室',
    detail: '高压报警解除，等待工程师复核',
    action: '保留观察 24 小时',
    tone: 'orange',
  },
  {
    time: '15:20',
    level: 'Info',
    icon: '气体',
    title: '氧气压力恢复正常',
    target: '中心供氧 · 住院综合楼',
    detail: '压力回升至 0.42MPa',
    action: '维持常规监控',
    tone: 'cyan',
  },
  {
    time: '15:12',
    level: 'Critical',
    icon: '急救',
    title: '除颤仪自检失败',
    target: 'DEF-ER-05 · 急诊抢救室',
    detail: '已自动派单并锁定备用设备',
    action: '应急备用池替换',
    tone: 'red',
  },
  {
    time: '15:06',
    level: 'Medium',
    icon: '计量',
    title: '计量到期提醒',
    target: 'INF-023 · 输液泵',
    detail: '证书 18 天后到期',
    action: '纳入本周计量计划',
    tone: 'orange',
  },
]

const HOSPITAL_ZONES: HeatZone[] = [
  { name: '门诊楼', x: 6, y: 12, w: 25, h: 22, online: 94.8, risk: 5, pm: '91%', alarm: '1 条网络抖动', tone: 'cyan', status: 'online' },
  { name: '住院楼', x: 35, y: 10, w: 24, h: 30, online: 92.1, risk: 9, pm: '86%', alarm: '3 台待PM', tone: 'orange', status: 'risk' },
  { name: 'ICU', x: 64, y: 12, w: 28, h: 20, online: 99.2, risk: 4, pm: '96%', alarm: '1 台呼吸机待战备', tone: 'orange', status: 'risk' },
  { name: '手术部', x: 66, y: 42, w: 26, h: 25, online: 96.7, risk: 6, pm: '89%', alarm: '麻醉机PM窗口紧张', tone: 'orange', status: 'risk' },
  { name: '介入中心', x: 7, y: 46, w: 26, h: 34, online: 91.4, risk: 8, pm: '78%', alarm: 'DSA高压报警复核', tone: 'orange', status: 'risk' },
  { name: '内镜中心', x: 37, y: 55, w: 24, h: 25, online: 95.3, risk: 3, pm: '93%', alarm: '无', tone: 'cyan', status: 'online' },
  { name: '放疗中心', x: 40, y: 82, w: 28, h: 12, online: 89.6, risk: 7, pm: '82%', alarm: '2 台待计量', tone: 'orange', status: 'offline' },
]

const AI_DECISIONS: AiAdvice[] = [
  {
    title: 'MRI冷却系统故障风险上升 12%',
    riskLevel: 'Critical',
    scope: '影像中心 / MRI-001 / GE',
    action: '提前更换冷却循环组件，并复核机房温湿度联动策略。',
    trend: '未来 7 天故障概率继续抬升',
    tone: 'red',
  },
  {
    title: 'DSA PM窗口不足',
    riskLevel: 'High',
    scope: '介入导管室 / DSA-003 / Siemens',
    action: '优先安排介入导管室维护窗口，避免高峰手术日停机。',
    trend: 'PM超期风险较目标高 11.4%',
    tone: 'orange',
  },
  {
    title: '急诊ICU生命支持设备压力偏高',
    riskLevel: 'Medium',
    scope: '急诊ICU / VENT-ICU-12 / Mindray',
    action: '保留 8 台呼吸机进入跨科室机动池，夜班前完成备用确认。',
    trend: '夜间调用需求预计上升 9%',
    tone: 'orange',
  },
]

const PM_FLOW = [
  { name: '计划', value: 168, rate: 100 },
  { name: '执行', value: 151, rate: 89.9 },
  { name: '验收', value: 139, rate: 82.7 },
  { name: '整改', value: 23, rate: 13.7 },
  { name: '归档', value: 128, rate: 76.2 },
]

const LARGE_EQUIPMENT = [
  { name: 'MRI', code: 'MRI-001', vendor: 'GE', utilization: 87.2, volume: 142, benefit: 38.6, downtime: 6.8 },
  { name: 'CT', code: 'CT-002', vendor: 'Philips', utilization: 93.6, volume: 318, benefit: 55.4, downtime: 2.6 },
  { name: 'DSA', code: 'DSA-003', vendor: 'Siemens', utilization: 91.4, volume: 49, benefit: 42.1, downtime: 5.2 },
  { name: 'DR', code: 'DR-010', vendor: 'United Imaging', utilization: 88.3, volume: 396, benefit: 26.7, downtime: 1.9 },
  { name: '内镜系统', code: 'ENDO-006', vendor: 'Olympus', utilization: 78.8, volume: 218, benefit: 29.3, downtime: 4.8 },
]

const OPERATION_PULSE = [
  { label: 'PM闭环', value: '86.8%', note: '17 项超期', icon: <ToolOutlined />, tone: 'orange' as Tone },
  { label: '医用气体', value: '0.42MPa', note: '中心供氧稳定', icon: <CloudServerOutlined />, tone: 'cyan' as Tone },
  { label: '辐射安全', value: '90.8%', note: '年检完成率', icon: <SafetyCertificateOutlined />, tone: 'orange' as Tone },
  { label: '急救战备', value: '94.8%', note: '除颤仪需复核', icon: <ThunderboltOutlined />, tone: 'orange' as Tone },
]

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function formatDateTime(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function formatGeneratedAt(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return formatDateTime(d)
}

function clampMetric(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function expandSeries(base: number[], length: number, offset = 0) {
  return Array.from({ length }, (_, i) => {
    const seed = base[i % base.length] ?? 0
    const wave = Math.sin((i + offset) / 4) * 4 + Math.cos((i + offset) / 9) * 2
    return Number(Math.max(0, seed + wave).toFixed(2))
  })
}

function buildTodoRows(ws: DashboardWorkspaceTasks | null): TodoFeedRow[] {
  if (!ws) return FALLBACK_TODO_ROWS
  const rows: TodoFeedRow[] = []
  for (const t of ws.workflow.items.slice(0, 3)) {
    rows.push({
      mini: '审',
      bg: '#1677ff',
      title: t.summary || t.instance_title || '待审批任务',
      meta: t.process_key ? `流程 · ${t.process_key}` : '流程待办',
      pill: '待办',
    })
  }
  for (const r of ws.repairs_preview.slice(0, 3)) {
    rows.push({
      mini: '修',
      bg: '#fa8c16',
      title: `${r.order_code} · ${(r.fault_preview || '故障待确认').trim()}`,
      meta: '未闭环维修工单',
      pill: r.status,
    })
  }
  return rows.length ? rows.slice(0, 4) : FALLBACK_TODO_ROWS
}

function RollingNumber({ value }: { value: string | number }) {
  return (
    <strong className="home-ioc-number" key={String(value)}>
      {String(value)
        .split('')
        .map((ch, idx) => (
          <span key={`${ch}-${idx}`}>{ch}</span>
        ))}
    </strong>
  )
}

function SectionTitle({ en, cn }: { en: string; cn: string }) {
  return (
    <div>
      <span className="home-ioc-panel__eyebrow">{en}</span>
      <h2>{cn}</h2>
    </div>
  )
}

function HealthCore({ score, riskLevel }: { score: number; riskLevel: number }) {
  return (
    <motion.div
      className="home-health-core"
      data-risk-level={riskLevel > 18 ? 'elevated' : 'stable'}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.55 }}
      style={{
        ['--health-deg' as string]: `${score * 3.6}deg`,
        ['--risk-intensity' as string]: `${Math.min(1, riskLevel / 46)}`,
      }}
    >
      <div className="home-health-core__dataflow" aria-hidden />
      <div className="home-health-core__particles" aria-hidden>
        {Array.from({ length: 24 }).map((_, idx) => (
          <i key={idx} style={{ ['--i' as string]: idx }} />
        ))}
      </div>
      <div className="home-health-core__outer-scan" aria-hidden />
      <div className="home-health-core__ring">
        <div className="home-health-core__scan" aria-hidden />
        <span>Medical Equipment Health Index</span>
        <RollingNumber value={score.toFixed(1)} />
        <em>全院医学装备运行健康度</em>
      </div>
      <div className="home-health-core__orbit" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="home-health-core__riskwave" aria-hidden />
      <div className="home-health-core__wave" aria-hidden />
    </motion.div>
  )
}

function SystemStatusPanel({ onlineRate }: { onlineRate: number }) {
  const rows = [
    { label: 'HIS接口', value: '正常', tone: 'cyan' as Tone },
    { label: 'PACS接口', value: '异常', tone: 'red' as Tone },
    { label: 'IoT连接', value: '正常', tone: 'cyan' as Tone },
    { label: '数据同步', value: '正常', tone: 'blue' as Tone },
    { label: '网络状态', value: '波动', tone: 'orange' as Tone },
  ]
  return (
    <aside className="home-ioc-console home-ioc-console--status">
      <div className="home-ioc-console__head">
        <span>SYSTEM STATUS</span>
        <b>系统状态</b>
      </div>
      <div className="home-system-list">
        {rows.map((row) => (
          <div className="home-system-row" data-tone={row.tone} key={row.label}>
            <i />
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
      <div className="home-system-online">
        <span>设备在线率</span>
        <strong>{onlineRate.toFixed(1)}%</strong>
      </div>
    </aside>
  )
}

function RiskSummaryPanel({
  todayAlarm,
  highRiskCount,
  pmOverdueCount,
  offlineAssets,
  now,
  sourceUpdatedText,
}: {
  todayAlarm: number
  highRiskCount: number
  pmOverdueCount: number
  offlineAssets: number
  now: Date
  sourceUpdatedText: string
}) {
  const rows = [
    { label: '今日新增报警', value: todayAlarm, unit: '条', tone: 'red' as Tone },
    { label: '高风险设备', value: highRiskCount, unit: '台', tone: 'red' as Tone },
    { label: 'PM超期', value: pmOverdueCount, unit: '项', tone: 'orange' as Tone },
    { label: '离线设备', value: offlineAssets, unit: '台', tone: 'gray' as Tone },
  ]
  return (
    <aside className="home-ioc-console home-ioc-console--risk">
      <div className="home-ioc-console__head">
        <span>RISK SUMMARY</span>
        <b>风险摘要</b>
      </div>
      <div className="home-risk-summary">
        {rows.map((row) => (
          <div className="home-risk-kpi" data-tone={row.tone} key={row.label}>
            <span>{row.label}</span>
            <div>
              <RollingNumber value={row.value} />
              <em>{row.unit}</em>
            </div>
          </div>
        ))}
      </div>
      <div className="home-ioc-clock">
        <span>COMMAND TIME</span>
        <strong>{formatDateTime(now)}</strong>
        <small>数据更新时间 · {sourceUpdatedText}</small>
      </div>
    </aside>
  )
}

function OperationModeSwitch({
  active,
  onChange,
  visualMode,
  onVisualModeChange,
}: {
  active: OperationMode
  onChange: (mode: OperationModeKey) => void
  visualMode: VisualMode
  onVisualModeChange: (mode: VisualMode) => void
}) {
  return (
    <div className="home-mode-switch" data-tone={active.tone}>
      <div className="home-mode-switch__top">
        <span>OPERATION MODE</span>
        <div className="home-visual-mode" aria-label="DAY NIGHT MODE">
          {(['day', 'night'] as VisualMode[]).map((mode) => (
            <button key={mode} type="button" data-active={visualMode === mode} onClick={() => onVisualModeChange(mode)}>
              {mode === 'day' ? 'DAY' : 'NIGHT'}
            </button>
          ))}
        </div>
      </div>
      <div>
        {OPERATION_MODES.map((mode) => (
          <button key={mode.key} type="button" data-active={mode.key === active.key} onClick={() => onChange(mode.key)}>
            <b>{mode.en}</b>
            <em>{mode.label}</em>
          </button>
        ))}
      </div>
      <small>{active.strategy}</small>
    </div>
  )
}

function EventCenter() {
  const [selected, setSelected] = useState<EventRow>(EVENT_STREAM[0])
  return (
    <article className="home-ioc-panel home-ioc-panel--events">
      <div className="home-ioc-panel__head">
        <SectionTitle en="SOC / NOC EVENTS" cn="事件中心" />
        <RadarChartOutlined />
      </div>
      <div className="home-event-layout">
        <div className="home-event-stream">
          <div className="home-event-track">
            {[...EVENT_STREAM, ...EVENT_STREAM].map((row, idx) => (
              <button
                className="home-event-row"
                data-tone={row.tone}
                key={`${row.time}-${row.title}-${idx}`}
                type="button"
                onClick={() => setSelected(row)}
              >
                <div className="home-event-row__time">
                  <time>{row.time}</time>
                  <i />
                </div>
                <span className="home-event-row__icon">{row.icon}</span>
                <div>
                  <strong>
                    {row.title}
                    <em>{row.level}</em>
                  </strong>
                  <small>{row.target}</small>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="home-event-detail" data-tone={selected.tone}>
          <span>{selected.level}</span>
          <strong>{selected.title}</strong>
          <p>{selected.detail}</p>
          <small>{selected.action}</small>
        </div>
      </div>
    </article>
  )
}

function HospitalHeatMap() {
  const flowLines = [
    { className: 'home-map-flow--icu-mri', label: 'ICU → MRI' },
    { className: 'home-map-flow--mri-or', label: 'MRI → 手术部' },
    { className: 'home-map-flow--or-icu', label: '手术部 → ICU' },
  ]
  return (
    <article className="home-ioc-panel home-ioc-panel--map">
      <div className="home-ioc-panel__head">
        <SectionTitle en="DIGITAL TWIN MAP" cn="医院空间态势" />
        <MonitorOutlined />
      </div>
      <div className="home-hospital-map">
        <div className="home-hospital-map__grid" aria-hidden />
        {flowLines.map((line) => (
          <span className={`home-map-flow ${line.className}`} key={line.label} aria-label={line.label} />
        ))}
        {HOSPITAL_ZONES.map((zone) => (
          <div
            className="home-zone"
            data-tone={zone.tone}
            data-status={zone.status}
            key={zone.name}
            style={{
              left: `${zone.x}%`,
              top: `${zone.y}%`,
              width: `${zone.w}%`,
              height: `${zone.h}%`,
            }}
            title={`${zone.name} · 在线率 ${zone.online}% · 风险设备 ${zone.risk} · PM ${zone.pm} · 当前报警 ${zone.alarm}`}
          >
            <i className="home-zone__status" />
            <strong>{zone.name}</strong>
            <span>在线 {zone.online}%</span>
            <em>风险 {zone.risk} · PM {zone.pm}</em>
          </div>
        ))}
      </div>
    </article>
  )
}

function RiskCenter() {
  return (
    <article className="home-ioc-panel home-ioc-panel--risk">
      <div className="home-ioc-panel__head">
        <SectionTitle en="CRITICAL RISK" cn="关键风险" />
        <Link to="/dashboard/risk">进入风险台</Link>
      </div>
      <div className="home-risk-list">
        {RISK_DEVICES.map((item) => (
          <div className="home-risk-row" key={item.code} data-tone={item.tone}>
            <div className="home-risk-row__main">
              <span className="home-risk-row__dot" />
              <div>
                <strong>
                  {item.code} · {item.name}
                </strong>
                <small>
                  {item.dept} / {item.room} · {item.vendor} · {item.reason}
                </small>
              </div>
            </div>
            <span className="home-risk-row__level">{item.level}</span>
            <span>{item.status}</span>
            <em>{item.alarm}</em>
            <div className="home-risk-row__score">
              <i style={{ width: `${item.score}%` }} />
            </div>
            <b>{item.onlineRate.toFixed(1)}%</b>
          </div>
        ))}
      </div>
    </article>
  )
}

function AIOpsCenter({ totalAssets, openOrders, financeTotal }: { totalAssets: number; openOrders: number; financeTotal: number }) {
  return (
    <article className="home-ioc-panel home-ioc-panel--ai">
      <div className="home-ai-scan" aria-hidden />
      <div className="home-ai-dataflow" aria-hidden />
      <div className="home-ioc-panel__head">
        <SectionTitle en="AI OPS CENTER" cn="AI决策助手" />
        <RobotOutlined />
      </div>
      <div className="home-ai-brief">
        <RobotOutlined />
        <div>
          <strong>只呈现 TOP 3 可执行建议</strong>
          <span>
            已分析 {totalAssets.toLocaleString()} 台设备、{openOrders} 条未闭环事件、{financeTotal.toFixed(1)} 万元成本信号。
          </span>
        </div>
      </div>
      <div className="home-ai-decision-list">
        {AI_DECISIONS.map((item) => (
          <div className="home-ai-decision" data-tone={item.tone} key={item.title}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.riskLevel}</span>
            </div>
            <p>{item.action}</p>
            <small>
              影响范围：{item.scope} · 预测趋势：{item.trend}
            </small>
          </div>
        ))}
      </div>
    </article>
  )
}

function RoleCockpit({
  activeRole,
  setActiveRole,
  profiles,
}: {
  activeRole: RoleKey
  setActiveRole: (role: RoleKey) => void
  profiles: RoleProfile[]
}) {
  const active = profiles.find((x) => x.key === activeRole) ?? profiles[0]
  return (
    <article className="home-ioc-panel home-ioc-panel--role">
      <div className="home-ioc-panel__head">
        <SectionTitle en="ROLE COCKPIT" cn="角色化驾驶舱" />
        <MedicineBoxOutlined />
      </div>
      <div className="home-role-tabs">
        {profiles.map((role, idx) => (
          <button key={role.key} type="button" data-active={role.key === activeRole} onClick={() => setActiveRole(role.key)}>
            <span>{String(idx + 1).padStart(2, '0')}</span>
            <b>{role.label}</b>
            <em>{role.subtitle}</em>
          </button>
        ))}
      </div>
      <div className="home-role-body">
        <div>
          <strong>{active.label}</strong>
          <span>{active.subtitle}</span>
        </div>
        <div className="home-role-metrics">
          {active.metrics.map((metric) => (
            <div key={metric.label} data-tone={metric.tone ?? 'blue'}>
              <span>{metric.label}</span>
              <b>{metric.value}</b>
            </div>
          ))}
        </div>
        <div className="home-role-focus">
          {active.focus.map((item) => (
            <div key={item.title} data-tone={item.tone}>
              <i />
              <div>
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

function OperationPulse() {
  return (
    <article className="home-ioc-panel home-ioc-panel--pulse">
      <div className="home-ioc-panel__head">
        <SectionTitle en="OPERATIONS PULSE" cn="运行脉搏" />
        <CheckCircleOutlined />
      </div>
      <div className="home-operation-pulse">
        {OPERATION_PULSE.map((item) => (
          <div key={item.label} data-tone={item.tone}>
            {item.icon}
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </div>
        ))}
      </div>
      <div className="home-pm-flow" aria-label="PM闭环流程">
        {PM_FLOW.map((step, idx) => (
          <div className="home-pm-flow__step" key={step.name}>
            <span>{idx + 1}</span>
            <strong>{step.name}</strong>
            <small>{step.rate.toFixed(1)}%</small>
          </div>
        ))}
      </div>
    </article>
  )
}

function buildRoleProfiles({
  healthScore,
  openOrders,
  highRiskCount,
  todayAlarm,
  onlineRate,
  pmOverdueCount,
  todoFeedRows,
}: {
  healthScore: number
  openOrders: number
  highRiskCount: number
  todayAlarm: number
  onlineRate: number
  pmOverdueCount: number
  todoFeedRows: TodoFeedRow[]
}): RoleProfile[] {
  return [
    {
      key: 'director',
      label: '院长驾驶舱',
      subtitle: '关注风险、效益、大型设备与运营指数。',
      metrics: [
        { label: '健康指数', value: healthScore.toFixed(1), tone: 'blue' },
        { label: '大型设备开机率', value: '88.7%', tone: 'cyan' },
        { label: '高风险', value: `${highRiskCount}台`, tone: 'red' },
      ],
      focus: [
        { title: 'MRI单机效益受停机影响', meta: 'MRI-001 停机 6.8h · 建议复核冷却系统', tone: 'orange' },
        { title: 'PACS接口异常影响影像链路', meta: '需信息科与设备科联合确认', tone: 'red' },
      ],
    },
    {
      key: 'device',
      label: '设备科驾驶舱',
      subtitle: '关注PM、维修、工单、库存和风险设备。',
      metrics: [
        { label: '未闭环工单', value: `${openOrders}`, tone: 'orange' },
        { label: 'PM超期', value: `${pmOverdueCount}`, tone: 'orange' },
        { label: '今日报警', value: `${todayAlarm}`, tone: 'red' },
      ],
      focus: [
        { title: 'DSA-003 PM窗口不足', meta: '介入导管室 · Siemens · 建议本周维护', tone: 'orange' },
        { title: 'DEF-ER-05 已锁定备用设备', meta: '急诊抢救室 · Philips · 等待工程师复核', tone: 'red' },
      ],
    },
    {
      key: 'engineer',
      label: '工程师驾驶舱',
      subtitle: '关注待办工单、报警、备件和到场时限。',
      metrics: [
        { label: '待办任务', value: `${todoFeedRows.length}`, tone: 'orange' },
        { label: '2小时内到场', value: '3', tone: 'red' },
        { label: '备件待确认', value: '5', tone: 'orange' },
      ],
      focus: todoFeedRows.slice(0, 2).map((row) => ({ title: row.title, meta: row.meta ?? row.pill, tone: row.bg === '#ff4d4f' ? 'red' : 'orange' })),
    },
    {
      key: 'clinical',
      label: '临床科室驾驶舱',
      subtitle: '关注可用设备、借调、故障和排队。',
      metrics: [
        { label: '临床可用率', value: `${onlineRate.toFixed(1)}%`, tone: 'cyan' },
        { label: '借调中', value: '18', tone: 'blue' },
        { label: '待处理故障', value: '9', tone: 'orange' },
      ],
      focus: [
        { title: '急诊ICU呼吸机备用池紧张', meta: '建议保留 8 台跨科室机动设备', tone: 'orange' },
        { title: '妇幼楼监护仪可用率稳定', meta: '当前在线 95.8% · 无Critical报警', tone: 'cyan' },
      ],
    },
    {
      key: 'duty',
      label: '值班驾驶舱',
      subtitle: '关注实时报警、夜间设备、急救设备和应急调配。',
      metrics: [
        { label: '夜间报警策略', value: 'ON', tone: 'blue' },
        { label: '急救设备完好率', value: '94.8%', tone: 'orange' },
        { label: 'Critical', value: '2', tone: 'red' },
      ],
      focus: [
        { title: 'DEF-ER-05 除颤仪自检失败', meta: '已派单 · 应急备用池替换', tone: 'red' },
        { title: '中心供氧恢复正常', meta: '压力 0.42MPa · 保持观察', tone: 'cyan' },
      ],
    },
  ]
}

export function HomeHospitalDashboard() {
  const me = useAuthSession((s) => s.me)
  const now = useClock()
  const greetName = me?.displayName ?? me?.username ?? ''

  const [trendRange, setTrendRange] = useState<TrendRange>(7)
  const [refreshTick, setRefreshTick] = useState(0)
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(30)
  const [operationMode, setOperationMode] = useState<OperationModeKey>('daily')
  const [visualMode, setVisualMode] = useState<VisualMode>('day')
  const [activeRole, setActiveRole] = useState<RoleKey>('device')
  const [liveSummary, setLiveSummary] = useState<HospitalDashboardSummary | null>(null)
  const [summaryErr, setSummaryErr] = useState<string | null>(null)
  const [liveRepairTrend, setLiveRepairTrend] = useState<DashboardRepairTrend | null>(null)
  const [trendErr, setTrendErr] = useState<string | null>(null)
  const [liveFinance, setLiveFinance] = useState<DashboardFinancePaymentSummary | null>(null)
  const [financeErr, setFinanceErr] = useState<string | null>(null)
  const [liveWorkspace, setLiveWorkspace] = useState<DashboardWorkspaceTasks | null>(null)
  const [workspaceErr, setWorkspaceErr] = useState<string | null>(null)

  useEffect(() => {
    if (autoRefreshSec <= 0) return undefined
    const id = window.setInterval(() => setRefreshTick((t) => t + 1), autoRefreshSec * 1000)
    return () => window.clearInterval(id)
  }, [autoRefreshSec])

  useEffect(() => {
    void refreshTick
    if (IS_AUTH_MOCK) {
      setLiveSummary(null)
      setSummaryErr(null)
      setLiveRepairTrend(null)
      setTrendErr(null)
      setLiveFinance(null)
      setFinanceErr(null)
      setLiveWorkspace(null)
      setWorkspaceErr(null)
      return undefined
    }
    let cancelled = false

    const load = async <T,>(fn: () => Promise<T>, onOk: (v: T) => void, onFail: (msg: string) => void) => {
      try {
        const v = await fn()
        if (!cancelled) onOk(v)
      } catch (e) {
        if (!cancelled) onFail(e instanceof ApiClientError ? e.message : '加载失败')
      }
    }

    void Promise.all([
      load(
        fetchHospitalDashboardSummary,
        (data) => {
          setLiveSummary(data)
          setSummaryErr(null)
        },
        (msg) => {
          setLiveSummary(null)
          setSummaryErr(msg)
        },
      ),
      load(
        () => fetchDashboardRepairTrend(trendRange),
        (data) => {
          setLiveRepairTrend(data)
          setTrendErr(null)
        },
        (msg) => {
          setLiveRepairTrend(null)
          setTrendErr(msg)
        },
      ),
      load(
        () => fetchDashboardFinancePaymentSummary(30),
        (data) => {
          setLiveFinance(data)
          setFinanceErr(null)
        },
        (msg) => {
          setLiveFinance(null)
          setFinanceErr(msg)
        },
      ),
      load(
        () => fetchDashboardWorkspaceTasks(8),
        (data) => {
          setLiveWorkspace(data)
          setWorkspaceErr(null)
        },
        (msg) => {
          setLiveWorkspace(null)
          setWorkspaceErr(msg)
        },
      ),
    ])

    return () => {
      cancelled = true
    }
  }, [refreshTick, trendRange])

  const totalAssets = liveSummary?.assets.total ?? 1842
  const openOrders = liveSummary?.repairs.open_orders ?? 37
  const todayRepair = liveSummary?.repairs.today_created ?? 18
  const onlineRate = clampMetric(92.6 - openOrders * 0.02 + Math.min(todayRepair, 30) * 0.01, 86.5, 98.8)
  const highRiskCount = clampMetric(Math.round(openOrders * 0.38) + 6, 11, 46)
  const todayAlarm = todayRepair + 18
  const pmOverdueCount = 17
  const offlineAssets = Math.round(totalAssets * 0.042)
  const healthScore = 89.5
  const sourceUpdatedText =
    formatGeneratedAt(liveSummary?.generated_at) ??
    formatGeneratedAt(liveRepairTrend?.generated_at) ??
    formatGeneratedAt(liveWorkspace?.generated_at) ??
    formatDateTime(now)

  const todoFeedRows = useMemo(() => buildTodoRows(liveWorkspace), [liveWorkspace])
  const financeBars = liveFinance?.bars?.length ? liveFinance.bars : PAYMENT_SUMMARY
  const financeTotal = financeBars.reduce((sum, item) => sum + Number(item.value || 0), 0)
  const partialStatHints = [trendErr, financeErr, workspaceErr].filter(Boolean).join(' · ')
  const dataMode = liveSummary ? '后端聚合' : IS_AUTH_MOCK ? '演示模式' : '演示回退'
  const activeMode = OPERATION_MODES.find((mode) => mode.key === operationMode) ?? OPERATION_MODES[0]

  useEffect(() => {
    if (operationMode === 'night') setVisualMode('night')
  }, [operationMode])

  const roleProfiles = useMemo(
    () =>
      buildRoleProfiles({
        healthScore,
        openOrders,
        highRiskCount,
        todayAlarm,
        onlineRate,
        pmOverdueCount,
        todoFeedRows,
      }),
    [healthScore, highRiskCount, onlineRate, openOrders, pmOverdueCount, todayAlarm, todoFeedRows],
  )

  const trendOption = useMemo(() => {
    const liveOk =
      liveRepairTrend?.days === trendRange &&
      liveRepairTrend.labels.length === liveRepairTrend.reported.length &&
      liveRepairTrend.labels.length === liveRepairTrend.completed.length
    const labels = liveOk
      ? liveRepairTrend.labels
      : trendRange === 7
        ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
        : Array.from({ length: trendRange }, (_, i) => `${i + 1}日`)
    const reported = liveOk ? liveRepairTrend.reported : trendRange === 7 ? REPAIR_TREND_7 : expandSeries(REPAIR_TREND_30, trendRange, 2)
    const completed = liveOk
      ? liveRepairTrend.completed
      : trendRange === 7
        ? REPAIR_COMPLETED_TREND_7
        : expandSeries(REPAIR_COMPLETED_TREND_30, trendRange, 5)
    const maxFault = Math.max(...reported, 1)
    const health = reported.map((v, i) => Number(clampMetric(92.5 - (v / maxFault) * 5.6 + Math.sin(i / 3) * 0.8, 82, 96).toFixed(2)))
    const pm = completed.map((v, i) => Number(clampMetric(80.8 + (v / Math.max(maxFault, 1)) * 8.8 + Math.sin(i / 5), 72, 94).toFixed(2)))
    const risk = reported.map((v, i) => Number(clampMetric(18 + v * 0.52 - (completed[i] ?? 0) * 0.16, 8, 46).toFixed(2)))
    return {
      color: ['#1677ff', '#13c2c2', '#fa8c16'],
      animationDuration: 900,
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(8, 18, 34, 0.94)',
        borderColor: 'rgba(19, 194, 194, 0.22)',
        textStyle: { color: '#fff' },
        axisPointer: { type: 'line' as const, lineStyle: { color: '#13c2c2', type: 'dashed' as const } },
      },
      legend: { top: 6, icon: 'roundRect', itemWidth: 14, itemHeight: 7, textStyle: { color: '#475569', fontSize: 12 } },
      grid: { left: 42, right: 36, top: 48, bottom: 30 },
      xAxis: {
        type: 'category' as const,
        boundaryGap: false,
        data: labels,
        axisLine: { lineStyle: { color: '#dbe7f3' } },
        axisTick: { show: false },
        axisLabel: { color: '#64748b', fontSize: 11, hideOverlap: true },
      },
      yAxis: [
        {
          type: 'value' as const,
          min: 0,
          max: 100,
          axisLabel: { color: '#94a3b8', formatter: '{value}' },
          splitLine: { lineStyle: { color: '#e8eef5', type: 'dashed' as const } },
        },
        {
          type: 'value' as const,
          min: 0,
          axisLabel: { color: '#94a3b8' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '健康指数',
          type: 'line' as const,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 3, shadowBlur: 12, shadowColor: '#1677ff' },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(22, 119, 255, 0.2)' },
                { offset: 1, color: 'rgba(22, 119, 255, 0)' },
              ],
            },
          },
          data: health,
        },
        { name: 'PM完成率', type: 'line' as const, smooth: true, symbol: 'none', lineStyle: { width: 2.8, shadowBlur: 9, shadowColor: '#13c2c2' }, data: pm },
        { name: '风险指数', type: 'line' as const, yAxisIndex: 1, smooth: true, symbol: 'none', lineStyle: { width: 2.8, shadowBlur: 9, shadowColor: '#fa8c16' }, data: risk },
      ],
    }
  }, [liveRepairTrend, trendRange])

  const largeEquipmentOption = useMemo(
    () => ({
      color: ['#1677ff', '#13c2c2', '#fa8c16'],
      tooltip: { trigger: 'axis' as const, backgroundColor: 'rgba(8, 18, 34, 0.94)', textStyle: { color: '#fff' } },
      legend: { top: 4, textStyle: { color: '#475569' }, icon: 'roundRect' },
      grid: { left: 40, right: 36, top: 44, bottom: 28 },
      xAxis: {
        type: 'category' as const,
        data: LARGE_EQUIPMENT.map((x) => x.name),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#dbe7f3' } },
        axisLabel: { color: '#64748b' },
      },
      yAxis: [
        { type: 'value' as const, axisLabel: { color: '#94a3b8', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#e8eef5', type: 'dashed' as const } } },
        { type: 'value' as const, axisLabel: { color: '#94a3b8', formatter: '{value}h' }, splitLine: { show: false } },
      ],
      series: [
        { name: '开机率', type: 'bar' as const, barWidth: 18, itemStyle: { borderRadius: [8, 8, 0, 0] }, data: LARGE_EQUIPMENT.map((x) => x.utilization) },
        { name: '单机效益', type: 'line' as const, smooth: true, symbolSize: 7, lineStyle: { width: 3, shadowBlur: 8, shadowColor: '#13c2c2' }, data: LARGE_EQUIPMENT.map((x) => x.benefit) },
        { name: '停机时长', type: 'line' as const, yAxisIndex: 1, smooth: true, symbolSize: 7, lineStyle: { width: 3, shadowBlur: 8, shadowColor: '#fa8c16' }, data: LARGE_EQUIPMENT.map((x) => x.downtime) },
      ],
    }),
    [],
  )

  const requestRefresh = () => setRefreshTick((t) => t + 1)

  const enterFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.()
      return
    }
    void document.documentElement.requestFullscreen?.()
  }

  const exportSnapshot = () => {
    const snapshot = {
      generated_at: new Date().toISOString(),
      operationMode,
      healthScore,
      totalAssets,
      todayAlarm,
      openOrders,
      highRiskCount,
      pmOverdueCount,
      offlineAssets,
    }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medical-equipment-ioc-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="home-dash home-ioc" data-mode={activeMode.tone} data-visual-mode={visualMode}>
      <div className="home-ioc__notice-stack">
        {IS_AUTH_MOCK ? (
          <Alert
            type="info"
            showIcon
            closable
            message="演示模式（Mock 登录）"
            description="当前未请求工作台汇总接口；IOC 页面以演示运营数据呈现。将 VITE_AUTH_MOCK 设为 false 后使用真实账号可接入后端聚合。"
          />
        ) : null}
        {!IS_AUTH_MOCK && summaryErr ? (
          <Alert
            type="warning"
            showIcon
            closable
            message="工作台汇总暂不可用"
            description={`${summaryErr} · 当前 IOC 指标已回退为演示口径，自动刷新仍会重试接口。`}
          />
        ) : null}
        {!IS_AUTH_MOCK && partialStatHints ? (
          <Alert type="info" showIcon closable message="部分扩展统计暂不可用" description={`${partialStatHints} · 对应图表或列表已回退为演示数据。`} />
        ) : null}
      </div>

      <div className="home-ioc-topline">
        <div className="home-ioc-brand">
          <span>Medical Equipment Digital IOC</span>
          <h1>医学装备数字运营指挥中心</h1>
          <p>五莲县人民医院 · 医院医学装备全生命周期闭环管理平台{greetName ? ` · ${greetName}` : ''}</p>
        </div>
        <OperationModeSwitch active={activeMode} onChange={setOperationMode} visualMode={visualMode} onVisualModeChange={setVisualMode} />
        <div className="home-ioc-actions">
          <Tooltip title="全屏">
            <Button icon={<FullscreenOutlined />} onClick={enterFullscreen} />
          </Tooltip>
          <Tooltip title="刷新">
            <Button icon={<ReloadOutlined />} onClick={requestRefresh} />
          </Tooltip>
          <Tooltip title="导出">
            <Button icon={<DownloadOutlined />} onClick={exportSnapshot} />
          </Tooltip>
          <Select
            size="middle"
            value={autoRefreshSec}
            popupMatchSelectWidth={false}
            className="home-ioc-actions__select"
            options={[
              { label: '关闭刷新', value: 0 },
              { label: '30秒刷新', value: 30 },
              { label: '60秒刷新', value: 60 },
            ]}
            onChange={(v) => setAutoRefreshSec(Number(v))}
          />
        </div>
      </div>

      <section className="home-ioc-command-deck">
        <SystemStatusPanel onlineRate={onlineRate} />
        <HealthCore score={healthScore} riskLevel={highRiskCount} />
        <RiskSummaryPanel
          todayAlarm={todayAlarm}
          highRiskCount={highRiskCount}
          pmOverdueCount={pmOverdueCount}
          offlineAssets={offlineAssets}
          now={now}
          sourceUpdatedText={sourceUpdatedText}
        />
      </section>

      <section className="home-ioc-primary-grid">
        <RiskCenter />
        <EventCenter />
      </section>

      <section className="home-ioc-secondary-grid">
        <HospitalHeatMap />
        <AIOpsCenter totalAssets={totalAssets} openOrders={openOrders} financeTotal={financeTotal} />
      </section>

      <section className="home-ioc-analysis-grid">
        <article className="home-ioc-panel home-ioc-panel--trend">
          <div className="home-ioc-panel__head">
            <SectionTitle en={`${dataMode} · HEALTH TREND`} cn="运行态势" />
            <div className="home-ioc-seg" role="tablist">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  data-active={trendRange === days ? 'true' : 'false'}
                  onClick={() => setTrendRange(days as TrendRange)}
                >
                  {days}天
                </button>
              ))}
            </div>
          </div>
          <ReactECharts option={trendOption} style={{ width: '100%', height: 286 }} opts={{ renderer: 'svg' }} />
        </article>

        <RoleCockpit activeRole={activeRole} setActiveRole={setActiveRole} profiles={roleProfiles} />
      </section>

      <section className="home-ioc-bottom-grid">
        <article className="home-ioc-panel home-ioc-panel--large">
          <div className="home-ioc-panel__head">
            <SectionTitle en="HIGH VALUE OPS" cn="大型设备运营" />
            <FundProjectionScreenOutlined />
          </div>
          <ReactECharts option={largeEquipmentOption} style={{ width: '100%', height: 236 }} opts={{ renderer: 'svg' }} />
          <div className="home-equipment-table">
            {LARGE_EQUIPMENT.map((row) => (
              <div key={row.code}>
                <strong>{row.code}</strong>
                <span>
                  {row.vendor} · {row.name}
                </span>
                <span>检查 {row.volume} 人次 · 停机 {row.downtime}h</span>
              </div>
            ))}
          </div>
        </article>

        <OperationPulse />
      </section>
    </div>
  )
}
