import React, { useState } from 'react'
import { Button } from '../../components/ui'
import type { ApplicantProfile, Gender } from '../../core/applicant'
import type {
  ExtractedApplicantData,
  ExtractedFieldConflict,
  ExtractedFieldReviewItem,
  ExtractionSource,
  ReviewDecision,
} from '../../core/extraction'
import {
  applyReviewDecisions,
  compareApplicantWithExtraction,
  isReviewStale,
} from '../../core/extraction'

export interface ExtractionReviewModalProps {
  targetApplicant: ApplicantProfile
  initialData: ExtractedApplicantData
  conflicts: ExtractedFieldConflict<unknown>[]
  onConfirm: (confirmedData: ExtractedApplicantData) => void
  onClose: () => void
}


export interwwc = new int ew

export const ExtractionReviewModal: React.FC<ExtractionReviewModalProps> = ({
  targetApplicant,
  initialData,
  conflicts,
  onConfirm,
  onClose,
}) => {
  const [reviewResult, setReviewResult] = useState(() =>
    compareApplicantWithExtraction(targetApplicant, initialData)
  )

  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null)
  const [customEditValue, setCustomEditValue] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isStale = isReviewStale(targetApplicant, reviewResult.snapshotTimestamp)

  const handleDecisionChange = (index: number, decision: ReviewDecision) => {
    setReviewResult((prev) => {
      const updatedItems = [...prev.reviewItems]
      const item = updatedItems[index]
      if (item) {
        updatedItems[index] = { ...item, decision }
      }
      return { ...prev, reviewItems: updatedItems }
    })
  }

  const handleStartEdit = (index: number, currentVal?: string) => {
    setEditingFieldIndex(index)
    setCustomEditValue(currentVal || '')
  }

  const handleSaveEdit = (index: number) => {
    setReviewResult((prev) => {
      const updatedItems = [...prev.reviewItems]
      const item = updatedItems[index]
      if (item) {
        updatedItems[index] = {
          ...item,
          decision: 'edit',
          editedValue: customEditValue,
        }
      }
      return { ...prev, reviewItems: updatedItems }
    })
    setEditingFieldIndex(null)
  }

  const handleApplyChanges = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (isStale) {
      setErrorMessage(
        'Applicant profile has changed since this review was opened. Please re-review before applying.'
      )
      return
    }

    const { validation } = applyReviewDecisions(
      targetApplicant,
      reviewResult.reviewItems
    )

    if (!validation.valid) {
      setErrorMessage(`Validation error: ${validation.errors[0]?.message || 'Invalid entries'}`)
      return
    }

    // Build confirmed ExtractedApplicantData payload for parent
    const confirmedPayload: ExtractedApplicantData = { personal: {}, passport: {}, contact: {} }

    reviewResult.reviewItems.forEach((item) => {
      let finalVal: string | undefined

      if (item.decision === 'use-extracted') {
        finalVal = item.extractedValue
      } else if (item.decision === 'edit') {
        finalVal = item.editedValue !== undefined ? item.editedValue : item.extractedValue
      }

      if (finalVal === undefined) return

      const [sec, key] = item.fieldPath.split('.')
      if (sec === 'personalInfo') {
        if (key === 'givenNames') {
          confirmedPayload.personal!.firstName = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'surname') {
          confirmedPayload.personal!.lastName = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'dateOfBirth') {
          confirmedPayload.personal!.dateOfBirth = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'nationality') {
          confirmedPayload.personal!.nationality = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'gender') {
          confirmedPayload.personal!.gender = { value: finalVal as Gender, source: item.source || 'manual-review' }
        } else if (key === 'townCityOfBirth') {
          confirmedPayload.personal!.townCityOfBirth = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'countryOfBirth') {
          confirmedPayload.personal!.countryOfBirth = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'nationalIdNumber') {
          confirmedPayload.personal!.nationalIdNumber = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'religion') {
          confirmedPayload.personal!.religion = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'educationalQualification') {
          confirmedPayload.personal!.educationalQualification = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'previousNationality') {
          confirmedPayload.personal!.previousNationality = { value: finalVal, source: item.source || 'manual-review' }
        }
      } else if (sec === 'passport') {
        if (key === 'passportNumber') {
          confirmedPayload.passport!.passportNumber = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'passportType') {
          confirmedPayload.passport!.passportType = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'issuingCountry') {
          confirmedPayload.passport!.issuingCountry = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'issueDate') {
          confirmedPayload.passport!.issueDate = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'expiryDate') {
          confirmedPayload.passport!.expiryDate = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'placeOfIssue') {
          confirmedPayload.passport!.placeOfIssue = { value: finalVal, source: item.source || 'manual-review' }
        }
      } else if (sec === 'contact') {
        if (key === 'email') {
          confirmedPayload.contact!.email = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'mobile') {
          confirmedPayload.contact!.mobile = { value: finalVal, source: item.source || 'manual-review' }
        } else if (key === 'phone') {
          confirmedPayload.contact!.phone = { value: finalVal, source: item.source || 'manual-review' }
        }
      }
    })

    onConfirm(confirmedPayload)
  }

  const renderSourceBadge = (source?: ExtractionSource, confidence?: number) => {
    if (!source) return null
    const color =
      source === 'mrz'
        ? 'bg-emerald-100 text-emerald-800'
        : source === 'pdf-text'
          ? 'bg-blue-100 text-blue-800'
          : source === 'ocr'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-slate-100 text-slate-700'

    return (
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${color}`}>
        {source} {confidence !== undefined ? `${confidence}%` : ''}
      </span>
    )
  }

  const renderStatusBadge = (item: ExtractedFieldReviewItem) => {
    if (item.status === 'matches') {
      return <span className="text-emerald-600 font-bold text-[10px]">✓ Matches</span>
    }
    if (item.status === 'new') {
      return <span className="text-blue-600 font-bold text-[10px]">✨ New Info</span>
    }
    return <span className="text-amber-600 font-bold text-[10px]">⚠️ Conflict</span>
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3">
      <form
        onSubmit={handleApplyChanges}
        className="bg-white rounded-xl p-4 max-w-sm w-full space-y-3 text-left max-h-[92vh] flex flex-col shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Document Intelligence Review</h3>
            <p className="text-[10px] text-slate-500">
              Target Profile:{' '}
              <strong className="text-slate-800">
                {targetApplicant.applicantId}
              </strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Stale Warning Banner */}
        {isStale && (
          <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs font-semibold">
            ⚠️ Applicant profile has been modified. Please re-review extracted values.
          </div>
        )}

        {/* Error Message Banner */}
        {errorMessage && (
          <div className="p-2 rounded bg-red-100 border border-red-300 text-red-700 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {/* Conflicts Summary */}
        {conflicts.length > 0 && (
          <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1">
              <span>⚠️</span>
              <span>Candidate Extraction Conflicts Detected:</span>
            </div>
            <ul className="list-disc pl-4 text-[10px] space-y-0.5">
              {conflicts.map((c, idx) => (
                <li key={idx}>
                  <strong>{c.label}:</strong>{' '}
                  {c.candidates.map((cand) => `${cand.source.toUpperCase()} (${String(cand.value)})`).join(' vs ')}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Field-by-Field Review Items List */}
        <div className="flex-1 overflow-y-auto max-h-[280px] space-y-3 text-xs pr-1">
          {reviewResult.reviewItems.length === 0 ? (
            <div className="p-4 text-center text-slate-500 italic text-xs">
              No reviewable fields extracted from this document.
            </div>
          ) : (
            reviewResult.reviewItems.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg border text-left space-y-1.5 bg-slate-50"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {/* Item Header */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    {renderSourceBadge(item.source, item.confidence)}
                    {renderStatusBadge(item)}
                  </div>
                </div>

                {/* Values Comparison Row */}
                <div className="grid grid-cols-2 gap-2 text-[11px] p-1.5 rounded bg-white border border-slate-200">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">
                      Existing Value
                    </span>
                    <span className="font-medium text-slate-700">
                      {item.existingValue || '— (Empty)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">
                      Extracted Value
                    </span>
                    <span className="font-bold text-indigo-700">
                      {item.extractedValue}
                    </span>
                  </div>
                </div>

                {/* Inline Field Editor */}
                {editingFieldIndex === idx ? (
                  <div className="space-y-1 pt-1">
                    <input
                      type="text"
                      className="w-full p-1 rounded border text-xs bg-white font-medium"
                      value={customEditValue}
                      onChange={(e) => setCustomEditValue(e.target.value)}
                      placeholder="Enter custom corrected value..."
                    />
                    <div className="flex gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingFieldIndex(null)}
                        className="px-2 py-0.5 text-[10px] text-slate-600 hover:underline"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(idx)}
                        className="px-2 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded hover:bg-indigo-700 cursor-pointer"
                      >
                        Save Custom Value
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Decision Controls Row */
                  <div className="flex items-center gap-1 pt-1 overflow-x-auto text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleDecisionChange(idx, 'keep-existing')}
                      className={`px-2 py-1 rounded font-semibold cursor-pointer transition ${item.decision === 'keep-existing'
                          ? 'bg-slate-700 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                    >
                      Keep Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecisionChange(idx, 'use-extracted')}
                      className={`px-2 py-1 rounded font-semibold cursor-pointer transition ${item.decision === 'use-extracted'
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                        }`}
                    >
                      Use Extracted
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(idx, item.editedValue || item.extractedValue)}
                      className={`px-2 py-1 rounded font-semibold cursor-pointer transition ${item.decision === 'edit'
                          ? 'bg-amber-600 text-white font-bold'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                        }`}
                    >
                      {item.decision === 'edit' ? 'Edited' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecisionChange(idx, 'ignore')}
                      className={`px-2 py-1 rounded font-semibold cursor-pointer transition ${item.decision === 'ignore'
                          ? 'bg-red-700 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                      Ignore
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1 border-t">
          <Button variant="ghost" size="sm" fullWidth type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" fullWidth type="submit" disabled={isStale}>
            Apply Selected Changes
          </Button>
        </div>
      </form>
    </div>
  )
}
