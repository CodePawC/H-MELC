import type { ReactNode } from 'react'

import { useAuthSession } from '../stores/authSession'

type AuthProps = {
  children: ReactNode
  /** 单一权限码 */
  permission?: string
  /** 满足其一即可 */
  anyOf?: string[]
  /** 需同时满足 */
  allOf?: string[]
  fallback?: ReactNode
}

/**
 * 按钮级权限：无权限时不渲染子节点（可配 fallback）。
 */
export function Auth({ children, permission, anyOf, allOf, fallback = null }: AuthProps) {
  const hasP = useAuthSession((s) => s.hasPermission)
  const hasAny = useAuthSession((s) => s.hasAnyPermission)

  let ok = true
  if (permission) ok = ok && hasP(permission)
  if (anyOf?.length) ok = ok && hasAny(anyOf)
  if (allOf?.length) ok = ok && allOf.every((c) => hasP(c))

  if (!ok) return <>{fallback}</>
  return <>{children}</>
}
