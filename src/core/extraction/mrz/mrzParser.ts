import { MRZ_CHECK_DIGIT_WEIGHTS, TD3_LINE_COUNT, TD3_LINE_LENGTH } from './mrzConstants'
import type {
  MrzCheckDigitResult,
  MrzParseError,
  MrzParseResult,
  MrzSex,
  PassportMrzData,
} from './types'

/**
 * Gets numerical weight value for an MRZ character according to ICAO Doc 9303.
 * 0-9 -> 0-9
 * A-Z -> 10-35
 * <   -> 0
 */
function getMrzCharValue(char: string): number {
  if (char >= '0' && char <= '9') {
    return char.charCodeAt(0) - 48
  }
  if (char >= 'A' && char <= 'Z') {
    return char.charCodeAt(0) - 65 + 10
  }
  return 0
}

/**
 * Calculates check digit for a string according to ICAO Doc 9303 algorithm.
 */
export function calculateMrzCheckDigit(value: string): number {
  let sum = 0
  for (let i = 0; i < value.length; i++) {
    const charValue = getMrzCharValue(value[i])
    const weight = MRZ_CHECK_DIGIT_WEIGHTS[i % 3]
    sum += charValue * weight
  }
  return sum % 10
}

/**
 * Validates check digit against expected character.
 */
export function validateMrzCheckDigit(
  value: string,
  expectedChar: string
): MrzCheckDigitResult {
  const calculated = calculateMrzCheckDigit(value)
  const expected = parseInt(expectedChar, 10)
  const valid = !isNaN(expected) && calculated === expected

  return {
    valid,
    calculated,
    expected: isNaN(expected) ? -1 : expected,
  }
}

/**
 * Converts 6-digit MRZ date (YYMMDD) to ISO YYYY-MM-DD format.
 * Documented century rule:
 * - Date of Birth (isExpiry=false): If YY > currentYear%100, 19YY; else 20YY.
 * - Expiry Date (isExpiry=true): Default 20YY.
 */
export function parseMrzDate(
  yymmdd: string,
  isExpiry = false
): { isoDate: string; valid: boolean; warning?: string } {
  if (!/^\d{6}$/.test(yymmdd)) {
    return { isoDate: '', valid: false, warning: 'Date string must contain exactly 6 digits.' }
  }

  const yy = parseInt(yymmdd.slice(0, 2), 10)
  const mm = parseInt(yymmdd.slice(2, 4), 10)
  const dd = parseInt(yymmdd.slice(4, 6), 10)

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return { isoDate: '', valid: false, warning: 'Invalid month or day numbers in date.' }
  }

  const currentYear = new Date().getFullYear()
  const currentYY = currentYear % 100

  let fullYear: number
  if (isExpiry) {
    fullYear = 2000 + yy
  } else {
    fullYear = yy > currentYY ? 1900 + yy : 2000 + yy
  }

  const mmStr = mm.toString().padStart(2, '0')
  const ddStr = dd.toString().padStart(2, '0')
  const isoDate = `${fullYear}-${mmStr}-${ddStr}`

  // Calendar validity check
  const testDate = new Date(isoDate)
  if (isNaN(testDate.getTime())) {
    return { isoDate: '', valid: false, warning: 'Parsed date is not a valid calendar date.' }
  }

  return { isoDate, valid: true }
}

/**
 * Parses surname and given names from TD3 Line 1 name field.
 * Example: "DOE<<JOHN<TEST<<<<<<<<<<<<<<<<<<<<<<"
 * Surname: "DOE", Given Names: "JOHN TEST"
 */
function parseMrzNames(nameField: string): { surname: string; givenNames: string } {
  const parts = nameField.split('<<')
  const rawSurname = parts[0] || ''
  const rawGiven = parts.slice(1).join('<<')

  const surname = rawSurname.replace(/</g, ' ').trim()
  
  // Replace single < with space, strip trailing fillers
  const givenParts = rawGiven.split('<').filter((p) => p.length > 0)
  const givenNames = givenParts.join(' ').trim()

  return { surname, givenNames }
}

/**
 * Parses raw text input into a structured PassportMrzData result.
 * Supports ICAO Doc 9303 TD3 format (2 lines x 44 characters).
 */
export function parsePassportMrz(rawInput: string): MrzParseResult {
  const errors: MrzParseError[] = []
  const warnings: string[] = []

  if (!rawInput || rawInput.trim() === '') {
    return {
      success: false,
      format: 'TD3',
      errors: [{ code: 'empty-input', message: 'MRZ input is empty.' }],
      warnings: [],
    }
  }

  // 1. Normalize line breaks and filter empty lines
  const lines = rawInput
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim().toUpperCase())
    .filter((l) => l.length > 0)

  if (lines.length !== TD3_LINE_COUNT) {
    return {
      success: false,
      format: 'TD3',
      rawLines: lines,
      errors: [
        {
          code: 'invalid-line-count',
          message: `Expected ${TD3_LINE_COUNT} MRZ lines, but received ${lines.length}.`,
        },
      ],
      warnings: [],
    }
  }

  const line1 = lines[0]
  const line2 = lines[1]

  // 2. Validate line length
  if (line1.length !== TD3_LINE_LENGTH || line2.length !== TD3_LINE_LENGTH) {
    if (line1.length !== TD3_LINE_LENGTH) {
      errors.push({
        code: 'invalid-line-length',
        field: 'line1',
        message: `Line 1 length is ${line1.length} characters (expected ${TD3_LINE_LENGTH}).`,
      })
    }
    if (line2.length !== TD3_LINE_LENGTH) {
      errors.push({
        code: 'invalid-line-length',
        field: 'line2',
        message: `Line 2 length is ${line2.length} characters (expected ${TD3_LINE_LENGTH}).`,
      })
    }
    return {
      success: false,
      format: 'TD3',
      rawLines: lines,
      errors,
      warnings,
    }
  }

  // 3. Validate MRZ characters [A-Z0-9<]
  const mrzCharRegex = /^[A-Z0-9<]+$/
  if (!mrzCharRegex.test(line1) || !mrzCharRegex.test(line2)) {
    errors.push({
      code: 'invalid-character',
      message: 'MRZ contains invalid characters outside A-Z, 0-9, or filler <.',
    })
    return {
      success: false,
      format: 'TD3',
      rawLines: lines,
      errors,
      warnings,
    }
  }

  // 4. Parse Line 1
  const documentCodeRaw = line1.slice(0, 2)
  const documentCode = documentCodeRaw.replace(/</g, '').trim()
  const issuingCountry = line1.slice(2, 5).replace(/</g, '').trim()

  if (!documentCode.startsWith('P')) {
    warnings.push(`Document code "${documentCode}" does not start with expected passport indicator "P".`)
  }

  const nameField = line1.slice(5, 44)
  const { surname, givenNames } = parseMrzNames(nameField)

  // 5. Parse Line 2
  const rawPassportNumber = line2.slice(0, 9)
  const passportNumber = rawPassportNumber.replace(/</g, '').trim()
  const passportNumCheckDigitChar = line2[9]
  const passportNumberCheckDigit = validateMrzCheckDigit(rawPassportNumber, passportNumCheckDigitChar)

  if (!passportNumberCheckDigit.valid) {
    errors.push({
      code: 'invalid-check-digit',
      field: 'passportNumber',
      message: `Passport number check digit validation failed (calculated ${passportNumberCheckDigit.calculated}, expected ${passportNumCheckDigitChar}).`,
    })
  }

  const nationality = line2.slice(10, 13).replace(/</g, '').trim()

  const rawDob = line2.slice(13, 19)
  const dobCheckDigitChar = line2[19]
  const dateOfBirthCheckDigit = validateMrzCheckDigit(rawDob, dobCheckDigitChar)

  if (!dateOfBirthCheckDigit.valid) {
    errors.push({
      code: 'invalid-check-digit',
      field: 'dateOfBirth',
      message: `Date of birth check digit validation failed (calculated ${dateOfBirthCheckDigit.calculated}, expected ${dobCheckDigitChar}).`,
    })
  }

  const dobParsed = parseMrzDate(rawDob, false)
  if (!dobParsed.valid) {
    errors.push({
      code: 'invalid-date',
      field: 'dateOfBirth',
      message: dobParsed.warning || 'Invalid date of birth format.',
    })
  } else if (dobParsed.warning) {
    warnings.push(dobParsed.warning)
  }

  const sexChar = line2[20]
  let sex: MrzSex = 'unspecified'
  if (sexChar === 'M') sex = 'male'
  else if (sexChar === 'F') sex = 'female'
  else if (sexChar !== '<') {
    warnings.push(`Unexpected sex character "${sexChar}". Defaulting to unspecified.`)
  }

  const rawExpiry = line2.slice(21, 27)
  const expiryCheckDigitChar = line2[27]
  const passportExpiryCheckDigit = validateMrzCheckDigit(rawExpiry, expiryCheckDigitChar)

  if (!passportExpiryCheckDigit.valid) {
    errors.push({
      code: 'invalid-check-digit',
      field: 'passportExpiryDate',
      message: `Passport expiry check digit validation failed (calculated ${passportExpiryCheckDigit.calculated}, expected ${expiryCheckDigitChar}).`,
    })
  }

  const expiryParsed = parseMrzDate(rawExpiry, true)
  if (!expiryParsed.valid) {
    errors.push({
      code: 'invalid-date',
      field: 'passportExpiryDate',
      message: expiryParsed.warning || 'Invalid passport expiry date format.',
    })
  } else if (expiryParsed.warning) {
    warnings.push(expiryParsed.warning)
  }

  const rawPersonalNumber = line2.slice(28, 42)
  const personalNumber = rawPersonalNumber.replace(/</g, '').trim()
  const personalNumCheckDigitChar = line2[42]
  const personalNumberCheckDigit = validateMrzCheckDigit(rawPersonalNumber, personalNumCheckDigitChar)

  // Composite check digit calculation: Line2[0..10] + Line2[13..20] + Line2[21..43]
  const compositeString = line2.slice(0, 10) + line2.slice(13, 20) + line2.slice(21, 43)
  const compositeCheckDigitChar = line2[43]
  const compositeCheckDigit = validateMrzCheckDigit(compositeString, compositeCheckDigitChar)

  if (!compositeCheckDigit.valid) {
    errors.push({
      code: 'invalid-composite-check-digit',
      field: 'compositeCheckDigit',
      message: `Composite check digit validation failed (calculated ${compositeCheckDigit.calculated}, expected ${compositeCheckDigitChar}).`,
    })
  }

  const parsedData: PassportMrzData = {
    documentCode,
    issuingCountry,
    surname,
    givenNames,
    passportNumber,
    passportNumberCheckDigit,
    nationality,
    dateOfBirth: dobParsed.isoDate,
    dateOfBirthCheckDigit,
    sex,
    passportExpiryDate: expiryParsed.isoDate,
    passportExpiryCheckDigit,
    personalNumber: personalNumber || undefined,
    personalNumberCheckDigit: personalNumber ? personalNumberCheckDigit : undefined,
    compositeCheckDigit,
  }

  const hasFatalErrors = errors.some(
    (e) =>
      e.code === 'invalid-line-count' ||
      e.code === 'invalid-line-length' ||
      e.code === 'invalid-character' ||
      e.code === 'invalid-date'
  )

  return {
    success: !hasFatalErrors,
    format: 'TD3',
    data: parsedData,
    errors,
    warnings,
    rawLines: lines,
  }
}
