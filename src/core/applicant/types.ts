export type Gender = 'male' | 'female' | 'other' | 'unspecified'

export type NationalityAcquiredBy = 'birth' | 'naturalization' | 'unspecified'

export interface Address {
  addressLine1?: string
  addressLine2?: string
  villageTownCity?: string
  district?: string
  stateProvince?: string
  country?: string
  postalCode?: string
}

export interface PermanentAddress extends Address {
  sameAsPresentAddress?: boolean
}

export interface OtherPassportDetails {
  passportNumber?: string
  countryOfIssue?: string
  issueDate?: string // YYYY-MM-DD
  placeOfIssue?: string
  nationalityInPassport?: string
}

export interface PassportDetails {
  passportNumber?: string
  passportType?: string
  issuingCountry?: string
  issueDate?: string // YYYY-MM-DD
  expiryDate?: string // YYYY-MM-DD
  placeOfIssue?: string
  holdsOtherPassport?: boolean
  otherPassportDetails?: OtherPassportDetails
}

export interface ContactDetails {
  phone?: string
  mobile?: string
  email?: string
}

export interface FamilyMember {
  name?: string
  nationality?: string
  previousNationality?: string
  placeOfBirth?: string
  countryOfBirth?: string
}

export interface FamilyDetails {
  father?: FamilyMember
  mother?: FamilyMember
  spouse?: FamilyMember
  hasPakistanRelation?: boolean
  pakistanRelationDetails?: string
}

export interface EmploymentDetails {
  presentOccupation?: string
  designationRank?: string
  employerName?: string
  employerAddress?: Address | string
  employerPhone?: string
  pastOccupation?: string
  hasMilitaryService?: boolean
  militaryOrganization?: string
  militaryDesignation?: string
  militaryPlaceOfPosting?: string
  militaryRank?: string
}

export interface TravelDetails {
  purposeOfVisit?: string
  intendedArrivalDate?: string // YYYY-MM-DD
  intendedDepartureDate?: string // YYYY-MM-DD
  countriesToVisit?: string[]
  previousVisitToCountry?: boolean
  travelCompanions?: string[]
  duration?: string
  visaEntryType?: string
  entryPoint?: string
  exitPoint?: string
  countriesVisited?: string
  visitedSaarc?: boolean
}

export interface PreviousVisaDetails {
  hasPreviousVisa?: boolean
  visaNumber?: string
  visaType?: string
  placeOfIssue?: string
  dateOfIssue?: string // YYYY-MM-DD
  visitedAddress1?: string
  visitedAddress2?: string
  visitedAddress3?: string
  hasRefusal?: boolean
  refusalDetails?: string
  countriesVisited?: string
  hasSaarcVisit?: boolean
}

export interface AccommodationDetails {
  placeHotelName?: string
  address?: Address | string
  state?: string
  phone?: string
  bookingReference?: string
}

export interface ReferenceDetails {
  name?: string
  addressLine1?: string
  addressLine2?: string
  address?: Address | string
  phone?: string
  email?: string
}

export interface PersonalInfo {
  surname?: string
  givenNames?: string
  hasChangedName?: boolean
  previousName?: string
  gender?: Gender
  dateOfBirth?: string // YYYY-MM-DD
  townCityOfBirth?: string
  countryOfBirth?: string
  nationalIdNumber?: string
  religion?: string
  visibleIdentificationMarks?: string
  educationalQualification?: string
  nationality?: string
  nationalityAcquiredBy?: NationalityAcquiredBy
  previousNationality?: string
  maritalStatus?: string
}

export interface ApplicantProfile {
  applicantId: string
  personalInfo?: PersonalInfo
  passport?: PassportDetails
  presentAddress?: Address
  permanentAddress?: PermanentAddress
  contact?: ContactDetails
  family?: FamilyDetails
  employment?: EmploymentDetails
  travel?: TravelDetails
  previousVisa?: PreviousVisaDetails
  accommodation?: AccommodationDetails
  reference?: ReferenceDetails
  sponsorMission?: ReferenceDetails
  createdAt: string // ISO timestamp string
  updatedAt: string // ISO timestamp string
  notes?: string
}
