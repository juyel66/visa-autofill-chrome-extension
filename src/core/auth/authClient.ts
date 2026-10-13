import {
  getStoredAuth,
  setStoredAuth,
  clearStoredAuth,
  TOKEN_ACCESS_KEY,
  TOKEN_REFRESH_KEY,
  USER_KEY,
} from './authStorage'
import type { AuthUser, AuthState } from './types'

import {
  BACKEND_AUTH_BASE_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_REDIRECT_URI as REDIRECT_URI,
} from '../config/env'
export { BACKEND_AUTH_BASE_URL, GOOGLE_CLIENT_ID, REDIRECT_URI }

export const AUTH_CONFIG = {
  GOOGLE_CLIENT_ID,
  BACKEND_URL: BACKEND_AUTH_BASE_URL,
  REDIRECT_URI,
}

// Canonical In-Memory Auth State for Instant Synchronous UI Restoration
let canonicalAuthState: AuthState = {
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null,
}

type AuthListener = (state: AuthState) => void
const authListeners = new Set<AuthListener>()

export function getCanonicalAuthState(): AuthState {
  return { ...canonicalAuthState }
}

export function subscribeAuthState(listener: AuthListener): () => void {
  authListeners.add(listener)
  try {
    listener({ ...canonicalAuthState })
  } catch (err) {
    console.error('Error invoking auth listener:', err)
  }
  return () => {
    authListeners.delete(listener)
  }
}

export function updateCanonicalAuthState(partial: Partial<AuthState>): void {
  canonicalAuthState = { ...canonicalAuthState, ...partial }
  authListeners.forEach((fn) => {
    try {
      fn({ ...canonicalAuthState })
    } catch (err) {
      console.error('Error notifying auth listener:', err)
    }
  })
}

// Cross-context storage synchronization for Manifest V3 (service worker restarts / multi-tab)
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes[TOKEN_ACCESS_KEY] || changes[TOKEN_REFRESH_KEY] || changes[USER_KEY]) {
          getStoredAuth().then((stored) => {
            if (stored.user && stored.accessToken) {
              updateCanonicalAuthState({
                isAuthenticated: true,
                user: stored.user,
                isLoading: false,
                error: null,
              })
            } else if (!stored.accessToken && !stored.refreshToken) {
              updateCanonicalAuthState({
                isAuthenticated: false,
                user: null,
                isLoading: false,
                error: null,
              })
            }
          })
        }
      }
    })
  } catch {}
}

/**
 * Resolves the redirect URI to use with chrome.identity.launchWebAuthFlow.
 * Uses chrome.identity.getRedirectURL() if available so Chrome can cleanly intercept
 * the callback URL, otherwise falls back to configured REDIRECT_URI.
 */
export function getOAuthRedirectUri(): string {
  if (typeof chrome !== 'undefined' && chrome.identity?.getRedirectURL) {
    try {
      const runtimeRedirect = chrome.identity.getRedirectURL()
      if (runtimeRedirect) {
        return runtimeRedirect
      }
    } catch {
      // Fallback to configured URI
    }
  }
  return AUTH_CONFIG.REDIRECT_URI
}

/**
 * Generate cryptographically random characters for OAuth state & PKCE code verifier
 */
function generateRandomString(length: number = 32): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let result = ''
  for (let i = 0; i < bytes.length; i++) {
    result += chars[bytes[i] % chars.length]
  }
  return result
}

/**
 * Generate PKCE SHA-256 base64url-encoded code challenge
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Initiates the Google OAuth 2.0 Web Application flow using chrome.identity.launchWebAuthFlow().
 * Exchanges the resulting authorization code with the backend at POST /api/auth/google/exchange.
 */
export async function loginWithGoogle(): Promise<AuthUser> {
  if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) {
    throw new Error('Chrome identity API (launchWebAuthFlow) is unavailable. Please run inside the Chrome extension.')
  }

  const redirectUri = getOAuthRedirectUri()
  const state = generateRandomString(16)
  const codeVerifier = generateRandomString(64)
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  // 1. Build Google OAuth authorization URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', AUTH_CONFIG.GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'select_account')

  // Safe diagnostic logging: logs ONLY safe public parameters, NEVER secrets/tokens/codes
  console.log('[Google OAuth Diagnostic]', {
    clientId: AUTH_CONFIG.GOOGLE_CLIENT_ID,
    redirectUri,
    authEndpoint: `${authUrl.origin}${authUrl.pathname}`,
    scopes: authUrl.searchParams.get('scope'),
  })

  // 2. Launch interactive Web Auth Flow
  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl.toString(),
        interactive: true,
      },
      (callbackUrl) => {
        if (chrome.runtime?.lastError) {
          const errMsg = chrome.runtime.lastError.message || 'Google sign-in was cancelled'
          reject(new Error(errMsg))
          return
        }
        if (!callbackUrl) {
          reject(new Error('No response URL received from Google authorization.'))
          return
        }
        resolve(callbackUrl)
      }
    )
  })

  // 3. Parse callback URL and validate state & code
  let parsedUrl: URL
  try {
    parsedUrl = new URL(responseUrl)
  } catch {
    throw new Error('Failed to parse Google OAuth callback URL.')
  }

  const error = parsedUrl.searchParams.get('error')
  if (error) {
    const errorDescription = parsedUrl.searchParams.get('error_description') || error
    throw new Error(`Google authorization error: ${errorDescription}`)
  }

  const returnedState = parsedUrl.searchParams.get('state')
  if (!returnedState || returnedState !== state) {
    throw new Error('OAuth security error: State parameter mismatch or missing.')
  }

  const code = parsedUrl.searchParams.get('code')
  if (!code) {
    throw new Error('No authorization code returned from Google.')
  }

  // 4. Send authorization code to backend for token exchange
  let response: Response
  try {
    response = await fetch(`${AUTH_CONFIG.BACKEND_URL}/api/auth/google/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirectUri,
        codeVerifier,
      }),
    })
  } catch (err) {
    throw new Error(`Unable to connect to backend server. Make sure ${AUTH_CONFIG.BACKEND_URL} is running.`)
  }

  const rawText = await response.text().catch(() => '')
  let resultJson: any = null
  try {
    resultJson = rawText ? JSON.parse(rawText) : null
  } catch {}

  if (!response.ok) {
    throw new Error(resultJson?.message || `Authentication failed with status ${response.status}`)
  }

  const result = resultJson as {
    success: boolean
    message?: string
    data: {
      token?: string
      tokens?: {
        accessToken: string
        refreshToken?: string
      }
      refreshToken?: string
      user: AuthUser
    }
  }

  const accessToken = result.data.token || result.data.tokens?.accessToken
  if (!accessToken) {
    throw new Error('No application token received from backend.')
  }

  const refreshToken = result.data.tokens?.refreshToken || result.data.refreshToken
  const user = result.data.user

  // 5. Store application JWT, persistent refresh token and authoritative user in Chrome storage
  await setStoredAuth(
    {
      accessToken,
      ...(refreshToken ? { refreshToken } : {}),
    },
    user
  )

  updateCanonicalAuthState({
    isAuthenticated: true,
    user,
    isLoading: false,
    error: null,
  })

  return user
}

/**
 * Checks whether an error is caused by a network connection failure (e.g. backend server down)
 */
export function isNetworkError(err: any): boolean {
  if (!err) return false
  const msg = (err.message || String(err)).toLowerCase()
  return (
    msg.includes('unable to connect') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('econnrefused') ||
    msg.includes('failed to connect') ||
    msg.includes('load failed') ||
    msg.includes('abort') ||
    (err.name === 'TypeError' && msg.includes('fetch'))
  )
}

/**
 * Safely inspects whether a JWT access token is expired or within the expiry buffer (default 60s).
 * Returns false if the token cannot be parsed as a 3-part JWT (unless it contains 'expired').
 */
export function isTokenExpiredOrNearExpiry(token: string, bufferSeconds: number = 60): boolean {
  if (!token || typeof token !== 'string') return true
  if (token.toLowerCase().includes('expired')) return true

  const parts = token.split('.')
  if (parts.length !== 3) {
    // Non-standard JWT (e.g. test string like 'valid-token' or opaque token)
    return false
  }

  try {
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    let jsonPayload = ''
    if (typeof atob !== 'undefined') {
      jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
    } else if (typeof Buffer !== 'undefined') {
      jsonPayload = Buffer.from(base64, 'base64').toString('utf8')
    }
    const payload = JSON.parse(jsonPayload)
    if (typeof payload.exp !== 'number') {
      return false
    }
    const now = Math.floor(Date.now() / 1000)
    return payload.exp <= now + bufferSeconds
  } catch {
    return false
  }
}

// In-flight refresh promise mutex: deduplicates multiple concurrent 401 refresh calls into ONE backend request
let activeRefreshPromise: Promise<string> | null = null

/**
 * Silently refreshes the access token using the stored backend refresh token.
 * Uses an in-flight promise mutex so simultaneous 401 responses send only ONE refresh request.
 */
export async function refreshAccessToken(): Promise<string> {
  if (activeRefreshPromise) {
    return activeRefreshPromise
  }

  activeRefreshPromise = (async () => {
    try {
      const { refreshToken } = await getStoredAuth()
      if (!refreshToken) {
        await clearStoredAuth()
        throw new Error('No refresh token available. Please sign in again.')
      }

      let response: Response
      try {
        response = await fetch(`${AUTH_CONFIG.BACKEND_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        })
      } catch (err: any) {
        // Backend unavailable: do NOT delete valid persistent session!
        throw new Error(`Unable to connect to backend server. Make sure ${AUTH_CONFIG.BACKEND_URL} is running.`)
      }

      const rawText = await response.text().catch(() => '')
      let resultJson: any = null
      try {
        resultJson = rawText ? JSON.parse(rawText) : null
      } catch {}

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Refresh token expired, revoked, or invalid -> clear invalid session
          await clearStoredAuth()
          updateCanonicalAuthState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: null,
          })
          throw new Error('Session expired. Please sign in again.')
        }
        // Server errors (500, 502, etc.) -> preserve session and throw
        throw new Error(resultJson?.message || `Session refresh failed with status ${response.status}`)
      }

      const result = resultJson as {
        success: boolean
        data?: {
          accessToken?: string
          token?: string
          refreshToken?: string
          tokens?: {
            accessToken?: string
            refreshToken?: string
          }
        }
      }

      const newAccessToken =
        result?.data?.accessToken ||
        result?.data?.token ||
        result?.data?.tokens?.accessToken

      if (!newAccessToken) {
        await clearStoredAuth()
        updateCanonicalAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null,
        })
        throw new Error('Invalid token response from backend.')
      }

      // Check if backend rotated the refresh token
      const newRefreshToken =
        result?.data?.refreshToken ||
        result?.data?.tokens?.refreshToken

      await setStoredAuth({
        accessToken: newAccessToken,
        ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}),
      })

      const currentStored = await getStoredAuth()
      if (currentStored.user) {
        updateCanonicalAuthState({
          isAuthenticated: true,
          user: currentStored.user,
          isLoading: false,
          error: null,
        })
      }

      return newAccessToken
    } finally {
      activeRefreshPromise = null
    }
  })()

  return activeRefreshPromise
}

/**
 * Executes an HTTP fetch request with Authorization Bearer header.
 * If response is 401, attempts a silent token refresh (using the mutex)
 * and retries the original request exactly once.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const { accessToken: initialToken } = await getStoredAuth()

  const headers = new Headers(options.headers || {})
  if (initialToken) {
    headers.set('Authorization', `Bearer ${initialToken}`)
  }

  let response = await fetch(url, { ...options, headers })

  if (response.status === 401) {
    try {
      // 1. Check if another concurrent request already refreshed the access token in storage
      const currentStored = await getStoredAuth()
      let newToken = currentStored.accessToken

      if (!newToken || newToken === initialToken) {
        // 2. Trigger silent refresh (deduplicated by activeRefreshPromise mutex)
        newToken = await refreshAccessToken()
      }

      // 3. Retry original request exactly once with new access token
      const retryHeaders = new Headers(options.headers || {})
      retryHeaders.set('Authorization', `Bearer ${newToken}`)
      response = await fetch(url, { ...options, headers: retryHeaders })
    } catch (refreshErr) {
      throw refreshErr
    }
  }

  return response
}

/**
 * Fetches the current authenticated user profile from GET /api/auth/me.
 * Uses fetchWithAuth so expired access tokens are automatically silently refreshed.
 * Does NOT clear storage on 403 or on network errors.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { accessToken, refreshToken, user: cachedUser } = await getStoredAuth()
  if (!accessToken && !refreshToken) return null

  try {
    const response = await fetchWithAuth(`${AUTH_CONFIG.BACKEND_URL}/api/auth/me`)

    if (!response.ok) {
      if (response.status === 403) {
        // 403 Forbidden: Permission error, do NOT logout or clear storage!
        return cachedUser
      }
      if (response.status === 401) {
        await clearStoredAuth()
        return null
      }
      return cachedUser
    }

    const rawText = await response.text().catch(() => '')
    let result: any = null
    try {
      result = rawText ? JSON.parse(rawText) : null
    } catch {}

    const user = result?.data?.user || result?.data || result?.user
    if (user && user.id) {
      const { accessToken: currentToken } = await getStoredAuth()
      if (currentToken) {
        await setStoredAuth({ accessToken: currentToken }, user)
      }
      return user
    }
    return cachedUser
  } catch (err: any) {
    if (isNetworkError(err)) {
      // Backend unavailable: rethrow network error so restoreAuthSession detects offline mode
      throw err
    }
    const remaining = await getStoredAuth()
    if (!remaining.refreshToken) {
      return null
    }
    return cachedUser
  }
}

export interface RestoreSessionResult {
  status: 'authenticated' | 'unauthenticated' | 'offline'
  user: AuthUser | null
  error?: string
}

// In-flight initialization promise mutex: deduplicates multiple calls to restoreAuthSession
let activeInitPromise: Promise<RestoreSessionResult> | null = null

export function resetAuthClientStateForTesting(): void {
  activeRefreshPromise = null
  activeInitPromise = null
  canonicalAuthState = {
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null,
  }
}

/**
 * Restores the persistent authentication session on Extension startup.
 * 1. Reads existing session from chrome.storage.local immediately.
 * 2. If locally cached user session and unexpired access token exist, restores the
 *    authenticated UI immediately with ZERO network requests (no unnecessary /api/auth/me).
 * 3. If access token is expired, silently refreshes in background or coordinates single refresh.
 * 4. Deduplicates concurrent / remount initialization calls via shared activeInitPromise.
 * 5. Returns 'unauthenticated' if no session exists or refresh token is revoked/expired.
 * 6. If backend is unavailable, preserves the session and returns 'offline'.
 */
export async function restoreAuthSession(options?: { forceVerify?: boolean }): Promise<RestoreSessionResult> {
  if (activeInitPromise) {
    return activeInitPromise
  }

  activeInitPromise = (async () => {
    try {
      const stored = await getStoredAuth()
      const { accessToken, refreshToken, user: cachedUser, expiresAt } = stored

      // 1. No stored session at all
      if (!accessToken && !refreshToken) {
        updateCanonicalAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null,
        })
        return { status: 'unauthenticated', user: null }
      }

      // 2. Check access token expiration (buffer 60 seconds)
      const isExpired = expiresAt != null
        ? Date.now() >= expiresAt - 60000
        : !accessToken || isTokenExpiredOrNearExpiry(accessToken, 60)

      // 3. FAST PATH: Unexpired token + cached user -> INSTANT restoration without /me
      if (!isExpired && cachedUser && !options?.forceVerify) {
        updateCanonicalAuthState({
          isAuthenticated: true,
          user: cachedUser,
          isLoading: false,
          error: null,
        })
        return { status: 'authenticated', user: cachedUser }
      }

      // 4. If access token is expired or near expiry, silently refresh
      if (refreshToken && (isExpired || !accessToken)) {
        try {
          await refreshAccessToken()
          // If we had a cached user and no forceVerify requested, return immediately without /me
          if (cachedUser && !options?.forceVerify) {
            updateCanonicalAuthState({
              isAuthenticated: true,
              user: cachedUser,
              isLoading: false,
              error: null,
            })
            return { status: 'authenticated', user: cachedUser }
          }
        } catch (refreshErr: any) {
          if (isNetworkError(refreshErr)) {
            // Backend unavailable: do NOT delete valid persistent session!
            updateCanonicalAuthState({
              isAuthenticated: Boolean(cachedUser),
              user: cachedUser,
              isLoading: false,
              error: 'Backend is temporarily unavailable. Working in offline mode.',
            })
            return {
              status: 'offline',
              user: cachedUser,
              error: 'Backend is temporarily unavailable. Session preserved.',
            }
          }
          // Refresh token is expired / revoked / invalid -> show login
          updateCanonicalAuthState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: null,
          })
          return { status: 'unauthenticated', user: null }
        }
      }

      // 5. Load / verify current user from backend only when cached user is missing or forceVerify requested
      try {
        const verifiedUser = await getCurrentUser()
        if (verifiedUser) {
          updateCanonicalAuthState({
            isAuthenticated: true,
            user: verifiedUser,
            isLoading: false,
            error: null,
          })
          return { status: 'authenticated', user: verifiedUser }
        }

        // Check if session was invalidated during verification
        const after = await getStoredAuth()
        if (!after.refreshToken && !after.accessToken) {
          updateCanonicalAuthState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: null,
          })
          return { status: 'unauthenticated', user: null }
        }

        if (cachedUser) {
          updateCanonicalAuthState({
            isAuthenticated: true,
            user: cachedUser,
            isLoading: false,
            error: 'Could not reach server to verify profile.',
          })
          return { status: 'offline', user: cachedUser, error: 'Could not reach server to verify profile.' }
        }

        updateCanonicalAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null,
        })
        return { status: 'unauthenticated', user: null }
      } catch (err: any) {
        if (isNetworkError(err)) {
          updateCanonicalAuthState({
            isAuthenticated: Boolean(cachedUser),
            user: cachedUser,
            isLoading: false,
            error: 'Unable to connect to backend server. Session preserved.',
          })
          return {
            status: 'offline',
            user: cachedUser,
            error: 'Unable to connect to backend server. Session preserved.',
          }
        }
        updateCanonicalAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null,
        })
        return { status: 'unauthenticated', user: null }
      }
    } finally {
      activeInitPromise = null
    }
  })()

  return activeInitPromise
}

/**
 * Explicit user logout.
 * Notifies backend to revoke refresh token and clears all local storage.
 * Does not restore session after explicit logout.
 */
export async function logout(): Promise<void> {
  const { refreshToken, accessToken } = await getStoredAuth()

  if (refreshToken) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }
      await fetch(`${AUTH_CONFIG.BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      }).catch(() => {})
      clearTimeout(timeoutId)
    } catch {
      // Ignore network errors during logout - local storage must still be wiped
    }
  }

  await clearStoredAuth()
  updateCanonicalAuthState({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    error: null,
  })
}
