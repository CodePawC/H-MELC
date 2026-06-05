import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Typography, Tag } from 'antd'
import { FileProtectOutlined, SafetyCertificateOutlined, BellOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { apiRequest } from '../lib/api'
import { useAuthStore } from '../stores/authStore'

const { Title } = Typography

type WorkbenchData = {
  enroll_count: number; pending_count: number; bid_count: number
  qual_count: number; notif_unread: number
}

export function SupplierWorkbenchPage() {
  const [data, setData] = useState<WorkbenchData | null>(null)
  const [loading, setLoading] = useState(true)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    setLoading(true)
    apiRequest<WorkbenchData>('/api/v1/supplier/procurement/workbench')
      .then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>供应商工作台</Title>
      <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 13 }}>
        {user?.legal_name || user?.username} · 欢迎使用采购协同平台
      </p>
      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <Card loading={loading}><Statistic title="已报名项目" prefix={<FileProtectOutlined />} value={data?.enroll_count ?? 0} /></Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card loading={loading}><Statistic title="待审核" prefix={<CheckCircleOutlined />} value={data?.pending_count ?? 0} valueStyle={{ color: data?.pending_count ? '#f59e0b' : undefined }} /></Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card loading={loading}><Statistic title="资质文件" prefix={<SafetyCertificateOutlined />} value={data?.qual_count ?? 0} /></Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card loading={loading}><Statistic title="未读消息" prefix={<BellOutlined />} value={data?.notif_unread ?? 0} valueStyle={{ color: data?.notif_unread ? '#ef4444' : undefined }} /></Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 16 }}>
        <Title level={5}>快速操作</Title>
        <Row gutter={[12, 12]}>
          <Col span={12}><a href="/portal" style={{ display: 'block', padding: '12px 16px', background: '#f0f5ff', borderRadius: 8, color: '#1677ff' }}>查看采购公告</a></Col>
          <Col span={12}><a href="/qualifications" style={{ display: 'block', padding: '12px 16px', background: '#f0f5ff', borderRadius: 8, color: '#1677ff' }}>管理资质文件</a></Col>
        </Row>
      </Card>
    </div>
  )
}
