import type { IndiaFieldSelector } from '../../mapping.types'

/**
 * Bangladesh Indian Visa Portal (https://indianvisa-bangladesh.nic.in/)
 * Page: /visa/BasicDetails (Canonical Page: BASIC_DETAILS)
 * 
 * Candidate selector abstractions prioritized by:
 * 1. Unique ID
 * 2. Stable Name
 * 3. Stable CSS / Label
 * 
 * Live DOM status:
 * Direct unauthenticated HTTP requests to /visa/BasicDetails require an active session state
 * from previous wizard step. Selectors represent candidate strategies and remain unverified
 * ('needs-verification') until live session inspection is completed.
 */
export interface BangladeshBasicDetailsSelectors {
  surname: IndiaFieldSelector[]
  givenName: IndiaFieldSelector[]
  gender: IndiaFieldSelector[]
  dateOfBirth: IndiaFieldSelector[]
  townCityOfBirth: IndiaFieldSelector[]
  countryOfBirth: IndiaFieldSelector[]
  nationality: IndiaFieldSelector[]
  nationalIdNumber: IndiaFieldSelector[]
  religion: IndiaFieldSelector[]
  educationalQualification: IndiaFieldSelector[]
  passportNumber: IndiaFieldSelector[]
  placeOfIssue: IndiaFieldSelector[]
  issueDate: IndiaFieldSelector[]
  expiryDate: IndiaFieldSelector[]
}

export const BANGLADESH_BASIC_DETAILS_SELECTORS: BangladeshBasicDetailsSelectors = {
  surname: [
    { strategy: 'id', value: 'applicant_surname' },
    { strategy: 'name', value: 'applicant_surname' },
    { strategy: 'name', value: 'surname' },
    { strategy: 'css', value: 'input[name="applicant_surname"], input[name="surname"]' },
  ],
  givenName: [
    { strategy: 'id', value: 'applicant_given_name' },
    { strategy: 'name', value: 'applicant_given_name' },
    { strategy: 'name', value: 'given_name' },
    { strategy: 'css', value: 'input[name="applicant_given_name"], input[name="given_name"]' },
  ],
  gender: [
    { strategy: 'id', value: 'gender' },
    { strategy: 'name', value: 'gender' },
    { strategy: 'css', value: 'select[name="gender"], input[name="gender"], input[name="applicant_gender"]' },
  ],
  dateOfBirth: [
    { strategy: 'id', value: 'dob' },
    { strategy: 'id', value: 'dob_id' },
    { strategy: 'name', value: 'dob' },
    { strategy: 'css', value: 'input[name="dob"]' },
  ],
  townCityOfBirth: [
    { strategy: 'id', value: 'city_of_birth' },
    { strategy: 'name', value: 'city_of_birth' },
    { strategy: 'name', value: 'place_of_birth' },
    { strategy: 'css', value: 'input[name="city_of_birth"], input[name="place_of_birth"]' },
  ],
  countryOfBirth: [
    { strategy: 'id', value: 'country_of_birth' },
    { strategy: 'name', value: 'country_of_birth' },
    { strategy: 'css', value: 'select[name="country_of_birth"]' },
  ],
  nationality: [
    { strategy: 'id', value: 'nationality' },
    { strategy: 'id', value: 'nationality_id' },
    { strategy: 'name', value: 'nationality' },
    { strategy: 'css', value: 'select[name="nationality"]' },
  ],
  nationalIdNumber: [
    { strategy: 'id', value: 'national_id' },
    { strategy: 'name', value: 'national_id' },
    { strategy: 'css', value: 'input[name="national_id"]' },
  ],
  religion: [
    { strategy: 'id', value: 'religion' },
    { strategy: 'name', value: 'religion' },
    { strategy: 'css', value: 'select[name="religion"]' },
  ],
  educationalQualification: [
    { strategy: 'id', value: 'educational_qualification' },
    { strategy: 'name', value: 'educational_qualification' },
    { strategy: 'css', value: 'select[name="educational_qualification"]' },
  ],
  passportNumber: [
    { strategy: 'id', value: 'passport_number' },
    { strategy: 'name', value: 'passport_number' },
    { strategy: 'css', value: 'input[name="passport_number"]' },
  ],
  placeOfIssue: [
    { strategy: 'id', value: 'place_of_issue' },
    { strategy: 'name', value: 'place_of_issue' },
    { strategy: 'css', value: 'input[name="place_of_issue"]' },
  ],
  issueDate: [
    { strategy: 'id', value: 'issue_date' },
    { strategy: 'name', value: 'issue_date' },
    { strategy: 'css', value: 'input[name="issue_date"]' },
  ],
  expiryDate: [
    { strategy: 'id', value: 'expiry_date' },
    { strategy: 'name', value: 'expiry_date' },
    { strategy: 'css', value: 'input[name="expiry_date"]' },
  ],
}

