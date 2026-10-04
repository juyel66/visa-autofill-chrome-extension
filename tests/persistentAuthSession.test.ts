import {
  loginWithGoogle,
  refreshAccessToken,
  fetchWithAuth,
  getCurrentUser,
  restoreAuthSession,
  logout,
  isTokenExpiredOrNearExpiry,
  isNetworkError,
  AUTH_CONFIG,
} from '../src/core/auth/authClient'
import {
  setStoredAuth,
  getStoredAuth,
  clearStoredAuth,
  TOKEN_ACCESS_KEY,
  TOKEN_REFRESH_KEY,
  USER_KEY,
} from '../src/core/auth/authStorage'
import type { AuthUser } from '../src/core/auth/types'

async function runPersistentAuthSessionTests() {
  console.log('==================================================')
  console.log('STARTING PERSISTENT 1-YEAR AUTH & SESSION TESTS')
  console.log('==================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`)
      passed++
    } else {
      console.error(`  ✕ FAIL: ${desc}`)
      failed++
    }
  }

  const originalFetch = globalThis.fetch
  const originalChrome = (globalThis as any).chrome

  const mockUser: AuthUser = {
    id: 'user-uuid-1',
    name: 'MD JUYEL RANA',
    email: 'juyel@example.com',
    picture: 'https://example.com/photo.jpg',
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Google Login -> Stores Access & Refresh Token, Authenticated Extension Opens
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: GOOGLE LOGIN ---')
    {
      await clearStoredAuth()

      // Mock Chrome Identity API
      ;(globalThis as any).chrome = {
        identity: {
          getRedirectURL: () => 'https://idjemajdjnoefigfbnnfmcpnnfgme.chromiumapp.org/',
          launchWebAuthFlow: (
            options: { url: string; interactive: boolean },
            callback: (responseUrl?: string) => void
          ) => {
            const url = new URL(options.url)
            const state = url.searchParams.get('state')
            callback(`https://idjemajdjnoefigfbnnfmcpnnfgme.chromiumapp.org/?code=mock-google-code&state=${state}`)
          },
        },
      }

      globalThis.fetch = async (url: any, options: any) => {
        const u = String(url)
        if (u.includes('/api/auth/google/exchange')) {
          const body = JSON.parse(options?.body || '{}')
          assert(body.code === 'mock-google-code', 'OAuth code forwarded to backend')
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                tokens: {
                  accessToken: 'initial-access-jwt',
                  refreshToken: 'persistent-refresh-token-365d',
                },
                user: mockUser,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response('Not Found', { status: 404 })
      }

      const user = await loginWithGoogle()
      assert(user.id === 'user-uuid-1', 'Login returns authenticated user')
      assert(user.email === 'juyel@example.com', 'User email correctly populated')

      const stored = await getStoredAuth()
      assert(stored.accessToken === 'initial-access-jwt', 'Access token persisted in storage')
      assert(stored.refreshToken === 'persistent-refresh-token-365d', '365-day refresh token persisted in storage')
      assert(stored.user?.name === 'MD JUYEL RANA', 'Authoritative user profile persisted in storage')
    }

    // -------------------------------------------------------------------------
    // TEST 2: Close Popup -> Reopen Popup (Session Restored)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: CLOSE POPUP -> REOPEN (User Remains Logged In) ---')
    {
      // Mock /api/auth/me
      globalThis.fetch = async (url: any, options: any) => {
        const u = String(url)
        if (u.includes('/api/auth/me')) {
          const headers = options?.headers
          const authHeader = headers instanceof Headers ? headers.get('Authorization') : headers?.Authorization
          assert(authHeader === 'Bearer initial-access-jwt', 'Authorization header sent with access token')
          return new Response(
            JSON.stringify({
              success: true,
              data: { user: mockUser },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response('Not Found', { status: 404 })
      }

      // Reopening extension triggers restoreAuthSession()
      const result = await restoreAuthSession()
      assert(result.status === 'authenticated', 'Session restored on popup reopen')
      assert(result.user?.id === 'user-uuid-1', 'User remains logged in without Google login screen')
    }

    // -------------------------------------------------------------------------
    // TEST 3: Close Chrome -> Reopen Chrome (Persistent Storage Survives)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: CLOSE CHROME -> REOPEN (Storage Survives Restart) ---')
    {
      // Verify storage still holds credentials
      const stored = await getStoredAuth()
      assert(Boolean(stored.accessToken), 'Access token survives browser restart')
      assert(Boolean(stored.refreshToken), 'Refresh token survives browser restart')
      assert(Boolean(stored.user), 'User data survives browser restart')

      const result = await restoreAuthSession()
      assert(result.status === 'authenticated', 'Authenticated state restored after Chrome reopen')
    }

    // -------------------------------------------------------------------------
    // TEST 4: Expired Access Token -> Silent Refresh on Startup (No Login Screen)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: EXPIRED ACCESS TOKEN (Silent Refresh, No Login Screen) ---')
    {
      // Set expired access token and valid refresh token
      await setStoredAuth({
        accessToken: 'expired-access-token',
        refreshToken: 'valid-365d-refresh-token',
      }, mockUser)

      let refreshCalled = 0
      let meCalled = 0

      globalThis.fetch = async (url: any, options: any) => {
        const u = String(url)
        if (u.includes('/api/auth/refresh')) {
          refreshCalled++
          const body = JSON.parse(options?.body || '{}')
          assert(body.refreshToken === 'valid-365d-refresh-token', 'Correct refresh token sent to backend')
          return new Response(
            JSON.stringify({
              success: true,
              data: { accessToken: 'newly-refreshed-jwt-token' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }
        if (u.includes('/api/auth/me')) {
          meCalled++
          const headers = options?.headers
          const authHeader = headers instanceof Headers ? headers.get('Authorization') : headers?.Authorization
          assert(authHeader === 'Bearer newly-refreshed-jwt-token', '/api/auth/me called with new access token')
          return new Response(
            JSON.stringify({
              success: true,
              data: { user: mockUser },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response('Not Found', { status: 404 })
      }

      const result = await restoreAuthSession()
      assert(refreshCalled === 1, 'Silent refresh executed automatically')
      assert(meCalled === 1, 'Current user loaded after silent refresh')
      assert(result.status === 'authenticated', 'Extension opens in authenticated state')
      assert(result.user?.id === 'user-uuid-1', 'User sees no login screen')

      const stored = await getStoredAuth()
      assert(stored.accessToken === 'newly-refreshed-jwt-token', 'New access token saved in persistent storage')
    }

    // -------------------------------------------------------------------------
    // TEST 5: Multiple Simultaneous 401 Requests -> Only ONE Refresh Request (Mutex)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: MULTIPLE SIMULTANEOUS 401s (Single Refresh Mutex) ---')
    {
      await setStoredAuth({
        accessToken: 'expired-simultaneous-token',
        refreshToken: 'valid-365d-refresh-token',
      }, mockUser)

      let refreshEndpointCount = 0
      let apiCallsCount = 0

      globalThis.fetch = async (url: any, options: any) => {
        const u = String(url)

        if (u.includes('/api/auth/refresh')) {
          refreshEndpointCount++
          // Artificial delay to simulate real network latency
          await new Promise((r) => setTimeout(r, 25))
          return new Response(
            JSON.stringify({
              success: true,
              data: { accessToken: 'deduplicated-new-token' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }

        if (u.includes('/api/test-endpoint-')) {
          apiCallsCount++
          const headers = options?.headers
          const authHeader = headers instanceof Headers ? headers.get('Authorization') : headers?.Authorization

          if (authHeader?.includes('expired-simultaneous-token')) {
            return new Response(JSON.stringify({ message: 'jwt expired' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          if (authHeader?.includes('deduplicated-new-token')) {
            return new Response(
              JSON.stringify({ success: true, endpoint: u }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }
        }

        return new Response('Not Found', { status: 404 })
      }

      // Launch 3 simultaneous requests that all receive 401 initially
      const [resA, resB, resC] = await Promise.all([
        fetchWithAuth('http://localhost:8000/api/test-endpoint-A'),
        fetchWithAuth('http://localhost:8000/api/test-endpoint-B'),
        fetchWithAuth('http://localhost:8000/api/test-endpoint-C'),
      ])

      assert(resA.status === 200, 'Request A retried and succeeded')
      assert(resB.status === 200, 'Request B retried and succeeded')
      assert(resC.status === 200, 'Request C retried and succeeded')

      assert(refreshEndpointCount === 1, `Only ONE refresh request was sent for 3 simultaneous 401s (was: ${refreshEndpointCount})`)
      assert(apiCallsCount === 6, 'All 3 requests were called initially (401) and retried once (200)')

      const stored = await getStoredAuth()
      assert(stored.accessToken === 'deduplicated-new-token', 'New access token saved in storage')
    }

    // -------------------------------------------------------------------------
    // TEST 6: Invalid / Revoked Refresh Token -> Clears Storage, Shows Login
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: INVALID/REVOKED REFRESH TOKEN (Clears Session) ---')
    {
      await setStoredAuth({
        accessToken: 'expired-token',
        refreshToken: 'revoked-refresh-token',
      }, mockUser)

      globalThis.fetch = async (url: any) => {
        const u = String(url)
        if (u.includes('/api/auth/refresh')) {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Refresh token has been revoked or expired',
            }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response('Not Found', { status: 404 })
      }

      const result = await restoreAuthSession()
      assert(result.status === 'unauthenticated', 'Result is unauthenticated when refresh token is revoked')
      assert(result.user === null, 'No user returned')

      const stored = await getStoredAuth()
      assert(stored.accessToken === null, 'Access token cleared from storage')
      assert(stored.refreshToken === null, 'Refresh token cleared from storage')
      assert(stored.user === null, 'User profile cleared from storage')
    }

    // -------------------------------------------------------------------------
    // TEST 7: Explicit Logout -> Calls API, Clears Storage, Never Auto-Restores
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: EXPLICIT LOGOUT ---')
    {
      await setStoredAuth({
        accessToken: 'valid-logout-token',
        refreshToken: 'logout-refresh-token',
      }, mockUser)

      let logoutApiCalled = false
      globalThis.fetch = async (url: any, options: any) => {
        const u = String(url)
        if (u.includes('/api/auth/logout')) {
          logoutApiCalled = true
          const body = JSON.parse(options?.body || '{}')
          assert(body.refreshToken === 'logout-refresh-token', 'Refresh token sent to logout endpoint')
          return new Response(JSON.stringify({ success: true }), { status: 200 })
        }
        return new Response('Not Found', { status: 404 })
      }

      await logout()
      assert(logoutApiCalled, 'Logout endpoint called on backend')

      const stored = await getStoredAuth()
      assert(stored.accessToken === null, 'Access token cleared on logout')
      assert(stored.refreshToken === null, 'Refresh token cleared on logout')
      assert(stored.user === null, 'User state cleared on logout')

      // Reopening extension must require login
      const result = await restoreAuthSession()
      assert(result.status === 'unauthenticated', 'Session NOT automatically restored after explicit logout')
    }

    // -------------------------------------------------------------------------
    // TEST 8: Backend Temporarily Unavailable -> Session NOT Destroyed
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: BACKEND TEMPORARILY UNAVAILABLE (Session Preserved) ---')
    {
      // User had an active session
      await setStoredAuth({
        accessToken: 'valid-token-before-offline',
        refreshToken: 'valid-refresh-token-365d',
      }, mockUser)

      // Backend is temporarily down (throws network error)
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch (net::ERR_CONNECTION_REFUSED)')
      }

      const result = await restoreAuthSession()
      assert(result.status === 'offline', 'Returns offline status when backend unreachable')
      assert(result.user?.id === 'user-uuid-1', 'Cached user returned to keep UI responsive')

      // Session MUST NOT be destroyed
      const stored = await getStoredAuth()
      assert(stored.accessToken === 'valid-token-before-offline', 'Access token preserved during backend outage')
      assert(stored.refreshToken === 'valid-refresh-token-365d', 'Refresh token preserved during backend outage')
      assert(stored.user?.email === 'juyel@example.com', 'User profile preserved during backend outage')
    }

    // -------------------------------------------------------------------------
    // TEST 9: 403 Forbidden -> Permission Error, DO NOT Automatically Logout
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: 403 FORBIDDEN (No Automatic Logout) ---')
    {
      await setStoredAuth({
        accessToken: 'valid-user-token',
        refreshToken: 'valid-user-refresh',
      }, mockUser)

      globalThis.fetch = async (url: any) => {
        const u = String(url)
        if (u.includes('/api/applications/forbidden-id')) {
          return new Response(JSON.stringify({ message: 'Access denied to this resource' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response('Not Found', { status: 404 })
      }

      const response = await fetchWithAuth('http://localhost:8000/api/applications/forbidden-id')
      assert(response.status === 403, '403 response received')

      const stored = await getStoredAuth()
      assert(stored.accessToken === 'valid-user-token', 'Session remains active after 403 Forbidden')
      assert(stored.refreshToken === 'valid-user-refresh', 'Refresh token remains intact after 403')
      assert(stored.user?.id === 'user-uuid-1', 'User remains logged in after 403')
    }

    // -------------------------------------------------------------------------
    // TEST 10: Token Expiration Checker & Network Error Helper
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: UTILITY HELPERS (JWT Expiry & Network Error Detection) ---')
    {
      assert(isTokenExpiredOrNearExpiry('expired-token') === true, 'Detects expired string token')
      assert(isTokenExpiredOrNearExpiry('valid-token') === false, 'Non-expired mock token passes')

      // Construct a valid unexpired JWT payload
      const futureExp = Math.floor(Date.now() / 1000) + 3600 // 1 hour in future
      const payloadFuture = Buffer.from(JSON.stringify({ id: 'u1', exp: futureExp })).toString('base64url')
      const validJwt = `eyJhbGciOiJIUzI1NiJ9.${payloadFuture}.signature`
      assert(isTokenExpiredOrNearExpiry(validJwt) === false, 'Valid JWT (exp in future) detected as unexpired')

      // Construct an expired JWT payload
      const pastExp = Math.floor(Date.now() / 1000) - 300 // 5 minutes in past
      const payloadPast = Buffer.from(JSON.stringify({ id: 'u1', exp: pastExp })).toString('base64url')
      const expiredJwt = `eyJhbGciOiJIUzI1NiJ9.${payloadPast}.signature`
      assert(isTokenExpiredOrNearExpiry(expiredJwt) === true, 'Expired JWT detected correctly')

      assert(isNetworkError(new TypeError('Failed to fetch')) === true, 'Detects fetch TypeError as network error')
      assert(isNetworkError(new Error('connect ECONNREFUSED 127.0.0.1:8000')) === true, 'Detects ECONNREFUSED as network error')
      assert(isNetworkError(new Error('Session expired')) === false, 'Auth error not flagged as network error')
    }

  } finally {
    globalThis.fetch = originalFetch
    ;(globalThis as any).chrome = originalChrome
  }

  console.log('\n==================================================')
  console.log(`PERSISTENT AUTH TESTS RESULT: ${failed === 0 ? '✅ ALL PASSED' : '❌ FAILED'}`)
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
  console.log('==================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runPersistentAuthSessionTests().catch((err) => {
  console.error('Test suite failed:', err)
  process.exit(1)
})
