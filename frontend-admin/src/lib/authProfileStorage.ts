/**
 * 会话用户画像持久化（供 Mock 模式刷新后 /auth/me 等价读取；与 token 并存）。
 */

import type { AuthUserProfile } from '../types/authProfile'

const KEY = 'mep_auth_profile_v1'

export function persistAuthProfile(profile: AuthUserProfile) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(profile))
  } catch {
    /* ignore quota */
  }
}

export function readAuthProfile(): AuthUserProfile | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUserProfile
  } catch {
    return null
  }
}

export function clearAuthProfile() {
  sessionStorage.removeItem(KEY)
}
