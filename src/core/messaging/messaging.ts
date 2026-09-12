import type { ExtensionMessage, ExtensionResponse } from './types'

export async function sendToBackground<T>(
  message: ExtensionMessage
): Promise<ExtensionResponse<T>> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve({
          status: 'error',
          error: 'Chrome extension environment not detected.',
        })
        return
      }

      chrome.runtime.sendMessage(message, (response: ExtensionResponse<T>) => {
        const lastError = chrome.runtime.lastError
        if (lastError) {
          resolve({
            status: 'error',
            error: lastError.message || 'Error communicating with background service.',
          })
          return
        }

        if (!response) {
          resolve({
            status: 'error',
            error: 'No response received from background service.',
          })
          return
        }

        resolve(response)
      })
    } catch (err) {
      resolve({
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown communication error.',
      })
    }
  })
}

export async function sendMessageToTab<T>(
  tabId: number,
  message: ExtensionMessage
): Promise<ExtensionResponse<T>> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.sendMessage) {
        resolve({
          status: 'error',
          error: 'Chrome extension environment not detected.',
        })
        return
      }

      chrome.tabs.sendMessage(tabId, message, (response: ExtensionResponse<T>) => {
        const lastError = chrome.runtime.lastError
        if (lastError) {
          const msg = lastError.message || ''
          const isReceiverMissing =
            msg.includes('Receiving end does not exist') || msg.includes('Could not establish connection')
          resolve({
            status: 'error',
            error: isReceiverMissing
              ? 'Content script is not available on this page.'
              : lastError.message || 'Error communicating with content script.',
          })
          return
        }

        if (!response) {
          resolve({
            status: 'error',
            error: 'No response received from content script on this page.',
          })
          return
        }

        resolve(response)
      })
    } catch (err) {
      resolve({
        status: 'error',
        error: err instanceof Error ? err.message : 'Content script is not available on this page.',
      })
    }
  })
}
