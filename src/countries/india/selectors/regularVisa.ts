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
  phone: { strategy: 'name', value: 'phone_no' },

  // Permanent Address
  permanentAddressLine1: { strategy: 'name', value: 'perm_addr1' },
  permanentAddressLine2: { strategy: 'name', value: 'perm_addr2' },
  permanentCity: { strategy: 'name', value: 'perm_city' },
  permanentState: { strategy: 'name', value: 'perm_state' },
  permanentCountry: { strategy: 'name', value: 'perm_country' },
  permanentPostalCode: { strategy: 'name', value: 'perm_postal_code' },
  sameAsPresentAddress: { strategy: 'name', value: 'same_address' },

  // Family Information
  fatherName: { strategy: 'name', value: 'father_name' },
  fatherNationality: { strategy: 'name', value: 'father_nationality' },
  fatherPreviousNationality: { strategy: 'name', value: 'father_prev_nationality' },
  fatherPlaceOfBirth: { strategy: 'name', value: 'father_place_birth' },
  fatherCountryOfBirth: { strategy: 'name', value: 'father_country_birth' },

  motherName: { strategy: 'name', value: 'mother_name' },
  motherNationality: { strategy: 'name', value: 'mother_nationality' },
  motherPreviousNationality: { strategy: 'name', value: 'mother_prev_nationality' },
  motherPlaceOfBirth: { strategy: 'name', value: 'mother_place_birth' },
  motherCountryOfBirth: { strategy: 'name', value: 'mother_country_birth' },

  spouseName: { strategy: 'name', value: 'spouse_name' },
  spouseNationality: { strategy: 'name', value: 'spouse_nationality' },
  spousePreviousNationality: { strategy: 'name', value: 'spouse_prev_nationality' },
  spousePlaceOfBirth: { strategy: 'name', value: 'spouse_place_birth' },
  spouseCountryOfBirth: { strategy: 'name', value: 'spouse_country_birth' },

  // Employment / Occupation
  presentOccupation: { strategy: 'name', value: 'present_occupation' },
  designationRank: { strategy: 'name', value: 'designation' },
  employerName: { strategy: 'name', value: 'employer_name' },
  employerAddress: { strategy: 'name', value: 'employer_address' },
  employerPhone: { strategy: 'name', value: 'employer_phone' },

  // Travel Details
  purposeOfVisit: { strategy: 'name', value: 'purpose' },
  intendedArrivalDate: { strategy: 'name', value: 'arrival_date' },
  intendedDepartureDate: { strategy: 'name', value: 'departure_date' },
  countriesToVisit: { strategy: 'name', value: 'countries_to_visit' },
  previousVisitToCountry: { strategy: 'name', value: 'prev_visit' },

  // Accommodation
  hotelName: { strategy: 'name', value: 'hotel_name' },
  hotelAddress: { strategy: 'name', value: 'hotel_address' },
  hotelState: { strategy: 'name', value: 'hotel_state' },
  hotelPhone: { strategy: 'name', value: 'hotel_phone' },
  bookingReference: { strategy: 'name', value: 'booking_ref' },

  // Reference / Contact
  referenceIndiaName: { strategy: 'name', value: 'ref_india_name' },
  referenceIndiaAddress: { strategy: 'name', value: 'ref_india_address' },
  referenceIndiaPhone: { strategy: 'name', value: 'ref_india_phone' },
  referenceHomeName: { strategy: 'name', value: 'ref_home_name' },
  referenceHomeAddress: { strategy: 'name', value: 'ref_home_address' },
  referenceHomePhone: { strategy: 'name', value: 'ref_home_phone' },
}
