import { useEffect, useState } from 'react'
import { Button, Card, Empty, Table, Tag } from 'antd'
import { SyncOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { apiRequest } from '../lib/api'
import { PageScaffold } from '../components/hospital/PageScaffold'

type SupplementRequest = {
  id: string
  request_type: string
  proposed_name: string
  reason: string
  submitted_by: string
  submitted_at: string
  status: string
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  equipment_standard_name: '设备通用名称',
  manufacturer_vendor: '往来单位',
  device_classification: '医疗器械分类',
  organization_master: '组织机构',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'orange',
  APPROVED: 'green',
  REJECTED: 'red',
}

export function SupplementRequestPage() {
  const [requests, setRequests] = useState<SupplementRequest[]>([])
  const [loading, setLoading] = useState(false)

  const loadRequests = async () => {
    setLoading(true)
    try {
      const result = await apiRequest<{ items: SupplementRequest[]; total: number }>(
        '/api/v1/hmdm/supplement-requests',
        { method: 'GET' },
      )
      if (result && 'items' in result) {
        setRequests((result as { items: SupplementRequest[] }).items)
      }
    } catch {
      // fallback empty
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRequests() }, [])

  const columns: ColumnsType<SupplementRequest> = [
    { title: '申请类型', dataIndex: 'request_type', width: 120, render: (v: string) => REQUEST_TYPE_LABELS[v] || v },
    { title: '申请名称', dataIndex: 'proposed_name', ellipsis: true },
    { title: '申请理由', dataIndex: 'reason', ellipsis: true, width: 200 },
    { title: '提交人', dataIndex: 'submitted_by', width: 100 },
    { title: '提交时间', dataIndex: 'submitted_at', width: 180, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <Tag color={STATUS_COLORS[v] || 'default'}>{v}</Tag> },
  ]

  return (
    <PageScaffold title="主数据补充申请管理">
      <Card
        title="主数据补充申请"
        extra={<Button icon={<SyncOutlined />} onClick={loadRequests} loading={loading}>刷新</Button>}
      >
        {requests.length === 0 && !loading ? (
          <Empty description="暂无补充申请。通过选择器中的「提交补充/修正申请」提交的新数据将在此处显示。" />
        ) : (
          <Table
            rowKey="id"
            dataSource={requests}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          />
        )}
      </Card>
    </PageScaffold>
  )
}
