import type { ExtractedApplicantData } from '../data/types'
import { parseStandardIsoDate } from '../data/applicantDataExtractor'

export const DEFAULT_GEMINI_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) ||
  ''

/**
 * Retrieves the stored Gemini API key from chrome.storage.local or falls back to environment variable.
 */
export async function getGeminiApiKey(): Promise<string> {
  const envKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) ||
    ''

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['visa_autofill_gemini_api_key'], (res) => {
        const storedKey = res?.visa_autofill_gemini_api_key
        if (typeof storedKey === 'string' && storedKey.trim()) {
          resolve(storedKey.trim())
        } else {
          resolve(envKey)
        }
      })
    })
  }
  return envKey
}

/**
 * Saves a new Gemini API key to chrome.storage.local.
 */
export async function saveGeminiApiKey(apiKey: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ visa_autofill_gemini_api_key: apiKey.trim() }, () => {
        resolve()
      })
    })
  }
}

export interface GeminiExtractionOptions {
  apiKey?: string
  modelName?: string
}

const PASSPORT_EXTRACTION_PROMPT = `
You are an expert OCR & document parsing AI specializing in international passports, visas, and identification documents (especially Bangladeshi, Indian, and South Asian passports).

Analyze the provided passport image(s) (including dual-page scans, MRZ lines, emergency contact, and visual data fields).
Extract ALL applicant and passport information with 100% accuracy.

Return ONLY a valid JSON object matching the following structure:
{
  "personal": {
    "surname": "Exact surname or last name",
    "givenNames": "Exact given names or first names",
    "fullName": "Full name as printed",
    "sex": "male" | "female" | "other",
    "dateOfBirth": "YYYY-MM-DD",
    "townCityOfBirth": "Town or City of birth",
    "countryOfBirth": "Country of birth (e.g. BANGLADESH)",
    "nationality": "Nationality (e.g. BANGLADESH)",
    "nationalIdNumber": "National ID / Personal No / NID / NIC number",
    "religion": "Religion if explicitly mentioned (e.g. ISLAM, HINDU, BUDDHISM, CHRISTIAN, SIKH, JAIN, OTHERS)",
    "educationalQualification": "BELOW MATRICULATION | MATRICULATION | HIGHER SECONDARY | GRADUATE | POST GRADUATE | PROFESSIONAL | ILLITERATE | OTHERS",
    "visibleIdentificationMarks": "Visible identification marks or NA if none",
    "maritalStatus": "Married | Single | Divorced | Widow/Widower"
  },
  "passport": {
    "passportNumber": "Exact passport number (e.g. E12345678)",
    "passportType": "P",
    "issuingCountry": "Country of issue (e.g. BANGLADESH)",
    "placeOfIssue": "Place of issue / Issuing authority (e.g. DIP/DHAKA or DHAKA)",
    "issueDate": "YYYY-MM-DD",
    "expiryDate": "YYYY-MM-DD",
    "holdsOtherPassport": true,
    "otherPassportNumber": "Previous passport number if mentioned (e.g. EA0123456)",
    "otherPassportPlaceOfIssue": "Place of issue of previous passport (e.g. DHAKA)",
    "otherPassportCountryOfIssue": "Country of issue of previous passport (e.g. BANGLADESH)",
    "otherPassportNationality": "Nationality in previous passport (e.g. BANGLADESH)"
  },
  "contact": {
    "email": "Email address if present",
    "phone": "Full phone number with country code (e.g. +8801700000000)",
    "mobile": "10-digit local mobile number without leading 0/code (e.g. 1700000000)",
    "isdCode": "Country ISD dialing code (e.g. 880 for Bangladesh)"
  },
  "presentAddress": {
    "addressLine1": "Primary street/village/house (e.g. HOUSE 12, ROAD 4)",
    "addressLine2": "Secondary area/colony/thana (e.g. SECTOR 3, UTTARA)",
    "villageTownCity": "Village, Town or City",
    "district": "District name (e.g. DHAKA)",
    "stateProvince": "State or Province name (e.g. DHAKA)",
    "postalCode": "Postal code or Pincode (e.g. 1230)",
    "country": "Country (e.g. BANGLADESH)"
  },
  "permanentAddress": {
    "addressLine1": "Primary street/village/house (e.g. VILLAGE GREEN)",
    "addressLine2": "Secondary area/colony/thana (e.g. POST OFFICE BAZAR)",
    "villageTownCity": "Village, Town or City",
    "district": "District name (e.g. CHITTAGONG)",
    "stateProvince": "State or Province name (e.g. CHITTAGONG)",
    "postalCode": "Postal code or Pincode (e.g. 4000)",
    "country": "Country (e.g. BANGLADESH)"
  },
  "family": {
    "fatherName": "Father's full name",
    "fatherNationality": "BANGLADESH",
    "fatherCountryOfBirth": "BANGLADESH",
    "fatherPlaceOfBirth": "Father's town/district of birth",
    "motherName": "Mother's full name",
    "motherNationality": "BANGLADESH",
    "motherCountryOfBirth": "BANGLADESH",
    "motherPlaceOfBirth": "Mother's town/district of birth",
    "spouseName": "Spouse's full name (from spouse or emergency contact relationship: SPOUSE)",
    "spouseNationality": "BANGLADESH",
    "spouseCountryOfBirth": "BANGLADESH",
    "spousePlaceOfBirth": "Spouse's town/district of birth"
  }
}

Rules:
1. Extract ALL fields present on Page 1 (Personal data & emergency contact) and Page 2 (Passport main visual & MRZ data).
2. For dates, format as YYYY-MM-DD.
3. If an Emergency Contact lists relationship as SPOUSE, populate spouseName with the emergency contact name and set maritalStatus to Married.
4. If Previous Passport No is found (e.g. EA0123456), set holdsOtherPassport to true and populate otherPassportNumber.
5. If phone is +8801700000000, set phone: "+8801700000000", isdCode: "880", mobile: "1700000000".
6. If a field is not found in the document, use null or omit it. Do not fabricate fake data.
`

/**
 * Extracts structured applicant data from passport image(s) using Gemini Vision API.
 */
export async function extractApplicantDataWithGemini(
  imagesBase64: string[],
  options?: GeminiExtractionOptions
): Promise<ExtractedApplicantData | null> {
  if (!imagesBase64 || imagesBase64.length === 0) return null

  const apiKey = (options?.apiKey || (await getGeminiApiKey())).trim()
  if (!apiKey) {
    return null
  }

  // Build inline_data parts for all pages/images
  const inlineParts = imagesBase64.map((raw) => {
    let cleanBase64 = raw
    let mimeType = 'image/jpeg'

    const match = raw.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      mimeType = match[1]
      cleanBase64 = match[2]
    }

    return {
      inline_data: {
        mime_type: mimeType,
        data: cleanBase64,
      },
    }
  })

  const requestBody = {
    contents: [
      {
        parts: [
          { text: PASSPORT_EXTRACTION_PROMPT },
          ...inlineParts,
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.1,
    },
  }

  const modelsToTry = [
    options?.modelName || 'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.7-flash',
    'gemini-3.1-flash-lite',
  ]

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        continue
      }

      const data = await response.json()
      const candidate = data.candidates?.[0]
      const rawJson = candidate?.content?.parts?.[0]?.text
      if (!rawJson) {
        continue
      }

      const parsed = JSON.parse(rawJson)
      const mappedData = mapGeminiOutputToApplicantData(parsed)
      console.log('gemini extracted data:', mappedData)

      return mappedData
    } catch {
      // Cascade to next model if error occurs
    }
  }

  return null
}

/**
 * Maps the raw structured JSON from Gemini Vision into standard ExtractedApplicantData.
 */
export function mapGeminiOutputToApplicantData(raw: Record<string, unknown>): ExtractedApplicantData {
  const result: ExtractedApplicantData = {
    personal: {},
    passport: {},
    contact: {},
    presentAddress: {},
    permanentAddress: {},
    family: {},
  }

  const confidence = 99
  const source = 'ai' as const

  // 1. Personal
  const p = (raw.personal || {}) as Record<string, string | undefined>
  if (p.surname) result.personal!.lastName = { value: String(p.surname).trim().toUpperCase(), source, confidence }
  if (p.givenNames) result.personal!.firstName = { value: String(p.givenNames).trim().toUpperCase(), source, confidence }
  if (p.fullName) result.personal!.fullName = { value: String(p.fullName).trim().toUpperCase(), source, confidence }
  else if (p.givenNames && p.surname) {
    result.personal!.fullName = { value: `${p.givenNames} ${p.surname}`.trim().toUpperCase(), source, confidence }
  }

  if (p.dateOfBirth) {
    const isoDob = parseStandardIsoDate(p.dateOfBirth) || p.dateOfBirth
    result.personal!.dateOfBirth = { value: isoDob, source, confidence }
  }

  if (p.sex) {
    const s = String(p.sex).toLowerCase()
    const normSex: 'male' | 'female' | 'other' = s.includes('f') ? 'female' : s.includes('other') ? 'other' : 'male'
    result.personal!.gender = { value: normSex, source, confidence }
  }

  if (p.townCityOfBirth) result.personal!.townCityOfBirth = { value: String(p.townCityOfBirth).trim().toUpperCase(), source, confidence }
  if (p.countryOfBirth) result.personal!.countryOfBirth = { value: String(p.countryOfBirth).trim().toUpperCase(), source, confidence }
  if (p.nationality) result.personal!.nationality = { value: String(p.nationality).trim().toUpperCase(), source, confidence }
  if (p.nationalIdNumber) result.personal!.nationalIdNumber = { value: String(p.nationalIdNumber).trim().toUpperCase(), source, confidence }
  if (p.religion) result.personal!.religion = { value: String(p.religion).trim().toUpperCase(), source, confidence }
  if (p.educationalQualification) result.personal!.educationalQualification = { value: String(p.educationalQualification).trim().toUpperCase(), source, confidence }
  if (p.visibleIdentificationMarks) result.personal!.visibleIdentificationMarks = { value: String(p.visibleIdentificationMarks).trim().toUpperCase(), source, confidence }
  if (p.maritalStatus) result.personal!.maritalStatus = { value: String(p.maritalStatus).trim(), source, confidence }

  // 2. Passport
  const ppt = (raw.passport || {}) as Record<string, unknown>
  if (ppt.passportNumber) result.passport!.passportNumber = { value: String(ppt.passportNumber).trim().toUpperCase(), source, confidence }
  if (ppt.passportType) result.passport!.passportType = { value: String(ppt.passportType).trim().toUpperCase(), source, confidence }
  if (ppt.issuingCountry) result.passport!.issuingCountry = { value: String(ppt.issuingCountry).trim().toUpperCase(), source, confidence }
  if (ppt.placeOfIssue) result.passport!.placeOfIssue = { value: String(ppt.placeOfIssue).trim().toUpperCase(), source, confidence }

  if (ppt.issueDate) {
    const isoIssue = parseStandardIsoDate(String(ppt.issueDate)) || String(ppt.issueDate)
    result.passport!.issueDate = { value: isoIssue, source, confidence }
  }
  if (ppt.expiryDate) {
    const isoExp = parseStandardIsoDate(String(ppt.expiryDate)) || String(ppt.expiryDate)
    result.passport!.expiryDate = { value: isoExp, source, confidence }
  }

  if (ppt.holdsOtherPassport === true || ppt.otherPassportNumber) {
    result.passport!.holdsOtherPassport = { value: true, source, confidence }
    result.passport!.otherPassportDetails = {
      passportNumber: ppt.otherPassportNumber ? { value: String(ppt.otherPassportNumber).trim().toUpperCase(), source, confidence } : undefined,
      placeOfIssue: { value: ppt.otherPassportPlaceOfIssue ? String(ppt.otherPassportPlaceOfIssue).trim().toUpperCase() : 'DHAKA', source, confidence },
      countryOfIssue: { value: ppt.otherPassportCountryOfIssue ? String(ppt.otherPassportCountryOfIssue).trim().toUpperCase() : 'BANGLADESH', source, confidence },
      nationalityInPassport: { value: ppt.otherPassportNationality ? String(ppt.otherPassportNationality).trim().toUpperCase() : 'BANGLADESH', source, confidence },
    }
  }

  // 3. Contact
  const c = (raw.contact || {}) as Record<string, unknown>
  if (c.email) result.contact!.email = { value: String(c.email).trim().toLowerCase(), source, confidence }
  if (c.phone) {
    result.contact!.phone = { value: String(c.phone).trim(), source, confidence }
    result.presentAddress!.phone = { value: String(c.phone).trim(), source, confidence }
  }
  if (c.mobile) {
    result.contact!.mobile = { value: String(c.mobile).trim(), source, confidence }
    result.presentAddress!.mobile = { value: String(c.mobile).trim(), source, confidence }
  }
  if (c.isdCode) {
    result.contact!.isdCode = { value: String(c.isdCode).trim(), source, confidence }
    result.presentAddress!.isdCode = { value: String(c.isdCode).trim(), source, confidence }
  }

  // 4. Present Address
  const pres = (raw.presentAddress || {}) as Record<string, unknown>
  if (pres.addressLine1) result.presentAddress!.addressLine1 = { value: String(pres.addressLine1).trim(), source, confidence }
  if (pres.addressLine2) result.presentAddress!.addressLine2 = { value: String(pres.addressLine2).trim(), source, confidence }
  if (pres.villageTownCity) result.presentAddress!.villageTownCity = { value: String(pres.villageTownCity).trim(), source, confidence }
  if (pres.district) result.presentAddress!.district = { value: String(pres.district).trim().toUpperCase(), source, confidence }
  if (pres.stateProvince) result.presentAddress!.stateProvince = { value: String(pres.stateProvince).trim().toUpperCase(), source, confidence }
  if (pres.postalCode) result.presentAddress!.postalCode = { value: String(pres.postalCode).trim(), source, confidence }
  if (pres.country) result.presentAddress!.country = { value: String(pres.country).trim().toUpperCase(), source, confidence }

  // 5. Permanent Address
  const perm = (raw.permanentAddress || {}) as Record<string, unknown>
  if (perm.addressLine1) result.permanentAddress!.addressLine1 = { value: String(perm.addressLine1).trim(), source, confidence }
  if (perm.addressLine2) result.permanentAddress!.addressLine2 = { value: String(perm.addressLine2).trim(), source, confidence }
  if (perm.villageTownCity) result.permanentAddress!.villageTownCity = { value: String(perm.villageTownCity).trim(), source, confidence }
  if (perm.district) result.permanentAddress!.district = { value: String(perm.district).trim().toUpperCase(), source, confidence }
  if (perm.stateProvince) result.permanentAddress!.stateProvince = { value: String(perm.stateProvince).trim().toUpperCase(), source, confidence }
  if (perm.postalCode) result.permanentAddress!.postalCode = { value: String(perm.postalCode).trim(), source, confidence }
  if (perm.country) result.permanentAddress!.country = { value: String(perm.country).trim().toUpperCase(), source, confidence }

  // 6. Family
  const fam = (raw.family || {}) as Record<string, unknown>
  if (fam.fatherName) {
    result.family!.father = {
      name: { value: String(fam.fatherName).trim().toUpperCase(), source, confidence },
      nationality: { value: fam.fatherNationality ? String(fam.fatherNationality).trim().toUpperCase() : 'BANGLADESH', source, confidence },
      countryOfBirth: { value: fam.fatherCountryOfBirth ? String(fam.fatherCountryOfBirth).trim().toUpperCase() : 'BANGLADESH', source, confidence },
      previousNationality: { value: 'BANGLADESH', source, confidence },
      placeOfBirth: fam.fatherPlaceOfBirth ? { value: String(fam.fatherPlaceOfBirth).trim().toUpperCase(), source, confidence } : undefined,
    }
  }

  if (fam.motherName) {
    result.family!.mother = {
      name: { value: String(fam.motherName).trim().toUpperCase(), source, confidence },
      nationality: { value: fam.motherNationality ? String(fam.motherNationality).trim().toUpperCase() : 'BANGLADESH', source, confidence },
      countryOfBirth: { value: fam.motherCountryOfBirth ? String(fam.motherCountryOfBirth).trim().toUpperCase() : 'BANGLADESH', source, confidence },
      previousNationality: { value: 'BANGLADESH', source, confidence },
      placeOfBirth: fam.motherPlaceOfBirth ? { value: String(fam.motherPlaceOfBirth).trim().toUpperCase(), source, confidence } : undefined,
    }
  }

  if (fam.spouseName) {
    result.family!.spouse = {
      name: { value: String(fam.spouseName).trim().toUpperCase(), source, confidence },
      nationality: { value: fam.spouseNationality ? String(fam.spouseNationality).trim().toUpperCase() : 'BANGLADESH', source, confidence },
      countryOfBirth: { value: fam.spouseCountryOfBirth ? String(fam.spouseCountryOfBirth).trim().toUpperCase() : 'BANGLADESH', source, confidence },
      previousNationality: { value: 'BANGLADESH', source, confidence },
      placeOfBirth: fam.spousePlaceOfBirth ? { value: String(fam.spousePlaceOfBirth).trim().toUpperCase(), source, confidence } : undefined,
    }
    if (!result.personal?.maritalStatus) {
      result.personal = {
        ...result.personal,
        maritalStatus: { value: 'Married', source, confidence },
      }
    }
  }

  // Clean empty objects
  if (result.personal && Object.keys(result.personal).length === 0) delete result.personal
  if (result.passport && Object.keys(result.passport).length === 0) delete result.passport
  if (result.contact && Object.keys(result.contact).length === 0) delete result.contact
  if (result.presentAddress && Object.keys(result.presentAddress).length === 0) delete result.presentAddress
  if (result.permanentAddress && Object.keys(result.permanentAddress).length === 0) delete result.permanentAddress
  if (result.family && Object.keys(result.family).length === 0) delete result.family

  return result
}
