import { useMemo, useState } from 'react'
import { Button, Form, Input, Modal, Select, Space, Switch, Tag, message } from 'antd'
import type { ProColumns } from '@ant-design/pro-components'
import { ProTable } from '@ant-design/pro-components'

import { Auth } from '../../../auth/Auth'
import { HOSPITAL_ROLES } from '../../../mock/roles'
import { MOCK_ACCOUNTS, type MockAccountRecord } from '../../../mock/users'
import { SystemUsersPage } from '../../SystemUsersPage'

type Row = MockAccountRecord & { key: string }

export function UserManagementMockPage() {
  const [useRealApi, setUseRealApi] = useState(false)
  const [rows, setRows] = useState<Row[]>(() => MOCK_ACCOUNTS.map((a) => ({ ...a, key: a.id })))
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form] = Form.useForm()

  const roleOptions = useMemo(
    () => HOSPITAL_ROLES.filter((r) => !r.name.includes('兼容')).map((r) => ({ label: r.name, value: r.code })),
    [],
  )

  if (useRealApi) {
    return (
      <div>
        <Button type="link" onClick={() => setUseRealApi(false)} style={{ marginBottom: 12 }}>
          返回 Mock 用户管理
        </Button>
        <SystemUsersPage />
      </div>
    )
  }

  const columns: ProColumns<Row>[] = [
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: '姓名', dataIndex: 'displayName', width: 120, ellipsis: true },
    { title: '手机', dataIndex: 'phone', width: 130, search: false },
    {
      title: '科室',
      dataIndex: 'departmentNames',
      ellipsis: true,
      search: false,
      render: (_, r) => (r.departmentNames?.length ? r.departmentNames.join('、') : '—'),
    },
    {
      title: '角色',
      dataIndex: 'roles',
      search: false,
      render: (_, r) => (
        <Space wrap size={[4, 4]}>
          {r.roles.map((x) => (
            <Tag key={x} color="blue">
              {x}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'disabled',
      valueType: 'select',
      valueEnum: {
        false: { text: '正常', status: 'Success' },
        true: { text: '禁用', status: 'Error' },
      },
    },
    { title: '最近登录', dataIndex: 'lastLoginAt', width: 170, search: false },
    {
      title: '操作',
      valueType: 'option',
      width: 220,
      render: (_, record) => [
        <Auth key="edit" permission="system:user:update">
          <Button type="link" size="small" onClick={() => onEdit(record)}>
            编辑
          </Button>
        </Auth>,
        <Auth key="role" permission="system:user:update">
          <Button type="link" size="small" onClick={() => onEdit(record)}>
            分配角色
          </Button>
        </Auth>,
        <Auth key="pwd" permission="system:user:update">
          <Button type="link" size="small" danger onClick={() => message.info('演示环境：重置为默认口令')}>
            重置密码
          </Button>
        </Auth>,
      ],
    },
  ]

  function onEdit(r: Row) {
    setEditing(r)
    form.setFieldsValue({
      displayName: r.displayName,
      phone: r.phone,
      roles: r.roles,
      disabled: r.disabled,
    })
    setOpen(true)
  }

  function onSave() {
    form.validateFields().then((v) => {
      if (!editing) return
      setRows((prev) =>
        prev.map((x) =>
          x.id === editing.id
            ? {
                ...x,
                displayName: v.displayName,
                phone: v.phone,
                roles: v.roles,
                disabled: v.disabled,
              }
            : x,
        ),
      )
      message.success('已保存（仅前端 Mock）')
      setOpen(false)
    })
  }

  return (
    <>
      <ProTable<Row>
        rowKey="key"
        headerTitle="用户管理（Mock）"
        columns={columns}
        dataSource={rows}
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10 }}
        toolBarRender={() => [
          <Auth key="add" permission="system:user:create">
            <Button type="primary" onClick={() => message.info('演示：请使用预置账号登录')}>
              新增用户
            </Button>
          </Auth>,
          <Button key="api" onClick={() => setUseRealApi(true)}>
            切换真实 API 页
          </Button>,
        ]}
      />

      <Modal title={editing ? `编辑用户 — ${editing.username}` : '用户'} open={open} onCancel={() => setOpen(false)} onOk={onSave} destroyOnClose width={520}>
        <Form form={form} layout="vertical">
          <Form.Item name="displayName" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>
          <Form.Item name="roles" label="角色" rules={[{ required: true }]}>
            <Select mode="multiple" options={roleOptions} />
          </Form.Item>
          <Form.Item name="disabled" label="禁用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
