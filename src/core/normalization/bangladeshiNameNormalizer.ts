/**
 * Bangladeshi / Bengali Name Normalization Dictionary & Parser
 * 
 * STRICT RELIGION SAFETY INVARIANT:
 * Religion is a sensitive personal attribute and MUST NEVER be derived, inferred,
 * or populated from any name token, prefix, surname, or title.
 * 
 * This module is strictly restricted to:
 * - OCR noise correction in names
 * - Detecting name prefixes and titles
 * - Separating given name and surname
 * - Normalizing spelling / casing / whitespace
 * - Preserving compound names (e.g. D'Costa, D'Souza, Ud Din, Chandra Roy)
 * - Identifying name-token boundaries
 */

// ============================================================================
// 1. PREFIX / TITLE VARIANTS
// ============================================================================
export const BANGLADESHI_PREFIX_TITLE_VARIANTS: readonly string[] = [
  // Md variants
  'MD',
  'MD.',
  'MOHAMMAD',
  'MOHAMMED',
  'MOHAMED',
  'MUHAMMAD',
  'MUHAMMED',
  'MUHAMMOD',
  'MOHD',
  'MOHD.',

  // Mst variants
  'MST',
  'MST.',
  'MOST',
  'MOST.',
  'MSS',
  'MSS.',
  'MUSSAMAT',
  'MUSSAMET',
  'MUSAMMAT',
  'MOSAMMAT',

  // Shree / Sri variants
  'SREE',
  'SHREE',
  'SRI',
  'SHRI',

  // Begum (when used as title prefix)
  'BEGUM',
] as const

// ============================================================================
// 2. SURNAME / NAME-TOKEN VARIANTS
// ============================================================================
export const BANGLADESHI_SURNAME_VARIANTS: readonly string[] = [
  // Traditional Bengali Hindu/General Surnames
  'RAY',
  'ROY',
  'DAS',
  'DEY',
  'DE',
  'DEB',
  'DEV',
  'GHOSH',
  'BOSE',
  'BASU',
  'SAHA',
  'SEN',
  'PAL',
  'PAUL',
  'GHOSAL',
  'CHAKRABORTY',
  'CHATTERJEE',
  'BANERJEE',
  'BHATTACHARYA',
  'BHATTACHARJEE',
  'BHOWMIK',
  'BISWAS',
  'HALDER',
  'SARKER',
  'SARKAR',
  'NANDI',
  'DATTA',
  'DUTTA',
  'DHAR',
  'MITRA',
  'GUHA',
  'KAR',
  'KARMAKAR',
  'BHADRA',
  'ADHIKARI',
  'SANYAL',
  'BASAK',
  'BARAL',
  'KUNDU',
  'MONDAL',
  'MONDOL',
  'BARUA',
  'BORUA',

  // Bengali Christian / Portuguese-origin Surnames
  'GOMES',
  'ROZARIO',
  "D'ROZARIO",
  'D ROZARIO',
  "D'COSTA",
  'D COSTA',
  'COSTA',
  'GONSALVES',
  'GONSALVEZ',
  'CRUZE',
  'DIAS',
  "D'SILVA",
  'D SILVA',
  "D'SOUZA",
  'D SOUZA',
  'REBEIRO',
  'RIBEIRO',
  'PEREIRA',
  'RODRIGUES',
  'CORRAYA',
  'PALMA',
  'GREGORY',
] as const

// ============================================================================
// 3. MUSLIM-COMMON NAME TOKEN VARIANTS
// ============================================================================
export const BANGLADESHI_MUSLIM_COMMON_NAME_TOKENS: readonly string[] = [
  'AHMED',
  'AHMAD',
  'RAHMAN',
  'HOSSAIN',
  'HUSSAIN',
  'HASAN',
  'HASSAN',
  'ISLAM',
  'UDDIN',
  'UD DIN',
  'HAQUE',
  'HUQ',
  'ALI',
  'KHAN',
  'SHEIKH',
  'MIA',
  'MIAH',
  'KAZI',
  'CHOWDHURY',
  'SARKER',
  'SARKAR',
  'TALUKDER',
  'BHUIYAN',
  'BHUYAN',
  'MAZUMDER',
  'MAZUMDAR',
  'AKTER',
  'AKHTER',
  'KHATUN',
  'BEGUM',
  'SULTANA',
] as const

// Sets for O(1) membership lookup
const PREFIX_SET = new Set<string>(
  BANGLADESHI_PREFIX_TITLE_VARIANTS.map((v) => v.toUpperCase().replace(/\./g, ''))
)

const SURNAME_SET = new Set<string>([
  ...BANGLADESHI_SURNAME_VARIANTS.map((v) => v.toUpperCase()),
  ...BANGLADESHI_MUSLIM_COMMON_NAME_TOKENS.map((v) => v.toUpperCase()),
])

// ============================================================================
// 4. OCR NOISE PATTERNS & CORRECTION
// ============================================================================
const OCR_NAME_CHAR_REPLACEMENTS: Record<string, string> = {
  // Digit misreads in alphabetic name strings
  '0': 'O',
  '1': 'I',
  '5': 'S',
  '8': 'B',
  '|': 'I',
}

/**
 * Cleans OCR noise from name tokens (e.g. digit-letter confusion, stray punctuation).
 * Preserves hyphens and single quotes in names (e.g., D'Costa, D'Souza).
 */
export function correctNameOcrNoise(raw: string): string {
  if (!raw) return ''
  let cleaned = raw.trim()

  // Replace common OCR bracket/pipe noise
  cleaned = cleaned.replace(/[|()[\]{}]/g, '')

  // Fix digit-in-word OCR errors (e.g. "SHR1" -> "SHRI", "MD0" -> "MDO")
  cleaned = cleaned.replace(/\b([A-Za-z]*)([0158])([A-Za-z]*)\b/g, (match, pre, digit, post) => {
    // If the whole token is a number, don't change it; but inside a name word, replace it
    if (pre.length > 0 || post.length > 0) {
      return pre + (OCR_NAME_CHAR_REPLACEMENTS[digit] || digit) + post
    }
    return match
  })

  // Normalize apostrophes to standard single quote '
  cleaned = cleaned.replace(/[`’]/g, "'")

  return cleaned
}

/**
 * Normalizes a full name string:
 * - Trims and collapses whitespace
 * - Standardizes internal punctuation and casing
 * - Preserves compound names like D'Costa, D'Souza, Ud Din
 */
export function normalizeNameString(name?: string): string | undefined {
  if (!name) return undefined
  let cleaned = correctNameOcrNoise(name).trim().replace(/\s+/g, ' ')
  if (!cleaned) return undefined

  // Normalize common prefix dots: "MD. " -> "MD ", "MST. " -> "MST "
  cleaned = cleaned.replace(/\b(MD|MST|MOST|MSS|MOHD)\.\s+/gi, '$1 ')
  // Normalize "D COSTA" / "D ROZARIO" / "D SILVA" / "D SOUZA" into "D'COSTA" / "D'ROZARIO" etc.
  cleaned = cleaned.replace(/\bD\s+(COSTA|ROZARIO|SILVA|SOUZA)\b/gi, "D'$1")

  return cleaned.toUpperCase()
}

/**
 * Checks if a token is a known Bangladeshi prefix/title (e.g. MD, MST, SHREE, SRI).
 */
export function isBangladeshiPrefixOrTitle(token: string): boolean {
  if (!token) return false
  const clean = token.toUpperCase().replace(/\./g, '').trim()
  return PREFIX_SET.has(clean)
}

/**
 * Checks if a token is a known Bangladeshi surname or common family name token.
 */
export function isBangladeshiSurname(token: string): boolean {
  if (!token) return false
  const clean = token.toUpperCase().trim()
  return SURNAME_SET.has(clean)
}

export interface SplitNameResult {
  givenNames: string
  surname: string
  title?: string
  rawFullName: string
}

/**
 * Intelligently separates a full Bangladeshi name into Given Name and Surname.
 * 
 * Rules:
 * 1. Honors explicit title prefixes (e.g. "MD RAHIM UDDIN" -> Given: "MD RAHIM", Surname: "UDDIN").
 * 2. Recognizes multi-token compound surnames (e.g. "D'COSTA", "D'SOUZA", "CHANDRA ROY", "UD DIN").
 * 3. Identifies known surname tokens at the end of the name.
 * 4. For single-word names (e.g. "RAHIM"), populates both or marks given name.
 * 
 * STRICT RELIGION SAFETY:
 * NEVER assigns or returns religion.
 */
export function splitBangladeshiFullName(fullName: string): SplitNameResult {
  const normalized = normalizeNameString(fullName) || ''
  if (!normalized) {
    return { givenNames: '', surname: '', rawFullName: fullName || '' }
  }

  const tokens = normalized.split(/\s+/).filter(Boolean)

  if (tokens.length === 1) {
    return {
      givenNames: tokens[0],
      surname: tokens[0],
      rawFullName: fullName,
    }
  }

  // Detect title prefix
  let title: string | undefined
  if (isBangladeshiPrefixOrTitle(tokens[0])) {
    title = tokens[0]
  }

  // Check for compound surname at the end
  // Case A: 2-token compound surname (e.g., "UD DIN", "CHANDRA ROY", "KUMAR DAS")
  if (tokens.length >= 3) {
    const lastTwo = `${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}`
    if (
      lastTwo === 'UD DIN' ||
      tokens[tokens.length - 2] === 'CHANDRA' ||
      tokens[tokens.length - 2] === 'KUMAR'
    ) {
      const surname = lastTwo
      const givenNames = tokens.slice(0, -2).join(' ')
      return {
        givenNames: givenNames || surname,
        surname,
        title,
        rawFullName: fullName,
      }
    }
  }

  // Case B: Standard last token is surname (e.g. "MD ABDUL KARIM" -> given: "MD ABDUL", surname: "KARIM")
  const surname = tokens[tokens.length - 1]
  const givenNames = tokens.slice(0, -1).join(' ')

  return {
    givenNames,
    surname,
    title,
    rawFullName: fullName,
  }
}
