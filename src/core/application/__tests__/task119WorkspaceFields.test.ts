import { populateApplicationFromDocuments } from '../applicationMerger'
import type { DocumentRecord } from '../../document/types'
import type { ExtractedField, ExtractedApplicantData, ExtractionSource } from '../../extraction/data/types'

function ef<T>(value: T, source: ExtractionSource = 'ocr'): ExtractedField<T> {
  return { value, source, confidence: 95 }
}

function createDoc(id: string, extractedData: ExtractedApplicantData): DocumentRecord {
  return {
    documentId: id,
    applicantId: 'app_' + id,
    documentType: 'passport',
    fileName: `${id}.pdf`,
    fileSize: 1000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData,
    extractedDataConfirmed: true,
  }
}

export async function runTask119Tests(): Promise<{ passed: boolean; failures: string[] }> {
  const failures: string[] = []
  let totalSubtests = 0

  function assert(condition: boolean, message: string) {
    totalSubtests++
    if (!condition) {
      failures.push(message)
      console.error(`  ❌ FAIL: ${message}`)
    } else {
      console.log(`  ✓ PASS: ${message}`)
    }
  }

  console.log('=== RUNNING TASK 119: WORKSPACE FIELDS, FAMILY DEFAULTS & MARITAL STATUS TESTS ===\n')

  // -------------------------------------------------------------------------
  // 1. Applicant Country of Birth
  // -------------------------------------------------------------------------
  console.log('--- 1. Applicant Country of Birth ---')
  {
    // Missing country of birth defaults to BANGLADESH (derived)
    const docMissingCob = createDoc('cob_1', {
      personal: { firstName: ef('JOTIMOY') }
    })
    const appMissingCob = populateApplicationFromDocuments({
      applicantId: 'app_cob_1',
      passportDoc: docMissingCob
    })
    assert(
      appMissingCob.fields['appl.country_of_birth']?.value === 'BANGLADESH',
      '1.1: Missing applicant country of birth defaults to BANGLADESH'
    )
    assert(
      appMissingCob.fields['appl.country_of_birth']?.source === 'derived',
      '1.2: Missing applicant country of birth has source "derived"'
    )

    // Explicit country of birth (INDIA) is preserved
    const docExplicitCob = createDoc('cob_2', {
      personal: {
        firstName: ef('JOTIMOY'),
        countryOfBirth: ef('INDIA')
      }
    })
    const appExplicitCob = populateApplicationFromDocuments({
      applicantId: 'app_cob_2',
      passportDoc: docExplicitCob
    })
    assert(
      appExplicitCob.fields['appl.country_of_birth']?.value === 'INDIA',
      '1.3: Explicit country of birth INDIA is preserved'
    )
    assert(
      appExplicitCob.fields['appl.country_of_birth']?.source === 'passport',
      '1.4: Explicit country of birth has source "passport"'
    )

    // BGD code normalized to BANGLADESH
    const docBgdCob = createDoc('cob_3', {
      personal: {
        firstName: ef('JOTIMOY'),
        countryOfBirth: ef('BGD')
      }
    })
    const appBgdCob = populateApplicationFromDocuments({
      applicantId: 'app_cob_3',
      passportDoc: docBgdCob
    })
    assert(
      appBgdCob.fields['appl.country_of_birth']?.value === 'BANGLADESH',
      '1.5: BGD code normalized to BANGLADESH'
    )
  }

  // -------------------------------------------------------------------------
  // 2 & 3. Father & Mother Previous Nationality
  // -------------------------------------------------------------------------
  console.log('\n--- 2 & 3. Father & Mother Previous Nationality ---')
  {
    // When father exists in Bangladeshi applicant, previous nationality is BANGLADESH (derived)
    const docWithParents = createDoc('parents_1', {
      personal: {
        firstName: ef('JOTIMOY'),
        nationality: ef('BANGLADESH'),
        townCityOfBirth: ef('THAKURGAON')
      },
      family: {
        father: {
          name: ef('SHREE KHIDAR MOHAN')
        },
        mother: {
          name: ef('PANCHAMI RANI')
        }
      }
    })
    const appParents = populateApplicationFromDocuments({
      applicantId: 'app_p_1',
      passportDoc: docWithParents
    })
    assert(
      appParents.fields['father_prev_nationality']?.value === 'BANGLADESH',
      '2.1: Father previous nationality defaults to BANGLADESH when father exists'
    )
    assert(
      appParents.fields['father_prev_nationality']?.source === 'derived',
      '2.2: Father previous nationality source is derived'
    )
    assert(
      appParents.fields['father_nationality']?.value === 'BANGLADESH',
      '2.3: Father current nationality is BANGLADESH'
    )
    assert(
      appParents.fields['mother_prev_nationality']?.value === 'BANGLADESH',
      '3.1: Mother previous nationality defaults to BANGLADESH when mother exists'
    )
    assert(
      appParents.fields['mother_prev_nationality']?.source === 'derived',
      '3.2: Mother previous nationality source is derived'
    )
    assert(
      appParents.fields['mother_nationality']?.value === 'BANGLADESH',
      '3.3: Mother current nationality is BANGLADESH'
    )

    // When father / mother do NOT exist, do NOT fabricate records
    const docNoParents = createDoc('no_parents', {
      personal: { firstName: ef('ALONE') }
    })
    const appNoParents = populateApplicationFromDocuments({
      applicantId: 'app_no_p',
      passportDoc: docNoParents
    })
    assert(
      appNoParents.fields['fthrname']?.value === '',
      '2.4: Father name is blank when not in doc'
    )
    assert(
      appNoParents.fields['father_prev_nationality']?.value === '',
      '2.5: Father prev nationality stays blank when father does not exist'
    )
    assert(
      appNoParents.fields['mother_prev_nationality']?.value === '',
      '3.4: Mother prev nationality stays blank when mother does not exist'
    )
  }

  // -------------------------------------------------------------------------
  // 4 & 5. Father & Mother Place of Birth
  // -------------------------------------------------------------------------
  console.log('\n--- 4 & 5. Father & Mother Place of Birth ---')
  {
    // Missing parent birthplace falls back to applicant extracted place of birth
    const docWithApplicantPob = createDoc('pob_1', {
      personal: {
        townCityOfBirth: ef('THAKURGAON')
      },
      family: {
        father: { name: ef('SHREE KHIDAR MOHAN') },
        mother: { name: ef('PANCHAMI RANI') }
      }
    })
    const appPob = populateApplicationFromDocuments({
      applicantId: 'app_pob_1',
      passportDoc: docWithApplicantPob
    })
    assert(
      appPob.fields['father_place_of_birth']?.value === 'THAKURGAON',
      '4.1: Father place of birth falls back to applicant place of birth'
    )
    assert(
      appPob.fields['father_place_of_birth']?.source === 'derived',
      '4.2: Father place of birth has source derived'
    )
    assert(
      appPob.fields['mother_place_of_birth']?.value === 'THAKURGAON',
      '5.1: Mother place of birth falls back to applicant place of birth'
    )
    assert(
      appPob.fields['mother_place_of_birth']?.source === 'derived',
      '5.2: Mother place of birth has source derived'
    )

    // Explicit father birthplace is NEVER overwritten
    const docExplicitParentPob = createDoc('pob_2', {
      personal: { townCityOfBirth: ef('THAKURGAON') },
      family: {
        father: { name: ef('SHREE KHIDAR MOHAN'), placeOfBirth: ef('DHAKA') },
        mother: { name: ef('PANCHAMI RANI'), placeOfBirth: ef('CHITTAGONG') }
      }
    })
    const appExplicitParentPob = populateApplicationFromDocuments({
      applicantId: 'app_pob_2',
      passportDoc: docExplicitParentPob
    })
    assert(
      appExplicitParentPob.fields['father_place_of_birth']?.value === 'DHAKA',
      '4.3: Explicit father birthplace DHAKA is preserved'
    )
    assert(
      appExplicitParentPob.fields['mother_place_of_birth']?.value === 'CHITTAGONG',
      '5.3: Explicit mother birthplace CHITTAGONG is preserved'
    )
  }

  // -------------------------------------------------------------------------
  // 6. Applicant Marital Status Resolution
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Applicant Marital Status Resolution ---')
  {
    // Spouse present -> MARRIED
    const docWithSpouse = createDoc('sp_1', {
      family: {
        spouse: { name: ef('JASHODA RANI') }
      }
    })
    const appMarried = populateApplicationFromDocuments({
      applicantId: 'app_m_1',
      passportDoc: docWithSpouse
    })
    assert(
      appMarried.fields['marital_status']?.value === 'Married',
      '6.1: Spouse present -> Marital status Married'
    )
    assert(
      appMarried.fields['marital_status']?.source === 'derived',
      '6.2: Marital status source is derived'
    )

    // No spouse -> SINGLE
    const docNoSpouse = createDoc('sp_0', {
      personal: { firstName: ef('JOTIMOY') }
    })
    const appSingle = populateApplicationFromDocuments({
      applicantId: 'app_s_1',
      passportDoc: docNoSpouse
    })
    assert(
      appSingle.fields['marital_status']?.value === 'Single',
      '6.3: No spouse -> Marital status Single'
    )
    assert(
      appSingle.fields['marital_status']?.source === 'derived',
      '6.4: Single marital status source is derived'
    )
  }

  // -------------------------------------------------------------------------
  // 7 & 8. Spouse Details & Defaults
  // -------------------------------------------------------------------------
  console.log('\n--- 7 & 8. Spouse Details & Defaults ---')
  {
    const docMarried = createDoc('sp_full', {
      personal: {
        nationality: ef('BANGLADESH'),
      },
      family: {
        spouse: { name: ef('JASHODA RANI') }
      }
    })
    const appSpouse = populateApplicationFromDocuments({
      applicantId: 'app_sp_full',
      passportDoc: docMarried
    })
    assert(
      appSpouse.fields['spouse_name']?.value === 'JASHODA RANI',
      '7.1: Spouse name populated from document'
    )
    assert(
      appSpouse.fields['spouse_nationality']?.value === 'BANGLADESH',
      '7.2: Spouse nationality defaults to BANGLADESH'
    )
    assert(
      appSpouse.fields['spouse_nationality']?.source === 'derived',
      '7.3: Spouse nationality source is derived'
    )
    assert(
      appSpouse.fields['spouse_prev_nationality']?.value === 'BANGLADESH',
      '7.4: Spouse previous nationality defaults to BANGLADESH'
    )
    assert(
      appSpouse.fields['spouse_place_of_birth']?.value === 'BANGLADESH',
      '8.1: Spouse place of birth defaults to BANGLADESH'
    )
    assert(
      appSpouse.fields['spouse_place_of_birth']?.source === 'derived',
      '8.2: Spouse place of birth source is derived'
    )
    assert(
      appSpouse.fields['spouse_country_of_birth']?.value === 'BANGLADESH',
      '8.3: Spouse country of birth defaults to BANGLADESH'
    )

    // Explicit foreign spouse birthplace and nationality preserved
    const docForeignSpouse = createDoc('sp_foreign', {
      family: {
        spouse: {
          name: ef('PRIYA SHARMA'),
          nationality: ef('INDIA'),
          placeOfBirth: ef('KOLKATA'),
          countryOfBirth: ef('INDIA')
        }
      }
    })
    const appForeignSpouse = populateApplicationFromDocuments({
      applicantId: 'app_foreign_sp',
      passportDoc: docForeignSpouse
    })
    assert(
      appForeignSpouse.fields['spouse_nationality']?.value === 'INDIA',
      '7.5: Explicit foreign spouse nationality INDIA preserved'
    )
    assert(
      appForeignSpouse.fields['spouse_place_of_birth']?.value === 'KOLKATA',
      '8.4: Explicit foreign spouse place of birth KOLKATA preserved'
    )
    assert(
      appForeignSpouse.fields['spouse_country_of_birth']?.value === 'INDIA',
      '8.5: Explicit foreign spouse country of birth INDIA preserved'
    )
  }

  // -------------------------------------------------------------------------
  // 9, 10, 11. Passport Dates & Current vs Previous Passport Separation
  // -------------------------------------------------------------------------
  console.log('\n--- 9, 10, 11. Passport Dates & Current vs Previous Separation ---')
  {
    const docPassportDates = createDoc('ppt_dates', {
      passport: {
        passportNumber: ef('A21496961'),
        issueDate: ef('2026-01-20'),
        expiryDate: ef('2031-01-19'),
        placeOfIssue: ef('DIP / DHAKA')
      }
    })
    const appDates = populateApplicationFromDocuments({
      applicantId: 'app_dates',
      passportDoc: docPassportDates
    })
    assert(
      appDates.fields['appl.passport_issue_date']?.value === '20/01/2026',
      '9.1: Current passport issue date formatted as DD/MM/YYYY (20/01/2026)'
    )
    assert(
      appDates.fields['appl.passport_issue_date']?.source === 'passport',
      '9.2: Current passport issue date has source passport'
    )
    assert(
      appDates.fields['appl.passport_expiry_date']?.value === '19/01/2031',
      '10.1: Current passport expiry date formatted as DD/MM/YYYY (19/01/2031)'
    )
    assert(
      appDates.fields['appl.passport_expiry_date']?.source === 'passport',
      '10.2: Current passport expiry date has source passport'
    )

    // Verify previous passport fields are completely separated and unpopulated by current passport
    assert(
      appDates.fields['appl.oth_pptno']?.value === '',
      '11.1: Previous passport number is empty'
    )
    assert(
      appDates.fields['appl.oth_ppt_issue_date']?.value === '',
      '11.2: Previous passport issue date is empty (not contaminated by current issue date)'
    )
    assert(
      appDates.fields['appl.oth_ppt_issue_place']?.value === '',
      '11.3: Previous passport issue place is empty'
    )
  }

  // -------------------------------------------------------------------------
  // 12. Manual Edit Precedence
  // -------------------------------------------------------------------------
  console.log('\n--- 12. Manual Edit Precedence & Persistence ---')
  {
    const docForManual = createDoc('manual_doc', {
      personal: {
        townCityOfBirth: ef('THAKURGAON')
      },
      family: {
        father: { name: ef('SHREE KHIDAR MOHAN') },
        mother: { name: ef('PANCHAMI RANI') },
        spouse: { name: ef('JASHODA RANI') }
      }
    })
    const baseApp = populateApplicationFromDocuments({
      applicantId: 'app_manual',
      passportDoc: docForManual
    })

    // Simulate user manual overrides
    baseApp.fields['appl.country_of_birth'] = { value: 'INDIA', source: 'manual', isUserEdited: true }
    baseApp.manualEdits['appl.country_of_birth'] = true
    baseApp.fields['father_prev_nationality'] = { value: 'INDIA', source: 'manual', isUserEdited: true }
    baseApp.manualEdits['father_prev_nationality'] = true
    baseApp.fields['mother_prev_nationality'] = { value: 'INDIA', source: 'manual', isUserEdited: true }
    baseApp.manualEdits['mother_prev_nationality'] = true
    baseApp.fields['father_place_of_birth'] = { value: 'DHAKA', source: 'manual', isUserEdited: true }
    baseApp.manualEdits['father_place_of_birth'] = true
    baseApp.fields['marital_status'] = { value: 'Married', source: 'manual', isUserEdited: true }
    baseApp.manualEdits['marital_status'] = true
    baseApp.fields['spouse_place_of_birth'] = { value: 'CHITTAGONG', source: 'manual', isUserEdited: true }
    baseApp.manualEdits['spouse_place_of_birth'] = true

    // Re-populate passing existingApp (simulates reload with saved manual edits)
    const reloadedApp = populateApplicationFromDocuments({
      applicantId: 'app_manual',
      passportDoc: docForManual,
      existingApp: baseApp
    })

    assert(
      reloadedApp.fields['appl.country_of_birth']?.value === 'INDIA' && reloadedApp.fields['appl.country_of_birth']?.source === 'manual',
      '12.1: Manual Country of Birth INDIA preserved over derived default'
    )
    assert(
      reloadedApp.fields['father_prev_nationality']?.value === 'INDIA' && reloadedApp.fields['father_prev_nationality']?.source === 'manual',
      '12.2: Manual Father Previous Nationality INDIA preserved'
    )
    assert(
      reloadedApp.fields['mother_prev_nationality']?.value === 'INDIA' && reloadedApp.fields['mother_prev_nationality']?.source === 'manual',
      '12.3: Manual Mother Previous Nationality INDIA preserved'
    )
    assert(
      reloadedApp.fields['father_place_of_birth']?.value === 'DHAKA' && reloadedApp.fields['father_place_of_birth']?.source === 'manual',
      '12.4: Manual Father Place of Birth DHAKA preserved'
    )
    assert(
      reloadedApp.fields['spouse_place_of_birth']?.value === 'CHITTAGONG' && reloadedApp.fields['spouse_place_of_birth']?.source === 'manual',
      '12.5: Manual Spouse Place of Birth CHITTAGONG preserved'
    )
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n==================================================')
  if (failures.length === 0) {
    console.log('TASK 119 TESTS RESULT: ✅ ALL PASSED')
  } else {
    console.log('TASK 119 TESTS RESULT: ❌ FAILED')
  }
  console.log(`Total assertions: ${totalSubtests}`)
  console.log(`Passed: ${totalSubtests - failures.length}`)
  console.log(`Failed: ${failures.length}`)
  if (failures.length > 0) {
    console.log('Failures:')
    failures.forEach((f) => console.log(`  - ${f}`))
  }
  console.log('==================================================\n')

  return {
    passed: failures.length === 0,
    failures
  }
}

if (process.argv[1] && process.argv[1].includes('task119WorkspaceFields.test.ts')) {
  runTask119Tests().then((res) => {
    process.exit(res.passed ? 0 : 1)
  })
}
