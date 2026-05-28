import { IS_AUTH_MOCK } from '../../../config/authMode'
import { AuditLogsPage } from '../../AuditLogsPage'
import { AuditLogManagementMockPage } from './AuditLogManagementMockPage'

export function AuditLogManagementPage() {
  return IS_AUTH_MOCK ? <AuditLogManagementMockPage /> : <AuditLogsPage />
}
