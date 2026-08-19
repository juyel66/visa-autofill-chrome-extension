import React, { useEffect, useState, useCallback } from 'react'
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
  AttachmentsStatusPayload,
} from '../../core/messaging'
import { sendToBackground } from '../../core/messaging'
import type { WorkflowState } from '../../core/workflow'
import { getIndiaDocumentRequirements } from '../../countries/india'
import type { CountryPageDetectionResult } from '../../countries/india/types'
import { DocumentPreviewModal } from '../../components/document'

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
  const [confirmAttachmentReq, setConfirmAttachmentReq] = useState<DocumentRequirement | null>(null)
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null)
  const [attachmentStates, setAttachmentStates] = useState<
    Record<
      string,
      {
        state: 'not-started' | 'awaiting-user' | 'attaching' | 'attached' | 'failed' | 'manual-required' | 'cancelled' | 'manual-verification-required'
        verifiedName?: string
        verifiedSize?: number
        error?: string
        retryCount?: number
      }
    >
  >({})
  const [retryCountMap, setRetryCountMap] = useState<Record<string, number>>({})
  const [failedFieldsMap, setFailedFieldsMap] = useState<Record<string, string[]>>({})

  const [isCheckingPage, setIsCheckingPage] = useState<boolean>(true)
  const [isAutofilling, setIsAutofilling] = useState<boolean>(false)
  const [isUndoing, setIsUndoing] = useState<boolean>(false)
  const [canUndo, setCanUndo] = useState<boolean>(false)

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }, [setToastMessage])

  const getAutofillStatusMessage = (): { text: string; type: 'success' | 'warning' | 'error' | 'info' } => {
    if (!detection || !detection.matched || detection.page === 'unknown' || !detection.page) {
      return { text: 'Unsupported visa page.', type: 'info' }
    }
    
    if (!selectedApplicant) {
      return { text: 'No active profile selected.', type: 'warning' }
    }

    const list = applicantDocs || []
    const hasPassport = list.some(d => d.documentType === 'passport')
    if (!hasPassport) {
      return { text: 'Confirmed document required.', type: 'warning' }
    }

    const hasConfirmedPassport = list.some(d => d.documentType === 'passport' && d.extractedDataConfirmed)
    if (!hasConfirmedPassport) {
      return { text: 'Review extracted document data first.', type: 'warning' }
    }

    return { text: 'Automatic Autofill Ready / Active.', type: 'success' }
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

  const handleStopWorkflow = useCallback(async () => {
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
  }, [setWorkflowState, setCanUndo, showToast, setErrorMessage])

  const verifyCurrentAttachments = async (requirementsList: DocumentRequirement[]) => {
    if (requirementsList.length === 0) return
    try {
      const response = await sendToBackground<AttachmentsStatusPayload>({
        type: 'CHECK_ATTACHMENTS',
        requirements: requirementsList.map((r) => ({ id: r.id, targetSelector: r.targetSelector })),
      })
      if (response.status === 'success' && response.data?.statuses) {
        const statuses = response.data.statuses
        setAttachmentStates((prev) => {
          const next = { ...prev }
          let changed = false
          for (const reqId of Object.keys(statuses)) {
            const s = statuses[reqId]
            if (s.attached) {
              if (prev[reqId]?.state !== 'attached' || prev[reqId]?.verifiedName !== s.fileName) {
                next[reqId] = {
                  ...prev[reqId],
                  state: 'attached',
                  verifiedName: s.fileName,
                  verifiedSize: s.fileSize,
                }
                changed = true
              }
            } else if (prev[reqId]?.state === 'attached') {
              next[reqId] = { ...prev[reqId], state: 'not-started' }
              changed = true
            }
          }
          return changed ? next : prev
        })
      }
    } catch (err) {
      console.error('Failed to verify attachments:', err)
    }
  }

  useEffect(() => {
    if (!detection?.matched || docRequirements.length === 0) return

    const timeout = setTimeout(() => {
      verifyCurrentAttachments(docRequirements)
    }, 0)

    const interval = setInterval(() => {
      verifyCurrentAttachments(docRequirements)
    }, 1500)

    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [detection, docRequirements])

  useEffect(() => {
    if (workflowState && workflowState.status !== 'idle') {
      if (!selectedApplicant) {
        setTimeout(() => {
          handleStopWorkflow()
          setErrorMessage('Selected applicant is unavailable.')
        }, 0)
      } else if (workflowState.applicantId && selectedApplicant.applicantId !== workflowState.applicantId) {
        setTimeout(() => {
          handleStopWorkflow()
          setErrorMessage('Applicant consistency violation. Workflow stopped.')
        }, 0)
      }
    }
  }, [selectedApplicant, workflowState, handleStopWorkflow])

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

  const handleRetryDetection = async () => {
    setIsCheckingPage(true)
    setErrorMessage(null)
    try {
      const response = await sendToBackground<VisaPageResponsePayload>({ type: 'GET_CURRENT_VISA_PAGE' })
      if (response.status === 'success' && response.data?.detection) {
        setDetection(response.data.detection as CountryPageDetectionResult)
        if (!response.data.detection.matched || response.data.detection.page === 'unknown') {
          setErrorMessage('Visa Autofill could not identify this page.')
        }
      }
    } catch {
      setErrorMessage('Unable to query browser tab.')
    } finally {
      setIsCheckingPage(false)
    }
  }



  const handleTriggerAutofill = async () => {
    if (!selectedApplicant) {
      setErrorMessage('Please select an applicant first.')
      return
    }

    if (!detection?.matched || detection.page === 'unknown') {
      setErrorMessage('Visa Autofill could not identify this page.')
      return
    }

    const pageId = detection.page || 'unknown'
    const retryCount = retryCountMap[pageId] || 0
    if (retryCount >= 2) {
      setErrorMessage('Max retries reached. Please complete manually.')
      return
    }

    setIsAutofilling(true)
    setErrorMessage(null)

    const failedIds = failedFieldsMap[pageId] || []

    try {
      const response = await sendToBackground<AutofillResponsePayload>({
        type: 'EXECUTE_AUTOFILL',
        applicant: selectedApplicant,
        failedMappingIds: failedIds,
      })

      if (response.status === 'success' && response.data?.result) {
        const r = response.data.result
        setCanUndo(r.filledFields > 0)

        // Track failed fields
        const newFailedIds = r.results
          .filter((res) => res.status === 'failed' || res.status === 'not-found')
          .map((res) => res.fieldId)

        setFailedFieldsMap((prev) => ({ ...prev, [pageId]: newFailedIds }))

        // Increment retry count if errors exist
        if (newFailedIds.length > 0) {
          setRetryCountMap((prev) => ({ ...prev, [pageId]: (prev[pageId] || 0) + 1 }))
        }

        if (r.failedFields > 0 && r.filledFields > 0) {
          showToast(`⚡ Partially completed. (${r.filledFields} filled, ${r.failedFields} failed)`)
        } else if (r.failedFields > 0 && r.filledFields === 0) {
          setErrorMessage('Autofill execution failed.')
        } else {
          showToast(`⚡ Autofill finished: ${r.filledFields} filled, ${r.skippedFields} skipped.`)
        }
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
        const pageId = detection?.page || 'unknown'
        setFailedFieldsMap((prev) => {
          const next = { ...prev }
          delete next[pageId]
          return next
        })
        setRetryCountMap((prev) => {
          const next = { ...prev }
          delete next[pageId]
          return next
        })
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

  const executeAttach = async (requirement: DocumentRequirement, documentId: string) => {
    setConfirmAttachmentReq(null)
    setAttachmentStates((prev) => ({
      ...prev,
      [requirement.id]: { state: 'attaching', retryCount: prev[requirement.id]?.retryCount || 0 },
    }))

    // 1. Verify current page matching
    const pageRes = await sendToBackground<VisaPageResponsePayload>({ type: 'GET_CURRENT_VISA_PAGE' })
    if (pageRes.status !== 'success' || !pageRes.data?.detection?.matched) {
      setAttachmentStates((prev) => ({
        ...prev,
        [requirement.id]: { state: 'failed', error: 'Page changed. Invalidation occurred.' },
      }))
      return
    }

    try {
      const response = await sendToBackground<DocumentAttachmentPayload>({
        type: 'ATTACH_DOCUMENT',
        requirementId: requirement.id,
        documentId,
      })

      if (response.status === 'success' && response.data?.result) {
        const res = response.data.result
        if (res.success) {
          // Verification check
          await verifyCurrentAttachments(docRequirements)
          setAttachmentStates((prev) => {
            const isVerified = prev[requirement.id]?.state === 'attached'
            return {
              ...prev,
              [requirement.id]: {
                ...prev[requirement.id],
                state: isVerified ? 'attached' : 'manual-verification-required',
              },
            }
          })
          showToast(`✓ Document "${requirement.label}" attachment initiated.`)
        } else {
          if (res.status === 'unsupported') {
            setAttachmentStates((prev) => ({
              ...prev,
              [requirement.id]: {
                ...prev[requirement.id],
                state: 'manual-required',
                error: res.reason,
              },
            }))
          } else {
            setAttachmentStates((prev) => ({
              ...prev,
              [requirement.id]: {
                ...prev[requirement.id],
                state: 'failed',
                error: res.reason,
              },
            }))
          }
        }
      } else if (response.status === 'error') {
        setAttachmentStates((prev) => ({
          ...prev,
          [requirement.id]: {
            ...prev[requirement.id],
            state: 'failed',
            error: response.error || 'Attachment failed.',
          },
        }))
      }
    } catch (err) {
      console.error('Document attachment error:', err)
      setAttachmentStates((prev) => ({
        ...prev,
        [requirement.id]: {
          ...prev[requirement.id],
          state: 'failed',
          error: 'Unable to attach document.',
        },
      }))
    }
  }

  const handleRetryAttachment = async (requirement: DocumentRequirement, documentId: string) => {
    const currentState = attachmentStates[requirement.id]
    const currentRetry = currentState?.retryCount || 0
    if (currentRetry >= 3) {
      setAttachmentStates((prev) => ({
        ...prev,
        [requirement.id]: {
          ...prev[requirement.id],
          state: 'manual-required',
          error: 'Max retries reached. Please select manually.',
        },
      }))
      return
    }

    setAttachmentStates((prev) => ({
      ...prev,
      [requirement.id]: {
        ...prev[requirement.id],
        state: 'attaching',
        retryCount: currentRetry + 1,
      },
    }))

    await new Promise((resolve) => setTimeout(resolve, 500))
    await executeAttach(requirement, documentId)
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
        ) : (
          (() => {
            const status = getAutofillStatusMessage()
            let bgColor = 'bg-slate-50 border-slate-200 text-slate-700'
            let badge = 'text-slate-600 bg-slate-100 border border-slate-300'
            
            if (status.type === 'success') {
              bgColor = 'bg-emerald-50 border-emerald-200 text-emerald-800'
              badge = 'bg-emerald-600 text-white'
            } else if (status.type === 'warning') {
              bgColor = 'bg-amber-50 border-amber-200 text-amber-800'
              badge = 'bg-amber-600 text-white'
            } else if (status.type === 'error') {
              bgColor = 'bg-red-50 border-red-200 text-red-800'
              badge = 'bg-red-600 text-white'
            }

            return (
              <div className={`p-2.5 rounded-lg border text-left space-y-1 ${bgColor}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1">
                    <span>{status.type === 'success' ? '✓' : 'ℹ'}</span>
                    <span>{status.text}</span>
                  </span>
                  {detection?.matched && detection.page !== 'unknown' ? (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${badge}`}>
                      Supported
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-200 text-slate-700 border border-slate-300">
                      Unsupported
                    </span>
                  )}
                </div>
                {detection?.matched && detection.page !== 'unknown' && (
                  <div className="text-[11px] grid grid-cols-2 gap-1 pt-0.5 opacity-90">
                    <div>
                      <span className="text-[9px] block opacity-70">Flow:</span>
                      <span className="font-semibold">{formatFlowName(detection.flow)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] block opacity-70">Current Stage:</span>
                      <span className="font-semibold">{formatPageName(detection.page)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })()
        )}
      </div>

      {/* Document Upload Requirements Card */}
      {detection?.matched && docRequirements.length > 0 && selectedApplicant && (
        <div className="p-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-left space-y-2">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-1.5">
            <span className="font-extrabold text-xs text-indigo-900 uppercase tracking-wider">
              📄 India Visa Documents
            </span>
            <span className="text-[9px] font-bold bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded">
              {docRequirements.length} Required
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {docRequirements.map((req) => {
              const candidates = matchDocumentsForRequirement(req, applicantDocs)
              const selectedDocId = selectedDocMap[req.id] || candidates[0]?.documentId || ''
              const isStale = selectedDocId && !candidates.some((c) => c.documentId === selectedDocId)
              const activeCandidate = candidates.find((c) => c.documentId === selectedDocId)
              const isExpired = activeCandidate?.expiryDate && new Date(activeCandidate.expiryDate) < new Date()
              const stateObj = attachmentStates[req.id] || { state: 'not-started' }

              return (
                <div
                  key={req.id}
                  className="p-2 rounded-lg bg-white border border-indigo-100 space-y-2 shadow-sm"
                >
                  {/* Header & Status Indicator */}
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
                        ? `${req.documentType.charAt(0).toUpperCase() + req.documentType.slice(1)} ✓ Available`
                        : '⚠ Missing'}
                    </span>
                  </div>

                  {candidates.length === 0 ? (
                    /* Missing Document Flow */
                    <div className="space-y-1.5 text-center p-2 rounded bg-slate-50 border border-dashed border-slate-200">
                      <div className="text-[10px] text-slate-600 font-semibold text-center w-full">Document missing</div>
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        onClick={() => onNavigate('documents')}
                      >
                        [ Add Document ]
                      </Button>
                    </div>
                  ) : isStale ? (
                    /* Deleted / Stale Document Reference */
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-red-600 font-semibold bg-red-50 p-1.5 rounded border border-red-200">
                        Selected document is no longer available.
                      </div>
                      {candidates.length > 1 && (
                        <select
                          className="w-full p-1 rounded border text-[10px] bg-slate-50"
                          value={selectedDocId}
                          onChange={(e) => {
                            setSelectedDocMap((prev) => ({ ...prev, [req.id]: e.target.value }))
                            setAttachmentStates((prev) => ({ ...prev, [req.id]: { state: 'not-started' } }))
                          }}
                        >
                          <option value="">Choose another document...</option>
                          {candidates.map((c) => (
                            <option key={c.documentId} value={c.documentId}>
                              {c.fileName} ({(c.fileSize / 1024 / 1024).toFixed(2)} MB)
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : (
                    /* Matched Candidates Available */
                    <div className="space-y-2">
                      {/* Candidate selector if multiple matches exist */}
                      {candidates.length > 1 && (
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-slate-400 font-bold uppercase block">
                            [ Choose Document ]
                          </label>
                          <select
                            className="w-full p-1 rounded border text-[10px] bg-slate-50"
                            value={selectedDocId}
                            onChange={(e) => {
                              setSelectedDocMap((prev) => ({ ...prev, [req.id]: e.target.value }))
                              setAttachmentStates((prev) => ({ ...prev, [req.id]: { state: 'not-started' } }))
                            }}
                          >
                            {candidates.map((c) => (
                              <option key={c.documentId} value={c.documentId}>
                                {c.fileName} ({(c.fileSize / 1024 / 1024).toFixed(2)} MB)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Selected Candidate Metadata Display */}
                      {activeCandidate && (
                        <div className="p-1.5 rounded bg-slate-50 border border-slate-100 flex items-center justify-between text-[10px]">
                          <div className="space-y-0.5 truncate max-w-[160px]">
                            <div className="font-bold text-slate-700 truncate">
                              {activeCandidate.fileName}
                            </div>
                            <div className="text-[9px] text-slate-400">
                              {activeCandidate.mimeType.split('/')[1].toUpperCase()} ·{' '}
                              {(activeCandidate.fileSize / 1024 / 1024).toFixed(2)} MB
                            </div>
                          </div>
                          <div className="text-right">
                            {activeCandidate.expiryDate ? (
                              isExpired ? (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-800 uppercase animate-pulse">
                                  Expired
                                </span>
                              ) : (
                                <span className="text-[8px] text-slate-400 block font-semibold text-right">
                                  Exp: {activeCandidate.expiryDate}
                                </span>
                              )
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* Expiry warnings */}
                      {isExpired && (
                        <div className="text-[9px] font-medium text-red-600 bg-red-50 p-1.5 rounded border border-red-100">
                          ⚠️ This document has expired. Do NOT automatically attach expired documents unless confirmed.
                        </div>
                      )}

                      {/* Attachment Workflow Control Buttons */}
                      {stateObj.state === 'attached' ? (
                        /* Case 1: Successfully Attached */
                        <div className="space-y-1">
                          <div className="p-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold text-center">
                            ✓ Attached ({stateObj.verifiedName || 'Verified'})
                          </div>
                          <div className="text-[10px] text-slate-500 italic text-center">
                            Document requirement completed.
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            fullWidth
                            onClick={() =>
                              setAttachmentStates((prev) => ({
                                ...prev,
                                [req.id]: { state: 'not-started' },
                              }))
                            }
                          >
                            Re-attach
                          </Button>
                        </div>
                      ) : stateObj.state === 'manual-verification-required' ? (
                        /* Case 2: Verification Awaiting */
                        <div className="space-y-1">
                          <div className="p-1 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold text-center">
                            ⚠ Manual verification required
                          </div>
                          <Button
                            variant="primary"
                            size="sm"
                            fullWidth
                            onClick={() => verifyCurrentAttachments(docRequirements)}
                          >
                            Verify Status
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            fullWidth
                            onClick={() =>
                              setAttachmentStates((prev) => ({
                                ...prev,
                                [req.id]: { state: 'not-started' },
                              }))
                            }
                          >
                            Re-attach
                          </Button>
                        </div>
                      ) : stateObj.state === 'manual-required' ? (
                        /* Case 3: Programmatic Selection Blocked */
                        <div className="space-y-1.5">
                          <div className="p-1 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold text-center">
                            ⚠ Manual Action Required
                          </div>
                          <p className="text-[10px] text-slate-600 leading-normal">
                            Please select the matching document in the website's file picker.
                          </p>
                          <div className="bg-slate-50 p-1.5 rounded border text-[9px] text-slate-500 font-medium">
                            <strong>Instructions:</strong> Click the upload button on the form page, and pick: <strong>{activeCandidate?.fileName}</strong>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            fullWidth
                            onClick={() => verifyCurrentAttachments(docRequirements)}
                          >
                            Verify Selected File
                          </Button>
                        </div>
                      ) : stateObj.state === 'failed' ? (
                        /* Case 4: Process Failure */
                        <div className="space-y-1.5">
                          <div className="p-1 rounded bg-red-100 border border-red-300 text-red-900 text-[10px] font-bold text-center">
                            Document could not be attached.
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Button
                              variant="primary"
                              size="sm"
                              fullWidth
                              onClick={() => handleRetryAttachment(req, selectedDocId)}
                            >
                              Retry
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              fullWidth
                              onClick={() =>
                                setAttachmentStates((prev) => ({
                                  ...prev,
                                  [req.id]: { ...prev[req.id], state: 'manual-required' },
                                }))
                              }
                            >
                              Manual Upload
                            </Button>
                          </div>
                        </div>
                      ) : stateObj.state === 'attaching' ? (
                        /* Case 5: Loading State */
                        <div className="text-center text-[10px] text-indigo-700 font-bold py-1.5">
                          ⏳ Attaching document...
                        </div>
                      ) : confirmAttachmentReq === req ? (
                        /* Case 6: User Confirmation Overlay */
                        <div className="space-y-1.5 p-2 rounded bg-indigo-50 border border-indigo-100">
                          <div className="text-[10px] text-indigo-900 font-bold text-center">
                            Use {activeCandidate?.fileName} for this requirement?
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Button
                              variant="primary"
                              size="sm"
                              fullWidth
                              onClick={() => executeAttach(req, selectedDocId)}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              fullWidth
                              onClick={() => setConfirmAttachmentReq(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* Default: Selection and Confirm Triggers */
                        <div className="grid grid-cols-2 gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            fullWidth
                            onClick={() => setPreviewDoc(activeCandidate || null)}
                          >
                            Preview
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            fullWidth
                            onClick={() => {
                              if (activeCandidate && activeCandidate.documentType !== req.documentType) {
                                setErrorMessage('Document type does not match this requirement.')
                              } else {
                                setConfirmAttachmentReq(req)
                              }
                            }}
                          >
                            Use Document
                          </Button>
                        </div>
                      )}
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
            PROFILE {selectedApplicant.applicantId}
          </div>
          <div className="text-[11px] space-y-1 mt-1.5" style={{ color: 'var(--color-muted)' }}>
            <div>Documents: {applicantDocs.length}</div>
            <div>
              Passport:{' '}
              {applicantDocs.some(
                (d) => d.documentType === 'passport' && d.extractedDataConfirmed
              ) ? (
                <span className="text-emerald-600 font-bold">Available</span>
              ) : (
                <span className="text-amber-600 font-bold">Not Available</span>
              )}
            </div>
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
                {(!detection?.matched || detection.page === 'unknown') ? (
                  <div className="p-2 rounded bg-amber-50 border border-amber-200 text-xs space-y-1.5 text-left">
                    <p className="text-amber-800 font-semibold">Visa Autofill could not identify this page.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="primary" size="sm" fullWidth onClick={handleRetryDetection}>
                        Retry Detection
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        onClick={() => {
                          setErrorMessage('Manual action is required.')
                        }}
                      >
                        Continue Manually
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Retry controls if there are failed fields */}
                    {(() => {
                      const pageId = detection.page || 'unknown'
                      const failedIds = failedFieldsMap[pageId] || []
                      const retryCount = retryCountMap[pageId] || 0
                      if (failedIds.length > 0) {
                        return (
                          <div className="p-2 rounded bg-red-50 border border-red-200 text-xs text-left space-y-1.5">
                            <p className="text-red-800 font-semibold">
                              Failed to fill {failedIds.length} field(s) (Attempt {retryCount}/2)
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {retryCount < 2 ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  fullWidth
                                  onClick={handleTriggerAutofill}
                                  disabled={isAutofilling}
                                >
                                  {isAutofilling ? '⚡ Retrying...' : 'Retry Failed Fields'}
                                </Button>
                              ) : (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  fullWidth
                                  onClick={() => {
                                    setErrorMessage('Manual action is required.')
                                  }}
                                >
                                  Continue Manually
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                fullWidth
                                onClick={() => {
                                  setFailedFieldsMap((prev) => ({ ...prev, [pageId]: [] }))
                                }}
                              >
                                Skip Failures
                              </Button>
                            </div>
                          </div>
                        )
                      }
                      return null
                    })()}

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
                  </div>
                )}

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
      {previewDoc && (
        <DocumentPreviewModal
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  )
}
