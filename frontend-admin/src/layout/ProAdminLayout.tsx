import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ProLayout } from '@ant-design/pro-components'
import { Alert, ConfigProvider } from 'antd'

import { hospitalContentLightTheme } from '../theme/enterpriseTheme'

import { logoutSession } from '../auth/logout'
import { fetchMe } from '../api/auth'
import { ApiClientError } from '../lib/api'
import { APP_VERSION_LABEL } from '../config/authMode'
import { ADMIN_MENU_GROUPS, filterMenuForProfile } from '../navigation/menu'
import { useAuthSession } from '../stores/authSession'
import { RepairAiFloatingAssistant } from '../components/RepairAiFloatingAssistant'
import { buildProLayoutRouteFromGroups, proLayoutLogo } from './buildProRoute'
import { HospitalHeaderBar } from './HospitalHeaderBar'

function HospitalFooterStatusBar() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="hospital-footer-status-bar">
      <span className="hospital-footer-status-bar__brand">
        H-MELC · 医院医学装备全生命周期闭环管理平台 · {APP_VERSION_LABEL}
      </span>
      <span className="hospital-footer-status-bar__group" aria-label="系统心跳正常">
        <i className="hospital-footer-heartbeat" />
        <span>HEARTBEAT</span>
        <strong>ONLINE</strong>
      </span>
      <span className="hospital-footer-status-bar__group hospital-footer-status-bar__time">
        <span>LOCAL TIME</span>
        <strong>{now.toLocaleString('zh-CN', { hour12: false })}</strong>
      </span>
      <span className="hospital-footer-status-bar__group">
        <span>SESSION</span>
        <strong>JWT ACTIVE</strong>
      </span>
    </div>
  )
}

export function ProAdminLayout() {
  const location = useLocation()

  const me = useAuthSession((s) => s.me)
  const setMe = useAuthSession((s) => s.setMe)
  const setHydrated = useAuthSession((s) => s.setHydrated)
  const setAuthLoadError = useAuthSession((s) => s.setAuthLoadError)

  const [err, setErr] = useState<string | null>(null)

  const filteredGroups = useMemo(() => filterMenuForProfile(ADMIN_MENU_GROUPS, me), [me])
  const route = useMemo(() => buildProLayoutRouteFromGroups(filteredGroups), [filteredGroups])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const m = await fetchMe()
        if (!cancelled) {
          setMe(m)
          setErr(null)
          setAuthLoadError(null)
        }
      } catch (e) {
        const msg = e instanceof ApiClientError ? e.message : '无法加载当前用户'
        if (!cancelled) {
          setErr(msg)
          setAuthLoadError(msg)
          const sessionLost =
            e instanceof ApiClientError &&
            (/登录状态|失效|重新登录|未提供访问令牌|令牌无效|Unauthorized|unauthorized|Not authenticated|credentials|invalid token|token expired|expired/i.test(
              msg,
            ) ||
              /Could not validate credentials|Not enough permissions/i.test(msg))
          if (sessionLost) {
            setMe(null)
          }
        }
      } finally {
        setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setMe, setHydrated, setAuthLoadError])

  return (
    <>
      <ProLayout
        title="医院医学装备全生命周期闭环管理平台"
        logo={proLayoutLogo}
        layout="side"
        navTheme="realDark"
        fixedHeader={false}
        fixSiderbar
        siderWidth={232}
        contentWidth="Fluid"
        menu={{ defaultOpenAll: true }}
        route={route}
        location={location}
        menuHeaderRender={(logo, title) => (
          <Link to="/" className="hospital-sider-brand">
            {logo}
            <span className="hospital-sider-brand__text">
              <strong>{title}</strong>
              <em>{APP_VERSION_LABEL}</em>
            </span>
          </Link>
        )}
        token={{
          header: {
            heightLayoutHeader: 56,
            colorBgHeader: '#ffffff',
            colorHeaderTitle: '#1f2937',
          },
          sider: {
            colorMenuBackground: '#08233f',
            colorTextMenu: 'rgba(255, 255, 255, 0.82)',
            colorTextMenuSecondary: 'rgba(255, 255, 255, 0.45)',
            colorTextMenuSelected: '#ffffff',
            colorBgMenuItemHover: 'rgba(255, 255, 255, 0.08)',
            colorBgMenuItemSelected: '#1677ff',
          },
          pageContainer: {
            paddingBlockPageContainerContent: 0,
            paddingInlinePageContainerContent: 0,
          },
        }}
        menuItemRender={(item, dom) => {
          const it = item as { path?: string; routes?: unknown[]; children?: unknown[] }
          const hasSub = (it.routes?.length ?? 0) > 0 || (it.children?.length ?? 0) > 0
          if (hasSub) return dom
          if (!it.path) return dom
          return <Link to={it.path}>{dom}</Link>
        }}
        footerRender={() => <HospitalFooterStatusBar />}
        contentStyle={{
          background: '#f5f7fa',
          minHeight: '100vh',
          padding: 0,
        }}
      >
        <div className="hospital-main-column">
          <div className="hospital-main-chrome">
            <HospitalHeaderBar groups={filteredGroups} />
            {err ? (
              <Alert
                banner
                type="warning"
                showIcon
                style={{ margin: 0, borderRadius: 0, flexShrink: 0 }}
                message={err}
                action={
                  <Link
                    to="/login?reason=session_expired"
                    onClick={() => logoutSession()}
                    style={{ fontWeight: 600 }}
                  >
                    重新登录
                  </Link>
                }
              />
            ) : null}
          </div>
          <div className="hospital-main-scroll">
            {/* ProLayout navTheme=realDark 会向内容区串联暗色变量；此处强制浅色算法 + token，保证表格/卡片白底 */}
            <ConfigProvider theme={hospitalContentLightTheme}>
              <Outlet />
              <RepairAiFloatingAssistant />
            </ConfigProvider>
          </div>
        </div>
      </ProLayout>
    </>
  )
}
