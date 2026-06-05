import { useEffect, useState } from 'react'
import { Button, Card, Col, Input, Row, Select, Tag, Typography, Spin, message } from 'antd'
import { SearchOutlined, CalendarOutlined, BankOutlined } from '@ant-design/icons'
import { apiRequest } from '../lib/api'

const { Title, Text } = Typography

type ProjectItem = {
  id: string; project_code: string; title: string; category: string
  procurement_method: string; budget_amount: number | null; status: string
  department_name: string; content: string; summary: string
  tech_params: string; config_list: string; service_requirements: string
  qualification_requirements: string; delivery_requirements: string
  acceptance_requirements: string
  registration_start: string | null; registration_end: string | null
  created_at: string; publish_at: string | null
}

const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: 'blue', REGISTERING: 'cyan', QUALIFYING: 'geekblue',
  BIDDING: 'volcano', EVALUATING: 'gold', AWARDED: 'green',
}

const API = ''

export function ProcurementPortalPage() {
  const [items, setItems] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<ProjectItem | null>(null)
  const [category, setCategory] = useState('')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    setLoading(true)
    const sp = new URLSearchParams()
    if (category) sp.set('category', category)
    if (keyword) sp.set('keyword', keyword)
    fetch(`${API}/api/v1/procurement-portal/projects?${sp}`)
      .then(r => r.json()).then(d => setItems(d.data?.items || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [category, keyword])

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <header style={{ background: '#fff', padding: '24px 48px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h1 style={{ fontSize: 24, margin: 0 }}><BankOutlined style={{ marginRight: 8 }} />五莲县人民医院采购协同门户</h1>
          <p style={{ color: '#6b7280', marginTop: 8, fontSize: 13 }}>
            本平台用于医院采购项目对外协同、供应商报名、资料提交和沟通留痕。
            达到政府采购或公共资源交易要求的项目，应按相关法律法规执行。
          </p>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        <Card style={{ marginBottom: 24 }} bodyStyle={{ padding: 16 }}>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Input prefix={<SearchOutlined />} placeholder="搜索项目名称、编号" allowClear
                onChange={e => setKeyword(e.target.value)} />
            </Col>
            <Col><Select value={category} onChange={setCategory} style={{ width: 150 }}
              options={[
                { value: '', label: '全部类别' },
                { value: '设备', label: '设备' },
                { value: '耗材', label: '耗材' },
                { value: '服务', label: '服务' },
                { value: '工程', label: '工程' },
                { value: '信息化', label: '信息化' },
              ]} /></Col>
          </Row>
        </Card>

        {loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div> : (
          <Row gutter={[16, 16]}>
            {items.map(item => (
              <Col xs={24} sm={12} lg={8} key={item.id}>
                <Card hoverable onClick={() => setDetail(item)} bodyStyle={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Tag color={STATUS_COLORS[item.status] || 'default'}>{item.status}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.category}</Text>
                  </div>
                  <Title level={5} style={{ margin: '0 0 8px' }}>{item.title}</Title>
                  <Text type="secondary" style={{ fontSize: 13 }}>{item.summary || item.content?.slice(0, 60)}</Text>
                  <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
                    <div><CalendarOutlined style={{ marginRight: 4 }} />报名截止：{item.registration_end ? new Date(item.registration_end).toLocaleDateString('zh-CN') : '-'}</div>
                    <div style={{ marginTop: 4 }}>预算：{item.budget_amount ? `¥${item.budget_amount.toLocaleString()}` : '-'}</div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>

      {detail && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, overflow: 'auto', padding: 48 }}
          onClick={() => setDetail(null)}>
          <Card style={{ maxWidth: 800, margin: '0 auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <Title level={4} style={{ margin: 0 }}>{detail.title}</Title>
                <Text type="secondary">编号：{detail.project_code || '-'} | 类别：{detail.category}</Text>
              </div>
              <Tag color={STATUS_COLORS[detail.status] || 'default'} style={{ fontSize: 14, padding: '4px 12px' }}>{detail.status}</Tag>
            </div>

            <Card size="small" style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                <Col span={8}>采购方式：{detail.procurement_method || '-'}</Col>
                <Col span={8}>预算：{detail.budget_amount ? `¥${detail.budget_amount.toLocaleString()}` : '-'}</Col>
                <Col span={8}>使用科室：{detail.department_name || '-'}</Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>报名开始：{detail.registration_start ? new Date(detail.registration_start).toLocaleString('zh-CN') : '-'}</Col>
                <Col span={12}>报名截止：{detail.registration_end ? new Date(detail.registration_end).toLocaleString('zh-CN') : '-'}</Col>
              </Row>
            </Card>

            {detail.content && <Card size="small" title="采购内容" style={{ marginBottom: 12 }}><pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{detail.content}</pre></Card>}
            {detail.tech_params && <Card size="small" title="技术参数" style={{ marginBottom: 12 }}><pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{detail.tech_params}</pre></Card>}
            {detail.qualification_requirements && <Card size="small" title="供应商资质要求" style={{ marginBottom: 12 }}><pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{detail.qualification_requirements}</pre></Card>}
            {detail.config_list && <Card size="small" title="配置清单" style={{ marginBottom: 12 }}><pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{detail.config_list}</pre></Card>}
            {detail.service_requirements && <Card size="small" title="售后服务要求" style={{ marginBottom: 12 }}><pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{detail.service_requirements}</pre></Card>}

            <div style={{ background: '#f0f5ff', padding: 16, borderRadius: 8, marginTop: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                如需报名或咨询，请联系医院采购中心。本平台不替代法定政府采购流程。
              </Text>
            </div>
            <Button type="primary" size="large" style={{ marginTop: 16 }} disabled>
              我要报名（需登录供应商账号）
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}
