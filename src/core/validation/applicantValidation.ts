import type { ApplicantProfile } from '../applicant/types'
import type { ValidationError, ValidationResult } from './validation.types'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidDateFormat(dateStr: string): boolean {
  if (!dateStr || dateStr.trim() === '') return true
  if (!DATE_REGEX.test(dateStr)) return false
  const dateObj = new Date(dateStr)
  return !isNaN(dateObj.getTime())
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
 * Optional omitted fields remain valid (partial profiles supported).
 */
export function validateApplicant(applicant: ApplicantProfile): ValidationResult {
  const errors: ValidationError[] = []

  if (!applicant) {
    return {
      valid: false,
      errors: [{ field: 'applicant', message: 'Applicant profile data is missing.' }],
    }
  }

  // 1. Applicant ID
  if (!applicant.applicantId || applicant.applicantId.trim() === '') {
    errors.push({ field: 'applicantId', message: 'Applicant ID is required.' })
  }

  // 2. Personal Information
  if (isWhitespaceOnly(applicant.personalInfo?.surname)) {
    errors.push({
      field: 'personalInfo.surname',
      message: 'Surname cannot consist only of whitespace.',
    })
  }

  if (isWhitespaceOnly(applicant.personalInfo?.givenNames)) {
    errors.push({
      field: 'personalInfo.givenNames',
      message: 'Given names cannot consist only of whitespace.',
    })
  }

  if (
    applicant.personalInfo?.dateOfBirth &&
    !isValidDateFormat(applicant.personalInfo.dateOfBirth)
  ) {
    errors.push({
      field: 'personalInfo.dateOfBirth',
      message: 'Date of birth must be formatted as YYYY-MM-DD.',
    })
  }

  // 3. Passport Information
  if (isWhitespaceOnly(applicant.passport?.passportNumber)) {
    errors.push({
      field: 'passport.passportNumber',
      message: 'Passport number cannot consist only of whitespace.',
    })
  }

  const issueDateValid = isValidDateFormat(applicant.passport?.issueDate || '')
  if (applicant.passport?.issueDate && !issueDateValid) {
    errors.push({
      field: 'passport.issueDate',
      message: 'Passport issue date must be formatted as YYYY-MM-DD.',
    })
  }

  const expiryDateValid = isValidDateFormat(applicant.passport?.expiryDate || '')
  if (applicant.passport?.expiryDate && !expiryDateValid) {
    errors.push({
      field: 'passport.expiryDate',
      message: 'Passport expiry date must be formatted as YYYY-MM-DD.',
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
    if (expiryTime < issueTime) {
      errors.push({
        field: 'passport.expiryDate',
        message: 'Passport expiry date must be on or after the issue date.',
      })
    }
  }

  // 4. Contact Information
  if (applicant.contact?.email && !isValidEmail(applicant.contact.email)) {
    errors.push({
      field: 'contact.email',
      message: 'Please enter a valid email address.',
    })
  }

  if (isWhitespaceOnly(applicant.contact?.mobile)) {
    errors.push({
      field: 'contact.mobile',
      message: 'Mobile number cannot consist only of whitespace.',
    })
  }

  // 5. Travel Information
  const arrivalDateValid = isValidDateFormat(applicant.travel?.intendedArrivalDate || '')
  if (applicant.travel?.intendedArrivalDate && !arrivalDateValid) {
    errors.push({
      field: 'travel.intendedArrivalDate',
      message: 'Intended arrival date must be formatted as YYYY-MM-DD.',
    })
  }

  const departureDateValid = isValidDateFormat(applicant.travel?.intendedDepartureDate || '')
  if (applicant.travel?.intendedDepartureDate && !departureDateValid) {
    errors.push({
      field: 'travel.intendedDepartureDate',
      message: 'Intended departure date must be formatted as YYYY-MM-DD.',
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
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
