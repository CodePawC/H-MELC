import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Drawer, Empty, Input, Select, Space, Table, Tag, Tree, Typography, message } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { DatabaseOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'

import {
  fetchCampuses,
  fetchDepartmentTree,
  fetchDisciplineTree,
  searchDepartments,
  searchDisciplines,
  searchPersons,
  type CampusMaster,
  type DepartmentMaster,
  type DisciplineMaster,
  type MasterListPayload,
  type PersonMaster,
} from '../api/mdm'
import { ApiClientError } from '../lib/api'

const { Text } = Typography

type SelectorKind = 'department' | 'person' | 'discipline'
type MasterRecord = DepartmentMaster | PersonMaster | DisciplineMaster

type Props = {
  open: boolean
  kind: SelectorKind
  title?: string
  value?: MasterRecord | null
  departmentId?: string | null
  personType?: string
  onCancel: () => void
  onSelect: (record: MasterRecord) => void
}

function errText(error: unknown) {
  if (error instanceof ApiClientError) return error.message
  return error instanceof Error ? error.message : String(error)
}

function isDepartment(item: MasterRecord): item is DepartmentMaster {
  return 'isClinical' in item
}

function isPerson(item: MasterRecord): item is PersonMaster {
  return 'employeeNo' in item || 'departmentName' in item
}

function treeModel(items: Array<DepartmentMaster | DisciplineMaster>) {
  const toNode = (item: DepartmentMaster | DisciplineMaster): DataNode => ({
    key: item.id,
    title: `${item.name}（${item.code}）`,
    children: (item.children ?? []).map(toNode),
  })
  const byId = new Map<string, DepartmentMaster | DisciplineMaster>()
  const visit = (item: DepartmentMaster | DisciplineMaster) => {
    byId.set(item.id, item)
    ;(item.children ?? []).forEach(visit)
  }
  items.forEach(visit)
  return { nodes: items.map(toNode), byId }
}

export function OrgMasterSelector({ open, kind, title, value, departmentId, personType: fixedPersonType, onCancel, onSelect }: Props) {
  const [keyword, setKeyword] = useState('')
  const [campuses, setCampuses] = useState<CampusMaster[]>([])
  const [campusId, setCampusId] = useState<string | undefined>()
  const [departmentType, setDepartmentType] = useState<string | undefined>()
  const [personType, setPersonType] = useState<string | undefined>()
  const [payload, setPayload] = useState<MasterListPayload<MasterRecord> | null>(null)
  const [treeItems, setTreeItems] = useState<Array<DepartmentMaster | DisciplineMaster>>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [treeLoading, setTreeLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connected = payload?.connected === true && payload?.source === 'h-mdm' && payload?.degraded === false
  const model = useMemo(() => treeModel(treeItems), [treeItems])
  const isTreeKind = kind === 'department' || kind === 'discipline'

  async function loadCampuses() {
    try {
      const result = await fetchCampuses({ page_size: 50 })
      setCampuses(result.items)
    } catch {
      setCampuses([])
    }
  }

  async function load(nextPage = page, nextKeyword = keyword) {
    setLoading(true)
    setError(null)
    try {
      let result: MasterListPayload<MasterRecord>
      if (kind === 'department') {
        result = await searchDepartments({ keyword: nextKeyword, campus_id: campusId, department_type: departmentType, page: nextPage, page_size: 10 })
      } else if (kind === 'person') {
        result = await searchPersons({ keyword: nextKeyword, department_id: departmentId ?? undefined, campus_id: campusId, person_type: fixedPersonType ?? personType, page: nextPage, page_size: 10 })
      } else {
        result = await searchDisciplines({ keyword: nextKeyword, page: nextPage, page_size: 10 })
      }
      setPayload(result)
      setPage(result.page)
      if (result.degraded) setError('H-UMDG 主数据服务不可用，无法获取科室/人员/学科信息。')
    } catch (e) {
      setPayload(null)
      setError(errText(e))
    } finally {
      setLoading(false)
    }
  }

  async function loadTree() {
    if (!isTreeKind) return
    setTreeLoading(true)
    try {
      const result = kind === 'department'
        ? await fetchDepartmentTree({ campus_id: campusId })
        : await fetchDisciplineTree()
      setTreeItems(result.items)
    } catch {
      setTreeItems([])
    } finally {
      setTreeLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void loadCampuses()
    void load(1)
    void loadTree()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind])

  function choose(row: MasterRecord) {
    if (!connected || payload?.degraded || row.source !== 'h-mdm') {
      message.warning('H-UMDG 主数据服务不可用，无法保存正式主数据引用。')
      return
    }
    if (!row.enabled) {
      message.warning('该主数据已停用，不能绑定到业务档案。')
      return
    }
    onSelect(row)
  }

  const tableColumns = [
    { title: '编码', dataIndex: 'code', width: 132, render: (v: string) => <Text code>{v}</Text> },
    { title: '名称', dataIndex: 'name', width: 160 },
    {
      title: kind === 'person' ? '所属科室' : kind === 'department' ? '院区/类型' : '关联科室',
      render: (_: unknown, row: MasterRecord) => {
        if (isPerson(row)) return row.departmentName || '—'
        if (isDepartment(row)) return `${row.campusName || '—'} / ${row.type || '—'}`
        return row.relatedDepartments?.map((item) => String(item.departmentName ?? '')).filter(Boolean).join('、') || '—'
      },
    },
    {
      title: '属性',
      width: 160,
      render: (_: unknown, row: MasterRecord) => {
        if (isPerson(row)) return <Tag color="blue">{row.type || row.position || '在职人员'}</Tag>
        if (isDepartment(row)) return <Tag color={row.isClinical ? 'green' : 'blue'}>{row.type || '科室'}</Tag>
        return row.isKeyDiscipline ? <Tag color="red">重点学科</Tag> : <Tag>{row.type || '学科'}</Tag>
      },
    },
    { title: '来源', dataIndex: 'source', width: 90, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '版本', dataIndex: 'version', width: 150, render: (v?: string) => v || '—' },
    {
      title: '操作',
      width: 88,
      fixed: 'right' as const,
      render: (_: unknown, row: MasterRecord) => (
        <Button size="small" type="primary" disabled={!connected || !row.enabled} onClick={() => choose(row)}>
          选择
        </Button>
      ),
    },
  ]

  return (
    <Drawer
      title={title ?? (kind === 'department' ? '选择 H-UMDG 科室主数据' : kind === 'person' ? '选择 H-UMDG 人员主数据' : '选择 H-UMDG 学科主数据')}
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
          message={error ?? '数据来源 h-mdm；编码和名称不可手工修改，找不到数据时请提交主数据补充/修正申请。'}
        />
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={kind === 'person' ? '姓名 / 工号搜索' : '名称 / 编码 / 关键词搜索'}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={() => void load(1)}
            style={{ width: 260 }}
          />
          {kind !== 'discipline' ? (
            <Select
              allowClear
              placeholder="按院区筛选"
              value={campusId}
              onChange={setCampusId}
              options={campuses.map((item) => ({ value: item.id, label: item.name }))}
              style={{ width: 180 }}
            />
          ) : null}
          {kind === 'department' ? (
            <Select
              allowClear
              placeholder="科室类型"
              value={departmentType}
              onChange={setDepartmentType}
              options={['临床科室', '医技科室', '护理单元', '行政职能科室', '后勤保障科室', '平台中心', '虚拟科室', '外部协作科室'].map((item) => ({ value: item, label: item }))}
              style={{ width: 180 }}
            />
          ) : null}
          {kind === 'person' && !fixedPersonType ? (
            <Select
              allowClear
              placeholder="人员类型"
              value={personType}
              onChange={setPersonType}
              options={['医生', '护士', '医技', '行政', '后勤', '设备工程师', '信息工程师', '外聘人员', '第三方维保人员'].map((item) => ({ value: item, label: item }))}
              style={{ width: 180 }}
            />
          ) : null}
          {kind === 'person' && fixedPersonType ? <Tag color="blue">人员类型：{fixedPersonType}</Tag> : null}
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => void load(1)}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={() => {
            setKeyword('')
            setCampusId(undefined)
            setDepartmentType(undefined)
            setPersonType(undefined)
            void load(1, '')
            void loadTree()
          }}>重置</Button>
          {value ? <Tag color="green">当前：{value.name}（{value.code}）</Tag> : null}
        </Space>

        <div style={{ display: 'grid', gridTemplateColumns: isTreeKind ? '280px minmax(0, 1fr)' : '1fr', gap: 16 }}>
          {isTreeKind ? (
            <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, minHeight: 420 }}>
              <Space align="center" style={{ marginBottom: 10 }}>
                <DatabaseOutlined />
                <Text strong>{kind === 'department' ? '科室树' : '学科树'}</Text>
                <Button size="small" loading={treeLoading} onClick={() => void loadTree()}>刷新</Button>
              </Space>
              {model.nodes.length ? (
                <Tree
                  height={360}
                  treeData={model.nodes}
                  onSelect={(keys) => {
                    const item = model.byId.get(String(keys[0] ?? ''))
                    if (item) {
                      setKeyword(item.name)
                      void load(1, item.name)
                    }
                  }}
                />
              ) : (
                <Empty description="暂无树形数据" />
              )}
            </section>
          ) : null}

          <Table<MasterRecord>
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
                <Empty description="未找到匹配的主数据，请检查关键词或提交主数据补充申请。">
                  <Button onClick={() => message.info('提交主数据补充/修正申请流程将在 H-UMDG 申请中心接入。')}>
                    提交主数据补充/修正申请
                  </Button>
                </Empty>
              ),
            }}
            columns={tableColumns}
          />
        </div>
      </Space>
    </Drawer>
  )
}
