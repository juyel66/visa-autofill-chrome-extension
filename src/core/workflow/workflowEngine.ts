import type { FieldMapping } from '../autofill/types'
import { resolveElement } from '../autofill/selectorResolver'

/**
 * Verifies whether target DOM form elements for the given field mappings are rendered in the DOM.
 * Returns true if at least one verified required or major mapped element is resolved.
 */
export function isFormReady(mappings: FieldMapping[]): boolean {
  if (!mappings || mappings.length === 0 || typeof document === 'undefined') {
    return false
  }

  const verifiedMappings = mappings.filter((m) => m.status === 'verified')
  if (verifiedMappings.length === 0) return false

  let resolvedCount = 0
  for (const m of verifiedMappings) {
    if (m.selector) {
      const el = resolveElement(m.selector)
      if (el) {
        resolvedCount++
      }
    }
  }

  // Form is considered ready if at least 1 verified target element is found
  return resolvedCount > 0
}
