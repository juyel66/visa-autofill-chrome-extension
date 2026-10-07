import type { SavedApplication, ApplicationFieldValue } from '../core/application/types'
import { getAllSchemaFields, type ApplicationFieldDef } from '../core/application/fieldSchema'
import {
  isFieldApplicable,
  isFieldFilled,
  WORKSPACE_NON_RENDERED_FIELDS,
} from '../core/application/workspaceProgress'

export type SmartFieldStatusType = 'completed' | 'needs_review' | 'not_applicable' | 'incomplete'

export interface SmartFieldStatusInfo {
  status: SmartFieldStatusType
  label: string
  badgeText: string
  icon: string
  badgeColorClass: string
  reviewReason?: string
  confidence?: number | string
}

export interface ManualFieldDefinition {
  /** Unique stable frontend identifier */
  id: string
  /** Canonical field identifier (alias to id) */
  fieldId?: string
  /** Canonical field key if stored in SavedApplication.fields */
  fieldKey?: string
  /** Display label shown in the navigator panel */
  label: string
  /** Section identifier matching sec-<sectionId> or page section */
  sectionId: string
  /** Canonical section identifier (alias to sectionId) */
  section?: string
  /** Display section name */
  sectionName: string
  /** Stable data-field-id attribute */
  dataFieldId: string
  /** Target ref attribute (alias to dataFieldId) */
  targetRef?: string
  /** Primary DOM selector */
  domSelector: string
  /** True if field requires manual entry */
  isManual?: boolean
  /** Exact contextual helper instructions for Guide Me mode */
  helperText?: string
  /** Evaluates whether field is applicable and rendered */
  isApplicable: (application: SavedApplication | null) => boolean
  /** Evaluates whether field is filled with a valid, non-blank value */
  isFilled: (application: SavedApplication | null) => boolean
  /** Optional formatted preview of value */
  getValuePreview?: (application: SavedApplication | null) => string | undefined
  /** Smart status evaluator for this field */
  getStatus?: (application: SavedApplication | null) => SmartFieldStatusInfo
}

export interface ManualFieldStatusItem {
  definition: ManualFieldDefinition
  isFilled: boolean
  status: SmartFieldStatusType
  statusInfo: SmartFieldStatusInfo
  valuePreview?: string
}

export interface ManualFieldsStatusResult {
  all: ManualFieldStatusItem[]
  needsAttention: ManualFieldStatusItem[]
  completed: ManualFieldStatusItem[]
  needsReview: ManualFieldStatusItem[]
  blankManual: ManualFieldStatusItem[]
  blankCount: number
  completedCount: number
  needsReviewCount: number
  totalCount: number
  percentage: number
  remainingCount: number
}

/**
 * Checks whether a given field value is blank:
 * null, undefined, empty string, or whitespace-only string.
 * Boolean values (like false) or 0 are handled according to context.
 */
export function isBlankValue(val: any): boolean {
  if (val === null || val === undefined) return true
  if (typeof val === 'string') return val.trim().length === 0
  return false
}

/**
 * Field aliases where workspace components or extractor may read/store values
 * interchangeably.
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
  'appl.email': ['email'],
  'email': ['appl.email'],
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
  'journeydate': ['appl.journeydate'],
  'appl.journeydate': ['journeydate'],
}

/**
 * Helper to safely extract a non-blank string or boolean from a field key or its aliases.
 */
function getFieldValueWithAliases(
  key: string,
  fields: Record<string, ApplicationFieldValue | undefined>
): any {
  const direct = fields[key]?.value
  if (!isBlankValue(direct)) return direct

  const aliases = FIELD_ALIASES[key]
  if (aliases) {
    for (const alias of aliases) {
      const aliasVal = fields[alias]?.value
      if (!isBlankValue(aliasVal)) return aliasVal
    }
  }

  return direct
}

/**
 * Maps a canonical schema field to its corresponding Workspace section and subsection name.
 */
function getSectionInfoForField(field: ApplicationFieldDef): { sectionId: string; sectionName: string } {
  const key = field.key

  // Passport details subsection in basicDetails
  if (
    key.startsWith('appl.passport_') ||
    key.startsWith('appl.oth_ppt') ||
    key === 'appl.oth_ppt' ||
    key === 'appl.prev_passport_country_issue' ||
    key === 'appl.other_ppt_nationality'
  ) {
    return { sectionId: 'basicDetails', sectionName: 'Passport Details' }
  }

  // Basic Details
  if (field.section === 'basicDetails') {
    return { sectionId: 'basicDetails', sectionName: 'Basic Details' }
  }

  // Present Address
  if (
    key === 'pres_addr1' ||
    key === 'pres_addr2' ||
    key === 'village_town_city' ||
    key === 'district' ||
    key === 'state_province' ||
    key === 'present_country' ||
    key === 'pincode' ||
    key === 'pres_phone' ||
    key === 'isd_code' ||
    key === 'mobile'
  ) {
    return { sectionId: 'familyDetails', sectionName: 'Present Address' }
  }

  // Permanent Address
  if (key.startsWith('perm_') || key.startsWith('permanent_')) {
    return { sectionId: 'familyDetails', sectionName: 'Permanent Address' }
  }

  // Profession / Occupation Details (Matches User Screenshot)
  if (
    key === 'occupation' ||
    key === 'occ_flag' ||
    key === 'empname' ||
    key === 'empdesignation' ||
    key === 'empaddress' ||
    key === 'empphone' ||
    key === 'previous_occupation' ||
    key === 'prev_org' ||
    key.startsWith('previous_')
  ) {
    return { sectionId: 'familyDetails', sectionName: 'Profession Details' }
  }

  // Family Details
  if (
    key.startsWith('father_') ||
    key === 'fthrname' ||
    key.startsWith('mother_') ||
    key === 'marital_status' ||
    key.startsWith('spouse_') ||
    key.startsWith('grandparent_')
  ) {
    return { sectionId: 'familyDetails', sectionName: 'Family Details' }
  }

  // Previous visit / visa
  if (
    key === 'old_visa_flag' ||
    key.startsWith('prv_visit_') ||
    key === 'cities_visited' ||
    key === 'old_visa_no' ||
    key === 'old_visa_type_id' ||
    key === 'oldvisaissueplace' ||
    key === 'oldvisaissuedate' ||
    key === 'refuse_flag' ||
    key === 'refuse_details'
  ) {
    return { sectionId: 'visaDetails', sectionName: 'Previous Visit Visa' }
  }

  // SAARC
  if (key.startsWith('saarc_')) {
    return { sectionId: 'visaDetails', sectionName: 'SAARC Country Visits' }
  }

  // Reference in India / Bangladesh
  if (key.includes('sponsor_')) {
    return { sectionId: 'visaDetails', sectionName: 'Reference Details' }
  }

  // Other information
  if (key === 'country_visited') {
    return { sectionId: 'visaDetails', sectionName: 'Other Information' }
  }

  // Visa Details
  if (field.section === 'visaDetails') {
    return { sectionId: 'visaDetails', sectionName: 'Visa Details' }
  }

  // Additional questions
  if (field.section === 'additionalQuestions') {
    return { sectionId: 'additionalQuestions', sectionName: 'Additional Questions' }
  }

  // Registration
  if (field.section === 'registration') {
    return { sectionId: 'registration', sectionName: 'Registration' }
  }

  return { sectionId: field.section || 'basicDetails', sectionName: field.subsection || 'Workspace Form' }
}

export function getHelperTextForField(key: string, label: string): string {
  switch (key) {
    case 'appl.email':
      return 'Please enter your email address.'
    case 'appl.email_re':
      return 'Please re-enter your email address to confirm.'
    case 'appl.journeydate':
    case 'journeydate':
      return 'Please enter your expected date of arrival in India (DD/MM/YYYY).'
    case 'purpose':
    case 'appl.purpose':
      return 'Please select the primary purpose of your visit.'
    case 'duration':
      return 'Please enter the expected duration of visa in months.'
    case 'visa_entry_id':
      return 'Please select the required number of entries (Single, Double, Multiple).'
    case 'entrypoint':
    case 'appl.entrypoint':
      return 'Please select your intended port of arrival in India.'
    case 'exitpoint':
    case 'appl.exitpoint':
      return 'Please select your intended port of exit from India.'
    case 'occupation':
      return 'Please select or enter your current occupation.'
    case 'empname':
      return 'Please enter your employer or business name.'
    case 'empdesignation':
      return 'Please enter your designation or job title.'
    case 'empaddress':
      return 'Please enter your employer or business address.'
    case 'empphone':
      return 'Please enter your employer phone number.'
    case 'previous_occupation':
      return 'Please select your previous occupation if applicable.'
    case 'prev_org':
      return 'Please indicate if you previously served in military, police, or security organization.'
    case 'previous_organization':
      return 'Please enter the name of the military/security organization.'
    case 'previous_designation':
      return 'Please enter your designation in the military/security organization.'
    case 'previous_rank':
      return 'Please enter your rank in the military/security organization.'
    case 'previous_posting':
      return 'Please enter your place of posting.'
    case 'applicant-photo':
      return 'Please upload a square passport photo of the applicant.'
    case 'captcha':
      return 'Please enter the characters shown in the security image.'
    case 'pres_addr1':
      return 'Please enter house number and street name for your present address.'
    case 'pres_addr2':
    case 'village_town_city':
      return 'Please enter your village, town, or city.'
    case 'district':
      return 'Please enter your district.'
    case 'state_province':
      return 'Please enter your state or province.'
    case 'pincode':
      return 'Please enter your postal/PIN code.'
    case 'pres_phone':
      return 'Please enter your present contact phone number.'
    case 'mobile':
      return 'Please enter your mobile phone number.'
    case 'perm_add1':
      return 'Please enter house number and street name for your permanent address.'
    case 'perm_add2':
    case 'permanent_village_town_city':
      return 'Please enter your permanent village, town, or city.'
    case 'permanent_district':
      return 'Please enter your permanent district.'
    case 'permanent_state_province':
      return 'Please enter your permanent state or province.'
    case 'permanent_postal_code':
      return 'Please enter your permanent postal code.'
    case 'fthrname':
      return "Please enter your father's full name."
    case 'father_nationality':
      return "Please select your father's nationality."
    case 'father_prev_nationality':
      return "Please select your father's previous nationality if different."
    case 'father_place_of_birth':
      return "Please enter your father's place of birth."
    case 'father_country_of_birth':
      return "Please select your father's country of birth."
    case 'mother_name':
      return "Please enter your mother's full name."
    case 'mother_nationality':
      return "Please select your mother's nationality."
    case 'mother_prev_nationality':
      return "Please select your mother's previous nationality if different."
    case 'mother_place_of_birth':
      return "Please enter your mother's place of birth."
    case 'mother_country_of_birth':
      return "Please select your mother's country of birth."
    case 'marital_status':
      return 'Please select your marital status.'
    case 'spouse_name':
      return "Please enter your spouse's full name."
    case 'spouse_nationality':
      return "Please select your spouse's nationality."
    case 'spouse_prev_nationality':
      return "Please select your spouse's previous nationality if different."
    case 'spouse_place_of_birth':
      return "Please enter your spouse's place of birth."
    case 'spouse_country_of_birth':
      return "Please select your spouse's country of birth."
    case 'grandparent_flag':
      return 'Please indicate if your parents or grandparents had Pakistan nationality.'
    case 'grandparent_details':
      return 'Please provide details of Pakistan nationality of parents/grandparents.'
    case 'nameofsponsor_ind':
      return 'Please enter reference person or hotel name in India.'
    case 'add1ofsponsor_ind':
      return 'Please enter reference address in India.'
    case 'phoneofsponsor_ind':
      return 'Please enter reference contact phone in India.'
    case 'nameofsponsor_msn':
      return 'Please enter reference name in your home country.'
    case 'add1ofsponsor_msn':
      return 'Please enter reference address in your home country.'
    case 'phoneofsponsor_msn':
      return 'Please enter reference contact phone in your home country.'
    case 'old_visa_flag':
      return 'Please indicate whether you have visited India previously.'
    case 'old_visa_no':
      return 'Please enter your previous Indian visa number.'
    case 'old_visa_type_id':
      return 'Please select the type of your previous Indian visa.'
    case 'oldvisaissueplace':
      return 'Please enter the place where your previous visa was issued.'
    case 'oldvisaissuedate':
      return 'Please enter the issue date of your previous visa (DD/MM/YYYY).'
    case 'cities_visited':
      return 'Please enter cities visited in India during your previous trip.'
    case 'refuse_flag':
    case 'appl.refuse_flag':
      return 'Please indicate if you have ever been refused an Indian visa.'
    case 'refuse_details':
      return 'Please provide details of refusal including control number and date.'
    case 'saarc_flag':
      return 'Please indicate if you visited any SAARC countries in the last 3 years.'
    case 'saarc_details':
      return 'Please list SAARC countries visited, year of visit, and number of visits.'
    case 'country_visited':
      return 'Please enter any other countries visited in the last 10 years, or NA.'
    default:
      if (key.startsWith('question_') && key.endsWith('_flag')) {
        return 'Please answer the statutory declaration question.'
      }
      if (key.startsWith('answer_')) {
        return 'Please provide explanation and details for your answer.'
      }
      return `Please enter or select ${label}.`
  }
}

/**
 * Computes live smart field status:
 * 🟢 Completed: valid value present, no conflict or low confidence
 * 🟡 Needs Review: conflict, low confidence, or existing review state
 * ⚪ Not Applicable: conditionally hidden or non-applicable
 * ⚪ Incomplete: applicable but blank
 */
export function getFieldSmartStatus(
  fieldDefOrKey: ManualFieldDefinition | string,
  application: SavedApplication | null
): SmartFieldStatusInfo {
  const def =
    typeof fieldDefOrKey === 'string'
      ? MANUAL_FIELDS_REGISTRY.find((f) => f.id === fieldDefOrKey || f.fieldKey === fieldDefOrKey)
      : fieldDefOrKey

  const key = typeof fieldDefOrKey === 'string' ? fieldDefOrKey : (fieldDefOrKey.fieldKey || fieldDefOrKey.id)

  // 1. Not Applicable check
  if (def && !def.isApplicable(application)) {
    return {
      status: 'not_applicable',
      label: 'Not Applicable',
      badgeText: '— Not Applicable',
      icon: '⚪',
      badgeColorClass: 'bg-slate-800 text-slate-400 border-slate-700',
    }
  }

  // 2. Needs Review check based on existing metadata
  const fieldVal = application?.fields
    ? application.fields[key] ||
      (FIELD_ALIASES[key]?.map((k) => application.fields[k]).find(Boolean))
    : undefined

  let isReview = false
  let reviewReason = ''

  if (fieldVal?.hasConflict) {
    isReview = true
    reviewReason = fieldVal.conflictDetails || 'Conflicting values between documents'
  } else if (
    fieldVal?.confidence === 'low' ||
    (typeof fieldVal?.confidence === 'number' && fieldVal.confidence < 0.7)
  ) {
    isReview = true
    reviewReason = 'Low OCR confidence - review recommended'
  } else if ((key === 'religion' || key === 'appl.religion') && application?.religionMetadata?.religionConflict) {
    isReview = true
    reviewReason = application?.religionMetadata?.conflictDetails || 'Religion conflict detected'
  }

  if (isReview) {
    return {
      status: 'needs_review',
      label: 'Needs Review',
      badgeText: '⚠ Needs Review',
      icon: '🟡',
      badgeColorClass: 'bg-amber-950/80 text-amber-300 border-amber-600/70',
      reviewReason,
      confidence: fieldVal?.confidence,
    }
  }

  // 3. Completed check
  const isFilled = def ? def.isFilled(application) : isFieldFilled(fieldVal)
  if (isFilled) {
    return {
      status: 'completed',
      label: 'Completed',
      badgeText: '✓ Completed',
      icon: '🟢',
      badgeColorClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/70',
    }
  }

  // 4. Incomplete
  return {
    status: 'incomplete',
    label: 'Incomplete',
    badgeText: '⚠ Incomplete',
    icon: '⚪',
    badgeColorClass: 'bg-slate-800 text-slate-400 border-slate-700',
  }
}

/**
 * Builds the comprehensive manual fields registry by combining:
 * 1. All unique applicable schema fields from getAllSchemaFields()
 * 2. Special workspace items (Applicant Photo, CAPTCHA)
 */
function buildComprehensiveManualFieldsRegistry(): ManualFieldDefinition[] {
  const schemaFields = getAllSchemaFields()
  const registry: ManualFieldDefinition[] = []
  const seenKeys = new Set<string>()

  // Special item: Applicant Photo
  registry.push({
    id: 'applicant-photo',
    fieldId: 'applicant-photo',
    label: 'Applicant Photo',
    sectionId: 'visaDetails',
    section: 'visaDetails',
    sectionName: 'Applicant Photo',
    dataFieldId: 'applicant-photo',
    targetRef: 'applicant-photo',
    domSelector: '[data-field-id="applicant-photo"], #applicant-photo-editor, #sec-photoUpload',
    isManual: true,
    helperText: 'Please upload a square passport photo of the applicant.',
    isApplicable: () => true,
    isFilled: (app) => Boolean(app?.photograph?.dataUrl || (app?.photograph as any)?.backendPhotoUrl),
    getValuePreview: (app) =>
      app?.photograph?.fileName || (app?.photograph?.dataUrl ? 'Photo attached' : undefined),
    getStatus: (app) => getFieldSmartStatus('applicant-photo', app),
  })

  // Iterate schema fields
  for (const field of schemaFields) {
    const key = field.key

    // Exclude non-rendered legacy schema fields
    if (WORKSPACE_NON_RENDERED_FIELDS.has(key)) {
      continue
    }

    // Exclude duplicate occurrences of the same key across multiple schema pages
    if (seenKeys.has(key)) {
      continue
    }
    seenKeys.add(key)

    const { sectionId, sectionName } = getSectionInfoForField(field)

    // Check if this field has custom filled/preview logic
    let isFilledFn: (app: SavedApplication | null) => boolean
    let previewFn: ((app: SavedApplication | null) => string | undefined) | undefined

    if (key === 'duration') {
      isFilledFn = (app) => {
        const val = String(app?.fields['duration']?.value ?? '').trim()
        return val !== '' && val !== '0'
      }
      previewFn = (app) => {
        const val = String(app?.fields['duration']?.value ?? '').trim()
        return val && val !== '0' ? `${val} Months` : undefined
      }
    } else if (key.startsWith('question_') && key.endsWith('_flag')) {
      const qNum = key.replace('question_', '').replace('_flag', '')
      isFilledFn = (app) => {
        const flag = String(app?.fields[key]?.value ?? '').trim().toLowerCase()
        if (!flag) return false
        if (flag === 'no') return true
        if (flag === 'yes') {
          return String(app?.fields[`answer_${qNum}`]?.value ?? '').trim().length > 0
        }
        return false
      }
      previewFn = (app) => {
        const flag = String(app?.fields[key]?.value ?? '').trim().toLowerCase()
        if (!flag) return undefined
        if (flag === 'no') return 'No'
        if (flag === 'yes') {
          const ans = String(app?.fields[`answer_${qNum}`]?.value ?? '').trim()
          return ans ? `Yes (${ans.substring(0, 15)}...)` : 'Yes (Details required)'
        }
        return undefined
      }
    } else {
      isFilledFn = (app) => {
        if (!app?.fields) return false
        const val = getFieldValueWithAliases(key, app.fields)
        return isFieldFilled(val)
      }
      previewFn = (app) => {
        if (!app?.fields) return undefined
        const val = getFieldValueWithAliases(key, app.fields)
        if (typeof val === 'string' && val.trim().length > 0) return val.trim()
        if (typeof val === 'boolean') return val ? 'Yes' : 'No'
        return undefined
      }
    }

    registry.push({
      id: key,
      fieldId: key,
      fieldKey: key,
      label: field.label,
      sectionId,
      section: sectionId,
      sectionName,
      dataFieldId: key,
      targetRef: key,
      domSelector: `[data-field-id="${key}"], [name="${key}"], [id="${key}"]`,
      isManual: true,
      helperText: getHelperTextForField(key, field.label),
      isApplicable: (app) => isFieldApplicable(key, app?.fields || {}, false),
      isFilled: isFilledFn,
      getValuePreview: previewFn,
      getStatus: (app) => getFieldSmartStatus(key, app),
    })
  }

  // Special item: CAPTCHA (conditional on presence in DOM)
  registry.push({
    id: 'captcha',
    fieldId: 'captcha',
    label: 'CAPTCHA',
    sectionId: 'registration',
    section: 'registration',
    sectionName: 'Registration',
    dataFieldId: 'captcha',
    targetRef: 'captcha',
    domSelector: '[data-field-id="captcha"], #captcha',
    isManual: true,
    helperText: 'Please enter the characters shown in the security image.',
    isApplicable: () =>
      typeof document !== 'undefined' &&
      Boolean(document.querySelector('[data-field-id="captcha"], #captcha')),
    isFilled: () => {
      if (typeof document === 'undefined') return false
      const el = document.querySelector<HTMLInputElement>('[data-field-id="captcha"], #captcha')
      return Boolean(el && el.value && el.value.trim().length > 0)
    },
    getStatus: (app) => getFieldSmartStatus('captcha', app),
  })

  return registry
}

export const MANUAL_FIELDS_REGISTRY: ManualFieldDefinition[] = buildComprehensiveManualFieldsRegistry()

/**
 * Evaluates live status for every applicable manual field in the Workspace.
 * Returns both 'needsAttention' (blank) and 'completed' items,
 * along with Smart Field Status classification and completion metrics.
 */
export function getManualFieldsStatus(application: SavedApplication | null): ManualFieldsStatusResult {
  const applicableFields = MANUAL_FIELDS_REGISTRY.filter((def) => def.isApplicable(application))

  const all: ManualFieldStatusItem[] = applicableFields.map((definition) => {
    const filled = definition.isFilled(application)
    const statusInfo = getFieldSmartStatus(definition, application)
    const valuePreview = definition.getValuePreview ? definition.getValuePreview(application) : undefined
    return {
      definition,
      isFilled: filled,
      status: statusInfo.status,
      statusInfo,
      valuePreview,
    }
  })

  const blankManual = all.filter((item) => !item.isFilled)
  const needsReview = all.filter((item) => item.status === 'needs_review')
  const completed = all.filter((item) => item.isFilled)

  // Prioritize blank fields first, then review items
  const needsAttentionMap = new Map<string, ManualFieldStatusItem>()
  blankManual.forEach((item) => needsAttentionMap.set(item.definition.id, item))
  needsReview.forEach((item) => {
    if (!needsAttentionMap.has(item.definition.id)) {
      needsAttentionMap.set(item.definition.id, item)
    }
  })
  const needsAttention = Array.from(needsAttentionMap.values())

  const totalCount = all.length
  const completedCount = completed.length
  const blankCount = blankManual.length
  const percentage = totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0

  return {
    all,
    needsAttention,
    completed,
    needsReview,
    blankManual,
    blankCount,
    completedCount,
    needsReviewCount: needsReview.length,
    totalCount,
    percentage,
    remainingCount: Math.max(0, totalCount - completedCount),
  }
}

/**
 * Currently active manual entry target field ID.
 * Exactly one field can have the active attention animation at a time.
 */
let currentActiveTargetId: string | null = null

type ActiveTargetListener = (fieldId: string | null) => void
const activeTargetListeners = new Set<ActiveTargetListener>()

/**
 * Subscribes to changes to the currently active target field ID.
 * Returns an unsubscribe cleanup function.
 */
export function onActiveTargetChange(listener: ActiveTargetListener): () => void {
  activeTargetListeners.add(listener)
  return () => {
    activeTargetListeners.delete(listener)
  }
}

function notifyActiveTargetChanged(fieldId: string | null): void {
  activeTargetListeners.forEach((fn) => {
    try {
      fn(fieldId)
    } catch {
      // safe fallback
    }
  })
}

export function getActiveTargetFieldId(): string | null {
  return currentActiveTargetId
}

/**
 * Clears the active yellow attention animation from all fields.
 */
export function clearActiveManualFieldHighlight(notify = true): void {
  currentActiveTargetId = null
  if (typeof document !== 'undefined') {
    const existing = document.querySelectorAll('.manual-entry-active-target')
    existing.forEach((el) => {
      el.classList.remove('manual-entry-active-target')
    })
  }
  if (notify) {
    notifyActiveTargetChanged(null)
  }
}

/**
 * Sets the active manual entry target field ID, removing highlight
 * from previous targets and adding it to the new target element.
 */
export function setActiveManualFieldHighlight(fieldId: string | null): void {
  clearActiveManualFieldHighlight(false)
  currentActiveTargetId = fieldId
  if (!fieldId || typeof document === 'undefined') {
    notifyActiveTargetChanged(null)
    return
  }

  const def = MANUAL_FIELDS_REGISTRY.find((f) => f.id === fieldId)
  if (!def) {
    notifyActiveTargetChanged(fieldId)
    return
  }

  const el =
    document.querySelector<HTMLElement>(`[data-field-id="${def.dataFieldId}"]`) ||
    (def.domSelector ? document.querySelector<HTMLElement>(def.domSelector) : null) ||
    document.getElementById(def.id)

  if (el) {
    const focusable = el.matches('input, select, textarea')
      ? el
      : el.querySelector<HTMLElement>('input, select, textarea')
    const highlightEl = focusable || el
    highlightEl.classList.add('manual-entry-active-target')
  }

  notifyActiveTargetChanged(fieldId)
}

/**
 * Checks if the currently active target field has been populated/filled.
 * If filled, immediately removes the yellow attention animation and resets target.
 */
export function checkAndClearActiveTargetIfFilled(application: SavedApplication | null): void {
  if (!currentActiveTargetId) return
  const def = MANUAL_FIELDS_REGISTRY.find((f) => f.id === currentActiveTargetId)
  if (!def || def.isFilled(application)) {
    clearActiveManualFieldHighlight()
  }
}

/**
 * Resolves any DOM element (e.g. clicked/focused in workspace) to its
 * corresponding ManualFieldDefinition in the canonical registry.
 */
export function findManualFieldByElement(el: HTMLElement | null): ManualFieldDefinition | null {
  if (!el || typeof document === 'undefined') return null

  // Ignore clicks inside manual fields navigator popover or trigger button
  if (
    el.closest('#manual-fields-nav-button') ||
    el.closest('[data-field-id="manual-fields-navigator-button"]') ||
    el.closest('[role="dialog"]')
  ) {
    return null
  }

  // 1. Check data-field-id on element or ancestor
  const dataFieldIdEl = el.closest<HTMLElement>('[data-field-id]')
  if (dataFieldIdEl) {
    const dfId = dataFieldIdEl.getAttribute('data-field-id')
    if (dfId && dfId !== 'manual-fields-navigator-button') {
      const match = MANUAL_FIELDS_REGISTRY.find(
        (f) => f.id === dfId || f.dataFieldId === dfId || f.fieldKey === dfId
      )
      if (match) return match
    }
  }

  // 2. Check name attribute
  const nameEl = el.closest<HTMLElement>('[name]')
  if (nameEl) {
    const name = nameEl.getAttribute('name')
    if (name) {
      const match = MANUAL_FIELDS_REGISTRY.find(
        (f) => f.id === name || f.fieldKey === name || f.dataFieldId === name
      )
      if (match) return match
    }
  }

  // 3. Check id attribute
  if (el.id) {
    const match = MANUAL_FIELDS_REGISTRY.find(
      (f) => f.id === el.id || f.fieldKey === el.id || f.dataFieldId === el.id
    )
    if (match) return match
  }

  return null
}

// Global browser listeners: when user clicks or focuses any field in the workspace,
// synchronize it as the active field so both the workspace form and manual modal stay active
if (typeof document !== 'undefined') {
  const handleWorkspaceFieldInteraction = (e: Event) => {
    const target = e.target as HTMLElement | null
    if (!target) return

    // Ignore clicks inside manual fields navigator popover or trigger button
    if (
      target.closest('#manual-fields-nav-button') ||
      target.closest('[data-field-id="manual-fields-navigator-button"]') ||
      target.closest('[role="dialog"]')
    ) {
      return
    }

    // Only inspect form inputs/selects/textareas or elements with field markers
    if (
      !target.matches('input, select, textarea, [data-field-id]') &&
      !target.closest('input, select, textarea, [data-field-id]')
    ) {
      return
    }

    const fieldDef = findManualFieldByElement(target)
    if (fieldDef && fieldDef.id !== currentActiveTargetId) {
      setActiveManualFieldHighlight(fieldDef.id)
    }
  }

  document.addEventListener('focusin', handleWorkspaceFieldInteraction, true)
  document.addEventListener('click', handleWorkspaceFieldInteraction, true)
}

/**
 * Navigates smoothly to the exact manual field in the Workspace:
 * 1. Expands target section / tab if needed
 * 2. Smoothly scrolls exact field into view (block: 'center')
 * 3. Focuses input/select/textarea
 * 4. Activates yellow attention animation on the target field
 */
export function navigateToManualField(
  field: ManualFieldDefinition,
  options?: {
    onExpandSection?: (sectionId: string) => void
  }
): boolean {
  if (typeof document === 'undefined') return false

  // Set this field as the single active targeted field (removes from any previous)
  setActiveManualFieldHighlight(field.id)

  // 1. Trigger section expansion callback if provided
  if (options?.onExpandSection) {
    options.onExpandSection(field.sectionId)
  }

  // Check section DOM element
  const sectionEl =
    document.getElementById(`sec-${field.sectionId}`) ||
    document.getElementById(field.sectionId) ||
    document.getElementById(`sec-${field.sectionId.toLowerCase()}`)

  if (sectionEl) {
    if (sectionEl.hasAttribute('hidden')) {
      sectionEl.removeAttribute('hidden')
    }
    const detailsParent = sectionEl.closest('details')
    if (detailsParent && !detailsParent.open) {
      detailsParent.open = true
    }
  }

  // 2. Locate exact target element
  const locateTarget = (): HTMLElement | null => {
    let el = document.querySelector<HTMLElement>(`[data-field-id="${field.dataFieldId}"]`)
    if (!el && field.domSelector) {
      try {
        el = document.querySelector<HTMLElement>(field.domSelector)
      } catch {
        // Safe fallback if selector had invalid characters
      }
    }
    if (!el && field.id) {
      el = document.getElementById(field.id)
    }
    if (!el && field.fieldKey) {
      el = document.querySelector<HTMLElement>(`[name="${field.fieldKey}"]`) || document.getElementById(field.fieldKey)
    }
    return el
  }

  const applyNavigation = (target: HTMLElement | null) => {
    if (!target) {
      // Fallback: scroll section into view
      if (sectionEl) {
        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return false
    }

    // Check if target is inside a closed details accordion
    const targetDetails = target.closest('details')
    if (targetDetails && !targetDetails.open) {
      targetDetails.open = true
    }

    // Smoothly scroll exact field into view centered in viewport
    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch {
      target.scrollIntoView()
    }

    // Focus input/select/textarea/button if appropriate
    const focusable = target.matches('input, select, textarea, button')
      ? target
      : target.querySelector<HTMLElement>('input, select, textarea, button')

    if (focusable) {
      try {
        focusable.focus({ preventScroll: true })
      } catch {
        focusable.focus()
      }
    }

    // Ensure yellow attention animation is applied to target
    target.classList.add('manual-entry-active-target')

    // Also trigger initial pulse class
    target.classList.remove('manual-field-highlight')
    void target.offsetWidth
    target.classList.add('manual-field-highlight')

    setTimeout(() => {
      target?.classList.remove('manual-field-highlight')
    }, 1800)

    return true
  }

  const targetEl = locateTarget()
  if (targetEl) {
    return applyNavigation(targetEl)
  }

  // If element not rendered yet due to pending state update, retry in next frame
  setTimeout(() => {
    const delayedTarget = locateTarget()
    applyNavigation(delayedTarget)
  }, 100)

  return true
}
