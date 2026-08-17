export type MrzSex = 'male' | 'female' | 'unspecified'

export type MrzFormat = 'TD3'

export interface MrzCheckDigitResult {
  valid: boolean
  calculated: number
  expected: number
}

export interface PassportMrzData {
  documentCode: string
  issuingCountry: string
  surname: string
  givenNames: string
  passportNumber: string
  passportNumberCheckDigit: MrzCheckDigitResult
  nationality: string
  dateOfBirth: string // YYYY-MM-DD format
  dateOfBirthCheckDigit: MrzCheckDigitResult
  sex: MrzSex
  passportExpiryDate: string // YYYY-MM-DD format
  passportExpiryCheckDigit: MrzCheckDigitResult
  personalNumber?: string
  personalNumberCheckDigit?: MrzCheckDigitResult
  compositeCheckDigit: MrzCheckDigitResult
}

export interface MrzParseError {
  code: string
  message: string
  field?: string
}

export interface MrzParseResult {
  success: boolean
  format: MrzFormat
  data?: PassportMrzData
  errors: MrzParseError[]
  warnings: string[]
  rawLines?: string[]
}
