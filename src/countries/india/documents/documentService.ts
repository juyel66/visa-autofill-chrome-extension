import type { DocumentRequirement } from '../../../core/document/requirement.types'

import type { IndiaVisaFlow, IndiaVisaPage } from '../types'
import { INDIA_EVISA_DOCUMENT_REQUIREMENTS, INDIA_REGULAR_DOCUMENT_REQUIREMENTS } from './requirements'

import { arePagesEquivalent } from '../canonicalPages'

/**
 * Returns strongly typed verified India document requirements matching the detected flow and page.
 */
export function getIndiaDocumentRequirements(
  flow: IndiaVisaFlow | null,
  page: IndiaVisaPage | null
): DocumentRequirement[] {
  // Only return document requirements on document upload pages or generic application form stages
  if (
    arePagesEquivalent(page, 'DOCUMENT_UPLOAD') ||
    arePagesEquivalent(page, 'DOCUMENT_REUPLOAD') ||
    arePagesEquivalent(page, 'APPLICATION_FORM') ||
    arePagesEquivalent(page, 'REGISTRATION')
  ) {
    if (flow === 'regular') return INDIA_REGULAR_DOCUMENT_REQUIREMENTS
    if (flow === 'evisa') return INDIA_EVISA_DOCUMENT_REQUIREMENTS
    return [...INDIA_REGULAR_DOCUMENT_REQUIREMENTS, ...INDIA_EVISA_DOCUMENT_REQUIREMENTS]
  }

  return []
}
