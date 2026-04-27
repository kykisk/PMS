import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/api/auth.api'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (tokens) => set(tokens),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'pms-auth' },
  ),
)
