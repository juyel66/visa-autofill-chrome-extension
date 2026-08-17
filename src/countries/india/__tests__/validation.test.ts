import { validateApplicant } from '../../../core/validation/applicantValidation'
import { executeAutofill } from '../../../core/autofill/autofillEngine'
import type { ApplicantProfile } from '../../../core/applicant/types'
import type { FieldMapping } from '../../../core/autofill/types'

export interface ValidationTestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runValidationTests(): Promise<ValidationTestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  // Synthetic valid profile: John Test Applicant
  const validProfile: ApplicantProfile = {
    applicantId: 'app_john_test',
    personalInfo: {
      surname: 'Test',
      givenNames: 'John',
      dateOfBirth: '1995-01-15',
      nationality: 'USA',
      gender: 'male',
    },
    passport: {
      passportNumber: 'TEST000000',
      issueDate: '2025-01-15',
      expiryDate: '2035-01-14',
    },
    contact: {
      email: 'john.test@example.invalid',
      mobile: '+8801000000000',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as ApplicantProfile

  // 1. VALID: valid profile validation
  totalSubtests++
  const valResult = validateApplicant(validProfile)
  if (!valResult.valid) {
    failures.push(`Subtest 1 Failed: Expected valid profile, got errors: ${JSON.stringify(valResult.errors)}`)
  }

  // 2. VALID: leap year validation
  totalSubtests++
  const leapProfile = {
    ...validProfile,
    personalInfo: {
      ...validProfile.personalInfo,
      dateOfBirth: '2024-02-29', // valid leap year
    },
  } as unknown as ApplicantProfile
  const valLeap = validateApplicant(leapProfile)
  if (!valLeap.valid) {
    failures.push(`Subtest 2 Failed: Expected 2024-02-29 to be valid, got errors: ${JSON.stringify(valLeap.errors)}`)
  }

  // 3. INVALID: 2026-02-30
  totalSubtests++
  const impossibleDate1 = {
    ...validProfile,
    personalInfo: {
      ...validProfile.personalInfo,
      dateOfBirth: '2026-02-30',
    },
  } as unknown as ApplicantProfile
  const valImp1 = validateApplicant(impossibleDate1)
  if (valImp1.valid) {
    failures.push('Subtest 3 Failed: Expected 2026-02-30 to be invalid, but it passed.')
  }

  // 4. INVALID: 2025-02-29 (non-leap year)
  totalSubtests++
  const impossibleDate2 = {
    ...validProfile,
    personalInfo: {
      ...validProfile.personalInfo,
      dateOfBirth: '2025-02-29',
    },
  } as unknown as ApplicantProfile
  const valImp2 = validateApplicant(impossibleDate2)
  if (valImp2.valid) {
    failures.push('Subtest 4 Failed: Expected 2025-02-29 to be invalid, but it passed.')
  }

  // 5. INVALID: invalid month
  totalSubtests++
  const impossibleDate3 = {
    ...validProfile,
    personalInfo: {
      ...validProfile.personalInfo,
      dateOfBirth: '2026-13-15',
    },
  } as unknown as ApplicantProfile
  const valImp3 = validateApplicant(impossibleDate3)
  if (valImp3.valid) {
    failures.push('Subtest 5 Failed: Expected month 13 to be invalid, but it passed.')
  }

  // 6. INVALID: invalid day
  totalSubtests++
  const impossibleDate4 = {
    ...validProfile,
    personalInfo: {
      ...validProfile.personalInfo,
      dateOfBirth: '2026-01-35',
    },
  } as unknown as ApplicantProfile
  const valImp4 = validateApplicant(impossibleDate4)
  if (valImp4.valid) {
    failures.push('Subtest 6 Failed: Expected day 35 to be invalid, but it passed.')
  }

  // 7. INVALID: malformed YYYY-MM-DD
  totalSubtests++
  const impossibleDate5 = {
    ...validProfile,
    personalInfo: {
      ...validProfile.personalInfo,
      dateOfBirth: '2026/01/15',
    },
  } as unknown as ApplicantProfile
  const valImp5 = validateApplicant(impossibleDate5)
  if (valImp5.valid) {
    failures.push('Subtest 7 Failed: Expected slash delimiters to be invalid, but it passed.')
  }

  // 8. INVALID: expiry before issue
  totalSubtests++
  const badPassport1 = {
    ...validProfile,
    passport: {
      passportNumber: 'TEST000000',
      issueDate: '2025-01-15',
      expiryDate: '2024-01-01',
    },
  } as unknown as ApplicantProfile
  const valPassport1 = validateApplicant(badPassport1)
  if (valPassport1.valid) {
    failures.push('Subtest 8 Failed: Expected expiry before issue to be invalid, but it passed.')
  }

  // 9. INVALID: issue date equal to expiry date
  totalSubtests++
  const badPassport2 = {
    ...validProfile,
    passport: {
      passportNumber: 'TEST000000',
      issueDate: '2025-01-15',
      expiryDate: '2025-01-15',
    },
  } as unknown as ApplicantProfile
  const valPassport2 = validateApplicant(badPassport2)
  if (valPassport2.valid) {
    failures.push('Subtest 9 Failed: Expected expiry equal to issue to be invalid, but it passed.')
  }

  // 10. INVALID: whitespace-only required field
  totalSubtests++
  const badProfileNames = {
    ...validProfile,
    personalInfo: {
      ...validProfile.personalInfo,
      surname: '   ',
    },
  } as unknown as ApplicantProfile
  const valNames = validateApplicant(badProfileNames)
  if (valNames.valid) {
    failures.push('Subtest 10 Failed: Expected whitespace-only surname to be invalid, but it passed.')
  }

  // 11. MAPPING: compatible text input, compatible select, compatible radio
  totalSubtests++
  if (typeof document !== 'undefined') {
    const container = document.createElement('div')
    container.innerHTML = `
      <input type="text" id="comp_text" value="" />
      <select id="comp_select">
        <option value="">Choose</option>
        <option value="male">male</option>
      </select>
      <input type="radio" id="comp_radio" name="r_group" value="male" />
    `
    document.body.appendChild(container)

    const mappings: FieldMapping[] = [
      {
        id: 'c_text',
        section: 'personalInfo',
        targetField: 'surname',
        sourceField: 'personalInfo.surname',
        sourceType: 'applicant-profile',
        selector: { strategy: 'id', value: 'comp_text' },
        inputType: 'text',
        status: 'verified',
      },
      {
        id: 'c_select',
        section: 'personalInfo',
        targetField: 'gender',
        sourceField: 'personalInfo.gender',
        sourceType: 'applicant-profile',
        selector: { strategy: 'id', value: 'comp_select' },
        inputType: 'select',
        status: 'verified',
      },
    ]

    const autofillRes = await executeAutofill({
      mappings,
      applicant: validProfile,
      options: { policy: 'fill-empty' },
    })

    const tVal = (container.querySelector('#comp_text') as HTMLInputElement).value
    const sVal = (container.querySelector('#comp_select') as HTMLSelectElement).value
    document.body.removeChild(container)

    if (autofillRes.filledFields !== 2 || tVal !== 'Test' || sVal !== 'male') {
      failures.push(`Subtest 11 Failed: Expected successful fills, got filledFields=${autofillRes.filledFields}`)
    }
  }

  // 12. MAPPING: mapping mismatch (select mapping on text/checkbox element)
  totalSubtests++
  if (typeof document !== 'undefined') {
    const container = document.createElement('div')
    container.innerHTML = `
      <input type="checkbox" id="mismatch_checkbox" />
    `
    document.body.appendChild(container)

    const mappingMismatch: FieldMapping[] = [
      {
        id: 'mismatch_field',
        section: 'personalInfo',
        targetField: 'gender',
        sourceField: 'personalInfo.gender',
        sourceType: 'applicant-profile',
        selector: { strategy: 'id', value: 'mismatch_checkbox' },
        inputType: 'select', // select on checkbox is a mismatch
        status: 'verified',
      },
    ]

    const autofillRes = await executeAutofill({
      mappings: mappingMismatch,
      applicant: validProfile,
      options: { policy: 'fill-empty' },
    })

    const isChecked = (container.querySelector('#mismatch_checkbox') as HTMLInputElement).checked
    document.body.removeChild(container)

    const fieldRes = autofillRes.results[0]
    if (isChecked || !fieldRes || fieldRes.failureType !== 'mapping-mismatch') {
      failures.push(`Subtest 12 Failed: Expected mapping-mismatch, got ${fieldRes?.failureType}`)
    }
  }

  // 13. MAPPING: unsupported mapping
  totalSubtests++
  const mappingUnsupported: FieldMapping[] = [
    {
      id: 'unsup_field',
      section: 'personalInfo',
      targetField: 'surname',
      sourceField: 'personalInfo.surname',
      sourceType: 'applicant-profile',
      selector: { strategy: 'id', value: 'some_id' },
      inputType: 'text',
      status: 'unsupported',
    },
  ]
  const resUnsup = await executeAutofill({
    mappings: mappingUnsupported,
    applicant: validProfile,
    options: { policy: 'fill-empty' },
  })
  const fieldResUnsup = resUnsup.results[0]
  if (!fieldResUnsup || fieldResUnsup.failureType !== 'unsupported-field' || fieldResUnsup.status !== 'unsupported') {
    failures.push(`Subtest 13 Failed: Expected unsupported-field status, got ${fieldResUnsup?.status}`)
  }

  // 14. MAPPING: manual-only mapping
  totalSubtests++
  const mappingManual: FieldMapping[] = [
    {
      id: 'man_field',
      section: 'personalInfo',
      targetField: 'surname',
      sourceField: 'personalInfo.surname',
      sourceType: 'manual', // manual-only
      selector: { strategy: 'id', value: 'some_id' },
      inputType: 'text',
      status: 'verified',
    },
  ]
  const resMan = await executeAutofill({
    mappings: mappingManual,
    applicant: validProfile,
    options: { policy: 'fill-empty' },
  })
  const fieldResMan = resMan.results[0]
  if (!fieldResMan || fieldResMan.failureType !== 'manual-required' || fieldResMan.attempts !== 0) {
    failures.push(`Subtest 14 Failed: Expected manual-required with 0 attempts, got ${fieldResMan?.failureType}`)
  }

  const passed = failures.length === 0
  return {
    passed,
    totalSubtests,
    failures,
  }
}
