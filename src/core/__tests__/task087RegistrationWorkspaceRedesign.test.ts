import { JSDOM } from 'jsdom'
import { WORKSPACE_SECTIONS, BANGLADESH_APPLICATION_SCHEMA } from '../application/fieldSchema'
import {
  PORTAL_COUNTRY_OPTIONS,
  PORTAL_MISSION_OPTIONS,
  PORTAL_NATIONALITY_OPTIONS,
  PORTAL_PURPOSE_OF_VISIT_OPTIONS,
  getMissionOptionsForCountry,
} from '../../countries/india/options/registrationOptions'
import type { SavedApplication } from '../application/types'
import { populateApplicationFromDocuments } from '../application/applicationMerger'
import { resolveCandidateData } from '../autofill/candidateResolver'
import { executeAutofill } from '../autofill/autofillEngine'
import { BANGLADESH_REGISTRATION_MAPPINGS } from '../../countries/india/mappings/bangladesh/registration'
import { saveApplication, getSavedApplicationByApplicantId } from '../application/applicationStorage'
import type { DocumentRecord } from '../document/types'

export interface TestSuiteResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runTask087RegistrationWorkspaceRedesignTests(): Promise<TestSuiteResult> {
  const failures: string[] = []
  let totalSubtests = 0

  function assert(condition: boolean, message: string) {
    totalSubtests++
    if (!condition) {
      failures.push(message)
    }
  }

  console.log('=== RUNNING TASK 087: APPLICATION WORKSPACE REGISTRATION PAGE REDESIGN TESTS ===')

  // =========================================================================
  // TEST 1: WORKSPACE SECTIONS STRUCTURE & REGISTRATION PLACEMENT
  // =========================================================================
  {
    assert(WORKSPACE_SECTIONS.length === 11, `Workspace must have exactly 11 sections (got ${WORKSPACE_SECTIONS.length})`)

    const regSec = WORKSPACE_SECTIONS[0]
    assert(regSec.id === 'registration', `Section 1 ID must be 'registration' (got '${regSec.id}')`)
    assert(regSec.title === '1. Registration', `Section 1 Title must be '1. Registration' (got '${regSec.title}')`)

    const personalSec = WORKSPACE_SECTIONS[1]
    assert(personalSec.id === 'personalDetails', `Section 2 ID must be 'personalDetails' (got '${personalSec.id}')`)
    assert(personalSec.title === '2. Personal Details', `Section 2 Title must be '2. Personal Details' (got '${personalSec.title}')`)

    const photoSec = WORKSPACE_SECTIONS[10]
    assert(photoSec.id === 'photoUpload', `Section 11 ID must be 'photoUpload' (got '${photoSec.id}')`)
    assert(photoSec.title === '11. Photo Section', `Section 11 Title must be '11. Photo Section' (got '${photoSec.title}')`)
  }

  // =========================================================================
  // TEST 2: REGISTRATION FIELD ORDER & CANONICAL KEYS
  // =========================================================================
  {
    const regSec = WORKSPACE_SECTIONS.find((s) => s.id === 'registration')!
    const expectedKeys = [
      'appl.countryname',
      'appl.missioncode',
      'appl.nationality',
      'appl.birthdate',
      'appl.email',
      'appl.email_re',
      'appl.journeydate',
      'purpose',
    ]

    assert(
      JSON.stringify(regSec.fieldKeys) === JSON.stringify(expectedKeys),
      `Registration field order must match portal exact order: ${expectedKeys.join(', ')}`
    )

    const schemaReg = BANGLADESH_APPLICATION_SCHEMA.find((s) => s.id === 'registration')!
    assert(schemaReg.fields.length === 7, `Schema registration section defines 7 canonical fields (got ${schemaReg.fields.length})`)
    const schemaFieldKeys = schemaReg.fields.map((f) => f.key)
    assert(
      schemaFieldKeys.includes('appl.countryname') &&
      schemaFieldKeys.includes('appl.missioncode') &&
      schemaFieldKeys.includes('appl.nationality') &&
      schemaFieldKeys.includes('appl.birthdate') &&
      schemaFieldKeys.includes('appl.email') &&
      schemaFieldKeys.includes('appl.email_re') &&
      schemaFieldKeys.includes('appl.journeydate'),
      'Schema registration fields contain all canonical registration keys'
    )
  }

  // =========================================================================
  // TEST 3: COMPLETE PORTAL DROPDOWN OPTION LISTS VALIDATION
  // =========================================================================
  {
    // Countries: complete set
    assert(PORTAL_COUNTRY_OPTIONS.length >= 190, `PORTAL_COUNTRY_OPTIONS must contain >= 190 countries (got ${PORTAL_COUNTRY_OPTIONS.length})`)
    assert(PORTAL_COUNTRY_OPTIONS.some((c) => c.value === 'BANGLADESH'), 'PORTAL_COUNTRY_OPTIONS must include BANGLADESH')
    assert(PORTAL_COUNTRY_OPTIONS.some((c) => c.value === 'INDIA'), 'PORTAL_COUNTRY_OPTIONS must include INDIA')
    assert(PORTAL_COUNTRY_OPTIONS.some((c) => c.value === 'UNITED STATES OF AMERICA'), 'PORTAL_COUNTRY_OPTIONS must include USA')

    // Missions: Bangladesh missions + worldwide
    assert(PORTAL_MISSION_OPTIONS.some((m) => m.value === 'BANGLADESH-RAJSHAHI'), 'Must include BANGLADESH-RAJSHAHI')
    assert(PORTAL_MISSION_OPTIONS.some((m) => m.value === 'BANGLADESH-DHAKA'), 'Must include BANGLADESH-DHAKA')
    assert(PORTAL_MISSION_OPTIONS.some((m) => m.value === 'BANGLADESH-CHITTAGONG'), 'Must include BANGLADESH-CHITTAGONG')
    assert(PORTAL_MISSION_OPTIONS.some((m) => m.value === 'BANGLADESH-SYLHET'), 'Must include BANGLADESH-SYLHET')
    assert(PORTAL_MISSION_OPTIONS.some((m) => m.value === 'BANGLADESH-KHULNA'), 'Must include BANGLADESH-KHULNA')
    assert(PORTAL_MISSION_OPTIONS.some((m) => m.value === 'USA-WASHINGTON'), 'Must include USA-WASHINGTON')
    assert(PORTAL_MISSION_OPTIONS.some((m) => m.value === 'UK-LONDON'), 'Must include UK-LONDON')

    const bdMissions = getMissionOptionsForCountry('BANGLADESH')
    assert(bdMissions[0].value.startsWith('BANGLADESH-'), 'getMissionOptionsForCountry prioritizes Bangladesh missions')

    // Nationalities: complete set
    assert(PORTAL_NATIONALITY_OPTIONS.length >= 190, `PORTAL_NATIONALITY_OPTIONS must contain >= 190 nationalities (got ${PORTAL_NATIONALITY_OPTIONS.length})`)
    assert(PORTAL_NATIONALITY_OPTIONS.some((n) => n.value === 'BANGLADESH'), 'Must include BANGLADESH nationality')
    assert(PORTAL_NATIONALITY_OPTIONS.some((n) => n.value === 'UNITED STATES OF AMERICA'), 'Must include USA nationality')

    // Purpose of Visit / Visiting India For
    assert(PORTAL_PURPOSE_OF_VISIT_OPTIONS.some((p) => p.value === 'TOURISM'), 'Must include TOURISM purpose')
    assert(PORTAL_PURPOSE_OF_VISIT_OPTIONS.some((p) => p.value === 'BUSINESS'), 'Must include BUSINESS purpose')
    assert(PORTAL_PURPOSE_OF_VISIT_OPTIONS.some((p) => p.value === 'MED_SELF'), 'Must include MED_SELF purpose')
    assert(PORTAL_PURPOSE_OF_VISIT_OPTIONS.some((p) => p.value === 'CONFERENCE'), 'Must include CONFERENCE purpose')
    assert(PORTAL_PURPOSE_OF_VISIT_OPTIONS.some((p) => p.value === 'EMPLOYMENT'), 'Must include EMPLOYMENT purpose')
  }

  // =========================================================================
  // TEST 4: DYNAMIC MULTI-APPLICANT ISOLATION (ZERO HARDCODED APPLICANT VALUES)
  // =========================================================================
  {
    // Applicant A (Bangladesh profile)
    const docA: DocumentRecord = {
      documentId: 'doc_appl_a_087',
      applicantId: 'APPLICANT_A_087',
      documentType: 'passport',
      fileName: 'applicant_a_passport.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      extractedDataConfirmed: true,
      extractedData: {
        personal: {
          lastName: { value: 'RAHMAN', source: 'pdf-text', confidence: 0.98 },
          firstName: { value: 'MD TARIQ', source: 'pdf-text', confidence: 0.98 },
          dateOfBirth: { value: '1985-04-20', source: 'pdf-text', confidence: 0.98 },
          nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.98 },
        },
        passport: {
          passportNumber: { value: 'A12345678', source: 'pdf-text', confidence: 0.98 },
          issuingCountry: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.98 },
        },
        contact: {
          email: { value: 'tariq.rahman@example.com', source: 'pdf-text', confidence: 0.95 },
        },
        presentAddress: {
          country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.98 },
        },
        travel: {
          intendedArrivalDate: { value: '2026-11-15', source: 'pdf-text', confidence: 0.95 },
          purposeOfVisit: { value: 'TOURISM', source: 'pdf-text', confidence: 0.95 },
        },
      },
    }

    const appA = populateApplicationFromDocuments({
      applicantId: 'APPLICANT_A_087',
      passportDoc: docA,
    })

    assert(appA.fields['appl.countryname']?.value === 'BANGLADESH', 'Applicant A country is BANGLADESH')
    assert(appA.fields['appl.missioncode']?.value === 'BANGLADESH-RAJSHAHI', 'Applicant A mission is default BANGLADESH-RAJSHAHI')
    assert(appA.fields['appl.nationality']?.value === 'BANGLADESH', 'Applicant A nationality is BANGLADESH')
    assert(appA.fields['appl.birthdate']?.value === '20/04/1985', `Applicant A birthdate is 20/04/1985 (got ${appA.fields['appl.birthdate']?.value})`)
    assert(appA.fields['appl.email']?.value === 'tariq.rahman@example.com', 'Applicant A email is tariq.rahman@example.com')
    assert(appA.fields['appl.journeydate']?.value === '15/11/2026', `Applicant A arrival date is 15/11/2026 (got ${appA.fields['appl.journeydate']?.value})`)
    assert(appA.fields['purpose']?.value === 'TOURISM', 'Applicant A purpose is TOURISM')

    // Applicant B (USA profile)
    const docB: DocumentRecord = {
      documentId: 'doc_appl_b_087',
      applicantId: 'APPLICANT_B_087',
      documentType: 'passport',
      fileName: 'applicant_b_passport.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      extractedDataConfirmed: true,
      extractedData: {
        personal: {
          lastName: { value: 'SMITH', source: 'pdf-text', confidence: 0.98 },
          firstName: { value: 'EMILY JANE', source: 'pdf-text', confidence: 0.98 },
          dateOfBirth: { value: '1992-09-10', source: 'pdf-text', confidence: 0.98 },
          nationality: { value: 'UNITED STATES OF AMERICA', source: 'pdf-text', confidence: 0.98 },
        },
        passport: {
          passportNumber: { value: 'US98765432', source: 'pdf-text', confidence: 0.98 },
          issuingCountry: { value: 'UNITED STATES OF AMERICA', source: 'pdf-text', confidence: 0.98 },
        },
        contact: {
          email: { value: 'emily.smith@example.com', source: 'pdf-text', confidence: 0.95 },
        },
        presentAddress: {
          country: { value: 'UNITED STATES OF AMERICA', source: 'pdf-text', confidence: 0.98 },
        },
        travel: {
          intendedArrivalDate: { value: '2027-02-01', source: 'pdf-text', confidence: 0.95 },
          purposeOfVisit: { value: 'BUSINESS', source: 'pdf-text', confidence: 0.95 },
        },
      },
    }

    const appB = populateApplicationFromDocuments({
      applicantId: 'APPLICANT_B_087',
      passportDoc: docB,
      notes: 'Indian Mission: USA-NEW YORK',
    })

    assert(appB.fields['appl.countryname']?.value === 'UNITED STATES OF AMERICA', 'Applicant B country is USA')
    assert(appB.fields['appl.missioncode']?.value === 'USA-NEW YORK', 'Applicant B mission is USA-NEW YORK')
    assert(appB.fields['appl.nationality']?.value === 'UNITED STATES OF AMERICA', 'Applicant B nationality is USA')
    assert(appB.fields['appl.birthdate']?.value === '10/09/1992', `Applicant B birthdate is 10/09/1992 (got ${appB.fields['appl.birthdate']?.value})`)
    assert(appB.fields['appl.email']?.value === 'emily.smith@example.com', 'Applicant B email is emily.smith@example.com')
    assert(appB.fields['appl.journeydate']?.value === '01/02/2027', `Applicant B arrival date is 01/02/2027 (got ${appB.fields['appl.journeydate']?.value})`)
    assert(appB.fields['purpose']?.value === 'BUSINESS', 'Applicant B purpose is BUSINESS')
  }

  // =========================================================================
  // TEST 5: MANUAL EDITING, SOURCE BADGE & PERSISTENCE TEST
  // =========================================================================
  {
    const baseApp: SavedApplication = {
      applicationId: 'app_edit_test_087',
      applicantId: 'APPL_EDIT_087',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ready_for_autofill',
      fields: {
        'appl.countryname': { value: 'BANGLADESH', source: 'passport', isUserEdited: false, originalExtractedValue: 'BANGLADESH' },
        'appl.missioncode': { value: 'BANGLADESH-RAJSHAHI', source: 'derived', isUserEdited: false, originalExtractedValue: 'BANGLADESH-RAJSHAHI' },
        'appl.nationality': { value: 'BANGLADESH', source: 'passport', isUserEdited: false, originalExtractedValue: 'BANGLADESH' },
        'appl.birthdate': { value: '15/05/1990', source: 'passport', isUserEdited: false, originalExtractedValue: '15/05/1990' },
        'appl.email': { value: 'orig@example.com', source: 'passport', isUserEdited: false, originalExtractedValue: 'orig@example.com' },
        'appl.email_re': { value: 'orig@example.com', source: 'passport', isUserEdited: false, originalExtractedValue: 'orig@example.com' },
        'appl.journeydate': { value: '01/10/2026', source: 'passport', isUserEdited: false, originalExtractedValue: '01/10/2026' },
        'purpose': { value: 'TOURISM', source: 'passport', isUserEdited: false, originalExtractedValue: 'TOURISM' },
      },
      manualEdits: {},
      provenance: { lastSavedAt: new Date().toISOString() },
      sourceDocuments: {},
    }

    // User manual edits
    const editedApp: SavedApplication = {
      ...baseApp,
      fields: {
        ...baseApp.fields,
        'appl.missioncode': { value: 'BANGLADESH-DHAKA', source: 'manual', isUserEdited: true, originalExtractedValue: 'BANGLADESH-RAJSHAHI' },
        'appl.email': { value: 'edited.user@example.com', source: 'manual', isUserEdited: true, originalExtractedValue: 'orig@example.com' },
        'appl.email_re': { value: 'edited.user@example.com', source: 'manual', isUserEdited: true, originalExtractedValue: 'orig@example.com' },
        'purpose': { value: 'MED_SELF', source: 'manual', isUserEdited: true, originalExtractedValue: 'TOURISM' },
      },
      manualEdits: {
        'appl.missioncode': true,
        'appl.email': true,
        'appl.email_re': true,
        'purpose': true,
      },
    }

    await saveApplication(editedApp)
    const reloaded = await getSavedApplicationByApplicantId('APPL_EDIT_087')

    assert(reloaded !== null, 'Reloaded application from storage is not null')
    assert(reloaded?.fields['appl.missioncode']?.value === 'BANGLADESH-DHAKA', 'Edited mission BANGLADESH-DHAKA persisted')
    assert(reloaded?.fields['appl.missioncode']?.source === 'manual', 'Edited mission source is manual')
    assert(reloaded?.fields['appl.missioncode']?.isUserEdited === true, 'Edited mission isUserEdited is true')
    assert(reloaded?.fields['appl.email']?.value === 'edited.user@example.com', 'Edited email persisted')
    assert(reloaded?.fields['purpose']?.value === 'MED_SELF', 'Edited purpose MED_SELF persisted')
  }

  // =========================================================================
  // TEST 6: AUTOFILL CONSUMES EDITED REGISTRATION WORKSPACE DATA
  // =========================================================================
  {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <select id="countryname_id" name="appl.countryname">
            <option value="">Select Country</option>
            <option value="BANGLADESH">BANGLADESH</option>
          </select>
          <select id="missioncode_id" name="appl.missioncode">
            <option value="">Select Mission</option>
            <option value="BANGLADESH-DHAKA">BANGLADESH - DHAKA</option>
            <option value="BANGLADESH-RAJSHAHI">BANGLADESH - RAJSHAHI</option>
          </select>
          <select id="nationality_id" name="appl.nationality">
            <option value="">Select Nationality</option>
            <option value="BANGLADESH">BANGLADESH</option>
          </select>
          <input type="text" id="dob_id" name="appl.birthdate" />
          <input type="text" id="email_id" name="appl.email" />
          <input type="text" id="email_re_id" name="appl.email_re" />
          <input type="text" id="jouryney_id" name="appl.journeydate" />
          <select id="purpose_id" name="appl.purpose">
            <option value="">Select Purpose</option>
            <option value="TOURISM">TOURISM / RECREATION</option>
            <option value="MED_SELF">FOR MEDICAL TREATMENT OF SELF</option>
          </select>
          <input type="text" id="captcha" name="captcha" />
        </body>
      </html>
    `
    const dom = new JSDOM(html)
    globalThis.document = dom.window.document
    globalThis.HTMLElement = dom.window.HTMLElement
    globalThis.HTMLSelectElement = dom.window.HTMLSelectElement
    globalThis.HTMLInputElement = dom.window.HTMLInputElement
    globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement
    globalThis.HTMLButtonElement = dom.window.HTMLButtonElement
    globalThis.HTMLOptionElement = dom.window.HTMLOptionElement
    globalThis.Event = dom.window.Event

    const savedApp: SavedApplication = {
      applicationId: 'app_autofill_test_087',
      applicantId: 'APPL_AUTO_087',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ready_for_autofill',
      fields: {
        'appl.countryname': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.missioncode': { value: 'BANGLADESH-DHAKA', source: 'manual', isUserEdited: true },
        'appl.nationality': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.birthdate': { value: '15/05/1990', source: 'passport', isUserEdited: false },
        'appl.email': { value: 'edited.user@example.com', source: 'manual', isUserEdited: true },
        'appl.email_re': { value: 'edited.user@example.com', source: 'manual', isUserEdited: true },
        'appl.journeydate': { value: '01/10/2026', source: 'passport', isUserEdited: false },
        'purpose': { value: 'MED_SELF', source: 'manual', isUserEdited: true },
      },
      manualEdits: {
        'appl.missioncode': true,
        'appl.email': true,
        'purpose': true,
      },
      provenance: { lastSavedAt: new Date().toISOString() },
      sourceDocuments: {},
    }

    const candRes = resolveCandidateData({
      profileId: 'APPL_AUTO_087',
      documents: [],
      savedApplication: savedApp,
    })

    assert(candRes.status === 'READY' && Boolean(candRes.applicant), 'Candidate resolved as READY')

    const autofillRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
      options: { policy: 'overwrite' },
    })

    const missionSelect = dom.window.document.getElementById('missioncode_id') as HTMLSelectElement
    const emailInput = dom.window.document.getElementById('email_id') as HTMLInputElement
    const purposeSelect = dom.window.document.getElementById('purpose_id') as HTMLSelectElement

    assert(missionSelect.value === 'BANGLADESH-DHAKA', `Autofill filled user-edited mission: ${missionSelect.value}`)
    assert(emailInput.value === 'edited.user@example.com', `Autofill filled user-edited email: ${emailInput.value}`)
    assert(purposeSelect.value === 'MED_SELF', `Autofill filled user-edited purpose: ${purposeSelect.value}`)
    assert(autofillRes.filledFields === 8, `Autofill successfully filled 8 registration fields (got ${autofillRes.filledFields})`)
  }

  // =========================================================================
  // TEST 7: NO CAPTCHA AND NO PORTAL BUTTONS IN WORKSPACE REGISTRATION SCHEMA
  // =========================================================================
  {
    const regSec = WORKSPACE_SECTIONS.find((s) => s.id === 'registration')!
    assert(!regSec.fieldKeys.includes('captcha'), 'Registration fieldKeys must NOT contain captcha')
    assert(!regSec.fieldKeys.includes('continue'), 'Registration fieldKeys must NOT contain continue')
    assert(!regSec.fieldKeys.includes('submit'), 'Registration fieldKeys must NOT contain submit')
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
