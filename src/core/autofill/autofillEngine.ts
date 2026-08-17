import type { AutofillChange, AutofillOperation } from '../safety/types'
import { captureFieldState } from '../safety/undoManager'
import { fillField } from './fieldFiller'
import { resolveElements } from './selectorResolver'
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
      return 'manual-required'

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

  if (element instanceof HTMLSelectElement) {
    return inputType === 'select'
  }

  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase()
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

  if (element instanceof HTMLTextAreaElement) {
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

    if (mapping.status === 'unverified') {
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

    // Check manual-only field sourceType gate
    if (mapping.sourceType === 'manual') {
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
          fieldResult = {
            fieldId: mapping.id,
            status: 'failed',
            failureType: 'ambiguous-target',
            reason: 'Visa Autofill detected multiple similar fields.',
            attempts,
          }
          break // manual-required, exit loop
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
          element instanceof HTMLSelectElement ||
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
        if (resolvedValue === undefined || resolvedValue === '') {
          if (mapping.required) {
            fieldResult = {
              fieldId: mapping.id,
              status: 'failed',
              failureType: 'validation-failed',
              reason: 'Required source field is missing from applicant profile.',
              attempts,
            }
            break // non-recoverable validation-failed, do not retry
          }
          fieldResult = {
            fieldId: mapping.id,
            status: 'skipped',
            reason: 'Applicant profile contains no value for source field',
            attempts,
          }
          success = true
          break
        }

        if (mapping.transform) {
          resolvedValue = applyValueTransform(resolvedValue, mapping.transform)
        }

        // Capture previous state
        const previousState = captureFieldState(element)

        // Execute DOM Fill
        const fillRes = fillField(element, mapping, resolvedValue, policy, dryRun)

        // Capture new state
        const newState = captureFieldState(element)

        // Set failureType based on fillField results
        let failureType: FailureCategory | undefined
        if (fillRes.status === 'failed' || fillRes.status === 'not-found') {
          if (fillRes.reason?.includes('Matching option')) {
            failureType = 'option-not-found'
          } else {
            failureType = 'unknown-error'
          }
        } else if (fillRes.status === 'already-matching') {
          failureType = 'already-matching'
        } else if (fillRes.status === 'skipped-existing') {
          failureType = 'skipped-existing'
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
