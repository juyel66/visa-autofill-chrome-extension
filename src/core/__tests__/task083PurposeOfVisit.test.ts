import { JSDOM } from 'jsdom'
import {
  extractFromPdfText,
  extractFromRawText,
  cleanExtractedPurpose,
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

export async function runTask083PurposeOfVisitTests(): Promise<TestSuiteResult> {
  const failures: string[] = []
  let totalSubtests = 0

  function assert(condition: boolean, message: string) {
    totalSubtests++
    if (!condition) {
      failures.push(message)
    }
  }

  console.log('=== RUNNING TASK 083: PURPOSE OF VISIT TESTS ===')

  // =========================================================================
  // TEST 1 — Dynamic PDF Text Extraction (No Hardcoded Values)
  // =========================================================================
  {
    const sampleText1 = `
      GOVERNMENT OF INDIA
      VISA APPLICATION FORM
      SURNAME: AHMED
      GIVEN NAME: TANVIR
      PASSPORT NO: A01234567
      PURPOSE OF VISIT: ATTENDING ANNUAL TECH EXPO AND BUSINESS MEETINGS
      DURATION OF VISA: 12 MONTHS
      NO. OF ENTRIES: MULTIPLE
    `
    const extracted1 = extractFromPdfText(sampleText1)
    assert(
      extracted1.travel?.purposeOfVisit?.value === 'ATTENDING ANNUAL TECH EXPO AND BUSINESS MEETINGS',
      `Test 1.1: Purpose extracted dynamically (got "${extracted1.travel?.purposeOfVisit?.value}")`
    )

    const sampleText2 = `
      VISA APPLICATION
      NAME: RAHMAN / MD
      PASSPORT NUMBER: B98765432
      PURPOSE OF VISIT: UNDERGOING CARDIAC SURGERY AND MEDICAL CONSULTATION
      PLACES LIKELY TO BE VISITED: CHENNAI
    `
    const extracted2 = extractFromPdfText(sampleText2)
    assert(
      extracted2.travel?.purposeOfVisit?.value === 'UNDERGOING CARDIAC SURGERY AND MEDICAL CONSULTATION',
      `Test 1.2: Second purpose extracted dynamically (got "${extracted2.travel?.purposeOfVisit?.value}")`
    )
  }

  // =========================================================================
  // TEST 2 — OCR / Raw Text Clean Normalization & Boundary Truncation
  // =========================================================================
  {
    // Hyphenation across line breaks, extra spaces, and section boundary truncation
    const rawOcr = `
      DETAILS OF VISA SOUGHT
      Purpose of Visit :
      FOR TOURISM,
      RECREA-
      TION AND SIGHT-
      SEEING WITH FAMILY
      Duration of Visa (in Months) : 6
      No. of Entries : Multiple
    `
    const extracted = extractFromRawText(rawOcr, 'ocr', 80)
    assert(
      extracted.travel?.purposeOfVisit?.value === 'FOR TOURISM, RECREATION AND SIGHTSEEING WITH FAMILY',
      `Test 2.1: OCR text cleaned and hyphenation joined correctly (got "${extracted.travel?.purposeOfVisit?.value}")`
    )

    // Verify cleanExtractedPurpose standalone
    assert(
      cleanExtractedPurpose(': -  TOURISM AND RECREATION  - :') === 'TOURISM AND RECREATION',
      'Test 2.2: cleanExtractedPurpose strips punctuation noise'
    )
    assert(
      cleanExtractedPurpose('VISIT-\nING FRIENDS') === 'VISITING FRIENDS',
      'Test 2.3: cleanExtractedPurpose joins hyphenated line breaks'
    )
  }

  // =========================================================================
  // TEST 3 — Missing Purpose in Document
  // =========================================================================
  {
    const noPurposeText = `
      GOVERNMENT OF INDIA
      SURNAME: HOSSAIN
      GIVEN NAME: KAMAL
      PASSPORT NUMBER: C11223344
      NATIONALITY: BANGLADESHI
    `
    const extracted = extractFromPdfText(noPurposeText)
    assert(
      extracted.travel?.purposeOfVisit === undefined,
      'Test 3.1: Missing purpose in document leaves purposeOfVisit undefined'
    )
  }

  // =========================================================================
  // TEST 4 — Workspace & SavedApplication Hydration & Manual Editing
  // =========================================================================
  {
    const applicantId = 'applicant_task083_test_a'
    const passportDoc: DocumentRecord = {
      documentId: 'doc_pass_task083_a',
      applicantId,
      documentType: 'passport',
      fileName: 'application_form_a.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      fileDataUrl: 'data:application/pdf;base64,dummy',
      extractedDataConfirmed: true,
      extractedData: {
        personal: {
          lastName: { value: 'CHOWDHURY', source: 'pdf-text', confidence: 90 },
          firstName: { value: 'FARHAN', source: 'pdf-text', confidence: 90 },
        },
        passport: {
          passportNumber: { value: 'A55667788', source: 'pdf-text', confidence: 90 },
        },
        travel: {
          purposeOfVisit: { value: 'FOR TOURISM RECREATION AND SIGHTSEEING', source: 'pdf-text', confidence: 90 },
        },
      },
    }

    // A. Initial populate from document
    const savedApp = populateApplicationFromDocuments({
      applicantId,
      passportDoc,
    })

    assert(
      savedApp.fields['purpose']?.value === 'FOR TOURISM RECREATION AND SIGHTSEEING',
      `Test 4.1: SavedApplication purpose populated from document (got "${savedApp.fields['purpose']?.value}")`
    )
    assert(
      savedApp.fields['purpose']?.source === 'passport',
      `Test 4.2: SavedApplication purpose source is 'passport' (got "${savedApp.fields['purpose']?.source}")`
    )

    // B. Simulate User Manual Edit in Workspace
    const editedApp: SavedApplication = {
      ...savedApp,
      fields: {
        ...savedApp.fields,
        purpose: {
          value: 'BUSINESS MEETINGS AND TRADE DELEGATION',
          source: 'manual',
          isUserEdited: true,
          originalExtractedValue: 'FOR TOURISM RECREATION AND SIGHTSEEING',
        },
      },
      manualEdits: {
        ...savedApp.manualEdits,
        purpose: true,
      },
      updatedAt: new Date().toISOString(),
    }

    // C. Re-hydrate with manual edit preserved
    const rehydratedApp = populateApplicationFromDocuments({
      applicantId,
      passportDoc,
      existingApp: editedApp,
    })

    assert(
      rehydratedApp.fields['purpose']?.value === 'BUSINESS MEETINGS AND TRADE DELEGATION',
      `Test 4.3: Manual edit preserved across workspace reload (got "${rehydratedApp.fields['purpose']?.value}")`
    )
    assert(
      rehydratedApp.fields['purpose']?.source === 'manual',
      'Test 4.4: Manual edit source remains manual'
    )
    assert(
      rehydratedApp.manualEdits['purpose'] === true,
      'Test 4.5: manualEdits flag recorded for purpose'
    )

    // D. Profile Conversion for Autofill Candidate Resolver
    const profile = convertSavedApplicationToApplicantProfile(rehydratedApp)
    assert(
      profile.travel?.purposeOfVisit === 'BUSINESS MEETINGS AND TRADE DELEGATION',
      `Test 4.6: Profile conversion carries manual edit to travel.purposeOfVisit (got "${profile.travel?.purposeOfVisit}")`
    )
  }

  // =========================================================================
  // TEST 5 — Strict Applicant Isolation (Applicant A vs Applicant B)
  // =========================================================================
  {
    const applicantAId = 'applicant_isolate_a'
    const docA: DocumentRecord = {
      documentId: 'doc_isolate_a',
      applicantId: applicantAId,
      documentType: 'passport',
      fileName: 'applicant_a.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      fileDataUrl: 'data:application/pdf;base64,dummy',
      extractedDataConfirmed: true,
      extractedData: {
        personal: { lastName: { value: 'KHAN', source: 'pdf-text', confidence: 90 } },
        passport: { passportNumber: { value: 'A11111111', source: 'pdf-text', confidence: 90 } },
        travel: { purposeOfVisit: { value: 'TOURISM AND VACATION', source: 'pdf-text', confidence: 90 } },
      },
    }

    const applicantBId = 'applicant_isolate_b'
    const docB: DocumentRecord = {
      documentId: 'doc_isolate_b',
      applicantId: applicantBId,
      documentType: 'passport',
      fileName: 'applicant_b.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      fileDataUrl: 'data:application/pdf;base64,dummy',
      extractedDataConfirmed: true,
      extractedData: {
        personal: { lastName: { value: 'ALAM', source: 'pdf-text', confidence: 90 } },
        passport: { passportNumber: { value: 'B22222222', source: 'pdf-text', confidence: 90 } },
        travel: { purposeOfVisit: { value: 'MEDICAL TREATMENT AT APPOLLO', source: 'pdf-text', confidence: 90 } },
      },
    }

    const appA = populateApplicationFromDocuments({ applicantId: applicantAId, passportDoc: docA })
    const appB = populateApplicationFromDocuments({ applicantId: applicantBId, passportDoc: docB })

    assert(
      appA.fields['purpose']?.value === 'TOURISM AND VACATION',
      'Test 5.1: Applicant A receives Purpose A'
    )
    assert(
      appB.fields['purpose']?.value === 'MEDICAL TREATMENT AT APPOLLO',
      'Test 5.2: Applicant B receives Purpose B'
    )
    assert(
      appA.fields['purpose']?.value !== appB.fields['purpose']?.value,
      'Test 5.3: Applicant A and B purposes are completely isolated'
    )

    // Cross-profile check: Candidate Resolver rejects wrong document
    const candidateCross = resolveCandidateData({
      profileId: applicantAId,
      requestedDocumentId: docB.documentId,
      documents: [docA, docB],
    })
    assert(
      candidateCross.status === 'NOT_READY',
      'Test 5.4: Candidate resolver strictly rejects candidate data from another profile'
    )
  }

  // =========================================================================
  // TEST 6 — Registration Page Autofill & DOM Select Matching
  // =========================================================================
  {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://indianvisa-bangladesh.nic.in/visa/Registration',
    })
    const doc = dom.window.document
    Object.defineProperty(globalThis, 'document', { value: doc, configurable: true, writable: true })
    Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true, writable: true })
    Object.defineProperty(globalThis, 'HTMLElement', { value: dom.window.HTMLElement, configurable: true, writable: true })
    Object.defineProperty(globalThis, 'HTMLInputElement', { value: dom.window.HTMLInputElement, configurable: true, writable: true })
    Object.defineProperty(globalThis, 'HTMLSelectElement', { value: dom.window.HTMLSelectElement, configurable: true, writable: true })
    Object.defineProperty(globalThis, 'HTMLTextAreaElement', { value: dom.window.HTMLTextAreaElement, configurable: true, writable: true })
    Object.defineProperty(globalThis, 'HTMLButtonElement', { value: dom.window.HTMLButtonElement, configurable: true, writable: true })
    Object.defineProperty(globalThis, 'Event', { value: dom.window.Event, configurable: true, writable: true })

    doc.body.innerHTML = `
      <form id="visa_reg_form">
        <select id="countryname_id" name="appl.countryname">
          <option value="">Select Country</option>
          <option value="BGD">BANGLADESH</option>
        </select>
        <select id="missioncode_id" name="appl.missioncode">
          <option value="">Select Mission</option>
          <option value="01">BANGLADESH - DHAKA</option>
        </select>
        <select id="nationality_id" name="appl.nationality">
          <option value="">Select Nationality</option>
          <option value="BGD">BANGLADESH</option>
        </select>
        <input id="dob_id" name="appl.birthdate" type="text" />
        <input id="email_id" name="appl.email" type="text" />
        <input id="email_re_id" name="appl.email_re" type="text" />
        <input id="jouryney_id" name="appl.journeydate" type="text" />
        <select id="purpose_id" name="appl.purpose">
          <option value="">Select Purpose</option>
          <option value="TOURISM">FOR TOURISM / RECREATION</option>
          <option value="BUSINESS">BUSINESS</option>
          <option value="MEDICAL">MEDICAL</option>
          <option value="STUDENT">STUDENT</option>
          <option value="CONFERENCE">CONFERENCE</option>
          <option value="EMPLOYMENT">EMPLOYMENT</option>
        </select>
        <input id="captcha" name="captcha" type="text" />
      </form>
    `

    // Subtest 6.1: Semantic matching of long tourist purpose
    const purposeSelect = doc.getElementById('purpose_id') as HTMLSelectElement
    const matchTour = findMatchingSelectOption(purposeSelect, 'FOR TOURISM RECREATION, SIGHTSEEING, VISITING FRIENDS AND RELATIVES')
    assert(
      matchTour.option?.value === 'TOURISM',
      `Test 6.1: Semantic category mapping maps detailed tourist sentence to TOURISM (got "${matchTour.option?.value}")`
    )

    // Subtest 6.2: Semantic matching of conference purpose
    const matchConf = findMatchingSelectOption(purposeSelect, 'ATTENDING ACADEMIC CONFERENCE IN DELHI')
    assert(
      matchConf.option?.value === 'CONFERENCE',
      `Test 6.2: Semantic mapping maps conference text to CONFERENCE (got "${matchConf.option?.value}")`
    )

    // Subtest 6.3: Full Registration Autofill execution
    const savedAppForAutofill: SavedApplication = {
      applicationId: 'app_task083_autofill',
      applicantId: 'applicant_autofill_1',
      status: 'ready_for_autofill',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provenance: {
        lastSavedAt: new Date().toISOString(),
      },
      sourceDocuments: {},
      fields: {
        'appl.countryname': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.missioncode': { value: 'BANGLADESH - DHAKA', source: 'passport', isUserEdited: false },
        'appl.nationality': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.birthdate': { value: '1992-08-20', source: 'passport', isUserEdited: false },
        'appl.email': { value: 'tanvir.ahmed@example.com', source: 'passport', isUserEdited: false },
        'appl.email_re': { value: 'tanvir.ahmed@example.com', source: 'passport', isUserEdited: false },
        'appl.journeydate': { value: '2026-11-15', source: 'passport', isUserEdited: false },
        'purpose': { value: 'FOR TOURISM RECREATION AND SIGHTSEEING', source: 'passport', isUserEdited: false },
      },
      manualEdits: {},
    }

    const candidateRes = resolveCandidateData({
      profileId: 'applicant_autofill_1',
      documents: [],
      savedApplication: savedAppForAutofill,
    })

    assert(candidateRes.status === 'READY', 'Test 6.3: Candidate resolver returns READY with SavedApplication')

    const autofillRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candidateRes.applicant!,
    })

    assert(autofillRes.filledFields === 8, `Test 6.4: Registration autofill filled all 8 automated fields (got ${autofillRes.filledFields})`)
    assert(autofillRes.failedFields === 1, `Test 6.4b: Expected 1 manual required field (CAPTCHA), got ${autofillRes.failedFields}`)

    // Verify all 7 automated fields + purpose are filled
    const purposeFieldRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_visiting_purpose')
    assert(
      purposeFieldRes?.status === 'filled',
      `Test 6.5: bd_reg_visiting_purpose status is filled (got "${purposeFieldRes?.status}")`
    )
    assert(
      purposeSelect.value === 'TOURISM',
      `Test 6.6: DOM select value is set to TOURISM (got "${purposeSelect.value}")`
    )

    // Verify security boundaries: CAPTCHA is manual
    const captchaFieldRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_captcha')
    assert(
      captchaFieldRes?.failureType === 'manual-required',
      'Test 6.7: CAPTCHA failureType is marked manual-required'
    )
    const captchaInput = doc.getElementById('captcha') as HTMLInputElement
    assert(captchaInput.value === '', 'Test 6.8: CAPTCHA DOM input remains untouched')
  }

  const passed = failures.length === 0
  console.log(`=== TASK 083 TESTS FINISHED (Passed: ${passed}, Count: ${totalSubtests}) ===`)
  if (!passed) {
    console.error('Task 083 Failures:', failures)
  }

  return {
    passed,
    totalSubtests,
    failures,
  }
}
