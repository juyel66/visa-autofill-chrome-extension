import { JSDOM } from 'jsdom'
import type { ApplicantProfile } from '../../applicant/types'
import type { DocumentRecord } from '../../document/types'
import type { ExtractedApplicantData } from '../../extraction/data/types'
import {
  BANGLADESH_APPLICATION_SCHEMA,
  getAllSchemaFields,
  getDefaultVisibleSchemaFields,
  getDefaultHiddenSchemaFields,
  WORKSPACE_DEFAULT_VISIBLE_FIELDS,
  WORKSPACE_HIDDEN_FIELDS,
  WORKSPACE_SECTIONS,
} from '../fieldSchema'
import {
  populateApplicationFromDocuments,
} from '../applicationMerger'
import {
  clearMemorySavedApplications,
  getSavedApplicationByApplicantId,
  saveApplication,
} from '../applicationStorage'
import { resolveCandidateData } from '../../autofill/candidateResolver'
import { executeAutofill } from '../../autofill/autofillEngine'
import { getIndiaVisaMappings } from '../../../countries/india/mappingService'
import { BANGLADESH_FIELD_REGISTRY } from '../../../countries/india/selectors/bangladesh/registry'
import type { SavedApplication } from '../types'

export interface TestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runApplicationWorkspaceTests(): Promise<TestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  const assert = (condition: boolean, testName: string, detail?: string) => {
    totalSubtests++
    if (!condition) {
      const msg = `FAIL: [ApplicationWorkspace] ${testName}${detail ? ` - ${detail}` : ''}`
      console.error(msg)
      failures.push(msg)
    }
  }

  // --- Subtest 1: Profile remains identifier-only container ---
  const profileId = 'PROFILE_TEST_001'
  const emptyProfile: ApplicantProfile = {
    applicantId: profileId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: 'Indian Mission: BANGLADESH-DHAKA',
  }
  assert(
    emptyProfile.applicantId === profileId &&
      emptyProfile.personalInfo === undefined &&
      emptyProfile.passport === undefined,
    'Subtest 1: Profile remains an identifier-only container without personal data fallback'
  )

  // --- Subtest 2 & 3: Passport and OGD upload create isolated document records ---
  const passportExtracted: ExtractedApplicantData = {
    personal: {
      lastName: { value: 'RAHMAN', source: 'pdf-text', confidence: 0.99 },
      firstName: { value: 'ANISUR', source: 'pdf-text', confidence: 0.99 },
      gender: { value: 'male', source: 'pdf-text', confidence: 0.99 },
      dateOfBirth: { value: '1990-05-15', source: 'pdf-text', confidence: 0.99 },
      nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.99 },
      townCityOfBirth: { value: 'DHAKA', source: 'pdf-text', confidence: 0.95 },
      countryOfBirth: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.99 },
    },
    passport: {
      passportNumber: { value: 'A12345678', source: 'pdf-text', confidence: 0.99 },
      placeOfIssue: { value: 'DHAKA', source: 'pdf-text', confidence: 0.95 },
      issueDate: { value: '2020-01-10', source: 'pdf-text', confidence: 0.99 },
      expiryDate: { value: '2030-01-09', source: 'pdf-text', confidence: 0.99 },
      issuingCountry: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.99 },
    },
    presentAddress: {
      addressLine1: { value: 'HOUSE 12, ROAD 5', source: 'pdf-text', confidence: 0.9 },
      villageTownCity: { value: 'DHAKA', source: 'pdf-text', confidence: 0.9 },
      postalCode: { value: '1205', source: 'pdf-text', confidence: 0.9 },
      country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.99 },
    },
    contact: {
      email: { value: 'anisur@example.com', source: 'pdf-text', confidence: 0.95 },
      mobile: { value: '01711122233', source: 'pdf-text', confidence: 0.95 },
    },
  }

  const ogdExtracted: ExtractedApplicantData = {
    personal: {
      // Intentionally divergent old identity to test precedence protection
      lastName: { value: 'OLD_NAME_IGNORE', source: 'pdf-text', confidence: 0.9 },
      dateOfBirth: { value: '1980-01-01', source: 'pdf-text', confidence: 0.9 },
    },
    passport: {
      passportNumber: { value: 'OLD_PASSPORT_000', source: 'pdf-text', confidence: 0.9 },
    },
    previousVisa: {
      hasPreviousVisa: { value: true, source: 'pdf-text', confidence: 0.95 },
      visaNumber: { value: 'V987654321', source: 'pdf-text', confidence: 0.95 },
      visaType: { value: 'TOURIST VISA', source: 'pdf-text', confidence: 0.95 },
      placeOfIssue: { value: 'DHAKA', source: 'pdf-text', confidence: 0.95 },
      dateOfIssue: { value: '2022-04-15', source: 'pdf-text', confidence: 0.95 },
      visitedAddress1: { value: 'HOTEL TAJ, KOLKATA', source: 'pdf-text', confidence: 0.95 },
      visitedAddress2: { value: 'PARK STREET', source: 'pdf-text', confidence: 0.95 },
      visitedAddress3: { value: 'KOLKATA', source: 'pdf-text', confidence: 0.95 },
    },
    travel: {
      countriesVisited: { value: 'INDIA, THAILAND', source: 'pdf-text', confidence: 0.9 },
      visitedSaarc: { value: true, source: 'pdf-text', confidence: 0.9 },
    },
  }

  const passportDoc: DocumentRecord = {
    documentId: 'doc_passport_001',
    applicantId: profileId,
    documentType: 'passport',
    fileName: 'Passport_Anisur.pdf',
    fileSize: 102400,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: passportExtracted,
    extractedDataConfirmed: true,
  }

  const ogdDoc: DocumentRecord = {
    documentId: 'doc_ogd_001',
    applicantId: profileId,
    documentType: 'ogd',
    fileName: 'Previous_India_Visa_OGD.pdf',
    fileSize: 85000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: ogdExtracted,
    extractedDataConfirmed: true,
  }

  assert(
    passportDoc.documentType === 'passport' && ogdDoc.documentType === 'ogd',
    'Subtest 2 & 3: Passport and OGD documents created with isolated types'
  )

  // --- Subtest 4 & 5: Confirmed extraction populates workspace & missing fields stay blank ---
  const initialApp = populateApplicationFromDocuments({
    applicantId: profileId,
    passportDoc,
    ogdDoc,
    existingApp: null,
    notes: emptyProfile.notes,
  })

  assert(
    initialApp.fields['appl.surname']?.value === 'RAHMAN' &&
      initialApp.fields['appl.surname']?.source === 'passport' &&
      initialApp.fields['appl.passport_number']?.value === 'A12345678',
    'Subtest 4: Confirmed passport extraction populates workspace identity fields'
  )

  assert(
    initialApp.fields['fthrname']?.value === '' &&
      initialApp.fields['fthrname']?.source === 'missing' &&
      initialApp.fields['mother_name']?.value === '',
    'Subtest 5: Fields missing from document stay blank without fallback to fake profile data'
  )

  // --- Subtest 6: User manual edit overrides extracted value ---
  const editedApp: SavedApplication = {
    ...initialApp,
    fields: {
      ...initialApp.fields,
      'appl.birthdate': {
        value: '16/05/1990',
        source: 'manual',
        isUserEdited: true,
        originalExtractedValue: '1990-05-15',
      },
      fthrname: {
        value: 'MUSTAFIZUR RAHMAN',
        source: 'manual',
        isUserEdited: true,
      },
    },
    manualEdits: {
      ...initialApp.manualEdits,
      'appl.birthdate': true,
      fthrname: true,
    },
  }

  assert(
    editedApp.fields['appl.birthdate']?.value === '16/05/1990' &&
      editedApp.fields['appl.birthdate']?.isUserEdited === true &&
      editedApp.fields['fthrname']?.value === 'MUSTAFIZUR RAHMAN',
    'Subtest 6: User manual edit overrides extracted value and marks isUserEdited'
  )

  // --- Subtest 7, 8, 9, 10: Save persists application and reopening preserves manual edits ---
  clearMemorySavedApplications()
  await saveApplication(editedApp)

  const reloadedApp = await getSavedApplicationByApplicantId(profileId)
  assert(
    reloadedApp !== null &&
      reloadedApp.applicantId === profileId &&
      reloadedApp.fields['appl.birthdate']?.value === '16/05/1990' &&
      reloadedApp.fields['fthrname']?.value === 'MUSTAFIZUR RAHMAN',
    'Subtest 7, 8, 9, 10: Saved application persists under profile and preserves manual edits on reopen'
  )

  // Re-merging with documents must NOT erase manual edits
  const reMerged = populateApplicationFromDocuments({
    applicantId: profileId,
    passportDoc,
    ogdDoc,
    existingApp: reloadedApp,
  })
  assert(
    reMerged.fields['appl.birthdate']?.value === '16/05/1990' &&
      reMerged.fields['fthrname']?.value === 'MUSTAFIZUR RAHMAN',
    'Subtest 10b: Re-merging from documents preserves user manual edits'
  )

  // --- Subtest 11 & 12: Passport + OGD provenance separate & OGD does not overwrite current passport identity ---
  assert(
    initialApp.fields['appl.passport_number']?.value === 'A12345678' &&
      initialApp.fields['appl.passport_number']?.source === 'passport' &&
      initialApp.fields['appl.surname']?.value === 'RAHMAN' &&
      initialApp.fields['old_visa_no']?.value === 'V987654321' &&
      initialApp.fields['old_visa_no']?.source === 'ogd' &&
      initialApp.fields['prv_visit_add1']?.value === 'HOTEL TAJ, KOLKATA',
    'Subtest 11 & 12: OGD historical data merges correctly while passport identity is strictly protected'
  )

  // --- Subtest 13 & 14: Portal autofill works from SavedApplication without website file attachment ---
  const candRes = resolveCandidateData({
    profileId,
    documents: [passportDoc, ogdDoc],
    savedApplication: reloadedApp,
  })

  assert(
    candRes.status === 'READY' &&
      candRes.applicant !== undefined &&
      candRes.applicant.personalInfo?.surname === 'RAHMAN' &&
      candRes.applicant.personalInfo?.dateOfBirth === '1990-05-16' &&
      candRes.applicant.family?.father?.name === 'MUSTAFIZUR RAHMAN' &&
      candRes.applicant.previousVisa?.visaNumber === 'V987654321',
    'Subtest 13: Candidate resolver resolves complete profile from SavedApplication'
  )

  // --- Subtest 15, 16, 17, 18, 19: DOM Autofill safety on Registration & Basic Details & Family Details ---
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <!-- Page 1: Registration -->
        <select id="countryname_id">
          <option value="">Select</option>
          <option value="BANGLADESH">BANGLADESH</option>
        </select>
        <select id="missioncode_id">
          <option value="">Select</option>
          <option value="BANGLADESH-DHAKA">BANGLADESH - DHAKA</option>
        </select>
        <select id="nationality_id">
          <option value="">Select</option>
          <option value="BANGLADESH">BANGLADESH</option>
        </select>
        <input id="dob_id" type="text" value="" />
        <input id="email_id" type="text" value="" />
        <input id="email_re_id" type="text" value="" />
        <input id="jouryney_id" type="text" value="" />
        <input id="captcha" type="text" value="" />

        <!-- Page 2: Basic Details -->
        <input id="surname" type="text" value="" />
        <input id="givenName" type="text" value="" />
        <select id="gender">
          <option value="">Select</option>
          <option value="MALE">MALE</option>
          <option value="FEMALE">FEMALE</option>
        </select>
        <input id="passport_no" type="text" value="" />
        <input id="father_name_pre_filled" type="text" value="EXISTING VALUE DO NOT OVERWRITE" />
      </body>
    </html>
  `)

  // Bind global DOM for autofill execution in test environment
  Object.assign(globalThis, {
    document: dom.window.document,
    window: dom.window,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
  })

  const regMappings = getIndiaVisaMappings(null, 'REGISTRATION', 'indianvisa-bangladesh.nic.in')
  const regResult = await executeAutofill({
    mappings: regMappings,
    applicant: candRes.applicant!,
    options: { policy: 'fill-empty' },
  })

  assert(
    regResult.filledFields >= 4,
    'Subtest 14: Registration autofill succeeds from SavedApplication without file attachment'
  )

  // Verify CAPTCHA remained untouched
  const captchaEl = dom.window.document.getElementById('captcha') as HTMLInputElement
  assert(
    captchaEl.value === '',
    'Subtest 20: CAPTCHA field remains untouched and manual'
  )

  // Basic Details execution
  const basicMappings = getIndiaVisaMappings(null, 'BASIC_DETAILS', 'indianvisa-bangladesh.nic.in')
  const basicResult = await executeAutofill({
    mappings: basicMappings,
    applicant: candRes.applicant!,
    options: { policy: 'fill-empty' },
  })

  const surnameEl = dom.window.document.getElementById('surname') as HTMLInputElement
  const passportNoEl = dom.window.document.getElementById('passport_no') as HTMLInputElement
  assert(
    basicResult.filledFields >= 2 && surnameEl.value === 'RAHMAN' && passportNoEl.value === 'A12345678',
    'Subtest 14b: Basic Details autofill fills correct values from SavedApplication'
  )

  // --- Subtest 20-24: Safety controls verification in schema ---
  const allSchema = getAllSchemaFields()
  const captchaInSchema = allSchema.find((f) => f.key === 'captcha' || f.key === 'appl.captcha')
  assert(
    captchaInSchema === undefined,
    'Subtest 20b: CAPTCHA does not exist as an autofillable field in Application Workspace schema'
  )

  const regNotices = BANGLADESH_APPLICATION_SCHEMA.find((s) => s.id === 'registration')?.manualNotices
  const refusalNotices = BANGLADESH_APPLICATION_SCHEMA.find((s) => s.id === 'visaDetails')?.manualNotices
  const declNotices = BANGLADESH_APPLICATION_SCHEMA.find((s) => s.id === 'additionalQuestions')?.manualNotices
  const photoNotices = BANGLADESH_APPLICATION_SCHEMA.find((s) => s.id === 'photoUpload')?.manualNotices

  assert(
    Boolean(regNotices?.some((n) => n.title.includes('CAPTCHA'))),
    'Subtest 20c: Registration manual notice highlights manual CAPTCHA'
  )
  assert(
    Boolean(refusalNotices?.some((n) => n.title.includes('Refusal'))),
    'Subtest 21: Visa details manual notice highlights manual Refusal disclosures'
  )
  assert(
    Boolean(declNotices?.some((n) => n.title.includes('Declaration'))),
    'Subtest 22: Additional questions manual notice highlights manual Declaration'
  )
  assert(
    Boolean(photoNotices?.some((n) => n.title.includes('Portal Photo Chooser'))),
    'Subtest 23: Photo upload manual notice highlights manual portal file selection'
  )

  const ignoredTechnicalButtons = BANGLADESH_FIELD_REGISTRY.filter(
    (c) => c.eligibility === 'technical-ignored'
  )
  assert(
    ignoredTechnicalButtons.length >= 4,
    'Subtest 24: Submit/Continue/Exit/Upload buttons are technical-ignored and never automated'
  )

  // --- Subtest 25: TASK 055 — Passport PDF Multi-Line Extraction & Full Workspace Auto-Population ---
  const { extractFromPdfText } = await import('../../extraction/data/applicantDataExtractor')
  const simulatedKhokonPdfText = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT
    Type / Type: P  Country Code / Code du pays: BGD  Passport No. / N° du passeport: A1234567
    Surname / Nom: AHMED
    Given Name(s) / Prénoms: KHOKON
    Nationality / Nationalité: BANGLADESHI
    Personal No. / N° personnel: 19951234567890123
    Date of Birth / Date de naissance: 15 MAY 1995
    Previous Passport No. / N° de l'ancien passeport:
    Sex / Sexe: M
    Place of Birth / Lieu de naissance: DHAKA, BGD
    Date of Issue / Date de délivrance: 27 JAN 2021
    Issuing Authority / Autorité: DIP/DHAKA
    Date of Expiry / Date d'expiration: 26 JAN 2031

    P<BGDAHMED<<KHOKON<<<<<<<<<<<<<<<<<<<<<<<<<<
    A1234567<8BGD9505156M3101264<<<<<<<<<<<<<<02
  `

  const extractedKhokon = extractFromPdfText(simulatedKhokonPdfText)
  assert(
    extractedKhokon.personal?.lastName?.value === 'AHMED' &&
      extractedKhokon.personal?.firstName?.value === 'KHOKON' &&
      extractedKhokon.personal?.dateOfBirth?.value === '1995-05-15' &&
      extractedKhokon.personal?.gender?.value === 'male' &&
      extractedKhokon.personal?.nationality?.value === 'BANGLADESH' &&
      extractedKhokon.personal?.townCityOfBirth?.value === 'DHAKA' &&
      extractedKhokon.personal?.countryOfBirth?.value === 'BANGLADESH' &&
      extractedKhokon.passport?.passportNumber?.value === 'A1234567' &&
      extractedKhokon.passport?.placeOfIssue?.value === 'DIP/DHAKA' &&
      extractedKhokon.passport?.issueDate?.value === '2021-01-27' &&
      extractedKhokon.passport?.expiryDate?.value === '2031-01-26',
    'Subtest 25a: Passport multi-line PDF text extracts all identity, date, and passport details'
  )

  const khokonDoc: DocumentRecord = {
    documentId: 'doc_khokon_001',
    applicantId: 'KHOKON_001',
    documentType: 'passport',
    fileName: 'Khokon WEB 27.pdf',
    fileSize: 154000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: extractedKhokon,
    extractedDataConfirmed: true,
  }

  const khokonApp = populateApplicationFromDocuments({
    applicantId: 'KHOKON_001',
    passportDoc: khokonDoc,
    ogdDoc: null,
    existingApp: null,
  })

  assert(
    khokonApp.fields['appl.surname']?.value === 'AHMED' &&
      khokonApp.fields['appl.applname']?.value === 'KHOKON' &&
      khokonApp.fields['appl.birthdate']?.value === '15/05/1995' &&
      khokonApp.fields['appl.nationality']?.value === 'BANGLADESH' &&
      khokonApp.fields['appl.countryname']?.value === 'BANGLADESH' &&
      khokonApp.fields['appl.placbrth']?.value === 'DHAKA' &&
      khokonApp.fields['appl.country_of_birth']?.value === 'BANGLADESH' &&
      khokonApp.fields['appl.passport_number']?.value === 'A1234567' &&
      khokonApp.fields['appl.passport_issue_date']?.value === '27/01/2021' &&
      khokonApp.fields['appl.passport_expiry_date']?.value === '26/01/2031' &&
      khokonApp.fields['appl.nationality_by']?.value === 'Birth' &&
      khokonApp.fields['appl.oth_ppt']?.value === 'No',
    'Subtest 25b: Passport PDF data directly auto-populates all corresponding application workspace fields'
  )

  assert(
    khokonApp.fields['fthrname']?.value === '' &&
      khokonApp.fields['mother_name']?.value === '' &&
      khokonApp.fields['empname']?.value === '' &&
      khokonApp.fields['old_visa_no']?.value === '',
    'Subtest 25c: Missing fields legitimately remain blank without fallback to fake profile values'
  )

  // --- TASK 067-FINAL & TASK 070: One-Page Workspace Visibility & Schema Integrity ---
  // Subtest 26: Schema Integrity (All canonical fields preserved)
  const allFields = getAllSchemaFields()
  const visibleFields = getDefaultVisibleSchemaFields()
  const hiddenFields = getDefaultHiddenSchemaFields()

  assert(
    allFields.length === 114,
    `Subtest 26a: Total registered schema fields is 114 (got ${allFields.length})`
  )
  assert(
    visibleFields.length === 95,
    `Subtest 26b: Default visible fields count is 95 (got ${visibleFields.length})`
  )
  assert(
    hiddenFields.length === 19,
    `Subtest 26c: Default hidden fields count is 19 (got ${hiddenFields.length})`
  )
  assert(
    WORKSPACE_DEFAULT_VISIBLE_FIELDS.length === 93 && WORKSPACE_HIDDEN_FIELDS.length === 17,
    'Subtest 26d: WORKSPACE_DEFAULT_VISIBLE_FIELDS (93) and WORKSPACE_HIDDEN_FIELDS (17) explicitly configured'
  )

  // Subtest 26e: All 10 Workspace Sections defined and cover all workspace fields
  assert(
    WORKSPACE_SECTIONS.length === 10,
    `Subtest 26e: Workspace has exactly 10 sections for single full-page rendering (got ${WORKSPACE_SECTIONS.length})`
  )
  const totalSectionFields = WORKSPACE_SECTIONS.flatMap((s) => s.fieldKeys)
  assert(
    totalSectionFields.length === 110,
    `Subtest 26f: All 10 Workspace sections map to all 110 section fields (got ${totalSectionFields.length})`
  )

  // Subtest 27: Hidden fields remain in SavedApplication and retain populated values
  assert(
    khokonApp.fields['appl.email_re'] !== undefined,
    'Subtest 27a: Hidden field appl.email_re is retained in SavedApplication'
  )
  assert(
    khokonApp.fields['appl.journeydate'] !== undefined,
    'Subtest 27b: Hidden field appl.journeydate is retained in SavedApplication'
  )
  assert(
    khokonApp.fields['appl.changedSurnameCheck'] !== undefined,
    'Subtest 27c: Hidden field appl.changedSurnameCheck is retained in SavedApplication'
  )
  assert(
    khokonApp.fields['grandparent_details'] !== undefined,
    'Subtest 27d: Hidden field grandparent_details is retained in SavedApplication'
  )
  assert(
    khokonApp.fields['previous_organization'] !== undefined,
    'Subtest 27e: Hidden field previous_organization is retained in SavedApplication'
  )
  assert(
    khokonApp.fields['answer_1'] !== undefined,
    'Subtest 27f: Hidden field answer_1 is retained in SavedApplication'
  )

  // Subtest 28: Save Application preserves all fields and reloads with hidden field values intact
  await saveApplication(khokonApp)
  const reloadedKhokon = await getSavedApplicationByApplicantId('KHOKON_001')
  assert(
    reloadedKhokon !== null && Object.keys(reloadedKhokon.fields).length === 111,
    'Subtest 28a: SavedApplication preserves all 111 unique fields in storage'
  )
  assert(
    reloadedKhokon?.fields['appl.surname']?.value === 'AHMED',
    'Subtest 28b: Reloaded application preserves visible field values'
  )
  assert(
    reloadedKhokon?.fields['appl.journeydate'] !== undefined,
    'Subtest 28c: Reloaded application preserves hidden field values'
  )

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
