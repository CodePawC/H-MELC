import { useEffect, useState } from 'react'
import { Card, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiRequest } from '../lib/api'

const { Title } = Typography

type EnrollmentItem = {
  id: string; project_id: string; project_title: string
  project_code: string; project_status: string
  status: string; contact_name: string; contact_phone: string
  review_comment: string; created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'orange', APPROVED: 'green', REJECTED: 'red', RETURNED: 'purple',
}

export function MyEnrollmentsPage() {
  const [items, setItems] = useState<EnrollmentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiRequest<{ items: EnrollmentItem[]; total: number }>('/api/v1/supplier/procurement/enrollments')
      .then(d => setItems(d.items || []))
      .catch(e => message.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const columns: ColumnsType<EnrollmentItem> = [
    { title: '项目名称', dataIndex: 'project_title', ellipsis: true },
    { title: '项目编号', dataIndex: 'project_code', width: 140 },
    {
      title: '报名状态', dataIndex: 'status', width: 120,
      render: (v: string) => <Tag color={STATUS_COLORS[v] || 'default'}>{v}</Tag>,
    },
    { title: '联系人', dataIndex: 'contact_name', width: 100 },
    { title: '电话', dataIndex: 'contact_phone', width: 130 },
    { title: '审核意见', dataIndex: 'review_comment', ellipsis: true },
    { title: '报名时间', dataIndex: 'created_at', width: 160, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>我的报名</Title>
      <Card>
        <Table rowKey="id" dataSource={items} columns={columns} loading={loading}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} />
      </Card>
    </div>
  )
}
