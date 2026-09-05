import type { Gender } from '../../applicant/types'

export type ExtractionSource = 'mrz' | 'pdf-text' | 'ocr' | 'manual-review'

export interface ExtractedField<T> {
  value: T
  source: ExtractionSource
  confidence?: number // 0 to 100
}

export interface ExtractedFamilyMember {
  name?: ExtractedField<string>
  nationality?: ExtractedField<string>
  previousNationality?: ExtractedField<string>
  placeOfBirth?: ExtractedField<string>
  countryOfBirth?: ExtractedField<string>
}

export interface ExtractedTravelData {
  duration?: ExtractedField<string>
  visaEntryType?: ExtractedField<string>
  journeyDate?: ExtractedField<string> // YYYY-MM-DD
  intendedArrivalDate?: ExtractedField<string> // YYYY-MM-DD
  entryPoint?: ExtractedField<string>
  exitPoint?: ExtractedField<string>
  purposeOfVisit?: ExtractedField<string>
  countriesVisited?: ExtractedField<string>
  visitedSaarc?: ExtractedField<boolean>
}

export interface ExtractedPreviousVisa {
  hasPreviousVisa?: ExtractedField<boolean>
  visaNumber?: ExtractedField<string>
  visaType?: ExtractedField<string>
  placeOfIssue?: ExtractedField<string>
  dateOfIssue?: ExtractedField<string> // YYYY-MM-DD
  visitedAddress1?: ExtractedField<string>
  visitedAddress2?: ExtractedField<string>
  visitedAddress3?: ExtractedField<string>
  hasRefusal?: ExtractedField<boolean>
  refusalDetails?: ExtractedField<string>
}

export interface ExtractedReference {
  name?: ExtractedField<string>
  addressLine1?: ExtractedField<string>
  addressLine2?: ExtractedField<string>
  phone?: ExtractedField<string>
  email?: ExtractedField<string>
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
    maritalStatus?: ExtractedField<string>
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
  presentAddress?: {
    addressLine1?: ExtractedField<string>
    addressLine2?: ExtractedField<string>
    villageTownCity?: ExtractedField<string>
    district?: ExtractedField<string>
    stateProvince?: ExtractedField<string>
    country?: ExtractedField<string>
    postalCode?: ExtractedField<string>
    phone?: ExtractedField<string>
  }
  permanentAddress?: {
    addressLine1?: ExtractedField<string>
    addressLine2?: ExtractedField<string>
    villageTownCity?: ExtractedField<string>
    district?: ExtractedField<string>
    stateProvince?: ExtractedField<string>
    country?: ExtractedField<string>
    postalCode?: ExtractedField<string>
  }
  family?: {
    father?: ExtractedFamilyMember
    mother?: ExtractedFamilyMember
    spouse?: ExtractedFamilyMember
    hasPakistanRelation?: ExtractedField<boolean>
    pakistanRelationDetails?: ExtractedField<string>
  }
  employment?: {
    presentOccupation?: ExtractedField<string>
    employerName?: ExtractedField<string>
    designationRank?: ExtractedField<string>
    employerAddress?: ExtractedField<string>
    employerPhone?: ExtractedField<string>
    pastOccupation?: ExtractedField<string>
    hasMilitaryService?: ExtractedField<boolean>
    militaryOrganization?: ExtractedField<string>
    militaryDesignation?: ExtractedField<string>
    militaryRank?: ExtractedField<string>
    militaryPlaceOfPosting?: ExtractedField<string>
  }
  travel?: ExtractedTravelData
  previousVisa?: ExtractedPreviousVisa
  sponsorIndia?: ExtractedReference
  sponsorMission?: ExtractedReference
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
