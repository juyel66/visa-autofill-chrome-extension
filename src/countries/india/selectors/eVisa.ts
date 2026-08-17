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
}
