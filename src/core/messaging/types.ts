import type { ApplicantProfile } from '../applicant/types'
import type { AutofillResult } from '../autofill/types'
import type { DocumentAttachmentResult } from '../document/requirement.types'
import type { UndoResult } from '../safety/types'
import type { WorkflowState } from '../workflow/types'

export interface GenericPageDetectionResult {
  matched: boolean
  country: string | null
  countryCode: string | null
  countryName: string | null
  flow: string | null
  page: string | null
  url?: string
  title?: string
}

export type ExtensionMessageType =
  | 'PING_BACKGROUND'
  | 'PING_CONTENT'
  | 'GET_CURRENT_VISA_PAGE'
  | 'EXECUTE_AUTOFILL'
  | 'START_WORKFLOW'
  | 'STOP_WORKFLOW'
  | 'GET_WORKFLOW_STATE'
  | 'PAGE_CHANGED'
  | 'ATTACH_DOCUMENT'
  | 'EXECUTE_UNDO'

export type PingBackgroundMessage = {
  type: 'PING_BACKGROUND'
}

export type PingContentMessage = {
  type: 'PING_CONTENT'
}

export type GetCurrentVisaPageMessage = {
  type: 'GET_CURRENT_VISA_PAGE'
}

export type ExecuteAutofillMessage = {
  type: 'EXECUTE_AUTOFILL'
  applicant: ApplicantProfile
}

export type StartWorkflowMessage = {
  type: 'START_WORKFLOW'
  applicantId: string
}

export type StopWorkflowMessage = {
  type: 'STOP_WORKFLOW'
}

export type GetWorkflowStateMessage = {
  type: 'GET_WORKFLOW_STATE'
}

export type PageChangedMessage = {
  type: 'PAGE_CHANGED'
  detection: GenericPageDetectionResult
}

export type AttachDocumentMessage = {
  type: 'ATTACH_DOCUMENT'
  documentId: string
  requirementId: string
}

export type ExecuteUndoMessage = {
  type: 'EXECUTE_UNDO'
}

export type ExtensionMessage =
  | PingBackgroundMessage
  | PingContentMessage
  | GetCurrentVisaPageMessage
  | ExecuteAutofillMessage
  | StartWorkflowMessage
  | StopWorkflowMessage
  | GetWorkflowStateMessage
  | PageChangedMessage
  | AttachDocumentMessage
  | ExecuteUndoMessage

export type BackgroundPongPayload = {
  type: 'BACKGROUND_PONG'
  message: string
}

export type ContentPongPayload = {
  type: 'CONTENT_PONG'
  message: string
}

export type VisaPageResponsePayload = {
  type: 'VISA_PAGE_DETECTION'
  detection: GenericPageDetectionResult
}

export type AutofillResponsePayload = {
  type: 'AUTOFILL_COMPLETED'
  result: AutofillResult
}

export type WorkflowStatePayload = {
  type: 'WORKFLOW_STATE_RESPONSE'
  state: WorkflowState
}

export type DocumentAttachmentPayload = {
  type: 'DOCUMENT_ATTACHED'
  result: DocumentAttachmentResult
}

export type UndoResponsePayload = {
  type: 'UNDO_COMPLETED'
  result: UndoResult
}

export type ExtensionResponseSuccess<T> = {
  status: 'success'
  data: T
}

export type ExtensionResponseError = {
  status: 'error'
  error: string
}

export type ExtensionResponse<T> =
  | ExtensionResponseSuccess<T>
  | ExtensionResponseError
