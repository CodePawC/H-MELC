import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Input,
  Space,
  Statistic,
  Tag,
  Tooltip,
} from 'antd'
import type { ProColumns, ProTableProps } from '@ant-design/pro-components'
import { ProCard, ProTable } from '@ant-design/pro-components'
import {
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FilterOutlined,
  HistoryOutlined,
  ToolOutlined,
} from '@ant-design/icons'

import { fetchRepairs } from '../api/repairs'
import type { RepairListQueryParams, RepairRow } from '../api/repairs'
import { PageScaffold } from '../components/hospital/PageScaffold'
import { ApiClientError } from '../lib/api'

type WorkbenchMode = 'process' | 'accept' | 'history' | 'fault'

type QueryForm = {
  order_status?: string
  asset_id?: string
  department_id?: string
  assigned_engineer_id?: string
  priority?: string
  date_range?: [string, string]
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PENDING_DISPATCH: { text: '待派单', color: 'default' },
  ASSIGNED: { text: '已指派', color: 'blue' },
  IN_PROGRESS: { text: '维修中', color: 'processing' },
  AWAIT_CONFIRM: { text: '待验收', color: 'gold' },
  CLOSED: { text: '已关闭', color: 'green' },
  PENDING_ASSIGN: { text: '待派工', color: 'default' },
  PROCESSING: { text: '处理中', color: 'processing' },
  PENDING_ACCEPT: { text: '待验收', color: 'gold' },
  DONE: { text: '已完成', color: 'green' },
  TIMEOUT: { text: '已超时', color: 'red' },
}

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: 'red',
  MEDIUM: 'orange',
  LOW: 'default',
  CRITICAL: 'volcano',
  高: 'red',
  中: 'orange',
  低: 'default',
}

const MODE_META: Record<
  WorkbenchMode,
  {
    title: string
    description: string
    icon: ReactNode
    defaultStatus?: string
    statusOptions: { label: string; value: string }[]
  }
> = {
  process: {
    title: '维修处理',
    description: '聚焦已派工与维修中的工单，支持工程师快速进入记录过程、完工与外修返厂动作。',
    icon: <ToolOutlined />,
    defaultStatus: 'IN_PROGRESS',
    statusOptions: [
      { label: '维修中', value: 'IN_PROGRESS' },
      { label: '已指派', value: 'ASSIGNED' },
      { label: '待派单', value: 'PENDING_DISPATCH' },
      { label: '全部未闭环', value: '__OPEN__' },
    ],
  },
  accept: {
    title: '维修验收',
    description: '聚焦待科室确认与待验收工单，帮助临床和设备科完成最后闭环。',
    icon: <CheckCircleOutlined />,
    defaultStatus: 'AWAIT_CONFIRM',
    statusOptions: [
      { label: '待科室确认', value: 'AWAIT_CONFIRM' },
      { label: '待验收', value: 'PENDING_ACCEPT' },
      { label: '已完成', value: 'DONE' },
      { label: '全部', value: '__ALL__' },
    ],
  },
  history: {
    title: '维修记录',
    description: '按时间、设备、工程师追溯维修历史，用于质控复盘、成本归集与设备健康评分。',
    icon: <HistoryOutlined />,
    defaultStatus: '__ALL__',
    statusOptions: [
      { label: '全部', value: '__ALL__' },
      { label: '已关闭', value: 'CLOSED' },
      { label: '已完成', value: 'DONE' },
      { label: '维修中', value: 'IN_PROGRESS' },
    ],
  },
  fault: {
    title: '故障分析',
    description: '从维修工单沉淀故障模式、优先级与未闭环风险，为知识中心和 PM 策略提供输入。',
    icon: <BarChartOutlined />,
    defaultStatus: '__OPEN__',
    statusOptions: [
      { label: '全部未闭环', value: '__OPEN__' },
      { label: '维修中', value: 'IN_PROGRESS' },
      { label: '待验收', value: 'AWAIT_CONFIRM' },
      { label: '全部', value: '__ALL__' },
    ],
  },
}

function statusTag(status: string) {
  const s = STATUS_LABEL[status] ?? { text: status, color: 'default' }
  return <Tag color={s.color}>{s.text}</Tag>
}

function priorityTag(priority?: string | null) {
  if (!priority) return <span style={{ color: '#9ca3af' }}>-</span>
  return <Tag color={PRIORITY_COLOR[priority] ?? 'default'}>{priority}</Tag>
}

function shortId(id?: string | null) {
  return id ? `${id.slice(0, 8)}...` : '-'
}

function fmtDate(s?: string | null) {
  return s ? s.replace('T', ' ').slice(0, 19) : '-'
}

function countBy(items: RepairRow[], predicate: (row: RepairRow) => boolean) {
  return items.filter(predicate).length
}

function normalizeStatusForQuery(status?: string) {
  if (!status || status === '__ALL__' || status === '__OPEN__') return undefined
  return status
}

export function RepairWorkbenchPage({ mode }: { mode: WorkbenchMode }) {
  const meta = MODE_META[mode]
  const [snapshot, setSnapshot] = useState<RepairRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const columns = useMemo<ProColumns<RepairRow>[]>(
    () => [
      {
        title: '工单号',
        dataIndex: 'order_code',
        width: 150,
        fixed: 'left',
        copyable: true,
        render: (_, row) => (
          <Link className="link-inline" to={`/repair/tickets/${row.id}`}>
            {row.order_code}
          </Link>
        ),
      },
      {
        title: '状态',
        dataIndex: 'order_status',
        width: 110,
        valueType: 'select',
        initialValue: meta.defaultStatus,
        fieldProps: {
          options: meta.statusOptions,
        },
        render: (_, row) => statusTag(row.order_status),
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        width: 100,
        valueType: 'select',
        fieldProps: {
          options: [
            { label: '高', value: 'HIGH' },
            { label: '中', value: 'MEDIUM' },
            { label: '低', value: 'LOW' },
            { label: '紧急', value: 'CRITICAL' },
          ],
        },
        render: (_, row) => priorityTag(row.priority),
      },
      {
        title: '设备',
        dataIndex: 'asset_id',
        width: 150,
        ellipsis: true,
        render: (_, row) => (
          <Tooltip title={row.asset_id}>
            <Link className="link-inline" to={`/assets/archive/${row.asset_id}`}>
              {shortId(row.asset_id)}
            </Link>
          </Tooltip>
        ),
      },
      {
        title: '故障描述',
        dataIndex: 'fault_description',
        ellipsis: true,
        search: false,
        render: (_, row) => row.fault_description || <span style={{ color: '#9ca3af' }}>未填写</span>,
      },
      {
        title: '科室',
        dataIndex: 'department_id',
        hideInTable: true,
        renderFormItem: () => <Input placeholder="department_id" />,
      },
      {
        title: '工程师',
        dataIndex: 'assigned_engineer_id',
        width: 130,
        ellipsis: true,
        renderFormItem: () => <Input placeholder="assigned_engineer_id" />,
        render: (_, row) => (
          <Tooltip title={row.assigned_engineer_id || ''}>{shortId(row.assigned_engineer_id)}</Tooltip>
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 170,
        search: false,
        render: (_, row) => fmtDate(row.created_at),
      },
      {
        title: '创建日期',
        dataIndex: 'date_range',
        hideInTable: true,
        renderFormItem: () => <DatePicker.RangePicker style={{ width: 260 }} />,
      },
      {
        title: '操作',
        valueType: 'option',
        width: 120,
        fixed: 'right',
        render: (_, row) => [
          <Link key="detail" to={`/repair/tickets/${row.id}`}>
            <EyeOutlined /> 详情
          </Link>,
        ],
      },
    ],
    [meta.defaultStatus, meta.statusOptions],
  )

  const request: ProTableProps<RepairRow, QueryForm>['request'] = async (params) => {
    setError(null)
    const status = params.order_status || meta.defaultStatus
    const query: RepairListQueryParams = {
      page: params.current ?? 1,
      page_size: params.pageSize ?? 20,
      order_status: normalizeStatusForQuery(status),
      asset_id: params.asset_id,
      department_id: params.department_id,
      assigned_engineer_id: params.assigned_engineer_id,
      priority: params.priority,
      date_from: params.date_range?.[0],
      date_to: params.date_range?.[1],
    }

    try {
      if (status === '__OPEN__') {
        const openStatuses = ['PENDING_DISPATCH', 'ASSIGNED', 'IN_PROGRESS', 'AWAIT_CONFIRM', 'PENDING_ACCEPT', 'PROCESSING']
        const pages = await Promise.all(
          openStatuses.map((order_status) => fetchRepairs({ ...query, order_status, page: 1, page_size: 100 })),
        )
        const rows = pages.flatMap((x) => x.items)
        const deduped = Array.from(new Map(rows.map((row) => [row.id, row])).values()).sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        )
        const page = params.current ?? 1
        const pageSize = params.pageSize ?? 20
        const start = (page - 1) * pageSize
        setSnapshot(deduped)
        return {
          data: deduped.slice(start, start + pageSize),
          success: true,
          total: deduped.length,
        }
      }

      const data = await fetchRepairs(query)
      setSnapshot(data.items)
      return { data: data.items, success: true, total: data.total }
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : String(e)
      setError(msg)
      setSnapshot([])
      return { data: [], success: false, total: 0 }
    }
  }

  const high = countBy(snapshot, (row) => ['HIGH', 'CRITICAL', '高'].includes(row.priority ?? ''))
  const open = countBy(snapshot, (row) => !['CLOSED', 'DONE'].includes(row.order_status))
  const awaiting = countBy(snapshot, (row) => ['AWAIT_CONFIRM', 'PENDING_ACCEPT'].includes(row.order_status))

  return (
    <PageScaffold title={meta.title} description={meta.description}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <ProCard gutter={12} ghost>
          <ProCard bordered size="small">
            <Statistic title="当前列表" value={snapshot.length} prefix={meta.icon} />
          </ProCard>
          <ProCard bordered size="small">
            <Statistic title="未闭环" value={open} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#d46b08' }} />
          </ProCard>
          <ProCard bordered size="small">
            <Statistic title="待验收" value={awaiting} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#1677ff' }} />
          </ProCard>
          <ProCard bordered size="small">
            <Statistic title="高优先级" value={high} valueStyle={{ color: '#cf1322' }} />
          </ProCard>
        </ProCard>

        {error ? <Alert showIcon type="error" message="维修接口暂不可用" description={error} /> : null}

        <Card bordered={false} bodyStyle={{ padding: 0 }}>
          <ProTable<RepairRow, QueryForm>
            rowKey="id"
            columns={columns}
            request={request}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            search={{ labelWidth: 'auto', defaultCollapsed: false, span: 6 }}
            scroll={{ x: 1120 }}
            dateFormatter="string"
            options={{ density: true, fullScreen: true, reload: true, setting: true }}
            toolBarRender={() => [
              <Button key="filter" icon={<FilterOutlined />}>
                保存视图
              </Button>,
            ]}
          />
        </Card>
      </Space>
    </PageScaffold>
  )
}
