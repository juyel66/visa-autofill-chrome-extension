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
You are an expert OCR & document parsing AI specializing in international passports, visas, national ID cards, and official travel documents (especially Bangladeshi, Indian, and South Asian passports/documents).

Analyze ALL provided document image(s) (including single/dual-page scans, MRZ lines, emergency contact page, visual data zones, and stamps).
Extract EVERY piece of applicant and passport/document information with 100% accuracy without missing anything written in the document.

Return ONLY a valid JSON object matching the following structure:
{
  "personal": {
    "surname": "Exact surname or last name",
    "givenNames": "Exact given names or first names",
    "fullName": "Full name as printed",
    "sex": "male" | "female" | "other",
    "dateOfBirth": "YYYY-MM-DD",
    "townCityOfBirth": "Town, City or District of birth",
    "countryOfBirth": "Country of birth (e.g. BANGLADESH)",
    "nationality": "Nationality (e.g. BANGLADESH)",
    "nationalIdNumber": "National ID / Personal No / NID / NIC number",
    "religion": "Religion if present (e.g. ISLAM, HINDU, BUDDHISM, CHRISTIAN, SIKH, JAIN, OTHERS)",
    "educationalQualification": "BELOW MATRICULATION | MATRICULATION | HIGHER SECONDARY | GRADUATE | POST GRADUATE | PROFESSIONAL | ILLITERATE | OTHERS",
    "visibleIdentificationMarks": "Visible identification marks or NA if none",
    "maritalStatus": "Married | Single | Divorced | Widow/Widower",
    "previousNationality": "Previous nationality if applicable",
    "hasChangedName": false,
    "previousName": null
  },
  "passport": {
    "passportNumber": "Exact passport number (e.g. E12345678)",
    "passportType": "P",
    "issuingCountry": "Country of issue (e.g. BANGLADESH)",
    "placeOfIssue": "Place of issue / Issuing authority (e.g. DIP/DHAKA or DHAKA)",
    "issueDate": "YYYY-MM-DD",
    "expiryDate": "YYYY-MM-DD",
    "holdsOtherPassport": true,
    "otherPassportNumber": "Previous / other passport number if mentioned",
    "otherPassportPlaceOfIssue": "Place of issue of previous passport (e.g. DHAKA)",
    "otherPassportCountryOfIssue": "Country of issue of previous passport (e.g. BANGLADESH)",
    "otherPassportNationality": "Nationality in previous passport (e.g. BANGLADESH)",
    "otherPassportIssueDate": "YYYY-MM-DD"
  },
  "contact": {
    "email": "Email address if present",
    "phone": "Full phone number with country code (e.g. +8801700000000)",
    "mobile": "Local mobile number without leading 0/country code (e.g. 1700000000)",
    "isdCode": "Country dialing code (e.g. 880)"
  },
  "presentAddress": {
    "addressLine1": "House / Street / Village name",
    "addressLine2": "Road / Thana / Area / Colony",
    "villageTownCity": "Village, Town or City",
    "district": "District name (e.g. DHAKA)",
    "stateProvince": "State or Province name",
    "postalCode": "Postal code or Pincode (e.g. 1230)",
    "country": "Country (e.g. BANGLADESH)"
  },
  "permanentAddress": {
    "addressLine1": "Permanent House / Street / Village name",
    "addressLine2": "Permanent Road / Thana / Area / Colony",
    "villageTownCity": "Village, Town or City",
    "district": "District name (e.g. CHITTAGONG)",
    "stateProvince": "State or Province name",
    "postalCode": "Postal code or Pincode (e.g. 4000)",
    "country": "Country (e.g. BANGLADESH)"
  },
  "family": {
    "fatherName": "Father's full name",
    "fatherNationality": "BANGLADESH",
    "fatherCountryOfBirth": "BANGLADESH",
    "fatherPlaceOfBirth": "Father's town/district of birth",
    "fatherPreviousNationality": "BANGLADESH",
    "motherName": "Mother's full name",
    "motherNationality": "BANGLADESH",
    "motherCountryOfBirth": "BANGLADESH",
    "motherPlaceOfBirth": "Mother's town/district of birth",
    "motherPreviousNationality": "BANGLADESH",
    "spouseName": "Spouse's full name (from spouse or emergency contact relationship: SPOUSE)",
    "spouseNationality": "BANGLADESH",
    "spouseCountryOfBirth": "BANGLADESH",
    "spousePlaceOfBirth": "Spouse's town/district of birth",
    "spousePreviousNationality": "BANGLADESH",
    "hasPakistanRelation": false,
    "pakistanRelationDetails": null
  },
  "employment": {
    "presentOccupation": "Present occupation or profession",
    "employerName": "Employer / business / company name",
    "designationRank": "Designation or rank",
    "employerAddress": "Employer address",
    "employerPhone": "Employer phone number",
    "pastOccupation": "Past occupation if mentioned"
  },
  "travel": {
    "duration": "Duration in days or months",
    "visaEntryType": "SINGLE | DOUBLE | TRIPLE | MULTIPLE",
    "entryPoint": "Port of entry (e.g. HARIDASPUR, GELEPHU, AIRPORT)",
    "exitPoint": "Port of exit",
    "purposeOfVisit": "TOURISM | BUSINESS | MEDICAL | TRANSIT",
    "countriesVisited": "Comma separated list of countries visited in last 10 years",
    "visitedSaarc": false
  },
  "previousVisa": {
    "hasPreviousVisa": true,
    "visaNumber": "Previous visa number",
    "visaType": "Type of previous visa",
    "placeOfIssue": "Place of issue of previous visa",
    "dateOfIssue": "YYYY-MM-DD",
    "visitedAddress1": "Address stayed during previous visit line 1",
    "visitedAddress2": "Address stayed line 2",
    "visitedAddress3": "Address stayed line 3"
  },
  "sponsorIndia": {
    "name": "Reference / Sponsor name in destination (e.g. India)",
    "addressLine1": "Sponsor address",
    "addressLine2": "Sponsor city/state",
    "phone": "Sponsor phone number",
    "email": "Sponsor email"
  },
  "sponsorMission": {
    "name": "Reference name in home country (e.g. Bangladesh)",
    "addressLine1": "Reference address",
    "addressLine2": "Reference city/state",
    "phone": "Reference phone number",
    "email": "Reference email"
  }
}

Rules:
1. Extract ALL fields present across all pages (Page 1 Emergency/Personal data, Page 2 Bio/MRZ data, stamps, notes).
2. For dates, format as YYYY-MM-DD.
3. If Emergency Contact lists relationship as SPOUSE, populate spouseName with the emergency contact name and set maritalStatus to Married.
4. If Previous Passport No is found, set holdsOtherPassport to true and populate otherPassportNumber.
5. If phone is found (e.g. +8801700000000), set phone: "+8801700000000", isdCode: "880", mobile: "1700000000".
6. If permanent address is found, populate permanentAddress. If present address is not explicitly separate, use permanent address.
7. If a field is not found in the document, use null or omit it. Do not fabricate fake data.
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
    console.warn('⚠️ [GEMINI AI] No API key provided or found in .env / storage.')
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

  console.log(`🤖 [GEMINI AI] Calling Gemini Vision API with ${imagesBase64.length} image(s)...`)

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
        const errText = await response.text()
        console.warn(`⚠️ [GEMINI AI] Model ${model} returned HTTP ${response.status}:`, errText)
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

      // Explicitly log as requested by user
      console.log('gemini api key theke egula asche:', mappedData)
      console.log('gemini extracted data:', mappedData)

      return mappedData
    } catch (err) {
      console.warn(`⚠️ [GEMINI AI] Error calling model ${model}:`, err)
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
    employment: {},
    travel: {},
    previousVisa: {},
    sponsorIndia: {},
    sponsorMission: {},
  }

  const confidence = 99
  const source = 'ai' as const

  // 1. Personal
  const p = (raw.personal || {}) as Record<string, unknown>
  if (p.surname) result.personal!.lastName = { value: String(p.surname).trim().toUpperCase(), source, confidence }
  if (p.givenNames) result.personal!.firstName = { value: String(p.givenNames).trim().toUpperCase(), source, confidence }
  if (p.fullName) result.personal!.fullName = { value: String(p.fullName).trim().toUpperCase(), source, confidence }
  else if (p.givenNames && p.surname) {
    result.personal!.fullName = { value: `${p.givenNames} ${p.surname}`.trim().toUpperCase(), source, confidence }
  }

  if (p.dateOfBirth) {
    const isoDob = parseStandardIsoDate(String(p.dateOfBirth)) || String(p.dateOfBirth)
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
  if (p.previousNationality) result.personal!.previousNationality = { value: String(p.previousNationality).trim().toUpperCase(), source, confidence }
  if (p.hasChangedName !== undefined) result.personal!.hasChangedName = { value: Boolean(p.hasChangedName), source, confidence }
  if (p.previousName) result.personal!.previousName = { value: String(p.previousName).trim().toUpperCase(), source, confidence }

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
      issueDate: ppt.otherPassportIssueDate ? { value: parseStandardIsoDate(String(ppt.otherPassportIssueDate)) || String(ppt.otherPassportIssueDate), source, confidence } : undefined,
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
      previousNationality: { value: fam.fatherPreviousNationality ? String(fam.fatherPreviousNationality).trim().toUpperCase() : 'BANGLADESH', source, confidence },
      placeOfBirth: fam.fatherPlaceOfBirth ? { value: String(fam.fatherPlaceOfBirth).trim().toUpperCase(), source, confidence } : undefined,
    }
  }

  if (fam.motherName) {
    result.family!.mother = {
      name: { value: String(fam.motherName).trim().toUpperCase(), source, confidence },
      nationality: { value: fam.motherNationality ? String(fam.motherNationality).trim().toUpperCase() : 'BANGLADESH', source, confidence },
      countryOfBirth: { value: fam.motherCountryOfBirth ? String(fam.motherCountryOfBirth).trim().toUpperCase() : 'BANGLADESH', source, confidence },
      previousNationality: { value: fam.motherPreviousNationality ? String(fam.motherPreviousNationality).trim().toUpperCase() : 'BANGLADESH', source, confidence },
      placeOfBirth: fam.motherPlaceOfBirth ? { value: String(fam.motherPlaceOfBirth).trim().toUpperCase(), source, confidence } : undefined,
    }
  }

  if (fam.spouseName) {
    result.family!.spouse = {
      name: { value: String(fam.spouseName).trim().toUpperCase(), source, confidence },
      nationality: { value: fam.spouseNationality ? String(fam.spouseNationality).trim().toUpperCase() : 'BANGLADESH', source, confidence },
      countryOfBirth: { value: fam.spouseCountryOfBirth ? String(fam.spouseCountryOfBirth).trim().toUpperCase() : 'BANGLADESH', source, confidence },
      previousNationality: { value: fam.spousePreviousNationality ? String(fam.spousePreviousNationality).trim().toUpperCase() : 'BANGLADESH', source, confidence },
      placeOfBirth: fam.spousePlaceOfBirth ? { value: String(fam.spousePlaceOfBirth).trim().toUpperCase(), source, confidence } : undefined,
    }
    if (!result.personal?.maritalStatus) {
      result.personal = {
        ...result.personal,
        maritalStatus: { value: 'Married', source, confidence },
      }
    }
  }

  if (fam.hasPakistanRelation !== undefined) {
    result.family!.hasPakistanRelation = { value: Boolean(fam.hasPakistanRelation), source, confidence }
  }
  if (fam.pakistanRelationDetails) {
    result.family!.pakistanRelationDetails = { value: String(fam.pakistanRelationDetails).trim(), source, confidence }
  }

  // 7. Employment
  const emp = (raw.employment || {}) as Record<string, unknown>
  if (emp.presentOccupation) result.employment!.presentOccupation = { value: String(emp.presentOccupation).trim().toUpperCase(), source, confidence }
  if (emp.employerName) result.employment!.employerName = { value: String(emp.employerName).trim().toUpperCase(), source, confidence }
  if (emp.designationRank) result.employment!.designationRank = { value: String(emp.designationRank).trim().toUpperCase(), source, confidence }
  if (emp.employerAddress) result.employment!.employerAddress = { value: String(emp.employerAddress).trim().toUpperCase(), source, confidence }
  if (emp.employerPhone) result.employment!.employerPhone = { value: String(emp.employerPhone).trim(), source, confidence }
  if (emp.pastOccupation) result.employment!.pastOccupation = { value: String(emp.pastOccupation).trim().toUpperCase(), source, confidence }

  // 8. Travel
  const tr = (raw.travel || {}) as Record<string, unknown>
  if (tr.duration) result.travel!.duration = { value: String(tr.duration).trim(), source, confidence }
  if (tr.visaEntryType) result.travel!.visaEntryType = { value: String(tr.visaEntryType).trim().toUpperCase(), source, confidence }
  if (tr.entryPoint) result.travel!.entryPoint = { value: String(tr.entryPoint).trim().toUpperCase(), source, confidence }
  if (tr.exitPoint) result.travel!.exitPoint = { value: String(tr.exitPoint).trim().toUpperCase(), source, confidence }
  if (tr.purposeOfVisit) result.travel!.purposeOfVisit = { value: String(tr.purposeOfVisit).trim().toUpperCase(), source, confidence }
  if (tr.countriesVisited) result.travel!.countriesVisited = { value: String(tr.countriesVisited).trim().toUpperCase(), source, confidence }
  if (tr.visitedSaarc !== undefined) result.travel!.visitedSaarc = { value: Boolean(tr.visitedSaarc), source, confidence }

  // 9. Previous Visa
  const pv = (raw.previousVisa || {}) as Record<string, unknown>
  if (pv.hasPreviousVisa !== undefined) result.previousVisa!.hasPreviousVisa = { value: Boolean(pv.hasPreviousVisa), source, confidence }
  if (pv.visaNumber) result.previousVisa!.visaNumber = { value: String(pv.visaNumber).trim().toUpperCase(), source, confidence }
  if (pv.visaType) result.previousVisa!.visaType = { value: String(pv.visaType).trim().toUpperCase(), source, confidence }
  if (pv.placeOfIssue) result.previousVisa!.placeOfIssue = { value: String(pv.placeOfIssue).trim().toUpperCase(), source, confidence }
  if (pv.dateOfIssue) result.previousVisa!.dateOfIssue = { value: parseStandardIsoDate(String(pv.dateOfIssue)) || String(pv.dateOfIssue), source, confidence }
  if (pv.visitedAddress1) result.previousVisa!.visitedAddress1 = { value: String(pv.visitedAddress1).trim().toUpperCase(), source, confidence }
  if (pv.visitedAddress2) result.previousVisa!.visitedAddress2 = { value: String(pv.visitedAddress2).trim().toUpperCase(), source, confidence }
  if (pv.visitedAddress3) result.previousVisa!.visitedAddress3 = { value: String(pv.visitedAddress3).trim().toUpperCase(), source, confidence }

  // 10. Sponsor India & Mission
  const spInd = (raw.sponsorIndia || {}) as Record<string, unknown>
  if (spInd.name) result.sponsorIndia!.name = { value: String(spInd.name).trim().toUpperCase(), source, confidence }
  if (spInd.addressLine1) result.sponsorIndia!.addressLine1 = { value: String(spInd.addressLine1).trim().toUpperCase(), source, confidence }
  if (spInd.addressLine2) result.sponsorIndia!.addressLine2 = { value: String(spInd.addressLine2).trim().toUpperCase(), source, confidence }
  if (spInd.phone) result.sponsorIndia!.phone = { value: String(spInd.phone).trim(), source, confidence }
  if (spInd.email) result.sponsorIndia!.email = { value: String(spInd.email).trim().toLowerCase(), source, confidence }

  const spMsn = (raw.sponsorMission || {}) as Record<string, unknown>
  if (spMsn.name) result.sponsorMission!.name = { value: String(spMsn.name).trim().toUpperCase(), source, confidence }
  if (spMsn.addressLine1) result.sponsorMission!.addressLine1 = { value: String(spMsn.addressLine1).trim().toUpperCase(), source, confidence }
  if (spMsn.addressLine2) result.sponsorMission!.addressLine2 = { value: String(spMsn.addressLine2).trim().toUpperCase(), source, confidence }
  if (spMsn.phone) result.sponsorMission!.phone = { value: String(spMsn.phone).trim(), source, confidence }
  if (spMsn.email) result.sponsorMission!.email = { value: String(spMsn.email).trim().toLowerCase(), source, confidence }

  // Clean empty objects
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
