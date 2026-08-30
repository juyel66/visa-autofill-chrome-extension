import { DEFAULT_SETTINGS } from './defaults'
import type { AppSettings } from './types'

const SETTINGS_STORAGE_KEY = 'visa_autofill_app_settings'

export const getSettings = async (): Promise<AppSettings> => {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve(DEFAULT_SETTINGS)
      return
    }


    

    chrome.storage.local.get([SETTINGS_STORAGE_KEY], (result) => {
      if (chrome.runtime?.lastError) {
        console.error('Error fetching settings from storage:', chrome.runtime.lastError)
        resolve(DEFAULT_SETTINGS)
        return
      }

      const stored = result[SETTINGS_STORAGE_KEY] as Partial<AppSettings> | undefined
      if (!stored || typeof stored !== 'object') {
        resolve(DEFAULT_SETTINGS)
        return
      }

      // Recover safely by merging stored settings with default values
      const recovered: AppSettings = {
        autofill: {
          defaultFillPolicy:
            stored.autofill?.defaultFillPolicy === 'overwrite' ? 'overwrite' : 'fill-empty',
          requirePageConfirmation:
            typeof stored.autofill?.requirePageConfirmation === 'boolean'
              ? stored.autofill.requirePageConfirmation
              : DEFAULT_SETTINGS.autofill.requirePageConfirmation,
        },
        privacy: {
          storeDocumentsLocally:
            typeof stored.privacy?.storeDocumentsLocally === 'boolean'
              ? stored.privacy.storeDocumentsLocally
              : DEFAULT_SETTINGS.privacy.storeDocumentsLocally,
        },
        version: stored.version || DEFAULT_SETTINGS.version,
      }

      resolve(recovered)
    })
  })
}

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve()
      return
    }

    chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings }, () => {
      if (chrome.runtime?.lastError) {
        console.error('Error saving settings to storage:', chrome.runtime.lastError)
        reject(chrome.runtime.lastError)
        return
      }
      resolve()
    })
  })
}

export const resetSettings = async (): Promise<AppSettings> => {
  await saveSettings(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export const clearAllLocalExtensionData = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve()
      return
    }

    chrome.storage.local.clear(() => {
      if (chrome.runtime?.lastError) {
        console.error('Error clearing local storage:', chrome.runtime.lastError)
        reject(chrome.runtime.lastError)
        return
      }
      resolve()
    })
  })
}
