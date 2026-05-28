import { useMemo, useState } from 'react'
import { Button, Drawer, Space, Table, Tag, Tree, Typography, message } from 'antd'
import type { DataNode } from 'antd/es/tree'

import { Auth } from '../../../auth/Auth'
import { PERMISSION_MENU_TREE } from '../../../mock/permissions'
import { HOSPITAL_ROLES, type HospitalRoleDef } from '../../../mock/roles'
import { SystemRolesPage } from '../../SystemRolesPage'

const { Paragraph } = Typography

const LS_KEY = 'mep_mock_role_permissions_v1'

function loadOverrides(): Record<string, string[]> {
  try {
    const s = localStorage.getItem(LS_KEY)
    if (!s) return {}
    return JSON.parse(s) as Record<string, string[]>
  } catch {
    return {}
  }
}

function collectLeafKeys(nodes: DataNode[]): string[] {
  const out: string[] = []
  for (const n of nodes) {
    if (n.children?.length) {
      out.push(...collectLeafKeys(n.children as DataNode[]))
    } else if (typeof n.key === 'string' && !n.key.startsWith('mod-')) {
      out.push(n.key)
    }
  }
  return out
}

export function RoleManagementMockPage() {
  const [useRealApi, setUseRealApi] = useState(false)
  const leafKeys = useMemo(() => collectLeafKeys(PERMISSION_MENU_TREE as DataNode[]), [])
  const [overrides, setOverrides] = useState<Record<string, string[]>>(() => loadOverrides())
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<HospitalRoleDef | null>(null)
  const [checked, setChecked] = useState<string[]>([])

  const dataSource = HOSPITAL_ROLES.filter((r) => !r.name.includes('兼容'))

  if (useRealApi) {
    return (
      <div>
        <Button type="link" onClick={() => setUseRealApi(false)} style={{ marginBottom: 12 }}>
          返回 Mock 角色管理
        </Button>
        <SystemRolesPage />
      </div>
    )
  }

  function openDrawer(row: HospitalRoleDef) {
    setActive(row)
    const base = row.permissions.includes('*') ? leafKeys : row.permissions
    const merged = overrides[row.code] ?? base
    setChecked(merged.filter((k) => leafKeys.includes(k)))
    setOpen(true)
  }

  function saveDrawer() {
    if (!active) return
    if (active.permissions.includes('*')) {
      message.warning('平台管理员角色固定为全量权限 *')
      setOpen(false)
      return
    }
    const next = { ...overrides, [active.code]: checked }
    setOverrides(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
    message.success('权限分配已保存到浏览器本地（Mock）')
    setOpen(false)
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          演示环境：角色权限勾选结果保存在 localStorage（{LS_KEY}），与真实后端无关。
        </Paragraph>
        <Button onClick={() => setUseRealApi(true)}>切换真实 API 页</Button>
      </div>
      <Table<HospitalRoleDef>
        rowKey="code"
        pagination={false}
        dataSource={dataSource}
        columns={[
          { title: '角色名称', dataIndex: 'name', width: 160 },
          { title: '角色编码', dataIndex: 'code', width: 160 },
          {
            title: '数据范围',
            dataIndex: 'dataScope',
            width: 120,
            render: (v) => <Tag>{String(v)}</Tag>,
          },
          {
            title: '用户数量（示意）',
            key: 'cnt',
            width: 120,
            render: (_, r) => (r.code === 'PLATFORM_ADMIN' ? 1 : r.code === 'DEVICE_ENGINEER' ? 6 : 3),
          },
          { title: '说明', dataIndex: 'description', ellipsis: true },
          {
            title: '操作',
            key: 'op',
            width: 220,
            render: (_, row) => (
              <Space>
                <Auth permission="system:role:update">
                  <Button type="link" size="small" onClick={() => openDrawer(row)}>
                    分配菜单/按钮权限
                  </Button>
                </Auth>
                <Auth permission="system:role:update">
                  <Button type="link" size="small" onClick={() => message.info('数据范围：在完整版与科室主数据联动')}>
                    数据权限
                  </Button>
                </Auth>
              </Space>
            ),
          },
        ]}
      />

      <Drawer title={active ? `权限分配 — ${active.name}` : ''} width={480} open={open} onClose={() => setOpen(false)} destroyOnClose>
        <Paragraph type="secondary">勾选即为该角色授予对应菜单/按钮权限码。</Paragraph>
        <Tree
          checkable
          selectable={false}
          treeData={PERMISSION_MENU_TREE as DataNode[]}
          checkedKeys={checked}
          onCheck={(k) => setChecked(k as string[])}
          defaultExpandAll
        />
        <div style={{ marginTop: 16 }}>
          <Button type="primary" onClick={saveDrawer}>
            保存
          </Button>
        </div>
      </Drawer>
    </>
  )
}
