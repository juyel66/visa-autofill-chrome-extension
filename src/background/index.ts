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
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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
      activeWorkflowState = createInitialWorkflowState()
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
          sendResponse({
            status: 'error',
            error: 'Active browser tab is not available.',
          })
          return
        }

        // Tab and Applicant Consistency Check
        if (
          activeWorkflowState.status !== 'idle' &&
          activeWorkflowState.tabId !== null &&
          typeof activeWorkflowState.tabId !== 'undefined' &&
          activeTab.id !== activeWorkflowState.tabId
        ) {
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

        const tabResponse = await sendMessageToTab<
          | VisaPageResponsePayload
          | AutofillResponsePayload
          | WorkflowStatePayload
          | DocumentAttachmentPayload
          | UndoResponsePayload
        >(activeTab.id, finalMessage)

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
