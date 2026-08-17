import type { DocumentRequirement } from './requirement.types'
import type { DocumentRecord } from './types'

/**
 * Filters an applicant's stored documents matching the requirements (category, accepted MIME types, file size).
 */
export function matchDocumentsForRequirement(
  requirement: DocumentRequirement,
  applicantDocs: DocumentRecord[]
): DocumentRecord[] {
  if (!requirement || !applicantDocs || applicantDocs.length === 0) {
    return []
  }

  return applicantDocs.filter((doc) => {
    // 1. Check Document Type Category
    if (doc.documentType !== requirement.documentType && doc.documentType !== 'other') {
      return false
    }

    // 2. Check MIME Type if specified
    if (requirement.acceptedMimeTypes && requirement.acceptedMimeTypes.length > 0) {
      const mimeMatches = requirement.acceptedMimeTypes.some(
        (m) => doc.mimeType.toLowerCase() === m.toLowerCase()
      )
      if (!mimeMatches) return false
    }

    // 3. Check File Size Limit if specified
    if (requirement.maxFileSizeBytes && doc.fileSize > requirement.maxFileSizeBytes) {
      return false
    }

    return true
  })
}
