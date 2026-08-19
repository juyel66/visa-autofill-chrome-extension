import type {
  AccommodationDetails,
  Address,
  ApplicantProfile,
  EmploymentDetails,
  FamilyDetails,
  FamilyMember,
  PassportDetails,
  PermanentAddress,
  PersonalInfo,
  ReferenceDetails,
  TravelDetails,
} from './types'

export function createEmptyAddress(): Address {
  return {
    addressLine1: '',
    addressLine2: '',
    villageTownCity: '',
    district: '',
    stateProvince: '',
    country: '',
    postalCode: '',
  }
}

export function createEmptyPermanentAddress(): PermanentAddress {
  return {
    ...createEmptyAddress(),
    sameAsPresentAddress: false,
  }
}

export function createEmptyPassportDetails(): PassportDetails {
  return {
    passportNumber: '',
    passportType: 'Ordinary',
    issuingCountry: '',
    issueDate: '',
    expiryDate: '',
    placeOfIssue: '',
    holdsOtherPassport: false,
  }
}

export function createEmptyFamilyMember(): FamilyMember {
  return {
    name: '',
    nationality: '',
    previousNationality: '',
    placeOfBirth: '',
    countryOfBirth: '',
  }
}

export function createEmptyFamilyDetails(): FamilyDetails {
  return {
    father: createEmptyFamilyMember(),
    mother: createEmptyFamilyMember(),
    spouse: createEmptyFamilyMember(),
    hasPakistanRelation: false,
    pakistanRelationDetails: '',
  }
}

export function createEmptyEmploymentDetails(): EmploymentDetails {
  return {
    presentOccupation: '',
    designationRank: '',
    employerName: '',
    employerAddress: createEmptyAddress(),
    employerPhone: '',
    pastOccupation: '',
    hasMilitaryService: false,
    militaryOrganization: '',
    militaryDesignation: '',
    militaryPlaceOfPosting: '',
    militaryRank: '',
  }
}

export function createEmptyTravelDetails(): TravelDetails {
  return {
    purposeOfVisit: '',
    intendedArrivalDate: '',
    intendedDepartureDate: '',
    countriesToVisit: [],
    previousVisitToCountry: false,
    travelCompanions: [],
  }
}

export function createEmptyAccommodationDetails(): AccommodationDetails {
  return {
    placeHotelName: '',
    address: '',
    state: '',
    phone: '',
    bookingReference: '',
  }
}

export function createEmptyReferenceDetails(): ReferenceDetails {
  return {
    name: '',
    address: '',
    phone: '',
    email: '',
  }
}

export function createEmptyPersonalInfo(): PersonalInfo {
  return {
    surname: '',
    givenNames: '',
    hasChangedName: false,
    previousName: '',
    gender: 'unspecified',
    dateOfBirth: '',
    townCityOfBirth: '',
    countryOfBirth: '',
    nationalIdNumber: '',
    religion: '',
    visibleIdentificationMarks: '',
    educationalQualification: '',
    nationality: '',
    nationalityAcquiredBy: 'unspecified',
    previousNationality: '',
  }
}

export function createEmptyApplicant(id?: string): ApplicantProfile {
  const now = new Date().toISOString()
  return {
    applicantId: id || `applicant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: now,
    updatedAt: now,
    notes: '',
  }
}
