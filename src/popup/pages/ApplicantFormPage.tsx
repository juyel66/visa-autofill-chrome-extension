import React, { useState } from 'react'
import { Button } from '../../components/ui'
import type { ApplicantProfile } from '../../core'

export interface ApplicantFormPageProps {
  initialApplicant?: ApplicantProfile | null
  onSave: (applicant: ApplicantProfile) => Promise<void>
  onCancel: () => void
}

export const ApplicantFormPage: React.FC<ApplicantFormPageProps> = ({
  initialApplicant,
  onSave,
  onCancel,
}) => {
  const [applicantId, setApplicantId] = useState<string>(() => {
    return initialApplicant ? initialApplicant.applicantId : ''
  })
  const [notes, setNotes] = useState<string>(() => {
    return initialApplicant ? initialApplicant.notes || '' : ''
  })
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = Boolean(initialApplicant)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanId = applicantId.trim()
    if (!cleanId) {
      setError('Profile Number / ID is required.')
      return
    }

    setIsSaving(true)
    try {
      const savedProfile: ApplicantProfile = {
        applicantId: cleanId,
        createdAt: initialApplicant ? initialApplicant.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: notes.trim(),
      }
      await onSave(savedProfile)
    } catch (err) {
      console.error('Failed to save profile:', err)
      setError('Failed to save profile.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl p-4 shadow-lg space-y-4 transition-colors duration-300 min-h-[440px] flex flex-col justify-between text-left"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold hover:underline cursor-pointer"
            style={{ color: 'var(--color-muted)' }}
          >
            Cancel
          </button>
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
            {isEditing ? 'Edit Profile' : 'New Profile'}
          </h2>
          <Button variant="primary" size="sm" type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-2 rounded bg-red-100 border border-red-300 text-red-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Inputs */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 block">Profile Number / ID</label>
            <input
              type="text"
              value={applicantId}
              onChange={(e) => setApplicantId(e.target.value)}
              disabled={isEditing}
              placeholder="e.g. 1001"
              className="w-full p-2 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
              style={{ borderColor: 'var(--color-border)' }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 block">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Mission: DHAKA"
              rows={6}
              className="w-full p-2 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
              style={{ borderColor: 'var(--color-border)' }}
            />
          </div>
        </div>
      </div>
    </form>
  )
}
