/**
 * 全局壳层偏好（Ant Design Pro 扩展位：表格默认分页等）
 */

import { create } from 'zustand'

export const useAppShellStore = create<{
  defaultPageSize: number
  setDefaultPageSize: (n: number) => void
}>()((set) => ({
  defaultPageSize: 20,
  setDefaultPageSize: (n) => set({ defaultPageSize: Math.min(100, Math.max(5, n)) }),
}))
