/**
 * Generic Select Resolver for Indian Visa Portal Dropdowns.
 * 
 * Provides robust, generic, multi-tier resolution of dropdown options:
 * 1. Exact normalized value matching
 * 2. Exact normalized text matching
 * 3. Alphanumeric clean matching
 * 4. Generic Country / Nationality / Demonym alias matching
 * 5. Structured prefix / suffix matching (e.g. "BANGLADESH - DHAKA" <-> "DHAKA")
 * 6. Word / Token boundary matching
 * 
 * Includes ambiguity detection and dynamic option population waiting.
 */

import { setNativeInputValue } from './eventDispatcher'

export interface SelectOptionMatchResult {
  option: HTMLOptionElement | null
  ambiguous: boolean
  matchMethod?: 'exact-value' | 'exact-text' | 'clean-match' | 'alias-match' | 'structured-match' | 'token-match' | 'semantic-match'
}

/**
 * Normalizes a string for comparison by lowercasing, trimming, and collapsing whitespace.
 */
export function normalizeSelectString(str?: string | null): string {
  if (!str) return ''
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * Cleans a string to alphanumeric-only characters (stripping all punctuation and spaces).
 */
export function cleanAlphanumeric(str?: string | null): string {
  if (!str) return ''
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Common Country / Nationality / Demonym / ISO Code Groups.
 * Every variant within an array maps to the same canonical equivalence group.
 */
export const COUNTRY_NATIONALITY_ALIAS_GROUPS: readonly (readonly string[])[] = [
  ['bangladesh', 'bangladeshi', 'bgd', 'bd'],
  ['india', 'indian', 'ind', 'in'],
  ['united states', 'united states of america', 'usa', 'us', 'american'],
  ['united kingdom', 'great britain', 'britain', 'gbr', 'gb', 'uk', 'british'],
  ['canada', 'canadian', 'can', 'ca'],
  ['australia', 'australian', 'aus', 'au'],
  ['germany', 'german', 'deu', 'de', 'ger', 'deutschland'],
  ['france', 'french', 'fra', 'fr'],
  ['italy', 'italian', 'ita', 'it', 'italia'],
  ['japan', 'japanese', 'jpn', 'jp', 'nippon'],
  ['china', 'chinese', 'chn', 'cn', 'prc'],
  ['nepal', 'nepali', 'nepalese', 'npl', 'np'],
  ['sri lanka', 'sri lankan', 'lka', 'lk', 'ceylon'],
  ['pakistan', 'pakistani', 'pak', 'pk'],
  ['bhutan', 'bhutanese', 'btn', 'bt'],
  ['myanmar', 'myanmarese', 'burmese', 'burma', 'mmr', 'mm'],
  ['malaysia', 'malaysian', 'mys', 'my'],
  ['singapore', 'singaporean', 'sgp', 'sg'],
  ['thailand', 'thai', 'tha', 'th'],
  ['indonesia', 'indonesian', 'idn', 'id'],
  ['philippines', 'filipino', 'philippine', 'phl', 'ph'],
  ['saudi arabia', 'saudi', 'sau', 'sa'],
  ['united arab emirates', 'uae', 'emirati', 'are', 'ae'],
  ['russia', 'russian', 'russian federation', 'rus', 'ru'],
  ['turkey', 'turkiye', 'turkish', 'tur', 'tr'],
  ['spain', 'spanish', 'esp', 'es', 'espana'],
  ['portugal', 'portuguese', 'prt', 'pt'],
  ['netherlands', 'dutch', 'holland', 'nld', 'nl'],
  ['sweden', 'swedish', 'swe', 'se'],
  ['norway', 'norwegian', 'nor', 'no'],
  ['finland', 'finnish', 'fin', 'fi'],
  ['denmark', 'danish', 'dnk', 'dk'],
  ['ireland', 'irish', 'irl', 'ie'],
  ['switzerland', 'swiss', 'che', 'ch'],
  ['austria', 'austrian', 'aut', 'at'],
  ['belgium', 'belgian', 'bel', 'be'],
  ['greece', 'greek', 'grc', 'gr', 'hellas'],
  ['egypt', 'egyptian', 'egy', 'eg'],
  ['south africa', 'south african', 'zaf', 'za'],
  ['nigeria', 'nigerian', 'nga', 'ng'],
  ['kenya', 'kenyan', 'ken', 'ke'],
  ['brazil', 'brazilian', 'bra', 'br', 'brasil'],
  ['argentina', 'argentine', 'argentinian', 'arg', 'ar'],
  ['mexico', 'mexican', 'mex', 'mx'],
  ['colombia', 'colombian', 'col', 'co'],
  ['chile', 'chilean', 'chl', 'cl'],
  ['peru', 'peruvian', 'per', 'pe'],
  ['new zealand', 'new zealander', 'nzl', 'nz', 'kiwi'],
  ['south korea', 'korea', 'korean', 'republic of korea', 'kor', 'kr'],
  ['vietnam', 'vietnamese', 'vnm', 'vn'],
]

// Build fast lookup map from alias to group
const ALIAS_TO_GROUP_MAP = new Map<string, readonly string[]>()
for (const group of COUNTRY_NATIONALITY_ALIAS_GROUPS) {
  for (const item of group) {
    ALIAS_TO_GROUP_MAP.set(cleanAlphanumeric(item), group)
  }
}

/**
 * Checks if two strings belong to the same country/nationality alias group.
 */
export function areAliasesEquivalent(val1: string, val2: string): boolean {
  const clean1 = cleanAlphanumeric(val1)
  const clean2 = cleanAlphanumeric(val2)
  if (!clean1 || !clean2) return false
  if (clean1 === clean2) return true

  const group1 = ALIAS_TO_GROUP_MAP.get(clean1)
  if (group1 && group1.some((alias) => cleanAlphanumeric(alias) === clean2)) {
    return true
  }

  const group2 = ALIAS_TO_GROUP_MAP.get(clean2)
  if (group2 && group2.some((alias) => cleanAlphanumeric(alias) === clean1)) {
    return true
  }

  return false
}

export interface PurposeCategory {
  category: string
  keywords: readonly string[]
}

/**
 * Generic Purpose of Visit and Visa Type semantic category groups.
 * Ordered with specific sub-categories (e.g. Medical Attendant) before broader categories (Medical).
 */
export const PURPOSE_OF_VISIT_SEMANTIC_CATEGORIES: readonly PurposeCategory[] = [
  {
    category: 'MEDICAL ATTENDANT',
    keywords: [
      'medical attendant',
      'med-x',
      'med x',
      'medical escort',
      'patient attendant',
      'accompanying patient',
      'attendant',
    ],
  },
  {
    category: 'TOURISM',
    keywords: [
      'touris',
      'tourist',
      'recreation',
      'sightseeing',
      'sight seeing',
      'holiday',
      'vacation',
      'yoga',
      'visiting friends',
      'visiting relatives',
      'leisure',
      'tourism',
      'tourist visa',
      'individual tourist',
    ],
  },
  {
    category: 'BUSINESS',
    keywords: [
      'business',
      'trade',
      'commercial',
      'meeting',
      'investor',
      'industrial',
      'sales',
      'corporate',
      'business meetings',
      'business visa',
    ],
  },
  {
    category: 'MEDICAL',
    keywords: [
      'medical',
      'treatment',
      'hospital',
      'doctor',
      'surgery',
      'consultation',
      'patient',
      'health',
      'therapy',
      'clinic',
      'medical visa',
      'short duration medical',
    ],
  },
  {
    category: 'CONFERENCE',
    keywords: [
      'conference',
      'seminar',
      'workshop',
      'symposium',
      'summit',
      'forum',
      'webinar',
      'conference visa',
    ],
  },
  {
    category: 'STUDENT',
    keywords: [
      'student',
      'study',
      'education',
      'university',
      'college',
      'academic',
      'scholarship',
      'course',
      'internship',
      'short term courses',
      'short-term courses',
      'student visa',
    ],
  },
  {
    category: 'EMPLOYMENT',
    keywords: [
      'employment',
      'work permit',
      'job',
      'deputation',
      'technician',
      'contractor',
      'employed',
      'employment visa',
    ],
  },
  {
    category: 'JOURNALIST',
    keywords: [
      'journalist',
      'journalism',
      'media',
      'press',
      'filming',
      'documentary',
      'reporter',
      'journalist visa',
    ],
  },
  {
    category: 'VOLUNTARY',
    keywords: [
      'voluntary',
      'volunteer',
      'voluntary work',
      'charity',
      'missionary',
      'ngo work',
    ],
  },
  {
    category: 'RESEARCH',
    keywords: [
      'research',
      'researcher',
      'fellowship',
      'research visa',
    ],
  },
  {
    category: 'FILM',
    keywords: [
      'film',
      'film making',
      'shooting',
      'cinema',
      'movie',
      'film visa',
    ],
  },
  {
    category: 'TRANSIT',
    keywords: [
      'transit',
      'layover',
      'direct transit',
      'connecting flight',
      'transit visa',
    ],
  },
  {
    category: 'ENTRY',
    keywords: [
      'entry',
      'family visa',
      'person of indian origin',
      'dependent',
      'spouse of indian',
      'entry visa',
    ],
  },
]

/**
 * Resolves a purpose string or option label to its semantic category.
 */
export function resolvePurposeSemanticCategory(text?: string | null): PurposeCategory | null {
  const norm = normalizeSelectString(text)
  if (!norm) return null

  for (const cat of PURPOSE_OF_VISIT_SEMANTIC_CATEGORIES) {
    // Check if category name itself is contained in text
    const catNorm = normalizeSelectString(cat.category)
    if (norm.includes(catNorm)) {
      return cat
    }
    // Check if any keyword is contained in text
    for (const kw of cat.keywords) {
      const normKw = normalizeSelectString(kw)
      if (norm.includes(normKw)) {
        return cat
      }
    }
  }
  return null
}

/**
 * Reads all non-empty <option> elements from an HTMLSelectElement.
 */
export function getSelectOptions(element: HTMLSelectElement): HTMLOptionElement[] {
  if (!element || !element.options) return []
  return Array.from(element.options).filter((opt) => {
    const val = opt.value.trim()
    const text = opt.text.trim()
    // Exclude generic placeholder options like "Select", "Select Country", "---", etc.
    if (val === '' && (text === '' || /^select\b|^--|^choose\b/i.test(text))) {
      return false
    }
    return true
  })
}

/**
 * Dynamically waits for a <select> element to have populated options.
 * Useful when a child dropdown (like Indian Mission) is populated via AJAX/event after parent change.
 */
export async function waitForSelectOptions(
  element: HTMLSelectElement,
  minCount = 1,
  timeoutMs = 1000,
  intervalMs = 50
): Promise<HTMLOptionElement[]> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const options = getSelectOptions(element)
    if (options.length >= minCount) {
      return options
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return getSelectOptions(element)
}

/**
 * Intelligently resolves a target value against the actual DOM <option> elements of a <select>.
 */
export function findMatchingSelectOption(
  element: HTMLSelectElement,
  targetValue: string
): SelectOptionMatchResult {
  const options = getSelectOptions(element)
  if (options.length === 0) {
    return { option: null, ambiguous: false }
  }

  const normTarget = normalizeSelectString(targetValue)
  const cleanTarget = cleanAlphanumeric(targetValue)
  if (!normTarget) {
    return { option: null, ambiguous: false }
  }

  // 1. Level 1: Exact match on normalized option value
  const exactValueMatches = options.filter(
    (opt) => normalizeSelectString(opt.value) === normTarget
  )
  if (exactValueMatches.length === 1) {
    return { option: exactValueMatches[0], ambiguous: false, matchMethod: 'exact-value' }
  }
  if (exactValueMatches.length > 1) {
    return { option: null, ambiguous: true }
  }

  // 2. Level 2: Exact match on normalized option text
  const exactTextMatches = options.filter(
    (opt) => normalizeSelectString(opt.text) === normTarget
  )
  if (exactTextMatches.length === 1) {
    return { option: exactTextMatches[0], ambiguous: false, matchMethod: 'exact-text' }
  }
  if (exactTextMatches.length > 1) {
    return { option: null, ambiguous: true }
  }

  // 3. Level 3: Alphanumeric-clean match on value or text
  const cleanMatches = options.filter((opt) => {
    const optValClean = cleanAlphanumeric(opt.value)
    const optTextClean = cleanAlphanumeric(opt.text)
    return optValClean === cleanTarget || optTextClean === cleanTarget
  })
  if (cleanMatches.length === 1) {
    return { option: cleanMatches[0], ambiguous: false, matchMethod: 'clean-match' }
  }
  if (cleanMatches.length > 1) {
    return { option: null, ambiguous: true }
  }

  // 4. Level 4: Generic Country / Nationality / Demonym alias dictionary match
  const aliasMatches = options.filter((opt) => {
    return (
      areAliasesEquivalent(targetValue, opt.text) ||
      areAliasesEquivalent(targetValue, opt.value)
    )
  })
  if (aliasMatches.length === 1) {
    return { option: aliasMatches[0], ambiguous: false, matchMethod: 'alias-match' }
  }
  if (aliasMatches.length > 1) {
    return { option: null, ambiguous: true }
  }

  // 5. Level 5: Structured prefix / suffix match (e.g. "BANGLADESH - DHAKA" <-> "DHAKA")
  const structuredMatches = options.filter((opt) => {
    const optVal = normalizeSelectString(opt.value)
    const optText = normalizeSelectString(opt.text)
    return (
      optVal.endsWith('- ' + normTarget) ||
      optVal.endsWith(' ' + normTarget) ||
      optVal.endsWith('-' + normTarget) ||
      optText.endsWith('- ' + normTarget) ||
      optText.endsWith(' - ' + normTarget) ||
      optText.endsWith(' ' + normTarget) ||
      optText.endsWith('-' + normTarget) ||
      optText.startsWith(normTarget + ' -') ||
      optText.startsWith(normTarget + ' ') ||
      optVal.startsWith(normTarget + '_') ||
      optVal.startsWith(normTarget + '-') ||
      // Inverse check: option text contains "- <target>" or target starts with option
      normTarget.endsWith('- ' + optText) ||
      normTarget.endsWith(' - ' + optText) ||
      normTarget.endsWith(' ' + optText) ||
      normTarget.startsWith(optText + ' -') ||
      normTarget.startsWith(optText + ' ')
    )
  })
  if (structuredMatches.length === 1) {
    return { option: structuredMatches[0], ambiguous: false, matchMethod: 'structured-match' }
  }
  if (structuredMatches.length > 1) {
    return { option: null, ambiguous: true }
  }

  // 6. Level 6: Word / Token boundary match (e.g. "DHAKA" matches "BANGLADESH - DHAKA")
  const tokenMatches = options.filter((opt) => {
    const optTextClean = normalizeSelectString(opt.text)
    const optValClean = normalizeSelectString(opt.value)
    const wordsText = optTextClean.split(/[^a-z0-9]+/).filter(Boolean)
    const wordsVal = optValClean.split(/[^a-z0-9]+/).filter(Boolean)
    const targetWords = normTarget.split(/[^a-z0-9]+/).filter(Boolean)

    // Check if target is a distinct token in the option or option is a token in target
    const targetInOpt = targetWords.every((w) => wordsText.includes(w) || wordsVal.includes(w))
    const optInTarget = wordsText.every((w) => targetWords.includes(w)) || wordsVal.every((w) => targetWords.includes(w))

    return targetInOpt || optInTarget
  })
  if (tokenMatches.length === 1) {
    return { option: tokenMatches[0], ambiguous: false, matchMethod: 'token-match' }
  }
  if (tokenMatches.length > 1) {
    return { option: null, ambiguous: true }
  }

  // 7. Level 7: Purpose of Visit Semantic Category & Keyword Relevance Ranking
  const targetCategory = resolvePurposeSemanticCategory(targetValue)
  if (targetCategory) {
    const scoredCandidates: Array<{ option: HTMLOptionElement; score: number }> = []
    const targetWords = normTarget.split(/[^a-z0-9]+/).filter((w) => w.length > 2)

    for (const opt of options) {
      const optText = normalizeSelectString(opt.text)
      const optVal = normalizeSelectString(opt.value)
      const optCategory = resolvePurposeSemanticCategory(opt.text) || resolvePurposeSemanticCategory(opt.value)

      let score = 0

      // Match on same semantic category
      if (optCategory && optCategory.category === targetCategory.category) {
        score += 10
      }

      // Keyword density matches (how many keywords of this category are in option)
      for (const kw of targetCategory.keywords) {
        const normKw = normalizeSelectString(kw)
        if (normKw && (optText.includes(normKw) || optVal.includes(normKw))) {
          score += 5
          // If the targetValue itself specifically contains this keyword, boost further
          if (normTarget.includes(normKw)) {
            score += 5
          }
        }
      }

      // Target words contained in option
      for (const tw of targetWords) {
        if (optText.includes(tw) || optVal.includes(tw)) {
          score += 3
        }
      }

      // Substring bonus
      if (normTarget.includes(optText) && optText.length > 3) {
        score += 8
      }
      if (optText.includes(normTarget) && normTarget.length > 3) {
        score += 8
      }

      if (score > 0) {
        scoredCandidates.push({ option: opt, score })
      }
    }

    if (scoredCandidates.length === 1) {
      return { option: scoredCandidates[0].option, ambiguous: false, matchMethod: 'semantic-match' }
    }

    if (scoredCandidates.length > 1) {
      scoredCandidates.sort((a, b) => b.score - a.score)
      const top = scoredCandidates[0]
      const runnerUp = scoredCandidates[1]

      // If top candidate has a clear lead (distinct score winner), select it
      if (top.score > runnerUp.score) {
        return { option: top.option, ambiguous: false, matchMethod: 'semantic-match' }
      }

      // Exact score tie between top candidates -> ambiguous
      return { option: null, ambiguous: true }
    }
  }

  return { option: null, ambiguous: false }
}

/**
 * Selects an option on an HTMLSelectElement and dispatches the standard DOM events.
 */
export function selectOptionAndDispatchEvents(
  element: HTMLSelectElement,
  option: HTMLOptionElement
): void {
  element.value = option.value
  option.selected = true
  setNativeInputValue(element, option.value)
}
