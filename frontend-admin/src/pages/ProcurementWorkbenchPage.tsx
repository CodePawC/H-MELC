import { useMemo, useRef, useState } from 'react'
import { Alert, Button, DatePicker, Drawer, Form, Input, Modal, Radio, Select, Space, Statistic, Tag, Typography } from 'antd'
import type { ActionType, ProColumns, ProTableProps } from '@ant-design/pro-components'
import { ProCard, ProTable } from '@ant-design/pro-components'
import { CheckCircleOutlined, FileAddOutlined, InboxOutlined, StopOutlined } from '@ant-design/icons'

import {
  createProcurementProject,
  fetchProcurementProjectBids,
  fetchProcurementProjects,
  reviewProcurementProject,
} from '../api/suppliers'
import type { ProcurementBidRow, ProcurementProjectRow } from '../api/suppliers'
import { ApiClientError } from '../lib/api'
import { PageScaffold } from '../components/hospital/PageScaffold'

type ProjectQuery = {
  status?: string
}

type CreateForm = {
  title: string
  summary?: string
  repair_order_id?: string
  bid_deadline?: string
}

function statusTag(status: string) {
  const color = status === 'OPEN' ? 'processing' : status === 'CLOSED' ? 'success' : status === 'CANCELLED' ? 'default' : 'warning'
  const text = status === 'OPEN' ? '报价中' : status === 'CLOSED' ? '已收官' : status === 'CANCELLED' ? '已废止' : status
  return <Tag color={color}>{text}</Tag>
}

function fmt(s?: string | null) {
  return s ? String(s).replace('T', ' ').slice(0, 19) : '-'
}

function money(v: number | string) {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  return `¥${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function ProcurementWorkbenchPage() {
  const actionRef = useRef<ActionType>(null)
  const [form] = Form.useForm<CreateForm>()
  const [reviewForm] = Form.useForm<{ decision: 'CLOSED' | 'CANCELLED'; winning_bid_id?: string; remark?: string }>()
  const [err, setErr] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [selected, setSelected] = useState<ProcurementProjectRow | null>(null)
  const [bids, setBids] = useState<ProcurementBidRow[]>([])
  const [bidsLoading, setBidsLoading] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [snapshot, setSnapshot] = useState<ProcurementProjectRow[]>([])

  async function openProject(row: ProcurementProjectRow) {
    setSelected(row)
    setBids([])
    reviewForm.setFieldsValue({ decision: 'CLOSED', winning_bid_id: row.winning_bid_id ?? undefined, remark: row.review_remark ?? undefined })
    setBidsLoading(true)
    setErr(null)
    try {
      const data = await fetchProcurementProjectBids(row.id)
      setBids(data.items)
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setBidsLoading(false)
    }
  }

  async function submitCreate(values: CreateForm) {
    setCreateBusy(true)
    setErr(null)
    try {
      await createProcurementProject({
        title: values.title,
        summary: values.summary || null,
        repair_order_id: values.repair_order_id || null,
        bid_deadline: values.bid_deadline || null,
      })
      setCreateOpen(false)
      form.resetFields()
      actionRef.current?.reload()
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setCreateBusy(false)
    }
  }

  async function submitReview() {
    if (!selected) return
    const values = await reviewForm.validateFields()
    setReviewBusy(true)
    setErr(null)
    try {
      await reviewProcurementProject(selected.id, {
        decision: values.decision,
        winning_bid_id: values.decision === 'CLOSED' ? values.winning_bid_id || null : null,
        remark: values.remark || null,
      })
      setSelected(null)
      actionRef.current?.reload()
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setReviewBusy(false)
    }
  }

  const request: ProTableProps<ProcurementProjectRow, ProjectQuery>['request'] = async (params) => {
    setErr(null)
    try {
      const data = await fetchProcurementProjects({
        page: params.current,
        page_size: params.pageSize,
        status: params.status === 'ALL' ? undefined : params.status,
      })
      setSnapshot(data.items)
      return { data: data.items, total: data.total, success: true }
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : String(e))
      setSnapshot([])
      return { data: [], total: 0, success: false }
    }
  }

  const columns = useMemo<ProColumns<ProcurementProjectRow>[]>(
    () => [
      { title: '项目标题', dataIndex: 'title', ellipsis: true, copyable: true },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        valueType: 'select',
        initialValue: 'ALL',
        fieldProps: {
          options: [
            { label: '全部', value: 'ALL' },
            { label: '报价中', value: 'OPEN' },
            { label: '已收官', value: 'CLOSED' },
            { label: '已废止', value: 'CANCELLED' },
          ],
        },
        render: (_, row) => statusTag(row.status),
      },
      { title: '关联维修工单', dataIndex: 'repair_order_id', width: 150, search: false, render: (_, row) => row.repair_order_id ? `${row.repair_order_id.slice(0, 8)}...` : '-' },
      { title: '报价截止', dataIndex: 'bid_deadline', width: 170, search: false, render: (_, row) => fmt(row.bid_deadline) },
      { title: '发布时间', dataIndex: 'created_at', width: 170, search: false, render: (_, row) => fmt(row.created_at) },
      {
        title: '操作',
        valueType: 'option',
        width: 120,
        render: (_, row) => [
          <Button key="detail" type="link" size="small" onClick={() => openProject(row)}>
            报价/评审
          </Button>,
        ],
      },
    ],
    [],
  )

  const openCount = snapshot.filter((x) => x.status === 'OPEN').length
  const closedCount = snapshot.filter((x) => x.status === 'CLOSED').length
  const cancelledCount = snapshot.filter((x) => x.status === 'CANCELLED').length

  return (
    <PageScaffold
      title="采购与竞价工作台"
      description="以竞价项目为当前真实闭环：院内发布项目，供应商门户报价，院内查看报价并收官或废止。"
      extra={
        <Button type="primary" icon={<FileAddOutlined />} onClick={() => setCreateOpen(true)}>
          发布竞价项目
        </Button>
      }
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {err ? <Alert showIcon type="warning" message="采购接口提示" description={err} /> : null}

        <ProCard gutter={12} ghost>
          <ProCard bordered size="small">
            <Statistic title="本页报价中" value={openCount} prefix={<InboxOutlined />} />
          </ProCard>
          <ProCard bordered size="small">
            <Statistic title="本页已收官" value={closedCount} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#1677ff' }} />
          </ProCard>
          <ProCard bordered size="small">
            <Statistic title="本页已废止" value={cancelledCount} prefix={<StopOutlined />} />
          </ProCard>
        </ProCard>

        <ProTable<ProcurementProjectRow, ProjectQuery>
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          request={request}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          search={{ labelWidth: 'auto', span: 8 }}
          options={{ reload: true, density: true, setting: true }}
        />
      </Space>

      <Modal
        title="发布竞价项目"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createBusy}
        width={680}
      >
        <Form form={form} layout="vertical" onFinish={submitCreate}>
          <Form.Item name="title" label="项目标题" rules={[{ required: true, message: '请填写项目标题' }]}>
            <Input placeholder="如：呼吸机维修外修竞价" />
          </Form.Item>
          <Form.Item name="summary" label="需求摘要">
            <Input.TextArea rows={4} placeholder="维修范围、服务要求、报价材料要求等" />
          </Form.Item>
          <Form.Item name="repair_order_id" label="关联维修工单 ID">
            <Input placeholder="可选，填写 repair_order_id UUID" />
          </Form.Item>
          <Form.Item name="bid_deadline" label="报价截止时间" getValueFromEvent={(v) => v?.toISOString?.()}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={selected?.title ?? '竞价项目'}
        open={!!selected}
        onClose={() => setSelected(null)}
        width={760}
        extra={selected ? statusTag(selected.status) : null}
      >
        {selected ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Typography.Paragraph type="secondary">{selected.summary || '未填写需求摘要。'}</Typography.Paragraph>
            <ProTable<ProcurementBidRow>
              rowKey="id"
              headerTitle="供应商报价"
              loading={bidsLoading}
              search={false}
              pagination={false}
              dataSource={bids}
              columns={[
                { title: '供应商', dataIndex: 'organization_legal_name', ellipsis: true },
                { title: '报价', dataIndex: 'quoted_amount', width: 130, render: (_, row) => money(row.quoted_amount) },
                { title: '币种', dataIndex: 'currency', width: 80 },
                { title: '说明', dataIndex: 'remark', ellipsis: true, render: (_, row) => row.remark || '-' },
                { title: '提交时间', dataIndex: 'created_at', width: 170, render: (_, row) => fmt(row.created_at) },
              ]}
            />

            {selected.status === 'OPEN' ? (
              <Form form={reviewForm} layout="vertical">
                <Form.Item name="decision" label="评审结论" initialValue="CLOSED">
                  <Radio.Group>
                    <Radio.Button value="CLOSED">收官</Radio.Button>
                    <Radio.Button value="CANCELLED">废止</Radio.Button>
                  </Radio.Group>
                </Form.Item>
                <Form.Item noStyle shouldUpdate={(prev, next) => prev.decision !== next.decision}>
                  {({ getFieldValue }) =>
                    getFieldValue('decision') === 'CLOSED' ? (
                      <Form.Item name="winning_bid_id" label="中选报价">
                        <Select
                          allowClear
                          placeholder="可选，不选择则仅收官"
                          options={bids.map((bid) => ({
                            label: `${bid.organization_legal_name} · ${money(bid.quoted_amount)}`,
                            value: bid.id,
                          }))}
                        />
                      </Form.Item>
                    ) : null
                  }
                </Form.Item>
                <Form.Item name="remark" label="评审备注">
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Button type="primary" loading={reviewBusy} onClick={submitReview}>
                  提交评审
                </Button>
              </Form>
            ) : (
              <Alert
                showIcon
                type="info"
                message="项目已结束"
                description={`评审时间：${fmt(selected.reviewed_at)}；备注：${selected.review_remark || '-'}`}
              />
            )}
          </Space>
        ) : null}
      </Drawer>
    </PageScaffold>
  )
}
