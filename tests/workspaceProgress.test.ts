import './setup'
import assert from 'node:assert'
import {
  calculateWorkspaceProgress,
  isFieldApplicable,
  isFieldFilled,
} from '../src/core/application/workspaceProgress'
import type { SavedApplication, ApplicationFieldValue } from '../src/core/application/types'

function makeApplication(fields: Record<string, any> = {}): SavedApplication {
  const formattedFields: Record<string, ApplicationFieldValue> = {}

  for (const [key, val] of Object.entries(fields)) {
    if (val && typeof val === 'object' && 'value' in val) {
      formattedFields[key] = val
    } else {
      formattedFields[key] = {
        value: val,
        source: 'manual',
      }
    }
  }

  return {
    applicationId: 'test-appl-123',
    applicantId: 'test-user-456',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    provenance: {
      lastSavedAt: new Date().toISOString(),
    },
    sourceDocuments: {},
    manualEdits: {},
    fields: formattedFields,
  }
}

export function runWorkspaceProgressTests() {
  console.log('\n--- RUNNING WORKSPACE COMPLETION PROGRESS TESTS ---')
  let passed = 0

  function test(name: string, fn: () => void) {
    try {
      fn()
      console.log(`  ✓ ${name}`)
      passed++
    } catch (err: any) {
      console.error(`  ✗ ${name}`)
      console.error(err)
      throw err
    }
  }

  // 1. Partially populated application shows correct percentage
  test('1. Workspace opens with partially populated application -> correct percentage calculated', () => {
    const app = makeApplication({
      'appl.countryname': 'BANGLADESH',
      'appl.missioncode': 'BANGLADESH-DHAKA',
      'appl.nationality': 'BANGLADESH',
      'appl.birthdate': '12/10/1990',
      'appl.email': 'test@example.com',
      'appl.email_re': 'test@example.com',
      'appl.journeydate': '01/12/2026',
      'purpose': 'TOURISM',
      'marital_status': 'Single',
      'appl.oth_ppt': 'No',
      'old_visa_flag': 'No',
      'grandparent_flag': 'No',
      'prev_org': 'No',
      'refuse_flag': 'No',
      'saarc_flag': 'No',
      'question_1_flag': 'No',
      'question_2_flag': 'No',
      'question_3_flag': 'No',
      'question_4_flag': 'No',
      'question_5_flag': 'No',
      'question_6_flag': 'No',
    })

    const result = calculateWorkspaceProgress(app)
    assert(result.total > 0, 'Total applicable fields should be greater than 0')
    assert.strictEqual(result.filled, 21, 'Should have exactly 21 filled fields')
    const expectedPercentage = Math.round((21 / result.total) * 100)
    assert.strictEqual(result.percentage, expectedPercentage, 'Percentage should match formula')
    assert.strictEqual(result.isComplete, false, 'Should not be marked complete')
  })

  // 2. Fill one empty field increases percentage
  test('2. Fill one empty field -> percentage increases immediately', () => {
    const fields: Record<string, any> = {
      'appl.countryname': 'BANGLADESH',
      'marital_status': 'Single',
      'appl.oth_ppt': 'No',
      'old_visa_flag': 'No',
      'grandparent_flag': 'No',
      'prev_org': 'No',
      'refuse_flag': 'No',
      'saarc_flag': 'No',
    }

    const appBefore = makeApplication(fields)
    const progressBefore = calculateWorkspaceProgress(appBefore)

    // User fills occupation
    fields['occupation'] = 'BUSINESS'
    const appAfter = makeApplication(fields)
    const progressAfter = calculateWorkspaceProgress(appAfter)

    assert.strictEqual(progressAfter.filled, progressBefore.filled + 1, 'Filled count should increase by 1')
    assert(progressAfter.percentage >= progressBefore.percentage, 'Percentage should increase or remain integer equal')
  })

  // 3. Clear one filled field decreases percentage
  test('3. Clear one filled field -> percentage decreases immediately', () => {
    const fields: Record<string, any> = {
      'appl.countryname': 'BANGLADESH',
      'occupation': 'BUSINESS',
      'marital_status': 'Single',
      'appl.oth_ppt': 'No',
      'old_visa_flag': 'No',
      'grandparent_flag': 'No',
      'prev_org': 'No',
      'refuse_flag': 'No',
      'saarc_flag': 'No',
    }

    const appBefore = makeApplication(fields)
    const progressBefore = calculateWorkspaceProgress(appBefore)

    // User clears occupation to empty string
    fields['occupation'] = ''
    const appAfter = makeApplication(fields)
    const progressAfter = calculateWorkspaceProgress(appAfter)

    assert.strictEqual(progressAfter.filled, progressBefore.filled - 1, 'Filled count should decrease by 1')
    assert(progressAfter.percentage <= progressBefore.percentage, 'Percentage should decrease')
  })

  // 4. Fill multiple fields updates percentage accurately
  test('4. Fill multiple fields -> percentage updates accurately', () => {
    const fields: Record<string, any> = {
      'marital_status': 'Single',
      'appl.oth_ppt': 'No',
      'old_visa_flag': 'No',
      'grandparent_flag': 'No',
      'prev_org': 'No',
      'refuse_flag': 'No',
      'saarc_flag': 'No',
    }

    const appInitial = makeApplication(fields)
    const progressInitial = calculateWorkspaceProgress(appInitial)

    fields['appl.surname'] = 'ISLAM'
    fields['appl.applname'] = 'RAFIQUL'
    fields['appl.nic_no'] = '19882692518000123'

    const appMulti = makeApplication(fields)
    const progressMulti = calculateWorkspaceProgress(appMulti)

    assert.strictEqual(progressMulti.filled, progressInitial.filled + 3, 'Filled should increase by 3')
  })

  // 5. Existing default value counts as filled
  test('5. Existing default value counts as filled', () => {
    const app = makeApplication({
      'present_country': {
        value: 'BANGLADESH',
        source: 'default',
      },
    })
    const result = calculateWorkspaceProgress(app)
    assert(result.filledFields.includes('present_country'), 'present_country default should be counted as filled')
    assert.strictEqual(isFieldFilled(app.fields['present_country']), true)
  })

  // 6. Derived value counts as filled
  test('6. Derived value counts as filled', () => {
    const app = makeApplication({
      'appl.passport_issue_place': {
        value: 'DHAKA',
        source: 'derived',
      },
    })
    const result = calculateWorkspaceProgress(app)
    assert(result.filledFields.includes('appl.passport_issue_place'), 'derived field should be counted as filled')
    assert.strictEqual(isFieldFilled(app.fields['appl.passport_issue_place']), true)
  })

  // 7. Empty string does not count
  test('7. Empty string does not count as filled', () => {
    assert.strictEqual(isFieldFilled(''), false)
    assert.strictEqual(isFieldFilled({ value: '', source: 'manual' }), false)
  })

  // 8. Whitespace-only value does not count
  test('8. Whitespace-only string does not count as filled', () => {
    assert.strictEqual(isFieldFilled('   '), false)
    assert.strictEqual(isFieldFilled('\t\n  '), false)
    assert.strictEqual(isFieldFilled({ value: '   ', source: 'manual' }), false)
  })

  // 9. Null and undefined do not count
  test('9. Null and undefined do not count as filled', () => {
    assert.strictEqual(isFieldFilled(null), false)
    assert.strictEqual(isFieldFilled(undefined), false)
    assert.strictEqual(isFieldFilled({ value: null as any, source: 'missing' }), false)
    assert.strictEqual(isFieldFilled({ value: undefined as any, source: 'missing' }), false)
  })

  // 10. Boolean fields follow actual field semantics
  test('10. Boolean fields follow actual field semantics', () => {
    assert.strictEqual(isFieldFilled(true), true)
    assert.strictEqual(isFieldFilled({ value: true, source: 'manual' }), true)
    // Radio answers stored as 'Yes' or 'No' string are filled
    assert.strictEqual(isFieldFilled('Yes'), true)
    assert.strictEqual(isFieldFilled('No'), true)
    assert.strictEqual(isFieldFilled(0), true) // Numeric 0 (e.g. duration)
  })

  // 11. Conditional field hidden is not counted as unfilled
  test('11. Conditional field hidden is not counted in total', () => {
    const singleApp = makeApplication({
      marital_status: 'Single',
      appl_oth_ppt: 'No',
      old_visa_flag: 'No',
      grandparent_flag: 'No',
      prev_org: 'No',
      saarc_flag: 'No',
      refuse_flag: 'No',
    })

    const progress = calculateWorkspaceProgress(singleApp)

    // When Single, spouse fields must NOT be in applicableFields
    assert(!progress.applicableFields.includes('spouse_name'), 'spouse_name should not be applicable when Single')
    assert(!progress.applicableFields.includes('spouse_nationality'), 'spouse_nationality should not be applicable')
    assert(!progress.missingFields.includes('spouse_name'), 'spouse_name must not be penalized in missingFields')
    assert(!progress.applicableFields.includes('appl.oth_pptno'), 'other passport no should not be applicable')
    assert(!progress.applicableFields.includes('cities_visited'), 'cities_visited should not be applicable')
    assert(!progress.applicableFields.includes('previous_organization'), 'military org should not be applicable')
  })

  // 12. Conditional field becomes visible -> included in total
  test('12. Conditional field becomes visible -> included in total and updates completion', () => {
    const app = makeApplication({
      marital_status: 'Single',
      appl_oth_ppt: 'No',
      old_visa_flag: 'No',
      grandparent_flag: 'No',
      prev_org: 'No',
      refuse_flag: 'No',
      saarc_flag: 'No',
    })

    const singleProgress = calculateWorkspaceProgress(app)

    // User changes marital_status to 'Married'
    app.fields['marital_status'] = { value: 'Married', source: 'manual' }
    const marriedProgress = calculateWorkspaceProgress(app)

    // Total must increase by exactly 5 spouse fields
    assert.strictEqual(marriedProgress.total, singleProgress.total + 5, 'Total should increase by 5 spouse fields')
    assert(marriedProgress.applicableFields.includes('spouse_name'), 'spouse_name is now applicable')
    assert(marriedProgress.missingFields.includes('spouse_name'), 'spouse_name is initially unfilled')

    // Now fill spouse_name
    app.fields['spouse_name'] = { value: 'NAZMA BEGUM', source: 'manual' }
    const filledSpouseProgress = calculateWorkspaceProgress(app)
    assert.strictEqual(filledSpouseProgress.filled, marriedProgress.filled + 1, 'Filled should increase by 1')
  })

  // 13. Visited India conditional fields (8 fields)
  test('13. Visited India becomes Yes -> 8 previous visa fields added to total', () => {
    const app = makeApplication({
      old_visa_flag: 'No',
    })
    const noProgress = calculateWorkspaceProgress(app)

    app.fields['old_visa_flag'] = { value: 'Yes', source: 'manual' }
    const yesProgress = calculateWorkspaceProgress(app)

    assert.strictEqual(yesProgress.total, noProgress.total + 8, 'Total must increase by 8 old visa fields')
    assert(yesProgress.applicableFields.includes('old_visa_no'), 'old_visa_no is now applicable')
    assert(yesProgress.applicableFields.includes('cities_visited'), 'cities_visited is now applicable')
  })

  // 14. Military service conditional fields (4 fields)
  test('14. Military service becomes Yes -> 4 military fields added to total', () => {
    const app = makeApplication({
      prev_org: 'No',
    })
    const noProgress = calculateWorkspaceProgress(app)

    app.fields['prev_org'] = { value: 'Yes', source: 'manual' }
    const yesProgress = calculateWorkspaceProgress(app)

    assert.strictEqual(yesProgress.total, noProgress.total + 4, 'Total must increase by 4 military fields')
    assert(yesProgress.applicableFields.includes('previous_organization'), 'previous_organization is now applicable')
    assert(yesProgress.applicableFields.includes('previous_rank'), 'previous_rank is now applicable')
  })

  // 15. Additional questions 1-6 explanation fields
  test('15. Additional question flag Yes -> answer field added to total', () => {
    const app = makeApplication({
      question_1_flag: 'No',
      question_2_flag: 'No',
    })
    const noProgress = calculateWorkspaceProgress(app)
    assert(!noProgress.applicableFields.includes('answer_1'), 'answer_1 should not be applicable when No')

    app.fields['question_1_flag'] = { value: 'Yes', source: 'manual' }
    const yesProgress = calculateWorkspaceProgress(app)
    assert(yesProgress.applicableFields.includes('answer_1'), 'answer_1 should become applicable when Yes')
    assert.strictEqual(yesProgress.total, noProgress.total + 1)
  })

  // 16. Saved application restores correct progress
  test('16. Saved application restores correct progress immediately', () => {
    const savedApp = makeApplication({
      'appl.countryname': 'BANGLADESH',
      'appl.missioncode': 'BANGLADESH-DHAKA',
      'appl.nationality': 'BANGLADESH',
      'appl.birthdate': '15/05/1992',
      'appl.email': 'saved@example.com',
      'marital_status': 'Single',
      'appl.oth_ppt': 'No',
      'old_visa_flag': 'No',
      'grandparent_flag': 'No',
      'prev_org': 'No',
      'refuse_flag': 'No',
      'saarc_flag': 'No',
      'question_1_flag': 'No',
      'question_2_flag': 'No',
      'question_3_flag': 'No',
      'question_4_flag': 'No',
      'question_5_flag': 'No',
      'question_6_flag': 'No',
    })

    const progress1 = calculateWorkspaceProgress(savedApp)
    // Simulate serialized & deserialized JSON (as from chrome.storage or API)
    const reloadedApp = JSON.parse(JSON.stringify(savedApp))
    const progress2 = calculateWorkspaceProgress(reloadedApp)

    assert.strictEqual(progress1.total, progress2.total, 'Totals must match on reload')
    assert.strictEqual(progress1.filled, progress2.filled, 'Filled count must match on reload')
    assert.strictEqual(progress1.percentage, progress2.percentage, 'Percentage must match on reload')
  })

  // 17. 100% completion state
  test('17. 100% complete state when all applicable fields are filled', () => {
    // Generate a fully populated application
    const app = makeApplication({
      marital_status: 'Single',
      appl_oth_ppt: 'No',
      old_visa_flag: 'No',
      grandparent_flag: 'No',
      prev_org: 'No',
      refuse_flag: 'No',
      saarc_flag: 'No',
      question_1_flag: 'No',
      question_2_flag: 'No',
      question_3_flag: 'No',
      question_4_flag: 'No',
      question_5_flag: 'No',
      question_6_flag: 'No',
    })

    const currentProgress = calculateWorkspaceProgress(app)
    // Fill all missing applicable fields
    currentProgress.missingFields.forEach((key) => {
      app.fields[key] = { value: 'VALID_VALUE', source: 'manual' }
    })

    const fullProgress = calculateWorkspaceProgress(app)
    assert.strictEqual(fullProgress.missing, 0, 'No fields should remain missing')
    assert.strictEqual(fullProgress.filled, fullProgress.total, 'Filled must equal total')
    assert.strictEqual(fullProgress.percentage, 100, 'Percentage must be 100%')
    assert.strictEqual(fullProgress.isComplete, true, 'isComplete must be true')
  })

  // 18. Alias handling: purpose / appl.purpose
  test('18. Field aliases are counted as filled when set under either key', () => {
    const appWithPurpose = makeApplication({
      'purpose': 'TOURISM',
    })
    const appWithApplPurpose = makeApplication({
      'appl.purpose': 'TOURISM',
    })

    const res1 = calculateWorkspaceProgress(appWithPurpose)
    const res2 = calculateWorkspaceProgress(appWithApplPurpose)

    assert(res1.filledFields.includes('purpose'), 'purpose should be filled')
    assert(res2.filledFields.includes('purpose'), 'purpose should be filled via appl.purpose alias')
  })

  // 19. Page progress breakdown
  test('19. Page progress breakdown tracks each page accurately', () => {
    const app = makeApplication({
      'appl.countryname': 'BANGLADESH',
      'appl.missioncode': 'BANGLADESH-DHAKA',
      'appl.nationality': 'BANGLADESH',
    })

    const result = calculateWorkspaceProgress(app)
    assert(result.pageProgress['registration'] !== undefined, 'registration page exists')
    assert(result.pageProgress['registration'].total > 0, 'registration page has total fields')
    assert(result.pageProgress['registration'].filled >= 3, 'registration page has at least 3 filled')
    assert(result.pageProgress['basicDetails'] !== undefined, 'basicDetails page exists')
  })

  // 20. Read-only guarantee: calculateWorkspaceProgress never mutates application state
  test('20. Read-only guarantee: input application object is never mutated', () => {
    const app = makeApplication({
      'appl.countryname': 'BANGLADESH',
      'occupation': '',
    })

    const fieldsSnapshotBefore = JSON.stringify(app.fields)
    calculateWorkspaceProgress(app)
    const fieldsSnapshotAfter = JSON.stringify(app.fields)

    assert.strictEqual(fieldsSnapshotBefore, fieldsSnapshotAfter, 'application.fields must remain unchanged')
  })

  console.log(`\nALL ${passed} WORKSPACE PROGRESS TESTS PASSED SUCCESSFULLY!`)
}

// Auto-run if executed directly via tsx
runWorkspaceProgressTests()
