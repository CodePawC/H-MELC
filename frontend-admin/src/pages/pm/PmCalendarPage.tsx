import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Calendar, List, Radio, Space, Tag, Typography } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'

import { fetchPmInspectionTasks, fetchPmTasks } from '../../api/pm'
import type { PmInspectionTaskRow, PmTaskRow } from '../../api/pm'
import { PageScaffold } from '../../components/hospital/PageScaffold'
import { IS_AUTH_MOCK } from '../../config/authMode'
import { ApiClientError } from '../../lib/api'
import { MOCK_PM } from '../../mock/hospital/tables'

type CalendarMode = 'month' | 'list'

type CalendarItem = {
  id: string
  type: 'PM' | 'INSPECTION'
  title: string
  due_date: string
  status: string
  asset_id?: string | null
}

function statusColor(status: string) {
  if (['DONE', 'COMPLETED'].includes(status)) return 'success'
  if (['OVERDUE', 'TIMEOUT'].includes(status)) return 'error'
  if (['PENDING', 'PENDING_ACCEPT', 'AWAIT_CONFIRM'].includes(status)) return 'warning'
  return 'processing'
}

function itemTag(item: CalendarItem) {
  return (
    <Space size={6} wrap>
      <Tag color={item.type === 'PM' ? 'blue' : 'cyan'}>{item.type === 'PM' ? '保养' : '巡检'}</Tag>
      <Tag color={statusColor(item.status)}>{item.status}</Tag>
    </Space>
  )
}

function toCalendarItems(tasks: PmTaskRow[], inspections: PmInspectionTaskRow[]): CalendarItem[] {
  return [
    ...tasks.map((x) => ({
      id: x.id,
      type: 'PM' as const,
      title: `保养任务 ${x.id.slice(0, 8)}`,
      due_date: x.due_date,
      status: x.task_status,
      asset_id: x.asset_id,
    })),
    ...inspections.map((x) => ({
      id: x.id,
      type: 'INSPECTION' as const,
      title: x.title,
      due_date: x.due_date,
      status: x.task_status,
      asset_id: x.asset_id,
    })),
  ].sort((a, b) => a.due_date.localeCompare(b.due_date))
}

function mockItems(): CalendarItem[] {
  return MOCK_PM.map((x) => ({
    id: x.id,
    type: 'PM',
    title: x.planName,
    due_date: x.nextDate,
    status: x.status === '已逾期' ? 'OVERDUE' : x.status === '已完成' ? 'DONE' : 'PENDING',
  }))
}

export function PmCalendarPage() {
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [mode, setMode] = useState<CalendarMode>('month')
  const [selectedDate, setSelectedDate] = useState(() => dayjs())

  function reload() {
    setLoading(true)
    setErr(null)
    if (IS_AUTH_MOCK) {
      setItems(mockItems())
      setLoading(false)
      return
    }
    void (async () => {
      try {
        const start = dayjs().startOf('month').subtract(1, 'month').format('YYYY-MM-DD')
        const end = dayjs().endOf('month').add(2, 'month').format('YYYY-MM-DD')
        const [tasks, inspections] = await Promise.all([
          fetchPmTasks({ page: 1, page_size: 100, date_from: start, date_to: end }),
          fetchPmInspectionTasks({ page: 1, page_size: 100, date_from: start, date_to: end }),
        ])
        setItems(toCalendarItems(tasks.items, inspections.items))
      } catch (e) {
        setErr(e instanceof ApiClientError ? e.message : String(e))
        setItems([])
      } finally {
        setLoading(false)
      }
    })()
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 页面进入时拉取一次窗口数据
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    items.forEach((item) => {
      const key = item.due_date
      map.set(key, [...(map.get(key) ?? []), item])
    })
    return map
  }, [items])

  const selectedItems = grouped.get(selectedDate.format('YYYY-MM-DD')) ?? []
  const overdue = items.filter((item) => dayjs(item.due_date).isBefore(dayjs(), 'day') && !['DONE', 'COMPLETED'].includes(item.status)).length

  return (
    <PageScaffold
      title="维护日历"
      description="合并保养任务与巡检任务的到期日程，帮助设备科提前安排工程师与科室窗口。"
      extra={
        <Space wrap>
          <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
            <Radio.Button value="month">月历</Radio.Button>
            <Radio.Button value="list">列表</Radio.Button>
          </Radio.Group>
          <Button onClick={reload} loading={loading}>
            刷新
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {IS_AUTH_MOCK ? <Alert showIcon type="info" message="演示模式" description="当前展示前端 PM 演示日程。" /> : null}
        {err ? <Alert showIcon type="warning" message="PM 日历接口提示" description={err} /> : null}

        <Space wrap size={12}>
          <Badge count={items.length} showZero color="#1677ff">
            <Tag style={{ marginInlineEnd: 0 }}>窗口任务</Tag>
          </Badge>
          <Badge count={overdue} showZero color="#cf1322">
            <Tag style={{ marginInlineEnd: 0 }}>已逾期</Tag>
          </Badge>
        </Space>

        {mode === 'month' ? (
          <Calendar
            value={selectedDate}
            onSelect={(date) => setSelectedDate(date)}
            cellRender={(date: Dayjs, info) => {
              if (info.type !== 'date') return info.originNode
              const dayItems = grouped.get(date.format('YYYY-MM-DD')) ?? []
              if (!dayItems.length) return null
              return (
                <ul className="pm-calendar-cell">
                  {dayItems.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <Badge status={statusColor(item.status)} text={item.type === 'PM' ? '保养' : '巡检'} />
                    </li>
                  ))}
                  {dayItems.length > 3 ? <li className="muted tiny">+{dayItems.length - 3}</li> : null}
                </ul>
              )
            }}
          />
        ) : null}

        <List
          loading={loading}
          header={
            mode === 'month' ? (
              <Typography.Text strong>{selectedDate.format('YYYY-MM-DD')} 日程</Typography.Text>
            ) : (
              <Typography.Text strong>近期维护日程</Typography.Text>
            )
          }
          dataSource={mode === 'month' ? selectedItems : items}
          locale={{ emptyText: '当前日期没有维护安排' }}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space wrap>
                    <Typography.Text>{item.title}</Typography.Text>
                    {itemTag(item)}
                  </Space>
                }
                description={
                  <Space wrap size={12}>
                    <span>到期：{item.due_date}</span>
                    <span>设备：{item.asset_id ? item.asset_id.slice(0, 8) : '-'}</span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Space>
    </PageScaffold>
  )
}
