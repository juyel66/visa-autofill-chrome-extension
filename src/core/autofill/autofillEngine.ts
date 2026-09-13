import type { AutofillChange, AutofillOperation } from '../safety/types'
import { captureFieldState } from '../safety/undoManager'
import { fillField } from './fieldFiller'
import { resolveElements } from './selectorResolver'
import { waitForSelectReadiness } from './selectResolver'
import type {
  AutofillFieldResult,
  AutofillFieldStatus,
  AutofillRequest,
  AutofillResult,
  FailureCategory,
  FailureSeverity,
  FieldMapping,
} from './types'
import { resolveApplicantValue } from './valueResolver'
import { applyValueTransform } from './transformRegistry'
import { validateApplicant } from '../validation/applicantValidation'

export function getFailureSeverity(category: FailureCategory): FailureSeverity {
  switch (category) {
    case 'field-not-found':
    case 'selector-failed':
    case 'stale-element':
    case 'attachment-failed':
    case 'option-not-found':
      return 'recoverable'

    case 'unsupported-field':
    case 'skipped-existing':
    case 'already-matching':
      return 'skippable'

    case 'manual-required':
    case 'readonly-field':
    case 'disabled-field':
    case 'ambiguous-target':
    case 'mapping-mismatch':
    case 'source-data-missing':
      return 'manual-required'

    case 'value-verification-failed':
    case 'page-not-recognized':
    case 'validation-failed':
    case 'page-changed':
    case 'workflow-cancelled':
    case 'applicant-missing':
    case 'document-missing':
    case 'unknown-error':
    default:
      return 'fatal'
  }
}

/**
 * Verifies that the resolved DOM element matches the expected field mapping input control type.
 */
export function isControlCompatible(element: HTMLElement, mapping: FieldMapping): boolean {
  const inputType = mapping.inputType

  if (element instanceof HTMLSelectElement || element.tagName === 'SELECT') {
    return inputType === 'select'
  }

  if (element instanceof HTMLInputElement || element.tagName === 'INPUT') {
    const type = ((element as HTMLInputElement).type || 'text').toLowerCase()
    if (type === 'checkbox') {
      return inputType === 'checkbox'
    }
    if (type === 'radio') {
      return inputType === 'radio'
    }
    if (type === 'date') {
      return inputType === 'date' || inputType === 'text'
    }
    return inputType === 'text' || inputType === 'date' || inputType === 'unknown'
  }

  if (element instanceof HTMLTextAreaElement || element.tagName === 'TEXTAREA') {
    return inputType === 'text' || inputType === 'textarea'
  }

  return true
}

/**
 * Country-agnostic browser form autofill engine.
 * Restructured with Task 032 failure recovery, stale element retries, and validation checking.
 */
export async function executeAutofill(request: AutofillRequest): Promise<AutofillResult> {
  const { mappings, applicant, options } = request
  const dryRun = options?.dryRun ?? false
  const policy = options?.policy ?? 'fill-empty'

  const operationId = `autofill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const startedAt = new Date().toISOString()
  const recordedChanges: AutofillChange[] = []
  const results: AutofillFieldResult[] = []

  let filledCount = 0
  let skippedCount = 0
  let failedCount = 0

  if (!applicant) {
    return {
      success: false,
      totalFields: 0,
      filledFields: 0,
      skippedFields: 0,
      failedFields: 0,
      results: [],
      operationId,
    }
  }

  // Pre-validate applicant profile to detect field-level validation errors
  const validation = validateApplicant(applicant)

  if (!mappings || mappings.length === 0) {
    const emptyOperation: AutofillOperation = {
      operationId,
      applicantId: applicant.applicantId,
      countryCode: null,
      flow: null,
      pageId: null,
      startedAt,
      completedAt: new Date().toISOString(),
      status: 'completed',
      changes: [],
    }

    return {
      success: true,
      totalFields: 0,
      filledFields: 0,
      skippedFields: 0,
      failedFields: 0,
      results: [],
      operationId,
      operation: emptyOperation,
    }
  }

  let pageChanged = false
  for (const mapping of mappings) {
    if (pageChanged) {
      break
    }

    // B. Check Mapping Status
    if (mapping.status === 'unsupported') {
      results.push({
        fieldId: mapping.id,
        status: 'unsupported',
        failureType: 'unsupported-field',
        reason: 'This field is not currently supported.',
        attempts: 0,
      })
      skippedCount++
      continue
    }

    if (mapping.status === 'manual-required' || mapping.sourceType === 'manual') {
      results.push({
        fieldId: mapping.id,
        status: 'failed',
        failureType: 'manual-required',
        reason: 'Manual entry required for this field.',
        attempts: 0,
      })
      failedCount++
      continue
    }

    if (mapping.status === 'unverified' || mapping.status === 'needs-verification') {
      results.push({
        fieldId: mapping.id,
        status: 'skipped',
        reason: 'Unverified Mapping',
        attempts: 0,
      })
      skippedCount++
      continue
    }

    if (mapping.status !== 'verified') {
      results.push({
        fieldId: mapping.id,
        status: 'skipped',
        reason: `Mapping status is ${mapping.status}`,
        attempts: 0,
      })
      skippedCount++
      continue
    }

    // C. Check Source Field Validation Errors
    if (mapping.sourceField) {
      const fieldErr = validation.errors.find((e) => e.field === mapping.sourceField)
      if (fieldErr) {
        results.push({
          fieldId: mapping.id,
          status: 'failed',
          failureType: 'validation-failed',
          reason: `Validation failed: ${fieldErr.message}`,
          attempts: 0,
        })
        failedCount++
        continue
      }
    }

    // D. Safe Retry loop for DOM querying and filling
    let attempts = 0
    let success = false
    let fieldResult: AutofillFieldResult | null = null

    while (attempts < 3 && !success) {
      attempts++

      // Small controlled delay on retry
      if (attempts > 1) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      try {
        // Page Consistency validation check
        if (options?.validatePageConsistency && !options.validatePageConsistency()) {
          fieldResult = {
            fieldId: mapping.id,
            status: 'failed',
            failureType: 'page-changed',
            reason: 'Page changed during operation.',
            attempts,
          }
          pageChanged = true
          break
        }

        // Query Element with Fallback
        let els = resolveElements(mapping.selector)
        if (els.length === 0 && mapping.fallbackSelector) {
          els = resolveElements(mapping.fallbackSelector)
        }

        if (els.length === 0) {
          if (mapping.required === false && attempts >= 3) {
            fieldResult = {
              fieldId: mapping.id,
              status: 'skipped',
              reason: 'Optional field is not present on page DOM.',
              attempts,
            }
            break
          }
          if (mapping.required === false && attempts < 3) {
            continue // recoverable, retry if element not yet rendered
          }
          fieldResult = {
            fieldId: mapping.id,
            status: 'not-found',
            failureType: mapping.selector ? 'selector-failed' : 'field-not-found',
            reason: 'Visa Autofill could not locate the target field.',
            attempts,
          }
          continue // recoverable, retry
        }

        // Check Ambiguous Target
        if (els.length > 1) {
          const isRadioGroup =
            mapping.inputType === 'radio' &&
            els.every(
              (el) =>
                ((typeof HTMLInputElement !== 'undefined' && el instanceof HTMLInputElement) || el.tagName === 'INPUT') &&
                ((el as HTMLInputElement).type || '').toLowerCase() === 'radio' &&
                Boolean((el as HTMLInputElement).name) &&
                (el as HTMLInputElement).name === (els[0] as HTMLInputElement).name
            )

          if (!isRadioGroup) {
            fieldResult = {
              fieldId: mapping.id,
              status: 'failed',
              failureType: 'ambiguous-target',
              reason: 'Visa Autofill detected multiple similar fields.',
              attempts,
            }
            break // manual-required, exit loop
          }
        }

        const element = els[0]

        // Check Target Control Type Compatibility
        if (!isControlCompatible(element, mapping)) {
          fieldResult = {
            fieldId: mapping.id,
            status: 'failed',
            failureType: 'mapping-mismatch',
            reason: 'Incompatible target control type for this mapping.',
            attempts,
          }
          break // non-recoverable
        }

        // Stale Element containment check
        if (typeof document !== 'undefined' && !document.body.contains(element)) {
          throw new Error('Element is detached from DOM')
        }

        // Readonly / Disabled checks
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLButtonElement
        ) {
          if (element.disabled) {
            fieldResult = {
              fieldId: mapping.id,
              status: 'failed',
              failureType: 'disabled-field',
              reason: 'Manual action is required: field is disabled.',
              attempts,
            }
            break // manual-required, exit loop
          }
        }

        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          if (element.readOnly) {
            fieldResult = {
              fieldId: mapping.id,
              status: 'failed',
              failureType: 'readonly-field',
              reason: 'Manual action is required: field is read-only.',
              attempts,
            }
            break // manual-required, exit loop
          }
        }

        // Resolve Value
        let resolvedValue = resolveApplicantValue(applicant, mapping.sourceField)
        const valuePresent = Boolean(resolvedValue !== undefined && resolvedValue !== '')
        console.log(`[Autofill Diagnostic] Field: ${mapping.id} (${mapping.targetField}) | source=SavedApplication, valuePresent=${valuePresent}`)

        if (!valuePresent) {
          fieldResult = {
            fieldId: mapping.id,
            status: 'skipped',
            failureType: 'source-data-missing',
            reason: 'Source value is not present in SavedApplication.',
            attempts,
          }
          success = true
          break
        }

        if (mapping.transform && resolvedValue !== undefined) {
          resolvedValue = applyValueTransform(resolvedValue, mapping.transform)
        }

        // For dynamic dropdowns (like Indian Mission, Purpose of Visit), wait for options readiness
        if ((element instanceof HTMLSelectElement || element?.tagName === 'SELECT') && resolvedValue) {
          const timeout = attempts === 1 ? 2500 : 300
          const getter = () => {
            const list = resolveElements(mapping.selector)
            if (list.length > 0) return list[0] as HTMLSelectElement
            if (mapping.fallbackSelector) {
              const fb = resolveElements(mapping.fallbackSelector)
              if (fb.length > 0) return fb[0] as HTMLSelectElement
            }
            return element as HTMLSelectElement
          }
          await waitForSelectReadiness(getter, {
            minOptions: 1,
            targetValue: resolvedValue,
            timeoutMs: timeout,
            pollIntervalMs: 30,
          })

          // If still disabled after readiness wait
          const latestEl = getter()
          if (latestEl && latestEl.disabled) {
            fieldResult = {
              fieldId: mapping.id,
              status: 'failed',
              failureType: 'disabled-field',
              reason: 'Manual action is required: field is disabled.',
              attempts,
            }
            break
          }
        }

        // Re-acquire fresh element for filling (in case getter resolved a newer DOM node)
        let fillTarget = element
        if (element instanceof HTMLSelectElement || element?.tagName === 'SELECT') {
          const freshList = resolveElements(mapping.selector)
          if (freshList.length > 0) fillTarget = freshList[0]
          else if (mapping.fallbackSelector) {
            const freshFb = resolveElements(mapping.fallbackSelector)
            if (freshFb.length > 0) fillTarget = freshFb[0]
          }
        }


        // Capture previous state
        const previousState = captureFieldState(fillTarget)

        // Execute DOM Fill with verification
        const fillRes = fillField(fillTarget, mapping, resolvedValue, policy, dryRun)

        // Capture new state
        const newState = captureFieldState(fillTarget)

        // Set failureType based on fillField results
        let failureType: FailureCategory | undefined = fillRes.failureType
        if (!failureType) {
          if (fillRes.status === 'failed' || fillRes.status === 'not-found') {
            if (fillRes.reason?.includes('Matching option') || fillRes.reason?.includes('dropdown option')) {
              failureType = 'option-not-found'
            } else {
              failureType = 'unknown-error'
            }
          } else if (fillRes.status === 'already-matching') {
            failureType = 'already-matching'
          } else if (fillRes.status === 'skipped-existing') {
            failureType = 'skipped-existing'
          }
        }

        fieldResult = {
          fieldId: mapping.id,
          status: fillRes.status as AutofillFieldStatus,
          reason: fillRes.reason || (fillRes.status === 'filled' ? 'Successfully filled' : undefined),
          attempts,
          failureType,
        }

        if (fillRes.status === 'filled') {
          recordedChanges.push({
            operationId,
            fieldId: mapping.id,
            targetSelector: mapping.selector,
            status: 'changed',
            previousState,
            newState,
            timestamp: new Date().toISOString(),
          })
          success = true
        } else if (
          fillRes.status === 'already-matching' ||
          fillRes.status === 'skipped-existing' ||
          fillRes.status === 'skipped'
        ) {
          success = true
        }

      } catch (err) {
        console.warn(`Stale element encounter on attempt ${attempts} for ${mapping.id}:`, err)
        fieldResult = {
          fieldId: mapping.id,
          status: 'failed',
          failureType: 'stale-element',
          reason: 'Visa Autofill encountered a stale element and tried to re-resolve.',
          attempts,
        }
      }
    }

    if (fieldResult) {
      results.push(fieldResult)
      if (fieldResult.status === 'filled') {
        filledCount++
      } else if (
        fieldResult.status === 'skipped' ||
        fieldResult.status === 'already-matching' ||
        fieldResult.status === 'skipped-existing'
      ) {
        skippedCount++
      } else {
        failedCount++
      }
    }
  }

  const completedAt = new Date().toISOString()
  const operationStatus =
    failedCount > 0 && filledCount > 0
      ? 'partially-completed'
      : failedCount > 0
      ? 'failed'
      : 'completed'

  const operation: AutofillOperation = {
    operationId,
    applicantId: applicant.applicantId,
    countryCode: null,
    flow: null,
    pageId: null,
    startedAt,
    completedAt,
    status: operationStatus,
    changes: recordedChanges,
  }

  return {
    success: failedCount === 0,
    totalFields: mappings.length,
    filledFields: filledCount,
    skippedFields: skippedCount,
    failedFields: failedCount,
    results,
    operationId,
    operation,
  }
}
