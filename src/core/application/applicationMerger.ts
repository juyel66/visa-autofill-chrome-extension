import type { DocumentRecord } from '../document/types'
import type { ApplicantProfile } from '../applicant/types'
import { applyExtractionToApplicant } from '../extraction/data/extractionMapper'
import { resolveApplicantValue } from '../autofill/valueResolver'
import { getAllSchemaFields } from './fieldSchema'
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

const PASSPORT_IDENTITY_KEYS = new Set([
  'appl.surname',
  'appl.applname',
  'appl.applsex',
  'appl.birthdate',
  'appl.nationality',
  'appl.placbrth',
  'appl.country_of_birth',
  'appl.passport_number',
  'appl.passport_issue_place',
  'appl.passport_issue_date',
  'appl.passport_expiry_date',
])

/**
 * Builds or updates a SavedApplication from confirmed documents (Passport and optional OGD)
 * preserving user manual edits as the highest precedence.
 */
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
  const manualEdits: Record<string, boolean> = { ...(existingApp?.manualEdits || {}) }

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

  for (const fieldDef of allFields) {
    const key = fieldDef.key

    // Priority 1: User Manual Edit preserved
    if (existingApp && existingApp.fields[key] && existingApp.manualEdits[key]) {
      fields[key] = {
        ...existingApp.fields[key],
        source: 'manual',
        isUserEdited: true,
      }
      manualEdits[key] = true
      continue
    }

    let resolvedValue: string | undefined
    let source: 'passport' | 'ogd' | 'missing' = 'missing'
    let docId: string | undefined

    // Priority 2: Passport Document (Primary source for identity, passport, address)
    if (passportProfile && fieldDef.sourceApplicantPath) {
      const pVal = resolveApplicantValue(passportProfile, fieldDef.sourceApplicantPath)
      if (pVal !== undefined && pVal !== '') {
        resolvedValue = pVal
        source = 'passport'
        docId = passportDoc?.documentId
      }
    }

    // Priority 3: OGD Document (Historical / Old visa / Previous travel data)
    if (ogdProfile && fieldDef.sourceApplicantPath) {
      const isHistorical = HISTORICAL_FIELD_KEYS.has(key)
      const isIdentity = PASSPORT_IDENTITY_KEYS.has(key)

      // Only let OGD populate if:
      // (a) It's a historical field, OR
      // (b) It's not a strict current passport identity field and passport didn't have it
      if (isHistorical || (!isIdentity && !resolvedValue)) {
        const ogdVal = resolveApplicantValue(ogdProfile, fieldDef.sourceApplicantPath)
        if (ogdVal !== undefined && ogdVal !== '') {
          // If passport already had a value for a non-historical field, do NOT let OGD overwrite it
          if (!resolvedValue || isHistorical) {
            resolvedValue = ogdVal
            source = 'ogd'
            docId = ogdDoc?.documentId
          }
        }
      }
    }

    // Derivation pass for fields deterministically tied to confirmed passport identity
    if (!resolvedValue) {
      if (key === 'appl.countryname' && (passportProfile?.personalInfo?.nationality === 'BANGLADESH' || passportProfile?.passport?.issuingCountry === 'BANGLADESH')) {
        resolvedValue = 'BANGLADESH'
        source = 'passport'
        docId = passportDoc?.documentId
      } else if (key === 'appl.country_of_birth' && (passportProfile?.personalInfo?.nationality === 'BANGLADESH' || passportProfile?.personalInfo?.townCityOfBirth)) {
        resolvedValue = 'BANGLADESH'
        source = 'passport'
        docId = passportDoc?.documentId
      } else if (key === 'appl.nationality_by' && passportProfile?.personalInfo?.nationality === 'BANGLADESH') {
        resolvedValue = 'Birth'
        source = 'passport'
        docId = passportDoc?.documentId
      } else if (key === 'appl.oth_ppt' && passportProfile && !passportProfile.passport?.holdsOtherPassport) {
        resolvedValue = 'No'
        source = 'passport'
        docId = passportDoc?.documentId
      }
    }

    if (resolvedValue !== undefined && resolvedValue !== '') {
      let finalVal = resolvedValue
      if (
        (fieldDef.inputType === 'date' || fieldDef.placeholder === 'DD/MM/YYYY') &&
        /^\d{4}-\d{2}-\d{2}$/.test(finalVal)
      ) {
        const [y, m, d] = finalVal.split('-')
        finalVal = `${d}/${m}/${y}`
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

    if (existingApp?.manualEdits[flagKey] && existingApp.fields[flagKey]) {
      fields[flagKey] = existingApp.fields[flagKey]
    } else if (!fields[flagKey]) {
      fields[flagKey] = { value: 'No', source: 'missing', isUserEdited: false }
    }

    if (existingApp?.manualEdits[ansKey] && existingApp.fields[ansKey]) {
      fields[ansKey] = existingApp.fields[ansKey]
    } else if (!fields[ansKey]) {
      fields[ansKey] = { value: '', source: 'missing', isUserEdited: false }
    }
  }

  const now = new Date().toISOString()
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
      dateOfBirth: getFieldStr('appl.birthdate'),
      townCityOfBirth: getFieldStr('appl.placbrth'),
      countryOfBirth: getFieldStr('appl.country_of_birth'),
      nationalIdNumber: getFieldStr('appl.nic_no'),
      religion: getFieldStr('appl.religion'),
      visibleIdentificationMarks: getFieldStr('appl.visual_mark'),
      educationalQualification: getFieldStr('appl.edu_id'),
      nationality: getFieldStr('appl.nationality'),
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
      issueDate: getFieldStr('appl.passport_issue_date'),
      expiryDate: getFieldStr('appl.passport_expiry_date'),
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
      villageTownCity: getFieldStr('state_name'),
      postalCode: getFieldStr('pincode'),
      country: getFieldStr('appl.countryname'),
    },

    permanentAddress: {
      addressLine1: getFieldStr('perm_add1'),
      addressLine2: getFieldStr('perm_add2'),
      villageTownCity: getFieldStr('perm_add3'),
      country: getFieldStr('appl.countryname'),
    },

    contact: {
      email: getFieldStr('appl.email'),
      phone: getFieldStr('pres_phone'),
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
      intendedArrivalDate: getFieldStr('journeydate') || getFieldStr('appl.journeydate'),
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
      dateOfIssue: getFieldStr('oldvisaissuedate'),
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
  }

  // Also preserve special derived mission if notes or fields specify
  const mission = getFieldStr('appl.missioncode')
  if (mission) {
    profile.notes = `${profile.notes ? profile.notes + '\n' : ''}Indian Mission: ${mission}`
  }

  return profile
}
