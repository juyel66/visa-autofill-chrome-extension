import type {
  AutofillResponsePayload,
  BackgroundPongPayload,
  DocumentAttachmentPayload,
  ExtensionMessage,
  ExtensionResponse,
  UndoResponsePayload,
  VisaPageResponsePayload,
  WorkflowStatePayload,
} from '../core/messaging'
import { sendMessageToTab } from '../core/messaging'
import { createInitialWorkflowState, updateWorkflowState } from '../core/workflow'
import type { WorkflowState } from '../core/workflow'

console.log('[Visa Autofill] Background service worker initialized.')

let activeWorkflowState: WorkflowState = createInitialWorkflowState()

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse<unknown>) => void
  ) => {
    if (message.type === 'PING_BACKGROUND') {
      const response: ExtensionResponse<BackgroundPongPayload> = {
        status: 'success',
        data: {
          type: 'BACKGROUND_PONG',
          message: 'Background service is working',
        },
      }
      sendResponse(response)
      return true
    }

    if (message.type === 'GET_WORKFLOW_STATE') {
      sendResponse({
        status: 'success',
        data: {
          type: 'WORKFLOW_STATE_RESPONSE',
          state: activeWorkflowState,
        },
      })
      return true
    }

    if (message.type === 'START_WORKFLOW') {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const activeTab = tabs[0]
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        activeWorkflowState = updateWorkflowState(activeWorkflowState, {
          sessionId,
          status: 'ready',
          applicantId: message.applicantId,
          tabId: activeTab?.id || null,
          operations: {},
          errors: [],
        })
        console.log(`[Visa Autofill Background] START_WORKFLOW initialized for applicant "${message.applicantId}" on tab ${activeTab?.id}.`)

        // Forward START_WORKFLOW to content script if active tab exists
        if (activeTab?.id) {
          try {
            await sendMessageToTab(activeTab.id, message)
          } catch (err) {
            console.warn('[Visa Autofill Background] Could not forward START_WORKFLOW to content script:', err)
          }
        }

        sendResponse({
          status: 'success',
          data: {
            type: 'WORKFLOW_STATE_RESPONSE',
            state: activeWorkflowState,
          },
        })
      })
      return true
    }

    if (message.type === 'STOP_WORKFLOW') {
      const tabId = activeWorkflowState.tabId
      activeWorkflowState = createInitialWorkflowState()
      console.log('[Visa Autofill Background] STOP_WORKFLOW received. Session reset.')

      // Forward STOP_WORKFLOW to content script if tab was tracked
      if (tabId) {
        sendMessageToTab(tabId, message).catch((err) => {
          console.warn('[Visa Autofill Background] Could not forward STOP_WORKFLOW to content script:', err)
        })
      }

      sendResponse({
        status: 'success',
        data: {
          type: 'WORKFLOW_STATE_RESPONSE',
          state: activeWorkflowState,
        },
      })
      return true
    }

    if (
      message.type === 'PING_CONTENT' ||
      message.type === 'GET_CURRENT_VISA_PAGE' ||
      message.type === 'EXECUTE_AUTOFILL' ||
      message.type === 'ATTACH_DOCUMENT' ||
      message.type === 'EXECUTE_UNDO' ||
      message.type === 'CHECK_ATTACHMENTS'
    ) {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const activeTab = tabs[0]
        if (!activeTab || typeof activeTab.id === 'undefined') {
          console.warn('[Visa Autofill Background] Active browser tab query returned no tab.')
          sendResponse({
            status: 'error',
            error: 'Active browser tab is not available.',
          })
          return
        }

        // Tab and Applicant Consistency Check and rebuild file
        if (
          activeWorkflowState.status !== 'idle' &&
          activeWorkflowState.tabId !== null &&
          typeof activeWorkflowState.tabId !== 'undefined' &&
          activeTab.id !== activeWorkflowState.tabId
        ) {
          console.warn(`[Visa Autofill Background] Tab mismatch: active ${activeTab.id} vs session ${activeWorkflowState.tabId}`)
          sendResponse({
            status: 'error',
            error: 'Active tab mismatch. Please return to the correct tab or restart workflow.',
          })
          return
        }

        // Inject page-specific operation on undo lookup
        let finalMessage: ExtensionMessage = message
        if (message.type === 'EXECUTE_UNDO') {
          const currentPage = activeWorkflowState.currentPage || ''
          const op = activeWorkflowState.operations?.[currentPage]
          finalMessage = {
            ...message,
            operation: op || null,
          }
        }

        console.log(`[Visa Autofill Background] Forwarding message "${message.type}" to tab ${activeTab.id}.`)

        const tabResponse = await sendMessageToTab<
          | VisaPageResponsePayload
          | AutofillResponsePayload
          | WorkflowStatePayload
          | DocumentAttachmentPayload
          | UndoResponsePayload
        >(activeTab.id, finalMessage)

        console.log(`[Visa Autofill Background] Tab response for "${message.type}":`, tabResponse.status)

        // Store active operation on successful execute-autofill
        if (
          message.type === 'EXECUTE_AUTOFILL' &&
          tabResponse.status === 'success' &&
          tabResponse.data?.type === 'AUTOFILL_COMPLETED'
        ) {
          const res = tabResponse.data.result
          if (res.operation && activeWorkflowState.currentPage) {
            if (!activeWorkflowState.operations) {
              activeWorkflowState.operations = {}
            }
            activeWorkflowState.operations[activeWorkflowState.currentPage] = res.operation
          }
        }

        // Clear page operation mapping on successful execute-undo
        if (
          message.type === 'EXECUTE_UNDO' &&
          tabResponse.status === 'success' &&
          tabResponse.data?.type === 'UNDO_COMPLETED'
        ) {
          if (activeWorkflowState.operations && activeWorkflowState.currentPage) {
            delete activeWorkflowState.operations[activeWorkflowState.currentPage]
          }
        }

        sendResponse(tabResponse)
      })

      return true
    }

    return false
  }
)
