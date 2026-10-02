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
  options?: { accountEmail?: string; disableTemporaryEmail?: boolean; disableEmploymentDefaults?: boolean }
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
  if (
    path === 'presentAddress.country' ||
    path === 'permanentAddress.country' ||
    path === 'appl.countryname' ||
    path === 'present_country' ||
    path === 'perm_country' ||
    path === 'appl.pres_country' ||
    path === 'appl.perm_country' ||
    path === 'country_name' ||
    path === 'registration.applyingFromCountry'
  ) {
    if (applicant.presentAddress?.country && applicant.presentAddress.country.trim() !== '') {
      return applicant.presentAddress.country.trim()
    }
    if (applicant.permanentAddress?.country && applicant.permanentAddress.country.trim() !== '') {
      return applicant.permanentAddress.country.trim()
    }
    if (applicant.registration?.applyingFromCountry && applicant.registration.applyingFromCountry.trim() !== '') {
      return applicant.registration.applyingFromCountry.trim()
    }
    const nat = applicant.personalInfo?.nationality?.trim() || applicant.passport?.issuingCountry?.trim()
    if (nat) {
      const upper = nat.toUpperCase()
      if (upper === 'BANGLADESH' || upper === 'BANGLADESHI' || upper === 'BGD') {
        return 'BANGLADESH'
      }
      return nat
    }
    return undefined
  }

  // ISD Code
  if (
    path === 'contact.isdCode' ||
    path === 'presentAddress.isdCode' ||
    path === 'appl.isd_code' ||
    path === 'isd_code' ||
    path === 'pres_phone_isd' ||
    path === 'mobile_isd'
  ) {
    const isd = applicant.contact?.isdCode || applicant.presentAddress?.isdCode
    if (isd && isd.trim() !== '') {
      return isd.trim()
    }
    const nat = applicant.personalInfo?.nationality?.trim() || applicant.passport?.issuingCountry?.trim()
    if (nat) {
      const upper = nat.toUpperCase()
      if (upper === 'BANGLADESH' || upper === 'BANGLADESHI' || upper === 'BGD') {
        return '880'
      }
      return undefined
    }
    return undefined
  }

  // Helper to sanitize District & State names (filter out invalid tokens like "IN", "BD", country names)
  const sanitizeDistrict = (val?: string): string | undefined => {
    if (!val) return undefined
    const clean = val.trim()
    const upper = clean.toUpperCase()
    if (['IN', 'BD', 'BGD', 'IND', 'INDIA', 'BANGLADESH'].includes(upper) || clean.length <= 2) {
      return undefined
    }
    return clean
  }

  // Address Line 1
  if (path === 'presentAddress.addressLine1' || path === 'appl.pres_add1' || path === 'pres_addr1' || path === 'pres_add1') {
    const raw = applicant.presentAddress?.addressLine1 || applicant.permanentAddress?.addressLine1
    return raw ? raw.replace(/,\s*/g, ', ').trim() : undefined
  }
  if (path === 'permanentAddress.addressLine1' || path === 'appl.perm_add1' || path === 'perm_addr1' || path === 'perm_add1') {
    const raw = applicant.permanentAddress?.addressLine1 || applicant.presentAddress?.addressLine1
    return raw ? raw.replace(/,\s*/g, ', ').trim() : undefined
  }

  // Address Line 2
  if (path === 'presentAddress.addressLine2' || path === 'appl.pres_add2' || path === 'pres_addr2' || path === 'pres_add2') {
    const raw = (
      applicant.presentAddress?.addressLine2 ||
      applicant.presentAddress?.villageTownCity ||
      applicant.permanentAddress?.addressLine2 ||
      applicant.permanentAddress?.villageTownCity
    )
    return raw ? raw.replace(/,\s*/g, ', ').trim() : undefined
  }
  if (
    path === 'permanentAddress.addressLine2' ||
    path === 'appl.perm_add2' ||
    path === 'perm_addr2' ||
    path === 'perm_add2' ||
    path === 'perm_address2'
  ) {
    const raw = (
      applicant.permanentAddress?.addressLine2 ||
      applicant.permanentAddress?.villageTownCity ||
      applicant.presentAddress?.addressLine2 ||
      applicant.presentAddress?.villageTownCity ||
      ''
    ).trim()
    if (!raw) return undefined
    return raw.toUpperCase().replace(/,\s*/g, ', ')
  }

  if (
    path === 'permanentAddress.villageTownCity' ||
    path === 'appl.perm_city' ||
    path === 'permanent_village_town_city' ||
    path === 'perm_city'
  ) {
    const raw = (
      applicant.permanentAddress?.villageTownCity ||
      applicant.permanentAddress?.addressLine2 ||
      applicant.presentAddress?.villageTownCity ||
      applicant.presentAddress?.addressLine2 ||
      ''
    ).trim()
    if (!raw) return undefined
    return raw.toUpperCase().replace(/,\s*/g, ', ')
  }

  // Village / Town / City (Present Address)
  if (path === 'presentAddress.villageTownCity' || path === 'appl.pres_city' || path === 'village_town_city') {
    const raw = (
      applicant.presentAddress?.villageTownCity ||
      applicant.presentAddress?.addressLine2 ||
      applicant.permanentAddress?.villageTownCity ||
      applicant.permanentAddress?.addressLine2
    )
    return raw ? raw.replace(/,\s*/g, ', ').trim() : undefined
  }

  // State / Province / District
  if (
    path === 'presentAddress.stateProvince' ||
    path === 'presentAddress.district' ||
    path === 'presentAddress.state_name' ||
    path === 'appl.state_name' ||
    path === 'appl.pres_state' ||
    path === 'pres_state' ||
    path === 'state_name' ||
    path === 'pres_city' ||
    path === 'pres_add3'
  ) {
    const d =
      sanitizeDistrict(applicant.presentAddress?.district) ||
      sanitizeDistrict(applicant.presentAddress?.stateProvince) ||
      sanitizeDistrict(applicant.permanentAddress?.district) ||
      sanitizeDistrict(applicant.permanentAddress?.stateProvince) ||
      sanitizeDistrict(applicant.personalInfo?.townCityOfBirth)
    if (d) return d
  }
  if (
    path === 'permanentAddress.stateProvince' ||
    path === 'permanentAddress.district' ||
    path === 'appl.perm_state' ||
    path === 'perm_state' ||
    path === 'perm_city' ||
    path === 'perm_add3' ||
    path === 'permanent_district' ||
    path === 'permanent_state_province'
  ) {
    const d =
      sanitizeDistrict(applicant.permanentAddress?.district) ||
      sanitizeDistrict(applicant.permanentAddress?.stateProvince) ||
      sanitizeDistrict(applicant.presentAddress?.district) ||
      sanitizeDistrict(applicant.presentAddress?.stateProvince) ||
      sanitizeDistrict(applicant.personalInfo?.townCityOfBirth)
    if (d) return d
  }

  // Postal / Zip Code
  if (path === 'presentAddress.postalCode' || path === 'appl.pincode' || path === 'pincode' || path === 'pres_postal_code') {
    return applicant.presentAddress?.postalCode || applicant.permanentAddress?.postalCode
  }
  if (path === 'permanentAddress.postalCode' || path === 'appl.perm_pincode' || path === 'perm_pincode' || path === 'perm_postal_code' || path === 'permanent_postal_code') {
    return applicant.permanentAddress?.postalCode || applicant.presentAddress?.postalCode
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

  // Previous Name & Surname
  if (path === 'personalInfo.previousSurname' || path === 'appl.prev_surname' || path === 'prev_surname') {
    if (applicant.personalInfo?.previousSurname && applicant.personalInfo.previousSurname.trim() !== '') {
      return applicant.personalInfo.previousSurname.trim()
    }
    return undefined
  }

  if (
    path === 'personalInfo.previousGivenNames' ||
    path === 'personalInfo.previousName' ||
    path === 'appl.prev_name' ||
    path === 'prev_name'
  ) {
    if (applicant.personalInfo?.previousGivenNames && applicant.personalInfo.previousGivenNames.trim() !== '') {
      return applicant.personalInfo.previousGivenNames.trim()
    }
    if (applicant.personalInfo?.previousName && applicant.personalInfo.previousName.trim() !== '') {
      return applicant.personalInfo.previousName.trim()
    }
    return undefined
  }

  // Date of Birth
  if (path === 'personalInfo.dateOfBirth' || path === 'appl.birthdate' || path === 'birthdate') {
    if (applicant.personalInfo?.dateOfBirth && applicant.personalInfo.dateOfBirth.trim() !== '') {
      return applicant.personalInfo.dateOfBirth.trim()
    }
    return undefined
  }

  // Town / City of Birth (Place of Birth strictly from document or blank)
  if (
    path === 'personalInfo.townCityOfBirth' ||
    path === 'appl.placbrth' ||
    path === 'placbrth' ||
    path === 'birth_place'
  ) {
    if (applicant.personalInfo?.townCityOfBirth && applicant.personalInfo.townCityOfBirth.trim() !== '') {
      return applicant.personalInfo.townCityOfBirth.trim().toUpperCase()
    }
    return undefined
  }

  // Passport Date of Issue
  if (
    path === 'passport.issueDate' ||
    path === 'appl.passport_issue_date' ||
    path === 'passport_issue_date' ||
    path === 'appl.issuedate' ||
    path === 'issuedate'
  ) {
    if (applicant.passport?.issueDate && applicant.passport.issueDate.trim() !== '') {
      return applicant.passport.issueDate.trim()
    }
    return undefined
  }

  // Present Occupation
  if (
    path === 'employment.presentOccupation' ||
    path === 'appl.occupation' ||
    path === 'occupation' ||
    path === 'present_occupation'
  ) {
    if (applicant.employment?.presentOccupation && applicant.employment.presentOccupation.trim() !== '') {
      return applicant.employment.presentOccupation.trim()
    }
    if (options?.disableEmploymentDefaults) {
      return undefined
    }
    return 'WORKER'
  }

  // Employer Name / Business (Defaults to candidate's full name: Given Name Surname)
  if (
    path === 'employment.employerName' ||
    path === 'appl.empname' ||
    path === 'empname' ||
    path === 'employer_name'
  ) {
    if (applicant.employment?.employerName && applicant.employment.employerName.trim() !== '') {
      return applicant.employment.employerName.trim().toUpperCase()
    }
    if (options?.disableEmploymentDefaults) {
      return undefined
    }
    const fullName = [applicant.personalInfo?.givenNames, applicant.personalInfo?.surname]
      .filter(Boolean)
      .join(' ')
      .trim()
      .toUpperCase()
    if (fullName) return fullName
    return undefined
  }

  // Designation (Defaults to WORKER)
  if (
    path === 'employment.designationRank' ||
    path === 'appl.empdesignation' ||
    path === 'empdesignation' ||
    path === 'designation'
  ) {
    if (applicant.employment?.designationRank && applicant.employment.designationRank.trim() !== '') {
      return applicant.employment.designationRank.trim().toUpperCase()
    }
    if (options?.disableEmploymentDefaults) {
      return undefined
    }
    return 'WORKER'
  }

  // Employer Address (Defaults to passport address excluding district)
  if (
    path === 'employment.employerAddress' ||
    path === 'appl.empaddress' ||
    path === 'empaddress' ||
    path === 'employer_address'
  ) {
    if (typeof applicant.employment?.employerAddress === 'string' && applicant.employment.employerAddress.trim() !== '') {
      return applicant.employment.employerAddress.trim().toUpperCase()
    }
    if (applicant.employment?.employerAddress && typeof applicant.employment.employerAddress === 'object') {
      const parts = [applicant.employment.employerAddress.addressLine1, applicant.employment.employerAddress.villageTownCity || applicant.employment.employerAddress.addressLine2].filter(Boolean)
      if (parts.length > 0) return parts.join(', ').trim().toUpperCase()
    }
    if (options?.disableEmploymentDefaults) {
      return undefined
    }
    const addr1 = applicant.presentAddress?.addressLine1 || applicant.permanentAddress?.addressLine1
    const addr2 = applicant.presentAddress?.villageTownCity || applicant.presentAddress?.addressLine2 || applicant.permanentAddress?.villageTownCity || applicant.permanentAddress?.addressLine2
    const combinedWithoutDist = [addr1, addr2].filter(Boolean).join(', ').trim().toUpperCase()
    if (combinedWithoutDist) return combinedWithoutDist
    return undefined
  }

  // Employer Phone (Defaults to candidate's phone starting with +88)
  if (
    path === 'employment.employerPhone' ||
    path === 'appl.empphone' ||
    path === 'empphone' ||
    path === 'employer_phone'
  ) {
    if (applicant.employment?.employerPhone && applicant.employment.employerPhone.trim() !== '') {
      return applicant.employment.employerPhone.trim()
    }
    const raw =
      applicant.contact?.phone ||
      applicant.presentAddress?.phone ||
      applicant.contact?.mobile ||
      applicant.presentAddress?.mobile
    if (raw) {
      const cleanDigits = raw.replace(/[^\d]/g, '')
      if (raw.startsWith('+880') || cleanDigits.startsWith('880')) {
        return `+880${cleanDigits.replace(/^880/, '')}`
      } else if (cleanDigits.startsWith('01') && cleanDigits.length === 11) {
        return `+88${cleanDigits}`
      } else if (cleanDigits.length === 10 && cleanDigits.startsWith('1')) {
        return `+880${cleanDigits}`
      }
      return raw.startsWith('+') ? raw : `+88${raw}`
    }
    return undefined
  }

  // Past Occupation (Defaults to PRIVATE SERVICE)
  if (
    path === 'employment.pastOccupation' ||
    path === 'appl.previous_occupation' ||
    path === 'previous_occupation'
  ) {
    if (applicant.employment?.pastOccupation && applicant.employment.pastOccupation.trim() !== '') {
      return applicant.employment.pastOccupation.trim()
    }
    return 'PRIVATE SERVICE'
  }

  // Grandparent / Pakistan Origin Relation Flag (Defaults strictly to 'No')
  if (
    path === 'family.hasPakistanRelation' ||
    path === 'appl.grandparent_flag' ||
    path === 'grandparent_flag'
  ) {
    if (
      applicant.family?.hasPakistanRelation === true ||
      (applicant.family?.hasPakistanRelation as unknown) === 'Yes' ||
      (applicant.family?.hasPakistanRelation as unknown) === 'Y' ||
      (applicant.family?.hasPakistanRelation as unknown) === 'true'
    ) {
      return 'Yes'
    }
    return 'No'
  }

  // Military / Police / Security Organization Service Flag (Defaults strictly to 'No')
  if (
    path === 'employment.hasMilitaryService' ||
    path === 'appl.prev_org' ||
    path === 'prev_org'
  ) {
    if (
      applicant.employment?.hasMilitaryService === true ||
      (applicant.employment?.hasMilitaryService as unknown) === 'Yes' ||
      (applicant.employment?.hasMilitaryService as unknown) === 'Y' ||
      (applicant.employment?.hasMilitaryService as unknown) === 'true'
    ) {
      return 'Yes'
    }
    return 'No'
  }

  // Previous Visa Flag (Defaults to 'No' unless explicitly true/Yes)
  if (
    path === 'previousVisa.hasPreviousVisa' ||
    path === 'appl.old_visa_flag' ||
    path === 'old_visa_flag'
  ) {
    if (
      applicant.previousVisa?.hasPreviousVisa === true ||
      (applicant.previousVisa?.hasPreviousVisa as unknown) === 'Yes' ||
      (applicant.previousVisa?.hasPreviousVisa as unknown) === 'Y' ||
      (applicant.previousVisa?.hasPreviousVisa as unknown) === 'true'
    ) {
      return 'Yes'
    }
    return 'No'
  }

  // Refuse Flag (Defaults to 'No' unless explicitly true/Yes)
  if (
    path === 'previousVisa.hasRefusal' ||
    path === 'appl.refuse_flag' ||
    path === 'refuse_flag'
  ) {
    if (
      applicant.previousVisa?.hasRefusal === true ||
      (applicant.previousVisa?.hasRefusal as unknown) === 'Yes' ||
      (applicant.previousVisa?.hasRefusal as unknown) === 'Y' ||
      (applicant.previousVisa?.hasRefusal as unknown) === 'true'
    ) {
      return 'Yes'
    }
    return 'No'
  }

  // SAARC Visit Flag (Defaults to 'No' unless explicitly true/Yes)
  if (
    path === 'travel.visitedSaarc' ||
    path === 'appl.saarc_flag' ||
    path === 'saarc_flag'
  ) {
    if (
      applicant.travel?.visitedSaarc === true ||
      (applicant.travel?.visitedSaarc as unknown) === 'Yes' ||
      (applicant.travel?.visitedSaarc as unknown) === 'Y' ||
      (applicant.travel?.visitedSaarc as unknown) === 'true'
    ) {
      return 'Yes'
    }
    return 'No'
  }

  // Specify below occupation details of (occ_flag)
  if (
    path === 'employment.dependentRelation' ||
    path === 'appl.occ_flag' ||
    path === 'occ_flag' ||
    path === 'occ_details_of' ||
    path === 'appl.occ_details_of'
  ) {
    if (applicant.employment?.dependentRelation && applicant.employment.dependentRelation.trim() !== '') {
      return applicant.employment.dependentRelation.trim().toUpperCase()
    }
    // Fallback based on marital status
    const marital = applicant.personalInfo?.maritalStatus?.toLowerCase()
    if (applicant.employment?.presentOccupation?.toUpperCase().includes('HOUSE')) {
      return marital === 'married' ? 'HUSBAND' : 'FATHER'
    }
    if (applicant.employment?.presentOccupation?.toUpperCase() === 'STUDENT') {
      return 'FATHER'
    }
    return undefined
  }

  const extractFieldValue = (field: any): string | undefined => {
    if (field === null || field === undefined) return undefined
    if (typeof field === 'string' && field.trim() !== '') return field.trim()
    if (typeof field === 'number' || typeof field === 'boolean') return String(field).trim()
    if (typeof field === 'object') {
      const v = field.value
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        return String(v).trim()
      }
    }
    return undefined
  }

  // Religion
  if (
    path === 'personalInfo.religion' ||
    path === 'appl.religion' ||
    path === 'religion' ||
    path === 'basic_religion'
  ) {
    if (applicant.personalInfo?.religion && applicant.personalInfo.religion.trim() !== '') {
      return applicant.personalInfo.religion.trim().toUpperCase()
    }
    if ((applicant as any).religion && String((applicant as any).religion).trim() !== '') {
      return String((applicant as any).religion).trim().toUpperCase()
    }
    if ((applicant as any)['appl.religion'] && String((applicant as any)['appl.religion']).trim() !== '') {
      return String((applicant as any)['appl.religion']).trim().toUpperCase()
    }
    const rawFields = (applicant as any).fields
    if (rawFields && typeof rawFields === 'object') {
      const val =
        extractFieldValue(rawFields['appl.religion']) ??
        extractFieldValue(rawFields['religion']) ??
        extractFieldValue(rawFields['personalInfo.religion'])
      if (val) return val.toUpperCase()
    }
  }

  // Business Company in India details
  if (
    path === 'travel.businessCompanyName' ||
    path === 'appl.comp_name' ||
    path === 'comp_name' ||
    path === 'business_company_name' ||
    path === 'appl.business_company_name' ||
    path === 'appl.ind_comp_name'
  ) {
    if (applicant.travel?.businessCompanyName && applicant.travel.businessCompanyName.trim() !== '') {
      return applicant.travel.businessCompanyName.trim().toUpperCase()
    }
    if ((applicant as any).comp_name && String((applicant as any).comp_name).trim() !== '') {
      return String((applicant as any).comp_name).trim().toUpperCase()
    }
    if ((applicant as any)['appl.comp_name'] && String((applicant as any)['appl.comp_name']).trim() !== '') {
      return String((applicant as any)['appl.comp_name']).trim().toUpperCase()
    }
    if ((applicant as any).travel?.comp_name && String((applicant as any).travel.comp_name).trim() !== '') {
      return String((applicant as any).travel.comp_name).trim().toUpperCase()
    }
    const rawFields = (applicant as any).fields
    if (rawFields && typeof rawFields === 'object') {
      const fieldVal =
        extractFieldValue(rawFields['comp_name']) ??
        extractFieldValue(rawFields['appl.comp_name']) ??
        extractFieldValue(rawFields['travel.businessCompanyName']) ??
        extractFieldValue(rawFields['businessCompanyName']) ??
        extractFieldValue(rawFields['appl.business_company_name']) ??
        extractFieldValue(rawFields['appl.ind_comp_name'])
      if (fieldVal) {
        return fieldVal.toUpperCase()
      }
    }
  }

  if (
    path === 'travel.businessCompanyAddress' ||
    path === 'appl.comp_address' ||
    path === 'comp_address' ||
    path === 'business_address' ||
    path === 'appl.business_address' ||
    path === 'appl.ind_comp_address'
  ) {
    if (applicant.travel?.businessCompanyAddress && applicant.travel.businessCompanyAddress.trim() !== '') {
      return applicant.travel.businessCompanyAddress.trim().toUpperCase()
    }
    if ((applicant as any).comp_address && String((applicant as any).comp_address).trim() !== '') {
      return String((applicant as any).comp_address).trim().toUpperCase()
    }
    if ((applicant as any)['appl.comp_address'] && String((applicant as any)['appl.comp_address']).trim() !== '') {
      return String((applicant as any)['appl.comp_address']).trim().toUpperCase()
    }
    if ((applicant as any).travel?.comp_address && String((applicant as any).travel.comp_address).trim() !== '') {
      return String((applicant as any).travel.comp_address).trim().toUpperCase()
    }
    const rawFields = (applicant as any).fields
    if (rawFields && typeof rawFields === 'object') {
      const fieldVal =
        extractFieldValue(rawFields['comp_address']) ??
        extractFieldValue(rawFields['appl.comp_address']) ??
        extractFieldValue(rawFields['travel.businessCompanyAddress']) ??
        extractFieldValue(rawFields['businessCompanyAddress']) ??
        extractFieldValue(rawFields['appl.business_address']) ??
        extractFieldValue(rawFields['appl.ind_comp_address'])
      if (fieldVal) {
        return fieldVal.toUpperCase()
      }
    }
  }

  if (
    path === 'travel.businessCompanyPhone' ||
    path === 'appl.comp_phone' ||
    path === 'comp_phone' ||
    path === 'business_phone' ||
    path === 'appl.business_phone' ||
    path === 'appl.ind_comp_phone'
  ) {
    if (applicant.travel?.businessCompanyPhone && applicant.travel.businessCompanyPhone.trim() !== '') {
      return applicant.travel.businessCompanyPhone.trim()
    }
    if ((applicant as any).comp_phone && String((applicant as any).comp_phone).trim() !== '') {
      return String((applicant as any).comp_phone).trim()
    }
    if ((applicant as any)['appl.comp_phone'] && String((applicant as any)['appl.comp_phone']).trim() !== '') {
      return String((applicant as any)['appl.comp_phone']).trim()
    }
    if ((applicant as any).travel?.comp_phone && String((applicant as any).travel.comp_phone).trim() !== '') {
      return String((applicant as any).travel.comp_phone).trim()
    }
    const rawFields = (applicant as any).fields
    if (rawFields && typeof rawFields === 'object') {
      const fieldVal =
        extractFieldValue(rawFields['comp_phone']) ??
        extractFieldValue(rawFields['appl.comp_phone']) ??
        extractFieldValue(rawFields['travel.businessCompanyPhone']) ??
        extractFieldValue(rawFields['businessCompanyPhone']) ??
        extractFieldValue(rawFields['appl.business_phone']) ??
        extractFieldValue(rawFields['appl.ind_comp_phone'])
      if (fieldVal) {
        return fieldVal
      }
    }
  }

  if (
    path === 'travel.businessCompanyEmail' ||
    path === 'appl.comp_email' ||
    path === 'comp_email' ||
    path === 'business_email' ||
    path === 'appl.business_email' ||
    path === 'appl.ind_comp_email'
  ) {
    if (applicant.travel?.businessCompanyEmail && applicant.travel.businessCompanyEmail.trim() !== '') {
      return applicant.travel.businessCompanyEmail.trim()
    }
    if ((applicant as any).comp_email && String((applicant as any).comp_email).trim() !== '') {
      return String((applicant as any).comp_email).trim()
    }
    if ((applicant as any)['appl.comp_email'] && String((applicant as any)['appl.comp_email']).trim() !== '') {
      return String((applicant as any)['appl.comp_email']).trim()
    }
    if ((applicant as any).travel?.comp_email && String((applicant as any).travel.comp_email).trim() !== '') {
      return String((applicant as any).travel.comp_email).trim()
    }
    const rawFields = (applicant as any).fields
    if (rawFields && typeof rawFields === 'object') {
      const fieldVal =
        extractFieldValue(rawFields['comp_email']) ??
        extractFieldValue(rawFields['appl.comp_email']) ??
        extractFieldValue(rawFields['travel.businessCompanyEmail']) ??
        extractFieldValue(rawFields['businessCompanyEmail']) ??
        extractFieldValue(rawFields['appl.business_email']) ??
        extractFieldValue(rawFields['appl.ind_comp_email'])
      if (fieldVal) {
        return fieldVal
      }
    }
  }

  // Cities Visited in India
  if (path === 'previousVisa.citiesVisited' || path === 'appl.cities_visited' || path === 'cities_visited') {
    if (applicant.previousVisa?.citiesVisited && applicant.previousVisa.citiesVisited.trim() !== '') {
      return applicant.previousVisa.citiesVisited.trim().toUpperCase()
    }
    if (applicant.previousVisa?.visitedAddress3 && applicant.previousVisa.visitedAddress3.trim() !== '') {
      return applicant.previousVisa.visitedAddress3.trim().toUpperCase()
    }
  }

  // Sponsor State / District in India
  if (path === 'reference.state' || path === 'appl.stateofsponsor_ind' || path === 'stateofsponsor_ind' || path === 'sponsor_state') {
    if (applicant.reference?.state && applicant.reference.state.trim() !== '') {
      return applicant.reference.state.trim()
    }
  }

  if (path === 'reference.district' || path === 'appl.districtofsponsor_ind' || path === 'districtofsponsor_ind' || path === 'sponsor_district') {
    if (applicant.reference?.district && applicant.reference.district.trim() !== '') {
      return applicant.reference.district.trim().toUpperCase()
    }
  }

  // Port of Arrival in India
  if (
    path === 'travel.entryPoint' ||
    path === 'appl.entrypoint' ||
    path === 'entrypoint' ||
    path === 'entry_point' ||
    path === 'visa_entrypoint'
  ) {
    const rawTravel = applicant.travel as Record<string, any> | undefined
    if (rawTravel) {
      const ep = rawTravel.entryPoint ?? rawTravel.entrypoint ?? rawTravel.entry_point
      if (typeof ep === 'string' && ep.trim() !== '') return ep.trim()
      if (ep && typeof ep === 'object' && typeof ep.value === 'string' && ep.value.trim() !== '') {
        return ep.value.trim()
      }
      // Fallback to exitPoint if entryPoint is not set
      const xp = rawTravel.exitPoint ?? rawTravel.exitpoint ?? rawTravel.exit_point
      if (typeof xp === 'string' && xp.trim() !== '') return xp.trim()
      if (xp && typeof xp === 'object' && typeof xp.value === 'string' && xp.value.trim() !== '') {
        return xp.value.trim()
      }
    }
    const fields = (applicant as any).fields
    if (fields && typeof fields === 'object') {
      const fieldVal =
        fields['entrypoint']?.value ??
        fields['appl.entrypoint']?.value ??
        fields['visa_entrypoint']?.value ??
        fields['travel.entryPoint']?.value
      if (typeof fieldVal === 'string' && fieldVal.trim() !== '') return fieldVal.trim()
      const xpVal = fields['exitpoint']?.value ?? fields['appl.exitpoint']?.value
      if (typeof xpVal === 'string' && xpVal.trim() !== '') return xpVal.trim()
    }
    return 'HARIDASPUR'
  }

  // Expected Port of Exit from India
  if (
    path === 'travel.exitPoint' ||
    path === 'appl.exitpoint' ||
    path === 'exitpoint' ||
    path === 'exitpointprc' ||
    path === 'exit_point' ||
    path === 'visa_exitpoint'
  ) {
    const rawTravel = applicant.travel as Record<string, any> | undefined
    if (rawTravel) {
      const xp = rawTravel.exitPoint ?? rawTravel.exitpoint ?? rawTravel.exit_point
      if (typeof xp === 'string' && xp.trim() !== '') return xp.trim()
      if (xp && typeof xp === 'object' && typeof xp.value === 'string' && xp.value.trim() !== '') {
        return xp.value.trim()
      }
      // Fallback to entryPoint if exitPoint is not set
      const ep = rawTravel.entryPoint ?? rawTravel.entrypoint ?? rawTravel.entry_point
      if (typeof ep === 'string' && ep.trim() !== '') return ep.trim()
      if (ep && typeof ep === 'object' && typeof ep.value === 'string' && ep.value.trim() !== '') {
        return ep.value.trim()
      }
    }
    const fields = (applicant as any).fields
    if (fields && typeof fields === 'object') {
      const fieldVal =
        fields['exitpoint']?.value ??
        fields['appl.exitpoint']?.value ??
        fields['exitpointprc']?.value ??
        fields['visa_exitpoint']?.value ??
        fields['travel.exitPoint']?.value
      if (typeof fieldVal === 'string' && fieldVal.trim() !== '') return fieldVal.trim()
      const epVal = fields['entrypoint']?.value ?? fields['appl.entrypoint']?.value
      if (typeof epVal === 'string' && epVal.trim() !== '') return epVal.trim()
    }
    return 'HARIDASPUR'
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

  // Cross-lookup fallback for address fields between presentAddress and permanentAddress
  if (path === 'presentAddress.addressLine1') {
    return applicant.presentAddress?.addressLine1 || applicant.permanentAddress?.addressLine1
  }
  if (path === 'permanentAddress.addressLine1') {
    return applicant.permanentAddress?.addressLine1 || applicant.presentAddress?.addressLine1
  }
  if (path === 'presentAddress.addressLine2') {
    return applicant.presentAddress?.addressLine2 || applicant.permanentAddress?.addressLine2
  }
  if (path === 'presentAddress.villageTownCity') {
    return applicant.presentAddress?.villageTownCity || applicant.permanentAddress?.villageTownCity
  }
  if (
    path === 'permanentAddress.addressLine2' ||
    path === 'appl.perm_add2' ||
    path === 'perm_add2' ||
    path === 'perm_addr2'
  ) {
    const rawVal = applicant.permanentAddress?.addressLine2 || applicant.presentAddress?.addressLine2
    if (rawVal && rawVal.trim() !== '') {
      return rawVal.trim().toUpperCase()
    }
    return undefined
  }
  if (
    path === 'permanentAddress.villageTownCity' ||
    path === 'permanent_village_town_city' ||
    path === 'appl.perm_city' ||
    path === 'perm_city'
  ) {
    const rawVal = applicant.permanentAddress?.villageTownCity || applicant.presentAddress?.villageTownCity
    if (rawVal && rawVal.trim() !== '') {
      return rawVal.trim().toUpperCase()
    }
    return undefined
  }
  if (path === 'presentAddress.stateProvince' || path === 'presentAddress.state_name') {
    return (
      applicant.presentAddress?.stateProvince ||
      applicant.presentAddress?.district ||
      applicant.permanentAddress?.stateProvince ||
      applicant.permanentAddress?.district ||
      applicant.personalInfo?.townCityOfBirth
    )
  }
  if (path === 'presentAddress.district') {
    return (
      applicant.presentAddress?.district ||
      applicant.presentAddress?.stateProvince ||
      applicant.permanentAddress?.district ||
      applicant.permanentAddress?.stateProvince ||
      applicant.personalInfo?.townCityOfBirth
    )
  }
  if (path === 'permanentAddress.stateProvince' || path === 'appl.perm_state' || path === 'perm_state') {
    return (
      applicant.permanentAddress?.stateProvince ||
      applicant.permanentAddress?.district ||
      applicant.presentAddress?.stateProvince ||
      applicant.presentAddress?.district ||
      applicant.personalInfo?.townCityOfBirth
    )
  }
  if (path === 'permanentAddress.district' || path === 'appl.perm_district' || path === 'perm_district') {
    return (
      applicant.permanentAddress?.district ||
      applicant.permanentAddress?.stateProvince ||
      applicant.presentAddress?.district ||
      applicant.presentAddress?.stateProvince ||
      applicant.personalInfo?.townCityOfBirth
    )
  }
  if (path === 'presentAddress.postalCode' || path === 'pincode') {
    return applicant.presentAddress?.postalCode || applicant.permanentAddress?.postalCode
  }
  if (path === 'permanentAddress.postalCode' || path === 'permanent_postal_code' || path === 'appl.perm_pincode' || path === 'perm_pincode') {
    return applicant.permanentAddress?.postalCode || applicant.presentAddress?.postalCode
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

  // Generic safe nested path traversal fallback (e.g. family.father.name, passport.otherPassportDetails.passportNumber)
  if (path.includes('.')) {
    const segments = path.split('.')
    let current: unknown = applicant
    for (const seg of segments) {
      if (current === undefined || current === null || typeof current !== 'object') {
        current = undefined
        break
      }
      current = (current as Record<string, unknown>)[seg]
    }
    if (typeof current === 'string' && current.trim() !== '') {
      return current.trim()
    }
    if (typeof current === 'boolean') {
      return current ? 'Yes' : 'No'
    }
    if (typeof current === 'number') {
      return String(current)
    }
  }

  return undefined
}

