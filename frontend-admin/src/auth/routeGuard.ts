/**
 * 路由级访问控制（与侧栏过滤一致；最终以接口 403 为准）。
 */

import { hasAnyPermission, hasPermission } from './permission'
import { ADMIN_ROUTE_LEAVES } from '../navigation/menu'
import type { AdminMenuLeaf } from '../navigation/menu'
import type { AuthUserProfile } from '../types/authProfile'

function leafMatchesPath(leafPath: string, pathname: string): boolean {
  if (pathname === leafPath) return true
  if (leafPath !== '/' && pathname.startsWith(`${leafPath}/`)) return true
  return false
}

function findLeaf(pathname: string): AdminMenuLeaf | undefined {
  return [...ADMIN_ROUTE_LEAVES].sort((a, b) => b.path.length - a.path.length).find((x) => leafMatchesPath(x.path, pathname))
}

function leafEffectiveAccess(leaf: AdminMenuLeaf): 'internal' | 'supplier' | 'both' {
  return leaf.access ?? 'internal'
}

export function canAccessPath(pathname: string, me: AuthUserProfile | null): boolean {
  if (!me || me.disabled) return false
  if (pathname === '/403') return true

  if (me.portalOnly && pathname.startsWith('/portal')) {
    return true
  }

  if (/^\/(lifecycle\/assets|assets\/archive)\/.+/.test(pathname)) {
    return hasPermission(me.permissions, 'equipment:asset:view')
  }
  if (/^\/(maintenance\/tickets|repair\/tickets)\/.+/.test(pathname)) {
    return hasPermission(me.permissions, 'equipment:repair:view')
  }
  if (/^\/knowledge\/documents\/.+/.test(pathname)) {
    return hasPermission(me.permissions, 'knowledge:doc:view')
  }

  if (pathname === '/') {
    if (me.portalOnly) return true
    return hasAnyPermission(me.permissions, ['dashboard:home:view'])
  }

  const leaf = findLeaf(pathname)
  if (!leaf) {
    return false
  }

  const eff = leafEffectiveAccess(leaf)
  if (me.portalOnly) {
    if (eff === 'internal') return false
  } else {
    if (eff === 'supplier') return false
  }

  if (leaf.requiredPermissions?.length) {
    return hasAnyPermission(me.permissions, leaf.requiredPermissions)
  }
  if (leaf.requiredRoles?.length) {
    return leaf.requiredRoles.some((r) => me.roles.includes(r))
  }
  return true
}
