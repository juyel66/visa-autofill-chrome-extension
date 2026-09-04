import type { IndiaVisaFieldMapping } from '../../mapping.types'
import { BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS } from '../../selectors/bangladesh/additionalQuestions'

/**
 * Field mappings for Bangladesh Indian Visa Portal - Additional Questions page (/visa/AdditionalQuestions)
 * Canonical Page Identity: 'ADDITIONAL_QUESTIONS'
 */
export const BANGLADESH_ADDITIONAL_QUESTIONS_MAPPINGS: IndiaVisaFieldMapping[] = [
  {
    id: 'bd_q_declaration',
    section: 'declaration',
    targetField: 'verifyQuestions',
    sourceType: 'manual',
    selector: BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS.declarationCheckbox,
    inputType: 'checkbox',
    status: 'manual-required',
    required: true,
    page: 'ADDITIONAL_QUESTIONS',
    notes: 'Declaration checkbox requires manual applicant confirmation.',
  },
]
