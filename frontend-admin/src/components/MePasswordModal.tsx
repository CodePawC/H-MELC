import { App, Form, Input, Modal } from 'antd'

import { changeMyPassword } from '../api/system'
import { ApiClientError } from '../lib/api'

type Props = {
  open: boolean
  onClose: () => void
}

export function MePasswordModal({ open, onClose }: Props) {
  const { message } = App.useApp()
  const [form] = Form.useForm<{ old_password: string; new_password: string }>()

  return (
    <Modal
      title="修改我的密码"
      open={open}
      destroyOnClose
      onCancel={() => {
        form.resetFields()
        onClose()
      }}
      okText="保存"
      cancelText="取消"
      onOk={async () => {
        try {
          const v = await form.validateFields()
          await changeMyPassword(v.old_password, v.new_password)
          message.success('密码已更新，请妥善保管')
          form.resetFields()
          onClose()
        } catch (e) {
          if (e && typeof e === 'object' && 'errorFields' in e) {
            return Promise.reject(e)
          }
          message.error(e instanceof ApiClientError ? e.message : '修改失败')
          return Promise.reject(e)
        }
      }}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="old_password" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="new_password"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '至少 8 位' },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
