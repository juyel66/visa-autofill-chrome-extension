import type { IndiaVisaFieldMapping } from '../../mapping.types'
import { BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS } from '../../selectors/bangladesh/additionalQuestions'

/**
 * Field mappings for Bangladesh Indian Visa Portal - Additional Questions page (/visa/AdditionalQuestions)
 * Canonical Page Identity: 'ADDITIONAL_QUESTIONS'
 */
export const BANGLADESH_ADDITIONAL_QUESTIONS_MAPPINGS: IndiaVisaFieldMapping[] = [
  // Question 1
  {
    id: 'bd_q1_flag',
    section: 'additional-questions',
    targetField: 'question_1_flag',
    sourceField: 'additionalQuestions.question1.flag',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS.question1Flag,
    inputType: 'radio',
    status: 'verified',
    required: false,
    page: 'ADDITIONAL_QUESTIONS',
  },
  {
    id: 'bd_q1_ans',
    section: 'additional-questions',
    targetField: 'answer_1',
    sourceField: 'additionalQuestions.question1.details',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS.answer1,
    inputType: 'textarea',
    status: 'verified',
    required: false,
    page: 'ADDITIONAL_QUESTIONS',
  },

  // Question 2
  {
    id: 'bd_q2_flag',
    section: 'additional-questions',
    targetField: 'question_2_flag',
    sourceField: 'additionalQuestions.question2.flag',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS.question2Flag,
    inputType: 'radio',
    status: 'verified',
    required: false,
    page: 'ADDITIONAL_QUESTIONS',
  },
  {
    id: 'bd_q2_ans',
    section: 'additional-questions',
    targetField: 'answer_2',
    sourceField: 'additionalQuestions.question2.details',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS.answer2,
    inputType: 'textarea',
    status: 'verified',
    required: false,
    page: 'ADDITIONAL_QUESTIONS',
  },

  // Question 3
  {
    id: 'bd_q3_flag',
    section: 'additional-questions',
    targetField: 'question_3_flag',
    sourceField: 'additionalQuestions.question3.flag',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS.question3Flag,
    inputType: 'radio',
    status: 'verified',
    required: false,
    page: 'ADDITIONAL_QUESTIONS',
  },
  {
    id: 'bd_q3_ans',
    section: 'additional-questions',
    targetField: 'answer_3',
    sourceField: 'additionalQuestions.question3.details',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS.answer3,
    inputType: 'textarea',
    status: 'verified',
    required: false,
    page: 'ADDITIONAL_QUESTIONS',
  },

  // Question 4
  {
    id: 'bd_q4_flag',
    section: 'additional-questions',
    targetField: 'question_4_flag',
    sourceField: 'additionalQuestions.question4.flag',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS.question4Flag,
    inputType: 'radio',
    status: 'verified',
    required: false,
    page: 'ADDITIONAL_QUESTIONS',
  },
  {
    id: 'bd_q4_ans',
    section: 'additional-questions',
    targetField: 'answer_4',
    sourceField: 'additionalQuestions.question4.details',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS.answer4,
    inputType: 'textarea',
    status: 'verified',
    required: false,
    page: 'ADDITIONAL_QUESTIONS',
  },

  // Question 5
  {
    id: 'bd_q5_flag',
    section: 'additional-questions',
    targetField: 'question_5_flag',
    sourceField: 'additionalQuestions.question5.flag',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS.question5Flag,
    inputType: 'radio',
    status: 'verified',
    required: false,
    page: 'ADDITIONAL_QUESTIONS',
  },
  {
    id: 'bd_q5_ans',
    section: 'additional-questions',
    targetField: 'answer_5',
    sourceField: 'additionalQuestions.question5.details',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS.answer5,
    inputType: 'textarea',
    status: 'verified',
    required: false,
    page: 'ADDITIONAL_QUESTIONS',
  },

  // Question 6
  {
    id: 'bd_q6_flag',
    section: 'additional-questions',
    targetField: 'question_6_flag',
    sourceField: 'additionalQuestions.question6.flag',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS.question6Flag,
    inputType: 'radio',
    status: 'verified',
    required: false,
    page: 'ADDITIONAL_QUESTIONS',
  },
  {
    id: 'bd_q6_ans',
    section: 'additional-questions',
    targetField: 'answer_6',
    sourceField: 'additionalQuestions.question6.details',
    sourceType: 'confirmed-document',
    selector: BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS.answer6,
    inputType: 'textarea',
    status: 'verified',
    required: false,
    page: 'ADDITIONAL_QUESTIONS',
  },

  // Statutory Declaration (Must remain manual)
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
    notes: 'Declaration checkbox requires manual applicant confirmation. Never automated.',
  },
]

