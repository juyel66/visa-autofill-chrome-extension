import { executeAutofill, resolveCandidateData, resolveElement } from '../core/autofill'
import { attachDocumentToField, getDocumentsByApplicantId } from '../core/document'
import type { DocumentRecord } from '../core/document/types'
import type { ApplicantProfile } from '../core/applicant/types'
import type { SavedApplication } from '../core/application/types'
import { getSettings } from '../core/settings'
import type {
  AutofillResponsePayload,
  ContentPongPayload,
  DocumentAttachmentPayload,
  ExtensionMessage,
  ExtensionResponse,
  UndoResponsePayload,
  VisaPageResponsePayload,
  WorkflowStatePayload,
  AttachmentsStatusPayload,
} from '../core/messaging'
import type { AutofillOperation } from '../core/safety'
import { executeUndo } from '../core/safety'
import { validateApplicant } from '../core/validation'
import {
  createInitialWorkflowState,
  isFormReady,
  startPageChangeObserver,
  updateWorkflowState,
} from '../core/workflow'
import type { WorkflowState } from '../core/workflow'
import {
  detectIndiaVisaPage,
  getIndiaDocumentRequirements,
  getIndiaVisaMappings,
} from '../countries/india'

const initDet = detectIndiaVisaPage()
const initPageDisplayName = initDet.page
  ? initDet.page === 'REGISTRATION'
    ? 'Registration'
    : initDet.page
  : 'Unknown'

console.log(
  `[Visa Autofill]\nContent script initialized\nURL: ${
    typeof window !== 'undefined' ? window.location.pathname : ''
  }\nPage: ${initPageDisplayName}\nAdapter: ${initDet.matched ? 'ready' : 'idle'}`
)

let activeState: WorkflowState = createInitialWorkflowState()
let observerCleanup: (() => void) | null = null
let latestOperation: AutofillOperation | null = null

/**
 * Production-safe storage reader for content script with error logging.
 */
async function readExtensionStorage<T extends Record<string, unknown>>(keys: string[]): Promise<T> {
  return new Promise<T>((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(keys, (data) => {
        if (chrome.runtime?.lastError) {
          console.error('[VISA AUTOFILL Content] Error reading storage keys:', keys, chrome.runtime.lastError)
          resolve({} as T)
        } else {
          resolve((data || {}) as T)
        }
      })
    } else {
      console.warn('[VISA AUTOFILL Content] chrome.storage.local is not available.')
      resolve({} as T)
    }
  })
}

function syncCurrentPageState(): WorkflowState {
  const detection = detectIndiaVisaPage()

  if (!detection.matched) {
    activeState = updateWorkflowState(activeState, {
      countryCode: null,
      flow: null,
      currentPage: null,
      formReady: false,
    })
    latestOperation = null
    return activeState
  }

  const mappings = getIndiaVisaMappings(detection.flow, detection.page)
  const ready = isFormReady(mappings)

  if (activeState.currentPage !== detection.page) {
    // Invalidate undo operation on page change
    latestOperation = null
  }

  activeState = updateWorkflowState(activeState, {
    countryCode: detection.countryCode,
    flow: detection.flow,
    previousPage: activeState.currentPage !== detection.page ? activeState.currentPage : activeState.previousPage,
    currentPage: detection.page,
    formReady: ready,
    status: activeState.status === 'idle' ? 'ready' : activeState.status,
  })

  return activeState
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (
      response: ExtensionResponse<
        | ContentPongPayload
        | VisaPageResponsePayload
        | AutofillResponsePayload
        | WorkflowStatePayload
        | DocumentAttachmentPayload
        | UndoResponsePayload
        | AttachmentsStatusPayload
      >
    ) => void
  ) => {
    if (message.type === 'PING_CONTENT') {
      sendResponse({
        status: 'success',
        data: {
          type: 'CONTENT_PONG',
          message: 'Content script is working',
        },
      })
      return true
    }

    if (message.type === 'GET_CURRENT_VISA_PAGE') {
      const detection = detectIndiaVisaPage()
      sendResponse({
        status: 'success',
        data: {
          type: 'VISA_PAGE_DETECTION',
          detection,
        },
      })
      return true
    }

    if (message.type === 'START_WORKFLOW') {
      console.log('[VISA AUTOFILL Content] START_WORKFLOW message received for applicant:', message.applicantId)
      if (observerCleanup) observerCleanup()

      const state = syncCurrentPageState()
      activeState = updateWorkflowState(state, {
        status: 'ready',
        applicantId: message.applicantId,
      })

      // Start watching URL/DOM page changes
      observerCleanup = startPageChangeObserver(() => {
        syncCurrentPageState()
      })

      sendResponse({
        status: 'success',
        data: {
          type: 'WORKFLOW_STATE_RESPONSE',
          state: activeState,
        },
      })
      return true
    }

    if (message.type === 'STOP_WORKFLOW') {
      console.log('[VISA AUTOFILL Content] STOP_WORKFLOW message received.')
      if (observerCleanup) {
        observerCleanup()
        observerCleanup = null
      }
      activeState = createInitialWorkflowState()
      latestOperation = null
      sendResponse({
        status: 'success',
        data: {
          type: 'WORKFLOW_STATE_RESPONSE',
          state: activeState,
        },
      })
      return true
    }

    if (message.type === 'EXECUTE_AUTOFILL') {
      const detection = detectIndiaVisaPage()
      const currentPageName =
        detection.page === 'REGISTRATION' ? 'Registration' : detection.page || 'Unknown'

      console.log(`[Visa Autofill]\nEXECUTE_AUTOFILL received\nPage: ${currentPageName}`)

      if (!detection.matched || detection.page === 'unknown' || !detection.page) {
        activeState = updateWorkflowState(activeState, {
          status: 'manual-required',
          currentPage: 'unknown',
        })
        sendResponse({
          status: 'error',
          error: 'Visa Autofill could not identify this page.',
        })
        return true
      }

      // Check manual boundaries
      if (
        detection.page === 'login' ||
        detection.page === 'otp' ||
        detection.page === 'captcha' ||
        detection.page === 'payment'
      ) {
        activeState = updateWorkflowState(activeState, {
          status: 'manual-required',
          currentPage: detection.page,
        })
        sendResponse({
          status: 'error',
          error: `${detection.page.toUpperCase()} verification is required. Please solve manually.`,
        })
        return true
      }

      if (detection.page === 'review') {
        activeState = updateWorkflowState(activeState, {
          status: 'waiting-for-user',
          currentPage: 'review',
        })
        sendResponse({
          status: 'error',
          error: 'Review the application before submitting.',
        })
        return true
      }

      // Applicant Consistency Check
      if (activeState.status !== 'idle' && activeState.applicantId && message.applicant.applicantId !== activeState.applicantId) {
        console.warn(`[VISA AUTOFILL Content] Applicant consistency violation: message=${message.applicant.applicantId} vs state=${activeState.applicantId}`)
        sendResponse({
          status: 'error',
          error: 'Applicant consistency violation. Workflow stopped.',
        })
        return true
      }

      const applicantId = message.applicant.applicantId

      readExtensionStorage<{
        visa_autofill_documents?: DocumentRecord[]
        visa_autofill_saved_applications?: SavedApplication[]
      }>(['visa_autofill_documents', 'visa_autofill_saved_applications'])
        .then((res) => {
          const documents = (res.visa_autofill_documents || []) as DocumentRecord[]
          const savedApplications = (res.visa_autofill_saved_applications || []) as SavedApplication[]
          const savedApp = savedApplications.find((a) => a.applicantId === applicantId)

          const candRes = resolveCandidateData({
            profileId: applicantId,
            documents,
            savedApplication: savedApp,
            notes: message.applicant.notes,
          })

          console.log(`[VISA AUTOFILL Content] Candidate resolution status: ${candRes.status}, reason: ${candRes.reason || 'None'}`)

          if (candRes.status !== 'READY' || !candRes.applicant) {
            sendResponse({
              status: 'error',
              error: candRes.reason || 'Review extracted document data or save application first.',
            })
            return
          }

          const tempProfile = candRes.applicant

          const validation = validateApplicant(tempProfile)
          if (!validation.valid) {
            const firstErr = validation.errors[0]?.message || 'Validation failed'
            console.warn(`[VISA AUTOFILL Content] Applicant validation failed: ${firstErr}`)
            sendResponse({
              status: 'error',
              error: `Applicant profile validation error: ${firstErr}`,
            })
            return
          }

          let mappings = getIndiaVisaMappings(detection.flow, detection.page)
          if (message.failedMappingIds && message.failedMappingIds.length > 0) {
            mappings = mappings.filter((m) => message.failedMappingIds!.includes(m.id))
          }

          console.log(`[VISA AUTOFILL Content] Executing autofill with ${mappings.length} mappings on page "${detection.page}"`)

          executeAutofill({
            mappings,
            applicant: tempProfile,
            options: {
              policy: 'overwrite',
              validatePageConsistency: () => {
                const currentDet = detectIndiaVisaPage()
                return currentDet.matched && currentDet.page === detection.page
              },
            },
          })
            .then((result) => {
              const manualCount = result.results.filter(
                (r) => r.failureType === 'manual-required' || r.fieldId.includes('captcha')
              ).length
              console.log(
                `[Visa Autofill]\nAutofill completed\nPage: ${currentPageName}\nFields processed: ${result.totalFields}\nFields filled: ${result.filledFields}\nFields skipped: ${result.skippedFields}\nManual: ${manualCount > 0 ? 'CAPTCHA' : 'None'}`
              )

              if (detection.page && !activeState.completedPages.includes(detection.page)) {
                activeState = updateWorkflowState(activeState, {
                  completedPages: [...activeState.completedPages, detection.page],
                })
              }

              if (result.operation) {
                latestOperation = result.operation
              }

              sendResponse({
                status: 'success',
                data: {
                  type: 'AUTOFILL_COMPLETED',
                  result,
                },
              })
            })
            .catch((err) => {
              console.error('[VISA AUTOFILL Content] Autofill execution error:', err)
              sendResponse({
                status: 'error',
                error: err instanceof Error ? err.message : 'Autofill execution failed.',
              })
            })
        })
        .catch((err) => {
          console.error('[VISA AUTOFILL Content] Storage read error during EXECUTE_AUTOFILL:', err)
          sendResponse({
            status: 'error',
            error: 'Storage read failed in content script.',
          })
        })

      return true
    }

    if (message.type === 'ATTACH_DOCUMENT') {
      const detection = detectIndiaVisaPage()
      const reqs = getIndiaDocumentRequirements(detection.flow, detection.page)
      const req = reqs.find((r) => r.id === message.requirementId)

      if (!req || !req.targetSelector) {
        sendResponse({
          status: 'error',
          error: 'Document requirement target selector was not found.',
        })
        return true
      }

      const element = resolveElement(req.targetSelector)
      if (!element) {
        sendResponse({
          status: 'error',
          error: `Target file input for "${req.label}" was not found on active page.`,
        })
        return true
      }

      getDocumentsByApplicantId(activeState.applicantId || '')
        .then((docs) => {
          const doc = docs.find((d) => d.documentId === message.documentId)
          if (!doc) {
            sendResponse({
              status: 'error',
              error: 'Selected document payload was not found in storage.',
            })
            return
          }

          attachDocumentToField(element, doc, req.id)
            .then((attachRes) => {
              sendResponse({
                status: 'success',
                data: {
                  type: 'DOCUMENT_ATTACHED',
                  result: attachRes,
                },
              })
            })
            .catch((err) => {
              sendResponse({
                status: 'error',
                error: err instanceof Error ? err.message : 'Document attachment failed.',
              })
            })
        })
        .catch((err) => {
          sendResponse({
            status: 'error',
            error: err instanceof Error ? err.message : 'Storage read failed.',
          })
        })

      return true
    }

    if (message.type === 'EXECUTE_UNDO') {
      const opToUndo = message.operation || latestOperation
      if (!opToUndo || opToUndo.changes.length === 0) {
        sendResponse({
          status: 'error',
          error: 'No recent autofill operation available to undo on this page.',
        })
        return true
      }

      



      executeUndo(opToUndo)
        .then((undoRes) => {
          if (opToUndo === latestOperation) {
            latestOperation = null
          }
          sendResponse({
            status: 'success',
            data: {
              type: 'UNDO_COMPLETED',
              result: undoRes,
            },
          })
        })
        .catch((err) => {
          sendResponse({
            status: 'error',
            error: err instanceof Error ? err.message : 'Undo execution failed.',
          })
        })

      return true
    }

    if (message.type === 'CHECK_ATTACHMENTS') {
      const statuses: Record<string, { attached: boolean; fileName?: string; fileSize?: number }> = {}

      for (const req of message.requirements) {
        if (!req.targetSelector) {
          statuses[req.id] = { attached: false }
          continue
        }

        const element = resolveElement(req.targetSelector)
        if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'file') {
          if (element.files && element.files.length > 0) {
            statuses[req.id] = {
              attached: true,
              fileName: element.files[0].name,
              fileSize: element.files[0].size,
            }
          } else {
            statuses[req.id] = { attached: false }
          }
        } else {
          statuses[req.id] = { attached: false }
        }
      }

      sendResponse({
        status: 'success',
        data: {
          type: 'ATTACHMENTS_STATUS',
          statuses,
        },
      })
      return true
    }

    return false
  }
)

async function attemptAutomaticAutofill() {
  try {
    // 1. Check user settings
    const settings = await getSettings()
    if (settings.autofill?.requirePageConfirmation) {
      console.log('[VISA AUTOFILL] Auto-trigger skipped: User setting requires manual click before filling new pages (requirePageConfirmation is enabled).')
      return
    }

    const detection = detectIndiaVisaPage()
    if (!detection.matched || detection.page === 'unknown' || !detection.page) {
      console.log('[VISA AUTOFILL] Page is not matched/supported for auto-autofill.')
      return
    }

    if (
      detection.page === 'login' ||
      detection.page === 'otp' ||
      detection.page === 'captcha' ||
      detection.page === 'payment' ||
      detection.page === 'review'
    ) {
      console.log(`[VISA AUTOFILL] Safety boundary page "${detection.page}" detected. Skipping auto-autofill.`)
      return
    }

    const result = await readExtensionStorage<{
      visa_autofill_selected_applicant_id?: string
      visa_autofill_applicants?: ApplicantProfile[]
      visa_autofill_documents?: DocumentRecord[]
      visa_autofill_saved_applications?: SavedApplication[]
    }>(['visa_autofill_selected_applicant_id', 'visa_autofill_applicants', 'visa_autofill_documents', 'visa_autofill_saved_applications'])

    const selectedApplicantId = result.visa_autofill_selected_applicant_id
    if (!selectedApplicantId) {
      console.log('[VISA AUTOFILL] Auto-trigger skipped: No active profile is selected.')
      return
    }

    const applicants = result.visa_autofill_applicants || []
    const activeApplicant = applicants.find((a) => a.applicantId === selectedApplicantId)
    if (!activeApplicant) {
      console.log('[VISA AUTOFILL] Auto-trigger skipped: Selected profile details could not be found.')
      return
    }

    const documents = result.visa_autofill_documents || []
    const savedApplications = result.visa_autofill_saved_applications || []
    const savedApp = savedApplications.find((a) => a.applicantId === selectedApplicantId)

    const candRes = resolveCandidateData({
      profileId: selectedApplicantId,
      documents,
      savedApplication: savedApp,
      notes: activeApplicant.notes,
    })

    if (candRes.status !== 'READY' || !candRes.applicant || !candRes.provenance) {
      console.log(`[VISA AUTOFILL] Auto-trigger skipped: ${candRes.reason || 'Candidate data is not READY.'}`)
      return
    }

    const tempProfile = candRes.applicant

    activeState = updateWorkflowState(activeState, {
      status: 'ready',
      applicantId: selectedApplicantId,
    })

    const mappings = getIndiaVisaMappings(detection.flow, detection.page)

    // Controlled bounded retry for DOM readiness (up to 5 attempts, 300ms apart = max 1.5s)
    let ready = isFormReady(mappings)
    let readinessAttempts = 0
    while (!ready && readinessAttempts < 5) {
      readinessAttempts++
      await new Promise((resolve) => setTimeout(resolve, 300))
      ready = isFormReady(mappings)
    }

    if (!ready) {
      console.log(`[VISA AUTOFILL] Auto-trigger skipped: Target form elements not detected after ${readinessAttempts} readiness checks.`)
      return
    }

    console.log(
      `[VISA AUTOFILL] Automatically triggering autofill on "${detection.page}" using confirmed data from document "${candRes.provenance.documentId}".`
    )

    const autofillResult = await executeAutofill({
      mappings,
      applicant: tempProfile,
      options: {
        policy: 'overwrite',
        validatePageConsistency: () => {
          const currentDet = detectIndiaVisaPage()
          return currentDet.matched && currentDet.page === detection.page
        },
      },
    })

    console.log('[VISA AUTOFILL] Automatic autofill execution completed:', autofillResult)

    if (detection.page && !activeState.completedPages.includes(detection.page)) {
      activeState = updateWorkflowState(activeState, {
        completedPages: [...activeState.completedPages, detection.page],
      })
    }

    if (autofillResult.operation) {
      latestOperation = autofillResult.operation
    }

  } catch (err) {
    console.error('[VISA AUTOFILL] Error during automatic autofill trigger:', err)
  }
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') {
    attemptAutomaticAutofill()
  } else {
    window.addEventListener('load', () => {
      attemptAutomaticAutofill()
    })
  }
}

