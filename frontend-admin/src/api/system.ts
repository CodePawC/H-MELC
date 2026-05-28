/** docs/06 §十三 系统用户与角色 */

import { apiRequest } from '../lib/api'
import type { Paged } from '../types/pagination'

export type RoleCatalogItem = {
  code: string
  name: string
  description: string
}

export type SystemUserRow = {
  id: string
  username: string
  display_name: string | null
  is_active: boolean
  role_codes: string[]
  created_at: string
}

export function fetchRoleCatalog() {
  return apiRequest<{ items: RoleCatalogItem[] }>('/api/v1/system/roles')
}

export function fetchSystemUsers(params: {
  page?: number
  page_size?: number
  keyword?: string
  role?: string
  is_active?: boolean
}) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.keyword?.trim()) sp.set('keyword', params.keyword.trim())
  if (params.role?.trim()) sp.set('role', params.role.trim())
  if (params.is_active !== undefined) sp.set('is_active', String(params.is_active))
  const q = sp.toString()
  return apiRequest<Paged<SystemUserRow>>(`/api/v1/system/users${q ? `?${q}` : ''}`)
}

export function createSystemUser(body: {
  username: string
  display_name?: string | null
  initial_password: string
  role_codes: string[]
  is_active?: boolean
}) {
  return apiRequest<SystemUserRow>('/api/v1/system/users', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function patchSystemUser(
  userId: string,
  body: { display_name?: string | null; is_active?: boolean | null },
) {
  return apiRequest<SystemUserRow>(`/api/v1/system/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function putSystemUserRoles(userId: string, role_codes: string[]) {
  return apiRequest<SystemUserRow>(`/api/v1/system/users/${encodeURIComponent(userId)}/roles`, {
    method: 'PUT',
    body: JSON.stringify({ role_codes }),
  })
}

export function adminResetUserPassword(userId: string, new_password: string) {
  return apiRequest<{ ok: boolean }>(
    `/api/v1/system/users/${encodeURIComponent(userId)}/password-reset`,
    {
      method: 'POST',
      body: JSON.stringify({ new_password }),
    },
  )
}

export function changeMyPassword(old_password: string, new_password: string) {
  return apiRequest<{ ok: boolean }>('/api/v1/system/me/password', {
    method: 'POST',
    body: JSON.stringify({ old_password, new_password }),
  })
}
