import { dispatchFieldEvents, setNativeInputValue } from './eventDispatcher'
import type { AutofillFieldResult, AutofillPolicy, FieldMapping } from './types'

/**
 * Fills a single resolved DOM HTMLElement safely according to its input type and field policy.
 */
export function fillField(
  element: HTMLElement,
  mapping: FieldMapping,
  value: string,
  policy: AutofillPolicy = 'fill-empty',
  dryRun = false
): AutofillFieldResult {
  const fieldId = mapping.id

  // 1. Check if disabled or readonly
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    if (element.disabled) {
      return { fieldId, status: 'skipped', reason: 'Field is disabled' }
    }
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.readOnly) {
      return { fieldId, status: 'skipped', reason: 'Field is read-only' }
    }
  }

  // 2. Check for Unsupported / Password / File fields
  if (element instanceof HTMLInputElement) {
    const typeLower = element.type.toLowerCase()
    if (typeLower === 'password' || typeLower === 'file' || mapping.inputType === 'file') {
      return { fieldId, status: 'unsupported', reason: 'File and Password inputs are not automated' }
    }
  }

  // 3. Same Value and Policy Check
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'checkbox') {
    const targetChecked = value === 'true' || value === '1'
    if (element.checked === targetChecked) {
      return { fieldId, status: 'already-matching', reason: 'Checkbox state matches source' }
    }
    if (policy === 'fill-empty' && element.checked) {
      return { fieldId, status: 'skipped-existing', reason: 'Checkbox is already checked' }
    }
  } else if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'radio') {
    const radioGroup = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        `input[type="radio"][name="${CSS.escape(element.name)}"]`
      )
    )
    const targetRadio = radioGroup.find(
      (r) => r.value.toLowerCase() === value.toLowerCase() || r.id.toLowerCase() === value.toLowerCase()
    )
    if (targetRadio?.checked) {
      return { fieldId, status: 'already-matching', reason: 'Radio option matches source' }
    }
    if (policy === 'fill-empty' && radioGroup.some((r) => r.checked)) {
      return { fieldId, status: 'skipped-existing', reason: 'Radio group already has a selection' }
    }
  } else if (element instanceof HTMLSelectElement) {
    const valLower = value.trim().toLowerCase()
    let matchedOptionValue: string | null = null
    for (const option of Array.from(element.options)) {
      if (option.value.toLowerCase() === valLower || option.text.trim().toLowerCase() === valLower) {
        matchedOptionValue = option.value
        break
      }
    }
    if (matchedOptionValue === null) {
      for (const option of Array.from(element.options)) {
        const optVal = option.value.trim().toLowerCase()
        const optText = option.text.trim().toLowerCase()
        if (
          optVal.endsWith('-' + valLower) ||
          optVal.endsWith(' ' + valLower) ||
          optText.endsWith('-' + valLower) ||
          optText.endsWith(' ' + valLower) ||
          optText.endsWith('- ' + valLower) ||
          optText.endsWith(' - ' + valLower)
        ) {
          matchedOptionValue = option.value
          break
        }
      }
    }
    if (matchedOptionValue === null) {
      return { fieldId, status: 'failed', reason: 'Matching option could not be found.' }
    }
    if (element.value === matchedOptionValue) {
      return { fieldId, status: 'already-matching', reason: 'Dropdown option matches source' }
    }
    if (policy === 'fill-empty' && element.value.trim() !== '') {
      return { fieldId, status: 'skipped-existing', reason: 'Dropdown already has a selection' }
    }
  } else if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const existingValue = element.value.trim()
    if (existingValue.toLowerCase() === value.trim().toLowerCase()) {
      return { fieldId, status: 'already-matching', reason: 'Text field value matches source' }
    }
    if (policy === 'fill-empty' && existingValue !== '') {
      return { fieldId, status: 'skipped-existing', reason: 'Text field already contains a value' }
    }
  }

  if (dryRun) {
    return { fieldId, status: 'filled', reason: '[Dry Run] Would fill field' }
  }

  // 4. Fill by Element Type
  try {
    if (element instanceof HTMLSelectElement) {
      let matchedValue: string | null = null
      const valLower = value.trim().toLowerCase()

      for (const option of Array.from(element.options)) {
        if (option.value.toLowerCase() === valLower || option.text.trim().toLowerCase() === valLower) {
          matchedValue = option.value
          break
        }
      }

      if (matchedValue === null) {
        for (const option of Array.from(element.options)) {
          const optVal = option.value.trim().toLowerCase()
          const optText = option.text.trim().toLowerCase()
          if (
            optVal.endsWith('-' + valLower) ||
            optVal.endsWith(' ' + valLower) ||
            optText.endsWith('-' + valLower) ||
            optText.endsWith(' ' + valLower) ||
            optText.endsWith('- ' + valLower) ||
            optText.endsWith(' - ' + valLower)
          ) {
            matchedValue = option.value
            break
          }
        }
      }

      if (matchedValue !== null) {
        setNativeInputValue(element, matchedValue)
        return { fieldId, status: 'filled' }
      } else {
        return { fieldId, status: 'not-found', reason: `No matching dropdown option for "${value}"` }
      }
    }

    if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'radio') {
      // Find radio matching name & value
      const radioGroup = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(element.name)}"]`))
      const targetRadio = radioGroup.find(
        (r) => r.value.toLowerCase() === value.toLowerCase() || r.id.toLowerCase() === value.toLowerCase()
      )

      if (targetRadio) {
        targetRadio.checked = true
        dispatchFieldEvents(targetRadio)
        return { fieldId, status: 'filled' }
      }
      return { fieldId, status: 'not-found', reason: `Radio option "${value}" not found` }
    }

    if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'checkbox') {
      const boolVal = value === 'true' || value === '1'
      element.checked = boolVal
      dispatchFieldEvents(element)
      return { fieldId, status: 'filled' }
    }

    // Default: Text, Textarea, Date, Email, Tel
    setNativeInputValue(element, value)
    return { fieldId, status: 'filled' }
  } catch (err) {
    console.error(`Failed to fill field ${fieldId}:`, err)
    return { fieldId, status: 'failed', reason: err instanceof Error ? err.message : 'Fill error' }
  }
}
