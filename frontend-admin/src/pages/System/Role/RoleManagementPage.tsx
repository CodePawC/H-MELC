import { IS_AUTH_MOCK } from '../../../config/authMode'
import { SystemRolesPage } from '../../SystemRolesPage'
import { RoleManagementMockPage } from './RoleManagementMockPage'

export function RoleManagementPage() {
  return IS_AUTH_MOCK ? <RoleManagementMockPage /> : <SystemRolesPage />
}
