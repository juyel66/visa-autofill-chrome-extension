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

  // 3. Check Policy (fill-empty)
  if (policy === 'fill-empty') {
    let existingValue = ''
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      existingValue = element.value.trim()
    }
    if (existingValue !== '') {
      return { fieldId, status: 'already-filled', reason: 'Field already contains a value' }
    }
  }

  if (dryRun) {
    return { fieldId, status: 'filled', reason: '[Dry Run] Would fill field' }
  }

  // 4. Fill by Element Type
  try {
    if (element instanceof HTMLSelectElement) {
      // Find matching option by value or label text
      let matchedValue: string | null = null
      const valLower = value.toLowerCase()

      for (const option of Array.from(element.options)) {
        if (option.value.toLowerCase() === valLower || option.text.trim().toLowerCase() === valLower) {
          matchedValue = option.value
          break
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
