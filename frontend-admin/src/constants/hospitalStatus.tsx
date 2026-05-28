/**
 * 医院业务状态统一色标（Ant Design Tag）
 */

import { Badge, Tag } from 'antd'

export const DEVICE_STATUS: Record<string, { text: string; color: string }> = {
  IN_USE: { text: '在用', color: 'success' },
  REPAIR: { text: '维修中', color: 'processing' },
  IDLE: { text: '停用', color: 'default' },
  RETIRED: { text: '报废', color: 'default' },
  ABNORMAL: { text: '异常', color: 'error' },
}

export const WORK_ORDER_STATUS: Record<string, { text: string; color: string }> = {
  PENDING_ASSIGN: { text: '待派工', color: 'default' },
  PROCESSING: { text: '处理中', color: 'processing' },
  PENDING_ACCEPT: { text: '待验收', color: 'warning' },
  DONE: { text: '已完成', color: 'success' },
  CLOSED: { text: '已关闭', color: 'default' },
  TIMEOUT: { text: '已超时', color: 'error' },
}

export const PAY_STATUS: Record<string, { text: string; color: string }> = {
  UNPAID: { text: '未付款', color: 'default' },
  PARTIAL: { text: '部分付款', color: 'processing' },
  PAID: { text: '已付款', color: 'success' },
  OVERDUE: { text: '逾期', color: 'error' },
  PENDING_AUDIT: { text: '待审核', color: 'warning' },
}

export const METER_STATUS: Record<string, { text: string; color: string }> = {
  OK: { text: '正常', color: 'success' },
  SOON: { text: '即将到期', color: 'warning' },
  EXPIRED: { text: '已过期', color: 'error' },
  SENT: { text: '已送检', color: 'processing' },
  COMPLETED: { text: '已完成', color: 'success' },
}

export const PM_STATUS: Record<string, { text: string; color: string }> = {
  NOT_START: { text: '未开始', color: 'default' },
  DOING: { text: '进行中', color: 'processing' },
  DONE: { text: '已完成', color: 'success' },
  OVERDUE: { text: '已逾期', color: 'error' },
}

export function StatusTag(map: Record<string, { text: string; color: string }>, code: string) {
  const x = map[code] ?? { text: code, color: 'default' as const }
  return <Tag color={x.color}>{x.text}</Tag>
}

export function UrgentBadge(level: string) {
  const color = level === '高' ? 'red' : level === '中' ? 'orange' : 'default'
  return <Badge status={color === 'red' ? 'error' : color === 'orange' ? 'warning' : 'default'} text={level} />
}
