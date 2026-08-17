import type { PassportMrzData } from '../mrz/types'
import type { OcrResult } from '../ocr/types'
import type {
  ExtractedApplicantData,
  ExtractedField,
  ExtractedFieldConflict,
  ExtractionSource,
} from './types'

/**
 * Maps structured Passport MRZ data into generic candidate applicant fields.
 */
export function extractFromMrz(mrzData: PassportMrzData): ExtractedApplicantData {
  const result: ExtractedApplicantData = {}

  if (!mrzData) return result

  result.personal = {}
  result.passport = {}

  if (mrzData.surname) {
    result.personal.lastName = { value: mrzData.surname, source: 'mrz', confidence: 95 }
  }

  if (mrzData.givenNames) {
    result.personal.firstName = { value: mrzData.givenNames, source: 'mrz', confidence: 95 }
    result.personal.fullName = {
      value: `${mrzData.givenNames} ${mrzData.surname}`.trim(),
      source: 'mrz',
      confidence: 95,
    }
  }

  if (mrzData.passportNumber) {
    result.passport.passportNumber = {
      value: mrzData.passportNumber,
      source: 'mrz',
      confidence: mrzData.passportNumberCheckDigit.valid ? 98 : 70,
    }
  }

  if (mrzData.issuingCountry) {
    result.passport.issuingCountry = { value: mrzData.issuingCountry, source: 'mrz', confidence: 95 }
  }

  if (mrzData.nationality) {
    result.personal.nationality = { value: mrzData.nationality, source: 'mrz', confidence: 95 }
  }

  if (mrzData.dateOfBirth) {
    result.personal.dateOfBirth = {
      value: mrzData.dateOfBirth,
      source: 'mrz',
      confidence: mrzData.dateOfBirthCheckDigit.valid ? 98 : 70,
    }
  }

  if (mrzData.sex) {
    result.personal.gender = { value: mrzData.sex, source: 'mrz', confidence: 95 }
  }

  if (mrzData.passportExpiryDate) {
    result.passport.expiryDate = {
      value: mrzData.passportExpiryDate,
      source: 'mrz',
      confidence: mrzData.passportExpiryCheckDigit.valid ? 98 : 70,
    }
  }

  return result
}

/**
 * Extracts candidate fields from PDF raw text using conservative regex pattern matching.
 */
export function extractFromPdfText(fullText: string): ExtractedApplicantData {
  const result: ExtractedApplicantData = {}
  if (!fullText) return result

  // Passport Number: "Passport No: XXXXXX" or "Passport Number: XXXXXX"
  const pptMatch = fullText.match(/passport\s*(?:no|number)?[:\s]+([A-Z0-9]{6,12})/i)
  if (pptMatch && pptMatch[1]) {
    result.passport = {
      ...result.passport,
      passportNumber: { value: pptMatch[1].trim(), source: 'pdf-text', confidence: 85 },
    }
  }

  // Date of Birth: "Date of Birth: YYYY-MM-DD"
  const dobMatch = fullText.match(/(?:date\s*of\s*birth|dob)[:\s]+(\d{4}-\d{2}-\d{2})/i)
  if (dobMatch && dobMatch[1]) {
    result.personal = {
      ...result.personal,
      dateOfBirth: { value: dobMatch[1].trim(), source: 'pdf-text', confidence: 85 },
    }
  }

  // Email: "Email: test@example.com"
  const emailMatch = fullText.match(/(?:email|e-mail)[:\s]+([^\s@]+@[^\s@]+\.[^\s@]+)/i)
  if (emailMatch && emailMatch[1]) {
    result.contact = {
      ...result.contact,
      email: { value: emailMatch[1].trim().toLowerCase(), source: 'pdf-text', confidence: 90 },
    }
  }

  // Mobile / Phone: "Mobile: +123456789" or "Phone: +123456789"
  const mobileMatch = fullText.match(/(?:mobile|phone|tel)[:\s]+(\+?[\d\s-]{7,15})/i)
  if (mobileMatch && mobileMatch[1]) {
    result.contact = {
      ...result.contact,
      mobile: { value: mobileMatch[1].trim(), source: 'pdf-text', confidence: 80 },
    }
  }

  return result
}

/**
 * Extracts candidate fields from OCR text using conservative regex pattern matching.
 */
export function extractFromOcrText(ocrResult: OcrResult): ExtractedApplicantData {
  if (!ocrResult || !ocrResult.text) return {}

  const baseConfidence = Math.round((ocrResult.confidence || 70) * 0.9)
  const result: ExtractedApplicantData = {}

  // Passport Number Pattern
  const pptMatch = ocrResult.text.match(/passport\s*(?:no|number)?[:\s]+([A-Z0-9]{6,12})/i)
  if (pptMatch && pptMatch[1]) {
    result.passport = {
      ...result.passport,
      passportNumber: { value: pptMatch[1].trim(), source: 'ocr', confidence: baseConfidence },
    }
  }

  // Email Pattern
  const emailMatch = ocrResult.text.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/i)
  if (emailMatch && emailMatch[1]) {
    result.contact = {
      ...result.contact,
      email: { value: emailMatch[1].trim().toLowerCase(), source: 'ocr', confidence: baseConfidence },
    }
  }

  return result
}

const SOURCE_PRIORITY: Record<ExtractionSource, number> = {
  mrz: 1,
  'pdf-text': 2,
  ocr: 3,
  'manual-review': 4,
}

/**
 * Merges multiple candidate extraction sources using a deterministic source priority rule:
 * MRZ (1) > PDF Text (2) > OCR (3)
 * Records conflicts if candidates from different sources return conflicting non-empty values.
 */
export function mergeExtractedCandidateData(
  candidateList: ExtractedApplicantData[]
): { merged: ExtractedApplicantData; conflicts: ExtractedFieldConflict<unknown>[] } {
  const merged: ExtractedApplicantData = {
    personal: {},
    passport: {},
    contact: {},
  }
  const conflicts: ExtractedFieldConflict<unknown>[] = []

  // Helper to merge a specific field path across candidates
  const mergeField = <T>(
    fieldKey: string,
    label: string,
    getter: (cand: ExtractedApplicantData) => ExtractedField<T> | undefined,
    setter: (val: ExtractedField<T>) => void
  ) => {
    const fields: ExtractedField<T>[] = []
    for (const cand of candidateList) {
      const f = getter(cand)
      if (f && f.value !== undefined && f.value !== null && String(f.value).trim() !== '') {
        fields.push(f)
      }
    }

    if (fields.length === 0) return

    // Sort by source priority
    fields.sort((a, b) => (SOURCE_PRIORITY[a.source] || 99) - (SOURCE_PRIORITY[b.source] || 99))

    const best = fields[0]
    setter(best)

    // Check if conflicting values exist across sources
    const distinctValues = Array.from(new Set(fields.map((f) => String(f.value).trim().toUpperCase())))
    if (distinctValues.length > 1) {
      conflicts.push({
        fieldKey,
        label,
        candidates: fields,
        resolvedValue: best.value,
      })
    }
  }

  mergeField(
    'personal.lastName',
    'Surname',
    (c) => c.personal?.lastName,
    (val) => { merged.personal!.lastName = val }
  )
  mergeField(
    'personal.firstName',
    'Given Names',
    (c) => c.personal?.firstName,
    (val) => { merged.personal!.firstName = val }
  )
  mergeField(
    'personal.dateOfBirth',
    'Date of Birth',
    (c) => c.personal?.dateOfBirth,
    (val) => { merged.personal!.dateOfBirth = val }
  )
  mergeField(
    'personal.gender',
    'Gender',
    (c) => c.personal?.gender,
    (val) => { merged.personal!.gender = val }
  )
  mergeField(
    'personal.nationality',
    'Nationality',
    (c) => c.personal?.nationality,
    (val) => { merged.personal!.nationality = val }
  )

  mergeField(
    'passport.passportNumber',
    'Passport Number',
    (c) => c.passport?.passportNumber,
    (val) => { merged.passport!.passportNumber = val }
  )
  mergeField(
    'passport.issuingCountry',
    'Issuing Country',
    (c) => c.passport?.issuingCountry,
    (val) => { merged.passport!.issuingCountry = val }
  )
  mergeField(
    'passport.expiryDate',
    'Passport Expiry Date',
    (c) => c.passport?.expiryDate,
    (val) => { merged.passport!.expiryDate = val }
  )

  mergeField(
    'contact.email',
    'Email Address',
    (c) => c.contact?.email,
    (val) => { merged.contact!.email = val }
  )
  mergeField(
    'contact.mobile',
    'Mobile Phone',
    (c) => c.contact?.mobile,
    (val) => { merged.contact!.mobile = val }
  )

  return { merged, conflicts }
}
