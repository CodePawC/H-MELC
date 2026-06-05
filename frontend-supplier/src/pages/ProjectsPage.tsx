import { useEffect, useRef, useState } from 'react'
import { Button, Card, Drawer, Form, Input, InputNumber, Modal, Space, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { fetchProjectBids, fetchProjects, submitBid } from '../api/supplierPortal'
import type { ProjectBid, ProjectItem } from '../types/supplier'
import { useAuthStore } from '../stores/authStore'

const { Title } = Typography

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [bidDrawer, setBidDrawer] = useState<{ open: boolean; project: ProjectItem | null; bids: ProjectBid[] }>({ open: false, project: null, bids: [] })
  const [bidLoading, setBidLoading] = useState(false)
  const user = useAuthStore((s) => s.user)

  const load = () => {
    setLoading(true)
    fetchProjects().then((r) => { setProjects(r.items); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const openBidDrawer = async (project: ProjectItem) => {
    setBidDrawer({ open: true, project, bids: [] })
    try {
      const r = await fetchProjectBids(project.id)
      setBidDrawer((prev) => ({ ...prev, bids: r.items }))
    } catch { /* ignore */ }
  }

  const handleSubmitBid = async (values: { quoted_amount: number; remark?: string }) => {
    if (!bidDrawer.project) return
    setBidLoading(true)
    try {
      await submitBid(bidDrawer.project.id, values.quoted_amount, values.remark)
      message.success('报价已提交')
      setBidDrawer((prev) => ({ ...prev, open: false, bids: [] }))
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '提交失败')
    } finally {
      setBidLoading(false)
    }
  }

  const columns: ColumnsType<ProjectItem> = [
    { title: '项目名称', dataIndex: 'title', ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <Tag color={v === 'OPEN' ? 'green' : 'default'}>{v}</Tag> },
    { title: '截止日期', dataIndex: 'bid_deadline', width: 180, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '发布时间', dataIndex: 'created_at', width: 180, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    {
      title: '操作', width: 100,
      render: (_, row) => (
        <Button type="link" onClick={() => openBidDrawer(row)} disabled={row.status !== 'OPEN'}>
          {row.status === 'OPEN' ? '报价' : '查看'}
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>项目中心</Title>
      <Card>
        <Table rowKey="id" dataSource={projects} columns={columns} loading={loading} pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} />
      </Card>

      <Drawer
        title={bidDrawer.project?.title || '项目详情'}
        open={bidDrawer.open}
        onClose={() => setBidDrawer({ open: false, project: null, bids: [] })}
        width={500}
      >
        {bidDrawer.bids.length > 0 && (
          <Card size="small" title="我的报价" style={{ marginBottom: 16 }}>
            <Table rowKey="id" dataSource={bidDrawer.bids} columns={[
              { title: '金额', dataIndex: 'quoted_amount', render: (v: number) => `¥${v.toFixed(2)}` },
              { title: '中标', dataIndex: 'is_winning', render: (v: boolean) => v ? <Tag color="green">是</Tag> : '否' },
            ]} pagination={false} size="small" />
          </Card>
        )}
        {bidDrawer.project?.status === 'OPEN' && (
          <Card size="small" title="提交报价">
            <Form layout="vertical" onFinish={handleSubmitBid}>
              <Form.Item name="quoted_amount" label="报价金额（元）" rules={[{ required: true, message: '请输入报价' }]}>
                <InputNumber style={{ width: '100%' }} min={0} prefix="¥" precision={2} />
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={bidLoading}>提交报价</Button>
            </Form>
          </Card>
        )}
      </Drawer>
    </div>
  )
}
