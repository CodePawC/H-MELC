import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Descriptions, Drawer, Empty, Input, Space, Table, Tag, Typography, message } from 'antd'
import { DatabaseOutlined, SearchOutlined } from '@ant-design/icons'

import { searchBusinessPartners, type BusinessPartnerMaster } from '../api/mdm'
import { ApiClientError } from '../lib/api'

const { Text } = Typography

type Props = {
  open: boolean
  roleType?: string
  title?: string
  value?: BusinessPartnerMaster | null
  onCancel: () => void
  onSelect: (row: BusinessPartnerMaster) => void
}

function errorMessage(error: unknown) {
  return error instanceof ApiClientError || error instanceof Error ? error.message : String(error)
}

function roleLabel(row: BusinessPartnerMaster) {
  const roles = row.roles || []
  return roles.length ? roles.map((role) => role.roleName || role.roleType).join(' / ') : '-'
}

export function BusinessPartnerSelector({ open, roleType, title, value, onCancel, onSelect }: Props) {
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<BusinessPartnerMaster[]>([])
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [degraded, setDegraded] = useState(false)
  const [selected, setSelected] = useState<BusinessPartnerMaster | null>(value ?? null)

  useEffect(() => {
    if (open) setSelected(value ?? null)
  }, [open, value])

  async function load(nextKeyword = keyword) {
    setLoading(true)
    try {
      const payload = await searchBusinessPartners({ keyword: nextKeyword, role_type: roleType, page_size: 20 })
      setItems(payload.items)
      setConnected(payload.connected)
      setDegraded(payload.degraded)
      if (!payload.items.length) message.info('未找到匹配的主数据，请检查关键词或提交主数据补充申请。')
    } catch (error) {
      setConnected(false)
      setDegraded(true)
      message.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roleType])

  const canSelect = selected?.source === 'h-mdm' && selected.enabled && selected.degraded !== true && connected && !degraded
  const drawerTitle = useMemo(() => title || `${roleType || '往来单位'}选择器`, [roleType, title])

  return (
    <Drawer
      title={drawerTitle}
      width={880}
      open={open}
      onClose={onCancel}
      extra={
        <Space>
          <Tag color={connected && !degraded ? 'green' : 'red'} icon={<DatabaseOutlined />}>
            H-UMDG {connected && !degraded ? 'connected=true' : '不可用/降级'}
          </Tag>
          <Button onClick={() => message.info('占位入口：后续接入 H-UMDG 主数据补充/修正申请流程。')}>提交主数据补充申请</Button>
          <Button type="primary" disabled={!canSelect} onClick={() => selected && onSelect(selected)}>确认选择</Button>
        </Space>
      }
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Alert
          showIcon
          type={connected && !degraded ? 'info' : 'error'}
          message={connected && !degraded ? '单位类主数据来自 H-UMDG，选择后只保存业务引用和快照。' : 'H-UMDG 主数据服务不可用，无法获取往来单位信息。'}
        />
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={() => void load()}
            placeholder="按单位名称、简称、统一社会信用代码搜索"
          />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => void load()}>
            搜索
          </Button>
        </Space.Compact>
        <Table
          size="small"
          rowKey="id"
          loading={loading}
          dataSource={items}
          locale={{ emptyText: <Empty description="未找到匹配的往来单位主数据" /> }}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: selected ? [selected.id] : [],
            onChange: (_keys, rows) => setSelected(rows[0] ?? null),
          }}
          onRow={(row) => ({ onClick: () => setSelected(row) })}
          columns={[
            { title: '单位名称', dataIndex: 'name', width: 250 },
            { title: '简称', dataIndex: 'shortName', width: 120 },
            { title: '统一社会信用代码', dataIndex: 'unifiedSocialCreditCode', width: 180 },
            { title: '角色', render: (_, row) => roleLabel(row), width: 220 },
            {
              title: '资质',
              width: 120,
              render: (_, row) => <Tag color={row.qualificationStatus === 'valid' ? 'green' : 'orange'}>{row.qualificationStatus || 'unknown'}</Tag>,
            },
            {
              title: '授权',
              width: 150,
              render: (_, row) => (
                <Space size={4} wrap>
                  {row.hasOriginalFactoryAuthorization ? <Tag color="green">原厂</Tag> : null}
                  {row.hasMaintenanceAuthorization ? <Tag color="blue">维保</Tag> : null}
                  {!row.hasOriginalFactoryAuthorization && !row.hasMaintenanceAuthorization ? <Text type="secondary">-</Text> : null}
                </Space>
              ),
            },
            { title: '来源', dataIndex: 'source', width: 90, render: (source) => <Tag color={source === 'h-mdm' ? 'green' : 'red'}>{source}</Tag> },
          ]}
          pagination={{ pageSize: 8 }}
        />
        {selected ? (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="单位编码">{selected.code}</Descriptions.Item>
            <Descriptions.Item label="主数据版本">{selected.version || '-'}</Descriptions.Item>
            <Descriptions.Item label="注册地址">{selected.registeredAddress || '-'}</Descriptions.Item>
            <Descriptions.Item label="办公地址">{selected.officeAddress || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系人电话">{selected.contactPhone || '-'}</Descriptions.Item>
            <Descriptions.Item label="外部映射">{selected.externalMappings?.length || 0} 条</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Space>
    </Drawer>
  )
}
