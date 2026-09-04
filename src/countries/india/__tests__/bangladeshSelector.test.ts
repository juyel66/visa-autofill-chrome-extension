import { BANGLADESH_VISA_MAPPINGS, BANGLADESH_REGISTRATION_MAPPINGS, BANGLADESH_BASIC_DETAILS_MAPPINGS } from '../mappings/bangladesh'
import { BANGLADESH_VISA_SELECTORS, BANGLADESH_REGISTRATION_SELECTORS, BANGLADESH_BASIC_DETAILS_SELECTORS } from '../selectors/bangladesh'
import { REGULAR_VISA_MAPPINGS } from '../mappings/regularVisa'
import { getIndiaVisaMappings } from '../mappingService'
import { detectIndiaVisaPage } from '../detector'
import { arePagesEquivalent, normalizePageIdentity, CANONICAL_INDIA_VISA_PAGES } from '../canonicalPages'
import { resolveElement, resolveElements } from '../../../core/autofill/selectorResolver'
import { INDIA_COUNTRY_CONFIG } from '../config'
import { BANGLADESH_REGISTRATION_FIXTURE_HTML, BANGLADESH_BASIC_DETAILS_FIXTURE_HTML } from './fixtures'

export function runBangladeshSelectorTests(): { passed: boolean; testCount: number; failures: string[] } {
  const failures: string[] = []
  let testCount = 0

  // Test 1: Bangladesh domain is supported
  testCount++
  if (!INDIA_COUNTRY_CONFIG.supportedDomains.includes('indianvisa-bangladesh.nic.in')) {
    failures.push("Test 1 Failed: 'indianvisa-bangladesh.nic.in' is not in INDIA_COUNTRY_CONFIG.supportedDomains.")
  }

  // Test 2: /visa/Registration resolves correctly to REGISTRATION
  testCount++
  const regDetection = detectIndiaVisaPage({
    hostname: 'indianvisa-bangladesh.nic.in',
    pathname: '/visa/Registration',
    href: 'https://indianvisa-bangladesh.nic.in/visa/Registration',
  })
  const regCanonical = normalizePageIdentity('/visa/Registration')
  const regLowerCanonical = normalizePageIdentity('registration')
  const regLegacyCanonical = normalizePageIdentity('application-start')
  if (
    !regDetection.matched ||
    regDetection.page !== 'REGISTRATION' ||
    regCanonical !== 'REGISTRATION' ||
    regLowerCanonical !== 'REGISTRATION' ||
    regLegacyCanonical !== 'REGISTRATION' ||
    !arePagesEquivalent(regDetection.page, CANONICAL_INDIA_VISA_PAGES.REGISTRATION) ||
    !arePagesEquivalent('/visa/Registration', 'application-start')
  ) {
    failures.push(`Test 2 Failed: Registration page did not resolve to canonical REGISTRATION. Got detection.page='${regDetection.page}', norm='${regCanonical}'`)
  }

  // Test 3: /visa/BasicDetails resolves correctly to BASIC_DETAILS
  testCount++
  const basicDetection = detectIndiaVisaPage({
    hostname: 'indianvisa-bangladesh.nic.in',
    pathname: '/visa/BasicDetails',
    href: 'https://indianvisa-bangladesh.nic.in/visa/BasicDetails',
  })
  const basicCanonical = normalizePageIdentity('/visa/BasicDetails')
  const basicLowerCanonical = normalizePageIdentity('basic-details')
  const basicLegacyCanonical = normalizePageIdentity('personal-details')
  if (
    !basicDetection.matched ||
    basicDetection.page !== 'BASIC_DETAILS' ||
    basicCanonical !== 'BASIC_DETAILS' ||
    basicLowerCanonical !== 'BASIC_DETAILS' ||
    basicLegacyCanonical !== 'BASIC_DETAILS' ||
    !arePagesEquivalent(basicDetection.page, CANONICAL_INDIA_VISA_PAGES.BASIC_DETAILS) ||
    !arePagesEquivalent('/visa/BasicDetails', 'personal-details')
  ) {
    failures.push(`Test 3 Failed: BasicDetails page did not resolve to canonical BASIC_DETAILS. Got detection.page='${basicDetection.page}', norm='${basicCanonical}'`)
  }

  // Test 3b: Mapping service returns Bangladesh mappings for both canonical pages
  testCount++
  const regServiceMappings = getIndiaVisaMappings('regular', 'REGISTRATION', 'indianvisa-bangladesh.nic.in')
  const basicServiceMappings = getIndiaVisaMappings('regular', 'BASIC_DETAILS', 'indianvisa-bangladesh.nic.in')
  if (
    regServiceMappings.length !== BANGLADESH_REGISTRATION_MAPPINGS.length ||
    basicServiceMappings.length !== BANGLADESH_BASIC_DETAILS_MAPPINGS.length ||
    !BANGLADESH_VISA_SELECTORS.applyingFromCountry ||
    !BANGLADESH_VISA_SELECTORS.surname ||
    REGULAR_VISA_MAPPINGS.length === 0
  ) {
    failures.push('Test 3b Failed: Mapping service or selector re-exports did not return expected definitions.')
  }


  // Test 4: Registration candidate selectors resolve against Registration fixture
  testCount++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_REGISTRATION_FIXTURE_HTML
    for (const [key, selector] of Object.entries(BANGLADESH_REGISTRATION_SELECTORS)) {
      const el = resolveElement(selector)
      if (!el) {
        failures.push(`Test 4 Failed: Registration selector for '${key}' failed to resolve in fixture.`)
      }
    }
  }

  // Test 5: BasicDetails candidate selectors resolve against BasicDetails fixture
  testCount++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_BASIC_DETAILS_FIXTURE_HTML
    for (const [key, selector] of Object.entries(BANGLADESH_BASIC_DETAILS_SELECTORS)) {
      const el = resolveElement(selector)
      if (!el) {
        failures.push(`Test 5 Failed: BasicDetails selector for '${key}' failed to resolve in fixture.`)
      }
    }
  }

  // Test 6: Verified / candidate selectors uniquely resolve (single matching element per field)
  testCount++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_REGISTRATION_FIXTURE_HTML
    for (const [key, selector] of Object.entries(BANGLADESH_REGISTRATION_SELECTORS)) {
      const matches = resolveElements(selector)
      if (matches.length !== 1) {
        failures.push(`Test 6 Failed: Registration selector for '${key}' resolved to ${matches.length} elements (expected 1).`)
      }
    }
    document.body.innerHTML = BANGLADESH_BASIC_DETAILS_FIXTURE_HTML
    for (const [key, selector] of Object.entries(BANGLADESH_BASIC_DETAILS_SELECTORS)) {
      const matches = resolveElements(selector)
      if (matches.length !== 1) {
        failures.push(`Test 6 Failed: BasicDetails selector for '${key}' resolved to ${matches.length} elements (expected 1).`)
      }
    }
  }

  // Test 7: Select fields resolve to actual <select> controls
  testCount++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_REGISTRATION_FIXTURE_HTML
    const countryEl = resolveElement(BANGLADESH_REGISTRATION_SELECTORS.applyingFromCountry)
    const missionEl = resolveElement(BANGLADESH_REGISTRATION_SELECTORS.indianMission)
    const natEl = resolveElement(BANGLADESH_REGISTRATION_SELECTORS.nationality)
    if (!countryEl || countryEl.tagName !== 'SELECT' || !missionEl || missionEl.tagName !== 'SELECT' || !natEl || natEl.tagName !== 'SELECT') {
      failures.push('Test 7 Failed: Registration select controls did not resolve to <select> elements.')
    }

    document.body.innerHTML = BANGLADESH_BASIC_DETAILS_FIXTURE_HTML
    const religionEl = resolveElement(BANGLADESH_BASIC_DETAILS_SELECTORS.religion)
    const eduEl = resolveElement(BANGLADESH_BASIC_DETAILS_SELECTORS.educationalQualification)
    const countryBirthEl = resolveElement(BANGLADESH_BASIC_DETAILS_SELECTORS.countryOfBirth)
    if (!religionEl || religionEl.tagName !== 'SELECT' || !eduEl || eduEl.tagName !== 'SELECT' || !countryBirthEl || countryBirthEl.tagName !== 'SELECT') {
      failures.push('Test 7 Failed: BasicDetails select controls did not resolve to <select> elements.')
    }
  }

  // Test 8: Radio fields resolve correctly
  testCount++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `
      <form id="radio_form">
        <label><input type="radio" name="gender" id="gender_m" value="M" /> Male</label>
        <label><input type="radio" name="gender" id="gender_f" value="F" /> Female</label>
      </form>
    `
    const radioElements = resolveElements(BANGLADESH_BASIC_DETAILS_SELECTORS.gender)
    if (radioElements.length !== 2 || !radioElements.every((el) => (el as HTMLInputElement).type === 'radio')) {
      failures.push(`Test 8 Failed: Gender radio controls failed to resolve. Found ${radioElements.length} elements.`)
    }
  }

  // Test 9: Date fields resolve to the actual control type
  testCount++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_REGISTRATION_FIXTURE_HTML
    const dobRegEl = resolveElement(BANGLADESH_REGISTRATION_SELECTORS.dateOfBirth)
    if (!dobRegEl || dobRegEl.tagName !== 'INPUT') {
      failures.push('Test 9 Failed: Registration dob did not resolve to an <input> element.')
    }

    document.body.innerHTML = BANGLADESH_BASIC_DETAILS_FIXTURE_HTML
    const dobBasicEl = resolveElement(BANGLADESH_BASIC_DETAILS_SELECTORS.dateOfBirth)
    const issueDateEl = resolveElement(BANGLADESH_BASIC_DETAILS_SELECTORS.issueDate)
    const expiryDateEl = resolveElement(BANGLADESH_BASIC_DETAILS_SELECTORS.expiryDate)
    if (!dobBasicEl || dobBasicEl.tagName !== 'INPUT' || !issueDateEl || issueDateEl.tagName !== 'INPUT' || !expiryDateEl || expiryDateEl.tagName !== 'INPUT') {
      failures.push('Test 9 Failed: BasicDetails date fields did not resolve to <input> elements.')
    }
  }

  // Test 10: CAPTCHA remains manual-required
  testCount++
  const captchaMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.targetField === 'captcha')
  if (!captchaMapping || captchaMapping.status !== 'manual-required' || captchaMapping.sourceType !== 'manual') {
    failures.push("Test 10 Failed: CAPTCHA mapping is not strictly status: 'manual-required' and sourceType: 'manual'.")
  }

  // Test 11: Manual Registration fields remain manual-required
  testCount++
  const missionMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.targetField === 'indian_mission')
  const arrivalMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.targetField === 'arr_date')
  if (
    !missionMapping || missionMapping.status !== 'manual-required' ||
    !arrivalMapping || arrivalMapping.status !== 'manual-required'
  ) {
    failures.push("Test 11 Failed: Registration manual fields ('indian_mission', 'arr_date') are not marked as status: 'manual-required'.")
  }

  // Test 12: Unknown / unverified selectors remain needs-verification
  testCount++
  const fakeVerifiedBD = BANGLADESH_VISA_MAPPINGS.filter((m) => m.status === 'verified')
  if (fakeVerifiedBD.length > 0) {
    failures.push(`Test 12 Failed: Found ${fakeVerifiedBD.length} Bangladesh mapping(s) falsely marked as 'verified'.`)
  }
  const unverifiedFields = BANGLADESH_VISA_MAPPINGS.filter((m) => m.status === 'needs-verification')
  if (unverifiedFields.length === 0) {
    failures.push('Test 12 Failed: Expected fields to be marked as needs-verification.')
  }

  // Test 13: Unsupported domains remain rejected
  testCount++
  const unsupportedDetection1 = detectIndiaVisaPage({
    hostname: 'unsupported-domain.org',
    pathname: '/visa/Registration',
  })
  const unsupportedDetection2 = detectIndiaVisaPage({
    hostname: 'fake-indianvisa-bangladesh.nic.in.attacker.com',
    pathname: '/visa/BasicDetails',
  })
  if (unsupportedDetection1.matched || unsupportedDetection2.matched) {
    failures.push('Test 13 Failed: Unsupported / lookalike domains were not rejected.')
  }

  if (typeof document !== 'undefined') {
    document.body.innerHTML = ''
  }

  return {
    passed: failures.length === 0,
    testCount,
    failures,
  }
}



