import type { FieldSelector } from '../autofill/types'
import type { GenericDocumentCategory } from './types'

export type DocumentRequirementStatus = 'verified' | 'unverified' | 'unsupported'

export type DocumentAttachmentStatus =
  | 'attached'
  | 'cancelled'
  | 'not-found'
  | 'unsupported'
  | 'invalid'
  | 'failed'

export interface DocumentRequirement {
  id: string
  documentType: GenericDocumentCategory
  label: string
  required: boolean
  acceptedMimeTypes?: string[]
  maxFileSizeBytes?: number
  status: DocumentRequirementStatus
  description?: string
  targetSelector?: FieldSelector
}

export interface DocumentAttachmentResult {
  success: boolean
  documentId: string
  targetFieldId: string
  status: DocumentAttachmentStatus
  reason?: string
}
