import { useNavigate } from 'react-router-dom'
import { Avatar, Button, Dropdown, Layout, Menu, Modal, Typography } from 'antd'
import {
  BankOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileProtectOutlined,
  LogoutOutlined,
  ProjectOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useAuthStore } from './stores/authStore'
import { clearToken } from './lib/token'

const { Header, Sider, Content } = Layout
const { Text } = Typography

type MenuItem = { key: string; icon: React.ReactNode; label: string }

const menuItems: MenuItem[] = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '首页' },
  { key: '/projects', icon: <ProjectOutlined />, label: '项目中心' },
  { key: '/invoices', icon: <FileProtectOutlined />, label: '发票管理' },
  { key: '/payments', icon: <DollarOutlined />, label: '付款进度' },
  { key: '/qualifications', icon: <SafetyCertificateOutlined />, label: '资质管理' },
  { key: '/about', icon: <BankOutlined />, label: '关于' },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const nav = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const handleLogout = () => {
    clearToken()
    setUser(null)
    nav('/login')
  }

  const handleMenuClick = (key: string) => {
    if (key === '/about') {
      Modal.info({
        title: '供应商协同门户',
        content: (
          <div>
            <p>H-MELC 医院医学装备全生命周期闭环管理平台</p>
            <p>版本: 0.1.0</p>
            <p>© 2026 CodePawC</p>
          </div>
        ),
      })
      return
    }
    nav(key)
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" collapsible>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: 16 }}>
          <BankOutlined style={{ marginRight: 8 }} /> 供应商门户
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[window.location.pathname]}
          items={menuItems.map((item) => ({ key: item.key, icon: item.icon, label: item.label }))}
          onClick={({ key }) => handleMenuClick(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderBottom: '1px solid #f0f0f0' }}>
          <Dropdown menu={{
            items: [
              { key: 'user', label: `${user?.legal_name || user?.username || ''}`, disabled: true },
              { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
            ],
            onClick: ({ key }) => { if (key === 'logout') handleLogout() },
          }}>
            <Button type="text" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar size="small" icon={<UserOutlined />} />
              <Text>{user?.legal_name || user?.username || '供应商'}</Text>
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
