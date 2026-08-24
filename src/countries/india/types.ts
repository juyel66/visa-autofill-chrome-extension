import type { GenericPageDetectionResult } from '../../core/messaging/types'

export type IndiaVisaFlow = 'regular' | 'evisa' | 'unknown'
 



export type IndiaVisaPage =
  | 'landing'
  | 'application-start'
  | 'registration'
  | 'application-form'
  | 'personal-details'
  | 'basic-details'
  | 'address-details'
  | 'family-details'
  | 'occupation-details'
  | 'travel-details'
  | 'reference-details'
  | 'document-upload'
  | 'partial-application'
  | 'print-application'
  | 'status'
  | 'document-reupload'
  | 'login'
  | 'otp'
  | 'captcha'
  | 'payment'
  | 'review'
  | 'unknown'

export interface CountryPageDetectionResult extends GenericPageDetectionResult {
  country: 'india' | null
  flow: IndiaVisaFlow | null
  page: IndiaVisaPage | null
}
