/** 院内用户会话（登录后）；Mock 与真实 /auth/me 对齐时可扩展字段 */

export type DataScopeType = 'all' | 'department' | 'self' | 'supplier' | 'custom'

export type AuthUserProfile = {
  id: string
  username: string
  displayName: string | null
  phone?: string | null
  roles: string[]
  /** RBAC 权限码 module:resource:action；含 * 表示平台管理员全量 */
  permissions: string[]
  dataScope: DataScopeType
  departmentIds: string[]
  departmentNames?: string[]
  supplierId?: string | null
  /** 供应商账号仅访问 /portal 域 */
  portalOnly?: boolean
  lastLoginAt?: string | null
  /** 账号禁用（Mock 校验；真实以后端为准） */
  disabled?: boolean
}
