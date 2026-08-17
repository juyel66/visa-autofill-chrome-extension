import { executeAutofill } from '../../../core/autofill/autofillEngine'
import { executeUndo } from '../../../core/safety/undoManager'
import type { FieldMapping } from '../../../core/autofill/types'
import type { AutofillOperation } from '../../../core/safety/types'
import type { ApplicantProfile } from '../../../core/applicant/types'

export interface RecoveryTestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runRecoveryTests(): Promise<RecoveryTestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  const mockApplicant = {
    applicantId: 'app_recovery_123',
    personalInfo: {
      surname: 'RECOVERY',
      givenNames: 'TESTER',
      dateOfBirth: '1995-01-15',
      nationality: 'USA',
      religion: 'OTHERS',
    },
    passport: {
      passportNumber: 'PPT000000',
    },
    contact: {
      email: 'invalid-email-format', // invalid formatting
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as ApplicantProfile

  // 1. field-not-found
  totalSubtests++
  const mappingNotFound: FieldMapping[] = [
    {
      id: 'surname',
      section: 'personalInfo',
      targetField: 'surname',
      sourceField: 'personalInfo.surname',
      sourceType: 'applicant-profile',
      selector: { strategy: 'id', value: 'non_existent_element_id' },
      inputType: 'text',
      status: 'verified',
    },
  ]
  const resNotFound = await executeAutofill({
    mappings: mappingNotFound,
    applicant: mockApplicant,
    options: { policy: 'fill-empty' },
  })
  const fieldResNotFound = resNotFound.results[0]
  if (
    !fieldResNotFound ||
    fieldResNotFound.status !== 'not-found' ||
    fieldResNotFound.failureType !== 'selector-failed'
  ) {
    failures.push(`Subtest 1 Failed: Expected selector-failed status, got ${fieldResNotFound?.failureType}`)
  }

  // 2. ambiguous-target
  totalSubtests++
  if (typeof document !== 'undefined') {
    const container = document.createElement('div')
    container.innerHTML = `
      <input type="text" class="duplicate-class" />
      <input type="text" class="duplicate-class" />
    `
    document.body.appendChild(container)

    const mappingAmbiguous: FieldMapping[] = [
      {
        id: 'duplicate',
        section: 'personalInfo',
        targetField: 'surname',
        sourceField: 'personalInfo.surname',
        sourceType: 'applicant-profile',
        selector: { strategy: 'css', value: '.duplicate-class' },
        inputType: 'text',
        status: 'verified',
      },
    ]

    const resAmbiguous = await executeAutofill({
      mappings: mappingAmbiguous,
      applicant: mockApplicant,
      options: { policy: 'fill-empty' },
    })

    document.body.removeChild(container)
    const fieldResAmb = resAmbiguous.results[0]
    if (!fieldResAmb || fieldResAmb.failureType !== 'ambiguous-target') {
      failures.push(`Subtest 2 Failed: Expected ambiguous-target, got ${fieldResAmb?.failureType}`)
    }
  }

  // 3. validation-failed
  totalSubtests++
  const mappingValidation: FieldMapping[] = [
    {
      id: 'email',
      section: 'contact',
      targetField: 'email',
      sourceField: 'contact.email',
      sourceType: 'applicant-profile',
      selector: { strategy: 'id', value: 'email_field' },
      inputType: 'text',
      status: 'verified',
    },
  ]
  const resValidation = await executeAutofill({
    mappings: mappingValidation,
    applicant: mockApplicant,
    options: { policy: 'fill-empty' },
  })
  const fieldResVal = resValidation.results[0]
  if (!fieldResVal || fieldResVal.failureType !== 'validation-failed') {
    failures.push(`Subtest 3 Failed: Expected validation-failed, got ${fieldResVal?.failureType}`)
  }

  // 4. option-not-found
  totalSubtests++
  if (typeof document !== 'undefined') {
    const container = document.createElement('div')
    container.innerHTML = `
      <select id="religion_dropdown">
        <option value="HINDU">Hindu</option>
        <option value="ISLAM">Islam</option>
      </select>
    `
    document.body.appendChild(container)

    const mappingOptionNotFound: FieldMapping[] = [
      {
        id: 'religion',
        section: 'personalInfo',
        targetField: 'religion',
        sourceField: 'personalInfo.religion',
        sourceType: 'applicant-profile',
        selector: { strategy: 'id', value: 'religion_dropdown' },
        inputType: 'select',
        status: 'verified',
      },
    ]

    const resOption = await executeAutofill({
      mappings: mappingOptionNotFound,
      applicant: mockApplicant,
      options: { policy: 'fill-empty' },
    })

    document.body.removeChild(container)
    const fieldResOpt = resOption.results[0]
    if (!fieldResOpt || fieldResOpt.failureType !== 'option-not-found') {
      failures.push(`Subtest 4 Failed: Expected option-not-found, got ${fieldResOpt?.failureType}`)
    }
  }

  // 5. readonly / disabled
  totalSubtests++
  if (typeof document !== 'undefined') {
    const container = document.createElement('div')
    container.innerHTML = `
      <input type="text" id="readonly_input" readonly />
      <input type="text" id="disabled_input" disabled />
    `
    document.body.appendChild(container)

    const mappingsConstraint: FieldMapping[] = [
      {
        id: 'readonly_field',
        section: 'personalInfo',
        targetField: 'surname',
        sourceField: 'personalInfo.surname',
        sourceType: 'applicant-profile',
        selector: { strategy: 'id', value: 'readonly_input' },
        inputType: 'text',
        status: 'verified',
      },
      {
        id: 'disabled_field',
        section: 'personalInfo',
        targetField: 'surname',
        sourceField: 'personalInfo.surname',
        sourceType: 'applicant-profile',
        selector: { strategy: 'id', value: 'disabled_input' },
        inputType: 'text',
        status: 'verified',
      },
    ]

    const resConstraint = await executeAutofill({
      mappings: mappingsConstraint,
      applicant: mockApplicant,
      options: { policy: 'fill-empty' },
    })

    document.body.removeChild(container)
    const r1 = resConstraint.results[0]
    const r2 = resConstraint.results[1]
    if (!r1 || r1.failureType !== 'readonly-field' || !r2 || r2.failureType !== 'disabled-field') {
      failures.push(
        `Subtest 5 Failed: Expected readonly and disabled failure types, got ${r1?.failureType} and ${r2?.failureType}`
      )
    }
  }

  // 6. already-matching
  totalSubtests++
  if (typeof document !== 'undefined') {
    const container = document.createElement('div')
    container.innerHTML = `
      <input type="text" id="matching_input" value="RECOVERY" />
    `
    document.body.appendChild(container)

    const mappingMatching: FieldMapping[] = [
      {
        id: 'matching_field',
        section: 'personalInfo',
        targetField: 'surname',
        sourceField: 'personalInfo.surname',
        sourceType: 'applicant-profile',
        selector: { strategy: 'id', value: 'matching_input' },
        inputType: 'text',
        status: 'verified',
      },
    ]

    const resMatching = await executeAutofill({
      mappings: mappingMatching,
      applicant: mockApplicant,
      options: { policy: 'fill-empty' },
    })

    document.body.removeChild(container)
    const rMatching = resMatching.results[0]
    if (!rMatching || rMatching.status !== 'already-matching') {
      failures.push(`Subtest 6 Failed: Expected already-matching status, got ${rMatching?.status}`)
    }
  }

  // 7. skipped-existing
  totalSubtests++
  if (typeof document !== 'undefined') {
    const container = document.createElement('div')
    container.innerHTML = `
      <input type="text" id="existing_input" value="DIFFERENT" />
    `
    document.body.appendChild(container)

    const mappingExisting: FieldMapping[] = [
      {
        id: 'existing_field',
        section: 'personalInfo',
        targetField: 'surname',
        sourceField: 'personalInfo.surname',
        sourceType: 'applicant-profile',
        selector: { strategy: 'id', value: 'existing_input' },
        inputType: 'text',
        status: 'verified',
      },
    ]

    const resExisting = await executeAutofill({
      mappings: mappingExisting,
      applicant: mockApplicant,
      options: { policy: 'fill-empty' },
    })

    document.body.removeChild(container)
    const rExisting = resExisting.results[0]
    if (!rExisting || rExisting.status !== 'skipped-existing') {
      failures.push(`Subtest 7 Failed: Expected skipped-existing status, got ${rExisting?.status}`)
    }
  }

  // 8. Stale element single recovery (FAIL -> SUCCESS)
  totalSubtests++
  if (typeof document !== 'undefined') {
    const container = document.createElement('div')
    container.innerHTML = `
      <input type="text" id="stale_input" value="" />
    `
    document.body.appendChild(container)

    const mappingStale: FieldMapping[] = [
      {
        id: 'stale_field',
        section: 'personalInfo',
        targetField: 'surname',
        sourceField: 'personalInfo.surname',
        sourceType: 'applicant-profile',
        selector: { strategy: 'id', value: 'stale_input' },
        inputType: 'text',
        status: 'verified',
      },
    ]


    let checkCount = 0
    const resStale = await executeAutofill({
      mappings: mappingStale,
      applicant: mockApplicant,
      options: {
        policy: 'fill-empty',
        validatePageConsistency: () => {
          checkCount++
          if (checkCount === 1) {
            // Detach elements on first check
            container.innerHTML = `<input type="text" id="stale_input" value="" />`
          }
          return true
        },
      },
    })

    const finalVal = (container.querySelector('#stale_input') as HTMLInputElement)?.value
    document.body.removeChild(container)

    if (finalVal !== 'RECOVERY' || resStale.filledFields !== 1) {
      failures.push(`Subtest 8 Failed: Expected stale element recovery to fill final input, got "${finalVal}"`)
    }
  }

  // 9. User modifications protection on Undo
  totalSubtests++
  if (typeof document !== 'undefined') {
    const container = document.createElement('div')
    container.innerHTML = `
      <input type="text" id="user_modified" value="USER_EDITED" />
    `
    document.body.appendChild(container)

    const op: AutofillOperation = {
      operationId: 'op_user_mod',
      applicantId: 'app_recovery_123',
      countryCode: 'india',
      flow: 'regular',
      pageId: 'page1',
      startedAt: new Date().toISOString(),
      status: 'completed',
      changes: [
        {
          operationId: 'op_user_mod',
          fieldId: 'user_modified',
          targetSelector: { strategy: 'id', value: 'user_modified' },
          status: 'changed',
          previousState: { value: 'OLD' },
          newState: { value: 'RECOVERY' },
          timestamp: new Date().toISOString(),
        },
      ],
    }

    const undoRes = await executeUndo(op)
    const val = (container.querySelector('#user_modified') as HTMLInputElement)?.value
    document.body.removeChild(container)

    if (val !== 'USER_EDITED' || undoRes.skipped !== 1) {
      failures.push(`Subtest 9 Failed: Undo overwrote user modifications. val=${val}, skipped=${undoRes.skipped}`)
    }
  }

  const passed = failures.length === 0
  return {
    passed,
    totalSubtests,
    failures,
  }
}
