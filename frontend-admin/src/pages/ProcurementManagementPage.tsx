import { useEffect, useState } from 'react'
import { Button, Card, Col, Drawer, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, message } from 'antd'
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { apiRequest } from '../lib/api'
import { PageScaffold } from '../components/hospital/PageScaffold'


type ProjectItem = {
  id: string; project_code: string; title: string; category: string
  procurement_method: string; budget_amount: number | null; status: string
  summary: string; department_name: string; content: string; tech_params: string
  config_list: string; service_requirements: string; delivery_requirements: string
  acceptance_requirements: string; qualification_requirements: string
  registration_start: string | null; registration_end: string | null
  bid_deadline: string | null; created_at: string; publish_at: string | null; is_public: boolean
  draft: boolean; archived: boolean
}

type EnrollmentItem = {
  id: string; project_id: string; organization_id: string; legal_name?: string
  status: string; contact_name: string; contact_phone: string; contact_email: string
  review_comment: string; created_at: string
}

const STATUS_OPTIONS = [
  'DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REGISTERING', 'QUALIFYING',
  'INQUIRING', 'BIDDING', 'EVALUATING', 'AWARDED', 'TERMINATED', 'ARCHIVED',
]
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'default', PENDING_REVIEW: 'orange', PUBLISHED: 'blue',
  REGISTERING: 'cyan', QUALIFYING: 'geekblue', INQUIRING: 'purple',
  BIDDING: 'volcano', EVALUATING: 'gold', AWARDED: 'green',
  TERMINATED: 'red', ARCHIVED: 'default',
}
const CATEGORIES = ['设备', '耗材', '服务', '工程', '信息化', '其他']
const METHODS = ['公开招标', '邀请招标', '竞争性谈判', '询价', '单一来源', '竞价', '其他']

function fmt(v: string | null | undefined) {
  return v ? new Date(v).toLocaleString('zh-CN') : '-'
}
function money(v: number | null | undefined) {
  return v != null ? `¥${v.toLocaleString('zh-CN')}` : '-'
}

export function ProcurementManagementPage() {
  const [items, setItems] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState<ProjectItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([])
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      if (statusFilter) sp.set('status', statusFilter)
      const r = await apiRequest<{ items: ProjectItem[]; total: number }>(`/api/v1/procurement?${sp}`)
      setItems(r.items || [])
    } catch { /* */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [statusFilter])

  const handleCreate = async (values: any) => {
    try {
      const r = await apiRequest<ProjectItem>('/api/v1/procurement', {
        method: 'POST', body: JSON.stringify(values),
      })
      message.success(`项目 ${r.title} 已创建`)
      setCreateOpen(false); form.resetFields(); load()
    } catch (e: any) { message.error(e.message) }
  }

  const handleStatus = async (id: string, status: string) => {
    try {
      await apiRequest(`/api/v1/procurement/${id}/status`, {
        method: 'POST', body: JSON.stringify({ status }),
      })
      message.success(`状态已变更为 ${status}`)
      load()
      if (detail?.id === id) openDetail(id)
    } catch (e: any) { message.error(e.message) }
  }

  const openDetail = async (id: string) => {
    try {
      const r = await apiRequest<ProjectItem>(`/api/v1/procurement/${id}`)
      setDetail(r); setDetailOpen(true)
    } catch { message.error('加载详情失败') }
  }

  const openEnrollments = async (projectId: string) => {
    try {
      const r = await apiRequest<{ items: EnrollmentItem[] }>(`/api/v1/procurement/${projectId}/enrollments`)
      setEnrollments(r.items || []); setEnrollOpen(true)
    } catch { message.error('加载报名列表失败') }
  }

  const reviewEnrollment = async (eid: string, decision: string) => {
    try {
      await apiRequest(`/api/v1/procurement/${detail?.id}/enrollments/${eid}/review`, {
        method: 'POST', body: JSON.stringify({ decision, comment: '' }),
      })
      message.success(`报名已${decision === 'APPROVED' ? '通过' : '退回'}`)
      openEnrollments(detail!.id)
    } catch (e: any) { message.error(e.message) }
  }

  const columns: ColumnsType<ProjectItem> = [
    { title: '项目编号', dataIndex: 'project_code', width: 120 },
    { title: '项目名称', dataIndex: 'title', ellipsis: true },
    { title: '类别', dataIndex: 'category', width: 80 },
    { title: '采购方式', dataIndex: 'procurement_method', width: 100 },
    { title: '预算', dataIndex: 'budget_amount', width: 120, render: (v: number | null) => money(v) },
    { title: '科室', dataIndex: 'department_name', width: 100 },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v: string) => <Tag color={STATUS_COLORS[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '操作', width: 200,
      render: (_: any, row: ProjectItem) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(row.id)}>详情</Button>
          {row.status === 'DRAFT' && <Button size="small" onClick={() => handleStatus(row.id, 'PUBLISHED')}>发布</Button>}
          {['PUBLISHED', 'REGISTERING'].includes(row.status) && (
            <Button size="small" onClick={() => openEnrollments(row.id)}>报名({row.id.slice(0,4)})</Button>
          )}
          {!['TERMINATED', 'ARCHIVED'].includes(row.status) && (
            <Button size="small" danger onClick={() => handleStatus(row.id, 'TERMINATED')}>终止</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <PageScaffold title="采购协同管理">
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space>
              <span>状态：</span>
              <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }} allowClear
                options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} placeholder="全部" />
            </Space>
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建项目</Button>
          </Col>
        </Row>
      </Card>
      <Card>
        <Table rowKey="id" dataSource={items} columns={columns} loading={loading}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} />
      </Card>

      <Modal title="新建采购项目" open={createOpen} onCancel={() => setCreateOpen(false)} footer={null} width={800}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="title" label="项目名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="category" label="类别"><Select options={CATEGORIES.map(c => ({ value: c, label: c }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="procurement_method" label="采购方式"><Select options={METHODS.map(m => ({ value: m, label: m }))} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="budget_amount" label="预算金额"><InputNumber style={{ width: '100%' }} min={0} prefix="¥" /></Form.Item></Col>
            <Col span={8}><Form.Item name="department_name" label="使用科室"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="is_public" label="对外公开" initialValue={true}>
              <Select options={[{ value: true, label: '公开' }, { value: false, label: '不公开' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="content" label="采购内容"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="summary" label="项目摘要"><Input.TextArea rows={2} /></Form.Item>
          <Button type="primary" htmlType="submit">创建项目</Button>
        </Form>
      </Modal>

      <Drawer title={detail?.title || '项目详情'} open={detailOpen} onClose={() => setDetailOpen(false)} width={640}>
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Card size="small" title="基本信息">
              <p>编号：{detail.project_code || '-'}</p>
              <p>类别：{detail.category} / 方式：{detail.procurement_method}</p>
              <p>预算：{money(detail.budget_amount)} / 科室：{detail.department_name}</p>
              <p>状态：<Tag color={STATUS_COLORS[detail.status]}>{detail.status}</Tag></p>
              <p>创建时间：{fmt(detail.created_at)} / 发布时间：{fmt(detail.publish_at)}</p>
            </Card>
            <Card size="small" title="采购内容">{detail.content || '-'}</Card>
            {detail.tech_params && <Card size="small" title="技术参数"><pre style={{ whiteSpace: 'pre-wrap' }}>{detail.tech_params}</pre></Card>}
            {detail.qualification_requirements && <Card size="small" title="资质要求"><pre style={{ whiteSpace: 'pre-wrap' }}>{detail.qualification_requirements}</pre></Card>}
            <Space>
              {detail.status === 'DRAFT' && <Button type="primary" onClick={() => handleStatus(detail.id, 'PUBLISHED')}>发布项目</Button>}
              {detail.status === 'PUBLISHED' && <Button onClick={() => handleStatus(detail.id, 'REGISTERING')}>开始报名</Button>}
              {detail.status === 'REGISTERING' && <Button onClick={() => handleStatus(detail.id, 'QUALIFYING')}>开始资质审核</Button>}
              {['PUBLISHED', 'REGISTERING'].includes(detail.status) && <Button onClick={() => openEnrollments(detail.id)}>报名列表</Button>}
              <Button danger onClick={() => handleStatus(detail.id, 'TERMINATED')}>终止项目</Button>
            </Space>
          </Space>
        )}
      </Drawer>

      <Modal title="报名供应商" open={enrollOpen} onCancel={() => setEnrollOpen(false)} footer={null} width={700}>
        {enrollments.length === 0 ? <p style={{ color: '#999' }}>暂无供应商报名</p> : (
          <Table rowKey="id" dataSource={enrollments} pagination={false} columns={[
            { title: '供应商', dataIndex: 'legal_name' },
            { title: '联系人', dataIndex: 'contact_name' },
            { title: '电话', dataIndex: 'contact_phone' },
            { title: '状态', dataIndex: 'status', render: (v: string) => <Tag>{v}</Tag> },
            {
              title: '操作', render: (_: any, row: EnrollmentItem) => (
                <Space>
                  <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                    onClick={() => reviewEnrollment(row.id, 'APPROVED')}>通过</Button>
                  <Button size="small" danger icon={<CloseCircleOutlined />}
                    onClick={() => reviewEnrollment(row.id, 'REJECTED')}>退回</Button>
                </Space>
              ),
            },
          ]} />
        )}
      </Modal>
    </PageScaffold>
  )
}
