import type { IndiaFieldSelector } from '../mapping.types'

/**
 * Centralized selectors for official Indian Regular/Paper Visa Online form fields (indianvisaonline.gov.in).
 * Priority: 1. Stable ID, 2. Stable Name, 3. Associated Label.
 */
export const REGULAR_VISA_SELECTORS: Record<string, IndiaFieldSelector> = {
  // Page 1: Application Start / Registration
  indianMission: { strategy: 'name', value: 'indian_mission' },
  nationality: { strategy: 'name', value: 'nationality' },
  dateOfBirth: { strategy: 'name', value: 'dob' },
  email: { strategy: 'name', value: 'email' },
  emailConfirm: { strategy: 'name', value: 'email_re' },
  expectedArrivalDate: { strategy: 'name', value: 'arr_date' },
  visaType: { strategy: 'name', value: 'visa_type' },

  // Page 2: Applicant Personal Details
  surname: { strategy: 'name', value: 'applicant_surname' },
  givenName: { strategy: 'name', value: 'applicant_given_name' },
  gender: { strategy: 'name', value: 'gender' },
  townCityOfBirth: { strategy: 'name', value: 'city_of_birth' },
  countryOfBirth: { strategy: 'name', value: 'country_of_birth' },
  nationalIdNumber: { strategy: 'name', value: 'national_id' },
  religion: { strategy: 'name', value: 'religion' },
  visibleMarks: { strategy: 'name', value: 'visible_identification_marks' },
  educationalQualification: { strategy: 'name', value: 'educational_qualification' },

  // Passport Details
  passportNumber: { strategy: 'name', value: 'passport_number' },
  placeOfIssue: { strategy: 'name', value: 'place_of_issue' },
  issueDate: { strategy: 'name', value: 'issue_date' },
  expiryDate: { strategy: 'name', value: 'expiry_date' },

  // Present Address
  presentAddressLine1: { strategy: 'name', value: 'pres_addr1' },
  presentAddressLine2: { strategy: 'name', value: 'pres_addr2' },
  presentCity: { strategy: 'name', value: 'pres_city' },
  presentState: { strategy: 'name', value: 'pres_state' },
  presentCountry: { strategy: 'name', value: 'pres_country' },
  presentPostalCode: { strategy: 'name', value: 'pres_postal_code' },
  mobile: { strategy: 'name', value: 'mobile_no' },
}
