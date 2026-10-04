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
  version?: number
  applicationId: string
  applicantId: string
  backendApplicationId?: string
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

export interface BackendApplicationSummary {
  id: string
  applicantName?: string | null
  passportNumber?: string | null
  status?: string | null
  hasOriginalPdf?: boolean
  createdAt: string
  updatedAt: string
}

export interface BackendApplicationDetail {
  id: string
  userId: string
  applicantName?: string | null
  passportNumber?: string | null
  status?: string | null
  applicationData: SavedApplication
  originalPdfFileName?: string | null
  originalPdfMimeType?: string | null
  hasOriginalPdf?: boolean
  createdAt: string
  updatedAt: string
}
