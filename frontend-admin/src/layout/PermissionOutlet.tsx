import { Spin } from 'antd'
import { Outlet, useLocation } from 'react-router-dom'

import { canAccessPath } from '../auth/routeGuard'
import { Forbidden403Page } from '../pages/Exception/Forbidden403'
import { useAuthSession } from '../stores/authSession'

/**
 * 路由级权限：无菜单权限的直链访问返回 403。
 */
export function PermissionOutlet() {
  const { pathname } = useLocation()
  const me = useAuthSession((s) => s.me)
  const hydrated = useAuthSession((s) => s.hydrated)
  const authLoadError = useAuthSession((s) => s.authLoadError)

  // 已登录且登录页已写入 me 时，不再等待 layout 内 fetchMe（避免 Strict Mode 下 effect 被取消导致 hydrated 一直为 false、主区域空白）
  if (!me && !hydrated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" tip="加载权限与用户信息…" />
      </div>
    )
  }

  if (!me) {
    return (
      <Forbidden403Page
        title="未获取到用户信息"
        subTitle={
          <div style={{ maxWidth: 520, textAlign: 'left' }}>
            <p style={{ marginBottom: 8 }}>
              {authLoadError ??
                '布局内拉取 /api/v1/auth/me 未得到可解析的用户画像，或登录后会话未写入。请重新登录；若使用统一认证网关，请确认网关返回的 data 内含 id、username、roles 或 operator_name、permissions 等字段。'}
            </p>
            <p className="muted tiny" style={{ margin: 0 }}>
              仍失败时请打开浏览器开发者工具 Network，查看 <code>/api/v1/auth/me</code> 的响应体与 HTTP 状态码。
            </p>
          </div>
        }
      />
    )
  }

  if (!canAccessPath(pathname, me)) {
    return <Forbidden403Page />
  }

  return <Outlet />
}
