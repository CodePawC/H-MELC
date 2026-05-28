import { useEffect, useRef, useState } from 'react'
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Result,
  Select,
  Switch,
  Tag,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { ProTable } from '@ant-design/pro-components'
import type { ActionType, ProColumns } from '@ant-design/pro-components'

import {
  adminResetUserPassword,
  createSystemUser,
  fetchRoleCatalog,
  fetchSystemUsers,
  patchSystemUser,
  putSystemUserRoles,
} from '../api/system'
import type { RoleCatalogItem, SystemUserRow } from '../api/system'
import { ApiClientError } from '../lib/api'
import { useAuthSession } from '../stores/authSession'

const VIEW_ROLES = ['SYS_ADMIN', 'DEVICE_ADMIN', 'AUDIT_ADMIN']

/** docs/06 §十三；写操作仅 SYS_ADMIN（与 backend RBAC_SYSTEM_USER_WRITE 一致） */

export function SystemUsersPage() {
  const { message } = App.useApp()
  const actionRef = useRef<ActionType>(null)
  const canView = useAuthSession((s) => s.hasAnyRole(VIEW_ROLES))
  const canAdmin = useAuthSession((s) => s.hasAnyRole(['SYS_ADMIN']))

  const [catalog, setCatalog] = useState<RoleCatalogItem[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editRow, setEditRow] = useState<SystemUserRow | null>(null)
  const [rolesRow, setRolesRow] = useState<SystemUserRow | null>(null)
  const [pwdRow, setPwdRow] = useState<SystemUserRow | null>(null)

  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [rolesForm] = Form.useForm()
  const [pwdForm] = Form.useForm()

  useEffect(() => {
    if (!canView) return
    fetchRoleCatalog()
      .then((d) => setCatalog(d.items))
      .catch(() => setCatalog([]))
  }, [canView])

  const roleOptions = catalog.map((r) => ({ label: `${r.name} (${r.code})`, value: r.code }))

  const columns: ProColumns<SystemUserRow>[] = [
    {
      title: '关键字',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '登录名或显示名' },
    },
    {
      title: '用户名',
      dataIndex: 'username',
      copyable: true,
      width: 140,
      search: false,
    },
    {
      title: '显示名',
      dataIndex: 'display_name',
      ellipsis: true,
      search: false,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, r) =>
        r.is_active ? <Tag color="success">启用</Tag> : <Tag color="default">禁用</Tag>,
    },
    {
      title: '角色',
      dataIndex: 'role_codes',
      search: false,
      ellipsis: true,
      render: (_, r) =>
        r.role_codes.map((c) => (
          <Tag key={c} color="blue" style={{ marginBottom: 4 }}>
            {c}
          </Tag>
        )),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      search: false,
      render: (_, r) => r.created_at.replace('T', ' ').slice(0, 19),
    },
    {
      title: '操作',
      valueType: 'option',
      width: canAdmin ? 220 : 60,
      render: (_, r) => {
        const nodes = []
        if (canAdmin) {
          nodes.push(
            <a key="edit" onClick={() => { setEditRow(r); editForm.setFieldsValue({ display_name: r.display_name ?? '', is_active: r.is_active }) }}>
              编辑
            </a>,
            <a key="roles" onClick={() => { setRolesRow(r); rolesForm.setFieldsValue({ role_codes: r.role_codes }) }}>
              角色
            </a>,
            <a key="pwd" onClick={() => { setPwdRow(r); pwdForm.resetFields() }}>
              重置密码
            </a>,
          )
        }
        return nodes
      },
    },
  ]

  if (!canView) {
    return (
      <Result
        status="403"
        title="无权访问"
        subTitle="用户列表需要 SYS_ADMIN、DEVICE_ADMIN 或 AUDIT_ADMIN。"
      />
    )
  }

  return (
    <>
      <ProTable<SystemUserRow>
        headerTitle="用户管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        cardBordered
        search={{ labelWidth: 'auto' }}
        toolBarRender={() =>
          canAdmin
            ? [
                <Button
                  key="add"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    createForm.resetFields()
                    createForm.setFieldsValue({ is_active: true, role_codes: ['DEVICE_ADMIN'] })
                    setCreateOpen(true)
                  }}
                >
                  新建用户
                </Button>,
              ]
            : []
        }
        request={async (params) => {
          const { current = 1, pageSize = 20, keyword, is_active } = params
          const kw = typeof keyword === 'string' ? keyword : undefined
          const active =
            is_active === true || is_active === 'true'
              ? true
              : is_active === false || is_active === 'false'
                ? false
                : undefined
          try {
            const data = await fetchSystemUsers({
              page: current,
              page_size: pageSize,
              keyword: kw?.trim() || undefined,
              is_active: active,
            })
            return { data: data.items, success: true, total: data.total }
          } catch (e) {
            message.error(e instanceof ApiClientError ? e.message : String(e))
            return { data: [], success: false, total: 0 }
          }
        }}
        pagination={{ showSizeChanger: true, defaultPageSize: 20, showTotal: (t) => `共 ${t} 条` }}
        options={{ reload: true, density: true, setting: true }}
      />

      <Modal
        title="新建用户"
        open={createOpen}
        destroyOnClose
        onCancel={() => setCreateOpen(false)}
        okText="创建"
        onOk={async () => {
          try {
            const v = await createForm.validateFields()
            await createSystemUser({
              username: v.username.trim(),
              display_name: v.display_name?.trim() || null,
              initial_password: v.initial_password,
              role_codes: v.role_codes,
              is_active: v.is_active !== false,
            })
            message.success('用户已创建')
            setCreateOpen(false)
            actionRef.current?.reload()
          } catch (e) {
            if (e && typeof e === 'object' && 'errorFields' in e) return Promise.reject(e)
            message.error(e instanceof ApiClientError ? e.message : '创建失败')
            return Promise.reject(e)
          }
        }}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="username" label="登录名" rules={[{ required: true, min: 2 }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="display_name" label="显示名">
            <Input />
          </Form.Item>
          <Form.Item
            name="initial_password"
            label="初始密码"
            rules={[{ required: true, min: 8, message: '至少 8 位' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="role_codes" label="角色" rules={[{ required: true, message: '至少选一个角色' }]}>
            <Select mode="multiple" options={roleOptions} placeholder="选择角色" optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`编辑用户：${editRow?.username ?? ''}`}
        open={!!editRow}
        destroyOnClose
        onCancel={() => setEditRow(null)}
        onOk={async () => {
          if (!editRow) return
          try {
            const v = await editForm.validateFields()
            await patchSystemUser(editRow.id, {
              display_name: v.display_name?.trim() || null,
              is_active: v.is_active,
            })
            message.success('已保存')
            setEditRow(null)
            actionRef.current?.reload()
          } catch (e) {
            if (e && typeof e === 'object' && 'errorFields' in e) return Promise.reject(e)
            message.error(e instanceof ApiClientError ? e.message : '保存失败')
            return Promise.reject(e)
          }
        }}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="display_name" label="显示名">
            <Input />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`分配角色：${rolesRow?.username ?? ''}`}
        open={!!rolesRow}
        destroyOnClose
        width={520}
        onCancel={() => setRolesRow(null)}
        onOk={async () => {
          if (!rolesRow) return
          try {
            const v = await rolesForm.validateFields()
            if (!v.role_codes?.length) {
              message.warning('至少保留一个角色')
              return Promise.reject()
            }
            await putSystemUserRoles(rolesRow.id, v.role_codes)
            message.success('角色已更新')
            setRolesRow(null)
            actionRef.current?.reload()
          } catch (e) {
            if (e && typeof e === 'object' && 'errorFields' in e) return Promise.reject(e)
            message.error(e instanceof ApiClientError ? e.message : '更新失败')
            return Promise.reject(e)
          }
        }}
      >
        <Form form={rolesForm} layout="vertical">
          <Form.Item name="role_codes" label="角色" rules={[{ required: true }]}>
            <Select mode="multiple" options={roleOptions} optionFilterProp="label" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`重置密码：${pwdRow?.username ?? ''}`}
        open={!!pwdRow}
        destroyOnClose
        okText="确认重置"
        okButtonProps={{ danger: true }}
        onCancel={() => setPwdRow(null)}
        onOk={async () => {
          if (!pwdRow) return
          try {
            const v = await pwdForm.validateFields()
            await new Promise<void>((resolve, reject) => {
              Modal.confirm({
                title: '确认重置密码？',
                content: `将使用新密码覆盖用户「${pwdRow.username}」的登录口令。`,
                okText: '确认',
                okType: 'danger',
                cancelText: '取消',
                onOk: async () => {
                  await adminResetUserPassword(pwdRow.id, v.new_password)
                  resolve()
                },
                onCancel: () => reject(new Error('cancel')),
              })
            })
            message.success('密码已重置')
            setPwdRow(null)
            pwdForm.resetFields()
          } catch (e) {
            if (e instanceof Error && e.message === 'cancel') return Promise.reject(e)
            if (e && typeof e === 'object' && 'errorFields' in e) return Promise.reject(e)
            message.error(e instanceof ApiClientError ? e.message : '重置失败')
            return Promise.reject(e)
          }
        }}
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[{ required: true, min: 8, message: '至少 8 位' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
