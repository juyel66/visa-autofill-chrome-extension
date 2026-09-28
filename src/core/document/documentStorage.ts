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
          if (chrome.runtime?.lastError) {
            console.error(`[Visa Autofill Document Storage] chrome.storage.local.get error for "${key}":`, chrome.runtime.lastError)
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
    console.error(`[Visa Autofill Document Storage] Error reading key "${key}":`, error)
    throw new Error('Unable to load documents. Please try again.', { cause: error })
  }
}

/**
 * Prunes heavy base64 fileDataUrl payloads from older historical documents.
 * Preserves full extracted data and metadata while keeping storage lean.
 */
export function pruneExcessDocumentPayloads(documents: DocumentRecord[]): DocumentRecord[] {
  if (!documents || documents.length === 0) return []

  // Group documents by applicantId + documentType
  const latestKeys = new Set<string>()

  // Sort by updatedAt/createdAt descending
  const sorted = [...documents].sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime()
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime()
    return timeB - timeA
  })

  // Retain fileDataUrl ONLY on the single most recent document per applicant & documentType
  return sorted.map((doc) => {
    const groupKey = `${doc.applicantId || 'unknown'}_${doc.documentType || 'unknown'}`
    if (!latestKeys.has(groupKey)) {
      latestKeys.add(groupKey)
      return doc
    }
    // Older document in the same group: strip the heavy base64 dataUrl if present
    if (doc.fileDataUrl) {
      return {
        ...doc,
        fileDataUrl: undefined,
      }
    }
    return doc
  })
}

/**
 * Public helper to free storage space by pruning obsolete document file payloads.
 */
export async function pruneDocumentStoragePayloads(aggressive = false): Promise<void> {
  try {
    const list = await storageGet<DocumentRecord[]>(DOCUMENTS_STORAGE_KEY)
    if (!list || list.length === 0) return

    let pruned: DocumentRecord[]
    if (aggressive) {
      // Keep fileDataUrl only on the latest 1 document across everything
      const sorted = [...list].sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime()
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime()
        return timeB - timeA
      })
      pruned = sorted.map((doc, idx) => {
        if (idx === 0) return doc
        return doc.fileDataUrl ? { ...doc, fileDataUrl: undefined } : doc
      })
    } else {
      pruned = pruneExcessDocumentPayloads(list)
    }

    if (isChromeStorageAvailable()) {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [DOCUMENTS_STORAGE_KEY]: pruned }, () => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
    }
  } catch (err) {
    console.warn('[Visa Autofill Document Storage] Failed to prune document payloads:', err)
  }
}

/**
 * Low-level storage writer abstraction for document records with quota resilience.
 */
async function storageSet<T>(key: string, value: T): Promise<void> {
  try {
    if (isChromeStorageAvailable()) {
      return await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [key]: value }, async () => {
          const lastError = chrome.runtime?.lastError
          if (!lastError) {
            resolve()
            return
          }

          const errorMsg = lastError.message || ''
          const isQuota = /quota|kQuotaBytes/i.test(errorMsg)

          if (isQuota) {
            console.warn(`[Visa Autofill Document Storage] Quota exceeded writing key "${key}". Attempting payload recovery...`)
            try {
              if (key === DOCUMENTS_STORAGE_KEY && Array.isArray(value)) {
                // Step 1: Aggressively prune documents keeping only latest document's payload
                const aggressiveList = (value as DocumentRecord[]).map((doc, idx, arr) => {
                  if (idx === arr.length - 1) return doc // keep newest
                  return doc.fileDataUrl ? { ...doc, fileDataUrl: undefined } : doc
                })

                await new Promise<void>((resRetry, rejRetry) => {
                  chrome.storage.local.set({ [key]: aggressiveList }, () => {
                    if (chrome.runtime?.lastError) {
                      rejRetry(new Error(chrome.runtime.lastError.message))
                    } else {
                      resRetry()
                    }
                  })
                })
                resolve()
                return
              } else {
                // Prune document payloads to free space for this key
                await pruneDocumentStoragePayloads(true)
                await new Promise<void>((resRetry, rejRetry) => {
                  chrome.storage.local.set({ [key]: value }, () => {
                    if (chrome.runtime?.lastError) {
                      rejRetry(new Error(chrome.runtime.lastError.message))
                    } else {
                      resRetry()
                    }
                  })
                })
                resolve()
                return
              }
            } catch (recoveryErr) {
              console.error('[Visa Autofill Document Storage] Quota recovery failed:', recoveryErr)
              // Final fallback: strip all fileDataUrl completely
              if (key === DOCUMENTS_STORAGE_KEY && Array.isArray(value)) {
                const stripped = (value as DocumentRecord[]).map((d) => ({
                  ...d,
                  fileDataUrl: undefined,
                }))
                try {
                  await new Promise<void>((resFinal, rejFinal) => {
                    chrome.storage.local.set({ [key]: stripped }, () => {
                      if (chrome.runtime?.lastError) {
                        rejFinal(new Error(chrome.runtime.lastError.message))
                      } else {
                        resFinal()
                      }
                    })
                  })
                  resolve()
                  return
                } catch {
                  // Fall through to error
                }
              }
            }
          }

          console.error(`[Visa Autofill Document Storage] chrome.storage.local.set error for "${key}":`, lastError)
          reject(new Error(lastError.message))
        })
      })
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (error) {
    console.error(`[Visa Autofill Document Storage] Error writing key "${key}":`, error)
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

  console.log('[DocumentStorage] saveDocument:', docRecord.documentId, {
    contactPhone: docRecord.extractedData?.contact?.phone?.value,
    contactIsd: docRecord.extractedData?.contact?.isdCode?.value,
    contactMobile: docRecord.extractedData?.contact?.mobile?.value,
    presentPhone: docRecord.extractedData?.presentAddress?.phone?.value,
    confirmed: docRecord.extractedDataConfirmed,
  })

  const prunedList = pruneExcessDocumentPayloads(list)
  await storageSet(DOCUMENTS_STORAGE_KEY, prunedList)
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

/**
 * Finds the latest (most recent by updatedAt/createdAt) document of a given type.
 * Prioritizes confirmed extractions over unconfirmed ones.
 */
export function getLatestDocument(docs: DocumentRecord[], documentType: string): DocumentRecord | undefined {
  if (!docs || docs.length === 0) return undefined
  const confirmed = docs.filter((d) => d.documentType === documentType && d.extractedDataConfirmed)
  if (confirmed.length > 0) {
    return [...confirmed].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    )[0]
  }
  const allOfType = docs.filter((d) => d.documentType === documentType)
  if (allOfType.length > 0) {
    return [...allOfType].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    )[0]
  }
  return undefined
}

