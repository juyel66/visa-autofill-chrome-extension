import type { AutofillChange, AutofillOperation } from '../safety/types'
import { captureFieldState } from '../safety/undoManager'
import { fillField } from './fieldFiller'

import { resolveElement } from './selectorResolver'

import type { AutofillFieldResult, AutofillRequest, AutofillResult } from './types'

import { resolveApplicantValue } from './valueResolver'

/**
 * Country-agnostic browser form autofill engine.
 * Receives abstract FieldMapping definitions and target ApplicantProfile, resolves DOM elements,
 * captures pre-fill and post-fill field states, and applies native values safely.
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

  for (const mapping of mappings) {
    if (mapping.status !== 'verified') {
      results.push({
        fieldId: mapping.id,
        status: 'skipped',
        reason: `Mapping status is ${mapping.status}`,
      })
      skippedCount++
      continue
    }

    if (!mapping.selector) {
      results.push({
        fieldId: mapping.id,
        status: 'not-found',
        reason: 'No selector strategy defined for mapping',
      })
      failedCount++
      continue
    }

    const element = resolveElement(mapping.selector)
    if (!element) {
      results.push({
        fieldId: mapping.id,
        status: 'not-found',
        reason: `DOM Element not found for strategy (${mapping.selector.strategy}: ${mapping.selector.value})`,
      })
      failedCount++
      continue
    }

    const resolvedValue = resolveApplicantValue(applicant, mapping.sourceField)
    if (resolvedValue === undefined || resolvedValue === '') {
      results.push({
        fieldId: mapping.id,
        status: 'skipped',
        reason: 'Applicant profile contains no value for source field',
      })
      skippedCount++
      continue
    }

    // Capture PREVIOUS FIELD STATE
    const previousState = captureFieldState(element)

    // Execute Fill
    const fillRes = fillField(element, mapping, resolvedValue, policy, dryRun)

    // Capture NEW FIELD STATE
    const newState = captureFieldState(element)

    // Record Change if value actually changed
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
      filledCount++
    } else if (fillRes.status === 'already-filled' || fillRes.status === 'skipped') {
      skippedCount++
    } else {
      failedCount++
    }

    results.push(fillRes)
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
