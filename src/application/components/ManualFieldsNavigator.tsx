import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { SavedApplication } from '../../core/application/types'
import {
  getManualFieldsStatus,
  navigateToManualField,
  setActiveManualFieldHighlight,
  getActiveTargetFieldId,
  onActiveTargetChange,
  type ManualFieldDefinition,
  type ManualFieldStatusItem,
} from '../manualFieldsRegistry'

export interface ManualFieldsNavigatorProps {
  application: SavedApplication | null
  onExpandSection?: (sectionId: string) => void
  className?: string
}

export const ManualFieldsNavigator: React.FC<ManualFieldsNavigatorProps> = ({
  application,
  onExpandSection,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listContainerRef = useRef<HTMLDivElement>(null)

  const [filterTab, setFilterTab] = useState<'attention' | 'completed' | 'all'>('attention')
  const [activeFieldId, setActiveFieldId] = useState<string | null>(() => getActiveTargetFieldId())

  // Keep activeFieldId synchronized with global workspace clicks and navigation
  useEffect(() => {
    return onActiveTargetChange((newId) => {
      setActiveFieldId(newId)
    })
  }, [])

  // Derive status synchronously from canonical application state — ZERO API calls
  const status = useMemo(() => {
    return getManualFieldsStatus(application)
  }, [application])

  const { needsAttention, completed, blankCount, completedCount, totalCount } = status

  // Select items based on active filter tab
  const tabItems = useMemo(() => {
    if (filterTab === 'completed') return completed
    if (filterTab === 'all') return status.all
    return needsAttention
  }, [filterTab, needsAttention, completed, status.all])

  // Filter items by search query if user typed anything
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return tabItems
    const q = searchQuery.trim().toLowerCase()
    return tabItems.filter(
      (item) =>
        item.definition.label.toLowerCase().includes(q) ||
        item.definition.sectionName.toLowerCase().includes(q) ||
        item.definition.id.toLowerCase().includes(q)
    )
  }, [tabItems, searchQuery])

  // When modal opens or activeFieldId changes, scroll active item right to the middle (block: 'center')
  useEffect(() => {
    if (isOpen && activeFieldId) {
      const timer = setTimeout(() => {
        if (listContainerRef.current) {
          const activeEl = listContainerRef.current.querySelector<HTMLElement>(
            `[data-nav-item-id="${activeFieldId}"]`
          )
          if (activeEl) {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }
      }, 60)
      return () => clearTimeout(timer)
    }
  }, [isOpen, activeFieldId, filterTab])

  // If active field is not in current tab but exists in all, switch tab so it is visible
  useEffect(() => {
    if (isOpen && activeFieldId) {
      const inCurrentTab = tabItems.some((i) => i.definition.id === activeFieldId)
      if (!inCurrentTab && status.all.some((i) => i.definition.id === activeFieldId)) {
        setFilterTab('all')
      }
    }
  }, [isOpen, activeFieldId, tabItems, status.all])

  // Reset search filter when popover closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
    }
  }, [isOpen])

  // Close popover when clicking outside backdrop
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return

      if (containerRef.current && containerRef.current.contains(target)) {
        return
      }

      setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close popover on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleFieldClick = useCallback(
    (fieldDef: ManualFieldDefinition) => {
      // 1. Activate in registry and DOM
      setActiveManualFieldHighlight(fieldDef.id)

      // 2. Close modal as requested: "click dile jate modal ta close hoye jay"
      setIsOpen(false)

      // 3. Smoothly navigate, scroll and focus in workspace
      requestAnimationFrame(() => {
        navigateToManualField(fieldDef, { onExpandSection })
      })
    },
    [onExpandSection]
  )

  const isCompleted = blankCount === 0

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* 1. Header Navbar Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        id="manual-fields-nav-button"
        data-field-id="manual-fields-navigator-button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={
          isCompleted
            ? 'Manual Entry: 0 fields need your input'
            : `Manual Entry: ${blankCount} fields need your input`
        }
        title={
          isCompleted
            ? 'All manual fields are completed'
            : `${blankCount} blank field${blankCount === 1 ? '' : 's'} need your input`
        }
        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer shadow-xs select-none ${
          isCompleted
            ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/60 text-emerald-200'
            : 'bg-amber-950/80 hover:bg-amber-900/90 border-amber-500/70 text-amber-200 ring-1 ring-amber-500/30'
        }`}
      >
        <span className="text-[13px] leading-none" aria-hidden="true">
          {isCompleted ? '✓' : '⚠'}
        </span>
        <span className="font-semibold whitespace-nowrap">
          {isCompleted ? 'Manual Entry (0)' : `Manual Entry (${blankCount})`}
        </span>

        <span className="text-[9px] text-slate-400 ml-0.5 opacity-80" aria-hidden="true">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* 2. Compact Popover Dropdown Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Manual Entry Navigator"
          className="absolute right-0 mt-2 w-88 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[min(500px,80vh)] animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Panel Header */}
          <div className="px-3.5 py-2.5 bg-slate-850 border-b border-slate-750 flex items-center justify-between gap-2 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  Manual Entry & Status
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold border ${
                    isCompleted
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                      : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                  }`}
                >
                  {isCompleted ? '0 Left' : `${blankCount} Left`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {blankCount > 0 ? (
                  <span className="text-amber-400 font-medium">
                    {blankCount} {blankCount === 1 ? 'blank field needs' : 'blank fields need'} your input
                  </span>
                ) : (
                  <span className="text-emerald-400 font-medium">
                    ✓ All manual fields completed
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-xs cursor-pointer"
              title="Close Manual Entry Navigator"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Smart Status Filter Tabs */}
          <div className="px-2.5 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center gap-1 flex-shrink-0 text-[11px]">
            <button
              type="button"
              onClick={() => setFilterTab('attention')}
              className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                filterTab === 'attention'
                  ? 'bg-amber-950/90 text-amber-300 border border-amber-700/70'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Needs Input ({blankCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('completed')}
              className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                filterTab === 'completed'
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/70'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Completed ({completedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-blue-950/90 text-blue-300 border border-blue-700/70'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({totalCount})
            </button>
          </div>

          {/* Quick Filter Search Input when items exist */}
          {tabItems.length > 4 && (
            <div className="px-2.5 pt-2 pb-1 bg-slate-900 border-b border-slate-800 flex-shrink-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter fields (e.g. occupation, name)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                    aria-label="Clear filter"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Scrollable Items List */}
          <div ref={listContainerRef} className="p-2 overflow-y-auto space-y-1.5 flex-1 max-h-[380px]">
            {filterTab === 'attention' && blankCount === 0 ? (
              <div className="px-3 py-6 text-center space-y-1.5">
                <div className="text-2xl text-emerald-400">✓</div>
                <div className="text-xs font-bold text-emerald-300">
                  All Manual Fields Completed
                </div>
                <p className="text-[11px] text-slate-400">
                  No blank manual fields remain. You can review your details and save the application.
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-400">
                No fields match "{searchQuery}"
              </div>
            ) : (
              filteredItems.map((item) => (
                <ManualFieldItemRow
                  key={item.definition.id}
                  item={item}
                  isActive={activeFieldId === item.definition.id}
                  onClick={() => handleFieldClick(item.definition)}
                />
              ))
            )}
          </div>

          {/* Panel Footer */}
          <div className="px-3 py-2 bg-slate-950/60 border-t border-slate-800/90 flex items-center justify-between text-[10px] text-slate-400 flex-shrink-0">
            <span>Click any field to scroll & highlight</span>
            <span className="font-mono text-slate-500">ESC to close</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Interactive button row for each manual field with Smart Field Status indicator
 * and persistent active/selected state tracking
 */
interface ManualFieldItemRowProps {
  item: ManualFieldStatusItem
  isActive: boolean
  onClick: () => void
}

const ManualFieldItemRow: React.FC<ManualFieldItemRowProps> = ({ item, isActive, onClick }) => {
  const { definition, statusInfo, isFilled, valuePreview } = item
  const status = statusInfo?.status || (isFilled ? 'completed' : 'incomplete')

  return (
    <button
      type="button"
      data-nav-item-id={definition.id}
      onClick={onClick}
      aria-current={isActive ? 'true' : undefined}
      aria-label={`Navigate to ${definition.label} in ${definition.sectionName}`}
      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between gap-2 cursor-pointer group border relative ${
        isActive
          ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-400/60 shadow-lg text-white'
          : status === 'needs_review'
          ? 'bg-amber-950/30 hover:bg-amber-950/60 border-amber-800/50 text-amber-200 hover:border-amber-500'
          : status === 'completed'
          ? 'bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-900/40 text-emerald-200 hover:border-emerald-600/70'
          : 'bg-amber-950/20 hover:bg-amber-950/50 border-amber-900/40 text-amber-200 hover:border-amber-600/70'
      }`}
    >
      {/* Active Left Indicator Bar */}
      {isActive && (
        <span
          className="absolute left-0 top-1 bottom-1 w-1 bg-amber-400 rounded-r shadow-[0_0_8px_#f59e0b]"
          aria-hidden="true"
        />
      )}

      <div className="flex items-center gap-2 min-w-0 flex-1 pl-1">
        {/* Smart Status Icon */}
        <span
          className={`flex-shrink-0 text-xs font-bold ${
            isActive
              ? 'text-amber-300'
              : status === 'needs_review'
              ? 'text-amber-400'
              : status === 'completed'
              ? 'text-emerald-400'
              : 'text-amber-400'
          }`}
          aria-hidden="true"
        >
          {isActive ? '▶' : status === 'needs_review' ? '⚠' : status === 'completed' ? '✓' : '⚠'}
        </span>

        {/* Field Label and preview */}
        <div className="min-w-0 flex-1">
          <div
            className={`truncate ${
              isActive
                ? 'font-bold text-amber-100 text-[12px]'
                : 'font-medium text-slate-100 group-hover:text-white'
            }`}
          >
            {definition.label}
          </div>
          {valuePreview && (
            <div
              className={`text-[10px] truncate font-mono ${
                isActive ? 'text-amber-200/90 font-medium' : 'text-slate-400'
              }`}
            >
              {valuePreview}
            </div>
          )}
        </div>
      </div>

      {/* Smart Status Badge & Section */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isActive ? (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400 text-slate-950 shadow-xs uppercase tracking-wider">
            Active
          </span>
        ) : status === 'needs_review' ? (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-700/60">
            Review
          </span>
        ) : null}
        <span
          className={`px-1.5 py-0.2 rounded text-[10px] font-medium border truncate max-w-[110px] ${
            isActive
              ? 'bg-slate-800 text-amber-200 border-amber-500/50'
              : 'bg-slate-800 text-slate-400 border border-slate-700/60 group-hover:border-slate-600'
          }`}
        >
          {definition.sectionName}
        </span>
        <span
          className={`text-[10px] transition-transform ${
            isActive
              ? 'text-amber-300 translate-x-0.5 font-bold'
              : 'text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5'
          }`}
          aria-hidden="true"
        >
          →
        </span>
      </div>
    </button>
  )
}
