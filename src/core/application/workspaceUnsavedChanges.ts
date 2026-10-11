import type { SavedApplication } from './types'

export interface WorkspaceBaseline {
  fieldValues: Map<string, string | boolean>
  photoSignature: string | null
}

/**
 * Normalizes a field value to a canonical string or boolean.
 * Undefined and null are normalized to empty string ''.
 */
export function normalizeFieldValue(value: unknown): string | boolean {
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'boolean') {
    return value
  }
  return String(value)
}

/**
 * Extracts a lightweight signature representing the photo state.
 */
export function getPhotoSignature(app: SavedApplication | null): string | null {
  if (!app?.photograph) return null
  const photo = app.photograph
  const fileName = photo.fileName || ''
  const fileSize = photo.fileSize || 0
  const dataLen = photo.dataUrl ? photo.dataUrl.length : 0
  const prefix = photo.dataUrl ? photo.dataUrl.slice(0, 60) : ''
  return `${fileName}:${fileSize}:${dataLen}:${prefix}`
}

/**
 * Creates a lightweight snapshot of the application's saved data.
 * Captures field values and photo signature without duplicating document records
 * or heavyweight metadata.
 */
export function createWorkspaceBaseline(application: SavedApplication | null): WorkspaceBaseline | null {
  if (!application) return null

  const fieldValues = new Map<string, string | boolean>()
  if (application.fields) {
    for (const [key, field] of Object.entries(application.fields)) {
      if (field) {
        fieldValues.set(key, normalizeFieldValue(field.value))
      }
    }
  }

  return {
    fieldValues,
    photoSignature: getPhotoSignature(application),
  }
}

/**
 * Compares current workspace application against the saved baseline.
 * Returns true if any field value differs from baseline or photo changed.
 * Returns false if all values match baseline (including after reverting changes).
 */
export function hasWorkspaceUnsavedChanges(
  currentApp: SavedApplication | null,
  baseline: WorkspaceBaseline | null
): boolean {
  if (!currentApp || !baseline) {
    return false
  }

  // 1. Photo state check
  const currentPhotoSig = getPhotoSignature(currentApp)
  if (currentPhotoSig !== baseline.photoSignature) {
    return true
  }

  const currentFields = currentApp.fields || {}
  const baselineValues = baseline.fieldValues

  // 2. Check current fields vs baseline
  for (const [key, field] of Object.entries(currentFields)) {
    const curVal = normalizeFieldValue(field?.value)
    const baseVal = baselineValues.has(key) ? baselineValues.get(key)! : ''
    if (curVal !== baseVal) {
      return true
    }
  }

  // 3. Check if any field present in baseline was removed or changed
  for (const [key, baseVal] of baselineValues.entries()) {
    if (baseVal === '') continue
    const field = currentFields[key]
    const curVal = normalizeFieldValue(field?.value)
    if (curVal !== baseVal) {
      return true
    }
  }

  return false
}

/**
 * Returns a list of field keys that differ from the saved baseline.
 */
export function getWorkspaceUnsavedChangeKeys(
  currentApp: SavedApplication | null,
  baseline: WorkspaceBaseline | null
): string[] {
  if (!currentApp || !baseline) {
    return []
  }

  const changedKeys: string[] = []
  const currentFields = currentApp.fields || {}
  const baselineValues = baseline.fieldValues

  // Check current fields
  for (const [key, field] of Object.entries(currentFields)) {
    const curVal = normalizeFieldValue(field?.value)
    const baseVal = baselineValues.has(key) ? baselineValues.get(key)! : ''
    if (curVal !== baseVal) {
      changedKeys.push(key)
    }
  }

  // Check deleted / missing baseline fields
  for (const [key, baseVal] of baselineValues.entries()) {
    if (baseVal === '' || changedKeys.includes(key)) continue
    const field = currentFields[key]
    const curVal = normalizeFieldValue(field?.value)
    if (curVal !== baseVal) {
      changedKeys.push(key)
    }
  }

  if (getPhotoSignature(currentApp) !== baseline.photoSignature) {
    changedKeys.push('applicant-photo')
  }

  return changedKeys
}

/**
 * Returns the count of fields with unsaved changes.
 */
export function getWorkspaceUnsavedChangesCount(
  currentApp: SavedApplication | null,
  baseline: WorkspaceBaseline | null
): number {
  return getWorkspaceUnsavedChangeKeys(currentApp, baseline).length
}
