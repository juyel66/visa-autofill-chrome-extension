import type { Address, ApplicantProfile, FamilyMember, PreviousVisaDetails, ReferenceDetails, TravelDetails } from '../applicant/types'

/**
 * Helper to safely trim whitespace and collapse repeated internal spaces.
 * Example: "  John   David  " -> "John David"
 */
function cleanString(str?: string): string | undefined {
  if (!str) return undefined
  const cleaned = str.trim().replace(/\s+/g, ' ')
  return cleaned !== '' ? cleaned : undefined
}

function cleanEmail(emailStr?: string): string | undefined {
  if (!emailStr) return undefined
  const cleaned = emailStr.trim().toLowerCase()
  return cleaned !== '' ? cleaned : undefined
}

function cleanPhone(phoneStr?: string): string | undefined {
  if (!phoneStr) return undefined
  const cleaned = phoneStr.trim()
  return cleaned !== '' ? cleaned : undefined
}

/**
 * Helper to normalize an Address object immutably.
 */
function cleanAddress<T extends Address>(addr?: T): T | undefined {
  if (!addr) return undefined
  const res = {
    ...addr,
    addressLine1: cleanString(addr.addressLine1),
    addressLine2: cleanString(addr.addressLine2),
    villageTownCity: cleanString(addr.villageTownCity),
    district: cleanString(addr.district),
    stateProvince: cleanString(addr.stateProvince),
    country: cleanString(addr.country),
    postalCode: cleanString(addr.postalCode),
  }
  const hasValues = Boolean(
    res.addressLine1 || res.addressLine2 || res.villageTownCity ||
    res.district || res.stateProvince || res.country || res.postalCode
  )
  return hasValues ? res : undefined
}

/**
 * Helper to normalize a FamilyMember object immutably.
 */
function cleanFamilyMember(member?: FamilyMember): FamilyMember | undefined {
  if (!member) return undefined
  const res = {
    name: cleanString(member.name),
    nationality: cleanString(member.nationality),
    previousNationality: cleanString(member.previousNationality),
    placeOfBirth: cleanString(member.placeOfBirth),
    countryOfBirth: cleanString(member.countryOfBirth),
  }
  const hasValues = Boolean(res.name || res.nationality || res.previousNationality || res.placeOfBirth || res.countryOfBirth)
  return hasValues ? res : undefined
}

/**
 * Helper to normalize a ReferenceDetails object immutably.
 */
function cleanReference(ref?: ReferenceDetails): ReferenceDetails | undefined {
  if (!ref) return undefined
  const res: ReferenceDetails = {
    name: cleanString(ref.name),
    addressLine1: cleanString(ref.addressLine1),
    addressLine2: cleanString(ref.addressLine2),
    address: typeof ref.address === 'string' ? cleanString(ref.address) : cleanAddress(ref.address as Address),
    phone: cleanPhone(ref.phone),
    email: cleanEmail(ref.email),
  }
  const hasValues = Boolean(res.name || res.addressLine1 || res.addressLine2 || res.address || res.phone || res.email)
  return hasValues ? res : undefined
}

/**
 * Helper to normalize a PreviousVisaDetails object immutably.
 */
function cleanPreviousVisa(visa?: PreviousVisaDetails): PreviousVisaDetails | undefined {
  if (!visa) return undefined
  const res: PreviousVisaDetails = {
    hasPreviousVisa: visa.hasPreviousVisa,
    visaNumber: cleanString(visa.visaNumber),
    visaType: cleanString(visa.visaType),
    placeOfIssue: cleanString(visa.placeOfIssue),
    dateOfIssue: cleanString(visa.dateOfIssue),
    visitedAddress1: cleanString(visa.visitedAddress1),
    visitedAddress2: cleanString(visa.visitedAddress2),
    visitedAddress3: cleanString(visa.visitedAddress3),
    hasRefusal: visa.hasRefusal,
    refusalDetails: cleanString(visa.refusalDetails),
    countriesVisited: cleanString(visa.countriesVisited),
    hasSaarcVisit: visa.hasSaarcVisit,
  }
  const hasValues = Boolean(
    res.hasPreviousVisa !== undefined || res.visaNumber || res.visaType || res.placeOfIssue || res.dateOfIssue ||
    res.visitedAddress1 || res.visitedAddress2 || res.visitedAddress3 ||
    res.hasRefusal !== undefined || res.refusalDetails || res.countriesVisited || res.hasSaarcVisit !== undefined
  )
  return hasValues ? res : undefined
}

/**
 * Helper to normalize a TravelDetails object immutably.
 */
function cleanTravel(travel?: TravelDetails): TravelDetails | undefined {
  if (!travel) return undefined
  const res: TravelDetails = {
    purposeOfVisit: cleanString(travel.purposeOfVisit),
    intendedArrivalDate: cleanString(travel.intendedArrivalDate),
    intendedDepartureDate: cleanString(travel.intendedDepartureDate),
    duration: cleanString(travel.duration),
    visaEntryType: cleanString(travel.visaEntryType),
    entryPoint: cleanString(travel.entryPoint),
    exitPoint: cleanString(travel.exitPoint),
    countriesVisited: cleanString(travel.countriesVisited),
    visitedSaarc: travel.visitedSaarc,
    countriesToVisit: travel.countriesToVisit?.map((c) => cleanString(c)).filter((c): c is string => Boolean(c)),
    previousVisitToCountry: travel.previousVisitToCountry,
    travelCompanions: travel.travelCompanions?.map((c) => cleanString(c)).filter((c): c is string => Boolean(c)),
  }
  const hasValues = Boolean(
    res.purposeOfVisit || res.intendedArrivalDate || res.intendedDepartureDate ||
    res.duration || res.visaEntryType || res.entryPoint || res.exitPoint ||
    res.countriesVisited || res.visitedSaarc !== undefined ||
    (res.countriesToVisit && res.countriesToVisit.length > 0) ||
    res.previousVisitToCountry !== undefined ||
    (res.travelCompanions && res.travelCompanions.length > 0)
  )
  return hasValues ? res : undefined
}

/**
 * Normalizes an ApplicantProfile object immutably.
 * Returns a NEW ApplicantProfile object with trimmed strings, lowercased emails,
 * and cleaned addresses while leaving original data unmutated and empty values un-invented.
 */
export function normalizeApplicant(applicant: ApplicantProfile): ApplicantProfile {
  if (!applicant) {
    return applicant
  }

  // Immutable copy with normalized fields
  return {
    ...applicant,
    applicantId: applicant.applicantId ? applicant.applicantId.trim() : '',
    personalInfo: applicant.personalInfo
      ? {
          ...applicant.personalInfo,
          surname: cleanString(applicant.personalInfo.surname),
          givenNames: cleanString(applicant.personalInfo.givenNames),
          previousName: cleanString(applicant.personalInfo.previousName),
          dateOfBirth: cleanString(applicant.personalInfo.dateOfBirth),
          townCityOfBirth: cleanString(applicant.personalInfo.townCityOfBirth),
          countryOfBirth: cleanString(applicant.personalInfo.countryOfBirth),
          nationalIdNumber: cleanString(applicant.personalInfo.nationalIdNumber),
          religion: cleanString(applicant.personalInfo.religion),
          visibleIdentificationMarks: cleanString(applicant.personalInfo.visibleIdentificationMarks),
          educationalQualification: cleanString(applicant.personalInfo.educationalQualification),
          nationality: cleanString(applicant.personalInfo.nationality),
          previousNationality: cleanString(applicant.personalInfo.previousNationality),
          maritalStatus: cleanString(applicant.personalInfo.maritalStatus),
        }
      : undefined,
    passport: applicant.passport
      ? {
          ...applicant.passport,
          passportNumber: cleanString(applicant.passport.passportNumber),
          passportType: cleanString(applicant.passport.passportType),
          issuingCountry: cleanString(applicant.passport.issuingCountry),
          issueDate: cleanString(applicant.passport.issueDate),
          expiryDate: cleanString(applicant.passport.expiryDate),
          placeOfIssue: cleanString(applicant.passport.placeOfIssue),
          otherPassportDetails: applicant.passport.otherPassportDetails
            ? {
                passportNumber: cleanString(applicant.passport.otherPassportDetails.passportNumber),
                countryOfIssue: cleanString(applicant.passport.otherPassportDetails.countryOfIssue),
                issueDate: cleanString(applicant.passport.otherPassportDetails.issueDate),
                placeOfIssue: cleanString(applicant.passport.otherPassportDetails.placeOfIssue),
                nationalityInPassport: cleanString(
                  applicant.passport.otherPassportDetails.nationalityInPassport
                ),
              }
            : undefined,
        }
      : undefined,
    presentAddress: cleanAddress(applicant.presentAddress),
    permanentAddress: applicant.permanentAddress
      ? {
          ...cleanAddress(applicant.permanentAddress),
          sameAsPresentAddress: Boolean(applicant.permanentAddress.sameAsPresentAddress),
        }
      : undefined,
    contact: applicant.contact
      ? {
          ...applicant.contact,
          email: cleanEmail(applicant.contact.email),
          mobile: cleanPhone(applicant.contact.mobile),
          phone: cleanPhone(applicant.contact.phone),
        }
      : undefined,
    family: applicant.family
      ? {
          ...applicant.family,
          father: cleanFamilyMember(applicant.family.father),
          mother: cleanFamilyMember(applicant.family.mother),
          spouse: applicant.family.spouse ? cleanFamilyMember(applicant.family.spouse) : undefined,
          hasPakistanRelation: applicant.family.hasPakistanRelation,
          pakistanRelationDetails: cleanString(applicant.family.pakistanRelationDetails),
        }
      : undefined,
    employment: applicant.employment
      ? {
          ...applicant.employment,
          presentOccupation: cleanString(applicant.employment.presentOccupation),
          designationRank: cleanString(applicant.employment.designationRank),
          employerName: cleanString(applicant.employment.employerName),
          employerAddress:
            typeof applicant.employment.employerAddress === 'string'
              ? cleanString(applicant.employment.employerAddress)
              : cleanAddress(applicant.employment.employerAddress as Address),
          employerPhone: cleanPhone(applicant.employment.employerPhone),
          pastOccupation: cleanString(applicant.employment.pastOccupation),
          hasMilitaryService: applicant.employment.hasMilitaryService,
          militaryOrganization: cleanString(applicant.employment.militaryOrganization),
          militaryDesignation: cleanString(applicant.employment.militaryDesignation),
          militaryPlaceOfPosting: cleanString(applicant.employment.militaryPlaceOfPosting),
          militaryRank: cleanString(applicant.employment.militaryRank),
        }
      : undefined,
    travel: cleanTravel(applicant.travel),
    previousVisa: cleanPreviousVisa(applicant.previousVisa),
    accommodation: applicant.accommodation
      ? {
          ...applicant.accommodation,
          placeHotelName: cleanString(applicant.accommodation.placeHotelName),
          state: cleanString(applicant.accommodation.state),
          phone: cleanPhone(applicant.accommodation.phone),
        }
      : undefined,
    reference: cleanReference(applicant.reference),
    sponsorMission: cleanReference(applicant.sponsorMission),
    notes: cleanString(applicant.notes),
  }
}
