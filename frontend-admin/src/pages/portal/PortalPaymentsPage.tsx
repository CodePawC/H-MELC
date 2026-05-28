import { useMemo, useState } from 'react'
import { Alert, Space, Statistic, Tag, Typography } from 'antd'
import type { ProColumns, ProTableProps } from '@ant-design/pro-components'
import { ProCard, ProTable } from '@ant-design/pro-components'

import { fetchSupplierPortalPayables, fetchSupplierPortalPayments } from '../../api/supplierPortal'
import type { SupplierPortalPayable, SupplierPortalPayment } from '../../api/supplierPortal'
import { ApiClientError } from '../../lib/api'
import { useAuthSession } from '../../stores/authSession'

const { Title, Text } = Typography

function money(v?: number) {
  return `¥${(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function statusTag(status: string) {
  const color = status === 'OPEN' ? 'orange' : status === 'CLOSED' ? 'green' : 'default'
  return <Tag color={color}>{status}</Tag>
}

export function PortalPaymentsPage() {
  const me = useAuthSession((s) => s.me)
  const [payables, setPayables] = useState<SupplierPortalPayable[]>([])
  const [payments, setPayments] = useState<SupplierPortalPayment[]>([])
  const [err, setErr] = useState<string | null>(null)

  const payableColumns = useMemo<ProColumns<SupplierPortalPayable>[]>(
    () => [
      { title: '应付事项', dataIndex: 'title', ellipsis: true },
      { title: '应付金额', dataIndex: 'amount_due', width: 120, search: false, render: (_, r) => money(r.amount_due) },
      { title: '已付金额', dataIndex: 'amount_paid', width: 120, search: false, render: (_, r) => money(r.amount_paid) },
      { title: '余额', dataIndex: 'balance', width: 120, search: false, render: (_, r) => money(r.balance) },
      { title: '到期日', dataIndex: 'due_date', width: 120, search: false, render: (_, r) => r.due_date ?? '-' },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        valueType: 'select',
        initialValue: 'ALL',
        fieldProps: {
          options: [
            { label: '全部', value: 'ALL' },
            { label: '未结清', value: 'OPEN' },
            { label: '已结清', value: 'CLOSED' },
          ],
        },
        render: (_, r) => statusTag(r.status),
      },
    ],
    [],
  )

  const paymentColumns = useMemo<ProColumns<SupplierPortalPayment>[]>(
    () => [
      { title: '付款日期', dataIndex: 'payment_date', width: 130, render: (_, r) => r.payment_date },
      { title: '付款金额', dataIndex: 'payment_amount', width: 140, render: (_, r) => money(r.payment_amount) },
      {
        title: '分摊条目',
        dataIndex: 'allocations',
        search: false,
        render: (_, r) => `${r.allocations?.length ?? 0} 条`,
      },
      { title: '付款 ID', dataIndex: 'id', ellipsis: true, copyable: true },
    ],
    [],
  )

  const payableRequest: ProTableProps<SupplierPortalPayable, { status?: string }>['request'] = async (params) => {
    setErr(null)
    try {
      const data = await fetchSupplierPortalPayables({
        page: params.current,
        page_size: params.pageSize,
        status: params.status === 'ALL' ? undefined : params.status,
      })
      setPayables(data.items)
      return { data: data.items, total: data.total, success: true }
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : String(e))
      setPayables([])
      return { data: [], total: 0, success: false }
    }
  }

  const paymentRequest: ProTableProps<SupplierPortalPayment, Record<string, unknown>>['request'] = async (params) => {
    setErr(null)
    try {
      const data = await fetchSupplierPortalPayments({ page: params.current, page_size: params.pageSize })
      setPayments(data.items)
      return { data: data.items, total: data.total, success: true }
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : String(e))
      setPayments([])
      return { data: [], total: 0, success: false }
    }
  }

  const openBalance = payables.reduce((sum, row) => sum + (row.balance || 0), 0)
  const paidThisPage = payments.reduce((sum, row) => sum + (row.payment_amount || 0), 0)

  return (
    <div>
      <Title level={4} style={{ marginTop: 0 }}>
        付款进度
      </Title>
      <Text type="secondary">仅展示当前供应商 {me?.supplierId ?? '-'} 可见的应付与付款流水。</Text>

      <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 16 }}>
        {err ? <Alert showIcon type="warning" message="门户付款接口提示" description={err} /> : null}

        <ProCard gutter={12} ghost>
          <ProCard bordered>
            <Statistic title="本页未付余额" value={money(openBalance)} valueStyle={{ color: '#cf1322' }} />
          </ProCard>
          <ProCard bordered>
            <Statistic title="本页付款流水" value={money(paidThisPage)} valueStyle={{ color: '#1677ff' }} />
          </ProCard>
          <ProCard bordered>
            <Statistic title="应付条目" value={payables.length} />
          </ProCard>
        </ProCard>

        <ProTable<SupplierPortalPayable, { status?: string }>
          rowKey="id"
          headerTitle="应付款台账"
          columns={payableColumns}
          request={payableRequest}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          search={{ labelWidth: 'auto', span: 8 }}
          options={{ reload: true, density: true, setting: true }}
        />

        <ProTable<SupplierPortalPayment>
          rowKey="id"
          headerTitle="付款流水"
          columns={paymentColumns}
          request={paymentRequest}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          search={false}
          options={{ reload: true, density: true, setting: true }}
        />
      </Space>
    </div>
  )
}
