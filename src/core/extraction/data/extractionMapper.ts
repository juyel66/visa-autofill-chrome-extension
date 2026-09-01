import type { ApplicantProfile } from '../../applicant/types'
import { normalizeApplicant } from '../../normalization'
import type { ExtractedApplicantData } from './types'

/**
 * Maps user-confirmed candidate extraction data into an ApplicantProfile object for autofill.
 * 
 * Rules:
 * 1. Confirmed PDF candidate data is the sole source of truth for personal and passport fields.
 * 2. Does NOT fall back to pre-existing applicant profile personal or passport values.
 * 3. Any field missing in confirmedData is left undefined (requiring manual input if required by form).
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
      nationalIdNumber: p.nationalIdNumber?.value ? p.nationalIdNumber.value : undefined,
      religion: p.religion?.value ? p.religion.value : undefined,
      educationalQualification: p.educationalQualification?.value ? p.educationalQualification.value : undefined,
      previousNationality: p.previousNationality?.value ? p.previousNationality.value : undefined,
    },
    passport: {
      passportNumber: pass.passportNumber?.value ? pass.passportNumber.value : undefined,
      passportType: pass.passportType?.value ? pass.passportType.value : undefined,
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
