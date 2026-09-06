import type { PassportMrzData } from '../mrz/types'
import { parsePassportMrz } from '../mrz/mrzParser'
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
    const normCountry = mrzData.issuingCountry === 'BGD' ? 'BANGLADESH' : mrzData.issuingCountry === 'IND' ? 'INDIA' : mrzData.issuingCountry === 'PAK' ? 'PAKISTAN' : mrzData.issuingCountry
    result.passport.issuingCountry = { value: normCountry, source: 'mrz', confidence: 95 }
  }

  if (mrzData.nationality) {
    const normNat = mrzData.nationality === 'BGD' ? 'BANGLADESH' : mrzData.nationality === 'IND' ? 'INDIA' : mrzData.nationality === 'PAK' ? 'PAKISTAN' : mrzData.nationality
    result.personal.nationality = { value: normNat, source: 'mrz', confidence: 95 }
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

  if (mrzData.personalNumber) {
    result.personal.nationalIdNumber = {
      value: mrzData.personalNumber,
      source: 'mrz',
      confidence: mrzData.personalNumberCheckDigit?.valid ? 98 : 85,
    }
  }

  return result
}

/**
 * Normalizes marital status safely to standard portal values:
 * MARRIED -> "0", SINGLE -> "1"
 * Returns undefined if phrase is unsupported or ambiguous.
 */
export function normalizeMaritalStatus(raw?: string): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.trim().toUpperCase()
  if (cleaned === 'MARRIED' || cleaned === '0') return '0'
  if (cleaned === 'SINGLE' || cleaned === 'UNMARRIED' || cleaned === '1') return '1'
  return undefined
}

/**
 * Deterministically normalizes occupation strings to verified portal option values.
 * Returns undefined if no safe deterministic match exists.
 */
export function normalizeOccupation(raw?: string): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.trim().toUpperCase()

  if (
    cleaned === 'BUSINESS' ||
    cleaned === 'BUSINESS PERSON' ||
    cleaned === 'BUSINESSMAN' ||
    cleaned === 'BUSINESSWOMAN' ||
    cleaned === 'TRADER' ||
    cleaned === 'MERCHANT'
  ) {
    return 'BUSINESS PERSON'
  }
  if (
    cleaned === 'DOCTOR' ||
    cleaned === 'PHYSICIAN' ||
    cleaned === 'MEDICAL PRACTITIONER' ||
    cleaned === 'SURGEON'
  ) {
    return 'DOCTOR'
  }
  if (
    cleaned === 'ENGINEER' ||
    cleaned === 'SOFTWARE ENGINEER' ||
    cleaned === 'CIVIL ENGINEER' ||
    cleaned === 'ELECTRICAL ENGINEER' ||
    cleaned === 'MECHANICAL ENGINEER'
  ) {
    return 'ENGINEER'
  }
  if (
    cleaned === 'GOVERNMENT SERVICE' ||
    cleaned === 'GOVT SERVICE' ||
    cleaned === 'GOVERNMENT EMPLOYEE' ||
    cleaned === 'GOVT EMPLOYEE' ||
    cleaned === 'CIVIL SERVANT' ||
    cleaned === 'PUBLIC SERVANT'
  ) {
    return 'GOVERNMENT SERVICE'
  }
  if (cleaned === 'STUDENT') {
    return 'STUDENT'
  }
  if (
    cleaned === 'PRIVATE SERVICE' ||
    cleaned === 'PRIVATE SECTOR' ||
    cleaned === 'SERVICE' ||
    cleaned === 'EXECUTIVE' ||
    cleaned === 'EMPLOYEE' ||
    cleaned === 'OFFICER'
  ) {
    return 'PRIVATE SERVICE'
  }
  if (
    cleaned === 'SELF EMPLOYED' ||
    cleaned === 'FREELANCER' ||
    cleaned === 'SELF EMPLOYED/ FREELANCER' ||
    cleaned === 'CONSULTANT'
  ) {
    return 'SELF EMPLOYED/ FREELANCER'
  }
  if (
    cleaned === 'TEACHER' ||
    cleaned === 'PROFESSOR' ||
    cleaned === 'LECTURER' ||
    cleaned === 'EDUCATOR'
  ) {
    return 'TEACHER'
  }
  if (cleaned === 'HOUSEWIFE' || cleaned === 'HOMEMAKER') {
    return 'HOUSEWIFE'
  }
  if (
    cleaned === 'LAWYER' ||
    cleaned === 'ADVOCATE' ||
    cleaned === 'ATTORNEY' ||
    cleaned === 'BARRISTER'
  ) {
    return 'LAWYER'
  }
  if (cleaned === 'JOURNALIST' || cleaned === 'REPORTER' || cleaned === 'MEDIA') {
    return 'JOURNALIST'
  }
  if (cleaned === 'RETIRED') {
    return 'RETIRED'
  }
  if (cleaned === 'DIPLOMAT') {
    return 'DIPLOMAT'
  }
  if (cleaned === 'POLICEMAN' || cleaned === 'POLICE') {
    return 'POLICEMAN'
  }
  if (
    cleaned === 'MILITARY' ||
    cleaned === 'ARMED FORCES' ||
    cleaned === 'ARMY' ||
    cleaned === 'NAVY' ||
    cleaned === 'AIR FORCE'
  ) {
    return 'MILITARY'
  }
  if (cleaned === 'NURSE') {
    return 'NURSE'
  }

  return undefined
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
}

/**
 * Parses raw date string into standard YYYY-MM-DD ISO format safely.
 */
export function parseStandardIsoDate(raw?: string): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned
  }
  const slashMatch = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0')
    const month = slashMatch[2].padStart(2, '0')
    const year = slashMatch[3]
    return `${year}-${month}-${day}`
  }
  const wordMatch = cleaned.match(/^(\d{1,2})[\s-]+([A-Za-z]+)[\s-]+(\d{4})$/)
  if (wordMatch) {
    const day = wordMatch[1].padStart(2, '0')
    const monthStr = wordMatch[2].toLowerCase()
    const month = MONTH_MAP[monthStr]
    if (month) {
      const year = wordMatch[3]
      return `${year}-${month}-${day}`
    }
  }
  return undefined
}

/**
 * Deterministically normalizes ports of entry / exit to verified portal option values.
 */
export function normalizePortOfEntry(raw?: string): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.trim().toUpperCase()
  if (cleaned.includes('HARIDASPUR') || cleaned.includes('BENAPOLE') || cleaned.includes('PETRAPOLE')) {
    return 'HARIDASPUR'
  }
  if (cleaned.includes('CHENNAI') || cleaned.includes('MAA')) {
    return 'CHENNAI'
  }
  if (cleaned.includes('DELHI') || cleaned.includes('DEL') || cleaned.includes('INDIRA GANDHI')) {
    return 'DELHI'
  }
  if (cleaned.includes('KOLKATA') || cleaned.includes('CCU') || cleaned.includes('NETAJI SUBHASH') || cleaned.includes('CALCUTTA')) {
    return 'KOLKATA'
  }
  if (cleaned.includes('MUMBAI') || cleaned.includes('BOM') || cleaned.includes('CHHATRAPATI SHIVAJI') || cleaned.includes('BOMBAY')) {
    return 'MUMBAI'
  }
  if (cleaned.includes('CHANGRA BANDHA') || cleaned.includes('CHANGRABANDHA')) {
    return 'CHANGRA BANDHA'
  }
  if (cleaned.includes('GEEDE') || cleaned.includes('GEDE') || cleaned.includes('DARSHANA')) {
    return 'GEEDE'
  }
  if (cleaned.includes('AGARTALA')) {
    return 'AGARTALA'
  }
  if (cleaned.includes('DAWKI')) {
    return 'DAWKI'
  }
  if (cleaned.includes('HYDERABAD') || cleaned.includes('HYD')) {
    return 'HYDERABAD'
  }
  if (cleaned.includes('BANGALORE') || cleaned.includes('BENGALURU') || cleaned.includes('BLR')) {
    return 'BANGALORE'
  }
  if (cleaned.includes('COCHIN') || cleaned.includes('KOCHI') || cleaned.includes('COK')) {
    return 'COCHIN'
  }
  return undefined
}

/**
 * Deterministically normalizes old visa type to verified portal option values.
 */
export function normalizeOldVisaType(raw?: string): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.trim().toUpperCase()
  if (cleaned.includes('TOURIST')) return 'TOURIST'
  if (cleaned.includes('BUSINESS')) return 'BUSINESS'
  if (cleaned.includes('MEDICAL')) return 'MEDICAL'
  if (cleaned.includes('STUDENT')) return 'STUDENT'
  if (cleaned.includes('EMPLOYMENT')) return 'EMPLOYMENT'
  if (cleaned.includes('ENTRY')) return 'ENTRY'
  if (cleaned.includes('CONFERENCE')) return 'CONFERENCE'
  if (cleaned.includes('JOURNALIST')) return 'JOURNALIST'
  if (cleaned.includes('TRANSIT')) return 'TRANSIT'
  return undefined
}

/**
 * Deterministically normalizes visa entry type to verified portal option values.
 */
export function normalizeVisaEntryType(raw?: string): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.trim().toUpperCase()
  if (cleaned === 'SINGLE' || cleaned === 'SINGLE ENTRY' || cleaned === '1') return 'Single'
  if (cleaned === 'DOUBLE' || cleaned === 'DOUBLE ENTRY' || cleaned === '2') return 'Double'
  if (cleaned === 'MULTIPLE' || cleaned === 'MULTIPLE ENTRY' || cleaned === 'M') return 'Multiple'
  if (cleaned === 'TRIPLE' || cleaned === 'TRIPLE ENTRY' || cleaned === '3') return 'Triple'
  return undefined
}

/**
 * Extracts candidate fields from raw text (PDF text or OCR text) using conservative pattern matching.
 */
function extractFromRawText(
  text: string,
  source: ExtractionSource,
  baseConfidence: number,
  documentType?: string
): ExtractedApplicantData {
  const result: ExtractedApplicantData = {}
  if (!text) return result

  // 1. Personal Identity & Name Fields
  const surnameMatch = text.match(
    /(?:surname(?:\s*\/\s*nom)?|last\s*name)[:\s]+([A-Za-z .'-]{2,40})/i
  )
  if (surnameMatch && surnameMatch[1]) {
    result.personal = {
      ...result.personal,
      lastName: { value: surnameMatch[1].trim().toUpperCase(), source, confidence: baseConfidence },
    }
  }

  const givenNameMatch = text.match(
    /(?:given\s*name(?:\(s\))?(?:\s*\/\s*pr[ée]noms)?|given\s*names|first\s*name)[:\s]+([A-Za-z .'-]{2,60})/i
  )
  if (givenNameMatch && givenNameMatch[1]) {
    result.personal = {
      ...result.personal,
      firstName: { value: givenNameMatch[1].trim().toUpperCase(), source, confidence: baseConfidence },
    }
  }

  if (!result.personal?.lastName || !result.personal?.firstName) {
    const fullNameMatch = text.match(
      /(?:full\s*name|name\s*of\s*holder|bearer(?:'s)?\s*name|holder(?:'s)?\s*name|name)[:\s]+([A-Za-z .'-]{3,60})/i
    )
    if (fullNameMatch && fullNameMatch[1]) {
      const rawName = fullNameMatch[1].trim().toUpperCase()
      const isNotApplicantName = /(?:father|mother|spouse|husband|wife|sponsor|reference|hotel|company|employer|emergency)/i.test(fullNameMatch[0])
      if (!isNotApplicantName && rawName.length > 2) {
        result.personal = {
          ...result.personal,
          fullName: { value: rawName, source, confidence: baseConfidence },
        }
        const nameParts = rawName.split(/\s+/).filter(Boolean)
        if (nameParts.length === 1 && !result.personal.lastName) {
          result.personal.lastName = { value: nameParts[0], source, confidence: baseConfidence }
        } else if (nameParts.length > 1) {
          if (!result.personal.lastName) {
            result.personal.lastName = { value: nameParts[nameParts.length - 1], source, confidence: baseConfidence }
          }
          if (!result.personal.firstName) {
            result.personal.firstName = { value: nameParts.slice(0, -1).join(' '), source, confidence: baseConfidence }
          }
        }
      }
    }
  }

  // 2. Passport Number: "Passport No: XXXXXX" or "Passport Number: XXXXXX" or "Passport No. / N° du passeport"
  const pptMatch = text.match(
    /(?:passport\s*(?:no|number|num|\.|\/|\s*n°\s*du\s*passeport)?|doc\s*(?:no|number)|pass\s*no)[:\s]+([A-Z0-9]{6,12})/i
  ) || text.match(/(?:passport|passeport)\s*[:\s]+([A-Z0-9]{7,10})/i)
  if (pptMatch && pptMatch[1]) {
    result.passport = {
      ...result.passport,
      passportNumber: { value: pptMatch[1].trim().toUpperCase(), source, confidence: baseConfidence },
    }
  }

  // 3. Date of Birth: "Date of Birth: DD/MM/YYYY" or "15 MAY 1995" or "YYYY-MM-DD"
  const dobMatch = text.match(
    /(?:date\s*of\s*birth(?:\s*\/\s*date\s*de\s*naissance)?|dob|birth\s*date)[:\s]+([0-9A-Za-z ./-]{8,25})/i
  )
  if (dobMatch && dobMatch[1]) {
    const parsedDob = parseStandardIsoDate(dobMatch[1])
    if (parsedDob) {
      result.personal = {
        ...result.personal,
        dateOfBirth: { value: parsedDob, source, confidence: baseConfidence },
      }
    }
  }

  // 4. Sex / Gender: "Sex: M" or "Sex / Sexe: M"
  const sexMatch = text.match(/(?:sex(?:\s*\/\s*sexe)?|gender)[:\s]+([A-Za-z]+)/i)
  if (sexMatch && sexMatch[1]) {
    const rawSex = sexMatch[1].trim().toUpperCase()
    let genderVal: 'male' | 'female' | 'other' | undefined
    if (rawSex === 'M' || rawSex === 'MALE') genderVal = 'male'
    else if (rawSex === 'F' || rawSex === 'FEMALE') genderVal = 'female'
    else if (rawSex === 'OTHER' || rawSex === 'TRANSGENDER') genderVal = 'other'
    if (genderVal) {
      result.personal = {
        ...result.personal,
        gender: { value: genderVal, source, confidence: baseConfidence },
      }
    }
  }

  // 5. Nationality & Issuing Country
  const natMatch = text.match(
    /(?:nationality(?:\s*\/\s*nationalit[ée])?|country\s*code(?:\s*\/\s*code\s*du\s*pays)?)[:\s]+([A-Za-z]+)/i
  )
  if (natMatch && natMatch[1]) {
    const rawNat = natMatch[1].trim().toUpperCase()
    let normNat: string | undefined
    if (rawNat === 'BANGLADESHI' || rawNat === 'BANGLADESH' || rawNat === 'BGD') normNat = 'BANGLADESH'
    else if (rawNat === 'INDIAN' || rawNat === 'INDIA' || rawNat === 'IND') normNat = 'INDIA'
    else if (rawNat === 'PAKISTANI' || rawNat === 'PAKISTAN' || rawNat === 'PAK') normNat = 'PAKISTAN'
    else if (rawNat === 'AMERICAN' || rawNat === 'USA') normNat = 'USA'
    else if (rawNat === 'BRITISH' || rawNat === 'UK' || rawNat === 'GBR') normNat = 'UK'
    else normNat = rawNat

    if (normNat) {
      result.personal = {
        ...result.personal,
        nationality: { value: normNat, source, confidence: baseConfidence },
      }
      result.passport = {
        ...result.passport,
        issuingCountry: { value: normNat, source, confidence: baseConfidence },
      }
    }
  }

  // 6. Place of Birth & Country of Birth
  const pobMatch = text.match(
    /(?:place\s*of\s*birth(?:\s*\/\s*lieu\s*de\s*naissance)?|town\s*of\s*birth|city\s*of\s*birth|birth\s*place|pob)[:\s]+([A-Za-z0-9 .,'-]{2,50})/i
  )
  if (pobMatch && pobMatch[1]) {
    const rawPob = pobMatch[1].trim().toUpperCase()
    const parts = rawPob.split(/[,/]/).map((p) => p.trim())
    result.personal = {
      ...result.personal,
      townCityOfBirth: { value: parts[0], source, confidence: baseConfidence },
    }
    if (parts.length > 1 && !result.personal?.countryOfBirth) {
      let cob = parts[1]
      if (cob === 'BGD' || cob === 'BANGLADESHI') cob = 'BANGLADESH'
      result.personal.countryOfBirth = { value: cob, source, confidence: baseConfidence }
    }
  }

  const cobMatch = text.match(
    /(?:country\s*of\s*birth(?:\s*\/\s*pays\s*de\s*naissance)?)[:\s]+([A-Za-z .,'-]{2,40})/i
  )
  if (cobMatch && cobMatch[1]) {
    let cob = cobMatch[1].trim().toUpperCase()
    if (cob === 'BGD' || cob === 'BANGLADESHI') cob = 'BANGLADESH'
    result.personal = {
      ...result.personal,
      countryOfBirth: { value: cob, source, confidence: baseConfidence },
    }
  }

  // 7. National ID / Personal Number
  const nidMatch = text.match(
    /(?:personal\s*no(?:\.|\/|\s*n°\s*personnel)?|national\s*id(?:\s*no)?(?:\.)?|nid(?:\s*no)?(?:\.)?|nic(?:\s*no)?(?:\.)?)[:\s]+([0-9A-Z]{8,25})/i
  )
  if (nidMatch && nidMatch[1]) {
    result.personal = {
      ...result.personal,
      nationalIdNumber: { value: nidMatch[1].trim().toUpperCase(), source, confidence: baseConfidence },
    }
  }

  // 8. Passport Dates (Issue & Expiry) & Place of Issue
  const issueDateMatch = text.match(
    /(?:date\s*of\s*issue(?:\s*\/\s*date\s*de\s*d[ée]livrance)?|passport\s*issue\s*date|issue\s*date|issued\s*on)[:\s]+([0-9A-Za-z ./-]{8,25})/i
  )
  if (issueDateMatch && issueDateMatch[1]) {
    const parsedIssue = parseStandardIsoDate(issueDateMatch[1])
    if (parsedIssue) {
      result.passport = {
        ...result.passport,
        issueDate: { value: parsedIssue, source, confidence: baseConfidence },
      }
    }
  }

  const expiryDateMatch = text.match(
    /(?:date\s*of\s*expiry(?:\s*\/\s*date\s*d['’]expiration)?|passport\s*expiry\s*date|expiry\s*date|expiration\s*date|expires\s*on)[:\s]+([0-9A-Za-z ./-]{8,25})/i
  )
  if (expiryDateMatch && expiryDateMatch[1]) {
    const parsedExpiry = parseStandardIsoDate(expiryDateMatch[1])
    if (parsedExpiry) {
      result.passport = {
        ...result.passport,
        expiryDate: { value: parsedExpiry, source, confidence: baseConfidence },
      }
    }
  }

  const issuePlaceMatch = text.match(
    /(?:place\s*of\s*issue(?:\s*\/\s*lieu\s*de\s*d[ée]livrance)?|issuing\s*authority(?:\s*\/\s*autorit[ée])?|\bauthority(?:\s*\/\s*autorit[ée])?|issued\s*by|issued\s*at)[:\s]+([A-Za-z0-9 .,/'-]{2,50})/i
  )
  if (issuePlaceMatch && issuePlaceMatch[1]) {
    const rawPlace = issuePlaceMatch[1].replace(/^[:\s/]+/, '').trim().toUpperCase()
    if (rawPlace.length >= 2 && !rawPlace.startsWith('AUTORIT')) {
      result.passport = {
        ...result.passport,
        placeOfIssue: { value: rawPlace, source, confidence: baseConfidence },
      }
    }
  }

  // 9. Previous Passport Details
  const prevPptMatch = text.match(
    /(?:previous\s*passport\s*(?:no|number|\.|\/|\s*n°\s*de\s*l['’]ancien\s*passeport)?|prev\s*passport\s*no)[:\s]+([A-Z0-9]{6,12})/i
  )
  if (prevPptMatch && prevPptMatch[1]) {
    result.passport = {
      ...result.passport,
      holdsOtherPassport: { value: true, source, confidence: baseConfidence },
      otherPassportDetails: {
        passportNumber: { value: prevPptMatch[1].trim().toUpperCase(), source, confidence: baseConfidence },
        countryOfIssue: { value: 'BANGLADESH', source, confidence: baseConfidence },
      },
    }
  }

  // 10. Religion, Education, Visible Identification Marks
  const religionMatch = text.match(/(?:religion)[:\s]+([A-Za-z]+)/i)
  if (religionMatch && religionMatch[1]) {
    const rawRel = religionMatch[1].trim().toUpperCase()
    let normRel: string | undefined
    if (rawRel.includes('ISLAM') || rawRel.includes('MUSLIM')) normRel = 'ISLAM'
    else if (rawRel.includes('HINDU')) normRel = 'HINDU'
    else if (rawRel.includes('BUDDH')) normRel = 'BUDDHISM'
    else if (rawRel.includes('CHRIST')) normRel = 'CHRISTIAN'
    else if (rawRel.includes('SIKH')) normRel = 'SIKH'
    else normRel = 'OTHERS'

    result.personal = {
      ...result.personal,
      religion: { value: normRel, source, confidence: baseConfidence },
    }
  }

  const eduMatch = text.match(/(?:educational\s*qualification|education|qualification)[:\s]+([A-Za-z ]+)/i)
  if (eduMatch && eduMatch[1]) {
    const rawEdu = eduMatch[1].trim().toUpperCase()
    let normEdu: string | undefined
    if (rawEdu.includes('POST GRAD') || rawEdu.includes('MASTER')) normEdu = 'POST GRADUATE'
    else if (rawEdu.includes('GRAD') || rawEdu.includes('BACHELOR') || rawEdu.includes('DEGREE') || rawEdu.includes('B.SC') || rawEdu.includes('B.A')) normEdu = 'GRADUATE'
    else if (rawEdu.includes('HIGHER') || rawEdu.includes('HSC') || rawEdu.includes('12TH')) normEdu = 'HIGHER SECONDARY'
    else if (rawEdu.includes('MATRIC') || rawEdu.includes('SSC') || rawEdu.includes('10TH')) normEdu = 'MATRICULATION'
    else if (rawEdu.includes('BELOW')) normEdu = 'BELOW MATRICULATION'
    else if (rawEdu.includes('PROFESSIONAL')) normEdu = 'PROFESSIONAL'
    else if (rawEdu.includes('ILLITERATE')) normEdu = 'ILLITERATE'
    else normEdu = 'OTHERS'

    result.personal = {
      ...result.personal,
      educationalQualification: { value: normEdu, source, confidence: baseConfidence },
    }
  }

  const markMatch = text.match(
    /(?:visible\s*identification\s*mark(?:\(s\))?|identification\s*marks?|identity\s*marks?|visual\s*mark)[:\s]+([A-Za-z0-9 .,'-]{2,50})/i
  )
  if (markMatch && markMatch[1]) {
    result.personal = {
      ...result.personal,
      visibleIdentificationMarks: { value: markMatch[1].trim().toUpperCase(), source, confidence: baseConfidence },
    }
  }

  // 11. Email: "Email: test@example.com"
  const emailMatch = text.match(/(?:email|e-mail)[:\s]+([^\s@]+@[^\s@]+\.[^\s@]+)/i)
  if (emailMatch && emailMatch[1]) {
    result.contact = {
      ...result.contact,
      email: { value: emailMatch[1].trim().toLowerCase(), source, confidence: baseConfidence },
    }
  }

  // 12. Mobile / Phone: "Mobile: +123456789"
  const mobileMatch = text.match(/(?:mobile|cell(?:\s*phone)?)[:\s]+(\+?[\d\s-]{7,15})/i)
  if (mobileMatch && mobileMatch[1]) {
    result.contact = {
      ...result.contact,
      mobile: { value: mobileMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  const phoneMatch = text.match(/(?:present\s*)?(?:phone|tel|telephone)[:\s]+(\+?[\d\s-]{7,15})/i)
  if (phoneMatch && phoneMatch[1]) {
    result.contact = {
      ...result.contact,
      phone: { value: phoneMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  // 5. ADDRESS EXTRACTION (Present & Permanent)
  // Check explicit line-by-line address fields first
  const presLine1Match = text.match(/(?:present\s*)?(?:address\s*line\s*1)[:\s]+([^\r\n]+)/i)
  const presLine2Match = text.match(/(?:present\s*)?(?:address\s*line\s*2)[:\s]+([^\r\n]+)/i)

  if (presLine1Match && presLine1Match[1]) {
    result.presentAddress = {
      ...result.presentAddress,
      addressLine1: { value: presLine1Match[1].trim(), source, confidence: baseConfidence },
    }
  }
  if (presLine2Match && presLine2Match[1]) {
    result.presentAddress = {
      ...result.presentAddress,
      addressLine2: { value: presLine2Match[1].trim(), source, confidence: baseConfidence },
    }
  }

  // Extract Present Address Block if line 1 wasn't found as a dedicated key
  if (!result.presentAddress?.addressLine1) {
    const presAddrBlock = text.match(
      /(?:present\s*address|residential\s*address|current\s*address|home\s*address|mailing\s*address|postal\s*address|address)[:\s]+([^\r\n]+(?:\r?\n[ \t]*(?!permanent|father|mother|marital|occupation|employer|previous|passport|date\s*of\s*birth|postal\s*code|pincode|country|district|state|province)[^\r\n:]+)*)/i
    )
    if (presAddrBlock && presAddrBlock[1]) {
      const lines = presAddrBlock[1]
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)

      if (lines.length > 0) {
        result.presentAddress = {
          ...result.presentAddress,
          addressLine1: { value: lines[0], source, confidence: baseConfidence },
        }
        if (lines.length > 1 && !result.presentAddress.addressLine2) {
          result.presentAddress.addressLine2 = { value: lines[1], source, confidence: baseConfidence }
        }
        if (lines.length > 2 && !result.presentAddress.villageTownCity) {
          result.presentAddress.villageTownCity = { value: lines[2], source, confidence: baseConfidence }
        }
      }
    }
  }

  const presCityMatch = text.match(/(?:present\s*)?(?:city|town|village|village\/town\/city)[:\s]+([^\r\n,;]+)/i)
  if (presCityMatch && presCityMatch[1] && (!result.presentAddress || !result.presentAddress.villageTownCity)) {
    result.presentAddress = {
      ...result.presentAddress,
      villageTownCity: { value: presCityMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  const presDistrictMatch = text.match(/(?:present\s*)?(?:district)[:\s]+([^\r\n,;]+)/i)
  if (presDistrictMatch && presDistrictMatch[1]) {
    result.presentAddress = {
      ...result.presentAddress,
      district: { value: presDistrictMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  const presStateMatch = text.match(/(?:present\s*)?(?:state|province|state\/province)[:\s]+([^\r\n,;]+)/i)
  if (presStateMatch && presStateMatch[1]) {
    result.presentAddress = {
      ...result.presentAddress,
      stateProvince: { value: presStateMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  const presPinMatch = text.match(/(?:pincode|postal\s*code|post\s*code|pin|zip(?:\s*code)?)[:\s]+([0-9A-Za-z -]{3,12})/i)
  if (presPinMatch && presPinMatch[1]) {
    result.presentAddress = {
      ...result.presentAddress,
      postalCode: { value: presPinMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  const presCountryMatch = text.match(/(?:present\s*(?:address\s*)?country|residential\s*country|home\s*country|\bcountry(?!\s*(?:code|of\s*birth|of\s*issue)))[:\s]+([A-Za-z .'-]{2,50})/i)
  if (presCountryMatch && presCountryMatch[1]) {
    const rawCountry = presCountryMatch[1].trim()
    if (!/^(code|du\s*pays|of\s*birth|of\s*issue)/i.test(rawCountry)) {
      result.presentAddress = {
        ...result.presentAddress,
        country: { value: rawCountry, source, confidence: baseConfidence },
      }
    }
  }

  // Extract Permanent Address Line 1 / Line 2 first
  const permLine1Match = text.match(/permanent\s*(?:address\s*line\s*1)[:\s]+([^\r\n]+)/i)
  const permLine2Match = text.match(/permanent\s*(?:address\s*line\s*2)[:\s]+([^\r\n]+)/i)

  if (permLine1Match && permLine1Match[1]) {
    result.permanentAddress = {
      ...result.permanentAddress,
      addressLine1: { value: permLine1Match[1].trim(), source, confidence: baseConfidence },
    }
  }
  if (permLine2Match && permLine2Match[1]) {
    result.permanentAddress = {
      ...result.permanentAddress,
      addressLine2: { value: permLine2Match[1].trim(), source, confidence: baseConfidence },
    }
  }

  // Extract Permanent Address Block if line 1 wasn't found as a dedicated key
  if (!result.permanentAddress?.addressLine1) {
    const permAddrBlock = text.match(
      /permanent\s*address[:\s]+([^\r\n]+(?:\r?\n[ \t]*(?!present|father|mother|marital|occupation|employer|previous|passport|date\s*of\s*birth|postal\s*code|pincode|country|district|state|province)[^\r\n:]+)*)/i
    )
    if (permAddrBlock && permAddrBlock[1]) {
      const lines = permAddrBlock[1]
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)

      if (lines.length > 0) {
        result.permanentAddress = {
          ...result.permanentAddress,
          addressLine1: { value: lines[0], source, confidence: baseConfidence },
        }
        if (lines.length > 1 && !result.permanentAddress.addressLine2) {
          result.permanentAddress.addressLine2 = { value: lines[1], source, confidence: baseConfidence }
        }
        if (lines.length > 2 && !result.permanentAddress.villageTownCity) {
          result.permanentAddress.villageTownCity = { value: lines[2], source, confidence: baseConfidence }
        }
      }
    }
  }

  const permCityMatch = text.match(/permanent\s*(?:city|town|village|village\/town\/city)[:\s]+([^\r\n,;]+)/i)
  if (permCityMatch && permCityMatch[1] && (!result.permanentAddress || !result.permanentAddress.villageTownCity)) {
    result.permanentAddress = {
      ...result.permanentAddress,
      villageTownCity: { value: permCityMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  const permPinMatch = text.match(/permanent\s*(?:pincode|postal\s*code|post\s*code|pin|zip(?:\s*code)?)[:\s]+([0-9A-Za-z -]{3,12})/i)
  if (permPinMatch && permPinMatch[1]) {
    result.permanentAddress = {
      ...result.permanentAddress,
      postalCode: { value: permPinMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  const permCountryMatch = text.match(/permanent\s*(?:address\s*)?country[:\s]+([A-Za-z .'-]{2,50})/i)
  if (permCountryMatch && permCountryMatch[1]) {
    result.permanentAddress = {
      ...result.permanentAddress,
      country: { value: permCountryMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  // 6. FAMILY INFORMATION
  // Father
  const fatherNameMatch = text.match(/(?:father(?:'s)?\s*name|name\s*of\s*father)[:\s]+([A-Za-z .'-]{2,60})/i)
  if (fatherNameMatch && fatherNameMatch[1]) {
    result.family = {
      ...result.family,
      father: {
        ...result.family?.father,
        name: { value: fatherNameMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  const fatherPlaceBirthMatch = text.match(/(?:father(?:'s)?\s*(?:place\s*of\s*birth|birth\s*place))[:\s]+([A-Za-z .'-]{2,60})/i)
  if (fatherPlaceBirthMatch && fatherPlaceBirthMatch[1]) {
    result.family = {
      ...result.family,
      father: {
        ...result.family?.father,
        placeOfBirth: { value: fatherPlaceBirthMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  const fatherCountryBirthMatch = text.match(/(?:father(?:'s)?\s*country\s*of\s*birth)[:\s]+([A-Za-z .'-]{2,40})/i)
  if (fatherCountryBirthMatch && fatherCountryBirthMatch[1]) {
    result.family = {
      ...result.family,
      father: {
        ...result.family?.father,
        countryOfBirth: { value: fatherCountryBirthMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  const fatherPrevNatMatch = text.match(/(?:father(?:'s)?\s*previous\s*nationality)[:\s]+([A-Za-z .'-]{2,40})/i)
  if (fatherPrevNatMatch && fatherPrevNatMatch[1]) {
    result.family = {
      ...result.family,
      father: {
        ...result.family?.father,
        previousNationality: { value: fatherPrevNatMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  const fatherNatMatch = text.match(/(?:father(?:'s)?\s*nationality)[:\s]+([A-Za-z .'-]{2,40})/i)
  if (fatherNatMatch && fatherNatMatch[1]) {
    result.family = {
      ...result.family,
      father: {
        ...result.family?.father,
        nationality: { value: fatherNatMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  // Mother
  const motherNameMatch = text.match(/(?:mother(?:'s)?\s*name|name\s*of\s*mother)[:\s]+([A-Za-z .'-]{2,60})/i)
  if (motherNameMatch && motherNameMatch[1]) {
    result.family = {
      ...result.family,
      mother: {
        ...result.family?.mother,
        name: { value: motherNameMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  const motherPlaceBirthMatch = text.match(/(?:mother(?:'s)?\s*(?:place\s*of\s*birth|birth\s*place))[:\s]+([A-Za-z .'-]{2,60})/i)
  if (motherPlaceBirthMatch && motherPlaceBirthMatch[1]) {
    result.family = {
      ...result.family,
      mother: {
        ...result.family?.mother,
        placeOfBirth: { value: motherPlaceBirthMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  const motherCountryBirthMatch = text.match(/(?:mother(?:'s)?\s*country\s*of\s*birth)[:\s]+([A-Za-z .'-]{2,40})/i)
  if (motherCountryBirthMatch && motherCountryBirthMatch[1]) {
    result.family = {
      ...result.family,
      mother: {
        ...result.family?.mother,
        countryOfBirth: { value: motherCountryBirthMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  const motherPrevNatMatch = text.match(/(?:mother(?:'s)?\s*previous\s*nationality)[:\s]+([A-Za-z .'-]{2,40})/i)
  if (motherPrevNatMatch && motherPrevNatMatch[1]) {
    result.family = {
      ...result.family,
      mother: {
        ...result.family?.mother,
        previousNationality: { value: motherPrevNatMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  const motherNatMatch = text.match(/(?:mother(?:'s)?\s*nationality)[:\s]+([A-Za-z .'-]{2,40})/i)
  if (motherNatMatch && motherNatMatch[1]) {
    result.family = {
      ...result.family,
      mother: {
        ...result.family?.mother,
        nationality: { value: motherNatMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  // Spouse
  const spouseNameMatch = text.match(/(?:spouse(?:'s)?\s*name|name\s*of\s*spouse|husband(?:'s)?\s*name|wife(?:'s)?\s*name)[:\s]+([A-Za-z .'-]{2,60})/i)
  if (spouseNameMatch && spouseNameMatch[1]) {
    result.family = {
      ...result.family,
      spouse: {
        ...result.family?.spouse,
        name: { value: spouseNameMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  const spousePlaceBirthMatch = text.match(/(?:spouse(?:'s)?\s*(?:place\s*of\s*birth|birth\s*place))[:\s]+([A-Za-z .'-]{2,60})/i)
  if (spousePlaceBirthMatch && spousePlaceBirthMatch[1]) {
    result.family = {
      ...result.family,
      spouse: {
        ...result.family?.spouse,
        placeOfBirth: { value: spousePlaceBirthMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  const spouseCountryBirthMatch = text.match(/(?:spouse(?:'s)?\s*country\s*of\s*birth)[:\s]+([A-Za-z .'-]{2,40})/i)
  if (spouseCountryBirthMatch && spouseCountryBirthMatch[1]) {
    result.family = {
      ...result.family,
      spouse: {
        ...result.family?.spouse,
        countryOfBirth: { value: spouseCountryBirthMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  const spousePrevNatMatch = text.match(/(?:spouse(?:'s)?\s*previous\s*nationality)[:\s]+([A-Za-z .'-]{2,40})/i)
  if (spousePrevNatMatch && spousePrevNatMatch[1]) {
    result.family = {
      ...result.family,
      spouse: {
        ...result.family?.spouse,
        previousNationality: { value: spousePrevNatMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  const spouseNatMatch = text.match(/(?:spouse(?:'s)?\s*nationality)[:\s]+([A-Za-z .'-]{2,40})/i)
  if (spouseNatMatch && spouseNatMatch[1]) {
    result.family = {
      ...result.family,
      spouse: {
        ...result.family?.spouse,
        nationality: { value: spouseNatMatch[1].trim(), source, confidence: baseConfidence },
      },
    }
  }

  // 7. MARITAL STATUS (Canonical path: personal.maritalStatus)
  const maritalMatch = text.match(/(?:marital\s*status)[:\s]+([A-Za-z0-9]+)/i)
  if (maritalMatch && maritalMatch[1]) {
    const normalizedMarital = normalizeMaritalStatus(maritalMatch[1])
    if (normalizedMarital !== undefined) {
      result.personal = {
        ...result.personal,
        maritalStatus: { value: normalizedMarital, source, confidence: baseConfidence },
      }
    }
  }

  // 8. OCCUPATION
  const occMatch = text.match(/(?:present\s*occupation|occupation|profession)[:\s]+([^\r\n,;]+)/i)
  if (occMatch && occMatch[1]) {
    const normalizedOcc = normalizeOccupation(occMatch[1])
    if (normalizedOcc) {
      result.employment = {
        ...result.employment,
        presentOccupation: { value: normalizedOcc, source, confidence: baseConfidence },
      }
    }
  }

  const pastOccMatch = text.match(/(?:previous\s*occupation|past\s*occupation)[:\s]+([^\r\n,;]+)/i)
  if (pastOccMatch && pastOccMatch[1]) {
    const normalizedPastOcc = normalizeOccupation(pastOccMatch[1]) || pastOccMatch[1].trim().toUpperCase()
    result.employment = {
      ...result.employment,
      pastOccupation: { value: normalizedPastOcc, source, confidence: baseConfidence },
    }
  }

  // 9. EMPLOYER DETAILS
  const empNameMatch = text.match(/(?:employer(?:\s*name)?|company(?:\s*name)?|organization(?:\s*name)?)[:\s]+([^\r\n,;]+)/i)
  if (empNameMatch && empNameMatch[1]) {
    result.employment = {
      ...result.employment,
      employerName: { value: empNameMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  const empDesigMatch = text.match(/(?:designation|job\s*title|position)[:\s]+([^\r\n,;]+)/i)
  if (empDesigMatch && empDesigMatch[1]) {
    result.employment = {
      ...result.employment,
      designationRank: { value: empDesigMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  const empAddressMatch = text.match(/(?:employer\s*address|office\s*address|work\s*address)[:\s]+([^\r\n]+)/i)
  if (empAddressMatch && empAddressMatch[1]) {
    result.employment = {
      ...result.employment,
      employerAddress: { value: empAddressMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  const empPhoneMatch = text.match(/(?:employer\s*phone|office\s*phone|work\s*phone)[:\s]+(\+?[\d\s-]{7,15})/i)
  if (empPhoneMatch && empPhoneMatch[1]) {
    result.employment = {
      ...result.employment,
      employerPhone: { value: empPhoneMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  // 10. PREVIOUS MILITARY / POLICE / SECURITY
  const prevOrgMatch = text.match(
    /(?:previous\s*organization|military\s*organization|police\s*organization|security\s*organization)[:\s]+([^\r\n,;]+)/i
  )
  if (prevOrgMatch && prevOrgMatch[1]) {
    result.employment = {
      ...result.employment,
      militaryOrganization: { value: prevOrgMatch[1].trim(), source, confidence: baseConfidence },
      hasMilitaryService: { value: true, source, confidence: baseConfidence },
    }
  }

  const prevDesigMatch = text.match(/(?:previous\s*designation|military\s*designation)[:\s]+([^\r\n,;]+)/i)
  if (prevDesigMatch && prevDesigMatch[1]) {
    result.employment = {
      ...result.employment,
      militaryDesignation: { value: prevDesigMatch[1].trim(), source, confidence: baseConfidence },
      hasMilitaryService: { value: true, source, confidence: baseConfidence },
    }
  }

  const prevRankMatch = text.match(/(?:previous\s*rank|military\s*rank|rank)[:\s]+([^\r\n,;]+)/i)
  if (prevRankMatch && prevRankMatch[1]) {
    result.employment = {
      ...result.employment,
      militaryRank: { value: prevRankMatch[1].trim(), source, confidence: baseConfidence },
      hasMilitaryService: { value: true, source, confidence: baseConfidence },
    }
  }

  const prevPostingMatch = text.match(/(?:previous\s*posting|place\s*of\s*posting|military\s*posting)[:\s]+([^\r\n,;]+)/i)
  if (prevPostingMatch && prevPostingMatch[1]) {
    result.employment = {
      ...result.employment,
      militaryPlaceOfPosting: { value: prevPostingMatch[1].trim(), source, confidence: baseConfidence },
      hasMilitaryService: { value: true, source, confidence: baseConfidence },
    }
  }

  // 11. GRANDPARENT CITIZENSHIP / RELATION QUESTION
  const gpMatch = text.match(/(?:grandparent\s*(?:pakistan\s*)?relation|pakistan\s*origin\s*grandparent)[:\s]+(yes|no|y|n|true|false)/i)
  if (gpMatch && gpMatch[1]) {
    const isYes = gpMatch[1].toLowerCase() === 'yes' || gpMatch[1].toLowerCase() === 'y' || gpMatch[1].toLowerCase() === 'true'
    result.family = {
      ...result.family,
      hasPakistanRelation: { value: isYes, source, confidence: baseConfidence },
    }
  }

  const gpDetailsMatch = text.match(/(?:grandparent\s*details|pakistan\s*relation\s*details)[:\s]+([^\r\n]+)/i)
  if (gpDetailsMatch && gpDetailsMatch[1]) {
    result.family = {
      ...result.family,
      pakistanRelationDetails: { value: gpDetailsMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  // 12. TRAVEL & VISA DETAILS EXTRACTION
  // Travel Date (Journey / Arrival Date)
  const journeyMatch = text.match(
    /(?:intended\s+)?(?:journey\s*date|date\s*of\s*journey|travel\s*date|departure\s*date|date\s*of\s*departure|flight\s*date|arrival\s*date|date\s*of\s*arrival)[:\s]+([0-9A-Za-z -/]{8,20})/i
  )
  if (journeyMatch && journeyMatch[1]) {
    // Ensure we do NOT extract ticket issue date or booking date as journey date
    const dateStr = journeyMatch[1].trim()
    const isoJourney = parseStandardIsoDate(dateStr)
    if (isoJourney) {
      result.travel = {
        ...result.travel,
        journeyDate: { value: isoJourney, source, confidence: baseConfidence },
        intendedArrivalDate: { value: isoJourney, source, confidence: baseConfidence },
      }
    }
  }

  // Visa Duration (Explicit duration only: "Visa Duration: 30 Days", "Requested duration: 6 months")
  const durationMatch = text.match(/(?:requested\s*(?:visa\s*)?duration|visa\s*duration|duration\s*of\s*(?:requested\s*)?visa)[:\s]+([0-9A-Za-z ]{2,30})/i)
  if (durationMatch && durationMatch[1]) {
    result.travel = {
      ...result.travel,
      duration: { value: durationMatch[1].trim().toUpperCase(), source, confidence: baseConfidence },
    }
  }

  // Number of Entries / Visa Entry Type
  const entryTypeMatch = text.match(/(?:number\s*of\s*entries|visa\s*entries|entries\s*requested|entry\s*type)[:\s]+([A-Za-z0-9 ]{3,20})/i)
  if (entryTypeMatch && entryTypeMatch[1]) {
    const normEntry = normalizeVisaEntryType(entryTypeMatch[1])
    if (normEntry) {
      result.travel = {
        ...result.travel,
        visaEntryType: { value: normEntry, source, confidence: baseConfidence },
      }
    }
  }

  // Entry Port (Explicit port/airport/station only, not raw city)
  const entryPortMatch = text.match(
    /(?:port\s*of\s*(?:entry|arrival)|entry\s*(?:point|port)|arrival\s*(?:port|airport|station)|destination\s*(?:airport|station|port|immigration\s*checkpost))[:\s]+([A-Za-z0-9 /()-]{3,50})/i
  ) || text.match(
    /destination[:\s]+([A-Za-z0-9 /()-]*(?:airport|station|railway|port|checkpost|haridaspur|benapole|petrapole|geede|gede|darshana|changra\s*bandha|agartala|dawki)[A-Za-z0-9 /()-]*)/i
  )
  if (entryPortMatch && entryPortMatch[1]) {
    const normPort = normalizePortOfEntry(entryPortMatch[1])
    if (normPort) {
      result.travel = {
        ...result.travel,
        entryPoint: { value: normPort, source, confidence: baseConfidence },
      }
    }
  }

  // Exit Port (Explicit port/airport/station only, not raw city)
  const exitPortMatch = text.match(
    /(?:port\s*of\s*(?:exit|departure)|exit\s*(?:point|port)|departure\s*(?:port|airport|station)|return\s*(?:airport|port|station))[:\s]+([A-Za-z0-9 /()-]{3,50})/i
  ) || text.match(
    /(?:departure|return)[:\s]+([A-Za-z0-9 /()-]*(?:airport|station|railway|port|checkpost|haridaspur|benapole|petrapole|geede|gede|darshana|changra\s*bandha|agartala|dawki)[A-Za-z0-9 /()-]*)/i
  )
  if (exitPortMatch && exitPortMatch[1]) {
    const normPort = normalizePortOfEntry(exitPortMatch[1])
    if (normPort) {
      result.travel = {
        ...result.travel,
        exitPoint: { value: normPort, source, confidence: baseConfidence },
      }
    }
  }

  // Purpose of Visit
  const purposeMatch = text.match(/(?:purpose\s*of\s*visit|visit\s*purpose)[:\s]+([A-Za-z0-9 /()-]{3,50})/i)
  if (purposeMatch && purposeMatch[1]) {
    result.travel = {
      ...result.travel,
      purposeOfVisit: { value: purposeMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  // 13. PREVIOUS INDIAN VISA EXTRACTION
  const oldVisaNoMatch = text.match(
    /(?:(?:previous|old|prior|indian)?\s*visa\s*(?:no|number|num))[:\s]+([A-Z0-9]{5,15})/i
  )
  if (oldVisaNoMatch && oldVisaNoMatch[1]) {
    result.previousVisa = {
      ...result.previousVisa,
      visaNumber: { value: oldVisaNoMatch[1].trim().toUpperCase(), source, confidence: baseConfidence },
      hasPreviousVisa: { value: true, source, confidence: baseConfidence },
    }
  }

  const oldVisaTypeMatch = text.match(
    /(?:type\s*of\s*visa|(?:previous|old|prior)?\s*visa\s*type)[:\s]+([A-Za-z]+)/i
  )
  if (oldVisaTypeMatch && oldVisaTypeMatch[1]) {
    const normVisaType = normalizeOldVisaType(oldVisaTypeMatch[1])
    if (normVisaType) {
      result.previousVisa = {
        ...result.previousVisa,
        visaType: { value: normVisaType, source, confidence: baseConfidence },
        hasPreviousVisa: { value: true, source, confidence: baseConfidence },
      }
    }
  }

  const oldVisaPlaceMatch = text.match(
    /(?:place\s*of\s*issue|(?:previous|old|prior)?\s*visa\s*(?:issue\s*place|place\s*of\s*issue))[:\s]+([A-Za-z .'-]{2,40})/i
  )
  if (oldVisaPlaceMatch && oldVisaPlaceMatch[1]) {
    result.previousVisa = {
      ...result.previousVisa,
      placeOfIssue: { value: oldVisaPlaceMatch[1].trim().toUpperCase(), source, confidence: baseConfidence },
      hasPreviousVisa: { value: true, source, confidence: baseConfidence },
    }
  }

  const oldVisaDateMatch = text.match(
    /(?:date\s*of\s*issue|(?:previous|old|prior)?\s*visa\s*(?:issue\s*date|date\s*of\s*issue))[:\s]+([0-9A-Za-z -/]{8,20})/i
  )
  if (oldVisaDateMatch && oldVisaDateMatch[1]) {
    const isoDate = parseStandardIsoDate(oldVisaDateMatch[1])
    if (isoDate) {
      result.previousVisa = {
        ...result.previousVisa,
        dateOfIssue: { value: isoDate, source, confidence: baseConfidence },
        hasPreviousVisa: { value: true, source, confidence: baseConfidence },
      }
    }
  }

  const prevVisitAdd1Match = text.match(
    /(?:previous\s*visit\s*address(?:\s*line\s*1)?|address\s*during\s*(?:previous|last)\s*visit|previous\s*address|previous\s*visited\s*address)[:\s]+([^\r\n]+)/i
  )
  if (prevVisitAdd1Match && prevVisitAdd1Match[1]) {
    result.previousVisa = {
      ...result.previousVisa,
      visitedAddress1: { value: prevVisitAdd1Match[1].trim(), source, confidence: baseConfidence },
      hasPreviousVisa: { value: true, source, confidence: baseConfidence },
    }
  }

  const prevVisitAdd2Match = text.match(/(?:previous\s*visit\s*address\s*line\s*2)[:\s]+([^\r\n]+)/i)
  if (prevVisitAdd2Match && prevVisitAdd2Match[1]) {
    result.previousVisa = {
      ...result.previousVisa,
      visitedAddress2: { value: prevVisitAdd2Match[1].trim(), source, confidence: baseConfidence },
      hasPreviousVisa: { value: true, source, confidence: baseConfidence },
    }
  }

  const prevVisitAdd3Match = text.match(
    /(?:previous\s*visit\s*(?:address\s*line\s*3|city)|visited\s*city\s*in\s*india)[:\s]+([^\r\n,;]+)/i
  )
  if (prevVisitAdd3Match && prevVisitAdd3Match[1]) {
    result.previousVisa = {
      ...result.previousVisa,
      visitedAddress3: { value: prevVisitAdd3Match[1].trim(), source, confidence: baseConfidence },
      hasPreviousVisa: { value: true, source, confidence: baseConfidence },
    }
  }

  const prevVisaFlagMatch = text.match(
    /(?:previous\s*indian\s*visa|visited\s*india\s*previously|old\s*visa\s*held)[:\s]+(yes|true|y)/i
  )
  if (prevVisaFlagMatch) {
    result.previousVisa = {
      ...result.previousVisa,
      hasPreviousVisa: { value: true, source, confidence: baseConfidence },
    }
  }

  // 14. REFUSAL & SAARC EXTRACTION
  const refusalMatch = text.match(/(?:visa\s*refusal|previously\s*refused)[:\s]+(yes|true|y)/i)
  if (refusalMatch) {
    result.previousVisa = {
      ...result.previousVisa,
      hasRefusal: { value: true, source, confidence: baseConfidence },
    }
  }

  const refuseDetailsMatch = text.match(/(?:refusal\s*details|reason\s*for\s*refusal)[:\s]+([^\r\n]+)/i)
  if (refuseDetailsMatch && refuseDetailsMatch[1]) {
    result.previousVisa = {
      ...result.previousVisa,
      refusalDetails: { value: refuseDetailsMatch[1].trim(), source, confidence: baseConfidence },
    }
  }

  const countriesVisitedMatch = text.match(/(?:countries\s*visited|visited\s*countries)[:\s]+([^\r\n]+)/i)
  if (countriesVisitedMatch && countriesVisitedMatch[1]) {
    const rawCountries = countriesVisitedMatch[1].trim()
    result.travel = {
      ...result.travel,
      countriesVisited: { value: rawCountries, source, confidence: baseConfidence },
    }
    const saarcCountries = ['AFGHANISTAN', 'BHUTAN', 'PAKISTAN', 'MALDIVES', 'NEPAL', 'SRI LANKA']
    const upper = rawCountries.toUpperCase()
    if (saarcCountries.some((c) => upper.includes(c))) {
      result.travel = {
        ...result.travel,
        visitedSaarc: { value: true, source, confidence: baseConfidence },
      }
    }
  }

  const saarcMatch = text.match(/(?:saarc\s*(?:country\s*)?visit(?:ed)?|visited\s*saarc)[:\s]+(yes|true|y)/i)
  if (saarcMatch) {
    result.travel = {
      ...result.travel,
      visitedSaarc: { value: true, source, confidence: baseConfidence },
    }
  }

  // 15. INDIA REFERENCE / SPONSOR EXTRACTION
  const sponsorNameMatch = text.match(
    /(?:sponsor\s*in\s*india|sponsor\s*(?:in\s*india)?(?:\s*name)?|reference\s*in\s*india(?:\s*name)?|hotel\s*name|name\s*of\s*sponsor\s*in\s*india)[:\s]+([A-Za-z0-9 .'-]{2,60})/i
  )
  if (sponsorNameMatch && sponsorNameMatch[1]) {
    result.sponsorIndia = {
      ...result.sponsorIndia,
      name: { value: sponsorNameMatch[1].trim().toUpperCase(), source, confidence: baseConfidence },
    }
  }

  const sponsorAdd1Match = text.match(
    /(?:sponsor\s*address(?:\s*line\s*1)?|reference\s*in\s*india\s*address|hotel\s*address(?:\s*line\s*1)?|hotel\s*address)[:\s]+([^\r\n]+)/i
  )
  if (sponsorAdd1Match && sponsorAdd1Match[1]) {
    result.sponsorIndia = {
      ...result.sponsorIndia,
      addressLine1: { value: sponsorAdd1Match[1].trim(), source, confidence: baseConfidence },
    }
  }

  const sponsorAdd2Match = text.match(
    /(?:sponsor\s*address\s*line\s*2|hotel\s*address\s*line\s*2)[:\s]+([^\r\n]+)/i
  )
  if (sponsorAdd2Match && sponsorAdd2Match[1]) {
    result.sponsorIndia = {
      ...result.sponsorIndia,
      addressLine2: { value: sponsorAdd2Match[1].trim(), source, confidence: baseConfidence },
    }
  }

  const sponsorPhoneMatch = text.match(
    /(?:sponsor\s*(?:in\s*india\s*)?(?:phone|tel|mobile)|reference\s*in\s*india\s*(?:phone|tel|mobile)|hotel\s*(?:phone|tel|mobile))[:\s]+(\+?[\d\s()-]{7,25})/i
  )
  if (sponsorPhoneMatch && sponsorPhoneMatch[1]) {
    result.sponsorIndia = {
      ...result.sponsorIndia,
      phone: { value: sponsorPhoneMatch[1].trim(), source, confidence: baseConfidence },
    }
  } else if (
    result.sponsorIndia?.name &&
    (documentType === 'hotel_booking' || documentType === 'invitation_letter' || documentType === 'invitation')
  ) {
    const isApplicantPhone = text.match(/(?:applicant|guest|passenger|visitor)\s*(?:phone|mobile|tel)[:\s]+(\+?[\d\s()-]{7,25})/i)
    const generalPhoneMatch = text.match(/(?:hotel\s*phone|contact\s*no|phone(?:\s*number)?|tel|telephone|mobile)[:\s]+(\+?[\d\s()-]{7,25})/i)
    if (generalPhoneMatch && generalPhoneMatch[1]) {
      if (!isApplicantPhone || isApplicantPhone[1].trim() !== generalPhoneMatch[1].trim()) {
        result.sponsorIndia = {
          ...result.sponsorIndia,
          phone: { value: generalPhoneMatch[1].trim(), source, confidence: baseConfidence },
        }
      }
    }
  }

  // 16. BANGLADESH / HOME MISSION REFERENCE EXTRACTION
  const homeRefNameMatch = text.match(
    /(?:home\s*(?:country\s*)?reference(?:\s*name)?|reference\s*in\s*(?:home\s*country|bangladesh)(?:\s*name)?|reference\s*in\s*bangladesh|contact\s*person\s*in\s*bangladesh)[:\s]+([A-Za-z0-9 .'-]{2,60})/i
  )
  if (homeRefNameMatch && homeRefNameMatch[1]) {
    result.sponsorMission = {
      ...result.sponsorMission,
      name: { value: homeRefNameMatch[1].trim().toUpperCase(), source, confidence: baseConfidence },
    }
  }

  const homeRefAdd1Match = text.match(
    /(?:home\s*reference\s*address(?:\s*line\s*1)?|reference\s*in\s*(?:home\s*country|bangladesh)\s*address|address\s*in\s*bangladesh)[:\s]+([^\r\n]+)/i
  )
  if (homeRefAdd1Match && homeRefAdd1Match[1]) {
    result.sponsorMission = {
      ...result.sponsorMission,
      addressLine1: { value: homeRefAdd1Match[1].trim(), source, confidence: baseConfidence },
    }
  }

  const homeRefAdd2Match = text.match(
    /(?:home\s*reference\s*address\s*line\s*2)[:\s]+([^\r\n]+)/i
  )
  if (homeRefAdd2Match && homeRefAdd2Match[1]) {
    result.sponsorMission = {
      ...result.sponsorMission,
      addressLine2: { value: homeRefAdd2Match[1].trim(), source, confidence: baseConfidence },
    }
  }

  const homeRefPhoneMatch = text.match(
    /(?:home\s*reference\s*phone|reference\s*in\s*(?:home\s*country|bangladesh)\s*(?:phone|tel|mobile)|contact\s*phone|reference\s*in\s*bangladesh\s*phone)[:\s]+(\+?[\d\s()-]{7,25})/i
  )
  if (homeRefPhoneMatch && homeRefPhoneMatch[1]) {
    result.sponsorMission = {
      ...result.sponsorMission,
      phone: { value: homeRefPhoneMatch[1].trim(), source, confidence: baseConfidence },
    }
  } else if (
    result.sponsorMission?.name &&
    (documentType === 'reference_doc' || documentType === 'sponsor_mission' || documentType === 'home_reference')
  ) {
    const isApplicantPhone = text.match(/(?:applicant|visitor)\s*(?:phone|mobile|tel)[:\s]+(\+?[\d\s()-]{7,25})/i)
    const generalPhoneMatch = text.match(/(?:reference\s*phone|contact\s*phone|contact\s*no|phone(?:\s*number)?|tel|telephone|mobile)[:\s]+(\+?[\d\s()-]{7,25})/i)
    if (generalPhoneMatch && generalPhoneMatch[1]) {
      if (!isApplicantPhone || isApplicantPhone[1].trim() !== generalPhoneMatch[1].trim()) {
        result.sponsorMission = {
          ...result.sponsorMission,
          phone: { value: generalPhoneMatch[1].trim(), source, confidence: baseConfidence },
        }
      }
    }
  }

  if (result.personal && Object.keys(result.personal).length === 0) delete result.personal
  if (result.passport && Object.keys(result.passport).length === 0) delete result.passport
  if (result.contact && Object.keys(result.contact).length === 0) delete result.contact
  if (result.presentAddress && Object.keys(result.presentAddress).length === 0) delete result.presentAddress
  if (result.permanentAddress && Object.keys(result.permanentAddress).length === 0) delete result.permanentAddress
  if (result.family && Object.keys(result.family).length === 0) delete result.family
  if (result.employment && Object.keys(result.employment).length === 0) delete result.employment
  if (result.travel && Object.keys(result.travel).length === 0) delete result.travel
  if (result.previousVisa && Object.keys(result.previousVisa).length === 0) delete result.previousVisa
  if (result.sponsorIndia && Object.keys(result.sponsorIndia).length === 0) delete result.sponsorIndia
  if (result.sponsorMission && Object.keys(result.sponsorMission).length === 0) delete result.sponsorMission

  return result
}

/**
 * Extracts candidate fields from PDF raw text using conservative regex pattern matching & MRZ detection.
 */
export function extractFromPdfText(fullText: string): ExtractedApplicantData {
  const candidateList: ExtractedApplicantData[] = []
  if (fullText) {
    const mrzRes = parsePassportMrz(fullText)
    if (mrzRes.success && mrzRes.data) {
      candidateList.push(extractFromMrz(mrzRes.data))
    }
    candidateList.push(extractFromRawText(fullText, 'pdf-text', 85))
  }
  if (candidateList.length === 0) return {}
  if (candidateList.length === 1) return candidateList[0]
  return mergeExtractedCandidateData(candidateList).merged
}

/**
 * Extracts candidate fields from OCR text using conservative regex pattern matching & MRZ detection.
 */
export function extractFromOcrText(ocrResult: OcrResult): ExtractedApplicantData {
  if (!ocrResult || !ocrResult.text) return {}
  const candidateList: ExtractedApplicantData[] = []
  const mrzRes = parsePassportMrz(ocrResult.text)
  if (mrzRes.success && mrzRes.data) {
    candidateList.push(extractFromMrz(mrzRes.data))
  }
  const baseConfidence = Math.round((ocrResult.confidence || 70) * 0.9)
  candidateList.push(extractFromRawText(ocrResult.text, 'ocr', baseConfidence))
  if (candidateList.length === 0) return {}
  if (candidateList.length === 1) return candidateList[0]
  return mergeExtractedCandidateData(candidateList).merged
}

export interface ExtractedDocumentInput {
  id?: string
  documentType?: string
  fileName?: string
  text?: string
  mrzData?: PassportMrzData
  ocrResult?: OcrResult
}

/**
 * Extracts and merges applicant data across multiple documents conservatively.
 */
export function extractApplicantDataFromDocuments(
  docs: ExtractedDocumentInput[]
): ExtractedApplicantData {
  const candidateList: ExtractedApplicantData[] = []
  for (const doc of docs) {
    if (doc.mrzData) {
      candidateList.push(extractFromMrz(doc.mrzData))
    }
    if (doc.text) {
      if (doc.text.includes('P<') || doc.documentType === 'passport') {
        const mrzRes = parsePassportMrz(doc.text)
        if (mrzRes.success && mrzRes.data) {
          candidateList.push(extractFromMrz(mrzRes.data))
        }
      }
      let confidence = 85
      if (
        doc.documentType === 'flight_itinerary' ||
        doc.fileName?.includes('ticket') ||
        doc.fileName?.includes('itinerary')
      ) {
        confidence = 92
      } else if (doc.documentType === 'previous_visa' || doc.fileName?.includes('visa')) {
        confidence = 95
      } else if (doc.documentType === 'hotel_booking' || doc.documentType === 'invitation_letter') {
        confidence = 90
      } else if (doc.documentType === 'generic_document' || doc.fileName?.includes('notes')) {
        confidence = 60
      }
      candidateList.push(extractFromRawText(doc.text, 'pdf-text', confidence, doc.documentType))
    }
    if (doc.ocrResult) {
      candidateList.push(extractFromOcrText(doc.ocrResult))
    }
  }
  if (candidateList.length === 0) return {}
  return mergeExtractedCandidateData(candidateList).merged
}

const SOURCE_PRIORITY: Record<ExtractionSource, number> = {
  mrz: 1,
  'pdf-text': 2,
  ocr: 3,
  'manual-review': 4,
}

/**
 * Merges multiple candidate extraction sources using a deterministic source priority rule:
 * MRZ (1) > PDF Text (2) > OCR (3) > Manual Review (4)
 * Records conflicts if candidates from different sources return conflicting non-empty values.
 */
export function mergeExtractedCandidateData(
  candidateList: ExtractedApplicantData[]
): { merged: ExtractedApplicantData; conflicts: ExtractedFieldConflict<unknown>[] } {
  const merged: ExtractedApplicantData = {
    personal: {},
    passport: {},
    contact: {},
    presentAddress: {},
    permanentAddress: {},
    family: {},
    employment: {},
    travel: {},
    previousVisa: {},
    sponsorIndia: {},
    sponsorMission: {},
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

    // Sort by source priority first, then descending confidence
    fields.sort((a, b) => {
      const sourceDiff = (SOURCE_PRIORITY[a.source] || 99) - (SOURCE_PRIORITY[b.source] || 99)
      if (sourceDiff !== 0) return sourceDiff
      return (b.confidence || 0) - (a.confidence || 0)
    })

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

  // Personal Fields
  mergeField('personal.lastName', 'Surname', (c) => c.personal?.lastName, (val) => { merged.personal!.lastName = val })
  mergeField('personal.firstName', 'Given Names', (c) => c.personal?.firstName, (val) => { merged.personal!.firstName = val })
  mergeField('personal.fullName', 'Full Name', (c) => c.personal?.fullName, (val) => { merged.personal!.fullName = val })
  mergeField('personal.dateOfBirth', 'Date of Birth', (c) => c.personal?.dateOfBirth, (val) => { merged.personal!.dateOfBirth = val })
  mergeField('personal.gender', 'Gender', (c) => c.personal?.gender, (val) => { merged.personal!.gender = val })
  mergeField('personal.nationality', 'Nationality', (c) => c.personal?.nationality, (val) => { merged.personal!.nationality = val })
  mergeField('personal.townCityOfBirth', 'Town/City of Birth', (c) => c.personal?.townCityOfBirth, (val) => { merged.personal!.townCityOfBirth = val })
  mergeField('personal.countryOfBirth', 'Country of Birth', (c) => c.personal?.countryOfBirth, (val) => { merged.personal!.countryOfBirth = val })
  mergeField('personal.nationalIdNumber', 'National ID Number', (c) => c.personal?.nationalIdNumber, (val) => { merged.personal!.nationalIdNumber = val })
  mergeField('personal.religion', 'Religion', (c) => c.personal?.religion, (val) => { merged.personal!.religion = val })
  mergeField('personal.educationalQualification', 'Educational Qualification', (c) => c.personal?.educationalQualification, (val) => { merged.personal!.educationalQualification = val })
  mergeField('personal.visibleIdentificationMarks', 'Visible Identification Marks', (c) => c.personal?.visibleIdentificationMarks, (val) => { merged.personal!.visibleIdentificationMarks = val })
  mergeField('personal.previousNationality', 'Previous Nationality', (c) => c.personal?.previousNationality, (val) => { merged.personal!.previousNationality = val })
  mergeField('personal.maritalStatus', 'Marital Status', (c) => c.personal?.maritalStatus, (val) => { merged.personal!.maritalStatus = val })
  mergeField('personal.hasChangedName', 'Has Changed Name', (c) => c.personal?.hasChangedName, (val) => { merged.personal!.hasChangedName = val })
  mergeField('personal.previousName', 'Previous Name', (c) => c.personal?.previousName, (val) => { merged.personal!.previousName = val })

  // Passport Fields
  mergeField('passport.passportNumber', 'Passport Number', (c) => c.passport?.passportNumber, (val) => { merged.passport!.passportNumber = val })
  mergeField('passport.passportType', 'Passport Type', (c) => c.passport?.passportType, (val) => { merged.passport!.passportType = val })
  mergeField('passport.issuingCountry', 'Issuing Country', (c) => c.passport?.issuingCountry, (val) => { merged.passport!.issuingCountry = val })
  mergeField('passport.issueDate', 'Passport Issue Date', (c) => c.passport?.issueDate, (val) => { merged.passport!.issueDate = val })
  mergeField('passport.expiryDate', 'Passport Expiry Date', (c) => c.passport?.expiryDate, (val) => { merged.passport!.expiryDate = val })
  mergeField('passport.placeOfIssue', 'Passport Place of Issue', (c) => c.passport?.placeOfIssue, (val) => { merged.passport!.placeOfIssue = val })
  mergeField('passport.holdsOtherPassport', 'Holds Other Passport', (c) => c.passport?.holdsOtherPassport, (val) => { merged.passport!.holdsOtherPassport = val })
  mergeField('passport.otherPassportDetails.passportNumber', 'Other Passport Number', (c) => c.passport?.otherPassportDetails?.passportNumber, (val) => {
    if (!merged.passport!.otherPassportDetails) merged.passport!.otherPassportDetails = {}
    merged.passport!.otherPassportDetails.passportNumber = val
  })
  mergeField('passport.otherPassportDetails.placeOfIssue', 'Other Passport Place of Issue', (c) => c.passport?.otherPassportDetails?.placeOfIssue, (val) => {
    if (!merged.passport!.otherPassportDetails) merged.passport!.otherPassportDetails = {}
    merged.passport!.otherPassportDetails.placeOfIssue = val
  })
  mergeField('passport.otherPassportDetails.countryOfIssue', 'Other Passport Country of Issue', (c) => c.passport?.otherPassportDetails?.countryOfIssue, (val) => {
    if (!merged.passport!.otherPassportDetails) merged.passport!.otherPassportDetails = {}
    merged.passport!.otherPassportDetails.countryOfIssue = val
  })
  mergeField('passport.otherPassportDetails.nationalityInPassport', 'Other Passport Nationality', (c) => c.passport?.otherPassportDetails?.nationalityInPassport, (val) => {
    if (!merged.passport!.otherPassportDetails) merged.passport!.otherPassportDetails = {}
    merged.passport!.otherPassportDetails.nationalityInPassport = val
  })
  mergeField('passport.otherPassportDetails.issueDate', 'Other Passport Issue Date', (c) => c.passport?.otherPassportDetails?.issueDate, (val) => {
    if (!merged.passport!.otherPassportDetails) merged.passport!.otherPassportDetails = {}
    merged.passport!.otherPassportDetails.issueDate = val
  })

  // Contact Fields
  mergeField('contact.email', 'Email Address', (c) => c.contact?.email, (val) => { merged.contact!.email = val })
  mergeField('contact.mobile', 'Mobile Phone', (c) => c.contact?.mobile, (val) => { merged.contact!.mobile = val })
  mergeField('contact.phone', 'Phone Number', (c) => c.contact?.phone, (val) => { merged.contact!.phone = val })

  // Present Address Fields
  mergeField('presentAddress.addressLine1', 'Present Address Line 1', (c) => c.presentAddress?.addressLine1, (val) => { merged.presentAddress!.addressLine1 = val })
  mergeField('presentAddress.addressLine2', 'Present Address Line 2', (c) => c.presentAddress?.addressLine2, (val) => { merged.presentAddress!.addressLine2 = val })
  mergeField('presentAddress.villageTownCity', 'Present City/Town/Village', (c) => c.presentAddress?.villageTownCity, (val) => { merged.presentAddress!.villageTownCity = val })
  mergeField('presentAddress.district', 'Present District', (c) => c.presentAddress?.district, (val) => { merged.presentAddress!.district = val })
  mergeField('presentAddress.stateProvince', 'Present State/Province', (c) => c.presentAddress?.stateProvince, (val) => { merged.presentAddress!.stateProvince = val })
  mergeField('presentAddress.country', 'Present Country', (c) => c.presentAddress?.country, (val) => { merged.presentAddress!.country = val })
  mergeField('presentAddress.postalCode', 'Present Postal Code', (c) => c.presentAddress?.postalCode, (val) => { merged.presentAddress!.postalCode = val })

  // Permanent Address Fields
  mergeField('permanentAddress.addressLine1', 'Permanent Address Line 1', (c) => c.permanentAddress?.addressLine1, (val) => { merged.permanentAddress!.addressLine1 = val })
  mergeField('permanentAddress.addressLine2', 'Permanent Address Line 2', (c) => c.permanentAddress?.addressLine2, (val) => { merged.permanentAddress!.addressLine2 = val })
  mergeField('permanentAddress.villageTownCity', 'Permanent City/Town/Village', (c) => c.permanentAddress?.villageTownCity, (val) => { merged.permanentAddress!.villageTownCity = val })
  mergeField('permanentAddress.district', 'Permanent District', (c) => c.permanentAddress?.district, (val) => { merged.permanentAddress!.district = val })
  mergeField('permanentAddress.stateProvince', 'Permanent State/Province', (c) => c.permanentAddress?.stateProvince, (val) => { merged.permanentAddress!.stateProvince = val })
  mergeField('permanentAddress.country', 'Permanent Country', (c) => c.permanentAddress?.country, (val) => { merged.permanentAddress!.country = val })
  mergeField('permanentAddress.postalCode', 'Permanent Postal Code', (c) => c.permanentAddress?.postalCode, (val) => { merged.permanentAddress!.postalCode = val })

  // Family Fields - Father
  mergeField('family.father.name', "Father's Name", (c) => c.family?.father?.name, (val) => {
    if (!merged.family!.father) merged.family!.father = {}
    merged.family!.father.name = val
  })
  mergeField('family.father.placeOfBirth', "Father's Place of Birth", (c) => c.family?.father?.placeOfBirth, (val) => {
    if (!merged.family!.father) merged.family!.father = {}
    merged.family!.father.placeOfBirth = val
  })
  mergeField('family.father.countryOfBirth', "Father's Country of Birth", (c) => c.family?.father?.countryOfBirth, (val) => {
    if (!merged.family!.father) merged.family!.father = {}
    merged.family!.father.countryOfBirth = val
  })
  mergeField('family.father.nationality', "Father's Nationality", (c) => c.family?.father?.nationality, (val) => {
    if (!merged.family!.father) merged.family!.father = {}
    merged.family!.father.nationality = val
  })
  mergeField('family.father.previousNationality', "Father's Previous Nationality", (c) => c.family?.father?.previousNationality, (val) => {
    if (!merged.family!.father) merged.family!.father = {}
    merged.family!.father.previousNationality = val
  })

  // Family Fields - Mother
  mergeField('family.mother.name', "Mother's Name", (c) => c.family?.mother?.name, (val) => {
    if (!merged.family!.mother) merged.family!.mother = {}
    merged.family!.mother.name = val
  })
  mergeField('family.mother.placeOfBirth', "Mother's Place of Birth", (c) => c.family?.mother?.placeOfBirth, (val) => {
    if (!merged.family!.mother) merged.family!.mother = {}
    merged.family!.mother.placeOfBirth = val
  })
  mergeField('family.mother.countryOfBirth', "Mother's Country of Birth", (c) => c.family?.mother?.countryOfBirth, (val) => {
    if (!merged.family!.mother) merged.family!.mother = {}
    merged.family!.mother.countryOfBirth = val
  })
  mergeField('family.mother.nationality', "Mother's Nationality", (c) => c.family?.mother?.nationality, (val) => {
    if (!merged.family!.mother) merged.family!.mother = {}
    merged.family!.mother.nationality = val
  })
  mergeField('family.mother.previousNationality', "Mother's Previous Nationality", (c) => c.family?.mother?.previousNationality, (val) => {
    if (!merged.family!.mother) merged.family!.mother = {}
    merged.family!.mother.previousNationality = val
  })

  // Family Fields - Spouse
  mergeField('family.spouse.name', "Spouse's Name", (c) => c.family?.spouse?.name, (val) => {
    if (!merged.family!.spouse) merged.family!.spouse = {}
    merged.family!.spouse.name = val
  })
  mergeField('family.spouse.placeOfBirth', "Spouse's Place of Birth", (c) => c.family?.spouse?.placeOfBirth, (val) => {
    if (!merged.family!.spouse) merged.family!.spouse = {}
    merged.family!.spouse.placeOfBirth = val
  })
  mergeField('family.spouse.countryOfBirth', "Spouse's Country of Birth", (c) => c.family?.spouse?.countryOfBirth, (val) => {
    if (!merged.family!.spouse) merged.family!.spouse = {}
    merged.family!.spouse.countryOfBirth = val
  })
  mergeField('family.spouse.nationality', "Spouse's Nationality", (c) => c.family?.spouse?.nationality, (val) => {
    if (!merged.family!.spouse) merged.family!.spouse = {}
    merged.family!.spouse.nationality = val
  })
  mergeField('family.spouse.previousNationality', "Spouse's Previous Nationality", (c) => c.family?.spouse?.previousNationality, (val) => {
    if (!merged.family!.spouse) merged.family!.spouse = {}
    merged.family!.spouse.previousNationality = val
  })

  // Family Fields - Grandparent / Pakistan
  mergeField('family.hasPakistanRelation', 'Grandparent Pakistan Relation', (c) => c.family?.hasPakistanRelation, (val) => { merged.family!.hasPakistanRelation = val })
  mergeField('family.pakistanRelationDetails', 'Grandparent Relation Details', (c) => c.family?.pakistanRelationDetails, (val) => { merged.family!.pakistanRelationDetails = val })

  // Employment Fields
  mergeField('employment.presentOccupation', 'Present Occupation', (c) => c.employment?.presentOccupation, (val) => { merged.employment!.presentOccupation = val })
  mergeField('employment.employerName', 'Employer Name', (c) => c.employment?.employerName, (val) => { merged.employment!.employerName = val })
  mergeField('employment.designationRank', 'Employer Designation', (c) => c.employment?.designationRank, (val) => { merged.employment!.designationRank = val })
  mergeField('employment.employerAddress', 'Employer Address', (c) => c.employment?.employerAddress, (val) => { merged.employment!.employerAddress = val })
  mergeField('employment.employerPhone', 'Employer Phone', (c) => c.employment?.employerPhone, (val) => { merged.employment!.employerPhone = val })
  mergeField('employment.pastOccupation', 'Past Occupation', (c) => c.employment?.pastOccupation, (val) => { merged.employment!.pastOccupation = val })
  mergeField('employment.hasMilitaryService', 'Military Service Flag', (c) => c.employment?.hasMilitaryService, (val) => { merged.employment!.hasMilitaryService = val })
  mergeField('employment.militaryOrganization', 'Military Organization', (c) => c.employment?.militaryOrganization, (val) => { merged.employment!.militaryOrganization = val })
  mergeField('employment.militaryDesignation', 'Military Designation', (c) => c.employment?.militaryDesignation, (val) => { merged.employment!.militaryDesignation = val })
  mergeField('employment.militaryRank', 'Military Rank', (c) => c.employment?.militaryRank, (val) => { merged.employment!.militaryRank = val })
  mergeField('employment.militaryPlaceOfPosting', 'Military Posting', (c) => c.employment?.militaryPlaceOfPosting, (val) => { merged.employment!.militaryPlaceOfPosting = val })

  // Travel Fields
  mergeField('travel.journeyDate', 'Travel / Journey Date', (c) => c.travel?.journeyDate, (val) => {
    if (!merged.travel) merged.travel = {}
    merged.travel.journeyDate = val
  })
  mergeField('travel.intendedArrivalDate', 'Intended Arrival Date', (c) => c.travel?.intendedArrivalDate, (val) => {
    if (!merged.travel) merged.travel = {}
    merged.travel.intendedArrivalDate = val
  })
  mergeField('travel.duration', 'Visa Duration', (c) => c.travel?.duration, (val) => {
    if (!merged.travel) merged.travel = {}
    merged.travel.duration = val
  })
  mergeField('travel.visaEntryType', 'Visa Entry Type', (c) => c.travel?.visaEntryType, (val) => {
    if (!merged.travel) merged.travel = {}
    merged.travel.visaEntryType = val
  })
  mergeField('travel.entryPoint', 'Port of Entry', (c) => c.travel?.entryPoint, (val) => {
    if (!merged.travel) merged.travel = {}
    merged.travel.entryPoint = val
  })
  mergeField('travel.exitPoint', 'Port of Exit', (c) => c.travel?.exitPoint, (val) => {
    if (!merged.travel) merged.travel = {}
    merged.travel.exitPoint = val
  })
  mergeField('travel.purposeOfVisit', 'Purpose of Visit', (c) => c.travel?.purposeOfVisit, (val) => {
    if (!merged.travel) merged.travel = {}
    merged.travel.purposeOfVisit = val
  })
  mergeField('travel.countriesVisited', 'Countries Visited', (c) => c.travel?.countriesVisited, (val) => {
    if (!merged.travel) merged.travel = {}
    merged.travel.countriesVisited = val
  })
  mergeField('travel.visitedSaarc', 'Visited SAARC', (c) => c.travel?.visitedSaarc, (val) => {
    if (!merged.travel) merged.travel = {}
    merged.travel.visitedSaarc = val
  })

  // Previous Visa Fields
  mergeField('previousVisa.hasPreviousVisa', 'Has Previous Indian Visa', (c) => c.previousVisa?.hasPreviousVisa, (val) => {
    if (!merged.previousVisa) merged.previousVisa = {}
    merged.previousVisa.hasPreviousVisa = val
  })
  mergeField('previousVisa.visaNumber', 'Old Visa Number', (c) => c.previousVisa?.visaNumber, (val) => {
    if (!merged.previousVisa) merged.previousVisa = {}
    merged.previousVisa.visaNumber = val
  })
  mergeField('previousVisa.visaType', 'Old Visa Type', (c) => c.previousVisa?.visaType, (val) => {
    if (!merged.previousVisa) merged.previousVisa = {}
    merged.previousVisa.visaType = val
  })
  mergeField('previousVisa.placeOfIssue', 'Old Visa Issue Place', (c) => c.previousVisa?.placeOfIssue, (val) => {
    if (!merged.previousVisa) merged.previousVisa = {}
    merged.previousVisa.placeOfIssue = val
  })
  mergeField('previousVisa.dateOfIssue', 'Old Visa Issue Date', (c) => c.previousVisa?.dateOfIssue, (val) => {
    if (!merged.previousVisa) merged.previousVisa = {}
    merged.previousVisa.dateOfIssue = val
  })
  mergeField('previousVisa.visitedAddress1', 'Previous Visit Address 1', (c) => c.previousVisa?.visitedAddress1, (val) => {
    if (!merged.previousVisa) merged.previousVisa = {}
    merged.previousVisa.visitedAddress1 = val
  })
  mergeField('previousVisa.visitedAddress2', 'Previous Visit Address 2', (c) => c.previousVisa?.visitedAddress2, (val) => {
    if (!merged.previousVisa) merged.previousVisa = {}
    merged.previousVisa.visitedAddress2 = val
  })
  mergeField('previousVisa.visitedAddress3', 'Previous Visit Address 3', (c) => c.previousVisa?.visitedAddress3, (val) => {
    if (!merged.previousVisa) merged.previousVisa = {}
    merged.previousVisa.visitedAddress3 = val
  })
  mergeField('previousVisa.hasRefusal', 'Has Visa Refusal', (c) => c.previousVisa?.hasRefusal, (val) => {
    if (!merged.previousVisa) merged.previousVisa = {}
    merged.previousVisa.hasRefusal = val
  })
  mergeField('previousVisa.refusalDetails', 'Visa Refusal Details', (c) => c.previousVisa?.refusalDetails, (val) => {
    if (!merged.previousVisa) merged.previousVisa = {}
    merged.previousVisa.refusalDetails = val
  })

  // Sponsor in India Fields
  mergeField('sponsorIndia.name', 'Sponsor in India Name', (c) => c.sponsorIndia?.name, (val) => {
    if (!merged.sponsorIndia) merged.sponsorIndia = {}
    merged.sponsorIndia.name = val
  })
  mergeField('sponsorIndia.addressLine1', 'Sponsor in India Address Line 1', (c) => c.sponsorIndia?.addressLine1, (val) => {
    if (!merged.sponsorIndia) merged.sponsorIndia = {}
    merged.sponsorIndia.addressLine1 = val
  })
  mergeField('sponsorIndia.addressLine2', 'Sponsor in India Address Line 2', (c) => c.sponsorIndia?.addressLine2, (val) => {
    if (!merged.sponsorIndia) merged.sponsorIndia = {}
    merged.sponsorIndia.addressLine2 = val
  })
  mergeField('sponsorIndia.phone', 'Sponsor in India Phone', (c) => c.sponsorIndia?.phone, (val) => {
    if (!merged.sponsorIndia) merged.sponsorIndia = {}
    merged.sponsorIndia.phone = val
  })

  // Reference in Home / Mission Country Fields
  mergeField('sponsorMission.name', 'Reference in Home Country Name', (c) => c.sponsorMission?.name, (val) => {
    if (!merged.sponsorMission) merged.sponsorMission = {}
    merged.sponsorMission.name = val
  })
  mergeField('sponsorMission.addressLine1', 'Reference in Home Country Address Line 1', (c) => c.sponsorMission?.addressLine1, (val) => {
    if (!merged.sponsorMission) merged.sponsorMission = {}
    merged.sponsorMission.addressLine1 = val
  })
  mergeField('sponsorMission.addressLine2', 'Reference in Home Country Address Line 2', (c) => c.sponsorMission?.addressLine2, (val) => {
    if (!merged.sponsorMission) merged.sponsorMission = {}
    merged.sponsorMission.addressLine2 = val
  })
  mergeField('sponsorMission.phone', 'Reference in Home Country Phone', (c) => c.sponsorMission?.phone, (val) => {
    if (!merged.sponsorMission) merged.sponsorMission = {}
    merged.sponsorMission.phone = val
  })

  if (merged.personal && Object.keys(merged.personal).length === 0) delete merged.personal
  if (merged.passport && Object.keys(merged.passport).length === 0) delete merged.passport
  if (merged.contact && Object.keys(merged.contact).length === 0) delete merged.contact
  if (merged.presentAddress && Object.keys(merged.presentAddress).length === 0) delete merged.presentAddress
  if (merged.permanentAddress && Object.keys(merged.permanentAddress).length === 0) delete merged.permanentAddress
  if (merged.family && Object.keys(merged.family).length === 0) delete merged.family
  if (merged.employment && Object.keys(merged.employment).length === 0) delete merged.employment
  if (merged.travel && Object.keys(merged.travel).length === 0) delete merged.travel
  if (merged.previousVisa && Object.keys(merged.previousVisa).length === 0) delete merged.previousVisa
  if (merged.sponsorIndia && Object.keys(merged.sponsorIndia).length === 0) delete merged.sponsorIndia
  if (merged.sponsorMission && Object.keys(merged.sponsorMission).length === 0) delete merged.sponsorMission

  return { merged, conflicts }
}
