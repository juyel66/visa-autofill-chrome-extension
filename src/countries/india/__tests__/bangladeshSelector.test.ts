import { BANGLADESH_VISA_MAPPINGS } from '../mappings/bangladeshVisa'
import { BANGLADESH_VISA_SELECTORS } from '../selectors/bangladeshVisa'
import { REGULAR_VISA_MAPPINGS } from '../mappings/regularVisa'
import { getIndiaVisaMappings } from '../mappingService'
import { detectIndiaVisaPage } from '../detector'
import { arePagesEquivalent, normalizePageIdentity } from '../canonicalPages'
import { resolveElement, resolveElements } from '../../../core/autofill/selectorResolver'

export function runBangladeshSelectorTests(): { passed: boolean; testCount: number; failures: string[] } {
  const failures: string[] = []
  let testCount = 0

  // Test 1: Registration Page Canonical Identity Resolution
  testCount++
  const regCanonical = normalizePageIdentity('/visa/Registration')
  const regAltCanonical = normalizePageIdentity('application-start')
  if (
    regCanonical !== 'registration' ||
    regAltCanonical !== 'registration' ||
    !arePagesEquivalent('/visa/Registration', 'application-start')
  ) {
    failures.push(`Test 1 Failed: Registration page did not resolve to canonical identity 'registration'. Got '${regCanonical}' / '${regAltCanonical}'`)
  }

  // Test 2: BasicDetails Page Canonical Identity Resolution
  testCount++
  const basicCanonical = normalizePageIdentity('/visa/BasicDetails')
  const basicAltCanonical = normalizePageIdentity('personal-details')
  if (
    basicCanonical !== 'basic-details' ||
    basicAltCanonical !== 'basic-details' ||
    !arePagesEquivalent('/visa/BasicDetails', 'personal-details')
  ) {
    failures.push(`Test 2 Failed: BasicDetails page did not resolve to canonical identity 'basic-details'. Got '${basicCanonical}' / '${basicAltCanonical}'`)
  }

  // Test 3: Bangladesh Selector Configuration Selection without Core Side-Effects
  testCount++
  const bdMappings = getIndiaVisaMappings('regular', 'registration', 'indianvisa-bangladesh.nic.in')
  const standardMappings = getIndiaVisaMappings('regular', 'registration', 'indianvisaonline.gov.in')
  if (bdMappings.length === 0 || bdMappings === standardMappings || !BANGLADESH_VISA_SELECTORS.applyingFromCountry) {
    failures.push('Test 3 Failed: Bangladesh selector configuration was not correctly isolated from standard India mappings.')
  }

  // Test 4: Unsupported Domain Mapping Rejection
  testCount++
  const unsupportedDetection = detectIndiaVisaPage({
    hostname: 'unsupported-domain.org',
    pathname: '/visa/Registration',
  })
  if (unsupportedDetection.matched) {
    failures.push('Test 4 Failed: Unsupported domain was mapped to Bangladesh/India.')
  }

  // Test 5: CAPTCHA Manual-Only Security Enforcement
  testCount++
  const bdCaptchaMapping = BANGLADESH_VISA_MAPPINGS.find((m) => m.targetField === 'captcha')
  if (!bdCaptchaMapping || bdCaptchaMapping.sourceType !== 'manual') {
    failures.push('Test 5 Failed: CAPTCHA field mapping in Bangladesh configuration is not marked sourceType: manual.')
  }

  // Test 6: Existing India Portal Configuration Integrity
  testCount++
  const standardRegMappings = getIndiaVisaMappings('regular', 'registration', 'indianvisaonline.gov.in')
  const standardSurnameMapping = REGULAR_VISA_MAPPINGS.find((m) => m.id === 'form_surname')
  if (standardRegMappings.length === 0 || !standardSurnameMapping || standardSurnameMapping.status !== 'verified') {
    failures.push('Test 6 Failed: Existing standard India portal mappings were corrupted or modified.')
  }

  // Test 7: Unknown Selectors Return Safe Not-Found Result
  testCount++
  const nonExistentElements = resolveElements({ strategy: 'id', value: 'non_existent_element_xyz_123' })
  const nonExistentElement = resolveElement({ strategy: 'id', value: 'non_existent_element_xyz_123' })
  if (nonExistentElements.length !== 0 || nonExistentElement !== null) {
    failures.push('Test 7 Failed: Unknown selector did not return safe empty array / null result.')
  }

  // Test 8: No Fake Verified Bangladesh Selector Without Evidence
  testCount++
  const verifiedAutomatedBD = BANGLADESH_VISA_MAPPINGS.filter(
    (m) => m.sourceType !== 'manual' && m.status === 'verified'
  )
  if (verifiedAutomatedBD.length > 0) {
    failures.push(`Test 8 Failed: Found ${verifiedAutomatedBD.length} automated Bangladesh mapping(s) falsely marked as verified without evidence.`)
  }

  return {
    passed: failures.length === 0,
    testCount,
    failures,
  }
}
