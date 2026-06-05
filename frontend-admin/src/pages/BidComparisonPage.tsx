import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiRequest } from '../lib/api'
import { PageScaffold } from '../components/hospital/PageScaffold'

const { Title } = Typography

type BidItem = {
  id: string; organization_id: string; legal_name: string; short_name: string
  quoted_amount: number; currency: string; remark: string
  bid_status: string; attachment_name: string; created_at: string
}

type ComparisonData = {
  project_title: string; project_code: string
  items: BidItem[]; total: number
  stats: { min_price: number; max_price: number; avg_price: number; bidder_count: number }
}

export function BidComparisonPage() {
  const { projectId } = useParams()
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    apiRequest<ComparisonData>(`/api/v1/procurement/${projectId}/comparison`)
      .then(setData).catch(e => message.error(e.message)).finally(() => setLoading(false))
  }, [projectId])

  const columns: ColumnsType<BidItem> = [
    { title: '供应商', dataIndex: 'legal_name' },
    { title: '报价金额', dataIndex: 'quoted_amount', render: (v: number) => <strong style={{ color: '#1677ff' }}>¥{v.toLocaleString()}</strong>, sorter: (a, b) => a.quoted_amount - b.quoted_amount },
    { title: '币种', dataIndex: 'currency', width: 80 },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    { title: '附件', dataIndex: 'attachment_name', render: (v: string) => v || '-' },
    { title: '状态', dataIndex: 'bid_status', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    { title: '报价时间', dataIndex: 'created_at', width: 160, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
  ]

  return (
    <PageScaffold title="报价对比">
      <Card loading={loading} style={{ marginBottom: 16 }}>
        <Title level={5}>{data?.project_title || '-'}</Title>
        <p style={{ color: '#6b7280' }}>项目编号：{data?.project_code || '-'} | 共 {data?.total || 0} 家供应商</p>
        <Space size={24}>
          <Statistic title="最低价" prefix="¥" value={data?.stats.min_price ?? 0} valueStyle={{ color: '#22c55e' }} />
          <Statistic title="最高价" prefix="¥" value={data?.stats.max_price ?? 0} valueStyle={{ color: '#ef4444' }} />
          <Statistic title="平均价" prefix="¥" value={data?.stats.avg_price ?? 0} precision={2} />
          <Statistic title="报价家数" value={data?.stats.bidder_count ?? 0} suffix="家" />
        </Space>
      </Card>
      <Card>
        <Table rowKey="id" dataSource={data?.items || []} columns={columns} loading={loading}
          pagination={false} />
      </Card>
    </PageScaffold>
  )
}
