import type {
  DeclarationDetails,
  IndiaVisaApplication,
  IndiaVisaReferences,
  PreviousVisitDetails,
  RegistrationDetails,
  VisaDetails,
} from './types'

export function createEmptyRegistrationDetails(): RegistrationDetails {
  return {
    applyingFromCountry: '',
    indianMission: '',
    nationality: '',
    dateOfBirth: '',
    email: '',
    expectedArrivalDate: '',
    captchaCompletedManually: false,
  }
}

export function createEmptyVisaDetails(): VisaDetails {
  return {
    visaType: '',
    numberOfEntries: '',
    periodOfVisaMonths: 12,
    expectedDateOfJourney: '',
    portOfArrival: '',
    portOfExit: '',
    placesToBeVisited: '',
    purposeOfVisit: '',
  }
}

export function createEmptyPreviousVisitDetails(): PreviousVisitDetails {
  return {
    hasVisitedIndia: false,
    stayAddressInIndia: '',
    citiesVisitedInIndia: '',
    previousVisaType: '',
    previousVisaNumber: '',
    previousVisaIssuedPlace: '',
    previousVisaIssueDate: '',
    countriesVisitedLast10Years: [],
    hasBeenRefusedIndianVisa: false,
    refusalDetails: '',
    hasBeenDeportedFromIndia: false,
    deportationDetails: '',
  }
}

export function createEmptyIndiaVisaReferences(): IndiaVisaReferences {
  return {
    india: {
      name: '',
      address: '',
      phone: '',
    },
    bangladesh: {
      name: '',
      address: '',
      phone: '',
    },
  }
}

export function createEmptyDeclarationDetails(): DeclarationDetails {
  return {
    isDeclared: false,
    declarationDate: '',
  }
}

export function createEmptyIndiaVisaApplication(
  applicationId?: string,
  applicantId?: string
): IndiaVisaApplication {
  const now = new Date().toISOString()
  return {
    applicationId:
      applicationId || `in_visa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    applicantId: applicantId || '',
    registration: createEmptyRegistrationDetails(),
    visaDetails: createEmptyVisaDetails(),
    previousVisitDetails: createEmptyPreviousVisitDetails(),
    accommodations: [],
    references: createEmptyIndiaVisaReferences(),
    documents: [],
    declaration: createEmptyDeclarationDetails(),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
}
