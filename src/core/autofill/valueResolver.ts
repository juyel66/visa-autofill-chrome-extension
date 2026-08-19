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
  if (path === 'registration.indianMission') {
    if (applicant.notes) {
      const match = applicant.notes.match(/(?:indian\s+)?mission\s*:\s*([^\r\n]+)/i)
      if (match && match[1]) {
        return match[1].trim()
      }
    }
    const city = applicant.presentAddress?.villageTownCity?.toLowerCase() || ''
    const country = applicant.presentAddress?.country?.toLowerCase() || ''
    if (country === 'bangladesh' || country.includes('bangladesh')) {
      if (city.includes('dhaka')) return 'BANGLADESH-DHAKA'
      if (city.includes('chittagong')) return 'BANGLADESH-CHITTAGONG'
      if (city.includes('sylhet')) return 'BANGLADESH-SYLHET'
      if (city.includes('rajshahi')) return 'BANGLADESH-RAJSHAHI'
      if (city.includes('khulna')) return 'BANGLADESH-KHULNA'
    }
    return undefined
  }

  const parts = path.split('.')
  let current: unknown = applicant

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  if (current === null || current === undefined) {
    return undefined
  }

  const strVal = String(current).trim()
  return strVal !== '' ? strVal : undefined
}
