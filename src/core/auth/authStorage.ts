import type { AuthUser, StoredAuthData, SessionMetadata } from './types'

export const TOKEN_ACCESS_KEY = 'visa_autofill_access_token'
export const TOKEN_REFRESH_KEY = 'visa_autofill_refresh_token'
export const USER_KEY = 'visa_autofill_auth_user'
export const TOKEN_EXPIRY_KEY = 'visa_autofill_token_expiry'
export const SESSION_METADATA_KEY = 'visa_autofill_session_metadata'

/**
 * Extracts the expiration timestamp in milliseconds from a standard JWT access token.
 */
export function extractJwtExpiryMs(token: string): number | null {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
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
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      return payload.exp * 1000 // Convert seconds to milliseconds
    }
    return null
  } catch {
    return null
  }
}

/**
 * Validates and sanitizes stored user object to avoid crashes on malformed storage data.
 */
function sanitizeUser(user: any): AuthUser | null {
  if (!user || typeof user !== 'object') return null
  if (typeof user.id !== 'string' || user.id.trim() === '') return null
  return {
    id: user.id.trim(),
    name: typeof user.name === 'string' ? user.name : '',
    email: typeof user.email === 'string' ? user.email : '',
    picture: typeof user.picture === 'string' ? user.picture : null,
    googleId: typeof user.googleId === 'string' ? user.googleId : undefined,
    createdAt: typeof user.createdAt === 'string' ? user.createdAt : undefined,
  }
}

/**
 * Validates and sanitizes stored token strings.
 */
function sanitizeToken(token: any): string | null {
  if (typeof token !== 'string') return null
  const trimmed = token.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Reads the persistent authentication session from chrome.storage.local (with test-safe fallback).
 * Returns sanitized tokens, cached user, expiration timestamp, and session metadata.
 */
export async function getStoredAuth(): Promise<StoredAuthData> {
  const keys = [TOKEN_ACCESS_KEY, TOKEN_REFRESH_KEY, USER_KEY, TOKEN_EXPIRY_KEY, SESSION_METADATA_KEY]

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (res) => {
        const rawAccess = sanitizeToken(res[TOKEN_ACCESS_KEY])
        const rawRefresh = sanitizeToken(res[TOKEN_REFRESH_KEY])
        const rawUser = sanitizeUser(res[USER_KEY])
        let expiresAt = typeof res[TOKEN_EXPIRY_KEY] === 'number' ? res[TOKEN_EXPIRY_KEY] : null

        if (!expiresAt && rawAccess) {
          expiresAt = extractJwtExpiryMs(rawAccess)
        }

        const rawMeta = res[SESSION_METADATA_KEY] as SessionMetadata | undefined

        resolve({
          accessToken: rawAccess,
          refreshToken: rawRefresh,
          user: rawUser,
          expiresAt,
          metadata: rawMeta && typeof rawMeta === 'object' ? rawMeta : null,
        })
      })
    })
  }

  // Fallback for Node environment / unit tests
  try {
    const rawAccess = sanitizeToken(localStorage.getItem(TOKEN_ACCESS_KEY))
    const rawRefresh = sanitizeToken(localStorage.getItem(TOKEN_REFRESH_KEY))
    const userStr = localStorage.getItem(USER_KEY)
    let rawUser: AuthUser | null = null
    if (userStr) {
      try {
        rawUser = sanitizeUser(JSON.parse(userStr))
      } catch {
        rawUser = null
      }
    }

    const expStr = localStorage.getItem(TOKEN_EXPIRY_KEY)
    let expiresAt = expStr ? Number(expStr) : null
    if ((!expiresAt || isNaN(expiresAt)) && rawAccess) {
      expiresAt = extractJwtExpiryMs(rawAccess)
    }

    const metaStr = localStorage.getItem(SESSION_METADATA_KEY)
    let metadata: SessionMetadata | null = null
    if (metaStr) {
      try {
        metadata = JSON.parse(metaStr)
      } catch {
        metadata = null
      }
    }

    return {
      accessToken: rawAccess,
      refreshToken: rawRefresh,
      user: rawUser,
      expiresAt: expiresAt && !isNaN(expiresAt) ? expiresAt : null,
      metadata,
    }
  } catch {
    return { accessToken: null, refreshToken: null, user: null, expiresAt: null, metadata: null }
  }
}

/**
 * Persists the authentication session to chrome.storage.local.
 * Automatically computes and stores token expiration timestamp and session metadata.
 */
export async function setStoredAuth(
  tokens: { accessToken: string; refreshToken?: string; expiresAt?: number },
  user?: AuthUser | null,
  metadata?: SessionMetadata | null
): Promise<void> {
  const dataToStore: Record<string, any> = {}

  if (tokens.accessToken) {
    dataToStore[TOKEN_ACCESS_KEY] = tokens.accessToken
    const exp = tokens.expiresAt || extractJwtExpiryMs(tokens.accessToken)
    if (exp) {
      dataToStore[TOKEN_EXPIRY_KEY] = exp
    }
  }
  if (tokens.refreshToken) {
    dataToStore[TOKEN_REFRESH_KEY] = tokens.refreshToken
  }
  if (user) {
    dataToStore[USER_KEY] = user
  }

  const sessionMeta: SessionMetadata = {
    ...(metadata || {}),
    lastRefreshedAt: Date.now(),
    expiresAt: dataToStore[TOKEN_EXPIRY_KEY] || undefined,
  }
  dataToStore[SESSION_METADATA_KEY] = sessionMeta

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set(dataToStore, () => resolve())
    })
  }

  // Fallback for Node environment / unit tests
  try {
    if (tokens.accessToken) {
      localStorage.setItem(TOKEN_ACCESS_KEY, tokens.accessToken)
      if (dataToStore[TOKEN_EXPIRY_KEY]) {
        localStorage.setItem(TOKEN_EXPIRY_KEY, String(dataToStore[TOKEN_EXPIRY_KEY]))
      }
    }
    if (tokens.refreshToken) {
      localStorage.setItem(TOKEN_REFRESH_KEY, tokens.refreshToken)
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    }
    localStorage.setItem(SESSION_METADATA_KEY, JSON.stringify(sessionMeta))
  } catch {
    // Ignore in restricted environments
  }
}

/**
 * Clears all persistent tokens, cached user profile, and session metadata.
 */
export async function clearStoredAuth(): Promise<void> {
  const keys = [TOKEN_ACCESS_KEY, TOKEN_REFRESH_KEY, USER_KEY, TOKEN_EXPIRY_KEY, SESSION_METADATA_KEY]

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, () => resolve())
    })
  }

  try {
    for (const k of keys) {
      localStorage.removeItem(k)
    }
  } catch {
    // Ignore in restricted environments
  }
}
