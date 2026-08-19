import type { ExtractedApplicantData } from '../extraction/data/types'

export type GenericDocumentCategory =
  | 'passport'
  | 'photograph'
  | 'identity-document'
  | 'supporting-document'
  | 'pdf'
  | 'other'

export type DocumentStatus = 'uploaded' | 'processing' | 'processed' | 'failed'

export type DocumentSource = 'user-upload' | 'future-extraction'

export interface DocumentRecord {
  documentId: string
  applicantId: string
  documentType: GenericDocumentCategory | string
  fileName: string
  mimeType: string
  fileSize: number // File size in bytes
  createdAt: string // ISO timestamp string
  updatedAt: string // ISO timestamp string
  status: DocumentStatus
  source: DocumentSource
  fileDataUrl?: string // Base64 data URL for preview and local storage
  description?: string
  expiryDate?: string
  extractedData?: ExtractedApplicantData
  extractedDataConfirmed?: boolean
}

// Deprecated legacy interface kept for backwards compatibility
export interface DocumentMetadata {
  documentId: string
  documentType: string
  fileName: string
  uploadedAt: string
  fileSize?: number
  mimeType?: string
  description?: string
}
