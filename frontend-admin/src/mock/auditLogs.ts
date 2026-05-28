/** Mock 审计日志（演示字段完整性） */

export type MockAuditLogRow = {
  id: string
  createdAt: string
  username: string
  roleCode: string | null
  module: string
  action: string
  ip: string
  result: 'success' | 'fail'
  detail: string
}

export const MOCK_AUDIT_LOGS: MockAuditLogRow[] = [
  {
    id: '1',
    createdAt: '2026-05-10 09:12:33',
    username: 'admin',
    roleCode: 'PLATFORM_ADMIN',
    module: '认证',
    action: 'LOGIN_SUCCESS',
    ip: '10.0.12.88',
    result: 'success',
    detail: '角色: PLATFORM_ADMIN',
  },
  {
    id: '2',
    createdAt: '2026-05-10 09:15:01',
    username: 'finance',
    roleCode: 'FINANCE',
    module: '付款',
    action: 'EXPORT',
    ip: '10.0.12.90',
    result: 'success',
    detail: '导出付款台账 CSV',
  },
  {
    id: '3',
    createdAt: '2026-05-10 08:40:22',
    username: 'unknown',
    roleCode: null,
    module: '认证',
    action: 'LOGIN_FAIL',
    ip: '192.168.1.101',
    result: 'fail',
    detail: '密码错误',
  },
  {
    id: '4',
    createdAt: '2026-05-09 16:20:00',
    username: 'director',
    roleCode: 'DEVICE_DIRECTOR',
    module: '设备台账',
    action: 'UPDATE',
    ip: '10.0.12.15',
    result: 'success',
    detail: '资产卡片字段调整',
  },
  {
    id: '5',
    createdAt: '2026-05-09 11:05:44',
    username: 'supplier',
    roleCode: 'SUPPLIER_PORTAL',
    module: '供应商门户',
    action: 'UPLOAD',
    ip: '61.144.x.x',
    result: 'success',
    detail: '上传增值税发票 PDF',
  },
]
