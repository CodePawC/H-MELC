/**
 * 登录后会话（与 fetchMe 同步），供菜单、路由、按钮权限判断。
 */

import { create } from 'zustand'

import { hasPermission as checkPermission, hasAnyPermission } from '../auth/permission'
import type { AuthUserProfile } from '../types/authProfile'

export const useAuthSession = create<{
  me: AuthUserProfile | null
  /** 已尝试拉取会话（无论成败） */
  hydrated: boolean
  /** 最近一次拉取 /auth/me 失败原因（便于排查网关字段差异） */
  authLoadError: string | null
  setMe: (m: AuthUserProfile | null) => void
  setHydrated: (v: boolean) => void
  setAuthLoadError: (s: string | null) => void
  clear: () => void
  hasAnyRole: (codes: string[]) => boolean
  hasAllRoles: (codes: string[]) => boolean
  hasPermission: (code: string) => boolean
  hasAnyPermission: (codes: string[]) => boolean
}>((set, get) => ({
  me: null,
  hydrated: false,
  authLoadError: null,
  setMe: (m) => set({ me: m }),
  setHydrated: (v) => set({ hydrated: v }),
  setAuthLoadError: (s) => set({ authLoadError: s }),
  clear: () => set({ me: null, hydrated: false, authLoadError: null }),
  hasAnyRole: (codes) => {
    const r = get().me?.roles ?? []
    return codes.some((c) => r.includes(c))
  },
  hasAllRoles: (codes) => {
    const r = get().me?.roles ?? []
    return codes.every((c) => r.includes(c))
  },
  hasPermission: (code) => checkPermission(get().me?.permissions, code),
  hasAnyPermission: (codes) => hasAnyPermission(get().me?.permissions, codes),
}))
