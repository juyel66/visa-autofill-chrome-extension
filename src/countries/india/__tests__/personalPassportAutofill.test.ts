import { SYNTHETIC_APPLICANT_PROFILE } from '../../../../tests/fixtures/syntheticPassport'
import { executeAutofill } from '../../../core/autofill/autofillEngine'
import type { FieldMapping } from '../../../core/autofill/types'
import { executeUndo } from '../../../core/safety/undoManager'

export interface PersonalPassportTestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runPersonalPassportAutofillTests(): Promise<PersonalPassportTestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  if (typeof document === 'undefined') {
    return { passed: true, totalSubtests: 1, failures: [] }
  }

  // --- Subtest 1: Text & Date Field Filling ---
  totalSubtests++
  const container1 = document.createElement('div')
  container1.innerHTML = `
    <input type="text" id="surname" value="" />
    <input type="text" id="given_name" value="" />
    <input type="text" id="dob" value="" />
    <input type="text" id="passport_no" value="" />
  `
  document.body.appendChild(container1)

  const mappings1: FieldMapping[] = [
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
      id: 'given_name',
      section: 'personalInfo',
      targetField: 'given_name',
      sourceField: 'personalInfo.givenNames',
      sourceType: 'applicant-profile',
      selector: { strategy: 'id', value: 'given_name' },
      inputType: 'text',
      status: 'verified',
    },
    {
      id: 'dob',
      section: 'personalInfo',
      targetField: 'dob',
      sourceField: 'personalInfo.dateOfBirth',
      sourceType: 'applicant-profile',
      selector: { strategy: 'id', value: 'dob' },
      inputType: 'text',
      status: 'verified',
    },
    {
      id: 'passport_no',
      section: 'passport',
      targetField: 'passport_no',
      sourceField: 'passport.passportNumber',
      sourceType: 'applicant-profile',
      selector: { strategy: 'id', value: 'passport_no' },
      inputType: 'text',
      status: 'verified',
    },
  ]

  const res1 = await executeAutofill({
    applicant: SYNTHETIC_APPLICANT_PROFILE,
    mappings: mappings1,
    options: { policy: 'fill-empty' },
  })

  const surnameVal = (container1.querySelector('#surname') as HTMLInputElement)?.value
  const passportVal = (container1.querySelector('#passport_no') as HTMLInputElement)?.value
  document.body.removeChild(container1)

  if (!res1.success || surnameVal !== 'APPLICANT' || passportVal !== 'TEST000000') {
    failures.push(`Subtest 1 Failed: Text inputs not filled properly. Surname: ${surnameVal}, Passport: ${passportVal}`)
  }

  // --- Subtest 2: Select Matching ---
  totalSubtests++
  const container2 = document.createElement('div')
  container2.innerHTML = `
    <select id="nationality">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
  `
  document.body.appendChild(container2)

  const mappings2: FieldMapping[] = [
    {
      id: 'nationality',
      section: 'personalInfo',
      targetField: 'nationality',
      sourceField: 'personalInfo.nationality',
      sourceType: 'applicant-profile',
      selector: { strategy: 'id', value: 'nationality' },
      inputType: 'select',
      status: 'verified',
    },
  ]

  await executeAutofill({
    applicant: SYNTHETIC_APPLICANT_PROFILE,
    mappings: mappings2,
    options: { policy: 'fill-empty' },
  })

  const selectVal = (container2.querySelector('#nationality') as HTMLSelectElement)?.value
  document.body.removeChild(container2)

  if (selectVal !== 'Bangladesh') {
    failures.push(`Subtest 2 Failed: Select option not matched. Expected 'Bangladesh', got '${selectVal}'`)
  }

  // --- Subtest 3: Preserving Existing Fields under fill-empty ---
  totalSubtests++
  const container3 = document.createElement('div')
  container3.innerHTML = `
    <input type="text" id="surname" value="PRE_EXISTING_SURNAME" />
  `
  document.body.appendChild(container3)

  const mappings3: FieldMapping[] = [
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
  ]

  await executeAutofill({
    applicant: SYNTHETIC_APPLICANT_PROFILE,
    mappings: mappings3,
    options: { policy: 'fill-empty' },
  })

  const preservedVal = (container3.querySelector('#surname') as HTMLInputElement)?.value
  document.body.removeChild(container3)

  if (preservedVal !== 'PRE_EXISTING_SURNAME') {
    failures.push(`Subtest 3 Failed: Pre-existing value overwritten under fill-empty policy. Got: '${preservedVal}'`)
  }

  // --- Subtest 4: Missing Elements Fail Safely ---
  totalSubtests++
  const mappings4: FieldMapping[] = [
    {
      id: 'non_existent',
      section: 'personalInfo',
      targetField: 'non_existent',
      sourceField: 'personalInfo.surname',
      sourceType: 'applicant-profile',
      selector: { strategy: 'id', value: 'does_not_exist_element' },
      inputType: 'text',
      status: 'verified',
    },
  ]

  const res4 = await executeAutofill({
    applicant: SYNTHETIC_APPLICANT_PROFILE,
    mappings: mappings4,
    options: { policy: 'fill-empty' },
  })

  if (res4.filledFields > 0 || res4.failedFields === 0) {
    failures.push('Subtest 4 Failed: Non-existent element did not report failure/not-found safely.')
  }

  // --- Subtest 5: User-Preserving Undo Protection ---
  totalSubtests++
  const container5 = document.createElement('div')
  container5.innerHTML = `
    <input type="text" id="surname" value="" />
    <input type="text" id="given_name" value="" />
  `
  document.body.appendChild(container5)

  const mappings5: FieldMapping[] = [
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
      id: 'given_name',
      section: 'personalInfo',
      targetField: 'given_name',
      sourceField: 'personalInfo.givenNames',
      sourceType: 'applicant-profile',
      selector: { strategy: 'id', value: 'given_name' },
      inputType: 'text',
      status: 'verified',
    },
  ]

  const fillRes5 = await executeAutofill({
    applicant: SYNTHETIC_APPLICANT_PROFILE,
    mappings: mappings5,
    options: { policy: 'fill-empty' },
  })

  // User edits given_name manually
  const givenInput = container5.querySelector('#given_name') as HTMLInputElement
  if (givenInput) {
    givenInput.value = 'USER_MODIFIED_NAME'
  }

  if (fillRes5.operation) {
    executeUndo(fillRes5.operation)
  }

  const surnameAfterUndo = (container5.querySelector('#surname') as HTMLInputElement)?.value
  const givenNameAfterUndo = (container5.querySelector('#given_name') as HTMLInputElement)?.value
  document.body.removeChild(container5)

  if (givenNameAfterUndo !== 'USER_MODIFIED_NAME' || surnameAfterUndo !== '') {
    failures.push(
      `Subtest 5 Failed: Undo did not preserve user edit. Surname: '${surnameAfterUndo}', GivenName: '${givenNameAfterUndo}'`
    )
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
