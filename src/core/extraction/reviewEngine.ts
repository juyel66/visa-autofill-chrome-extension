import type { ApplicantProfile } from '../applicant/types'
import { validateApplicant } from '../validation/applicantValidation'
import type { ValidationResult } from '../validation/validation.types'
import type {
  ExtractedApplicantData,
  ExtractedFieldReviewItem,
  ExtractedFieldReviewStatus,
  ExtractionSource,
  ProfileUpdateReviewResult,
  ReviewDecision,
} from './data/types'

export const isReviewStale = (
  applicant: ApplicantProfile,
  snapshotTimestamp: string
): boolean => {
  if (!applicant.updatedAt || !snapshotTimestamp) return false
  const updatedTime = new Date(applicant.updatedAt).getTime()
  const snapshotTime = new Date(snapshotTimestamp).getTime()
  return updatedTime > snapshotTime
}

export const compareApplicantWithExtraction = (
  applicant: ApplicantProfile,
  extracted: ExtractedApplicantData,
  documentId?: string
): ProfileUpdateReviewResult => {
  const reviewItems: ExtractedFieldReviewItem[] = []
  const snapshotTimestamp = applicant.updatedAt || new Date().toISOString()

  // Helper to register comparison item
  const checkField = (
    fieldPath: string,
    label: string,
    existingVal: string | undefined,
    extractedField: { value?: string; source?: ExtractionSource; confidence?: number } | undefined
  ) => {
    if (!extractedField || extractedField.value === undefined || extractedField.value === null) {
      return
    }

    const existingTrimmed = (existingVal || '').trim()
    const extractedTrimmed = String(extractedField.value).trim()

    if (!extractedTrimmed) return

    let status: ExtractedFieldReviewStatus
    let decision: ReviewDecision

    if (!existingTrimmed) {
      status = 'new'
      decision = 'use-extracted'
    } else if (existingTrimmed.toLowerCase() === extractedTrimmed.toLowerCase()) {
      status = 'matches'
      decision = 'use-extracted'
    } else {
      status = 'conflict'
      decision = 'use-extracted'
    }

    reviewItems.push({
      fieldPath,
      label,
      existingValue: existingTrimmed || undefined,
      extractedValue: extractedTrimmed,
      status,
      source: extractedField.source,
      confidence: extractedField.confidence,
      decision,
    })
  }

  // Personal Info
  if (extracted.personal) {
    checkField(
      'personalInfo.givenNames',
      'Given Name(s)',
      applicant.personalInfo?.givenNames,
      extracted.personal.firstName || extracted.personal.fullName
    )
    checkField('personalInfo.surname', 'Surname', applicant.personalInfo?.surname, extracted.personal.lastName)
    checkField('personalInfo.dateOfBirth', 'Date of Birth', applicant.personalInfo?.dateOfBirth, extracted.personal.dateOfBirth)
    checkField('personalInfo.townCityOfBirth', 'Town/City of Birth', applicant.personalInfo?.townCityOfBirth, extracted.personal.townCityOfBirth)
    checkField('personalInfo.countryOfBirth', 'Country of Birth', applicant.personalInfo?.countryOfBirth, extracted.personal.countryOfBirth)
    checkField(
      'personalInfo.gender',
      'Gender',
      applicant.personalInfo?.gender,
      extracted.personal.gender
        ? {
            value: String(extracted.personal.gender.value),
            source: extracted.personal.gender.source,
            confidence: extracted.personal.gender.confidence,
          }
        : undefined
    )
    checkField('personalInfo.nationality', 'Nationality', applicant.personalInfo?.nationality, extracted.personal.nationality)
    checkField('personalInfo.nationalIdNumber', 'Citizenship / National ID', applicant.personalInfo?.nationalIdNumber, extracted.personal.nationalIdNumber)
    checkField('personalInfo.religion', 'Religion', applicant.personalInfo?.religion, extracted.personal.religion)
    checkField('personalInfo.educationalQualification', 'Educational Qualification', applicant.personalInfo?.educationalQualification, extracted.personal.educationalQualification)
    checkField('personalInfo.previousNationality', 'Previous Nationality', applicant.personalInfo?.previousNationality, extracted.personal.previousNationality)
  }

  // Passport Info
  if (extracted.passport) {
    checkField('passport.passportNumber', 'Passport Number', applicant.passport?.passportNumber, extracted.passport.passportNumber)
    checkField('passport.passportType', 'Passport Type', applicant.passport?.passportType, extracted.passport.passportType)
    checkField('passport.issuingCountry', 'Issuing Country', applicant.passport?.issuingCountry, extracted.passport.issuingCountry)
    checkField('passport.issueDate', 'Issue Date', applicant.passport?.issueDate, extracted.passport.issueDate)
    checkField('passport.expiryDate', 'Expiry Date', applicant.passport?.expiryDate, extracted.passport.expiryDate)
    checkField('passport.placeOfIssue', 'Place of Issue', applicant.passport?.placeOfIssue, extracted.passport.placeOfIssue)
  }

  // Contact Info
  if (extracted.contact) {
    checkField('contact.email', 'Email Address', applicant.contact?.email, extracted.contact.email)
    checkField('contact.mobile', 'Mobile Phone', applicant.contact?.mobile, extracted.contact.mobile)
    checkField('contact.phone', 'Phone', applicant.contact?.phone, extracted.contact.phone)
  }

  return {
    applicantId: applicant.applicantId,
    documentId,
    snapshotTimestamp,
    reviewItems,
    isStale: false,
  }
}

export const applyReviewDecisions = (
  applicant: ApplicantProfile,
  reviewItems: ExtractedFieldReviewItem[]
): { updatedProfile: ApplicantProfile; validation: ValidationResult } => {
  // Immutably clone applicant
  const updated: ApplicantProfile = JSON.parse(JSON.stringify(applicant))

  reviewItems.forEach((item) => {
    let targetValue: string | undefined

    if (item.decision === 'use-extracted') {
      targetValue = item.extractedValue
    } else if (item.decision === 'edit') {
      targetValue = item.editedValue !== undefined ? item.editedValue : item.extractedValue
    } else {
      // keep-existing or ignore
      return
    }

    if (targetValue === undefined) return

    // Apply by field path safely
    const parts = item.fieldPath.split('.')
    if (parts.length === 2) {
      const sectionKey = parts[0] as keyof ApplicantProfile
      const fieldKey = parts[1]

      if (sectionKey && fieldKey) {
        if (!updated[sectionKey] || typeof updated[sectionKey] !== 'object') {
          ;(updated as unknown as Record<string, unknown>)[sectionKey] = {}
        }
        const targetSection = updated[sectionKey] as unknown as Record<string, unknown>
        targetSection[fieldKey] = targetValue
      }
    }
  })

  updated.updatedAt = new Date().toISOString()
  const validation = validateApplicant(updated)

  return {
    updatedProfile: updated,
    validation,
  }
}
