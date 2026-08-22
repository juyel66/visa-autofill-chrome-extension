import type { ApplicantProfile } from '../../applicant/types'
import { normalizeApplicant } from '../../normalization'
import type { ExtractedApplicantData } from './types'

/**
 * Safely merges user-confirmed candidate extraction data into an existing ApplicantProfile object.
 * 
 * Rules:
 * 1. Does NOT mutate original input applicant.
 * 2. Only overwrites fields that are explicitly provided with non-empty values in confirmedData.
 * 3. Preserves all existing profile values when extraction data has no value.
 * 4. Runs normalizeApplicant() on the final merged object.
 * 5. Updates the updatedAt ISO timestamp.
 */
export function applyExtractionToApplicant(
  applicant: ApplicantProfile,
  confirmedData: ExtractedApplicantData
): ApplicantProfile {
  if (!applicant) {
    throw new Error('Target applicant profile is required for data mapping.')
  }

  const now = new Date().toISOString()

  const p = confirmedData.personal || {}
  const pass = confirmedData.passport || {}
  const c = confirmedData.contact || {}

  const merged: ApplicantProfile = {
    ...applicant,
    updatedAt: now,
    personalInfo: {
      surname: p.lastName?.value ? p.lastName.value : undefined,
      givenNames: p.firstName?.value ? p.firstName.value : undefined,
      dateOfBirth: p.dateOfBirth?.value ? p.dateOfBirth.value : undefined,
      gender: p.gender?.value ? p.gender.value : undefined,
      nationality: p.nationality?.value ? p.nationality.value : undefined,
      townCityOfBirth: p.townCityOfBirth?.value ? p.townCityOfBirth.value : undefined,
      countryOfBirth: p.countryOfBirth?.value ? p.countryOfBirth.value : undefined,
    },
    passport: {
      passportNumber: pass.passportNumber?.value ? pass.passportNumber.value : undefined,
      issuingCountry: pass.issuingCountry?.value ? pass.issuingCountry.value : undefined,
      expiryDate: pass.expiryDate?.value ? pass.expiryDate.value : undefined,
      issueDate: pass.issueDate?.value ? pass.issueDate.value : undefined,
      placeOfIssue: pass.placeOfIssue?.value ? pass.placeOfIssue.value : undefined,
    },
    contact: {
      email: c.email?.value ? c.email.value : undefined,
      mobile: c.mobile?.value ? c.mobile.value : undefined,
      phone: c.phone?.value ? c.phone.value : undefined,
    },
  }

  // Immutable normalization pass
  return normalizeApplicant(merged)
}
