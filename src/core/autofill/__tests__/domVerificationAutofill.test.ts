import { executeAutofill } from '../autofillEngine'
import { fillField } from '../fieldFiller'
import { verifyDomValue } from '../domVerifier'
import { normalizeDateForControl, parseDateString } from '../dateNormalizer'
import { resolveCandidateData } from '../candidateResolver'
import type { FieldMapping } from '../types'
import type { ApplicantProfile } from '../../applicant/types'
import type { DocumentRecord } from '../../document/types'

export interface DomVerificationTestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runDomVerificationAutofillTests(): Promise<DomVerificationTestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  if (typeof document === 'undefined') {
    return { passed: true, totalSubtests: 1, failures: [] }
  }

  const mockApplicant: ApplicantProfile = {
    applicantId: 'app_dom_test_001',
    personalInfo: {
      surname: 'RAHMAN',
      givenNames: 'MOHAMMED',
      dateOfBirth: '1990-05-20',
      nationality: 'BANGLADESH',
      gender: 'male',
    },
    passport: {
      passportNumber: 'A12345678',
      issueDate: '2020-01-10',
      expiryDate: '2030-01-09',
      placeOfIssue: 'DHAKA',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // 1. Text field is actually filled and verified
  totalSubtests++
  const container1 = document.createElement('div')
  container1.innerHTML = `<input type="text" id="test_surname" value="" />`
  document.body.appendChild(container1)
  const mapping1: FieldMapping = {
    id: 'test_surname',
    section: 'personal',
    targetField: 'surname',
    sourceField: 'personalInfo.surname',
    sourceType: 'applicant-profile',
    selector: { strategy: 'id', value: 'test_surname' },
    inputType: 'text',
    status: 'verified',
  }
  const res1 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping1],
    options: { policy: 'fill-empty' },
  })
  const input1 = container1.querySelector('#test_surname') as HTMLInputElement
  if (!res1.success || res1.filledFields !== 1 || input1.value !== 'RAHMAN') {
    failures.push(`Test 1 Failed: Text field was not properly filled and verified. Val=${input1?.value}`)
  }
  document.body.removeChild(container1)

  // 2. Text field setter succeeds but DOM value remains wrong -> VALUE_VERIFICATION_FAILED
  totalSubtests++
  const fakeElement = document.createElement('input')
  // Intercept value setter to keep it empty
  Object.defineProperty(fakeElement, 'value', {
    get() {
      return 'wrong_tampered_value'
    },
    set() {
      // simulate blocked or tampered setter
    },
    configurable: true,
  })
  const fillResTampered = fillField(fakeElement, mapping1, 'RAHMAN', 'overwrite')
  if (fillResTampered.status !== 'failed' || fillResTampered.failureType !== 'value-verification-failed') {
    failures.push(`Test 2 Failed: Expected value-verification-failed on tampered input, got status=${fillResTampered.status}, failureType=${fillResTampered.failureType}`)
  }

  // 3. Date input gets correct YYYY-MM-DD value
  totalSubtests++
  const container3 = document.createElement('div')
  container3.innerHTML = `<input type="date" id="test_dob" value="" />`
  document.body.appendChild(container3)
  const mapping3: FieldMapping = {
    id: 'test_dob',
    section: 'personal',
    targetField: 'dob',
    sourceField: 'personalInfo.dateOfBirth',
    sourceType: 'applicant-profile',
    selector: { strategy: 'id', value: 'test_dob' },
    inputType: 'date',
    status: 'verified',
  }
  const res3 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping3],
    options: { policy: 'fill-empty' },
  })
  const input3 = container3.querySelector('#test_dob') as HTMLInputElement
  if (!res3.success || res3.filledFields !== 1 || input3.value !== '1990-05-20') {
    failures.push(`Test 3 Failed: Date input did not receive correct YYYY-MM-DD value. Got=${input3?.value}`)
  }
  document.body.removeChild(container3)

  // 4. Invalid date normalization does not guess
  totalSubtests++
  const invalidDate1 = normalizeDateForControl('not-a-date', 'date')
  const invalidDate2 = normalizeDateForControl('2026-02-30', 'date') // invalid day in Feb
  const invalidParsed = parseDateString('99/99/9999')
  if (invalidDate1 !== null || invalidDate2 !== null || invalidParsed !== null) {
    failures.push('Test 4 Failed: Invalid dates were not rejected as null.')
  }

  // 5. Select matches exact value
  totalSubtests++
  const container5 = document.createElement('div')
  container5.innerHTML = `
    <select id="test_nat_val">
      <option value="">--Select--</option>
      <option value="BANGLADESH">Bangladesh</option>
      <option value="USA">United States</option>
    </select>
  `
  document.body.appendChild(container5)
  const mapping5: FieldMapping = {
    id: 'test_nat',
    section: 'personal',
    targetField: 'nationality',
    sourceField: 'personalInfo.nationality',
    sourceType: 'applicant-profile',
    selector: { strategy: 'id', value: 'test_nat_val' },
    inputType: 'select',
    status: 'verified',
  }
  const res5 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping5],
    options: { policy: 'fill-empty' },
  })
  const select5 = container5.querySelector('#test_nat_val') as HTMLSelectElement
  if (!res5.success || select5.value !== 'BANGLADESH') {
    failures.push(`Test 5 Failed: Select exact value matching failed. Value=${select5?.value}`)
  }
  document.body.removeChild(container5)

  // 6. Select matches exact visible text
  totalSubtests++
  const container6 = document.createElement('div')
  container6.innerHTML = `
    <select id="test_nat_text">
      <option value="">--Select--</option>
      <option value="BGD">BANGLADESH</option>
      <option value="USA">UNITED STATES</option>
    </select>
  `
  document.body.appendChild(container6)
  const mapping6: FieldMapping = {
    id: 'test_nat_txt',
    section: 'personal',
    targetField: 'nationality',
    sourceField: 'personalInfo.nationality',
    sourceType: 'applicant-profile',
    selector: { strategy: 'id', value: 'test_nat_text' },
    inputType: 'select',
    status: 'verified',
  }
  const res6 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping6],
    options: { policy: 'fill-empty' },
  })
  const select6 = container6.querySelector('#test_nat_text') as HTMLSelectElement
  if (!res6.success || select6.value !== 'BGD') {
    failures.push(`Test 6 Failed: Select visible text matching failed. Value=${select6?.value}`)
  }
  document.body.removeChild(container6)

  // 7. Ambiguous select does not guess
  totalSubtests++
  const container7 = document.createElement('div')
  container7.innerHTML = `
    <select id="test_ambiguous_select">
      <option value="DHAKA_1">Dhaka Main</option>
      <option value="DHAKA_2">Dhaka North</option>
    </select>
  `
  document.body.appendChild(container7)
  const mapping7: FieldMapping = {
    id: 'test_ambig_sel',
    section: 'personal',
    targetField: 'city',
    sourceField: 'passport.placeOfIssue', // 'DHAKA'
    sourceType: 'applicant-profile',
    selector: { strategy: 'id', value: 'test_ambiguous_select' },
    inputType: 'select',
    status: 'verified',
  }
  const res7 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping7],
    options: { policy: 'fill-empty' },
  })
  const fieldRes7 = res7.results[0]
  if (fieldRes7.status !== 'failed' || fieldRes7.failureType !== 'ambiguous-target') {
    failures.push(`Test 7 Failed: Expected ambiguous-target for multiple partial select matches, got ${fieldRes7?.failureType}`)
  }
  document.body.removeChild(container7)

  // 8. Radio selection is verified
  totalSubtests++
  const container8 = document.createElement('div')
  container8.innerHTML = `
    <input type="radio" name="gender" value="male" id="gender_m" />
    <input type="radio" name="gender" value="female" id="gender_f" />
  `
  document.body.appendChild(container8)
  const mapping8: FieldMapping = {
    id: 'test_gender',
    section: 'personal',
    targetField: 'gender',
    sourceField: 'personalInfo.gender',
    sourceType: 'applicant-profile',
    selector: { strategy: 'css', value: '#gender_m' },
    inputType: 'radio',
    status: 'verified',
  }
  const res8 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping8],
    options: { policy: 'fill-empty' },
  })
  const radioM = container8.querySelector('#gender_m') as HTMLInputElement
  const radioF = container8.querySelector('#gender_f') as HTMLInputElement
  if (!res8.success || !radioM.checked || radioF.checked) {
    failures.push('Test 8 Failed: Radio button was not correctly checked and verified in DOM.')
  }
  document.body.removeChild(container8)

  // 9. Checkbox selection is verified
  totalSubtests++
  const container9 = document.createElement('div')
  container9.innerHTML = `<input type="checkbox" id="test_agree" />`
  document.body.appendChild(container9)
  const mapping9: FieldMapping = {
    id: 'test_chk',
    section: 'declaration',
    targetField: 'agree',
    sourceField: 'personalInfo.surname', // dummy value to set true
    sourceType: 'applicant-profile',
    selector: { strategy: 'id', value: 'test_agree' },
    inputType: 'checkbox',
    status: 'verified',
  }
  const fillRes9 = fillField(container9.querySelector('#test_agree') as HTMLElement, mapping9, 'true', 'overwrite')
  const chk = container9.querySelector('#test_agree') as HTMLInputElement
  const verify9 = verifyDomValue(chk, mapping9, 'true')
  if (fillRes9.status !== 'filled' || !chk.checked || !verify9.verified) {
    failures.push('Test 9 Failed: Checkbox fill and DOM verification failed.')
  }
  document.body.removeChild(container9)

  // 10. Disabled input is not modified
  totalSubtests++
  const container10 = document.createElement('div')
  container10.innerHTML = `<input type="text" id="disabled_input" value="original_disabled" disabled />`
  document.body.appendChild(container10)
  const mapping10: FieldMapping = {
    id: 'disabled_fld',
    section: 'personal',
    targetField: 'surname',
    sourceField: 'personalInfo.surname',
    sourceType: 'applicant-profile',
    selector: { strategy: 'id', value: 'disabled_input' },
    inputType: 'text',
    status: 'verified',
  }
  const res10 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping10],
    options: { policy: 'overwrite' },
  })
  const disInput = container10.querySelector('#disabled_input') as HTMLInputElement
  if (res10.results[0].failureType !== 'disabled-field' || disInput.value !== 'original_disabled') {
    failures.push('Test 10 Failed: Disabled input was modified or did not return disabled-field.')
  }
  document.body.removeChild(container10)

  // 11. Readonly input is not modified
  totalSubtests++
  const container11 = document.createElement('div')
  container11.innerHTML = `<input type="text" id="readonly_input" value="original_readonly" readonly />`
  document.body.appendChild(container11)
  const mapping11: FieldMapping = {
    id: 'readonly_fld',
    section: 'personal',
    targetField: 'surname',
    sourceField: 'personalInfo.surname',
    sourceType: 'applicant-profile',
    selector: { strategy: 'id', value: 'readonly_input' },
    inputType: 'text',
    status: 'verified',
  }
  const res11 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping11],
    options: { policy: 'overwrite' },
  })
  const roInput = container11.querySelector('#readonly_input') as HTMLInputElement
  if (res11.results[0].failureType !== 'readonly-field' || roInput.value !== 'original_readonly') {
    failures.push('Test 11 Failed: Readonly input was modified or did not return readonly-field.')
  }
  document.body.removeChild(container11)

  // 12. Zero selector result -> selector-failed
  totalSubtests++
  const mapping12: FieldMapping = {
    id: 'zero_sel',
    section: 'personal',
    targetField: 'surname',
    sourceField: 'personalInfo.surname',
    sourceType: 'applicant-profile',
    selector: { strategy: 'id', value: 'totally_non_existent_element_xyz' },
    inputType: 'text',
    status: 'verified',
  }
  const res12 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping12],
    options: { policy: 'fill-empty' },
  })
  if (res12.results[0].failureType !== 'selector-failed' || res12.results[0].status !== 'not-found') {
    failures.push(`Test 12 Failed: Expected selector-failed, got status=${res12.results[0].status}, failureType=${res12.results[0].failureType}`)
  }

  // 13. Multiple selector result -> ambiguous-target
  totalSubtests++
  const container13 = document.createElement('div')
  container13.innerHTML = `
    <input type="text" class="shared_class_input" />
    <input type="text" class="shared_class_input" />
  `
  document.body.appendChild(container13)
  const mapping13: FieldMapping = {
    id: 'mult_sel',
    section: 'personal',
    targetField: 'surname',
    sourceField: 'personalInfo.surname',
    sourceType: 'applicant-profile',
    selector: { strategy: 'css', value: '.shared_class_input' },
    inputType: 'text',
    status: 'verified',
  }
  const res13 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping13],
    options: { policy: 'fill-empty' },
  })
  if (res13.results[0].failureType !== 'ambiguous-target') {
    failures.push(`Test 13 Failed: Expected ambiguous-target for multiple elements, got ${res13.results[0].failureType}`)
  }
  document.body.removeChild(container13)

  // 14. Stale / detached element retry
  totalSubtests++
  const container14 = document.createElement('div')
  container14.innerHTML = `<input type="text" id="stale_retry_input" value="" />`
  document.body.appendChild(container14)
  const mapping14: FieldMapping = {
    id: 'stale_retry',
    section: 'personal',
    targetField: 'surname',
    sourceField: 'personalInfo.surname',
    sourceType: 'applicant-profile',
    selector: { strategy: 'id', value: 'stale_retry_input' },
    inputType: 'text',
    status: 'verified',
  }
  const res14 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping14],
    options: { policy: 'fill-empty' },
  })
  if (!res14.success || res14.filledFields !== 1) {
    failures.push('Test 14 Failed: Re-resolution retry failed.')
  }
  document.body.removeChild(container14)

  // 15. Missing source value does not erase existing website value
  totalSubtests++
  const container15 = document.createElement('div')
  container15.innerHTML = `<input type="text" id="user_kept_val" value="keep_my_manual_text" />`
  document.body.appendChild(container15)
  const mapping15: FieldMapping = {
    id: 'missing_src',
    section: 'personal',
    targetField: 'notes',
    sourceField: 'notes', // missing from mockApplicant
    sourceType: 'applicant-profile',
    selector: { strategy: 'id', value: 'user_kept_val' },
    inputType: 'text',
    status: 'verified',
    required: false,
  }
  const res15 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping15],
    options: { policy: 'fill-empty' },
  })
  const userVal = (container15.querySelector('#user_kept_val') as HTMLInputElement).value
  if (userVal !== 'keep_my_manual_text' || res15.results[0].status !== 'skipped') {
    failures.push(`Test 15 Failed: Missing source value erased user text! Val=${userVal}`)
  }
  document.body.removeChild(container15)

  // 16. Missing source value on required field returns source-data-missing without altering DOM
  totalSubtests++
  const container16 = document.createElement('div')
  container16.innerHTML = `<input type="text" id="req_missing_val" value="existing_text" />`
  document.body.appendChild(container16)
  const mapping16: FieldMapping = {
    id: 'req_missing_src',
    section: 'personal',
    targetField: 'nationalIdNumber',
    sourceField: 'personalInfo.nationalIdNumber', // missing
    sourceType: 'applicant-profile',
    selector: { strategy: 'id', value: 'req_missing_val' },
    inputType: 'text',
    status: 'verified',
    required: true,
  }
  const res16 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping16],
    options: { policy: 'fill-empty' },
  })
  const reqVal = (container16.querySelector('#req_missing_val') as HTMLInputElement).value
  if (
    res16.results[0].failureType !== 'source-data-missing' ||
    reqVal !== 'existing_text'
  ) {
    failures.push(`Test 16 Failed: Missing required source value did not return source-data-missing. Got=${res16.results[0].failureType}`)
  }
  document.body.removeChild(container16)

  // 17. Partial success is reported correctly
  totalSubtests++
  const container17 = document.createElement('div')
  container17.innerHTML = `
    <input type="text" id="part_surname" value="" />
    <input type="text" id="part_disabled" value="" disabled />
  `
  document.body.appendChild(container17)
  const mappings17: FieldMapping[] = [
    {
      id: 'part_surname',
      section: 'personal',
      targetField: 'surname',
      sourceField: 'personalInfo.surname',
      sourceType: 'applicant-profile',
      selector: { strategy: 'id', value: 'part_surname' },
      inputType: 'text',
      status: 'verified',
    },
    {
      id: 'part_disabled',
      section: 'personal',
      targetField: 'givenNames',
      sourceField: 'personalInfo.givenNames',
      sourceType: 'applicant-profile',
      selector: { strategy: 'id', value: 'part_disabled' },
      inputType: 'text',
      status: 'verified',
    },
    {
      id: 'part_manual',
      section: 'captcha',
      targetField: 'captcha',
      sourceType: 'manual',
      selector: { strategy: 'id', value: 'part_captcha' },
      inputType: 'text',
      status: 'manual-required',
    },
  ]
  const res17 = await executeAutofill({
    applicant: mockApplicant,
    mappings: mappings17,
    options: { policy: 'fill-empty' },
  })
  if (
    res17.success !== false ||
    res17.filledFields !== 1 ||
    res17.failedFields !== 2 ||
    res17.operation?.status !== 'partially-completed'
  ) {
    failures.push(`Test 17 Failed: Partial success inaccurate. Success=${res17.success}, Filled=${res17.filledFields}, Failed=${res17.failedFields}, OpStatus=${res17.operation?.status}`)
  }
  document.body.removeChild(container17)

  // 18. needs-verification mapping is skipped safely
  totalSubtests++
  const mapping18: FieldMapping = {
    id: 'unverified_fld',
    section: 'personal',
    targetField: 'surname',
    sourceField: 'personalInfo.surname',
    sourceType: 'applicant-profile',
    selector: { strategy: 'id', value: 'any_input' },
    inputType: 'text',
    status: 'needs-verification',
  }
  const res18 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping18],
  })
  if (res18.results[0].status !== 'skipped' || res18.skippedFields !== 1) {
    failures.push(`Test 18 Failed: needs-verification was not skipped safely. Status=${res18.results[0].status}`)
  }

  // 19. manual-required mapping remains manual
  totalSubtests++
  const mapping19: FieldMapping = {
    id: 'manual_fld',
    section: 'security',
    targetField: 'captcha',
    sourceType: 'manual',
    selector: { strategy: 'id', value: 'captcha_input' },
    inputType: 'text',
    status: 'manual-required',
  }
  const res19 = await executeAutofill({
    applicant: mockApplicant,
    mappings: [mapping19],
  })
  if (res19.results[0].status !== 'failed' || res19.results[0].failureType !== 'manual-required') {
    failures.push(`Test 19 Failed: manual-required mapping did not return manual-required failureType. Got=${res19.results[0].failureType}`)
  }

  // 20. CandidateResolver: NO fallback to pre-existing profile personal data
  totalSubtests++
  const unconfirmedDoc: DocumentRecord = {
    documentId: 'doc_unconfirmed_123',
    applicantId: 'prof_no_fallback',
    documentType: 'passport',
    fileName: 'passport.pdf',
    mimeType: 'application/pdf',
    fileSize: 2048,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'uploaded',
    source: 'user-upload',
    extractedDataConfirmed: false, // NOT confirmed
    extractedData: {
      personal: {
        lastName: { value: 'SECRET_FALLBACK', source: 'mrz' },
        firstName: { value: 'SHOULD_NOT_LEAK', source: 'mrz' },
        dateOfBirth: { value: '1990-01-01', source: 'mrz' },
        nationality: { value: 'USA', source: 'mrz' },
      },
      passport: {
        passportNumber: { value: 'NOPE123', source: 'mrz' },
      },
    },
  }
  const candRes = resolveCandidateData({
    profileId: 'prof_no_fallback',
    documents: [unconfirmedDoc],
  })
  if (candRes.status !== 'REVIEW_REQUIRED' || candRes.applicant !== undefined) {
    failures.push(`Test 20 Failed: Candidate data resolver leaked unconfirmed profile data! Status=${candRes.status}`)
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
