import type { ExtractedApplicantData } from '../data/types'
import { parseStandardIsoDate, parseStructuredAddress } from '../data/applicantDataExtractor'

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

export const RECOMMENDED_GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-3.1-pro-preview',
]

let cachedWorkingModel = 'gemini-3.5-flash'

/**
 * Retrieves the currently active / cached working model.
 */
export async function getActiveGeminiModel(): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['visa_autofill_active_gemini_model'], (res) => {
        const stored = res?.visa_autofill_active_gemini_model
        if (typeof stored === 'string' && stored.trim()) {
          resolve(stored.trim())
        } else {
          resolve(cachedWorkingModel)
        }
      })
    })
  }
  return cachedWorkingModel
}

/**
 * Persists the working Gemini model so future requests hit it immediately.
 */
export async function setActiveGeminiModel(modelName: string): Promise<void> {
  cachedWorkingModel = modelName
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ visa_autofill_active_gemini_model: modelName }, () => {
        resolve()
      })
    })
  }
}

/**
 * Tests Gemini API connection and finds the fastest working model.
 */
export async function testGeminiConnection(
  apiKey?: string,
  modelName?: string
): Promise<{ success: boolean; activeModel?: string; latencyMs?: number; error?: string }> {
  const key = (apiKey || (await getGeminiApiKey())).trim()
  if (!key) {
    return { success: false, error: 'No API key provided.' }
  }

  const activeCached = await getActiveGeminiModel()
  const candidateModels = Array.from(new Set([
    modelName || activeCached || 'gemini-3.5-flash',
    ...RECOMMENDED_GEMINI_MODELS
  ]))

  for (const m of candidateModels) {
    const t0 = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with valid JSON: {"status":"ok"}' }] }],
          generationConfig: { response_mime_type: 'application/json' }
        }),
        signal: controller.signal
      })
      clearTimeout(timer)
      if (res.ok) {
        const latencyMs = Date.now() - t0
        await setActiveGeminiModel(m).catch(() => {})
        return { success: true, activeModel: m, latencyMs }
      }
    } catch {
      clearTimeout(timer)
      continue
    }
  }

  return { success: false, error: 'All tested Gemini models failed to respond. Please check your API key and network connection.' }
}

export interface GeminiExtractionOptions {
  apiKey?: string
  modelName?: string
  mimeType?: string
}

const PASSPORT_EXTRACTION_PROMPT = `
You are an expert OCR & document parsing AI specializing in international passports, visas, national ID cards, and travel documents.

Analyze ALL provided document image(s) (including single/dual-page scans, MRZ lines, emergency contact page, visual data zones, and stamps).

Extract ONLY information visibly present in the document.
If a field is not present or cannot be reliably read from the document, return null.
Do NOT invent, guess, or default any fields (such as father nationality, place of issue, country of issue, religion, or phone numbers).

Return ONLY a valid JSON object matching the following structure:
{
  "personal": {
    "surname": "Exact surname or last name or null",
    "givenNames": "Exact given names or first names or null",
    "fullName": "Full name as printed or null",
    "sex": "male" | "female" | "other" | null,
    "dateOfBirth": "YYYY-MM-DD or null",
    "townCityOfBirth": "Town, City or District of birth as printed or null",
    "countryOfBirth": "Country of birth as printed or null",
    "nationality": "Nationality as printed or null",
    "nationalIdNumber": "National ID / Personal No / NID / NIC number or null",
    "religion": "Religion if explicitly stated or null",
    "educationalQualification": "BELOW MATRICULATION | MATRICULATION | HIGHER SECONDARY | GRADUATE | POST GRADUATE | PROFESSIONAL | ILLITERATE | OTHERS | null",
    "visibleIdentificationMarks": "Visible identification marks as printed or null",
    "maritalStatus": "Married | Single | Divorced | Widow/Widower | null",
    "previousNationality": "Previous nationality if stated or null",
    "hasChangedName": true | false | null,
    "previousName": "Previous name if stated or null"
  },
  "passport": {
    "passportNumber": "Exact passport number or null",
    "passportType": "P or null",
    "issuingCountry": "Country of issue as printed or null",
    "placeOfIssue": "Place of issue / Issuing authority as printed or null",
    "issueDate": "YYYY-MM-DD or null",
    "expiryDate": "YYYY-MM-DD or null",
    "holdsOtherPassport": true | false | null,
    "otherPassportNumber": "Previous / other passport number if stated or null",
    "otherPassportPlaceOfIssue": "Place of issue of previous passport as printed or null",
    "otherPassportCountryOfIssue": "Country of issue of previous passport as printed or null",
    "otherPassportNationality": "Nationality in previous passport as printed or null",
    "otherPassportIssueDate": "YYYY-MM-DD or null"
  },
  "contact": {
    "email": "Email address if present or null",
    "phone": "Full phone number with country code if present or null",
    "mobile": "Local mobile number if present or null",
    "isdCode": "Country dialing code if present or null"
  },
  "presentAddress": {
    "addressLine1": "First address component before 1st comma (e.g. House No. / Street / Village name) or null",
    "villageTownCity": "Next two middle components after 1st comma joined with comma (e.g. Area, Upazila / Police Station / Colony) or null",
    "addressLine2": "Next two middle components after 1st comma joined with comma or null",
    "district": "Last component / District name (e.g. THAKURGAON, DHAKA, CHITTAGONG) or null",
    "stateProvince": "District name (for Bangladesh, this is the District name, NEVER 'IN' or country code) or null",
    "postalCode": "Postal code or Pincode (4-6 digits) or null",
    "country": "Country name (e.g. BANGLADESH) or null"
  },
  "permanentAddress": {
    "addressLine1": "First address component before 1st comma (e.g. Permanent House No. / Street / Village name) or null",
    "villageTownCity": "Next two middle components after 1st comma joined with comma (e.g. Area, Upazila / Police Station / Colony) or null",
    "addressLine2": "Next two middle components after 1st comma joined with comma or null",
    "district": "Last component / District name (e.g. THAKURGAON, DHAKA, CHITTAGONG) or null",
    "stateProvince": "District name (for Bangladesh, this is the District name, NEVER 'IN' or country code) or null",
    "postalCode": "Postal code or Pincode (4-6 digits) or null",
    "country": "Country name (e.g. BANGLADESH) or null"
  },
  "family": {
    "fatherName": "Father's full name as printed or null",
    "fatherNationality": "Father's nationality if explicitly stated or null",
    "fatherCountryOfBirth": "Father's country of birth if explicitly stated or null",
    "fatherPlaceOfBirth": "Father's place of birth if explicitly stated or null",
    "fatherPreviousNationality": "Father's previous nationality if explicitly stated or null",
    "motherName": "Mother's full name as printed or null",
    "motherNationality": "Mother's nationality if explicitly stated or null",
    "motherCountryOfBirth": "Mother's country of birth if explicitly stated or null",
    "motherPlaceOfBirth": "Mother's place of birth if explicitly stated or null",
    "motherPreviousNationality": "Mother's previous nationality if explicitly stated or null",
    "spouseName": "Spouse's full name (from spouse or emergency contact relationship: SPOUSE) or null",
    "spouseNationality": "Spouse's nationality if explicitly stated or null",
    "spouseCountryOfBirth": "Spouse's country of birth if explicitly stated or null",
    "spousePlaceOfBirth": "Spouse's place of birth if explicitly stated or null",
    "spousePreviousNationality": "Spouse's previous nationality if explicitly stated or null",
    "hasPakistanRelation": true | false | null,
    "pakistanRelationDetails": "Details if applicable or null"
  },
  "employment": {
    "presentOccupation": "Present occupation or profession as printed or null",
    "employerName": "Employer / business / company name or null",
    "designationRank": "Designation or rank or null",
    "employerAddress": "Employer address or null",
    "employerPhone": "Employer phone number or null",
    "pastOccupation": "Past occupation if mentioned or null"
  },
  "travel": {
    "duration": "Duration if stated or null",
    "visaEntryType": "SINGLE | DOUBLE | TRIPLE | MULTIPLE | null",
    "entryPoint": "Port of entry as stated or null",
    "exitPoint": "Port of exit as stated or null",
    "purposeOfVisit": "Exact purpose of visit as stated in the document (e.g. Tourism, Business, Medical, or detailed purpose sentence) or null",
    "countriesVisited": "Comma separated list of countries visited if stated or null",
    "visitedSaarc": true | false | null
  },
  "previousVisa": {
    "hasPreviousVisa": true | false | null,
    "visaNumber": "Previous visa number if stated or null",
    "visaType": "Type of previous visa if stated or null",
    "placeOfIssue": "Place of issue of previous visa if stated or null",
    "dateOfIssue": "YYYY-MM-DD or null",
    "visitedAddress1": "Address stayed during previous visit line 1 or null",
    "visitedAddress2": "Address stayed line 2 or null",
    "visitedAddress3": "Address stayed line 3 or null"
  },
  "sponsorIndia": {
    "name": "Reference / Sponsor name in destination or null",
    "addressLine1": "Sponsor address or null",
    "addressLine2": "Sponsor city/state or null",
    "phone": "Sponsor phone number or null",
    "email": "Sponsor email or null"
  },
  "sponsorMission": {
    "name": "Reference name in home country or null",
    "addressLine1": "Reference address or null",
    "addressLine2": "Reference city/state or null",
    "phone": "Reference phone number or null",
    "email": "Reference email or null"
  }
}

Rules:
1. Extract ALL fields present across all provided pages.
2. For dates, format as YYYY-MM-DD.
3. If Emergency Contact lists relationship as SPOUSE, populate spouseName with the emergency contact name and set maritalStatus to Married.
4. If Previous Passport No is found, set holdsOtherPassport to true and populate otherPassportNumber.
5. If phone is found (e.g. +8801700000000), set phone: "+8801700000000", isdCode: "880", mobile: "1700000000".
6. If permanent address is found, populate permanentAddress.
7. For Place of Issue in Bangladeshi passports, extract the issuing authority/office (e.g. 'DIP/DHAKA', 'DHAKA', 'DIP/CHITTAGONG', etc.).
8. Extract Personal No / NID / NIC (e.g. 10 or 17 digit number) into personal.nationalIdNumber.
9. For addresses in Bangladesh, district name must be extracted into district and stateProvince (never use 'IN' or country code).
10. If a field is not visibly found in the document, return null. Do not invent or guess data.
`

/**
 * Extracts structured applicant data from passport image(s) using Gemini Vision API.
 */
/**
 * Extracts structured applicant data from passport PDF or image(s) using Gemini 3.8 Flash API.
 */
export async function extractApplicantDataWithGemini(
  imagesBase64: string[],
  options?: GeminiExtractionOptions
): Promise<ExtractedApplicantData | null> {
  if (!imagesBase64 || imagesBase64.length === 0) return null

  const totalStart = Date.now()
  const apiKey = (options?.apiKey || (await getGeminiApiKey())).trim()
  if (!apiKey) {
    console.warn('⚠️ [GEMINI AI] No API key provided or found in .env / storage.')
    return null
  }

  // 1. Preparation & Encoding
  const prepStart = Date.now()
  const inlineParts = imagesBase64.map((raw) => {
    let cleanBase64 = raw
    let mimeType = options?.mimeType || 'image/jpeg'

    const match = raw.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      mimeType = match[1]
      cleanBase64 = match[2]
    } else if (raw.startsWith('JVBERi')) {
      mimeType = 'application/pdf'
    }

    // Clean whitespace/newlines from base64 string
    cleanBase64 = cleanBase64.replace(/\s+/g, '')

    return {
      inline_data: {
        mime_type: mimeType,
        data: cleanBase64,
      },
    }
  })
  const prepDuration = Date.now() - prepStart

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
    },
  }

  const activeCached = await getActiveGeminiModel()
  const preferredModel = options?.modelName || activeCached || 'gemini-3.5-flash'
  const fallbackList = [
    preferredModel,
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3-flash-preview',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-flash-latest',
    'gemini-3.1-pro-preview',
  ]
  const modelsToTry = Array.from(new Set(fallbackList))

  console.log(`🤖 [GEMINI AI] Calling Gemini API (Primary: ${modelsToTry[0]}) with ${imagesBase64.length} payload(s)...`)

  let response: Response | null = null
  let activeModel = modelsToTry[0]
  let reqDuration = 0
  const reqStart = Date.now()

  for (const model of modelsToTry) {
    activeModel = model
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 50000)

    try {
      const fetchStart = Date.now()
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })
      clearTimeout(timer)
      reqDuration += Date.now() - fetchStart

      if (res.ok) {
        response = res
        // Save working model so future extractions immediately hit the active model
        setActiveGeminiModel(model).catch(() => {})
        break
      }

      const errText = await res.text()
      console.warn(`⚠️ [GEMINI AI] Model ${model} returned HTTP ${res.status}:`, errText)

      // If temporary overload (503/429), model not found (404), unsupported/bad request (400), or server error (500), try next fallback model
      if (res.status === 503 || res.status === 429 || res.status === 404 || res.status === 500 || res.status === 400) {
        response = res
        continue
      }

      response = res
      break
    } catch (fetchErr) {
      clearTimeout(timer)
      reqDuration += Date.now() - reqStart
      console.warn(`⚠️ [GEMINI AI] Network error calling model ${model}:`, fetchErr)
      continue
    }
  }

  if (!response || !response.ok) {
    const totalDuration = Date.now() - totalStart
    console.log(`[GEMINI PERF]
PDF preparation: ${prepDuration}ms
Gemini request: ${reqDuration}ms
Gemini response: HTTP ${response?.status || 'network-error'}
JSON parsing: 0ms
Mapping: 0ms
Total: ${totalDuration}ms

Gemini model: ${activeModel}
HTTP status: ${response?.status || 0}
Success: false
Duration: ${totalDuration}ms`)
    return null
  }

  // 2. JSON Parsing
  const parseStart = Date.now()
  let parsed: Record<string, unknown> | null = null
  try {
    const data = await response.json()
    const candidate = data.candidates?.[0]
    const rawJson = candidate?.content?.parts?.[0]?.text
    if (rawJson && typeof rawJson === 'string') {
      let cleanJson = rawJson.trim()
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      }
      parsed = JSON.parse(cleanJson)
    }
  } catch (parseErr) {
    console.warn(`⚠️ [GEMINI AI] Failed to parse JSON response from ${activeModel}:`, parseErr)
  }
  const parseDuration = Date.now() - parseStart

  if (!parsed || typeof parsed !== 'object') {
    const totalDuration = Date.now() - totalStart
    console.log(`[GEMINI PERF]
PDF preparation: ${prepDuration}ms
Gemini request: ${reqDuration}ms
Gemini response: HTTP ${response.status}
JSON parsing: ${parseDuration}ms
Mapping: 0ms
Total: ${totalDuration}ms

Gemini model: ${activeModel}
HTTP status: ${response.status}
Success: false
Duration: ${totalDuration}ms`)
    return null
  }

  // 3. Mapping
  const mapStart = Date.now()
  const mappedData = mapGeminiOutputToApplicantData(parsed)
  const mapDuration = Date.now() - mapStart
  const totalDuration = Date.now() - totalStart

  const isUsable = hasUsableFields(mappedData)

  console.log(`[GEMINI PERF]
PDF preparation: ${prepDuration}ms
Gemini request: ${reqDuration}ms
Gemini response: HTTP ${response.status}
JSON parsing: ${parseDuration}ms
Mapping: ${mapDuration}ms
Total: ${totalDuration}ms

Gemini model: ${activeModel}
HTTP status: ${response.status}
Success: ${isUsable}
Duration: ${totalDuration}ms`)

  if (!isUsable) {
    console.warn(`⚠️ [GEMINI AI] Model ${activeModel} returned response but no usable applicant fields were extracted.`)
    return null
  }

  return mappedData
}

function hasUsableFields(data?: ExtractedApplicantData | null): boolean {
  if (!data) return false
  return Boolean(
    data.personal?.lastName?.value ||
    data.personal?.firstName?.value ||
    data.personal?.fullName?.value ||
    data.personal?.dateOfBirth?.value ||
    data.passport?.passportNumber?.value ||
    data.passport?.expiryDate?.value ||
    data.presentAddress?.addressLine1?.value ||
    data.permanentAddress?.addressLine1?.value ||
    data.family?.father?.name?.value ||
    data.family?.mother?.name?.value ||
    data.family?.spouse?.name?.value ||
    data.contact?.phone?.value ||
    data.contact?.mobile?.value ||
    data.contact?.email?.value
  )
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

  const source = 'ai' as const

  // 1. Personal
  const p = (raw.personal || {}) as Record<string, unknown>
  if (p.surname) result.personal!.lastName = { value: String(p.surname).trim().toUpperCase(), source }
  if (p.givenNames) result.personal!.firstName = { value: String(p.givenNames).trim().toUpperCase(), source }
  if (p.fullName) result.personal!.fullName = { value: String(p.fullName).trim().toUpperCase(), source }
  else if (p.givenNames && p.surname) {
    result.personal!.fullName = { value: `${p.givenNames} ${p.surname}`.trim().toUpperCase(), source }
  }

  if (p.dateOfBirth) {
    const isoDob = parseStandardIsoDate(String(p.dateOfBirth)) || String(p.dateOfBirth)
    result.personal!.dateOfBirth = { value: isoDob, source }
  }

  if (p.sex) {
    const s = String(p.sex).toLowerCase()
    const normSex: 'male' | 'female' | 'other' = s.includes('f') ? 'female' : s.includes('other') ? 'other' : 'male'
    result.personal!.gender = { value: normSex, source }
  }

  if (p.townCityOfBirth) result.personal!.townCityOfBirth = { value: String(p.townCityOfBirth).trim().toUpperCase(), source }
  if (p.countryOfBirth) result.personal!.countryOfBirth = { value: String(p.countryOfBirth).trim().toUpperCase(), source }
  if (p.nationality) result.personal!.nationality = { value: String(p.nationality).trim().toUpperCase(), source }
  if (p.nationalIdNumber) result.personal!.nationalIdNumber = { value: String(p.nationalIdNumber).trim().toUpperCase(), source }
  if (p.religion) result.personal!.religion = { value: String(p.religion).trim().toUpperCase(), source }
  if (p.educationalQualification) result.personal!.educationalQualification = { value: String(p.educationalQualification).trim().toUpperCase(), source }
  if (p.visibleIdentificationMarks) result.personal!.visibleIdentificationMarks = { value: String(p.visibleIdentificationMarks).trim().toUpperCase(), source }
  if (p.maritalStatus) result.personal!.maritalStatus = { value: String(p.maritalStatus).trim(), source }
  if (p.previousNationality) result.personal!.previousNationality = { value: String(p.previousNationality).trim().toUpperCase(), source }
  if (p.hasChangedName !== undefined && p.hasChangedName !== null) result.personal!.hasChangedName = { value: Boolean(p.hasChangedName), source }
  if (p.previousName) result.personal!.previousName = { value: String(p.previousName).trim().toUpperCase(), source }

  // 2. Passport
  const ppt = (raw.passport || {}) as Record<string, unknown>
  if (ppt.passportNumber) result.passport!.passportNumber = { value: String(ppt.passportNumber).trim().toUpperCase(), source }
  if (ppt.passportType) result.passport!.passportType = { value: String(ppt.passportType).trim().toUpperCase(), source }
  if (ppt.issuingCountry) result.passport!.issuingCountry = { value: String(ppt.issuingCountry).trim().toUpperCase(), source }
  if (ppt.placeOfIssue) result.passport!.placeOfIssue = { value: String(ppt.placeOfIssue).trim().toUpperCase(), source }

  if (ppt.issueDate) {
    const isoIssue = parseStandardIsoDate(String(ppt.issueDate)) || String(ppt.issueDate)
    result.passport!.issueDate = { value: isoIssue, source }
  }
  if (ppt.expiryDate) {
    const isoExp = parseStandardIsoDate(String(ppt.expiryDate)) || String(ppt.expiryDate)
    result.passport!.expiryDate = { value: isoExp, source }
  }

  if (ppt.holdsOtherPassport === true || ppt.otherPassportNumber) {
    result.passport!.holdsOtherPassport = { value: true, source }
    result.passport!.otherPassportDetails = {
      passportNumber: ppt.otherPassportNumber ? { value: String(ppt.otherPassportNumber).trim().toUpperCase(), source } : undefined,
      placeOfIssue: ppt.otherPassportPlaceOfIssue ? { value: String(ppt.otherPassportPlaceOfIssue).trim().toUpperCase(), source } : undefined,
      countryOfIssue: ppt.otherPassportCountryOfIssue ? { value: String(ppt.otherPassportCountryOfIssue).trim().toUpperCase(), source } : undefined,
      nationalityInPassport: ppt.otherPassportNationality ? { value: String(ppt.otherPassportNationality).trim().toUpperCase(), source } : undefined,
      issueDate: ppt.otherPassportIssueDate ? { value: parseStandardIsoDate(String(ppt.otherPassportIssueDate)) || String(ppt.otherPassportIssueDate), source } : undefined,
    }
  }

  // 3. Contact
  const c = (raw.contact || {}) as Record<string, unknown>
  if (c.email) result.contact!.email = { value: String(c.email).trim().toLowerCase(), source }
  if (c.phone) {
    result.contact!.phone = { value: String(c.phone).trim(), source }
    result.presentAddress!.phone = { value: String(c.phone).trim(), source }
  }
  if (c.mobile) {
    result.contact!.mobile = { value: String(c.mobile).trim(), source }
    result.presentAddress!.mobile = { value: String(c.mobile).trim(), source }
  }
  if (c.isdCode) {
    result.contact!.isdCode = { value: String(c.isdCode).trim(), source }
    result.presentAddress!.isdCode = { value: String(c.isdCode).trim(), source }
  }

  // 4. Present Address
  const pres = (raw.presentAddress || {}) as Record<string, unknown>
  let presLine1 = pres.addressLine1 ? String(pres.addressLine1).trim() : undefined
  let presLine2 = pres.addressLine2 ? String(pres.addressLine2).trim() : undefined
  let presCity = pres.villageTownCity ? String(pres.villageTownCity).trim() : undefined
  let presDist = pres.district ? String(pres.district).trim().toUpperCase() : undefined
  let presState = pres.stateProvince ? String(pres.stateProvince).trim().toUpperCase() : undefined
  let presPin = pres.postalCode ? String(pres.postalCode).trim() : undefined
  let presCountry = pres.country ? String(pres.country).trim().toUpperCase() : undefined

  const invalidTokens = new Set(['IN', 'BD', 'BGD', 'IND', 'INDIA', 'BANGLADESH'])
  if (presState && (invalidTokens.has(presState) || presState.length <= 2)) {
    presState = undefined
  }
  if (presDist && (invalidTokens.has(presDist) || presDist.length <= 2)) {
    presDist = undefined
  }
  if (!presDist && presState) presDist = presState
  if (!presState && presDist) presState = presDist

  const rawPresStr = (pres.rawAddress || pres.fullAddress || pres.address) ? String(pres.rawAddress || pres.fullAddress || pres.address).trim() : undefined
  if (rawPresStr && !presLine1 && !presDist) {
    const reParsed = parseStructuredAddress(rawPresStr, { nationality: p.nationality ? String(p.nationality) : undefined })
    if (reParsed.addressLine1) presLine1 = reParsed.addressLine1
    if (reParsed.villageTownCity) {
      presCity = reParsed.villageTownCity
      if (!presLine2) presLine2 = reParsed.villageTownCity
    }
    if (reParsed.district) {
      presDist = reParsed.district
      presState = reParsed.stateProvince || reParsed.district
    }
    if (reParsed.postalCode && !presPin) presPin = reParsed.postalCode
    if (reParsed.country && !presCountry) presCountry = reParsed.country
  }

  if (presLine1) result.presentAddress!.addressLine1 = { value: presLine1, source }
  if (presLine2) result.presentAddress!.addressLine2 = { value: presLine2, source }
  if (presCity) result.presentAddress!.villageTownCity = { value: presCity, source }
  if (presDist) result.presentAddress!.district = { value: presDist, source }
  if (presState || presDist) result.presentAddress!.stateProvince = { value: presState || presDist!, source }
  if (presPin) result.presentAddress!.postalCode = { value: presPin, source }
  if (presCountry) result.presentAddress!.country = { value: presCountry, source }

  // 5. Permanent Address
  const perm = (raw.permanentAddress || {}) as Record<string, unknown>
  let permLine1 = perm.addressLine1 ? String(perm.addressLine1).trim() : undefined
  let permLine2 = perm.addressLine2 ? String(perm.addressLine2).trim() : undefined
  let permCity = perm.villageTownCity ? String(perm.villageTownCity).trim() : undefined
  let permDist = perm.district ? String(perm.district).trim().toUpperCase() : undefined
  let permState = perm.stateProvince ? String(perm.stateProvince).trim().toUpperCase() : undefined
  let permPin = perm.postalCode ? String(perm.postalCode).trim() : undefined
  let permCountry = perm.country ? String(perm.country).trim().toUpperCase() : undefined

  if (permState && (invalidTokens.has(permState) || permState.length <= 2)) {
    permState = undefined
  }
  if (permDist && (invalidTokens.has(permDist) || permDist.length <= 2)) {
    permDist = undefined
  }
  if (!permDist && permState) permDist = permState
  if (!permState && permDist) permState = permDist

  const rawPermStr = (perm.rawAddress || perm.fullAddress || perm.address) ? String(perm.rawAddress || perm.fullAddress || perm.address).trim() : undefined
  if (rawPermStr && !permLine1 && !permDist) {
    const reParsed = parseStructuredAddress(rawPermStr, { nationality: p.nationality ? String(p.nationality) : undefined })
    if (reParsed.addressLine1) permLine1 = reParsed.addressLine1
    if (reParsed.villageTownCity) {
      permCity = reParsed.villageTownCity
      if (!permLine2) permLine2 = reParsed.villageTownCity
    }
    if (reParsed.district) {
      permDist = reParsed.district
      permState = reParsed.stateProvince || reParsed.district
    }
    if (reParsed.postalCode && !permPin) permPin = reParsed.postalCode
    if (reParsed.country && !permCountry) permCountry = reParsed.country
  }

  if (permLine1) result.permanentAddress!.addressLine1 = { value: permLine1, source }
  if (permLine2) result.permanentAddress!.addressLine2 = { value: permLine2, source }
  if (permCity) result.permanentAddress!.villageTownCity = { value: permCity, source }
  if (permDist) result.permanentAddress!.district = { value: permDist, source }
  if (permState || permDist) result.permanentAddress!.stateProvince = { value: permState || permDist!, source }
  if (permPin) result.permanentAddress!.postalCode = { value: permPin, source }
  if (permCountry) result.permanentAddress!.country = { value: permCountry, source }

  // Fallback: If permanent address is completely absent from document and present is present, fallback
  const hasExtractedPerm = Boolean(
    permLine1 || permLine2 || permCity || permDist || permState || permPin || permCountry
  )
  const hasExtractedPres = Boolean(
    presLine1 || presLine2 || presCity || presDist || presState || presPin || presCountry
  )

  if (!hasExtractedPerm && hasExtractedPres) {
    result.permanentAddress = {
      addressLine1: result.presentAddress!.addressLine1 ? { ...result.presentAddress!.addressLine1 } : undefined,
      addressLine2: result.presentAddress!.addressLine2 ? { ...result.presentAddress!.addressLine2 } : undefined,
      villageTownCity: result.presentAddress!.villageTownCity ? { ...result.presentAddress!.villageTownCity } : undefined,
      district: result.presentAddress!.district ? { ...result.presentAddress!.district } : undefined,
      stateProvince: result.presentAddress!.stateProvince ? { ...result.presentAddress!.stateProvince } : undefined,
      postalCode: result.presentAddress!.postalCode ? { ...result.presentAddress!.postalCode } : undefined,
      country: result.presentAddress!.country ? { ...result.presentAddress!.country } : undefined,
    }
  } else if (!hasExtractedPres && hasExtractedPerm) {
    result.presentAddress = {
      addressLine1: result.permanentAddress!.addressLine1 ? { ...result.permanentAddress!.addressLine1 } : undefined,
      addressLine2: result.permanentAddress!.addressLine2 ? { ...result.permanentAddress!.addressLine2 } : undefined,
      villageTownCity: result.permanentAddress!.villageTownCity ? { ...result.permanentAddress!.villageTownCity } : undefined,
      district: result.permanentAddress!.district ? { ...result.permanentAddress!.district } : undefined,
      stateProvince: result.permanentAddress!.stateProvince ? { ...result.permanentAddress!.stateProvince } : undefined,
      postalCode: result.permanentAddress!.postalCode ? { ...result.permanentAddress!.postalCode } : undefined,
      country: result.permanentAddress!.country ? { ...result.permanentAddress!.country } : undefined,
    }
  }

  // 6. Family
  const fam = (raw.family || {}) as Record<string, unknown>
  if (fam.fatherName) {
    result.family!.father = {
      name: { value: String(fam.fatherName).trim().toUpperCase(), source },
      nationality: fam.fatherNationality ? { value: String(fam.fatherNationality).trim().toUpperCase(), source } : undefined,
      countryOfBirth: fam.fatherCountryOfBirth ? { value: String(fam.fatherCountryOfBirth).trim().toUpperCase(), source } : undefined,
      previousNationality: fam.fatherPreviousNationality ? { value: String(fam.fatherPreviousNationality).trim().toUpperCase(), source } : undefined,
      placeOfBirth: fam.fatherPlaceOfBirth ? { value: String(fam.fatherPlaceOfBirth).trim().toUpperCase(), source } : undefined,
    }
  }

  if (fam.motherName) {
    result.family!.mother = {
      name: { value: String(fam.motherName).trim().toUpperCase(), source },
      nationality: fam.motherNationality ? { value: String(fam.motherNationality).trim().toUpperCase(), source } : undefined,
      countryOfBirth: fam.motherCountryOfBirth ? { value: String(fam.motherCountryOfBirth).trim().toUpperCase(), source } : undefined,
      previousNationality: fam.motherPreviousNationality ? { value: String(fam.motherPreviousNationality).trim().toUpperCase(), source } : undefined,
      placeOfBirth: fam.motherPlaceOfBirth ? { value: String(fam.motherPlaceOfBirth).trim().toUpperCase(), source } : undefined,
    }
  }

  if (fam.spouseName) {
    result.family!.spouse = {
      name: { value: String(fam.spouseName).trim().toUpperCase(), source },
      nationality: fam.spouseNationality ? { value: String(fam.spouseNationality).trim().toUpperCase(), source } : undefined,
      countryOfBirth: fam.spouseCountryOfBirth ? { value: String(fam.spouseCountryOfBirth).trim().toUpperCase(), source } : undefined,
      previousNationality: fam.spousePreviousNationality ? { value: String(fam.spousePreviousNationality).trim().toUpperCase(), source } : undefined,
      placeOfBirth: fam.spousePlaceOfBirth ? { value: String(fam.spousePlaceOfBirth).trim().toUpperCase(), source } : undefined,
    }
    if (!result.personal?.maritalStatus) {
      result.personal = {
        ...result.personal,
        maritalStatus: { value: 'Married', source },
      }
    }
  }

  if (fam.hasPakistanRelation !== undefined && fam.hasPakistanRelation !== null) {
    result.family!.hasPakistanRelation = { value: Boolean(fam.hasPakistanRelation), source }
  }
  if (fam.pakistanRelationDetails) {
    result.family!.pakistanRelationDetails = { value: String(fam.pakistanRelationDetails).trim(), source }
  }

  // 7. Employment
  const emp = (raw.employment || {}) as Record<string, unknown>
  if (emp.presentOccupation) result.employment!.presentOccupation = { value: String(emp.presentOccupation).trim().toUpperCase(), source }
  if (emp.employerName) result.employment!.employerName = { value: String(emp.employerName).trim().toUpperCase(), source }
  if (emp.designationRank) result.employment!.designationRank = { value: String(emp.designationRank).trim().toUpperCase(), source }
  if (emp.employerAddress) result.employment!.employerAddress = { value: String(emp.employerAddress).trim().toUpperCase(), source }
  if (emp.employerPhone) result.employment!.employerPhone = { value: String(emp.employerPhone).trim(), source }
  if (emp.pastOccupation) result.employment!.pastOccupation = { value: String(emp.pastOccupation).trim().toUpperCase(), source }

  // 8. Travel
  const tr = (raw.travel || {}) as Record<string, unknown>
  if (tr.duration) result.travel!.duration = { value: String(tr.duration).trim(), source }
  if (tr.visaEntryType) result.travel!.visaEntryType = { value: String(tr.visaEntryType).trim().toUpperCase(), source }
  if (tr.entryPoint) result.travel!.entryPoint = { value: String(tr.entryPoint).trim().toUpperCase(), source }
  if (tr.exitPoint) result.travel!.exitPoint = { value: String(tr.exitPoint).trim().toUpperCase(), source }
  if (tr.purposeOfVisit) result.travel!.purposeOfVisit = { value: String(tr.purposeOfVisit).trim().toUpperCase(), source }
  if (tr.countriesVisited) result.travel!.countriesVisited = { value: String(tr.countriesVisited).trim().toUpperCase(), source }
  if (tr.visitedSaarc !== undefined && tr.visitedSaarc !== null) result.travel!.visitedSaarc = { value: Boolean(tr.visitedSaarc), source }

  // 9. Previous Visa
  const pv = (raw.previousVisa || {}) as Record<string, unknown>
  if (pv.hasPreviousVisa !== undefined && pv.hasPreviousVisa !== null) result.previousVisa!.hasPreviousVisa = { value: Boolean(pv.hasPreviousVisa), source }
  if (pv.visaNumber) result.previousVisa!.visaNumber = { value: String(pv.visaNumber).trim().toUpperCase(), source }
  if (pv.visaType) result.previousVisa!.visaType = { value: String(pv.visaType).trim().toUpperCase(), source }
  if (pv.placeOfIssue) result.previousVisa!.placeOfIssue = { value: String(pv.placeOfIssue).trim().toUpperCase(), source }
  if (pv.dateOfIssue) result.previousVisa!.dateOfIssue = { value: parseStandardIsoDate(String(pv.dateOfIssue)) || String(pv.dateOfIssue), source }
  if (pv.visitedAddress1) result.previousVisa!.visitedAddress1 = { value: String(pv.visitedAddress1).trim().toUpperCase(), source }
  if (pv.visitedAddress2) result.previousVisa!.visitedAddress2 = { value: String(pv.visitedAddress2).trim().toUpperCase(), source }
  if (pv.visitedAddress3) result.previousVisa!.visitedAddress3 = { value: String(pv.visitedAddress3).trim().toUpperCase(), source }

  // 10. Sponsor India & Mission
  const spInd = (raw.sponsorIndia || {}) as Record<string, unknown>
  if (spInd.name) result.sponsorIndia!.name = { value: String(spInd.name).trim().toUpperCase(), source }
  if (spInd.addressLine1) result.sponsorIndia!.addressLine1 = { value: String(spInd.addressLine1).trim().toUpperCase(), source }
  if (spInd.addressLine2) result.sponsorIndia!.addressLine2 = { value: String(spInd.addressLine2).trim().toUpperCase(), source }
  if (spInd.phone) result.sponsorIndia!.phone = { value: String(spInd.phone).trim(), source }
  if (spInd.email) result.sponsorIndia!.email = { value: String(spInd.email).trim().toLowerCase(), source }

  const spMsn = (raw.sponsorMission || {}) as Record<string, unknown>
  if (spMsn.name) result.sponsorMission!.name = { value: String(spMsn.name).trim().toUpperCase(), source }
  if (spMsn.addressLine1) result.sponsorMission!.addressLine1 = { value: String(spMsn.addressLine1).trim().toUpperCase(), source }
  if (spMsn.addressLine2) result.sponsorMission!.addressLine2 = { value: String(spMsn.addressLine2).trim().toUpperCase(), source }
  if (spMsn.phone) result.sponsorMission!.phone = { value: String(spMsn.phone).trim(), source }
  if (spMsn.email) result.sponsorMission!.email = { value: String(spMsn.email).trim().toLowerCase(), source }

  // Clean empty sections
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
