import React, { useEffect, useState } from 'react'
import { Button } from '../../components/ui'
import type { ApplicantProfile } from '../../core/applicant'
import {
  getDocumentsByApplicantId,
  matchDocumentsForRequirement,
} from '../../core/document'
import type { DocumentRecord, DocumentRequirement } from '../../core/document'
import type {
  AutofillResponsePayload,
  DocumentAttachmentPayload,
  UndoResponsePayload,
  VisaPageResponsePayload,
  WorkflowStatePayload,
} from '../../core/messaging'
import { sendToBackground } from '../../core/messaging'
import type { WorkflowState } from '../../core/workflow'
import { getIndiaDocumentRequirements } from '../../countries/india'
import type { CountryPageDetectionResult } from '../../countries/india/types'

export interface DashboardProps {
  selectedApplicant: ApplicantProfile | null
  applicantCount: number
  onNavigate: (page: 'dashboard' | 'applicants' | 'applicant-form' | 'documents' | 'settings') => void
  onAddApplicant: () => void
}

export const Dashboard: React.FC<DashboardProps> = ({
  selectedApplicant,
  applicantCount,
  onNavigate,
  onAddApplicant,
}) => {
  const [detection, setDetection] = useState<CountryPageDetectionResult | null>(null)
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null)
  const [docRequirements, setDocRequirements] = useState<DocumentRequirement[]>([])
  const [applicantDocs, setApplicantDocs] = useState<DocumentRecord[]>([])
  const [selectedDocMap, setSelectedDocMap] = useState<Record<string, string>>({})

  const [isCheckingPage, setIsCheckingPage] = useState<boolean>(true)
  const [isAutofilling, setIsAutofilling] = useState<boolean>(false)
  const [isUndoing, setIsUndoing] = useState<boolean>(false)
  const [canUndo, setCanUndo] = useState<boolean>(false)
  const [isAttaching, setIsAttaching] = useState<string | null>(null)

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  useEffect(() => {
    let isMounted = true

    async function checkCurrentTab() {
      try {
        const [pageRes, wfRes] = await Promise.all([
          sendToBackground<VisaPageResponsePayload>({ type: 'GET_CURRENT_VISA_PAGE' }),
          sendToBackground<WorkflowStatePayload>({ type: 'GET_WORKFLOW_STATE' }),
        ])

        if (isMounted && pageRes.status === 'success' && pageRes.data?.detection) {
          const det = pageRes.data.detection as CountryPageDetectionResult
          setDetection(det)
          if (det.matched) {
            const reqs = getIndiaDocumentRequirements(det.flow, det.page)
            setDocRequirements(reqs)
          }
        }

        if (isMounted && wfRes.status === 'success' && wfRes.data?.state) {
          setWorkflowState(wfRes.data.state)
        }
      } catch {
        if (isMounted) {
          setDetection(null)
          setWorkflowState(null)
        }
      } finally {
        if (isMounted) {
          setIsCheckingPage(false)
        }
      }
    }

    checkCurrentTab()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    if (selectedApplicant) {
      getDocumentsByApplicantId(selectedApplicant.applicantId)
        .then((docs) => {
          if (isMounted) {
            setApplicantDocs(docs)
          }
        })
        .catch((err) => {
          console.error('Failed to load applicant documents for requirements:', err)
        })
    }
    return () => {
      isMounted = false
    }
  }, [selectedApplicant])

  const handleStartWorkflow = async () => {
    if (!selectedApplicant) {
      setErrorMessage('Please select an active applicant before starting workflow.')
      return
    }

    setErrorMessage(null)
    try {
      const response = await sendToBackground<WorkflowStatePayload>({
        type: 'START_WORKFLOW',
        applicantId: selectedApplicant.applicantId,
      })

      if (response.status === 'success' && response.data?.state) {
        setWorkflowState(response.data.state)
        showToast('Workflow session started. Select Autofill This Page to begin.')
      } else if (response.status === 'error') {
        setErrorMessage(response.error || 'Failed to start workflow.')
      }
    } catch {
      setErrorMessage('Unable to start workflow.')
    }
  }

  const handleStopWorkflow = async () => {
    setErrorMessage(null)
    try {
      const response = await sendToBackground<WorkflowStatePayload>({
        type: 'STOP_WORKFLOW',
      })

      if (response.status === 'success' && response.data?.state) {
        setWorkflowState(response.data.state)
        setCanUndo(false)
        showToast('Workflow session stopped.')
      }
    } catch {
      setErrorMessage('Unable to stop workflow.')
    }
  }

  const handleTriggerAutofill = async () => {
    if (!selectedApplicant) {
      setErrorMessage('Please select an active applicant before running autofill.')
      return
    }

    if (!detection?.matched) {
      setErrorMessage('Current page is not a supported visa application page.')
      return
    }

    setIsAutofilling(true)
    setErrorMessage(null)

    try {
      const response = await sendToBackground<AutofillResponsePayload>({
        type: 'EXECUTE_AUTOFILL',
        applicant: selectedApplicant,
      })

      if (response.status === 'success' && response.data?.result) {
        const r = response.data.result
        setCanUndo(r.filledFields > 0)
        showToast(`⚡ Autofill finished: ${r.filledFields} filled, ${r.skippedFields} skipped, ${r.failedFields} not found.`)
      } else if (response.status === 'error') {
        setErrorMessage(response.error || 'Autofill execution failed.')
      } else {
        setErrorMessage('Autofill execution failed.')
      }
    } catch (err) {
      console.error('Autofill request error:', err)
      setErrorMessage('Unable to execute autofill on active page.')
    } finally {
      setIsAutofilling(false)
    }
  }

  const handleTriggerUndo = async () => {
    setIsUndoing(true)
    setErrorMessage(null)

    try {
      const response = await sendToBackground<UndoResponsePayload>({
        type: 'EXECUTE_UNDO',
      })

      if (response.status === 'success' && response.data?.result) {
        const r = response.data.result
        setCanUndo(false)
        showToast(`↩ Undo finished: ${r.restored} restored, ${r.skipped} user-modified skipped, ${r.notFound} not found.`)
      } else if (response.status === 'error') {
        setErrorMessage(response.error || 'Undo operation failed.')
      } else {
        setErrorMessage('Undo operation failed.')
      }
    } catch (err) {
      console.error('Undo request error:', err)
      setErrorMessage('Unable to execute undo on active page.')
    } finally {
      setIsUndoing(false)
    }
  }

  const handleAttachDocument = async (requirement: DocumentRequirement, documentId: string) => {
    setIsAttaching(requirement.id)
    setErrorMessage(null)

    try {
      const response = await sendToBackground<DocumentAttachmentPayload>({
        type: 'ATTACH_DOCUMENT',
        requirementId: requirement.id,
        documentId,
      })

      if (response.status === 'success' && response.data?.result) {
        const res = response.data.result
        if (res.success) {
          showToast(`✓ Document "${requirement.label}" attached successfully.`)
        } else {
          setErrorMessage(res.reason || 'Document attachment failed.')
        }
      } else if (response.status === 'error') {
        setErrorMessage(response.error || 'Document attachment failed.')
      }
    } catch (err) {
      console.error('Document attachment error:', err)
      setErrorMessage('Unable to attach document to form field.')
    } finally {
      setIsAttaching(null)
    }
  }

  const formatFlowName = (flow?: string | null): string => {
    if (flow === 'regular') return 'Regular / Paper Visa'
    if (flow === 'evisa') return 'e-Visa Application'
    return 'Unknown Flow'
  }

  const formatPageName = (page?: string | null): string => {
    if (page === 'landing') return 'Portal Homepage'
    if (page === 'application-start') return 'Application Registration'
    if (page === 'application-form') return 'Application Form'
    if (page === 'partial-application') return 'Partially Saved Form'
    if (page === 'print-application') return 'Print Application'
    if (page === 'status') return 'Status Inquiry'
    if (page === 'document-reupload') return 'Document Re-upload'
    return 'Visa Page'
  }

  const isWorkflowActive = workflowState && workflowState.status !== 'idle'

  return (
    <div
      className="rounded-xl p-5 shadow-lg space-y-4 transition-colors duration-300 relative"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {/* Toast Banner */}
      {toastMessage && (
        <div className="absolute top-2 left-4 right-4 z-50 p-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold text-center shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Extension Title Header */}
      <div className="flex items-center gap-3">
        <div
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl font-bold text-xl text-white shadow-sm"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          V
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--color-text)' }}>
            Visa Autofill
          </h1>
          <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            Assisted Visa Application Entry
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-2 rounded bg-red-100 border border-red-300 text-red-700 text-xs font-semibold text-left">
          {errorMessage}
        </div>
      )}

      {/* Website Detection & Workflow Status Banner */}
      <div
        className="pt-3 text-left space-y-1.5"
        style={{
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderTopColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>Target Visa Portal Status</span>
          {isWorkflowActive && (
            <span className="text-indigo-600">
              Completed: {workflowState.completedPages.length} pages
            </span>
          )}
        </div>

        {isCheckingPage ? (
          <div className="text-xs text-slate-500 flex items-center gap-1.5 py-1">
            <span className="animate-spin text-xs">⏳</span>
            <span>Checking browser tab...</span>
          </div>
        ) : detection?.matched ? (
          <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-left space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-emerald-800 flex items-center gap-1">
                <span>✓</span>
                <span>Indian Visa Application Detected</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600 text-white uppercase">
                Supported
              </span>
            </div>
            <div className="text-[11px] text-emerald-900 grid grid-cols-2 gap-1 pt-0.5">
              <div>
                <span className="text-[9px] text-emerald-600 block">Flow:</span>
                <span className="font-semibold">{formatFlowName(detection.flow)}</span>
              </div>
              <div>
                <span className="text-[9px] text-emerald-600 block">Current Stage:</span>
                <span className="font-semibold">{formatPageName(detection.page)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-left space-y-1">
            <div className="font-bold text-xs text-slate-700">
              No supported visa application detected.
            </div>
            <div className="text-[11px] text-slate-500">
              Open <strong className="text-slate-700">indianvisaonline.gov.in</strong> to apply.
            </div>
          </div>
        )}
      </div>

      {/* Document Upload Requirements Card */}
      {detection?.matched && docRequirements.length > 0 && selectedApplicant && (
        <div className="p-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-left space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-indigo-900">
              📄 Document Upload Requirements
            </span>
            <span className="text-[9px] font-bold bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded">
              {docRequirements.length} required
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {docRequirements.map((req) => {
              const candidates = matchDocumentsForRequirement(req, applicantDocs)
              const selectedDocId =
                selectedDocMap[req.id] || candidates[0]?.documentId || ''

              return (
                <div
                  key={req.id}
                  className="p-2 rounded bg-white border border-indigo-100 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px]">{req.label}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        candidates.length > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {candidates.length > 0
                        ? `${candidates.length} Available`
                        : 'Missing'}
                    </span>
                  </div>

                  {candidates.length > 0 ? (
                    <div className="space-y-1">
                      <select
                        className="w-full p-1 rounded border text-[10px] bg-slate-50"
                        value={selectedDocId}
                        onChange={(e) =>
                          setSelectedDocMap((prev) => ({
                            ...prev,
                            [req.id]: e.target.value,
                          }))
                        }
                      >
                        {candidates.map((c) => (
                          <option key={c.documentId} value={c.documentId}>
                            {c.fileName} ({(c.fileSize / 1024).toFixed(1)} KB)
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        disabled={isAttaching === req.id || !selectedDocId}
                        onClick={() => handleAttachDocument(req, selectedDocId)}
                      >
                        {isAttaching === req.id ? 'Attaching File...' : 'Attach Document'}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-[10px] text-amber-700 italic">
                      Upload a {req.documentType} document in the Repository first.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Manual Action Safety Notice */}
      {detection?.matched &&
        (detection.page === 'status' ||
          detection.page === 'print-application' ||
          detection.page === 'document-reupload') && (
          <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] text-left font-medium">
            ⚠️ <strong>Manual Action Required:</strong> Document uploads, CAPTCHAs, and final submission must be completed manually.
          </div>
        )}

      {/* Selected Applicant Summary Banner */}
      {selectedApplicant ? (
        <div
          className="p-3 rounded-lg text-left text-xs space-y-1"
          style={{
            backgroundColor: 'var(--color-bg-middle)',
            borderColor: 'var(--color-accent)',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Active Selected Profile
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Selected
            </span>
          </div>
          <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
            {selectedApplicant.personalInfo.givenNames} {selectedApplicant.personalInfo.surname}
          </div>
          <div className="text-[11px] flex gap-3" style={{ color: 'var(--color-muted)' }}>
            {selectedApplicant.personalInfo.nationality && (
              <span>Nationality: {selectedApplicant.personalInfo.nationality}</span>
            )}
            {selectedApplicant.passport?.passportNumber && (
              <span>PPT: {selectedApplicant.passport.passportNumber}</span>
            )}
          </div>
        </div>
      ) : (
        <div
          className="p-2.5 rounded-lg text-left text-xs italic"
          style={{
            backgroundColor: 'var(--color-bg-middle)',
            color: 'var(--color-muted)',
            borderColor: 'var(--color-border)',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
        >
          No active applicant selected. Go to Applicants list to select one.
        </div>
      )}

      {/* Primary Dashboard Actions */}
      <div className="space-y-2 pt-1">
        {detection?.matched && selectedApplicant && (
          <div className="space-y-1.5">
            {isWorkflowActive ? (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    onClick={handleTriggerAutofill}
                    disabled={isAutofilling}
                  >
                    {isAutofilling ? '⚡ Filling...' : '⚡ Autofill Page'}
                  </Button>
                  <Button variant="ghost" size="sm" fullWidth onClick={handleStopWorkflow}>
                    ⏹ Stop Workflow
                  </Button>
                </div>
                {canUndo && (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={handleTriggerUndo}
                    disabled={isUndoing}
                  >
                    {isUndoing ? '↩ Undoing...' : '↩ Undo Autofill'}
                  </Button>
                )}
              </div>
            ) : (
              <Button variant="primary" fullWidth size="md" onClick={handleStartWorkflow}>
                ▶ Start Autofill Workflow
              </Button>
            )}
          </div>
        )}

        <Button variant="secondary" fullWidth size="md" onClick={onAddApplicant}>
          + Add Applicant
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" fullWidth onClick={() => onNavigate('applicants')}>
            Applicants ({applicantCount})
          </Button>

          <Button variant="secondary" size="sm" fullWidth onClick={() => onNavigate('documents')}>
            Documents
          </Button>
        </div>

        <Button variant="ghost" size="sm" fullWidth onClick={() => onNavigate('settings')}>
          Settings
        </Button>
      </div>
    </div>
  )
}
