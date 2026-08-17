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

  return {
    passed: failures.length === 0,
    testCount,
    failures,
  }
}
