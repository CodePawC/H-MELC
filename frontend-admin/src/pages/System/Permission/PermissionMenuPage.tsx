/**
 * 菜单与按钮权限树（Mock）：勾选后写入 localStorage，供演示「授权」流程。
 */

import { useMemo, useState } from 'react'
import { Alert, Button, Card, Space, Tree, Typography, message } from 'antd'
import type { DataNode } from 'antd/es/tree'

import { PERMISSION_MENU_TREE } from '../../../mock/permissions'

const { Title, Paragraph } = Typography
const LS_KEY = 'mep_mock_global_menu_checked_v1'

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

export function PermissionMenuPage() {
  const leafKeys = useMemo(() => collectLeafKeys(PERMISSION_MENU_TREE as DataNode[]), [])
  const [checked, setChecked] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) return JSON.parse(raw) as string[]
    } catch {
      /* ignore */
    }
    return leafKeys
  })

  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(checked))
    message.success('已保存菜单/按钮权限勾选集（Mock，仅本机浏览器）')
  }

  return (
    <Card>
      <Title level={4}>菜单权限（树形）</Title>
      <Paragraph type="secondary">
        将平台功能拆为模块 / 页面 / 按钮（权限码）。可与「角色管理」中的分配联动扩展；此处为全局勾选演示。
      </Paragraph>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="生产环境应由后端持久化 RBAC，并与 JWT / 会话中的 permissions 对齐。"
      />
      <Tree
        checkable
        selectable={false}
        treeData={PERMISSION_MENU_TREE as DataNode[]}
        checkedKeys={checked}
        onCheck={(k) => setChecked(k as string[])}
        defaultExpandAll
      />
      <Space style={{ marginTop: 24 }}>
        <Button type="primary" onClick={save}>
          保存勾选
        </Button>
        <Button onClick={() => setChecked(leafKeys)}>全选</Button>
        <Button onClick={() => setChecked([])}>全不选</Button>
      </Space>
    </Card>
  )
}
