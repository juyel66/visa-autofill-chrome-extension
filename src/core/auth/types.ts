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
}

export interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  isLoading: boolean
  error: string | null
}
