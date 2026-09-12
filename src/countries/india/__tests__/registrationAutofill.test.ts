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

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://indianvisa-bangladesh.nic.in/visa/Registration',
  })
  const doc = dom.window.document
  ;(globalThis as unknown as { document: Document }).document = doc
  ;(globalThis as unknown as { window: Window }).window = dom.window as unknown as Window
  ;(globalThis as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement = dom.window.HTMLElement
  ;(globalThis as unknown as { HTMLInputElement: typeof HTMLInputElement }).HTMLInputElement = dom.window.HTMLInputElement
  ;(globalThis as unknown as { HTMLSelectElement: typeof HTMLSelectElement }).HTMLSelectElement = dom.window.HTMLSelectElement
  ;(globalThis as unknown as { HTMLTextAreaElement: typeof HTMLTextAreaElement }).HTMLTextAreaElement = dom.window.HTMLTextAreaElement
  ;(globalThis as unknown as { HTMLButtonElement: typeof HTMLButtonElement }).HTMLButtonElement = dom.window.HTMLButtonElement
  ;(globalThis as unknown as { Event: typeof Event }).Event = dom.window.Event

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
    assert(emailEl.value === '', `Missing email must remain blank, got "${emailEl.value}"`)
    assert(journeyEl.value === '', `Missing journey date must remain blank, got "${journeyEl.value}"`)

    // Verify missing fields results structure -> SKIPPED
    const emailResult = autofillResultB.results.find((r) => r.fieldId === 'bd_reg_email')
    assert(Boolean(emailResult && emailResult.status === 'skipped'), 'Missing email must be reported as skipped')

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
  // 7. DYNAMIC DEPENDENT MISSION POPULATION SIMULATION
  // =========================================================================
  {
    doc.body.innerHTML = `
      <form id="visa_registration_form_3">
        <select name="appl.countryname" id="countryname_id">
          <option value="">Select Country</option>
          <option value="BGD">BANGLADESH</option>
        </select>
        <!-- Mission starts empty (simulating dynamic AJAX load upon country change) -->
        <select name="appl.missioncode" id="missioncode_id">
          <option value="">Select Mission</option>
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

    const countrySelect = doc.getElementById('countryname_id') as HTMLSelectElement
    const missionSelect = doc.getElementById('missioncode_id') as HTMLSelectElement

    // Simulate portal script that populates mission dropdown when country change event fires
    countrySelect.addEventListener('change', () => {
      const opt = doc.createElement('option')
      opt.value = '01'
      opt.text = 'BANGLADESH - DHAKA'
      missionSelect.appendChild(opt)
    })

    const testApplicant: ApplicantProfile = {
      applicantId: 'APPL_DYNAMIC',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      registration: {
        applyingFromCountry: 'BANGLADESH',
        indianMission: 'BANGLADESH - DHAKA',
        nationality: 'BANGLADESH',
      },
      personalInfo: {
        dateOfBirth: '1990-01-01',
        nationality: 'BANGLADESH',
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
      applicant: testApplicant,
      options: { policy: 'fill-empty' },
    })

    assert(countrySelect.value === 'BGD', 'Country should be set')
    assert(missionSelect.value === '01', `Mission select should be populated and selected to "01", got "${missionSelect.value}"`)
    assert(autofillRes.filledFields === 7, `Expected all 7 fields filled with dynamic mission, got ${autofillRes.filledFields}`)
  }

  // Restore previous global environment
  if (prevDoc) {
    ;(globalThis as unknown as { document: Document }).document = prevDoc
  }
  if (prevWindow) {
    ;(globalThis as unknown as { window: Window }).window = prevWindow
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
