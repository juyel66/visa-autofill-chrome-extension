import type { IndiaFieldSelector } from '../mapping.types'

/**
 * Bangladesh Indian Visa Portal (indianvisa-bangladesh.nic.in) field selector abstractions.
 * 
 * TARGET PORTAL: https://indianvisa-bangladesh.nic.in/
 * Target Pages: /visa/Registration, /visa/BasicDetails
 * 
 * IMPORTANT: Exact live DOM element names/IDs for the Bangladesh portal are NOT present in
 * repository source artifacts. Candidate selectors are defined as structural abstractions
 * (candidate strategy options) and marked as unverified until live DOM captures become available.
 */
export interface BangladeshVisaSelectorConfig {
  // /visa/Registration page fields
  applyingFromCountry?: IndiaFieldSelector | IndiaFieldSelector[]
  indianMission?: IndiaFieldSelector | IndiaFieldSelector[]
  nationality?: IndiaFieldSelector | IndiaFieldSelector[]
  dateOfBirth?: IndiaFieldSelector | IndiaFieldSelector[]
  email?: IndiaFieldSelector | IndiaFieldSelector[]
  emailConfirm?: IndiaFieldSelector | IndiaFieldSelector[]
  expectedArrivalDate?: IndiaFieldSelector | IndiaFieldSelector[]
  captcha?: IndiaFieldSelector | IndiaFieldSelector[]

  // /visa/BasicDetails page fields
  surname?: IndiaFieldSelector | IndiaFieldSelector[]
  givenName?: IndiaFieldSelector | IndiaFieldSelector[]
  gender?: IndiaFieldSelector | IndiaFieldSelector[]
  townCityOfBirth?: IndiaFieldSelector | IndiaFieldSelector[]
  countryOfBirth?: IndiaFieldSelector | IndiaFieldSelector[]
  nationalIdNumber?: IndiaFieldSelector | IndiaFieldSelector[]
  religion?: IndiaFieldSelector | IndiaFieldSelector[]
  educationalQualification?: IndiaFieldSelector | IndiaFieldSelector[]
  passportNumber?: IndiaFieldSelector | IndiaFieldSelector[]
  placeOfIssue?: IndiaFieldSelector | IndiaFieldSelector[]
  issueDate?: IndiaFieldSelector | IndiaFieldSelector[]
  expiryDate?: IndiaFieldSelector | IndiaFieldSelector[]
}

export const BANGLADESH_VISA_SELECTORS: Record<string, IndiaFieldSelector | IndiaFieldSelector[] | undefined> = {
  // /visa/Registration page candidate selector abstractions
  applyingFromCountry: [
    { strategy: 'id', value: 'countryname_id' },
    { strategy: 'name', value: 'country' },
  ],
  indianMission: [
    { strategy: 'name', value: 'indian_mission' },
    { strategy: 'id', value: 'missioncode_id' },
  ],
  nationality: [
    { strategy: 'name', value: 'nationality' },
    { strategy: 'id', value: 'nationality_id' },
  ],
  dateOfBirth: [
    { strategy: 'name', value: 'dob' },
    { strategy: 'id', value: 'dob_id' },
  ],
  email: [
    { strategy: 'name', value: 'email' },
    { strategy: 'id', value: 'email_id' },
  ],
  emailConfirm: [
    { strategy: 'name', value: 'email_re' },
    { strategy: 'id', value: 'email_re_id' },
  ],
  expectedArrivalDate: [
    { strategy: 'name', value: 'arr_date' },
    { strategy: 'id', value: 'journey_id' },
  ],
  captcha: [
    { strategy: 'id', value: 'captcha' },
    { strategy: 'name', value: 'captcha' },
  ],

  // /visa/BasicDetails page candidate selector abstractions
  surname: [
    { strategy: 'name', value: 'applicant_surname' },
    { strategy: 'name', value: 'surname' },
  ],
  givenName: [
    { strategy: 'name', value: 'applicant_given_name' },
    { strategy: 'name', value: 'given_name' },
  ],
  gender: [
    { strategy: 'name', value: 'gender' },
    { strategy: 'id', value: 'gender' },
  ],
  townCityOfBirth: [
    { strategy: 'name', value: 'city_of_birth' },
    { strategy: 'name', value: 'place_of_birth' },
  ],
  countryOfBirth: [
    { strategy: 'name', value: 'country_of_birth' },
    { strategy: 'id', value: 'country_of_birth' },
  ],
  nationalIdNumber: [
    { strategy: 'name', value: 'national_id' },
    { strategy: 'id', value: 'national_id' },
  ],
  religion: [
    { strategy: 'name', value: 'religion' },
    { strategy: 'id', value: 'religion' },
  ],
  educationalQualification: [
    { strategy: 'name', value: 'educational_qualification' },
    { strategy: 'id', value: 'educational_qualification' },
  ],
  passportNumber: [
    { strategy: 'name', value: 'passport_number' },
    { strategy: 'id', value: 'passport_number' },
  ],
  placeOfIssue: [
    { strategy: 'name', value: 'place_of_issue' },
    { strategy: 'id', value: 'place_of_issue' },
  ],
  issueDate: [
    { strategy: 'name', value: 'issue_date' },
    { strategy: 'id', value: 'issue_date' },
  ],
  expiryDate: [
    { strategy: 'name', value: 'expiry_date' },
    { strategy: 'id', value: 'expiry_date' },
  ],
}

