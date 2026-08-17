import type { DocumentRequirement } from '../../../core/document/requirement.types'

/**
 * Verified Document Requirements for official Indian Regular/Paper Visa online portal.
 */
export const INDIA_REGULAR_DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  {
    id: 'req_regular_passport',
    documentType: 'passport',
    label: 'Passport Bio Page',
    required: true,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxFileSizeBytes: 5 * 1024 * 1024,
    status: 'verified',
    description: 'Scanned bio page of valid passport (PDF or Image, max 5 MB).',
    targetSelector: { strategy: 'name', value: 'passport_file' },
  },
  {
    id: 'req_regular_photo',
    documentType: 'photograph',
    label: 'Applicant Photograph',
    required: true,
    acceptedMimeTypes: ['image/jpeg', 'image/png'],
    maxFileSizeBytes: 3 * 1024 * 1024,
    status: 'verified',
    description: 'Recent passport size photo (JPG/PNG, max 3 MB).',
    targetSelector: { strategy: 'name', value: 'photo_file' },
  },
]

/**
 * Verified Document Requirements for official Indian e-Visa online portal.
 */
export const INDIA_EVISA_DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  {
    id: 'req_evisa_passport',
    documentType: 'passport',
    label: 'Passport Bio Page',
    required: true,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg'],
    maxFileSizeBytes: 5 * 1024 * 1024,
    status: 'verified',
    description: 'Scanned PDF of passport page containing personal details.',
    targetSelector: { strategy: 'id', value: 'passportUpload' },
  },
  {
    id: 'req_evisa_photo',
    documentType: 'photograph',
    label: 'Applicant Photograph',
    required: true,
    acceptedMimeTypes: ['image/jpeg', 'image/png'],
    maxFileSizeBytes: 1 * 1024 * 1024,
    status: 'verified',
    description: 'Recent photograph with white background.',
    targetSelector: { strategy: 'id', value: 'photoUpload' },
  },
]
