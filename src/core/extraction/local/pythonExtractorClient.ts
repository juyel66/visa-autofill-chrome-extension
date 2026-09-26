import type { ExtractedApplicantData, ExtractedField, ExtractionSource } from '../data/types'
import type { Gender } from '../../applicant/types'
import { normalizeNameString, BANGLADESHI_PREFIX_TITLE_VARIANTS } from '../../normalization/bangladeshiNameNormalizer'
import { parseDateString, formatToIsoDate } from '../../autofill/dateNormalizer'

/**
 * Default local URL for the Python extractor service created in Task 114.
 */
export const LOCAL_EXTRACTOR_URL = 'http://127.0.0.1:8001'

/**
 * Timeout in milliseconds. CPU OCR with PyMuPDF & PaddleOCR can take 40-100 seconds on CPU.
 */
export const DEFAULT_EXTRACTION_TIMEOUT_MS = 150000

// ============================================================================
// PYTHON SERVICE TYPINGS (Matching python-extractor/app/schemas.py)
// ============================================================================

export interface PythonPersonalData {
  surname: string
  givenName: string
  fullName?: string
  dateOfBirth: string
  gender: string
  nationality: string
  placeOfBirth: string
  countryOfBirth: string
  nid: string
}

export interface PythonPreviousPassportData {
  number: string
  issuePlace?: string
  issueDate?: string
  issuingCountry?: string
}

export interface PythonPassportData {
  number: string
  issueDate: string
  expiryDate: string
  issuePlace: string
  issuingCountry: string
  previousPassport?: PythonPreviousPassportData
}

export interface PythonAddressData {
  line1: string
  line2: string
  city: string
  district: string
  stateProvince?: string
  postalCode: string
  country: string
  phone?: string
}

export interface PythonPersonInfo {
  name: string
  nationality?: string
  previousNationality?: string
  placeOfBirth?: string
  countryOfBirth?: string
}

export interface PythonFamilyData {
  father?: PythonPersonInfo
  mother?: PythonPersonInfo
  spouse?: PythonPersonInfo
}

export interface PythonMRZData {
  detected: boolean
  valid: boolean
  rawLines: string[]
  confidence: number
}

export interface PythonFieldSource {
  source: string // "pdf_text" | "ocr" | "mrz"
  confidence: number
  rawValue: string
}

export interface PythonPassportExtractionResult {
  personal: PythonPersonalData
  passport: PythonPassportData
  address: PythonAddressData
  family?: PythonFamilyData
  mrz: PythonMRZData
  fieldSources: Record<string, PythonFieldSource>
  processingTimeMs?: number
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export type PythonExtractorErrorCode =
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE'
  | 'INVALID_FILE'
  | 'EXTRACTION_FAILED'

export class PythonExtractorError extends Error {
  public readonly code: PythonExtractorErrorCode
  public readonly status?: number

  constructor(message: string, code: PythonExtractorErrorCode, status?: number) {
    super(message)
    this.name = 'PythonExtractorError'
    this.code = code
    this.status = status
    Object.setPrototypeOf(this, PythonExtractorError.prototype)
  }
}

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================

/**
 * Normalizes nationality values deterministically.
 * Example: 'BANGLADESHI' | 'BGD' -> 'BANGLADESH'
 *          'INDIAN' | 'IND' -> 'INDIA'
 * Does NOT blindly replace arbitrary nationality values.
 */
export function normalizeExtractedNationality(nat?: string): string {
  if (!nat) return ''
  const trimmed = nat.trim()
  const upper = trimmed.toUpperCase()

  if (upper === 'BANGLADESHI' || upper === 'BGD' || upper === 'BANGLADESH') {
    return 'BANGLADESH'
  }
  if (upper === 'INDIAN' || upper === 'IND' || upper === 'INDIA') {
    return 'INDIA'
  }
  return trimmed
}

/**
 * Normalizes country representation.
 */
export function normalizeExtractedCountry(country?: string): string {
  if (!country) return ''
  const trimmed = country.trim()
  const upper = trimmed.toUpperCase()

  if (upper === 'BANGLADESHI' || upper === 'BGD' || upper === 'BANGLADESH') {
    return 'BANGLADESH'
  }
  if (upper === 'INDIAN' || upper === 'IND' || upper === 'INDIA') {
    return 'INDIA'
  }
  return trimmed
}

/**
 * Normalizes dates to the application's standard ISO format (YYYY-MM-DD).
 */
export function normalizeExtractedDate(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return ''
  const parsed = parseDateString(dateStr.trim())
  if (!parsed) return ''
  return formatToIsoDate(parsed)
}

/**
 * Normalizes given name, resolving missing spaces (e.g. "SHREEJOTIMOY" -> "SHREE JOTIMOY")
 * using MRZ separator information or explicit Bangladeshi prefix title dictionaries.
 * Does NOT invent arbitrary spaces.
 */
export function normalizeExtractedGivenName(givenName?: string, mrzRawLines?: string[]): string {
  if (!givenName) return ''
  const trimmed = givenName.trim()
  if (!trimmed) return ''

  // 1. Check if MRZ line 1 contains '<' separator for this given name
  if (mrzRawLines && mrzRawLines.length > 0) {
    const l1 = mrzRawLines[0] || ''
    // TD3 Line 1 format: P<CCC<SURNAME<<GIVEN<NAMES<<<<
    const parts = l1.includes('<<') ? l1.split('<<') : [l1]
    const afterSurname = parts.length > 1 ? parts[1] : parts[0]
    if (afterSurname) {
      const tokens = afterSurname.split('<').filter((t) => t.length > 0 && /^[A-Z]+$/.test(t))
      if (tokens.length >= 2) {
        const joined = tokens.join('').toUpperCase()
        const givenClean = trimmed.replace(/[^A-Za-z]/g, '').toUpperCase()
        if (joined === givenClean || joined.includes(givenClean) || givenClean.includes(joined)) {
          return tokens.map((t) => normalizeNameString(t) || t).join(' ')
        }
      }
    }
  }

  // 2. Filter out obvious OCR garbage tokens (e.g. tokens with digits like G70E, 410G7A, 70E, O7E)
  const rawTokens = trimmed.replace(/[/<]/g, ' ').split(/\s+/).filter(Boolean)
  const validTokens = rawTokens.filter((tok) => {
    const cleanTok = tok.replace(/^[.,:;-_/\\<>()[\]{}"'!?#*~]+|[.,:;-_/\\<>()[\]{}"'!?#*~]+$/g, '')
    if (!cleanTok || /\d/.test(cleanTok)) return false
    return /^[A-Za-z]+(?:['-][A-Za-z]+)*$/.test(cleanTok)
  })

  if (validTokens.length === 0) {
    // If visual only contained noise tokens, fallback to MRZ tokens if present
    if (mrzRawLines && mrzRawLines.length > 0) {
      const l1 = mrzRawLines[0] || ''
      const parts = l1.includes('<<') ? l1.split('<<') : [l1]
      const afterSurname = parts.length > 1 ? parts[1] : parts[0]
      if (afterSurname) {
        const tokens = afterSurname.split('<').filter((t) => t.length > 0 && /^[A-Z]+$/.test(t))
        if (tokens.length > 0) {
          return tokens.map((t) => normalizeNameString(t) || t).join(' ')
        }
      }
    }
    return ''
  }

  const cleanedString = validTokens.join(' ')

  // 3. Check if givenName begins with a known Bangladeshi prefix/title without space
  const upper = cleanedString.toUpperCase()
  if (!upper.includes(' ')) {
    for (const prefix of BANGLADESHI_PREFIX_TITLE_VARIANTS) {
      const cleanPrefix = prefix.replace(/\./g, '')
      if (upper.startsWith(cleanPrefix) && upper.length > cleanPrefix.length + 2) {
        const rest = upper.slice(cleanPrefix.length).trim()
        if (/^[A-Z]+$/.test(rest)) {
          return `${cleanPrefix} ${rest}`
        }
      }
    }
  }

  return normalizeNameString(cleanedString) || cleanedString.toUpperCase()
}

/**
 * Normalizes gender string into strict Gender type ('male' | 'female' | 'transgender').
 */
export function normalizeExtractedGender(genderStr?: string): Gender | undefined {
  if (!genderStr) return undefined
  const g = genderStr.trim().toLowerCase()
  if (g === 'male' || g === 'm') return 'male'
  if (g === 'female' || g === 'f') return 'female'
  if (g === 'transgender' || g === 't' || g === 'other' || g === 'x') return 'other'
  return undefined
}

/**
 * Helper to convert 0.0-1.0 confidence to 0-100 integer.
 */
function toPercentageConfidence(conf?: number): number | undefined {
  if (conf === undefined || conf === null || isNaN(conf)) return undefined
  if (conf <= 1.0) {
    return Math.round(conf * 100)
  }
  return Math.round(conf)
}

/**
 * Resolves source string to ExtractedField's ExtractionSource.
 */
function resolveSource(sourceStr?: string, defaultSource: ExtractionSource = 'ocr'): ExtractionSource {
  if (!sourceStr) return defaultSource
  const lower = sourceStr.toLowerCase()
  if (lower === 'mrz') return 'mrz'
  if (lower === 'ocr') return 'ocr'
  if (lower === 'pdf_text' || lower === 'pdf-text') return 'pdf-text'
  return defaultSource
}

/**
 * Creates an ExtractedField with source and confidence.
 */
function createExtractedField<T>(
  value: T,
  sourceStr?: string,
  rawConfidence?: number,
  fallbackSource: ExtractionSource = 'ocr'
): ExtractedField<T> {
  return {
    value,
    source: resolveSource(sourceStr, fallbackSource),
    confidence: toPercentageConfidence(rawConfidence),
  }
}

// ============================================================================
// MAPPER: Python Response -> ExtractedApplicantData
// ============================================================================

/**
 * Maps the Python OCR response structure into the existing ExtractedApplicantData format.
 * Strictly maintains data integrity:
 * - Place of birth comes only from document extraction (never derived from address/issue place).
 * - Country of birth is not assumed Bangladesh.
 * - Nationality is not forced to Bangladesh.
 * - Family fields are not fabricated.
 * - Passport expiry is preserved from MRZ/Python and not overwritten by issue date.
 */
export function mapPythonResultToExtractedApplicant(
  res: PythonPassportExtractionResult
): ExtractedApplicantData {
  if (!res || !res.personal || !res.passport) {
    return {}
  }

  const p = res.personal
  const pass = res.passport
  const addr = res.address || { line1: '', line2: '', city: '', district: '', postalCode: '', country: '' }
  const mrz = res.mrz || { detected: false, valid: false, rawLines: [], confidence: 0 }
  const fs = res.fieldSources || {}

  const result: ExtractedApplicantData = {
    personal: {},
    passport: {},
    permanentAddress: {},
    presentAddress: {},
  }

  // --- 1. PERSONAL PARTICULARS ---
  // Surname
  if (p.surname && p.surname.trim()) {
    const rawConf = fs['personal.surname']?.confidence ?? (mrz.detected ? mrz.confidence : undefined)
    const norm = normalizeNameString(p.surname) || p.surname.trim().toUpperCase()
    result.personal!.lastName = createExtractedField(norm, fs['personal.surname']?.source, rawConf, 'ocr')
  }

  // Given Name
  if (p.givenName && p.givenName.trim()) {
    const rawConf = fs['personal.givenName']?.confidence ?? (mrz.detected ? mrz.confidence : undefined)
    const norm = normalizeExtractedGivenName(p.givenName, mrz.rawLines)
    result.personal!.firstName = createExtractedField(norm, fs['personal.givenName']?.source, rawConf, 'ocr')
  }

  // Full Name
  const lName = result.personal?.lastName?.value
  const fName = result.personal?.firstName?.value
  if (fName && lName) {
    const full = `${fName} ${lName}`.trim()
    result.personal!.fullName = createExtractedField(full, 'ocr', mrz.detected ? mrz.confidence : undefined)
  } else if (fName || lName) {
    result.personal!.fullName = createExtractedField(fName || lName || '', 'ocr', mrz.detected ? mrz.confidence : undefined)
  }

  // Date of Birth
  if (p.dateOfBirth && p.dateOfBirth.trim()) {
    const normDob = normalizeExtractedDate(p.dateOfBirth)
    if (normDob) {
      const rawConf = fs['personal.dateOfBirth']?.confidence ?? (mrz.detected ? mrz.confidence : undefined)
      result.personal!.dateOfBirth = createExtractedField(normDob, fs['personal.dateOfBirth']?.source, rawConf, 'ocr')
    }
  }

  // Gender
  if (p.gender && p.gender.trim()) {
    const normGender = normalizeExtractedGender(p.gender)
    if (normGender) {
      const rawConf = fs['personal.gender']?.confidence ?? (mrz.detected ? mrz.confidence : undefined)
      result.personal!.gender = createExtractedField(normGender, fs['personal.gender']?.source, rawConf, 'ocr')
    }
  }

  // Nationality
  if (p.nationality && p.nationality.trim()) {
    const normNat = normalizeExtractedNationality(p.nationality)
    if (normNat) {
      const rawConf = fs['personal.nationality']?.confidence ?? (mrz.detected ? mrz.confidence : undefined)
      result.personal!.nationality = createExtractedField(normNat, fs['personal.nationality']?.source, rawConf, 'ocr')
    }
  }

  // Place of Birth (STRICT: Document extraction only, leave blank if not provided)
  if (p.placeOfBirth && p.placeOfBirth.trim()) {
    const rawConf = fs['personal.placeOfBirth']?.confidence
    result.personal!.townCityOfBirth = createExtractedField(
      p.placeOfBirth.trim().toUpperCase(),
      fs['personal.placeOfBirth']?.source,
      rawConf,
      'ocr'
    )
  }

  // Country of Birth (STRICT: Leave blank if Python returns blank)
  if (p.countryOfBirth && p.countryOfBirth.trim()) {
    const normCob = normalizeExtractedCountry(p.countryOfBirth)
    if (normCob) {
      const rawConf = fs['personal.countryOfBirth']?.confidence
      result.personal!.countryOfBirth = createExtractedField(
        normCob,
        fs['personal.countryOfBirth']?.source,
        rawConf,
        'ocr'
      )
    }
  }

  // National ID Number
  if (p.nid && p.nid.trim()) {
    const rawConf = fs['personal.nid']?.confidence ?? (mrz.detected ? mrz.confidence : undefined)
    result.personal!.nationalIdNumber = createExtractedField(p.nid.trim(), fs['personal.nid']?.source, rawConf, 'ocr')
  }

  // --- 2. PASSPORT PARTICULARS ---
  // Passport Number
  if (pass.number && pass.number.trim()) {
    const rawConf = fs['passport.number']?.confidence ?? (mrz.detected ? mrz.confidence : undefined)
    result.passport!.passportNumber = createExtractedField(
      pass.number.trim().toUpperCase(),
      fs['passport.number']?.source,
      rawConf,
      'ocr'
    )
  }

  // Passport Issue Date
  if (pass.issueDate && pass.issueDate.trim()) {
    const normIssue = normalizeExtractedDate(pass.issueDate)
    if (normIssue) {
      const rawConf = fs['passport.issueDate']?.confidence
      result.passport!.issueDate = createExtractedField(normIssue, fs['passport.issueDate']?.source, rawConf, 'ocr')
    }
  }

  // Passport Expiry Date (STRICT: Preserve Python/MRZ-derived expiry, never overwrite with issue date)
  if (pass.expiryDate && pass.expiryDate.trim()) {
    const normExpiry = normalizeExtractedDate(pass.expiryDate)
    if (normExpiry) {
      const rawConf = fs['passport.expiryDate']?.confidence ?? (mrz.detected ? mrz.confidence : undefined)
      result.passport!.expiryDate = createExtractedField(normExpiry, fs['passport.expiryDate']?.source, rawConf, 'ocr')
    }
  }

  // Place of Issue
  if (pass.issuePlace && pass.issuePlace.trim()) {
    const rawConf = fs['passport.issuePlace']?.confidence
    result.passport!.placeOfIssue = createExtractedField(
      pass.issuePlace.trim().toUpperCase(),
      fs['passport.issuePlace']?.source,
      rawConf,
      'ocr'
    )
  }

  // Issuing Country
  if (pass.issuingCountry && pass.issuingCountry.trim()) {
    const normCountry = normalizeExtractedCountry(pass.issuingCountry)
    if (normCountry) {
      const rawConf = fs['passport.issuingCountry']?.confidence ?? (mrz.detected ? mrz.confidence : undefined)
      result.passport!.issuingCountry = createExtractedField(
        normCountry,
        fs['passport.issuingCountry']?.source,
        rawConf,
        'ocr'
      )
    }
  }

  // Previous Passport
  if (pass.previousPassport && pass.previousPassport.number && pass.previousPassport.number.trim()) {
    const rawConf = fs['passport.previousPassport.number']?.confidence ?? 0.9
    const prevNo = pass.previousPassport.number.trim().toUpperCase()
    result.passport!.holdsOtherPassport = createExtractedField(true, 'ocr', rawConf, 'ocr')
    result.passport!.otherPassportDetails = {
      passportNumber: createExtractedField(prevNo, 'ocr', rawConf, 'ocr'),
      countryOfIssue: pass.previousPassport.issuingCountry
        ? createExtractedField(normalizeExtractedCountry(pass.previousPassport.issuingCountry), 'ocr', rawConf, 'ocr')
        : (pass.issuingCountry ? createExtractedField(normalizeExtractedCountry(pass.issuingCountry), 'ocr', rawConf, 'ocr') : undefined),
      placeOfIssue: pass.previousPassport.issuePlace
        ? createExtractedField(pass.previousPassport.issuePlace.trim().toUpperCase(), 'ocr', rawConf, 'ocr')
        : undefined,
      issueDate: pass.previousPassport.issueDate
        ? createExtractedField(normalizeExtractedDate(pass.previousPassport.issueDate), 'ocr', rawConf, 'ocr')
        : undefined,
    }
  }

  // --- 3. ADDRESS PARTICULARS ---
  const addrConf = fs['address']?.confidence
  const addrSource = fs['address']?.source

  if (addr.line1 && addr.line1.trim()) {
    result.permanentAddress!.addressLine1 = createExtractedField(addr.line1.trim().toUpperCase(), addrSource, addrConf, 'ocr')
    result.presentAddress!.addressLine1 = createExtractedField(addr.line1.trim().toUpperCase(), addrSource, addrConf, 'ocr')
  }
  if (addr.line2 && addr.line2.trim()) {
    result.permanentAddress!.addressLine2 = createExtractedField(addr.line2.trim().toUpperCase(), addrSource, addrConf, 'ocr')
    result.presentAddress!.addressLine2 = createExtractedField(addr.line2.trim().toUpperCase(), addrSource, addrConf, 'ocr')
  }
  if (addr.city && addr.city.trim()) {
    result.permanentAddress!.villageTownCity = createExtractedField(addr.city.trim().toUpperCase(), addrSource, addrConf, 'ocr')
    result.presentAddress!.villageTownCity = createExtractedField(addr.city.trim().toUpperCase(), addrSource, addrConf, 'ocr')
  }
  if (addr.district && addr.district.trim()) {
    result.permanentAddress!.district = createExtractedField(addr.district.trim().toUpperCase(), addrSource, addrConf, 'ocr')
    result.presentAddress!.district = createExtractedField(addr.district.trim().toUpperCase(), addrSource, addrConf, 'ocr')
  }
  if (addr.stateProvince && addr.stateProvince.trim()) {
    result.permanentAddress!.stateProvince = createExtractedField(addr.stateProvince.trim().toUpperCase(), addrSource, addrConf, 'ocr')
    result.presentAddress!.stateProvince = createExtractedField(addr.stateProvince.trim().toUpperCase(), addrSource, addrConf, 'ocr')
  }
  if (addr.postalCode && addr.postalCode.trim()) {
    result.permanentAddress!.postalCode = createExtractedField(addr.postalCode.trim(), addrSource, addrConf, 'ocr')
    result.presentAddress!.postalCode = createExtractedField(addr.postalCode.trim(), addrSource, addrConf, 'ocr')
  }
  if (addr.country && addr.country.trim()) {
    const normAc = normalizeExtractedCountry(addr.country)
    result.permanentAddress!.country = createExtractedField(normAc, addrSource, addrConf, 'ocr')
    result.presentAddress!.country = createExtractedField(normAc, addrSource, addrConf, 'ocr')
  }
  if (addr.phone && addr.phone.trim()) {
    const rawP = addr.phone.trim()
    result.presentAddress!.phone = createExtractedField(rawP, addrSource, addrConf, 'ocr')
    result.presentAddress!.mobile = createExtractedField(rawP, addrSource, addrConf, 'ocr')
    result.permanentAddress!.phone = createExtractedField(rawP, addrSource, addrConf, 'ocr')
    result.permanentAddress!.mobile = createExtractedField(rawP, addrSource, addrConf, 'ocr')
    result.contact = result.contact || {}
    result.contact.phone = createExtractedField(rawP, addrSource, addrConf, 'ocr')
    result.contact.mobile = createExtractedField(rawP, addrSource, addrConf, 'ocr')
    if (rawP.startsWith('+880') || rawP.replace(/\D/g, '').startsWith('880')) {
      result.contact.isdCode = createExtractedField('880', addrSource, addrConf, 'ocr')
      result.presentAddress!.isdCode = createExtractedField('880', addrSource, addrConf, 'ocr')
    }
  }

  // --- 4. FAMILY PARTICULARS (Document-extracted) ---
  if (res.family) {
    result.family = {}
    if (res.family.father?.name && res.family.father.name.trim()) {
      const rawConf = fs['family.father.name']?.confidence ?? 0.9
      result.family.father = {
        name: createExtractedField(normalizeNameString(res.family.father.name) || res.family.father.name.trim().toUpperCase(), 'ocr', rawConf, 'ocr'),
        nationality: res.family.father.nationality ? createExtractedField(normalizeExtractedNationality(res.family.father.nationality), 'ocr', rawConf, 'ocr') : undefined,
        placeOfBirth: res.family.father.placeOfBirth ? createExtractedField(res.family.father.placeOfBirth.trim().toUpperCase(), 'ocr', rawConf, 'ocr') : undefined,
        countryOfBirth: res.family.father.countryOfBirth ? createExtractedField(normalizeExtractedCountry(res.family.father.countryOfBirth), 'ocr', rawConf, 'ocr') : undefined,
      }
    }
    if (res.family.mother?.name && res.family.mother.name.trim()) {
      const rawConf = fs['family.mother.name']?.confidence ?? 0.9
      result.family.mother = {
        name: createExtractedField(normalizeNameString(res.family.mother.name) || res.family.mother.name.trim().toUpperCase(), 'ocr', rawConf, 'ocr'),
        nationality: res.family.mother.nationality ? createExtractedField(normalizeExtractedNationality(res.family.mother.nationality), 'ocr', rawConf, 'ocr') : undefined,
        placeOfBirth: res.family.mother.placeOfBirth ? createExtractedField(res.family.mother.placeOfBirth.trim().toUpperCase(), 'ocr', rawConf, 'ocr') : undefined,
        countryOfBirth: res.family.mother.countryOfBirth ? createExtractedField(normalizeExtractedCountry(res.family.mother.countryOfBirth), 'ocr', rawConf, 'ocr') : undefined,
      }
    }
    if (res.family.spouse?.name && res.family.spouse.name.trim()) {
      const rawConf = fs['family.spouse.name']?.confidence ?? 0.9
      result.family.spouse = {
        name: createExtractedField(normalizeNameString(res.family.spouse.name) || res.family.spouse.name.trim().toUpperCase(), 'ocr', rawConf, 'ocr'),
        nationality: res.family.spouse.nationality ? createExtractedField(normalizeExtractedNationality(res.family.spouse.nationality), 'ocr', rawConf, 'ocr') : undefined,
        placeOfBirth: res.family.spouse.placeOfBirth ? createExtractedField(res.family.spouse.placeOfBirth.trim().toUpperCase(), 'ocr', rawConf, 'ocr') : undefined,
        countryOfBirth: res.family.spouse.countryOfBirth ? createExtractedField(normalizeExtractedCountry(res.family.spouse.countryOfBirth), 'ocr', rawConf, 'ocr') : undefined,
      }
    }
    if (Object.keys(result.family).length === 0) {
      delete result.family
    }
  }

  // Clean empty sub-objects
  if (Object.keys(result.personal!).length === 0) delete result.personal
  if (Object.keys(result.passport!).length === 0) delete result.passport
  if (Object.keys(result.permanentAddress!).length === 0) delete result.permanentAddress
  if (Object.keys(result.presentAddress!).length === 0) delete result.presentAddress
  if (result.contact && Object.keys(result.contact).length === 0) delete result.contact

  return result
}

// ============================================================================
// CLIENT / HTTP EXTRACTION LAYER
// ============================================================================

export interface PythonExtractorOptions {
  baseUrl?: string
  timeoutMs?: number
  onProgress?: (progress: { percent: number; text: string }) => void
}

/**
 * Converts a Base64 dataURL or Blob into a Blob for FormData upload.
 */
export function payloadToBlob(input: string | Blob | File, defaultFileName = 'passport.pdf'): { blob: Blob; fileName: string } {
  if (typeof input !== 'string') {
    const name = input instanceof File && input.name ? input.name : defaultFileName
    return { blob: input, fileName: name.endsWith('.pdf') ? name : `${name}.pdf` }
  }

  if (input.startsWith('data:')) {
    const [header, base64Data] = input.split(',')
    const mimeMatch = header.match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf'
    const binary = atob(base64Data || '')
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return { blob: new Blob([bytes], { type: mime }), fileName: defaultFileName }
  }

  throw new PythonExtractorError('Invalid file payload: expected Data URL or Blob.', 'INVALID_FILE')
}

/**
 * Calls the local Python extraction FastAPI service at POST /extract-passport.
 */
export async function extractPassportWithPython(
  fileInput: string | Blob | File,
  fileName: string = 'passport.pdf',
  options?: PythonExtractorOptions
): Promise<PythonPassportExtractionResult> {
  const baseUrl = (options?.baseUrl || LOCAL_EXTRACTOR_URL).replace(/\/$/, '')
  const timeoutMs = options?.timeoutMs ?? DEFAULT_EXTRACTION_TIMEOUT_MS
  const onProgress = options?.onProgress

  onProgress?.({ percent: 15, text: 'Preparing passport document for local Python OCR...' })

  let blob: Blob
  let resolvedFileName: string

  try {
    const converted = payloadToBlob(fileInput, fileName)
    blob = converted.blob
    resolvedFileName = converted.fileName
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new PythonExtractorError(`Payload preparation failed: ${msg}`, 'INVALID_FILE')
  }

  if (blob.size === 0) {
    throw new PythonExtractorError('Uploaded document payload is empty.', 'INVALID_FILE')
  }

  const formData = new FormData()
  // Match FastAPI parameter: file: UploadFile = File(...)
  formData.append('file', blob, resolvedFileName)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  onProgress?.({ percent: 35, text: 'Executing local Python OCR & MRZ parser...' })

  try {
    // Note: Do NOT set Content-Type header when sending FormData! fetch sets boundary automatically.
    const response = await fetch(`${baseUrl}/extract-passport`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })

    if (!response.ok) {
      let errorDetail = ''
      try {
        const errorJson = await response.json()
        errorDetail = errorJson.detail || JSON.stringify(errorJson)
      } catch {
        errorDetail = await response.text()
      }
      throw new PythonExtractorError(
        `Python extraction service returned HTTP ${response.status}: ${errorDetail || response.statusText}`,
        'HTTP_ERROR',
        response.status
      )
    }

    let jsonResult: unknown
    try {
      jsonResult = await response.json()
    } catch {
      throw new PythonExtractorError(
        'Invalid JSON response returned by local Python extractor.',
        'INVALID_RESPONSE'
      )
    }

    // Validate essential structure
    const parsed = jsonResult as PythonPassportExtractionResult
    if (!parsed || typeof parsed !== 'object' || !parsed.personal || !parsed.passport) {
      throw new PythonExtractorError(
        'Python extractor returned incomplete response schema: missing personal or passport data.',
        'INVALID_RESPONSE'
      )
    }

    onProgress?.({ percent: 85, text: 'Local Python OCR extraction complete. Mapping fields...' })
    return parsed
  } catch (err: unknown) {
    if (err instanceof PythonExtractorError) {
      throw err
    }

    const errorObj = err as { name?: string; message?: string }
    if (errorObj?.name === 'AbortError') {
      throw new PythonExtractorError(
        `Local Python extractor timed out after ${Math.round(timeoutMs / 1000)} seconds. Start or check the service on port 8001.`,
        'TIMEOUT'
      )
    }

    const msg = errorObj?.message || String(err)
    const causeStr = (err as { cause?: { code?: string; message?: string } })?.cause
      ? String((err as { cause?: { code?: string; message?: string } }).cause?.code || (err as { cause?: { message?: string } }).cause?.message || '')
      : ''
    const combinedMsg = `${msg} ${causeStr}`.toLowerCase()
    if (
      combinedMsg.includes('failed to fetch') ||
      combinedMsg.includes('fetch failed') ||
      combinedMsg.includes('networkerror') ||
      combinedMsg.includes('econnrefused') ||
      combinedMsg.includes('connection refused')
    ) {
      throw new PythonExtractorError(
        'Local Python extractor is not running. Start the Python extraction service on port 8001.',
        'UNAVAILABLE'
      )
    }

    throw new PythonExtractorError(`Failed to communicate with local Python extractor: ${msg}`, 'EXTRACTION_FAILED')
  } finally {
    clearTimeout(timeoutId)
  }
}
