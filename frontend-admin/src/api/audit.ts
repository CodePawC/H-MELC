/** 对齐 docs/06_接口设计/01 §九·1 */

import { apiRequest } from '../lib/api'
import type { Paged } from '../types/pagination'

export type AuditLogRow = {
  id: string
  user_id?: string | null
  username?: string | null
  role_code?: string | null
  action: string
  object_type?: string | null
  object_id?: string | null
  created_at: string
}

export function fetchAuditLogs(params: {
  page?: number
  page_size?: number
  action?: string
  username?: string
}) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.action?.trim()) sp.set('action', params.action.trim())
  if (params.username?.trim()) sp.set('username', params.username.trim())
  const q = sp.toString()
  return apiRequest<Paged<AuditLogRow>>(`/api/v1/audit/logs${q ? `?${q}` : ''}`)
}
