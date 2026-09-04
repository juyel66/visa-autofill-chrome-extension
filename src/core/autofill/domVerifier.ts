import type { FieldMapping } from './types'
import { normalizeDateForControl } from './dateNormalizer'

export interface DomVerificationResult {
  verified: boolean
  actualValue?: string | boolean
  expectedValue?: string | boolean
  reason?: string
}

/**
 * Verifies that the target DOM element actually holds the intended value after
 * setter invocation and event dispatching.
 */
export function verifyDomValue(
  element: HTMLElement,
  mapping: FieldMapping,
  expectedValue: string
): DomVerificationResult {
  if (!element) {
    return {
      verified: false,
      reason: 'Target element is null or undefined.',
    }
  }

  // 1. Checkbox
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'checkbox') {
    const expectedBool =
      expectedValue === 'true' ||
      expectedValue === '1' ||
      expectedValue.toLowerCase() === 'yes'
    const actualBool = element.checked

    return {
      verified: actualBool === expectedBool,
      actualValue: actualBool,
      expectedValue: expectedBool,
      reason:
        actualBool === expectedBool
          ? undefined
          : `Checkbox checked state (${actualBool}) does not match expected (${expectedBool}).`,
    }
  }

  // 2. Radio Button
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'radio') {
    const actualChecked = element.checked
    return {
      verified: actualChecked === true,
      actualValue: actualChecked,
      expectedValue: true,
      reason: actualChecked
        ? undefined
        : `Radio option "${element.value || element.id}" is not checked in DOM.`,
    }
  }

  // 3. Select Dropdown
  if (element instanceof HTMLSelectElement) {
    const selectedIdx = element.selectedIndex
    if (selectedIdx < 0 || selectedIdx >= element.options.length) {
      return {
        verified: false,
        actualValue: '',
        expectedValue,
        reason: 'No dropdown option is selected.',
      }
    }

    const selectedOpt = element.options[selectedIdx]
    const actualVal = element.value
    const actualText = selectedOpt.text.trim()
    const expLower = expectedValue.trim().toLowerCase()

    const matchesVal = actualVal.toLowerCase() === expLower
    const matchesText = actualText.toLowerCase() === expLower
    const matchesPrefixSuffix =
      actualText.toLowerCase().endsWith('- ' + expLower) ||
      actualText.toLowerCase().endsWith(' ' + expLower) ||
      actualText.toLowerCase().startsWith(expLower + ' -')

    const verified = matchesVal || matchesText || matchesPrefixSuffix

    return {
      verified,
      actualValue: actualVal,
      expectedValue,
      reason: verified
        ? undefined
        : `Selected option (${actualVal} / "${actualText}") does not match expected "${expectedValue}".`,
    }
  }

  // 4. Date Input (<input type="date">)
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'date') {
    const expectedIso = normalizeDateForControl(expectedValue, 'date')
    if (!expectedIso) {
      return {
        verified: false,
        actualValue: element.value,
        expectedValue,
        reason: `Could not normalize date "${expectedValue}" to valid ISO date for <input type="date">.`,
      }
    }

    const actualVal = element.value
    const verified = actualVal === expectedIso

    return {
      verified,
      actualValue: actualVal,
      expectedValue: expectedIso,
      reason: verified
        ? undefined
        : `Date input value "${actualVal}" does not match expected ISO date "${expectedIso}".`,
    }
  }

  // 5. Text / Email / Tel / Textarea / Other Text-like Inputs
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const actualVal = element.value.trim()
    let normalizedExpected = expectedValue.trim()

    if (mapping.transform === 'uppercase') {
      normalizedExpected = normalizedExpected.toUpperCase()
    } else if (mapping.transform === 'lowercase') {
      normalizedExpected = normalizedExpected.toLowerCase()
    }

    const verified =
      actualVal.toLowerCase() === normalizedExpected.toLowerCase()

    return {
      verified,
      actualValue: actualVal,
      expectedValue: normalizedExpected,
      reason: verified
        ? undefined
        : `DOM value "${actualVal}" does not match expected "${normalizedExpected}".`,
    }
  }

  return {
    verified: true,
  }
}
