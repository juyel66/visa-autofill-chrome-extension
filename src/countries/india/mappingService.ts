import type { IndiaVisaFieldMapping } from './mapping.types'
import { EVISA_MAPPINGS } from './mappings/eVisa'
import { REGULAR_VISA_MAPPINGS } from './mappings/regularVisa'
import { BANGLADESH_VISA_MAPPINGS } from './mappings/bangladeshVisa'
import { arePagesEquivalent, normalizePageIdentity } from './canonicalPages'
import type { IndiaVisaFlow, IndiaVisaPage } from './types'

/**
 * Returns strongly typed India visa field mappings matching the detected flow, page stage, and domain.
 * 
 * 
 * Read-only mapping query service. Does NOT execute DOM queries or autofill actions.
 */
export function getIndiaVisaMappings(
  flow: IndiaVisaFlow | null,
  page: IndiaVisaPage | null,
  domain?: string | null
): IndiaVisaFieldMapping[] {
  const effectiveDomain =
    domain || (typeof window !== 'undefined' ? window.location.hostname : '')
  const isBangladesh = Boolean(
    effectiveDomain &&
      effectiveDomain.toLowerCase().includes('indianvisa-bangladesh.nic.in')
  )

  const baseMappings = isBangladesh
    ? BANGLADESH_VISA_MAPPINGS
    : flow === 'regular'
    ? REGULAR_VISA_MAPPINGS
    : flow === 'evisa'
    ? EVISA_MAPPINGS
    : [...REGULAR_VISA_MAPPINGS, ...EVISA_MAPPINGS]

  if (page && page !== 'unknown' && page !== 'UNKNOWN') {
    const canonicalPage = normalizePageIdentity(page)
    const candidates = isBangladesh
      ? baseMappings
      : baseMappings.filter((m) => m.status === 'verified')

    if (canonicalPage === 'APPLICATION_FORM') {
      return candidates
    }
    return candidates.filter((m) => m.page && arePagesEquivalent(m.page, canonicalPage))
  }

  return baseMappings
}
