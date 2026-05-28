import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Space,
  Tabs,
  Typography,
  theme,
} from 'antd'
import {
  LockOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  MedicineBoxOutlined,
  BankOutlined,
} from '@ant-design/icons'

import { LoginError, createMathCaptcha, performLogin } from '../../auth/login'
import { logoutSession } from '../../auth/logout'
import { fetchMe } from '../../api/auth'
import { APP_VERSION_LABEL, IS_AUTH_MOCK } from '../../config/authMode'
import { ApiClientError } from '../../lib/api'
import { getAccessToken } from '../../lib/token'
import { useAuthSession } from '../../stores/authSession'

const { Title, Text, Paragraph } = Typography

type LocState = { from?: { pathname?: string } }

type Persona = 'admin' | 'clinical' | 'supplier' | 'finance'

export function LoginPage() {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const [searchParams] = useSearchParams()
  const reason = searchParams.get('reason')
  const forceRelogin = reason === 'session_expired' || reason === 'unauthorized'
  const state = loc.state as LocState | undefined
  const [busy, setBusy] = useState(false)
  const setMe = useAuthSession((s) => s.setMe)
  const setHydrated = useAuthSession((s) => s.setHydrated)
  const setAuthLoadError = useAuthSession((s) => s.setAuthLoadError)
  const captchaRef = useRef(createMathCaptcha())
  const [captcha, setCaptcha] = useState(captchaRef.current)

  const [form] = Form.useForm()

  useEffect(() => {
    if (forceRelogin) {
      logoutSession()
      message.warning('登录已失效，请重新登录')
    }
  }, [forceRelogin, message])

  if (getAccessToken() && !forceRelogin) {
    return <Navigate to={state?.from?.pathname ?? '/'} replace />
  }

  const presets = useMemo(
    () =>
      ({
        // 本地 dev 预填与 bootstrap 默认口令一致；生产构建不写入密码
        admin: { username: 'admin', password: IS_AUTH_MOCK || import.meta.env.DEV ? 'admin123' : '' },
        clinical: { username: 'nurse', password: IS_AUTH_MOCK ? '123456' : '' },
        supplier: { username: 'supplier', password: IS_AUTH_MOCK ? '123456' : '' },
        finance: { username: 'finance', password: IS_AUTH_MOCK ? '123456' : '' },
      }) satisfies Record<Persona, { username: string; password: string }>,
    [],
  )

  function applyPersona(p: Persona) {
    form.setFieldsValue(presets[p])
  }

  function refreshCaptcha() {
    captchaRef.current = createMathCaptcha()
    setCaptcha(captchaRef.current)
    form.setFieldValue('captcha', undefined)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        background: '#f5f7fa',
      }}
    >
      <Row style={{ width: '100%', maxWidth: 1100, margin: 'auto', padding: '32px 16px' }} gutter={[0, 0]}>
        <Col xs={0} md={11} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: 32 }}>
          <Space align="start" size={16} style={{ marginBottom: 24 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: 'linear-gradient(145deg, #1677ff 0%, #0958d9 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(22,119,255,0.35)',
              }}
            >
              <MedicineBoxOutlined style={{ fontSize: 30, color: '#fff' }} />
            </div>
            <div>
              <Title level={3} style={{ color: '#1f2937', marginBottom: 4 }}>
                医院医学装备全生命周期闭环管理平台
              </Title>
              <Text style={{ color: '#6b7280', fontSize: 13 }}>
                Hospital Medical Equipment Lifecycle Closed-loop Management Platform
              </Text>
            </div>
          </Space>
          <div style={{ marginTop: 8 }}>
            <Text style={{ color: '#374151', fontSize: 16 }}>
              <BankOutlined style={{ marginRight: 8, color: '#1677ff' }} />
              五莲县人民医院
            </Text>
          </div>
          <Paragraph style={{ color: '#6b7280', marginTop: 24, maxWidth: 400, fontSize: 13, lineHeight: 1.8 }}>
            面向医学装备全生命周期闭环管理场景：申请论证、采购验收、建档使用、维修保养、计量监管、效益评价与报废处置。请使用院内账号或供应商门户账号登录。
          </Paragraph>
          <div style={{ marginTop: 'auto', paddingTop: 48, color: '#9ca3af', fontSize: 12 }}>
            <SafetyCertificateOutlined style={{ color: '#1677ff' }} /> 等保与院内网络安全规范适用区域，请勿在公共设备勾选「记住我」。
          </div>
        </Col>

        <Col xs={24} md={13}>
          <Card
            bordered={false}
            style={{
              borderRadius: token.borderRadiusLG * 1.5,
              border: '1px solid #e8eaef',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.04)',
              background: '#ffffff',
            }}
            styles={{ body: { padding: '32px 28px 24px' } }}
          >
            <Title level={4} style={{ marginTop: 0, marginBottom: 4 }}>
              用户登录
            </Title>
            <Text type="secondary">请输入工号/登录名与密码</Text>

            <Tabs
              style={{ marginTop: 20 }}
              items={[
                {
                  key: 'admin',
                  label: '管理员 / 设备科',
                  children: null,
                },
                { key: 'clinical', label: '科室用户', children: null },
                { key: 'supplier', label: '供应商', children: null },
                { key: 'finance', label: '财务', children: null },
              ]}
              onChange={(k) => applyPersona(k as Persona)}
            />

            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              initialValues={{ remember: true, ...presets.admin }}
              onFinish={async (v: {
                username: string
                password: string
                captcha: string
                remember: boolean
              }) => {
                setBusy(true)
                try {
                  await performLogin({
                    username: v.username.trim(),
                    password: v.password,
                    remember: !!v.remember,
                    captchaExpected: captcha.answer,
                    captchaInput: v.captcha,
                  })
                  const me = await fetchMe()
                  setMe(me)
                  setHydrated(true)
                  setAuthLoadError(null)
                  message.success('登录成功')
                  const target = state?.from?.pathname
                  if (me.portalOnly) {
                    const portalTarget = (path: string | undefined) => {
                      if (!path || path === '/') return '/supplier-portal/dashboard'
                      if (path.startsWith('/supplier-portal')) return path
                      const legacy: Record<string, string> = {
                        '/portal/home': '/supplier-portal/dashboard',
                        '/portal/invoices': '/supplier-portal/invoices',
                        '/portal/payments': '/supplier-portal/payments',
                        '/portal/quotations': '/supplier-portal/quotes',
                      }
                      return legacy[path] ?? '/supplier-portal/dashboard'
                    }
                    nav(portalTarget(target), { replace: true })
                  } else {
                    const blocked = target?.startsWith('/portal') || target?.startsWith('/supplier-portal')
                    nav(target && !blocked ? target : '/', { replace: true })
                  }
                } catch (e) {
                  refreshCaptcha()
                  if (e instanceof LoginError) {
                    message.error(e.message)
                  } else {
                    message.error(e instanceof ApiClientError ? e.message : '登录失败')
                  }
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input prefix={<UserOutlined />} autoComplete="username" size="large" placeholder="工号 / 登录名" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password
                  prefix={<LockOutlined />}
                  autoComplete="current-password"
                  size="large"
                  placeholder="密码"
                />
              </Form.Item>
              <Form.Item
                label="验证码"
                required
                style={{ marginBottom: 8 }}
              >
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="captcha" noStyle rules={[{ required: true, message: '请输入验证码' }]}>
                    <Input size="large" placeholder={`计算：${captcha.question}`} style={{ flex: 1 }} />
                  </Form.Item>
                  <Button size="large" onClick={refreshCaptcha}>
                    刷新
                  </Button>
                </Space.Compact>
              </Form.Item>
              <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 12 }}>
                <Checkbox>记住我（公共电脑请勿勾选）</Checkbox>
              </Form.Item>
              <Form.Item style={{ marginBottom: 8 }}>
                <Button type="primary" htmlType="submit" size="large" block loading={busy}>
                  登录
                </Button>
              </Form.Item>
            </Form>

            <Divider plain style={{ margin: '12px 0', fontSize: 12 }}>
              快捷填充（演示）
            </Divider>
            <Space wrap size="small">
              <Button size="small" onClick={() => applyPersona('admin')}>
                平台管理员
              </Button>
              <Button
                size="small"
                onClick={() => form.setFieldsValue({ username: 'director', password: IS_AUTH_MOCK ? '123456' : '' })}
              >
                设备科主任
              </Button>
              <Button
                size="small"
                onClick={() => form.setFieldsValue({ username: 'engineer', password: IS_AUTH_MOCK ? '123456' : '' })}
              >
                设备科工程师
              </Button>
              <Button size="small" onClick={() => applyPersona('clinical')}>
                科室护士长
              </Button>
              <Button size="small" onClick={() => applyPersona('supplier')}>
                供应商
              </Button>
              <Button size="small" onClick={() => applyPersona('finance')}>
                财务
              </Button>
            </Space>

            <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 20, marginBottom: 0 }}>
              {IS_AUTH_MOCK ? (
                <>
                  当前为 <Text code>VITE_AUTH_MOCK</Text> 模式：预置账号见{' '}
                  <Text code>admin / admin123</Text> 等。关闭 Mock 后走真实 <Text code>/api/v1/auth/login</Text>。
                </>
              ) : (
                <>
                  生产环境对接 PostgreSQL 身份库与 JWT；首次部署请执行迁移并预置账号。
                </>
              )}
            </Paragraph>
            <div style={{ marginTop: 16, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
              <div>技术支持：信息科 / 医学装备科 · 版本 {APP_VERSION_LABEL}</div>
              <div style={{ marginTop: 4 }}>© {new Date().getFullYear()} 五莲县人民医院 · 保留所有权利</div>
            </div>
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <Link to="/">返回工作台（需已登录）</Link>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
