import type { AuthUser } from './types'

export const TOKEN_ACCESS_KEY = 'visa_autofill_access_token'
export const TOKEN_REFRESH_KEY = 'visa_autofill_refresh_token'
export const USER_KEY = 'visa_autofill_auth_user'

export async function getStoredAuth(): Promise<{
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
}> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([TOKEN_ACCESS_KEY, TOKEN_REFRESH_KEY, USER_KEY], (res) => {
        resolve({
          accessToken: (res[TOKEN_ACCESS_KEY] as string) || null,
          refreshToken: (res[TOKEN_REFRESH_KEY] as string) || null,
          user: (res[USER_KEY] as AuthUser) || null,
        })
      })
    })
  }

  try {
    return {
      accessToken: localStorage.getItem(TOKEN_ACCESS_KEY),
      refreshToken: localStorage.getItem(TOKEN_REFRESH_KEY),
      user: localStorage.getItem(USER_KEY) ? JSON.parse(localStorage.getItem(USER_KEY)!) : null,
    }
  } catch {
    return { accessToken: null, refreshToken: null, user: null }
  }
}

export async function setStoredAuth(
  tokens: { accessToken: string; refreshToken?: string },
  user?: AuthUser | null
): Promise<void> {
  const dataToStore: Record<string, any> = {}
  if (tokens.accessToken) {
    dataToStore[TOKEN_ACCESS_KEY] = tokens.accessToken
  }
  if (tokens.refreshToken) {
    dataToStore[TOKEN_REFRESH_KEY] = tokens.refreshToken
  }
  if (user) {
    dataToStore[USER_KEY] = user
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set(dataToStore, () => resolve())
    })
  }

  try {
    if (tokens.accessToken) {
      localStorage.setItem(TOKEN_ACCESS_KEY, tokens.accessToken)
    }
    if (tokens.refreshToken) {
      localStorage.setItem(TOKEN_REFRESH_KEY, tokens.refreshToken)
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    }
  } catch {
    // Ignore in restricted environments
  }
}

export async function clearStoredAuth(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([TOKEN_ACCESS_KEY, TOKEN_REFRESH_KEY, USER_KEY], () => resolve())
    })
  }

  try {
    localStorage.removeItem(TOKEN_ACCESS_KEY)
    localStorage.removeItem(TOKEN_REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    // Ignore in restricted environments
  }
}
