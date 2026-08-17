import type { ApplicantProfile } from '../applicant/types'
import type { ValidationError, ValidationResult } from './validation.types'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Strict check for real calendar dates.
 * Enforces YYYY-MM-DD format and rejects Rollover dates (e.g. 2026-02-30).
 */
export function isValidCalendarDate(dateStr: string): boolean {
  if (!dateStr || dateStr.trim() === '') return true
  const trimmed = dateStr.trim()
  if (!DATE_REGEX.test(trimmed)) return false

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false

  const y = parseInt(match[1], 10)
  const m = parseInt(match[2], 10) - 1 // 0-indexed month
  const d = parseInt(match[3], 10)

  const dateObj = new Date(Date.UTC(y, m, d))
  return (
    dateObj.getUTCFullYear() === y &&
    dateObj.getUTCMonth() === m &&
    dateObj.getUTCDate() === d
  )
}

function isValidDateFormat(dateStr: string): boolean {
  return isValidCalendarDate(dateStr)
}

function isValidEmail(emailStr: string): boolean {
  if (!emailStr || emailStr.trim() === '') return true
  return EMAIL_REGEX.test(emailStr.trim())
}

function isWhitespaceOnly(val?: string): boolean {
  if (val === undefined || val === null) return false
  return val.length > 0 && val.trim().length === 0
}

/**
 * Validates a generic ApplicantProfile object.
 * Performs structural, date format, email syntax, and passport expiry checks.
 */
export function validateApplicant(applicant: ApplicantProfile): ValidationResult {
  const errors: ValidationError[] = []

  if (!applicant) {
    return {
      valid: false,
      errors: [
        {
          field: 'applicant',
          message: 'Applicant profile data is missing.',
          errorCode: 'applicant-profile-missing',
          safeMessage: 'Applicant profile data is missing.',
        },
      ],
    }
  }

  // 1. Applicant ID
  if (!applicant.applicantId || applicant.applicantId.trim() === '') {
    errors.push({
      field: 'applicantId',
      message: 'Applicant ID is required.',
      errorCode: 'applicant-id-required',
      safeMessage: 'Applicant ID is required.',
    })
  }

  // 2. Personal Information
  if (isWhitespaceOnly(applicant.personalInfo?.surname)) {
    errors.push({
      field: 'personalInfo.surname',
      message: 'Surname cannot consist only of whitespace.',
      errorCode: 'surname-whitespace-only',
      safeMessage: 'Surname cannot consist only of whitespace.',
    })
  }

  if (isWhitespaceOnly(applicant.personalInfo?.givenNames)) {
    errors.push({
      field: 'personalInfo.givenNames',
      message: 'Given names cannot consist only of whitespace.',
      errorCode: 'given-names-whitespace-only',
      safeMessage: 'Given names cannot consist only of whitespace.',
    })
  }

  if (applicant.personalInfo?.dateOfBirth) {
    if (!isValidDateFormat(applicant.personalInfo.dateOfBirth)) {
      errors.push({
        field: 'personalInfo.dateOfBirth',
        message: 'Date of birth must be a valid calendar date in YYYY-MM-DD format.',
        errorCode: 'date-of-birth-invalid',
        safeMessage: 'Date of birth must be a valid calendar date in YYYY-MM-DD format.',
      })
    }
  }

  // 3. Passport Information
  if (isWhitespaceOnly(applicant.passport?.passportNumber)) {
    errors.push({
      field: 'passport.passportNumber',
      message: 'Passport number cannot consist only of whitespace.',
      errorCode: 'passport-number-whitespace-only',
      safeMessage: 'Passport number cannot consist only of whitespace.',
    })
  }

  const issueDateValid = isValidDateFormat(applicant.passport?.issueDate || '')
  if (applicant.passport?.issueDate && !issueDateValid) {
    errors.push({
      field: 'passport.issueDate',
      message: 'Passport issue date must be a valid calendar date in YYYY-MM-DD format.',
      errorCode: 'passport-issue-date-invalid',
      safeMessage: 'Passport issue date must be a valid calendar date in YYYY-MM-DD format.',
    })
  }

  const expiryDateValid = isValidDateFormat(applicant.passport?.expiryDate || '')
  if (applicant.passport?.expiryDate && !expiryDateValid) {
    errors.push({
      field: 'passport.expiryDate',
      message: 'Passport expiry date must be a valid calendar date in YYYY-MM-DD format.',
      errorCode: 'passport-expiry-date-invalid',
      safeMessage: 'Passport expiry date must be a valid calendar date in YYYY-MM-DD format.',
    })
  }

  // Passport Expiry vs Issue Date check
  if (
    applicant.passport?.issueDate &&
    applicant.passport?.expiryDate &&
    issueDateValid &&
    expiryDateValid
  ) {
    const issueTime = new Date(applicant.passport.issueDate).getTime()
    const expiryTime = new Date(applicant.passport.expiryDate).getTime()
    if (expiryTime <= issueTime) {
      errors.push({
        field: 'passport.expiryDate',
        message: 'Passport expiry date must be after the issue date.',
        errorCode: 'passport-expiry-before-issue',
        safeMessage: 'Passport expiry date must be after the issue date.',
      })
      errors.push({
        field: 'passport.issueDate',
        message: 'Passport issue date must be before the expiry date.',
        errorCode: 'passport-issue-after-expiry',
        safeMessage: 'Passport issue date must be before the expiry date.',
      })
    }
  }

  // 4. Contact Information
  if (applicant.contact?.email && !isValidEmail(applicant.contact.email)) {
    errors.push({
      field: 'contact.email',
      message: 'Please enter a valid email address.',
      errorCode: 'contact-email-invalid',
      safeMessage: 'Please enter a valid email address.',
    })
  }

  if (isWhitespaceOnly(applicant.contact?.mobile)) {
    errors.push({
      field: 'contact.mobile',
      message: 'Mobile number cannot consist only of whitespace.',
      errorCode: 'contact-mobile-whitespace-only',
      safeMessage: 'Mobile number cannot consist only of whitespace.',
    })
  }

  // 5. Travel Information
  const arrivalDateValid = isValidDateFormat(applicant.travel?.intendedArrivalDate || '')
  if (applicant.travel?.intendedArrivalDate && !arrivalDateValid) {
    errors.push({
      field: 'travel.intendedArrivalDate',
      message: 'Intended arrival date must be a valid calendar date in YYYY-MM-DD format.',
      errorCode: 'travel-arrival-date-invalid',
      safeMessage: 'Intended arrival date must be a valid calendar date in YYYY-MM-DD format.',
    })
  }

  const departureDateValid = isValidDateFormat(applicant.travel?.intendedDepartureDate || '')
  if (applicant.travel?.intendedDepartureDate && !departureDateValid) {
    errors.push({
      field: 'travel.intendedDepartureDate',
      message: 'Intended departure date must be a valid calendar date in YYYY-MM-DD format.',
      errorCode: 'travel-departure-date-invalid',
      safeMessage: 'Intended departure date must be a valid calendar date in YYYY-MM-DD format.',
    })
  }

  if (
    applicant.travel?.intendedArrivalDate &&
    applicant.travel?.intendedDepartureDate &&
    arrivalDateValid &&
    departureDateValid
  ) {
    const arrivalTime = new Date(applicant.travel.intendedArrivalDate).getTime()
    const departureTime = new Date(applicant.travel.intendedDepartureDate).getTime()
    if (departureTime < arrivalTime) {
      errors.push({
        field: 'travel.intendedDepartureDate',
        message: 'Departure date must be on or after the arrival date.',
        errorCode: 'travel-departure-before-arrival',
        safeMessage: 'Departure date must be on or after the arrival date.',
      })
      errors.push({
        field: 'travel.intendedArrivalDate',
        message: 'Arrival date must be on or before the departure date.',
        errorCode: 'travel-arrival-after-departure',
        safeMessage: 'Arrival date must be on or before the departure date.',
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
