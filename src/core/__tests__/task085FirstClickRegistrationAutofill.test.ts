import { JSDOM } from 'jsdom'
import type { SavedApplication } from '../application/types'
import { BANGLADESH_REGISTRATION_MAPPINGS } from '../../countries/india/mappings/bangladesh/registration'
import { executeAutofill } from '../autofill/autofillEngine'
import { resolveCandidateData } from '../autofill/candidateResolver'
import { waitForSelectReadiness, isPlaceholderOption, isSelectControlReady, getSelectOptions } from '../autofill/selectResolver'

export interface TestSuiteResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runTask085FirstClickRegistrationAutofillTests(): Promise<TestSuiteResult> {
  const failures: string[] = []
  let totalSubtests = 0

  function assert(condition: boolean, message: string) {
    totalSubtests++
    if (!condition) {
      failures.push(message)
    }
  }

  console.log('=== RUNNING TASK 085: FIRST-CLICK REGISTRATION AUTOFILL & ASYNC PURPOSE TESTS ===')

  // =========================================================================
  // TEST 1 — Select Helper Functions & Placeholder Identification
  // =========================================================================
  {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html><body>
        <select id="test_sel">
          <option value="">Select Purpose</option>
          <option value="">-- Choose One --</option>
          <option value="0">Select Mission</option>
          <option value="TOURISM">FOR TOURISM / RECREATION</option>
          <option value="BUSINESS">BUSINESS</option>
        </select>
      </body></html>
    `)
    const select = dom.window.document.getElementById('test_sel') as HTMLSelectElement
    const opts = Array.from(select.options)

    assert(isPlaceholderOption(opts[0]) === true, 'Test 1.1: "Select Purpose" recognized as placeholder')
    assert(isPlaceholderOption(opts[1]) === true, 'Test 1.2: "-- Choose One --" recognized as placeholder')
    assert(isPlaceholderOption(opts[2]) === true, 'Test 1.3: "0 - Select Mission" recognized as placeholder')
    assert(isPlaceholderOption(opts[3]) === false, 'Test 1.4: Real TOURISM option recognized as valid non-placeholder')
    assert(isPlaceholderOption(opts[4]) === false, 'Test 1.5: Real BUSINESS option recognized as valid non-placeholder')

    const validOpts = getSelectOptions(select)
    assert(validOpts.length === 2, `Test 1.6: getSelectOptions returns 2 valid options (got ${validOpts.length})`)
    assert(isSelectControlReady(select) === true, 'Test 1.7: isSelectControlReady returns true for populated select')

    const readiness = await waitForSelectReadiness(select, { targetValue: 'BUSINESS' })
    assert(readiness.ready === true, 'Test 1.8: waitForSelectReadiness returns ready: true')
    assert(readiness.matchedOption?.value === 'BUSINESS', 'Test 1.9: waitForSelectReadiness matches targetValue')
  }

  // =========================================================================
  // TEST 2 — Fresh Registration Page: 1 Single Click Fills ALL Supported Fields
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
            <option value="BD01">BANGLADESH - DHAKA (IVAC)</option>
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
      applicationId: 'app_task085_test2',
      applicantId: 'applicant_task085_1',
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
        'appl.email': { value: 'MD.JUYEL@EXAMPLE.COM', source: 'passport', isUserEdited: false },
        'appl.email_re': { value: 'MD.JUYEL@EXAMPLE.COM', source: 'passport', isUserEdited: false },
        'appl.journeydate': { value: '2026-11-20', source: 'passport', isUserEdited: false },
        'purpose': { value: 'FOR TOURISM, RECREATION AND SIGHTSEEING WITH FAMILY', source: 'passport', isUserEdited: false },
      },
      manualEdits: {},
    }

    const candRes = resolveCandidateData({
      profileId: 'applicant_task085_1',
      documents: [],
      savedApplication: savedApp,
    })

    assert(candRes.status === 'READY', 'Test 2.1: Candidate data status is READY')

    // Single Autofill Click
    const autofillRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
    })

    assert(autofillRes.filledFields === 8, `Test 2.2: Exactly 8 automated fields filled in 1 pass (got ${autofillRes.filledFields})`)
    assert(autofillRes.failedFields === 1, `Test 2.3: Exactly 1 manual field (CAPTCHA) (got ${autofillRes.failedFields})`)

    const purposeRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_visiting_purpose')
    assert(purposeRes?.status === 'filled', `Test 2.4: Purpose status is filled on first click (got "${purposeRes?.status}")`)

    const purposeSelect = dom.window.document.getElementById('purpose_id') as HTMLSelectElement
    assert(purposeSelect.value === 'TOURISM', `Test 2.5: DOM select value for purpose verified as TOURISM (got "${purposeSelect.value}")`)

    // Verify all other fields
    const countryEl = dom.window.document.getElementById('countryname_id') as HTMLSelectElement
    const missionEl = dom.window.document.getElementById('missioncode_id') as HTMLSelectElement
    const natEl = dom.window.document.getElementById('nationality_id') as HTMLSelectElement
    const dobEl = dom.window.document.getElementById('dob_id') as HTMLInputElement
    const emailEl = dom.window.document.getElementById('email_id') as HTMLInputElement
    const emailReEl = dom.window.document.getElementById('email_re_id') as HTMLInputElement
    const journeyEl = dom.window.document.getElementById('jouryney_id') as HTMLInputElement

    assert(countryEl.value === 'BANGLADESH', 'Test 2.6: Country DOM value verified')
    assert(missionEl.value === 'BD01', 'Test 2.7: Mission DOM value verified')
    assert(natEl.value === 'BANGLADESH', 'Test 2.8: Nationality DOM value verified')
    assert(dobEl.value === '14/05/1990', 'Test 2.9: DOB DOM value verified format DD/MM/YYYY')
    assert(emailEl.value === 'md.juyel@example.com', 'Test 2.10: Email DOM value verified lowercase')
    assert(emailReEl.value === 'md.juyel@example.com', 'Test 2.11: Confirm Email DOM value verified lowercase')
    assert(journeyEl.value === '20/11/2026', 'Test 2.12: Journey Date DOM value verified format DD/MM/YYYY')
  }

  // =========================================================================
  // TEST 3 — Slow / Asynchronous Portal Initialization (Delayed Purpose Options)
  // =========================================================================
  {
    const fixtureHtml = `
      <!DOCTYPE html>
      <html>
      <body>
        <form id="registration_form">
          <select id="countryname_id" name="appl.countryname"><option value="">Select Country</option><option value="BANGLADESH">BANGLADESH</option></select>
          <select id="missioncode_id" name="appl.missioncode"><option value="">Select Mission</option><option value="BD01">BANGLADESH - DHAKA</option></select>
          <select id="nationality_id" name="appl.nationality"><option value="">Select Nationality</option><option value="BANGLADESH">BANGLADESH</option></select>
          <input type="text" id="dob_id" name="appl.birthdate" value="" />
          <input type="text" id="email_id" name="appl.email" value="" />
          <input type="text" id="email_re_id" name="appl.email_re" value="" />
          <input type="text" id="jouryney_id" name="appl.journeydate" value="" />
          <!-- Purpose starts with ONLY placeholder (simulating portal AJAX loading) -->
          <select id="purpose_id" name="appl.purpose">
            <option value="">Select Purpose</option>
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
      applicationId: 'app_task085_test3',
      applicantId: 'applicant_task085_async',
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
        'purpose': { value: 'FOR MEDICAL TREATMENT OF SELF AT APPOLLO', source: 'passport', isUserEdited: false },
      },
      manualEdits: {},
    }

    const candRes = resolveCandidateData({
      profileId: 'applicant_task085_async',
      documents: [],
      savedApplication: savedApp,
    })

    // Simulate portal AJAX response arriving after 200ms
    setTimeout(() => {
      const purposeSel = dom.window.document.getElementById('purpose_id') as HTMLSelectElement
      if (purposeSel) {
        const optTourism = dom.window.document.createElement('option')
        optTourism.value = 'TOURISM'
        optTourism.text = 'FOR TOURISM / RECREATION'

        const optMedical = dom.window.document.createElement('option')
        optMedical.value = 'MED_SELF'
        optMedical.text = 'FOR MEDICAL TREATMENT OF SELF'

        const optBusiness = dom.window.document.createElement('option')
        optBusiness.value = 'BUSINESS'
        optBusiness.text = 'BUSINESS / TRADE'

        purposeSel.appendChild(optTourism)
        purposeSel.appendChild(optMedical)
        purposeSel.appendChild(optBusiness)
      }
    }, 200)

    // Execute autofill — condition waiting should catch the options populated at 200ms
    const autofillRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
    })

    assert(autofillRes.filledFields === 8, `Test 3.1: 8 fields filled in single pass despite 200ms portal delay (got ${autofillRes.filledFields})`)

    const purposeRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_visiting_purpose')
    assert(purposeRes?.status === 'filled', `Test 3.2: Async purpose status is filled (got "${purposeRes?.status}")`)

    const purposeSelect = dom.window.document.getElementById('purpose_id') as HTMLSelectElement
    assert(purposeSelect.value === 'MED_SELF', `Test 3.3: DOM select value matched MED_SELF (got "${purposeSelect.value}")`)
  }

  // =========================================================================
  // TEST 4 — Purpose Options Unavailable / Portal Timeout (Safe Failure)
  // =========================================================================
  {
    const fixtureHtml = `
      <!DOCTYPE html>
      <html><body>
        <form>
          <select id="countryname_id" name="appl.countryname"><option value="">Select Country</option><option value="BANGLADESH">BANGLADESH</option></select>
          <select id="missioncode_id" name="appl.missioncode"><option value="">Select Mission</option><option value="BD01">BANGLADESH - DHAKA</option></select>
          <select id="nationality_id" name="appl.nationality"><option value="">Select Nationality</option><option value="BANGLADESH">BANGLADESH</option></select>
          <input type="text" id="dob_id" name="appl.birthdate" value="" />
          <input type="text" id="email_id" name="appl.email" value="" />
          <input type="text" id="email_re_id" name="appl.email_re" value="" />
          <input type="text" id="jouryney_id" name="appl.journeydate" value="" />
          <!-- Purpose only has placeholder and never populates -->
          <select id="purpose_id" name="appl.purpose"><option value="">Select Purpose</option></select>
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

    const savedApp: SavedApplication = {
      applicationId: 'app_task085_timeout',
      applicantId: 'applicant_timeout',
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
        'purpose': { value: 'TOURISM AND RECREATION', source: 'passport', isUserEdited: false },
      },
      manualEdits: {},
    }

    const candRes = resolveCandidateData({
      profileId: 'applicant_timeout',
      documents: [],
      savedApplication: savedApp,
    })

    const autofillRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
    })

    const purposeRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_visiting_purpose')
    assert(purposeRes?.status === 'failed', `Test 4.1: Unavailable options reports status: failed (got "${purposeRes?.status}")`)
    assert(purposeRes?.failureType === 'option-not-found', `Test 4.2: Unavailable options failureType is option-not-found (got "${purposeRes?.failureType}")`)
    assert(autofillRes.filledFields === 7, `Test 4.3: 7 other fields filled correctly (got ${autofillRes.filledFields})`)
  }

  // =========================================================================
  // TEST 5 — Missing Purpose in SavedApplication
  // =========================================================================
  {
    const fixtureHtml = `
      <!DOCTYPE html>
      <html><body>
        <form>
          <select id="countryname_id" name="appl.countryname"><option value="">Select Country</option><option value="BANGLADESH">BANGLADESH</option></select>
          <select id="missioncode_id" name="appl.missioncode"><option value="">Select Mission</option><option value="BD01">BANGLADESH - DHAKA</option></select>
          <select id="nationality_id" name="appl.nationality"><option value="">Select Nationality</option><option value="BANGLADESH">BANGLADESH</option></select>
          <input type="text" id="dob_id" name="appl.birthdate" value="" />
          <input type="text" id="email_id" name="appl.email" value="" />
          <input type="text" id="email_re_id" name="appl.email_re" value="" />
          <input type="text" id="jouryney_id" name="appl.journeydate" value="" />
          <select id="purpose_id" name="appl.purpose"><option value="">Select Purpose</option><option value="TOURISM">FOR TOURISM</option></select>
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

    const savedApp: SavedApplication = {
      applicationId: 'app_task085_missing',
      applicantId: 'applicant_missing',
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

    const candRes = resolveCandidateData({
      profileId: 'applicant_missing',
      documents: [],
      savedApplication: savedApp,
    })

    const autofillRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
    })

    const purposeRes = autofillRes.results.find((r) => r.fieldId === 'bd_reg_visiting_purpose')
    assert(purposeRes?.status === 'skipped', `Test 5.1: Missing purpose status is skipped (got "${purposeRes?.status}")`)
    assert(purposeRes?.failureType === 'source-data-missing', `Test 5.2: Missing purpose failureType is source-data-missing (got "${purposeRes?.failureType}")`)
  }

  // =========================================================================
  // TEST 6 — Second Click Idempotency
  // =========================================================================
  {
    const fixtureHtml = `
      <!DOCTYPE html>
      <html><body>
        <form>
          <select id="countryname_id" name="appl.countryname"><option value="">Select Country</option><option value="BANGLADESH">BANGLADESH</option></select>
          <select id="missioncode_id" name="appl.missioncode"><option value="">Select Mission</option><option value="BD01">BANGLADESH - DHAKA</option></select>
          <select id="nationality_id" name="appl.nationality"><option value="">Select Nationality</option><option value="BANGLADESH">BANGLADESH</option></select>
          <input type="text" id="dob_id" name="appl.birthdate" value="" />
          <input type="text" id="email_id" name="appl.email" value="" />
          <input type="text" id="email_re_id" name="appl.email_re" value="" />
          <input type="text" id="jouryney_id" name="appl.journeydate" value="" />
          <select id="purpose_id" name="appl.purpose"><option value="">Select Purpose</option><option value="TOURISM">FOR TOURISM / RECREATION</option></select>
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

    const savedApp: SavedApplication = {
      applicationId: 'app_task085_idemp',
      applicantId: 'applicant_idemp',
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
      profileId: 'applicant_idemp',
      documents: [],
      savedApplication: savedApp,
    })

    // First Click: fills everything
    const firstRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
    })
    assert(firstRes.filledFields === 8, `Test 6.1: First click fills 8 fields (got ${firstRes.filledFields})`)

    // Second Click: harmless & idempotent
    const secondRes = await executeAutofill({
      mappings: BANGLADESH_REGISTRATION_MAPPINGS,
      applicant: candRes.applicant!,
    })
    assert(secondRes.filledFields === 0, `Test 6.2: Second click fills 0 new fields (got ${secondRes.filledFields})`)
    assert(secondRes.skippedFields === 8, `Test 6.3: Second click skips 8 already matching fields (got ${secondRes.skippedFields})`)
  }

  console.log(`Task 085 test suite finished with ${failures.length} failures out of ${totalSubtests} assertions.`)

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
