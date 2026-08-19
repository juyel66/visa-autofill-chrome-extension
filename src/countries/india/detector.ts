import { INDIA_COUNTRY_CONFIG } from './config'
import type { CountryPageDetectionResult, IndiaVisaFlow, IndiaVisaPage } from './types'

export interface LocationInfo {
  href?: string
  hostname?: string
  pathname?: string
  title?: string
}

/**
 * Detects whether a page belongs to the official Indian Visa Online portal (indianvisaonline.gov.in)
 * and classifies the visa flow (regular vs evisa) and page stage.
 * 
 * Read-only page detector. Does NOT modify DOM, populate fields, or solve CAPTCHAs.
 */
export function detectIndiaVisaPage(locationInfo?: LocationInfo): CountryPageDetectionResult {
  const href =
    locationInfo?.href || (typeof window !== 'undefined' ? window.location.href : '')
  const hostname =
    locationInfo?.hostname || (typeof window !== 'undefined' ? window.location.hostname : '')
  const pathname =
    locationInfo?.pathname || (typeof window !== 'undefined' ? window.location.pathname : '')
  const title =
    locationInfo?.title || (typeof document !== 'undefined' ? document.title : '')

  const isIndiaDomain = INDIA_COUNTRY_CONFIG.supportedDomains.some((domain) => {
    const hostLower = hostname.toLowerCase()
    const domLower = domain.toLowerCase()
    return hostLower === domLower || hostLower.endsWith('.' + domLower)
  })

  if (!isIndiaDomain) {
    return {
      matched: false,
      country: null,
      countryCode: null,
      countryName: null,
      flow: null,
      page: null,
      url: href,
      title,
    }
  }

  const pathLower = pathname.toLowerCase()

  // 1. Flow Classification
  let flow: IndiaVisaFlow = 'unknown'
  if (pathLower.includes('/evisa') || pathLower.includes('/evisaindia')) {
    flow = 'evisa'
  } else if (pathLower.includes('/visa')) {
    flow = 'regular'
  }

  // 2. Page Stage Classification
  let page: IndiaVisaPage = 'unknown'
  if (pathLower === '' || pathLower === '/' || pathLower === '/index.html' || pathLower.endsWith('/index.jsp')) {
    page = 'landing'
  } else if (
    pathLower.endsWith('/visa/registration') ||
    pathLower.includes('/registration') ||
    pathLower.includes('/welcome.jsp')
  ) {
    page = 'application-start'
  } else if (
    pathLower.endsWith('/visa/basicdetails') ||
    pathLower.includes('/personal.jsp') ||
    pathLower.includes('/visaonline.jsp') ||
    pathLower.includes('/form1') ||
    pathLower.includes('/evisaform1') ||
    pathLower.includes('/basicdetails')
  ) {
    page = 'personal-details'
  } else if (pathLower.includes('/addressdetails.jsp') || pathLower.includes('/form2') || pathLower.includes('/evisaform2')) {
    page = 'address-details'
  } else if (pathLower.includes('/familydetails.jsp')) {
    page = 'family-details'
  } else if (pathLower.includes('/occupationdetails.jsp') || pathLower.includes('/form4') || pathLower.includes('/evisaform4')) {
    page = 'occupation-details'
  } else if (pathLower.includes('/visadetails.jsp') || pathLower.includes('/form3') || pathLower.includes('/evisaform3')) {
    page = 'travel-details'
  } else if (pathLower.includes('/referencedetails.jsp') || pathLower.includes('/form5') || pathLower.includes('/evisaform5')) {
    page = 'reference-details'
  } else if (
    pathLower.includes('/form') ||
    pathLower.includes('/visadetails') ||
    pathLower.includes('/familydetails') ||
    pathLower.includes('/personal')
  ) {
    page = 'application-form'
  } else if (pathLower.includes('/partial') || pathLower.includes('/completepartially')) {
    page = 'partial-application'
  } else if (pathLower.includes('/print')) {
    page = 'print-application'
  } else if (pathLower.includes('/status') || pathLower.includes('/checkstatus')) {
    page = 'status'
  } else if (pathLower.includes('/reupload')) {
    page = 'document-reupload'
  } else if (pathLower.includes('/upload') || pathLower.includes('/uploadphoto.jsp')) {
    page = 'document-upload'
  } else if (pathLower.includes('/login') || pathLower.includes('login.jsp')) {
    page = 'login'
  } else if (pathLower.includes('/otp') || pathLower.includes('otp.jsp')) {
    page = 'otp'
  } else if (pathLower.includes('/captcha') || pathLower.includes('captcha.jsp')) {
    page = 'captcha'
  } else if (pathLower.includes('/payment') || pathLower.includes('payment.jsp') || pathLower.includes('/pay')) {
    page = 'payment'
  } else if (
    pathLower.includes('/review') ||
    pathLower.includes('/preview') ||
    pathLower.includes('preview.jsp') ||
    pathLower.includes('viewdetails.jsp')
  ) {
    page = 'review'
  }

  // DOM structural fallbacks
  if (typeof document !== 'undefined' && page === 'unknown') {
    if (document.querySelector('input[type="password"]')) {
      page = 'login'
    } else if (document.querySelector('input[name*="otp" i], input[id*="otp" i]')) {
      page = 'otp'
    } else if (document.querySelector('img[src*="captcha" i], input[name*="captcha" i]')) {
      page = 'captcha'
    }
  }

  return {
    matched: true,
    country: 'india',
    countryCode: INDIA_COUNTRY_CONFIG.countryCode,
    countryName: INDIA_COUNTRY_CONFIG.countryName,
    flow,
    page,
    url: href,
    title,
  }
}
