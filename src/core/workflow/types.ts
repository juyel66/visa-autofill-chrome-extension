import type { AutofillOperation } from '../safety/types'

export type WorkflowStatus =
  | 'idle'
  | 'detected'
  | 'ready'
  | 'filling'
  | 'waiting-for-user'
  | 'page-changing'
  | 'completed'
  | 'blocked'
  | 'error'
  | 'manual-required'
  | 'cancelled'

export interface PageIdentity {
  countryCode: string
  flow: string
  pageId: string
  confidence?: number
}

export interface PageDetectionResult {
  detected: boolean
  page?: PageIdentity
  reason?: string
}

export interface WorkflowState {
  sessionId: string | null
  status: WorkflowStatus
  countryCode: string | null
  flow: string | null
  currentPage: string | null
  previousPage: string | null
  applicantId: string | null
  completedPages: string[]
  formReady: boolean
  blockedReason?: string
  tabId?: number | null
  operations?: Record<string, AutofillOperation>
  errors?: string[]
}

export interface WorkflowSession {
  sessionId: string
  applicantId: string
  countryCode: string
  flow: string
  startedAt: string
  currentPage: string
  completedPages: string[]
  status: WorkflowStatus
}
