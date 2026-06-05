import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Form, Input, Typography, App } from 'antd'
import { BankOutlined } from '@ant-design/icons'
import { loginSupplier } from '../api/supplierPortal'
import { setToken } from '../lib/token'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography

export function LoginPage() {
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()
  const { message } = App.useApp()
  const setUser = useAuthStore((s) => s.setUser)

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const result = await loginSupplier(values.username, values.password)
      setToken(result.access_token)
      setUser(result.user)
      message.success('登录成功')
      nav('/dashboard')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' }}>
      <Card style={{ width: 420, borderRadius: 10 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <BankOutlined style={{ fontSize: 48, color: '#1677ff' }} />
          <Title level={3} style={{ marginTop: 12 }}>供应商协同门户</Title>
          <Text type="secondary">H-MELC 医院医学装备平台</Text>
        </div>
        <Form layout="vertical" onFinish={handleLogin} autoComplete="off">
          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input placeholder="供应商账号" size="large" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="密码" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
