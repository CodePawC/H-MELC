import { useEffect, useState } from 'react'
import { Button, Card, Modal, Table, Tag, Typography, Upload, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { fetchInvoices, uploadInvoice } from '../api/supplierPortal'
import type { InvoiceItem } from '../types/supplier'
import { useAuthStore } from '../stores/authStore'

const { Title } = Typography

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const user = useAuthStore((s) => s.user)

  const load = () => {
    setLoading(true)
    fetchInvoices().then((r) => { setInvoices(r.items); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleUpload = async (file: File) => {
    if (!user) return
    setUploading(true)
    try {
      await uploadInvoice(file, user.organization_id)
      message.success('发票上传成功')
      setUploadOpen(false)
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
    return false
  }

  const columns: ColumnsType<InvoiceItem> = [
    { title: '发票编号', dataIndex: 'object_key', ellipsis: true, render: (v: string) => v.split('/').pop() },
    { title: '类型', dataIndex: 'mime_type', width: 100 },
    { title: '大小', dataIndex: 'file_size', width: 100, render: (v: number) => v ? `${(v / 1024).toFixed(1)} KB` : '-' },
    { title: '状态', dataIndex: 'ocr_review_status', width: 120, render: (v: string) => v ? <Tag>{v}</Tag> : <Tag color="default">待处理</Tag> },
    { title: '上传时间', dataIndex: 'created_at', width: 180, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>发票管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setUploadOpen(true)}>上传发票</Button>
      </div>
      <Card>
        <Table rowKey="id" dataSource={invoices} columns={columns} loading={loading} pagination={{ pageSize: 20 }} />
      </Card>
      <Modal title="上传发票" open={uploadOpen} onCancel={() => setUploadOpen(false)} footer={null}>
        <Upload.Dragger accept=".pdf,.jpg,.jpeg,.png" multiple={false} showUploadList={false} beforeUpload={handleUpload} disabled={uploading}>
          <p className="ant-upload-drag-icon"><PlusOutlined /></p>
          <p>点击或拖拽发票文件到此处</p>
          <p style={{ color: '#999' }}>支持 PDF、JPG、PNG 格式</p>
        </Upload.Dragger>
      </Modal>
    </div>
  )
}
