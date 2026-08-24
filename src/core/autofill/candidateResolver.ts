import type { ApplicantProfile } from '../applicant/types'
import type { DocumentRecord } from '../document/types'
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
  notes?: string
}

/**
 * Resolves PDF-extracted candidate data for autofill execution.
 * 
 * Rules:
 * 1. Applicant Profile is ONLY an identifier container (`profileId`).
 * 2. Confirmed PDF candidate data is the sole source of truth for personal identity fields.
 * 3. NO fallback to pre-existing profile personal data.
 * 4. Strictly validates document-to-profile association (rejects cross-profile data).
 * 5. Requires `extractedDataConfirmed === true` (CONFIRMED status gate).
 * 6. Prefers confirmed 'passport' documents for passport/personal autofill fields.
 * 7. Attaches internal provenance metadata (`profileId`, `documentId`, `sourceType: 'confirmed-document'`).
 */
export function resolveCandidateData(
  options: CandidateDataResolverOptions
): CandidateDataResolutionResult {
  const { profileId, requestedDocumentId, preferredDocumentType = 'passport', documents, notes } = options

  if (!profileId) {
    return {
      status: 'NOT_READY',
      reason: 'Applicant profileId is required for candidate data resolution.',
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

    // Check wrong document category if preferred type specified (e.g. photograph passed for passport fields)
    if (preferredDocumentType && rawDoc.documentType !== preferredDocumentType) {
      return {
        status: 'COMPATIBLE_DOCUMENT_REQUIRED',
        reason: `Document type "${rawDoc.documentType}" is not compatible with preferred document type "${preferredDocumentType}".`,
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

  // 2. No explicit documentId passed: find matching confirmed passport document
  if (profileDocs.length === 0) {
    return {
      status: 'MANUAL_REQUIRED',
      reason: 'No documents associated with this profile.',
    }
  }

  const confirmedPassportDoc = profileDocs.find(
    (d) => d.documentType === preferredDocumentType && d.extractedDataConfirmed && d.extractedData
  )

  if (confirmedPassportDoc) {
    const baseProfile: ApplicantProfile = {
      applicantId: profileId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes,
    }

    const resolvedProfile = applyExtractionToApplicant(baseProfile, confirmedPassportDoc.extractedData!)

    return {
      status: 'READY',
      provenance: {
        profileId,
        documentId: confirmedPassportDoc.documentId,
        sourceType: 'confirmed-document',
        documentType: confirmedPassportDoc.documentType,
        extractedAt: confirmedPassportDoc.updatedAt,
      },
      applicant: resolvedProfile,
    }
  }

  // Check if unconfirmed passport document exists
  const unconfirmedPassportDoc = profileDocs.find((d) => d.documentType === preferredDocumentType)
  if (unconfirmedPassportDoc) {
    return {
      status: 'REVIEW_REQUIRED',
      reason: 'Review extracted document data first.',
    }
  }

  // Check if unconfirmed or wrong category documents exist
  const confirmedAnyDoc = profileDocs.find((d) => d.extractedDataConfirmed && d.extractedData)
  if (!confirmedAnyDoc) {
    const unconfirmedAnyDoc = profileDocs.find((d) => d.extractedData)
    if (unconfirmedAnyDoc) {
      return {
        status: 'REVIEW_REQUIRED',
        reason: 'Review extracted document data first.',
      }
    }
    return {
      status: 'MANUAL_REQUIRED',
      reason: 'No extracted document data available for this profile.',
    }
  }

  // Confirmed document exists but wrong type (e.g. photograph only)
  return {
    status: 'COMPATIBLE_DOCUMENT_REQUIRED',
    reason: `Found confirmed document of type "${confirmedAnyDoc.documentType}", but compatible "${preferredDocumentType}" document is required.`,
  }
}
