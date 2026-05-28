import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  PrinterOutlined,
  QrcodeOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { Alert, Button, Descriptions, Empty, Modal, Progress, Row, Col, Space, Statistic, Table, Tabs, Tag, Timeline, Typography, message } from 'antd'

import {
  adjustClassificationImpact,
  bindAssetClassification,
  confirmClassificationImpact,
  fetchAssetDetail,
  ignoreClassificationImpact,
  recordClassificationDetailView,
  updateAsset,
} from '../api/assets'
import type { AssetDetailBundle, ClassificationImpact, QrRow } from '../api/assets'
import { matchDeviceClassification } from '../api/hmdm'
import type { DeviceClassificationCandidate } from '../api/hmdm'
import type { DeviceCategory } from '../api/mdm'
import { DeviceCategorySelector } from '../components/DeviceCategorySelector'
import { IS_AUTH_MOCK } from '../config/authMode'
import { ApiClientError } from '../lib/api'
import { AssetLabelPrintPanel, type AssetLabelPrintTarget } from './assets/AssetLabelPrintPanel'
import {
  buildAssetLifecycleEvents,
  buildAssetTwinImage,
  buildAssetTwinMetrics,
  buildMockArchiveRows,
  enrichAssetRow,
  formatArchiveAssetCode,
  type AssetArchiveDisplayRow,
} from './assets/assetArchiveEnrichment'
import { mockCalRows, mockContractRows, mockPmRows } from './assets/assetArchiveDrawerMock'

import './assets/assetArchive.css'

const { Text, Title } = Typography

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

function errorText(e: unknown): string {
  return e instanceof ApiClientError ? e.message : String(e)
}

function moneyWan(v: number) {
  return (v / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })
}

function moneyCn(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? `¥ ${n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : String(v)
}

function riskColor(risk: AssetArchiveDisplayRow['risk_display']) {
  if (risk === '高风险') return 'red'
  if (risk === '中风险') return 'orange'
  return 'green'
}

function runColor(run: AssetArchiveDisplayRow['run_display']) {
  if (run === '在用') return 'green'
  if (run === '维修中') return 'blue'
  if (run === '停用') return 'default'
  if (run === '报废') return 'default'
  return 'red'
}

function classificationStatusLabel(value?: string | null) {
  const map: Record<string, string> = {
    unclassified: '未分类',
    auto_recommended: '自动推荐',
    pending_confirm: '待确认',
    confirmed: '已确认',
    need_review: '需复核',
    expired: '已失效',
    remapped: '已重映射',
    unable_to_match: '无法匹配',
  }
  return value ? map[value] ?? value : '未分类'
}

function classificationStatusColor(value?: string | null) {
  if (value === 'confirmed' || value === 'remapped') return 'green'
  if (value === 'need_review' || value === 'pending_confirm' || value === 'auto_recommended') return 'orange'
  if (value === 'expired' || value === 'unable_to_match') return 'red'
  return 'default'
}

type GovernanceStatus = 'UNSYNCED' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'PENDING_REVIEW' | 'CONFLICT'

function governanceStatusTag(status: GovernanceStatus) {
  const map: Record<GovernanceStatus, { color: string; label: string }> = {
    SYNCED: { color: 'green', label: '已同步' },
    PENDING_REVIEW: { color: 'orange', label: '待审核' },
    CONFLICT: { color: 'red', label: '冲突待处理' },
    UNSYNCED: { color: 'default', label: '未同步' },
    FAILED: { color: 'red', label: '同步失败' },
    SYNCING: { color: 'processing', label: '同步中' },
  }
  const item = map[status]
  return <Tag color={item.color}>{item.label}</Tag>
}

function buildGovernanceSnapshot(row: AssetArchiveDisplayRow) {
  const formattedCode = formatArchiveAssetCode(row.asset_code, row.id)
  const syncStatus: GovernanceStatus = row.risk_display === '高风险' ? 'PENDING_REVIEW' : row.metrology_display === '已过期' ? 'CONFLICT' : 'SYNCED'
  const qualityScore = syncStatus === 'CONFLICT' ? 82 : syncStatus === 'PENDING_REVIEW' ? 91 : 96
  const completeness = row.serial_number && row.registration_no ? 94 : 86
  const mappingRate = syncStatus === 'CONFLICT' ? 76 : 92
  return {
    currentSource: '医学装备运营 OS',
    hudmpCode: `HMDM-EQ-${formattedCode.replace(/\W/g, '').slice(-10)}`,
    osCode: formattedCode,
    fixedAssetCode: `FA-${formattedCode.replace(/\W/g, '').slice(-8)}`,
    hisCode: `HIS-EQ-${row.department_name.replace(/\W/g, '').slice(0, 4) || 'DEPT'}-${row.id.slice(0, 4)}`,
    spdCode: `SPD-${row.supplier_id?.slice(0, 8) ?? row.id.slice(0, 8)}`,
    lastSyncAt: '2026-05-19 08:40',
    syncStatus,
    qualityScore,
    completeness,
    mappingRate,
    conflicts: [
      syncStatus === 'CONFLICT'
        ? { field: '计量属性', osValue: row.metrology_display, hudmpValue: '待复核', strategy: '人工审核合并' }
        : { field: '供应商名称', osValue: row.supplier_demo_name, hudmpValue: row.supplier_demo_name, strategy: '已匹配' },
      syncStatus === 'PENDING_REVIEW'
        ? { field: '风险等级', osValue: row.risk_display, hudmpValue: '标准风险等级待发布', strategy: '候选申请提交 H-UMDG' }
        : { field: '设备状态', osValue: row.run_display, hudmpValue: row.run_display, strategy: '以 OS 业务状态为准' },
    ],
    versions: [
      { version: 'v3', time: '2026-05-19 08:40', operator: '系统同步', action: '更新 H-UMDG 引用快照' },
      { version: 'v2', time: row.install_display, operator: '设备科', action: '验收建档并生成一机一码' },
      { version: 'v1', time: row.purchase_display, operator: '采购验收', action: '到货登记形成设备草稿' },
    ],
  }
}

function QrTable({ rows }: { rows: QrRow[] }) {
  if (!rows.length) return <Empty description="暂无有效二维码记录" />
  return (
    <Table
      size="small"
      pagination={false}
      rowKey="id"
      dataSource={rows}
      columns={[
        { title: '版本', dataIndex: 'qr_version', width: 90 },
        { title: '状态', dataIndex: 'status', width: 120 },
        {
          title: 'qr_token',
          dataIndex: 'qr_token',
          ellipsis: true,
          render: (value: string) => <Text code>{value}</Text>,
        },
      ]}
    />
  )
}

function RepairTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <Empty description="暂无维修工单或后端暂未返回 repair 汇总" />
  return (
    <Table
      size="small"
      pagination={false}
      rowKey={(r) => String(r.id ?? r.order_code)}
      dataSource={rows}
      scroll={{ x: 760 }}
      columns={[
        {
          title: '工单号',
          dataIndex: 'order_code',
          width: 140,
          render: (value: string, row: Record<string, unknown>) =>
            row.id ? <Link to={`/maintenance/tickets/${String(row.id)}`}>{fmt(value)}</Link> : fmt(value),
        },
        { title: '状态', dataIndex: 'order_status', width: 120, render: fmt },
        { title: '优先级', dataIndex: 'priority', width: 100, render: fmt },
        { title: '故障摘要', dataIndex: 'fault_description', ellipsis: true, render: fmt },
        {
          title: '维修费用',
          width: 120,
          render: (_: unknown, row: Record<string, unknown>) => moneyCn(row.actual_cost ?? row.estimated_cost),
        },
      ]}
    />
  )
}

function TwinGraph({ row, dark = true }: { row: AssetArchiveDisplayRow; dark?: boolean }) {
  const option = useMemo(() => {
    const metrics = buildAssetTwinMetrics(row)
    const nodes = [
      { name: row.asset_name, category: 0, symbolSize: 76 },
      { name: row.department_name, category: 1, symbolSize: 46 },
      { name: row.owner_name, category: 2, symbolSize: 38 },
      { name: row.risk_display, category: 3, symbolSize: 44 },
      { name: row.supplier_demo_name, category: 4, symbolSize: 42 },
      { name: metrics.lifecycleStage, category: 5, symbolSize: 38 },
      { name: '核心配件', category: 6, symbolSize: 36 },
      { name: 'PM计划', category: 6, symbolSize: 36 },
    ]
    return {
      backgroundColor: 'transparent',
      color: ['#22d3ee', '#34d399', '#a78bfa', '#f87171', '#fbbf24', '#60a5fa', '#94a3b8'],
      tooltip: {},
      series: [
        {
          type: 'graph' as const,
          layout: 'force' as const,
          roam: true,
          draggable: true,
          categories: ['设备', '科室', '工程师', '风险', '供应商', '生命周期', '配件/计划'].map((name) => ({ name })),
          label: { show: true, color: dark ? '#e0faff' : '#0f172a', fontSize: 11 },
          lineStyle: { color: 'source', curveness: 0.18, opacity: 0.7 },
          force: { repulsion: 260, edgeLength: 90 },
          data: nodes,
          links: [
            { source: row.asset_name, target: row.department_name },
            { source: row.asset_name, target: row.owner_name },
            { source: row.asset_name, target: row.risk_display },
            { source: row.asset_name, target: row.supplier_demo_name },
            { source: row.asset_name, target: metrics.lifecycleStage },
            { source: row.asset_name, target: '核心配件' },
            { source: row.asset_name, target: 'PM计划' },
          ],
        },
      ],
    }
  }, [dark, row])

  return <ReactECharts option={option} style={{ height: 340 }} notMerge lazyUpdate />
}

export function AssetDetailPage() {
  const { assetId } = useParams<{ assetId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<AssetDetailBundle | null>(null)
  const [mockRow, setMockRow] = useState<AssetArchiveDisplayRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [classificationActionLoading, setClassificationActionLoading] = useState<string | null>(null)
  const [classificationCandidates, setClassificationCandidates] = useState<DeviceClassificationCandidate[]>([])
  const [classificationCandidateOpen, setClassificationCandidateOpen] = useState(false)
  const [categorySelectorOpen, setCategorySelectorOpen] = useState(false)

  useEffect(() => {
    if (!assetId) return
    let cancel = false
    setLoading(true)
    setErr(null)
    setData(null)
    setMockRow(null)

    if (IS_AUTH_MOCK) {
      const row = buildMockArchiveRows().find((item) => item.id === assetId) ?? buildMockArchiveRows()[0] ?? null
      setMockRow(row)
      setLoading(false)
      return
    }

    ;(async () => {
      try {
        const bundle = await fetchAssetDetail(assetId)
        if (!cancel) setData(bundle)
      } catch (e) {
        if (!cancel) {
          setErr(e instanceof ApiClientError ? e.message : String(e))
          const fallback = buildMockArchiveRows().find((item) => item.id === assetId) ?? null
          setMockRow(fallback)
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [assetId])

  async function refreshDetail() {
    if (!assetId || IS_AUTH_MOCK) return
    const bundle = await fetchAssetDetail(assetId)
    setData(bundle)
    setMockRow(null)
  }

  const row = useMemo<AssetArchiveDisplayRow | null>(() => {
    if (data?.asset) return enrichAssetRow(data.asset)
    return mockRow
  }, [data, mockRow])

  const metrics = useMemo(() => (row ? buildAssetTwinMetrics(row) : null), [row])
  const lifecycle = useMemo(() => (row ? buildAssetLifecycleEvents(row) : []), [row])
  const pmRows = useMemo(() => (row ? mockPmRows(row) : []), [row])
  const calRows = useMemo(() => (row ? mockCalRows(row) : []), [row])
  const contractRows = useMemo(() => (row ? mockContractRows(row) : []), [row])
  const governance = useMemo(() => (row ? buildGovernanceSnapshot(row) : null), [row])
  const pendingClassificationImpact = useMemo<ClassificationImpact | null>(
    () => data?.classification_impacts?.find((item) => item.status === 'pending') ?? null,
    [data?.classification_impacts],
  )

  const printTargets = useMemo<AssetLabelPrintTarget[]>(() => {
    if (!row) return []
    return [
      {
        asset_id: row.id,
        asset_code: formatArchiveAssetCode(row.asset_code, row.id),
        asset_name: row.asset_name,
        main_status: row.main_status,
      },
    ]
  }, [row])

  const healthOption = useMemo(() => {
    if (!metrics) return {}
    return {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge' as const,
          min: 0,
          max: 100,
          radius: '92%',
          progress: { show: true, width: 14, itemStyle: { color: metrics.aiScore >= 75 ? '#22c55e' : metrics.aiScore >= 62 ? '#f59e0b' : '#ef4444' } },
          axisLine: { lineStyle: { width: 14, color: [[1, 'rgba(148,163,184,0.22)']] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          title: { show: true, color: '#93c5fd', fontSize: 12, offsetCenter: [0, '42%'] },
          detail: { valueAnimation: true, fontSize: 42, fontWeight: 800, color: '#e0faff', offsetCenter: [0, '4%'] },
          data: [{ value: metrics.aiScore, name: 'AI健康评分' }],
        },
      ],
    }
  }, [metrics])

  async function runClassificationAction(key: string, work: () => Promise<void>) {
    setClassificationActionLoading(key)
    try {
      await work()
    } catch (e) {
      message.error(errorText(e))
    } finally {
      setClassificationActionLoading(null)
    }
  }

  function handleViewClassificationDetail() {
    if (!row) return
    void runClassificationAction('view-detail', async () => {
      await recordClassificationDetailView(row.id)
      Modal.info({
        width: 640,
        title: 'H-UMDG 标准目录详情',
        content: (
            <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="主数据来源">{row.mdm_source === 'h-mdm' ? 'H-UMDG' : '—'}</Descriptions.Item>
            <Descriptions.Item label="分类编码">{row.mdm_category_code || row.classification_code || row.hmdm_equipment_category_code || '—'}</Descriptions.Item>
            <Descriptions.Item label="目录条目">{row.mdm_category_name || row.classification_name || row.hmdm_standard_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="分类路径">{row.mdm_category_path || '—'}</Descriptions.Item>
            <Descriptions.Item label="管理类别">{row.management_class || row.hmdm_management_class || '—'}</Descriptions.Item>
            <Descriptions.Item label="关联版本">{row.mdm_category_version || row.classification_version_id || '—'}</Descriptions.Item>
            <Descriptions.Item label="最近同步时间">{row.mdm_synced_at?.slice(0, 19).replace('T', ' ') || '—'}</Descriptions.Item>
            <Descriptions.Item label="说明">已记录查看 H-UMDG 标准目录详情审计日志；正式联调时可跳转到 H-UMDG 目录详情页。</Descriptions.Item>
          </Descriptions>
        ),
      })
    })
  }

  function handleViewClassificationImpacts() {
    const impacts = data?.classification_impacts ?? []
    Modal.info({
      width: 860,
      title: '分类变更影响',
      content: (
        <Table
          size="small"
          pagination={false}
          rowKey="impact_id"
          dataSource={impacts}
          columns={[
            { title: '变更类型', dataIndex: 'change_type', width: 160 },
            { title: '风险', dataIndex: 'impact_level', width: 90, render: (value: string) => <Tag color={value === 'high' ? 'red' : value === 'medium' ? 'orange' : 'blue'}>{value}</Tag> },
            { title: '状态', dataIndex: 'status', width: 110 },
            { title: '原因', dataIndex: 'impact_reason' },
          ]}
          locale={{ emptyText: '暂无分类变更影响提醒' }}
        />
      ),
    })
  }

  function handleConfirmCurrentClassification(impact: ClassificationImpact | null = pendingClassificationImpact) {
    if (!impact) {
      message.info('当前没有待处理的分类变更影响。')
      return
    }
    Modal.confirm({
      title: '确认当前分类仍适用？',
      content: '系统会关闭当前影响记录，并把设备分类状态恢复为已确认；不会自动覆盖 H-UMDG 分类字段。',
      okText: '确认',
      cancelText: '取消',
      onOk: () =>
        runClassificationAction('confirm-impact', async () => {
          await confirmClassificationImpact(impact.impact_id, { handleReason: '人工确认当前分类仍适用' })
          message.success('已确认当前分类')
          await refreshDetail()
        }),
    })
  }

  function handleIgnoreClassificationImpact(impact: ClassificationImpact | null = pendingClassificationImpact) {
    if (!impact) {
      message.info('当前没有待忽略的分类变更影响。')
      return
    }
    if (impact.impact_level === 'high') {
      message.warning('高风险分类影响不能忽略，请人工确认或调整分类。')
      return
    }
    Modal.confirm({
      title: '忽略本次分类变更？',
      content: '仅忽略当前影响记录，不会覆盖设备档案分类字段；动作会写入审计日志。',
      okText: '忽略',
      cancelText: '取消',
      onOk: () =>
        runClassificationAction('ignore-impact', async () => {
          await ignoreClassificationImpact(impact.impact_id, { handleReason: '人工判断本次变更不影响该设备' })
          message.success('已忽略本次变更')
          await refreshDetail()
        }),
    })
  }

  function handleRematchClassification() {
    const asset = data?.asset
    if (!asset) {
      message.warning('当前设备详情不可用，无法发起分类匹配。')
      return
    }
    void runClassificationAction('rematch', async () => {
      const result = await matchDeviceClassification({
        deviceName: asset.asset_name,
        brand: asset.brand ?? undefined,
        model: asset.model ?? undefined,
        registrationName: asset.registration_no ?? undefined,
        registrationCertificateNo: asset.registration_no ?? undefined,
        managementClass: asset.management_class ?? asset.hmdm_management_class ?? undefined,
        department: asset.department_name ?? undefined,
        intendedUse: asset.hmdm_secondary_product_category ?? undefined,
        originalCategory: asset.hmdm_equipment_category_name ?? asset.category_code ?? undefined,
      })
      setClassificationCandidates(result.candidates)
      setClassificationCandidateOpen(true)
    })
  }

  function handleCandidateConfirm(candidate: DeviceClassificationCandidate) {
    if (!assetId) return
    void runClassificationAction(`candidate-${candidate.classificationId}`, async () => {
      const payload = {
        classificationId: candidate.classificationId,
        classificationCode: candidate.classificationCode,
        classificationName: candidate.catalogItem,
        classificationVersionId: candidate.versionId || 'H-UMDG-CURRENT',
        managementClass: candidate.managementClass ?? undefined,
        confirmReason: `根据重新匹配候选确认：${candidate.matchReason}`,
        handleReason: pendingClassificationImpact ? '人工选择候选分类并调整变更影响' : undefined,
        matchMethod: pendingClassificationImpact ? 'manual_adjusted' : 'manual_confirmed',
        matchScore: candidate.matchScore,
      }
      if (pendingClassificationImpact) {
        await adjustClassificationImpact(pendingClassificationImpact.impact_id, payload)
        message.success('已调整为新分类')
      } else {
        await bindAssetClassification(assetId, payload)
        message.success('已确认候选分类')
      }
      setClassificationCandidateOpen(false)
      await refreshDetail()
    })
  }

  function handleCategorySelect(category: DeviceCategory) {
    if (!assetId) return
    void runClassificationAction('mdm-category-select', async () => {
      await updateAsset(assetId, {
        mdm_category_id: category.id,
        mdm_category_code: category.code,
        mdm_category_name: category.name,
        mdm_category_path: category.path,
        mdm_category_version: category.version ?? undefined,
        mdm_source: 'h-mdm',
        hmdm_equipment_category_code: category.code,
        hmdm_equipment_category_name: category.name,
        hmdm_management_class: category.managementClass ?? undefined,
        classification_id: category.id,
        classification_code: category.code,
        classification_name: category.name,
        classification_version_id: category.version ?? undefined,
        management_class: category.managementClass ?? undefined,
        classification_match_status: 'confirmed',
        classification_match_method: 'h-mdm_selector',
        classification_match_score: 100,
      })
      setCategorySelectorOpen(false)
      message.success('已保存 H-UMDG 医疗器械分类目录引用')
      await refreshDetail()
    })
  }

  if (!assetId) {
    return (
      <div className="asset-archive-page asset-twin-page asset-detail-twin">
        <Empty description="缺少设备 ID" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="asset-archive-page asset-twin-page asset-detail-twin">
        <section className="asset-twin-hero">
          <Title level={2} className="asset-twin-hero__title">
            设备数字孪生主页加载中...
          </Title>
        </section>
      </div>
    )
  }

  if (!row || !metrics) {
    return (
      <div className="asset-archive-page asset-twin-page asset-detail-twin">
        <Alert type="error" showIcon message="设备详情不可用" description={err ?? '未找到设备'} />
        <Button style={{ marginTop: 16 }} icon={<ArrowLeftOutlined />} onClick={() => navigate('/assets/archive')}>
          返回设备数字孪生运营主页
        </Button>
      </div>
    )
  }

  return (
    <div className="asset-archive-page asset-twin-page asset-detail-twin">
      <section className="asset-twin-hero asset-detail-twin__hero">
        <div className="asset-twin-hero__glow" />
        <div className="asset-detail-twin__hero-grid">
          <div>
            <Text className="asset-twin-hero__eyebrow">Medical Equipment Digital Twin</Text>
            <Title level={2} className="asset-twin-hero__title">
              {row.asset_name}
            </Title>
            <Space wrap className="asset-detail-twin__tags">
              <Text copyable code>
                {formatArchiveAssetCode(row.asset_code, row.id)}
              </Text>
              <Tag color={runColor(row.run_display)}>{row.run_display}</Tag>
              <Tag color="cyan">{metrics.lifecycleStage}</Tag>
              <Tag color={riskColor(row.risk_display)}>{row.risk_display}</Tag>
              <Tag color={row.metrology_display === '已过期' ? 'red' : row.metrology_display === '即将到期' ? 'orange' : 'green'}>
                计量：{row.metrology_display}
              </Tag>
            </Space>
            <Text className="asset-twin-hero__subtitle">
              {row.department_name} · {row.location_text} · {row.brand_vendor} · {row.spec_model}
            </Text>
          </div>
          <Space wrap className="asset-detail-twin__actions">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/assets/archive')}>
              返回运营主页
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => setPrintOpen(true)}>
              打印标签
            </Button>
            <Link to={`/maintenance/tickets?asset_id=${encodeURIComponent(row.id)}`}>
              <Button icon={<ToolOutlined />}>维修记录</Button>
            </Link>
            <Link to="/pm/tasks">
              <Button icon={<HistoryOutlined />}>PM任务</Button>
            </Link>
          </Space>
        </div>
      </section>

      {err ? (
        <Alert
          style={{ marginBottom: 14 }}
          type="warning"
          showIcon
          message="详情接口暂不可用"
          description={`${err}。当前页面使用数字孪生演示画像兜底。`}
        />
      ) : null}

      <Row gutter={[16, 16]} className="asset-detail-twin__overview">
        <Col xs={24} lg={8}>
          <section className="asset-glass-panel asset-detail-twin__visual">
            <img src={buildAssetTwinImage(row)} alt={row.asset_name} />
            <div className="asset-detail-twin__ai-callout">
              <RobotOutlined />
              <span>{metrics.aiPrediction}</span>
            </div>
          </section>
        </Col>
        <Col xs={24} lg={8}>
          <section className="asset-glass-panel">
            <div className="asset-panel-head">
              <Space>
                <RobotOutlined />
                <div>
                  <h2>AI健康评分</h2>
                  <p>融合故障频率、维修成本、开机率、PM与计量状态。</p>
                </div>
              </Space>
            </div>
            <ReactECharts option={healthOption} style={{ height: 240 }} notMerge lazyUpdate />
          </section>
        </Col>
        <Col xs={24} lg={8}>
          <section className="asset-glass-panel asset-detail-twin__kpis">
            <Statistic title="开机率" value={metrics.bootRate} suffix="%" valueStyle={{ color: '#67e8f9' }} />
            <Progress percent={metrics.bootRate} showInfo={false} strokeColor={metrics.bootRate >= 80 ? '#22c55e' : '#f59e0b'} />
            <div className="asset-detail-twin__metric-grid">
              <div>
                <span>维修次数</span>
                <strong>{metrics.repairCount} 次</strong>
              </div>
              <div>
                <span>维修成本</span>
                <strong>{moneyWan(metrics.repairCost)} 万</strong>
              </div>
              <div>
                <span>剩余寿命</span>
                <strong>{metrics.remainingLifeMonths} 月</strong>
              </div>
              <div>
                <span>停机风险</span>
                <strong>{metrics.downtimeRisk}%</strong>
              </div>
            </div>
          </section>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={16}>
          <section className="asset-glass-panel asset-detail-twin__timeline">
            <div className="asset-panel-head">
              <Space>
                <HistoryOutlined />
                <div>
                  <h2>完整生命周期时间轴</h2>
                  <p>采购申请 → 到货验收 → 安装培训 → PM/维修/配件 → AI预测 → 更新评估。</p>
                </div>
              </Space>
            </div>
            <Timeline
              mode="alternate"
              items={lifecycle.map((item) => ({
                color:
                  item.tone === 'red'
                    ? 'red'
                    : item.tone === 'orange'
                      ? 'orange'
                      : item.tone === 'green'
                        ? 'green'
                        : item.tone === 'gray'
                          ? 'gray'
                          : 'blue',
                children: (
                  <div className="asset-detail-twin__timeline-card">
                    <span>{item.time}</span>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                ),
              }))}
            />
          </section>
        </Col>
        <Col xs={24} xl={8}>
          <section className="asset-glass-panel">
            <div className="asset-panel-head">
              <Space>
                <ClusterOutlined />
                <div>
                  <h2>设备关系图谱</h2>
                  <p>设备与科室、工程师、供应商、风险、配件、PM计划关联。</p>
                </div>
              </Space>
            </div>
            <TwinGraph row={row} />
          </section>
        </Col>
      </Row>

      <section className="asset-glass-panel asset-detail-twin__tabs">
        <Tabs
          items={[
            {
              key: 'profile',
              label: (
                <span>
                  <BarChartOutlined /> 设备画像
                </span>
              ),
              children: (
                <Descriptions column={{ xs: 1, md: 2, xl: 3 }} bordered size="small">
                  <Descriptions.Item label="设备编码">{formatArchiveAssetCode(row.asset_code, row.id)}</Descriptions.Item>
                  <Descriptions.Item label="序列号">{row.serial_number ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="RFID">{metrics.rfid}</Descriptions.Item>
                  <Descriptions.Item label="二维码">{metrics.qrCode}</Descriptions.Item>
                  <Descriptions.Item label="品牌型号">{row.brand_vendor} · {row.spec_model}</Descriptions.Item>
                  <Descriptions.Item label="生产厂家">{row.manufacturer_full}</Descriptions.Item>
                  <Descriptions.Item label="所属科室">{row.department_name}</Descriptions.Item>
                  <Descriptions.Item label="存放地点">{row.location_text}</Descriptions.Item>
                  <Descriptions.Item label="购置日期">{row.purchase_display}</Descriptions.Item>
                  <Descriptions.Item label="启用日期">{row.install_display}</Descriptions.Item>
                  <Descriptions.Item label="使用年限">{metrics.serviceAgeYears.toFixed(1)} 年</Descriptions.Item>
                  <Descriptions.Item label="设备原值">{moneyCn(row.original_value)}</Descriptions.Item>
                  <Descriptions.Item label="高值设备">{metrics.highValue ? '是' : '否'}</Descriptions.Item>
                  <Descriptions.Item label="急救设备">{row.is_critical_care ? '是' : '否'}</Descriptions.Item>
                  <Descriptions.Item label="更新计划">{metrics.updatePlan}</Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'org-master',
              label: (
                <span>
                  <ClusterOutlined /> 组织人员
                </span>
              ),
              children: (
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Alert
                    showIcon
                    type="info"
                    message="组织、人员与学科主数据来自 H-UMDG"
                    description="OS 只保存设备业务发生时的引用关系和快照名称；科室、人员、院区、学科的编码与名称不可在 OS 内自由维护。"
                  />
                  <Descriptions column={{ xs: 1, md: 2, xl: 3 }} bordered size="small">
                    <Descriptions.Item label="所属院区">{fmt(data?.asset.campus_name || data?.asset.campus_code)}</Descriptions.Item>
                    <Descriptions.Item label="使用科室">{fmt(data?.asset.department_name)}</Descriptions.Item>
                    <Descriptions.Item label="科室编码">{fmt(data?.asset.department_code)}</Descriptions.Item>
                    <Descriptions.Item label="科室主数据来源">{data?.asset.department_source === 'h-mdm' ? <Tag color="blue">H-UMDG</Tag> : '—'}</Descriptions.Item>
                    <Descriptions.Item label="科室版本">{fmt(data?.asset.department_version)}</Descriptions.Item>
                    <Descriptions.Item label="科室同步时间">{data?.asset.department_synced_at?.slice(0, 19).replace('T', ' ') || '—'}</Descriptions.Item>
                    <Descriptions.Item label="设备责任人">{fmt(data?.asset.person_name)}</Descriptions.Item>
                    <Descriptions.Item label="人员编码">{fmt(data?.asset.person_code)}</Descriptions.Item>
                    <Descriptions.Item label="人员所属科室">{fmt(data?.asset.person_department_name)}</Descriptions.Item>
                    <Descriptions.Item label="人员主数据来源">{data?.asset.person_source === 'h-mdm' ? <Tag color="blue">H-UMDG</Tag> : '—'}</Descriptions.Item>
                    <Descriptions.Item label="人员版本">{fmt(data?.asset.person_version)}</Descriptions.Item>
                    <Descriptions.Item label="人员同步时间">{data?.asset.person_synced_at?.slice(0, 19).replace('T', ' ') || '—'}</Descriptions.Item>
                    <Descriptions.Item label="服务学科">{fmt(data?.asset.discipline_name)}</Descriptions.Item>
                    <Descriptions.Item label="学科编码">{fmt(data?.asset.discipline_code)}</Descriptions.Item>
                    <Descriptions.Item label="学科主数据来源">{data?.asset.discipline_source === 'h-mdm' ? <Tag color="blue">H-UMDG</Tag> : '—'}</Descriptions.Item>
                    <Descriptions.Item label="学科版本">{fmt(data?.asset.discipline_version)}</Descriptions.Item>
                    <Descriptions.Item label="学科同步时间">{data?.asset.discipline_synced_at?.slice(0, 19).replace('T', ' ') || '—'}</Descriptions.Item>
                  </Descriptions>
                </Space>
              ),
            },
            {
              key: 'partner-master',
              label: (
                <span>
                  <DatabaseOutlined /> 往来单位
                </span>
              ),
              children: (
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Alert
                    showIcon
                    type="info"
                    message="生产厂家、供应商、维保商等单位类主数据来自 H-UMDG 往来单位主数据"
                    description="同一个 H-UMDG org_id 可同时作为生产厂家、供应商、维保商等业务角色；OS 只保存当前设备的角色化引用和快照。"
                  />
                  <Descriptions column={{ xs: 1, md: 2, xl: 3 }} bordered size="small">
                    <Descriptions.Item label="生产厂家">{fmt(data?.asset.manufacturer_name)}</Descriptions.Item>
                    <Descriptions.Item label="厂家 org_id">{fmt(data?.asset.manufacturer_org_id)}</Descriptions.Item>
                    <Descriptions.Item label="厂家编码">{fmt(data?.asset.manufacturer_org_code)}</Descriptions.Item>
                    <Descriptions.Item label="品牌方">{fmt(data?.asset.brand_owner_name)}</Descriptions.Item>
                    <Descriptions.Item label="品牌方 org_id">{fmt(data?.asset.brand_owner_org_id)}</Descriptions.Item>
                    <Descriptions.Item label="品牌方编码">{fmt(data?.asset.brand_owner_org_code)}</Descriptions.Item>
                    <Descriptions.Item label="注册证持有人">{fmt(data?.asset.registration_holder_name)}</Descriptions.Item>
                    <Descriptions.Item label="注册证持有人 org_id">{fmt(data?.asset.registration_holder_org_id)}</Descriptions.Item>
                    <Descriptions.Item label="注册证持有人编码">{fmt(data?.asset.registration_holder_org_code)}</Descriptions.Item>
                    <Descriptions.Item label="供应商">{fmt(data?.asset.supplier_name)}</Descriptions.Item>
                    <Descriptions.Item label="供应商 org_id">{fmt(data?.asset.supplier_org_id)}</Descriptions.Item>
                    <Descriptions.Item label="供应商编码">{fmt(data?.asset.supplier_org_code)}</Descriptions.Item>
                    <Descriptions.Item label="维保商">{fmt(data?.asset.maintainer_name)}</Descriptions.Item>
                    <Descriptions.Item label="维保商 org_id">{fmt(data?.asset.maintainer_org_id)}</Descriptions.Item>
                    <Descriptions.Item label="维保商编码">{fmt(data?.asset.maintainer_org_code)}</Descriptions.Item>
                    <Descriptions.Item label="安装单位">{fmt(data?.asset.installer_name)}</Descriptions.Item>
                    <Descriptions.Item label="安装单位 org_id">{fmt(data?.asset.installer_org_id)}</Descriptions.Item>
                    <Descriptions.Item label="安装单位编码">{fmt(data?.asset.installer_org_code)}</Descriptions.Item>
                    <Descriptions.Item label="单位主数据来源">{data?.asset.org_source === 'h-mdm' ? <Tag color="blue">H-UMDG</Tag> : '—'}</Descriptions.Item>
                    <Descriptions.Item label="单位主数据版本">{fmt(data?.asset.org_version)}</Descriptions.Item>
                    <Descriptions.Item label="单位同步时间">{data?.asset.org_synced_at?.slice(0, 19).replace('T', ' ') || '—'}</Descriptions.Item>
                  </Descriptions>
                </Space>
              ),
            },
            {
              key: 'classification',
              label: (
                <span>
                  <DatabaseOutlined /> 标准分类
                </span>
              ),
              children: (
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Alert
                    showIcon
                    type={row.classification_match_status === 'need_review' || row.classification_change_status === 'pending' ? 'warning' : row.classification_match_status === 'expired' ? 'error' : 'info'}
                    message={row.mdm_category_name || row.classification_name || row.hmdm_standard_name || '尚未确认 H-UMDG 医疗器械分类'}
                    description="H-UMDG 是医疗器械分类目录的唯一权威来源；本档案只保存当前设备绑定的 mdm_category_id、mdm_category_code、mdm_category_version 等引用关系。"
                  />
                  <Descriptions column={{ xs: 1, md: 2, xl: 3 }} bordered size="small">
                    <Descriptions.Item label="主数据来源">{row.mdm_source === 'h-mdm' ? <Tag color="blue">H-UMDG</Tag> : '—'}</Descriptions.Item>
                    <Descriptions.Item label="分类编码">{row.mdm_category_code || row.classification_code || row.hmdm_equipment_category_code || '—'}</Descriptions.Item>
                    <Descriptions.Item label="分类名称">{row.mdm_category_name || row.classification_name || row.hmdm_standard_name || '—'}</Descriptions.Item>
                    <Descriptions.Item label="分类路径" span={2}>{row.mdm_category_path || '—'}</Descriptions.Item>
                    <Descriptions.Item label="设备标准名称">{row.hmdm_standard_name || row.asset_name}</Descriptions.Item>
                    <Descriptions.Item label="管理类别">{row.management_class || row.hmdm_management_class || '—'}</Descriptions.Item>
                    <Descriptions.Item label="主数据版本">{row.mdm_category_version || row.classification_version_id || '—'}</Descriptions.Item>
                    <Descriptions.Item label="最近同步时间">{row.mdm_synced_at?.slice(0, 19).replace('T', ' ') || '—'}</Descriptions.Item>
                    <Descriptions.Item label="分类状态">
                      <Tag color={classificationStatusColor(row.classification_match_status)}>
                        {classificationStatusLabel(row.classification_match_status)}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="分类确认人">{row.classification_confirmed_by || '—'}</Descriptions.Item>
                    <Descriptions.Item label="分类确认时间">{row.classification_confirmed_at?.slice(0, 19).replace('T', ' ') || '—'}</Descriptions.Item>
                    <Descriptions.Item label="最近变更提醒">
                      {row.classification_change_status === 'pending' || row.classification_match_status === 'need_review' ? <Tag color="orange">需复核</Tag> : row.classification_match_status === 'expired' ? <Tag color="red">原分类已失效</Tag> : <Tag color="green">暂无影响</Tag>}
                    </Descriptions.Item>
                  </Descriptions>
                  <Space wrap>
                    <Button type="primary" loading={classificationActionLoading === 'mdm-category-select'} onClick={() => setCategorySelectorOpen(true)}>
                      选择/更换 H-UMDG 分类目录
                    </Button>
                    <Button loading={classificationActionLoading === 'view-detail'} onClick={handleViewClassificationDetail}>
                      查看 H-UMDG 标准目录详情
                    </Button>
                    <Button loading={classificationActionLoading === 'rematch'} onClick={handleRematchClassification}>
                      重新匹配分类
                    </Button>
                    <Button disabled={!pendingClassificationImpact} loading={classificationActionLoading === 'confirm-impact'} onClick={() => handleConfirmCurrentClassification()}>
                      确认当前分类
                    </Button>
                    <Button onClick={handleViewClassificationImpacts}>
                      查看变更影响
                    </Button>
                    <Button disabled={!pendingClassificationImpact || pendingClassificationImpact.impact_level === 'high'} loading={classificationActionLoading === 'ignore-impact'} onClick={() => handleIgnoreClassificationImpact()}>
                      忽略本次变更
                    </Button>
                    <Button type="primary" loading={classificationActionLoading === 'rematch'} onClick={handleRematchClassification}>
                      调整为新分类
                    </Button>
                  </Space>
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="impact_id"
                    dataSource={data?.classification_impacts ?? []}
                    columns={[
                      { title: '变更类型', dataIndex: 'change_type', width: 160 },
                      { title: '风险', dataIndex: 'impact_level', width: 90, render: (value: string) => <Tag color={value === 'high' ? 'red' : value === 'medium' ? 'orange' : 'blue'}>{value}</Tag> },
                      { title: '原因', dataIndex: 'impact_reason' },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        width: 110,
                        render: (value: string) => {
                          const map: Record<string, { label: string; color: string }> = {
                            pending: { label: '待处理', color: 'orange' },
                            confirmed: { label: '已确认', color: 'green' },
                            adjusted: { label: '已调整', color: 'blue' },
                            ignored: { label: '已忽略', color: 'default' },
                          }
                          const item = map[value] ?? { label: value, color: 'default' }
                          return <Tag color={item.color}>{item.label}</Tag>
                        },
                      },
                      {
                        title: '操作',
                        width: 150,
                        render: (_: unknown, item: ClassificationImpact) =>
                          item.status === 'pending' ? (
                            <Space size={6}>
                              <Button size="small" onClick={() => handleConfirmCurrentClassification(item)}>确认</Button>
                              <Button size="small" disabled={item.impact_level === 'high'} onClick={() => handleIgnoreClassificationImpact(item)}>忽略</Button>
                            </Space>
                          ) : (
                            <Text type="secondary">{item.handled_by || '已处理'}</Text>
                          ),
                      },
                    ]}
                    locale={{ emptyText: '暂无分类变更影响提醒' }}
                  />
                </Space>
              ),
            },
            {
              key: 'repair',
              label: (
                <span>
                  <ToolOutlined /> 维修情况
                </span>
              ),
              children: <RepairTable rows={data?.repairs ?? []} />,
            },
            {
              key: 'pm',
              label: (
                <span>
                  <SafetyCertificateOutlined /> PM情况
                </span>
              ),
              children: (
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(r) => `${r.plan}-${r.done_at}`}
                  dataSource={pmRows}
                  columns={[
                    { title: '保养计划', dataIndex: 'plan' },
                    { title: '保养项目', dataIndex: 'item' },
                    { title: '执行人', dataIndex: 'executor', width: 170 },
                    { title: '执行日期', dataIndex: 'done_at', width: 120 },
                    { title: '结果', dataIndex: 'result', width: 100 },
                  ]}
                />
              ),
            },
            {
              key: 'meter',
              label: (
                <span>
                  <ExperimentOutlined /> 计量情况
                </span>
              ),
              children: calRows.length ? (
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(r) => r.cert_no}
                  dataSource={calRows}
                  columns={[
                    { title: '检定日期', dataIndex: 'cal_date', width: 120 },
                    { title: '到期日期', dataIndex: 'due_date', width: 120 },
                    { title: '检定机构', dataIndex: 'org' },
                    { title: '证书编号', dataIndex: 'cert_no' },
                    { title: '结果', dataIndex: 'result', width: 90 },
                  ]}
                />
              ) : (
                <Empty description="不适用或非强检计量设备暂无记录" />
              ),
            },
            {
              key: 'qr',
              label: (
                <span>
                  <QrcodeOutlined /> 一机一码
                </span>
              ),
              children: <QrTable rows={data?.qr_codes ?? []} />,
            },
            {
              key: 'governance',
              label: (
                <span>
                  <DatabaseOutlined /> 数据治理
                </span>
              ),
              children: governance ? (
                <div className="asset-detail-twin__governance">
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={8}>
                      <section className="asset-governance-card">
                        <Text type="secondary">当前主数据来源</Text>
                        <strong>{governance.currentSource}</strong>
                        <Tag color="blue">本地维护</Tag>
                      </section>
                    </Col>
                    <Col xs={24} lg={8}>
                      <section className="asset-governance-card">
                        <Text type="secondary">H-UMDG 引用状态</Text>
                        <strong>{governanceStatusTag(governance.syncStatus)}</strong>
                        <span>{governance.lastSyncAt}</span>
                      </section>
                    </Col>
                    <Col xs={24} lg={8}>
                      <section className="asset-governance-card">
                        <Text type="secondary">数据质量评分</Text>
                        <strong>{governance.qualityScore}</strong>
                        <Progress percent={governance.qualityScore} showInfo={false} strokeColor={governance.qualityScore >= 90 ? '#16a34a' : '#f59e0b'} />
                      </section>
                    </Col>
                  </Row>

                  <Descriptions column={{ xs: 1, md: 2 }} bordered size="small" style={{ marginTop: 16 }}>
                    <Descriptions.Item label="H-UMDG 引用编码">{governance.hudmpCode}</Descriptions.Item>
                    <Descriptions.Item label="医学装备 OS 设备编码">{governance.osCode}</Descriptions.Item>
                    <Descriptions.Item label="固定资产编码">{governance.fixedAssetCode}</Descriptions.Item>
                    <Descriptions.Item label="HIS 关联编码">{governance.hisCode}</Descriptions.Item>
                    <Descriptions.Item label="SPD 关联编码">{governance.spdCode}</Descriptions.Item>
                    <Descriptions.Item label="最近同步时间">{governance.lastSyncAt}</Descriptions.Item>
                    <Descriptions.Item label="字段完整率">
                      <Progress percent={governance.completeness} size="small" strokeColor={governance.completeness >= 90 ? '#16a34a' : '#f59e0b'} />
                    </Descriptions.Item>
                    <Descriptions.Item label="映射完成率">
                      <Progress percent={governance.mappingRate} size="small" strokeColor={governance.mappingRate >= 90 ? '#16a34a' : '#ef4444'} />
                    </Descriptions.Item>
                  </Descriptions>

                  <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                    <Col xs={24} xl={12}>
                      <Table
                        size="small"
                        pagination={false}
                        rowKey={(r) => r.field}
                        dataSource={governance.conflicts}
                        columns={[
                          { title: '冲突字段', dataIndex: 'field', width: 110 },
                          { title: 'OS值', dataIndex: 'osValue' },
                          { title: 'H-UMDG值', dataIndex: 'hudmpValue' },
                          { title: '处理策略', dataIndex: 'strategy', width: 150 },
                        ]}
                      />
                    </Col>
                    <Col xs={24} xl={12}>
                      <Table
                        size="small"
                        pagination={false}
                        rowKey={(r) => r.version}
                        dataSource={governance.versions}
                        columns={[
                          { title: '版本', dataIndex: 'version', width: 70 },
                          { title: '时间', dataIndex: 'time', width: 120 },
                          { title: '操作人', dataIndex: 'operator', width: 100 },
                          { title: '记录', dataIndex: 'action' },
                        ]}
                      />
                    </Col>
                  </Row>
                </div>
              ) : (
                <Empty description="暂无数据治理信息" />
              ),
            },
            {
              key: 'contract',
              label: '采购与供应商',
              children: (
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(r) => r.contract_no}
                  dataSource={contractRows}
                  columns={[
                    { title: '合同编号', dataIndex: 'contract_no' },
                    { title: '供应商', dataIndex: 'supplier' },
                    { title: '发票号', dataIndex: 'invoice_no' },
                    { title: '金额', dataIndex: 'amount' },
                    { title: '付款状态', dataIndex: 'pay_status', width: 110 },
                  ]}
                />
              ),
            },
          ]}
        />
      </section>

      <Modal
        title={pendingClassificationImpact ? '调整为 H-UMDG 新分类' : '确认 H-UMDG 候选分类'}
        open={classificationCandidateOpen}
        onCancel={() => setClassificationCandidateOpen(false)}
        footer={null}
        width={980}
        destroyOnHidden
      >
        <Table
          size="small"
          rowKey={(item) => `${item.classificationId}-${item.versionId ?? ''}`}
          dataSource={classificationCandidates}
          pagination={false}
          scroll={{ x: 860 }}
          columns={[
            { title: '候选分类编码', dataIndex: 'classificationCode', width: 130 },
            { title: '候选目录条目', dataIndex: 'catalogItem', width: 180 },
            { title: '管理类别', dataIndex: 'managementClass', width: 90, render: fmt },
            { title: '匹配分数', dataIndex: 'matchScore', width: 100, render: (value: number) => <Tag color={value >= 90 ? 'green' : value >= 75 ? 'orange' : 'blue'}>{value}</Tag> },
            { title: '匹配原因', dataIndex: 'matchReason', ellipsis: true },
            { title: '来源版本', dataIndex: 'versionId', width: 150, render: fmt },
            {
              title: '操作',
              width: 100,
              fixed: 'right',
              render: (_: unknown, item: DeviceClassificationCandidate) => (
                <Button
                  size="small"
                  type="primary"
                  loading={classificationActionLoading === `candidate-${item.classificationId}`}
                  onClick={() => handleCandidateConfirm(item)}
                >
                  确认
                </Button>
              ),
            },
          ]}
          locale={{ emptyText: '暂无候选分类，请重新匹配' }}
        />
      </Modal>

      <Modal
        title="当前设备标签打印"
        open={printOpen}
        onCancel={() => setPrintOpen(false)}
        footer={null}
        width={920}
        destroyOnHidden
      >
        <AssetLabelPrintPanel targets={printTargets} title="当前设备标签打印" />
      </Modal>
      <DeviceCategorySelector
        open={categorySelectorOpen}
        value={
          row?.mdm_category_id
            ? {
                id: row.mdm_category_id,
                code: row.mdm_category_code || row.classification_code || '',
                name: row.mdm_category_name || row.classification_name || '',
                path: row.mdm_category_path || '',
                managementClass: row.management_class,
                version: row.mdm_category_version || row.classification_version_id,
                source: 'h-mdm',
                enabled: true,
              }
            : null
        }
        onCancel={() => setCategorySelectorOpen(false)}
        onSelect={handleCategorySelect}
      />
    </div>
  )
}
