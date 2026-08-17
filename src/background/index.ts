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
      activeWorkflowState = updateWorkflowState(activeWorkflowState, {
        status: 'ready',
        applicantId: message.applicantId,
      })
      sendResponse({
        status: 'success',
        data: {
          type: 'WORKFLOW_STATE_RESPONSE',
          state: activeWorkflowState,
        },
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
      message.type === 'EXECUTE_UNDO'
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

        const tabResponse = await sendMessageToTab<
          | VisaPageResponsePayload
          | AutofillResponsePayload
          | WorkflowStatePayload
          | DocumentAttachmentPayload
          | UndoResponsePayload
        >(activeTab.id, message)

        sendResponse(tabResponse)
      })

      return true
    }

    return false
  }
)
