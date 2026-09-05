import {
  BANGLADESH_VISA_MAPPINGS,
  BANGLADESH_REGISTRATION_MAPPINGS,
  BANGLADESH_BASIC_DETAILS_MAPPINGS,
  BANGLADESH_FAMILY_DETAILS_MAPPINGS,
  BANGLADESH_VISA_DETAILS_MAPPINGS,
  BANGLADESH_ADDITIONAL_QUESTIONS_MAPPINGS,
  BANGLADESH_PHOTO_UPLOAD_MAPPINGS,
} from '../mappings/bangladesh'
import {
  BANGLADESH_VISA_SELECTORS,
  BANGLADESH_REGISTRATION_SELECTORS,
  BANGLADESH_BASIC_DETAILS_SELECTORS,
  BANGLADESH_FAMILY_DETAILS_SELECTORS,
  BANGLADESH_VISA_DETAILS_SELECTORS,
  BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS,
  BANGLADESH_PHOTO_UPLOAD_SELECTORS,
  BANGLADESH_FIELD_REGISTRY,
  getBangladeshPageControls,
  getBangladeshVerifiedFieldsCount,
} from '../selectors/bangladesh'
import { REGULAR_VISA_MAPPINGS } from '../mappings/regularVisa'
import { getIndiaVisaMappings } from '../mappingService'
import { detectIndiaVisaPage } from '../detector'
import { arePagesEquivalent, normalizePageIdentity, CANONICAL_INDIA_VISA_PAGES } from '../canonicalPages'
import { resolveElement, resolveElements } from '../../../core/autofill/selectorResolver'
import { INDIA_COUNTRY_CONFIG } from '../config'
import {
  BANGLADESH_REGISTRATION_FIXTURE_HTML,
  BANGLADESH_BASIC_DETAILS_FIXTURE_HTML,
  BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML,
  BANGLADESH_VISA_DETAILS_FIXTURE_HTML,
  BANGLADESH_ADDITIONAL_QUESTIONS_FIXTURE_HTML,
  BANGLADESH_PHOTO_UPLOAD_FIXTURE_HTML,
} from './fixtures'
import { applyExtractionToApplicant } from '../../../core/extraction/data/extractionMapper'
import { executeAutofill } from '../../../core/autofill/autofillEngine'
import { getCoverageMatrixStats } from '../coverageMatrix'

import type { IndiaFieldSelector } from '../mapping.types'

export async function runBangladeshSelectorTests(): Promise<{ passed: boolean; testCount: number; failures: string[] }> {
  const failures: string[] = []
  let testCount = 0

  // Test 1: Bangladesh domain is supported
  testCount++
  if (!INDIA_COUNTRY_CONFIG.supportedDomains.includes('indianvisa-bangladesh.nic.in')) {
    failures.push("Test 1 Failed: 'indianvisa-bangladesh.nic.in' is not in INDIA_COUNTRY_CONFIG.supportedDomains.")
  }

  // Test 2: Canonical Page Detection for all 6 Bangladesh pages
  testCount++
  const pagesToTest: Array<{ path: string; expected: string }> = [
    { path: '/visa/Registration', expected: CANONICAL_INDIA_VISA_PAGES.REGISTRATION },
    { path: '/visa/BasicDetails', expected: CANONICAL_INDIA_VISA_PAGES.BASIC_DETAILS },
    { path: '/visa/FamilyDetails', expected: CANONICAL_INDIA_VISA_PAGES.FAMILY_DETAILS },
    { path: '/visa/VisaDetails', expected: CANONICAL_INDIA_VISA_PAGES.TRAVEL_DETAILS },
    { path: '/visa/AdditionalQuestions', expected: CANONICAL_INDIA_VISA_PAGES.ADDITIONAL_QUESTIONS },
    { path: '/visa/PhotoUpload', expected: CANONICAL_INDIA_VISA_PAGES.DOCUMENT_UPLOAD },
  ]

  for (const item of pagesToTest) {
    const detection = detectIndiaVisaPage({
      hostname: 'indianvisa-bangladesh.nic.in',
      pathname: item.path,
      href: `https://indianvisa-bangladesh.nic.in${item.path}`,
    })
    const canonical = normalizePageIdentity(item.path)
    if (!detection.matched || !arePagesEquivalent(detection.page, item.expected) || !arePagesEquivalent(canonical, item.expected)) {
      failures.push(`Test 2 Failed: Path '${item.path}' did not resolve to '${item.expected}'. Got detection='${detection.page}', norm='${canonical}'`)
    }
  }

  // Test 3: Mapping service returns Bangladesh mappings for each page
  testCount++
  const regMappings = getIndiaVisaMappings('regular', 'REGISTRATION', 'indianvisa-bangladesh.nic.in')
  const basicMappings = getIndiaVisaMappings('regular', 'BASIC_DETAILS', 'indianvisa-bangladesh.nic.in')
  const familyMappings = getIndiaVisaMappings('regular', 'FAMILY_DETAILS', 'indianvisa-bangladesh.nic.in')
  const visaMappings = getIndiaVisaMappings('regular', 'TRAVEL_DETAILS', 'indianvisa-bangladesh.nic.in')
  const qMappings = getIndiaVisaMappings('regular', 'ADDITIONAL_QUESTIONS', 'indianvisa-bangladesh.nic.in')
  const docMappings = getIndiaVisaMappings('regular', 'DOCUMENT_UPLOAD', 'indianvisa-bangladesh.nic.in')

  if (
    regMappings.length !== BANGLADESH_REGISTRATION_MAPPINGS.length ||
    basicMappings.length !== BANGLADESH_BASIC_DETAILS_MAPPINGS.length ||
    familyMappings.length !== BANGLADESH_FAMILY_DETAILS_MAPPINGS.length ||
    visaMappings.length !== BANGLADESH_VISA_DETAILS_MAPPINGS.length ||
    qMappings.length !== BANGLADESH_ADDITIONAL_QUESTIONS_MAPPINGS.length ||
    docMappings.length !== BANGLADESH_PHOTO_UPLOAD_MAPPINGS.length ||
    !BANGLADESH_VISA_SELECTORS.applyingFromCountry ||
    !BANGLADESH_VISA_SELECTORS.surname ||
    REGULAR_VISA_MAPPINGS.length === 0
  ) {
    failures.push('Test 3 Failed: Mapping service returned unexpected mapping counts for Bangladesh pages.')
  }


  // Test 4: Registration verified selectors resolve in fixture
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

  // Test 5: BasicDetails verified selectors resolve in fixture
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

  // Test 6: FamilyDetails verified selectors resolve in fixture
  testCount++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML
    for (const [key, selector] of Object.entries(BANGLADESH_FAMILY_DETAILS_SELECTORS)) {
      const el = resolveElement(selector)
      if (!el) {
        failures.push(`Test 6 Failed: FamilyDetails selector for '${key}' failed to resolve in fixture.`)
      }
    }
  }

  // Test 7: VisaDetails verified selectors resolve in fixture
  testCount++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_VISA_DETAILS_FIXTURE_HTML
    for (const [key, selector] of Object.entries(BANGLADESH_VISA_DETAILS_SELECTORS)) {
      const el = resolveElement(selector)
      if (!el) {
        failures.push(`Test 7 Failed: VisaDetails selector for '${key}' failed to resolve in fixture.`)
      }
    }
  }

  // Test 8: AdditionalQuestions verified selectors resolve in fixture
  testCount++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_ADDITIONAL_QUESTIONS_FIXTURE_HTML
    for (const [key, selector] of Object.entries(BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS)) {
      const el = resolveElement(selector)
      if (!el) {
        failures.push(`Test 8 Failed: AdditionalQuestions selector for '${key}' failed to resolve in fixture.`)
      }
    }
  }

  // Test 9: PhotoUpload selectors resolve in fixture
  testCount++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_PHOTO_UPLOAD_FIXTURE_HTML
    for (const [key, selector] of Object.entries(BANGLADESH_PHOTO_UPLOAD_SELECTORS)) {
      const el = resolveElement(selector)
      if (!el) {
        failures.push(`Test 9 Failed: PhotoUpload selector for '${key}' failed to resolve in fixture.`)
      }
    }
  }

  // Test 10: Verified selectors uniquely resolve (1 match per field in respective page)
  testCount++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = BANGLADESH_REGISTRATION_FIXTURE_HTML
    for (const [key, selector] of Object.entries(BANGLADESH_REGISTRATION_SELECTORS)) {
      const matches = resolveElements(selector)
      if (matches.length !== 1) {
        failures.push(`Test 10 Failed: Registration selector for '${key}' resolved to ${matches.length} elements (expected 1).`)
      }
    }

    document.body.innerHTML = BANGLADESH_BASIC_DETAILS_FIXTURE_HTML
    for (const [key, selector] of Object.entries(BANGLADESH_BASIC_DETAILS_SELECTORS)) {
      const matches = resolveElements(selector)
      if (matches.length !== 1) {
        failures.push(`Test 10 Failed: BasicDetails selector for '${key}' resolved to ${matches.length} elements (expected 1).`)
      }
    }
  }

  // Test 11: CAPTCHA is strictly manual-required
  testCount++
  const captchaMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.targetField === 'captcha')
  if (!captchaMapping || captchaMapping.status !== 'manual-required' || captchaMapping.sourceType !== 'manual') {
    failures.push("Test 11 Failed: CAPTCHA mapping is not strictly status: 'manual-required' and sourceType: 'manual'.")
  }

  // Test 12: Normal fields are marked status: 'verified'
  testCount++
  const regDob = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_dob')
  const basicSurname = BANGLADESH_BASIC_DETAILS_MAPPINGS.find((m) => m.id === 'bd_basic_surname')
  const familyFather = BANGLADESH_FAMILY_DETAILS_MAPPINGS.find((m) => m.id === 'bd_family_father_name')
  if (
    !regDob || regDob.status !== 'verified' ||
    !basicSurname || basicSurname.status !== 'verified' ||
    !familyFather || familyFather.status !== 'verified'
  ) {
    failures.push("Test 12 Failed: Normal form fields should have status: 'verified'.")
  }

  // Test 13: Registry contains registered controls for all 6 pages
  testCount++
  const totalVerifiedCount = getBangladeshVerifiedFieldsCount()
  const regControls = getBangladeshPageControls('REGISTRATION')
  const basicControls = getBangladeshPageControls('BASIC_DETAILS')
  const familyControls = getBangladeshPageControls('FAMILY_DETAILS')
  const travelControls = getBangladeshPageControls('TRAVEL_DETAILS')
  const qControls = getBangladeshPageControls('ADDITIONAL_QUESTIONS')
  const photoControls = getBangladeshPageControls('DOCUMENT_UPLOAD')

  if (
    totalVerifiedCount !== 107 ||
    regControls.length !== 8 ||
    basicControls.length !== 20 ||
    familyControls.length !== 39 ||
    travelControls.length !== 27 ||
    qControls.length !== 21 ||
    photoControls.length !== 4 ||
    BANGLADESH_FIELD_REGISTRY.length !== 119
  ) {
    failures.push(`Test 13 Failed: Registry did not return expected control counts. Total verified: ${totalVerifiedCount}, total: ${BANGLADESH_FIELD_REGISTRY.length}`)
  }

  // Helper to extract primary DOM selector string
  function getPrimarySelector(selector: IndiaFieldSelector | IndiaFieldSelector[] | undefined): string {
    if (!selector) return ''
    const primary = Array.isArray(selector) ? selector[0] : selector
    if (primary.strategy === 'id') return `#${primary.value}`
    if (primary.strategy === 'css') return primary.value
    if (primary.strategy === 'name') return `[name="${primary.value}"]`
    return ''
  }

  // Test 14: Submit buttons and technical controls are not mapped for autofill
  testCount++
  const continueMapping = BANGLADESH_VISA_MAPPINGS.find((m) => m.targetField === 'continue' || m.targetField === 'exit' || m.targetField === 'upload')
  if (continueMapping) {
    failures.push('Test 14 Failed: Submit/Exit/Upload buttons must not be included in automated field mappings.')
  }

  // Test 15: Unsupported / lookalike domains remain rejected
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
    failures.push('Test 15 Failed: Unsupported / lookalike domains were not rejected.')
  }

  // Test 16: Coverage matrix validates against registry controls
  testCount++
  const stats = getCoverageMatrixStats()
  if (
    stats.total !== 119 ||
    stats.verifiedAutofillable !== 106 ||
    stats.securityManual !== 6 ||
    stats.technicalIgnored !== 7 ||
    stats.directlyExtracted !== 66
  ) {
    failures.push(
      `Test 16 Failed: Coverage matrix stats mismatch. Got total=${stats.total}, autofillable=${stats.verifiedAutofillable}, manual=${stats.securityManual}, technical=${stats.technicalIgnored}, extracted=${stats.directlyExtracted}.`
    )
  }

  // Test 17: Zero Profile Fallback Rule (applyExtractionToApplicant isolates confirmed data)
  testCount++
  const originalProfile = {
    applicantId: 'test-app-1',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    personalInfo: {
      surname: 'OLD_SURNAME',
      givenNames: 'OLD_GIVEN',
      religion: 'OLD_RELIGION',
    },
    passport: {
      passportNumber: 'OLD_PPT',
    },
  }
  const extractedConfirmed = {
    personal: {
      lastName: { value: 'RAHMAN', source: 'mrz' as const, confidence: 95 },
    },
    passport: {
      passportNumber: { value: 'A12345678', source: 'mrz' as const, confidence: 98 },
    },
  }
  const mappedProfile = applyExtractionToApplicant(originalProfile, extractedConfirmed)
  if (
    mappedProfile.personalInfo?.surname !== 'RAHMAN' ||
    mappedProfile.passport?.passportNumber !== 'A12345678' ||
    mappedProfile.personalInfo?.givenNames !== undefined ||
    mappedProfile.personalInfo?.religion !== undefined
  ) {
    failures.push('Test 17 Failed: applyExtractionToApplicant did not strictly isolate confirmed document data.')
  }

  // Test 18: Missing extracted source causes skip without DOM mutation
  testCount++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `
      <div>
        <input type="text" id="religion" name="appl.religion" value="EXISTING_USER_INPUT" />
        <input type="text" id="surname" name="appl.surname" value="" />
      </div>
    `
    const religionInput = document.getElementById('religion') as HTMLInputElement
    const surnameInput = document.getElementById('surname') as HTMLInputElement

    // Autofill with candidate profile that lacks religion
    const singleMapping = BANGLADESH_BASIC_DETAILS_MAPPINGS.find((m) => m.id === 'bd_basic_surname')!
    const religionMapping = BANGLADESH_BASIC_DETAILS_MAPPINGS.find((m) => m.id === 'bd_basic_religion')!

    await executeAutofill({
      mappings: [singleMapping, religionMapping],
      applicant: mappedProfile,
    })

    if (surnameInput.value !== 'RAHMAN') {
      failures.push(`Test 18 Failed: Surname was not filled. Got '${surnameInput.value}'`)
    }
    if (religionInput.value !== 'EXISTING_USER_INPUT') {
      failures.push(`Test 18 Failed: Field with missing source was mutated. Got '${religionInput.value}'`)
    }
  }

  // Test 19: Date normalization transform (isoDateToDdMmYyyy)
  testCount++
  const dobProfile = {
    applicantId: 'test-dob',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    personalInfo: {
      dateOfBirth: '1990-05-15',
    },
  }
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '<input type="text" id="dob_id" name="appl.birthdate" value="" />'
    const dobInput = document.getElementById('dob_id') as HTMLInputElement
    const dobMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_dob')!
    await executeAutofill({
      mappings: [dobMapping],
      applicant: dobProfile,
    })
    if (dobInput.value !== '15/05/1990') {
      failures.push(`Test 19 Failed: Date was not formatted to DD/MM/YYYY. Got '${dobInput.value}'`)
    }
  }

  // Test 20: Select options matching
  testCount++
  const genderProfile = {
    applicantId: 'test-gender',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    personalInfo: {
      gender: 'male' as const,
    },
  }
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `
      <select id="gender" name="appl.applsex">
        <option value="">Select Gender</option>
        <option value="M">MALE</option>
        <option value="F">FEMALE</option>
      </select>
    `
    const genderSelect = document.getElementById('gender') as HTMLSelectElement
    const genderMapping = BANGLADESH_BASIC_DETAILS_MAPPINGS.find((m) => m.id === 'bd_basic_gender')!
    await executeAutofill({
      mappings: [genderMapping],
      applicant: genderProfile,
    })
    if (genderSelect.value !== 'M') {
      failures.push(`Test 20 Failed: Select gender option was not matched. Got '${genderSelect.value}'`)
    }
  }

  // Test 21: Consistency Audit - Every mapping selector exists in the canonical Bangladesh registry
  testCount++
  const registrySelectors = new Set(BANGLADESH_FIELD_REGISTRY.map((r) => getPrimarySelector(r.selectors)))
  for (const m of BANGLADESH_VISA_MAPPINGS) {
    const sel = getPrimarySelector(m.selector)
    if (sel && !registrySelectors.has(sel)) {
      failures.push(`Test 21 Failed: Mapping ${m.id} uses selector '${sel}' which is not in BANGLADESH_FIELD_REGISTRY.`)
    }
  }

  // Test 22: Obsolete selector prohibition - No mapping or registry control uses obsolete/synthetic selectors
  testCount++
  const obsoleteSelectors = ['#dob', '#nationality', '#applicant_surname', '#city_of_birth', '#indian_mission', '#arr_date']
  for (const m of BANGLADESH_VISA_MAPPINGS) {
    const sel = getPrimarySelector(m.selector)
    if (sel && obsoleteSelectors.includes(sel)) {
      failures.push(`Test 22 Failed: Mapping ${m.id} references obsolete selector '${sel}'.`)
    }
  }
  for (const r of BANGLADESH_FIELD_REGISTRY) {
    const sel = getPrimarySelector(r.selectors)
    if (obsoleteSelectors.includes(sel)) {
      failures.push(`Test 22 Failed: Registry field ${r.controlId} references obsolete selector '${sel}'.`)
    }
  }

  // Test 23: Registration DOB is strictly #dob_id and Nationality is strictly #nationality_id
  testCount++
  const regDobMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_dob')
  const regNatMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_nationality')
  const regDobSel = getPrimarySelector(regDobMapping?.selector)
  const regNatSel = getPrimarySelector(regNatMapping?.selector)
  if (regDobSel !== '#dob_id') {
    failures.push(`Test 23 Failed: Registration DOB selector must be '#dob_id'. Got '${regDobSel}'`)
  }
  if (regNatSel !== '#nationality_id') {
    failures.push(`Test 23 Failed: Registration Nationality selector must be '#nationality_id'. Got '${regNatSel}'`)
  }
  // Verify Basic Details does not contain DOB or Nationality
  const basicDobControl = BANGLADESH_FIELD_REGISTRY.find((r) => r.page === 'BASIC_DETAILS' && getPrimarySelector(r.selectors) === '#dob')
  const basicNatControl = BANGLADESH_FIELD_REGISTRY.find((r) => r.page === 'BASIC_DETAILS' && getPrimarySelector(r.selectors) === '#nationality')
  if (basicDobControl || basicNatControl) {
    failures.push('Test 23 Failed: Basic Details must not contain fake #dob or #nationality controls.')
  }

  // Test 24: Select Option Mismatch Safety - Does NOT select arbitrary options when value is missing
  testCount++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `
      <select id="country_birth" name="appl.country_of_birth">
        <option value="">Select Country of Birth...</option>
        <option value="BGD">BANGLADESH</option>
        <option value="IND">INDIA</option>
      </select>
    `
    const countrySelect = document.getElementById('country_birth') as HTMLSelectElement
    const mismatchedProfile = {
      applicantId: 'test-mismatch',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      personalInfo: {
        countryOfBirth: 'NON_EXISTENT_COUNTRY',
      },
    }
    const countryMapping = BANGLADESH_BASIC_DETAILS_MAPPINGS.find((m) => m.id === 'bd_basic_country_of_birth')!
    await executeAutofill({
      mappings: [countryMapping],
      applicant: mismatchedProfile,
    })
    if (countrySelect.value !== '') {
      failures.push(`Test 24 Failed: Mismatched select option selected an arbitrary value '${countrySelect.value}'. Expected ''`)
    }
  }

  // Test 25: Extracted Nationality reaches #nationality_id on Registration
  testCount++
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `
      <select id="nationality_id" name="appl.nationality">
        <option value="">Select Nationality...</option>
        <option value="BGD">BANGLADESH</option>
        <option value="IND">INDIA</option>
      </select>
    `
    const natSelect = document.getElementById('nationality_id') as HTMLSelectElement
    const natProfile = {
      applicantId: 'test-nat',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      personalInfo: {
        nationality: 'Bangladesh',
      },
    }
    await executeAutofill({
      mappings: [regNatMapping!],
      applicant: natProfile,
    })
    if (natSelect.value !== 'BGD') {
      failures.push(`Test 25 Failed: Extracted nationality did not select 'BGD' in #nationality_id. Got '${natSelect.value}'`)
    }
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





