import { useEffect, useState } from 'react'
import { Card, Result, Spin, Table, Typography } from 'antd'

import { fetchRoleCatalog } from '../api/system'
import type { RoleCatalogItem } from '../api/system'
import { ApiClientError } from '../lib/api'
import { useAuthSession } from '../stores/authSession'

const { Paragraph } = Typography

const VIEW_ROLES = ['SYS_ADMIN', 'DEVICE_ADMIN', 'AUDIT_ADMIN']

/** docs/06 §十三·7 角色目录（只读） */

export function SystemRolesPage() {
  const canView = useAuthSession((s) => s.hasAnyRole(VIEW_ROLES))
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [items, setItems] = useState<RoleCatalogItem[]>([])

  useEffect(() => {
    if (!canView) return
    let c = false
    setLoading(true)
    setErr(null)
    fetchRoleCatalog()
      .then((d) => {
        if (!c) setItems(d.items)
      })
      .catch((e) => {
        if (!c) setErr(e instanceof ApiClientError ? e.message : String(e))
      })
      .finally(() => {
        if (!c) setLoading(false)
      })
    return () => {
      c = true
    }
  }, [canView])

  if (!canView) {
    return (
      <Result
        status="403"
        title="无权访问"
        subTitle="角色目录需要 SYS_ADMIN、DEVICE_ADMIN 或 AUDIT_ADMIN。"
      />
    )
  }

  return (
    <Card bordered={false} title="角色与权限说明">
      <Paragraph type="secondary">
        以下为院内 Phase 0 角色编码，与后端 <Typography.Text code>rbac.py</Typography.Text> 及{' '}
        <Typography.Text code>docs/01_需求文档/03</Typography.Text> 对齐；实际授权在用户管理中为账号绑定多角色。
      </Paragraph>
      {err && <Paragraph type="danger">{err}</Paragraph>}
      <Spin spinning={loading}>
        <Table<RoleCatalogItem>
          rowKey="code"
          pagination={false}
          columns={[
            { title: '角色编码', dataIndex: 'code', width: 160 },
            { title: '名称', dataIndex: 'name', width: 180 },
            { title: '说明', dataIndex: 'description' },
          ]}
          dataSource={items}
        />
      </Spin>
    </Card>
  )
}
