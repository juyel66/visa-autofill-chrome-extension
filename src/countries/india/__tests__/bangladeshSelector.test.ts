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
    totalVerifiedCount !== 105 ||
    regControls.length !== 8 ||
    basicControls.length !== 22 ||
    familyControls.length !== 32 ||
    travelControls.length !== 27 ||
    qControls.length !== 21 ||
    photoControls.length !== 4 ||
    BANGLADESH_FIELD_REGISTRY.length !== 114
  ) {
    failures.push(`Test 13 Failed: Registry did not return expected control counts. Total verified: ${totalVerifiedCount}`)
  }

  // Test 14: Submit buttons and technical controls are not mapped for autofill
  testCount++
  const continueMapping = BANGLADESH_VISA_MAPPINGS.find((m) => m.targetField === 'continue' || m.targetField === 'exit')
  if (continueMapping) {
    failures.push('Test 14 Failed: Submit/Exit buttons must not be included in automated field mappings.')
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
    stats.total !== 114 ||
    stats.verifiedAutofillable !== 104 ||
    stats.securityManual !== 3 ||
    stats.technicalIgnored !== 7 ||
    stats.directlyExtracted !== 12
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
        <option value="MALE">MALE</option>
        <option value="FEMALE">FEMALE</option>
      </select>
    `
    const genderSelect = document.getElementById('gender') as HTMLSelectElement
    const genderMapping = BANGLADESH_BASIC_DETAILS_MAPPINGS.find((m) => m.id === 'bd_basic_gender')!
    await executeAutofill({
      mappings: [genderMapping],
      applicant: genderProfile,
    })
    if (genderSelect.value !== 'MALE') {
      failures.push(`Test 20 Failed: Select gender option was not matched. Got '${genderSelect.value}'`)
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





