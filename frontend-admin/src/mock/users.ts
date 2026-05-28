/**
 * Mock 登录账号（演示院内多角色）；开启 VITE_AUTH_MOCK 时使用。
 */

import type { AuthUserProfile } from '../types/authProfile'

export type MockAccountRecord = AuthUserProfile & {
  /** 登录口令（仅 Mock） */
  password: string
}

export const MOCK_ACCOUNTS: MockAccountRecord[] = [
  {
    id: 'u-admin',
    username: 'admin',
    password: 'admin123',
    displayName: '系统管理员',
    phone: '13800000001',
    roles: ['PLATFORM_ADMIN'],
    permissions: ['*'],
    dataScope: 'all',
    departmentIds: ['dept-info'],
    departmentNames: ['信息科'],
    supplierId: null,
    portalOnly: false,
    lastLoginAt: '2026-05-10 08:30:00',
    disabled: false,
  },
  {
    id: 'u-director',
    username: 'director',
    password: '123456',
    displayName: '张主任',
    phone: '13800000002',
    roles: ['DEVICE_DIRECTOR'],
    permissions: [],
    dataScope: 'all',
    departmentIds: ['dept-equip'],
    departmentNames: ['医学装备科'],
    portalOnly: false,
    lastLoginAt: '2026-05-09 17:10:00',
    disabled: false,
  },
  {
    id: 'u-engineer',
    username: 'engineer',
    password: '123456',
    displayName: '李工程师',
    phone: '13800000003',
    roles: ['DEVICE_ENGINEER'],
    permissions: [],
    dataScope: 'all',
    departmentIds: ['dept-equip'],
    departmentNames: ['医学装备科'],
    portalOnly: false,
    lastLoginAt: '2026-05-10 07:50:00',
    disabled: false,
  },
  {
    id: 'u-nurse',
    username: 'nurse',
    password: '123456',
    displayName: '王护士长',
    phone: '13800000004',
    roles: ['DEPT_HEAD_NURSE'],
    permissions: [],
    dataScope: 'department',
    departmentIds: ['dept-icu'],
    departmentNames: ['重症医学科'],
    portalOnly: false,
    lastLoginAt: '2026-05-08 09:00:00',
    disabled: false,
  },
  {
    id: 'u-supplier',
    username: 'supplier',
    password: '123456',
    displayName: '某某医疗科技',
    phone: '13800000005',
    roles: ['SUPPLIER_PORTAL'],
    permissions: [],
    dataScope: 'supplier',
    departmentIds: [],
    departmentNames: [],
    supplierId: 'sup-001',
    portalOnly: true,
    lastLoginAt: '2026-05-10 10:00:00',
    disabled: false,
  },
  {
    id: 'u-finance',
    username: 'finance',
    password: '123456',
    displayName: '赵会计',
    phone: '13800000006',
    roles: ['FINANCE'],
    permissions: [],
    dataScope: 'all',
    departmentIds: ['dept-finance'],
    departmentNames: ['财务科'],
    portalOnly: false,
    lastLoginAt: '2026-05-09 16:00:00',
    disabled: false,
  },
]

export function findMockAccount(username: string): MockAccountRecord | undefined {
  return MOCK_ACCOUNTS.find((a) => a.username === username.trim())
}
