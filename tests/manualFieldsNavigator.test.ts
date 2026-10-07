import assert from 'node:assert'
import { JSDOM } from 'jsdom'
import type { SavedApplication } from '../src/core/application/types'
import {
  MANUAL_FIELDS_REGISTRY,
  getManualFieldsStatus,
  navigateToManualField,
  setActiveManualFieldHighlight,
  clearActiveManualFieldHighlight,
  checkAndClearActiveTargetIfFilled,
  getActiveTargetFieldId,
  isBlankValue,
  type ManualFieldDefinition,
} from '../src/application/manualFieldsRegistry'

console.log('==================================================')
console.log('STARTING MANUAL ENTRY NAVIGATOR TEST SUITE')
console.log('==================================================')

let totalSubtests = 0
const failures: string[] = []

function check(desc: string, fn: () => void) {
  totalSubtests++
  try {
    fn()
    console.log(`  ✓ PASS: ${desc}`)
  } catch (err: any) {
    console.error(`  ✕ FAIL: ${desc} -> ${err.message}`)
    failures.push(`${desc} -> ${err.message}`)
  }
}

// Base blank application
const emptyApp: SavedApplication = {
  applicantId: 'test-applicant-001',
  status: 'draft',
  updatedAt: new Date().toISOString(),
  fields: {},
  manualEdits: {},
}

// -----------------------------------------------------------------------------
// TEST SUITE 1: Canonical Manual Field Registry Integrity
// -----------------------------------------------------------------------------
console.log('\n--- 1. CANONICAL REGISTRY INTEGRITY ---')

check('Registry contains all core required manual fields and comprehensive workspace fields', () => {
  const ids = MANUAL_FIELDS_REGISTRY.map((f) => f.id)
  // Core fields
  assert(ids.includes('appl.email'), 'Must include appl.email')
  assert(ids.includes('appl.email_re'), 'Must include appl.email_re')
  assert(ids.includes('appl.journeydate') || ids.includes('journeydate'), 'Must include arrival date')
  assert(ids.includes('purpose'), 'Must include purpose')
  assert(ids.includes('applicant-photo'), 'Must include applicant-photo')
  assert(ids.includes('duration'), 'Must include duration')
  assert(ids.includes('visa_entry_id'), 'Must include visa_entry_id')
  assert(ids.includes('entrypoint'), 'Must include entrypoint')
  assert(ids.includes('exitpoint'), 'Must include exitpoint')
  assert(ids.includes('question_1_flag'), 'Must include question_1_flag')
  assert(ids.includes('question_2_flag'), 'Must include question_2_flag')
  assert(ids.includes('question_3_flag'), 'Must include question_3_flag')
  assert(ids.includes('question_4_flag'), 'Must include question_4_flag')
  assert(ids.includes('question_5_flag'), 'Must include question_5_flag')
  assert(ids.includes('question_6_flag'), 'Must include question_6_flag')

  // User Screenshot fields: Profession & Employment
  assert(ids.includes('occupation'), 'Must include occupation (Present Occupation)')
  assert(ids.includes('empname'), 'Must include empname (Employer Name/business)')
  assert(ids.includes('empdesignation'), 'Must include empdesignation (Designation)')
  assert(ids.includes('empaddress'), 'Must include empaddress (Address)')
  assert(ids.includes('empphone'), 'Must include empphone (Phone)')
  assert(ids.includes('previous_occupation'), 'Must include previous_occupation')
  assert(ids.includes('prev_org'), 'Must include prev_org')

  // Family, Address & Basic Details
  assert(ids.includes('appl.surname'), 'Must include appl.surname')
  assert(ids.includes('appl.applname'), 'Must include appl.applname')
  assert(ids.includes('appl.passport_number'), 'Must include appl.passport_number')
  assert(ids.includes('pres_addr1'), 'Must include pres_addr1')
  assert(ids.includes('fthrname'), 'Must include fthrname')
  assert(ids.includes('mother_name'), 'Must include mother_name')
  assert(ids.includes('nameofsponsor_ind'), 'Must include nameofsponsor_ind')
})

check('All registry entries have stable data-field-id and domSelector', () => {
  for (const field of MANUAL_FIELDS_REGISTRY) {
    assert(field.dataFieldId && field.dataFieldId.length > 0, `${field.id} must have dataFieldId`)
    assert(field.domSelector && field.domSelector.length > 0, `${field.id} must have domSelector`)
    assert(field.sectionId && field.sectionId.length > 0, `${field.id} must have sectionId`)
    assert(field.label && field.label.length > 0, `${field.id} must have label`)
  }
})

check('isBlankValue detects null, undefined, empty, and whitespace-only strings correctly', () => {
  assert.strictEqual(isBlankValue(null), true)
  assert.strictEqual(isBlankValue(undefined), true)
  assert.strictEqual(isBlankValue(''), true)
  assert.strictEqual(isBlankValue('    '), true)
  assert.strictEqual(isBlankValue('valid string'), false)
  assert.strictEqual(isBlankValue(false), false)
  assert.strictEqual(isBlankValue(0), false)
})

// -----------------------------------------------------------------------------
// TEST SUITE 2: User Specifications (TEST 1 to TEST 10)
// -----------------------------------------------------------------------------
console.log('\n--- 2. USER SCENARIOS TEST 1 TO TEST 10 ---')

// TEST 1: Several manual fields blank -> Navbar shows correct count
check('TEST 1: Navbar shows correct count when manual fields are blank', () => {
  const status = getManualFieldsStatus(emptyApp)
  assert(status.blankCount > 0, 'Blank count should be positive on empty application')
  assert.strictEqual(status.blankCount, status.totalCount, 'All applicable fields on emptyApp should be blank')
  assert.strictEqual(status.completedCount, 0, 'No fields completed on emptyApp')
})

// TEST 2: Click Manual Entry -> Only blank manual fields appear
check('TEST 2: Manual entry list contains ONLY blank manual fields', () => {
  const partialApp: SavedApplication = {
    ...emptyApp,
    fields: {
      'appl.email': { value: 'user@example.com', source: 'manual', isUserEdited: true },
      'appl.email_re': { value: 'user@example.com', source: 'manual', isUserEdited: true },
    },
  }
  const status = getManualFieldsStatus(partialApp)
  assert.strictEqual(status.completedCount, 2)
  assert.strictEqual(status.blankCount, status.totalCount - 2)
  const blankIds = status.needsAttention.map((i) => i.definition.id)
  assert(!blankIds.includes('appl.email'), 'Filled Email ID must NOT appear in blank list')
  assert(!blankIds.includes('appl.email_re'), 'Filled Re-enter Email ID must NOT appear in blank list')
  assert(blankIds.includes('appl.journeydate'), 'Blank Arrival date MUST appear in blank list')
  assert(blankIds.includes('purpose'), 'Blank Purpose MUST appear in blank list')
  assert(blankIds.includes('occupation'), 'Blank Present Occupation MUST appear in blank list')
  assert(blankIds.includes('empname'), 'Blank Employer Name MUST appear in blank list')
})

// TEST 3: Click Email ID -> Workspace scrolls to Email ID, Email ID gets yellow animated border/glow
check('TEST 3: Navigating to Email ID focuses, scrolls, and starts yellow animation', () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <section id="sec-registration">
          <input id="email_id" data-field-id="appl.email" type="text" value="" />
          <input id="email_re_id" data-field-id="appl.email_re" type="text" value="" />
          <input id="journey_id" data-field-id="appl.journeydate" type="text" value="" />
          <div id="purpose_id_trigger" data-field-id="purpose">Select Purpose</div>
        </section>
      </body>
    </html>
  `)

  ;(globalThis as any).document = dom.window.document
  ;(globalThis as any).window = dom.window

  const emailInput = dom.window.document.getElementById('email_id') as HTMLInputElement
  let scrolled = false
  let focused = false
  emailInput.scrollIntoView = () => {
    scrolled = true
  }
  emailInput.focus = () => {
    focused = true
  }

  const emailDef = MANUAL_FIELDS_REGISTRY.find((f) => f.id === 'appl.email')!
  const success = navigateToManualField(emailDef)

  assert.strictEqual(success, true)
  assert.strictEqual(scrolled, true, 'Email ID should be scrolled into view')
  assert.strictEqual(focused, true, 'Email ID should be focused')
  assert(
    emailInput.classList.contains('manual-entry-active-target'),
    'Email ID must receive manual-entry-active-target class'
  )
  assert.strictEqual(getActiveTargetFieldId(), 'appl.email')
})

// TEST 4: Fill Email ID -> Yellow animation stops, Email ID immediately disappears from list, count decreases by 1
check('TEST 4: Filling Email ID stops animation, disappears from list, and decrements count', () => {
  const filledApp: SavedApplication = {
    ...emptyApp,
    fields: {
      'appl.email': { value: 'test@example.com', source: 'manual', isUserEdited: true },
    },
  }

  // Active target should be cleared
  checkAndClearActiveTargetIfFilled(filledApp)

  const emailInput = document.getElementById('email_id') as HTMLInputElement
  assert.strictEqual(
    emailInput.classList.contains('manual-entry-active-target'),
    false,
    'Yellow animation must be removed when field is filled'
  )
  assert.strictEqual(getActiveTargetFieldId(), null, 'Active target ID should be reset')

  const status = getManualFieldsStatus(filledApp)
  assert.strictEqual(status.completedCount, 1)
  assert.strictEqual(status.blankCount, status.totalCount - 1)
  const blankIds = status.needsAttention.map((i) => i.definition.id)
  assert(!blankIds.includes('appl.email'), 'Email ID must disappear from blank list')
})

// TEST 5: Clear Email ID again -> Email ID immediately returns to list, count increases by 1
check('TEST 5: Clearing Email ID immediately returns it to the list and increments count', () => {
  const clearedApp: SavedApplication = {
    ...emptyApp,
    fields: {
      'appl.email': { value: '', source: 'manual', isUserEdited: true },
    },
  }

  const status = getManualFieldsStatus(clearedApp)
  assert.strictEqual(status.blankCount, status.totalCount)
  const blankIds = status.needsAttention.map((i) => i.definition.id)
  assert(blankIds.includes('appl.email'), 'Email ID must return to blank list')
})

// TEST 6: Click field inside collapsed section -> Section expands automatically, scrolls, yellow animation starts
check('TEST 6: Clicking field in collapsed section expands section, scrolls, and starts yellow animation', () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <details id="sec-visaDetails">
          <summary>Visa Details</summary>
          <input id="entrypoint" data-field-id="entrypoint" type="text" value="" />
        </details>
      </body>
    </html>
  `)

  ;(globalThis as any).document = dom.window.document
  ;(globalThis as any).window = dom.window

  const detailsEl = dom.window.document.getElementById('sec-visaDetails') as HTMLDetailsElement
  detailsEl.open = false // Collapsed!

  const entryInput = dom.window.document.getElementById('entrypoint') as HTMLInputElement
  let scrolled = false
  entryInput.scrollIntoView = () => {
    scrolled = true
  }

  let expandedSection = ''
  const entryDef = MANUAL_FIELDS_REGISTRY.find((f) => f.id === 'entrypoint')!
  navigateToManualField(entryDef, {
    onExpandSection: (secId) => {
      expandedSection = secId
    },
  })

  assert.strictEqual(expandedSection, 'visaDetails', 'Section expansion callback must be triggered')
  assert.strictEqual(detailsEl.open, true, 'Collapsed details element must be automatically opened')
  assert.strictEqual(scrolled, true, 'Field must be smoothly scrolled into view')
  assert(
    entryInput.classList.contains('manual-entry-active-target'),
    'Entry Point must receive yellow attention animation'
  )
})

// TEST 7: Click another blank field -> Previous target becomes normal, new target gets yellow animation
check('TEST 7: Clicking another blank field switches yellow animation to new target only', () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <input id="journey_id" data-field-id="appl.journeydate" type="text" value="" />
        <div id="purpose_id_trigger" data-field-id="purpose">Select Purpose</div>
      </body>
    </html>
  `)

  ;(globalThis as any).document = dom.window.document
  ;(globalThis as any).window = dom.window

  const journeyInput = dom.window.document.getElementById('journey_id') as HTMLInputElement
  const purposeDiv = dom.window.document.getElementById('purpose_id_trigger') as HTMLDivElement

  journeyInput.scrollIntoView = () => {}
  purposeDiv.scrollIntoView = () => {}

  const journeyDef = MANUAL_FIELDS_REGISTRY.find((f) => f.id === 'appl.journeydate')!
  const purposeDef = MANUAL_FIELDS_REGISTRY.find((f) => f.id === 'purpose')!

  // Navigate to Expected Date of Arrival
  navigateToManualField(journeyDef)
  assert(journeyInput.classList.contains('manual-entry-active-target'), 'Journey date should have animation')
  assert(!purposeDiv.classList.contains('manual-entry-active-target'), 'Purpose should NOT have animation')

  // Now click Visiting India for
  navigateToManualField(purposeDef)
  assert(!journeyInput.classList.contains('manual-entry-active-target'), 'Previous target must return to normal')
  assert(purposeDiv.classList.contains('manual-entry-active-target'), 'New target must have yellow animation')
  assert.strictEqual(getActiveTargetFieldId(), 'purpose')
})

// TEST 8: Fill the highlighted field -> Animation stops immediately, field disappears from navigator
check('TEST 8: Filling the highlighted field immediately stops animation and removes it from navigator', () => {
  const purposeDiv = document.getElementById('purpose_id_trigger') as HTMLDivElement

  // Simulate user filling purpose
  const updatedApp: SavedApplication = {
    ...emptyApp,
    fields: {
      purpose: { value: 'TOURISM', source: 'manual', isUserEdited: true },
    },
  }

  checkAndClearActiveTargetIfFilled(updatedApp)
  assert(!purposeDiv.classList.contains('manual-entry-active-target'), 'Animation must stop immediately')
  assert.strictEqual(getActiveTargetFieldId(), null)

  const status = getManualFieldsStatus(updatedApp)
  const blankIds = status.needsAttention.map((i) => i.definition.id)
  assert(!blankIds.includes('purpose'), 'Purpose must disappear from navigator list')
})

// TEST 9: All manual fields filled -> Manual Entry count becomes 0, no blank-field warning remains
check('TEST 9: When all applicable fields filled, blankCount is 0 with completed state', () => {
  // Populate all applicable fields
  const fieldsMap: Record<string, any> = {}
  for (const def of MANUAL_FIELDS_REGISTRY) {
    if (def.id === 'applicant-photo') continue
    if (def.id === 'captcha') continue
    if (def.id === 'duration') {
      fieldsMap['duration'] = { value: '6', source: 'manual' }
    } else if (def.id.startsWith('question_') && def.id.endsWith('_flag')) {
      fieldsMap[def.id] = { value: 'No', source: 'manual' }
    } else {
      fieldsMap[def.id] = { value: 'SAMPLE_VALUE', source: 'manual' }
    }
  }

  const allFilledApp: SavedApplication = {
    ...emptyApp,
    photograph: {
      dataUrl: 'data:image/jpeg;base64,photo...',
      fileName: 'photo.jpg',
      fileSize: 45000,
    },
    fields: fieldsMap,
  }

  const status = getManualFieldsStatus(allFilledApp)
  assert.strictEqual(status.blankCount, 0, `Expected 0 blank fields, got ${status.blankCount}`)
  assert.strictEqual(status.needsAttention.length, 0, 'No blank fields remaining')
  assert.strictEqual(status.completedCount, status.totalCount, 'All fields are marked completed')
})

// TEST 10: Refresh/reopen Workspace -> Navigator reflects actual current field values
check('TEST 10: Reopened workspace accurately derives status from saved state', () => {
  const reloadedApp: SavedApplication = {
    ...emptyApp,
    fields: {
      'appl.email': { value: 'persisted@test.com', source: 'manual', isUserEdited: true },
      duration: { value: '6', source: 'manual', isUserEdited: true },
    },
  }

  const status = getManualFieldsStatus(reloadedApp)
  assert.strictEqual(status.completedCount, 2)
  const completedIds = status.completed.map((i) => i.definition.id)
  assert(completedIds.includes('appl.email'))
  assert(completedIds.includes('duration'))

  const blankIds = status.needsAttention.map((i) => i.definition.id)
  assert(!blankIds.includes('appl.email'))
  assert(!blankIds.includes('duration'))
  assert(blankIds.includes('appl.email_re'))
  assert(blankIds.includes('occupation'))
})

// -----------------------------------------------------------------------------
// TEST SUITE 3: User's Screenshot Scenario (Profession & Occupation Details)
// -----------------------------------------------------------------------------
console.log('\n--- 3. USER SCREENSHOT SCENARIO: PROFESSION DETAILS BLANK HANDLING ---')

check('TEST 11: Profession Details in screenshot (Present Occupation, Employer Name, Designation, Address blank) are correctly detected', () => {
  // Simulates the exact state shown in user screenshot:
  // - Phone: +8801734672669 (extracted from Passport PDF)
  // - Past Occupation: PRIVATE SERVICE (extracted)
  // - Military organization: No (extracted)
  // - Present Occupation: blank
  // - Employer Name: blank
  // - Designation: blank
  // - Address: blank
  const screenshotApp: SavedApplication = {
    ...emptyApp,
    fields: {
      empphone: { value: '+8801734672669', source: 'pdf', isUserEdited: false },
      previous_occupation: { value: 'PRIVATE SERVICE', source: 'pdf', isUserEdited: false },
      prev_org: { value: 'No', source: 'pdf', isUserEdited: false },
    },
  }

  const status = getManualFieldsStatus(screenshotApp)
  const blankIds = status.needsAttention.map((i) => i.definition.id)
  const completedIds = status.completed.map((i) => i.definition.id)

  // Filled fields from screenshot must NOT be in needsAttention
  assert(completedIds.includes('empphone'), 'Phone must be completed')
  assert(completedIds.includes('previous_occupation'), 'Past Occupation must be completed')
  assert(completedIds.includes('prev_org'), 'Military service (No) must be completed')
  assert(!blankIds.includes('empphone'), 'Phone must not be in blank list')
  assert(!blankIds.includes('previous_occupation'), 'Past Occupation must not be in blank list')
  assert(!blankIds.includes('prev_org'), 'Military service must not be in blank list')

  // Blank fields from screenshot MUST be in needsAttention
  assert(blankIds.includes('occupation'), 'Present Occupation must be in blank list')
  assert(blankIds.includes('empname'), 'Employer Name must be in blank list')
  assert(blankIds.includes('empdesignation'), 'Designation must be in blank list')
  assert(blankIds.includes('empaddress'), 'Address must be in blank list')

  // Conditional military subfields must NOT be in blank list because prev_org === 'No'
  assert(!blankIds.includes('previous_organization'), 'Military Organization must not be applicable')
  assert(!blankIds.includes('previous_designation'), 'Military Designation must not be applicable')
  assert(!blankIds.includes('previous_rank'), 'Military Rank must not be applicable')
  assert(!blankIds.includes('previous_posting'), 'Military Place of Posting must not be applicable')
})

check('TEST 12: Navigating to Present Occupation focuses and highlights the exact occupation select element', () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <div id="sec-professionEmployment">
          <select id="occupation" data-field-id="occupation">
            <option value="">Select Occupation</option>
            <option value="PRIVATE SERVICE">PRIVATE SERVICE</option>
          </select>
          <input id="empname" data-field-id="empname" type="text" value="" />
          <input id="empdesignation" data-field-id="empdesignation" type="text" value="" />
          <input id="empaddress" data-field-id="empaddress" type="text" value="" />
        </div>
      </body>
    </html>
  `)

  ;(globalThis as any).document = dom.window.document
  ;(globalThis as any).window = dom.window

  const occSelect = dom.window.document.getElementById('occupation') as HTMLSelectElement
  let scrolled = false
  let focused = false
  occSelect.scrollIntoView = () => {
    scrolled = true
  }
  occSelect.focus = () => {
    focused = true
  }

  const occDef = MANUAL_FIELDS_REGISTRY.find((f) => f.id === 'occupation')!
  const success = navigateToManualField(occDef)

  assert.strictEqual(success, true)
  assert.strictEqual(scrolled, true, 'Present Occupation select must be scrolled into view')
  assert.strictEqual(focused, true, 'Present Occupation select must be focused')
  assert(
    occSelect.classList.contains('manual-entry-active-target'),
    'Present Occupation select must receive yellow attention animation'
  )
  assert.strictEqual(getActiveTargetFieldId(), 'occupation')

  // When user selects occupation, active target clears and field leaves blank list
  const userFilledApp: SavedApplication = {
    ...emptyApp,
    fields: {
      occupation: { value: 'PRIVATE SERVICE', source: 'manual', isUserEdited: true },
    },
  }

  checkAndClearActiveTargetIfFilled(userFilledApp)
  assert(!occSelect.classList.contains('manual-entry-active-target'), 'Animation must clear when selected')
  assert.strictEqual(getActiveTargetFieldId(), null)

  const newStatus = getManualFieldsStatus(userFilledApp)
  const newBlankIds = newStatus.needsAttention.map((i) => i.definition.id)
  assert(!newBlankIds.includes('occupation'), 'occupation must be removed from blank list')
  assert(newBlankIds.includes('empname'), 'empname must still remain in blank list')
})

console.log('\n==================================================')
console.log(`MANUAL ENTRY NAVIGATOR TESTS FINISHED: Passed=${failures.length === 0}, Subtests=${totalSubtests}`)
console.log('==================================================')

if (failures.length > 0) {
  process.exit(1)
}
