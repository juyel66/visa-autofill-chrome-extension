import type {
  ExtensionMessage,
  ExtensionResponse,
  ContentPongPayload,
} from '../core/messaging'

console.log('[Visa Autofill] Content script loaded.')

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse<ContentPongPayload>) => void
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

    return false
  }
)
