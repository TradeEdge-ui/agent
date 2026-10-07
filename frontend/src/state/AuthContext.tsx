import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchMe, login as loginApi, register as registerApi } from '../services/auth'
import type { Me } from '../types'

interface AuthContextValue {
  me: Me | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (payload: { email: string; password: string; full_name: string; business_name: string }) => Promise<void>
  logout: () => void
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setMe(null)
      setLoading(false)
      return
    }
    try {
      const data = await fetchMe()
      setMe(data)
    } catch {
      localStorage.removeItem('access_token')
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshMe()
  }, [refreshMe])

  const login = useCallback(
    async (email: string, password: string) => {
      const token = await loginApi(email, password)
      localStorage.setItem('access_token', token)
      await refreshMe()
    },
    [refreshMe]
  )

  const register = useCallback(
    async (payload: { email: string; password: string; full_name: string; business_name: string }) => {
      const token = await registerApi(payload)
      localStorage.setItem('access_token', token)
      await refreshMe()
    },
    [refreshMe]
  )

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    setMe(null)
  }, [])

  return (
    <AuthContext.Provider value={{ me, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
