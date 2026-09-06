import type { DocumentRecord } from '../document/types'

export type ApplicationFieldSource = 'passport' | 'ogd' | 'manual' | 'missing'

export type SavedApplicationStatus = 'draft' | 'ready_for_autofill'

export interface ApplicationFieldValue {
  value: string | boolean
  source: ApplicationFieldSource
  documentId?: string
  confidence?: number
  isUserEdited?: boolean
  originalExtractedValue?: string | boolean
}

export interface SavedApplication {
  applicationId: string
  applicantId: string
  createdAt: string
  updatedAt: string
  status: SavedApplicationStatus
  fields: Record<string, ApplicationFieldValue>
  provenance: {
    passportDocumentId?: string
    ogdDocumentId?: string
    lastSavedAt: string
  }
  sourceDocuments: {
    passport?: DocumentRecord
    ogd?: DocumentRecord
  }
  manualEdits: Record<string, boolean>
  photograph?: {
    dataUrl?: string
    fileName?: string
    fileSize?: number
  }
}
