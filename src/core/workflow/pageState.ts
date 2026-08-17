import type { WorkflowSession, WorkflowState } from './types'

export function createInitialWorkflowState(): WorkflowState {
  return {
    sessionId: null,
    status: 'idle',
    countryCode: null,
    flow: null,
    currentPage: null,
    previousPage: null,
    applicantId: null,
    completedPages: [],
    formReady: false,
    tabId: null,
    operations: {},
    errors: [],
  }
}

export function createWorkflowSession(
  applicantId: string,
  countryCode: string,
  flow: string,
  pageId: string
): WorkflowSession {
  return {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    applicantId,
    countryCode,
    flow,
    startedAt: new Date().toISOString(),
    currentPage: pageId,
    completedPages: [],
    status: 'ready',
  }
}

export function updateWorkflowState(
  current: WorkflowState,
  updates: Partial<WorkflowState>
): WorkflowState {
  return {
    ...current,
    ...updates,
  }
}
