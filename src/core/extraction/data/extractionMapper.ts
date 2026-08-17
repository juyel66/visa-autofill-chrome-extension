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
      ...applicant.personalInfo,
      surname: p.lastName?.value ? p.lastName.value : applicant.personalInfo.surname,
      givenNames: p.firstName?.value ? p.firstName.value : applicant.personalInfo.givenNames,
      dateOfBirth: p.dateOfBirth?.value ? p.dateOfBirth.value : applicant.personalInfo.dateOfBirth,
      gender: p.gender?.value ? p.gender.value : applicant.personalInfo.gender,
      nationality: p.nationality?.value ? p.nationality.value : applicant.personalInfo.nationality,
      townCityOfBirth: p.townCityOfBirth?.value
        ? p.townCityOfBirth.value
        : applicant.personalInfo.townCityOfBirth,
      countryOfBirth: p.countryOfBirth?.value
        ? p.countryOfBirth.value
        : applicant.personalInfo.countryOfBirth,
    },
    passport: {
      ...applicant.passport,
      passportNumber: pass.passportNumber?.value
        ? pass.passportNumber.value
        : applicant.passport.passportNumber,
      issuingCountry: pass.issuingCountry?.value
        ? pass.issuingCountry.value
        : applicant.passport.issuingCountry,
      expiryDate: pass.expiryDate?.value ? pass.expiryDate.value : applicant.passport.expiryDate,
      issueDate: pass.issueDate?.value ? pass.issueDate.value : applicant.passport.issueDate,
    },
    contact: {
      ...applicant.contact,
      email: c.email?.value ? c.email.value : applicant.contact.email,
      mobile: c.mobile?.value ? c.mobile.value : applicant.contact.mobile,
      phone: c.phone?.value ? c.phone.value : applicant.contact.phone,
    },
  }

  // Immutable normalization pass
  return normalizeApplicant(merged)
}
