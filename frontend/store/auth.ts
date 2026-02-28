'use client'

import { create } from 'zustand'
import type { AuthUser } from '@/lib/auth'
import { getMe, getToken, removeToken } from '@/lib/auth'

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  setAuth: (user: AuthUser, token: string) => void
  logout: () => void
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: (user, token) => set({ user, token, isLoading: false }),

  logout: () => {
    removeToken()
    set({ user: null, token: null, isLoading: false })
  },

  initialize: async () => {
    const token = getToken()
    if (!token) {
      set({ isLoading: false })
      return
    }
    try {
      const user = await getMe(token)
      set({ user, token, isLoading: false })
    } catch {
      removeToken()
      set({ user: null, token: null, isLoading: false })
    }
  },
}))
