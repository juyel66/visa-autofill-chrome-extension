
import type { SavedApplication } from '../application/types'

export interface ApplicationDraft {
  draftId: string
  savedApplication: SavedApplication
  pdfBlob?: Blob | null
  pdfFileName?: string
  pdfMimeType?: string
  createdAt: number
}

const DB_NAME = 'visa_autofill_drafts_db'
const STORE_NAME = 'drafts'
const DB_VERSION = 1

// In-memory fallback if IndexedDB is unavailable
const memoryDrafts = new Map<string, ApplicationDraft>()

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment.'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'draftId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Stores an in-memory extraction draft with original PDF bytes until the user saves or cancels.
 */
export async function saveDraft(draft: ApplicationDraft): Promise<void> {
  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const putReq = store.put(draft)

      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    })
  } catch (err) {
    console.warn('[DraftDB] IndexedDB save failed, using memory fallback:', err)
    memoryDrafts.set(draft.draftId, draft)
  }
} 

 
/** 
 * Retrieves a draft by its ID.
 */ 


export async function getDraft(draftId: string): Promise<ApplicationDraft | null> {
  if (!draftId) return null

  if (memoryDrafts.has(draftId)) {
    return memoryDrafts.get(draftId) || null
  }

  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(draftId)

      getReq.onsuccess = () => resolve(getReq.result || null)
      getReq.onerror = () => reject(getReq.error)
    })
  } catch (err) {
    console.warn('[DraftDB] IndexedDB read failed:', err)
    return memoryDrafts.get(draftId) || null
  }
}

/**
 * Deletes a draft once saved to the database.
 */
export async function deleteDraft(draftId: string): Promise<void> {
  if (!draftId) return

  memoryDrafts.delete(draftId)

  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const delReq = store.delete(draftId)

      delReq.onsuccess = () => resolve()
      delReq.onerror = () => reject(delReq.error)
    })
  } catch (err) {
    console.warn('[DraftDB] IndexedDB delete error:', err)
  }
}

/**
 * Retrieves the most recent draft if no draftId was provided.
 */
export async function getLatestDraft(): Promise<ApplicationDraft | null> {
  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.getAll()

      req.onsuccess = () => {
        const all = (req.result || []) as ApplicationDraft[]
        if (all.length === 0) {
          resolve(null)
          return
        }
        all.sort((a, b) => b.createdAt - a.createdAt)
        resolve(all[0])
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    const all = Array.from(memoryDrafts.values())
    if (all.length === 0) return null
    all.sort((a, b) => b.createdAt - a.createdAt)
    return all[0]
  }
}


