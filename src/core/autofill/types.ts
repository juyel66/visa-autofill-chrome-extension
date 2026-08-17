import type { ApplicantProfile } from '../applicant/types'
import type { AutofillOperation } from '../safety/types'

export type AutofillPolicy = 'fill-empty' | 'overwrite'

export type AutofillFieldStatus =
  | 'filled'
  | 'skipped'
  | 'failed'
  | 'not-found'
  | 'unsupported'
  | 'already-filled'
  | 'already-matching'
  | 'skipped-existing'

export type FailureCategory =
  | 'page-not-recognized'
  | 'field-not-found'
  | 'selector-failed'
  | 'ambiguous-target'
  | 'unsupported-field'
  | 'manual-required'
  | 'validation-failed'
  | 'option-not-found'
  | 'readonly-field'
  | 'disabled-field'
  | 'stale-element'
  | 'page-changed'
  | 'workflow-cancelled'
  | 'applicant-missing'
  | 'document-missing'
  | 'attachment-failed'
  | 'unknown-error'
  | 'skipped-existing'
  | 'already-matching'
  | 'mapping-mismatch'

export type FailureSeverity = 'recoverable' | 'skippable' | 'manual-required' | 'fatal'

export type FieldInputType =
  | 'text'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'textarea'
  | 'file'
  | 'unknown'

export type SelectorStrategy = 'id' | 'name' | 'label' | 'css' | 'xpath'

export interface FieldSelector {
  strategy: SelectorStrategy
  value: string
}

export type MappingStatus = 'verified' | 'unverified' | 'unsupported'

export interface FieldMapping {
  id: string
  section: string
  targetField: string
  sourceField?: string
  sourceType?: 'applicant-profile' | 'country-specific' | 'manual'
  selector?: FieldSelector
  inputType: FieldInputType
  status: MappingStatus
  required?: boolean
  transform?: string
  notes?: string
  fallbackSelector?: FieldSelector
}

export interface AutofillFieldResult {
  fieldId: string
  status: AutofillFieldStatus
  reason?: string
  attempts?: number
  failureType?: FailureCategory
  pageId?: string | null
}

export interface AutofillResult {
  success: boolean
  totalFields: number
  filledFields: number
  skippedFields: number
  failedFields: number
  results: AutofillFieldResult[]
  operationId?: string
  operation?: AutofillOperation
}

export interface AutofillOptions {
  dryRun?: boolean
  policy?: AutofillPolicy
  validatePageConsistency?: () => boolean
}

export interface AutofillRequest {
  mappings: FieldMapping[]
  applicant: ApplicantProfile
  options?: AutofillOptions
}
