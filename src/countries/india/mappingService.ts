import type { IndiaVisaFieldMapping } from './mapping.types'

import { EVISA_MAPPINGS } from './mappings/eVisa'
import { REGULAR_VISA_MAPPINGS } from './mappings/regularVisa'
import type { IndiaVisaFlow, IndiaVisaPage } from './types'

/**
 * Returns strongly typed verified India visa field mappings matching the detected flow and page stage.
 * 
 * Read-only mapping query service. Does NOT execute DOM queries or autofill actions.
 */
export function getIndiaVisaMappings(
  flow: IndiaVisaFlow | null,
  page: IndiaVisaPage | null
): IndiaVisaFieldMapping[] {
  const baseMappings =
    flow === 'regular'
      ? REGULAR_VISA_MAPPINGS
      : flow === 'evisa'
      ? EVISA_MAPPINGS
      : [...REGULAR_VISA_MAPPINGS, ...EVISA_MAPPINGS]

  if (page && page !== 'unknown') {
    const verified = baseMappings.filter((m) => m.status === 'verified')
    if (page === 'application-form') {
      return verified
    }
    return verified.filter((m) => m.page === page)
  }

  return baseMappings
}
