/**
 * RBAC：权限码校验、角色推导权限、数据范围文案。
 */

import { HOSPITAL_ROLES, roleDefByCode } from '../mock/roles'
import type { AuthUserProfile, DataScopeType } from '../types/authProfile'

const SCOPE_RANK: Record<DataScopeType, number> = {
  all: 5,
  custom: 4,
  department: 3,
  self: 2,
  supplier: 1,
}

/** 是否具备某权限码（支持 * 与 module:* 简写） */
export function hasPermission(permissions: string[] | undefined, code: string): boolean {
  if (!permissions?.length) return false
  if (permissions.includes('*')) return true
  if (permissions.includes(code)) return true
  const parts = code.split(':')
  if (parts.length >= 2) {
    const modRes = `${parts[0]}:${parts[1]}:*`
    if (permissions.includes(modRes)) return true
    if (permissions.includes(`${parts[0]}:*`)) return true
  }
  return false
}

export function hasAnyPermission(permissions: string[] | undefined, codes: string[]): boolean {
  return codes.some((c) => hasPermission(permissions, c))
}

export function hasAllPermissions(permissions: string[] | undefined, codes: string[]): boolean {
  return codes.every((c) => hasPermission(permissions, c))
}

/** 将角色编码合并为权限列表（去重） */
export function derivePermissionsFromRoles(roleCodes: string[]): string[] {
  const out = new Set<string>()
  for (const rc of roleCodes) {
    const def = roleDefByCode(rc)
    if (!def) continue
    for (const p of def.permissions) out.add(p)
  }
  return [...out]
}

/** 合并多角色数据范围（取最宽） */
export function mergeDataScope(roleCodes: string[]): DataScopeType {
  let best: DataScopeType = 'self'
  let rank = -1
  for (const rc of roleCodes) {
    const def = roleDefByCode(rc)
    if (!def) continue
    const r = SCOPE_RANK[def.dataScope] ?? 0
    if (r > rank) {
      rank = r
      best = def.dataScope
    }
  }
  return best
}

export function dataScopeHint(scope: DataScopeType | undefined, portalOnly?: boolean): string {
  if (portalOnly) return '当前为供应商门户账号，仅展示本供应商相关数据。'
  switch (scope) {
    case 'all':
      return '全院运营视图已启用。'
    case 'department':
      return '当前数据范围：所属科室，列表与统计已按科室过滤。'
    case 'self':
      return '当前数据范围：本人提交。'
    case 'supplier':
      return '当前数据范围：本供应商。'
    case 'custom':
      return '当前数据范围：自定义科室集合。'
    default:
      return ''
  }
}

/** 真实 JWT 仅有角色时，拼装完整 AuthUserProfile（权限由角色表推导） */
export function profileFromApiMe(input: {
  id: string
  username: string
  roles: string[]
  permissions?: string[]
  displayName?: string | null
  phone?: string | null
  dataScope?: DataScopeType
  departmentIds?: string[]
  supplierId?: string | null
  portalOnly?: boolean
}): AuthUserProfile {
  const permissions = Array.from(
    new Set([...derivePermissionsFromRoles(input.roles), ...(input.permissions ?? [])]),
  )
  const dataScope = input.dataScope ?? mergeDataScope(input.roles)
  const portalOnly =
    input.portalOnly ??
    (input.roles.length === 1 && input.roles[0] === 'SUPPLIER_PORTAL')
  return {
    id: input.id,
    username: input.username,
    displayName: input.displayName ?? input.username,
    phone: input.phone ?? null,
    roles: input.roles,
    permissions,
    dataScope,
    departmentIds: input.departmentIds ?? [],
    supplierId: input.supplierId ?? null,
    portalOnly: portalOnly === true,
    lastLoginAt: null,
    disabled: false,
  }
}

/** Mock：补全用户记录中的空 permissions */
export function hydrateMockProfile(p: AuthUserProfile): AuthUserProfile {
  const perms = p.permissions?.length ? p.permissions : derivePermissionsFromRoles(p.roles)
  const dataScope = p.dataScope ?? mergeDataScope(p.roles)
  return {
    ...p,
    permissions: perms,
    dataScope,
    portalOnly: p.portalOnly ?? p.roles.includes('SUPPLIER_PORTAL'),
  }
}

export { HOSPITAL_ROLES }
