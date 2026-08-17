import { dispatchFieldEvents, setNativeInputValue } from '../autofill/eventDispatcher'
import { resolveElement } from '../autofill/selectorResolver'
import type { AutofillOperation, FieldState, UndoFieldResult, UndoResult } from './types'

/**
 * Captures the current in-memory field state (value and checked status) of a target DOM element.
 */
export function captureFieldState(element: HTMLElement): FieldState {
  if (element instanceof HTMLInputElement) {
    const typeLower = element.type.toLowerCase()
    if (typeLower === 'checkbox' || typeLower === 'radio') {
      return {
        value: element.value,
        checked: element.checked,
      }
    }
    return { value: element.value }
  }

  if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    return { value: element.value }
  }

  return { value: element.textContent?.trim() || '' }
}

/**
 * Restores previous field states recorded during an autofill operation.
 * Skips fields that have been manually modified by the user after autofill execution.
 */
export async function executeUndo(operation: AutofillOperation): Promise<UndoResult> {
  const operationId = operation.operationId
  const fieldResults: UndoFieldResult[] = []

  let restoredCount = 0
  let skippedCount = 0
  let notFoundCount = 0
  let failedCount = 0

  for (const change of operation.changes) {
    const fieldId = change.fieldId

    if (!change.targetSelector) {
      fieldResults.push({ fieldId, status: 'not-found', reason: 'Missing field selector' })
      notFoundCount++
      continue
    }

    const element = resolveElement(change.targetSelector)
    if (!element) {
      fieldResults.push({ fieldId, status: 'not-found', reason: 'Field element not found on page' })
      notFoundCount++
      continue
    }

    const currentState = captureFieldState(element)

    // USER-MODIFIED CHECK: If the current DOM value differs from what Visa Autofill populated,
    // the user manually edited the field after autofill -> SKIP RESTORING TO PRESERVE USER EDITS.
    const isValueChanged = currentState.value !== change.newState.value
    const isCheckChanged =
      typeof change.newState.checked !== 'undefined' && currentState.checked !== change.newState.checked

    if (isValueChanged || isCheckChanged) {
      fieldResults.push({
        fieldId,
        status: 'user-modified',
        reason: 'Skipped restoring because field was manually edited after autofill.',
      })
      skippedCount++
      continue
    }

    // Restore previous state
    try {
      if (element instanceof HTMLInputElement && (element.type.toLowerCase() === 'checkbox' || element.type.toLowerCase() === 'radio')) {
        element.checked = !!change.previousState.checked
        dispatchFieldEvents(element)
      } else if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
        setNativeInputValue(element, change.previousState.value)
      } else {
        element.textContent = change.previousState.value
      }

      fieldResults.push({ fieldId, status: 'restored' })
      restoredCount++
    } catch (err) {
      fieldResults.push({
        fieldId,
        status: 'failed',
        reason: err instanceof Error ? err.message : 'Undo failed',
      })
      failedCount++
    }
  }

  return {
    operationId,
    restored: restoredCount,
    skipped: skippedCount,
    notFound: notFoundCount,
    failed: failedCount,
    fields: fieldResults,
  }
}
