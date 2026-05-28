import { clearAuthProfile } from '../lib/authProfileStorage'
import { clearAccessToken } from '../lib/token'
import { useAuthSession } from '../stores/authSession'

export function logoutSession() {
  clearAccessToken()
  clearAuthProfile()
  useAuthSession.getState().clear()
}
