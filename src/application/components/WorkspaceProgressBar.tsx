import React from 'react'

export interface WorkspaceProgressBarProps {
  percentage: number
  filled: number
  total: number
  isComplete: boolean
  loading?: boolean
  className?: string
}

export const WorkspaceProgressBar: React.FC<WorkspaceProgressBarProps> = ({
  percentage,
  filled,
  total,
  isComplete,
  loading = false,
  className = '',
}) => {
  const safePercentage = total > 0 ? Math.max(0, Math.min(100, Math.round(percentage))) : 0
  const complete = isComplete || (total > 0 && filled >= total && safePercentage === 100)

  return (
    <div
      className={`w-full bg-slate-900/90 border-t border-b border-slate-800/90 shadow-sm px-4 sm:px-6 py-2.5 transition-all ${className}`}
      aria-label={`Application completion: ${safePercentage} percent`}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-1.5">
        {/* Top Label & Counters Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Left: Section Label & Status Badge */}
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-slate-200 tracking-tight flex items-center gap-1.5">
              <span className="text-blue-400 text-sm">📊</span>
              <span className="hidden sm:inline">Application Completion</span>
              <span className="sm:hidden">Completion</span>
            </span>

            {loading ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 animate-pulse">
                Calculating...
              </span>
            ) : complete ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/70 shadow-xs shadow-emerald-500/20">
                <svg
                  className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>100% Complete</span>
              </span>
            ) : safePercentage === 0 ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                0% Complete
              </span>
            ) : (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                  safePercentage >= 75
                    ? 'bg-blue-950 text-blue-200 border-blue-600/70 shadow-xs shadow-blue-500/10'
                    : safePercentage >= 40
                    ? 'bg-indigo-950/80 text-indigo-200 border-indigo-700/60'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {safePercentage}% Complete
              </span>
            )}
          </div>

          {/* Right: Filled / Total Count */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {loading ? (
              <span className="text-slate-500 italic text-[11px]">Loading application data...</span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-300 font-medium">
                  <strong
                    className={`font-bold transition-colors ${
                      complete ? 'text-emerald-400' : 'text-slate-100'
                    }`}
                  >
                    {filled}
                  </strong>
                  <span className="text-slate-500"> / </span>
                  <span className="text-slate-300">{total}</span>
                  <span className="text-slate-400 ml-1">fields</span>
                </span>
                {total - filled > 0 && (
                  <span className="hidden sm:inline-block text-[11px] text-slate-500">
                    ({total - filled} remaining)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Visual Progress Bar Track */}
        <div
          role="progressbar"
          aria-valuenow={safePercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Application completion: ${safePercentage} percent`}
          aria-valuetext={`${safePercentage}% complete, ${filled} of ${total} fields filled`}
          className="w-full h-2 sm:h-2.5 bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/70 shadow-inner"
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              loading
                ? 'bg-slate-700 animate-pulse w-full'
                : complete
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 shadow-sm shadow-emerald-500/40'
                : safePercentage >= 70
                ? 'bg-gradient-to-r from-blue-600 via-indigo-500 to-teal-400 shadow-sm shadow-blue-500/20'
                : safePercentage >= 35
                ? 'bg-gradient-to-r from-blue-600 to-indigo-500 shadow-sm shadow-blue-500/10'
                : safePercentage > 0
                ? 'bg-gradient-to-r from-blue-700 to-blue-500'
                : 'bg-transparent'
            }`}
            style={{ width: loading ? '100%' : `${safePercentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}
