import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Drawer, Empty, Input, Space, Table, Tag, Tree, Typography, message } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { DatabaseOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'

import {
  fetchDeviceCategories,
  fetchDeviceCategoryTree,
  type DeviceCategory,
  type DeviceCategoryListPayload,
} from '../api/mdm'
import { ApiClientError } from '../lib/api'

const { Text } = Typography

type Props = {
  open: boolean
  value?: DeviceCategory | null
  onCancel: () => void
  onSelect: (category: DeviceCategory) => void
}

function errText(error: unknown) {
  if (error instanceof ApiClientError) return error.message
  return error instanceof Error ? error.message : String(error)
}

type CategoryTreeModel = {
  nodes: DataNode[]
  byKey: Map<string, DeviceCategory>
}

function categoryTreeModel(items: DeviceCategory[]): CategoryTreeModel {
  const roots: DataNode[] = []
  const nodesByKey = new Map<string, DataNode & { children?: DataNode[] }>()
  const itemByKey = new Map<string, DeviceCategory>()

  items.forEach((item) => {
    const segments = (item.path || item.name)
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
    const pathSegments = segments.length ? segments : [item.name]
    let children = roots
    const accumulated: string[] = []

    pathSegments.forEach((segment, index) => {
      accumulated.push(segment)
      const key = `path:${accumulated.join(' / ')}`
      let node = nodesByKey.get(key)
      if (!node) {
        node = {
          key,
          title: index === pathSegments.length - 1 && item.code ? `${segment}（${item.code}）` : segment,
          children: [],
        }
        nodesByKey.set(key, node)
        children.push(node)
      }
      if (index === pathSegments.length - 1) {
        itemByKey.set(key, item)
      }
      children = node.children ?? []
    })
  })

  const clean = (nodes: DataNode[]): DataNode[] =>
    nodes.map((node) => {
      const children = Array.isArray(node.children) ? clean(node.children) : []
      return children.length ? { ...node, children } : { key: node.key, title: node.title }
    })

  return { nodes: clean(roots), byKey: itemByKey }
}

export function DeviceCategorySelector({ open, value, onCancel, onSelect }: Props) {
  const [keyword, setKeyword] = useState('')
  const [code, setCode] = useState('')
  const [page, setPage] = useState(1)
  const [payload, setPayload] = useState<DeviceCategoryListPayload | null>(null)
  const [treeItems, setTreeItems] = useState<DeviceCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [treeLoading, setTreeLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connected = payload?.connected === true && payload?.source === 'h-mdm' && payload?.degraded === false
  const treeModel = useMemo(() => categoryTreeModel(treeItems), [treeItems])

  async function load(nextPage = page, nextKeyword = keyword, nextCode = code) {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchDeviceCategories({
        keyword: nextKeyword,
        code: nextCode,
        page: nextPage,
        page_size: 10,
      })
      setPayload(result)
      setPage(result.page)
      if (result.degraded) {
        setError('H-UMDG 主数据服务暂不可用，无法获取医疗器械分类目录，请稍后重试或联系管理员。')
      }
    } catch (e) {
      setPayload(null)
      setError(errText(e))
    } finally {
      setLoading(false)
    }
  }

  async function loadTree() {
    setTreeLoading(true)
    try {
      const result = await fetchDeviceCategoryTree()
      setTreeItems(result.items)
    } catch {
      setTreeItems([])
    } finally {
      setTreeLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void load(1)
    void loadTree()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function choose(row: DeviceCategory) {
    if (!connected || payload?.degraded || row.source !== 'h-mdm') {
      message.warning('H-UMDG 主数据服务暂不可用，无法保存正式分类引用。')
      return
    }
    if (!row.enabled) {
      message.warning('该分类目录未启用，不能绑定到设备档案。')
      return
    }
    onSelect(row)
  }

  return (
    <Drawer
      title="选择 H-UMDG 医疗器械分类目录"
      width={980}
      open={open}
      onClose={onCancel}
      destroyOnHidden
      extra={
        <Space>
          <Tag color={connected ? 'green' : 'red'}>{connected ? 'connected=true' : 'connected=false'}</Tag>
          <Tag color={payload?.degraded ? 'red' : 'blue'}>source={payload?.source ?? 'h-mdm'}</Tag>
        </Space>
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          showIcon
          type={error ? 'error' : 'info'}
          message={error ?? '数据来源 h-mdm；connected=true 且 degraded=false 时才允许保存为正式主数据引用。'}
        />
        <Space wrap style={{ width: '100%' }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="分类名称 / 关键词模糊搜索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={() => void load(1)}
            style={{ width: 260 }}
          />
          <Input
            allowClear
            placeholder="分类编码搜索"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onPressEnter={() => void load(1)}
            style={{ width: 220 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => void load(1)} loading={loading}>
            搜索
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setKeyword('')
              setCode('')
              void load(1, '', '')
            }}
          >
            重置
          </Button>
          {value ? <Tag color="green">当前：{value.name}（{value.code}）</Tag> : null}
        </Space>

        <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 16 }}>
          <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, minHeight: 420 }}>
            <Space align="center" style={{ marginBottom: 10 }}>
              <DatabaseOutlined />
              <Text strong>目录树浏览</Text>
              <Button size="small" onClick={() => void loadTree()} loading={treeLoading}>
                刷新
              </Button>
            </Space>
            {treeModel.nodes.length ? (
              <Tree
                height={360}
                treeData={treeModel.nodes}
                onSelect={(keys) => {
                  const id = String(keys[0] ?? '')
                  const item = treeModel.byKey.get(id)
                  if (item) {
                    setKeyword(item.name)
                    setCode(item.code)
                    void load(1, item.name, item.code)
                  }
                }}
              />
            ) : (
              <Empty description="暂无目录树数据" />
            )}
          </section>

          <Table<DeviceCategory>
            size="small"
            rowKey="id"
            loading={loading}
            dataSource={payload?.items ?? []}
            pagination={{
              current: payload?.page ?? page,
              pageSize: payload?.page_size ?? 10,
              total: payload?.total ?? 0,
              showSizeChanger: false,
              onChange: (next) => void load(next),
              showTotal: (total) => `共 ${total} 条`,
            }}
            locale={{
              emptyText: (
                <Empty description="未找到匹配的医疗器械分类目录。">
                  <Button onClick={() => message.info('提交主数据补充申请流程将在 H-UMDG 申请中心接入。')}>
                    提交主数据补充申请
                  </Button>
                </Empty>
              ),
            }}
            columns={[
              { title: '分类编码', dataIndex: 'code', width: 130, render: (v: string) => <Text code>{v}</Text> },
              { title: '分类名称', dataIndex: 'name', width: 180 },
              { title: '完整分类路径', dataIndex: 'path', ellipsis: true },
              { title: '管理类别', dataIndex: 'managementClass', width: 90, render: (v?: string) => v || '—' },
              { title: '主数据版本', dataIndex: 'version', width: 160, render: (v?: string) => v || '—' },
              { title: '来源', dataIndex: 'source', width: 90, render: (v: string) => <Tag color="blue">{v}</Tag> },
              {
                title: '操作',
                width: 92,
                fixed: 'right',
                render: (_, row) => (
                  <Button size="small" type="primary" disabled={!connected || !row.enabled} onClick={() => choose(row)}>
                    选择
                  </Button>
                ),
              },
            ]}
          />
        </div>
      </Space>
    </Drawer>
  )
}
