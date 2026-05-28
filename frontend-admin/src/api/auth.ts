import { profileFromApiMe } from '../auth/permission'
import { IS_AUTH_MOCK } from '../config/authMode'
import type { AuthUserProfile } from '../types/authProfile'
import type { LoginResult } from '../types/auth'
import { apiRequest, ApiClientError } from '../lib/api'
import { persistAuthProfile, readAuthProfile } from '../lib/authProfileStorage'
import { getAccessToken, isMockToken } from '../lib/token'

type LoginPayloadGateway = {
  operator_name?: string | null
  operator_display_name?: string | null
  operator_role?: string | null
  permissions?: string[]
  session_token?: string | null
  token_type?: string | null
  expires_in?: number | null
  session_expires_at?: string | null
}

function normalizeRoleCode(role: string | null | undefined): string | null {
  const r = role?.trim()
  if (!r) return null
  if (r === 'platform_admin') return 'PLATFORM_ADMIN'
  return r
}

function normalizeLoginResult(raw: LoginResult | LoginPayloadGateway, fallbackUsername: string): LoginResult {
  if ('access_token' in raw && typeof raw.access_token === 'string' && raw.access_token) {
    return raw
  }

  const g = raw as LoginPayloadGateway
  if (typeof g.session_token === 'string' && g.session_token) {
    const username = g.operator_name?.trim() || fallbackUsername
    const role = normalizeRoleCode(g.operator_role)
    const profile = profileFromApiMe({
      id: username,
      username,
      roles: role ? [role] : [],
      permissions: g.permissions,
      displayName: g.operator_display_name ?? username,
    })
    persistAuthProfile(profile)
    return {
      access_token: g.session_token,
      token_type: g.token_type || 'bearer',
      expires_in: typeof g.expires_in === 'number' && Number.isFinite(g.expires_in) ? g.expires_in : 86400,
      user: {
        id: username,
        username,
        display_name: g.operator_display_name ?? username,
        roles: role ? [role] : [],
      },
    }
  }

  throw new ApiClientError('登录成功响应缺少 access_token 或 session_token，无法建立前端会话')
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const raw = await apiRequest<LoginResult | LoginPayloadGateway>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  return normalizeLoginResult(raw, username)
}

/** 当前用户画像（含权限码）；Mock 时读会话缓存，真实模式调 /auth/me 并推导权限 */
type MePayloadFastApi = {
  id: string
  username: string
  roles: string[]
  permissions?: string[]
  display_name?: string | null
  phone?: string | null
  data_scope?: AuthUserProfile['dataScope']
  department_ids?: string[]
  supplier_id?: string | null
  portal_only?: boolean
}

/** 部分网关：`data` 内为 operator_* + permissions（对齐 success/code:"OK" 信封） */
type MePayloadGateway = {
  operator_name: string
  operator_display_name?: string | null
  operator_role?: string | null
  permissions?: string[]
  user_id?: string
  id?: string
  phone?: string | null
  data_scope?: AuthUserProfile['dataScope']
  department_ids?: string[]
  supplier_id?: string | null
  portal_only?: boolean
}

/** 部分网关把用户放在 `user` 子对象下 */
function peelUserObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  let o = raw as Record<string, unknown>
  if (o.user && typeof o.user === 'object' && !Array.isArray(o.user)) {
    o = o.user as Record<string, unknown>
  }
  return o
}

function normalizeMeToProfileInput(raw: unknown): Parameters<typeof profileFromApiMe>[0] {
  const o = peelUserObject(raw)
  if (!o) {
    throw new ApiClientError('/auth/me 成功信封内 data 为空或不是对象')
  }

  const g = o as unknown as MePayloadGateway
  if (typeof g.operator_name === 'string' && g.operator_name.length > 0) {
    const roleOne = normalizeRoleCode(g.operator_role)
    return {
      id: (typeof g.user_id === 'string' && g.user_id) || (typeof g.id === 'string' && g.id) || `login:${g.operator_name}`,
      username: g.operator_name,
      roles: roleOne ? [roleOne] : [],
      permissions: g.permissions,
      displayName: g.operator_display_name ?? null,
      phone: g.phone ?? null,
      dataScope: g.data_scope,
      departmentIds: g.department_ids,
      supplierId: g.supplier_id ?? null,
      portalOnly: g.portal_only,
    }
  }

  const username =
    (typeof o.username === 'string' && o.username) ||
    (typeof o.loginName === 'string' && o.loginName) ||
    (typeof o.userName === 'string' && o.userName) ||
    ''
  if (username) {
    const roles = Array.isArray(o.roles)
      ? (o.roles as unknown[]).filter((x): x is string => typeof x === 'string')
      : typeof o.role === 'string'
        ? [o.role]
        : typeof o.operator_role === 'string'
          ? [o.operator_role]
          : []
    const displayName =
      (typeof o.display_name === 'string' && o.display_name) ||
      (typeof o.displayName === 'string' && o.displayName) ||
      (typeof o.operator_display_name === 'string' && o.operator_display_name) ||
      null
    return {
      id:
        (typeof o.user_id === 'string' && o.user_id) ||
        (typeof o.id === 'string' && o.id) ||
        `login:${username}`,
      username,
      roles,
      permissions: Array.isArray(o.permissions)
        ? (o.permissions as unknown[]).filter((x): x is string => typeof x === 'string')
        : undefined,
      displayName,
      phone: typeof o.phone === 'string' ? o.phone : null,
      dataScope: o.data_scope as AuthUserProfile['dataScope'] | undefined,
      departmentIds: Array.isArray(o.department_ids) ? (o.department_ids as string[]) : undefined,
      supplierId: typeof o.supplier_id === 'string' ? o.supplier_id : null,
      portalOnly: typeof o.portal_only === 'boolean' ? o.portal_only : undefined,
    }
  }

  const f = o as unknown as MePayloadFastApi
  if (typeof f.id === 'string' && f.id && typeof f.username === 'string' && f.username) {
    return {
      id: f.id,
      username: f.username,
      roles: f.roles ?? [],
      permissions: f.permissions,
      displayName: f.display_name ?? null,
      phone: f.phone ?? null,
      dataScope: f.data_scope,
      departmentIds: f.department_ids,
      supplierId: f.supplier_id ?? null,
      portalOnly: f.portal_only,
    }
  }

  throw new ApiClientError(
    `无法从 /auth/me 的 data 映射用户画像。需 id+username+roles（本仓库 FastAPI）或 operator_name / username 与权限字段。实际 keys：${Object.keys(o).join(', ')}`,
  )
}

export async function fetchMe(): Promise<AuthUserProfile> {
  const tok = getAccessToken()
  if (IS_AUTH_MOCK && isMockToken(tok)) {
    const p = readAuthProfile()
    if (p && !p.disabled) return p
    throw new ApiClientError('登录状态已失效，请重新登录')
  }

  let raw: MePayloadFastApi | MePayloadGateway
  try {
    raw = await apiRequest<MePayloadFastApi | MePayloadGateway>('/api/v1/auth/me', { method: 'GET' })
  } catch (e) {
    const cached = readAuthProfile()
    if (cached && !cached.disabled) return cached
    throw e
  }

  if (raw == null || typeof raw !== 'object') {
    throw new ApiClientError('/auth/me 返回的 data 为空或类型无效')
  }

  return profileFromApiMe(normalizeMeToProfileInput(raw))
}
