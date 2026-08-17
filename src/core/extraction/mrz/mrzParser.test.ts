import { parsePassportMrz } from './mrzParser'

/**
 * Synthetic Test Suite for Passport MRZ Parsing Engine.
 * Tests use synthetic test strings only. No real personal data.
 */
export function runSyntheticMrzTests(): boolean {
  console.log('Running synthetic MRZ engine tests...')

  // Synthetic Test Case 1: Valid 2-line TD3 MRZ
  const syntheticMrz = `P<BGDTEST<<JOHN<TEST<<<<<<<<<<<<<<<<<<<<<<\nTEST0000000BGD9001011M3001017<<<<<<<<<<<<<<02`
  
  const result = parsePassportMrz(syntheticMrz)

  if (!result.success || !result.data) {
    console.error('Synthetic Test Case 1 FAILED:', result.errors)
    return false
  }

  const d = result.data
  if (
    d.surname !== 'TEST' ||
    d.givenNames !== 'JOHN TEST' ||
    d.issuingCountry !== 'BGD' ||
    d.passportNumber !== 'TEST00000' || // First 9 chars of TEST0000000
    d.nationality !== 'BGD' ||
    d.dateOfBirth !== '1990-01-01' ||
    d.sex !== 'male' ||
    d.passportExpiryDate !== '2030-01-01'
  ) {
    console.error('Synthetic Test Case 1 Field Extraction Mismatch:', d)
    return false
  }

  // Synthetic Test Case 2: Malformed Line Length Error
  const malformedMrz = `P<BGDTEST<<JOHN<TEST<<<<<<<<<<<<\nTEST0000000BGD9001011M3001017`
  const result2 = parsePassportMrz(malformedMrz)
  if (result2.success || result2.errors[0]?.code !== 'invalid-line-length') {
    console.error('Synthetic Test Case 2 FAILED (Expected invalid-line-length):', result2)
    return false
  }

  console.log('All synthetic MRZ engine tests PASSED successfully!')
  return true
}
