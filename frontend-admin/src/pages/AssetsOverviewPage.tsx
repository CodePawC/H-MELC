import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  ExportOutlined,
  FundOutlined,
  HeartOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Col,
  List,
  Progress,
  Row,
  Segmented,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { OperationsKpi } from './assets/assetOverviewOperationsMock'
import {
  getOperationsKpis,
  getOperationsTrend,
  getStatusDistribution,
  OPERATIONS_AGE_STRUCTURE,
  OPERATIONS_CATEGORY_STATS,
  OPERATIONS_DEPT_BAR,
  OPERATIONS_ENHANCEMENT_STRIPS,
  OPERATIONS_HIGH_VALUE_TOP10,
  OPERATIONS_LIFECYCLE,
  OPERATIONS_REPAIR_COST_MONTHS,
  OPERATIONS_REPAIR_COST_SERIES,
  OPERATIONS_REPAIR_TOP5,
  OPERATIONS_RISK_ALERTS,
  OPERATIONS_TODOS,
} from './assets/assetOverviewOperationsMock'

import './assets/assetOverviewPage.css'

const { Text, Title } = Typography

function formatNow(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function archiveSearchPath(keyword: string) {
  return `/assets/archive?keyword=${encodeURIComponent(keyword)}`
}

function KpiIcon({ k }: { k: OperationsKpi['icon'] }) {
  const style = { fontSize: 22, color: '#1677ff' }
  switch (k) {
    case 'total':
      return <AppstoreOutlined style={style} />
    case 'active':
      return <CheckCircleOutlined style={{ ...style, color: '#22c55e' }} />
    case 'life':
      return <HeartOutlined style={{ ...style, color: '#ef4444' }} />
    case 'repairNew':
      return <ThunderboltOutlined style={{ ...style, color: '#f59e0b' }} />
    case 'repairOpen':
      return <ToolOutlined style={{ ...style, color: '#1677ff' }} />
    case 'meter':
      return <ExperimentOutlined style={{ ...style, color: '#ea580c' }} />
    case 'risk':
      return <WarningOutlined style={{ ...style, color: '#dc2626' }} />
    case 'value':
      return <FundOutlined style={{ ...style, color: '#7c3aed' }} />
    default:
      return <AppstoreOutlined style={style} />
  }
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const opt = useMemo(
    () => ({
      grid: { left: 0, right: 0, top: 2, bottom: 2 },
      xAxis: { type: 'category' as const, show: false, data: data.map((_, i) => i) },
      yAxis: { type: 'value' as const, show: false },
      series: [
        {
          type: 'line' as const,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color },
          areaStyle: { color: `${color}22` },
          data,
        },
      ],
      tooltip: { show: false },
    }),
    [data, color],
  )
  return <ReactECharts option={opt} style={{ height: 44, width: '100%' }} notMerge lazyUpdate />
}

function WowBadge({ wow }: { wow: number }) {
  if (wow === 0) return <Tag color="default">环比 —</Tag>
  const up = wow > 0
  return (
    <Tag color={up ? 'green' : 'orange'} icon={up ? <ArrowUpOutlined /> : <ArrowDownOutlined />}>
      环比 {up ? '+' : ''}
      {wow.toFixed(2)}%
    </Tag>
  )
}

/** 设备总览 · 医学装备运营驾驶舱（中文运营语义；指标来自院内演示数据集，可按台账对齐替换） */
export function AssetsOverviewPage() {
  const { message } = App.useApp()
  const [trendDays, setTrendDays] = useState<7 | 30>(7)
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const [refreshing, setRefreshing] = useState(false)

  const kpis = useMemo(() => getOperationsKpis(), [])
  const trendData = useMemo(() => getOperationsTrend(trendDays), [trendDays])
  const statusSlices = useMemo(() => getStatusDistribution(), [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    window.setTimeout(() => {
      setUpdatedAt(new Date())
      setRefreshing(false)
      message.success('运营面板已刷新')
    }, 380)
  }, [message])

  const trendOption = useMemo(() => {
    const labels = trendData.map((d) => d.label)
    return {
      color: ['#1677ff', '#22c55e', '#f59e0b', '#a855f7'],
      title: {
        text: '设备运行趋势',
        subtext: '按业务口径聚合 · 单位：件次 / 单',
        left: 12,
        top: 8,
        textStyle: { fontSize: 15, fontWeight: 600, color: '#1f2937' },
        subtextStyle: { fontSize: 12, color: '#6b7280' },
      },
      grid: { left: 52, right: 24, top: 72, bottom: 36 },
      legend: {
        data: ['新增报修', '完成维修', 'PM 保养执行', '计量完成'],
        top: 40,
        left: 'center',
        textStyle: { color: '#475569', fontSize: 12 },
      },
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'cross' as const },
      },
      xAxis: {
        type: 'category' as const,
        boundaryGap: false,
        data: labels,
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        name: '件次',
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { type: 'dashed' as const, color: '#eceff3' } },
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      series: [
        {
          name: '新增报修',
          type: 'line' as const,
          smooth: true,
          symbolSize: 6,
          data: trendData.map((d) => d.repairNew),
        },
        {
          name: '完成维修',
          type: 'line' as const,
          smooth: true,
          symbolSize: 6,
          data: trendData.map((d) => d.repairDone),
        },
        {
          name: 'PM 保养执行',
          type: 'line' as const,
          smooth: true,
          symbolSize: 6,
          data: trendData.map((d) => d.pmDone),
        },
        {
          name: '计量完成',
          type: 'line' as const,
          smooth: true,
          symbolSize: 6,
          data: trendData.map((d) => d.calDone),
        },
      ],
    }
  }, [trendData])

  const statusTotal = statusSlices.reduce((s, x) => s + x.value, 0)

  const donutOption = useMemo(() => {
    return {
      title: {
        text: '设备状态分布',
        subtext: '全院台账口径 · 中文状态映射',
        left: 'center',
        top: 10,
        textStyle: { fontSize: 15, fontWeight: 600, color: '#1f2937' },
        subtextStyle: { fontSize: 12, color: '#6b7280' },
      },
      tooltip: {
        trigger: 'item' as const,
        formatter: (p: { name: string; value: number; percent: number }) =>
          `${p.name}<br/>数量 ${p.value} 台 · 占比 ${p.percent}%`,
      },
      legend: {
        orient: 'vertical' as const,
        right: '6%',
        top: 'middle',
        textStyle: { fontSize: 12, color: '#475569' },
        formatter: (name: string) => {
          const row = statusSlices.find((x) => x.name === name)
          const v = row?.value ?? 0
          const pct = statusTotal ? ((v / statusTotal) * 100).toFixed(1) : '0'
          return `${name}  ${v}台 (${pct}%)`
        },
      },
      color: statusSlices.map((s) => s.color),
      series: [
        {
          name: '状态',
          type: 'pie' as const,
          radius: ['44%', '68%'],
          center: ['38%', '54%'],
          avoidLabelOverlap: true,
          label: {
            formatter: (p: { name: string; value: number; percent: number }) =>
              `{nm|${p.name}}\n{vl|${p.value} 台 · ${p.percent}%}`,
            rich: {
              nm: { fontSize: 11, color: '#64748b', lineHeight: 16 },
              vl: { fontSize: 12, fontWeight: 600, color: '#1f2937', lineHeight: 18 },
            },
          },
          labelLine: { length: 12, length2: 10 },
          data: statusSlices.map((s) => ({ name: s.name, value: s.value })),
        },
      ],
    }
  }, [statusSlices, statusTotal])

  const deptBarOption = useMemo(
    () => ({
      title: {
        text: '科室设备分布',
        subtext: 'TOP 科室监测 · 单位：台',
        left: 8,
        top: 4,
        textStyle: { fontSize: 14, fontWeight: 600, color: '#1f2937' },
        subtextStyle: { fontSize: 11, color: '#6b7280' },
      },
      grid: { left: 72, right: 28, top: 56, bottom: 28 },
      tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
      xAxis: {
        type: 'value' as const,
        splitLine: { lineStyle: { type: 'dashed' as const, color: '#eef2f6' } },
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      yAxis: {
        type: 'category' as const,
        data: [...OPERATIONS_DEPT_BAR].map((x) => x.dept).reverse(),
        axisLabel: { color: '#475569', fontSize: 12 },
      },
      series: [
        {
          type: 'bar' as const,
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#1677ff' },
                { offset: 1, color: '#60a5fa' },
              ],
            },
            borderRadius: [0, 6, 6, 0],
          },
          label: { show: true, position: 'right' as const, color: '#475569', fontSize: 11 },
          data: [...OPERATIONS_DEPT_BAR].map((x) => x.count).reverse(),
        },
      ],
    }),
    [],
  )

  const catTotal = OPERATIONS_CATEGORY_STATS.reduce((s, x) => s + x.count, 0)

  const categoryBarOption = useMemo(
    () => ({
      title: {
        text: '设备分类统计',
        subtext: '数量与占比（全院口径）',
        left: 8,
        top: 4,
        textStyle: { fontSize: 14, fontWeight: 600, color: '#1f2937' },
        subtextStyle: { fontSize: 11, color: '#6b7280' },
      },
      grid: { left: 100, right: 36, top: 56, bottom: 28 },
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: { name: string; value: number }[]) => {
          const p = params[0]
          if (!p) return ''
          const pct = catTotal ? ((p.value / catTotal) * 100).toFixed(1) : '0'
          return `${p.name}<br/>${p.value} 台 · ${pct}%`
        },
      },
      xAxis: {
        type: 'value' as const,
        splitLine: { lineStyle: { type: 'dashed' as const, color: '#eef2f6' } },
      },
      yAxis: {
        type: 'category' as const,
        data: OPERATIONS_CATEGORY_STATS.map((x) => x.name),
        axisLabel: { fontSize: 12, color: '#475569' },
      },
      series: [
        {
          type: 'bar' as const,
          itemStyle: { color: '#22c55e', borderRadius: [0, 6, 6, 0] },
          label: {
            show: true,
            position: 'right' as const,
            formatter: (p: { value: number }) => {
              const pct = catTotal ? ((p.value / catTotal) * 100).toFixed(1) : '0'
              return `${p.value} (${pct}%)`
            },
            color: '#475569',
            fontSize: 11,
          },
          data: OPERATIONS_CATEGORY_STATS.map((x) => x.count),
        },
      ],
    }),
    [catTotal],
  )

  const ageOption = useMemo(
    () => ({
      title: {
        text: '设备年龄结构',
        subtext: '按启用年限分层',
        left: 10,
        top: 6,
        textStyle: { fontSize: 14, fontWeight: 600, color: '#1f2937' },
        subtextStyle: { fontSize: 11, color: '#6b7280' },
      },
      color: ['#1677ff', '#22c55e', '#f59e0b', '#ef4444'],
      tooltip: {
        trigger: 'item' as const,
        formatter: (p: { name: string; value: number; percent: number }) =>
          `${p.name}<br/>${p.value} 台 · ${p.percent}%`,
      },
      legend: { bottom: 8, textStyle: { fontSize: 11, color: '#64748b' } },
      series: [
        {
          type: 'pie' as const,
          radius: ['36%', '62%'],
          center: ['50%', '52%'],
          label: { formatter: '{b}\n{d}%' },
          data: OPERATIONS_AGE_STRUCTURE.map((x) => ({ name: x.range, value: x.count })),
        },
      ],
    }),
    [],
  )

  const repairCostOption = useMemo(
    () => ({
      title: {
        text: '维修成本分析',
        subtext: '月度维修支出 · 单位：万元',
        left: 8,
        top: 4,
        textStyle: { fontSize: 14, fontWeight: 600, color: '#1f2937' },
        subtextStyle: { fontSize: 11, color: '#6b7280' },
      },
      grid: { left: 44, right: 16, top: 52, bottom: 36 },
      tooltip: { trigger: 'axis' as const },
      xAxis: {
        type: 'category' as const,
        data: OPERATIONS_REPAIR_COST_MONTHS,
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        name: '万元',
        splitLine: { lineStyle: { type: 'dashed' as const, color: '#eef2f6' } },
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      series: [
        {
          name: '维修费用',
          type: 'bar' as const,
          barWidth: '52%',
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#1677ff' },
                { offset: 1, color: '#bfdbfe' },
              ],
            },
            borderRadius: [6, 6, 0, 0],
          },
          data: OPERATIONS_REPAIR_COST_SERIES,
        },
      ],
    }),
    [],
  )

  return (
    <div className="operations-overview">
      <div className="operations-overview__hero">
        <div>
          <Title level={3} className="operations-overview__title">
            设备总览
          </Title>
          <p className="operations-overview__subtitle">
            全院医学装备运行状态、风险预警、维修运维、计量质控与资产效益综合监控。
            <span style={{ display: 'block', marginTop: 6, fontWeight: 500, color: '#374151' }}>
              医学装备全生命周期运行监控中心
            </span>
          </p>
        </div>
        <Space wrap align="center">
          <Text type="secondary">数据更新时间 · {formatNow(updatedAt)}</Text>
          <Segmented
            options={[
              { label: '近 7 天', value: 7 },
              { label: '近 30 天', value: 30 },
            ]}
            value={trendDays}
            onChange={(v) => setTrendDays(v as 7 | 30)}
          />
          <Button icon={<ReloadOutlined />} loading={refreshing} onClick={onRefresh}>
            刷新
          </Button>
          <Button
            icon={<ExportOutlined />}
            onClick={() =>
              message.info('导出运营简报（PDF/Excel）对接报表中心 · 当前为占位')
            }
          >
            导出报告
          </Button>
          <Link to="/assets/archive">
            <Button type="link">设备档案</Button>
          </Link>
        </Space>
      </div>

      <Card className="operations-panel-card" style={{ marginBottom: 16 }} bordered={false}>
        <div className="operations-strip-scroll">
          {OPERATIONS_ENHANCEMENT_STRIPS.map((s) => (
            <div key={s.title} className="operations-strip-item">
              <div className="operations-strip-item__t">{s.title}</div>
              <div className="operations-strip-item__v">
                {s.value}
                {s.unit ? <span className="operations-mini-muted"> {s.unit}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {kpis.map((k) => (
          <Col xs={24} sm={12} xl={6} key={k.key}>
            <Card className="operations-kpi-card" bordered={false} loading={refreshing}>
              <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space direction="vertical" size={4}>
                  <Space>
                    <KpiIcon k={k.icon} />
                    <Text style={{ color: '#6b7280', fontSize: 13 }}>{k.title}</Text>
                  </Space>
                  <Statistic
                    value={k.value}
                    precision={k.precision}
                    suffix={<span style={{ fontSize: 14, color: '#6b7280' }}>{k.suffix}</span>}
                    valueStyle={{ fontSize: 26, fontWeight: 700, color: '#111827' }}
                  />
                  <Space size={8} wrap>
                    <WowBadge wow={k.wow} />
                    <Tag color={k.statusColor}>{k.statusTag}</Tag>
                  </Space>
                </Space>
                <div style={{ width: '42%', minWidth: 96 }}>
                  <MiniSparkline data={k.sparkline} color="#1677ff" />
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'right' }}>
                    近14点走势
                  </Text>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} xl={16}>
          <Card className="operations-panel-card" bordered={false}>
            <ReactECharts option={trendOption} style={{ height: 380 }} notMerge lazyUpdate />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="operations-panel-card" bordered={false}>
            <ReactECharts option={donutOption} style={{ height: 380 }} notMerge lazyUpdate />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12} xl={6}>
          <Card className="operations-panel-card" title="风险预警" bordered={false}>
            <List
              size="small"
              dataSource={OPERATIONS_RISK_ALERTS}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space wrap>
                        <Tag color={item.level === '高' ? 'red' : item.level === '中' ? 'orange' : 'blue'}>
                          {item.level}风险
                        </Tag>
                        <Text strong>{item.title}</Text>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.time} · {item.dept}
                        </Text>
                        <Text style={{ fontSize: 13 }}>{item.device}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12} xl={6}>
          <Card className="operations-panel-card" title="待办事项" bordered={false}>
            <List
              size="small"
              dataSource={OPERATIONS_TODOS}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Space wrap>
                      <Tag color="processing">{item.type}</Tag>
                      <Tag color={item.priority === '高' ? 'red' : item.priority === '中' ? 'orange' : 'default'}>
                        {item.priority}优先
                      </Tag>
                      <Text type="secondary">{item.count} 项</Text>
                    </Space>
                    <Text>{item.summary}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12} xl={6}>
          <Card className="operations-panel-card" bordered={false}>
            <ReactECharts option={deptBarOption} style={{ height: 320 }} notMerge lazyUpdate />
          </Card>
        </Col>
        <Col xs={24} lg={12} xl={6}>
          <Card className="operations-panel-card" bordered={false}>
            <ReactECharts option={categoryBarOption} style={{ height: 320 }} notMerge lazyUpdate />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} xl={14}>
          <Card className="operations-panel-card" title="高价值设备 TOP10" bordered={false}>
            <Table
              size="small"
              pagination={false}
              rowKey={(r) => r.name}
              dataSource={OPERATIONS_HIGH_VALUE_TOP10}
              scroll={{ x: 900 }}
              columns={[
                {
                  title: '设备名称',
                  dataIndex: 'name',
                  ellipsis: true,
                  width: 220,
                  render: (name: string) => <Link to={archiveSearchPath(name)}>{name}</Link>,
                },
                { title: '科室', dataIndex: 'dept', width: 110 },
                {
                  title: '原值（万元）',
                  dataIndex: 'valueWan',
                  width: 110,
                  align: 'right' as const,
                  render: (v: number) => v.toLocaleString('zh-CN'),
                },
                {
                  title: '开机率',
                  dataIndex: 'bootRate',
                  width: 88,
                  render: (v: number) => `${v}%`,
                },
                {
                  title: '使用率',
                  dataIndex: 'useRate',
                  width: 88,
                  render: (v: number) => `${v}%`,
                },
                {
                  title: '收益估算（万元）',
                  dataIndex: 'revenueWan',
                  width: 130,
                  align: 'right' as const,
                  render: (v: number) => v.toLocaleString('zh-CN'),
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card className="operations-panel-card" bordered={false} style={{ marginBottom: 16 }}>
            <ReactECharts option={repairCostOption} style={{ height: 260 }} notMerge lazyUpdate />
          </Card>
          <Card className="operations-panel-card" title="高维修成本设备 TOP5" bordered={false}>
            <Table
              size="small"
              pagination={false}
              rowKey={(r) => r.name}
              dataSource={OPERATIONS_REPAIR_TOP5}
              columns={[
                {
                  title: '设备/事项',
                  dataIndex: 'name',
                  ellipsis: true,
                  render: (name: string) => <Link to={archiveSearchPath(name)}>{name}</Link>,
                },
                { title: '科室', dataIndex: 'dept', width: 100 },
                {
                  title: '费用（万元）',
                  dataIndex: 'costWan',
                  width: 110,
                  align: 'right' as const,
                  render: (v: number) => v.toLocaleString('zh-CN'),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card className="operations-panel-card" bordered={false}>
            <ReactECharts option={ageOption} style={{ height: 300 }} notMerge lazyUpdate />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card className="operations-panel-card" title="生命周期状态" bordered={false}>
            <Row gutter={[12, 12]}>
              {OPERATIONS_LIFECYCLE.map((x) => (
                <Col xs={24} sm={12} key={x.label}>
                  <Card size="small" bordered style={{ borderRadius: 10 }}>
                    <Statistic title={x.label} value={x.count} suffix="台" valueStyle={{ fontSize: 22 }} />
                    <Progress
                      percent={Math.min(100, Math.round((x.count / 1842) * 100))}
                      showInfo={false}
                      strokeColor={
                        x.tone === 'blue'
                          ? '#1677ff'
                          : x.tone === 'orange'
                            ? '#f59e0b'
                            : x.tone === 'red'
                              ? '#ef4444'
                              : '#22c55e'
                      }
                      trailColor="#f1f5f9"
                      style={{ marginTop: 12 }}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {x.hint}
                    </Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      <Card className="operations-panel-card" style={{ marginTop: 16 }} bordered={false}>
        <Space wrap size="large">
          <Text strong>供应商服务质量（摘要）</Text>
          <Text type="secondary">
            SLA 达成 96.4% · 重大停机平均恢复 4.2h · 质保索赔闭环率 91%
          </Text>
          <Link to="/supplier/projects">
            <Button type="link">竞价与履约台账</Button>
          </Link>
        </Space>
      </Card>
    </div>
  )
}
