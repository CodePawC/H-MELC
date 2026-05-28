/**
 * 将 PC 管理端菜单转为 ProLayout route（docs/05_前端设计/01 §二）
 */

import type { ReactNode } from 'react'
import {
  AccountBookOutlined,
  AlertOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  ClusterOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FundProjectionScreenOutlined,
  MedicineBoxOutlined,
  PartitionOutlined,
  RobotOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  SettingOutlined,
  ShopOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import type { ProLayoutProps } from '@ant-design/pro-components'

import type { AdminMenuGroup } from '../navigation/menu'

const GROUP_ICONS: Record<string, ReactNode> = {
  workspace: <DashboardOutlined />,
  dashboard: <DashboardOutlined />,
  'task-center': <ScheduleOutlined />,
  assets: <MedicineBoxOutlined />,
  repair: <ToolOutlined />,
  maintenance: <ToolOutlined />,
  pm: <ScheduleOutlined />,
  meter: <ExperimentOutlined />,
  'operation-center': <FundProjectionScreenOutlined />,
  ioc: <FundProjectionScreenOutlined />,
  purchase: <ShopOutlined />,
  'supply-finance': <AccountBookOutlined />,
  supplier: <ClusterOutlined />,
  finance: <AccountBookOutlined />,
  consumables: <AppstoreOutlined />,
  qcsafety: <SafetyCertificateOutlined />,
  'quality-safety': <SafetyCertificateOutlined />,
  ai: <RobotOutlined />,
  knowledge: <ReadOutlined />,
  system: <SettingOutlined />,
  hmdm: <DatabaseOutlined />,
  quality: <SafetyCertificateOutlined />,
  supply: <ClusterOutlined />,
  operation: <ToolOutlined />,
  asset: <MedicineBoxOutlined />,
  analysis: <BarChartOutlined />,
  'command-center': <FundProjectionScreenOutlined />,
  'operation-platform': <PartitionOutlined />,
  risk: <AlertOutlined />,
}

const PRIMARY_GROUPS = [
  'dashboard',
  'task-center',
  'assets',
  'maintenance',
  'supply-finance',
  'quality-safety',
  'ioc',
]

const SECONDARY_GROUPS = ['knowledge', 'system']

export function buildProLayoutRouteFromGroups(groups: AdminMenuGroup[]): ProLayoutProps['route'] {
  return {
    path: '/',
    routes: groups.map((g) => ({
      path: `/${g.id}`,
      name: g.label,
      icon: GROUP_ICONS[g.id] ?? <AppstoreOutlined />,
      className: PRIMARY_GROUPS.includes(g.id)
        ? 'hospital-menu-priority'
        : SECONDARY_GROUPS.includes(g.id)
          ? 'hospital-menu-secondary'
          : undefined,
      routes: g.items.map((it) => ({
        path: it.path,
        name: it.label,
      })),
    })),
  }
}

export const proLayoutLogo = <MedicineBoxOutlined style={{ fontSize: 28, color: '#1677ff' }} />
