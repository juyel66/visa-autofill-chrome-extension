import { BANGLADESH_VISA_MAPPINGS, BANGLADESH_REGISTRATION_MAPPINGS, BANGLADESH_BASIC_DETAILS_MAPPINGS } from '../mappings/bangladesh'
import { BANGLADESH_VISA_SELECTORS, BANGLADESH_REGISTRATION_SELECTORS, BANGLADESH_BASIC_DETAILS_SELECTORS } from '../selectors/bangladesh'
import { REGULAR_VISA_MAPPINGS } from '../mappings/regularVisa'
import { getIndiaVisaMappings } from '../mappingService'
import { detectIndiaVisaPage } from '../detector'
import { arePagesEquivalent, normalizePageIdentity, CANONICAL_INDIA_VISA_PAGES } from '../canonicalPages'
import { resolveElement, resolveElements } from '../../../core/autofill/selectorResolver'
import { INDIA_COUNTRY_CONFIG } from '../config'

export function runBangladeshSelectorTests(): { passed: boolean; testCount: number; failures: string[] } {
  const failures: string[] = []
  let testCount = 0

  // Test A: Bangladesh domain is supported
  testCount++
  if (!INDIA_COUNTRY_CONFIG.supportedDomains.includes('indianvisa-bangladesh.nic.in')) {
    failures.push("Test A Failed: 'indianvisa-bangladesh.nic.in' is not in INDIA_COUNTRY_CONFIG.supportedDomains.")
  }

  // Test B: indianvisa-bangladesh.nic.in/visa/Registration resolves to REGISTRATION
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
    failures.push(`Test B Failed: Registration page did not resolve to canonical REGISTRATION. Got detection.page='${regDetection.page}', norm='${regCanonical}'`)
  }

  // Test C: indianvisa-bangladesh.nic.in/visa/BasicDetails resolves to BASIC_DETAILS
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
    failures.push(`Test C Failed: BasicDetails page did not resolve to canonical BASIC_DETAILS. Got detection.page='${basicDetection.page}', norm='${basicCanonical}'`)
  }

  // Test D: Unsupported domains are rejected
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
    failures.push('Test D Failed: Unsupported / lookalike domains were not rejected.')
  }

  // Test E: Registration mapping resolves to REGISTRATION
  testCount++
  const regMappings = getIndiaVisaMappings('regular', 'REGISTRATION', 'indianvisa-bangladesh.nic.in')
  const regMappingsLegacy = getIndiaVisaMappings('regular', 'registration', 'indianvisa-bangladesh.nic.in')
  if (
    regMappings.length === 0 ||
    regMappings.length !== BANGLADESH_REGISTRATION_MAPPINGS.length ||
    regMappings.length !== regMappingsLegacy.length ||
    !regMappings.every((m) => arePagesEquivalent(m.page, 'REGISTRATION'))
  ) {
    failures.push(`Test E Failed: Registration mappings failed to resolve to REGISTRATION. Got ${regMappings.length} mappings.`)
  }

  // Test F: BasicDetails mapping resolves to BASIC_DETAILS
  testCount++
  const basicMappings = getIndiaVisaMappings('regular', 'BASIC_DETAILS', 'indianvisa-bangladesh.nic.in')
  const basicMappingsLegacy = getIndiaVisaMappings('regular', 'basic-details', 'indianvisa-bangladesh.nic.in')
  if (
    basicMappings.length === 0 ||
    basicMappings.length !== BANGLADESH_BASIC_DETAILS_MAPPINGS.length ||
    basicMappings.length !== basicMappingsLegacy.length ||
    !basicMappings.every((m) => arePagesEquivalent(m.page, 'BASIC_DETAILS'))
  ) {
    failures.push(`Test F Failed: BasicDetails mappings failed to resolve to BASIC_DETAILS. Got ${basicMappings.length} mappings.`)
  }

  // Test G: Unknown selectors are NOT marked verified (no fake verified Bangladesh selectors)
  testCount++
  const fakeVerifiedBD = BANGLADESH_VISA_MAPPINGS.filter((m) => m.status === 'verified')
  if (fakeVerifiedBD.length > 0) {
    failures.push(`Test G Failed: Found ${fakeVerifiedBD.length} Bangladesh mapping(s) falsely marked as 'verified'.`)
  }
  const unverifiedFields = BANGLADESH_VISA_MAPPINGS.filter((m) => m.status === 'needs-verification')
  if (unverifiedFields.length === 0) {
    failures.push('Test G Failed: Expected fields to be marked as needs-verification.')
  }

  // Test H: Manual fields remain manual-required
  testCount++
  const captchaMapping = BANGLADESH_VISA_MAPPINGS.find((m) => m.targetField === 'captcha')
  const missionMapping = BANGLADESH_VISA_MAPPINGS.find((m) => m.targetField === 'indian_mission')
  const arrivalMapping = BANGLADESH_VISA_MAPPINGS.find((m) => m.targetField === 'arr_date')
  if (
    !captchaMapping || captchaMapping.status !== 'manual-required' ||
    !missionMapping || missionMapping.status !== 'manual-required' ||
    !arrivalMapping || arrivalMapping.status !== 'manual-required'
  ) {
    failures.push('Test H Failed: Manual/application-specific fields are not marked as status: manual-required.')
  }

  // Test I: Existing selector resolver mechanics test (without declaring live portal verified)
  testCount++
  const nonExistentElements = resolveElements({ strategy: 'id', value: 'non_existent_element_xyz_123' })
  const nonExistentElement = resolveElement({ strategy: 'id', value: 'non_existent_element_xyz_123' })
  if (nonExistentElements.length !== 0 || nonExistentElement !== null) {
    failures.push('Test I Failed: Unknown selector did not return safe empty array / null result.')
  }

  // Test J: Existing India portal tests & configuration integrity
  testCount++
  const standardRegMappings = getIndiaVisaMappings('regular', 'REGISTRATION', 'indianvisaonline.gov.in')
  const standardSurnameMapping = REGULAR_VISA_MAPPINGS.find((m) => m.id === 'form_surname')
  if (standardRegMappings.length === 0 || !standardSurnameMapping || standardSurnameMapping.status !== 'verified') {
    failures.push('Test J Failed: Existing standard India portal mappings were corrupted or modified.')
  }

  // Test K: Candidate selector priority structure
  testCount++
  if (
    !BANGLADESH_VISA_SELECTORS.applyingFromCountry ||
    !BANGLADESH_REGISTRATION_SELECTORS.applyingFromCountry ||
    !BANGLADESH_REGISTRATION_SELECTORS.nationality ||
    !BANGLADESH_BASIC_DETAILS_SELECTORS.surname ||
    !BANGLADESH_BASIC_DETAILS_SELECTORS.passportNumber
  ) {
    failures.push('Test K Failed: Bangladesh candidate selector objects are missing expected properties.')
  }

  return {
    passed: failures.length === 0,
    testCount,
    failures,
  }
}
