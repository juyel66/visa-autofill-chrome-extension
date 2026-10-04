import { convertSavedApplicationToApplicantProfile } from '../applicationMerger'
import { resolveApplicantValue } from '../../autofill/valueResolver'
import { executeAutofill } from '../../autofill/autofillEngine'
import { findMatchingSelectOption } from '../../autofill/selectResolver'
import { BANGLADESH_BASIC_DETAILS_MAPPINGS } from '../../../countries/india/mappings/bangladesh/basicDetails'
import { BANGLADESH_VISA_DETAILS_MAPPINGS } from '../../../countries/india/mappings/bangladesh/visaDetails'
import type { SavedApplication } from '../types'

export async function runTask123Tests(): Promise<{ passed: boolean; failures: string[] }> {
  const failures: string[] = []
  let totalSubtests = 0

  function testAssert(condition: boolean, message: string) {
    totalSubtests++
    if (!condition) {
      failures.push(message)
      console.error(`  ❌ FAIL: ${message}`)
    } else {
      console.log(`  ✓ PASS: ${message}`)
    }
  }

  console.log('=== RUNNING TASK 123: RELIGION & COMPANY DETAILS WORKSPACE + AUTOFILL TESTS ===\n')

  // -------------------------------------------------------------------------
  // PART 1: RELIGION RESOLUTION FROM SAVED APPLICATION & WORKSPACE
  // -------------------------------------------------------------------------
  console.log('--- PART 1: RELIGION CONVERSION & RESOLUTION ---')
  {
    const savedApp = {
      applicationId: 'app_rel_1',
      applicantId: 'user_123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      fields: {
        'appl.religion': {
          value: 'ISLAM',
          source: 'manual',
          isUserEdited: true,
        },
      },
    }

    const profile = convertSavedApplicationToApplicantProfile(savedApp as unknown as SavedApplication)
    testAssert(profile.personalInfo?.religion === 'ISLAM', 'Test 1: profile.personalInfo.religion is converted from appl.religion')

    const resolvedVal = resolveApplicantValue(profile, 'personalInfo.religion')
    testAssert(resolvedVal === 'ISLAM', 'Test 2: resolveApplicantValue returns ISLAM for personalInfo.religion')

    const directKeyVal = resolveApplicantValue(profile, 'appl.religion')
    testAssert(directKeyVal === 'ISLAM', 'Test 3: resolveApplicantValue returns ISLAM for appl.religion')
  }

  {
    const savedApp = {
      applicationId: 'app_rel_2',
      applicantId: 'user_456',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      fields: {
        'appl.religion': {
          value: 'HINDUISM',
          source: 'manual',
          isUserEdited: true,
        },
      },
    }

    const profile = convertSavedApplicationToApplicantProfile(savedApp as unknown as SavedApplication)
    const resolvedVal = resolveApplicantValue(profile, 'personalInfo.religion')
    testAssert(resolvedVal === 'HINDUISM', 'Test 4: resolveApplicantValue returns HINDUISM for personalInfo.religion')
  }

  // -------------------------------------------------------------------------
  // PART 2: RELIGION DROPDOWN OPTION MATCHING WITH ALIASES
  // -------------------------------------------------------------------------
  console.log('--- PART 2: RELIGION DROPDOWN OPTION MATCHING ---')
  {
    // Test HINDUISM matches <option value="HINDU">HINDUISM</option>
    document.body.innerHTML = `
      <select id="religion" name="appl.religion">
        <option value="">Select Religion...</option>
        <option value="ISLAM">ISLAM</option>
        <option value="HINDU">HINDUISM</option>
        <option value="BUDDHISM">BUDDHISM</option>
        <option value="CHRISTIANITY">CHRISTIANITY</option>
        <option value="OTHERS">OTHERS</option>
      </select>
    `
    const selectEl = document.getElementById('religion') as HTMLSelectElement

    const matchIslam = findMatchingSelectOption(selectEl, 'ISLAM')
    testAssert(matchIslam.option?.value === 'ISLAM', 'Test 5: ISLAM matches option with value ISLAM')

    const matchHinduism = findMatchingSelectOption(selectEl, 'HINDUISM')
    testAssert(matchHinduism.option?.value === 'HINDU', 'Test 6: HINDUISM matches option with value HINDU and text HINDUISM')

    const matchHindu = findMatchingSelectOption(selectEl, 'HINDU')
    testAssert(matchHindu.option?.value === 'HINDU', 'Test 7: HINDU alias matches option with value HINDU')

    const matchMuslim = findMatchingSelectOption(selectEl, 'MUSLIM')
    testAssert(matchMuslim.option?.value === 'ISLAM', 'Test 8: MUSLIM alias matches option with value ISLAM')

    const matchChristian = findMatchingSelectOption(selectEl, 'CHRISTIAN')
    testAssert(matchChristian.option?.value === 'CHRISTIANITY', 'Test 9: CHRISTIAN alias matches option CHRISTIANITY')
  }

  // -------------------------------------------------------------------------
  // PART 3: DOM AUTOFILL EXECUTION FOR RELIGION
  // -------------------------------------------------------------------------
  console.log('--- PART 3: DOM AUTOFILL EXECUTION FOR RELIGION ---')
  {
    document.body.innerHTML = `
      <select id="religion" name="appl.religion">
        <option value="">Select Religion...</option>
        <option value="ISLAM">ISLAM</option>
        <option value="HINDU">HINDUISM</option>
        <option value="BUDDHISM">BUDDHISM</option>
        <option value="CHRISTIANITY">CHRISTIANITY</option>
      </select>
    `
    const savedApp = {
      applicationId: 'app_rel_3',
      applicantId: 'user_rel_3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      fields: {
        'appl.religion': {
          value: 'ISLAM',
          source: 'manual',
          isUserEdited: true,
        },
      },
    }

    const profile = convertSavedApplicationToApplicantProfile(savedApp as unknown as SavedApplication)
    const religionMapping = BANGLADESH_BASIC_DETAILS_MAPPINGS.filter((m) => m.id === 'bd_basic_religion')

    const result = await executeAutofill({
      mappings: religionMapping,
      applicant: profile,
    })

    const selectEl = document.getElementById('religion') as HTMLSelectElement
    testAssert(selectEl.value === 'ISLAM', 'Test 10: DOM #religion select is filled with ISLAM')
    testAssert(result.results[0]?.status === 'filled', 'Test 11: bd_basic_religion autofill status is filled')
  }

  // -------------------------------------------------------------------------
  // PART 4: COMPANY DETAILS WORKSPACE CONVERSION & VALUE RESOLUTION
  // -------------------------------------------------------------------------
  console.log('--- PART 4: COMPANY DETAILS WORKSPACE & RESOLUTION ---')
  {
    const savedApp = {
      applicationId: 'app_biz_1',
      applicantId: 'user_biz_1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      fields: {
        visa_type: { value: 'BUSINESS VISA', source: 'manual', isUserEdited: true },
        comp_name: { value: 'TECH CORP INDIA PVT LTD', source: 'manual', isUserEdited: true },
        comp_address: { value: '123 PARK STREET, KOLKATA, WEST BENGAL', source: 'manual', isUserEdited: true },
        comp_phone: { value: '+913322110099', source: 'manual', isUserEdited: true },
        comp_email: { value: 'contact@techcorpindia.com', source: 'manual', isUserEdited: true },
      },
    }

    const profile = convertSavedApplicationToApplicantProfile(savedApp as unknown as SavedApplication)
    testAssert(profile.travel?.businessCompanyName === 'TECH CORP INDIA PVT LTD', 'Test 12: travel.businessCompanyName converted from comp_name')
    testAssert(profile.travel?.businessCompanyAddress === '123 PARK STREET, KOLKATA, WEST BENGAL', 'Test 13: travel.businessCompanyAddress converted from comp_address')
    testAssert(profile.travel?.businessCompanyPhone === '+913322110099', 'Test 14: travel.businessCompanyPhone converted from comp_phone')
    testAssert(profile.travel?.businessCompanyEmail === 'contact@techcorpindia.com', 'Test 15: travel.businessCompanyEmail converted from comp_email')

    testAssert(resolveApplicantValue(profile, 'travel.businessCompanyName') === 'TECH CORP INDIA PVT LTD', 'Test 16: resolves travel.businessCompanyName')
    testAssert(resolveApplicantValue(profile, 'comp_name') === 'TECH CORP INDIA PVT LTD', 'Test 17: resolves comp_name')
    testAssert(resolveApplicantValue(profile, 'appl.comp_name') === 'TECH CORP INDIA PVT LTD', 'Test 18: resolves appl.comp_name')

    testAssert(resolveApplicantValue(profile, 'travel.businessCompanyAddress') === '123 PARK STREET, KOLKATA, WEST BENGAL', 'Test 19: resolves travel.businessCompanyAddress')
    testAssert(resolveApplicantValue(profile, 'comp_address') === '123 PARK STREET, KOLKATA, WEST BENGAL', 'Test 20: resolves comp_address')

    testAssert(resolveApplicantValue(profile, 'travel.businessCompanyPhone') === '+913322110099', 'Test 21: resolves travel.businessCompanyPhone')
    testAssert(resolveApplicantValue(profile, 'comp_phone') === '+913322110099', 'Test 22: resolves comp_phone')

    testAssert(resolveApplicantValue(profile, 'travel.businessCompanyEmail') === 'contact@techcorpindia.com', 'Test 23: resolves travel.businessCompanyEmail')
    testAssert(resolveApplicantValue(profile, 'comp_email') === 'contact@techcorpindia.com', 'Test 24: resolves comp_email')
  }

  // -------------------------------------------------------------------------
  // PART 5: DOM AUTOFILL EXECUTION FOR COMPANY DETAILS ON VISA DETAILS FORM
  // -------------------------------------------------------------------------
  console.log('--- PART 5: DOM AUTOFILL EXECUTION ON VISA DETAILS FORM ---')
  {
    document.body.innerHTML = `
      <form id="visaDetailsForm">
        <input type="text" id="comp_name" name="appl.comp_name" value="" />
        <input type="text" id="comp_address" name="appl.comp_address" value="" />
        <input type="text" id="comp_phone" name="appl.comp_phone" value="" />
        <input type="text" id="comp_email" name="appl.comp_email" value="" />
      </form>
    `

    const savedApp = {
      applicationId: 'app_biz_2',
      applicantId: 'user_biz_2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      fields: {
        comp_name: { value: 'TATA CONSULTANCY SERVICES', source: 'manual', isUserEdited: true },
        comp_address: { value: 'SECTOR V, SALT LAKE, KOLKATA 700091', source: 'manual', isUserEdited: true },
        comp_phone: { value: '+919876543210', source: 'manual', isUserEdited: true },
        comp_email: { value: 'india_office@tcs.com', source: 'manual', isUserEdited: true },
      },
    }

    const profile = convertSavedApplicationToApplicantProfile(savedApp as unknown as SavedApplication)
    const companyMappings = BANGLADESH_VISA_DETAILS_MAPPINGS.filter((m) =>
      ['bd_visa_comp_name', 'bd_visa_comp_address', 'bd_visa_comp_phone', 'bd_visa_comp_email'].includes(m.id)
    )

    testAssert(companyMappings.length === 4, 'Test 25: Found all 4 company mappings in BANGLADESH_VISA_DETAILS_MAPPINGS')

    const autofillRes = await executeAutofill({
      mappings: companyMappings,
      applicant: profile,
    })

    const elName = document.getElementById('comp_name') as HTMLInputElement
    const elAddr = document.getElementById('comp_address') as HTMLInputElement
    const elPhone = document.getElementById('comp_phone') as HTMLInputElement
    const elEmail = document.getElementById('comp_email') as HTMLInputElement

    testAssert(elName.value === 'TATA CONSULTANCY SERVICES', 'Test 26: DOM #comp_name filled with TATA CONSULTANCY SERVICES')
    testAssert(elAddr.value === 'SECTOR V, SALT LAKE, KOLKATA 700091', 'Test 27: DOM #comp_address filled with SECTOR V, SALT LAKE, KOLKATA 700091')
    testAssert(elPhone.value === '+919876543210', 'Test 28: DOM #comp_phone filled with +919876543210')
    testAssert(elEmail.value === 'india_office@tcs.com', 'Test 29: DOM #comp_email filled with india_office@tcs.com')

    testAssert(autofillRes.filledFields === 4, 'Test 30: All 4 company fields recorded as filled')
  }

  // -------------------------------------------------------------------------
  // PART 6: PORTAL FORM WITH ALTERNATIVE INPUT NAMES (comp_name instead of appl.comp_name)
  // -------------------------------------------------------------------------
  console.log('--- PART 6: ALTERNATIVE DOM SELECTOR COMPATIBILITY ---')
  {
    document.body.innerHTML = `
      <form id="visaDetailsFormVariant">
        <input type="text" name="comp_name" value="" />
        <input type="text" name="comp_address" value="" />
        <input type="text" name="comp_phone" value="" />
        <input type="text" name="comp_email" value="" />
      </form>
    `

    const savedApp = {
      applicationId: 'app_biz_3',
      applicantId: 'user_biz_3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      fields: {
        comp_name: { value: 'INFOSYS LIMITED', source: 'manual', isUserEdited: true },
        comp_address: { value: 'ELECTRONICS CITY, BANGALORE', source: 'manual', isUserEdited: true },
        comp_phone: { value: '+918028520261', source: 'manual', isUserEdited: true },
        comp_email: { value: 'askus@infosys.com', source: 'manual', isUserEdited: true },
      },
    }

    const profile = convertSavedApplicationToApplicantProfile(savedApp as unknown as SavedApplication)
    const companyMappings = BANGLADESH_VISA_DETAILS_MAPPINGS.filter((m) =>
      ['bd_visa_comp_name', 'bd_visa_comp_address', 'bd_visa_comp_phone', 'bd_visa_comp_email'].includes(m.id)
    )

    const autofillRes = await executeAutofill({
      mappings: companyMappings,
      applicant: profile,
    })

    const elName = document.querySelector('input[name="comp_name"]') as HTMLInputElement
    const elAddr = document.querySelector('input[name="comp_address"]') as HTMLInputElement
    const elPhone = document.querySelector('input[name="comp_phone"]') as HTMLInputElement
    const elEmail = document.querySelector('input[name="comp_email"]') as HTMLInputElement

    testAssert(elName.value === 'INFOSYS LIMITED', 'Test 31: Variant input[name="comp_name"] filled')
    testAssert(elAddr.value === 'ELECTRONICS CITY, BANGALORE', 'Test 32: Variant input[name="comp_address"] filled')
    testAssert(elPhone.value === '+918028520261', 'Test 33: Variant input[name="comp_phone"] filled')
    testAssert(elEmail.value === 'askus@infosys.com', 'Test 34: Variant input[name="comp_email"] filled')
    testAssert(autofillRes.filledFields === 4, 'Test 35: All 4 variant fields successfully filled')
  }

  console.log(`\nTask 123 Tests Completed: ${totalSubtests - failures.length}/${totalSubtests} Passed.`)
  if (failures.length > 0) {
    console.error(`Task 123 Failed with ${failures.length} errors:`)
    failures.forEach((f) => console.error(`  - ${f}`))
    return { passed: false, failures }
  }

  console.log('All Task 123 Tests Passed successfully!\n')
  return { passed: true, failures: [] }
}

if (process.argv[1] && process.argv[1].includes('task123ReligionAndCompanyFieldsAutofill.test.ts')) {
  runTask123Tests().then((res) => {
    if (!res.passed) {
      process.exit(1)
    }
  })
}
