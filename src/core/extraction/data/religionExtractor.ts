import type { ExtractionSource } from './types'

export type ReligionConfidenceLevel = 'high' | 'medium' | 'low' | 'none'
export type ReligionEvidenceSource = 'passport' | 'official_document' | 'ogd' | 'manual' | 'missing'

export interface ReligionExtractionResult {
  value: string
  normalizedValue?: string
  source: ReligionEvidenceSource
  confidence: ReligionConfidenceLevel
  conflict: boolean
  conflictDetails?: string
  rawSourceValue?: string
}

/**
 * Standard canonical mappings for religion in the Indian Visa Application.
 * Options on portal: ISLAM, HINDU, BUDDHISM, CHRISTIAN, SIKH, OTHERS.
 */
const RELIGION_CANONICAL_MAP: Record<string, string> = {
  // ISLAM
  ISLAM: 'ISLAM',
  ISLAMIC: 'ISLAM',
  MUSLIM: 'ISLAM',
  MUSLIMISM: 'ISLAM',
  MUSALMAN: 'ISLAM',
  ISLAMISM: 'ISLAM',

  // HINDU
  HINDU: 'HINDU',
  HINDUISM: 'HINDU',
  SANATAN: 'HINDU',
  SANATANA: 'HINDU',
  SANATANDHARMA: 'HINDU',

  // BUDDHISM
  BUDDHIST: 'BUDDHISM',
  BUDDHISM: 'BUDDHISM',
  BOUDDHA: 'BUDDHISM',
  BUDDHA: 'BUDDHISM',

  // CHRISTIAN
  CHRISTIAN: 'CHRISTIAN',
  CHRISTIANITY: 'CHRISTIAN',
  CATHOLIC: 'CHRISTIAN',
  PROTESTANT: 'CHRISTIAN',
  BAPTIST: 'CHRISTIAN',
  ORTHODOX: 'CHRISTIAN',
  CHRISTEN: 'CHRISTIAN',

  // SIKH
  SIKH: 'SIKH',
  SIKHISM: 'SIKH',

  // OTHERS
  JAIN: 'OTHERS',
  JAINISM: 'OTHERS',
  PARSI: 'OTHERS',
  ZOROASTRIAN: 'OTHERS',
  ZOROASTRIANISM: 'OTHERS',
  JEWISH: 'OTHERS',
  JUDAISM: 'OTHERS',
  OTHER: 'OTHERS',
  OTHERS: 'OTHERS',
  NON_RELIGIOUS: 'OTHERS',
  ATHEIST: 'OTHERS',
  AGNOSTIC: 'OTHERS',
}

/**
 * Normalizes an explicit religion string into a verified canonical value.
 * Returns undefined if raw string is not a recognized religion.
 * 
 * STRICT RULE: Does NOT guess from name, surname, or prefixes.
 */
export function normalizeReligion(raw?: string): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z]/g, '')
  if (!cleaned) return undefined
  return RELIGION_CANONICAL_MAP[cleaned]
}

/**
 * Words indicating relative/family member context preceding religion.
 * Strict Rule: Applicant religion must NEVER be derived from parents or family members.
 */
const RELATIVE_PREFIX_BEFORE_RELIGION = /(?:father|mother|parent|spouse|husband|wife|guardian|child|son|daughter)(?:'s|s)?\s*[:\-/]?\s*$/i

/**
 * Robust regex for detecting explicit Religion labels in PDF or OCR text.
 * Allows common OCR substitutions (e.g. RELIGlON, RELIG1ON, RELlGION, RELIGl0N).
 */
const EXPLICIT_RELIGION_SCAN_REGEX = /(?:([^\r\n]{0,40})\s+)?\b(RELIG[I1l|0]ON(?:\s*[/\\&]\s*COMMUNITY)?|RELIGIOUS\s*(?:AFFILIATION|BELIEF|FAITH|COMMUNITY)|FAITH)\s*[:=\-.]?\s*([A-Za-z]+)/gi

/**
 * Extracts explicit religion from raw document text (PDF text or OCR).
 * Returns undefined if no explicit religion label exists, if extracted word is not a religion,
 * or if the label belongs to a family member (Father's/Mother's Religion).
 */
export function extractReligionFromExplicitDocumentText(
  text: string,
  sourceType: 'passport' | 'official_document' | 'ogd' | ExtractionSource = 'passport'
): { value: string; raw: string; source: 'passport' | 'official_document' | 'ogd'; confidence: ReligionConfidenceLevel } | undefined {
  if (!text) return undefined

  let match: RegExpExecArray | null
  // Reset lastIndex for global regex
  EXPLICIT_RELIGION_SCAN_REGEX.lastIndex = 0

  while ((match = EXPLICIT_RELIGION_SCAN_REGEX.exec(text)) !== null) {
    const prefixContext = (match[1] || '').trim()
    const rawCandidate = match[3]?.trim()
    if (!rawCandidate) continue

    // If preceding context on the same line indicates a family member (e.g. "Father's Religion:", "Mother's Religion:"), skip it!
    if (RELATIVE_PREFIX_BEFORE_RELIGION.test(prefixContext)) {
      continue
    }

    const normalized = normalizeReligion(rawCandidate)
    if (normalized) {
      const assignedSource =
        sourceType === 'ogd' ? 'ogd' : sourceType === 'official_document' ? 'official_document' : 'passport'
      const assignedConfidence: ReligionConfidenceLevel = assignedSource === 'ogd' ? 'medium' : 'high'

      return {
        value: normalized,
        raw: rawCandidate,
        source: assignedSource,
        confidence: assignedConfidence,
      }
    }
  }

  return undefined
}

/**
 * Resolves final religion with strict source precedence and conflict detection:
 * 
 * Manual User Edit (Level 5)
 *   >
 * Current Passport / Current Official Document (Level 1 / 2)
 *   >
 * OGD / Previous Application (Level 3)
 *   >
 * Blank (Level 4 / Default)
 */
export function resolveApplicantReligion(options: {
  passportText?: string | null
  passportExtractedValue?: string | null
  ogdText?: string | null
  ogdExtractedValue?: string | null
  existingManualValue?: string | boolean | null
  isUserEdited?: boolean
}): ReligionExtractionResult {
  const {
    passportText,
    passportExtractedValue,
    ogdText,
    ogdExtractedValue,
    existingManualValue,
    isUserEdited,
  } = options

  // 1. LEVEL 5: Manual User Edit (Highest Precedence)
  if (isUserEdited && existingManualValue !== undefined && existingManualValue !== null && String(existingManualValue).trim() !== '') {
    const rawManual = String(existingManualValue).trim()
    const normManual = normalizeReligion(rawManual) || rawManual.toUpperCase()
    return {
      value: normManual,
      normalizedValue: normManual,
      source: 'manual',
      confidence: 'high',
      conflict: false,
      rawSourceValue: rawManual,
    }
  }

  // 2. LEVEL 1 & 2: Current Passport / Official Document
  let passportRel: { value: string; raw: string } | undefined
  if (passportExtractedValue) {
    const norm = normalizeReligion(passportExtractedValue)
    if (norm) passportRel = { value: norm, raw: passportExtractedValue }
  }
  if (!passportRel && passportText) {
    const fromText = extractReligionFromExplicitDocumentText(passportText, 'passport')
    if (fromText) passportRel = { value: fromText.value, raw: fromText.raw }
  }

  // 3. LEVEL 3: OGD / Previous Application
  let ogdRel: { value: string; raw: string } | undefined
  if (ogdExtractedValue) {
    const norm = normalizeReligion(ogdExtractedValue)
    if (norm) ogdRel = { value: norm, raw: ogdExtractedValue }
  }
  if (!ogdRel && ogdText) {
    const fromText = extractReligionFromExplicitDocumentText(ogdText, 'ogd')
    if (fromText) ogdRel = { value: fromText.value, raw: fromText.raw }
  }

  // 4. PRECEDENCE & CONFLICT EVALUATION
  if (passportRel) {
    if (ogdRel && ogdRel.value !== passportRel.value) {
      // Conflict between Passport and OGD: Passport takes authoritative precedence, but conflict is flagged!
      return {
        value: passportRel.value,
        normalizedValue: passportRel.value,
        source: 'passport',
        confidence: 'high',
        conflict: true,
        conflictDetails: `Religion conflict detected: Current passport indicates "${passportRel.raw}" while previous OGD application indicates "${ogdRel.raw}". Passport value takes precedence.`,
        rawSourceValue: passportRel.raw,
      }
    }

    return {
      value: passportRel.value,
      normalizedValue: passportRel.value,
      source: 'passport',
      confidence: 'high',
      conflict: false,
      rawSourceValue: passportRel.raw,
    }
  }

  if (ogdRel) {
    return {
      value: ogdRel.value,
      normalizedValue: ogdRel.value,
      source: 'ogd',
      confidence: 'medium',
      conflict: false,
      rawSourceValue: ogdRel.raw,
    }
  }

  // 5. NO DOCUMENT EVIDENCE: Must remain blank (Never guess from name or family!)
  return {
    value: '',
    source: 'missing',
    confidence: 'none',
    conflict: false,
  }
}
