import { JSDOM } from 'jsdom'
import { executeAutofill } from '../autofill/autofillEngine'
import { getIndiaVisaMappings } from '../../countries/india/mappingService'
import { BANGLADESH_BASIC_DETAILS_FIXTURE_HTML } from '../../countries/india/__tests__/fixtures'
import { convertSavedApplicationToApplicantProfile, populateApplicationFromDocuments } from '../application/applicationMerger'
import type { SavedApplication } from '../application/types'
import type { DocumentRecord } from '../document/types'

export interface TestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runTask090OtherPassportAutofillTests(): Promise<TestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  function assert(condition: boolean, msg: string) {
    totalSubtests++
    if (!condition) {
      failures.push(msg)
      console.error(`  ✗ FAIL: ${msg}`)
    } else {
      console.log(`  ✓ PASS: ${msg}`)
    }
  }

  console.log('--- TEST 1: Full Autofill of Other Passport Section with holdsOtherPassport = true ---')
  {
    const dom = new JSDOM(BANGLADESH_BASIC_DETAILS_FIXTURE_HTML, {
      url: 'https://indianvisa-bangladesh.nic.in/visa/BasicDetails',
      runScripts: 'outside-only',
    })
    Object.defineProperty(global, 'window', { value: dom.window, configurable: true, writable: true })
    Object.defineProperty(global, 'document', { value: dom.window.document, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLElement', { value: dom.window.HTMLElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLInputElement', { value: dom.window.HTMLInputElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLSelectElement', { value: dom.window.HTMLSelectElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLOptionElement', { value: dom.window.HTMLOptionElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLTextAreaElement', { value: dom.window.HTMLTextAreaElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLButtonElement', { value: dom.window.HTMLButtonElement, configurable: true, writable: true })
    Object.defineProperty(global, 'Event', { value: dom.window.Event, configurable: true, writable: true })
    Object.defineProperty(global, 'MouseEvent', { value: dom.window.MouseEvent, configurable: true, writable: true })

    const savedApp: SavedApplication = {
      applicationId: 'app_test_other_ppt',
      applicantId: 'appl_other_ppt_123',
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      status: 'ready_for_autofill',
      fields: {
        'appl.surname': { value: 'ISLAM', source: 'passport', isUserEdited: false },
        'appl.applname': { value: 'MD JUYEL', source: 'passport', isUserEdited: false },
        'appl.applsex': { value: 'MALE', source: 'passport', isUserEdited: false },
        'appl.birthdate': { value: '15/05/1990', source: 'passport', isUserEdited: false },
        'appl.placbrth': { value: 'DHAKA', source: 'passport', isUserEdited: false },
        'appl.country_of_birth': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.nic_no': { value: '1234567890', source: 'passport', isUserEdited: false },
        'appl.religion': { value: 'ISLAM', source: 'passport', isUserEdited: false },
        'appl.visual_mark': { value: 'NA', source: 'passport', isUserEdited: false },
        'appl.edu_id': { value: 'GRADUATE', source: 'passport', isUserEdited: false },
        'appl.nationality': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.nationality_by': { value: 'Birth', source: 'passport', isUserEdited: false },
        'appl.passport_number': { value: 'A01234567', source: 'passport', isUserEdited: false },
        'appl.passport_issue_place': { value: 'DHAKA', source: 'passport', isUserEdited: false },
        'appl.passport_issue_date': { value: '24/08/2021', source: 'passport', isUserEdited: false },
        'appl.passport_expiry_date': { value: '23/08/2031', source: 'passport', isUserEdited: false },
        // Other passport fields
        'appl.oth_ppt': { value: 'Yes', source: 'manual', isUserEdited: true },
        'appl.prev_passport_country_issue': { value: 'BANGLADESH', source: 'manual', isUserEdited: true },
        'appl.oth_pptno': { value: 'BE0240401', source: 'manual', isUserEdited: true },
        'appl.oth_ppt_issue_date': { value: '12/12/2012', source: 'manual', isUserEdited: true },
        'appl.oth_ppt_issue_place': { value: 'DHAKA', source: 'manual', isUserEdited: true },
        'appl.other_ppt_nationality': { value: 'BANGLADESH', source: 'manual', isUserEdited: true },
      },
      sourceDocuments: {},
      provenance: { lastSavedAt: '2026-09-15T00:00:00.000Z' },
      manualEdits: {
        'appl.oth_ppt': true,
        'appl.prev_passport_country_issue': true,
        'appl.oth_pptno': true,
        'appl.oth_ppt_issue_date': true,
        'appl.oth_ppt_issue_place': true,
        'appl.other_ppt_nationality': true,
      },
    }

    const profile = convertSavedApplicationToApplicantProfile(savedApp)

    assert(profile.passport?.holdsOtherPassport === true, 'Profile holdsOtherPassport is true')
    assert(profile.passport?.otherPassportDetails?.passportNumber === 'BE0240401', 'Other passport number converted accurately')
    assert(profile.passport?.otherPassportDetails?.countryOfIssue === 'BANGLADESH', 'Other passport country converted accurately')
    assert(profile.passport?.otherPassportDetails?.placeOfIssue === 'DHAKA', 'Other passport place of issue converted accurately')
    assert(profile.passport?.otherPassportDetails?.nationalityInPassport === 'BANGLADESH', 'Other passport nationality converted accurately')
    assert(profile.passport?.otherPassportDetails?.issueDate === '2012-12-12', 'Other passport issue date converted to ISO date in profile')

    const mappings = getIndiaVisaMappings('regular', 'BASIC_DETAILS')
    const autofillResult = await executeAutofill({
      mappings,
      applicant: profile,
      options: { policy: 'overwrite' },
    })

    if (!autofillResult.success) {
      console.error('Autofill field failures:', autofillResult.results.filter(r => r.status === 'failed'))
    }

    assert(autofillResult.success, 'Autofill execution reported success')

    // Verify DOM values
    const doc = dom.window.document
    const radioYes = doc.querySelector<HTMLInputElement>('#other_ppt_1')
    assert(Boolean(radioYes?.checked), 'Radio #other_ppt_1 (Yes) is checked in DOM')

    const countrySelect = doc.querySelector<HTMLSelectElement>('#other_ppt_country_issue')
    assert(countrySelect?.value === 'BGD', `Country of issue select is filled with BGD (matched BANGLADESH), actual: "${countrySelect?.value}"`)

    const pptNoInput = doc.querySelector<HTMLInputElement>('#other_ppt_no')
    assert(pptNoInput?.value === 'BE0240401', `Passport/IC number is filled with BE0240401, actual: "${pptNoInput?.value}"`)

    const dateInput = doc.querySelector<HTMLInputElement>('#other_ppt_issue_date')
    assert(dateInput?.value === '12/12/2012', `Date of issue is filled in DD/MM/YYYY format as "12/12/2012" (not backward YYYY-MM-DD), actual: "${dateInput?.value}"`)

    const placeInput = doc.querySelector<HTMLInputElement>('#other_ppt_issue_place')
    assert(placeInput?.value === 'DHAKA', `Place of issue is filled with DHAKA, actual: "${placeInput?.value}"`)

    const natSelect = doc.querySelector<HTMLSelectElement>('#other_ppt_nat')
    assert(natSelect?.value === 'BGD', `Nationality select is filled with BGD (matched BANGLADESH), actual: "${natSelect?.value}"`)
  }

  console.log('--- TEST 2: Autofill with holdsOtherPassport = false / "No" ---')
  {
    const dom = new JSDOM(BANGLADESH_BASIC_DETAILS_FIXTURE_HTML, {
      url: 'https://indianvisa-bangladesh.nic.in/visa/BasicDetails',
      runScripts: 'outside-only',
    })
    Object.defineProperty(global, 'window', { value: dom.window, configurable: true, writable: true })
    Object.defineProperty(global, 'document', { value: dom.window.document, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLElement', { value: dom.window.HTMLElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLInputElement', { value: dom.window.HTMLInputElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLSelectElement', { value: dom.window.HTMLSelectElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLOptionElement', { value: dom.window.HTMLOptionElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLTextAreaElement', { value: dom.window.HTMLTextAreaElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLButtonElement', { value: dom.window.HTMLButtonElement, configurable: true, writable: true })
    Object.defineProperty(global, 'Event', { value: dom.window.Event, configurable: true, writable: true })
    Object.defineProperty(global, 'MouseEvent', { value: dom.window.MouseEvent, configurable: true, writable: true })

    const savedApp: SavedApplication = {
      applicationId: 'app_test_no_other_ppt',
      applicantId: 'appl_other_ppt_456',
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      status: 'ready_for_autofill',
      fields: {
        'appl.surname': { value: 'RAHMAN', source: 'passport', isUserEdited: false },
        'appl.applname': { value: 'AMINUL', source: 'passport', isUserEdited: false },
        'appl.applsex': { value: 'MALE', source: 'passport', isUserEdited: false },
        'appl.birthdate': { value: '15/05/1990', source: 'passport', isUserEdited: false },
        'appl.placbrth': { value: 'DHAKA', source: 'passport', isUserEdited: false },
        'appl.country_of_birth': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.nic_no': { value: '1234567890', source: 'passport', isUserEdited: false },
        'appl.religion': { value: 'ISLAM', source: 'passport', isUserEdited: false },
        'appl.visual_mark': { value: 'NA', source: 'passport', isUserEdited: false },
        'appl.edu_id': { value: 'GRADUATE', source: 'passport', isUserEdited: false },
        'appl.nationality': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.nationality_by': { value: 'Birth', source: 'passport', isUserEdited: false },
        'appl.passport_number': { value: 'B98765432', source: 'passport', isUserEdited: false },
        'appl.passport_issue_place': { value: 'DHAKA', source: 'passport', isUserEdited: false },
        'appl.passport_issue_date': { value: '24/08/2021', source: 'passport', isUserEdited: false },
        'appl.passport_expiry_date': { value: '23/08/2031', source: 'passport', isUserEdited: false },
        'appl.oth_ppt': { value: 'No', source: 'passport', isUserEdited: false },
      },
      sourceDocuments: {},
      provenance: { lastSavedAt: '2026-09-15T00:00:00.000Z' },
      manualEdits: {},
    }

    const profile = convertSavedApplicationToApplicantProfile(savedApp)
    assert(profile.passport?.holdsOtherPassport === false, 'Profile holdsOtherPassport is false')

    const mappings = getIndiaVisaMappings('regular', 'BASIC_DETAILS')
    const autofillResult = await executeAutofill({
      mappings,
      applicant: profile,
      options: { policy: 'overwrite' },
    })

    assert(autofillResult.success, 'Autofill execution with holdsOtherPassport=No succeeded')

    const doc = dom.window.document
    const radioNo = doc.querySelector<HTMLInputElement>('#other_ppt_2')
    assert(Boolean(radioNo?.checked), 'Radio #other_ppt_2 (No) is checked in DOM')

    const pptNoInput = doc.querySelector<HTMLInputElement>('#other_ppt_no')
    assert(pptNoInput?.value === '', 'Other passport subfield remains blank when holdsOtherPassport is false')
  }

  console.log('--- TEST 3: populateApplicationFromDocuments preserves manual Other Passport edits ---')
  {
    const passportDoc: DocumentRecord = {
      documentId: 'doc_passport_sample',
      applicantId: 'appl_sample',
      documentType: 'passport',
      fileName: 'passport.pdf',
      fileSize: 1000,
      mimeType: 'application/pdf',
      status: 'processed',
      source: 'user-upload',
      extractedData: {
        personal: {
          lastName: { value: 'CHOWDHURY', source: 'mrz', confidence: 95 },
          firstName: { value: 'ANIS', source: 'mrz', confidence: 95 },
        },
        passport: {
          passportNumber: { value: 'EF1234567', source: 'mrz', confidence: 95 },
          placeOfIssue: { value: 'DHAKA', source: 'pdf-text', confidence: 90 },
        },
      },
      extractedDataConfirmed: true,
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
    }

    const existingApp: SavedApplication = {
      applicationId: 'app_existing_1',
      applicantId: 'appl_sample',
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      status: 'ready_for_autofill',
      fields: {
        'appl.passport_number': { value: 'EF1234567', source: 'passport', isUserEdited: false },
        'appl.oth_ppt': { value: 'Yes', source: 'manual', isUserEdited: true },
        'appl.oth_pptno': { value: 'BE0240401', source: 'manual', isUserEdited: true },
        'appl.oth_ppt_issue_date': { value: '12/12/2012', source: 'manual', isUserEdited: true },
        'appl.oth_ppt_issue_place': { value: 'DHAKA', source: 'manual', isUserEdited: true },
        'appl.prev_passport_country_issue': { value: 'BANGLADESH', source: 'manual', isUserEdited: true },
        'appl.other_ppt_nationality': { value: 'BANGLADESH', source: 'manual', isUserEdited: true },
      },
      sourceDocuments: {},
      provenance: { lastSavedAt: '2026-09-15T00:00:00.000Z' },
      manualEdits: {
        'appl.oth_ppt': true,
        'appl.oth_pptno': true,
        'appl.oth_ppt_issue_date': true,
        'appl.oth_ppt_issue_place': true,
        'appl.prev_passport_country_issue': true,
        'appl.other_ppt_nationality': true,
      },
    }

    const populated = populateApplicationFromDocuments({
      applicantId: 'appl_sample',
      passportDoc,
      existingApp,
    })

    assert(populated.fields['appl.oth_ppt']?.value === 'Yes', 'populated preserves appl.oth_ppt = Yes')
    assert(populated.fields['appl.oth_pptno']?.value === 'BE0240401', 'populated preserves appl.oth_pptno = BE0240401')
    assert(populated.fields['appl.oth_ppt_issue_date']?.value === '12/12/2012', 'populated preserves appl.oth_ppt_issue_date = 12/12/2012')
    assert(populated.fields['appl.oth_ppt_issue_place']?.value === 'DHAKA', 'populated preserves appl.oth_ppt_issue_place = DHAKA')
    assert(populated.fields['appl.prev_passport_country_issue']?.value === 'BANGLADESH', 'populated preserves prev_passport_country_issue = BANGLADESH')
    assert(populated.fields['appl.other_ppt_nationality']?.value === 'BANGLADESH', 'populated preserves other_ppt_nationality = BANGLADESH')
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
