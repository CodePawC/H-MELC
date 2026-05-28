/**
 * 用户管理：Mock 模式下完整演示字段与操作；真实模式复用原 API 页。
 */

import { UserManagementMockPage } from './UserManagementMockPage'
import { SystemUsersPage } from '../../SystemUsersPage'
import { IS_AUTH_MOCK } from '../../../config/authMode'

export function UserManagementPage() {
  return IS_AUTH_MOCK ? <UserManagementMockPage /> : <SystemUsersPage />
}
