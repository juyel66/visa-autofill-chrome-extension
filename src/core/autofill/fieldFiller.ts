import { dispatchFieldEvents, setNativeInputValue } from './eventDispatcher'
import { verifyDomValue } from './domVerifier'
import { normalizeDateForControl } from './dateNormalizer'
import { findMatchingSelectOption, selectOptionAndDispatchEvents } from './selectResolver'
import type { AutofillFieldResult, AutofillPolicy, FieldMapping } from './types'

export { findMatchingSelectOption, selectOptionAndDispatchEvents } from './selectResolver'

function safeCssEscape(val: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(val)
  }
  return val.replace(/([#;?%&,.+*~':"!^$[\]()=>|/\\@])/g, '\\$1')
}

/**
 * Fills a single resolved DOM HTMLElement safely according to its input type and field policy.
 * Only returns status 'filled' after strict DOM-level value verification.
 */
export function fillField(
  element: HTMLElement,
  mapping: FieldMapping,
  value: string | undefined | null,
  policy: AutofillPolicy = 'fill-empty',
  dryRun = false
): AutofillFieldResult {
  const fieldId = mapping.id

  // 1. Guard against Disabled / Readonly
  if (
    (typeof HTMLInputElement !== 'undefined' && element instanceof HTMLInputElement) ||
    (typeof HTMLSelectElement !== 'undefined' && element instanceof HTMLSelectElement) ||
    (typeof HTMLTextAreaElement !== 'undefined' && element instanceof HTMLTextAreaElement) ||
    (typeof HTMLButtonElement !== 'undefined' && element instanceof HTMLButtonElement)
  ) {
    if (element.disabled) {
      return {
        fieldId,
        status: 'failed',
        failureType: 'disabled-field',
        reason: 'Manual action is required: field is disabled.',
      }
    }
  }

  if (
    (typeof HTMLInputElement !== 'undefined' && element instanceof HTMLInputElement) ||
    (typeof HTMLTextAreaElement !== 'undefined' && element instanceof HTMLTextAreaElement)
  ) {
    if (element.readOnly) {
      return {
        fieldId,
        status: 'failed',
        failureType: 'readonly-field',
        reason: 'Manual action is required: field is read-only.',
      }
    }
  }

  // 2. Check for Unsupported / Password / File fields
  if (typeof HTMLInputElement !== 'undefined' && element instanceof HTMLInputElement) {
    const typeLower = element.type.toLowerCase()
    if (typeLower === 'password' || typeLower === 'file' || mapping.inputType === 'file') {
      return {
        fieldId,
        status: 'unsupported',
        failureType: 'unsupported-field',
        reason: 'File and Password inputs are not automated.',
      }
    }
  }

  // 3. Source value validation (Do NOT clear or mutate existing website value if source data is missing)
  if (value === undefined || value === null || value === '') {
    if (mapping.required) {
      return {
        fieldId,
        status: 'failed',
        failureType: 'source-data-missing',
        reason: 'Required source field is missing from confirmed document data.',
      }
    }
    return {
      fieldId,
      status: 'skipped',
      reason: 'Source value is not present for optional field.',
    }
  }

  const strValue = String(value)

  // 4. Same Value & Policy Checks (fill-empty vs overwrite)
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'checkbox') {
    const targetChecked = strValue === 'true' || strValue === '1' || strValue.toLowerCase() === 'yes'
    if (element.checked === targetChecked) {
      return { fieldId, status: 'already-matching', failureType: 'already-matching', reason: 'Checkbox state matches source' }
    }
    if (policy === 'fill-empty' && element.checked) {
      return { fieldId, status: 'skipped-existing', failureType: 'skipped-existing', reason: 'Checkbox is already checked' }
    }
  } else if (
    (element instanceof HTMLInputElement || element.tagName === 'INPUT') &&
    ((element as HTMLInputElement).type || '').toLowerCase() === 'radio'
  ) {
    const radioGroup = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        `input[type="radio"][name="${safeCssEscape((element as HTMLInputElement).name)}"]`
      )
    )
    const isTrue = strValue.toLowerCase() === 'true' || strValue.toLowerCase() === 'yes' || strValue === '1' || strValue.toLowerCase() === 'y'
    const isFalse = strValue.toLowerCase() === 'false' || strValue.toLowerCase() === 'no' || strValue === '0' || strValue.toLowerCase() === 'n'
    const targetRadio = radioGroup.find((r) => {
      const rVal = r.value.toLowerCase()
      const rId = r.id.toLowerCase()
      if (rVal === strValue.toLowerCase() || rId === strValue.toLowerCase()) return true
      if (isTrue) {
        if (rVal === 'y' || rVal === 'yes' || rVal === '1' || rVal === 'true') return true
        if (rId.includes('yes') || rId.endsWith('_yes')) return true
        if (!rId.includes('no') && (rId.endsWith('flag1') || rId.endsWith('_1') || /(?:flag|org|ppt|visa)1$/.test(rId))) return true
      }
      if (isFalse) {
        if (rVal === 'n' || rVal === 'no' || rVal === '0' || rVal === 'false') return true
        if (rId.includes('no') || rId.endsWith('_no')) return true
        if (!rId.includes('yes') && (rId.endsWith('flag2') || rId.endsWith('_2') || /(?:flag|org|ppt|visa)2$/.test(rId))) return true
      }
      return false
    })
    if (targetRadio?.checked) {
      return { fieldId, status: 'already-matching', failureType: 'already-matching', reason: 'Radio option matches source' }
    }
    if (policy === 'fill-empty' && radioGroup.some((r) => r.checked)) {
      return { fieldId, status: 'skipped-existing', failureType: 'skipped-existing', reason: 'Radio group already has a selection' }
    }
  } else if (element instanceof HTMLSelectElement || element.tagName === 'SELECT') {
    const sel = element as HTMLSelectElement
    const { option: matchedOption, ambiguous } = findMatchingSelectOption(sel, strValue)

    if (ambiguous) {
      return { fieldId, status: 'failed', failureType: 'ambiguous-target', reason: 'Ambiguous select choices' }
    }

    if (!matchedOption) {
      return { fieldId, status: 'failed', failureType: 'option-not-found', reason: `No matching dropdown option for "${strValue}"` }
    }

    if (sel.value === matchedOption.value) {
      return { fieldId, status: 'already-matching', failureType: 'already-matching', reason: 'Dropdown option matches source' }
    }

    if (policy === 'fill-empty' && sel.value.trim() !== '') {
      return { fieldId, status: 'skipped-existing', failureType: 'skipped-existing', reason: 'Dropdown already has a selection' }
    }
  } else if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const existingValue = element.value.trim()
    if (existingValue.toLowerCase() === strValue.trim().toLowerCase()) {
      return { fieldId, status: 'already-matching', failureType: 'already-matching', reason: 'Text field value matches source' }
    }
    if (policy === 'fill-empty' && existingValue !== '') {
      return { fieldId, status: 'skipped-existing', failureType: 'skipped-existing', reason: 'Text field already contains a value' }
    }
  }

  if (dryRun) {
    return { fieldId, status: 'filled', reason: '[Dry Run] Would fill field' }
  }

  // 5. Fill by Element Type & Perform Strict Post-Fill DOM Verification
  try {
    // A. Select dropdown
    if (element instanceof HTMLSelectElement || element.tagName === 'SELECT') {
      const sel = element as HTMLSelectElement
      const { option: matchedOption, ambiguous } = findMatchingSelectOption(sel, strValue)

      if (ambiguous) {
        return { fieldId, status: 'failed', failureType: 'ambiguous-target', reason: 'Ambiguous select choices' }
      }

      if (!matchedOption) {
        return { fieldId, status: 'failed', failureType: 'option-not-found', reason: `No matching dropdown option for "${strValue}"` }
      }

      selectOptionAndDispatchEvents(sel, matchedOption)

      // Post-fill verification
      const verifyRes = verifyDomValue(sel, mapping, matchedOption.value)
      if (!verifyRes.verified) {
        return {
          fieldId,
          status: 'failed',
          failureType: 'value-verification-failed',
          reason: verifyRes.reason || 'DOM value verification failed for select dropdown.',
        }
      }

      return { fieldId, status: 'filled' }
    }


    // B. Radio buttons
    if (
      (element instanceof HTMLInputElement || element.tagName === 'INPUT') &&
      ((element as HTMLInputElement).type || '').toLowerCase() === 'radio'
    ) {
      const radioElementsSet = new Set<HTMLInputElement>()
      if (element instanceof HTMLInputElement) {
        radioElementsSet.add(element)
      }

      const elName = (element as HTMLInputElement).name
      if (elName) {
        document.querySelectorAll<HTMLInputElement>(
          `input[type="radio"][name="${safeCssEscape(elName)}"]`
        ).forEach((r) => radioElementsSet.add(r))

        const rawName = elName.replace(/^appl\./, '')
        document.querySelectorAll<HTMLInputElement>(
          `input[type="radio"][name="${safeCssEscape(rawName)}"], input[type="radio"][name="appl.${safeCssEscape(rawName)}"]`
        ).forEach((r) => radioElementsSet.add(r))
      }

      // Specific known radio patterns on Indian visa portals
      if (
        mapping.targetField === 'grandparent_flag' ||
        mapping.sourceField === 'family.hasPakistanRelation' ||
        mapping.id.includes('grandparent')
      ) {
        document.querySelectorAll<HTMLInputElement>(
          '#grandparent_flag1, #grandparent_flag2, input[name="appl.grandparent_flag"], input[name="grandparent_flag"]'
        ).forEach((r) => radioElementsSet.add(r))
      }

      if (
        mapping.targetField === 'prev_org' ||
        mapping.sourceField === 'employment.hasMilitaryService' ||
        mapping.id.includes('prev_org')
      ) {
        document.querySelectorAll<HTMLInputElement>(
          '#prev_org1, #prev_org2, input[name="appl.prev_org"], input[name="prev_org"]'
        ).forEach((r) => radioElementsSet.add(r))
      }

      if (element.id) {
        const baseId = element.id.replace(/(?:_?flag)?[12]$|_yes$|_no$/i, '')
        if (baseId) {
          document.querySelectorAll<HTMLInputElement>(
            `input[type="radio"][id^="${safeCssEscape(baseId)}"], input[type="radio"][id*="${safeCssEscape(baseId)}"]`
          ).forEach((r) => radioElementsSet.add(r))
        }
      }

      const radioGroup = Array.from(radioElementsSet)
      const isTrue = strValue.toLowerCase() === 'true' || strValue.toLowerCase() === 'yes' || strValue === '1' || strValue.toLowerCase() === 'y'
      const isFalse = strValue.toLowerCase() === 'false' || strValue.toLowerCase() === 'no' || strValue === '0' || strValue.toLowerCase() === 'n'
      const matchingRadios = radioGroup.filter((r) => {
        const rVal = (r.value || '').toLowerCase()
        const rId = (r.id || '').toLowerCase()
        if (rVal === strValue.toLowerCase() || rId === strValue.toLowerCase()) return true
        if (isTrue) {
          if (rVal === 'y' || rVal === 'yes' || rVal === '1' || rVal === 'true') return true
          if (rId.includes('yes') || rId.endsWith('_yes')) return true
          if (!rId.includes('no') && (rId.endsWith('flag1') || rId.endsWith('_1') || /(?:flag|org|ppt|visa)1$/.test(rId))) return true
        }
        if (isFalse) {
          if (rVal === 'n' || rVal === 'no' || rVal === '0' || rVal === 'false') return true
          if (rId.includes('no') || rId.endsWith('_no')) return true
          if (!rId.includes('yes') && (rId.endsWith('flag2') || rId.endsWith('_2') || /(?:flag|org|ppt|visa)2$/.test(rId))) return true
        }
        return false
      })

      if (matchingRadios.length === 0) {
        return { fieldId, status: 'failed', failureType: 'option-not-found', reason: `Radio option "${strValue}" not found` }
      }

      let targetRadio: HTMLInputElement = matchingRadios[0]
      if (matchingRadios.length > 1) {
        targetRadio = matchingRadios.find((r) => {
          const rVal = (r.value || '').toLowerCase()
          const rId = (r.id || '').toLowerCase()
          if (isFalse) {
            return rVal === 'n' || rVal === 'no' || rId.endsWith('2') || rId.includes('no')
          }
          if (isTrue) {
            return rVal === 'y' || rVal === 'yes' || rId.endsWith('1') || rId.includes('yes')
          }
          return false
        }) || matchingRadios[0]
      }

      targetRadio.checked = true
      dispatchFieldEvents(targetRadio)

      const verifyRes = verifyDomValue(targetRadio, mapping, strValue)
      if (!verifyRes.verified) {
        return {
          fieldId,
          status: 'failed',
          failureType: 'value-verification-failed',
          reason: verifyRes.reason || 'DOM value verification failed for radio option.',
        }
      }

      return { fieldId, status: 'filled' }
    }

    // C. Checkbox
    if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'checkbox') {
      const boolVal = strValue === 'true' || strValue === '1' || strValue.toLowerCase() === 'yes'
      element.checked = boolVal
      dispatchFieldEvents(element)

      const verifyRes = verifyDomValue(element, mapping, strValue)
      if (!verifyRes.verified) {
        return {
          fieldId,
          status: 'failed',
          failureType: 'value-verification-failed',
          reason: verifyRes.reason || 'DOM value verification failed for checkbox.',
        }
      }

      return { fieldId, status: 'filled' }
    }

    // D. Date Input (<input type="date">)
    if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'date') {
      const normalizedIso = normalizeDateForControl(strValue, 'date')
      if (!normalizedIso) {
        return {
          fieldId,
          status: 'failed',
          failureType: 'value-verification-failed',
          reason: `Invalid date format "${strValue}". Could not normalize to YYYY-MM-DD.`,
        }
      }

      setNativeInputValue(element, normalizedIso)

      const verifyRes = verifyDomValue(element, mapping, normalizedIso)
      if (!verifyRes.verified) {
        return {
          fieldId,
          status: 'failed',
          failureType: 'value-verification-failed',
          reason: verifyRes.reason || 'DOM value verification failed for date input.',
        }
      }

      return { fieldId, status: 'filled' }
    }

    // E. Text, Textarea, Email, Tel
    let valueToSet = strValue
    if (mapping.inputType === 'date' && !(element instanceof HTMLInputElement && element.type.toLowerCase() === 'date')) {
      const dateNormalized = normalizeDateForControl(strValue, 'text', mapping.transform)
      if (dateNormalized) {
        valueToSet = dateNormalized
      }
    }

    setNativeInputValue(element, valueToSet)

    const verifyRes = verifyDomValue(element, mapping, valueToSet)
    if (!verifyRes.verified) {
      return {
        fieldId,
        status: 'failed',
        failureType: 'value-verification-failed',
        reason: verifyRes.reason || 'DOM value verification failed for text input.',
      }
    }

    return { fieldId, status: 'filled' }
  } catch (err) {
    console.error(`Failed to fill field ${fieldId}:`, err)
    return {
      fieldId,
      status: 'failed',
      failureType: 'unknown-error',
      reason: err instanceof Error ? err.message : 'Fill error',
    }
  }
}
