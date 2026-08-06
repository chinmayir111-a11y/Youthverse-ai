import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, tokenStore, AUTH_EXPIRED_EVENT } from '../lib/api'
import type { Profile, User } from '../types'

interface AuthState {
  user: User | null
  profile: Profile | null
  /** True until the initial "am I logged in?" check settles. */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => void
  setProfile: (profile: Profile) => void
  setUser: (user: User) => void
}

export interface RegisterInput {
  name: string
  email: string
  password: string
  role?: 'student' | 'mentor'
}

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setProfile(null)
  }, [])

  // Restore the session on page load. Without this, a refresh would log the
  // user out even though their token is still valid.
  useEffect(() => {
    const token = tokenStore.get()
    if (!token) {
      setLoading(false)
      return
    }

    let cancelled = false
    api
      .get('/auth/me')
      .then(({ data }) => {
        if (cancelled) return
        setUser(data.data.user)
        setProfile(data.data.profile)
      })
      .catch(() => {
        if (!cancelled) logout()
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [logout])

  // The axios interceptor fires this when the server rejects our token.
  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, logout)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, logout)
  }, [logout])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    tokenStore.set(data.data.token)
    setUser(data.data.user)
    // Login doesn't return the profile; fetch it so the UI is complete.
    const me = await api.get('/auth/me')
    setProfile(me.data.data.profile)
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const { data } = await api.post('/auth/register', input)
    tokenStore.set(data.data.token)
    setUser(data.data.user)
    setProfile(data.data.profile)
  }, [])

  const value = useMemo<AuthState>(
    () => ({ user, profile, loading, login, register, logout, setProfile, setUser }),
    [user, profile, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
