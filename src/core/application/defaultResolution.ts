/**
 * Centralized Default Resolution Layer for Workspace & Application Fields
 *
 * Implements deterministic derivation and approved product defaults according to Task 117:
 * - Precedence:
 *   1. Manual user edit
 *   2. Document-derived value (passport)
 *   3. Official uploaded document value (OGD)
 *   4. Deterministic derived rule
 *   5. Approved product default
 *   6. Blank / missing
 *
 * Strict Rules:
 * - Never overwrite manual values.
 * - Never overwrite document values.
 * - Never masquerade defaults as OCR/document evidence (source is always 'derived').
 * - Sensitive/legal/declaration questions must NEVER be answered with fake defaults.
 */

export interface DefaultResolutionContext {
  isApplicantBangladeshi: boolean
  hasSpouse: boolean
  hasDocumentNationality?: boolean
  hasPakistanRelation?: boolean
  hasMilitaryService?: boolean
  hasPreviousVisa?: boolean
  holdsOtherPassport?: boolean
  hasFather?: boolean
  hasMother?: boolean
  applicantPlaceOfBirth?: string
}

export interface ResolvedDefault {
  value: string | boolean
  source: 'derived'
  reason: string
}

/**
 * Checks if a string represents Bangladesh / Bangladeshi / BGD deterministically.
 */
export function isBangladeshiValue(val?: string | null): boolean {
  if (!val) return false
  const s = val.trim().toUpperCase()
  return s === 'BANGLADESH' || s === 'BANGLADESHI' || s === 'BGD'
}

/**
 * Normalizes nationality strings to canonical format.
 */
export function normalizeNationality(val?: string | null): string {
  if (!val) return ''
  const trimmed = val.trim()
  const upper = trimmed.toUpperCase()
  if (upper === 'BANGLADESHI' || upper === 'BGD' || upper === 'BANGLADESH') {
    return 'BANGLADESH'
  }
  if (upper === 'INDIAN' || upper === 'IND' || upper === 'INDIA') {
    return 'INDIA'
  }
  if (upper === 'NEPALESE' || upper === 'NPL' || upper === 'NEPAL') {
    return 'NEPAL'
  }
  if (upper === 'PAKISTANI' || upper === 'PAK' || upper === 'PAKISTAN') {
    return 'PAKISTAN'
  }
  return trimmed
}

/**
 * Normalizes country strings to canonical format.
 */
export function normalizeCountry(val?: string | null): string {
  if (!val) return ''
  const trimmed = val.trim()
  const upper = trimmed.toUpperCase()
  if (upper === 'BANGLADESHI' || upper === 'BGD' || upper === 'BANGLADESH') {
    return 'BANGLADESH'
  }
  if (upper === 'INDIAN' || upper === 'IND' || upper === 'INDIA') {
    return 'INDIA'
  }
  if (upper === 'NEPALESE' || upper === 'NPL' || upper === 'NEPAL') {
    return 'NEPAL'
  }
  if (upper === 'PAKISTANI' || upper === 'PAK' || upper === 'PAKISTAN') {
    return 'PAKISTAN'
  }
  return trimmed
}

/**
 * Resolves an approved product default or deterministic derivation for a specific field key.
 * Returns undefined if no approved default exists for that field.
 */
export function resolveApprovedProductDefault(
  key: string,
  context: DefaultResolutionContext
): ResolvedDefault | undefined {
  // 1. Applicant Nationality Default
  if (key === 'appl.nationality' || key === 'nationality') {
    if (context.isApplicantBangladeshi || !context.hasDocumentNationality) {
      return {
        value: 'BANGLADESH',
        source: 'derived',
        reason: 'Approved product default: BANGLADESH nationality for applicant',
      }
    }
  }

  // 1b. Applicant Country/Region of Birth Default (Task 119)
  if (key === 'appl.country_of_birth' || key === 'country_of_birth') {
    if (context.isApplicantBangladeshi || !context.hasDocumentNationality) {
      return {
        value: 'BANGLADESH',
        source: 'derived',
        reason: 'Approved product default: BANGLADESH country of birth for applicant',
      }
    }
  }

  // 2. Present Country & Country of Residence
  if (
    key === 'appl.countryname' ||
    key === 'present_country' ||
    key === 'pres_country'
  ) {
    if (context.isApplicantBangladeshi) {
      return {
        value: 'BANGLADESH',
        source: 'derived',
        reason: 'Derived: Present country matches Bangladeshi nationality and passport origin',
      }
    }
  }

  // 3. Permanent Country
  if (key === 'permanent_country') {
    if (context.isApplicantBangladeshi) {
      return {
        value: 'BANGLADESH',
        source: 'derived',
        reason: 'Derived: Permanent country matches Bangladeshi nationality',
      }
    }
  }

  // 4. Nationality by Birth
  if (key === 'appl.nationality_by' || key === 'nationality_by') {
    return {
      value: 'Birth',
      source: 'derived',
      reason: 'Approved product default: Nationality acquired by Birth',
    }
  }

  // 5. Visual Identification Marks Fallback
  if (key === 'appl.visual_mark' || key === 'visual_mark') {
    return {
      value: 'NA',
      source: 'derived',
      reason: 'Approved product default: NA when no visual identification marks are listed',
    }
  }

  // 6. Educational Qualification Fallback
  if (key === 'appl.edu_id' || key === 'edu_id') {
    return {
      value: 'BELOW MATRICULATION',
      source: 'derived',
      reason: 'Approved product default: Educational qualification baseline',
    }
  }

  // 7. Passport Issue Place Default (for Bangladeshi passports)
  if (
    key === 'appl.passport_issue_place' ||
    key === 'issueplace' ||
    key === 'appl.issueplace'
  ) {
    if (context.isApplicantBangladeshi) {
      return {
        value: 'DHAKA',
        source: 'derived',
        reason: 'Approved product default: DHAKA issue place for Bangladeshi passports',
      }
    }
  }

  // 8. Holds Other Passport Flag
  if (key === 'appl.oth_ppt' || key === 'oth_ppt') {
    if (context.holdsOtherPassport === false) {
      return {
        value: 'No',
        source: 'derived',
        reason: 'Derived: Document explicitly indicates no other/previous passport',
      }
    }
  }

  // 9. Marital Status (Task 119: deterministic spouse presence -> Married, no spouse -> Single)
  if (key === 'marital_status' || key === 'appl.marital_status') {
    if (context.hasSpouse) {
      return {
        value: 'Married',
        source: 'derived',
        reason: 'Derived: Married status confirmed by spouse record in document',
      }
    } else {
      return {
        value: 'Single',
        source: 'derived',
        reason: 'Derived: Single status default when no spouse record is present in document',
      }
    }
  }

  // 10. Father Defaults (Task 119: only when father exists)
  if (context.hasFather) {
    if (
      (key === 'father_nationality' || key === 'appl.father_nationality') &&
      (context.isApplicantBangladeshi || !context.hasDocumentNationality)
    ) {
      return {
        value: 'BANGLADESH',
        source: 'derived',
        reason: 'Approved product default: Father nationality matches Bangladeshi family descent',
      }
    }

    if (
      (key === 'father_prev_nationality' || key === 'appl.father_prev_nationality') &&
      (context.isApplicantBangladeshi || !context.hasDocumentNationality)
    ) {
      return {
        value: 'BANGLADESH',
        source: 'derived',
        reason: 'Approved product default: Father previous nationality matches Bangladeshi family descent',
      }
    }

    if (
      (key === 'father_place_of_birth' || key === 'appl.father_place_of_birth') &&
      context.applicantPlaceOfBirth
    ) {
      return {
        value: context.applicantPlaceOfBirth.toUpperCase(),
        source: 'derived',
        reason: "Derived: Father place of birth defaults to applicant's extracted place of birth",
      }
    }

    if (
      (key === 'father_country_of_birth' || key === 'appl.father_country_of_birth') &&
      (context.isApplicantBangladeshi || !context.hasDocumentNationality)
    ) {
      return {
        value: 'BANGLADESH',
        source: 'derived',
        reason: 'Approved product default: Father country of birth matches Bangladeshi family descent',
      }
    }
  }

  // 11. Mother Defaults (Task 119: only when mother exists)
  if (context.hasMother) {
    if (
      (key === 'mother_nationality' || key === 'appl.mother_nationality') &&
      (context.isApplicantBangladeshi || !context.hasDocumentNationality)
    ) {
      return {
        value: 'BANGLADESH',
        source: 'derived',
        reason: 'Approved product default: Mother nationality matches Bangladeshi family descent',
      }
    }

    if (
      (key === 'mother_prev_nationality' || key === 'appl.mother_prev_nationality') &&
      (context.isApplicantBangladeshi || !context.hasDocumentNationality)
    ) {
      return {
        value: 'BANGLADESH',
        source: 'derived',
        reason: 'Approved product default: Mother previous nationality matches Bangladeshi family descent',
      }
    }

    if (
      (key === 'mother_place_of_birth' || key === 'appl.mother_place_of_birth') &&
      context.applicantPlaceOfBirth
    ) {
      return {
        value: context.applicantPlaceOfBirth.toUpperCase(),
        source: 'derived',
        reason: "Derived: Mother place of birth defaults to applicant's extracted place of birth",
      }
    }

    if (
      (key === 'mother_country_of_birth' || key === 'appl.mother_country_of_birth') &&
      (context.isApplicantBangladeshi || !context.hasDocumentNationality)
    ) {
      return {
        value: 'BANGLADESH',
        source: 'derived',
        reason: 'Approved product default: Mother country of birth matches Bangladeshi family descent',
      }
    }
  }

  // 12. Spouse Defaults (Task 119: only when spouse exists)
  if (context.hasSpouse) {
    if (
      (key === 'spouse_nationality' || key === 'appl.spouse_nationality') &&
      (context.isApplicantBangladeshi || !context.hasDocumentNationality)
    ) {
      return {
        value: 'BANGLADESH',
        source: 'derived',
        reason: 'Approved product default: Spouse nationality matches Bangladeshi family descent',
      }
    }

    if (
      (key === 'spouse_prev_nationality' || key === 'appl.spouse_prev_nationality') &&
      (context.isApplicantBangladeshi || !context.hasDocumentNationality)
    ) {
      return {
        value: 'BANGLADESH',
        source: 'derived',
        reason: 'Approved product default: Spouse previous nationality matches Bangladeshi family descent',
      }
    }

    if (key === 'spouse_place_of_birth' || key === 'appl.spouse_place_of_birth') {
      return {
        value: 'BANGLADESH',
        source: 'derived',
        reason: 'Approved product default: BANGLADESH place of birth for spouse when unavailable',
      }
    }

    if (
      (key === 'spouse_country_of_birth' || key === 'appl.spouse_country_of_birth') &&
      (context.isApplicantBangladeshi || !context.hasDocumentNationality)
    ) {
      return {
        value: 'BANGLADESH',
        source: 'derived',
        reason: 'Approved product default: BANGLADESH country of birth for spouse',
      }
    }
  }

  // 11. ISD Code
  if (key === 'isd_code') {
    if (context.isApplicantBangladeshi) {
      return {
        value: '880',
        source: 'derived',
        reason: 'Derived: ISD code +880 for Bangladesh',
      }
    }
  }

  // 12. Negative declaration flags (only when explicitly confirmed absent by document/OGD profile)
  if (
    (key === 'grandparent_flag' || key === 'appl.grandparent_flag') &&
    context.hasPakistanRelation === false
  ) {
    return {
      value: 'No',
      source: 'derived',
      reason: 'Derived: Negative relation to Pakistan confirmed by applicant profile',
    }
  }

  if (
    (key === 'prev_org' || key === 'appl.prev_org') &&
    context.hasMilitaryService === false
  ) {
    return {
      value: 'No',
      source: 'derived',
      reason: 'Derived: Negative military service confirmed by applicant profile',
    }
  }

  if (
    (key === 'old_visa_flag' || key === 'appl.old_visa_flag') &&
    context.hasPreviousVisa === false
  ) {
    return {
      value: 'No',
      source: 'derived',
      reason: 'Derived: Negative previous Indian visa confirmed by applicant profile',
    }
  }

  return undefined
}
