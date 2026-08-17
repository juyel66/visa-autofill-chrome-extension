import type { GenericPageDetectionResult } from '../../core/messaging/types'

export type IndiaVisaFlow = 'regular' | 'evisa' | 'unknown'

export type IndiaVisaPage =
  | 'landing'
  | 'application-start'
  | 'application-form'
  | 'partial-application'
  | 'print-application'
  | 'status'
  | 'document-reupload'
  | 'unknown'

export interface CountryPageDetectionResult extends GenericPageDetectionResult {
  country: 'india' | null
  flow: IndiaVisaFlow | null
  page: IndiaVisaPage | null
}
