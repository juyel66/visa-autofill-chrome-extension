import type { CanonicalIndiaVisaPage } from './types'

export const CANONICAL_INDIA_VISA_PAGES = {
  REGISTRATION: 'REGISTRATION',
  BASIC_DETAILS: 'BASIC_DETAILS',
  ADDRESS_DETAILS: 'ADDRESS_DETAILS',
  FAMILY_DETAILS: 'FAMILY_DETAILS',
  OCCUPATION_DETAILS: 'OCCUPATION_DETAILS',
  TRAVEL_DETAILS: 'TRAVEL_DETAILS',
  REFERENCE_DETAILS: 'REFERENCE_DETAILS',
  DOCUMENT_UPLOAD: 'DOCUMENT_UPLOAD',
  DOCUMENT_REUPLOAD: 'DOCUMENT_REUPLOAD',
  LANDING: 'LANDING',
  APPLICATION_FORM: 'APPLICATION_FORM',
  PARTIAL_APPLICATION: 'PARTIAL_APPLICATION',
  PRINT_APPLICATION: 'PRINT_APPLICATION',
  STATUS: 'STATUS',
  LOGIN: 'LOGIN',
  OTP: 'OTP',
  CAPTCHA: 'CAPTCHA',
  PAYMENT: 'PAYMENT',
  REVIEW: 'REVIEW',
  ADDITIONAL_QUESTIONS: 'ADDITIONAL_QUESTIONS',
  PHOTO_UPLOAD: 'PHOTO_UPLOAD',
  UNKNOWN: 'UNKNOWN',
} as const

/**
 * Normalizes any page identifier or path string into a single canonical CanonicalIndiaVisaPage identity.
 * Maps legacy/alternate names like 'application-start', '/visa/Registration', and 'registration'
 * to canonical 'REGISTRATION', and 'personal-details', '/visa/BasicDetails' to 'BASIC_DETAILS'.
 */
export function normalizePageIdentity(page?: string | null): CanonicalIndiaVisaPage {
  if (!page) return 'UNKNOWN'
  const p = page.toLowerCase().trim()

  switch (p) {
    case 'registration':
    case 'application-start':
    case '/visa/registration':
    case '/visa/registration.jsp':
    case 'registration.jsp':
    case 'welcome.jsp':
      return 'REGISTRATION'

    case 'basic-details':
    case 'basicdetails':
    case 'basic_details':
    case 'personal-details':
    case '/visa/basicdetails':
    case '/visa/basicdetails.jsp':
    case 'basicdetails.jsp':
    case 'personal.jsp':
    case 'form1':
    case 'evisaform1':
      return 'BASIC_DETAILS'

    case 'address-details':
    case 'addressdetails':
    case 'address_details':
    case '/visa/addressdetails.jsp':
    case 'addressdetails.jsp':
    case 'form2':
    case 'evisaform2':
      return 'ADDRESS_DETAILS'

    case 'family-details':
    case 'familydetails':
    case 'family_details':
    case '/visa/familydetails':
    case '/visa/familydetails.jsp':
    case 'familydetails.jsp':
      return 'FAMILY_DETAILS'

    case 'occupation-details':
    case 'occupationdetails':
    case 'occupation_details':
    case 'profession':
    case '/visa/occupationdetails.jsp':
    case 'occupationdetails.jsp':
    case 'form4':
    case 'evisaform4':
      return 'OCCUPATION_DETAILS'

    case 'travel-details':
    case 'traveldetails':
    case 'travel_details':
    case 'visa-details':
    case 'visadetails':
    case 'visa_details':
    case '/visa/visadetails':
    case '/visa/visadetails.jsp':
    case 'visadetails.jsp':
    case 'form3':
    case 'evisaform3':
      return 'TRAVEL_DETAILS'

    case 'reference-details':
    case 'referencedetails':
    case 'reference_details':
    case 'references':
    case 'accommodation':
    case '/visa/referencedetails.jsp':
    case 'referencedetails.jsp':
    case 'form5':
    case 'evisaform5':
      return 'REFERENCE_DETAILS'

    case 'document-upload':
    case 'documentupload':
    case 'document_upload':
    case 'photo-upload':
    case 'photoupload':
    case 'photo_upload':
    case '/visa/photoupload':
    case '/visa/photoupload.jsp':
    case 'uploadphoto.jsp':
      return 'DOCUMENT_UPLOAD'

    case 'additional-questions':
    case 'additionalquestions':
    case 'additional_questions':
    case '/visa/additionalquestions':
    case '/visa/additionalquestions.jsp':
      return 'ADDITIONAL_QUESTIONS'

    case 'document-reupload':
    case 'documentreupload':
    case 'document_reupload':
    case 'reupload':
      return 'DOCUMENT_REUPLOAD'

    case 'landing':
    case 'index.html':
    case 'index.jsp':
      return 'LANDING'

    case 'application-form':
    case 'applicationform':
    case 'application_form':
      return 'APPLICATION_FORM'

    case 'partial-application':
    case 'partialapplication':
    case 'partial_application':
      return 'PARTIAL_APPLICATION'

    case 'print-application':
    case 'printapplication':
    case 'print_application':
      return 'PRINT_APPLICATION'

    case 'status':
      return 'STATUS'

    case 'login':
      return 'LOGIN'

    case 'otp':
      return 'OTP'

    case 'captcha':
      return 'CAPTCHA'

    case 'payment':
      return 'PAYMENT'

    case 'review':
      return 'REVIEW'

    default:
      return 'UNKNOWN'
  }
}


/**
 * Checks if two page identifiers refer to the same canonical page identity.
 */
export function arePagesEquivalent(pageA?: string | null, pageB?: string | null): boolean {
  if (!pageA || !pageB) return false
  const normA = normalizePageIdentity(pageA)
  const normB = normalizePageIdentity(pageB)
  return normA !== 'UNKNOWN' && normA === normB
}

