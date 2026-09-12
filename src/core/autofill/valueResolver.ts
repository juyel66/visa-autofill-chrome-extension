import type { ApplicantProfile } from '../applicant/types'
import { BANGLADESH_WORKFLOW_DEFAULTS } from '../../countries/india/config'

/**
 * Generates a deterministic, unique temporary email based on the current applicant's identity.
 * Zero hardcoded names; uses the applicant's normalized first/last name and unique ID suffix.
 */
export function generateDynamicTemporaryEmail(applicant: ApplicantProfile): string {
  const given = (applicant.personalInfo?.givenNames || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  const surname = (applicant.personalInfo?.surname || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  const namePart = [given, surname].filter(Boolean).join('.') || 'applicant'
  const idSource = applicant.passport?.passportNumber || applicant.applicantId || 'user'
  const idPart = idSource.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(-6)
  return `${namePart}.${idPart}@${BANGLADESH_WORKFLOW_DEFAULTS.temporaryEmailDomain}`
}

/**
 * Resolves the final Registration email according to the priority hierarchy:
 * 1. Manual user email / account email
 * 2. Explicit applicant email extracted from document
 * 3. Dynamic temporary generated email (from current applicant identity)
 */
export function resolveRegistrationEmail(
  applicant: ApplicantProfile,
  options?: { accountEmail?: string }
): { email: string; source: 'manual' | 'account' | 'extracted' | 'temporary_generated' } {
  // 1. Account / login email passed via options or notes
  if (options?.accountEmail && options.accountEmail.trim() !== '') {
    return { email: options.accountEmail.trim(), source: 'account' }
  }
  if (applicant.notes) {
    const accMatch = applicant.notes.match(/(?:account\s*email|user\s*email)\s*:\s*([^\r\n\s]+@[^\r\n\s]+)/i)
    if (accMatch && accMatch[1]) {
      return { email: accMatch[1].trim(), source: 'account' }
    }
  }

  // 2. Explicit applicant email from document or SavedApplication
  if (applicant.contact?.email && applicant.contact.email.trim() !== '') {
    return { email: applicant.contact.email.trim(), source: 'extracted' }
  }

  // 3. Deterministic temporary generated email
  return {
    email: generateDynamicTemporaryEmail(applicant),
    source: 'temporary_generated',
  }
}

/**
 * Safely resolves nested string values from ApplicantProfile without using eval().
 */
export function resolveApplicantValue(
  applicant: ApplicantProfile,
  path?: string,
  options?: { accountEmail?: string; disableTemporaryEmail?: boolean }
): string | undefined {
  if (!applicant || !path) return undefined

  // Indian Mission: explicit mission > city derivation > configured Bangladesh default
  if (path === 'registration.indianMission' || path === 'appl.missioncode' || path === 'missioncode') {
    if (applicant.registration?.indianMission && applicant.registration.indianMission.trim() !== '') {
      return applicant.registration.indianMission.trim()
    }
    if (applicant.notes) {
      const match = applicant.notes.match(/(?:indian\s+)?mission\s*:\s*([^\r\n]+)/i)
      if (match && match[1] && match[1].trim() !== '') {
        return match[1].trim()
      }
    }
    const city = applicant.presentAddress?.villageTownCity?.toLowerCase() || ''
    if (city.includes('dhaka')) return 'BANGLADESH-DHAKA'
    if (city.includes('chittagong')) return 'BANGLADESH-CHITTAGONG'
    if (city.includes('sylhet')) return 'BANGLADESH-SYLHET'
    if (city.includes('rajshahi')) return 'BANGLADESH-RAJSHAHI'
    if (city.includes('khulna')) return 'BANGLADESH-KHULNA'

    // Centralized default for Bangladesh workflow
    return BANGLADESH_WORKFLOW_DEFAULTS.defaultMission
  }

  // Journey Date / Expected Date of Arrival
  if (path === 'travel.intendedArrivalDate' || path === 'appl.journeydate' || path === 'journeydate') {
    if (applicant.travel?.intendedArrivalDate && applicant.travel.intendedArrivalDate.trim() !== '') {
      return applicant.travel.intendedArrivalDate.trim()
    }
    return undefined
  }

  // Purpose of Visit / Visiting India for / Visa Type
  if (
    path === 'travel.purposeOfVisit' ||
    path === 'appl.purpose' ||
    path === 'purpose' ||
    path === 'appl.visatype' ||
    path === 'visatype'
  ) {
    if (applicant.travel?.purposeOfVisit && applicant.travel.purposeOfVisit.trim() !== '') {
      return applicant.travel.purposeOfVisit.trim()
    }
    return undefined
  }

  // Country
  if (path === 'presentAddress.country' || path === 'appl.countryname' || path === 'present_country') {
    if (applicant.presentAddress?.country && applicant.presentAddress.country.trim() !== '') {
      return applicant.presentAddress.country.trim()
    }
    if (applicant.registration?.applyingFromCountry && applicant.registration.applyingFromCountry.trim() !== '') {
      return applicant.registration.applyingFromCountry.trim()
    }
    return undefined
  }

  // Nationality: Priority 1: Explicit nationality -> Priority 2: Country of birth fallback
  if (path === 'personalInfo.nationality' || path === 'appl.nationality' || path === 'nationality') {
    if (applicant.personalInfo?.nationality && applicant.personalInfo.nationality.trim() !== '') {
      return applicant.personalInfo.nationality.trim()
    }
    if (applicant.registration?.nationality && applicant.registration.nationality.trim() !== '') {
      return applicant.registration.nationality.trim()
    }
    // Generic fallback to Country of Birth only when nationality is genuinely missing
    if (applicant.personalInfo?.countryOfBirth && applicant.personalInfo.countryOfBirth.trim() !== '') {
      return applicant.personalInfo.countryOfBirth.trim()
    }
    if (applicant.presentAddress?.country && applicant.presentAddress.country.trim() !== '') {
      return applicant.presentAddress.country.trim()
    }
    return undefined
  }

  // Email & Confirm Email: Manual > Account > Extracted Document > Temporary Generated
  if (
    path === 'contact.email' ||
    path === 'contact.emailConfirm' ||
    path === 'contact.email_re' ||
    path === 'appl.email' ||
    path === 'appl.email_re' ||
    path === 'email'
  ) {
    if (options?.disableTemporaryEmail) {
      if (applicant.contact?.email && applicant.contact.email.trim() !== '') {
        return applicant.contact.email.trim()
      }
      return undefined
    }
    return resolveRegistrationEmail(applicant, options).email
  }

  // Date of Birth
  if (path === 'personalInfo.dateOfBirth' || path === 'appl.birthdate' || path === 'birthdate') {
    if (applicant.personalInfo?.dateOfBirth && applicant.personalInfo.dateOfBirth.trim() !== '') {
      return applicant.personalInfo.dateOfBirth.trim()
    }
    return undefined
  }

  const parts = path.split('.')
  let current: unknown = applicant

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      current = undefined
      break
    }
    current = (current as Record<string, unknown>)[part]
  }

  if (current !== null && current !== undefined) {
    const strVal = String(current).trim()
    if (strVal !== '') {
      return strVal
    }
  }

  // Fallbacks for specific paths
  if (path === 'presentAddress.country' && applicant.registration?.applyingFromCountry) {
    return applicant.registration.applyingFromCountry
  }
  if (path === 'personalInfo.nationality' && applicant.registration?.nationality) {
    return applicant.registration.nationality
  }
  if ((path === 'contact.emailConfirm' || path === 'contact.email_re') && applicant.contact?.email) {
    return applicant.contact.email
  }

  // Cross-lookup fallback for phone, mobile, isdCode between contact and presentAddress
  if (path === 'presentAddress.isdCode' && applicant.contact?.isdCode) {
    return applicant.contact.isdCode
  }
  if (path === 'contact.isdCode' && applicant.presentAddress?.isdCode) {
    return applicant.presentAddress.isdCode
  }
  if (path === 'presentAddress.phone' && applicant.contact?.phone) {
    return applicant.contact.phone
  }
  if (path === 'contact.phone' && applicant.presentAddress?.phone) {
    return applicant.presentAddress.phone
  }
  if (path === 'presentAddress.mobile' && applicant.contact?.mobile) {
    return applicant.contact.mobile
  }
  if (path === 'contact.mobile' && applicant.presentAddress?.mobile) {
    return applicant.presentAddress.mobile
  }

  return undefined
}

