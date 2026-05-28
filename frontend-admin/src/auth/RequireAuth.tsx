import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { IS_AUTH_MOCK } from '../config/authMode'
import { logoutSession } from './logout'
import { readAuthProfile } from '../lib/authProfileStorage'
import { getAccessToken, isMockToken } from '../lib/token'

export function RequireAuth() {
  const loc = useLocation()
  const tok = getAccessToken()

  /** 关闭 Mock 后不应残留 MOCK_TOKEN，否则接口将全部失败 */
  if (!IS_AUTH_MOCK && tok && isMockToken(tok)) {
    logoutSession()
    return <Navigate to="/login" replace state={{ from: loc }} />
  }

  if (IS_AUTH_MOCK && tok && isMockToken(tok) && !readAuthProfile()) {
    logoutSession()
    return <Navigate to="/login?reason=session_expired" replace state={{ from: loc }} />
  }

  if (!tok) {
    return <Navigate to="/login" replace state={{ from: loc }} />
  }
  return <Outlet />
}
