import type { Gender } from '../../applicant/types'

export type ExtractionSource = 'mrz' | 'pdf-text' | 'ocr' | 'manual-review'

export interface ExtractedField<T> {
  value: T
  source: ExtractionSource
  confidence?: number // 0 to 100
}

export interface ExtractedApplicantData {
  personal?: {
    firstName?: ExtractedField<string>
    middleName?: ExtractedField<string>
    lastName?: ExtractedField<string>
    fullName?: ExtractedField<string>
    dateOfBirth?: ExtractedField<string> // YYYY-MM-DD
    townCityOfBirth?: ExtractedField<string>
    countryOfBirth?: ExtractedField<string>
    gender?: ExtractedField<Gender>
    nationality?: ExtractedField<string>
    previousNationality?: ExtractedField<string>
    nationalIdNumber?: ExtractedField<string>
    religion?: ExtractedField<string>
    educationalQualification?: ExtractedField<string>
  }
  passport?: {
    passportNumber?: ExtractedField<string>
    passportType?: ExtractedField<string>
    issuingCountry?: ExtractedField<string>
    issueDate?: ExtractedField<string> // YYYY-MM-DD
    expiryDate?: ExtractedField<string> // YYYY-MM-DD
    placeOfIssue?: ExtractedField<string>
  }
  contact?: {
    email?: ExtractedField<string>
    mobile?: ExtractedField<string>
    phone?: ExtractedField<string>
  }
}

export interface ExtractedFieldConflict<T> {
  fieldKey: string
  label: string
  candidates: ExtractedField<T>[]
  resolvedValue?: T
}

export interface DocumentExtractionPackage {
  documentId: string
  applicantId: string
  extractedData: ExtractedApplicantData
  conflicts: ExtractedFieldConflict<unknown>[]
  warnings: string[]
  createdAt: string // ISO 8601
}

export type ReviewDecision = 'keep-existing' | 'use-extracted' | 'edit' | 'ignore'

export type ExtractedFieldReviewStatus =
  | 'matches'
  | 'new'
  | 'conflict'
  | 'invalid'
  | 'mrz_ocr_conflict'

export interface ExtractedFieldReviewItem {
  fieldPath: string
  label: string
  existingValue?: string
  extractedValue?: string
  status: ExtractedFieldReviewStatus
  source?: ExtractionSource
  confidence?: number
  decision: ReviewDecision
  editedValue?: string
  validationError?: string
}

export interface ProfileUpdateReviewResult {
  applicantId: string
  documentId?: string
  snapshotTimestamp: string
  reviewItems: ExtractedFieldReviewItem[]
  isStale?: boolean
}
