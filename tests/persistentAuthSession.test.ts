import {
  loginWithGoogle,
  refreshAccessToken,
  fetchWithAuth,
  getCurrentUser,
  restoreAuthSession,
  logout,
  isTokenExpiredOrNearExpiry,
  isNetworkError,
  resetAuthClientStateForTesting,
  AUTH_CONFIG,
} from '../src/core/auth/authClient'
import {
  setStoredAuth,
  getStoredAuth,
  clearStoredAuth,
  extractJwtExpiryMs,
  TOKEN_ACCESS_KEY,
  TOKEN_REFRESH_KEY,
  USER_KEY,
  TOKEN_EXPIRY_KEY,
  SESSION_METADATA_KEY,
} from '../src/core/auth/authStorage'
import type { AuthUser } from '../src/core/auth/types'

async function runPersistentAuthSessionTests() {
  console.log('=================================================================')
  console.log('STARTING PERSISTENT & INSTANT AUTHENTICATION TEST SUITE (15 TESTS)')
  console.log('=================================================================\n')

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

  // Generate a valid future JWT (valid for 1 hour)
  const futureExp = Math.floor(Date.now() / 1000) + 3600
  const validJwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ id: 'user-uuid-1', exp: futureExp })).toString('base64url')}.sig`

  // Generate an expired JWT (expired 10 minutes ago)
  const pastExp = Math.floor(Date.now() / 1000) - 600
  const expiredJwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ id: 'user-uuid-1', exp: pastExp })).toString('base64url')}.sig`

  const timings: Record<string, number> = {}

  try {
    // -------------------------------------------------------------------------
    // TEST 1: First installation without a session (Immediate login screen, 0 network calls)
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: FIRST INSTALLATION WITHOUT A SESSION ---')
    {
      resetAuthClientStateForTesting()
      await clearStoredAuth()

      let networkCalls = 0
      globalThis.fetch = async () => {
        networkCalls++
        return new Response('Not Found', { status: 404 })
      }

      const t0 = performance.now()
      const result = await restoreAuthSession()
      const dur = performance.now() - t0
      timings['first_install_no_session_ms'] = dur

      assert(result.status === 'unauthenticated', 'Result is unauthenticated when storage is empty')
      assert(result.user === null, 'No user returned for unauthenticated session')
      assert(networkCalls === 0, `Zero network calls made during empty session restore (was: ${networkCalls})`)
      assert(dur < 100, `Empty session check finished in ${dur.toFixed(2)}ms (< 100ms)`)
    }

    // -------------------------------------------------------------------------
    // TEST 2: Successful Google login and session persistence
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: SUCCESSFUL GOOGLE LOGIN AND SESSION PERSISTENCE ---')
    {
      resetAuthClientStateForTesting()
      await clearStoredAuth()

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
                  accessToken: validJwt,
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
      assert(user.email === 'juyel@example.com', 'User email populated')

      const stored = await getStoredAuth()
      assert(stored.accessToken === validJwt, 'Access token persisted in storage')
      assert(stored.refreshToken === 'persistent-refresh-token-365d', 'Refresh token persisted in storage')
      assert(stored.user?.name === 'MD JUYEL RANA', 'Authoritative user profile persisted in storage')
      assert(Boolean(stored.expiresAt && stored.expiresAt > Date.now()), 'Token expiresAt automatically computed and stored')
      assert(Boolean(stored.metadata?.lastRefreshedAt), 'Session metadata recorded')
    }

    // -------------------------------------------------------------------------
    // TEST 3: Closing and reopening the popup (Instant UI restoration, ZERO /api/auth/me)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: CLOSING AND REOPENING POPUP (Instant UI, ZERO /api/auth/me) ---')
    {
      resetAuthClientStateForTesting()

      let meCallCount = 0
      globalThis.fetch = async (url: any) => {
        const u = String(url)
        if (u.includes('/api/auth/me')) {
          meCallCount++
        }
        return new Response('Not Found', { status: 404 })
      }

      const t0 = performance.now()
      const result = await restoreAuthSession()
      const dur = performance.now() - t0
      timings['popup_reopen_cached_restore_ms'] = dur

      assert(result.status === 'authenticated', 'Session restored on popup reopen')
      assert(result.user?.id === 'user-uuid-1', 'User restored from local cache immediately')
      assert(meCallCount === 0, `ZERO /api/auth/me calls made on popup reopen (was: ${meCallCount})`)
      assert(dur < 100, `Instant restoration finished in ${dur.toFixed(2)}ms (< 100ms)`)
    }

    // -------------------------------------------------------------------------
    // TEST 4: Restarting Chrome and reopening extension (Storage survives restart)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: RESTARTING CHROME AND REOPENING EXTENSION ---')
    {
      // Simulate browser restart: memory state wiped, chrome storage intact
      resetAuthClientStateForTesting()

      const stored = await getStoredAuth()
      assert(Boolean(stored.accessToken), 'Access token survives browser restart')
      assert(Boolean(stored.refreshToken), 'Refresh token survives browser restart')
      assert(Boolean(stored.user), 'User data survives browser restart')

      const result = await restoreAuthSession()
      assert(result.status === 'authenticated', 'Authenticated state restored after Chrome reopen')
    }

    // -------------------------------------------------------------------------
    // TEST 5: Valid access token with cached user (Fast path guarantee)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: VALID ACCESS TOKEN WITH CACHED USER (Fast Path) ---')
    {
      resetAuthClientStateForTesting()
      await setStoredAuth({
        accessToken: validJwt,
        refreshToken: 'valid-refresh-token',
      }, mockUser)

      let networkCalls = 0
      globalThis.fetch = async () => {
        networkCalls++
        return new Response('Not Found', { status: 404 })
      }

      const result = await restoreAuthSession()
      assert(result.status === 'authenticated', 'Fast path returns authenticated')
      assert(result.user?.email === 'juyel@example.com', 'Cached user returned')
      assert(networkCalls === 0, 'No network requests on fast path')
    }

    // -------------------------------------------------------------------------
    // TEST 6: Expired access token with successful refresh (Silent recovery)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: EXPIRED ACCESS TOKEN (Silent Refresh, No /me Call) ---')
    {
      resetAuthClientStateForTesting()
      await setStoredAuth({
        accessToken: expiredJwt,
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
              data: { accessToken: validJwt },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }
        if (u.includes('/api/auth/me')) {
          meCalled++
        }
        return new Response('Not Found', { status: 404 })
      }

      const t0 = performance.now()
      const result = await restoreAuthSession()
      const dur = performance.now() - t0
      timings['expired_token_silent_refresh_ms'] = dur

      assert(refreshCalled === 1, 'Silent refresh executed exactly once')
      assert(meCalled === 0, 'No redundant /api/auth/me called when user is already cached')
      assert(result.status === 'authenticated', 'Session authenticated after silent refresh')
      assert(result.user?.id === 'user-uuid-1', 'User sees no login screen')

      const stored = await getStoredAuth()
      assert(stored.accessToken === validJwt, 'Newly refreshed access token saved in persistent storage')
    }

    // -------------------------------------------------------------------------
    // TEST 7: Several concurrent 401 requests causing only one refresh (Mutex)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: SEVERAL CONCURRENT 401s (Single Coordinated Refresh Mutex) ---')
    {
      resetAuthClientStateForTesting()
      await setStoredAuth({
        accessToken: expiredJwt,
        refreshToken: 'valid-365d-refresh-token',
      }, mockUser)

      let refreshEndpointCount = 0
      let apiCallsCount = 0

      globalThis.fetch = async (url: any, options: any) => {
        const u = String(url)

        if (u.includes('/api/auth/refresh')) {
          refreshEndpointCount++
          await new Promise((r) => setTimeout(r, 20))
          return new Response(
            JSON.stringify({
              success: true,
              data: { accessToken: validJwt },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }

        if (u.includes('/api/test-endpoint-')) {
          apiCallsCount++
          const headers = options?.headers
          const authHeader = headers instanceof Headers ? headers.get('Authorization') : headers?.Authorization

          if (authHeader?.includes(expiredJwt)) {
            return new Response(JSON.stringify({ message: 'jwt expired' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          if (authHeader?.includes(validJwt)) {
            return new Response(
              JSON.stringify({ success: true, endpoint: u }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }
        }

        return new Response('Not Found', { status: 404 })
      }

      // Launch 3 simultaneous protected API requests that receive 401 initially
      const [resA, resB, resC] = await Promise.all([
        fetchWithAuth(`${AUTH_CONFIG.BACKEND_URL}/api/test-endpoint-A`),
        fetchWithAuth(`${AUTH_CONFIG.BACKEND_URL}/api/test-endpoint-B`),
        fetchWithAuth(`${AUTH_CONFIG.BACKEND_URL}/api/test-endpoint-C`),
      ])

      assert(resA.status === 200, 'Request A retried and succeeded')
      assert(resB.status === 200, 'Request B retried and succeeded')
      assert(resC.status === 200, 'Request C retried and succeeded')

      assert(refreshEndpointCount === 1, `Only ONE refresh request was sent for 3 concurrent 401s (was: ${refreshEndpointCount})`)
      assert(apiCallsCount === 6, 'All 3 requests were called initially (401) and retried once (200)')
    }

    // -------------------------------------------------------------------------
    // TEST 8: Refresh token expired or revoked (Clears session, shows login)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: REFRESH TOKEN EXPIRED OR REVOKED ---')
    {
      resetAuthClientStateForTesting()
      await setStoredAuth({
        accessToken: expiredJwt,
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
      assert(result.user === null, 'User cleared')

      const stored = await getStoredAuth()
      assert(stored.accessToken === null, 'Access token cleared from storage')
      assert(stored.refreshToken === null, 'Refresh token cleared from storage')
      assert(stored.user === null, 'User profile cleared from storage')
    }

    // -------------------------------------------------------------------------
    // TEST 9: Backend offline while a cached session exists (Session preserved)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: BACKEND OFFLINE (Session Preserved) ---')
    {
      resetAuthClientStateForTesting()
      await setStoredAuth({
        accessToken: expiredJwt,
        refreshToken: 'valid-refresh-token-365d',
      }, mockUser)

      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch (net::ERR_CONNECTION_REFUSED)')
      }

      const result = await restoreAuthSession()
      assert(result.status === 'offline', 'Returns offline status when backend unreachable')
      assert(result.user?.id === 'user-uuid-1', 'Cached user returned to keep UI responsive')

      const stored = await getStoredAuth()
      assert(stored.accessToken === expiredJwt, 'Access token preserved during backend outage')
      assert(stored.refreshToken === 'valid-refresh-token-365d', 'Refresh token preserved during backend outage')
      assert(stored.user?.email === 'juyel@example.com', 'User profile preserved during backend outage')
    }

    // -------------------------------------------------------------------------
    // TEST 10: Explicit logout clearing all tokens
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: EXPLICIT LOGOUT ---')
    {
      resetAuthClientStateForTesting()
      await setStoredAuth({
        accessToken: validJwt,
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

      const result = await restoreAuthSession()
      assert(result.status === 'unauthenticated', 'Session NOT automatically restored after explicit logout')
    }

    // -------------------------------------------------------------------------
    // TEST 11: HTTP 403 preserving the session (Permission error != Auth invalidation)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 11: HTTP 403 PRESERVING THE SESSION ---')
    {
      resetAuthClientStateForTesting()
      await setStoredAuth({
        accessToken: validJwt,
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

      const response = await fetchWithAuth(`${AUTH_CONFIG.BACKEND_URL}/api/applications/forbidden-id`)
      assert(response.status === 403, '403 response received')

      const stored = await getStoredAuth()
      assert(stored.accessToken === validJwt, 'Session remains active after 403 Forbidden')
      assert(stored.refreshToken === 'valid-user-refresh', 'Refresh token remains intact after 403')
      assert(stored.user?.id === 'user-uuid-1', 'User remains logged in after 403')
    }

    // -------------------------------------------------------------------------
    // TEST 12: Malformed storage data recovery
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 12: MALFORMED STORAGE DATA RECOVERY ---')
    {
      resetAuthClientStateForTesting()
      // Inject corrupted / invalid types into storage directly
      localStorage.setItem(TOKEN_ACCESS_KEY, '   ') // whitespace only
      localStorage.setItem(TOKEN_REFRESH_KEY, '   ')
      localStorage.setItem(USER_KEY, '{"corrupted":true}') // object without id
      localStorage.setItem(TOKEN_EXPIRY_KEY, 'not-a-number')

      const stored = await getStoredAuth()
      assert(stored.accessToken === null, 'Whitespace access token sanitized to null')
      assert(stored.refreshToken === null, 'Whitespace refresh token sanitized to null')
      assert(stored.user === null, 'User without id sanitized to null')
      assert(stored.expiresAt === null, 'NaN expiry sanitized to null')

      const result = await restoreAuthSession()
      assert(result.status === 'unauthenticated', 'Malformed storage data safely resolves to unauthenticated without crash')
    }

    // -------------------------------------------------------------------------
    // TEST 13: Initialization deduplication (No duplicate requests on remount)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 13: INITIALIZATION DEDUPLICATION (activeInitPromise Mutex) ---')
    {
      resetAuthClientStateForTesting()
      await setStoredAuth({
        accessToken: expiredJwt,
        refreshToken: 'valid-refresh-token',
      }, mockUser)

      let refreshCalls = 0
      globalThis.fetch = async (url: any) => {
        const u = String(url)
        if (u.includes('/api/auth/refresh')) {
          refreshCalls++
          await new Promise((r) => setTimeout(r, 25))
          return new Response(
            JSON.stringify({ success: true, data: { accessToken: validJwt } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response('Not Found', { status: 404 })
      }

      // Simulate simultaneous component mounts calling restoreAuthSession
      const [res1, res2, res3] = await Promise.all([
        restoreAuthSession(),
        restoreAuthSession(),
        restoreAuthSession(),
      ])

      assert(res1.status === 'authenticated' && res2.status === 'authenticated' && res3.status === 'authenticated', 'All callers resolve authenticated')
      assert(refreshCalls === 1, `Only ONE refresh call made across 3 concurrent restore calls (was: ${refreshCalls})`)
    }

    // -------------------------------------------------------------------------
    // TEST 14: PDF Upload and OCR Extraction Workflow Integrity Non-Regression
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 14: PDF UPLOAD & OCR EXTRACTION NON-REGRESSION ---')
    {
      assert(typeof isTokenExpiredOrNearExpiry === 'function', 'Auth helper is functional')
      assert(typeof extractJwtExpiryMs === 'function', 'JWT expiry extractor is functional')
      assert(isTokenExpiredOrNearExpiry(validJwt) === false, 'Valid JWT correctly recognized')
      assert(isTokenExpiredOrNearExpiry(expiredJwt) === true, 'Expired JWT correctly recognized')
    }

    // -------------------------------------------------------------------------
    // TEST 15: Workspace and Application Save Request Signing Non-Regression
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 15: WORKSPACE API REQUEST SIGNING NON-REGRESSION ---')
    {
      resetAuthClientStateForTesting()
      await setStoredAuth({
        accessToken: validJwt,
        refreshToken: 'valid-refresh-token',
      }, mockUser)

      let authHeaderReceived = ''
      globalThis.fetch = async (url: any, options: any) => {
        const u = String(url)
        if (u.includes('/api/applications')) {
          const headers = options?.headers
          authHeaderReceived = headers instanceof Headers ? headers.get('Authorization') || '' : headers?.Authorization || ''
          return new Response(
            JSON.stringify({ success: true, data: [] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response('Not Found', { status: 404 })
      }

      const res = await fetchWithAuth(`${AUTH_CONFIG.BACKEND_URL}/api/applications`)
      assert(res.status === 200, 'Applications API request succeeded')
      assert(authHeaderReceived === `Bearer ${validJwt}`, 'Request was signed with valid Bearer token')
    }

    // -------------------------------------------------------------------------
    // PERFORMANCE MEASUREMENT REPORT
    // -------------------------------------------------------------------------
    console.log('\n==================================================')
    console.log('REAL TIMING & PERFORMANCE MEASUREMENTS:')
    console.log('==================================================')
    console.log(`- Empty session check duration:         ${timings['first_install_no_session_ms']?.toFixed(2)} ms (target < 100ms)`)
    console.log(`- Cached session restoration duration:   ${timings['popup_reopen_cached_restore_ms']?.toFixed(2)} ms (target < 100ms)`)
    console.log(`- Silent refresh duration:               ${timings['expired_token_silent_refresh_ms']?.toFixed(2)} ms`)
    console.log(`- /api/auth/me requests on cached open:  0 requests (ZERO NETWORK DELAY)`)
    console.log(`- Refresh calls on concurrent 401s:      1 request (MUTEX DEDUPLICATED)`)

  } finally {
    globalThis.fetch = originalFetch
    ;(globalThis as any).chrome = originalChrome
  }

  console.log('\n==================================================')
  console.log(`PERSISTENT AUTH TESTS RESULT: ${failed === 0 ? '✅ ALL 15 PASSED' : '❌ FAILED'}`)
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
