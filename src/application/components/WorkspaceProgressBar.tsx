import React, { useState, useRef, useEffect } from 'react'
import type { WorkspacePageProgress } from '../../core/application/workspaceProgress'
import { WORKSPACE_PAGES } from '../../core/application/fieldSchema'

export interface WorkspaceProgressBarProps {
  percentage: number
  filled: number
  total: number
  isComplete: boolean
  loading?: boolean
  className?: string
  pageProgress?: Record<string, WorkspacePageProgress>
  editedCount?: number
  onSectionClick?: (sectionId: string) => void
  passportDoc?: { fileName: string; confirmed: boolean } | null
  ogdDoc?: { fileName: string; confirmed: boolean } | null
}

export const WorkspaceProgressBar: React.FC<WorkspaceProgressBarProps> = ({
  percentage,
  filled,
  total,
  isComplete,
  loading = false,
  className = '',
  pageProgress,
  editedCount = 0,
  onSectionClick,
  passportDoc,
  ogdDoc,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const safePercentage = total > 0 ? Math.max(0, Math.min(100, Math.round(percentage))) : 0
  const complete = isComplete || (total > 0 && filled >= total && safePercentage === 100)

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Interactive Slim Pill Container */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1 rounded-full border transition-all duration-200 cursor-pointer select-none shadow-xs ${
          isOpen
            ? 'bg-slate-800 border-blue-500/80 ring-2 ring-blue-500/20 shadow-md'
            : complete
            ? 'bg-emerald-950/80 hover:bg-emerald-900/90 border-emerald-600/70 hover:border-emerald-500 text-emerald-200'
            : safePercentage >= 75
            ? 'bg-slate-800/90 hover:bg-slate-800 border-blue-600/60 hover:border-blue-400 text-blue-200'
            : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-200'
        }`}
        title="Click to view full application progress breakdown and section navigation"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        {/* Status indicator icon */}
        <span className="flex items-center text-xs">
          {loading ? (
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          ) : complete ? (
            <span className="text-emerald-400 text-xs">✓</span>
          ) : (
            <span className="text-blue-400 text-xs">📊</span>
          )}
        </span>

        {/* Embedded Mini Progress Bar Track */}
        <div
          role="progressbar"
          aria-valuenow={safePercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Application completion: ${safePercentage} percent`}
          aria-valuetext={`${safePercentage}% complete, ${filled} of ${total} fields filled`}
          className="w-14 sm:w-24 md:w-32 h-2 bg-slate-900/90 rounded-full overflow-hidden p-0.5 border border-slate-700/80 flex items-center"
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              loading
                ? 'bg-slate-600 animate-pulse w-full'
                : complete
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300'
                : safePercentage >= 70
                ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400'
                : safePercentage >= 35
                ? 'bg-gradient-to-r from-blue-600 to-indigo-500'
                : safePercentage > 0
                ? 'bg-gradient-to-r from-blue-700 to-blue-500'
                : 'bg-transparent'
            }`}
            style={{ width: loading ? '100%' : `${safePercentage}%` }}
          />
        </div>

        {/* Percentage Badge */}
        <span
          className={`text-xs font-bold tracking-tight transition-colors ${
            complete ? 'text-emerald-300' : 'text-blue-300'
          }`}
        >
          {loading ? '...' : `${safePercentage}%`}
        </span>

        {/* Field Count Badge */}
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-300 font-medium">
          <strong className={complete ? 'text-emerald-300' : 'text-slate-100'}>{filled}</strong>
          <span className="text-slate-500">/</span>
          <span>{total}</span>
          <span className="text-slate-400 text-[10px] hidden md:inline">fields</span>
        </span>

        {/* Interactive Chevron Indicator */}
        <span
          className={`text-[10px] text-slate-400 transition-transform duration-200 ml-0.5 ${
            isOpen ? 'rotate-180 text-blue-400' : 'group-hover:text-slate-200'
          }`}
        >
          ▾
        </span>
      </button>

      {/* Floating Interactive Popover Drawer */}
      {isOpen && (
        <div className="absolute top-full mt-2.5 left-1/2 -translate-x-1/2 w-80 sm:w-96 bg-slate-900/98 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl p-4 z-50 text-slate-200 animate-in fade-in zoom-in-95 duration-150">
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-sm">📊</span>
              <div>
                <h4 className="text-xs font-bold text-white tracking-tight">Application Completion</h4>
                <p className="text-[11px] text-slate-400">
                  {complete ? 'All required fields completed' : `${total - filled} fields remaining`}
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                complete
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600/70'
                  : 'bg-blue-950 text-blue-200 border-blue-600/70'
              }`}
            >
              {safePercentage}% Complete
            </span>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-4 gap-2 py-3 border-b border-slate-800 text-center">
            <div className="bg-slate-800/60 rounded-lg p-1.5 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Total</span>
              <strong className="text-xs text-white font-bold">{total}</strong>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-1.5 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Filled</span>
              <strong className="text-xs text-emerald-400 font-bold">{filled}</strong>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-1.5 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Remaining</span>
              <strong className="text-xs text-amber-400 font-bold">{Math.max(0, total - filled)}</strong>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-1.5 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Edited</span>
              <strong className="text-xs text-blue-400 font-bold">{editedCount}</strong>
            </div>
          </div>

          {/* Section Breakdown (Click to Jump) */}
          <div className="py-3 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block px-1">
              Page Breakdown (Click to jump)
            </span>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {WORKSPACE_PAGES.map((page) => {
                const stat = pageProgress?.[page.id] || {
                  total: page.fieldKeys.length,
                  filled: 0,
                  percentage: 0,
                  isComplete: false,
                }

                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => {
                      onSectionClick?.(page.id)
                      setIsOpen(false)
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-xs hover:bg-slate-800 transition-colors text-left group/item border border-transparent hover:border-slate-700 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center justify-center flex-shrink-0 group-hover/item:bg-blue-600 group-hover/item:text-white transition-colors">
                        {page.pageNumber}
                      </span>
                      <span className="truncate text-slate-300 group-hover/item:text-white font-medium">
                        {page.title.replace(/^\d+\.\s*/, '')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Mini Bar */}
                      <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div
                          className={`h-full rounded-full ${
                            stat.isComplete
                              ? 'bg-emerald-400'
                              : stat.filled > 0
                              ? 'bg-blue-500'
                              : 'bg-transparent'
                          }`}
                          style={{ width: `${stat.percentage}%` }}
                        />
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                          stat.isComplete
                            ? 'text-emerald-400 bg-emerald-950/80'
                            : 'text-slate-300 bg-slate-800'
                        }`}
                      >
                        {stat.filled}/{stat.total}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Document Provenance Summary */}
          {(passportDoc || ogdDoc) && (
            <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-3">
                {passportDoc && (
                  <span className="flex items-center gap-1 text-emerald-400" title={passportDoc.fileName}>
                    <span>🛂</span>
                    <span className="truncate max-w-[120px]">{passportDoc.fileName}</span>
                  </span>
                )}
                {ogdDoc && (
                  <span className="flex items-center gap-1 text-purple-400" title={ogdDoc.fileName}>
                    <span>📄</span>
                    <span className="truncate max-w-[120px]">{ogdDoc.fileName}</span>
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500">Auto-synced</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
