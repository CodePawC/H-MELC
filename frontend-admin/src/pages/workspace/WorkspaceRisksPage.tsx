import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'

import { fetchRepairs, type RepairRow } from '../../api/repairs'
import { PageScaffold } from '../../components/hospital/PageScaffold'
import { IS_AUTH_MOCK } from '../../config/authMode'
import { ApiClientError } from '../../lib/api'
import { MOCK_RISKS } from '../../mock/hospital/tables'

type RiskMergedRow = {
  key: string
  kind: string
  level: string
  title: string
  time: string
  order_status: string
  repair_id: string
}

function riskLevelTag(level: string) {
  if (level === '高') return <Tag color="red">{level}</Tag>
  if (level === '中') return <Tag color="orange">{level}</Tag>
  return <Tag>{level}</Tag>
}

/** 风险列表：真实登录时用工单接口拼装「待确认 / 高优先级」两类信号；Mock 为演示数据 */
export function WorkspaceRisksPage() {
  const [loading, setLoading] = useState(!IS_AUTH_MOCK)
  const [err, setErr] = useState<string | null>(null)
  const [rows, setRows] = useState<RiskMergedRow[]>([])

  useEffect(() => {
    if (IS_AUTH_MOCK) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const [awaitConfirm, highPri] = await Promise.all([
          fetchRepairs({ page: 1, page_size: 50, order_status: 'AWAIT_CONFIRM' }),
          fetchRepairs({ page: 1, page_size: 40, priority: 'HIGH' }),
        ])
        if (cancelled) return
        const seen = new Set<string>()
        const out: RiskMergedRow[] = []

        function pushRow(r: RepairRow, kind: string, level: string) {
          if (seen.has(r.id)) return
          seen.add(r.id)
          const title = `${r.order_code} · ${r.fault_description?.trim() || '—'}`
          const time = r.created_at ? r.created_at.replace('T', ' ').slice(0, 19) : '—'
          out.push({
            key: r.id,
            kind,
            level,
            title,
            time,
            order_status: r.order_status,
            repair_id: r.id,
          })
        }

        for (const r of awaitConfirm.items) pushRow(r, '待科室确认', '中')
        for (const r of highPri.items) pushRow(r, '高优先级跟进', '高')

        setRows(out)
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof ApiClientError ? e.message : '风险列表加载失败')
          setRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const mockCols: ColumnsType<(typeof MOCK_RISKS)[number]> = useMemo(
    () => [
      {
        title: '级别',
        dataIndex: 'level',
        width: 80,
        render: (l: string) => riskLevelTag(l),
      },
      { title: '描述', dataIndex: 'title', ellipsis: true },
      { title: '时间', dataIndex: 'time', width: 170 },
      {
        title: '操作',
        key: 'op',
        width: 80,
        render: () => <span className="muted tiny">演示</span>,
      },
    ],
    [],
  )

  const liveCols: ColumnsType<RiskMergedRow> = [
    {
      title: '级别',
      dataIndex: 'level',
      width: 80,
      render: (l: string) => riskLevelTag(l),
    },
    { title: '类型', dataIndex: 'kind', width: 120 },
    { title: '描述', dataIndex: 'title', ellipsis: true },
    { title: '工单状态', dataIndex: 'order_status', width: 120 },
    { title: '创建时间', dataIndex: 'time', width: 170 },
    {
      title: '操作',
      key: 'op',
      width: 80,
      render: (_, r) => <Link to={`/repair/tickets/${r.repair_id}`}>详情</Link>,
    },
  ]

  if (IS_AUTH_MOCK) {
    return (
      <PageScaffold
        title="风险预警"
        description="演示风险条目。真实环境将基于维修工单状态与优先级等聚合信号。"
      >
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message="演示模式（Mock 登录）" />
        <Table size="small" columns={mockCols} dataSource={MOCK_RISKS} rowKey="id" pagination={false} />
      </PageScaffold>
    )
  }

  return (
    <PageScaffold
      title="风险预警"
      description="由「待科室确认」与「高优先级」工单列表拼装的风险视图（一期近似实现；计量与付款类风险待专用接口）。"
      extra={
        <Space wrap>
          <Link to="/repair/tickets?order_status=AWAIT_CONFIRM">
            <Button type="primary">待确认工单</Button>
          </Link>
          <Link to="/repair/tickets">
            <Button>全部工单</Button>
          </Link>
        </Space>
      }
    >
      {err ? (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="接口暂不可用" description={err} />
      ) : null}
      <Table
        size="small"
        loading={loading}
        columns={liveCols}
        dataSource={rows}
        rowKey={(r) => r.key}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: loading ? '加载中…' : '暂无风险条目' }}
      />
    </PageScaffold>
  )
}
