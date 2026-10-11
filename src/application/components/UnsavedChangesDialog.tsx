import React, { useEffect, useRef } from 'react'

export interface UnsavedChangesDialogProps {
  isOpen: boolean
  onStay: () => void
  onLeave: () => void
  changedCount?: number
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  onStay,
  onLeave,
  changedCount,
}) => {
  const stayButtonRef = useRef<HTMLButtonElement>(null)

  // Auto-focus the safe 'Stay' button when dialog opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        stayButtonRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Handle ESC key to Stay (safe action)
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onStay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onStay])

  if (!isOpen) return null

  return (
    <div
      id="unsaved-changes-dialog-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
      aria-describedby="unsaved-changes-desc"
    >
      <div
        id="unsaved-changes-dialog-card"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header with Warning Icon */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-600/70 flex items-center justify-center text-amber-400 text-lg flex-shrink-0 mt-0.5">
            ⚠
          </div>
          <div className="min-w-0 flex-1">
            <h3
              id="unsaved-changes-title"
              className="text-base font-bold text-slate-100 tracking-tight"
            >
              Unsaved Changes
            </h3>
            {typeof changedCount === 'number' && changedCount > 0 && (
              <p className="text-xs text-amber-400/90 font-medium mt-0.5">
                {changedCount} {changedCount === 1 ? 'field has' : 'fields have'} unsaved modifications
              </p>
            )}
          </div>
        </div>

        {/* Message Body */}
        <div className="space-y-1.5 py-1 text-slate-200">
          <p id="unsaved-changes-desc" className="text-sm font-semibold text-slate-100">
            Your changes haven't been saved.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Are you sure you want to leave? Your unsaved changes may be lost.
          </p>
        </div>

        {/* Action Buttons: [ Stay ] (Primary / Safe), [ Leave ] (Secondary / Danger) */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            id="unsaved-dialog-leave-btn"
            onClick={onLeave}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800/90 hover:bg-rose-950/80 text-rose-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700/60 transition-all cursor-pointer"
          >
            Leave
          </button>
          <button
            ref={stayButtonRef}
            type="button"
            id="unsaved-dialog-stay-btn"
            onClick={onStay}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm hover:shadow-blue-500/20 transition-all cursor-pointer"
          >
            Stay
          </button>
        </div>
      </div>
    </div>
  )
}
