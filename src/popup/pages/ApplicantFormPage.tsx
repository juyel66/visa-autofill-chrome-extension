import React, { useState } from 'react'
import {
  AccommodationSection,
  AddressSection,
  ContactSection,
  EmploymentSection,
  FamilySection,
  NotesSection,
  PassportSection,
  PersonalInformationSection,
  ReferenceSection,
  TravelSection,
} from '../../components/applicant'
import { Button } from '../../components/ui'
import type { ApplicantProfile, ValidationError } from '../../core'
import { createEmptyApplicant, normalizeApplicant, validateApplicant } from '../../core'

export interface ApplicantFormPageProps {
  initialApplicant?: ApplicantProfile | null
  onSave: (applicant: ApplicantProfile) => Promise<void>
  onCancel: () => void
}

type FormSection =
  | 'personal'
  | 'passport'
  | 'presentAddress'
  | 'permanentAddress'
  | 'contact'
  | 'family'
  | 'employment'
  | 'travel'
  | 'accommodation'
  | 'reference'
  | 'notes'

export const ApplicantFormPage: React.FC<ApplicantFormPageProps> = ({
  initialApplicant,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState<ApplicantProfile>(() => {
    return initialApplicant ? JSON.parse(JSON.stringify(initialApplicant)) : createEmptyApplicant()
  })

  const [activeTab, setActiveTab] = useState<FormSection>('personal')
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isDirty, setIsDirty] = useState<boolean>(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])

  const isEditing = Boolean(initialApplicant)

  const handleFormChange = (updated: ApplicantProfile) => {
    setFormData(updated)
    setIsDirty(true)
  }

  const getFieldError = (fieldKey: string): string | undefined => {
    const found = validationErrors.find((err) => err.field === fieldKey)
    return found ? found.message : undefined
  }

  const sectionHasErrors = (section: FormSection): boolean => {
    return validationErrors.some((err) => err.field.startsWith(section))
  }

  const handleCancelClick = () => {
    if (isDirty) {
      setShowDiscardConfirm(true)
    } else {
      onCancel()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationErrors([])

    // 1. Immutable Data Normalization
    const normalizedData = normalizeApplicant(formData)
    setFormData(normalizedData)

    // 2. Structural & Format Validation
    const validationResult = validateApplicant(normalizedData)

    if (!validationResult.valid) {
      setValidationErrors(validationResult.errors)

      // Switch active tab to the first section that has an error
      const firstErrorField = validationResult.errors[0]?.field
      if (firstErrorField) {
        if (firstErrorField.startsWith('personalInfo')) setActiveTab('personal')
        else if (firstErrorField.startsWith('passport')) setActiveTab('passport')
        else if (firstErrorField.startsWith('presentAddress')) setActiveTab('presentAddress')
        else if (firstErrorField.startsWith('permanentAddress')) setActiveTab('permanentAddress')
        else if (firstErrorField.startsWith('contact')) setActiveTab('contact')
        else if (firstErrorField.startsWith('family')) setActiveTab('family')
        else if (firstErrorField.startsWith('employment')) setActiveTab('employment')
        else if (firstErrorField.startsWith('travel')) setActiveTab('travel')
        else if (firstErrorField.startsWith('accommodation')) setActiveTab('accommodation')
        else if (firstErrorField.startsWith('reference')) setActiveTab('reference')
      }
      return
    }

    // 3. Save Normalized Valid Profile
    setIsSaving(true)
    try {
      await onSave(normalizedData)
    } finally {
      setIsSaving(false)
    }
  }

  const sections: { id: FormSection; label: string }[] = [
    { id: 'personal', label: 'Personal' },
    { id: 'passport', label: 'Passport' },
    { id: 'presentAddress', label: 'Pres. Addr' },
    { id: 'permanentAddress', label: 'Perm. Addr' },
    { id: 'contact', label: 'Contact' },
    { id: 'family', label: 'Family' },
    { id: 'employment', label: 'Work' },
    { id: 'travel', label: 'Travel' },
    { id: 'accommodation', label: 'Stay' },
    { id: 'reference', label: 'Ref' },
    { id: 'notes', label: 'Notes' },
  ]

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl p-4 shadow-lg space-y-3 transition-colors duration-300 min-h-[440px] flex flex-col relative"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {/* Top Bar Header */}
      <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <button
          type="button"
          onClick={handleCancelClick}
          className="text-xs font-semibold hover:underline cursor-pointer"
          style={{ color: 'var(--color-muted)' }}
        >
          Cancel
        </button>
        <h2 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
          {isEditing ? 'Edit Applicant' : 'New Applicant Profile'}
        </h2>
        <Button variant="primary" size="sm" type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Applicant'}
        </Button>
      </div>

      {/* Discard Confirmation Modal Overlay */}
      {showDiscardConfirm && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-left space-y-2 z-50">
          <div className="text-xs font-bold text-amber-800">Discard unsaved changes?</div>
          <div className="text-[11px] text-amber-700">
            You have modified this applicant profile. Canceling will discard your edits.
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setShowDiscardConfirm(false)}
            >
              Continue Editing
            </Button>
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition cursor-pointer"
            >
              Discard Changes
            </button>
          </div>
        </div>
      )}

      {/* Validation Summary Error Banner */}
      {validationErrors.length > 0 && (
        <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-left text-xs space-y-1">
          <div className="font-bold flex items-center gap-1">
            <span>⚠️</span>
            <span>Please correct validation errors before saving:</span>
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
            {validationErrors.map((err, index) => (
              <li key={index}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-none text-[11px]">
        {sections.map((sec) => {
          const hasErr = sectionHasErrors(sec.id)
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveTab(sec.id)}
              className={`px-2 py-1 rounded font-medium whitespace-nowrap cursor-pointer transition relative ${
                activeTab === sec.id ? 'font-bold' : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                backgroundColor: hasErr
                  ? '#FEE2E2'
                  : activeTab === sec.id
                  ? 'var(--color-primary)'
                  : 'var(--color-bg-middle)',
                color: hasErr ? '#991B1B' : activeTab === sec.id ? '#FFFFFF' : 'var(--color-text)',
              }}
            >
              {sec.label}
              {hasErr && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block ml-1"></span>
              )}
            </button>
          )
        })}
      </div>

      {/* Form Content Area */}
      <div className="flex-1 overflow-y-auto max-h-[320px] text-xs text-left space-y-3 pr-1">
        {activeTab === 'personal' && (
          <PersonalInformationSection
            data={formData}
            onChange={handleFormChange}
            getFieldError={getFieldError}
          />
        )}

        {activeTab === 'passport' && (
          <PassportSection
            data={formData}
            onChange={handleFormChange}
            getFieldError={getFieldError}
          />
        )}

        {activeTab === 'presentAddress' && (
          <AddressSection data={formData} onChange={handleFormChange} isPermanentSection={false} />
        )}

        {activeTab === 'permanentAddress' && (
          <AddressSection data={formData} onChange={handleFormChange} isPermanentSection={true} />
        )}

        {activeTab === 'contact' && (
          <ContactSection
            data={formData}
            onChange={handleFormChange}
            getFieldError={getFieldError}
          />
        )}

        {activeTab === 'family' && <FamilySection data={formData} onChange={handleFormChange} />}

        {activeTab === 'employment' && <EmploymentSection data={formData} onChange={handleFormChange} />}

        {activeTab === 'travel' && <TravelSection data={formData} onChange={handleFormChange} />}

        {activeTab === 'accommodation' && <AccommodationSection data={formData} onChange={handleFormChange} />}

        {activeTab === 'reference' && <ReferenceSection data={formData} onChange={handleFormChange} />}

        {activeTab === 'notes' && <NotesSection data={formData} onChange={handleFormChange} />}
      </div>
    </form>
  )
}
