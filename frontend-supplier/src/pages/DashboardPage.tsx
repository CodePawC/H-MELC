import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Typography } from 'antd'
import { DollarOutlined, FileProtectOutlined, ShoppingCartOutlined, WarningOutlined } from '@ant-design/icons'
import { fetchDashboard, fetchQualifications } from '../api/supplierPortal'
import type { DashboardData } from '../types/supplier'
import { useAuthStore } from '../stores/authStore'

const { Title } = Typography

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        欢迎，{user?.legal_name || user?.username}
      </Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="未付款金额" prefix="¥" value={data?.unpaid_amount ?? 0} precision={2} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="已付款金额" prefix="¥" value={data?.paid_amount ?? 0} precision={2} valueStyle={{ color: '#22c55e' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="待审核发票" prefix={<FileProtectOutlined />} value={data?.pending_invoice_count ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="可参与项目" prefix={<ShoppingCartOutlined />} value={data?.active_projects_count ?? 0} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="缺失资质" prefix={<WarningOutlined />} value={data?.missing_material_count ?? 0} valueStyle={{ color: data?.missing_material_count ? '#f59e0b' : undefined }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="付款进度" suffix="%" value={data?.payment_progress_pct ?? 0} precision={1} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
