import { Navigate } from 'react-router-dom'

import { useAuthSession } from '../stores/authSession'
import { HomeHospitalDashboard } from './hospital/HomeHospitalDashboard'

/** 院内综合驾驶舱；供应商账号跳转门户首页 */
export function HomePage() {
  const me = useAuthSession((s) => s.me)
  if (me?.portalOnly) {
    return <Navigate to="/supplier-portal/dashboard" replace />
  }
  return <HomeHospitalDashboard />
}
