import type { DocumentRecord } from '../document/types'
import type { ApplicantProfile } from '../applicant/types'
import { applyExtractionToApplicant } from '../extraction/data/extractionMapper'
import { resolveApplicantValue } from '../autofill/valueResolver'
import { parseDateString, formatToIsoDate } from '../autofill/dateNormalizer'
import { getAllSchemaFields } from './fieldSchema'
import { resolveApplicantReligion } from '../extraction/data/religionExtractor'
import type { ApplicationFieldValue, SavedApplication } from './types'

const HISTORICAL_FIELD_KEYS = new Set([
  'old_visa_flag',
  'prv_visit_add1',
  'prv_visit_add2',
  'prv_visit_add3',
  'old_visa_no',
  'old_visa_type_id',
  'oldvisaissueplace',
  'oldvisaissuedate',
  'country_visited',
  'saarc_flag',
  'previous_occupation',
  'prev_org',
  'previous_organization',
  'previous_designation',
  'previous_rank',
  'previous_posting',
])

export const PASSPORT_IDENTITY_KEYS = new Set([
  'appl.surname',
  'surname',
  'appl.applname',
  'applname',
  'appl.applsex',
  'applsex',
  'appl.birthdate',
  'birthdate',
  'appl.nationality',
  'nationality',
  'appl.country_of_birth',
  'country_of_birth',
  'appl.placbrth',
  'placbrth',
  'appl.nic_no',
  'nic_no',
  'appl.pptno',
  'pptno',
  'appl.passport_number',
  'appl.issuedate',
  'issuedate',
  'appl.passport_issue_date',
  'appl.expdate',
  'expdate',
  'appl.passport_expiry_date',
  'appl.issueplace',
  'issueplace',
  'appl.passport_issue_place',
  'appl.father_name',
  'father_name',
  'appl.mother_name',
  'mother_name',
  'appl.spouse_name',
  'spouse_name',
  'appl.pres_add1',
  'pres_add1',
  'pres_add2',
  'appl.pres_state',
  'pres_state',
  'appl.pres_pincode',
  'pres_pincode',
  'pincode',
  'appl.pres_phone',
  'pres_phone',
  'village_town_city',
  'district',
  'state_province',
  'present_country',
  'isd_code',
  'mobile',
  'appl.mobile',
  'appl.email',
  'appl.email_re',
  'email',
  'appl.perm_add1',
  'perm_add1',
  'perm_add2',
  'permanent_village_town_city',
  'permanent_district',
  'permanent_state_province',
  'permanent_country',
  'permanent_postal_code',
  'perm_add3',
  'marital_status',
  'appl.marital_status',
])

// Application merger helper constants and functions
export function populateApplicationFromDocuments(options: {
  applicantId: string
  passportDoc?: DocumentRecord | null
  ogdDoc?: DocumentRecord | null
  existingApp?: SavedApplication | null
  notes?: string
}): SavedApplication {
  const { applicantId, passportDoc, ogdDoc, existingApp, notes } = options

  const allFields = getAllSchemaFields()
  const fields: Record<string, ApplicationFieldValue> = {}

  // 1. Build temporary profiles from confirmed documents if available
  let passportProfile: ApplicantProfile | null = null
  if (passportDoc && passportDoc.extractedDataConfirmed && passportDoc.extractedData) {
    const base: ApplicantProfile = {
      applicantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes,
    }
    passportProfile = applyExtractionToApplicant(base, passportDoc.extractedData)
  }

  let ogdProfile: ApplicantProfile | null = null
  if (ogdDoc && ogdDoc.extractedDataConfirmed && ogdDoc.extractedData) {
    const base: ApplicantProfile = {
      applicantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes,
    }
    ogdProfile = applyExtractionToApplicant(base, ogdDoc.extractedData)
  }

  // 2. Cross-applicant identity checks:
  const currentPptNo = passportProfile?.passport?.passportNumber?.trim().toUpperCase()
  const currentSurname = passportProfile?.personalInfo?.surname?.trim().toUpperCase()
  const existingPptNo = (
    existingApp?.fields['appl.pptno']?.value ||
    existingApp?.fields['appl.passport_number']?.value ||
    existingApp?.fields['passport_number']?.value ||
    existingApp?.fields['pptno']?.value ||
    ''
  )
    .toString()
    .trim()
    .toUpperCase()
  const existingSurname = (
    existingApp?.fields['appl.surname']?.value ||
    existingApp?.fields['surname']?.value ||
    ''
  )
    .toString()
    .trim()
    .toUpperCase()

  const isMismatchedExistingApp = Boolean(
    (currentPptNo && existingPptNo && currentPptNo !== existingPptNo) ||
    (currentSurname && existingSurname && !currentSurname.includes(existingSurname) && !existingSurname.includes(currentSurname) && (!existingPptNo || existingPptNo !== currentPptNo))
  )

  const manualEdits: Record<string, boolean> = isMismatchedExistingApp ? {} : { ...(existingApp?.manualEdits || {}) }

  let ogdIsDifferentApplicant = false
  if (passportProfile && ogdProfile) {
    const oPpt = ogdProfile.passport?.passportNumber?.trim().toUpperCase()
    const oSurname = ogdProfile.personalInfo?.surname?.trim().toUpperCase()
    if (currentPptNo && oPpt && currentPptNo !== oPpt) {
      ogdIsDifferentApplicant = true
    } else if (currentSurname && oSurname && !currentSurname.includes(oSurname) && !oSurname.includes(currentSurname)) {
      ogdIsDifferentApplicant = true
    }
  }

  const activeProfile = passportProfile || ogdProfile
  const activeDocId = passportDoc?.documentId || ogdDoc?.documentId
  const activeSource = passportDoc ? 'passport' : 'ogd'

  for (const fieldDef of allFields) {
    const key = fieldDef.key
    const isPassportIdentityField = PASSPORT_IDENTITY_KEYS.has(key)

    // Priority 1: User Manual Edit preserved
    // Only preserve manual edits if:
    // (a) existingApp is from the same applicant/passport (!isMismatchedExistingApp), AND
    // (b) existingApp has a recorded manual edit with isUserEdited: true or source: 'manual', AND
    // (c) the recorded manual value is actually non-empty (stale empty placeholders from previous schema versions must not block document extraction)
    const existingField = existingApp?.fields[key]
    const hasManualEditFlag = Boolean(
      !isMismatchedExistingApp &&
      existingApp &&
      existingField &&
      existingApp.manualEdits[key] &&
      (existingField.isUserEdited === true || existingField.source === 'manual')
    )
    const manualVal = existingField?.value
    const hasNonEmptyManualVal =
      manualVal !== undefined &&
      manualVal !== null &&
      manualVal !== '' &&
      (typeof manualVal !== 'string' || manualVal.trim() !== '')

    const preserveManualEdit = hasManualEditFlag && hasNonEmptyManualVal

    if (preserveManualEdit && existingField) {
      fields[key] = {
        ...existingField,
        source: 'manual',
        isUserEdited: true,
      }
      manualEdits[key] = true
      continue
    }

    // Special handling for Religion: Strict documentary evidence, source priority, and conflict detection
    if (key === 'appl.religion' || key === 'religion') {
      const relResolution = resolveApplicantReligion({
        passportExtractedValue:
          passportProfile?.personalInfo?.religion ||
          passportDoc?.extractedData?.personal?.religion?.value,
        ogdExtractedValue:
          ogdProfile?.personalInfo?.religion ||
          ogdDoc?.extractedData?.personal?.religion?.value,
        existingManualValue: existingApp?.fields[key]?.value,
        isUserEdited:
          !isMismatchedExistingApp &&
          Boolean(existingApp?.manualEdits[key] && existingApp?.fields[key]?.isUserEdited),
      })

      if (relResolution.value) {
        fields[key] = {
          value: relResolution.value,
          source: relResolution.source,
          documentId:
            relResolution.source === 'passport'
              ? passportDoc?.documentId
              : relResolution.source === 'ogd'
              ? ogdDoc?.documentId
              : undefined,
          confidence: relResolution.confidence,
          isUserEdited: relResolution.source === 'manual',
          originalExtractedValue: relResolution.rawSourceValue || relResolution.value,
          hasConflict: relResolution.conflict,
          conflictDetails: relResolution.conflictDetails,
        }
        if (relResolution.source === 'manual') {
          manualEdits[key] = true
        }
      } else {
        fields[key] = {
          value: '',
          source: 'missing',
          isUserEdited: false,
          hasConflict: false,
        }
      }
      continue
    }

    let resolvedValue: string | undefined
    let source: 'passport' | 'ogd' | 'derived' | 'missing' = 'missing'
    let docId: string | undefined

    // Priority 2: Passport Document (Primary authoritative source for identity, passport, address)
    if (passportProfile && fieldDef.sourceApplicantPath) {
      const pVal = resolveApplicantValue(passportProfile, fieldDef.sourceApplicantPath)
      if (pVal !== undefined && pVal !== '') {
        resolvedValue = pVal
        const isPresentAddressField =
          fieldDef.sourceApplicantPath.startsWith('presentAddress.addressLine') ||
          fieldDef.sourceApplicantPath.startsWith('presentAddress.district') ||
          fieldDef.sourceApplicantPath.startsWith('presentAddress.villageTownCity') ||
          fieldDef.sourceApplicantPath.startsWith('presentAddress.stateProvince') ||
          fieldDef.sourceApplicantPath.startsWith('presentAddress.postalCode')
        const hasExplicitDocPresent = Boolean(
          passportDoc?.extractedData?.presentAddress?.addressLine1?.value ||
          passportDoc?.extractedData?.presentAddress?.district?.value ||
          passportDoc?.extractedData?.presentAddress?.postalCode?.value ||
          passportDoc?.extractedData?.presentAddress?.villageTownCity?.value
        )
        source = isPresentAddressField && !hasExplicitDocPresent ? 'derived' : 'passport'
        docId = passportDoc?.documentId
      }
    }

    // Priority 3: OGD Document (Historical / Old visa / Previous travel data / fallback identity if same applicant)
    if (ogdProfile && fieldDef.sourceApplicantPath) {
      const isHistorical = HISTORICAL_FIELD_KEYS.has(key)

      // Only let OGD populate if:
      // (a) It's a historical field, OR
      // (b) Passport document did not provide a value for this field AND OGD is not a different applicant
      if (isHistorical || (!resolvedValue && (!isPassportIdentityField || !ogdIsDifferentApplicant))) {
        const ogdVal = resolveApplicantValue(ogdProfile, fieldDef.sourceApplicantPath)
        if (ogdVal !== undefined && ogdVal !== '') {
          if (!resolvedValue || isHistorical) {
            resolvedValue = ogdVal
            source = 'ogd'
            docId = ogdDoc?.documentId
          }
        }
      }
    }

    function isBangladeshiValue(val?: string | null): boolean {
      if (!val) return false
      const s = val.trim().toUpperCase()
      return s === 'BANGLADESH' || s === 'BANGLADESHI' || s === 'BGD'
    }

    const isApplicantBangladeshi =
      isBangladeshiValue(activeProfile?.personalInfo?.nationality) ||
      isBangladeshiValue(activeProfile?.passport?.issuingCountry) ||
      isBangladeshiValue(activeProfile?.presentAddress?.country) ||
      isBangladeshiValue(activeProfile?.permanentAddress?.country) ||
      isBangladeshiValue(passportDoc?.extractedData?.personal?.nationality?.value) ||
      isBangladeshiValue(passportDoc?.extractedData?.passport?.issuingCountry?.value) ||
      isBangladeshiValue(ogdProfile?.personalInfo?.nationality)

    // Derivation pass for fields deterministically tied to confirmed documents
    if (!resolvedValue && activeProfile) {
      if (
        (key === 'appl.countryname' || key === 'present_country') &&
        isApplicantBangladeshi
      ) {
        resolvedValue = 'BANGLADESH'
        source = activeSource
        docId = activeDocId
      } else if (
        (key === 'appl.nationality' || key === 'nationality') &&
        (activeProfile.personalInfo?.nationality ||
          activeProfile.passport?.issuingCountry ||
          passportDoc?.extractedData?.personal?.nationality?.value ||
          passportDoc?.extractedData?.passport?.issuingCountry?.value)
      ) {
        resolvedValue =
          activeProfile.personalInfo?.nationality ||
          activeProfile.passport?.issuingCountry ||
          passportDoc?.extractedData?.personal?.nationality?.value ||
          passportDoc?.extractedData?.passport?.issuingCountry?.value ||
          'BANGLADESH'
        source = activeSource
        docId = activeDocId
      } else if (
        key === 'appl.country_of_birth' &&
        (isApplicantBangladeshi || activeProfile.personalInfo?.townCityOfBirth)
      ) {
        resolvedValue = 'BANGLADESH'
        source = activeSource
        docId = activeDocId
      } else if (
        (key === 'appl.nationality_by' || key === 'nationality_by') &&
        (isApplicantBangladeshi ||
          isBangladeshiValue(activeProfile.personalInfo?.countryOfBirth))
      ) {
        resolvedValue = 'Birth'
        source = activeSource
        docId = activeDocId
      } else if (
        (key === 'appl.visual_mark' || key === 'visual_mark') &&
        !resolvedValue
      ) {
        resolvedValue = activeProfile.personalInfo?.visibleIdentificationMarks || passportDoc?.extractedData?.personal?.visibleIdentificationMarks?.value || 'NA'
        source = activeSource
        docId = activeDocId
      } else if (
        (key === 'appl.email_re' || key === 'appl.email' || key === 'email') &&
        activeProfile.contact?.email
      ) {
        resolvedValue = activeProfile.contact.email
        source = activeSource
        docId = activeDocId
      } else if (key === 'appl.passport_number' || key === 'passport_number') {
        const pNo =
          activeProfile.passport?.passportNumber ||
          passportDoc?.extractedData?.passport?.passportNumber?.value
        if (pNo) {
          resolvedValue = pNo
          source = activeSource
          docId = activeDocId
        }
      } else if (key === 'pres_phone' || key === 'appl.pres_phone') {
        const rawPhone =
          activeProfile.presentAddress?.phone ||
          activeProfile.contact?.phone ||
          activeProfile.permanentAddress?.phone ||
          passportDoc?.extractedData?.presentAddress?.phone?.value ||
          passportDoc?.extractedData?.contact?.phone?.value

        if (rawPhone) {
          resolvedValue = rawPhone
          source = activeSource
          docId = activeDocId
        } else if (
          activeProfile.presentAddress?.mobile ||
          activeProfile.contact?.mobile ||
          passportDoc?.extractedData?.presentAddress?.mobile?.value ||
          passportDoc?.extractedData?.contact?.mobile?.value
        ) {
          const m =
            activeProfile.presentAddress?.mobile ||
            activeProfile.contact?.mobile ||
            passportDoc?.extractedData?.presentAddress?.mobile?.value ||
            passportDoc?.extractedData?.contact?.mobile?.value ||
            ''
          const isd =
            activeProfile.presentAddress?.isdCode ||
            activeProfile.contact?.isdCode ||
            passportDoc?.extractedData?.presentAddress?.isdCode?.value ||
            passportDoc?.extractedData?.contact?.isdCode?.value ||
            (activeProfile.personalInfo?.nationality === 'BANGLADESH' ||
            activeProfile.presentAddress?.country === 'BANGLADESH' ||
            activeProfile.passport?.issuingCountry === 'BANGLADESH'
              ? '880'
              : '')
          resolvedValue = isd ? (m.startsWith('+') ? m : `+${isd}${m.replace(/^0+/, '')}`) : m
          source = activeSource
          docId = activeDocId
        }
      } else if (key === 'isd_code') {
        const rawIsd =
          activeProfile.presentAddress?.isdCode ||
          activeProfile.contact?.isdCode ||
          passportDoc?.extractedData?.presentAddress?.isdCode?.value ||
          passportDoc?.extractedData?.contact?.isdCode?.value
        if (rawIsd) {
          resolvedValue = rawIsd
          source = activeSource
          docId = activeDocId
        } else {
          const rawPhone =
            activeProfile.presentAddress?.phone ||
            activeProfile.contact?.phone ||
            activeProfile.permanentAddress?.phone ||
            passportDoc?.extractedData?.presentAddress?.phone?.value ||
            passportDoc?.extractedData?.contact?.phone?.value
          if (rawPhone) {
            const cleanDigits = rawPhone.replace(/[^\d]/g, '')
            if (rawPhone.startsWith('+880') || cleanDigits.startsWith('880')) {
              resolvedValue = '880'
              source = activeSource
              docId = activeDocId
            } else if (rawPhone.startsWith('+')) {
              const intlMatch = rawPhone.match(/^\+(\d{1,4})/)
              if (intlMatch) {
                resolvedValue = intlMatch[1]
                source = activeSource
                docId = activeDocId
              }
            } else if (cleanDigits.startsWith('01') && cleanDigits.length >= 10) {
              resolvedValue = '880'
              source = activeSource
              docId = activeDocId
            }
          }
          if (
            !resolvedValue &&
            (activeProfile.personalInfo?.nationality === 'BANGLADESH' ||
              activeProfile.presentAddress?.country === 'BANGLADESH' ||
              activeProfile.passport?.issuingCountry === 'BANGLADESH')
          ) {
            resolvedValue = '880'
            source = activeSource
            docId = activeDocId
          }
        }
      } else if (key === 'mobile' || key === 'appl.mobile') {
        const rawMob =
          activeProfile.presentAddress?.mobile ||
          activeProfile.contact?.mobile ||
          passportDoc?.extractedData?.presentAddress?.mobile?.value ||
          passportDoc?.extractedData?.contact?.mobile?.value

        if (rawMob) {
          resolvedValue = rawMob
          source = activeSource
          docId = activeDocId
        } else {
          const rawPhone =
            activeProfile.presentAddress?.phone ||
            activeProfile.contact?.phone ||
            activeProfile.permanentAddress?.phone ||
            passportDoc?.extractedData?.presentAddress?.phone?.value ||
            passportDoc?.extractedData?.contact?.phone?.value
          if (rawPhone) {
            const cleanDigits = rawPhone.replace(/[^\d]/g, '')
            if (rawPhone.startsWith('+880') || cleanDigits.startsWith('880')) {
              resolvedValue = cleanDigits.slice(3)
              source = activeSource
              docId = activeDocId
            } else if (rawPhone.startsWith('+')) {
              const intlMatch = rawPhone.match(/^\+(\d{1,4})(\d{6,14})$/)
              if (intlMatch) {
                resolvedValue = intlMatch[2]
                source = activeSource
                docId = activeDocId
              } else {
                resolvedValue = cleanDigits
                source = activeSource
                docId = activeDocId
              }
            } else if (cleanDigits.startsWith('01') && cleanDigits.length >= 10) {
              resolvedValue = cleanDigits.slice(1)
              source = activeSource
              docId = activeDocId
            } else {
              resolvedValue = cleanDigits
              source = activeSource
              docId = activeDocId
            }
          }
        }
      } else if (key === 'appl.journeydate' && activeProfile.travel?.intendedArrivalDate) {
        resolvedValue = activeProfile.travel.intendedArrivalDate
        source = activeSource
        docId = activeDocId
      } else if (key === 'appl.oth_ppt' && activeProfile.passport?.holdsOtherPassport !== true) {
        resolvedValue = 'No'
        source = activeSource
        docId = activeDocId
      } else if (
        (key === 'father_nationality' || key === 'appl.father_nationality') &&
        activeProfile.family?.father?.name &&
        isApplicantBangladeshi
      ) {
        resolvedValue = 'BANGLADESH'
        source = 'derived'
        docId = activeDocId
      } else if (
        (key === 'father_place_of_birth' || key === 'appl.father_place_of_birth') &&
        activeProfile.family?.father?.placeOfBirth
      ) {
        resolvedValue = activeProfile.family.father.placeOfBirth
        source = activeSource
        docId = activeDocId
      } else if (
        (key === 'father_country_of_birth' || key === 'appl.father_country_of_birth') &&
        activeProfile.family?.father?.name &&
        isApplicantBangladeshi
      ) {
        resolvedValue = 'BANGLADESH'
        source = 'derived'
        docId = activeDocId
      } else if (
        (key === 'father_prev_nationality' || key === 'appl.father_prev_nationality') &&
        activeProfile.family?.father?.name &&
        isApplicantBangladeshi
      ) {
        resolvedValue = 'BANGLADESH'
        source = 'derived'
        docId = activeDocId
      } else if (
        (key === 'mother_nationality' || key === 'appl.mother_nationality') &&
        activeProfile.family?.mother?.name &&
        isApplicantBangladeshi
      ) {
        resolvedValue = 'BANGLADESH'
        source = 'derived'
        docId = activeDocId
      } else if (
        (key === 'mother_place_of_birth' || key === 'appl.mother_place_of_birth') &&
        activeProfile.family?.mother?.placeOfBirth
      ) {
        resolvedValue = activeProfile.family.mother.placeOfBirth
        source = activeSource
        docId = activeDocId
      } else if (
        (key === 'mother_country_of_birth' || key === 'appl.mother_country_of_birth') &&
        activeProfile.family?.mother?.name &&
        isApplicantBangladeshi
      ) {
        resolvedValue = 'BANGLADESH'
        source = 'derived'
        docId = activeDocId
      } else if (
        (key === 'mother_prev_nationality' || key === 'appl.mother_prev_nationality') &&
        activeProfile.family?.mother?.name &&
        isApplicantBangladeshi
      ) {
        resolvedValue = 'BANGLADESH'
        source = 'derived'
        docId = activeDocId
      } else if (
        (key === 'spouse_nationality' || key === 'appl.spouse_nationality') &&
        activeProfile.family?.spouse?.name &&
        isApplicantBangladeshi
      ) {
        resolvedValue = 'BANGLADESH'
        source = 'derived'
        docId = activeDocId
      } else if (
        (key === 'spouse_place_of_birth' || key === 'appl.spouse_place_of_birth') &&
        activeProfile.family?.spouse?.placeOfBirth
      ) {
        resolvedValue = activeProfile.family.spouse.placeOfBirth
        source = activeSource
        docId = activeDocId
      } else if (
        (key === 'spouse_country_of_birth' || key === 'appl.spouse_country_of_birth') &&
        activeProfile.family?.spouse?.name &&
        isApplicantBangladeshi
      ) {
        resolvedValue = 'BANGLADESH'
        source = 'derived'
        docId = activeDocId
      } else if (
        (key === 'spouse_prev_nationality' || key === 'appl.spouse_prev_nationality') &&
        activeProfile.family?.spouse?.name &&
        isApplicantBangladeshi
      ) {
        resolvedValue = 'BANGLADESH'
        source = 'derived'
        docId = activeDocId
      } else if (
        (key === 'marital_status' || key === 'appl.marital_status') &&
        activeProfile.family?.spouse?.name
      ) {
        resolvedValue = 'Married'
        source = 'derived'
        docId = activeDocId
      } else if (
        (key === 'appl.oth_ppt_issue_place' || key === 'oth_ppt_issue_place') &&
        activeProfile.passport?.holdsOtherPassport === true &&
        activeProfile.passport?.otherPassportDetails?.placeOfIssue
      ) {
        resolvedValue = activeProfile.passport.otherPassportDetails.placeOfIssue
        source = activeSource
        docId = activeDocId
      } else if (
        (key === 'appl.prev_passport_country_issue' || key === 'prev_passport_country_issue') &&
        activeProfile.passport?.holdsOtherPassport === true &&
        activeProfile.passport?.otherPassportDetails?.countryOfIssue
      ) {
        resolvedValue = activeProfile.passport.otherPassportDetails.countryOfIssue
        source = activeSource
        docId = activeDocId
      } else if (
        (key === 'appl.other_ppt_nationality' || key === 'other_ppt_nationality') &&
        activeProfile.passport?.holdsOtherPassport === true &&
        activeProfile.passport?.otherPassportDetails?.nationalityInPassport
      ) {
        resolvedValue = activeProfile.passport.otherPassportDetails.nationalityInPassport
        source = activeSource
        docId = activeDocId
      } else if (
        (key === 'grandparent_flag' || key === 'appl.grandparent_flag') &&
        (activeProfile.family?.hasPakistanRelation === false || ogdProfile?.family?.hasPakistanRelation === false)
      ) {
        resolvedValue = 'No'
        source = ogdProfile?.family?.hasPakistanRelation === false ? 'ogd' : activeSource
        docId = ogdProfile?.family?.hasPakistanRelation === false ? ogdDoc?.documentId : activeDocId
      } else if (
        (key === 'prev_org' || key === 'appl.prev_org') &&
        (activeProfile.employment?.hasMilitaryService === false || ogdProfile?.employment?.hasMilitaryService === false)
      ) {
        resolvedValue = 'No'
        source = ogdProfile?.employment?.hasMilitaryService === false ? 'ogd' : activeSource
        docId = ogdProfile?.employment?.hasMilitaryService === false ? ogdDoc?.documentId : activeDocId
      } else if (
        (key === 'old_visa_flag' || key === 'appl.old_visa_flag') &&
        (activeProfile.previousVisa?.hasPreviousVisa === false || ogdProfile?.previousVisa?.hasPreviousVisa === false)
      ) {
        resolvedValue = 'No'
        source = ogdProfile?.previousVisa?.hasPreviousVisa === false ? 'ogd' : activeSource
        docId = ogdProfile?.previousVisa?.hasPreviousVisa === false ? ogdDoc?.documentId : activeDocId
      } else if (
        (key === 'pres_addr1' || key === 'appl.pres_add1') &&
        !resolvedValue &&
        (activeProfile.presentAddress?.addressLine1 || activeProfile.permanentAddress?.addressLine1)
      ) {
        resolvedValue = activeProfile.presentAddress?.addressLine1 || activeProfile.permanentAddress?.addressLine1
        source = activeProfile.presentAddress?.addressLine1 ? activeSource : 'derived'
        docId = activeDocId
      } else if (
        (key === 'pres_addr2' || key === 'appl.pres_add2') &&
        !resolvedValue &&
        (activeProfile.presentAddress?.addressLine2 || activeProfile.permanentAddress?.addressLine2)
      ) {
        resolvedValue = activeProfile.presentAddress?.addressLine2 || activeProfile.permanentAddress?.addressLine2
        source = activeProfile.presentAddress?.addressLine2 ? activeSource : 'derived'
        docId = activeDocId
      } else if (
        (key === 'village_town_city' || key === 'appl.pres_city') &&
        !resolvedValue &&
        (activeProfile.presentAddress?.villageTownCity || activeProfile.permanentAddress?.villageTownCity)
      ) {
        resolvedValue = activeProfile.presentAddress?.villageTownCity || activeProfile.permanentAddress?.villageTownCity
        source = activeProfile.presentAddress?.villageTownCity ? activeSource : 'derived'
        docId = activeDocId
      } else if (
        (key === 'district' || key === 'appl.pres_district') &&
        !resolvedValue &&
        (activeProfile.presentAddress?.district || activeProfile.permanentAddress?.district)
      ) {
        resolvedValue = activeProfile.presentAddress?.district || activeProfile.permanentAddress?.district
        source = activeProfile.presentAddress?.district ? activeSource : 'derived'
        docId = activeDocId
      } else if (
        (key === 'state_province' || key === 'appl.pres_state' || key === 'pres_state' || key === 'state_name') &&
        !resolvedValue &&
        (activeProfile.presentAddress?.stateProvince || activeProfile.permanentAddress?.stateProvince)
      ) {
        resolvedValue = activeProfile.presentAddress?.stateProvince || activeProfile.permanentAddress?.stateProvince
        source = activeProfile.presentAddress?.stateProvince ? activeSource : 'derived'
        docId = activeDocId
      } else if (
        (key === 'present_country' || key === 'appl.countryname') &&
        !resolvedValue &&
        (activeProfile.presentAddress?.country || activeProfile.permanentAddress?.country)
      ) {
        resolvedValue = activeProfile.presentAddress?.country || activeProfile.permanentAddress?.country
        source = activeProfile.presentAddress?.country ? activeSource : 'derived'
        docId = activeDocId
      } else if (
        (key === 'pincode' || key === 'appl.pres_pincode' || key === 'pres_pincode') &&
        !resolvedValue &&
        (activeProfile.presentAddress?.postalCode || activeProfile.permanentAddress?.postalCode)
      ) {
        resolvedValue = activeProfile.presentAddress?.postalCode || activeProfile.permanentAddress?.postalCode
        source = activeProfile.presentAddress?.postalCode ? activeSource : 'derived'
        docId = activeDocId
      } else if (
        (key === 'perm_add1' || key === 'appl.perm_add1') &&
        !resolvedValue &&
        (activeProfile.permanentAddress?.addressLine1 || activeProfile.presentAddress?.addressLine1)
      ) {
        resolvedValue = activeProfile.permanentAddress?.addressLine1 || activeProfile.presentAddress?.addressLine1
        source = activeProfile.permanentAddress?.addressLine1 ? activeSource : 'derived'
        docId = activeDocId
      } else if (
        (key === 'perm_add2' || key === 'appl.perm_add2') &&
        !resolvedValue &&
        (activeProfile.permanentAddress?.addressLine2 || activeProfile.presentAddress?.addressLine2)
      ) {
        resolvedValue = activeProfile.permanentAddress?.addressLine2 || activeProfile.presentAddress?.addressLine2
        source = activeProfile.permanentAddress?.addressLine2 ? activeSource : 'derived'
        docId = activeDocId
      } else if (
        (key === 'permanent_village_town_city' || key === 'appl.perm_city') &&
        !resolvedValue &&
        (activeProfile.permanentAddress?.villageTownCity || activeProfile.presentAddress?.villageTownCity)
      ) {
        resolvedValue = activeProfile.permanentAddress?.villageTownCity || activeProfile.presentAddress?.villageTownCity
        source = activeProfile.permanentAddress?.villageTownCity ? activeSource : 'derived'
        docId = activeDocId
      } else if (
        (key === 'permanent_district' || key === 'appl.perm_district') &&
        !resolvedValue &&
        (activeProfile.permanentAddress?.district || activeProfile.presentAddress?.district)
      ) {
        resolvedValue = activeProfile.permanentAddress?.district || activeProfile.presentAddress?.district
        source = activeProfile.permanentAddress?.district ? activeSource : 'derived'
        docId = activeDocId
      } else if (
        (key === 'permanent_state_province' || key === 'perm_add3' || key === 'appl.perm_state') &&
        !resolvedValue &&
        (activeProfile.permanentAddress?.stateProvince || activeProfile.presentAddress?.stateProvince)
      ) {
        resolvedValue = activeProfile.permanentAddress?.stateProvince || activeProfile.presentAddress?.stateProvince
        source = activeProfile.permanentAddress?.stateProvince ? activeSource : 'derived'
        docId = activeDocId
      } else if (
        (key === 'permanent_country' || key === 'appl.perm_country') &&
        !resolvedValue &&
        (activeProfile.permanentAddress?.country || activeProfile.presentAddress?.country)
      ) {
        resolvedValue = activeProfile.permanentAddress?.country || activeProfile.presentAddress?.country
        source = activeProfile.permanentAddress?.country ? activeSource : 'derived'
        docId = activeDocId
      } else if (
        (key === 'permanent_postal_code' || key === 'appl.perm_pincode' || key === 'perm_pincode') &&
        !resolvedValue &&
        (activeProfile.permanentAddress?.postalCode || activeProfile.presentAddress?.postalCode)
      ) {
        resolvedValue = activeProfile.permanentAddress?.postalCode || activeProfile.presentAddress?.postalCode
        source = activeProfile.permanentAddress?.postalCode ? activeSource : 'derived'
        docId = activeDocId
      }
    }

    if (resolvedValue !== undefined && resolvedValue !== '') {
      let finalVal: string | boolean = resolvedValue

      // Radio normalization
      if (fieldDef.inputType === 'radio') {
        const s = String(finalVal).trim().toLowerCase()
        if (s === 'false' || s === '0' || s === 'no') {
          finalVal = 'No'
        } else if (s === 'true' || s === '1' || s === 'yes') {
          finalVal = 'Yes'
        }
      }

      // Checkbox normalization
      if (fieldDef.inputType === 'checkbox') {
        const s = String(finalVal).trim().toLowerCase()
        if (s === 'false' || s === '0' || s === 'no') {
          finalVal = false
        } else if (s === 'true' || s === '1' || s === 'yes') {
          finalVal = true
        }
      }

      // Date normalization to DD/MM/YYYY
      if (
        typeof finalVal === 'string' &&
        (fieldDef.inputType === 'date' || fieldDef.placeholder === 'DD/MM/YYYY' || key.includes('date'))
      ) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(finalVal)) {
          const [y, m, d] = finalVal.split('-')
          finalVal = `${d}/${m}/${y}`
        } else {
          const parsed = parseDateString(finalVal)
          if (parsed) {
            const iso = formatToIsoDate(parsed)
            const [y, m, d] = iso.split('-')
            finalVal = `${d}/${m}/${y}`
          }
        }
      }

      // Special field value normalizations
      if (typeof finalVal === 'string') {
        if (key === 'appl.applsex' || key === 'gender') {
          const g = finalVal.toUpperCase().trim()
          if (g === 'M' || g === 'MALE') finalVal = 'MALE'
          else if (g === 'F' || g === 'FEMALE') finalVal = 'FEMALE'
          else if (g === 'T' || g === 'TRANSGENDER') finalVal = 'TRANSGENDER'
        } else if (key === 'marital_status') {
          if (finalVal === '0' || finalVal.toUpperCase() === 'MARRIED') finalVal = 'Married'
          else if (finalVal === '1' || finalVal.toUpperCase() === 'SINGLE' || finalVal.toUpperCase() === 'UNMARRIED') finalVal = 'Single'
        } else if (key === 'duration') {
          finalVal = finalVal.replace(/months?/i, '').trim()
        } else if (key === 'visa_entry_id') {
          if (/multiple/i.test(finalVal)) finalVal = 'Multiple'
          else if (/double/i.test(finalVal)) finalVal = 'Double'
          else if (/triple/i.test(finalVal)) finalVal = 'Triple'
          else if (/single/i.test(finalVal)) finalVal = 'Single'
        } else if (key === 'occupation') {
          if (/farmer|agriculture/i.test(finalVal)) finalVal = 'FARMER'
        } else if (key === 'entrypoint' || key === 'exitpoint') {
          if (/phulbari|fulbari/i.test(finalVal)) finalVal = 'BY ROAD PHULBARI'
        }
      }

      // Select option value normalization
      if (fieldDef.options && typeof finalVal === 'string') {
        const match = fieldDef.options.find(
          (opt) => opt.value.toUpperCase() === (finalVal as string).toUpperCase() || opt.label.toUpperCase() === (finalVal as string).toUpperCase()
        )
        if (match) {
          finalVal = match.value
        }
      }

      fields[key] = {
        value: finalVal,
        source,
        documentId: docId,
        isUserEdited: false,
        originalExtractedValue: finalVal,
      }
    } else {
      // Missing field: explicitly blank (no fallback to fake or arbitrary profile data)
      fields[key] = {
        value: fieldDef.inputType === 'checkbox' ? false : '',
        source: 'missing',
        isUserEdited: false,
      }
    }
  }

  // Handle Question groups in additionalQuestions
  for (let q = 1; q <= 6; q++) {
    const flagKey = `question_${q}_flag`
    const ansKey = `answer_${q}`

    if (!isMismatchedExistingApp && existingApp?.manualEdits[flagKey] && existingApp.fields[flagKey]) {
      fields[flagKey] = existingApp.fields[flagKey]
    } else {
      const isRefusalQ = q === 2 && (ogdProfile?.previousVisa?.hasRefusal === false || activeProfile?.previousVisa?.hasRefusal === false)
      if (isRefusalQ) {
        fields[flagKey] = {
          value: 'No',
          source: 'ogd',
          documentId: ogdDoc?.documentId,
          isUserEdited: false,
        }
      } else if (!fields[flagKey]) {
        fields[flagKey] = {
          value: 'No',
          source: 'missing',
          isUserEdited: false,
        }
      }
    }

    if (!isMismatchedExistingApp && existingApp?.manualEdits[ansKey] && existingApp.fields[ansKey]) {
      fields[ansKey] = existingApp.fields[ansKey]
    } else if (!fields[ansKey]) {
      fields[ansKey] = { value: '', source: 'missing', isUserEdited: false }
    }
  }

  const now = new Date().toISOString()
  const religionField = fields['appl.religion']
  const religionMetadata = {
    religion: (religionField?.value ? String(religionField.value) : null) as string | null,
    religionSource: (religionField?.source && religionField.source !== 'missing' ? religionField.source : null) as 'passport' | 'official_document' | 'ogd' | 'manual' | null,
    religionConfidence: (religionField?.confidence || 'none') as 'high' | 'medium' | 'low' | 'none',
    religionConflict: Boolean(religionField?.hasConflict),
    conflictDetails: religionField?.conflictDetails,
  }

  console.group('⚙️ [VISA AUTOFILL] APPLICATION MERGER POPULATED FIELDS')
  console.log('Applicant ID:', applicantId)
  console.log('Passport Document ID:', passportDoc?.documentId)
  console.log('OGD Document ID:', ogdDoc?.documentId)
  console.log('Contact Phone:', fields['pres_phone']?.value, 'Source:', fields['pres_phone']?.source)
  console.log('Contact ISD:', fields['isd_code']?.value, 'Source:', fields['isd_code']?.source)
  console.log('Contact Mobile:', fields['mobile']?.value, 'Source:', fields['mobile']?.source)
  console.log('All Populated Fields Object:', fields)
  console.groupEnd()

  return {
    applicationId: existingApp?.applicationId || `app_${applicantId}_${Date.now()}`,
    applicantId,
    createdAt: existingApp?.createdAt || now,
    updatedAt: now,
    status: existingApp?.status || (passportDoc?.extractedDataConfirmed ? 'ready_for_autofill' : 'draft'),
    fields,
    provenance: {
      passportDocumentId: passportDoc?.documentId,
      ogdDocumentId: ogdDoc?.documentId,
      lastSavedAt: existingApp?.provenance?.lastSavedAt || now,
    },
    sourceDocuments: {
      passport: passportDoc || undefined,
      ogd: ogdDoc || undefined,
    },
    manualEdits,
    religionMetadata,
    photograph: existingApp?.photograph,
  }
}

/**
 * Converts a SavedApplication back to an ApplicantProfile for the autofill engine.
 * Ensures that all edited or confirmed values in SavedApplication directly feed
 * into the standard verified field mappings.
 */
export function convertSavedApplicationToApplicantProfile(
  savedApp: SavedApplication,
  baseProfile?: ApplicantProfile
): ApplicantProfile {
  const getFieldStr = (key: string): string | undefined => {
    const f = savedApp.fields[key]
    if (!f || f.value === '' || f.value === undefined || f.value === null) return undefined
    return String(f.value).trim()
  }

  const getFieldDate = (key: string): string | undefined => {
    const raw = getFieldStr(key)
    if (!raw) return undefined
    const parsed = parseDateString(raw)
    return parsed ? formatToIsoDate(parsed) : raw
  }

  const getFieldBool = (key: string): boolean | undefined => {
    const f = savedApp.fields[key]
    if (!f || f.value === '' || f.value === undefined || f.value === null) return undefined
    if (typeof f.value === 'boolean') return f.value
    const s = String(f.value).toLowerCase()
    return s === 'yes' || s === 'true' || s === '1'
  }

  const profile: ApplicantProfile = {
    applicantId: savedApp.applicantId,
    createdAt: savedApp.createdAt,
    updatedAt: savedApp.updatedAt,
    notes: baseProfile?.notes,

    registration: {
      applyingFromCountry: getFieldStr('appl.countryname') || getFieldStr('present_country'),
      indianMission: getFieldStr('appl.missioncode') || getFieldStr('missioncode'),
      nationality: getFieldStr('appl.nationality') || getFieldStr('nationality'),
    },

    personalInfo: {
      surname: getFieldStr('appl.surname'),
      givenNames: getFieldStr('appl.applname'),
      hasChangedName: getFieldBool('appl.changedSurnameCheck'),
      gender: (() => {
        const g = getFieldStr('appl.applsex')?.toLowerCase()
        if (g === 'male' || g === 'm') return 'male'
        if (g === 'female' || g === 'f') return 'female'
        if (g === 'other' || g === 'transgender') return 'other'
        return undefined
      })(),
      dateOfBirth: getFieldDate('appl.birthdate') || getFieldStr('appl.birthdate') || getFieldDate('birthdate') || getFieldStr('birthdate'),
      townCityOfBirth: getFieldStr('appl.placbrth'),
      countryOfBirth: getFieldStr('appl.country_of_birth'),
      nationalIdNumber: getFieldStr('appl.nic_no'),
      religion: getFieldStr('appl.religion'),
      visibleIdentificationMarks: getFieldStr('appl.visual_mark'),
      educationalQualification: getFieldStr('appl.edu_id'),
      nationality: getFieldStr('appl.nationality') || getFieldStr('nationality'),
      nationalityAcquiredBy: (() => {
        const n = getFieldStr('appl.nationality_by')?.toLowerCase()
        if (n?.includes('birth')) return 'birth'
        if (n?.includes('nat')) return 'naturalization'
        return undefined
      })(),
      maritalStatus: getFieldStr('marital_status'),
    },

    passport: {
      passportNumber: getFieldStr('appl.passport_number'),
      placeOfIssue: getFieldStr('appl.passport_issue_place'),
      issueDate: getFieldDate('appl.passport_issue_date'),
      expiryDate: getFieldDate('appl.passport_expiry_date'),
      issuingCountry: getFieldStr('appl.countryname'),
      holdsOtherPassport: getFieldBool('appl.oth_ppt'),
      otherPassportDetails: {
        passportNumber: getFieldStr('appl.oth_pptno'),
        placeOfIssue: getFieldStr('appl.oth_ppt_issue_place'),
        countryOfIssue: getFieldStr('appl.prev_passport_country_issue'),
        nationalityInPassport: getFieldStr('appl.other_ppt_nationality'),
      },
    },

    presentAddress: {
      addressLine1: getFieldStr('pres_addr1'),
      addressLine2: getFieldStr('pres_addr2'),
      villageTownCity: getFieldStr('village_town_city'),
      district: getFieldStr('district'),
      stateProvince: getFieldStr('state_province'),
      postalCode: getFieldStr('pincode'),
      country: getFieldStr('present_country') || getFieldStr('appl.countryname'),
      phone: getFieldStr('pres_phone'),
      isdCode: getFieldStr('isd_code'),
      mobile: getFieldStr('mobile'),
    },

    permanentAddress: {
      addressLine1: getFieldStr('perm_add1'),
      addressLine2: getFieldStr('perm_add2'),
      villageTownCity: getFieldStr('permanent_village_town_city'),
      district: getFieldStr('permanent_district'),
      stateProvince: getFieldStr('permanent_state_province'),
      country: getFieldStr('permanent_country'),
      postalCode: getFieldStr('permanent_postal_code'),
    },

    contact: {
      email: getFieldStr('appl.email') || getFieldStr('email'),
      phone: getFieldStr('pres_phone'),
      isdCode: getFieldStr('isd_code'),
      mobile: getFieldStr('mobile'),
    },

    family: {
      father: {
        name: getFieldStr('fthrname'),
        placeOfBirth: getFieldStr('father_place_of_birth'),
        countryOfBirth: getFieldStr('father_country_of_birth'),
        nationality: getFieldStr('father_nationality'),
        previousNationality: getFieldStr('father_prev_nationality'),
      },
      mother: {
        name: getFieldStr('mother_name'),
        placeOfBirth: getFieldStr('mother_place_of_birth'),
        countryOfBirth: getFieldStr('mother_country_of_birth'),
        nationality: getFieldStr('mother_nationality'),
        previousNationality: getFieldStr('mother_prev_nationality'),
      },
      spouse: {
        name: getFieldStr('spouse_name'),
        placeOfBirth: getFieldStr('spouse_place_of_birth'),
        countryOfBirth: getFieldStr('spouse_country_of_birth'),
        nationality: getFieldStr('spouse_nationality'),
        previousNationality: getFieldStr('spouse_prev_nationality'),
      },
      hasPakistanRelation: getFieldBool('grandparent_flag'),
      pakistanRelationDetails: getFieldStr('grandparent_details'),
    },

    employment: {
      presentOccupation: getFieldStr('occupation'),
      employerName: getFieldStr('empname'),
      designationRank: getFieldStr('empdesignation'),
      employerAddress: getFieldStr('empaddress'),
      employerPhone: getFieldStr('empphone'),
      pastOccupation: getFieldStr('previous_occupation'),
      hasMilitaryService: getFieldBool('prev_org'),
      militaryOrganization: getFieldStr('previous_organization'),
      militaryDesignation: getFieldStr('previous_designation'),
      militaryRank: getFieldStr('previous_rank'),
      militaryPlaceOfPosting: getFieldStr('previous_posting'),
    },

    travel: {
      duration: getFieldStr('duration'),
      visaEntryType: getFieldStr('visa_entry_id'),
      intendedArrivalDate: getFieldDate('journeydate') || getFieldDate('appl.journeydate') || getFieldStr('journeydate') || getFieldStr('appl.journeydate'),
      entryPoint: getFieldStr('entrypoint'),
      exitPoint: getFieldStr('exitpoint'),
      countriesVisited: getFieldStr('country_visited'),
      visitedSaarc: getFieldBool('saarc_flag'),
    },

    previousVisa: {
      hasPreviousVisa: getFieldBool('old_visa_flag'),
      visitedAddress1: getFieldStr('prv_visit_add1'),
      visitedAddress2: getFieldStr('prv_visit_add2'),
      visitedAddress3: getFieldStr('prv_visit_add3'),
      visaNumber: getFieldStr('old_visa_no'),
      visaType: getFieldStr('old_visa_type_id'),
      placeOfIssue: getFieldStr('oldvisaissueplace'),
      dateOfIssue: getFieldDate('oldvisaissuedate'),
    },

    reference: {
      name: getFieldStr('nameofsponsor_ind'),
      addressLine1: getFieldStr('add1ofsponsor_ind'),
      addressLine2: getFieldStr('add2ofsponsor_ind'),
      phone: getFieldStr('phoneofsponsor_ind'),
    },

    sponsorMission: {
      name: getFieldStr('nameofsponsor_msn'),
      addressLine1: getFieldStr('add1ofsponsor_msn'),
      addressLine2: getFieldStr('add2ofsponsor_msn'),
      phone: getFieldStr('phoneofsponsor_msn'),
    },

    additionalQuestions: {
      question1: {
        flag: getFieldStr('question_1_flag') || 'No',
        details: getFieldStr('answer_1'),
      },
      question2: {
        flag: getFieldStr('question_2_flag') || 'No',
        details: getFieldStr('answer_2'),
      },
      question3: {
        flag: getFieldStr('question_3_flag') || 'No',
        details: getFieldStr('answer_3'),
      },
      question4: {
        flag: getFieldStr('question_4_flag') || 'No',
        details: getFieldStr('answer_4'),
      },
      question5: {
        flag: getFieldStr('question_5_flag') || 'No',
        details: getFieldStr('answer_5'),
      },
      question6: {
        flag: getFieldStr('question_6_flag') || 'No',
        details: getFieldStr('answer_6'),
      },
    },
  }

  // Also preserve special derived mission if notes or fields specify
  const mission = getFieldStr('appl.missioncode')
  if (mission) {
    profile.notes = `${profile.notes ? profile.notes + '\n' : ''}Indian Mission: ${mission}`
  }

  return profile
}

