import type { ApplicantProfile } from '../applicant/types'

export const APPLICANTS_STORAGE_KEY = 'visa_autofill_applicants'
export const SELECTED_APPLICANT_STORAGE_KEY = 'visa_autofill_selected_applicant_id'

function isChromeStorageAvailable(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

/**
 * Low-level storage reader abstraction.
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

    // Fallback to localStorage for non-extension web contexts
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : null
    }

    return null
  } catch (error) {
    console.error(`Error reading key "${key}" from storage:`, error)
    throw new Error('Unable to read storage. Please try again.', { cause: error })
  }
}

/**
 * Low-level storage writer abstraction.
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

    // Fallback to localStorage for non-extension web contexts
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (error) {
    console.error(`Error writing key "${key}" to storage:`, error)
    throw new Error('Unable to save applicant. Please try again.', { cause: error })
  }
}

/**
 * Low-level storage remover abstraction.
 */
async function storageRemove(key: string): Promise<void> {
  try {
    if (isChromeStorageAvailable()) {
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.remove([key], () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
    }
  } catch (error) {
    console.error(`Error removing key "${key}" from storage:`, error)
    throw new Error('Unable to remove storage item. Please try again.', { cause: error })
  }
}

/**
 * Retrieves all saved generic Applicant Profiles from storage.
 */
export async function getApplicants(): Promise<ApplicantProfile[]> {
  const applicants = await storageGet<ApplicantProfile[]>(APPLICANTS_STORAGE_KEY)
  return applicants || []
}

/**
 * Retrieves a single applicant profile by its unique applicantId.
 */
export async function getApplicantById(id: string): Promise<ApplicantProfile | null> {
  if (!id) return null
  const list = await getApplicants()
  return list.find((a) => a.applicantId === id) || null
}

/**
 * Saves a new applicant profile or updates an existing one.
 */
export async function saveApplicant(applicant: ApplicantProfile): Promise<void> {
  if (!applicant.applicantId) {
    throw new Error('Applicant must have a valid applicantId')
  }

  const now = new Date().toISOString()
  const list = await getApplicants()
  const index = list.findIndex((a) => a.applicantId === applicant.applicantId)

  if (index >= 0) {
    // Preserving createdAt, updating updatedAt
    const existing = list[index]
    const updatedApplicant: ApplicantProfile = {
      ...applicant,
      createdAt: existing.createdAt || now,
      updatedAt: now,
    }
    list[index] = updatedApplicant
  } else {
    // New applicant creation
    const newApplicant: ApplicantProfile = {
      ...applicant,
      createdAt: applicant.createdAt || now,
      updatedAt: now,
    }
    list.push(newApplicant)
  }

  await storageSet(APPLICANTS_STORAGE_KEY, list)
}

/**
 * Updates an existing applicant profile.
 */
export async function updateApplicant(applicant: ApplicantProfile): Promise<void> {
  await saveApplicant(applicant)
}

/**
 * Deletes an applicant profile by applicantId.
 * If the deleted applicant was selected, clears the active selection.
 */
export async function deleteApplicant(id: string): Promise<void> {
  if (!id) return
  const list = await getApplicants()
  const filtered = list.filter((a) => a.applicantId !== id)
  await storageSet(APPLICANTS_STORAGE_KEY, filtered)

  // Clear selected applicant if it matches deleted ID
  const selectedId = await getSelectedApplicantId()
  if (selectedId === id) {
    await clearSelectedApplicant()
  }
}

/**
 * Gets the active selected applicant ID.
 */
export async function getSelectedApplicantId(): Promise<string | null> {
  return await storageGet<string>(SELECTED_APPLICANT_STORAGE_KEY)
}

/**
 * Sets the active selected applicant ID.
 */
export async function setSelectedApplicantId(id: string): Promise<void> {
  await storageSet(SELECTED_APPLICANT_STORAGE_KEY, id)
}

/**
 * Clears the active selected applicant ID.
 */
export async function clearSelectedApplicant(): Promise<void> {
  await storageRemove(SELECTED_APPLICANT_STORAGE_KEY)
}
