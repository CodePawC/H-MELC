import { useMemo, useState } from 'react'
import { Alert, App, Button, Card, Col, Progress, Row, Space, Statistic, Steps, Tag } from 'antd'
import type { ProColumns } from '@ant-design/pro-components'
import { ProTable } from '@ant-design/pro-components'
import {
  AlertOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons'

import { PageScaffold } from '../../components/hospital/PageScaffold'
import { PAY_STATUS, PM_STATUS, StatusTag, DEVICE_STATUS, METER_STATUS, WORK_ORDER_STATUS, UrgentBadge } from '../../constants/hospitalStatus'
import { SUPPLIERS } from '../../mock/hospital/fixtures'
import {
  MOCK_ASSETS,
  MOCK_CONSUMABLES,
  MOCK_METER,
  MOCK_PAYMENTS,
  MOCK_PM,
  MOCK_PURCHASE,
  MOCK_REPAIRS,
  MOCK_RISKS,
  MOCK_TODOS,
  type MockAssetRow,
  type MockConsumableRow,
  type MockMeterRow,
  type MockPaymentRow,
  type MockPmRow,
  type MockPurRow,
  type MockRepairRow,
  type MockRiskRow,
  type MockTodoRow,
} from '../../mock/hospital/tables'
import { DeviceArchiveDrawer, RepairOrderDrawer, Supplier360Drawer } from './HospitalDrawers'

type PresetConfig<T extends Record<string, unknown> = Record<string, unknown>> = {
  title: string
  description: string
  columns: ProColumns<T>[]
  data: T[]
  rowKey: string
  drawer?: 'device' | 'repair' | 'supplier'
  metrics?: PresetMetric[]
  flow?: string[]
  insight?: string
}

type PresetMetric = { title: string; value: string | number; suffix?: string; trend?: string }

function toolBar(message: ReturnType<typeof App.useApp>['message']) {
  return [
    <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => message.info('演示环境：写入接口待对接')}>
      新增
    </Button>,
    <Button key="imp" icon={<ImportOutlined />} onClick={() => message.info('批量导入')}>
      导入
    </Button>,
    <Button key="exp" icon={<DownloadOutlined />} onClick={() => message.info('导出 Excel')}>
      导出
    </Button>,
    <Button key="del" danger icon={<DeleteOutlined />} onClick={() => message.warning('请勾选表格行后删除')}>
      删除
    </Button>,
    <Button key="ref" icon={<ReloadOutlined />}>
      刷新
    </Button>,
    <Button key="col" icon={<SettingOutlined />}>
      列设置
    </Button>,
  ]
}

const PRESETS: Record<string, PresetConfig> = {}

function reg<T extends Record<string, unknown>>(key: string, cfg: PresetConfig<T>) {
  PRESETS[key] = cfg as PresetConfig
}

function flowForPreset(preset: string, title: string) {
  if (preset.startsWith('task_center_')) return ['事件接入', '任务生成', '自动派单', 'SLA升级', '闭环验收']
  if (preset.startsWith('dashboard_')) return ['实时采集', '态势研判', '风险识别', '任务下发', '运营复盘']
  if (preset.startsWith('ioc_')) return ['数据聚合', '大屏编排', '终端发布', '实时刷新', '调度联动']
  if (preset.startsWith('ai_')) return ['数据输入', 'AI研判', '生成建议', '自动建任务', '人工确认']
  if (preset.startsWith('pur_')) return ['申请', '论证', '审批', '合同', '验收', '入库']
  if (preset.startsWith('sp_')) return ['提交', '审核', '协同处理', '对账', '归档']
  if (preset.startsWith('fin_')) return ['发票', '应付', '审批', '付款', '分摊', '对账']
  if (preset.startsWith('cons_')) return ['目录', '入库', '领用', '库存预警', 'SPD同步']
  if (preset.startsWith('qc_')) return ['发现', '上报', '研判', '整改', '复盘']
  if (preset.startsWith('analytics_')) return ['采集', '清洗', '计算', '分析', '导出']
  if (preset.startsWith('assets_')) return ['建档', '使用', '维护', '计量', '报废']
  if (preset.startsWith('meter_')) return ['建档', '计划', '送检', '证书', '预警']
  if (preset.startsWith('pm_')) return ['计划', '派发', '执行', '验收', '闭环']
  return [title, '筛选', '办理', '留痕']
}

function metricsForConfig(cfg: PresetConfig): PresetMetric[] {
  const rows = cfg.data ?? []
  const amount = rows.reduce((sum, row) => {
    const r = row as Record<string, unknown>
    const value = Number(r.amount ?? r.invoiceAmt ?? r.originalValue ?? r.stock ?? 0)
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)
  const statusCount = new Set(
    rows
      .map((row) => {
        const r = row as Record<string, unknown>
        return r.status ?? r.st ?? r.payStatus
      })
      .filter(Boolean),
  ).size
  return [
    { title: '当前记录', value: rows.length, suffix: '条' },
    { title: '状态类型', value: statusCount || 1, suffix: '类' },
    { title: '本期金额', value: amount > 10000 ? Math.round(amount / 10000) : amount || rows.length * 12, suffix: amount > 10000 ? '万元' : '项' },
    { title: '闭环率', value: 92 + (rows.length % 6), suffix: '%' },
  ]
}

function buildFallbackPreset(preset: string, label: string): PresetConfig {
  const isFinance = preset.startsWith('fin_')
  const isQc = preset.startsWith('qc_')
  const isConsumable = preset.startsWith('cons_')
  const isTask = preset.startsWith('task_center_')
  const isDashboard = preset.startsWith('dashboard_')
  const isAi = preset.startsWith('ai_')
  const isIoc = preset.startsWith('ioc_')
  const data = Array.from({ length: 8 }, (_, i) => ({
    id: `${preset}-${i}`,
    code: `${preset.toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
    name: `${label}事项 ${i + 1}`,
    source: ['IoT报警', 'AI预警', '人工上报', '接口同步'][i % 4],
    owner: ['设备科', '财务科', '医学工程组', '供应商'][i % 4],
    sla: ['30分钟', '2小时', '当日', '3个工作日'][i % 4],
    riskLevel: i % 5 === 0 ? 'High' : i % 3 === 0 ? 'Medium' : 'Info',
    amount: isFinance ? 12000 + i * 3600 : isConsumable ? 80 + i * 12 : 20 + i,
    status: isTask && i % 4 === 0 ? '超时升级' : isQc && i % 3 === 0 ? '待整改' : i % 2 === 0 ? '进行中' : '已闭环',
    updatedAt: `2026-05-${String((i % 9) + 1).padStart(2, '0')} 10:${String(i * 7).padStart(2, '0')}`,
  }))
  return {
    title: label,
    description: isTask
      ? '任务运营中心基于“事件 → 任务 → 派单 → SLA升级 → 验收归档”的任务引擎组织全院事项。'
      : isDashboard || isIoc || isAi
        ? '本页按 Hospital Medical Equipment Lifecycle Closed-loop Management Platform 架构提供实时状态、风险提示、AI建议与任务联动入口。'
        : '本页已提供业务列表、指标摘要、流程指引与操作入口；所有异常最终可转入任务引擎闭环。',
    columns: [
      { title: '单据编号', dataIndex: 'code', width: 170, copyable: true },
      { title: '事项名称', dataIndex: 'name', ellipsis: true },
      { title: '事件来源', dataIndex: 'source', width: 110 },
      { title: '责任方', dataIndex: 'owner', width: 120 },
      { title: 'SLA', dataIndex: 'sla', width: 100 },
      { title: '风险等级', dataIndex: 'riskLevel', width: 100 },
      { title: isFinance ? '金额' : isConsumable ? '数量' : isAi || isIoc ? '置信度' : '指标值', dataIndex: 'amount', width: 110 },
      { title: '状态', dataIndex: 'status', width: 100 },
      { title: '更新时间', dataIndex: 'updatedAt', width: 160 },
      { title: '操作', valueType: 'option', width: 150, render: () => [<a key="task">生成任务</a>, <a key="flow">闭环</a>] },
    ],
    data,
    rowKey: 'id',
    insight: isTask
      ? '任务引擎将维修、PM、计量、风险、不良事件、采购、付款、医用气体、辐射安全与AI预警统一转为可追踪任务，并按SLA自动升级。'
      : undefined,
  }
}

/** 待办状态 Tag（对齐浅色表格可读性） */
function todoStatusTag(status: string) {
  if (status.includes('逾期')) return <Tag color="red">{status}</Tag>
  if (status === '待办') return <Tag color="orange">{status}</Tag>
  return <Tag color="default">{status}</Tag>
}

const assetCols: ProColumns<MockAssetRow>[] = [
  { title: '关键字', dataIndex: 'keyword', hideInTable: true, fieldProps: { placeholder: '名称 / 资产编号' } },
  { title: '资产编号', dataIndex: 'assetNo', width: 150, ellipsis: true, copyable: true },
  { title: '设备名称', dataIndex: 'name', ellipsis: true },
  { title: '规格型号', dataIndex: 'spec', width: 100, search: false },
  { title: '品牌厂家', dataIndex: 'brand', width: 120, search: false },
  { title: '设备分类', dataIndex: 'category', width: 100, search: false },
  { title: '使用科室', dataIndex: 'dept', width: 120 },
  { title: '存放地点', dataIndex: 'location', ellipsis: true, search: false },
  { title: '启用日期', dataIndex: 'startDate', width: 110, search: false },
  { title: '原值(元)', dataIndex: 'originalValue', width: 110, search: false, render: (_, r) => r.originalValue.toLocaleString() },
  { title: '状态', dataIndex: 'status', width: 100, search: false, render: (_, r) => StatusTag(DEVICE_STATUS, r.status) },
  { title: '责任人', dataIndex: 'owner', width: 90, search: false },
  { title: '二维码', dataIndex: 'qr', width: 100, search: false, copyable: true },
  { title: '操作', valueType: 'option', width: 120, search: false, render: () => [<a key="d">详情</a>, <a key="q">二维码</a>] },
]

reg('assets_overview', {
  title: '设备总览',
  description: '按科室、分类、状态的聚合视图（演示为明细快照，可对接统计服务）。',
  columns: assetCols,
  data: MOCK_ASSETS,
  rowKey: 'id',
  drawer: 'device',
})

reg('assets_archive', {
  title: '设备档案',
  description: '一机一档：资产、使用、维修、计量、合同等全生命周期信息入口。',
  columns: assetCols,
  data: MOCK_ASSETS,
  rowKey: 'id',
  drawer: 'device',
})

reg('assets_category', {
  title: '设备分类',
  description: '分类体系与编码维护，支撑采购论证与效益分析口径统一。',
  columns: [
    { title: '分类编码', dataIndex: 'code', width: 120 },
    { title: '分类名称', dataIndex: 'name' },
    { title: '上级', dataIndex: 'parent', width: 120 },
    { title: '设备台数', dataIndex: 'cnt', width: 100 },
  ],
  data: [
    { id: '1', code: 'YX-01', name: 'CT', parent: '影像', cnt: 4 },
    { id: '2', code: 'YX-02', name: 'MRI', parent: '影像', cnt: 2 },
    { id: '3', code: 'SM-01', name: '呼吸机', parent: '生命支持', cnt: 38 },
  ],
  rowKey: 'id',
})

reg('assets_dept', {
  title: '科室分布',
  description: '各科室设备数量、原值、风险分布（示意）。',
  columns: [
    { title: '科室', dataIndex: 'dept' },
    { title: '台数', dataIndex: 'cnt', width: 100 },
    { title: '原值(万元)', dataIndex: 'val', width: 120 },
    { title: '高风险台数', dataIndex: 'risk', width: 120 },
  ],
  data: Object.values(
    MOCK_ASSETS.reduce<Record<string, { id: string; dept: string; cnt: number; val: number; risk: number }>>(
      (acc, a) => {
        const x = acc[a.dept] ?? { id: a.dept, dept: a.dept, cnt: 0, val: 0, risk: 0 }
        x.cnt += 1
        x.val += a.originalValue / 10000
        if (a.status === 'ABNORMAL') x.risk += 1
        acc[a.dept] = x
        return acc
      },
      {},
    ),
  ),
  rowKey: 'id',
})

reg('assets_qr', {
  title: '设备二维码',
  description: '一机一码扫码入口与标签打印批次管理。',
  columns: [
    { title: '资产编号', dataIndex: 'assetNo' },
    { title: '二维码', dataIndex: 'qr', copyable: true },
    { title: '打印批次', dataIndex: 'batch', width: 120 },
    { title: '状态', dataIndex: 'st', width: 100 },
  ],
  data: MOCK_ASSETS.map((a, i) => ({ ...a, batch: `B-2026-${i % 4}`, st: '已发放' })),
  rowKey: 'id',
  drawer: 'device',
})

reg('assets_attach', {
  title: '附件资料',
  description: '说明书、合格证、验收单、培训签到等文件集中管理。',
  columns: [
    { title: '资产编号', dataIndex: 'assetNo' },
    { title: '资料类型', dataIndex: 't' },
    { title: '文件名', dataIndex: 'f', ellipsis: true },
    { title: '上传人', dataIndex: 'u', width: 100 },
    { title: '时间', dataIndex: 'd', width: 160 },
  ],
  data: MOCK_ASSETS.slice(0, 6).map((a, i) => ({
    id: a.id,
    assetNo: a.assetNo,
    t: ['说明书', '验收单', '合格证'][i % 3],
    f: `${a.name}_随机文件_${i}.pdf`,
    u: '设备科',
    d: `2026-05-0${(i % 8) + 1} 10:00`,
  })),
  rowKey: 'id',
})

const repairCols: ProColumns<MockRepairRow>[] = [
  { title: '工单编号', dataIndex: 'orderNo', width: 150, copyable: true },
  { title: '设备名称', dataIndex: 'deviceName', ellipsis: true },
  { title: '报修科室', dataIndex: 'dept', width: 120 },
  { title: '报修人', dataIndex: 'reporter', width: 100, search: false },
  { title: '故障描述', dataIndex: 'fault', ellipsis: true, search: false },
  { title: '紧急程度', dataIndex: 'urgent', width: 100, search: false, render: (_, r) => UrgentBadge(r.urgent) },
  { title: '当前状态', dataIndex: 'status', width: 100, render: (_, r) => StatusTag(WORK_ORDER_STATUS, r.status) },
  { title: '工程师', dataIndex: 'engineer', width: 100, search: false },
  { title: '报修时间', dataIndex: 'reportTime', width: 160, search: false },
  { title: '响应时长(分)', dataIndex: 'responseMin', width: 120, search: false },
  { title: '维修费用', dataIndex: 'fee', width: 100, search: false, render: (_, r) => `¥${r.fee}` },
  { title: '操作', valueType: 'option', width: 100, render: () => [<a key="d">详情</a>] },
]

;['repair_list', 'repair_dispatch', 'repair_process', 'repair_accept', 'repair_history', 'repair_fault'].forEach((k, i) => {
  reg(k, {
    title: ['报修工单', '维修派工', '维修处理', '维修验收', '维修记录', '故障分析'][i],
    description: '统一列表规范：筛选、导出、详情抽屉、状态色标与临床闭环对齐。',
    columns: repairCols,
    data: MOCK_REPAIRS,
    rowKey: 'id',
    drawer: 'repair',
  })
})

;['pm_plan', 'pm_task', 'pm_inspect', 'pm_calendar', 'pm_overdue'].forEach((k, i) => {
  reg(k, {
    title: ['保养计划', '保养任务', '巡检记录', '维护日历', '逾期提醒'][i],
    description: '预防性维护与巡检闭环，支持逾期预警与工程师责任矩阵。',
    columns: [
      { title: '计划名称', dataIndex: 'planName', ellipsis: true },
      { title: '设备类别', dataIndex: 'category', width: 100 },
      { title: '使用科室', dataIndex: 'dept', width: 120 },
      { title: '保养周期', dataIndex: 'cycle', width: 100 },
      { title: '下次保养日期', dataIndex: 'nextDate', width: 130 },
      { title: '责任工程师', dataIndex: 'engineer', width: 110 },
      { title: '状态', dataIndex: 'status', width: 100, render: (_, r) => StatusTag(PM_STATUS, r.status) },
      { title: '逾期天数', dataIndex: 'overdueDays', width: 100 },
      { title: '操作', valueType: 'option', render: () => [<a key="x">执行</a>] },
    ] as ProColumns<MockPmRow>[],
    data: MOCK_PM,
    rowKey: 'id',
  })
})

;['meter_ledger', 'meter_plan', 'meter_record', 'meter_cert', 'meter_alert'].forEach((k, i) => {
  reg(k, {
    title: ['计量台账', '检定计划', '检定记录', '校准证书', '到期预警'][i],
    description: '强检与非强检设备分级管理，证书与到期策略联动付款与质控。',
    columns: [
      { title: '设备名称', dataIndex: 'deviceName', ellipsis: true },
      { title: '资产编号', dataIndex: 'assetNo', width: 150 },
      { title: '计量类别', dataIndex: 'meterType', width: 100 },
      { title: '检定周期(月)', dataIndex: 'cycleMonth', width: 120 },
      { title: '上次检定', dataIndex: 'lastDate', width: 120 },
      { title: '下次到期', dataIndex: 'nextDue', width: 120 },
      { title: '证书编号', dataIndex: 'certNo', width: 140 },
      { title: '检定机构', dataIndex: 'org', width: 120 },
      { title: '状态', dataIndex: 'status', width: 100, render: (_, r) => StatusTag(METER_STATUS, r.status) },
      { title: '操作', valueType: 'option', render: () => [<a key="d">详情</a>] },
    ] as ProColumns<MockMeterRow>[],
    data: MOCK_METER,
    rowKey: 'id',
  })
})

;['pur_apply', 'pur_review', 'pur_plan', 'pur_contract', 'pur_arrive', 'pur_train'].forEach((k, i) => {
  reg(k, {
    title: ['采购申请', '采购论证', '采购计划', '合同管理', '到货验收', '安装培训'][i],
    description: '采购与验收全流程留痕，对接合同、发票与资产入库。',
    columns: [
      { title: '主题', dataIndex: 'title', ellipsis: true },
      { title: '预算(万元)', dataIndex: 'amount', width: 110 },
      { title: '责任科室', dataIndex: 'dept', width: 120 },
      { title: '状态', dataIndex: 'status', width: 100 },
      { title: '日期', dataIndex: 'date', width: 120 },
      { title: '操作', valueType: 'option', render: () => [<a key="d">办理</a>] },
    ] as ProColumns<MockPurRow>[],
    data: MOCK_PURCHASE,
    rowKey: 'id',
  })
})

;['sp_profile', 'sp_invoice_up', 'sp_shipping', 'sp_quote', 'sp_pay_prog', 'sp_recon'].forEach((k, i) => {
  reg(k, {
    title: ['供应商档案', '发票上传', '随货同行单', '维修报价', '付款进度', '对账管理'][i],
    description: k === 'sp_profile' ? '院内管理与供应商协同统一入口（权限按角色隔离）。' : '供应商门户协同场景，数据范围按供应商维度隔离。',
    columns:
      k === 'sp_pay_prog' || k === 'sp_recon'
        ? ([
            { title: '供应商名称', dataIndex: 'supplier', width: 140 },
            { title: '发票编号', dataIndex: 'invoiceNo', width: 140 },
            { title: '发票金额', dataIndex: 'invoiceAmt', width: 110, render: (_, r) => (r as MockPaymentRow).invoiceAmt.toLocaleString() },
            { title: '已付款', dataIndex: 'paidAmt', width: 110, render: (_, r) => (r as MockPaymentRow).paidAmt.toLocaleString() },
            { title: '未付款', dataIndex: 'unpaidAmt', width: 110, render: (_, r) => (r as MockPaymentRow).unpaidAmt.toLocaleString() },
            { title: '付款比例', dataIndex: 'ratio', width: 90 },
            { title: '发票日期', dataIndex: 'invoiceDate', width: 120 },
            { title: '付款状态', dataIndex: 'payStatus', width: 100, render: (_, r) => StatusTag(PAY_STATUS, (r as MockPaymentRow).payStatus) },
            { title: '优先级', dataIndex: 'priority', width: 80 },
            { title: '操作', valueType: 'option', render: () => [<a key="d">详情</a>] },
          ] as ProColumns<MockPaymentRow>[])
        : ([
            { title: '名称', dataIndex: 'name', ellipsis: true },
            { title: '类型', dataIndex: 't', width: 120 },
            { title: '状态', dataIndex: 'st', width: 100 },
            { title: '更新时间', dataIndex: 'd', width: 160 },
            { title: '操作', valueType: 'option', render: () => [<a key="u">上传</a>, <a key="v">查看</a>] },
          ] as ProColumns<{ id: string; name: string; t: string; st: string; d: string }>[]),
    data:
      k === 'sp_pay_prog' || k === 'sp_recon'
        ? MOCK_PAYMENTS
        : SUPPLIERS.map((name, j) => ({
            id: String(j),
            name,
            t: ['档案', '发票', '随货单', '报价'][i % 4],
            st: '正常',
            d: '2026-05-10 09:00',
          })),
    rowKey: 'id',
    drawer: k === 'sp_profile' ? 'supplier' : undefined,
  } as PresetConfig)
})

const payCols: ProColumns<MockPaymentRow>[] = [
  { title: '供应商名称', dataIndex: 'supplier', width: 140 },
  { title: '发票编号', dataIndex: 'invoiceNo', width: 140 },
  { title: '发票金额', dataIndex: 'invoiceAmt', width: 110, render: (_, r) => r.invoiceAmt.toLocaleString() },
  { title: '已付款金额', dataIndex: 'paidAmt', width: 110, render: (_, r) => r.paidAmt.toLocaleString() },
  { title: '未付款金额', dataIndex: 'unpaidAmt', width: 110, render: (_, r) => r.unpaidAmt.toLocaleString() },
  { title: '付款比例', dataIndex: 'ratio', width: 90 },
  { title: '发票日期', dataIndex: 'invoiceDate', width: 120 },
  { title: '付款状态', dataIndex: 'payStatus', width: 100, render: (_, r) => StatusTag(PAY_STATUS, r.payStatus) },
  { title: '付款优先级', dataIndex: 'priority', width: 100 },
  { title: '操作', valueType: 'option', render: () => [<a key="d">详情</a>] },
]

;['fin_apply', 'fin_invoice', 'fin_plan', 'fin_progress', 'fin_arrear', 'fin_priority'].forEach((k, i) => {
  reg(k, {
    title: ['付款申请', '发票管理', '付款计划', '付款进度', '欠款统计', '付款优先级'][i],
    description: '财务闭环：发票—应付—付款—对账—账龄，权限与供应商/设备数据隔离。',
    columns: payCols,
    data: MOCK_PAYMENTS,
    rowKey: 'id',
  })
})

const moduleFallbackLabels: Record<string, string> = {
  pur_contract: '合同管理',
  pur_arrive: '到货验收',
  pur_train: '安装培训',
  sp_profile: '供应商档案',
  sp_invoice_up: '发票上传',
  sp_shipping: '随货同行单',
  sp_quote: '维修报价',
  sp_recon: '对账管理',
  fin_apply: '付款申请',
  fin_plan: '付款计划',
  fin_progress: '付款进度',
  fin_arrear: '欠款统计',
  cons_catalog: '耗材目录',
  cons_in: '入库管理',
  cons_out: '出库管理',
  cons_alert: '库存预警',
  cons_vbp: '带量采购',
  cons_spd: 'SPD对接',
  qc_check: '质量检查',
  qc_risk: '风险事件',
  qc_adverse: '不良事件',
  qc_emerge_dev: '应急设备',
  qc_emerge_dispatch: '应急调配',
  qc_patrol: '安全巡查',
  analytics_benefit: '设备效益分析',
  analytics_repair_cost: '维修成本分析',
  analytics_dept: '科室使用分析',
  analytics_supplier: '供应商分析',
  analytics_pay: '付款分析',
  analytics_qc: '质量指标',
}

Object.entries(moduleFallbackLabels).forEach(([key, title]) => {
  if (!PRESETS[key]) reg(key, buildFallbackPreset(key, title))
})

;['cons_catalog', 'cons_in', 'cons_out', 'cons_alert', 'cons_vbp', 'cons_spd'].forEach((k, i) => {
  reg(k, {
    title: ['耗材目录', '入库管理', '出库管理', '库存预警', '带量采购', 'SPD对接'][i],
    description: '高值/低值耗材与 SPD、带量采购政策衔接（演示数据）。',
    columns: [
      { title: '耗材名称', dataIndex: 'name', ellipsis: true },
      { title: '规格', dataIndex: 'spec', width: 100 },
      { title: '库存', dataIndex: 'stock', width: 80 },
      { title: '安全库存', dataIndex: 'min', width: 100 },
      { title: '归属科室', dataIndex: 'dept', width: 120 },
      { title: '操作', valueType: 'option', render: () => [<a key="d">详情</a>] },
    ] as ProColumns<MockConsumableRow>[],
    data: MOCK_CONSUMABLES,
    rowKey: 'id',
  })
})

;['qc_check', 'qc_risk', 'qc_adverse', 'qc_emerge_dev', 'qc_emerge_dispatch', 'qc_patrol'].forEach((k, i) => {
  reg(k, {
    title: ['质量检查', '风险事件', '不良事件', '应急设备', '应急调配', '安全巡查'][i],
    description: '质控与安全闭环：事件上报、根因分析、整改追踪与应急资源可视化。',
    columns: [
      { title: '主题', dataIndex: 'title', ellipsis: true },
      { title: '级别', dataIndex: 'level', width: 80 },
      { title: '时间', dataIndex: 'time', width: 160 },
      { title: '状态', dataIndex: 'st', width: 100 },
      { title: '操作', valueType: 'option', render: () => [<a key="d">处置</a>] },
    ] as ProColumns<MockRiskRow & { st: string }>[],
    data: MOCK_RISKS.map((r) => ({ ...r, st: '跟踪中' })),
    rowKey: 'id',
  })
})

;['analytics_benefit', 'analytics_repair_cost', 'analytics_dept', 'analytics_supplier', 'analytics_pay', 'analytics_qc'].forEach((k, i) => {
  reg(k, {
    title: ['设备效益分析', '维修成本分析', '科室使用分析', '供应商分析', '付款分析', '质量指标'][i],
    description: '管理决策视图：与台账、维修、付款、质控主数据同源，支持导出与订阅。',
    columns: [
      { title: '指标', dataIndex: 'k' },
      { title: '本期', dataIndex: 'v1', width: 120 },
      { title: '上期', dataIndex: 'v2', width: 120 },
      { title: '环比', dataIndex: 'w', width: 100 },
    ],
    data: [
      { id: '1', k: '设备使用率', v1: '68%', v2: '65%', w: '+3%' },
      { id: '2', k: '万元资产维修费', v1: '820', v2: '910', w: '-9.9%' },
    ],
    rowKey: 'id',
  })
})

reg('workspace_todo', {
  title: '我的待办',
  description: '跨模块待办聚合：维修验收、采购审批、付款审核、计量与保养逾期。',
  columns: [
    { title: '类型', dataIndex: 'type', width: 120 },
    { title: '事项', dataIndex: 'title', ellipsis: true },
    { title: '截止', dataIndex: 'due', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, r) => todoStatusTag(r.status),
    },
    { title: '操作', valueType: 'option', render: () => [<a key="x">处理</a>] },
  ] as ProColumns<MockTodoRow>[],
  data: MOCK_TODOS,
  rowKey: 'id',
})

reg('workspace_risk', {
  title: '风险预警',
  description: '急救设备、计量、维修时效、付款逾期等风险统一预警列表。',
  columns: [
    { title: '级别', dataIndex: 'level', width: 80, render: (_, r) => UrgentBadge(r.level === '高' ? '高' : '中') },
    { title: '描述', dataIndex: 'title', ellipsis: true },
    { title: '时间', dataIndex: 'time', width: 160 },
    { title: '操作', valueType: 'option', render: () => [<a key="x">研判</a>] },
  ] as ProColumns<MockRiskRow>[],
  data: MOCK_RISKS,
  rowKey: 'id',
})

reg('workspace_ai', {
  title: 'AI 助手',
  description: '对接院内知识中心与票据识别能力，提供维修辅助、付款分析与制度问答入口。',
  columns: [
    { title: '能力', dataIndex: 'k' },
    { title: '说明', dataIndex: 'd', ellipsis: true },
    { title: '操作', valueType: 'option', render: () => [<a key="o">打开</a>] },
  ],
  data: [
    { id: '1', k: '维修助手', d: '故障现象 → 可能原因与备件建议' },
    { id: '2', k: '票据识别', d: '发票/随货单 OCR 与字段回填' },
    { id: '3', k: '付款分析', d: '账龄与供应商集中度提示' },
  ],
  rowKey: 'id',
})

reg('sys_oplog', {
  title: '操作日志',
  description: '关键业务操作留痕，支持按模块、用户、时间检索。',
  columns: [
    { title: '时间', dataIndex: 't', width: 170 },
    { title: '用户', dataIndex: 'u', width: 100 },
    { title: '模块', dataIndex: 'm', width: 100 },
    { title: '动作', dataIndex: 'a', width: 120 },
    { title: '结果', dataIndex: 'r', width: 80 },
  ],
  data: Array.from({ length: 8 }, (_, i) => ({
    id: String(i),
    t: `2026-05-10 1${i}:20:00`,
    u: ['admin', 'director', 'engineer'][i % 3],
    m: ['设备', '维修', '付款'][i % 3],
    a: ['UPDATE', 'EXPORT', 'APPROVE'][i % 3],
    r: '成功',
  })),
  rowKey: 'id',
})

reg('sys_params', {
  title: '参数配置',
  description: '系统级参数、接口开关与业务规则默认值（演示数据）。',
  columns: [
    { title: '参数键', dataIndex: 'k', width: 200, ellipsis: true },
    { title: '当前值', dataIndex: 'v', width: 140 },
    { title: '说明', dataIndex: 'd', ellipsis: true },
    { title: '操作', valueType: 'option', width: 100, render: () => [<a key="e">编辑</a>] },
  ],
  data: [
    { id: '1', k: 'repair.sla.response_minutes', v: '30', d: '报修响应 SLA（分钟）' },
    { id: '2', k: 'meter.alert.lead_days', v: '30', d: '计量到期提前预警天数' },
    { id: '3', k: 'finance.payment.batch_limit', v: '500000', d: '单笔付款审批阈值（元）' },
  ],
  rowKey: 'id',
})

export function HospitalPresetPage({ preset, label }: { preset: string; label: string }) {
  const { message } = App.useApp()
  const cfg = PRESETS[preset]
  const [devOpen, setDevOpen] = useState(false)
  const [repOpen, setRepOpen] = useState(false)
  const [supOpen, setSupOpen] = useState(false)
  const [assetRow, setAssetRow] = useState<MockAssetRow | null>(null)
  const [repRow, setRepRow] = useState<MockRepairRow | null>(null)

  const merged = useMemo(() => {
    if (cfg) return { ...cfg, title: cfg.title || label }
    return buildFallbackPreset(preset, label)
  }, [cfg, label])
  const metrics = merged.metrics ?? metricsForConfig(merged)
  const flow = merged.flow ?? flowForPreset(preset, merged.title)
  const insight =
    merged.insight ??
    `${merged.title}已具备列表检索、批量动作、流程留痕和导出入口；接入真实接口时保留当前列结构即可完成联调验收。`
  const isTaskEnginePage =
    preset.startsWith('task_center_') ||
    preset.startsWith('dashboard_') ||
    preset.startsWith('ai_') ||
    preset.startsWith('ioc_')

  return (
    <>
      <PageScaffold title={merged.title} description={merged.description} extra={toolBar(message)}>
        <Alert
          type="warning"
          showIcon
          message="后续阶段 / 演示页面 / 待接入真实后端接口"
          description="该页面用于菜单结构、流程样式和演示数据验证，不纳入一期真实闭环 Verified 验收范围。"
          style={{ marginBottom: 12 }}
        />
        {isTaskEnginePage ? (
          <Card
            className="hospital-os-loop-card"
            size="small"
            bordered
            style={{ borderRadius: 10, marginBottom: 12 }}
          >
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} lg={8}>
                <Space direction="vertical" size={4}>
                  <Tag color="blue">Hospital Medical Equipment Lifecycle Closed-loop Management Platform</Tag>
                  <strong style={{ fontSize: 18 }}>事件 → 任务 → 闭环</strong>
                  <span style={{ color: '#64748b', fontSize: 12 }}>
                    统一把报警、风险、PM、维修、采购、财务、质量安全与 AI 预警转为可追踪任务。
                  </span>
                </Space>
              </Col>
              <Col xs={24} lg={10}>
                <Steps
                  size="small"
                  current={2}
                  items={['事件接入', '任务生成', '自动派单', 'SLA升级', '闭环验收'].map((title) => ({ title }))}
                />
              </Col>
              <Col xs={24} lg={6}>
                <Space wrap>
                  <Tag color="processing" icon={<AlertOutlined />}>WebSocket实时刷新</Tag>
                  <Tag color="cyan" icon={<CheckCircleOutlined />}>AI自动派单</Tag>
                </Space>
              </Col>
            </Row>
          </Card>
        ) : null}
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          {metrics.map((item) => (
            <Col xs={12} md={6} key={item.title}>
              <Card size="small" bordered style={{ borderRadius: 8, height: '100%' }}>
                <Statistic
                  title={item.title}
                  value={item.value}
                  suffix={item.suffix}
                  valueStyle={{ color: '#155eef', fontWeight: 700, fontSize: 24 }}
                />
                {item.trend ? <Tag color={item.trend.startsWith('-') ? 'green' : 'blue'}>{item.trend}</Tag> : null}
              </Card>
            </Col>
          ))}
        </Row>
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          <Col xs={24} lg={16}>
            <Card size="small" bordered style={{ borderRadius: 8, height: '100%' }}>
              <Steps
                size="small"
                current={Math.max(1, Math.min(flow.length - 2, 2))}
                items={flow.map((title) => ({ title }))}
              />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card size="small" bordered style={{ borderRadius: 8, height: '100%' }}>
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Alert type="info" showIcon message="联调提示" description={insight} />
                <Progress percent={metrics[3] ? Number(metrics[3].value) || 92 : 92} size="small" />
              </Space>
            </Card>
          </Col>
        </Row>
        <ProTable
          rowKey={merged.rowKey}
          columns={merged.columns}
          dataSource={merged.data}
          search={
            merged.columns.some((c) => c.hideInTable) ? { labelWidth: 'auto', defaultCollapsed: true } : false
          }
          pagination={{ pageSize: 10, showSizeChanger: false, style: { marginBottom: 0 } }}
          cardBordered={false}
          ghost={false}
          cardProps={{
            style: { background: '#ffffff' },
            bodyStyle: { background: '#ffffff' },
          }}
          options={{ reload: true, density: true, setting: true }}
          dateFormatter="string"
          headerTitle={false}
          toolBarRender={() => toolBar(message)}
          onRow={(record) => ({
            onClick: () => {
              if (merged.drawer === 'device' && 'assetNo' in record) {
                setAssetRow(record as MockAssetRow)
                setDevOpen(true)
              }
              if (merged.drawer === 'repair' && 'orderNo' in record) {
                setRepRow(record as MockRepairRow)
                setRepOpen(true)
              }
              if (merged.drawer === 'supplier') {
                setSupOpen(true)
              }
            },
          })}
        />
      </PageScaffold>
      <DeviceArchiveDrawer open={devOpen} onClose={() => setDevOpen(false)} row={assetRow} />
      <RepairOrderDrawer open={repOpen} onClose={() => setRepOpen(false)} row={repRow} />
      <Supplier360Drawer open={supOpen} onClose={() => setSupOpen(false)} />
    </>
  )
}
