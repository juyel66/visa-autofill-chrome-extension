import { JSDOM } from 'jsdom'
import { detectIndiaVisaPage } from '../detector'
import { getIndiaVisaMappings } from '../mappingService'
import { BANGLADESH_REGISTRATION_MAPPINGS } from '../mappings/bangladesh/registration'
import { executeAutofill } from '../../../core/autofill/autofillEngine'
import { resolveCandidateData } from '../../../core/autofill/candidateResolver'
import { findMatchingSelectOption, areAliasesEquivalent } from '../../../core/autofill/selectResolver'
import type { SavedApplication } from '../../../core/application/types'
import type { ApplicantProfile } from '../../../core/applicant/types'

export interface TestSuiteResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runRegistrationAutofillTests(): Promise<TestSuiteResult> {
  const failures: string[] = []
  let totalSubtests = 0

  const prevDoc = (globalThis as unknown as { document?: Document }).document
  const prevWindow = (globalThis as unknown as { window?: Window }).window
  const prevHTMLElement = (globalThis as unknown as { HTMLElement?: typeof HTMLElement }).HTMLElement
  const prevHTMLInputElement = (globalThis as unknown as { HTMLInputElement?: typeof HTMLInputElement }).HTMLInputElement
  const prevHTMLSelectElement = (globalThis as unknown as { HTMLSelectElement?: typeof HTMLSelectElement }).HTMLSelectElement
  const prevHTMLTextAreaElement = (globalThis as unknown as { HTMLTextAreaElement?: typeof HTMLTextAreaElement }).HTMLTextAreaElement
  const prevHTMLButtonElement = (globalThis as unknown as { HTMLButtonElement?: typeof HTMLButtonElement }).HTMLButtonElement
  const prevEvent = (globalThis as unknown as { Event?: typeof Event }).Event

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

  try {

  function assert(condition: boolean, message: string) {
    totalSubtests++
    if (!condition) {
      failures.push(message)
    }
  }

  // =========================================================================
  // 1. PAGE DETECTION TESTS
  // =========================================================================
  {
    const regDetection = detectIndiaVisaPage({
      href: 'https://indianvisa-bangladesh.nic.in/visa/Registration',
      hostname: 'indianvisa-bangladesh.nic.in',
      pathname: '/visa/Registration',
      title: 'Indian Visa Online - Registration',
    })

    assert(regDetection.matched === true, 'Registration page should match India visa portal')
    assert(regDetection.countryCode === 'IND', 'Country code should be IND')
    assert(regDetection.page === 'REGISTRATION', 'Page identity should resolve to REGISTRATION')
    assert(regDetection.flow === 'regular', 'Flow should be regular')

    // Case insensitivity & trailing slashes
    const regDetection2 = detectIndiaVisaPage({
      href: 'https://indianvisa-bangladesh.nic.in/visa/registration/',
      hostname: 'indianvisa-bangladesh.nic.in',
      pathname: '/visa/registration/',
      title: '',
    })
    assert(regDetection2.page === 'REGISTRATION', 'Lower-case /visa/registration/ should resolve to REGISTRATION')

    // Domain query mapping service
    const mappings = getIndiaVisaMappings('regular', 'REGISTRATION', 'indianvisa-bangladesh.nic.in')
    assert(mappings.length >= 7, `Expected at least 7 registration mappings, got ${mappings.length}`)
  }

  // =========================================================================
  // 2. FIELD MAPPINGS AND VERIFIED SELECTORS
  // =========================================================================
  {
    const countryMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_country')
    const missionMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_indian_mission')
    const nationalityMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_nationality')
    const dobMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_dob')
    const emailMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_email')
    const emailConfirmMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_email_confirm')
    const journeyMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_expected_arrival')
    const captchaMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_captcha')

    assert(Boolean(countryMapping && countryMapping.status === 'verified'), 'Country mapping must be verified')
    assert(countryMapping?.targetField === 'appl.countryname', 'Country targetField must be appl.countryname')

    assert(Boolean(missionMapping && missionMapping.status === 'verified'), 'Mission mapping must be verified')
    assert(missionMapping?.targetField === 'appl.missioncode', 'Mission targetField must be appl.missioncode')

    assert(Boolean(nationalityMapping && nationalityMapping.status === 'verified'), 'Nationality mapping must be verified')
    assert(nationalityMapping?.targetField === 'appl.nationality', 'Nationality targetField must be appl.nationality')

    assert(Boolean(dobMapping && dobMapping.status === 'verified'), 'DOB mapping must be verified')
    assert(dobMapping?.targetField === 'appl.birthdate', 'DOB targetField must be appl.birthdate')
    assert(dobMapping?.transform === 'isoDateToDdMmYyyy', 'DOB transform must be isoDateToDdMmYyyy')

    assert(Boolean(emailMapping && emailMapping.status === 'verified'), 'Email mapping must be verified')
    assert(emailMapping?.targetField === 'appl.email', 'Email targetField must be appl.email')

    assert(Boolean(emailConfirmMapping && emailConfirmMapping.status === 'verified'), 'Email confirm mapping must be verified')
    assert(emailConfirmMapping?.targetField === 'appl.email_re', 'Email confirm targetField must be appl.email_re')

    assert(Boolean(journeyMapping && journeyMapping.status === 'verified'), 'Journey date mapping must be verified')
    assert(journeyMapping?.targetField === 'appl.journeydate', 'Journey date targetField must be appl.journeydate')
    assert(journeyMapping?.transform === 'isoDateToDdMmYyyy', 'Journey transform must be isoDateToDdMmYyyy')

    assert(Boolean(captchaMapping && captchaMapping.status === 'manual-required'), 'CAPTCHA mapping must be manual-required')
    assert(captchaMapping?.sourceType === 'manual', 'CAPTCHA sourceType must be manual')
  }

  // =========================================================================
  // 3. GENERIC SELECT RESOLVER & ALIAS TESTS
  // =========================================================================
  {
    // Alias equivalence tests
    assert(areAliasesEquivalent('BANGLADESHI', 'BANGLADESH'), 'BANGLADESHI should match BANGLADESH alias')
    assert(areAliasesEquivalent('BANGLADESHI', 'BGD'), 'BANGLADESHI should match BGD alias')
    assert(areAliasesEquivalent('USA', 'UNITED STATES'), 'USA should match UNITED STATES alias')
    assert(areAliasesEquivalent('AMERICAN', 'UNITED STATES'), 'AMERICAN should match UNITED STATES alias')
    assert(areAliasesEquivalent('BRITISH', 'GBR'), 'BRITISH should match GBR alias')
    assert(areAliasesEquivalent('INDIAN', 'INDIA'), 'INDIAN should match INDIA alias')
    assert(areAliasesEquivalent('CANADIAN', 'CANADA'), 'CANADIAN should match CANADA alias')
    assert(!areAliasesEquivalent('BANGLADESH', 'INDIA'), 'BANGLADESH should not match INDIA alias')

    // DOM select matching tests
    doc.body.innerHTML = `
      <select id="test_nat_select">
        <option value="">Select Nationality</option>
        <option value="BGD">BANGLADESH</option>
        <option value="USA">UNITED STATES</option>
        <option value="CAN">CANADA</option>
        <option value="IND">INDIA</option>
      </select>
      <select id="test_mission_select">
        <option value="">Select Mission</option>
        <option value="01">BANGLADESH - DHAKA</option>
        <option value="02">BANGLADESH - CHITTAGONG</option>
        <option value="03">BANGLADESH - RAJSHAHI</option>
      </select>
    `
    const natSelect = doc.getElementById('test_nat_select') as HTMLSelectElement
    const missionSelect = doc.getElementById('test_mission_select') as HTMLSelectElement

    // 1. BANGLADESHI matches option <option value="BGD">BANGLADESH</option>
    const matchBgd = findMatchingSelectOption(natSelect, 'BANGLADESHI')
    assert(matchBgd.option?.value === 'BGD', `BANGLADESHI should resolve to option value "BGD", got "${matchBgd.option?.value}"`)

    // 2. BGD matches option <option value="BGD">BANGLADESH</option>
    const matchBgdCode = findMatchingSelectOption(natSelect, 'BGD')
    assert(matchBgdCode.option?.value === 'BGD', `BGD should resolve to option value "BGD", got "${matchBgdCode.option?.value}"`)

    // 3. AMERICAN matches option <option value="USA">UNITED STATES</option>
    const matchUsa = findMatchingSelectOption(natSelect, 'AMERICAN')
    assert(matchUsa.option?.value === 'USA', `AMERICAN should resolve to option value "USA", got "${matchUsa.option?.value}"`)

    // 4. CANADIAN matches option <option value="CAN">CANADA</option>
    const matchCan = findMatchingSelectOption(natSelect, 'CANADIAN')
    assert(matchCan.option?.value === 'CAN', `CANADIAN should resolve to option value "CAN", got "${matchCan.option?.value}"`)

    // 5. Mission match from city only: "DHAKA" matches "BANGLADESH - DHAKA"
    const matchDhaka = findMatchingSelectOption(missionSelect, 'DHAKA')
    assert(matchDhaka.option?.value === '01', `DHAKA should resolve to option value "01", got "${matchDhaka.option?.value}"`)

    // 6. Mission match from full text: "BANGLADESH - DHAKA" matches "BANGLADESH - DHAKA"
    const matchFullDhaka = findMatchingSelectOption(missionSelect, 'BANGLADESH - DHAKA')
    assert(matchFullDhaka.option?.value === '01', `BANGLADESH - DHAKA should resolve to "01", got "${matchFullDhaka.option?.value}"`)

    // 7. Mission match from code: "01" matches "01"
    const matchCode01 = findMatchingSelectOption(missionSelect, '01')
    assert(matchCode01.option?.value === '01', `"01" should resolve to "01", got "${matchCode01.option?.value}"`)

    // 8. Unresolvable option returns null
    const matchUnknown = findMatchingSelectOption(missionSelect, 'LONDON')
    assert(matchUnknown.option === null, 'Unresolvable mission should return null option')
  }

  // =========================================================================
  // 4. FULL REGISTRATION PAGE DOM AUTOFILL EXECUTION (REALISTIC BANGLADESHI APPLICANT)
  // =========================================================================
  {
    doc.body.innerHTML = `
      <form id="visa_registration_form">
        <!-- 1. Country select -->
        <select name="appl.countryname" id="countryname_id">
          <option value="">Select Country</option>
          <option value="BGD">BANGLADESH</option>
          <option value="USA">UNITED STATES</option>
          <option value="IND">INDIA</option>
        </select>

        <!-- 2. Indian Mission select -->
        <select name="appl.missioncode" id="missioncode_id">
          <option value="">Select Mission</option>
          <option value="01">BANGLADESH - DHAKA</option>
          <option value="02">BANGLADESH - CHITTAGONG</option>
          <option value="03">BANGLADESH - RAJSHAHI</option>
          <option value="04">BANGLADESH - SYLHET</option>
          <option value="05">BANGLADESH - KHULNA</option>
        </select>

        <!-- 3. Nationality select -->
        <select name="appl.nationality" id="nationality_id">
          <option value="">Select Nationality</option>
          <option value="BGD">BANGLADESH</option>
          <option value="USA">UNITED STATES</option>
          <option value="CAN">CANADA</option>
        </select>

        <!-- 4. Date of Birth text input -->
        <input type="text" name="appl.birthdate" id="dob_id" value="" />

        <!-- 5. Email text input -->
        <input type="text" name="appl.email" id="email_id" value="" />

        <!-- 6. Confirm Email text input -->
        <input type="text" name="appl.email_re" id="email_re_id" value="" />

        <!-- 7. Journey Date text input -->
        <input type="text" name="appl.journeydate" id="jouryney_id" value="" />

        <!-- 8. CAPTCHA input (MUST REMAIN UNTOUCHED) -->
        <input type="text" name="captcha" id="captcha" value="" />

        <!-- Submit Button (MUST NOT BE CLICKED) -->
        <button type="button" id="btn_save_continue">Save and Continue</button>
      </form>
    `

    let submitClicked = false
    const submitBtn = doc.getElementById('btn_save_continue')
    submitBtn?.addEventListener('click', () => {
      submitClicked = true
    })

    // Track event dispatches
    const eventLog: Record<string, string[]> = {}
    const fieldIds = ['countryname_id', 'missioncode_id', 'nationality_id', 'dob_id', 'email_id', 'email_re_id', 'jouryney_id', 'captcha']
    fieldIds.forEach((id) => {
      eventLog[id] = []
      const el = doc.getElementById(id)
      if (el) {
        ;['input', 'change', 'blur'].forEach((evtType) => {
          el.addEventListener(evtType, () => {
            eventLog[id].push(evtType)
          })
        })
      }
    })

    // Test SavedApplication representing a real Bangladeshi applicant (with BANGLADESHI nationality & DHAKA mission)
    const savedAppA: SavedApplication = {
      applicationId: 'app_applicant_001',
      applicantId: 'APPLICANT_001',
      createdAt: '2026-09-12T10:00:00Z',
      updatedAt: '2026-09-12T10:00:00Z',
      status: 'ready_for_autofill',
      fields: {
        'appl.countryname': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.missioncode': { value: 'DHAKA', source: 'manual', isUserEdited: true },
        'appl.nationality': { value: 'BANGLADESHI', source: 'passport', isUserEdited: false },
        'appl.birthdate': { value: '20 APR 1987', source: 'passport', isUserEdited: false },
        'appl.email': { value: 'applicant.one@example.com', source: 'passport', isUserEdited: false },
        'appl.email_re': { value: 'applicant.one@example.com', source: 'passport', isUserEdited: false },
        'appl.journeydate': { value: '15/10/2026', source: 'manual', isUserEdited: true },
      },
      manualEdits: {
        'appl.missioncode': true,
        'appl.journeydate': true,
      },
      provenance: {
        lastSavedAt: '2026-09-12T10:00:00Z',
      },
      sourceDocuments: {},
    }

    const candRes = resolveCandidateData({
      profileId: 'APPLICANT_001',
      documents: [],
      savedApplication: savedAppA,
    })

    assert(candRes.status === 'READY', `Expected candidate resolution status READY, got ${candRes.status}`)
    assert(Boolean(candRes.applicant), 'Expected resolved applicant profile')

    const autofillResult = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
      options: { policy: 'fill-empty' },
    })

    // Verify Autofill Counts
    assert(autofillResult.filledFields === 7, `Expected 7 filled fields, got ${autofillResult.filledFields}`)
    assert(autofillResult.failedFields === 1, `Expected 1 manual/failed field (CAPTCHA), got ${autofillResult.failedFields}`)

    // Verify individual DOM field values
    const countryEl = doc.getElementById('countryname_id') as HTMLSelectElement
    assert(countryEl.value === 'BGD', `Country select value should be "BGD", got "${countryEl.value}"`)

    const missionEl = doc.getElementById('missioncode_id') as HTMLSelectElement
    assert(missionEl.value === '01', `Mission select value should be "01", got "${missionEl.value}"`)

    const nationalityEl = doc.getElementById('nationality_id') as HTMLSelectElement
    assert(nationalityEl.value === 'BGD', `Nationality select value should be "BGD", got "${nationalityEl.value}"`)

    const dobEl = doc.getElementById('dob_id') as HTMLInputElement
    assert(dobEl.value === '20/04/1987', `DOB input should be normalized to "20/04/1987", got "${dobEl.value}"`)

    const emailEl = doc.getElementById('email_id') as HTMLInputElement
    assert(emailEl.value === 'applicant.one@example.com', `Email should be "applicant.one@example.com", got "${emailEl.value}"`)

    const emailReEl = doc.getElementById('email_re_id') as HTMLInputElement
    assert(emailReEl.value === 'applicant.one@example.com', `Confirm Email should be "applicant.one@example.com", got "${emailReEl.value}"`)

    const journeyEl = doc.getElementById('jouryney_id') as HTMLInputElement
    assert(journeyEl.value === '15/10/2026', `Journey date should be "15/10/2026", got "${journeyEl.value}"`)

    // CAPTCHA must remain empty
    const captchaEl = doc.getElementById('captcha') as HTMLInputElement
    assert(captchaEl.value === '', `CAPTCHA must remain empty, got "${captchaEl.value}"`)

    // Save & Continue button must not be clicked
    assert(submitClicked === false, 'Save & Continue button must never be clicked by autofill')

    // Verify DOM events were fired
    assert(eventLog['countryname_id'].includes('change'), 'Country select should dispatch change event')
    assert(eventLog['missioncode_id'].includes('change'), 'Mission select should dispatch change event')
    assert(eventLog['nationality_id'].includes('change'), 'Nationality select should dispatch change event')
    assert(eventLog['dob_id'].includes('input') && eventLog['dob_id'].includes('change'), 'DOB input should dispatch input and change events')
    assert(eventLog['email_id'].includes('input') && eventLog['email_id'].includes('change'), 'Email input should dispatch input and change events')
    assert(eventLog['jouryney_id'].includes('input'), 'Journey date should dispatch input event')
    assert(eventLog['captcha'].length === 0, 'CAPTCHA should have 0 dispatched events')
  }

  // =========================================================================
  // 5. MISSING VALUES REPORTED AS SKIPPED (PROFILE ISOLATION TEST)
  // =========================================================================
  {
    doc.body.innerHTML = `
      <form id="visa_registration_form_2">
        <select name="appl.countryname" id="countryname_id"><option value="">Select</option><option value="USA">UNITED STATES</option></select>
        <select name="appl.missioncode" id="missioncode_id"><option value="">Select</option><option value="10">USA - NEW YORK</option></select>
        <select name="appl.nationality" id="nationality_id"><option value="">Select</option><option value="USA">UNITED STATES</option></select>
        <input type="text" name="appl.birthdate" id="dob_id" value="" />
        <input type="text" name="appl.email" id="email_id" value="" />
        <input type="text" name="appl.email_re" id="email_re_id" value="" />
        <input type="text" name="appl.journeydate" id="jouryney_id" value="" />
        <input type="text" name="captcha" id="captcha" value="" />
      </form>
    `

    // Completely different applicant (USA applicant, missing journey date and missing email)
    const savedAppB: SavedApplication = {
      applicationId: 'app_applicant_002',
      applicantId: 'APPLICANT_002',
      createdAt: '2026-09-12T10:00:00Z',
      updatedAt: '2026-09-12T10:00:00Z',
      status: 'ready_for_autofill',
      fields: {
        'appl.countryname': { value: 'UNITED STATES', source: 'passport', isUserEdited: false },
        'appl.missioncode': { value: 'USA - NEW YORK', source: 'manual', isUserEdited: true },
        'appl.nationality': { value: 'AMERICAN', source: 'passport', isUserEdited: false },
        'appl.birthdate': { value: '1985-12-25', source: 'passport', isUserEdited: false },
        // email is intentionally MISSING
        'appl.email': { value: '', source: 'missing', isUserEdited: false },
        'appl.email_re': { value: '', source: 'missing', isUserEdited: false },
        // journeydate is intentionally MISSING
        'appl.journeydate': { value: '', source: 'missing', isUserEdited: false },
      },
      manualEdits: {},
      provenance: {
        lastSavedAt: '2026-09-12T10:00:00Z',
      },
      sourceDocuments: {},
    }

    const candResB = resolveCandidateData({
      profileId: 'APPLICANT_002',
      documents: [],
      savedApplication: savedAppB,
    })

    const autofillResultB = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candResB.applicant!,
      options: { policy: 'fill-empty' },
    })

    const countryEl = doc.getElementById('countryname_id') as HTMLSelectElement
    const missionEl = doc.getElementById('missioncode_id') as HTMLSelectElement
    const nationalityEl = doc.getElementById('nationality_id') as HTMLSelectElement
    const dobEl = doc.getElementById('dob_id') as HTMLInputElement
    const emailEl = doc.getElementById('email_id') as HTMLInputElement
    const journeyEl = doc.getElementById('jouryney_id') as HTMLInputElement

    assert(countryEl.value === 'USA', `USA Country should be selected, got "${countryEl.value}"`)
    assert(missionEl.value === '10', `USA Mission should be selected, got "${missionEl.value}"`)
    assert(nationalityEl.value === 'USA', `USA Nationality should be selected from AMERICAN, got "${nationalityEl.value}"`)
    assert(dobEl.value === '25/12/1985', `DOB should be 25/12/1985, got "${dobEl.value}"`)
    assert(emailEl.value.includes('@temporary-visa-app.com'), `Missing email should be populated with dynamic temporary email, got "${emailEl.value}"`)
    assert(journeyEl.value === '', `Missing journey date must remain blank, got "${journeyEl.value}"`)

    // Verify missing fields results structure: email filled via temp, journey date -> SKIPPED
    const emailResult = autofillResultB.results.find((r) => r.fieldId === 'bd_reg_email')
    assert(Boolean(emailResult && emailResult.status === 'filled'), 'Dynamic temporary email should be reported as filled')

    const journeyResult = autofillResultB.results.find((r) => r.fieldId === 'bd_reg_expected_arrival')
    assert(Boolean(journeyResult && journeyResult.status === 'skipped'), 'Missing journey date must be reported as skipped')

    const captchaResult = autofillResultB.results.find((r) => r.fieldId === 'bd_reg_captcha')
    assert(Boolean(captchaResult && captchaResult.failureType === 'manual-required'), 'CAPTCHA must be reported as manual-required')
  }

  // =========================================================================
  // 6. UNRESOLVABLE DROPDOWNS REPORTED AS FAILED
  // =========================================================================
  {
    doc.body.innerHTML = `
      <form id="visa_registration_form_unresolvable">
        <select name="appl.countryname" id="countryname_id">
          <option value="">Select Country</option>
          <option value="BGD">BANGLADESH</option>
        </select>
        <select name="appl.missioncode" id="missioncode_id">
          <option value="">Select Mission</option>
          <option value="01">BANGLADESH - DHAKA</option>
        </select>
        <select name="appl.nationality" id="nationality_id">
          <option value="">Select Nationality</option>
          <option value="BGD">BANGLADESH</option>
        </select>
        <input type="text" name="appl.birthdate" id="dob_id" value="" />
        <input type="text" name="appl.email" id="email_id" value="" />
        <input type="text" name="appl.email_re" id="email_re_id" value="" />
        <input type="text" name="appl.journeydate" id="jouryney_id" value="" />
        <input type="text" name="captcha" id="captcha" value="" />
      </form>
    `

    const unresolvableApplicant: ApplicantProfile = {
      applicantId: 'APPL_UNRESOLVABLE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      registration: {
        applyingFromCountry: 'BANGLADESH',
        indianMission: 'NON_EXISTENT_MISSION_XYZ',
        nationality: 'NON_EXISTENT_NATIONALITY_XYZ',
      },
      personalInfo: {
        dateOfBirth: '1990-01-01',
        nationality: 'NON_EXISTENT_NATIONALITY_XYZ',
      },
      contact: {
        email: 'test@example.com',
      },
      travel: {
        intendedArrivalDate: '2026-11-01',
      },
    }

    const autofillRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: unresolvableApplicant,
      options: { policy: 'fill-empty' },
    })

    const missionRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_indian_mission')
    assert(Boolean(missionRes && missionRes.status === 'failed' && missionRes.failureType === 'option-not-found'), 'Unresolvable mission must be reported as FAILED with option-not-found')

    const natRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_nationality')
    assert(Boolean(natRes && natRes.status === 'failed' && natRes.failureType === 'option-not-found'), 'Unresolvable nationality must be reported as FAILED with option-not-found')
  }

  // =========================================================================
  // 8. BANGLADESH CENTRALIZED DEFAULT MISSION (BANGLADESH-RAJSHAHI) & EXPLICIT OVERRIDE
  // =========================================================================
  {
    doc.body.innerHTML = `
      <form id="visa_registration_form_mission">
        <select name="appl.countryname" id="countryname_id"><option value="BGD">BANGLADESH</option></select>
        <select name="appl.missioncode" id="missioncode_id">
          <option value="">Select Mission</option>
          <option value="01">BANGLADESH - DHAKA</option>
          <option value="02">BANGLADESH - CHITTAGONG</option>
          <option value="03">BANGLADESH - RAJSHAHI</option>
          <option value="04">BANGLADESH - SYLHET</option>
        </select>
        <select name="appl.nationality" id="nationality_id"><option value="BGD">BANGLADESH</option></select>
        <input type="text" name="appl.birthdate" id="dob_id" value="" />
        <input type="text" name="appl.email" id="email_id" value="" />
        <input type="text" name="appl.email_re" id="email_re_id" value="" />
        <input type="text" name="appl.journeydate" id="jouryney_id" value="" />
        <input type="text" name="captcha" id="captcha" value="" />
      </form>
    `

    // Test 8.1: No explicit mission -> Uses configured default (BANGLADESH-RAJSHAHI)
    const appNoMission: ApplicantProfile = {
      applicantId: 'APPL_NO_MISSION',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      personalInfo: { dateOfBirth: '1990-01-01', nationality: 'BANGLADESH' },
      registration: { applyingFromCountry: 'BANGLADESH' },
    }

    const autofillResDefault = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: appNoMission,
      options: { policy: 'fill-empty' },
    })

    const missionEl = doc.getElementById('missioncode_id') as HTMLSelectElement
    assert(missionEl.value === '03', `Default mission should resolve to "03" (RAJSHAHI), got "${missionEl.value}"`)
    const missionRes = autofillResDefault.results.find((r) => r.fieldId === 'bd_reg_indian_mission')
    assert(missionRes?.status === 'filled', 'Default mission should be reported as filled')

    // Test 8.2: Explicit mission overrides default
    const appExplicitMission: ApplicantProfile = {
      applicantId: 'APPL_EXP_MISSION',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      personalInfo: { dateOfBirth: '1990-01-01', nationality: 'BANGLADESH' },
      registration: { applyingFromCountry: 'BANGLADESH', indianMission: 'BANGLADESH - SYLHET' },
    }

    doc.getElementById('missioncode_id')!.setAttribute('value', '')
    ;(doc.getElementById('missioncode_id') as HTMLSelectElement).value = ''

    await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: appExplicitMission,
      options: { policy: 'overwrite' },
    })

    assert(missionEl.value === '04', `Explicit mission should override default and resolve to "04" (SYLHET), got "${missionEl.value}"`)
  }

  // =========================================================================
  // 9. NATIONALITY DYNAMIC PRIORITY & COUNTRY-OF-BIRTH FALLBACK
  // =========================================================================
  {
    doc.body.innerHTML = `
      <form id="visa_registration_form_nat">
        <select name="appl.countryname" id="countryname_id"><option value="BGD">BANGLADESH</option></select>
        <select name="appl.missioncode" id="missioncode_id"><option value="01">BANGLADESH - DHAKA</option></select>
        <select name="appl.nationality" id="nationality_id">
          <option value="">Select Nationality</option>
          <option value="BGD">BANGLADESH</option>
          <option value="USA">UNITED STATES</option>
          <option value="CAN">CANADA</option>
        </select>
        <input type="text" name="appl.birthdate" id="dob_id" value="" />
        <input type="text" name="appl.email" id="email_id" value="" />
        <input type="text" name="appl.email_re" id="email_re_id" value="" />
        <input type="text" name="appl.journeydate" id="jouryney_id" value="" />
        <input type="text" name="captcha" id="captcha" value="" />
      </form>
    `

    const natEl = doc.getElementById('nationality_id') as HTMLSelectElement

    // Test 9.1: Explicit nationality differs from Country of Birth -> explicit nationality wins
    const appDiffNat: ApplicantProfile = {
      applicantId: 'APPL_DIFF_NAT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      personalInfo: {
        nationality: 'AMERICAN',
        countryOfBirth: 'BANGLADESH',
        dateOfBirth: '1992-04-10',
      },
    }

    await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: appDiffNat,
      options: { policy: 'overwrite' },
    })

    assert(natEl.value === 'USA', `Explicit AMERICAN nationality should win over country of birth, got "${natEl.value}"`)

    // Test 9.2: Nationality missing, Country of Birth available -> Fallback triggers
    const appCobFallback: ApplicantProfile = {
      applicantId: 'APPL_COB_FB',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      personalInfo: {
        countryOfBirth: 'BANGLADESH',
        dateOfBirth: '1992-04-10',
      },
    }

    natEl.value = ''
    await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: appCobFallback,
      options: { policy: 'overwrite' },
    })

    assert(natEl.value === 'BGD', `Country of birth fallback should populate "BGD", got "${natEl.value}"`)

    // Test 9.3: Both missing -> Skipped
    const appMissingBoth: ApplicantProfile = {
      applicantId: 'APPL_MISSING_NAT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      personalInfo: { dateOfBirth: '1992-04-10' },
    }

    natEl.value = ''
    const resMissing = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: appMissingBoth,
      options: { policy: 'overwrite' },
    })

    const natRes = resMissing.results.find((r) => r.fieldId === 'bd_reg_nationality')
    assert(natRes?.status === 'skipped', 'Missing nationality and country of birth must be reported as skipped')
    assert(natEl.value === '', 'Nationality select must remain blank when skipped')
  }

  // =========================================================================
  // 10. EMAIL PRIORITY & DYNAMIC TEMPORARY GENERATION
  // =========================================================================
  {
    doc.body.innerHTML = `
      <form id="visa_registration_form_email">
        <select name="appl.countryname" id="countryname_id"><option value="BGD">BANGLADESH</option></select>
        <select name="appl.missioncode" id="missioncode_id"><option value="01">BANGLADESH - DHAKA</option></select>
        <select name="appl.nationality" id="nationality_id"><option value="BGD">BANGLADESH</option></select>
        <input type="text" name="appl.birthdate" id="dob_id" value="" />
        <input type="text" name="appl.email" id="email_id" value="" />
        <input type="text" name="appl.email_re" id="email_re_id" value="" />
        <input type="text" name="appl.journeydate" id="jouryney_id" value="" />
        <input type="text" name="captcha" id="captcha" value="" />
      </form>
    `

    const emailEl = doc.getElementById('email_id') as HTMLInputElement
    const emailReEl = doc.getElementById('email_re_id') as HTMLInputElement

    // Test 10.1: Explicit extracted document email wins
    const appDocEmail: ApplicantProfile = {
      applicantId: 'APPL_DOC_EMAIL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      personalInfo: { givenNames: 'JOHN', surname: 'DOE', dateOfBirth: '1990-01-01', nationality: 'BANGLADESH' },
      contact: { email: 'extracted.john@customdomain.org' },
    }

    await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: appDocEmail,
      options: { policy: 'overwrite' },
    })

    assert(emailEl.value === 'extracted.john@customdomain.org', `Extracted document email should win, got "${emailEl.value}"`)
    assert(emailReEl.value === 'extracted.john@customdomain.org', `Confirm email should match email, got "${emailReEl.value}"`)

    // Test 10.2: Account email in notes wins when document email is absent
    const appAccEmail: ApplicantProfile = {
      applicantId: 'APPL_ACC_EMAIL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: 'Account Email: user.account@gmail.com',
      personalInfo: { givenNames: 'JOHN', surname: 'DOE', dateOfBirth: '1990-01-01', nationality: 'BANGLADESH' },
    }

    emailEl.value = ''
    emailReEl.value = ''
    await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: appAccEmail,
      options: { policy: 'overwrite' },
    })

    assert(emailEl.value === 'user.account@gmail.com', `Account email should win over temp, got "${emailEl.value}"`)
    assert(emailReEl.value === 'user.account@gmail.com', `Confirm email should match account email, got "${emailReEl.value}"`)

    // Test 10.3: No document or account email -> Deterministic temporary generated email
    const appTemp1: ApplicantProfile = {
      applicantId: 'APPL_TEMP_1',
      passport: { passportNumber: 'EA9876543' },
      personalInfo: { givenNames: 'ANISUR', surname: 'RAHMAN', dateOfBirth: '1990-01-01', nationality: 'BANGLADESH' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    emailEl.value = ''
    emailReEl.value = ''
    await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: appTemp1,
      options: { policy: 'overwrite' },
    })

    assert(emailEl.value.includes('anisur.rahman'), `Temporary email should contain normalized applicant name, got "${emailEl.value}"`)
    assert(emailEl.value.endsWith('@temporary-visa-app.com'), `Temporary email should end with configured domain, got "${emailEl.value}"`)
    assert(emailReEl.value === emailEl.value, 'Confirm email must match generated temporary email identically')

    // Test 10.4: Different applicant generates a completely different temporary email
    const appTemp2: ApplicantProfile = {
      applicantId: 'APPL_TEMP_2',
      passport: { passportNumber: 'EB1234567' },
      personalInfo: { givenNames: 'SHARMIN', surname: 'AKTER', dateOfBirth: '1995-05-15', nationality: 'BANGLADESH' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    emailEl.value = ''
    emailReEl.value = ''
    await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: appTemp2,
      options: { policy: 'overwrite' },
    })

    assert(emailEl.value.includes('sharmin.akter'), `Temporary email for applicant 2 should contain "sharmin.akter", got "${emailEl.value}"`)
    assert(!emailEl.value.includes('anisur'), `Temporary email for applicant 2 must not contain applicant 1 name, got "${emailEl.value}"`)
  }

  // =========================================================================
  // 11. MULTI-APPLICANT END-TO-END DYNAMIC ISOLATION (APPLICANT A vs APPLICANT B)
  // =========================================================================
  {
    doc.body.innerHTML = `
      <form id="visa_registration_form_isolation">
        <select name="appl.countryname" id="countryname_id">
          <option value="">Select Country</option>
          <option value="BGD">BANGLADESH</option>
          <option value="IND">INDIA</option>
          <option value="USA">UNITED STATES</option>
        </select>
        <select name="appl.missioncode" id="missioncode_id">
          <option value="">Select Mission</option>
          <option value="01">BANGLADESH - DHAKA</option>
          <option value="02">BANGLADESH - CHITTAGONG</option>
          <option value="03">BANGLADESH - RAJSHAHI</option>
          <option value="04">BANGLADESH - SYLHET</option>
        </select>
        <select name="appl.nationality" id="nationality_id">
          <option value="">Select Nationality</option>
          <option value="BGD">BANGLADESH</option>
          <option value="USA">UNITED STATES</option>
        </select>
        <input type="text" name="appl.birthdate" id="dob_id" value="" />
        <input type="text" name="appl.email" id="email_id" value="" />
        <input type="text" name="appl.email_re" id="email_re_id" value="" />
        <input type="text" name="appl.journeydate" id="jouryney_id" value="" />
        <input type="text" name="captcha" id="captcha" value="" />
      </form>
    `

    // Applicant Alpha
    const savedAppAlpha: SavedApplication = {
      applicationId: 'app_alpha',
      applicantId: 'APPLICANT_ALPHA',
      createdAt: '2026-09-12T10:00:00Z',
      updatedAt: '2026-09-12T10:00:00Z',
      status: 'ready_for_autofill',
      fields: {
        'appl.countryname': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.missioncode': { value: 'DHAKA', source: 'passport', isUserEdited: false },
        'appl.nationality': { value: 'BANGLADESHI', source: 'passport', isUserEdited: false },
        'appl.birthdate': { value: '1988-03-25', source: 'passport', isUserEdited: false },
        'appl.email': { value: 'alpha.applicant@domain.com', source: 'passport', isUserEdited: false },
        'appl.email_re': { value: 'alpha.applicant@domain.com', source: 'passport', isUserEdited: false },
        'appl.journeydate': { value: '2026-12-01', source: 'passport', isUserEdited: false },
      },
      manualEdits: {},
      provenance: { lastSavedAt: '2026-09-12T10:00:00Z' },
      sourceDocuments: {},
    }

    const candAlpha = resolveCandidateData({
      profileId: 'APPLICANT_ALPHA',
      documents: [],
      savedApplication: savedAppAlpha,
    })

    await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candAlpha.applicant!,
      options: { policy: 'overwrite' },
    })

    const dobEl = doc.getElementById('dob_id') as HTMLInputElement
    const emailEl = doc.getElementById('email_id') as HTMLInputElement
    const journeyEl = doc.getElementById('jouryney_id') as HTMLInputElement
    const missionEl = doc.getElementById('missioncode_id') as HTMLSelectElement

    assert(dobEl.value === '25/03/1988', `Alpha DOB should be 25/03/1988, got "${dobEl.value}"`)
    assert(emailEl.value === 'alpha.applicant@domain.com', `Alpha email should be alpha.applicant@domain.com, got "${emailEl.value}"`)
    assert(journeyEl.value === '01/12/2026', `Alpha journey should be 01/12/2026, got "${journeyEl.value}"`)
    assert(missionEl.value === '01', `Alpha mission should be DHAKA (01), got "${missionEl.value}"`)

    // Applicant Beta (Completely different applicant: no explicit mission -> default RAJSHAHI, no email -> temp, no journey -> skipped)
    const savedAppBeta: SavedApplication = {
      applicationId: 'app_beta',
      applicantId: 'APPLICANT_BETA',
      createdAt: '2026-09-12T10:00:00Z',
      updatedAt: '2026-09-12T10:00:00Z',
      status: 'ready_for_autofill',
      fields: {
        'appl.countryname': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.missioncode': { value: '', source: 'missing', isUserEdited: false },
        'appl.nationality': { value: 'BANGLADESHI', source: 'passport', isUserEdited: false },
        'appl.birthdate': { value: '1999-11-05', source: 'passport', isUserEdited: false },
        'appl.email': { value: '', source: 'missing', isUserEdited: false },
        'appl.email_re': { value: '', source: 'missing', isUserEdited: false },
        'appl.journeydate': { value: '', source: 'missing', isUserEdited: false },
      },
      manualEdits: {},
      provenance: { lastSavedAt: '2026-09-12T10:00:00Z' },
      sourceDocuments: {},
    }

    const candBeta = resolveCandidateData({
      profileId: 'APPLICANT_BETA',
      documents: [],
      savedApplication: savedAppBeta,
    })

    // Reset inputs
    dobEl.value = ''
    emailEl.value = ''
    journeyEl.value = ''
    missionEl.value = ''

    await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candBeta.applicant!,
      options: { policy: 'overwrite' },
    })

    assert(dobEl.value === '05/11/1999', `Beta DOB should be 05/11/1999, got "${dobEl.value}"`)
    assert(missionEl.value === '03', `Beta default mission should be RAJSHAHI (03), got "${missionEl.value}"`)
    assert(journeyEl.value === '', `Beta missing journey date should remain empty, got "${journeyEl.value}"`)
    assert(!emailEl.value.includes('alpha.applicant'), `Beta email must NOT contain Alpha email, got "${emailEl.value}"`)
    assert(emailEl.value.endsWith('@temporary-visa-app.com'), `Beta email should be temporary generated, got "${emailEl.value}"`)
  }

  // =========================================================================
  // 12. PRODUCTION HARDCODE PROTECTION SCAN
  // =========================================================================
  {
    const isNode = typeof globalThis !== 'undefined' && 'process' in globalThis
    if (isNode) {
      try {
        interface NodeFsModule {
          readdirSync: (p: string, opt: { recursive: boolean }) => string[]
          readFileSync: (p: string, enc: string) => string
        }
        interface NodePathModule {
          resolve: (...paths: string[]) => string
          join: (...paths: string[]) => string
        }
        const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<{ default: unknown }>
        const fsMod = (await dynamicImport('fs')).default as NodeFsModule
        const pathMod = (await dynamicImport('path')).default as NodePathModule

        const srcDir = pathMod.resolve('.', 'src')
        const allFiles = fsMod.readdirSync(srcDir, { recursive: true })
        const codeFiles = allFiles.filter(
          (f) =>
            (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')) &&
            !f.includes('__tests__') &&
            !f.includes('.test.') &&
            !f.includes('.spec.')
        )

        const forbiddenPhrases = [
          'alpha.applicant',
          'APPLICANT_ALPHA',
          'APPLICANT_BETA',
          'EA9876543',
          'EB1234567',
        ]

        for (const file of codeFiles) {
          const content = fsMod.readFileSync(pathMod.join(srcDir, file), 'utf8')
          for (const phrase of forbiddenPhrases) {
            if (content.includes(phrase)) {
              failures.push(`Hardcode audit failed: Production file "${file}" contains forbidden test phrase "${phrase}"`)
            }
          }
        }
        assert(true, 'Production source files contain 0 applicant-specific hardcoded test data')
      } catch (err) {
        failures.push(`Hardcode audit encountered error: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  } finally {
    // Restore previous global environment
    if (prevDoc) {
      Object.defineProperty(globalThis, 'document', { value: prevDoc, configurable: true, writable: true })
    }
    if (prevWindow) {
      Object.defineProperty(globalThis, 'window', { value: prevWindow, configurable: true, writable: true })
    }
    if (prevHTMLElement) {
      Object.defineProperty(globalThis, 'HTMLElement', { value: prevHTMLElement, configurable: true, writable: true })
    }
    if (prevHTMLInputElement) {
      Object.defineProperty(globalThis, 'HTMLInputElement', { value: prevHTMLInputElement, configurable: true, writable: true })
    }
    if (prevHTMLSelectElement) {
      Object.defineProperty(globalThis, 'HTMLSelectElement', { value: prevHTMLSelectElement, configurable: true, writable: true })
    }
    if (prevHTMLTextAreaElement) {
      Object.defineProperty(globalThis, 'HTMLTextAreaElement', { value: prevHTMLTextAreaElement, configurable: true, writable: true })
    }
    if (prevHTMLButtonElement) {
      Object.defineProperty(globalThis, 'HTMLButtonElement', { value: prevHTMLButtonElement, configurable: true, writable: true })
    }
    if (prevEvent) {
      Object.defineProperty(globalThis, 'Event', { value: prevEvent, configurable: true, writable: true })
    }
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
