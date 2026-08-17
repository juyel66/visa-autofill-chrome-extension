import type { DocumentRecord } from './types'

export const DOCUMENTS_STORAGE_KEY = 'visa_autofill_documents'

function isChromeStorageAvailable(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

/**
 * Low-level storage reader abstraction for document records.
 */
async function storageGet<T>(key: string): Promise<T | null> {
  try {
    if (isChromeStorageAvailable()) {
      return new Promise<T | null>((resolve, reject) => {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve((result[key] as T) ?? null)
          }
        })
      })
    }

    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : null
    }

    return null
  } catch (error) {
    console.error(`Error reading key "${key}" from document storage:`, error)
    throw new Error('Unable to load documents. Please try again.', { cause: error })
  }
}

/**
 * Low-level storage writer abstraction for document records.
 */
async function storageSet<T>(key: string, value: T): Promise<void> {
  try {
    if (isChromeStorageAvailable()) {
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (error) {
    console.error(`Error writing key "${key}" to document storage:`, error)
    throw new Error('Unable to save document. Please try again.', { cause: error })
  }
}

/**
 * Retrieves all stored document records.
 */
export async function getDocuments(): Promise<DocumentRecord[]> {
  const documents = await storageGet<DocumentRecord[]>(DOCUMENTS_STORAGE_KEY)
  return documents || []
}

/**
 * Retrieves document records associated with a specific applicantId.
 */
export async function getDocumentsByApplicantId(applicantId: string): Promise<DocumentRecord[]> {
  if (!applicantId) return []
  const list = await getDocuments()
  return list.filter((doc) => doc.applicantId === applicantId)
}

/**
 * Retrieves a single document record by documentId.
 */
export async function getDocumentById(documentId: string): Promise<DocumentRecord | null> {
  if (!documentId) return null
  const list = await getDocuments()
  return list.find((doc) => doc.documentId === documentId) || null
}

/**
 * Saves a new document record or updates an existing record.
 */
export async function saveDocument(docRecord: DocumentRecord): Promise<void> {
  if (!docRecord.documentId) {
    throw new Error('Document record must have a valid documentId')
  }

  const now = new Date().toISOString()
  const list = await getDocuments()
  const index = list.findIndex((doc) => doc.documentId === docRecord.documentId)

  if (index >= 0) {
    const existing = list[index]
    list[index] = {
      ...docRecord,
      createdAt: existing.createdAt || now,
      updatedAt: now,
    }
  } else {
    list.push({
      ...docRecord,
      createdAt: docRecord.createdAt || now,
      updatedAt: now,
    })
  }

  await storageSet(DOCUMENTS_STORAGE_KEY, list)
}

/**
 * Updates an existing document record.
 */
export async function updateDocument(docRecord: DocumentRecord): Promise<void> {
  await saveDocument(docRecord)
}

/**
 * Deletes a document record by documentId.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  if (!documentId) return
  const list = await getDocuments()
  const filtered = list.filter((doc) => doc.documentId !== documentId)
  await storageSet(DOCUMENTS_STORAGE_KEY, filtered)
}
