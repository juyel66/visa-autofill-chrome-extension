import type { IndiaFieldSelector } from '../../mapping.types'

/**
 * Bangladesh Indian Visa Portal (https://indianvisa-bangladesh.nic.in/)
 * Page: /visa/BasicDetails (Canonical Page: BASIC_DETAILS)
 * 
 * Verified DOM selectors provided from live Bangladesh portal DOM evidence.
 */
export interface BangladeshBasicDetailsSelectors {
  surname: IndiaFieldSelector[]
  givenName: IndiaFieldSelector[]
  changedSurnameCheck: IndiaFieldSelector[]
  gender: IndiaFieldSelector[]
  townCityOfBirth: IndiaFieldSelector[]
  countryOfBirth: IndiaFieldSelector[]
  nationalIdNumber: IndiaFieldSelector[]
  religion: IndiaFieldSelector[]
  visibleIdentificationMarks: IndiaFieldSelector[]
  educationalQualification: IndiaFieldSelector[]
  nationalityBy: IndiaFieldSelector[]
  passportNumber: IndiaFieldSelector[]
  placeOfIssue: IndiaFieldSelector[]
  issueDate: IndiaFieldSelector[]
  expiryDate: IndiaFieldSelector[]
  otherPassportFlag: IndiaFieldSelector[]
  otherPassportNumber: IndiaFieldSelector[]
  otherPassportPlaceOfIssue: IndiaFieldSelector[]
  otherPassportCountryOfIssue: IndiaFieldSelector[]
  otherPassportNationality: IndiaFieldSelector[]
}

export const BANGLADESH_BASIC_DETAILS_SELECTORS: BangladeshBasicDetailsSelectors = {
  surname: [
    { strategy: 'id', value: 'surname' },
    { strategy: 'name', value: 'appl.surname' },
    { strategy: 'css', value: 'input[name="appl.surname"], input#surname' },
  ],
  givenName: [
    { strategy: 'id', value: 'givenName' },
    { strategy: 'name', value: 'appl.applname' },
    { strategy: 'css', value: 'input[name="appl.applname"], input#givenName' },
  ],
  changedSurnameCheck: [
    { strategy: 'id', value: 'changedSurnameCheck' },
    { strategy: 'name', value: 'appl.changedSurnameCheck' },
    { strategy: 'css', value: 'input[name="appl.changedSurnameCheck"], input#changedSurnameCheck' },
  ],
  gender: [
    { strategy: 'id', value: 'gender' },
    { strategy: 'name', value: 'appl.applsex' },
    { strategy: 'css', value: 'select[name="appl.applsex"], select#gender' },
  ],
  townCityOfBirth: [
    { strategy: 'id', value: 'birth_place' },
    { strategy: 'name', value: 'appl.placbrth' },
    { strategy: 'css', value: 'input[name="appl.placbrth"], input#birth_place' },
  ],
  countryOfBirth: [
    { strategy: 'id', value: 'country_birth' },
    { strategy: 'name', value: 'appl.country_of_birth' },
    { strategy: 'css', value: 'select[name="appl.country_of_birth"], select#country_birth' },
  ],
  nationalIdNumber: [
    { strategy: 'id', value: 'nic_number' },
    { strategy: 'name', value: 'appl.nic_no' },
    { strategy: 'css', value: 'input[name="appl.nic_no"], input#nic_number' },
  ],
  religion: [
    { strategy: 'id', value: 'religion' },
    { strategy: 'name', value: 'appl.religion' },
    { strategy: 'css', value: 'select[name="appl.religion"], select#religion' },
  ],
  visibleIdentificationMarks: [
    { strategy: 'id', value: 'identity_marks' },
    { strategy: 'name', value: 'appl.visual_mark' },
    { strategy: 'css', value: 'input[name="appl.visual_mark"], input#identity_marks' },
  ],
  educationalQualification: [
    { strategy: 'id', value: 'education' },
    { strategy: 'name', value: 'appl.edu_id' },
    { strategy: 'css', value: 'select[name="appl.edu_id"], select#education' },
  ],
  nationalityBy: [
    { strategy: 'id', value: 'nationality_by' },
    { strategy: 'name', value: 'appl.nationality_by' },
    { strategy: 'css', value: 'select[name="appl.nationality_by"], select#nationality_by' },
  ],
  passportNumber: [
    { strategy: 'id', value: 'passport_no' },
    { strategy: 'name', value: 'appl.passport_number' },
    { strategy: 'css', value: 'input[name="appl.passport_number"], input#passport_no' },
  ],
  placeOfIssue: [
    { strategy: 'id', value: 'passport_issue_place' },
    { strategy: 'name', value: 'appl.passport_issue_place' },
    { strategy: 'css', value: 'input[name="appl.passport_issue_place"], input#passport_issue_place' },
  ],
  issueDate: [
    { strategy: 'id', value: 'passport_issue_date' },
    { strategy: 'name', value: 'appl.passport_issue_date' },
    { strategy: 'css', value: 'input[name="appl.passport_issue_date"], input#passport_issue_date' },
  ],
  expiryDate: [
    { strategy: 'id', value: 'passport_expiry_date' },
    { strategy: 'name', value: 'appl.passport_expiry_date' },
    { strategy: 'css', value: 'input[name="appl.passport_expiry_date"], input#passport_expiry_date' },
  ],
  otherPassportFlag: [
    { strategy: 'id', value: 'other_ppt_1' },
    { strategy: 'id', value: 'other_ppt_2' },
    { strategy: 'name', value: 'appl.oth_ppt' },
    { strategy: 'css', value: 'input[name="appl.oth_ppt"]' },
  ],
  otherPassportNumber: [
    { strategy: 'id', value: 'other_ppt_no' },
    { strategy: 'name', value: 'appl.oth_pptno' },
    { strategy: 'css', value: 'input[name="appl.oth_pptno"], input#other_ppt_no' },
  ],
  otherPassportPlaceOfIssue: [
    { strategy: 'id', value: 'other_ppt_issue_place' },
    { strategy: 'name', value: 'appl.other_ppt_issue_place' },
    { strategy: 'name', value: 'appl.oth_ppt_issue_place' },
    { strategy: 'css', value: 'input[name="appl.other_ppt_issue_place"], input[name="appl.oth_ppt_issue_place"], input#other_ppt_issue_place' },
  ],
  otherPassportCountryOfIssue: [
    { strategy: 'id', value: 'other_ppt_country_issue' },
    { strategy: 'name', value: 'appl.prev_passport_country_issue' },
    { strategy: 'css', value: 'select[name="appl.prev_passport_country_issue"], select#other_ppt_country_issue' },
  ],
  otherPassportNationality: [
    { strategy: 'id', value: 'other_ppt_nat' },
    { strategy: 'name', value: 'appl.other_ppt_nationality' },
    { strategy: 'css', value: 'select[name="appl.other_ppt_nationality"], select#other_ppt_nat' },
  ],
}


