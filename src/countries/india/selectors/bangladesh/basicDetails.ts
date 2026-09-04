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
  dateOfBirth: IndiaFieldSelector[]
  townCityOfBirth: IndiaFieldSelector[]
  countryOfBirth: IndiaFieldSelector[]
  nationality: IndiaFieldSelector[]
  nationalityBy: IndiaFieldSelector[]
  nationalIdNumber: IndiaFieldSelector[]
  religion: IndiaFieldSelector[]
  visibleIdentificationMarks: IndiaFieldSelector[]
  educationalQualification: IndiaFieldSelector[]
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
    { strategy: 'id', value: 'applicant_surname' },
    { strategy: 'name', value: 'appl.surname' },
    { strategy: 'name', value: 'applicant_surname' },
    { strategy: 'css', value: 'input[name="appl.surname"], input[name="applicant_surname"], input#surname' },
  ],
  givenName: [
    { strategy: 'id', value: 'givenName' },
    { strategy: 'id', value: 'applicant_given_name' },
    { strategy: 'name', value: 'appl.applname' },
    { strategy: 'name', value: 'applicant_given_name' },
    { strategy: 'name', value: 'given_name' },
    { strategy: 'css', value: 'input[name="appl.applname"], input[name="applicant_given_name"], input#givenName' },
  ],
  changedSurnameCheck: [
    { strategy: 'id', value: 'changedSurnameCheck' },
    { strategy: 'name', value: 'appl.changedSurnameCheck' },
    { strategy: 'css', value: 'input[name="appl.changedSurnameCheck"], input#changedSurnameCheck' },
  ],
  gender: [
    { strategy: 'id', value: 'gender' },
    { strategy: 'name', value: 'appl.applsex' },
    { strategy: 'name', value: 'gender' },
    { strategy: 'css', value: 'select[name="appl.applsex"], select[name="gender"], input[name="appl.applsex"], input[name="gender"]' },
  ],
  dateOfBirth: [
    { strategy: 'id', value: 'dob' },
    { strategy: 'id', value: 'dob_id' },
    { strategy: 'name', value: 'appl.birthdate' },
    { strategy: 'name', value: 'dob' },
    { strategy: 'css', value: 'input[name="appl.birthdate"], input[name="dob"]' },
  ],
  townCityOfBirth: [
    { strategy: 'id', value: 'birth_place' },
    { strategy: 'id', value: 'city_of_birth' },
    { strategy: 'name', value: 'appl.placbrth' },
    { strategy: 'name', value: 'city_of_birth' },
    { strategy: 'css', value: 'input[name="appl.placbrth"], input[name="city_of_birth"], input#birth_place' },
  ],
  countryOfBirth: [
    { strategy: 'id', value: 'country_birth' },
    { strategy: 'id', value: 'country_of_birth' },
    { strategy: 'name', value: 'appl.country_of_birth' },
    { strategy: 'name', value: 'country_of_birth' },
    { strategy: 'css', value: 'select[name="appl.country_of_birth"], select[name="country_of_birth"], select#country_birth' },
  ],
  nationality: [
    { strategy: 'id', value: 'nationality' },
    { strategy: 'id', value: 'nationality_id' },
    { strategy: 'name', value: 'appl.nationality' },
    { strategy: 'name', value: 'nationality' },
    { strategy: 'css', value: 'select[name="appl.nationality"], select[name="nationality"]' },
  ],
  nationalityBy: [
    { strategy: 'id', value: 'nationality_by' },
    { strategy: 'name', value: 'appl.nationality_by' },
    { strategy: 'css', value: 'select[name="appl.nationality_by"], input[name="appl.nationality_by"]' },
  ],
  nationalIdNumber: [
    { strategy: 'id', value: 'nic_number' },
    { strategy: 'id', value: 'national_id' },
    { strategy: 'name', value: 'appl.nic_no' },
    { strategy: 'name', value: 'national_id' },
    { strategy: 'css', value: 'input[name="appl.nic_no"], input[name="national_id"], input#nic_number' },
  ],
  religion: [
    { strategy: 'id', value: 'religion' },
    { strategy: 'name', value: 'appl.religion' },
    { strategy: 'name', value: 'religion' },
    { strategy: 'css', value: 'select[name="appl.religion"], select[name="religion"]' },
  ],
  visibleIdentificationMarks: [
    { strategy: 'id', value: 'identity_marks' },
    { strategy: 'name', value: 'appl.visual_mark' },
    { strategy: 'name', value: 'visible_identification_marks' },
    { strategy: 'css', value: 'input[name="appl.visual_mark"], input#identity_marks' },
  ],
  educationalQualification: [
    { strategy: 'id', value: 'education' },
    { strategy: 'id', value: 'educational_qualification' },
    { strategy: 'name', value: 'appl.edu_id' },
    { strategy: 'name', value: 'educational_qualification' },
    { strategy: 'css', value: 'select[name="appl.edu_id"], select[name="educational_qualification"], select#education' },
  ],
  passportNumber: [
    { strategy: 'id', value: 'passport_no' },
    { strategy: 'id', value: 'passport_number' },
    { strategy: 'name', value: 'appl.passport_number' },
    { strategy: 'name', value: 'passport_number' },
    { strategy: 'css', value: 'input[name="appl.passport_number"], input[name="passport_number"], input#passport_no' },
  ],
  placeOfIssue: [
    { strategy: 'id', value: 'passport_issue_place' },
    { strategy: 'id', value: 'place_of_issue' },
    { strategy: 'name', value: 'appl.passport_issue_place' },
    { strategy: 'name', value: 'place_of_issue' },
    { strategy: 'css', value: 'input[name="appl.passport_issue_place"], input[name="place_of_issue"], input#passport_issue_place' },
  ],
  issueDate: [
    { strategy: 'id', value: 'passport_issue_date' },
    { strategy: 'id', value: 'issue_date' },
    { strategy: 'name', value: 'appl.passport_issue_date' },
    { strategy: 'name', value: 'issue_date' },
    { strategy: 'css', value: 'input[name="appl.passport_issue_date"], input[name="issue_date"], input#passport_issue_date' },
  ],
  expiryDate: [
    { strategy: 'id', value: 'passport_expiry_date' },
    { strategy: 'id', value: 'expiry_date' },
    { strategy: 'name', value: 'appl.passport_expiry_date' },
    { strategy: 'name', value: 'expiry_date' },
    { strategy: 'css', value: 'input[name="appl.passport_expiry_date"], input[name="expiry_date"], input#passport_expiry_date' },
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
    { strategy: 'css', value: 'input[name="appl.other_ppt_issue_place"], input#other_ppt_issue_place' },
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


