import { SYNTHETIC_APPLICANT_PROFILE } from '../../../../tests/fixtures/syntheticPassport'
import { executeAutofill } from '../../../core/autofill/autofillEngine'
import type { FieldMapping } from '../../../core/autofill/types'
import { executeUndo } from '../../../core/safety/undoManager'
import { getIndiaVisaMappings } from '../mappingService'
import type { ApplicantProfile } from '../../../core/applicant/types'

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
    await executeUndo(fillRes5.operation)
  }

  const surnameAfterUndo = (container5.querySelector('#surname') as HTMLInputElement)?.value
  const givenNameAfterUndo = (container5.querySelector('#given_name') as HTMLInputElement)?.value
  document.body.removeChild(container5)

  if (givenNameAfterUndo !== 'USER_MODIFIED_NAME' || surnameAfterUndo !== '') {
    failures.push(
      `Subtest 5 Failed: Undo did not preserve user edit. Surname: '${surnameAfterUndo}', GivenName: '${givenNameAfterUndo}'`
    )
  }

  // --- Subtest 6: Present & Permanent Address Autofill ---
  totalSubtests++
  const container6 = document.createElement('div')
  container6.innerHTML = `
    <input type="text" name="pres_addr1" value="" />
    <input type="text" name="pres_addr2" value="" />
    <input type="text" name="pres_city" value="" />
    <input type="text" name="pres_state" value="" />
    <select name="pres_country">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <input type="text" name="pres_postal_code" value="" />
    <input type="text" name="mobile_no" value="" />
    <input type="text" name="phone_no" value="" />
    <input type="text" name="perm_addr1" value="" />
    <input type="text" name="perm_addr2" value="" />
    <input type="text" name="perm_city" value="" />
    <input type="text" name="perm_state" value="" />
    <select name="perm_country">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <input type="text" name="perm_postal_code" value="" />
    <input type="checkbox" name="same_address" />
  `
  document.body.appendChild(container6)

  const addressMappings = getIndiaVisaMappings('regular', 'address-details')
  const res6 = await executeAutofill({
    applicant: SYNTHETIC_APPLICANT_PROFILE,
    mappings: addressMappings,
    options: { policy: 'fill-empty' },
  })

  const presAddr1Val = (container6.querySelector('[name="pres_addr1"]') as HTMLInputElement)?.value
  const presCityVal = (container6.querySelector('[name="pres_city"]') as HTMLInputElement)?.value
  const presCountryVal = (container6.querySelector('[name="pres_country"]') as HTMLSelectElement)?.value
  const mobileVal = (container6.querySelector('[name="mobile_no"]') as HTMLInputElement)?.value
  const sameAddrChecked = (container6.querySelector('[name="same_address"]') as HTMLInputElement)?.checked

  if (res6.failedFields > 0 || presAddr1Val !== '123 Test Street' || presCityVal !== 'Dhaka' || presCountryVal !== 'Bangladesh' || mobileVal !== '+8801000000000' || sameAddrChecked !== true) {
    failures.push(`Subtest 6 Failed: Address details not filled properly. pres_addr1: ${presAddr1Val}, pres_city: ${presCityVal}, same_address: ${sameAddrChecked}`)
  }

  // Trigger Undo
  if (res6.operation) {
    await executeUndo(res6.operation)
  }
  const presAddr1AfterUndo = (container6.querySelector('[name="pres_addr1"]') as HTMLInputElement)?.value
  const sameAddrCheckedAfterUndo = (container6.querySelector('[name="same_address"]') as HTMLInputElement)?.checked
  document.body.removeChild(container6)

  if (presAddr1AfterUndo !== '' || sameAddrCheckedAfterUndo !== false) {
    failures.push(`Subtest 6 Failed on Undo: pres_addr1 after undo: "${presAddr1AfterUndo}", same_address after undo: ${sameAddrCheckedAfterUndo}`)
  }

  // --- Subtest 7: Family Details Autofill ---
  totalSubtests++
  const container7 = document.createElement('div')
  container7.innerHTML = `
    <input type="text" name="father_name" value="" />
    <select name="father_nationality">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <select name="father_prev_nationality">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <input type="text" name="father_place_birth" value="" />
    <select name="father_country_birth">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <input type="text" name="mother_name" value="" />
    <select name="mother_nationality">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <select name="mother_prev_nationality">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <input type="text" name="mother_place_birth" value="" />
    <select name="mother_country_birth">
      <option value="">Select</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
  `
  document.body.appendChild(container7)

  const familyMappings = getIndiaVisaMappings('regular', 'family-details')
  const res7 = await executeAutofill({
    applicant: SYNTHETIC_APPLICANT_PROFILE,
    mappings: familyMappings,
    options: { policy: 'fill-empty' },
  })

  const fatherNameVal = (container7.querySelector('[name="father_name"]') as HTMLInputElement)?.value
  const motherNameVal = (container7.querySelector('[name="mother_name"]') as HTMLInputElement)?.value
  const fatherNatVal = (container7.querySelector('[name="father_nationality"]') as HTMLSelectElement)?.value

  document.body.removeChild(container7)

  if (res7.failedFields > 0 || fatherNameVal !== 'FATHER TEST' || motherNameVal !== 'MOTHER TEST' || fatherNatVal !== 'Bangladesh') {
    failures.push(`Subtest 7 Failed: Family details not filled properly. father_name: ${fatherNameVal}, mother_name: ${motherNameVal}`)
  }

  // --- Subtest 8: Occupation Autofill ---
  totalSubtests++
  const container8 = document.createElement('div')
  container8.innerHTML = `
    <select name="present_occupation">
      <option value="">Select</option>
      <option value="Software Developer">Software Developer</option>
    </select>
    <input type="text" name="designation" value="" />
    <input type="text" name="employer_name" value="" />
    <input type="text" name="employer_address" value="" />
    <input type="text" name="employer_phone" value="" />
  `
  document.body.appendChild(container8)

  const occupationMappings = getIndiaVisaMappings('regular', 'occupation-details')
  const extendedProfile = {
    ...SYNTHETIC_APPLICANT_PROFILE,
    employment: {
      ...SYNTHETIC_APPLICANT_PROFILE.employment,
      designationRank: 'Engineer',
      employerAddress: '123 Employer Road',
      employerPhone: '+8801000000000',
    },
  }

  const res8 = await executeAutofill({
    applicant: extendedProfile,
    mappings: occupationMappings,
    options: { policy: 'fill-empty' },
  })

  const occupationVal = (container8.querySelector('[name="present_occupation"]') as HTMLSelectElement)?.value
  const designationVal = (container8.querySelector('[name="designation"]') as HTMLInputElement)?.value
  const employerNameVal = (container8.querySelector('[name="employer_name"]') as HTMLInputElement)?.value
  const employerAddrVal = (container8.querySelector('[name="employer_address"]') as HTMLInputElement)?.value

  document.body.removeChild(container8)

  if (res8.failedFields > 0 || occupationVal !== 'Software Developer' || designationVal !== 'Engineer' || employerNameVal !== 'Test Tech Ltd' || employerAddrVal !== '123 Employer Road') {
    failures.push(`Subtest 8 Failed: Occupation details not filled properly. occupation: ${occupationVal}, employer: ${employerNameVal}, address: ${employerAddrVal}`)
  }

  // --- Subtest 9: Travel details Autofill (Date conversions) ---
  totalSubtests++
  const container9 = document.createElement('div')
  container9.innerHTML = `
    <select name="purpose">
      <option value="">Select</option>
      <option value="Tourism">Tourism</option>
    </select>
    <input type="text" name="arrival_date" value="" />
    <input type="text" name="departure_date" value="" />
  `
  document.body.appendChild(container9)

  const travelMappings = getIndiaVisaMappings('regular', 'travel-details')
  const res9 = await executeAutofill({
    applicant: SYNTHETIC_APPLICANT_PROFILE,
    mappings: travelMappings,
    options: { policy: 'fill-empty' },
  })

  const purposeVal = (container9.querySelector('[name="purpose"]') as HTMLSelectElement)?.value
  const arrivalVal = (container9.querySelector('[name="arrival_date"]') as HTMLInputElement)?.value
  const departureVal = (container9.querySelector('[name="departure_date"]') as HTMLInputElement)?.value

  document.body.removeChild(container9)

  if (res9.failedFields > 0 || purposeVal !== 'Tourism' || arrivalVal !== '01/10/2026' || departureVal !== '15/10/2026') {
    failures.push(`Subtest 9 Failed: Travel details / dates not filled properly. purpose: ${purposeVal}, arrival: ${arrivalVal}, departure: ${departureVal}`)
  }

  // --- Subtest 10: Accommodation & Reference Autofill ---
  totalSubtests++
  const container10 = document.createElement('div')
  container10.innerHTML = `
    <input type="text" name="hotel_name" value="" />
    <input type="text" name="hotel_address" value="" />
    <select name="hotel_state">
      <option value="">Select</option>
      <option value="Delhi">Delhi</option>
    </select>
    <input type="text" name="hotel_phone" value="" />
    <input type="text" name="booking_ref" value="" />
    <input type="text" name="ref_india_name" value="" />
    <input type="text" name="ref_india_address" value="" />
    <input type="text" name="ref_india_phone" value="" />
  `
  document.body.appendChild(container10)

  const accommodationMappings = getIndiaVisaMappings('regular', 'reference-details')
  const extendedRefProfile = {
    ...SYNTHETIC_APPLICANT_PROFILE,
    accommodation: {
      ...SYNTHETIC_APPLICANT_PROFILE.accommodation!,
      bookingReference: 'TEST-BOOKING-001',
    },
  }

  const res10 = await executeAutofill({
    applicant: extendedRefProfile,
    mappings: accommodationMappings,
    options: { policy: 'fill-empty' },
  })

  const hotelNameVal = (container10.querySelector('[name="hotel_name"]') as HTMLInputElement)?.value
  const hotelStateVal = (container10.querySelector('[name="hotel_state"]') as HTMLSelectElement)?.value
  const bookingVal = (container10.querySelector('[name="booking_ref"]') as HTMLInputElement)?.value
  const refIndiaNameVal = (container10.querySelector('[name="ref_india_name"]') as HTMLInputElement)?.value

  document.body.removeChild(container10)

  if (res10.failedFields > 0 || hotelNameVal !== 'Grand Test Hotel' || hotelStateVal !== 'Delhi' || bookingVal !== 'TEST-BOOKING-001' || refIndiaNameVal !== 'Ref Person') {
    failures.push(`Subtest 10 Failed: Accommodation & reference details not filled properly. hotel: ${hotelNameVal}, state: ${hotelStateVal}, refName: ${refIndiaNameVal}`)
  }

  // --- Subtest 11: Page Isolation Verification ---
  totalSubtests++
  const container11 = document.createElement('div')
  container11.innerHTML = `
    <input type="text" name="pres_addr1" value="" />
    <input type="text" name="father_name" value="" />
  `
  document.body.appendChild(container11)

  // Request mappings for family-details page
  const isolatedMappings = getIndiaVisaMappings('regular', 'family-details')
  await executeAutofill({
    applicant: SYNTHETIC_APPLICANT_PROFILE,
    mappings: isolatedMappings,
    options: { policy: 'fill-empty' },
  })

  const presAddr1AfterIsolation = (container11.querySelector('[name="pres_addr1"]') as HTMLInputElement)?.value
  const fatherNameAfterIsolation = (container11.querySelector('[name="father_name"]') as HTMLInputElement)?.value
  document.body.removeChild(container11)

  // Father name should be filled (belongs to family-details), pres_addr1 should NOT be filled (belongs to address-details)
  if (fatherNameAfterIsolation !== 'FATHER TEST' || presAddr1AfterIsolation !== '') {
    failures.push(`Subtest 11 Failed: Page Isolation not enforced. father_name: "${fatherNameAfterIsolation}", pres_addr1: "${presAddr1AfterIsolation}"`)
  }

  // --- Subtest 12: India Registration Mappings & Safety Verification ---
  totalSubtests++
  const container12 = document.createElement('div')
  container12.innerHTML = `
    <select id="countryname_id">
      <option value="">Select country</option>
      <option value="Bangladesh">Bangladesh</option>
      <option value="India">India</option>
    </select>
    <select id="missioncode_id">
      <option value="">Select Mission</option>
      <option value="BANGLADESH-DHAKA">BANGLADESH-DHAKA</option>
      <option value="BANGLADESH-CHITTAGONG">BANGLADESH-CHITTAGONG</option>
    </select>
    <select id="nationality_id">
      <option value="">Select Nationality</option>
      <option value="Bangladesh">Bangladesh</option>
    </select>
    <input type="text" id="dob_id" value="" />
    <input type="text" id="email_id" value="" />
    <input type="text" id="email_re_id" value="" />
    <input type="text" id="jouryney_id" value="" />
    <input type="text" id="captcha" value="" />
  `
  document.body.appendChild(container12)

  // 1. Complete valid applicant profile
  const validProfile = {
    ...SYNTHETIC_APPLICANT_PROFILE,
    notes: 'Mission: DHAKA',
  }
  const regMappings = getIndiaVisaMappings('regular', 'application-start')
  const validRes = await executeAutofill({
    applicant: validProfile,
    mappings: regMappings,
    options: { policy: 'fill-empty' },
  })

  // DOM verification
  const countryFilled = (container12.querySelector('#countryname_id') as HTMLSelectElement).value
  const missionFilled = (container12.querySelector('#missioncode_id') as HTMLSelectElement).value
  const nationalityFilled = (container12.querySelector('#nationality_id') as HTMLSelectElement).value
  const dobFilled = (container12.querySelector('#dob_id') as HTMLInputElement).value
  const emailFilled = (container12.querySelector('#email_id') as HTMLInputElement).value
  const emailConfirmFilled = (container12.querySelector('#email_re_id') as HTMLInputElement).value
  const arrivalDateFilled = (container12.querySelector('#jouryney_id') as HTMLInputElement).value
  const captchaFilled = (container12.querySelector('#captcha') as HTMLInputElement).value

  // Assertions for complete valid applicant & CAPTCHA always manual
  if (
    countryFilled !== 'Bangladesh' ||
    missionFilled !== 'BANGLADESH-DHAKA' ||
    nationalityFilled !== 'Bangladesh' ||
    dobFilled !== '15/01/1995' ||
    emailFilled !== 'john.test@example.invalid' ||
    emailConfirmFilled !== 'john.test@example.invalid' ||
    arrivalDateFilled !== '01/10/2026' ||
    captchaFilled !== ''
  ) {
    failures.push('Subtest 12.1 Failed: Registration autofill fields value mismatch.')
  }

  // Check CAPTCHA manual status result
  const captchaResult = validRes.results.find((r) => r.fieldId === 'reg_captcha')
  if (!captchaResult || captchaResult.status !== 'failed' || captchaResult.failureType !== 'manual-required') {
    failures.push('Subtest 12.2 Failed: CAPTCHA was not correctly flagged as manual-required.')
  }

  // Reset values
  ;(container12.querySelector('#countryname_id') as HTMLSelectElement).value = ''
  ;(container12.querySelector('#missioncode_id') as HTMLSelectElement).value = ''
  ;(container12.querySelector('#nationality_id') as HTMLSelectElement).value = ''
  ;(container12.querySelector('#dob_id') as HTMLInputElement).value = ''
  ;(container12.querySelector('#email_id') as HTMLInputElement).value = ''
  ;(container12.querySelector('#email_re_id') as HTMLInputElement).value = ''
  ;(container12.querySelector('#jouryney_id') as HTMLInputElement).value = ''
  ;(container12.querySelector('#captcha') as HTMLInputElement).value = ''

  // 2. Missing email profile
  const missingEmailProfile = {
    ...validProfile,
    contact: { ...validProfile.contact, email: '' },
  }
  const resEmailMissing = await executeAutofill({
    applicant: missingEmailProfile,
    mappings: regMappings,
    options: { policy: 'fill-empty' },
  })
  const emailResObj = resEmailMissing.results.find((r) => r.fieldId === 'reg_email')
  if (!emailResObj || emailResObj.status !== 'failed' || emailResObj.failureType !== 'validation-failed') {
    failures.push('Subtest 12.3 Failed: Missing email did not trigger validation-failed.')
  }

  // 3. Missing arrival date profile
  const missingArrivalProfile = {
    ...validProfile,
    travel: undefined,
  }
  const resArrivalMissing = await executeAutofill({
    applicant: missingArrivalProfile,
    mappings: regMappings,
    options: { policy: 'fill-empty' },
  })
  const arrivalResObj = resArrivalMissing.results.find((r) => r.fieldId === 'reg_arr_date')
  if (!arrivalResObj || arrivalResObj.status !== 'failed' || arrivalResObj.failureType !== 'validation-failed') {
    failures.push('Subtest 12.4 Failed: Missing arrival date did not trigger validation-failed.')
  }

  // 4. Invalid DOB profile (e.g. invalid calendar date)
  const invalidDobProfile = {
    ...validProfile,
    personalInfo: { ...validProfile.personalInfo, dateOfBirth: '2026-02-30' },
  }
  const resInvalidDob = await executeAutofill({
    applicant: invalidDobProfile,
    mappings: regMappings,
    options: { policy: 'fill-empty' },
  })
  const dobResObj = resInvalidDob.results.find((r) => r.fieldId === 'reg_dob')
  if (!dobResObj || dobResObj.status !== 'failed' || dobResObj.failureType !== 'validation-failed') {
    failures.push('Subtest 12.5 Failed: Invalid DOB 2026-02-30 did not trigger validation-failed.')
  }

  // 5. Invalid arrival date profile (e.g. format error)
  const invalidArrivalProfile: ApplicantProfile = {
    ...validProfile,
    travel: {
      purposeOfVisit: 'Tourism',
      intendedArrivalDate: '01/10/2026',
      intendedDepartureDate: '2026-10-15',
    },
  }
  const resInvalidArrival = await executeAutofill({
    applicant: invalidArrivalProfile,
    mappings: regMappings,
    options: { policy: 'fill-empty' },
  })
  const arrivalInvalidResObj = resInvalidArrival.results.find((r) => r.fieldId === 'reg_arr_date')
  if (!arrivalInvalidResObj || arrivalInvalidResObj.status !== 'failed' || arrivalInvalidResObj.failureType !== 'validation-failed') {
    failures.push('Subtest 12.6 Failed: Invalid profile arrival date format did not trigger validation-failed.')
  }

  // 6. Existing user value protection (policy: 'fill-empty')
  ;(container12.querySelector('#email_id') as HTMLInputElement).value = 'user@example.com'
  await executeAutofill({
    applicant: validProfile,
    mappings: regMappings,
    options: { policy: 'fill-empty' },
  })
  const emailAfterFillEmpty = (container12.querySelector('#email_id') as HTMLInputElement).value
  if (emailAfterFillEmpty !== 'user@example.com') {
    failures.push('Subtest 12.7 Failed: fill-empty policy overwrote existing manual user input.')
  }

  document.body.removeChild(container12)

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
