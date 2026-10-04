import { useEffect, useState } from 'react'
import {
  loginWithGoogle,
  logout as authLogout,
  restoreAuthSession,
  type AuthUser,
} from '../core/auth'
import { GoogleLoginScreen } from './components/GoogleLoginScreen'
import { Dashboard, SettingsPage } from './pages'

export type PopupPage = 'dashboard' | 'settings'

export default function App() {
  const [activePage, setActivePage] = useState<PopupPage>('dashboard')

  // Authentication State
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true)
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  // Check authentication on startup
  useEffect(() => {
    let isMounted = true

    restoreAuthSession()
      .then((res) => {
        if (!isMounted) return

        if (res.status === 'authenticated') {
          setAuthUser(res.user)
          setErrorMessage(null)
          setAuthError(null)
        } else if (res.status === 'offline') {
          if (res.user) {
            setAuthUser(res.user)
            setErrorMessage('Backend server unreachable. Working in offline mode (session preserved).')
          } else {
            setAuthUser(null)
            setAuthError('Backend server unreachable. Make sure backend is running on port 8000.')
          }
        } else {
          // Unauthenticated (no session or refresh token expired/revoked)
          setAuthUser(null)
        }
      })
      .catch((err) => {
        if (!isMounted) return
        console.warn('[Startup Auth Exception]:', err)
        setAuthUser(null)
      })
      .finally(() => {
        if (isMounted) setIsAuthLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Clear any previous error as soon as user is authenticated
  useEffect(() => {
    if (authUser) {
      setErrorMessage(null)
      setAuthError(null)
    }
  }, [authUser])

  const handleLogin = async () => {
    setIsLoggingIn(true)
    setAuthError(null)
    setErrorMessage(null)
    try {
      const user = await loginWithGoogle()
      setAuthUser(user)
      setErrorMessage(null)
      setAuthError(null)
      showToast(`Welcome, ${user.name}!`)
    } catch (err: any) {
      console.error('Login failed:', err)
      const msg = err.message || 'Failed to authenticate with Google. Make sure backend is running on port 8000.'
      setAuthError(msg)
      setErrorMessage(msg)
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    try {
      await authLogout()
    } catch (err: any) {
      console.error('Logout error:', err)
    } finally {
      setAuthUser(null)
      setErrorMessage(null)
      setAuthError(null)
      showToast('Signed out successfully.')
    }
  }

  // 1. Initial Loading State
  if (isAuthLoading) {
    return (
      <div className="w-80 p-6 min-h-[460px] bg-slate-900 text-slate-100 flex flex-col items-center justify-center font-sans">
        <div className="animate-spin text-2xl text-blue-500 mb-2">✦</div>
        <p className="text-xs text-slate-400 font-medium">Checking authorization...</p>
      </div>
    )
  }

  // 2. Unauthenticated State: Show Centered Google Login
  if (!authUser) {
    return (
      <div className="w-80 min-h-[460px] relative">
        {toastMessage && (
          <div className="absolute top-2 left-4 right-4 z-50 p-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold text-center shadow-lg animate-fade-in">
            {toastMessage}
          </div>
        )}
        <GoogleLoginScreen
          onLogin={handleLogin}
          isLoading={isLoggingIn}
          errorMessage={authError}
        />
      </div>
    )
  }

  // 3. Authenticated State: Direct Application Dashboard
  return (
    <div className="w-80 p-0 font-sans min-h-[460px] transition-colors duration-300 relative bg-slate-900 text-slate-100 flex flex-col">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-2 left-5 right-5 z-50 p-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold text-center shadow-lg animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMessage && (
        <div className="m-3 mb-0 p-2 rounded-lg bg-red-600 text-white text-xs font-semibold shadow-lg flex items-center justify-between">
          <span className="flex-1 text-center">⚠️ {errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-white hover:text-red-200 text-xs font-bold px-1.5 py-0.5 ml-2 cursor-pointer rounded hover:bg-red-700/50"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dashboard View */}
      {activePage === 'dashboard' && (
        <Dashboard
          onNavigate={(page) => {
            if (page === 'settings' || page === 'dashboard') {
              setActivePage(page)
            }
          }}
          user={authUser}
          onLogout={handleLogout}
        />
      )}

      {/* Settings View */}
      {activePage === 'settings' && (
        <SettingsPage
          onBack={() => setActivePage('dashboard')}
          applicantCount={0}
          documentCount={0}
          onDataWiped={async () => {
            setActivePage('dashboard')
          }}
        />
      )}
    </div>
  )
}
