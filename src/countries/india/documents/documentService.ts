import type { DocumentRequirement } from '../../../core/document/requirement.types'

import type { IndiaVisaFlow, IndiaVisaPage } from '../types'
import { INDIA_EVISA_DOCUMENT_REQUIREMENTS, INDIA_REGULAR_DOCUMENT_REQUIREMENTS } from './requirements'

/**
 * Returns strongly typed verified India document requirements matching the detected flow and page.
 */
export function getIndiaDocumentRequirements(
  flow: IndiaVisaFlow | null,
  page: IndiaVisaPage | null
): DocumentRequirement[] {
  // Only return document requirements on document upload pages or generic application form stages
  if (page === 'document-reupload' || page === 'application-form' || page === 'application-start') {
    if (flow === 'regular') return INDIA_REGULAR_DOCUMENT_REQUIREMENTS
    if (flow === 'evisa') return INDIA_EVISA_DOCUMENT_REQUIREMENTS
    return [...INDIA_REGULAR_DOCUMENT_REQUIREMENTS, ...INDIA_EVISA_DOCUMENT_REQUIREMENTS]
  }

  return []
}
