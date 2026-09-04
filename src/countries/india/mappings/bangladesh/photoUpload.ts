import type { IndiaVisaFieldMapping } from '../../mapping.types'
import { BANGLADESH_PHOTO_UPLOAD_SELECTORS } from '../../selectors/bangladesh/photoUpload'

/**
 * Field mappings for Bangladesh Indian Visa Portal - Photo Upload page (/visa/PhotoUpload)
 * Canonical Page Identity: 'DOCUMENT_UPLOAD'
 */
export const BANGLADESH_PHOTO_UPLOAD_MAPPINGS: IndiaVisaFieldMapping[] = [
  {
    id: 'bd_photo_upload',
    section: 'photo-upload',
    targetField: 'photo',
    sourceType: 'manual',
    selector: BANGLADESH_PHOTO_UPLOAD_SELECTORS.photoFile,
    inputType: 'file',
    status: 'manual-required',
    required: true,
    page: 'DOCUMENT_UPLOAD',
    notes: 'Photograph upload is performed manually by the applicant.',
  },
]
