import { create } from 'zustand'
import type { SupplierUserPublic } from '../types/supplier'

type AuthState = {
  user: SupplierUserPublic | null
  setUser: (user: SupplierUserPublic | null) => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  isAuthenticated: () => !!get().user,
}))
