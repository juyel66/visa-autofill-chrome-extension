import { JSDOM } from 'jsdom'
import type { DocumentRecord } from '../../../core/document/types'
import {
  extractFromPdfText,
} from '../../../core/extraction/data/applicantDataExtractor'
import {
  populateApplicationFromDocuments,
} from '../../../core/application/applicationMerger'
import {
  clearMemorySavedApplications,
  getSavedApplicationByApplicantId,
  saveApplication,
} from '../../../core/application/applicationStorage'
import { resolveCandidateData } from '../../../core/autofill/candidateResolver'
import { executeAutofill } from '../../../core/autofill/autofillEngine'
import { getIndiaVisaMappings } from '../mappingService'
import { detectIndiaVisaPage } from '../detector'
import { normalizePageIdentity } from '../canonicalPages'
import { BANGLADESH_FIELD_REGISTRY } from '../selectors/bangladesh/registry'
import { BANGLADESH_APPLICATION_SCHEMA } from '../../../core/application/fieldSchema'
import type { SavedApplication } from '../../../core/application/types'

export interface WorkflowTestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runEndToEndWorkflowTests(): Promise<WorkflowTestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  const assert = (condition: boolean, testName: string, detail?: string) => {
    totalSubtests++
    if (!condition) {
      const msg = `FAIL: [E2E Workflow] ${testName}${detail ? ` - ${detail}` : ''}`
      console.error(msg)
      failures.push(msg)
    }
  }

  console.log('--- STARTING COMPLETE END-TO-END WORKFLOW TESTS (TASK 056) ---')

  const applicantId = 'APPLICANT_TASK_056'
  const applicantNotes = 'Indian Mission: BANGLADESH-DHAKA'

  // =========================================================================
  // STAGE A & B: PDF Extraction & Data Normalization
  // =========================================================================
  const samplePassportPdfText = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT
    Type / Type: P  Country Code / Code du pays: BGD  Passport No. / N° du passeport: EJ0123456
    Surname / Nom: CHOWDHURY
    Given Name(s) / Prénoms: TANVIR AHMED
    Nationality / Nationalité: BANGLADESHI
    Personal No. / N° personnel: 19922692512345678
    Date of Birth / Date de naissance: 12 OCT 1992
    Sex / Sexe: M
    Place of Birth / Lieu de naissance: CHITTAGONG, BGD
    Date of Issue / Date de délivrance: 15 MAR 2021
    Issuing Authority / Autorité: DHAKA
    Date of Expiry / Date d'expiration: 14 MAR 2031

    P<BGDCHOWDHURY<<TANVIR<AHMED<<<<<<<<<<<<<<<<<
    EJ01234567BGD9210123M3103148<<<<<<<<<<<<<<04
  `

  const extractedPassport = extractFromPdfText(samplePassportPdfText)
  assert(
    extractedPassport.personal?.lastName?.value === 'CHOWDHURY' &&
    extractedPassport.personal?.firstName?.value === 'TANVIR AHMED' &&
    extractedPassport.personal?.dateOfBirth?.value === '1992-10-12' &&
    extractedPassport.personal?.gender?.value === 'male' &&
    extractedPassport.personal?.nationality?.value === 'BANGLADESH' &&
    extractedPassport.personal?.townCityOfBirth?.value === 'CHITTAGONG' &&
    extractedPassport.personal?.countryOfBirth?.value === 'BANGLADESH' &&
    extractedPassport.passport?.passportNumber?.value === 'EJ0123456' &&
    extractedPassport.passport?.placeOfIssue?.value === 'DHAKA' &&
    extractedPassport.passport?.issueDate?.value === '2021-03-15' &&
    extractedPassport.passport?.expiryDate?.value === '2031-03-14',
    'A & B: PDF Extraction & Normalization extracts all identity and passport fields'
  )

  // =========================================================================
  // STAGE C: Application Merge (Passport + OGD)
  // =========================================================================
  const passportDoc: DocumentRecord = {
    documentId: 'doc_passport_56',
    applicantId,
    documentType: 'passport',
    fileName: 'Passport_Tanvir.pdf',
    fileSize: 120000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: extractedPassport,
    extractedDataConfirmed: true,
  }

  const ogdDoc: DocumentRecord = {
    documentId: 'doc_ogd_56',
    applicantId,
    documentType: 'ogd',
    fileName: 'Previous_Visa_OGD.pdf',
    fileSize: 95000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: {
      previousVisa: {
        hasPreviousVisa: { value: true, source: 'pdf-text', confidence: 0.95 },
        visaNumber: { value: 'VJ12345678', source: 'pdf-text', confidence: 0.95 },
        visaType: { value: 'TOURIST VISA', source: 'pdf-text', confidence: 0.95 },
        placeOfIssue: { value: 'DHAKA', source: 'pdf-text', confidence: 0.95 },
        dateOfIssue: { value: '2022-06-10', source: 'pdf-text', confidence: 0.95 },
        visitedAddress1: { value: 'PARK HOTEL, NEW DELHI', source: 'pdf-text', confidence: 0.95 },
        visitedAddress2: { value: 'CONNAUGHT PLACE', source: 'pdf-text', confidence: 0.95 },
        visitedAddress3: { value: 'NEW DELHI', source: 'pdf-text', confidence: 0.95 },
      },
      travel: {
        countriesVisited: { value: 'INDIA, MALAYSIA, SINGAPORE', source: 'pdf-text', confidence: 0.95 },
        visitedSaarc: { value: true, source: 'pdf-text', confidence: 0.95 },
      },
    },
    extractedDataConfirmed: true,
  }

  const initialMergedApp = populateApplicationFromDocuments({
    applicantId,
    passportDoc,
    ogdDoc,
    existingApp: null,
    notes: applicantNotes,
  })

  assert(
    initialMergedApp.fields['appl.surname']?.value === 'CHOWDHURY' &&
    initialMergedApp.fields['appl.applname']?.value === 'TANVIR AHMED' &&
    initialMergedApp.fields['appl.birthdate']?.value === '12/10/1992' &&
    initialMergedApp.fields['appl.nationality']?.value === 'BANGLADESH' &&
    initialMergedApp.fields['appl.countryname']?.value === 'BANGLADESH' &&
    initialMergedApp.fields['appl.passport_number']?.value === 'EJ0123456' &&
    initialMergedApp.fields['old_visa_no']?.value === 'VJ12345678' &&
    initialMergedApp.fields['country_visited']?.value === 'INDIA, MALAYSIA, SINGAPORE',
    'C: Application Merge populates both passport identity and OGD historical data'
  )

  // =========================================================================
  // STAGE D: Automatic SavedApplication Persistence
  // =========================================================================
  clearMemorySavedApplications()
  await saveApplication(initialMergedApp)

  const persistedApp = await getSavedApplicationByApplicantId(applicantId)
  assert(
    persistedApp !== null &&
    persistedApp.applicantId === applicantId &&
    persistedApp.fields['appl.surname']?.value === 'CHOWDHURY' &&
    persistedApp.fields['appl.passport_number']?.value === 'EJ0123456',
    'D: Automatic SavedApplication Persistence stores extracted application in storage'
  )

  // =========================================================================
  // STAGE E & F: Workspace Initialization & Manual Edit Persistence
  // =========================================================================
  // Simulate user opening workspace and editing / adding missing fields:
  // e.g. adding Father Name, Spouse Name, Present Address, Indian Sponsor, 6 Questions
  const manuallyEditedApp: SavedApplication = {
    ...persistedApp!,
    fields: {
      ...persistedApp!.fields,
      'appl.email': {
        value: 'tanvir.chowdhury@example.com',
        source: 'manual',
        isUserEdited: true,
      },
      'appl.email_re': {
        value: 'tanvir.chowdhury@example.com',
        source: 'manual',
        isUserEdited: true,
      },
      'appl.journeydate': {
        value: '20/12/2026',
        source: 'manual',
        isUserEdited: true,
      },
      'appl.religion': {
        value: 'ISLAM',
        source: 'manual',
        isUserEdited: true,
      },
      'appl.edu_id': {
        value: 'GRADUATE',
        source: 'manual',
        isUserEdited: true,
      },
      pres_addr1: {
        value: 'HOUSE 45, ROAD 11, GULSHAN',
        source: 'manual',
        isUserEdited: true,
      },
      state_name: {
        value: 'DHAKA',
        source: 'manual',
        isUserEdited: true,
      },
      pincode: {
        value: '1212',
        source: 'manual',
        isUserEdited: true,
      },
      pres_phone: {
        value: '028812345',
        source: 'manual',
        isUserEdited: true,
      },
      mobile: {
        value: '01811223344',
        source: 'manual',
        isUserEdited: true,
      },
      perm_add1: {
        value: 'VILLAGE KADAMTALI',
        source: 'manual',
        isUserEdited: true,
      },
      perm_add3: {
        value: 'CHITTAGONG',
        source: 'manual',
        isUserEdited: true,
      },
      fthrname: {
        value: 'LATE ABDUR RAHIM CHOWDHURY',
        source: 'manual',
        isUserEdited: true,
      },
      mother_name: {
        value: 'SURAIYA BEGUM',
        source: 'manual',
        isUserEdited: true,
      },
      marital_status: {
        value: 'MARRIED',
        source: 'manual',
        isUserEdited: true,
      },
      spouse_name: {
        value: 'NUSRAT JAHAN',
        source: 'manual',
        isUserEdited: true,
      },
      occupation: {
        value: 'BUSINESS',
        source: 'manual',
        isUserEdited: true,
      },
      empname: {
        value: 'CHOWDHURY TRADING LTD',
        source: 'manual',
        isUserEdited: true,
      },
      empdesignation: {
        value: 'MANAGING DIRECTOR',
        source: 'manual',
        isUserEdited: true,
      },
      empaddress: {
        value: 'MOTIJHEEL C/A, DHAKA',
        source: 'manual',
        isUserEdited: true,
      },
      duration: {
        value: '12',
        source: 'manual',
        isUserEdited: true,
      },
      visa_entry_id: {
        value: 'MULTIPLE',
        source: 'manual',
        isUserEdited: true,
      },
      journeydate: {
        value: '20/12/2026',
        source: 'manual',
        isUserEdited: true,
      },
      entrypoint: {
        value: 'HARIDASPUR',
        source: 'manual',
        isUserEdited: true,
      },
      exitpoint: {
        value: 'HARIDASPUR',
        source: 'manual',
        isUserEdited: true,
      },
      nameofsponsor_ind: {
        value: 'RAJESH SHARMA',
        source: 'manual',
        isUserEdited: true,
      },
      add1ofsponsor_ind: {
        value: 'FLAT 4B, SALT LAKE SECTOR 5',
        source: 'manual',
        isUserEdited: true,
      },
      phoneofsponsor_ind: {
        value: '+919876543210',
        source: 'manual',
        isUserEdited: true,
      },
      nameofsponsor_msn: {
        value: 'KAMAL HOSSAIN',
        source: 'manual',
        isUserEdited: true,
      },
      add1ofsponsor_msn: {
        value: 'GULSHAN 2, DHAKA',
        source: 'manual',
        isUserEdited: true,
      },
      phoneofsponsor_msn: {
        value: '+8801711223344',
        source: 'manual',
        isUserEdited: true,
      },
      question_1_flag: { value: 'No', source: 'manual', isUserEdited: true },
      answer_1: { value: '', source: 'manual', isUserEdited: true },
      question_2_flag: { value: 'No', source: 'manual', isUserEdited: true },
      answer_2: { value: '', source: 'manual', isUserEdited: true },
      question_3_flag: { value: 'No', source: 'manual', isUserEdited: true },
      answer_3: { value: '', source: 'manual', isUserEdited: true },
      question_4_flag: { value: 'No', source: 'manual', isUserEdited: true },
      answer_4: { value: '', source: 'manual', isUserEdited: true },
      question_5_flag: { value: 'No', source: 'manual', isUserEdited: true },
      answer_5: { value: '', source: 'manual', isUserEdited: true },
      question_6_flag: { value: 'No', source: 'manual', isUserEdited: true },
      answer_6: { value: '', source: 'manual', isUserEdited: true },
    },
    manualEdits: {
      ...persistedApp!.manualEdits,
      'appl.email': true,
      'appl.email_re': true,
      'appl.journeydate': true,
      'appl.religion': true,
      'appl.edu_id': true,
      pres_addr1: true,
      state_name: true,
      pincode: true,
      pres_phone: true,
      mobile: true,
      perm_add1: true,
      perm_add3: true,
      fthrname: true,
      mother_name: true,
      marital_status: true,
      spouse_name: true,
      occupation: true,
      empname: true,
      empdesignation: true,
      empaddress: true,
      duration: true,
      visa_entry_id: true,
      journeydate: true,
      entrypoint: true,
      exitpoint: true,
      nameofsponsor_ind: true,
      add1ofsponsor_ind: true,
      phoneofsponsor_ind: true,
      nameofsponsor_msn: true,
      add1ofsponsor_msn: true,
      phoneofsponsor_msn: true,
      question_1_flag: true,
      question_2_flag: true,
      question_3_flag: true,
      question_4_flag: true,
      question_5_flag: true,
      question_6_flag: true,
    },
  }

  await saveApplication(manuallyEditedApp)

  // =========================================================================
  // STAGE G: SavedApplication Reload & Precedence Verification
  // =========================================================================
  const reloadedSavedApp = await getSavedApplicationByApplicantId(applicantId)
  assert(
    reloadedSavedApp !== null &&
    reloadedSavedApp.fields['fthrname']?.value === 'LATE ABDUR RAHIM CHOWDHURY' &&
    reloadedSavedApp.fields['spouse_name']?.value === 'NUSRAT JAHAN' &&
    reloadedSavedApp.fields['nameofsponsor_ind']?.value === 'RAJESH SHARMA' &&
    reloadedSavedApp.fields['question_1_flag']?.value === 'No',
    'G: SavedApplication Reload preserves all manual edits'
  )

  // Re-synchronizing from documents must NOT overwrite manual edits
  const resyncedApp = populateApplicationFromDocuments({
    applicantId,
    passportDoc,
    ogdDoc,
    existingApp: reloadedSavedApp,
    notes: applicantNotes,
  })

  assert(
    resyncedApp.fields['fthrname']?.value === 'LATE ABDUR RAHIM CHOWDHURY' &&
    resyncedApp.fields['spouse_name']?.value === 'NUSRAT JAHAN' &&
    resyncedApp.fields['appl.surname']?.value === 'CHOWDHURY',
    'G2: Re-synchronizing documents strictly respects User Manual Edit > Confirmed Document Value'
  )

  // Resolve candidate data from SavedApplication
  const candRes = resolveCandidateData({
    profileId: applicantId,
    documents: [passportDoc, ogdDoc],
    savedApplication: reloadedSavedApp,
    notes: applicantNotes,
  })

  assert(
    candRes.status === 'READY' &&
    candRes.applicant !== undefined &&
    candRes.applicant.personalInfo?.surname === 'CHOWDHURY' &&
    candRes.applicant.family?.father?.name === 'LATE ABDUR RAHIM CHOWDHURY' &&
    candRes.applicant.family?.spouse?.name === 'NUSRAT JAHAN' &&
    candRes.applicant.additionalQuestions?.question1?.flag === 'No',
    'G3: Candidate resolver reads SavedApplication as the single source of autofill data'
  )

  const resolvedProfile = candRes.applicant!

  // =========================================================================
  // STAGE O: Deterministic Page Detection Across All 6 Pages
  // =========================================================================
  const regDet = detectIndiaVisaPage({ href: 'https://indianvisa-bangladesh.nic.in/visa/Registration', hostname: 'indianvisa-bangladesh.nic.in', pathname: '/visa/Registration' })
  const basicDet = detectIndiaVisaPage({ href: 'https://indianvisa-bangladesh.nic.in/visa/BasicDetails', hostname: 'indianvisa-bangladesh.nic.in', pathname: '/visa/BasicDetails' })
  const famDet = detectIndiaVisaPage({ href: 'https://indianvisa-bangladesh.nic.in/visa/FamilyDetails', hostname: 'indianvisa-bangladesh.nic.in', pathname: '/visa/FamilyDetails' })
  const visaDet = detectIndiaVisaPage({ href: 'https://indianvisa-bangladesh.nic.in/visa/VisaDetails', hostname: 'indianvisa-bangladesh.nic.in', pathname: '/visa/VisaDetails' })
  const qDet = detectIndiaVisaPage({ href: 'https://indianvisa-bangladesh.nic.in/visa/AdditionalQuestions', hostname: 'indianvisa-bangladesh.nic.in', pathname: '/visa/AdditionalQuestions' })
  const photoDet = detectIndiaVisaPage({ href: 'https://indianvisa-bangladesh.nic.in/visa/PhotoUpload', hostname: 'indianvisa-bangladesh.nic.in', pathname: '/visa/PhotoUpload' })

  assert(
    regDet.matched && normalizePageIdentity(regDet.page) === 'REGISTRATION',
    'O1: Page 1 detected as REGISTRATION'
  )
  assert(
    basicDet.matched && normalizePageIdentity(basicDet.page) === 'BASIC_DETAILS',
    'O2: Page 2 detected as BASIC_DETAILS'
  )
  assert(
    famDet.matched && normalizePageIdentity(famDet.page) === 'FAMILY_DETAILS',
    'O3: Page 3 detected as FAMILY_DETAILS'
  )
  assert(
    visaDet.matched && normalizePageIdentity(visaDet.page) === 'TRAVEL_DETAILS',
    'O4: Page 4 detected as TRAVEL_DETAILS'
  )
  assert(
    qDet.matched && normalizePageIdentity(qDet.page) === 'ADDITIONAL_QUESTIONS',
    'O5: Page 5 detected as ADDITIONAL_QUESTIONS'
  )
  assert(
    photoDet.matched && normalizePageIdentity(photoDet.page) === 'DOCUMENT_UPLOAD',
    'O6: Page 6 detected as DOCUMENT_UPLOAD'
  )

  // =========================================================================
  // STAGE H: Page 1 — Registration Autofill
  // =========================================================================
  const dom1 = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <select id="countryname_id" name="appl.countryname">
          <option value="">Select</option>
          <option value="BANGLADESH">BANGLADESH</option>
        </select>
        <select id="missioncode_id" name="appl.missioncode">
          <option value="">Select</option>
          <option value="BANGLADESH-DHAKA">BANGLADESH - DHAKA</option>
        </select>
        <select id="nationality_id" name="appl.nationality">
          <option value="">Select</option>
          <option value="BANGLADESH">BANGLADESH</option>
        </select>
        <input id="dob_id" name="appl.birthdate" type="text" value="" />
        <input id="email_id" name="appl.email" type="text" value="" />
        <input id="email_re_id" name="appl.email_re" type="text" value="" />
        <input id="jouryney_id" name="appl.journeydate" type="text" value="" />
        <input id="captcha" name="captcha" type="text" value="" />
        <input type="submit" id="continue" value="Save and Continue" />
      </body>
    </html>
  `)

  Object.assign(globalThis, {
    document: dom1.window.document,
    window: dom1.window,
    HTMLElement: dom1.window.HTMLElement,
    HTMLInputElement: dom1.window.HTMLInputElement,
    HTMLSelectElement: dom1.window.HTMLSelectElement,
    HTMLTextAreaElement: dom1.window.HTMLTextAreaElement,
  })

  const regMappings = getIndiaVisaMappings(null, 'REGISTRATION', 'indianvisa-bangladesh.nic.in')
  const regAutofillRes = await executeAutofill({
    mappings: regMappings,
    applicant: resolvedProfile,
    options: { policy: 'fill-empty' },
  })

  const regCountry = (dom1.window.document.getElementById('countryname_id') as HTMLSelectElement).value
  const regMission = (dom1.window.document.getElementById('missioncode_id') as HTMLSelectElement).value
  const regNationality = (dom1.window.document.getElementById('nationality_id') as HTMLSelectElement).value
  const regDob = (dom1.window.document.getElementById('dob_id') as HTMLInputElement).value
  const regEmail = (dom1.window.document.getElementById('email_id') as HTMLInputElement).value
  const regEmailRe = (dom1.window.document.getElementById('email_re_id') as HTMLInputElement).value
  const regJourney = (dom1.window.document.getElementById('jouryney_id') as HTMLInputElement).value
  const regCaptcha = (dom1.window.document.getElementById('captcha') as HTMLInputElement).value

  assert(
    regAutofillRes.filledFields >= 6 &&
    regCountry === 'BANGLADESH' &&
    regMission === 'BANGLADESH-DHAKA' &&
    regNationality === 'BANGLADESH' &&
    regDob === '12/10/1992' &&
    regEmail === 'tanvir.chowdhury@example.com' &&
    regEmailRe === 'tanvir.chowdhury@example.com' &&
    regJourney === '20/12/2026',
    'H: Page 1 (Registration) fills all applicable supported fields'
  )
  assert(
    regCaptcha === '',
    'H2: Page 1 (Registration) CAPTCHA is never filled and remains manual'
  )

  // =========================================================================
  // STAGE I: Page 2 — Basic Details Autofill
  // =========================================================================
  const dom2 = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <input id="surname" name="appl.surname" type="text" value="" />
        <input id="givenName" name="appl.applname" type="text" value="" />
        <select id="gender" name="appl.applsex">
          <option value="">Select</option>
          <option value="MALE">MALE</option>
          <option value="FEMALE">FEMALE</option>
        </select>
        <input id="birth_place" name="appl.placbrth" type="text" value="" />
        <select id="country_birth" name="appl.country_of_birth">
          <option value="">Select</option>
          <option value="BANGLADESH">BANGLADESH</option>
        </select>
        <select id="religion" name="appl.religion">
          <option value="">Select</option>
          <option value="ISLAM">ISLAM</option>
        </select>
        <select id="education" name="appl.edu_id">
          <option value="">Select</option>
          <option value="GRADUATE">GRADUATE</option>
        </select>
        <select id="nationality_by" name="appl.nationality_by">
          <option value="">Select</option>
          <option value="Birth">Birth</option>
        </select>
        <input id="passport_no" name="appl.passport_number" type="text" value="" />
        <input id="passport_issue_place" name="appl.passport_issue_place" type="text" value="" />
        <input id="passport_issue_date" name="appl.passport_issue_date" type="text" value="" />
        <input id="passport_expiry_date" name="appl.passport_expiry_date" type="text" value="" />
      </body>
    </html>
  `)

  Object.assign(globalThis, {
    document: dom2.window.document,
    window: dom2.window,
    HTMLElement: dom2.window.HTMLElement,
    HTMLInputElement: dom2.window.HTMLInputElement,
    HTMLSelectElement: dom2.window.HTMLSelectElement,
    HTMLTextAreaElement: dom2.window.HTMLTextAreaElement,
  })

  const basicMappings = getIndiaVisaMappings(null, 'BASIC_DETAILS', 'indianvisa-bangladesh.nic.in')
  const basicAutofillRes = await executeAutofill({
    mappings: basicMappings,
    applicant: resolvedProfile,
    options: { policy: 'fill-empty' },
  })

  const bSurname = (dom2.window.document.getElementById('surname') as HTMLInputElement).value
  const bGivenName = (dom2.window.document.getElementById('givenName') as HTMLInputElement).value
  const bGender = (dom2.window.document.getElementById('gender') as HTMLSelectElement).value
  const bBirthPlace = (dom2.window.document.getElementById('birth_place') as HTMLInputElement).value
  const bPassportNo = (dom2.window.document.getElementById('passport_no') as HTMLInputElement).value
  const bIssuePlace = (dom2.window.document.getElementById('passport_issue_place') as HTMLInputElement).value
  const bIssueDate = (dom2.window.document.getElementById('passport_issue_date') as HTMLInputElement).value
  const bExpiryDate = (dom2.window.document.getElementById('passport_expiry_date') as HTMLInputElement).value

  assert(
    basicAutofillRes.filledFields >= 8 &&
    bSurname === 'CHOWDHURY' &&
    bGivenName === 'TANVIR AHMED' &&
    bGender === 'MALE' &&
    bBirthPlace === 'CHITTAGONG' &&
    bPassportNo === 'EJ0123456' &&
    bIssuePlace === 'DHAKA' &&
    bIssueDate === '15/03/2021' &&
    bExpiryDate === '14/03/2031',
    'I: Page 2 (Basic Details) autofills all personal and passport fields correctly'
  )

  // =========================================================================
  // STAGE J: Page 3 — Family Details Autofill
  // =========================================================================
  const dom3 = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <input id="pres_addr1" name="pres_addr1" type="text" value="" />
        <input id="state_name" name="state_name" type="text" value="" />
        <input id="pincode" name="pincode" type="text" value="" />
        <input id="pres_phone" name="pres_phone" type="text" value="" />
        <input id="mobile" name="mobile" type="text" value="" />
        <input id="sameAddress" name="sameAddress" type="checkbox" />
        <input id="perm_add1" name="perm_add1" type="text" value="" />
        <input id="perm_add3" name="perm_add3" type="text" value="" />
        <input id="fthrname" name="fthrname" type="text" value="" />
        <input id="mother_name" name="mother_name" type="text" value="" />
        <select id="marital_status" name="marital_status">
          <option value="">Select</option>
          <option value="MARRIED">MARRIED</option>
        </select>
        <input id="spouse_name" name="spouse_name" type="text" value="" />
        <select id="occupation" name="occupation">
          <option value="">Select</option>
          <option value="BUSINESS">BUSINESS</option>
        </select>
        <input id="empname" name="empname" type="text" value="" />
        <input id="empdesignation" name="empdesignation" type="text" value="" />
        <input id="empaddress" name="empaddress" type="text" value="" />
      </body>
    </html>
  `)

  Object.assign(globalThis, {
    document: dom3.window.document,
    window: dom3.window,
    HTMLElement: dom3.window.HTMLElement,
    HTMLInputElement: dom3.window.HTMLInputElement,
    HTMLSelectElement: dom3.window.HTMLSelectElement,
    HTMLTextAreaElement: dom3.window.HTMLTextAreaElement,
  })

  const famMappings = getIndiaVisaMappings(null, 'FAMILY_DETAILS', 'indianvisa-bangladesh.nic.in')
  const famAutofillRes = await executeAutofill({
    mappings: famMappings,
    applicant: resolvedProfile,
    options: { policy: 'fill-empty' },
  })

  const fAddr1 = (dom3.window.document.getElementById('pres_addr1') as HTMLInputElement).value
  const fFather = (dom3.window.document.getElementById('fthrname') as HTMLInputElement).value
  const fMother = (dom3.window.document.getElementById('mother_name') as HTMLInputElement).value
  const fSpouse = (dom3.window.document.getElementById('spouse_name') as HTMLInputElement).value
  const fOcc = (dom3.window.document.getElementById('occupation') as HTMLSelectElement).value
  const fEmp = (dom3.window.document.getElementById('empname') as HTMLInputElement).value
  const fSameAddrCheckbox = dom3.window.document.getElementById('sameAddress') as HTMLInputElement

  assert(
    famAutofillRes.filledFields >= 10 &&
    fAddr1 === 'HOUSE 45, ROAD 11, GULSHAN' &&
    fFather === 'LATE ABDUR RAHIM CHOWDHURY' &&
    fMother === 'SURAIYA BEGUM' &&
    fSpouse === 'NUSRAT JAHAN' &&
    fOcc === 'BUSINESS' &&
    fEmp === 'CHOWDHURY TRADING LTD',
    'J: Page 3 (Family Details) autofills address, family, marital, and employment details'
  )
  assert(
    fSameAddrCheckbox.checked === false,
    'J2: Page 3 (Family Details) Same Address checkbox remains manual and unchecked'
  )

  // =========================================================================
  // STAGE K: Page 4 — Visa Details Autofill
  // =========================================================================
  const dom4 = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <input id="duration" name="appl.duration" type="text" value="" />
        <select id="visa_entry_id" name="appl.visa_entry_id">
          <option value="">Select</option>
          <option value="MULTIPLE">MULTIPLE</option>
        </select>
        <input id="jouryney_id" name="appl.journeydate" type="text" value="" />
        <select id="entrypoint" name="appl.entrypoint">
          <option value="">Select</option>
          <option value="HARIDASPUR">HARIDASPUR</option>
        </select>
        <select id="exitpointprc" name="appl.exitpoint">
          <option value="">Select</option>
          <option value="HARIDASPUR">HARIDASPUR</option>
        </select>
        <input id="old_visa_flag1" name="appl.old_visa_flag" type="radio" value="Y" />
        <input id="old_visa_flag2" name="appl.old_visa_flag" type="radio" value="N" />
        <input id="old_visa_no" name="appl.old_visa_no" type="text" value="" />
        <input id="country_visited" name="appl.country_visited" type="text" value="" />
        <input id="saarc_flag1" name="appl.saarc_flag" type="radio" value="Y" />
        <input id="saarc_flag2" name="appl.saarc_flag" type="radio" value="N" />
        <input id="nameofsponsor_ind" name="appl.nameofsponsor_ind" type="text" value="" />
        <input id="add1ofsponsor_ind" name="appl.add1ofsponsor_ind" type="text" value="" />
        <input id="phoneofsponsor_ind" name="appl.phoneofsponsor_ind" type="text" value="" />
        <input id="nameofsponsor_msn" name="appl.nameofsponsor_msn" type="text" value="" />
        <input id="add1ofsponsor_msn" name="appl.add1ofsponsor_msn" type="text" value="" />
        <input id="phoneofsponsor_msn" name="appl.phoneofsponsor_msn" type="text" value="" />
        <input id="refuse_flag1" name="appl.refuse_flag" type="radio" value="Y" />
        <input id="refuse_flag2" name="appl.refuse_flag" type="radio" value="N" />
      </body>
    </html>
  `)

  Object.assign(globalThis, {
    document: dom4.window.document,
    window: dom4.window,
    HTMLElement: dom4.window.HTMLElement,
    HTMLInputElement: dom4.window.HTMLInputElement,
    HTMLSelectElement: dom4.window.HTMLSelectElement,
    HTMLTextAreaElement: dom4.window.HTMLTextAreaElement,
  })

  const visaMappings = getIndiaVisaMappings(null, 'TRAVEL_DETAILS', 'indianvisa-bangladesh.nic.in')
  const visaAutofillRes = await executeAutofill({
    mappings: visaMappings,
    applicant: resolvedProfile,
    options: { policy: 'fill-empty' },
  })

  const vDuration = (dom4.window.document.getElementById('duration') as HTMLInputElement).value
  const vEntry = (dom4.window.document.getElementById('visa_entry_id') as HTMLSelectElement).value
  const vOldVisaNo = (dom4.window.document.getElementById('old_visa_no') as HTMLInputElement).value
  const vCountryVisited = (dom4.window.document.getElementById('country_visited') as HTMLInputElement).value
  const vSponsorInd = (dom4.window.document.getElementById('nameofsponsor_ind') as HTMLInputElement).value
  const vSponsorMsn = (dom4.window.document.getElementById('nameofsponsor_msn') as HTMLInputElement).value
  const vRefuseFlag1 = dom4.window.document.getElementById('refuse_flag1') as HTMLInputElement
  const vRefuseFlag2 = dom4.window.document.getElementById('refuse_flag2') as HTMLInputElement

  assert(
    visaAutofillRes.filledFields >= 8 &&
    vDuration === '12' &&
    vEntry === 'MULTIPLE' &&
    vOldVisaNo === 'VJ12345678' &&
    vCountryVisited === 'INDIA, MALAYSIA, SINGAPORE' &&
    vSponsorInd === 'RAJESH SHARMA' &&
    vSponsorMsn === 'KAMAL HOSSAIN',
    'K: Page 4 (Visa Details) autofills travel, history, and sponsor references'
  )
  assert(
    !vRefuseFlag1.checked && !vRefuseFlag2.checked,
    'K2: Page 4 (Visa Details) refusal disclosures remain manual and untouched'
  )

  // =========================================================================
  // STAGE L: Page 5 — Additional Questions Autofill
  // =========================================================================
  const dom5 = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <input id="question_yes_1" name="question_1_flag" type="radio" value="Y" />
        <input id="question_no_1" name="question_1_flag" type="radio" value="N" />
        <textarea id="answer_1" name="answer_1"></textarea>

        <input id="question_yes_2" name="question_2_flag" type="radio" value="Y" />
        <input id="question_no_2" name="question_2_flag" type="radio" value="N" />
        <textarea id="answer_2" name="answer_2"></textarea>

        <input id="question_yes_3" name="question_3_flag" type="radio" value="Y" />
        <input id="question_no_3" name="question_3_flag" type="radio" value="N" />
        <textarea id="answer_3" name="answer_3"></textarea>

        <input id="question_yes_4" name="question_4_flag" type="radio" value="Y" />
        <input id="question_no_4" name="question_4_flag" type="radio" value="N" />
        <textarea id="answer_4" name="answer_4"></textarea>

        <input id="question_yes_5" name="question_5_flag" type="radio" value="Y" />
        <input id="question_no_5" name="question_5_flag" type="radio" value="N" />
        <textarea id="answer_5" name="answer_5"></textarea>

        <input id="question_yes_6" name="question_6_flag" type="radio" value="Y" />
        <input id="question_no_6" name="question_6_flag" type="radio" value="N" />
        <textarea id="answer_6" name="answer_6"></textarea>

        <input id="verifyQuestions" name="verifyQuestions" type="checkbox" />
      </body>
    </html>
  `)

  Object.assign(globalThis, {
    document: dom5.window.document,
    window: dom5.window,
    HTMLElement: dom5.window.HTMLElement,
    HTMLInputElement: dom5.window.HTMLInputElement,
    HTMLSelectElement: dom5.window.HTMLSelectElement,
    HTMLTextAreaElement: dom5.window.HTMLTextAreaElement,
  })

  const qMappings = getIndiaVisaMappings(null, 'ADDITIONAL_QUESTIONS', 'indianvisa-bangladesh.nic.in')
  const qAutofillRes = await executeAutofill({
    mappings: qMappings,
    applicant: resolvedProfile,
    options: { policy: 'fill-empty' },
  })

  const q1No = dom5.window.document.getElementById('question_no_1') as HTMLInputElement
  const q2No = dom5.window.document.getElementById('question_no_2') as HTMLInputElement
  const q3No = dom5.window.document.getElementById('question_no_3') as HTMLInputElement
  const q4No = dom5.window.document.getElementById('question_no_4') as HTMLInputElement
  const q5No = dom5.window.document.getElementById('question_no_5') as HTMLInputElement
  const q6No = dom5.window.document.getElementById('question_no_6') as HTMLInputElement
  const declCheckbox = dom5.window.document.getElementById('verifyQuestions') as HTMLInputElement

  assert(
    qAutofillRes.filledFields >= 6 &&
    q1No.checked &&
    q2No.checked &&
    q3No.checked &&
    q4No.checked &&
    q5No.checked &&
    q6No.checked,
    'L: Page 5 (Additional Questions) autofills all 6 question groups correctly'
  )
  assert(
    declCheckbox.checked === false,
    'L2: Page 5 (Additional Questions) Declaration checkbox remains manual and unchecked'
  )

  // =========================================================================
  // STAGE M: Page 6 — Photo Page Behavior
  // =========================================================================
  const dom6 = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <input id="photo" name="photo" type="file" />
        <input type="submit" id="upload" value="Upload Photo" />
      </body>
    </html>
  `)

  Object.assign(globalThis, {
    document: dom6.window.document,
    window: dom6.window,
    HTMLElement: dom6.window.HTMLElement,
    HTMLInputElement: dom6.window.HTMLInputElement,
    HTMLSelectElement: dom6.window.HTMLSelectElement,
    HTMLTextAreaElement: dom6.window.HTMLTextAreaElement,
  })

  const photoMappings = getIndiaVisaMappings(null, 'DOCUMENT_UPLOAD', 'indianvisa-bangladesh.nic.in')
  const photoAutofillRes = await executeAutofill({
    mappings: photoMappings,
    applicant: resolvedProfile,
    options: { policy: 'fill-empty' },
  })

  assert(
    photoAutofillRes.filledFields === 0,
    'M: Page 6 (Photo Page) file input is never automated'
  )

  // =========================================================================
  // STAGE N: Security & Manual Field Protection across the system
  // =========================================================================
  const technicalIgnored = BANGLADESH_FIELD_REGISTRY.filter(
    (c) => c.eligibility === 'technical-ignored'
  )
  assert(
    technicalIgnored.length >= 4,
    'N1: Portal navigation buttons (Save & Continue, Exit, Submit) are technical-ignored'
  )

  const schemaNotices = BANGLADESH_APPLICATION_SCHEMA.flatMap((s) => s.manualNotices || [])
  assert(
    schemaNotices.some((n) => n.title.includes('CAPTCHA')) &&
    schemaNotices.some((n) => n.title.includes('Declaration')) &&
    schemaNotices.some((n) => n.title.includes('Portal Photo Chooser')),
    'N2: Application Workspace clearly notifies user of all manual security boundaries'
  )

  // =========================================================================
  // STAGE P & Q: Value Transformations & Select/Radio Field Handling
  // =========================================================================
  const { normalizeDateForControl } = await import('../../../core/autofill/dateNormalizer')
  const dateFormatted = normalizeDateForControl('1992-10-12', 'text', 'isoDateToDdMmYyyy')
  assert(
    dateFormatted === '12/10/1992',
    'P: Date transformation converts ISO YYYY-MM-DD to DD/MM/YYYY for text date inputs'
  )

  console.log(`--- COMPLETE END-TO-END WORKFLOW TESTS FINISHED: Passed=${failures.length === 0}, Subtests=${totalSubtests} ---`)

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
