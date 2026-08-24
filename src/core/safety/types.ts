import type { FieldSelector } from '../autofill/types'

export interface FieldState {
  value: string
  checked?: boolean
}

export type ChangeStatus =
  | 'changed'
  | 'skipped'
  | 'failed'
  | 'user-modified'
  | 'restored'
  | 'unsupported'

export interface AutofillChange {
  operationId: string
  fieldId: string
  targetSelector?: FieldSelector | FieldSelector[]
  status: ChangeStatus
  previousState: FieldState
  newState: FieldState
  timestamp: string
}

export type OperationStatus =
  | 'started'
  | 'completed'
  | 'partially-completed'
  | 'failed'
  | 'undone'
  | 'cancelled'

export interface AutofillOperation {
  operationId: string
  applicantId: string
  countryCode: string | null
  flow: string | null
  pageId: string | null
  startedAt: string
  completedAt?: string
  status: OperationStatus
  changes: AutofillChange[]
}

export type UndoFieldStatus = 'restored' | 'user-modified' | 'not-found' | 'failed' | 'skipped'

export interface UndoFieldResult {
  fieldId: string
  status: UndoFieldStatus
  reason?: string
}

export interface UndoResult {
  operationId: string
  restored: number
  skipped: number
  notFound: number
  failed: number
  fields: UndoFieldResult[]
}
