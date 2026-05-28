import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'

import { fetchDashboardWorkspaceTasks } from '../../api/dashboard'
import { PageScaffold } from '../../components/hospital/PageScaffold'
import { IS_AUTH_MOCK } from '../../config/authMode'
import { ApiClientError } from '../../lib/api'
import { MOCK_TODOS } from '../../mock/hospital/tables'

function todoDemoTag(status: string) {
  if (status.includes('逾期')) return <Tag color="red">{status}</Tag>
  if (status === '待办') return <Tag color="orange">{status}</Tag>
  return <Tag>{status}</Tag>
}

/** docs/06 · GET /dashboard/workspace-tasks；Mock 时沿用演示表数据 */
export function WorkspaceTodosPage() {
  const [loading, setLoading] = useState(!IS_AUTH_MOCK)
  const [err, setErr] = useState<string | null>(null)
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof fetchDashboardWorkspaceTasks>> | null>(null)

  useEffect(() => {
    if (IS_AUTH_MOCK) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const d = await fetchDashboardWorkspaceTasks(30)
        if (!cancelled) setPayload(d)
      } catch (e) {
        if (!cancelled) setErr(e instanceof ApiClientError ? e.message : '工作台待办加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const mockCols: ColumnsType<(typeof MOCK_TODOS)[number]> = [
    { title: '类型', dataIndex: 'type', width: 120 },
    { title: '事项', dataIndex: 'title', ellipsis: true },
    { title: '截止', dataIndex: 'due', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: string) => todoDemoTag(s),
    },
    {
      title: '操作',
      key: 'op',
      width: 100,
      render: () => <span className="muted tiny">演示</span>,
    },
  ]

  if (IS_AUTH_MOCK) {
    return (
      <PageScaffold
        title="我的待办"
        description="演示数据。生产环境请关闭 VITE_AUTH_MOCK 并登录，以对接工作台聚合接口。"
      >
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message="演示模式（Mock 登录）" />
        <Table size="small" columns={mockCols} dataSource={MOCK_TODOS} rowKey="id" pagination={false} />
      </PageScaffold>
    )
  }

  const wfCols: ColumnsType<(NonNullable<typeof payload>['workflow']['items'][number])> = [
    { title: '摘要', dataIndex: 'summary', ellipsis: true, render: (v, r) => v || r.instance_title || '—' },
    { title: '流程', dataIndex: 'process_key', width: 140, ellipsis: true, render: (v: string | null) => v || '—' },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (v: string | null) => (v ? v.replace('T', ' ').slice(0, 19) : '—'),
    },
    {
      title: '操作',
      key: 'op',
      width: 120,
      render: () => <Link to="/system/workflows">审批台</Link>,
    },
  ]

  const repairCols: ColumnsType<(NonNullable<typeof payload>['repairs_preview'][number])> = [
    { title: '工单号', dataIndex: 'order_code', width: 140 },
    { title: '状态', dataIndex: 'status', width: 120 },
    { title: '故障摘要', dataIndex: 'fault_preview', ellipsis: true },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (v: string | null) => (v ? v.replace('T', ' ').slice(0, 19) : '—'),
    },
    {
      title: '操作',
      key: 'op',
      width: 80,
      render: (_, r) => <Link to={`/repair/tickets/${r.id}`}>详情</Link>,
    },
  ]

  return (
    <PageScaffold
      title="我的待办"
      description="聚合审批流待办与未闭环工单预览。数据来源：GET /api/v1/dashboard/workspace-tasks。"
      extra={
        <Space wrap>
          <Link to="/system/workflows">
            <Button type="primary">审批控制台</Button>
          </Link>
          <Link to="/repair/tickets">
            <Button>报修工单列表</Button>
          </Link>
        </Space>
      }
    >
      {err ? (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="接口暂不可用" description={err} />
      ) : null}
      <h4 style={{ margin: '0 0 12px', fontSize: 15 }}>审批待办（共 {payload?.workflow.total ?? '—'} 条）</h4>
      <Table
        size="small"
        loading={loading}
        columns={wfCols}
        dataSource={payload?.workflow.items ?? []}
        rowKey={(r) => r.task_id}
        pagination={false}
        locale={{ emptyText: loading ? '加载中…' : '暂无审批待办' }}
      />
      <h4 style={{ margin: '24px 0 12px', fontSize: 15 }}>未闭环工单预览</h4>
      <Table
        size="small"
        loading={loading}
        columns={repairCols}
        dataSource={payload?.repairs_preview ?? []}
        rowKey={(r) => r.id}
        pagination={false}
        locale={{ emptyText: loading ? '加载中…' : '暂无未闭环工单' }}
      />
    </PageScaffold>
  )
}
