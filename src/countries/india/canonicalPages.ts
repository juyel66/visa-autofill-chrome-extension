import type { IndiaVisaPage } from './types'

/**
 * Normalizes any page identifier or path string into a single canonical IndiaVisaPage identity.
 * Maps legacy/alternate names like 'application-start' to canonical 'registration',
 * and 'personal-details' to canonical 'basic-details'.
 */
export function normalizePageIdentity(page?: string | null): IndiaVisaPage {
  if (!page) return 'unknown'
  const p = page.toLowerCase().trim()

  switch (p) {
    case 'registration':
    case 'application-start':
    case '/visa/registration':
    case '/visa/registration.jsp':
    case 'registration.jsp':
    case 'welcome.jsp':
      return 'registration'

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
      return 'basic-details'

    case 'address-details':
    case 'addressdetails.jsp':
    case 'form2':
    case 'evisaform2':
      return 'address-details'

    case 'family-details':
    case 'familydetails.jsp':
      return 'family-details'

    case 'occupation-details':
    case 'profession':
    case 'occupationdetails.jsp':
    case 'form4':
    case 'evisaform4':
      return 'occupation-details'

    case 'travel-details':
    case 'visa-details':
    case 'visadetails.jsp':
    case 'form3':
    case 'evisaform3':
      return 'travel-details'

    case 'reference-details':
    case 'references':
    case 'accommodation':
    case 'referencedetails.jsp':
    case 'form5':
    case 'evisaform5':
      return 'reference-details'

    case 'document-upload':
    case 'uploadphoto.jsp':
      return 'document-upload'

    case 'document-reupload':
    case 'reupload':
      return 'document-reupload'

    case 'landing':
    case 'index.html':
    case 'index.jsp':
      return 'landing'

    case 'application-form':
      return 'application-form'

    case 'partial-application':
      return 'partial-application'

    case 'print-application':
      return 'print-application'

    case 'status':
      return 'status'

    case 'login':
      return 'login'

    case 'otp':
      return 'otp'

    case 'captcha':
      return 'captcha'

    case 'payment':
      return 'payment'

    case 'review':
      return 'review'

    default:
      return 'unknown'
  }
}

/**
 * Checks if two page identifiers refer to the same canonical page identity.
 */
export function arePagesEquivalent(pageA?: string | null, pageB?: string | null): boolean {
  if (!pageA || !pageB) return false
  const normA = normalizePageIdentity(pageA)
  const normB = normalizePageIdentity(pageB)
  return normA !== 'unknown' && normA === normB
}
