import React, { useState } from 'react'
import { Button } from '../../components/ui'
import type { ApplicantProfile } from '../../core/applicant'

export interface ApplicantsPageProps {
  applicants: ApplicantProfile[]
  selectedApplicantId: string | null
  onBack: () => void
  onAddApplicant: () => void
  onEditApplicant: (applicant: ApplicantProfile) => void
  onSelectApplicant: (id: string) => void
  onDuplicateApplicant: (applicant: ApplicantProfile) => Promise<void>
  onDeleteApplicant: (id: string) => Promise<void>
}

export const ApplicantsPage: React.FC<ApplicantsPageProps> = ({
  applicants,
  selectedApplicantId,
  onBack,
  onAddApplicant,
  onEditApplicant,
  onSelectApplicant,
  onDuplicateApplicant,
  onDeleteApplicant,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null)

  const maskPassport = (num?: string): string => {
    if (!num) return 'Not Provided'
    if (num.length <= 4) return '••••••••'
    return `•••• ${num.slice(-4)}`
  }

  const handleConfirmDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      await onDeleteApplicant(id)
      setDeleteConfirmId(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDuplicate = async (applicant: ApplicantProfile) => {
    setIsDuplicating(applicant.applicantId)
    try {
      await onDuplicateApplicant(applicant)
    } finally {
      setIsDuplicating(null)
    }
  }

  const filteredApplicants = applicants.filter((app) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    const fullName = `${app.personalInfo.givenNames || ''} ${app.personalInfo.surname || ''}`.toLowerCase()
    const id = app.applicantId.toLowerCase()
    const nat = (app.personalInfo.nationality || '').toLowerCase()

    return fullName.includes(q) || id.includes(q) || nat.includes(q)
  })

  return (
    <div
      className="rounded-xl p-5 shadow-lg space-y-4 transition-colors duration-300 min-h-[380px] flex flex-col"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold flex items-center gap-1 hover:underline cursor-pointer"
          style={{ color: 'var(--color-accent)' }}
        >
          ← Back
        </button>
        <h2 className="text-base font-extrabold" style={{ color: 'var(--color-text)' }}>
          My Applicants ({applicants.length})
        </h2>
        <Button variant="primary" size="sm" onClick={onAddApplicant}>
          + Add
        </Button>
      </div>

      {/* Search Input */}
      {applicants.length > 0 && (
        <div className="relative">
          <input
            type="text"
            className="w-full p-2 pl-8 rounded-lg border text-xs bg-white"
            placeholder="Search applicants by name, nationality, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="absolute left-2.5 top-2 text-xs text-slate-400">🔍</span>
        </div>
      )}

      {/* Delete Confirmation Overlay Modal */}
      {deleteConfirmId && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-left space-y-2">
          <div className="text-xs font-bold text-red-800">Delete this applicant?</div>
          <div className="text-[11px] text-red-600">
            This profile and any associated document records will be permanently deleted from local extension storage.
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirmId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <button
              type="button"
              onClick={() => handleConfirmDelete(deleteConfirmId)}
              disabled={isDeleting}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Applicants List */}
      <div className="flex-1 overflow-y-auto max-h-[300px] space-y-3 pr-1">
        {filteredApplicants.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-full text-lg"
              style={{ backgroundColor: 'var(--color-bg-start)', color: 'var(--color-primary)' }}
            >
              👤
            </div>
            <div>
              <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                {searchQuery ? 'No matching applicants found' : 'No applicants yet'}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Add your first applicant profile to get started.'}
              </div>
            </div>
            {!searchQuery && (
              <div className="pt-2">
                <Button variant="primary" size="sm" onClick={onAddApplicant}>
                  + Add Applicant
                </Button>
              </div>
            )}
          </div>
        ) : (
          filteredApplicants.map((applicant) => {
            const isSelected = applicant.applicantId === selectedApplicantId
            const fullName =
              `${applicant.personalInfo.givenNames || ''} ${applicant.personalInfo.surname || ''}`.trim() ||
              'Unnamed Applicant'

            return (
              <div
                key={applicant.applicantId}
                className="p-3 rounded-lg text-left space-y-2 transition-all"
                style={{
                  backgroundColor: isSelected ? 'var(--color-bg-middle)' : 'var(--color-surface)',
                  borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                  borderWidth: isSelected ? '2px' : '1px',
                  borderStyle: 'solid',
                }}
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                    {fullName}
                  </span>
                  {isSelected && (
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-xs"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      Selected
                    </span>
                  )}
                </div>

                {/* Details summary with masked passport */}
                <div className="text-xs space-y-0.5" style={{ color: 'var(--color-muted)' }}>
                  {applicant.personalInfo.nationality && (
                    <div>Nationality: {applicant.personalInfo.nationality}</div>
                  )}
                  <div>Passport: {maskPassport(applicant.passport?.passportNumber)}</div>
                  {applicant.personalInfo.dateOfBirth && (
                    <div>DOB: {applicant.personalInfo.dateOfBirth}</div>
                  )}
                </div>

                {/* Action buttons */}
                <div
                  className="flex items-center justify-between pt-2 border-t"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div>
                    {!isSelected && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onSelectApplicant(applicant.applicantId)}
                      >
                        Select
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDuplicate(applicant)}
                      disabled={isDuplicating === applicant.applicantId}
                      className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline px-1.5 py-1 font-medium cursor-pointer"
                    >
                      {isDuplicating === applicant.applicantId ? 'Duplicating...' : 'Duplicate'}
                    </button>
                    <Button variant="ghost" size="sm" onClick={() => onEditApplicant(applicant)}>
                      Edit
                    </Button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(applicant.applicantId)}
                      className="text-xs text-red-600 hover:text-red-800 hover:underline px-1.5 py-1 font-medium cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
