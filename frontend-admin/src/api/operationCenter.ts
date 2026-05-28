import { apiRequest } from '../lib/api'
import { API_BASE_URL } from '../config'
import type { Paged } from '../types/pagination'

export type ScreenDef = { code: string; name: string }

export type ScreenAccessKeyRow = {
  id: string
  key_name: string
  screen_code: string
  screen_name: string
  access_key: string
  is_enabled: boolean
  valid_from?: string | null
  valid_to?: string | null
  allowed_ips?: string | null
  desensitized: boolean
  refresh_interval_seconds: number
  carousel_interval_seconds: number
  access_count: number
  last_access_at?: string | null
  created_by_user_id?: string | null
  created_by_username?: string | null
  created_at: string
  updated_at: string
}

export type ScreenTerminalRow = {
  id: string
  terminal_name: string
  location?: string | null
  screen_code: string
  screen_name: string
  access_key_id?: string | null
  access_key_name?: string | null
  resolution: string
  online_status: string
  last_heartbeat_at?: string | null
  remark?: string | null
  created_at: string
  updated_at: string
}

export type ScreenAccessLogRow = {
  id: string
  access_time: string
  access_ip?: string | null
  screen_code: string
  screen_name: string
  access_key: string
  access_key_id?: string | null
  terminal_name?: string | null
  user_agent?: string | null
  success: boolean
  failure_reason?: string | null
}

export type PublicScreenPayload = {
  screen: ScreenDef
  generated_at: string
  refresh_interval_seconds: number
  carousel_interval_seconds: number
  desensitized: boolean
  watermark: string
  kpis?: { label: string; value: number | string; unit?: string }[]
  charts?: { title: string; type: string; items: { name: string; value: number }[] }[]
  tables?: { title: string; rows: Record<string, string | number | null>[] }[]
  carousel_items?: PublicScreenPayload[]
}

export function fetchOperationScreens() {
  return apiRequest<{ items: ScreenDef[]; total: number }>('/api/v1/operation-center/screens')
}

export function fetchScreenAccessKeys(params: { page?: number; page_size?: number; screen_code?: string } = {}) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.screen_code) sp.set('screen_code', params.screen_code)
  const q = sp.toString()
  return apiRequest<Paged<ScreenAccessKeyRow>>(`/api/v1/operation-center/access-keys${q ? `?${q}` : ''}`)
}

export function createScreenAccessKey(body: Partial<ScreenAccessKeyRow> & { key_name: string; screen_code: string }) {
  return apiRequest<ScreenAccessKeyRow>('/api/v1/operation-center/access-keys', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function patchScreenAccessKey(id: string, body: Partial<ScreenAccessKeyRow>) {
  return apiRequest<ScreenAccessKeyRow>(`/api/v1/operation-center/access-keys/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function fetchScreenTerminals(params: { page?: number; page_size?: number; screen_code?: string } = {}) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.screen_code) sp.set('screen_code', params.screen_code)
  const q = sp.toString()
  return apiRequest<Paged<ScreenTerminalRow>>(`/api/v1/operation-center/terminals${q ? `?${q}` : ''}`)
}

export function createScreenTerminal(body: Partial<ScreenTerminalRow> & { terminal_name: string; screen_code: string }) {
  return apiRequest<ScreenTerminalRow>('/api/v1/operation-center/terminals', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function patchScreenTerminal(id: string, body: Partial<ScreenTerminalRow>) {
  return apiRequest<ScreenTerminalRow>(`/api/v1/operation-center/terminals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function fetchScreenAccessLogs(params: { page?: number; page_size?: number; screen_code?: string; success?: boolean } = {}) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.screen_code) sp.set('screen_code', params.screen_code)
  if (params.success != null) sp.set('success', String(params.success))
  const q = sp.toString()
  return apiRequest<Paged<ScreenAccessLogRow>>(`/api/v1/operation-center/access-logs${q ? `?${q}` : ''}`)
}

export async function fetchPublicScreen(screenCode: string, accessKey: string): Promise<PublicScreenPayload> {
  const base = API_BASE_URL.replace(/\/$/, '')
  const res = await fetch(`${base}/screen-api/${encodeURIComponent(screenCode)}?accessKey=${encodeURIComponent(accessKey)}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = body?.detail || body?.message || `大屏访问失败（HTTP ${res.status}）`
    throw new Error(msg)
  }
  if (body?.code !== 0) {
    throw new Error(body?.message || '大屏访问失败')
  }
  return body.data as PublicScreenPayload
}

