import type { IndiaFieldSelector } from '../../mapping.types'

/**
 * Bangladesh Indian Visa Portal (https://indianvisa-bangladesh.nic.in/)
 * Page: /visa/PhotoUpload (Canonical Page: DOCUMENT_UPLOAD)
 * 
 * Verified DOM selectors for Photo Upload page.
 * Note: File uploads are manual actions and are not automated in this phase.
 */
export interface BangladeshPhotoUploadSelectors {
  photoFile: IndiaFieldSelector[]
  uploadButton: IndiaFieldSelector[]
  submitContinue: IndiaFieldSelector[]
  submitExit: IndiaFieldSelector[]
}

export const BANGLADESH_PHOTO_UPLOAD_SELECTORS: BangladeshPhotoUploadSelectors = {
  photoFile: [
    { strategy: 'id', value: 'photo' },
    { strategy: 'name', value: 'photo' },
    { strategy: 'css', value: 'input[type="file"], input#photo' },
  ],
  uploadButton: [
    { strategy: 'id', value: 'upload' },
    { strategy: 'name', value: 'upload' },
    { strategy: 'css', value: 'input#upload, button#upload' },
  ],
  submitContinue: [
    { strategy: 'id', value: 'continue' },
    { strategy: 'name', value: 'continue' },
    { strategy: 'css', value: 'input#continue, button#continue' },
  ],
  submitExit: [
    { strategy: 'id', value: 'exit' },
    { strategy: 'name', value: 'exit' },
    { strategy: 'css', value: 'input#exit, button#exit' },
  ],
}
