import type { IndiaFieldSelector } from '../../mapping.types'

/**
 * Bangladesh Indian Visa Portal (https://indianvisa-bangladesh.nic.in/)
 * Page: /visa/AdditionalQuestions (Canonical Page: ADDITIONAL_QUESTIONS)
 * 
 * Verified DOM selectors provided from live Bangladesh portal DOM evidence.
 */
export interface BangladeshAdditionalQuestionsSelectors {
  question1Flag: IndiaFieldSelector[]
  question1Yes: IndiaFieldSelector[]
  question1No: IndiaFieldSelector[]
  answer1: IndiaFieldSelector[]
  question2Flag: IndiaFieldSelector[]
  question2Yes: IndiaFieldSelector[]
  question2No: IndiaFieldSelector[]
  answer2: IndiaFieldSelector[]
  question3Flag: IndiaFieldSelector[]
  question3Yes: IndiaFieldSelector[]
  question3No: IndiaFieldSelector[]
  answer3: IndiaFieldSelector[]
  question4Flag: IndiaFieldSelector[]
  question4Yes: IndiaFieldSelector[]
  question4No: IndiaFieldSelector[]
  answer4: IndiaFieldSelector[]
  question5Flag: IndiaFieldSelector[]
  question5Yes: IndiaFieldSelector[]
  question5No: IndiaFieldSelector[]
  answer5: IndiaFieldSelector[]
  question6Flag: IndiaFieldSelector[]
  question6Yes: IndiaFieldSelector[]
  question6No: IndiaFieldSelector[]
  answer6: IndiaFieldSelector[]
  declarationCheckbox: IndiaFieldSelector[]
  submitContinue: IndiaFieldSelector[]
  submitExit: IndiaFieldSelector[]
}

export const BANGLADESH_ADDITIONAL_QUESTIONS_SELECTORS: BangladeshAdditionalQuestionsSelectors = {
  question1Flag: [
    { strategy: 'name', value: 'question_1_flag' },
    { strategy: 'id', value: 'question_yes_1' },
    { strategy: 'id', value: 'question_no_1' },
    { strategy: 'css', value: 'input[name="question_1_flag"], input#question_yes_1, input#question_no_1' },
  ],
  question1Yes: [{ strategy: 'id', value: 'question_yes_1' }, { strategy: 'css', value: 'input#question_yes_1' }],
  question1No: [{ strategy: 'id', value: 'question_no_1' }, { strategy: 'css', value: 'input#question_no_1' }],
  answer1: [{ strategy: 'id', value: 'answer_1' }, { strategy: 'name', value: 'answer_1' }, { strategy: 'css', value: 'input#answer_1, textarea#answer_1, textarea[name="answer_1"]' }],
  question2Flag: [
    { strategy: 'name', value: 'question_2_flag' },
    { strategy: 'id', value: 'question_yes_2' },
    { strategy: 'id', value: 'question_no_2' },
    { strategy: 'css', value: 'input[name="question_2_flag"], input#question_yes_2, input#question_no_2' },
  ],
  question2Yes: [{ strategy: 'id', value: 'question_yes_2' }, { strategy: 'css', value: 'input#question_yes_2' }],
  question2No: [{ strategy: 'id', value: 'question_no_2' }, { strategy: 'css', value: 'input#question_no_2' }],
  answer2: [{ strategy: 'id', value: 'answer_2' }, { strategy: 'name', value: 'answer_2' }, { strategy: 'css', value: 'input#answer_2, textarea#answer_2, textarea[name="answer_2"]' }],
  question3Flag: [
    { strategy: 'name', value: 'question_3_flag' },
    { strategy: 'id', value: 'question_yes_3' },
    { strategy: 'id', value: 'question_no_3' },
    { strategy: 'css', value: 'input[name="question_3_flag"], input#question_yes_3, input#question_no_3' },
  ],
  question3Yes: [{ strategy: 'id', value: 'question_yes_3' }, { strategy: 'css', value: 'input#question_yes_3' }],
  question3No: [{ strategy: 'id', value: 'question_no_3' }, { strategy: 'css', value: 'input#question_no_3' }],
  answer3: [{ strategy: 'id', value: 'answer_3' }, { strategy: 'name', value: 'answer_3' }, { strategy: 'css', value: 'input#answer_3, textarea#answer_3, textarea[name="answer_3"]' }],
  question4Flag: [
    { strategy: 'name', value: 'question_4_flag' },
    { strategy: 'id', value: 'question_yes_4' },
    { strategy: 'id', value: 'question_no_4' },
    { strategy: 'css', value: 'input[name="question_4_flag"], input#question_yes_4, input#question_no_4' },
  ],
  question4Yes: [{ strategy: 'id', value: 'question_yes_4' }, { strategy: 'css', value: 'input#question_yes_4' }],
  question4No: [{ strategy: 'id', value: 'question_no_4' }, { strategy: 'css', value: 'input#question_no_4' }],
  answer4: [{ strategy: 'id', value: 'answer_4' }, { strategy: 'name', value: 'answer_4' }, { strategy: 'css', value: 'input#answer_4, textarea#answer_4, textarea[name="answer_4"]' }],
  question5Flag: [
    { strategy: 'name', value: 'question_5_flag' },
    { strategy: 'id', value: 'question_yes_5' },
    { strategy: 'id', value: 'question_no_5' },
    { strategy: 'css', value: 'input[name="question_5_flag"], input#question_yes_5, input#question_no_5' },
  ],
  question5Yes: [{ strategy: 'id', value: 'question_yes_5' }, { strategy: 'css', value: 'input#question_yes_5' }],
  question5No: [{ strategy: 'id', value: 'question_no_5' }, { strategy: 'css', value: 'input#question_no_5' }],
  answer5: [{ strategy: 'id', value: 'answer_5' }, { strategy: 'name', value: 'answer_5' }, { strategy: 'css', value: 'input#answer_5, textarea#answer_5, textarea[name="answer_5"]' }],
  question6Flag: [
    { strategy: 'name', value: 'question_6_flag' },
    { strategy: 'id', value: 'question_yes_6' },
    { strategy: 'id', value: 'question_no_6' },
    { strategy: 'css', value: 'input[name="question_6_flag"], input#question_yes_6, input#question_no_6' },
  ],
  question6Yes: [{ strategy: 'id', value: 'question_yes_6' }, { strategy: 'css', value: 'input#question_yes_6' }],
  question6No: [{ strategy: 'id', value: 'question_no_6' }, { strategy: 'css', value: 'input#question_no_6' }],
  answer6: [{ strategy: 'id', value: 'answer_6' }, { strategy: 'name', value: 'answer_6' }, { strategy: 'css', value: 'input#answer_6, textarea#answer_6, textarea[name="answer_6"]' }],
  declarationCheckbox: [{ strategy: 'id', value: 'verifyQuestions' }, { strategy: 'name', value: 'verifyQuestions' }, { strategy: 'css', value: 'input#verifyQuestions' }],
  submitContinue: [{ strategy: 'id', value: 'continue' }, { strategy: 'css', value: 'input#continue, button#continue' }],
  submitExit: [{ strategy: 'id', value: 'exit' }, { strategy: 'css', value: 'input#exit, button#exit' }],
}

