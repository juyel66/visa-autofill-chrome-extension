import type { IndiaFieldSelector } from '../mapping.types'

/**
 * Centralized selectors for official Indian e-Visa Online form fields (indianvisaonline.gov.in/evisa).
 */
export const EVISA_SELECTORS: Record<string, IndiaFieldSelector> = {
  // e-Visa Application Details
  passportType: { strategy: 'id', value: 'passportType' },
  nationality: { strategy: 'id', value: 'nationality' },
  portOfArrival: { strategy: 'id', value: 'portOfArrival' },
  dateOfBirth: { strategy: 'id', value: 'dob' },
  email: { strategy: 'id', value: 'emailId' },
  expectedArrivalDate: { strategy: 'id', value: 'expectedArrivalDate' },

  // e-Visa Personal Details
  surname: { strategy: 'id', value: 'surname' },
  givenName: { strategy: 'id', value: 'givenName' },
  gender: { strategy: 'id', value: 'gender' },
  townCityOfBirth: { strategy: 'id', value: 'townOfBirth' },
  countryOfBirth: { strategy: 'id', value: 'countryOfBirth' },
  nationalIdNumber: { strategy: 'id', value: 'nationalId' },
  religion: { strategy: 'id', value: 'religion' },
  visibleMarks: { strategy: 'id', value: 'visibleMarks' },

  // e-Visa Passport Details
  passportNumber: { strategy: 'id', value: 'passportNo' },
  placeOfIssue: { strategy: 'id', value: 'placeOfIssue' },
  issueDate: { strategy: 'id', value: 'passportIssueDate' },
  expiryDate: { strategy: 'id', value: 'passportExpiryDate' },

  // Present Address
  presentAddressLine1: { strategy: 'id', value: 'presAddress1' },
  presentAddressLine2: { strategy: 'id', value: 'presAddress2' },
  presentCity: { strategy: 'id', value: 'presCity' },
  presentState: { strategy: 'id', value: 'presState' },
  presentCountry: { strategy: 'id', value: 'presCountry' },
  presentPostalCode: { strategy: 'id', value: 'presZip' },
  mobile: { strategy: 'id', value: 'mobile' },
  phone: { strategy: 'id', value: 'phone' },

  // Permanent Address
  permanentAddressLine1: { strategy: 'id', value: 'permAddress1' },
  permanentAddressLine2: { strategy: 'id', value: 'permAddress2' },
  permanentCity: { strategy: 'id', value: 'permCity' },
  permanentState: { strategy: 'id', value: 'permState' },
  permanentCountry: { strategy: 'id', value: 'permCountry' },
  permanentPostalCode: { strategy: 'id', value: 'permZip' },
  sameAsPresentAddress: { strategy: 'id', value: 'sameAddressCheckbox' },

  // Family Information
  fatherName: { strategy: 'id', value: 'fatherName' },
  fatherNationality: { strategy: 'id', value: 'fatherNationality' },
  fatherPreviousNationality: { strategy: 'id', value: 'fatherPreviousNationality' },
  fatherPlaceOfBirth: { strategy: 'id', value: 'fatherPlaceOfBirth' },
  fatherCountryOfBirth: { strategy: 'id', value: 'fatherCountryOfBirth' },

  motherName: { strategy: 'id', value: 'motherName' },
  motherNationality: { strategy: 'id', value: 'motherNationality' },
  motherPreviousNationality: { strategy: 'id', value: 'motherPreviousNationality' },
  motherPlaceOfBirth: { strategy: 'id', value: 'motherPlaceOfBirth' },
  motherCountryOfBirth: { strategy: 'id', value: 'motherCountryOfBirth' },

  spouseName: { strategy: 'id', value: 'spouseName' },
  spouseNationality: { strategy: 'id', value: 'spouseNationality' },
  spousePreviousNationality: { strategy: 'id', value: 'spousePreviousNationality' },
  spousePlaceOfBirth: { strategy: 'id', value: 'spousePlaceOfBirth' },
  spouseCountryOfBirth: { strategy: 'id', value: 'spouseCountryOfBirth' },

  // Employment / Occupation
  presentOccupation: { strategy: 'id', value: 'presentOccupation' },
  designationRank: { strategy: 'id', value: 'designation' },
  employerName: { strategy: 'id', value: 'employerName' },
  employerAddress: { strategy: 'id', value: 'employerAddress' },
  employerPhone: { strategy: 'id', value: 'employerPhone' },

  // Travel Details
  purposeOfVisit: { strategy: 'id', value: 'purposeOfVisit' },
  intendedArrivalDate: { strategy: 'id', value: 'intendedArrivalDate' },
  intendedDepartureDate: { strategy: 'id', value: 'intendedDepartureDate' },
  countriesToVisit: { strategy: 'id', value: 'countriesToVisit' },
  previousVisitToCountry: { strategy: 'id', value: 'previousVisit' },

  // Accommodation
  hotelName: { strategy: 'id', value: 'hotelName' },
  hotelAddress: { strategy: 'id', value: 'hotelAddress' },
  hotelState: { strategy: 'id', value: 'hotelState' },
  hotelPhone: { strategy: 'id', value: 'hotelPhone' },
  bookingReference: { strategy: 'id', value: 'bookingReference' },

  // Reference / Contact
  referenceIndiaName: { strategy: 'id', value: 'refIndiaName' },
  referenceIndiaAddress: { strategy: 'id', value: 'refIndiaAddress' },
  referenceIndiaPhone: { strategy: 'id', value: 'refIndiaPhone' },
  referenceHomeName: { strategy: 'id', value: 'refHomeName' },
  referenceHomeAddress: { strategy: 'id', value: 'refHomeAddress' },
  referenceHomePhone: { strategy: 'id', value: 'refHomePhone' },
}
