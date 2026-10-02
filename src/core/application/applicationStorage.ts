import type { SavedApplication } from './types'
import { pruneDocumentStoragePayloads } from '../document/documentStorage'

const SAVED_APPLICATIONS_STORAGE_KEY = 'visa_autofill_saved_applications'

function getStorageArea(): chrome.storage.StorageArea | null {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return chrome.storage.local
  }
  return null
}

// In-memory fallback for unit tests and non-extension environments
let memorySavedApplications: SavedApplication[] = []

export function clearMemorySavedApplications(): void {
  memorySavedApplications = []
}

export async function getSavedApplications(): Promise<SavedApplication[]> {
  const storage = getStorageArea()
  if (!storage) {
    return [...memorySavedApplications]
  }

  return new Promise<SavedApplication[]>((resolve) => {
    storage.get([SAVED_APPLICATIONS_STORAGE_KEY], (res) => {
      if (chrome.runtime?.lastError) {
        console.error('[ApplicationStorage] Error fetching saved applications:', chrome.runtime.lastError)
        resolve([])
        return
      }
      const data = res[SAVED_APPLICATIONS_STORAGE_KEY]
      if (Array.isArray(data)) {
        resolve(data as SavedApplication[])
      } else {
        resolve([])
      }
    })
  })
}

export async function getSavedApplicationByApplicantId(applicantId: string): Promise<SavedApplication | null> {
  if (!applicantId) return null
  const applications = await getSavedApplications()
  return (
    applications.find((a) => a.applicantId === applicantId) ||
    applications.find(
      (a) =>
        a.fields?.['comp_name']?.value ||
        a.fields?.['appl.comp_name']?.value ||
        a.fields?.['travel.businessCompanyName']?.value
    ) ||
    applications[0] ||
    null
  )
}

export async function saveApplication(app: SavedApplication): Promise<void> {
  if (!app || !app.applicantId) {
    throw new Error('Application must have an applicantId to be saved.')
  }

  const existing = await getSavedApplications()
  const index = existing.findIndex((a) => a.applicantId === app.applicantId)

  const updatedApp: SavedApplication = {
    ...app,
    updatedAt: new Date().toISOString(),
  }

  let nextList: SavedApplication[]
  if (index >= 0) {
    nextList = [...existing]
    nextList[index] = updatedApp
  } else {
    nextList = [...existing, updatedApp]
  }

  const storage = getStorageArea()
  if (!storage) {
    memorySavedApplications = nextList
    return
  }

  return new Promise<void>((resolve, reject) => {
    storage.set({ [SAVED_APPLICATIONS_STORAGE_KEY]: nextList }, async () => {
      if (chrome.runtime?.lastError) {
        const errorMsg = chrome.runtime.lastError.message || ''
        if (/quota|kQuotaBytes/i.test(errorMsg)) {
          console.warn('[ApplicationStorage] Quota exceeded saving application. Pruning document payloads and retrying...')
          try {
            await pruneDocumentStoragePayloads(true)
            storage.set({ [SAVED_APPLICATIONS_STORAGE_KEY]: nextList }, () => {
              if (chrome.runtime?.lastError) {
                console.error('[ApplicationStorage] Retry after prune failed:', chrome.runtime.lastError)
                reject(new Error(chrome.runtime.lastError.message))
              } else {
                resolve()
              }
            })
            return
          } catch (pruneErr) {
            console.error('[ApplicationStorage] Prune retry error:', pruneErr)
          }
        }
        console.error('[ApplicationStorage] Error saving application:', chrome.runtime.lastError)
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve()
      }
    })
  })
}

export async function deleteSavedApplication(applicantId: string): Promise<void> {
  if (!applicantId) return
  const existing = await getSavedApplications()
  const nextList = existing.filter((a) => a.applicantId !== applicantId)

  const storage = getStorageArea()
  if (!storage) {
    memorySavedApplications = nextList
    return
  }

  return new Promise<void>((resolve, reject) => {
    storage.set({ [SAVED_APPLICATIONS_STORAGE_KEY]: nextList }, () => {
      if (chrome.runtime?.lastError) {
        console.error('[ApplicationStorage] Error deleting saved application:', chrome.runtime.lastError)
        reject(chrome.runtime.lastError)
      } else {
        resolve()
      }
    })
  })
}
