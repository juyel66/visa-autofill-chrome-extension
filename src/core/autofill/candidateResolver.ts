import type { ApplicantProfile } from '../applicant/types'
import type { DocumentRecord } from '../document/types'
import type { SavedApplication } from '../application/types'
import { convertSavedApplicationToApplicantProfile } from '../application/applicationMerger'
import { applyExtractionToApplicant } from '../extraction/data/extractionMapper'

export type CandidateDataResolutionStatus =
  | 'READY'
  | 'REVIEW_REQUIRED'
  | 'NOT_READY'
  | 'COMPATIBLE_DOCUMENT_REQUIRED'
  | 'MANUAL_REQUIRED'

export interface CandidateDataProvenance {
  profileId: string
  documentId: string
  sourceType: 'confirmed-document'
  documentType: string
  extractedAt?: string
}

export interface CandidateDataResolutionResult {
  status: CandidateDataResolutionStatus
  provenance?: CandidateDataProvenance
  applicant?: ApplicantProfile
  reason?: string
}

export interface CandidateDataResolverOptions {
  profileId: string
  requestedDocumentId?: string
  preferredDocumentType?: string
  documents: DocumentRecord[]
  savedApplication?: SavedApplication | null
  notes?: string
}

/**
 * Resolves candidate data for autofill execution from SavedApplication or confirmed documents.
 * 
 * Rules:
 * 1. Applicant Profile is ONLY an identifier container (`profileId`).
 * 2. SavedApplication (with user manual edits and document provenance) takes highest priority.
 * 3. Confirmed PDF candidate data is the base source of truth for personal identity fields.
 * 4. NO fallback to pre-existing profile personal data.
 * 5. Strictly validates document-to-profile association (rejects cross-profile data).
 * 6. Requires `extractedDataConfirmed === true` (CONFIRMED status gate).
 * 7. Prefers confirmed 'passport' documents for passport/personal autofill fields.
 * 8. Attaches internal provenance metadata (`profileId`, `documentId`, `sourceType: 'confirmed-document'`).
 */
export function resolveCandidateData(
  options: CandidateDataResolverOptions
): CandidateDataResolutionResult {
  const { profileId, requestedDocumentId, preferredDocumentType = 'passport', documents, savedApplication, notes } = options

  if (!profileId) {
    return {
      status: 'NOT_READY',
      reason: 'Applicant profileId is required for candidate data resolution.',
    }
  }

  // 1. Highest Priority: SavedApplication for this profile (contains confirmed extractions + user edits)
  if (savedApplication && savedApplication.applicantId === profileId) {
    const baseProfile: ApplicantProfile = {
      applicantId: profileId,
      createdAt: savedApplication.createdAt || new Date().toISOString(),
      updatedAt: savedApplication.updatedAt || new Date().toISOString(),
      notes,
    }
    const profile = convertSavedApplicationToApplicantProfile(savedApplication, baseProfile)
    return {
      status: 'READY',
      provenance: {
        profileId,
        documentId: savedApplication.provenance?.passportDocumentId || savedApplication.applicationId,
        sourceType: 'confirmed-document',
        documentType: 'saved-application',
        extractedAt: savedApplication.updatedAt,
      },
      applicant: profile,
    }
  }

  const profileDocs = documents.filter((d) => d.applicantId === profileId)

  // 1. If explicit document requested, validate document association & profile isolation
  if (requestedDocumentId) {
    const rawDoc = documents.find((d) => d.documentId === requestedDocumentId)
    if (!rawDoc) {
      return {
        status: 'NOT_READY',
        reason: `Requested documentId "${requestedDocumentId}" was not found.`,
      }
    }

    if (rawDoc.applicantId !== profileId) {
      return {
        status: 'NOT_READY',
        reason: `Document "${requestedDocumentId}" belongs to profile "${rawDoc.applicantId}", not requested profile "${profileId}". Candidate data from another profile is rejected.`,
      }
    }

    // Check wrong document category if preferred type explicitly specified (e.g. photograph passed for passport fields)
    if (options.preferredDocumentType && rawDoc.documentType !== options.preferredDocumentType) {
      return {
        status: 'COMPATIBLE_DOCUMENT_REQUIRED',
        reason: `Document type "${rawDoc.documentType}" is not compatible with preferred document type "${options.preferredDocumentType}".`,
      }
    }

    if (!rawDoc.extractedDataConfirmed || !rawDoc.extractedData) {
      return {
        status: 'REVIEW_REQUIRED',
        reason: 'Review extracted document data first.',
      }
    }

    const baseProfile: ApplicantProfile = {
      applicantId: profileId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes,
    }

    const resolvedProfile = applyExtractionToApplicant(baseProfile, rawDoc.extractedData)

    return {
      status: 'READY',
      provenance: {
        profileId,
        documentId: rawDoc.documentId,
        sourceType: 'confirmed-document',
        documentType: rawDoc.documentType,
        extractedAt: rawDoc.updatedAt,
      },
      applicant: resolvedProfile,
    }
  }

  // 2. No explicit documentId passed: find matching confirmed document
  if (profileDocs.length === 0) {
    return {
      status: 'MANUAL_REQUIRED',
      reason: 'No documents associated with this profile.',
    }
  }

  // A. Prefer confirmed document matching preferredDocumentType (e.g., passport)
  const confirmedPreferredDoc = profileDocs.find(
    (d) => d.documentType === preferredDocumentType && d.extractedDataConfirmed && d.extractedData
  )

  if (confirmedPreferredDoc) {
    const baseProfile: ApplicantProfile = {
      applicantId: profileId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes,
    }

    const resolvedProfile = applyExtractionToApplicant(baseProfile, confirmedPreferredDoc.extractedData!)

    return {
      status: 'READY',
      provenance: {
        profileId,
        documentId: confirmedPreferredDoc.documentId,
        sourceType: 'confirmed-document',
        documentType: confirmedPreferredDoc.documentType,
        extractedAt: confirmedPreferredDoc.updatedAt,
      },
      applicant: resolvedProfile,
    }
  }

  // B. Fallback to any other confirmed non-photo document that has confirmed extracted data
  const confirmedOtherDoc = profileDocs.find(
    (d) => d.documentType !== 'photograph' && d.extractedDataConfirmed && d.extractedData
  )

  if (confirmedOtherDoc) {
    const baseProfile: ApplicantProfile = {
      applicantId: profileId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes,
    }

    const resolvedProfile = applyExtractionToApplicant(baseProfile, confirmedOtherDoc.extractedData!)

    return {
      status: 'READY',
      provenance: {
        profileId,
        documentId: confirmedOtherDoc.documentId,
        sourceType: 'confirmed-document',
        documentType: confirmedOtherDoc.documentType,
        extractedAt: confirmedOtherDoc.updatedAt,
      },
      applicant: resolvedProfile,
    }
  }

  // C. Check if unconfirmed documents with extraction exist
  const unconfirmedDoc = profileDocs.find(
    (d) => (d.documentType === preferredDocumentType || d.documentType !== 'photograph') && (d.extractedData || !d.extractedDataConfirmed)
  )
  if (unconfirmedDoc && (unconfirmedDoc.extractedData || unconfirmedDoc.documentType === preferredDocumentType)) {
    return {
      status: 'REVIEW_REQUIRED',
      reason: 'Review extracted document data first.',
    }
  }

  // D. Check if confirmed photograph exists without form data
  const confirmedPhotoDoc = profileDocs.find((d) => d.extractedDataConfirmed && d.extractedData)
  if (confirmedPhotoDoc) {
    return {
      status: 'COMPATIBLE_DOCUMENT_REQUIRED',
      reason: `Found confirmed document of type "${confirmedPhotoDoc.documentType}", but compatible "${preferredDocumentType}" document is required.`,
    }
  }

  return {
    status: 'MANUAL_REQUIRED',
    reason: 'No extracted document data available for this profile.',
  }
}
