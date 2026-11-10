import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'
import loginBg from '../assets/login-bg.jpg'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const cleanUser = username.trim()
    if (!cleanUser || !password) {
      setErrorMessage('Please enter both username and password.')
      return
    }

    try {
      setLoading(true)
      await login(cleanUser, password)

      // Redirect back to intended return URL or default welcome dashboard
      const params = new URLSearchParams(window.location.search)
      const returnUrl = params.get('returnUrl') || '/'
      window.location.href = returnUrl
    } catch (err: any) {
      console.error('Login failed:', err)
      if (err.response?.status === 429) {
        setErrorMessage(err.response?.data?.detail || 'Too many failed login attempts. Please wait 15 minutes before trying again.')
      } else if (err.response?.status === 401 || err.response?.status === 400) {
        setErrorMessage('Invalid username or password.')
      } else {
        setErrorMessage('Network error or server unreachable. Please verify your connection.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundImage: `url(${loginBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative'
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '2.5rem 2.2rem',
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 40, 80, 0.18), 0 10px 25px -5px rgba(0, 91, 170, 0.12)',
          border: '1.5px solid rgba(0, 174, 179, 0.25)',
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '1.15rem' }}>
            <img
              src={logo}
              alt="Viruj Chematrix Logo"
              style={{ height: '62px', width: 'auto', objectFit: 'contain' }}
            />
            <div style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.05 }}>
                <span style={{ fontSize: '1.95rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>
                  Viruj
                </span>
                <span style={{ fontSize: '1.95rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.03em' }}>
                  Chematrix
                </span>
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>
                DOE & QBD PLATFORM
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '0.75rem 0.9rem',
              borderRadius: '8px',
              fontSize: '0.84rem',
              marginBottom: '1.4rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              lineHeight: 1.45
            }}
          >
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Username Field */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="username"
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '0.45rem'
              }}
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              disabled={loading}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. scientist or admin"
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                fontSize: '0.9rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                outline: 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                background: '#ffffff'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 91, 170, 0.15)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <label
                htmlFor="password"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#334155'
                }}
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  padding: 0,
                  fontWeight: 600
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                fontSize: '0.9rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                outline: 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                background: '#ffffff'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 91, 170, 0.15)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              fontSize: '0.94rem',
              fontWeight: 700,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255, 255, 255, 0.4)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite'
                  }}
                />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

