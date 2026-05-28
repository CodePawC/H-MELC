import { useEffect, useState } from 'react'
import { Alert, Card, Col, Descriptions, Progress, Row, Skeleton, Statistic, Typography } from 'antd'
import { FileTextOutlined, PayCircleOutlined, ProjectOutlined, SafetyCertificateOutlined, ShopOutlined } from '@ant-design/icons'

import { dataScopeHint } from '../../auth/permission'
import { fetchSupplierPortalDashboard } from '../../api/supplierPortal'
import type { SupplierPortalDashboard } from '../../api/supplierPortal'
import { ApiClientError } from '../../lib/api'
import { useAuthSession } from '../../stores/authSession'

const { Title, Paragraph, Text } = Typography

function money(v?: number) {
  return `¥${(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function PortalHomePage() {
  const me = useAuthSession((s) => s.me)
  const [data, setData] = useState<SupplierPortalDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setErr(null)
    void (async () => {
      try {
        const res = await fetchSupplierPortalDashboard()
        if (!cancel) setData(res)
      } catch (e) {
        if (!cancel) {
          setErr(e instanceof ApiClientError ? e.message : String(e))
          setData(null)
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  return (
    <div>
      <Title level={4} style={{ marginTop: 0 }}>
        供应商协同门户
      </Title>
      <Paragraph type="secondary">{dataScopeHint(me?.dataScope, me?.portalOnly)}</Paragraph>
      {err ? <Alert showIcon type="warning" message="门户汇总暂不可用" description={err} style={{ marginBottom: 16 }} /> : null}

      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false}>
              <Statistic title="待审发票" value={data?.pending_invoice_count ?? 0} prefix={<FileTextOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false}>
              <Statistic title="待补材料" value={data?.missing_material_count ?? 0} prefix={<SafetyCertificateOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false}>
              <Statistic title="参与项目" value={data?.active_projects_count ?? 0} prefix={<ProjectOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false}>
              <Statistic title="付款进度" value={data?.payment_progress_pct ?? 0} suffix="%" prefix={<PayCircleOutlined />} />
            </Card>
          </Col>

          <Col xs={24} lg={14}>
            <Card title="款项概览" bordered={false}>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Statistic title="未付余额" value={money(data?.unpaid_amount)} valueStyle={{ color: '#cf1322' }} />
                </Col>
                <Col xs={24} sm={12}>
                  <Statistic title="累计已付" value={money(data?.paid_amount)} valueStyle={{ color: '#1677ff' }} />
                </Col>
                <Col span={24}>
                  <Progress percent={data?.payment_progress_pct ?? 0} status="active" />
                  <Text type="secondary">按本供应商应付与付款流水计算。</Text>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card title="企业信息" bordered={false}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="供应商编码">{me?.supplierId ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="登录账号">{me?.username ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="联系人">{me?.displayName ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="手机">{me?.phone ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="门户角色">
                  <ShopOutlined /> {me?.roles?.join(', ') || '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  )
}
