import React from 'react'

interface GoogleLoginScreenProps {
  onLogin: () => void
  isLoading: boolean
  errorMessage?: string | null
}

export const GoogleLoginScreen: React.FC<GoogleLoginScreenProps> = ({
  onLogin,
  isLoading,
  errorMessage,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[460px] p-6 text-center bg-slate-900 text-slate-100 font-sans select-none">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-xl shadow-blue-500/20 text-3xl">
          ✈️
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-[10px] text-white font-bold">
          ✓
        </div>
      </div>

      <h1 className="text-xl font-bold tracking-tight text-white mb-1.5">
        VISA AUTOFILL
      </h1>
      <p className="text-xs text-slate-400 max-w-[240px] mb-8 leading-relaxed">
        Fast, intelligent visa application automation. Sign in to access your profiles and documents.
      </p>

      {errorMessage && (
        <div className="w-full max-w-xs mb-5 p-2.5 rounded-lg bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs text-left">
          <p className="font-semibold mb-0.5">Authentication Failed</p>
          <p className="text-[11px] opacity-90">{errorMessage}</p>
        </div>
      )}

      <button
        onClick={onLogin}
        disabled={isLoading}
        className="w-full max-w-xs py-3 px-4 rounded-xl bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-800 font-semibold text-sm flex items-center justify-center gap-3 shadow-lg shadow-black/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-700">
            <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Signing in...</span>
          </div>
        ) : (
          <>
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google</span>
          </>
        )}
      </button>

      <div className="mt-8 text-[11px] text-slate-500">
        Secured with Google OAuth 2.0
      </div>
    </div>
  )
}
