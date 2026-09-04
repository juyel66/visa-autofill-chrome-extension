import type { GenericPageDetectionResult } from '../../core/messaging/types'

export type IndiaVisaFlow = 'regular' | 'evisa' | 'unknown'
 



export type CanonicalIndiaVisaPage =
  | 'REGISTRATION'
  | 'BASIC_DETAILS'
  | 'ADDRESS_DETAILS'
  | 'FAMILY_DETAILS'
  | 'OCCUPATION_DETAILS'
  | 'TRAVEL_DETAILS'
  | 'REFERENCE_DETAILS'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_REUPLOAD'
  | 'LANDING'
  | 'APPLICATION_FORM'
  | 'PARTIAL_APPLICATION'
  | 'PRINT_APPLICATION'
  | 'STATUS'
  | 'LOGIN'
  | 'OTP'
  | 'CAPTCHA'
  | 'PAYMENT'
  | 'REVIEW'
  | 'UNKNOWN'

export type IndiaVisaPage =
  | CanonicalIndiaVisaPage
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
