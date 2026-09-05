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
    checkField('personalInfo.maritalStatus', 'Marital Status', applicant.personalInfo?.maritalStatus, extracted.personal.maritalStatus)
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

  // Present Address Info
  if (extracted.presentAddress) {
    checkField('presentAddress.addressLine1', 'Present Address Line 1', applicant.presentAddress?.addressLine1, extracted.presentAddress.addressLine1)
    checkField('presentAddress.addressLine2', 'Present Address Line 2', applicant.presentAddress?.addressLine2, extracted.presentAddress.addressLine2)
    checkField('presentAddress.villageTownCity', 'Present City/Town/Village', applicant.presentAddress?.villageTownCity, extracted.presentAddress.villageTownCity)
    checkField('presentAddress.district', 'Present District', applicant.presentAddress?.district, extracted.presentAddress.district)
    checkField('presentAddress.stateProvince', 'Present State/Province', applicant.presentAddress?.stateProvince, extracted.presentAddress.stateProvince)
    checkField('presentAddress.country', 'Present Country', applicant.presentAddress?.country, extracted.presentAddress.country)
    checkField('presentAddress.postalCode', 'Present Postal Code', applicant.presentAddress?.postalCode, extracted.presentAddress.postalCode)
  }

  // Permanent Address Info
  if (extracted.permanentAddress) {
    checkField('permanentAddress.addressLine1', 'Permanent Address Line 1', applicant.permanentAddress?.addressLine1, extracted.permanentAddress.addressLine1)
    checkField('permanentAddress.addressLine2', 'Permanent Address Line 2', applicant.permanentAddress?.addressLine2, extracted.permanentAddress.addressLine2)
    checkField('permanentAddress.villageTownCity', 'Permanent City/Town/Village', applicant.permanentAddress?.villageTownCity, extracted.permanentAddress.villageTownCity)
    checkField('permanentAddress.district', 'Permanent District', applicant.permanentAddress?.district, extracted.permanentAddress.district)
    checkField('permanentAddress.stateProvince', 'Permanent State/Province', applicant.permanentAddress?.stateProvince, extracted.permanentAddress.stateProvince)
    checkField('permanentAddress.country', 'Permanent Country', applicant.permanentAddress?.country, extracted.permanentAddress.country)
    checkField('permanentAddress.postalCode', 'Permanent Postal Code', applicant.permanentAddress?.postalCode, extracted.permanentAddress.postalCode)
  }

  // Family Info
  if (extracted.family) {
    if (extracted.family.father) {
      checkField('family.father.name', "Father's Name", applicant.family?.father?.name, extracted.family.father.name)
      checkField('family.father.placeOfBirth', "Father's Place of Birth", applicant.family?.father?.placeOfBirth, extracted.family.father.placeOfBirth)
      checkField('family.father.countryOfBirth', "Father's Country of Birth", applicant.family?.father?.countryOfBirth, extracted.family.father.countryOfBirth)
      checkField('family.father.nationality', "Father's Nationality", applicant.family?.father?.nationality, extracted.family.father.nationality)
      checkField('family.father.previousNationality', "Father's Previous Nationality", applicant.family?.father?.previousNationality, extracted.family.father.previousNationality)
    }
    if (extracted.family.mother) {
      checkField('family.mother.name', "Mother's Name", applicant.family?.mother?.name, extracted.family.mother.name)
      checkField('family.mother.placeOfBirth', "Mother's Place of Birth", applicant.family?.mother?.placeOfBirth, extracted.family.mother.placeOfBirth)
      checkField('family.mother.countryOfBirth', "Mother's Country of Birth", applicant.family?.mother?.countryOfBirth, extracted.family.mother.countryOfBirth)
      checkField('family.mother.nationality', "Mother's Nationality", applicant.family?.mother?.nationality, extracted.family.mother.nationality)
      checkField('family.mother.previousNationality', "Mother's Previous Nationality", applicant.family?.mother?.previousNationality, extracted.family.mother.previousNationality)
    }
    if (extracted.family.spouse) {
      checkField('family.spouse.name', "Spouse's Name", applicant.family?.spouse?.name, extracted.family.spouse.name)
      checkField('family.spouse.placeOfBirth', "Spouse's Place of Birth", applicant.family?.spouse?.placeOfBirth, extracted.family.spouse.placeOfBirth)
      checkField('family.spouse.countryOfBirth', "Spouse's Country of Birth", applicant.family?.spouse?.countryOfBirth, extracted.family.spouse.countryOfBirth)
      checkField('family.spouse.nationality', "Spouse's Nationality", applicant.family?.spouse?.nationality, extracted.family.spouse.nationality)
      checkField('family.spouse.previousNationality', "Spouse's Previous Nationality", applicant.family?.spouse?.previousNationality, extracted.family.spouse.previousNationality)
    }
    checkField(
      'family.hasPakistanRelation',
      'Grandparent Pakistan Relation',
      applicant.family?.hasPakistanRelation !== undefined ? String(applicant.family.hasPakistanRelation) : undefined,
      extracted.family.hasPakistanRelation
        ? {
            value: String(extracted.family.hasPakistanRelation.value),
            source: extracted.family.hasPakistanRelation.source,
            confidence: extracted.family.hasPakistanRelation.confidence,
          }
        : undefined
    )
    checkField('family.pakistanRelationDetails', 'Grandparent Relation Details', applicant.family?.pakistanRelationDetails, extracted.family.pakistanRelationDetails)
  }

  // Employment Info
  if (extracted.employment) {
    checkField('employment.presentOccupation', 'Present Occupation', applicant.employment?.presentOccupation, extracted.employment.presentOccupation)
    checkField('employment.employerName', 'Employer Name', applicant.employment?.employerName, extracted.employment.employerName)
    checkField('employment.designationRank', 'Employer Designation', applicant.employment?.designationRank, extracted.employment.designationRank)
    checkField(
      'employment.employerAddress',
      'Employer Address',
      typeof applicant.employment?.employerAddress === 'string' ? applicant.employment.employerAddress : undefined,
      extracted.employment.employerAddress
    )
    checkField('employment.employerPhone', 'Employer Phone', applicant.employment?.employerPhone, extracted.employment.employerPhone)
    checkField('employment.pastOccupation', 'Past Occupation', applicant.employment?.pastOccupation, extracted.employment.pastOccupation)
    checkField('employment.militaryOrganization', 'Military Organization', applicant.employment?.militaryOrganization, extracted.employment.militaryOrganization)
    checkField('employment.militaryDesignation', 'Military Designation', applicant.employment?.militaryDesignation, extracted.employment.militaryDesignation)
    checkField('employment.militaryRank', 'Military Rank', applicant.employment?.militaryRank, extracted.employment.militaryRank)
    checkField('employment.militaryPlaceOfPosting', 'Military Posting', applicant.employment?.militaryPlaceOfPosting, extracted.employment.militaryPlaceOfPosting)
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

    // Apply by nested field path safely
    const parts = item.fieldPath.split('.')
    let curr: Record<string, unknown> = updated as unknown as Record<string, unknown>
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i]
      if (!curr[key] || typeof curr[key] !== 'object') {
        curr[key] = {}
      }
      curr = curr[key] as Record<string, unknown>
    }
    const finalKey = parts[parts.length - 1]
    if (finalKey) {
      curr[finalKey] = targetValue
    }
  })

  updated.updatedAt = new Date().toISOString()
  const validation = validateApplicant(updated)

  return {
    updatedProfile: updated,
    validation,
  }
}
