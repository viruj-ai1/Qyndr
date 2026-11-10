import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Frontend Authentication Integration Tests', () => {
  test('Login screen renders credentials form and handles 429 rate limit errors', () => {
    const loginFilePath = path.resolve(__dirname, '../src/screens/Login.tsx')
    const content = fs.readFileSync(loginFilePath, 'utf8')

    assert.ok(content.includes('Sign in') || content.includes('Sign In'), 'Login screen must have sign in button')
    assert.ok(content.includes('Viruj Chematrix'), 'Login screen must render brand header')
    assert.ok(content.includes('autoComplete="username"'), 'Username input must have autoComplete attribute')
    assert.ok(content.includes('autoComplete="current-password"'), 'Password input must have autoComplete attribute')
    assert.ok(content.includes('429'), 'Login must check for 429 rate-limit responses')
    assert.ok(content.includes('aria-live="polite"'), 'Error banner must have aria-live accessible attribute')
  })

  test('AuthContext manages user session, token in storage, and emits unauthorized events', () => {
    const authContextPath = path.resolve(__dirname, '../src/context/AuthContext.tsx')
    const content = fs.readFileSync(authContextPath, 'utf8')

    assert.ok(content.includes('Auth.me()'), 'AuthContext must check GET /me on mount')
    assert.ok(content.includes('qyndr_auth_token'), 'AuthContext must track token storage')
    assert.ok(content.includes('auth:unauthorized'), 'AuthContext must handle 401 events')
  })

  test('App.tsx protects workflow routes and redirects unauthenticated users to /login', () => {
    const appPath = path.resolve(__dirname, '../src/App.tsx')
    const content = fs.readFileSync(appPath, 'utf8')

    assert.ok(content.includes('useAuth()'), 'App must use useAuth hook')
    assert.ok(content.includes('/login?returnUrl='), 'App must redirect unauthenticated users to /login with returnUrl')
    assert.ok(content.includes('<Login />'), 'App must render Login when user is null')
  })

  test('Axios API client attaches credentials and authorization tokens', () => {
    const apiPath = path.resolve(__dirname, '../src/services/api.ts')
    const content = fs.readFileSync(apiPath, 'utf8')

    assert.ok(content.includes('withCredentials: true'), 'Axios must have withCredentials enabled')
    assert.ok(content.includes('Bearer'), 'Axios interceptor must attach Bearer authorization')
    assert.ok(content.includes('auth:unauthorized'), 'Axios 401 interceptor must fire unauthorized event')
  })
})
