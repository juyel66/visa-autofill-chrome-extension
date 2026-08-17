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
}

export interface AutofillFieldResult {
  fieldId: string
  status: AutofillFieldStatus
  reason?: string
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
}

export interface AutofillRequest {
  mappings: FieldMapping[]
  applicant: ApplicantProfile
  options?: AutofillOptions
}
