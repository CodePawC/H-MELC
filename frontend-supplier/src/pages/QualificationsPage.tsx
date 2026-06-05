import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, Modal, Select, Table, Tag, Typography, Upload, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { fetchQualifications, uploadQualification } from '../api/supplierPortal'
import type { QualificationItem } from '../types/supplier'

const { Title } = Typography

export function QualificationsPage() {
  const [items, setItems] = useState<QualificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    fetchQualifications().then((r) => { setItems(r.items); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleCreate = async (values: { title: string; credential_type: string }) => {
    setSubmitting(true)
    try {
      await uploadQualification(values.title, values.credential_type)
      message.success('资质已提交')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<QualificationItem> = [
    { title: '资质名称', dataIndex: 'title', ellipsis: true },
    { title: '类型', dataIndex: 'credential_type', width: 120 },
    {
      title: '审核状态', dataIndex: 'review_status', width: 120,
      render: (v: string) => {
        const colors: Record<string, string> = { PENDING: 'orange', ACCEPTED: 'green', REJECTED: 'red' }
        return <Tag color={colors[v] || 'default'}>{v}</Tag>
      },
    },
    { title: '提交时间', dataIndex: 'created_at', width: 180, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>资质管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新增资质</Button>
      </div>
      <Card>
        <Table rowKey="id" dataSource={items} columns={columns} loading={loading} pagination={{ pageSize: 20 }} />
      </Card>
      <Modal title="新增资质" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="资质名称" rules={[{ required: true, message: '请输入' }]}>
            <Input placeholder="如 医疗器械经营许可证" />
          </Form.Item>
          <Form.Item name="credential_type" label="资质类型">
            <Select>
              <Select.Option value="经营许可">经营许可</Select.Option>
              <Select.Option value="生产许可">生产许可</Select.Option>
              <Select.Option value="授权书">授权书</Select.Option>
              <Select.Option value="维修资质">维修资质</Select.Option>
              <Select.Option value="其他">其他</Select.Option>
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>提交</Button>
        </Form>
      </Modal>
    </div>
  )
}
