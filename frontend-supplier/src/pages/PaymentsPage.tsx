import { useEffect, useState } from 'react'
import { Card, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { fetchPayables, fetchPayments } from '../api/supplierPortal'
import type { PayableItem, PaymentItem } from '../types/supplier'

const { Title } = Typography

function PayablesTab() {
  const [data, setData] = useState<PayableItem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    fetchPayables(page, 20).then((r) => { setData(r.items); setTotal(r.total); setLoading(false) }).catch(() => setLoading(false))
  }, [page])

  const columns: ColumnsType<PayableItem> = [
    { title: '名称', dataIndex: 'title', ellipsis: true },
    { title: '应付金额', dataIndex: 'amount_due', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '已付金额', dataIndex: 'amount_paid', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '余额', dataIndex: 'balance', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '到期日', dataIndex: 'due_date', render: (v: string) => v ? new Date(v).toLocaleDateString('zh-CN') : '-' },
    { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v === 'OPEN' ? 'orange' : 'green'}>{v}</Tag> },
  ]

  return (
    <Card>
      <Table rowKey="id" dataSource={data} columns={columns} loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => setPage(p), showTotal: (t) => `共 ${t} 条` }} />
    </Card>
  )
}

function PaymentsTab() {
  const [data, setData] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    fetchPayments(page, 20).then((r) => { setData(r.items); setTotal(r.total); setLoading(false) }).catch(() => setLoading(false))
  }, [page])

  const columns: ColumnsType<PaymentItem> = [
    { title: '付款日期', dataIndex: 'payment_date', render: (v: string) => new Date(v).toLocaleDateString('zh-CN') },
    { title: '付款金额', dataIndex: 'payment_amount', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '分摊笔数', dataIndex: 'allocations', render: (v: PaymentItem['allocations']) => v?.length || 0 },
  ]

  return (
    <Card>
      <Table rowKey="id" dataSource={data} columns={columns} loading={loading}
        pagination={{ current: page, pageSize: 20, total, onChange: (p) => setPage(p), showTotal: (t) => `共 ${t} 条` }} />
    </Card>
  )
}

export function PaymentsPage() {
  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>付款进度</Title>
      <Tabs defaultActiveKey="payables" items={[
        { key: 'payables', label: '应付款台账', children: <PayablesTab /> },
        { key: 'payments', label: '付款流水', children: <PaymentsTab /> },
      ]} />
    </div>
  )
}
