import { getAllSchemaFields, WORKSPACE_PAGES } from './fieldSchema'
import type { SavedApplication, ApplicationFieldValue } from './types'

/**
 * Legacy or combined fields defined in the schema that are never rendered
 * as fillable form inputs in the Workspace UI.
 */
export const WORKSPACE_NON_RENDERED_FIELDS = new Set<string>([
  'state_name',
  'perm_add3',
  'appl.changedSurnameCheck',
])

/**
 * Known field aliases where the Workspace components may read or store values
 * interchangeably under either key.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  'purpose': ['appl.purpose'],
  'appl.purpose': ['purpose'],
  'entrypoint': ['appl.entrypoint'],
  'appl.entrypoint': ['entrypoint'],
  'exitpoint': ['appl.exitpoint'],
  'appl.exitpoint': ['exitpoint'],
  'refuse_flag': ['appl.refuse_flag'],
  'appl.refuse_flag': ['refuse_flag'],
  'appl.email': ['appl.email_re', 'email'],
  'appl.email_re': ['appl.email', 'email'],
  'comp_name': ['appl.comp_name'],
  'appl.comp_name': ['comp_name'],
  'comp_address': ['appl.comp_address'],
  'appl.comp_address': ['comp_address'],
  'comp_phone': ['appl.comp_phone'],
  'appl.comp_phone': ['comp_phone'],
  'comp_email': ['appl.comp_email'],
  'appl.comp_email': ['comp_email'],
  'religion': ['appl.religion'],
  'appl.religion': ['religion'],
  'visa_type': ['appl.visatype', 'appl.visa_type'],
  'appl.visatype': ['visa_type', 'appl.visa_type'],
  'appl.visa_type': ['visa_type', 'appl.visatype'],
}

/**
 * Helper to safely extract a trimmed string value from a field key or alias.
 */
function getTrimmedStringValue(key: string, fields: Record<string, ApplicationFieldValue | undefined>): string {
  const primary = fields[key]?.value
  if (typeof primary === 'string') return primary.trim()
  if (typeof primary === 'boolean') return primary ? 'true' : 'false'

  const aliases = FIELD_ALIASES[key]
  if (aliases) {
    for (const alias of aliases) {
      const aliasVal = fields[alias]?.value
      if (typeof aliasVal === 'string' && aliasVal.trim().length > 0) {
        return aliasVal.trim()
      }
      if (typeof aliasVal === 'boolean') {
        return aliasVal ? 'true' : 'false'
      }
    }
  }

  return ''
}

/**
 * Helper to check whether a boolean or 'yes'/'true' string is set for a field key or alias.
 */
function getBooleanValue(key: string, fields: Record<string, ApplicationFieldValue | undefined>): boolean {
  const primary = fields[key]?.value
  if (typeof primary === 'boolean') return primary
  if (typeof primary === 'string') {
    const lower = primary.trim().toLowerCase()
    return lower === 'yes' || lower === 'true'
  }

  const aliases = FIELD_ALIASES[key]
  if (aliases) {
    for (const alias of aliases) {
      const aliasVal = fields[alias]?.value
      if (typeof aliasVal === 'boolean') return aliasVal
      if (typeof aliasVal === 'string') {
        const lower = aliasVal.trim().toLowerCase()
        if (lower === 'yes' || lower === 'true') return true
      }
    }
  }

  return false
}

/**
 * Determines whether a field is currently applicable and fillable in the Workspace,
 * following authentic portal visibility rules and existing Workspace UI conditional logic.
 */
export function isFieldApplicable(
  key: string,
  fields: Record<string, ApplicationFieldValue | undefined>,
  showAllFields = false
): boolean {
  // Legacy / non-rendered fields are never applicable
  if (WORKSPACE_NON_RENDERED_FIELDS.has(key)) {
    return false
  }

  // If user activated "Show All 100 Fields" view mode, all real form fields are applicable
  if (showAllFields) {
    return true
  }

  // 1. Name change conditional fields (Basic Details)
  if (key === 'appl.prev_surname' || key === 'appl.prev_name') {
    const hasChangedName =
      fields['appl.changedSurnameCheck'] !== undefined
        ? getBooleanValue('appl.changedSurnameCheck', fields)
        : Boolean(
            getTrimmedStringValue('appl.prev_surname', fields) ||
            getTrimmedStringValue('appl.prev_name', fields)
          )
    return hasChangedName
  }

  // 2. Secondary / Other Passport conditional fields (Basic Details)
  if (
    key === 'appl.prev_passport_country_issue' ||
    key === 'appl.oth_pptno' ||
    key === 'appl.oth_ppt_issue_date' ||
    key === 'appl.oth_ppt_issue_place' ||
    key === 'appl.other_ppt_nationality'
  ) {
    return getTrimmedStringValue('appl.oth_ppt', fields).toLowerCase() === 'yes'
  }

  // 3. Spouse details conditional fields (Family Details)
  if (
    key === 'spouse_name' ||
    key === 'spouse_place_of_birth' ||
    key === 'spouse_country_of_birth' ||
    key === 'spouse_nationality' ||
    key === 'spouse_prev_nationality'
  ) {
    return getTrimmedStringValue('marital_status', fields).toLowerCase() === 'married'
  }

  // 4. Grandparent Pakistan Ancestry details conditional field (Family Details)
  if (key === 'grandparent_details') {
    return getTrimmedStringValue('grandparent_flag', fields).toLowerCase() === 'yes'
  }

  // 5. Dependent occupation supporter flag (Family Details)
  if (key === 'occ_flag') {
    const occ = getTrimmedStringValue('occupation', fields).toUpperCase()
    return (
      occ === 'HOUSE WIFE' ||
      occ === 'HOUSEWIFE' ||
      occ === 'STUDENT' ||
      occ === 'UN-EMPLOYED' ||
      occ === 'UNEMPLOYED' ||
      occ === 'MINOR' ||
      Boolean(getTrimmedStringValue('occ_flag', fields))
    )
  }

  // 6. Military / Security Service conditional fields (Family Details)
  if (
    key === 'previous_organization' ||
    key === 'previous_designation' ||
    key === 'previous_rank' ||
    key === 'previous_posting'
  ) {
    return getTrimmedStringValue('prev_org', fields).toLowerCase() === 'yes'
  }

  // 7. Previous India Visit / Visa conditional fields (Visa Details)
  if (
    key === 'prv_visit_add1' ||
    key === 'prv_visit_add2' ||
    key === 'prv_visit_add3' ||
    key === 'cities_visited' ||
    key === 'old_visa_no' ||
    key === 'old_visa_type_id' ||
    key === 'oldvisaissueplace' ||
    key === 'oldvisaissuedate'
  ) {
    return getTrimmedStringValue('old_visa_flag', fields).toLowerCase() === 'yes'
  }

  // 8. Previous Refusal details conditional field (Visa Details)
  if (key === 'refuse_details') {
    return (
      getTrimmedStringValue('refuse_flag', fields).toLowerCase() === 'yes' ||
      getTrimmedStringValue('appl.refuse_flag', fields).toLowerCase() === 'yes'
    )
  }

  // 9. SAARC Countries Visited details conditional field (Visa Details)
  if (key === 'saarc_details') {
    return getTrimmedStringValue('saarc_flag', fields).toLowerCase() === 'yes'
  }

  // 10. Statutory Additional Questions 1 to 6 explanation fields
  const questionMatch = key.match(/^answer_([1-6])$/)
  if (questionMatch) {
    const qNum = questionMatch[1]
    return getTrimmedStringValue(`question_${qNum}_flag`, fields).toLowerCase() === 'yes'
  }

  // All other fields are standard fillable fields in the Workspace
  return true
}

/**
 * Determines whether a field contains a meaningful, usable value in the Workspace.
 *
 * Counted as FILLED:
 * - Non-empty, non-whitespace strings (including 'Yes', 'No', derived/default codes)
 * - Valid numbers (where field legitimately uses numbers, e.g. 0)
 * - Boolean true
 *
 * Counted as EMPTY:
 * - Empty strings ("")
 * - Whitespace-only strings ("   ")
 * - null
 * - undefined
 */
export function isFieldFilled(
  fieldValue?: ApplicationFieldValue | string | boolean | number | null
): boolean {
  if (fieldValue === null || fieldValue === undefined) {
    return false
  }

  // Extract raw value if an ApplicationFieldValue object was passed
  const val = typeof fieldValue === 'object' && 'value' in fieldValue ? fieldValue.value : fieldValue

  if (val === null || val === undefined) {
    return false
  }

  if (typeof val === 'string') {
    return val.trim().length > 0
  }

  if (typeof val === 'number') {
    return !isNaN(val)
  }

  if (typeof val === 'boolean') {
    return true
  }

  return false
}

export interface WorkspacePageProgress {
  pageId: string
  total: number
  filled: number
  percentage: number
  isComplete: boolean
}

export interface WorkspaceProgressResult {
  total: number
  filled: number
  missing: number
  percentage: number
  isComplete: boolean
  applicableFields: string[]
  filledFields: string[]
  missingFields: string[]
  pageProgress: Record<string, WorkspacePageProgress>
}

/**
 * Calculates overall application completion progress and per-page breakdown
 * based on canonical schema definitions and live Workspace application state.
 */
export function calculateWorkspaceProgress(
  application: SavedApplication | null,
  showAllFields = false
): WorkspaceProgressResult {
  const fields = application?.fields || {}

  // Get canonical schema fields, de-duplicating by unique key
  const allSchemaFields = getAllSchemaFields()
  const uniqueSchemaKeys = new Set<string>()
  const uniqueFields: typeof allSchemaFields = []

  for (const f of allSchemaFields) {
    if (!uniqueSchemaKeys.has(f.key)) {
      uniqueSchemaKeys.add(f.key)
      uniqueFields.push(f)
    }
  }

  const applicableFields: string[] = []
  const filledFields: string[] = []
  const missingFields: string[] = []

  // Track page-level progress for each of the 5 authentic portal pages
  const pageStats: Record<string, { total: number; filled: number }> = {}
  for (const page of WORKSPACE_PAGES) {
    pageStats[page.id] = { total: 0, filled: 0 }
  }

  // Build a lookup map of fieldKey -> pageId
  const keyToPageId = new Map<string, string>()
  for (const page of WORKSPACE_PAGES) {
    for (const k of page.fieldKeys) {
      if (!keyToPageId.has(k)) {
        keyToPageId.set(k, page.id)
      }
    }
  }

  for (const fieldDef of uniqueFields) {
    const key = fieldDef.key
    if (!isFieldApplicable(key, fields, showAllFields)) {
      continue
    }

    applicableFields.push(key)

    // Check if primary key or any alias has a filled value
    let filled = isFieldFilled(fields[key])
    if (!filled && FIELD_ALIASES[key]) {
      for (const alias of FIELD_ALIASES[key]) {
        if (isFieldFilled(fields[alias])) {
          filled = true
          break
        }
      }
    }

    if (filled) {
      filledFields.push(key)
    } else {
      missingFields.push(key)
    }

    // Associate with page progress if mapped to a page
    const pageId = keyToPageId.get(key) || fieldDef.section
    if (pageStats[pageId]) {
      pageStats[pageId].total++
      if (filled) {
        pageStats[pageId].filled++
      }
    }
  }

  const total = applicableFields.length
  const filled = filledFields.length
  const missing = missingFields.length
  const percentage = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0
  const isComplete = total > 0 && filled >= total && percentage === 100

  // Format per-page breakdown
  const pageProgress: Record<string, WorkspacePageProgress> = {}
  for (const [pageId, stat] of Object.entries(pageStats)) {
    const pagePct = stat.total > 0 ? Math.min(100, Math.round((stat.filled / stat.total) * 100)) : 0
    pageProgress[pageId] = {
      pageId,
      total: stat.total,
      filled: stat.filled,
      percentage: pagePct,
      isComplete: stat.total > 0 && stat.filled >= stat.total,
    }
  }

  return {
    total,
    filled,
    missing,
    percentage,
    isComplete,
    applicableFields,
    filledFields,
    missingFields,
    pageProgress,
  }
}
