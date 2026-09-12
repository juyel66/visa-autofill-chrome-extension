import { JSDOM } from 'jsdom'
import {
  extractFromPdfText,
  extractFromRawText,
} from '../extraction/data/applicantDataExtractor'
import {
  populateApplicationFromDocuments,
  convertSavedApplicationToApplicantProfile,
} from '../application/applicationMerger'
import type { DocumentRecord } from '../document/types'
import type { SavedApplication } from '../application/types'
import { BANGLADESH_REGISTRATION_MAPPINGS } from '../../countries/india/mappings/bangladesh/registration'
import { executeAutofill } from '../autofill/autofillEngine'
import { resolveCandidateData } from '../autofill/candidateResolver'
import { findMatchingSelectOption } from '../autofill/selectResolver'

export interface TestSuiteResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runTask084PurposeDebugTests(): Promise<TestSuiteResult> {
  const failures: string[] = []
  let totalSubtests = 0

  function assert(condition: boolean, message: string) {
    totalSubtests++
    if (!condition) {
      failures.push(message)
    }
  }

  console.log('=== RUNNING TASK 084: PURPOSE OF VISIT END-TO-END DEBUG TESTS ===')

  // =========================================================================
  // TEST 1 — Dynamic PDF & Raw Text Extraction with Robust Pattern Matching
  // =========================================================================
  {
    // 1.1: Document with "Visiting India for :" and same-line next field
    const doc1 = `
      ONLINE VISA APPLICATION
      NAME: HOSSAIN / MD
      PASSPORT NUMBER: A12345678
      VISITING INDIA FOR: ATTENDING BIOTECH SYMPOSIUM AND SCIENTIFIC WORKSHOP   DURATION OF VISA: 6 MONTHS
      NO. OF ENTRIES: SINGLE
    `
    const ext1 = extractFromPdfText(doc1)
    assert(
      ext1.travel?.purposeOfVisit?.value === 'ATTENDING BIOTECH SYMPOSIUM AND SCIENTIFIC WORKSHOP',
      `Test 1.1: Visiting India for extracted and bounded before Duration (got "${ext1.travel?.purposeOfVisit?.value}")`
    )

    // 1.2: Document with "Purpose :" format
    const doc2 = `
      GOVERNMENT OF INDIA
      VISA FORM
      SURNAME: MIAH
      GIVEN NAME: ROKIB
      PURPOSE: UNDERGOING CORNEA REPLACEMENT SURGERY
      PLACES LIKELY TO BE VISITED: HYDERABAD
    `
    const ext2 = extractFromPdfText(doc2)
    assert(
      ext2.travel?.purposeOfVisit?.value === 'UNDERGOING CORNEA REPLACEMENT SURGERY',
      `Test 1.2: Purpose format extracted correctly (got "${ext2.travel?.purposeOfVisit?.value}")`
    )

    // 1.3: Document with only "Type of Visa :" (fallback)
    const doc3 = `
      DETAILS OF VISA SOUGHT
      Type of Visa : BUSINESS VISA
      Duration of Visa : 12
    `
    const ext3 = extractFromRawText(doc3, 'ocr', 80)
    assert(
      ext3.travel?.purposeOfVisit?.value === 'BUSINESS VISA',
      `Test 1.3: Visa Type fallback used when explicit purpose omitted (got "${ext3.travel?.purposeOfVisit?.value}")`
    )
  }

  // =========================================================================
  // TEST 2 — Multi-Option Semantic Disambiguation & Relevance Ranking
  // =========================================================================
  {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
      <body>
        <select id="purpose_dropdown" name="appl.purpose">
          <option value="">Select Purpose</option>
          <option value="TOURIST_IND">INDIVIDUAL TOURIST</option>
          <option value="TOURIST_SIGHTSEEING">SIGHTSEEING / RECREATION / HOLIDAY</option>
          <option value="TOURIST_FRIENDS">MEETING FRIENDS/RELATIVES</option>
          <option value="BUSINESS_GENERAL">BUSINESS - ATTENDING MEETINGS</option>
          <option value="BUSINESS_EXPO">BUSINESS - PARTICIPATION IN TRADE FAIRS</option>
          <option value="MED_SELF">FOR MEDICAL TREATMENT OF SELF</option>
          <option value="MED_ATTENDANT">ACCOMPANYING MEDICAL PATIENT</option>
        </select>
      </body>
      </html>
    `)
    const select = dom.window.document.getElementById('purpose_dropdown') as HTMLSelectElement

    // 2.1: Sightseeing / recreation sentence matches the more specific SIGHTSEEING option
    const matchSight = findMatchingSelectOption(select, 'FOR TOURISM, RECREATION AND SIGHTSEEING WITH FAMILY')
    assert(
      matchSight.option?.value === 'TOURIST_SIGHTSEEING',
      `Test 2.1: Scored disambiguation matched SIGHTSEEING option (got "${matchSight.option?.value}")`
    )

    // 2.2: Trade expo sentence matches trade fairs option
    const matchTrade = findMatchingSelectOption(select, 'PARTICIPATING IN INTERNATIONAL TRADE FAIR AND EXPO')
    assert(
      matchTrade.option?.value === 'BUSINESS_EXPO',
      `Test 2.2: Scored disambiguation matched BUSINESS_EXPO option (got "${matchTrade.option?.value}")`
    )

    // 2.3: Patient medical treatment matches MED_SELF option over MED_ATTENDANT
    const matchMed = findMatchingSelectOption(select, 'UNDERGOING CARDIAC SURGERY AND MEDICAL TREATMENT')
    assert(
      matchMed.option?.value === 'MED_SELF',
      `Test 2.3: Scored disambiguation matched MED_SELF option (got "${matchMed.option?.value}")`
    )

    // 2.4: Attendant text matches MED_ATTENDANT option
    const matchAtt = findMatchingSelectOption(select, 'ATTENDANT ACCOMPANYING SICK PARENT')
    assert(
      matchAtt.option?.value === 'MED_ATTENDANT',
      `Test 2.4: Scored disambiguation matched MED_ATTENDANT option (got "${matchAtt.option?.value}")`
    )
  }

  // =========================================================================
  // TEST 3 — Application Workspace & SavedApplication Persistence
  // =========================================================================
  {
    const applicantId = 'appl_task084_persistence'
    const doc: DocumentRecord = {
      documentId: 'doc_task084_1',
      applicantId,
      documentType: 'passport',
      fileName: 'visa_app.pdf',
      mimeType: 'application/pdf',
      fileSize: 2048,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      extractedDataConfirmed: true,
      extractedData: {
        personal: { lastName: { value: 'CHOWDHURY', source: 'pdf-text', confidence: 90 } },
        passport: { passportNumber: { value: 'A99887766', source: 'pdf-text', confidence: 90 } },
        travel: {
          purposeOfVisit: { value: 'FOR TOURISM AND RECREATION', source: 'pdf-text', confidence: 90 },
          intendedArrivalDate: { value: '2026-10-25', source: 'pdf-text', confidence: 90 },
        },
      },
    }

    // A. Populate from document
    const savedApp = populateApplicationFromDocuments({
      applicantId,
      passportDoc: doc,
    })

    assert(
      savedApp.fields['purpose']?.value === 'FOR TOURISM AND RECREATION',
      `Test 3.1: SavedApplication purpose initialized from document (got "${savedApp.fields['purpose']?.value}")`
    )

    // B. Manual Edit in Workspace
    const editedApp: SavedApplication = {
      ...savedApp,
      fields: {
        ...savedApp.fields,
        purpose: {
          value: 'ATTENDING TECH SUMMIT 2026',
          source: 'manual',
          isUserEdited: true,
          originalExtractedValue: 'FOR TOURISM AND RECREATION',
        },
      },
      manualEdits: {
        ...savedApp.manualEdits,
        purpose: true,
      },
      updatedAt: new Date().toISOString(),
    }

    // C. Re-hydrate across workspace saves
    const rehydrated = populateApplicationFromDocuments({
      applicantId,
      passportDoc: doc,
      existingApp: editedApp,
    })

    assert(
      rehydrated.fields['purpose']?.value === 'ATTENDING TECH SUMMIT 2026',
      `Test 3.2: User edit preserved across re-hydration (got "${rehydrated.fields['purpose']?.value}")`
    )
    assert(
      rehydrated.fields['purpose']?.source === 'manual',
      'Test 3.3: Field source remains manual'
    )

    // D. Profile Conversion for Candidate Resolver
    const profile = convertSavedApplicationToApplicantProfile(rehydrated)
    assert(
      profile.travel?.purposeOfVisit === 'ATTENDING TECH SUMMIT 2026',
      `Test 3.4: ApplicantProfile has manual purpose (got "${profile.travel?.purposeOfVisit}")`
    )
  }

  // =========================================================================
  // TEST 4 — Applicant Isolation Test (Applicant A vs Applicant B)
  // =========================================================================
  {
    const applicantAId = 'applicant_iso_a'
    const docA: DocumentRecord = {
      documentId: 'doc_iso_a',
      applicantId: applicantAId,
      documentType: 'passport',
      fileName: 'doc_a.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      extractedDataConfirmed: true,
      extractedData: {
        personal: { lastName: { value: 'ISLAM', source: 'pdf-text', confidence: 90 } },
        passport: { passportNumber: { value: 'A00011122', source: 'pdf-text', confidence: 90 } },
        travel: { purposeOfVisit: { value: 'TOURISM AND SIGHTSEEING', source: 'pdf-text', confidence: 90 } },
      },
    }

    const applicantBId = 'applicant_iso_b'
    const docB: DocumentRecord = {
      documentId: 'doc_iso_b',
      applicantId: applicantBId,
      documentType: 'passport',
      fileName: 'doc_b.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      extractedDataConfirmed: true,
      extractedData: {
        personal: { lastName: { value: 'KABIR', source: 'pdf-text', confidence: 90 } },
        passport: { passportNumber: { value: 'B33344455', source: 'pdf-text', confidence: 90 } },
        travel: { purposeOfVisit: { value: 'CONSULTING ON SOFTWARE ARCHITECTURE', source: 'pdf-text', confidence: 90 } },
      },
    }

    const appA = populateApplicationFromDocuments({ applicantId: applicantAId, passportDoc: docA })
    const appB = populateApplicationFromDocuments({ applicantId: applicantBId, passportDoc: docB })

    assert(
      appA.fields['purpose']?.value === 'TOURISM AND SIGHTSEEING',
      'Test 4.1: Applicant A has Purpose A'
    )
    assert(
      appB.fields['purpose']?.value === 'CONSULTING ON SOFTWARE ARCHITECTURE',
      'Test 4.2: Applicant B has Purpose B'
    )
    assert(
      appA.fields['purpose']?.value !== appB.fields['purpose']?.value,
      'Test 4.3: Applicant A and B are completely isolated'
    )
  }

  // =========================================================================
  // TEST 5 — Full Registration Page DOM Autofill Execution & Status Reporting
  // =========================================================================
  {
    const fixtureHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Registration</title></head>
      <body>
        <form id="registration_form">
          <select id="countryname_id" name="appl.countryname">
            <option value="">Select Country...</option>
            <option value="BANGLADESH">BANGLADESH</option>
          </select>
          <select id="missioncode_id" name="appl.missioncode">
            <option value="">Select Mission...</option>
            <option value="BD01">BANGLADESH - DHAKA</option>
          </select>
          <select id="nationality_id" name="appl.nationality">
            <option value="">Select Nationality...</option>
            <option value="BANGLADESH">BANGLADESH</option>
          </select>
          <input type="text" id="dob_id" name="appl.birthdate" value="" />
          <input type="text" id="email_id" name="appl.email" value="" />
          <input type="text" id="email_re_id" name="appl.email_re" value="" />
          <input type="text" id="jouryney_id" name="appl.journeydate" value="" />
          <select id="purpose_id" name="appl.purpose">
            <option value="">Select Purpose</option>
            <option value="TOURISM">FOR TOURISM / RECREATION</option>
            <option value="BUSINESS">BUSINESS</option>
            <option value="MEDICAL">MEDICAL</option>
            <option value="STUDENT">STUDENT</option>
          </select>
          <input type="text" id="captcha" name="captcha" value="" />
        </form>
      </body>
      </html>
    `
    const dom = new JSDOM(fixtureHtml)
    ;(global as unknown as { document: Document }).document = dom.window.document
    ;(global as unknown as { window: Window }).window = dom.window as unknown as Window
    ;(global as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement = dom.window.HTMLElement
    ;(global as unknown as { HTMLSelectElement: typeof HTMLSelectElement }).HTMLSelectElement = dom.window.HTMLSelectElement
    ;(global as unknown as { HTMLInputElement: typeof HTMLInputElement }).HTMLInputElement = dom.window.HTMLInputElement
    ;(global as unknown as { HTMLTextAreaElement: typeof HTMLTextAreaElement }).HTMLTextAreaElement = dom.window.HTMLTextAreaElement
    ;(global as unknown as { HTMLButtonElement: typeof HTMLButtonElement }).HTMLButtonElement = dom.window.HTMLButtonElement

    const savedApp: SavedApplication = {
      applicationId: 'app_task084_e2e',
      applicantId: 'applicant_e2e_1',
      status: 'ready_for_autofill',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provenance: { lastSavedAt: new Date().toISOString() },
      sourceDocuments: {},
      fields: {
        'appl.countryname': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.missioncode': { value: 'BANGLADESH - DHAKA', source: 'passport', isUserEdited: false },
        'appl.nationality': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.birthdate': { value: '1990-05-14', source: 'passport', isUserEdited: false },
        'appl.email': { value: 'md.juyel@example.com', source: 'passport', isUserEdited: false },
        'appl.email_re': { value: 'md.juyel@example.com', source: 'passport', isUserEdited: false },
        'appl.journeydate': { value: '2026-11-20', source: 'passport', isUserEdited: false },
        'purpose': { value: 'FOR TOURISM, RECREATION AND SIGHTSEEING WITH FAMILY', source: 'passport', isUserEdited: false },
      },
      manualEdits: {},
    }

    const candRes = resolveCandidateData({
      profileId: 'applicant_e2e_1',
      documents: [],
      savedApplication: savedApp,
    })

    assert(candRes.status === 'READY', 'Test 5.1: Candidate data status is READY')

    const autofillRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
    })

    assert(autofillRes.filledFields === 8, `Test 5.2: 8 automated fields filled successfully (got ${autofillRes.filledFields})`)
    assert(autofillRes.failedFields === 1, `Test 5.3: Exactly 1 manual control failed/requires manual action (CAPTCHA) (got ${autofillRes.failedFields})`)

    const purposeRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_visiting_purpose')
    assert(
      purposeRes?.status === 'filled',
      `Test 5.4: bd_reg_visiting_purpose status is filled (got "${purposeRes?.status}")`
    )

    const purposeSelect = dom.window.document.getElementById('purpose_id') as HTMLSelectElement
    assert(
      purposeSelect.value === 'TOURISM',
      `Test 5.5: DOM select value verified as TOURISM (got "${purposeSelect.value}")`
    )

    const captchaRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_captcha')
    assert(
      captchaRes?.failureType === 'manual-required',
      'Test 5.6: CAPTCHA is strictly manual-required'
    )
  }

  // =========================================================================
  // TEST 6 — Missing Purpose vs Unmappable Purpose Result Statuses
  // =========================================================================
  {
    const fixtureHtml = `
      <!DOCTYPE html>
      <html><body>
        <form>
          <select id="countryname_id" name="appl.countryname"><option value="BANGLADESH">BANGLADESH</option></select>
          <select id="missioncode_id" name="appl.missioncode"><option value="BD01">DHAKA</option></select>
          <select id="nationality_id" name="appl.nationality"><option value="BANGLADESH">BANGLADESH</option></select>
          <input type="text" id="dob_id" name="appl.birthdate" value="" />
          <input type="text" id="email_id" name="appl.email" value="" />
          <input type="text" id="email_re_id" name="appl.email_re" value="" />
          <input type="text" id="jouryney_id" name="appl.journeydate" value="" />
          <select id="purpose_id" name="appl.purpose">
            <option value="">Select Purpose</option>
            <option value="TOURISM">TOURIST VISA</option>
          </select>
          <input type="text" id="captcha" name="captcha" value="" />
        </form>
      </body></html>
    `
    const dom = new JSDOM(fixtureHtml)
    ;(global as unknown as { document: Document }).document = dom.window.document
    ;(global as unknown as { window: Window }).window = dom.window as unknown as Window
    ;(global as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement = dom.window.HTMLElement
    ;(global as unknown as { HTMLSelectElement: typeof HTMLSelectElement }).HTMLSelectElement = dom.window.HTMLSelectElement
    ;(global as unknown as { HTMLInputElement: typeof HTMLInputElement }).HTMLInputElement = dom.window.HTMLInputElement
    ;(global as unknown as { HTMLTextAreaElement: typeof HTMLTextAreaElement }).HTMLTextAreaElement = dom.window.HTMLTextAreaElement
    ;(global as unknown as { HTMLButtonElement: typeof HTMLButtonElement }).HTMLButtonElement = dom.window.HTMLButtonElement

    // Case A: Missing purpose in SavedApplication
    const missingApp: SavedApplication = {
      applicationId: 'app_missing_purpose',
      applicantId: 'applicant_missing_1',
      status: 'ready_for_autofill',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provenance: { lastSavedAt: new Date().toISOString() },
      sourceDocuments: {},
      fields: {
        'appl.countryname': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.missioncode': { value: 'BANGLADESH - DHAKA', source: 'passport', isUserEdited: false },
        'appl.nationality': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.birthdate': { value: '1990-05-14', source: 'passport', isUserEdited: false },
        'appl.email': { value: 'md.juyel@example.com', source: 'passport', isUserEdited: false },
        'appl.email_re': { value: 'md.juyel@example.com', source: 'passport', isUserEdited: false },
        'appl.journeydate': { value: '2026-11-20', source: 'passport', isUserEdited: false },
        // purpose omitted
      },
      manualEdits: {},
    }

    const candMissing = resolveCandidateData({
      profileId: 'applicant_missing_1',
      documents: [],
      savedApplication: missingApp,
    })

    const resMissing = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candMissing.applicant!,
    })

    const missingPurposeField = resMissing.results.find((r) => r.fieldId === 'bd_reg_visiting_purpose')
    assert(
      missingPurposeField?.status === 'skipped',
      `Test 6.1: Missing purpose correctly reports status: skipped (got "${missingPurposeField?.status}")`
    )
    assert(
      missingPurposeField?.failureType === 'source-data-missing',
      `Test 6.2: Missing purpose correctly reports failureType: source-data-missing (got "${missingPurposeField?.failureType}")`
    )
  }

  console.log(`Task 084 test suite finished with ${failures.length} failures out of ${totalSubtests} assertions.`)

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
