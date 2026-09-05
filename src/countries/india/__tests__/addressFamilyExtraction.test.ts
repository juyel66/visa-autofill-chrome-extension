import {
  extractFromPdfText,
  mergeExtractedCandidateData,
  normalizeMaritalStatus,
  normalizeOccupation,
} from '../../../core/extraction/data/applicantDataExtractor'
import { applyExtractionToApplicant } from '../../../core/extraction/data/extractionMapper'
import { resolveCandidateData } from '../../../core/autofill/candidateResolver'
import { executeAutofill } from '../../../core/autofill/autofillEngine'
import { BANGLADESH_FAMILY_DETAILS_MAPPINGS } from '../mappings/bangladesh/familyDetails'
import { BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML } from './fixtures'
import type { ApplicantProfile } from '../../../core/applicant/types'
import type { DocumentRecord } from '../../../core/document/types'
import type { ExtractedApplicantData } from '../../../core/extraction/data/types'

export interface AddressFamilyExtractionTestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runAddressFamilyExtractionTests(): Promise<AddressFamilyExtractionTestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  // =========================================================================
  // Test 1: Multi-line address extraction (Canonical Present Address)
  // =========================================================================
  totalSubtests++
  const multiLineDocText = `
    PASSPORT NO: A12345678
    Date of Birth: 1990-05-15
    Present Address:
      Flat 4B, Green Tower
      12 Kamal Ataturk Avenue
      Dhaka
    Postal Code: 1212
    Country: BANGLADESH
  `
  const extracted1 = extractFromPdfText(multiLineDocText)
  if (
    !extracted1.presentAddress?.addressLine1?.value ||
    !extracted1.presentAddress?.addressLine2?.value ||
    !extracted1.presentAddress?.villageTownCity?.value ||
    extracted1.presentAddress.addressLine1.value !== 'Flat 4B, Green Tower' ||
    extracted1.presentAddress.addressLine2.value !== '12 Kamal Ataturk Avenue' ||
    extracted1.presentAddress.villageTownCity.value !== 'Dhaka' ||
    extracted1.presentAddress.postalCode?.value !== '1212' ||
    extracted1.presentAddress.country?.value !== 'BANGLADESH'
  ) {
    failures.push(`Test 1 Failed: Multi-line address extraction failed: ${JSON.stringify(extracted1.presentAddress)}`)
  }

  // =========================================================================
  // Test 2: Address components (Distinct Present & Permanent addresses)
  // =========================================================================
  totalSubtests++
  const separateAddrText = `
    Present Address Line 1: House 5, Road 10
    Present Address Line 2: Dhanmondi
    Present City: Dhaka
    Present District: Dhaka
    Present Postal Code: 1205
    Present Country: BANGLADESH
    Permanent Address Line 1: Village Baroipara
    Permanent Address Line 2: P.O. Ghorashal
    Permanent City: Narsingdi
    Permanent Postal Code: 1610
    Permanent Country: BANGLADESH
  `
  const extracted2 = extractFromPdfText(separateAddrText)
  if (
    extracted2.presentAddress?.addressLine1?.value !== 'House 5, Road 10' ||
    extracted2.presentAddress?.addressLine2?.value !== 'Dhanmondi' ||
    extracted2.presentAddress?.villageTownCity?.value !== 'Dhaka' ||
    extracted2.presentAddress?.postalCode?.value !== '1205' ||
    extracted2.permanentAddress?.addressLine1?.value !== 'Village Baroipara' ||
    extracted2.permanentAddress?.addressLine2?.value !== 'P.O. Ghorashal' ||
    extracted2.permanentAddress?.villageTownCity?.value !== 'Narsingdi' ||
    extracted2.permanentAddress?.postalCode?.value !== '1610'
  ) {
    failures.push(`Test 2 Failed: Distinct address components extraction failed: ${JSON.stringify(extracted2)}`)
  }

  // =========================================================================
  // Test 3: Father name extraction into canonical family.father.name
  // =========================================================================
  totalSubtests++
  const fatherDoc = `
    Father's Name: MD ABDUR RAHMAN
    Passport No: B98765432
  `
  const extracted3 = extractFromPdfText(fatherDoc)
  if (extracted3.family?.father?.name?.value !== 'MD ABDUR RAHMAN') {
    failures.push(`Test 3 Failed: Father's Name extraction failed: got '${extracted3.family?.father?.name?.value}'`)
  }

  // =========================================================================
  // Test 4: Mother name extraction into canonical family.mother.name
  // =========================================================================
  totalSubtests++
  const motherDoc = `
    Mother Name: ROKEYA BEGUM
    Passport No: B98765432
  `
  const extracted4 = extractFromPdfText(motherDoc)
  if (extracted4.family?.mother?.name?.value !== 'ROKEYA BEGUM') {
    failures.push(`Test 4 Failed: Mother's Name extraction failed: got '${extracted4.family?.mother?.name?.value}'`)
  }

  // =========================================================================
  // Test 5: Father birthplace extraction into canonical family.father.placeOfBirth
  // =========================================================================
  totalSubtests++
  const fatherBirthDoc = `
    Father's Name: ANWAR HOSSAIN
    Father Place of Birth: COMILLA
  `
  const extracted5 = extractFromPdfText(fatherBirthDoc)
  if (extracted5.family?.father?.placeOfBirth?.value !== 'COMILLA') {
    failures.push(`Test 5 Failed: Father Place of Birth extraction failed: got '${extracted5.family?.father?.placeOfBirth?.value}'`)
  }

  // =========================================================================
  // Test 6: Mother birthplace extraction into canonical family.mother.placeOfBirth
  // =========================================================================
  totalSubtests++
  const motherBirthDoc = `
    Mother's Name: SHAHANA AKTER
    Mother Place of Birth: SYLHET
  `
  const extracted6 = extractFromPdfText(motherBirthDoc)
  if (extracted6.family?.mother?.placeOfBirth?.value !== 'SYLHET') {
    failures.push(`Test 6 Failed: Mother Place of Birth extraction failed: got '${extracted6.family?.mother?.placeOfBirth?.value}'`)
  }

  // =========================================================================
  // Test 7: Family nationality & previous nationality extraction (Father & Mother)
  // =========================================================================
  totalSubtests++
  const familyNatDoc = `
    Father's Nationality: BANGLADESH
    Father Previous Nationality: BRITISH
    Mother's Nationality: BANGLADESH
    Mother Previous Nationality: BRITISH
    Mother Country of Birth: BANGLADESH
  `
  const extracted7 = extractFromPdfText(familyNatDoc)
  if (
    extracted7.family?.father?.nationality?.value !== 'BANGLADESH' ||
    extracted7.family?.father?.previousNationality?.value !== 'BRITISH' ||
    extracted7.family?.mother?.nationality?.value !== 'BANGLADESH' ||
    extracted7.family?.mother?.previousNationality?.value !== 'BRITISH' ||
    extracted7.family?.mother?.countryOfBirth?.value !== 'BANGLADESH'
  ) {
    failures.push(`Test 7 Failed: Family nationality extraction failed: ${JSON.stringify(extracted7.family)}`)
  }

  // =========================================================================
  // Test 8: Spouse extraction into canonical family.spouse.*
  // =========================================================================
  totalSubtests++
  const spouseDoc = `
    Spouse Name: NUSRAT JAHAN
    Spouse Place of Birth: DHAKA
    Spouse Country of Birth: BANGLADESH
    Spouse Nationality: BANGLADESH
    Spouse Previous Nationality: BANGLADESH
  `
  const extracted8 = extractFromPdfText(spouseDoc)
  if (
    extracted8.family?.spouse?.name?.value !== 'NUSRAT JAHAN' ||
    extracted8.family?.spouse?.placeOfBirth?.value !== 'DHAKA' ||
    extracted8.family?.spouse?.countryOfBirth?.value !== 'BANGLADESH' ||
    extracted8.family?.spouse?.nationality?.value !== 'BANGLADESH' ||
    extracted8.family?.spouse?.previousNationality?.value !== 'BANGLADESH'
  ) {
    failures.push(`Test 8 Failed: Spouse extraction failed: ${JSON.stringify(extracted8.family?.spouse)}`)
  }

  // =========================================================================
  // Test 9: Marital status explicit extraction into canonical personal.maritalStatus
  // =========================================================================
  totalSubtests++
  const marriedDoc = `Marital Status: Married`
  const singleDoc = `Marital Status: Single`
  const ambigDoc = `Marital Status: Complex Relationship Status`
  const extMarried = extractFromPdfText(marriedDoc)
  const extSingle = extractFromPdfText(singleDoc)
  const extAmbig = extractFromPdfText(ambigDoc)

  if (
    extMarried.personal?.maritalStatus?.value !== '0' ||
    extSingle.personal?.maritalStatus?.value !== '1' ||
    extAmbig.personal?.maritalStatus !== undefined ||
    normalizeMaritalStatus('MARRIED') !== '0' ||
    normalizeMaritalStatus('SINGLE') !== '1' ||
    normalizeMaritalStatus('UNKNOWN') !== undefined
  ) {
    failures.push(`Test 9 Failed: Marital status extraction / normalization failed. Married: '${extMarried.personal?.maritalStatus?.value}', Single: '${extSingle.personal?.maritalStatus?.value}'`)
  }

  // =========================================================================
  // Test 10: Occupation explicit extraction & deterministic normalization
  // =========================================================================
  totalSubtests++
  const occEngDoc = `Present Occupation: SOFTWARE ENGINEER`
  const occDocDoc = `Occupation: DOCTOR`
  const occGovDoc = `Profession: GOVT SERVICE`
  const occUnkDoc = `Occupation: SPACE EXPLORER`

  const extEng = extractFromPdfText(occEngDoc)
  const extDoc = extractFromPdfText(occDocDoc)
  const extGov = extractFromPdfText(occGovDoc)
  const extUnk = extractFromPdfText(occUnkDoc)

  if (
    extEng.employment?.presentOccupation?.value !== 'ENGINEER' ||
    extDoc.employment?.presentOccupation?.value !== 'DOCTOR' ||
    extGov.employment?.presentOccupation?.value !== 'GOVERNMENT SERVICE' ||
    extUnk.employment?.presentOccupation !== undefined ||
    normalizeOccupation('BUSINESSMAN') !== 'BUSINESS PERSON' ||
    normalizeOccupation('FREELANCER') !== 'SELF EMPLOYED/ FREELANCER' ||
    normalizeOccupation('RANDOM STRING') !== undefined
  ) {
    failures.push(`Test 10 Failed: Occupation extraction / normalization failed: Eng=${extEng.employment?.presentOccupation?.value}, Doc=${extDoc.employment?.presentOccupation?.value}, Gov=${extGov.employment?.presentOccupation?.value}, Unk=${extUnk.employment?.presentOccupation?.value}`)
  }

  // =========================================================================
  // Test 11: Employer details extraction into canonical employment.*
  // =========================================================================
  totalSubtests++
  const empDoc = `
    Employer Name: ABC Technologies Ltd
    Designation: Senior Architect
    Employer Address: Gulshan 2, Dhaka 1212
    Employer Phone: +8801711223344
  `
  const extEmp = extractFromPdfText(empDoc)
  if (
    extEmp.employment?.employerName?.value !== 'ABC Technologies Ltd' ||
    extEmp.employment?.designationRank?.value !== 'Senior Architect' ||
    extEmp.employment?.employerAddress?.value !== 'Gulshan 2, Dhaka 1212' ||
    extEmp.employment?.employerPhone?.value !== '+8801711223344'
  ) {
    failures.push(`Test 11 Failed: Employer details extraction failed: ${JSON.stringify(extEmp.employment)}`)
  }

  // =========================================================================
  // Test 12: Previous military / security details extraction into canonical employment.*
  // =========================================================================
  totalSubtests++
  const milDoc = `
    Previous Organization: Bangladesh Army
    Previous Designation: Staff Officer
    Previous Rank: Major
    Previous Posting: Dhaka Cantonment
  `
  const extMil = extractFromPdfText(milDoc)
  if (
    extMil.employment?.militaryOrganization?.value !== 'Bangladesh Army' ||
    extMil.employment?.militaryDesignation?.value !== 'Staff Officer' ||
    extMil.employment?.militaryRank?.value !== 'Major' ||
    extMil.employment?.militaryPlaceOfPosting?.value !== 'Dhaka Cantonment' ||
    extMil.employment?.hasMilitaryService?.value !== true
  ) {
    failures.push(`Test 12 Failed: Military/Security extraction failed: ${JSON.stringify(extMil.employment)}`)
  }

  // =========================================================================
  // Test 13: Missing family data -> remains undefined
  // =========================================================================
  totalSubtests++
  const minimalDoc = `
    Passport No: X1234567
    Date of Birth: 1985-10-10
  `
  const extMin = extractFromPdfText(minimalDoc)
  if (
    extMin.family?.father?.name !== undefined ||
    extMin.family?.mother?.name !== undefined ||
    extMin.family?.father?.placeOfBirth !== undefined ||
    extMin.family?.mother?.nationality !== undefined ||
    extMin.family?.spouse !== undefined ||
    extMin.presentAddress?.addressLine1 !== undefined ||
    extMin.employment?.presentOccupation !== undefined
  ) {
    failures.push(`Test 13 Failed: Missing data should be undefined: ${JSON.stringify(extMin)}`)
  }

  // =========================================================================
  // Test 14: No inference of family nationality/birthplace from applicant
  // =========================================================================
  totalSubtests++
  const applicantNatOnlyDoc = `
    Passport No: X1234567
    Nationality: BANGLADESH
    Town of Birth: SYLHET
    Country of Birth: BANGLADESH
    Father's Name: KABIR AHMED
  `
  const extNat = extractFromPdfText(applicantNatOnlyDoc)
  if (
    extNat.family?.father?.nationality !== undefined ||
    extNat.family?.father?.countryOfBirth !== undefined ||
    extNat.family?.father?.placeOfBirth !== undefined ||
    extNat.family?.mother?.nationality !== undefined
  ) {
    failures.push(`Test 14 Failed: Family nationality/birthplace must not be inferred from applicant: ${JSON.stringify(extNat.family)}`)
  }

  // =========================================================================
  // Test 15: No inference of military/employer from ordinary occupation
  // =========================================================================
  totalSubtests++
  const occOnlyDoc = `
    Occupation: ENGINEER
  `
  const extOccOnly = extractFromPdfText(occOnlyDoc)
  if (
    extOccOnly.employment?.employerName !== undefined ||
    extOccOnly.employment?.designationRank !== undefined ||
    extOccOnly.employment?.militaryOrganization !== undefined ||
    extOccOnly.employment?.hasMilitaryService !== undefined
  ) {
    failures.push(`Test 15 Failed: Employer/Military details must not be derived from occupation: ${JSON.stringify(extOccOnly.employment)}`)
  }

  // =========================================================================
  // Test 16: No inference of grandparent / Pakistan status
  // =========================================================================
  totalSubtests++
  const gpAbsentDoc = `
    Father's Name: TARIQ KHAN
    Mother's Name: NAZMA KHAN
    Nationality: BANGLADESH
  `
  const extGpAbsent = extractFromPdfText(gpAbsentDoc)
  if (
    extGpAbsent.family?.hasPakistanRelation !== undefined ||
    extGpAbsent.family?.pakistanRelationDetails !== undefined
  ) {
    failures.push(`Test 16 Failed: Grandparent Pakistan relation must never be guessed: ${JSON.stringify(extGpAbsent.family)}`)
  }

  // =========================================================================
  // Test 17: Country option matching in Autofill execution for Family & Spouse
  // =========================================================================
  totalSubtests++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML

    const confirmedData: ExtractedApplicantData = {
      family: {
        father: {
          countryOfBirth: { value: 'BANGLADESH', source: 'pdf-text', confidence: 90 },
          nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 90 },
        },
        spouse: {
          nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 90 },
          countryOfBirth: { value: 'BANGLADESH', source: 'pdf-text', confidence: 90 },
        },
      },
    }
    const profile: ApplicantProfile = {
      applicantId: 'app-country-test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const resolvedProfile = applyExtractionToApplicant(profile, confirmedData)

    const countryMappings = BANGLADESH_FAMILY_DETAILS_MAPPINGS.filter(
      (m) =>
        m.id === 'bd_family_father_country_birth' ||
        m.id === 'bd_family_father_nat' ||
        m.id === 'bd_family_spouse_nat' ||
        m.id === 'bd_family_spouse_country_birth'
    )
    const autofillRes = await executeAutofill({
      mappings: countryMappings,
      applicant: resolvedProfile,
    })

    const fatherCountrySelect = document.querySelector('#father_country_of_birth') as HTMLSelectElement
    const fatherNatSelect = document.querySelector('#father_nationality') as HTMLSelectElement
    const spouseCountrySelect = document.querySelector('#spouse_birth_country') as HTMLSelectElement
    const spouseNatSelect = document.querySelector('#spouse_nationality') as HTMLSelectElement

    if (
      !autofillRes.success ||
      fatherCountrySelect?.value !== 'BGD' ||
      fatherNatSelect?.value !== 'BGD' ||
      spouseCountrySelect?.value !== 'BGD' ||
      spouseNatSelect?.value !== 'BGD'
    ) {
      failures.push(
        `Test 17 Failed: Country option matching failed. FatherCountry='${fatherCountrySelect?.value}', FatherNat='${fatherNatSelect?.value}', SpouseCountry='${spouseCountrySelect?.value}', SpouseNat='${spouseNatSelect?.value}'`
      )
    }
  }

  // =========================================================================
  // Test 18: Zero ApplicantProfile fallback (Confirmed document is ONLY source)
  // =========================================================================
  totalSubtests++
  const confirmedDocRecord: DocumentRecord = {
    documentId: 'doc-valid-01',
    applicantId: 'app-fallback-test',
    documentType: 'passport',
    fileName: 'passport.pdf',
    mimeType: 'application/pdf',
    fileSize: 50000,
    status: 'processed',
    source: 'user-upload',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    extractedDataConfirmed: true,
    extractedData: {
      personal: {
        lastName: { value: 'RAHMAN', source: 'pdf-text', confidence: 95 },
      },
      family: {
        father: {
          name: { value: 'ABDUR RAHMAN', source: 'pdf-text', confidence: 90 },
        },
      },
      // Note: addressLine1 is NOT present in confirmed document
    },
  }

  const candRes = resolveCandidateData({
    profileId: 'app-fallback-test',
    documents: [confirmedDocRecord],
  })

  if (
    candRes.status !== 'READY' ||
    candRes.applicant?.personalInfo?.surname !== 'RAHMAN' ||
    candRes.applicant?.family?.father?.name !== 'ABDUR RAHMAN' ||
    candRes.applicant?.presentAddress?.addressLine1 !== undefined // MUST BE UNDEFINED, zero fallback to pre-existing profile!
  ) {
    failures.push(`Test 18 Failed: CandidateResolver fell back to pre-existing profile data: ${JSON.stringify(candRes.applicant)}`)
  }

  // =========================================================================
  // Test 19: No DOM mutation when source is missing
  // =========================================================================
  totalSubtests++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML

    // Pre-populate DOM field with existing user value
    const presAdd1Input = document.querySelector('#pres_add1') as HTMLInputElement
    const fatherPlaceInput = document.querySelector('#father_place_of_birth') as HTMLInputElement
    presAdd1Input.value = 'Existing User Line 1'
    fatherPlaceInput.value = 'Existing Birthplace'

    // Confirmed document does NOT contain presentAddress or father place of birth
    const partialDoc: ExtractedApplicantData = {
      family: {
        father: {
          name: { value: 'KAMAL HOSSAIN', source: 'pdf-text', confidence: 90 },
        },
      },
    }
    const profile: ApplicantProfile = {
      applicantId: 'app-no-mutation-test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const resolved = applyExtractionToApplicant(profile, partialDoc)

    await executeAutofill({
      mappings: BANGLADESH_FAMILY_DETAILS_MAPPINGS,
      applicant: resolved,
    })

    if (
      presAdd1Input.value !== 'Existing User Line 1' ||
      fatherPlaceInput.value !== 'Existing Birthplace'
    ) {
      failures.push(`Test 19 Failed: Missing source fields must not mutate DOM. Pres1='${presAdd1Input.value}', Birth='${fatherPlaceInput.value}'`)
    }
  }

  // =========================================================================
  // Test 20: Provenance preservation and conflict detection on nested paths
  // =========================================================================
  totalSubtests++
  const candidatePdf: ExtractedApplicantData = {
    personal: {
      maritalStatus: { value: '0', source: 'pdf-text', confidence: 85 },
    },
    presentAddress: {
      addressLine1: { value: '12 Kemal Ataturk Avenue', source: 'pdf-text', confidence: 85 },
    },
    family: {
      father: {
        name: { value: 'MD ABDUR RAHMAN', source: 'pdf-text', confidence: 85 },
      },
    },
  }

  const candidateOcr: ExtractedApplicantData = {
    personal: {
      maritalStatus: { value: '1', source: 'ocr', confidence: 70 }, // Conflicting
    },
    presentAddress: {
      addressLine1: { value: '14 Kemal Ataturk Avenue', source: 'ocr', confidence: 70 }, // Conflicting
    },
    family: {
      father: {
        name: { value: 'MD ABDUR RAHMAN', source: 'ocr', confidence: 70 }, // Matching
      },
    },
  }

  const mergedRes = mergeExtractedCandidateData([candidatePdf, candidateOcr])

  if (
    mergedRes.merged.presentAddress?.addressLine1?.value !== '12 Kemal Ataturk Avenue' ||
    mergedRes.merged.presentAddress?.addressLine1?.source !== 'pdf-text' ||
    mergedRes.merged.family?.father?.name?.value !== 'MD ABDUR RAHMAN' ||
    mergedRes.merged.personal?.maritalStatus?.value !== '0' ||
    mergedRes.conflicts.length < 2 // Should detect conflicts on addressLine1 and personal.maritalStatus
  ) {
    failures.push(`Test 20 Failed: Provenance preservation / conflict tracking failed: merged=${JSON.stringify(mergedRes.merged)}, conflicts=${mergedRes.conflicts.length}`)
  }

  // =========================================================================
  // Test 21: Full End-to-End Extraction to Autofill on Family Details Form
  // =========================================================================
  totalSubtests++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML

    const fullDocText = `
      PASSPORT NO: A88997766
      Present Address:
        House 12, Road 4
        Banani, Dhaka
      Postal Code: 1213
      Country: BANGLADESH
      Mobile: +8801700112233
      Phone: 028899001
      Permanent Address:
        Village Charpara
        P.O. Munshiganj
      Father's Name: MOHAMMAD ALI
      Father Place of Birth: DHAKA
      Father Country of Birth: BANGLADESH
      Father Nationality: BANGLADESH
      Father Previous Nationality: BRITISH
      Mother's Name: FATEMA BEGUM
      Mother Place of Birth: CHITTAGONG
      Mother Country of Birth: BANGLADESH
      Mother Nationality: BANGLADESH
      Mother Previous Nationality: BRITISH
      Marital Status: Married
      Spouse Name: SALMA BEGUM
      Spouse Place of Birth: DHAKA
      Spouse Country of Birth: BANGLADESH
      Spouse Nationality: BANGLADESH
      Occupation: ENGINEER
      Employer Name: Tech Innovations BD
      Employer Designation: Lead Engineer
      Employer Address: Kawran Bazar, Dhaka
      Employer Phone: 0255112233
    `
    const extractedData = extractFromPdfText(fullDocText)
    const baseProf: ApplicantProfile = {
      applicantId: 'app-full-test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const resolvedProfile = applyExtractionToApplicant(baseProf, extractedData)

    const autofillResult = await executeAutofill({
      mappings: BANGLADESH_FAMILY_DETAILS_MAPPINGS,
      applicant: resolvedProfile,
    })

    const pres1 = (document.querySelector('#pres_add1') as HTMLInputElement)?.value
    const pres2 = (document.querySelector('#pres_add2') as HTMLInputElement)?.value
    const pincode = (document.querySelector('#pincode') as HTMLInputElement)?.value
    const fatherName = (document.querySelector('#fthrname') as HTMLInputElement)?.value
    const fatherPrevNat = (document.querySelector('#father_prev_nationality') as HTMLSelectElement)?.value
    const motherName = (document.querySelector('#mother_name') as HTMLInputElement)?.value
    const motherPrevNat = (document.querySelector('#mother_prev_nationality') as HTMLSelectElement)?.value
    const maritalSelect = (document.querySelector('#marital_status') as HTMLSelectElement)?.value
    const spouseName = (document.querySelector('#spouse_name') as HTMLInputElement)?.value
    const spouseNat = (document.querySelector('#spouse_nationality') as HTMLSelectElement)?.value
    const occSelect = (document.querySelector('#occupation') as HTMLSelectElement)?.value
    const empName = (document.querySelector('#empname') as HTMLInputElement)?.value
    const sameAddr = (document.querySelector('#sameAddress_id') as HTMLInputElement)?.checked

    const sameAddrRes = autofillResult.results.find((r) => r.fieldId === 'bd_family_same_address')
    const autofillableFailed = autofillResult.results.filter(
      (r) => r.status === 'failed' && r.fieldId !== 'bd_family_same_address'
    )

    if (
      autofillableFailed.length > 0 ||
      sameAddrRes?.failureType !== 'manual-required' ||
      pres1 !== 'House 12, Road 4' ||
      pres2 !== 'Banani, Dhaka' ||
      pincode !== '1213' ||
      fatherName !== 'MOHAMMAD ALI' ||
      fatherPrevNat !== 'GBR' ||
      motherName !== 'FATEMA BEGUM' ||
      motherPrevNat !== 'GBR' ||
      (maritalSelect !== '0' && maritalSelect !== 'Married') ||
      spouseName !== 'SALMA BEGUM' ||
      spouseNat !== 'BGD' ||
      occSelect !== 'ENGINEER' ||
      empName !== 'TECH INNOVATIONS BD' ||
      sameAddr !== false // Same address checkbox must remain unselected
    ) {
      failures.push(
        `Test 21 Failed: Full Autofill execution failed. pres1='${pres1}', pres2='${pres2}', pin='${pincode}', fthr='${fatherName}', fthrPrev='${fatherPrevNat}', mthr='${motherName}', mthrPrev='${motherPrevNat}', marital='${maritalSelect}', spouse='${spouseName}', spouseNat='${spouseNat}', occ='${occSelect}', emp='${empName}', sameAddr='${sameAddr}'`
      )
    }
  }

  // =========================================================================
  // Test 22: ApplicantProfile Fallback Regression Tests (Cases A, B, C, D, E)
  // =========================================================================
  totalSubtests++
  {
    const existingProfile: ApplicantProfile = {
      applicantId: 'app-fallback-matrix',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      personalInfo: {
        surname: 'OLD_SURNAME',
        townCityOfBirth: 'OLD_CITY',
      },
      presentAddress: {
        addressLine1: 'OLD_PRES_ADD1',
      },
      permanentAddress: {
        addressLine1: 'OLD_PERM_ADD1',
        postalCode: '9999',
      },
      family: {
        father: {
          name: 'OLD_FATHER_NAME',
          nationality: 'OLD_FATHER_NAT',
        },
        mother: {
          name: 'OLD_MOTHER_NAME',
        },
      },
      employment: {
        presentOccupation: 'STUDENT',
        hasMilitaryService: true,
        militaryOrganization: 'OLD_ARMY',
      },
    }

    // Confirmed document has specific fields only
    const confirmedDoc: ExtractedApplicantData = {
      personal: {
        lastName: { value: 'DOC_SURNAME', source: 'pdf-text', confidence: 95 },
      },
      family: {
        father: {
          name: { value: 'DOC_FATHER_NAME', source: 'pdf-text', confidence: 95 },
          // No father nationality in document!
        },
        // No mother in document!
      },
      presentAddress: {
        addressLine1: { value: 'DOC_PRES_ADD1', source: 'pdf-text', confidence: 90 },
      },
      // No permanent address in document!
      // No military service in document!
    }

    const resolved = applyExtractionToApplicant(existingProfile, confirmedDoc)

    // A. Document has value + Profile has different value -> document value wins
    const caseAPassed =
      resolved.personalInfo?.surname === 'DOC_SURNAME' &&
      resolved.family?.father?.name === 'DOC_FATHER_NAME' &&
      resolved.presentAddress?.addressLine1 === 'DOC_PRES_ADD1'

    // B. Document has no value + Profile has value -> field remains undefined
    const caseBPassed =
      resolved.personalInfo?.townCityOfBirth === undefined &&
      resolved.family?.mother === undefined

    // C. Document has no family nationality + Profile has family nationality -> no autofill / undefined
    const caseCPassed = resolved.family?.father?.nationality === undefined

    // D. Document has no military service + Profile has military service -> no autofill / undefined
    const caseDPassed =
      resolved.employment?.hasMilitaryService === undefined &&
      resolved.employment?.militaryOrganization === undefined

    // E. Document has no permanent address + Profile has permanent address -> no autofill / undefined
    const caseEPassed =
      resolved.permanentAddress?.addressLine1 === undefined &&
      resolved.permanentAddress?.postalCode === undefined

    if (!caseAPassed || !caseBPassed || !caseCPassed || !caseDPassed || !caseEPassed) {
      failures.push(
        `Test 22 Failed: Fallback regression matrix failure. A=${caseAPassed}, B=${caseBPassed}, C=${caseCPassed}, D=${caseDPassed}, E=${caseEPassed}`
      )
    }
  }

  // =========================================================================
  // Test 23: DOM Safety & Non-Destructive Invariant Tests
  // =========================================================================
  totalSubtests++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML

    // Pre-populate form fields
    const perm1Input = document.querySelector('#perm_address1') as HTMLInputElement
    const fatherPlaceInput = document.querySelector('#father_place_of_birth') as HTMLInputElement
    const fatherCountrySelect = document.querySelector('#father_country_of_birth') as HTMLSelectElement
    const sameAddrCheck = document.querySelector('#sameAddress_id') as HTMLInputElement
    const prevOrgYes = document.querySelector('#prev_org1') as HTMLInputElement
    const prevOrgNo = document.querySelector('#prev_org2') as HTMLInputElement

    perm1Input.value = 'User Pre-Entered Permanent Address'
    fatherPlaceInput.value = 'User Pre-Entered Birthplace'
    fatherCountrySelect.value = ''
    sameAddrCheck.checked = false
    prevOrgYes.checked = false
    prevOrgNo.checked = false

    // Applicant data with only present address and father name
    const sparseApplicant: ApplicantProfile = {
      applicantId: 'app-dom-safety',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      presentAddress: {
        addressLine1: 'New Present Address',
      },
      family: {
        father: {
          name: 'NEW FATHER NAME',
        },
      },
    }

    await executeAutofill({
      mappings: BANGLADESH_FAMILY_DETAILS_MAPPINGS,
      applicant: sparseApplicant,
    })

    const pres1Val = (document.querySelector('#pres_add1') as HTMLInputElement)?.value
    const perm1Val = (document.querySelector('#perm_address1') as HTMLInputElement)?.value
    const fatherNameVal = (document.querySelector('#fthrname') as HTMLInputElement)?.value
    const fatherPlaceVal = (document.querySelector('#father_place_of_birth') as HTMLInputElement)?.value
    const sameAddrState = (document.querySelector('#sameAddress_id') as HTMLInputElement)?.checked

    if (
      pres1Val !== 'New Present Address' ||
      fatherNameVal !== 'NEW FATHER NAME' ||
      perm1Val !== 'User Pre-Entered Permanent Address' || // MUST NOT be cleared or overwritten
      fatherPlaceVal !== 'User Pre-Entered Birthplace' ||   // MUST NOT be cleared or overwritten
      sameAddrState !== false                              // MUST NOT be clicked or checked
    ) {
      failures.push(
        `Test 23 Failed: DOM safety invariant violated. pres1='${pres1Val}', fthr='${fatherNameVal}', perm1='${perm1Val}', fthrPlace='${fatherPlaceVal}', sameAddr=${sameAddrState}`
      )
    }
  }

  // =========================================================================
  // Test 24: Address Separation Safety & Multi-line Isolation Tests
  // =========================================================================
  totalSubtests++
  {
    const docWithOnlyPresent = `
      Present Address Line 1: Road 27, House 14
      Present Address Line 2: Block A, Banani
      Present City: Dhaka
      Postal Code: 1213
      Country: BANGLADESH
    `
    const extPresentOnly = extractFromPdfText(docWithOnlyPresent)

    if (
      extPresentOnly.presentAddress?.addressLine1?.value !== 'Road 27, House 14' ||
      extPresentOnly.presentAddress?.addressLine2?.value !== 'Block A, Banani' ||
      extPresentOnly.presentAddress?.villageTownCity?.value !== 'Dhaka' ||
      extPresentOnly.presentAddress?.postalCode?.value !== '1213' ||
      extPresentOnly.permanentAddress?.addressLine1 !== undefined || // Must NOT bleed into permanent address
      extPresentOnly.permanentAddress?.villageTownCity !== undefined ||
      extPresentOnly.permanentAddress?.postalCode !== undefined
    ) {
      failures.push(
        `Test 24 Failed: Address separation failed. Present data bled into permanent fields: ${JSON.stringify(extPresentOnly)}`
      )
    }
  }

  // =========================================================================
  // Test 25: Family & Spouse Separation & Zero Inference Tests
  // =========================================================================
  totalSubtests++
  {
    const docWithApplicantAndSpouse = `
      Passport No: B12345678
      Surname: AHMED
      Given Names: TANVIR
      Nationality: BANGLADESH
      Town of Birth: SYLHET
      Country of Birth: BANGLADESH
      Spouse Name: RASHIDA KHAN
    `
    const extFamilyIso = extractFromPdfText(docWithApplicantAndSpouse)

    // Father & Mother fields must remain undefined
    const fatherUndefined = extFamilyIso.family?.father === undefined
    const motherUndefined = extFamilyIso.family?.mother === undefined

    // Spouse name is extracted, but spouse nationality/birthplace must NOT be inferred from applicant
    const spouseNameOk = extFamilyIso.family?.spouse?.name?.value === 'RASHIDA KHAN'
    const spouseNatUndefined = extFamilyIso.family?.spouse?.nationality === undefined
    const spouseBirthUndefined = extFamilyIso.family?.spouse?.placeOfBirth === undefined

    // Marital status must NOT be inferred from presence of spouse
    const maritalStatusUndefined = extFamilyIso.personal?.maritalStatus === undefined

    if (
      !fatherUndefined ||
      !motherUndefined ||
      !spouseNameOk ||
      !spouseNatUndefined ||
      !spouseBirthUndefined ||
      !maritalStatusUndefined
    ) {
      failures.push(
        `Test 25 Failed: Family separation/zero inference failed: fatherUndef=${fatherUndefined}, motherUndef=${motherUndefined}, spouseName=${spouseNameOk}, spouseNatUndef=${spouseNatUndefined}, maritalUndef=${maritalStatusUndefined}`
      )
    }
  }

  // =========================================================================
  // Test 26: Strict Employment & Military Service Non-Inference Tests
  // =========================================================================
  totalSubtests++
  {
    const civilGovDoc = `
      Occupation: GOVERNMENT SERVICE
      Employer Name: Ministry of Finance
      Designation: Senior Assistant Secretary
      Employer Address: Bangladesh Secretariat, Dhaka
      Employer Phone: 029511223
    `
    const extCivilGov = extractFromPdfText(civilGovDoc)

    // Civil service / Officer title must NOT trigger military service
    const noMilitary =
      extCivilGov.employment?.hasMilitaryService === undefined &&
      extCivilGov.employment?.militaryOrganization === undefined &&
      extCivilGov.employment?.militaryDesignation === undefined &&
      extCivilGov.employment?.militaryRank === undefined

    const occOk = extCivilGov.employment?.presentOccupation?.value === 'GOVERNMENT SERVICE'
    const empNameOk = extCivilGov.employment?.employerName?.value === 'Ministry of Finance'

    if (!noMilitary || !occOk || !empNameOk) {
      failures.push(
        `Test 26 Failed: Military service incorrectly inferred from civil government job: ${JSON.stringify(extCivilGov.employment)}`
      )
    }
  }

  // =========================================================================
  // Test 27: Strict Grandparent / Pakistan Non-Inference Tests
  // =========================================================================
  totalSubtests++
  {
    const sensitiveDoc = `
      Passport No: Z11223344
      Surname: KHAN
      Father's Name: ASGHAR KHAN
      Mother's Name: ZUBAIDA KHAN
      Town of Birth: PESHAWAR
      Religion: ISLAM
    `
    const extSens = extractFromPdfText(sensitiveDoc)

    // Grandparent Pakistan relation must NEVER be guessed from surname, birthplace, or religion
    const noPakistanRelation =
      extSens.family?.hasPakistanRelation === undefined &&
      extSens.family?.pakistanRelationDetails === undefined

    if (!noPakistanRelation) {
      failures.push(
        `Test 27 Failed: Grandparent Pakistan relation was incorrectly inferred from text clues: ${JSON.stringify(extSens.family)}`
      )
    }
  }

  // =========================================================================
  // Test 28: Provenance Integrity End-to-End Test
  // =========================================================================
  totalSubtests++
  {
    const pdfText = `
      Father's Name: MD ABDUL KARIM
      Father's Nationality: BANGLADESH
      Marital Status: Single
      Occupation: DOCTOR
    `
    const extracted = extractFromPdfText(pdfText)

    const fatherNameProv = extracted.family?.father?.name
    const fatherNatProv = extracted.family?.father?.nationality
    const maritalProv = extracted.personal?.maritalStatus
    const occProv = extracted.employment?.presentOccupation

    const provIntact =
      fatherNameProv?.source === 'pdf-text' &&
      fatherNameProv?.confidence === 85 &&
      fatherNatProv?.source === 'pdf-text' &&
      fatherNatProv?.confidence === 85 &&
      maritalProv?.source === 'pdf-text' &&
      maritalProv?.value === '1' &&
      occProv?.source === 'pdf-text' &&
      occProv?.value === 'DOCTOR'

    if (!provIntact) {
      failures.push(
        `Test 28 Failed: Provenance metadata was lost during extraction: ${JSON.stringify({
          fatherNameProv,
          fatherNatProv,
          maritalProv,
          occProv,
        })}`
      )
    }
  }

  // =========================================================================
  // Test 29: SameAddress is strictly MANUAL-ONLY & NEVER auto-clicked
  // =========================================================================
  totalSubtests++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML

    const sameAddrCheckbox = document.querySelector('#sameAddress_id') as HTMLInputElement
    sameAddrCheckbox.checked = false

    // 1. Profile with sameAsPresentAddress=true
    const profileWithSameAddr: ApplicantProfile = {
      applicantId: 'app-same-addr-test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      presentAddress: {
        addressLine1: 'Present Road 1',
        villageTownCity: 'Dhaka',
      },
      permanentAddress: {
        sameAsPresentAddress: true, // Should NOT trigger checkbox click!
      },
    }

    const sameAddrMapping = BANGLADESH_FAMILY_DETAILS_MAPPINGS.find((m) => m.id === 'bd_family_same_address')
    if (sameAddrMapping?.status !== 'manual-required' || sameAddrMapping?.sourceType !== 'manual') {
      failures.push(
        `Test 29 Failed: bd_family_same_address mapping must have status 'manual-required' and sourceType 'manual'. Got status='${sameAddrMapping?.status}', sourceType='${sameAddrMapping?.sourceType}'`
      )
    }

    await executeAutofill({
      mappings: BANGLADESH_FAMILY_DETAILS_MAPPINGS,
      applicant: profileWithSameAddr,
    })

    if (sameAddrCheckbox.checked !== false) {
      failures.push('Test 29 Failed: #sameAddress_id was clicked/automated when sameAsPresentAddress=true was provided.')
    }

    // 2. Document with identical present and permanent addresses
    const identicalAddrDoc = `
      Present Address Line 1: House 10, Road 5
      Present City: Dhaka
      Permanent Address Line 1: House 10, Road 5
      Permanent City: Dhaka
    `
    const extIdentical = extractFromPdfText(identicalAddrDoc)
    const baseProf: ApplicantProfile = {
      applicantId: 'app-identical-test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const resolvedIdentical = applyExtractionToApplicant(baseProf, extIdentical)

    sameAddrCheckbox.checked = false
    await executeAutofill({
      mappings: BANGLADESH_FAMILY_DETAILS_MAPPINGS,
      applicant: resolvedIdentical,
    })

    if (sameAddrCheckbox.checked !== false) {
      failures.push('Test 29 Failed: #sameAddress_id was clicked when present & permanent addresses were identical.')
    }
  }

  // =========================================================================
  // Test 30: Control Counting & Alternative Selector Invariant
  // =========================================================================
  totalSubtests++
  {
    // Verify that alternative selectors do not inflate the logical control count
    const familyMappings = BANGLADESH_FAMILY_DETAILS_MAPPINGS
    const uniqueMappingIds = new Set(familyMappings.map((m) => m.id))
    const uniqueTargetFields = new Set(familyMappings.map((m) => m.targetField))

    // Exactly 39 logical field mappings on Family Details
    if (familyMappings.length !== 39 || uniqueMappingIds.size !== 39 || uniqueTargetFields.size !== 39) {
      failures.push(
        `Test 30 Failed: Family Details mappings count mismatch. Length=${familyMappings.length}, uniqueIds=${uniqueMappingIds.size}, uniqueTargets=${uniqueTargetFields.size}`
      )
    }
  }

  // =========================================================================
  // Test 31: Absolute Zero ApplicantProfile Fallback Verification
  // =========================================================================
  totalSubtests++
  {
    const richPreexistingProfile: ApplicantProfile = {
      applicantId: 'app-full-fallback-audit',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      personalInfo: {
        surname: 'OLD_SURNAME',
        givenNames: 'OLD_GIVEN',
        maritalStatus: '1',
      },
      presentAddress: {
        addressLine1: 'OLD_PRES_1',
        villageTownCity: 'OLD_PRES_CITY',
      },
      permanentAddress: {
        addressLine1: 'OLD_PERM_1',
        villageTownCity: 'OLD_PERM_CITY',
      },
      family: {
        father: {
          name: 'OLD_FATHER',
          nationality: 'BANGLADESH',
        },
        mother: {
          name: 'OLD_MOTHER',
          nationality: 'BANGLADESH',
        },
        spouse: {
          name: 'OLD_SPOUSE',
        },
      },
      employment: {
        presentOccupation: 'ENGINEER',
        employerName: 'OLD_EMPLOYER',
        hasMilitaryService: true,
        militaryOrganization: 'OLD_ARMY',
      },
    }

    // Candidate extraction containing ONLY presentAddressLine1
    const singleFieldDoc: ExtractedApplicantData = {
      presentAddress: {
        addressLine1: { value: 'CONFIRMED_DOC_PRES_1', source: 'pdf-text', confidence: 95 },
      },
    }

    const isolatedApplicant = applyExtractionToApplicant(richPreexistingProfile, singleFieldDoc)

    const isIsolated =
      isolatedApplicant.presentAddress?.addressLine1 === 'CONFIRMED_DOC_PRES_1' &&
      isolatedApplicant.presentAddress?.villageTownCity === undefined &&
      isolatedApplicant.permanentAddress === undefined &&
      isolatedApplicant.family?.father === undefined &&
      isolatedApplicant.family?.mother === undefined &&
      isolatedApplicant.family?.spouse === undefined &&
      isolatedApplicant.personalInfo?.surname === undefined &&
      isolatedApplicant.personalInfo?.maritalStatus === undefined &&
      isolatedApplicant.employment === undefined

    if (!isIsolated) {
      failures.push(
        `Test 31 Failed: Pre-existing profile data leaked into isolated applicant: ${JSON.stringify(isolatedApplicant)}`
      )
    }
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
