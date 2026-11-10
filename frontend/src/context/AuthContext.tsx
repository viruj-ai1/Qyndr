import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Auth, UserProfile } from '../services/api'

interface AuthContextType {
  user: UserProfile | null
  token: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('qyndr_auth_token'))
  const [loading, setLoading] = useState<boolean>(true)

  // Verify and restore session on mount
  useEffect(() => {
    let isCancelled = false

    const checkSession = async () => {
      try {
        const profile = await Auth.me()
        if (!isCancelled) {
          setUser(profile)
        }
      } catch (err) {
        if (!isCancelled) {
          setUser(null)
          setToken(null)
          localStorage.removeItem('qyndr_auth_token')
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    checkSession()

    // Listen for 401 unauthorized events emitted from Axios interceptor
    const handleUnauthorized = () => {
      setUser(null)
      setToken(null)
      localStorage.removeItem('qyndr_auth_token')
      if (window.location.pathname !== '/login') {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search)
        window.history.replaceState(null, '', `/login?returnUrl=${returnUrl}`)
      }
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => {
      isCancelled = true
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
    }
  }, [])

  const login = async (username: string, password: string) => {
    const res = await Auth.login(username, password)
    setUser(res.user)
    setToken(res.access_token)
    localStorage.setItem('qyndr_auth_token', res.access_token)
  }

  const logout = async () => {
    try {
      await Auth.logout()
    } catch (err) {
      // Ignore network errors on logout
    } finally {
      setUser(null)
      setToken(null)
      localStorage.removeItem('qyndr_auth_token')
      window.history.replaceState(null, '', '/login')
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
