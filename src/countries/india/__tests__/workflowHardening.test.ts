import { detectIndiaVisaPage } from '../detector'
import { createInitialWorkflowState } from '../../../core/workflow'
import { executeAutofill } from '../../../core/autofill/autofillEngine'
import { executeUndo } from '../../../core/safety/undoManager'
import type { FieldMapping } from '../../../core/autofill/types'
import type { AutofillOperation } from '../../../core/safety/types'
import type { ApplicantProfile } from '../../../core/applicant/types'

export interface WorkflowTestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runWorkflowHardeningTests(): Promise<WorkflowTestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  // Mock applicant profile
  const mockApplicant = {
    applicantId: 'app_test_123',
    personalInfo: {
      surname: 'APPLICANT',
      givenNames: 'TESTER',
      dateOfBirth: '1995-01-15',
      nationality: 'USA',
    },
    passport: {
      passportNumber: 'TEST000000',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // 1. Detect Login Page via URL
  totalSubtests++
  const loginDet = detectIndiaVisaPage({
    href: 'https://indianvisaonline.gov.in/visa/login.jsp',
    hostname: 'indianvisaonline.gov.in',
    pathname: '/visa/login.jsp',
  })
  if (loginDet.page !== 'login') {
    failures.push(`Subtest 1 Failed: Expected login page, got ${loginDet.page}`)
  }

  // 2. Detect OTP Page via URL
  totalSubtests++
  const otpDet = detectIndiaVisaPage({
    href: 'https://indianvisaonline.gov.in/visa/otp.jsp',
    hostname: 'indianvisaonline.gov.in',
    pathname: '/visa/otp.jsp',
  })
  if (otpDet.page !== 'otp') {
    failures.push(`Subtest 2 Failed: Expected otp page, got ${otpDet.page}`)
  }

  // 3. Detect CAPTCHA Page via URL
  totalSubtests++
  const captchaDet = detectIndiaVisaPage({
    href: 'https://indianvisaonline.gov.in/visa/captcha.jsp',
    hostname: 'indianvisaonline.gov.in',
    pathname: '/visa/captcha.jsp',
  })
  if (captchaDet.page !== 'captcha') {
    failures.push(`Subtest 3 Failed: Expected captcha page, got ${captchaDet.page}`)
  }

  // 4. Detect Payment Page via URL
  totalSubtests++
  const paymentDet = detectIndiaVisaPage({
    href: 'https://indianvisaonline.gov.in/visa/payment.jsp',
    hostname: 'indianvisaonline.gov.in',
    pathname: '/visa/payment.jsp',
  })
  if (paymentDet.page !== 'payment') {
    failures.push(`Subtest 4 Failed: Expected payment page, got ${paymentDet.page}`)
  }

  // 5. Detect Review Page via URL
  totalSubtests++
  const reviewDet = detectIndiaVisaPage({
    href: 'https://indianvisaonline.gov.in/visa/preview.jsp',
    hostname: 'indianvisaonline.gov.in',
    pathname: '/visa/preview.jsp',
  })
  if (reviewDet.page !== 'review') {
    failures.push(`Subtest 5 Failed: Expected review page, got ${reviewDet.page}`)
  }

  // 6. Workflow State initialization updates fields correctly
  totalSubtests++
  const initialState = createInitialWorkflowState()
  if (
    initialState.sessionId !== null ||
    initialState.tabId !== null ||
    typeof initialState.operations !== 'object'
  ) {
    failures.push('Subtest 6 Failed: createInitialWorkflowState fields initialized incorrectly.')
  }

  // 7. validatePageConsistency callback breaks autofill if page changes mid-operation
  totalSubtests++
  if (typeof document !== 'undefined') {
    const container = document.createElement('div')
    container.innerHTML = `
      <input type="text" id="surname" value="" />
      <input type="text" id="given_names" value="" />
    `
    document.body.appendChild(container)

    const mappings: FieldMapping[] = [
      {
        id: 'surname',
        section: 'personalInfo',
        targetField: 'surname',
        sourceField: 'personalInfo.surname',
        sourceType: 'applicant-profile',
        selector: { strategy: 'id', value: 'surname' },
        inputType: 'text',
        status: 'verified',
      },
      {
        id: 'given_names',
        section: 'personalInfo',
        targetField: 'givenNames',
        sourceField: 'personalInfo.givenNames',
        sourceType: 'applicant-profile',
        selector: { strategy: 'id', value: 'given_names' },
        inputType: 'text',
        status: 'verified',
      },
    ]

    let counter = 0
    await executeAutofill({
      mappings,
      applicant: mockApplicant as unknown as ApplicantProfile,
      options: {
        policy: 'fill-empty',
        validatePageConsistency: () => {
          counter++
          // Force consistency failure on second mapping check
          return counter < 2
        },
      },
    })

    const surnameVal = (container.querySelector('#surname') as HTMLInputElement)?.value
    const givenNamesVal = (container.querySelector('#given_names') as HTMLInputElement)?.value
    document.body.removeChild(container)

    // First mapping (surname) should be filled. Second mapping (given_names) should be skipped/cancelled.
    if (surnameVal !== 'APPLICANT' || givenNamesVal !== '') {
      failures.push(
        `Subtest 7 Failed: validatePageConsistency did not halt loop. surname=${surnameVal}, given_names=${givenNamesVal}`
      )
    }
  } else {
    // Bypassed in headless/node context
  }

  // 8. Isolated Undo: Page A operation revert does not affect Page B changes
  totalSubtests++
  if (typeof document !== 'undefined') {
    const container = document.createElement('div')
    container.innerHTML = `
      <input type="text" id="page1_field" value="PAGE1_VAL" />
      <input type="text" id="page2_field" value="PAGE2_VAL" />
    `
    document.body.appendChild(container)

    const opPage2: AutofillOperation = {
      operationId: 'op_page2',
      applicantId: 'app_test_123',
      countryCode: 'india',
      flow: 'regular',
      pageId: 'page2',
      startedAt: new Date().toISOString(),
      status: 'completed',
      changes: [
        {
          operationId: 'op_page2',
          fieldId: 'page2_field',
          targetSelector: { strategy: 'id', value: 'page2_field' },
          status: 'changed',
          previousState: { value: '' },
          newState: { value: 'PAGE2_VAL' },
          timestamp: new Date().toISOString(),
        },
      ],
    }

    // Execute undo for Page 2
    await executeUndo(opPage2)

    const page1Val = (container.querySelector('#page1_field') as HTMLInputElement)?.value
    const page2Val = (container.querySelector('#page2_field') as HTMLInputElement)?.value
    document.body.removeChild(container)

    if (page1Val !== 'PAGE1_VAL' || page2Val !== '') {
      failures.push(
        `Subtest 8 Failed: Isolated undo failed to preserve page 1 while reverting page 2. page1=${page1Val}, page2=${page2Val}`
      )
    }
  } else {
    // Bypassed in headless/node context
  }

  // 9. User modification check: Reverting does not restore field if user has edited it after autofill
  totalSubtests++
  if (typeof document !== 'undefined') {
    const container = document.createElement('div')
    container.innerHTML = `
      <input type="text" id="edited_field" value="USER_EDITED_VAL" />
    `
    document.body.appendChild(container)

    const opEdited: AutofillOperation = {
      operationId: 'op_edited',
      applicantId: 'app_test_123',
      countryCode: 'india',
      flow: 'regular',
      pageId: 'page1',
      startedAt: new Date().toISOString(),
      status: 'completed',
      changes: [
        {
          operationId: 'op_edited',
          fieldId: 'edited_field',
          targetSelector: { strategy: 'id', value: 'edited_field' },
          status: 'changed',
          previousState: { value: 'PREFILL_VAL' },
          newState: { value: 'AUTOFILL_VAL' },
          timestamp: new Date().toISOString(),
        },
      ],
    }

    const undoRes = await executeUndo(opEdited)
    const editedVal = (container.querySelector('#edited_field') as HTMLInputElement)?.value
    document.body.removeChild(container)

    if (editedVal !== 'USER_EDITED_VAL' || undoRes.skipped !== 1) {
      failures.push(
        `Subtest 9 Failed: Revert overwrote manual user edit. editedVal=${editedVal}, skippedCount=${undoRes.skipped}`
      )
    }
  } else {
    // Bypassed in headless/node context
  }

  const passed = failures.length === 0
  return {
    passed,
    totalSubtests,
    failures,
  }
}
