import { useState } from 'react'
import { sendToBackground } from '../core/messaging'
import type { BackgroundPongPayload, ContentPongPayload } from '../core/messaging'

export default function App() {
  const [bgResult, setBgResult] = useState<string | null>(null)
  const [csResult, setCsResult] = useState<string | null>(null)
  const [bgLoading, setBgLoading] = useState(false)
  const [csLoading, setCsLoading] = useState(false)

  const handleTestBackground = async () => {
    setBgLoading(true)
    setBgResult(null)
    const response = await sendToBackground<BackgroundPongPayload>({
      type: 'PING_BACKGROUND',
    })
    setBgLoading(false)
    if (response.status === 'success') {
      setBgResult(response.data.message)
    } else {
      setBgResult(response.error)
    }
  }

  const handleTestContentScript = async () => {
    setCsLoading(true)
    setCsResult(null)
    const response = await sendToBackground<ContentPongPayload>({
      type: 'PING_CONTENT',
    })
    setCsLoading(false)
    if (response.status === 'success') {
      setCsResult(response.data.message)
    } else {
      setCsResult(response.error)
    }
  }

  return (
    <div className="w-80 bg-slate-900 text-slate-100 p-5 font-sans">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 font-bold text-xl mb-1">
          V
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Visa Autofill</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Smart Visa Application Autofill</p>
        </div>

        <div className="pt-3 border-t border-slate-700/60 text-left">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Extension Status
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-semibold text-emerald-400">Ready</span>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-700/60 text-left space-y-3">
          <div className="text-xs font-semibold text-slate-300">
            Extension Communication Test
          </div>

          <div className="space-y-2">
            <button
              onClick={handleTestBackground}
              disabled={bgLoading}
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition shadow cursor-pointer"
            >
              {bgLoading ? 'Testing...' : 'Test Background'}
            </button>
            {bgResult !== null && (
              <div className="p-2 bg-slate-950/60 rounded border border-slate-700 text-xs">
                <span className="text-slate-400 font-medium">Result: </span>
                <span className={bgResult.includes('working') ? 'text-emerald-400' : 'text-amber-400'}>
                  {bgResult}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <button
              onClick={handleTestContentScript}
              disabled={csLoading}
              className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition shadow cursor-pointer"
            >
              {csLoading ? 'Testing...' : 'Test Content Script'}
            </button>
            {csResult !== null && (
              <div className="p-2 bg-slate-950/60 rounded border border-slate-700 text-xs">
                <span className="text-slate-400 font-medium">Result: </span>
                <span className={csResult.includes('working') ? 'text-emerald-400' : 'text-amber-400'}>
                  {csResult}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
