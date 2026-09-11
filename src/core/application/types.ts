import type { DocumentRecord } from '../document/types'

export type ApplicationFieldSource = 'passport' | 'official_document' | 'ogd' | 'manual' | 'derived' | 'missing'

export type SavedApplicationStatus = 'draft' | 'ready_for_autofill'

export interface ApplicationFieldValue {
  value: string | boolean
  source: ApplicationFieldSource
  documentId?: string
  confidence?: number | string
  isUserEdited?: boolean
  originalExtractedValue?: string | boolean
  hasConflict?: boolean
  conflictDetails?: string
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
  religionMetadata?: {
    religion: string | null
    religionSource: 'passport' | 'official_document' | 'ogd' | 'manual' | null
    religionConfidence: 'high' | 'medium' | 'low' | 'none'
    religionConflict: boolean
    conflictDetails?: string
  }
  photograph?: {
    dataUrl?: string
    fileName?: string
    fileSize?: number
  }
}
