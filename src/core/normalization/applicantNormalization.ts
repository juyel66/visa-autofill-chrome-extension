import type { Address, ApplicantProfile, FamilyMember } from '../applicant/types'

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
  return {
    ...addr,
    addressLine1: cleanString(addr.addressLine1),
    addressLine2: cleanString(addr.addressLine2),
    villageTownCity: cleanString(addr.villageTownCity),
    district: cleanString(addr.district),
    stateProvince: cleanString(addr.stateProvince),
    country: cleanString(addr.country),
    postalCode: cleanString(addr.postalCode),
  }
}

/**
 * Helper to normalize a FamilyMember object immutably.
 */
function cleanFamilyMember(member?: FamilyMember): FamilyMember | undefined {
  if (!member) return undefined
  return {
    name: cleanString(member.name),
    nationality: cleanString(member.nationality),
    previousNationality: cleanString(member.previousNationality),
    placeOfBirth: cleanString(member.placeOfBirth),
    countryOfBirth: cleanString(member.countryOfBirth),
  }
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
    family: {
      ...applicant.family,
      father: cleanFamilyMember(applicant.family?.father),
      mother: cleanFamilyMember(applicant.family?.mother),
      spouse: applicant.family?.spouse ? cleanFamilyMember(applicant.family.spouse) : undefined,
      pakistanRelationDetails: applicant.family?.pakistanRelationDetails
        ? cleanString(applicant.family.pakistanRelationDetails)
        : '',
    },
    employment: {
      ...applicant.employment,
      presentOccupation: cleanString(applicant.employment?.presentOccupation),
      designationRank: applicant.employment?.designationRank
        ? cleanString(applicant.employment.designationRank)
        : '',
      employerName: applicant.employment?.employerName
        ? cleanString(applicant.employment.employerName)
        : '',
      employerPhone: applicant.employment?.employerPhone
        ? cleanPhone(applicant.employment.employerPhone)
        : '',
      pastOccupation: applicant.employment?.pastOccupation
        ? cleanString(applicant.employment.pastOccupation)
        : '',
    },
    travel: applicant.travel
      ? {
          ...applicant.travel,
          purposeOfVisit: cleanString(applicant.travel.purposeOfVisit),
          intendedArrivalDate: applicant.travel.intendedArrivalDate
            ? applicant.travel.intendedArrivalDate.trim()
            : '',
          intendedDepartureDate: applicant.travel.intendedDepartureDate
            ? applicant.travel.intendedDepartureDate.trim()
            : '',
        }
      : undefined,
    accommodation: applicant.accommodation
      ? {
          ...applicant.accommodation,
          placeHotelName: cleanString(applicant.accommodation.placeHotelName),
          state: cleanString(applicant.accommodation.state),
          phone: cleanPhone(applicant.accommodation.phone),
        }
      : undefined,
    reference: applicant.reference
      ? {
          ...applicant.reference,
          name: cleanString(applicant.reference.name),
          phone: cleanPhone(applicant.reference.phone),
          email: applicant.reference.email ? cleanEmail(applicant.reference.email) : '',
        }
      : undefined,
    notes: applicant.notes ? cleanString(applicant.notes) : '',
  }
}
