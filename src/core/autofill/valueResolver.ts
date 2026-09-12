import type { ApplicantProfile } from '../applicant/types'

/**
 * Safely resolves nested string values from ApplicantProfile without using eval().
 */
export function resolveApplicantValue(
  applicant: ApplicantProfile,
  path?: string
): string | undefined {
  if (!applicant || !path) return undefined

  // Special derivation logic for Indian Mission
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
    const country = applicant.presentAddress?.country?.toLowerCase() || applicant.registration?.applyingFromCountry?.toLowerCase() || ''
    if (country === 'bangladesh' || country.includes('bangladesh')) {
      if (city.includes('dhaka')) return 'BANGLADESH-DHAKA'
      if (city.includes('chittagong')) return 'BANGLADESH-CHITTAGONG'
      if (city.includes('sylhet')) return 'BANGLADESH-SYLHET'
      if (city.includes('rajshahi')) return 'BANGLADESH-RAJSHAHI'
      if (city.includes('khulna')) return 'BANGLADESH-KHULNA'
    }
    return undefined
  }

  // Journey Date
  if (path === 'travel.intendedArrivalDate' || path === 'appl.journeydate' || path === 'journeydate') {
    if (applicant.travel?.intendedArrivalDate && applicant.travel.intendedArrivalDate.trim() !== '') {
      return applicant.travel.intendedArrivalDate.trim()
    }
  }

  // Country
  if (path === 'presentAddress.country' || path === 'appl.countryname' || path === 'present_country') {
    if (applicant.presentAddress?.country && applicant.presentAddress.country.trim() !== '') {
      return applicant.presentAddress.country.trim()
    }
    if (applicant.registration?.applyingFromCountry && applicant.registration.applyingFromCountry.trim() !== '') {
      return applicant.registration.applyingFromCountry.trim()
    }
  }

  // Nationality
  if (path === 'personalInfo.nationality' || path === 'appl.nationality' || path === 'nationality') {
    if (applicant.personalInfo?.nationality && applicant.personalInfo.nationality.trim() !== '') {
      return applicant.personalInfo.nationality.trim()
    }
    if (applicant.registration?.nationality && applicant.registration.nationality.trim() !== '') {
      return applicant.registration.nationality.trim()
    }
  }

  // Email & Confirm Email
  if (
    path === 'contact.email' ||
    path === 'contact.emailConfirm' ||
    path === 'contact.email_re' ||
    path === 'appl.email' ||
    path === 'appl.email_re' ||
    path === 'email'
  ) {
    if (applicant.contact?.email && applicant.contact.email.trim() !== '') {
      return applicant.contact.email.trim()
    }
  }

  // Date of Birth
  if (path === 'personalInfo.dateOfBirth' || path === 'appl.birthdate' || path === 'birthdate') {
    if (applicant.personalInfo?.dateOfBirth && applicant.personalInfo.dateOfBirth.trim() !== '') {
      return applicant.personalInfo.dateOfBirth.trim()
    }
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
