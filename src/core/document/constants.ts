import type { GenericDocumentCategory } from './types'

/**
 * Maximum allowed document file size in bytes (5 MB).
 * Centralized constant to allow developers to adjust file limits easily.
 */
export const MAX_DOCUMENT_FILE_SIZE = 5 * 1024 * 1024

/**
 * Supported MIME types for client-side upload validation.
 */
export const SUPPORTED_MIME_TYPES: string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
]

/**
 * Human-readable category labels for document records.
 */
export const DOCUMENT_CATEGORY_LABELS: Record<GenericDocumentCategory, string> = {
  passport: 'Passport',
  photograph: 'Photograph',
  'identity-document': 'Identity Document',
  'supporting-document': 'Supporting Document',
  pdf: 'PDF Document',
  other: 'Other Document',
}
