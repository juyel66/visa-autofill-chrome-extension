import { JSDOM } from 'jsdom'
import { executeAutofill } from '../autofill/autofillEngine'
import { BANGLADESH_REGISTRATION_MAPPINGS } from '../../countries/india/mappings/bangladesh/registration'
import { resolveCandidateData } from '../autofill/candidateResolver'
import { verifyDomValue } from '../autofill/domVerifier'
import type { ApplicationFieldSource, SavedApplication } from '../application/types'

export interface TestSuiteResult {
  suiteName: string
  totalTests: number
  passedTests: number
  failedTests: number
  errors: string[]
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

function createSavedApp(
  applicantId: string,
  fieldsMap: Record<string, { value: string | boolean; source?: ApplicationFieldSource; isUserEdited?: boolean }>
): SavedApplication {
  const fields: SavedApplication['fields'] = {}
  for (const [k, v] of Object.entries(fieldsMap)) {
    fields[k] = {
      value: v.value,
      source: v.source || 'passport',
      isUserEdited: v.isUserEdited ?? false,
    }
  }

  return {
    applicationId: `app_${applicantId}`,
    applicantId,
    createdAt: '2026-09-13T10:00:00.000Z',
    updatedAt: '2026-09-13T10:00:00.000Z',
    status: 'draft',
    fields,
    provenance: {
      lastSavedAt: '2026-09-13T10:00:00.000Z',
    },
    sourceDocuments: {},
    manualEdits: {},
  }
}

export async function runTask086FirstClickRegistrationDefinitiveTests(): Promise<TestSuiteResult> {
  const result: TestSuiteResult = {
    suiteName: 'Task 086: Definitive Fix — Visiting India for Must Fill on First Click',
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    errors: [],
  }

  const runTest = async (name: string, fn: () => Promise<void> | void) => {
    result.totalTests++
    try {
      await fn()
      result.passedTests++
      console.log(`  ✓ PASS: ${name}`)
    } catch (err: unknown) {
      result.failedTests++
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${name}: ${msg}`)
      console.error(`  ✗ FAIL: ${name}:`, msg)
    }
  }

  console.log('=== RUNNING TASK 086: DEFINITIVE FIRST-CLICK REGISTRATION AUTOFILL TESTS ===')

  // TEST 1 — Single-Click Full Autofill with Delayed AJAX Purpose Options (300ms delay)
  await runTest('Test 1: Single-click fills ALL 8 registration fields including delayed Purpose', async () => {
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
            <option value="BANGLADESH-CHITTAGONG">BANGLADESH - CHITTAGONG</option>
          </select>
          <select id="nationality_id" name="appl.nationality">
            <option value="">Select Nationality</option>
            <option value="BANGLADESH">BANGLADESH</option>
          </select>
          <input type="text" id="dob_id" name="appl.birthdate" />
          <input type="text" id="email_id" name="appl.email" />
          <input type="text" id="email_re_id" name="appl.email_re" />
          <input type="text" id="jouryney_id" name="appl.journeydate" />
          <!-- Purpose starts with ONLY placeholder (simulating portal AJAX loading) -->
          <select id="purpose_id" name="appl.purpose">
            <option value="">Select Purpose</option>
          </select>
          <input type="text" id="captcha" name="captcha" />
        </body>
      </html>
    `
    const dom = new JSDOM(html, { runScripts: 'dangerously' })
    globalThis.document = dom.window.document
    globalThis.HTMLElement = dom.window.HTMLElement
    globalThis.HTMLSelectElement = dom.window.HTMLSelectElement
    globalThis.HTMLInputElement = dom.window.HTMLInputElement
    globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement
    globalThis.HTMLButtonElement = dom.window.HTMLButtonElement
    globalThis.HTMLOptionElement = dom.window.HTMLOptionElement
    globalThis.Event = dom.window.Event

    const savedApp = createSavedApp('prof_t086_01', {
      'appl.countryname': { value: 'BANGLADESH' },
      'appl.missioncode': { value: 'BANGLADESH-DHAKA' },
      'appl.nationality': { value: 'BANGLADESH' },
      'appl.birthdate': { value: '1990-05-15' },
      'appl.email': { value: 'john.doe@example.com' },
      'appl.journeydate': { value: '2026-10-01' },
      'purpose': { value: 'FOR TOURISM, RECREATION AND SIGHTSEEING WITH FAMILY' },
    })

    const candRes = resolveCandidateData({
      profileId: 'prof_t086_01',
      documents: [],
      savedApplication: savedApp,
    })

    assert(candRes.status === 'READY' && Boolean(candRes.applicant), 'Candidate resolved as READY')

    // Simulate portal AJAX: 200ms after Autofill initiates, options arrive in #purpose_id
    setTimeout(() => {
      const purposeSel = dom.window.document.getElementById('purpose_id') as HTMLSelectElement
      if (purposeSel) {
        const optTourism = dom.window.document.createElement('option')
        optTourism.value = 'TOURISM'
        optTourism.text = 'INDIVIDUAL TOURIST / RECREATION'

        const optMedical = dom.window.document.createElement('option')
        optMedical.value = 'MED_SELF'
        optMedical.text = 'FOR MEDICAL TREATMENT OF SELF'

        const optBusiness = dom.window.document.createElement('option')
        optBusiness.value = 'BUSINESS'
        optBusiness.text = 'BUSINESS VISIT'

        purposeSel.appendChild(optTourism)
        purposeSel.appendChild(optMedical)
        purposeSel.appendChild(optBusiness)
      }
    }, 200)

    // Execute ONE Autofill click
    const autofillRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
      options: { policy: 'fill-empty' },
    })

    // Check all fields
    const countryRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_country')
    const missionRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_indian_mission')
    const natRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_nationality')
    const dobRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_dob')
    const emailRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_email')
    const emailConfRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_email_confirm')
    const journeyRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_expected_arrival')
    const purposeRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_visiting_purpose')
    const captchaRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_captcha')

    assert(countryRes?.status === 'filled', `Country filled (got ${countryRes?.status})`)
    assert(missionRes?.status === 'filled', `Mission filled (got ${missionRes?.status})`)
    assert(natRes?.status === 'filled', `Nationality filled (got ${natRes?.status})`)
    assert(dobRes?.status === 'filled', `DOB filled (got ${dobRes?.status})`)
    assert(emailRes?.status === 'filled', `Email filled (got ${emailRes?.status})`)
    assert(emailConfRes?.status === 'filled', `Confirm Email filled (got ${emailConfRes?.status})`)
    assert(journeyRes?.status === 'filled', `Journey Date filled (got ${journeyRes?.status})`)
    assert(purposeRes?.status === 'filled', `Visiting India for filled on first click (got ${purposeRes?.status})`)
    assert(captchaRes?.failureType === 'manual-required', 'CAPTCHA is manual-required')

    const purposeSelect = dom.window.document.getElementById('purpose_id') as HTMLSelectElement
    assert(purposeSelect.value === 'TOURISM', `DOM value is TOURISM (got "${purposeSelect.value}")`)
    assert(purposeSelect.selectedIndex > 0, 'selectedIndex > 0')
    assert(autofillRes.filledFields === 8, `Total filled fields is 8 (got ${autofillRes.filledFields})`)
  })

  // TEST 2 — Purpose Dropdown Initially Disabled During Portal AJAX
  await runTest('Test 2: Purpose dropdown initially disabled during AJAX becomes enabled and fills', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <select id="countryname_id" name="appl.countryname"><option value="BANGLADESH">BANGLADESH</option></select>
          <select id="missioncode_id" name="appl.missioncode"><option value="BANGLADESH-DHAKA">BANGLADESH - DHAKA</option></select>
          <select id="nationality_id" name="appl.nationality"><option value="BANGLADESH">BANGLADESH</option></select>
          <input type="text" id="dob_id" name="appl.birthdate" />
          <input type="text" id="email_id" name="appl.email" />
          <input type="text" id="email_re_id" name="appl.email_re" />
          <input type="text" id="jouryney_id" name="appl.journeydate" />
          <!-- Purpose starts DISABLED and empty -->
          <select id="purpose_id" name="appl.purpose" disabled>
            <option value="">Select Purpose</option>
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

    const savedApp = createSavedApp('prof_t086_02', {
      'appl.countryname': { value: 'BANGLADESH' },
      'appl.missioncode': { value: 'BANGLADESH-DHAKA' },
      'appl.nationality': { value: 'BANGLADESH' },
      'appl.birthdate': { value: '1985-11-20' },
      'appl.email': { value: 'traveler@gmail.com' },
      'appl.journeydate': { value: '2026-11-15' },
      'purpose': { value: 'BUSINESS VISA FOR ATTENDING TRADE EXHIBITION' },
    })

    const candRes = resolveCandidateData({
      profileId: 'prof_t086_02',
      documents: [],
      savedApplication: savedApp,
    })

    // Simulate portal enabling the select and adding options at 250ms
    setTimeout(() => {
      const purposeSel = dom.window.document.getElementById('purpose_id') as HTMLSelectElement
      if (purposeSel) {
        purposeSel.disabled = false
        const optBiz = dom.window.document.createElement('option')
        optBiz.value = 'BUSINESS'
        optBiz.text = 'BUSINESS VISA'
        purposeSel.appendChild(optBiz)
      }
    }, 250)

    const autofillRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
      options: { policy: 'fill-empty' },
    })

    const purposeRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_visiting_purpose')
    assert(purposeRes?.status === 'filled', `Purpose filled after becoming enabled (got ${purposeRes?.status})`)

    const purposeSelect = dom.window.document.getElementById('purpose_id') as HTMLSelectElement
    assert(purposeSelect.value === 'BUSINESS', `DOM select value is BUSINESS (got "${purposeSelect.value}")`)
  })

  // TEST 3 — Purpose Dropdown DOM Node Replaced by Portal Script During Option Rebuild
  await runTest('Test 3: Purpose dropdown dynamically replaced in DOM is resolved and filled in single click', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <select id="countryname_id" name="appl.countryname"><option value="BANGLADESH">BANGLADESH</option></select>
          <select id="missioncode_id" name="appl.missioncode"><option value="BANGLADESH-DHAKA">BANGLADESH - DHAKA</option></select>
          <select id="nationality_id" name="appl.nationality"><option value="BANGLADESH">BANGLADESH</option></select>
          <input type="text" id="dob_id" name="appl.birthdate" />
          <input type="text" id="email_id" name="appl.email" />
          <input type="text" id="email_re_id" name="appl.email_re" />
          <input type="text" id="jouryney_id" name="appl.journeydate" />
          <div id="purpose_container">
            <select id="purpose_id" name="appl.purpose">
              <option value="">Select Purpose</option>
            </select>
          </div>
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

    const savedApp = createSavedApp('prof_t086_03', {
      'appl.countryname': { value: 'BANGLADESH' },
      'appl.missioncode': { value: 'BANGLADESH-DHAKA' },
      'appl.nationality': { value: 'BANGLADESH' },
      'appl.birthdate': { value: '1992-03-10' },
      'appl.email': { value: 'patient@health.org' },
      'appl.journeydate': { value: '2026-12-01' },
      'purpose': { value: 'FOR MEDICAL TREATMENT OF SELF' },
    })

    const candRes = resolveCandidateData({
      profileId: 'prof_t086_03',
      documents: [],
      savedApplication: savedApp,
    })

    // Simulate portal script replacing the innerHTML of #purpose_container at 150ms
    setTimeout(() => {
      const container = dom.window.document.getElementById('purpose_container')
      if (container) {
        container.innerHTML = `
          <select id="purpose_id" name="appl.purpose">
            <option value="">Select Purpose</option>
            <option value="TOURISM">TOURISM</option>
            <option value="MED_SELF">FOR MEDICAL TREATMENT OF SELF</option>
          </select>
        `
      }
    }, 150)

    const autofillRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
      options: { policy: 'fill-empty' },
    })

    const purposeRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_visiting_purpose')
    assert(purposeRes?.status === 'filled', `Purpose filled on re-rendered DOM element (got ${purposeRes?.status})`)

    const currentPurposeEl = dom.window.document.getElementById('purpose_id') as HTMLSelectElement
    assert(currentPurposeEl.value === 'MED_SELF', `Fresh DOM select value is MED_SELF (got "${currentPurposeEl.value}")`)
  })

  // TEST 4 — Strict DOM Post-Fill Verification (No False Verification on Placeholder)
  await runTest('Test 4: Strict DOM verification rejects placeholder options', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <select id="purpose_id" name="appl.purpose">
            <option value="">Select Purpose</option>
            <option value="TOURISM">FOR TOURISM</option>
          </select>
        </body>
      </html>
    `
    const dom = new JSDOM(html)
    globalThis.document = dom.window.document
    globalThis.HTMLElement = dom.window.HTMLElement
    globalThis.HTMLSelectElement = dom.window.HTMLSelectElement
    globalThis.HTMLOptionElement = dom.window.HTMLOptionElement
    const select = dom.window.document.getElementById('purpose_id') as HTMLSelectElement

    // Initial state: selectedIndex is 0 ("Select Purpose")
    const mapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_visiting_purpose')!
    const verifyPlaceholder = verifyDomValue(select, mapping, 'TOURISM')
    assert(verifyPlaceholder.verified === false, 'Placeholder is NOT verified as matching')

    // After setting valid option
    select.value = 'TOURISM'
    select.selectedIndex = 1
    const verifyFilled = verifyDomValue(select, mapping, 'TOURISM')
    assert(verifyFilled.verified === true, 'Valid selected option IS verified')
  })

  // TEST 5 — Missing Purpose in SavedApplication Returns 'skipped'
  await runTest('Test 5: Missing purpose in SavedApplication returns skipped with source-data-missing', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <select id="countryname_id" name="appl.countryname"><option value="BANGLADESH">BANGLADESH</option></select>
          <select id="missioncode_id" name="appl.missioncode"><option value="BANGLADESH-DHAKA">BANGLADESH - DHAKA</option></select>
          <select id="nationality_id" name="appl.nationality"><option value="BANGLADESH">BANGLADESH</option></select>
          <input type="text" id="dob_id" name="appl.birthdate" />
          <input type="text" id="email_id" name="appl.email" />
          <input type="text" id="email_re_id" name="appl.email_re" />
          <input type="text" id="jouryney_id" name="appl.journeydate" />
          <select id="purpose_id" name="appl.purpose">
            <option value="">Select Purpose</option>
            <option value="TOURISM">FOR TOURISM</option>
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

    const savedApp = createSavedApp('prof_t086_05', {
      'appl.countryname': { value: 'BANGLADESH' },
      'appl.missioncode': { value: 'BANGLADESH-DHAKA' },
      'appl.nationality': { value: 'BANGLADESH' },
      'appl.birthdate': { value: '1990-01-01' },
      'appl.email': { value: 'test@example.com' },
      'appl.journeydate': { value: '2026-11-01' },
      // purpose intentionally missing
    })

    const candRes = resolveCandidateData({
      profileId: 'prof_t086_05',
      documents: [],
      savedApplication: savedApp,
    })

    const autofillRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
      options: { policy: 'fill-empty' },
    })

    const purposeRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_visiting_purpose')
    assert(purposeRes?.status === 'skipped', `Missing purpose status is skipped (got ${purposeRes?.status})`)
    assert(purposeRes?.failureType === 'source-data-missing', `Failure type is source-data-missing (got ${purposeRes?.failureType})`)
  })

  // TEST 6 — Options Unavailable / Timeout Returns 'failed' with 'option-not-found'
  await runTest('Test 6: Options unavailable / unmatched returns failed with option-not-found (never false skipped)', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <select id="countryname_id" name="appl.countryname"><option value="BANGLADESH">BANGLADESH</option></select>
          <select id="missioncode_id" name="appl.missioncode"><option value="BANGLADESH-DHAKA">BANGLADESH - DHAKA</option></select>
          <select id="nationality_id" name="appl.nationality"><option value="BANGLADESH">BANGLADESH</option></select>
          <input type="text" id="dob_id" name="appl.birthdate" />
          <input type="text" id="email_id" name="appl.email" />
          <input type="text" id="email_re_id" name="appl.email_re" />
          <input type="text" id="jouryney_id" name="appl.journeydate" />
          <select id="purpose_id" name="appl.purpose">
            <option value="">Select Purpose</option>
            <option value="TOURISM">FOR TOURISM</option>
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

    const savedApp = createSavedApp('prof_t086_06', {
      'appl.countryname': { value: 'BANGLADESH' },
      'appl.missioncode': { value: 'BANGLADESH-DHAKA' },
      'appl.nationality': { value: 'BANGLADESH' },
      'appl.birthdate': { value: '1990-01-01' },
      'appl.email': { value: 'test@example.com' },
      'appl.journeydate': { value: '2026-11-01' },
      'purpose': { value: 'UNKNOWN NON-EXISTENT SPECIAL CATEGORY PURPOSE' },
    })

    const candRes = resolveCandidateData({
      profileId: 'prof_t086_06',
      documents: [],
      savedApplication: savedApp,
    })

    const autofillRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
      options: { policy: 'fill-empty' },
    })

    const purposeRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_visiting_purpose')
    assert(purposeRes?.status === 'failed', `Unmatched purpose status is failed (got ${purposeRes?.status})`)
    assert(purposeRes?.failureType === 'option-not-found', `Failure type is option-not-found (got ${purposeRes?.failureType})`)
  })

  // TEST 7 — Repeated Autofill Idempotency
  await runTest('Test 7: Repeated autofill execution is idempotent and preserves correct values', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <select id="countryname_id" name="appl.countryname"><option value="">Select Country</option><option value="BANGLADESH">BANGLADESH</option></select>
          <select id="missioncode_id" name="appl.missioncode"><option value="">Select Mission</option><option value="BANGLADESH-DHAKA">BANGLADESH - DHAKA</option></select>
          <select id="nationality_id" name="appl.nationality"><option value="">Select Nationality</option><option value="BANGLADESH">BANGLADESH</option></select>
          <input type="text" id="dob_id" name="appl.birthdate" />
          <input type="text" id="email_id" name="appl.email" />
          <input type="text" id="email_re_id" name="appl.email_re" />
          <input type="text" id="jouryney_id" name="appl.journeydate" />
          <select id="purpose_id" name="appl.purpose">
            <option value="">Select Purpose</option>
            <option value="TOURISM">FOR TOURISM</option>
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

    const savedApp = createSavedApp('prof_t086_07', {
      'appl.countryname': { value: 'BANGLADESH' },
      'appl.missioncode': { value: 'BANGLADESH-DHAKA' },
      'appl.nationality': { value: 'BANGLADESH' },
      'appl.birthdate': { value: '1995-07-22' },
      'appl.email': { value: 'repetition@test.org' },
      'appl.journeydate': { value: '2026-11-20' },
      'purpose': { value: 'FOR TOURISM AND SIGHTSEEING' },
    })

    const candRes = resolveCandidateData({
      profileId: 'prof_t086_07',
      documents: [],
      savedApplication: savedApp,
    })

    // First click
    const res1 = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
      options: { policy: 'fill-empty' },
    })
    assert(res1.filledFields === 8, `Pass 1 fills 8 fields (got ${res1.filledFields})`)

    const purposeSel = dom.window.document.getElementById('purpose_id') as HTMLSelectElement
    assert(purposeSel.value === 'TOURISM', 'Purpose is TOURISM after pass 1')

    // Second click (must not alter or break fields)
    const res2 = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
      options: { policy: 'fill-empty' },
    })

    assert(purposeSel.value === 'TOURISM', 'Purpose remains TOURISM after pass 2')
    const purposeRes2 = res2.results.find((r) => r.fieldId === 'bd_reg_visiting_purpose')
    assert(
      purposeRes2?.status === 'already-matching' || purposeRes2?.status === 'skipped-existing' || purposeRes2?.status === 'filled',
      `Pass 2 status is non-destructive (got ${purposeRes2?.status})`
    )
  })

  // TEST 8 — Multi-Applicant Isolation & Zero Hardcoded Data
  await runTest('Test 8: Different applicants dynamically resolve distinct purposes with zero hardcoding', async () => {
    const htmlA = `
      <!DOCTYPE html><html><body>
        <select id="countryname_id" name="appl.countryname"><option value="BANGLADESH">BANGLADESH</option></select>
        <select id="missioncode_id" name="appl.missioncode"><option value="BANGLADESH-DHAKA">BANGLADESH - DHAKA</option></select>
        <select id="nationality_id" name="appl.nationality"><option value="BANGLADESH">BANGLADESH</option></select>
        <input type="text" id="dob_id" name="appl.birthdate" />
        <input type="text" id="email_id" name="appl.email" />
        <input type="text" id="email_re_id" name="appl.email_re" />
        <input type="text" id="jouryney_id" name="appl.journeydate" />
        <select id="purpose_id" name="appl.purpose">
          <option value="">Select Purpose</option>
          <option value="TOURISM">FOR TOURISM</option>
          <option value="MED_SELF">FOR MEDICAL TREATMENT</option>
          <option value="BUSINESS">BUSINESS VISIT</option>
        </select>
        <input type="text" id="captcha" name="captcha" />
      </body></html>
    `
    const domA = new JSDOM(htmlA)
    globalThis.document = domA.window.document
    globalThis.HTMLElement = domA.window.HTMLElement
    globalThis.HTMLSelectElement = domA.window.HTMLSelectElement
    globalThis.HTMLInputElement = domA.window.HTMLInputElement
    globalThis.HTMLTextAreaElement = domA.window.HTMLTextAreaElement
    globalThis.HTMLButtonElement = domA.window.HTMLButtonElement
    globalThis.HTMLOptionElement = domA.window.HTMLOptionElement
    globalThis.Event = domA.window.Event

    const candA = resolveCandidateData({
      profileId: 'applicant_alpha',
      documents: [],
      savedApplication: createSavedApp('applicant_alpha', {
        'appl.countryname': { value: 'BANGLADESH' },
        'appl.missioncode': { value: 'BANGLADESH-DHAKA' },
        'appl.nationality': { value: 'BANGLADESH' },
        'appl.birthdate': { value: '1988-04-12' },
        'appl.email': { value: 'alpha@tourism.org' },
        'appl.journeydate': { value: '2026-10-15' },
        'purpose': { value: 'HOLIDAY VACATION AND RECREATION' },
      }),
    })

    const candB = resolveCandidateData({
      profileId: 'applicant_beta',
      documents: [],
      savedApplication: createSavedApp('applicant_beta', {
        'appl.countryname': { value: 'BANGLADESH' },
        'appl.missioncode': { value: 'BANGLADESH-DHAKA' },
        'appl.nationality': { value: 'BANGLADESH' },
        'appl.birthdate': { value: '1975-09-30' },
        'appl.email': { value: 'beta@medical.org' },
        'appl.journeydate': { value: '2026-11-01' },
        'purpose': { value: 'UNDERGOING SURGICAL TREATMENT AT HOSPITAL' },
      }),
    })

    await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candA.applicant!,
      options: { policy: 'fill-empty' },
    })
    const selA = domA.window.document.getElementById('purpose_id') as HTMLSelectElement
    assert(selA.value === 'TOURISM', `Applicant Alpha gets TOURISM (got "${selA.value}")`)

    // Fresh DOM for Applicant Beta
    const domB = new JSDOM(htmlA)
    globalThis.document = domB.window.document
    globalThis.HTMLElement = domB.window.HTMLElement
    globalThis.HTMLSelectElement = domB.window.HTMLSelectElement
    globalThis.HTMLInputElement = domB.window.HTMLInputElement
    globalThis.HTMLTextAreaElement = domB.window.HTMLTextAreaElement
    globalThis.HTMLButtonElement = domB.window.HTMLButtonElement
    globalThis.HTMLOptionElement = domB.window.HTMLOptionElement
    globalThis.Event = domB.window.Event

    await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candB.applicant!,
      options: { policy: 'fill-empty' },
    })
    const selB = domB.window.document.getElementById('purpose_id') as HTMLSelectElement
    assert(selB.value === 'MED_SELF', `Applicant Beta gets MED_SELF (got "${selB.value}")`)
  })

  // TEST 9 — Security Boundary: CAPTCHA remains manual
  await runTest('Test 9: Security boundary: CAPTCHA remains strictly manual-required', async () => {
    const captchaMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_captcha')
    assert(captchaMapping?.status === 'manual-required', 'CAPTCHA mapping is manual-required')
    assert(captchaMapping?.sourceType === 'manual', 'CAPTCHA sourceType is manual')
  })

  console.log(`\nTask 086 Test Results: ${result.passedTests}/${result.totalTests} Passed (${result.failedTests} Failed)`)
  return result
}
