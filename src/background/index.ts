import type {
  ExtensionMessage,
  ExtensionResponse,
  BackgroundPongPayload,
  ContentPongPayload,
} from '../core/messaging'
import { sendMessageToTab } from '../core/messaging'

console.log('[Visa Autofill] Background service worker initialized.')

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

    if (message.type === 'PING_CONTENT') {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const activeTab = tabs[0]
        if (!activeTab || typeof activeTab.id === 'undefined') {
          sendResponse({
            status: 'error',
            error: 'Content script is not available on this page.',
          })
          return
        }

        const tabResponse = await sendMessageToTab<ContentPongPayload>(
          activeTab.id,
          message
        )
        sendResponse(tabResponse)
      })

      return true
    }

    return false
  }
)
