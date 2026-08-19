import { calculateIndiaCoverageSummary, INDIA_FIELD_COVERAGE_REGISTRY } from '../compatibility'
import { detectIndiaVisaPage } from '../detector'

export function runIndiaCompatibilityTests(): { passed: boolean; testCount: number; failures: string[] } {
  const failures: string[] = []
  let testCount = 0

  // Test 1: Page Detector - India Domain Matching
  testCount++
  const matchResult = detectIndiaVisaPage({
    hostname: 'indianvisaonline.gov.in',
    pathname: '/visa/registration',
    href: 'https://indianvisaonline.gov.in/visa/registration',
    title: 'Indian Visa Online',
  })
  if (!matchResult.matched || matchResult.country !== 'india' || matchResult.flow !== 'regular') {
    failures.push('Test 1 Failed: Page detector did not identify Indian Visa portal regular flow.')
  }

  // Test 2: Page Detector - Non-India Domain Rejection
  testCount++
  const nonMatchResult = detectIndiaVisaPage({
    hostname: 'example.com',
    pathname: '/form',
    href: 'https://example.com/form',
  })
  if (nonMatchResult.matched) {
    failures.push('Test 2 Failed: Page detector incorrectly matched non-India domain.')
  }

  // Test 3: Coverage Summary Calculator Metrics
  testCount++
  const summary = calculateIndiaCoverageSummary()
  if (summary.totalFields === 0 || summary.totalPages === 0) {
    failures.push('Test 3 Failed: Coverage summary calculated empty pages/fields.')
  }

  // Test 4: Manual Security Boundaries
  testCount++
  const captchaItem = INDIA_FIELD_COVERAGE_REGISTRY.find((f) => f.fieldId === 'captcha_field')
  if (!captchaItem || captchaItem.status !== 'manual-only') {
    failures.push('Test 4 Failed: CAPTCHA field boundary is not marked manual-only.')
  }

  // Test 5: Field Registry Primary Selectors Presence
  testCount++
  const invalidSelectors = INDIA_FIELD_COVERAGE_REGISTRY.filter((f) => !f.primarySelector)
  if (invalidSelectors.length > 0) {
    failures.push('Test 5 Failed: Some registry field coverage items lack primary selectors.')
  }

  // Test 6: Bangladesh India Visa Domain Matching
  testCount++
  const bdDomainMatch = detectIndiaVisaPage({
    hostname: 'indianvisa-bangladesh.nic.in',
    pathname: '/visa/BasicDetails',
    href: 'https://indianvisa-bangladesh.nic.in/visa/BasicDetails',
    title: 'Indian Visa Online',
  })
  if (!bdDomainMatch.matched || bdDomainMatch.country !== 'india' || bdDomainMatch.flow !== 'regular') {
    failures.push('Test 6 Failed: Page detector did not identify Bangladesh Indian Visa portal regular flow.')
  }

  // Test 7: Bangladesh India Visa BasicDetails Detection
  testCount++
  if (bdDomainMatch.page !== 'personal-details') {
    failures.push(`Test 7 Failed: Expected page 'personal-details' for BasicDetails, got '${bdDomainMatch.page}'`)
  }

  // Test 8: Bangladesh India Visa Registration Detection
  testCount++
  const bdRegMatch = detectIndiaVisaPage({
    hostname: 'indianvisa-bangladesh.nic.in',
    pathname: '/visa/Registration',
    href: 'https://indianvisa-bangladesh.nic.in/visa/Registration',
    title: 'Indian Visa Online',
  })
  if (!bdRegMatch.matched || bdRegMatch.page !== 'application-start') {
    failures.push(`Test 8 Failed: Expected page 'application-start' for Registration, got '${bdRegMatch.page}'`)
  }

  // Test 9: Unrelated .nic.in Domain Rejection
  testCount++
  const unrelatedNicMatch = detectIndiaVisaPage({
    hostname: 'unrelated-site.nic.in',
    pathname: '/visa/BasicDetails',
    href: 'https://unrelated-site.nic.in/visa/BasicDetails',
  })
  if (unrelatedNicMatch.matched) {
    failures.push('Test 9 Failed: Page detector incorrectly matched unrelated .nic.in domain.')
  }

  // Test 10: Unsupported path handling on supported domain
  testCount++
  const unsupportedPathMatch = detectIndiaVisaPage({
    hostname: 'indianvisa-bangladesh.nic.in',
    pathname: '/visa/someunknownpath',
    href: 'https://indianvisa-bangladesh.nic.in/visa/someunknownpath',
  })
  if (!unsupportedPathMatch.matched || unsupportedPathMatch.page !== 'unknown') {
    failures.push(`Test 10 Failed: Expected page 'unknown' for unsupported path on supported domain, got '${unsupportedPathMatch.page}'`)
  }

  // Test 11: Malicious Lookalike Domain Rejection
  testCount++
  const lookalikeMatch = detectIndiaVisaPage({
    hostname: 'evilindianvisa-bangladesh.nic.in',
    pathname: '/visa/BasicDetails',
    href: 'https://evilindianvisa-bangladesh.nic.in/visa/BasicDetails',
  })
  if (lookalikeMatch.matched) {
    failures.push('Test 11 Failed: Page detector incorrectly matched lookalike domain (evilindianvisa-bangladesh.nic.in).')
  }

  return {
    passed: failures.length === 0,
    testCount,
    failures,
  }
}
