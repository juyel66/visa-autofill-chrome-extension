import type { ApplicantProfile } from '../../applicant/types'
import { normalizeApplicant } from '../../normalization'
import type { ExtractedApplicantData } from './types'

/**
 * Maps user-confirmed candidate extraction data into an ApplicantProfile object for autofill.
 * 
 * Rules:
 * 1. Confirmed PDF/OCR candidate data is the sole source of truth for personal, passport, address, family, and employment fields.
 * 2. Does NOT fall back to pre-existing applicant profile values.
 * 3. Any field missing in confirmedData is left undefined (requiring manual input if required by form).
 * 4. Runs normalizeApplicant() on the final merged object.
 * 5. Updates the updatedAt ISO timestamp.
 */
export function applyExtractionToApplicant(
  applicant: ApplicantProfile,
  confirmedData: ExtractedApplicantData
): ApplicantProfile {
  if (!applicant) {
    throw new Error('Target applicant profile is required for data mapping.')
  }

  const now = new Date().toISOString()

  const p = confirmedData.personal || {}
  const pass = confirmedData.passport || {}
  const c = confirmedData.contact || {}
  const pres = confirmedData.presentAddress || {}
  const perm = confirmedData.permanentAddress || {}
  const fam = confirmedData.family || {}
  const emp = confirmedData.employment || {}
  const tr = confirmedData.travel || {}
  const pv = confirmedData.previousVisa || {}
  const spInd = confirmedData.sponsorIndia || {}
  const spMsn = confirmedData.sponsorMission || {}

  const hasPersonal = Boolean(
    p.lastName?.value ||
    p.firstName?.value ||
    p.dateOfBirth?.value ||
    p.gender?.value ||
    p.nationality?.value ||
    p.townCityOfBirth?.value ||
    p.countryOfBirth?.value ||
    p.nationalIdNumber?.value ||
    p.religion?.value ||
    p.educationalQualification?.value ||
    p.previousNationality?.value ||
    p.maritalStatus?.value
  )

  const hasPassport = Boolean(
    pass.passportNumber?.value ||
    pass.passportType?.value ||
    pass.issuingCountry?.value ||
    pass.expiryDate?.value ||
    pass.issueDate?.value ||
    pass.placeOfIssue?.value
  )

  const hasPresent = Boolean(
    pres.addressLine1?.value ||
    pres.addressLine2?.value ||
    pres.villageTownCity?.value ||
    pres.district?.value ||
    pres.stateProvince?.value ||
    pres.country?.value ||
    pres.postalCode?.value
  )

  const hasPerm = Boolean(
    perm.addressLine1?.value ||
    perm.addressLine2?.value ||
    perm.villageTownCity?.value ||
    perm.district?.value ||
    perm.stateProvince?.value ||
    perm.country?.value ||
    perm.postalCode?.value
  )

  const hasContact = Boolean(
    c.email?.value ||
    c.mobile?.value ||
    c.phone?.value ||
    pres.phone?.value
  )

  const hasFamily = Boolean(
    fam.father ||
    fam.mother ||
    fam.spouse ||
    fam.hasPakistanRelation?.value !== undefined ||
    fam.pakistanRelationDetails?.value
  )

  const hasEmployment = Boolean(
    emp.presentOccupation?.value ||
    emp.employerName?.value ||
    emp.designationRank?.value ||
    emp.employerAddress?.value ||
    emp.employerPhone?.value ||
    emp.pastOccupation?.value ||
    emp.hasMilitaryService?.value !== undefined ||
    emp.militaryOrganization?.value ||
    emp.militaryDesignation?.value ||
    emp.militaryRank?.value ||
    emp.militaryPlaceOfPosting?.value
  )

  const hasTravel = Boolean(
    tr.purposeOfVisit?.value ||
    tr.intendedArrivalDate?.value ||
    tr.journeyDate?.value ||
    tr.duration?.value ||
    tr.visaEntryType?.value ||
    tr.entryPoint?.value ||
    tr.exitPoint?.value ||
    tr.countriesVisited?.value ||
    tr.visitedSaarc?.value !== undefined
  )

  const hasPreviousVisa = Boolean(
    pv.hasPreviousVisa?.value !== undefined ||
    pv.visaNumber?.value ||
    pv.visaType?.value ||
    pv.placeOfIssue?.value ||
    pv.dateOfIssue?.value ||
    pv.visitedAddress1?.value ||
    pv.visitedAddress2?.value ||
    pv.visitedAddress3?.value ||
    pv.hasRefusal?.value !== undefined ||
    pv.refusalDetails?.value
  )

  const hasSponsorInd = Boolean(
    spInd.name?.value ||
    spInd.addressLine1?.value ||
    spInd.addressLine2?.value ||
    spInd.phone?.value ||
    spInd.email?.value
  )

  const hasSponsorMsn = Boolean(
    spMsn.name?.value ||
    spMsn.addressLine1?.value ||
    spMsn.addressLine2?.value ||
    spMsn.phone?.value ||
    spMsn.email?.value
  )

  const merged: ApplicantProfile = {
    ...applicant,
    updatedAt: now,
    personalInfo: hasPersonal
      ? {
          surname: p.lastName?.value ? p.lastName.value : undefined,
          givenNames: p.firstName?.value ? p.firstName.value : undefined,
          dateOfBirth: p.dateOfBirth?.value ? p.dateOfBirth.value : undefined,
          gender: p.gender?.value ? p.gender.value : undefined,
          nationality: p.nationality?.value ? p.nationality.value : undefined,
          townCityOfBirth: p.townCityOfBirth?.value ? p.townCityOfBirth.value : undefined,
          countryOfBirth: p.countryOfBirth?.value ? p.countryOfBirth.value : undefined,
          nationalIdNumber: p.nationalIdNumber?.value ? p.nationalIdNumber.value : undefined,
          religion: p.religion?.value ? p.religion.value : undefined,
          educationalQualification: p.educationalQualification?.value ? p.educationalQualification.value : undefined,
          previousNationality: p.previousNationality?.value ? p.previousNationality.value : undefined,
          maritalStatus: p.maritalStatus?.value ? p.maritalStatus.value : undefined,
        }
      : undefined,
    passport: hasPassport
      ? {
          passportNumber: pass.passportNumber?.value ? pass.passportNumber.value : undefined,
          passportType: pass.passportType?.value ? pass.passportType.value : undefined,
          issuingCountry: pass.issuingCountry?.value ? pass.issuingCountry.value : undefined,
          expiryDate: pass.expiryDate?.value ? pass.expiryDate.value : undefined,
          issueDate: pass.issueDate?.value ? pass.issueDate.value : undefined,
          placeOfIssue: pass.placeOfIssue?.value ? pass.placeOfIssue.value : undefined,
        }
      : undefined,
    presentAddress: hasPresent
      ? {
          addressLine1: pres.addressLine1?.value ? pres.addressLine1.value : undefined,
          addressLine2: pres.addressLine2?.value ? pres.addressLine2.value : undefined,
          villageTownCity: pres.villageTownCity?.value ? pres.villageTownCity.value : undefined,
          district: pres.district?.value ? pres.district.value : undefined,
          stateProvince: pres.stateProvince?.value ? pres.stateProvince.value : undefined,
          country: pres.country?.value ? pres.country.value : undefined,
          postalCode: pres.postalCode?.value ? pres.postalCode.value : undefined,
        }
      : undefined,
    permanentAddress: hasPerm
      ? {
          addressLine1: perm.addressLine1?.value ? perm.addressLine1.value : undefined,
          addressLine2: perm.addressLine2?.value ? perm.addressLine2.value : undefined,
          villageTownCity: perm.villageTownCity?.value ? perm.villageTownCity.value : undefined,
          district: perm.district?.value ? perm.district.value : undefined,
          stateProvince: perm.stateProvince?.value ? perm.stateProvince.value : undefined,
          country: perm.country?.value ? perm.country.value : undefined,
          postalCode: perm.postalCode?.value ? perm.postalCode.value : undefined,
        }
      : undefined,
    contact: hasContact
      ? {
          email: c.email?.value ? c.email.value : undefined,
          mobile: c.mobile?.value ? c.mobile.value : undefined,
          phone: c.phone?.value ? c.phone.value : pres.phone?.value ? pres.phone.value : undefined,
        }
      : undefined,
    family: hasFamily
      ? {
          father: fam.father
            ? {
                name: fam.father.name?.value ? fam.father.name.value : undefined,
                placeOfBirth: fam.father.placeOfBirth?.value ? fam.father.placeOfBirth.value : undefined,
                countryOfBirth: fam.father.countryOfBirth?.value ? fam.father.countryOfBirth.value : undefined,
                nationality: fam.father.nationality?.value ? fam.father.nationality.value : undefined,
                previousNationality: fam.father.previousNationality?.value ? fam.father.previousNationality.value : undefined,
              }
            : undefined,
          mother: fam.mother
            ? {
                name: fam.mother.name?.value ? fam.mother.name.value : undefined,
                placeOfBirth: fam.mother.placeOfBirth?.value ? fam.mother.placeOfBirth.value : undefined,
                countryOfBirth: fam.mother.countryOfBirth?.value ? fam.mother.countryOfBirth.value : undefined,
                nationality: fam.mother.nationality?.value ? fam.mother.nationality.value : undefined,
                previousNationality: fam.mother.previousNationality?.value ? fam.mother.previousNationality.value : undefined,
              }
            : undefined,
          spouse: fam.spouse
            ? {
                name: fam.spouse.name?.value ? fam.spouse.name.value : undefined,
                placeOfBirth: fam.spouse.placeOfBirth?.value ? fam.spouse.placeOfBirth.value : undefined,
                countryOfBirth: fam.spouse.countryOfBirth?.value ? fam.spouse.countryOfBirth.value : undefined,
                nationality: fam.spouse.nationality?.value ? fam.spouse.nationality.value : undefined,
                previousNationality: fam.spouse.previousNationality?.value ? fam.spouse.previousNationality.value : undefined,
              }
            : undefined,
          hasPakistanRelation: fam.hasPakistanRelation?.value !== undefined ? fam.hasPakistanRelation.value : undefined,
          pakistanRelationDetails: fam.pakistanRelationDetails?.value ? fam.pakistanRelationDetails.value : undefined,
        }
      : undefined,
    employment: hasEmployment
      ? {
          presentOccupation: emp.presentOccupation?.value ? emp.presentOccupation.value : undefined,
          employerName: emp.employerName?.value ? emp.employerName.value : undefined,
          designationRank: emp.designationRank?.value ? emp.designationRank.value : undefined,
          employerAddress: emp.employerAddress?.value ? emp.employerAddress.value : undefined,
          employerPhone: emp.employerPhone?.value ? emp.employerPhone.value : undefined,
          pastOccupation: emp.pastOccupation?.value ? emp.pastOccupation.value : undefined,
          hasMilitaryService: emp.hasMilitaryService?.value !== undefined ? emp.hasMilitaryService.value : undefined,
          militaryOrganization: emp.militaryOrganization?.value ? emp.militaryOrganization.value : undefined,
          militaryDesignation: emp.militaryDesignation?.value ? emp.militaryDesignation.value : undefined,
          militaryRank: emp.militaryRank?.value ? emp.militaryRank.value : undefined,
          militaryPlaceOfPosting: emp.militaryPlaceOfPosting?.value ? emp.militaryPlaceOfPosting.value : undefined,
        }
      : undefined,
    travel: hasTravel
      ? {
          purposeOfVisit: tr.purposeOfVisit?.value ? tr.purposeOfVisit.value : undefined,
          intendedArrivalDate: tr.journeyDate?.value
            ? tr.journeyDate.value
            : tr.intendedArrivalDate?.value
            ? tr.intendedArrivalDate.value
            : undefined,
          duration: tr.duration?.value ? tr.duration.value : undefined,
          visaEntryType: tr.visaEntryType?.value ? tr.visaEntryType.value : undefined,
          entryPoint: tr.entryPoint?.value ? tr.entryPoint.value : undefined,
          exitPoint: tr.exitPoint?.value ? tr.exitPoint.value : undefined,
          countriesVisited: tr.countriesVisited?.value ? tr.countriesVisited.value : undefined,
          visitedSaarc: tr.visitedSaarc?.value !== undefined ? tr.visitedSaarc.value : undefined,
        }
      : undefined,
    previousVisa: hasPreviousVisa
      ? {
          hasPreviousVisa: pv.hasPreviousVisa?.value !== undefined ? pv.hasPreviousVisa.value : undefined,
          visaNumber: pv.visaNumber?.value ? pv.visaNumber.value : undefined,
          visaType: pv.visaType?.value ? pv.visaType.value : undefined,
          placeOfIssue: pv.placeOfIssue?.value ? pv.placeOfIssue.value : undefined,
          dateOfIssue: pv.dateOfIssue?.value ? pv.dateOfIssue.value : undefined,
          visitedAddress1: pv.visitedAddress1?.value ? pv.visitedAddress1.value : undefined,
          visitedAddress2: pv.visitedAddress2?.value ? pv.visitedAddress2.value : undefined,
          visitedAddress3: pv.visitedAddress3?.value ? pv.visitedAddress3.value : undefined,
          hasRefusal: pv.hasRefusal?.value !== undefined ? pv.hasRefusal.value : undefined,
          refusalDetails: pv.refusalDetails?.value ? pv.refusalDetails.value : undefined,
        }
      : undefined,
    reference: hasSponsorInd
      ? {
          name: spInd.name?.value ? spInd.name.value : undefined,
          addressLine1: spInd.addressLine1?.value ? spInd.addressLine1.value : undefined,
          addressLine2: spInd.addressLine2?.value ? spInd.addressLine2.value : undefined,
          phone: spInd.phone?.value ? spInd.phone.value : undefined,
          email: spInd.email?.value ? spInd.email.value : undefined,
        }
      : undefined,
    sponsorMission: hasSponsorMsn
      ? {
          name: spMsn.name?.value ? spMsn.name.value : undefined,
          addressLine1: spMsn.addressLine1?.value ? spMsn.addressLine1.value : undefined,
          addressLine2: spMsn.addressLine2?.value ? spMsn.addressLine2.value : undefined,
          phone: spMsn.phone?.value ? spMsn.phone.value : undefined,
          email: spMsn.email?.value ? spMsn.email.value : undefined,
        }
      : undefined,
  }

  // Immutable normalization pass
  return normalizeApplicant(merged)
}
