import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Form, Input, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ApiOutlined, CloudSyncOutlined, DatabaseOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'

import {
  createEquipmentNameRequest,
  createManufacturerVendorRequest,
  fetchHmdmCacheStatus,
  fetchHmdmEquipmentCategories,
  fetchHmdmStatus,
  refreshHmdmCache,
  searchHmdmEquipmentNames,
  searchHmdmManufacturerVendors,
  type HmdmCacheStatusPayload,
  type HmdmStatusPayload,
} from '../api/hmdm'
import { ApiClientError } from '../lib/api'

const { Paragraph, Text, Title } = Typography

function toRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>
    const data = p.data
    if (Array.isArray(data)) return data.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).items)) {
      return ((data as Record<string, unknown>).items as unknown[]).filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    }
    if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).records)) {
      return ((data as Record<string, unknown>).records as unknown[]).filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    }
    if (Array.isArray(p.items)) return p.items.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    if (Array.isArray(p.records)) return p.records.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
  }
  return []
}

function valueText(value: unknown) {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.join('、')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function HmdmIntegrationPage() {
  const [status, setStatus] = useState<HmdmStatusPayload | null>(null)
  const [cache, setCache] = useState<HmdmCacheStatusPayload | null>(null)
  const [categoryRows, setCategoryRows] = useState<Record<string, unknown>[]>([])
  const [equipmentRows, setEquipmentRows] = useState<Record<string, unknown>[]>([])
  const [vendorRows, setVendorRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [equipForm] = Form.useForm()
  const [vendorForm] = Form.useForm()

  const reload = async () => {
    setLoading(true)
    try {
      const [statusData, cacheData] = await Promise.all([fetchHmdmStatus(), fetchHmdmCacheStatus()])
      setStatus(statusData)
      setCache(cacheData)
      setNotice(null)
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const cacheRows = useMemo(() => {
    const counts = cache?.counts ?? {}
    return Object.entries(counts).map(([sourceType, count]) => ({ sourceType, count }))
  }, [cache])

  const commonColumns: ColumnsType<Record<string, unknown>> = [
    { title: '编码', dataIndex: 'code', width: 180, render: (_, row) => valueText(row.category_code ?? row.equipment_name_code ?? row.organization_code ?? row.code ?? row.id) },
    { title: '名称', dataIndex: 'name', width: 240, render: (_, row) => valueText(row.category_name ?? row.standard_name ?? row.name ?? row.source_name) },
    { title: '摘要', render: (_, row) => <Text type="secondary">{valueText(row.management_class ?? row.managementClass ?? row.roles ?? row.status ?? row.parent_code)}</Text> },
  ]

  return (
    <div className="page hmdm-page">
      <div className="master-data-source-page__hero">
        <div>
          <Text className="master-data-source-page__eyebrow">External Master Data</Text>
          <Title level={2}>H-UMDG 外部主数据接入</Title>
          <Paragraph>
            H-UMDG 是另一个系统，负责设备分类、标准名称、监管属性和厂商机构标准身份。本平台只调用、引用、缓存和提交候选申请，不维护权威库。
          </Paragraph>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={reload}>刷新状态</Button>
          <Button
            type="primary"
            icon={<CloudSyncOutlined />}
            onClick={async () => {
              try {
                await refreshHmdmCache()
                message.success('已提交缓存刷新')
                await reload()
              } catch (e) {
                message.error(e instanceof Error ? e.message : String(e))
              }
            }}
          >
            手动刷新缓存
          </Button>
        </Space>
      </div>

      <Alert
        showIcon
        type={notice ? 'warning' : 'info'}
        message="边界提醒：H-MELC 不建设第二个 H-UMDG"
        description={notice ?? '设备分类、设备标准名称、医疗器械分类目录和厂商机构标准身份均以 H-UMDG 为权威来源；本页面用于联调、缓存观察和候选申请。'}
        style={{ marginBottom: 16 }}
      />

      <div className="master-data-source-page__stats">
        <div><span>连接状态</span><strong>{status?.connected ? '已连接' : '未连接'}</strong></div>
        <div><span>API Key</span><strong>{status?.api_key_configured ? '已配置' : '未配置'}</strong></div>
        <div><span>缓存</span><strong>{cache?.cache_enabled ? '启用' : '关闭'}</strong></div>
        <div><span>过期缓存</span><strong>{cache?.expired_count ?? 0}</strong></div>
        <div><span>TTL</span><strong>{cache?.ttl_seconds ?? 0}s</strong></div>
      </div>

      <Tabs
        items={[
          {
            key: 'status',
            label: '接入状态',
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card size="small" title={<><ApiOutlined /> H-UMDG 配置</>}>
                  <p>地址：<Text code>{status?.hmdm_base_url || '未配置'}</Text></p>
                  <p>最近成功调用：{status?.last_success_at ?? '—'}</p>
                  <p>最近失败原因：{status?.last_failure_reason ?? '—'}</p>
                </Card>
                <Card size="small" title={<><DatabaseOutlined /> 字典缓存</>}>
                  <Table
                    size="small"
                    rowKey="sourceType"
                    pagination={false}
                    dataSource={cacheRows}
                    columns={[
                      { title: '来源类型', dataIndex: 'sourceType' },
                      { title: '数量', dataIndex: 'count', width: 120 },
                    ]}
                  />
                </Card>
              </Space>
            ),
          },
          {
            key: 'dictionary',
            label: '装备字典',
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Button onClick={async () => {
                  const data = await fetchHmdmEquipmentCategories()
                  setCategoryRows(toRows(data.payload))
                }}>加载设备分类树</Button>
                <Form layout="inline" onFinish={async (v) => {
                  const data = await searchHmdmEquipmentNames(v.keyword ?? '', v.category_id)
                  setEquipmentRows(toRows(data.payload))
                }}>
                  <Form.Item name="keyword"><Input placeholder="标准名称/别名/关键词" /></Form.Item>
                  <Form.Item name="category_id"><Input placeholder="分类编码" /></Form.Item>
                  <Button type="primary" htmlType="submit">查询标准名称</Button>
                </Form>
                <Table size="small" rowKey={(row) => String(row.category_code ?? row.equipment_name_code ?? Math.random())} dataSource={[...categoryRows, ...equipmentRows]} columns={commonColumns} />
              </Space>
            ),
          },
          {
            key: 'vendors',
            label: '厂商机构',
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Form layout="inline" onFinish={async (v) => {
                  const data = await searchHmdmManufacturerVendors(v.keyword ?? '', v.role_type)
                  setVendorRows(toRows(data.payload))
                }}>
                  <Form.Item name="keyword"><Input placeholder="名称/简称/英文名/信用代码" /></Form.Item>
                  <Form.Item name="role_type">
                    <Select style={{ width: 160 }} allowClear placeholder="角色">
                      <Select.Option value="manufacturer">生产厂家</Select.Option>
                      <Select.Option value="supplier">供应商</Select.Option>
                      <Select.Option value="after_sales">售后服务商</Select.Option>
                    </Select>
                  </Form.Item>
                  <Button type="primary" htmlType="submit">查询厂商</Button>
                </Form>
                <Table size="small" rowKey={(row) => String(row.organization_code ?? Math.random())} dataSource={vendorRows} columns={commonColumns} />
              </Space>
            ),
          },
          {
            key: 'requests',
            label: '候选申请',
            children: (
              <div className="master-data-source-page__stats" style={{ alignItems: 'flex-start' }}>
                <Card title="申请新增设备标准名称" style={{ flex: 1 }}>
                  <Form form={equipForm} layout="vertical" onFinish={async (v) => {
                    await createEquipmentNameRequest({ ...v, alias_names: v.alias_names ? String(v.alias_names).split(/[，,]/).map((x) => x.trim()).filter(Boolean) : [] })
                    message.success('设备标准名称候选申请已提交')
                    equipForm.resetFields()
                  }}>
                    <Form.Item name="proposed_name" label="申请名称" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="alias_names" label="别名"><Input /></Form.Item>
                    <Form.Item name="suggested_category" label="建议分类"><Input /></Form.Item>
                    <Form.Item name="reason" label="申请原因" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>提交申请</Button>
                  </Form>
                </Card>
                <Card title="申请新增厂商机构" style={{ flex: 1 }}>
                  <Form form={vendorForm} layout="vertical" onFinish={async (v) => {
                    await createManufacturerVendorRequest({ ...v, alias_names: v.alias_names ? String(v.alias_names).split(/[，,]/).map((x) => x.trim()).filter(Boolean) : [] })
                    message.success('厂商机构候选申请已提交')
                    vendorForm.resetFields()
                  }}>
                    <Form.Item name="proposed_standard_name" label="申请厂商名称" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="english_name" label="英文名"><Input /></Form.Item>
                    <Form.Item name="short_name" label="简称"><Input /></Form.Item>
                    <Form.Item name="unified_social_credit_code" label="统一社会信用代码"><Input /></Form.Item>
                    <Form.Item name="suggested_role_type" label="建议角色"><Input /></Form.Item>
                    <Form.Item name="business_domain" label="业务领域"><Input /></Form.Item>
                    <Form.Item name="reason" label="申请原因" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>提交申请</Button>
                  </Form>
                </Card>
              </div>
            ),
          },
        ]}
      />

      <Space wrap style={{ marginTop: 12 }}>
        <Tag color="purple">H-UMDG 权威</Tag>
        <Tag color="blue">H-MELC 引用快照</Tag>
        <Tag color="gold">缓存仅只读降级</Tag>
      </Space>
    </div>
  )
}
