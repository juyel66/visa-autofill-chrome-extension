export interface AuthUser {
  id: string
  googleId?: string
  name: string
  email: string
  picture: string | null
  createdAt?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt?: number
}

export interface SessionMetadata {
  lastRefreshedAt?: number
  restoredAt?: number
  expiresAt?: number
}

export interface StoredAuthData {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  expiresAt: number | null
  metadata: SessionMetadata | null
}

export interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  isLoading: boolean
  error: string | null
}

