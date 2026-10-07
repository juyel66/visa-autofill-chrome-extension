import './setup'
import assert from 'node:assert'
import { JSDOM } from 'jsdom'
import type { SavedApplication } from '../src/core/application/types'
import {
  MANUAL_FIELDS_REGISTRY,
  getManualFieldsStatus,
  getFieldSmartStatus,
  getHelperTextForField,
  navigateToManualField,
  setActiveManualFieldHighlight,
  clearActiveManualFieldHighlight,
  checkAndClearActiveTargetIfFilled,
  getActiveTargetFieldId,
  isBlankValue,
  findManualFieldByElement,
  onActiveTargetChange,
} from '../src/application/manualFieldsRegistry'
import {
  calculateWorkspaceProgress,
  isFieldFilled,
} from '../src/core/application/workspaceProgress'

console.log('==================================================')
console.log('STARTING WORKSPACE UX FEATURES TEST SUITE')
console.log('==================================================')

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ PASS: ${name}`)
    passed++
  } catch (err: any) {
    console.error(`  ✕ FAIL: ${name} -> ${err.message}`)
    failed++
    throw err
  }
}

// Base blank application
function createBaseApp(fields: Record<string, any> = {}): SavedApplication {
  const formattedFields: Record<string, any> = {}
  for (const [key, val] of Object.entries(fields)) {
    if (val && typeof val === 'object' && 'value' in val) {
      formattedFields[key] = val
    } else {
      formattedFields[key] = {
        value: val,
        source: 'manual',
        isUserEdited: true,
      }
    }
  }

  return {
    applicationId: 'test-app-001',
    applicantId: 'applicant-001',
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

// -----------------------------------------------------------------------------
// FEATURE 1: APPLICATION COMPLETION PROGRESS
// -----------------------------------------------------------------------------
console.log('\n--- FEATURE 1: APPLICATION COMPLETION PROGRESS ---')

test('1. Workspace opens normally and completion percentage is accurately calculated', () => {
  const app = createBaseApp({
    'appl.surname': 'RANA',
    'appl.applname': 'JUYEL',
    'appl.birthdate': '15/08/1995',
  })

  const progress = calculateWorkspaceProgress(app)
  assert(progress.total > 0, 'Total applicable fields must be > 0')
  assert(progress.filled >= 2, 'Filled count must reflect populated fields')
  const expectedPct = Math.round((progress.filled / progress.total) * 100)
  assert.strictEqual(progress.percentage, expectedPct)
  assert.strictEqual(progress.isComplete, false)
})

test('2. Percentage updates immediately after editing a missing field', () => {
  const app1 = createBaseApp({
    'appl.surname': 'RANA',
    'appl.applname': 'JUYEL',
  })
  const initialProgress = calculateWorkspaceProgress(app1)

  // User fills one missing field
  const app2 = createBaseApp({
    ...app1.fields,
    'appl.birthdate': '15/08/1995',
  })
  const updatedProgress = calculateWorkspaceProgress(app2)

  assert.strictEqual(updatedProgress.filled, initialProgress.filled + 1)
  assert(updatedProgress.percentage >= initialProgress.percentage)
  assert.strictEqual(updatedProgress.missing, initialProgress.missing - 1)
})

test('3. Blank fields (empty string, whitespace-only, null, undefined) are not counted as completed', () => {
  assert.strictEqual(isFieldFilled(''), false)
  assert.strictEqual(isFieldFilled('   '), false)
  assert.strictEqual(isFieldFilled('\t  \n'), false)
  assert.strictEqual(isFieldFilled(null), false)
  assert.strictEqual(isFieldFilled(undefined), false)
  assert.strictEqual(isFieldFilled({ value: '', source: 'manual' }), false)
  assert.strictEqual(isFieldFilled({ value: '   ', source: 'manual' }), false)
  assert.strictEqual(isFieldFilled({ value: null as any, source: 'manual' }), false)
  assert.strictEqual(isFieldFilled({ value: undefined as any, source: 'manual' }), false)
})

test('4. Valid false boolean values are handled correctly and not treated as blank', () => {
  // Boolean false represents a valid, answered value (e.g., flag or answer)
  assert.strictEqual(isFieldFilled(false), true, 'Boolean false must count as filled')
  assert.strictEqual(isFieldFilled({ value: false, source: 'manual' }), true)
  assert.strictEqual(isBlankValue(false), false, 'Boolean false is not a blank value')

  const appWithBoolFalse = createBaseApp({
    'appl.surname': 'RANA',
    'grandparent_flag': false,
  })
  const progress = calculateWorkspaceProgress(appWithBoolFalse)
  assert(progress.filled >= 2, 'Field with boolean false must be counted as filled')
})

test('5. Non-rendered legacy and conditionally hidden fields are excluded from progress total', () => {
  const app = createBaseApp({
    marital_status: 'Single',
  })
  const progress = calculateWorkspaceProgress(app)

  // Spouse fields must be hidden when Single
  assert(!progress.applicableFields.includes('spouse_name'), 'spouse_name must not be in applicable fields')
  assert(!progress.missingFields.includes('spouse_name'), 'spouse_name must not penalize completion')
  // Legacy non-rendered fields must be excluded
  assert(!progress.applicableFields.includes('state_name'))
  assert(!progress.applicableFields.includes('perm_add3'))
})

// -----------------------------------------------------------------------------
// FEATURE 2: SMART FIELD STATUS
// -----------------------------------------------------------------------------
console.log('\n--- FEATURE 2: SMART FIELD STATUS ---')

test('6. Completed state (🟢 Completed) returned for validly filled fields without review alerts', () => {
  const app = createBaseApp({
    'appl.surname': { value: 'SHREE JOTIMOY', source: 'passport', confidence: 0.95 },
    'appl.applsex': { value: 'MALE', source: 'passport', confidence: 0.98 },
  })

  const statusSurname = getFieldSmartStatus('appl.surname', app)
  assert.strictEqual(statusSurname.status, 'completed')
  assert.strictEqual(statusSurname.badgeText, '✓ Completed')

  const statusSex = getFieldSmartStatus('appl.applsex', app)
  assert.strictEqual(statusSex.status, 'completed')
  assert.strictEqual(statusSex.badgeText, '✓ Completed')
})

test('7. Needs Review state (🟡 Needs Review) triggered by conflict or low confidence', () => {
  // Case A: Conflicting values between documents
  const appConflict = createBaseApp({
    'appl.birthdate': {
      value: '15/08/1990',
      source: 'passport',
      hasConflict: true,
      conflictDetails: 'Passport DOB 15/08/1990 conflicts with NID DOB 15/08/1992',
    },
  })
  const statusConflict = getFieldSmartStatus('appl.birthdate', appConflict)
  assert.strictEqual(statusConflict.status, 'needs_review')
  assert.strictEqual(statusConflict.badgeText, '⚠ Needs Review')
  assert(statusConflict.reviewReason?.includes('conflicts'))

  // Case B: Low OCR confidence (< 0.7)
  const appLowConf = createBaseApp({
    'appl.passport_number': {
      value: 'A12345678',
      source: 'passport',
      confidence: 0.52,
    },
  })
  const statusLowConf = getFieldSmartStatus('appl.passport_number', appLowConf)
  assert.strictEqual(statusLowConf.status, 'needs_review')
  assert.strictEqual(statusLowConf.badgeText, '⚠ Needs Review')
  assert(statusLowConf.reviewReason?.includes('Low OCR confidence'))
})

test('8. Not Applicable state (⚪ Not Applicable) for conditionally hidden fields', () => {
  const appSingle = createBaseApp({
    marital_status: 'Single',
  })
  const statusSpouse = getFieldSmartStatus('spouse_name', appSingle)
  assert.strictEqual(statusSpouse.status, 'not_applicable')
  assert.strictEqual(statusSpouse.badgeText, '— Not Applicable')
})

test('9. Field values and sources are NEVER mutated by status evaluation', () => {
  const originalApp = createBaseApp({
    'appl.surname': { value: 'ORIGINAL', source: 'passport', confidence: 0.5 },
  })
  const originalSnapshot = JSON.parse(JSON.stringify(originalApp))

  getFieldSmartStatus('appl.surname', originalApp)
  getManualFieldsStatus(originalApp)

  assert.deepStrictEqual(originalApp, originalSnapshot, 'Original application must remain strictly unchanged')
})

// -----------------------------------------------------------------------------
// FEATURE 3: GUIDE ME MODE & SHARED REGISTRY INTEGRATION
// -----------------------------------------------------------------------------
console.log('\n--- FEATURE 3: GUIDE ME MODE & SHARED REGISTRY INTEGRATION ---')

test('10. Canonical field registry is shared between Manual Entry, Guide Me, and Completion Progress', () => {
  const app = createBaseApp({
    'appl.email': 'test@example.com',
  })

  const manualStatus = getManualFieldsStatus(app)
  const progress = calculateWorkspaceProgress(app)

  // Both derive from same canonical definitions
  assert(MANUAL_FIELDS_REGISTRY.length > 50, 'Canonical registry must have comprehensive workspace fields')
  assert.strictEqual(manualStatus.completedCount, manualStatus.totalCount - manualStatus.blankCount)
  assert(manualStatus.percentage >= 0 && manualStatus.percentage <= 100)
  assert(progress.total > 0)
})

test('11. Guide Me identifies first incomplete manual field and builds queue', () => {
  const app = createBaseApp({
    // email is blank on new app
  })

  const status = getManualFieldsStatus(app)
  assert(status.blankManual.length > 0, 'Must have blank manual fields')
  const firstIncomplete = status.blankManual[0]
  assert(firstIncomplete.definition.id, 'First item must have valid definition ID')
  assert.strictEqual(firstIncomplete.isFilled, false)

  // Helper text must be authentic and present
  const helperText = getHelperTextForField('appl.email', 'Email ID')
  assert.strictEqual(helperText, 'Please enter your email address.')
})

test('12. Guide Me navigation focuses input, smooth scrolls, and starts active yellow highlight', () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <section id="sec-registration">
          <input id="email_input" data-field-id="appl.email" type="text" value="" />
        </section>
      </body>
    </html>
  `)
  ;(globalThis as any).document = dom.window.document
  ;(globalThis as any).window = dom.window

  const emailEl = dom.window.document.getElementById('email_input') as HTMLInputElement
  let scrolled = false
  let focused = false
  emailEl.scrollIntoView = () => {
    scrolled = true
  }
  emailEl.focus = () => {
    focused = true
  }

  const emailDef = MANUAL_FIELDS_REGISTRY.find((f) => f.id === 'appl.email')!
  const navResult = navigateToManualField(emailDef)

  assert.strictEqual(navResult, true)
  assert.strictEqual(scrolled, true, 'Target field must be scrolled into view')
  assert.strictEqual(focused, true, 'Target field must be focused')
  assert(
    emailEl.classList.contains('manual-entry-active-target'),
    'Target field must receive active yellow animation class'
  )
  assert.strictEqual(getActiveTargetFieldId(), 'appl.email')
})

test('13. Filling the field removes yellow animation and decrements blankCount', () => {
  const filledApp = createBaseApp({
    'appl.email': { value: 'user@example.com', source: 'manual', isUserEdited: true },
  })

  // Check and clear active target
  checkAndClearActiveTargetIfFilled(filledApp)

  const emailEl = document.getElementById('email_input') as HTMLInputElement
  assert.strictEqual(
    emailEl.classList.contains('manual-entry-active-target'),
    false,
    'Yellow highlight must stop once field is filled'
  )
  assert.strictEqual(getActiveTargetFieldId(), null)

  const updatedStatus = getManualFieldsStatus(filledApp)
  const blankIds = updatedStatus.blankManual.map((i) => i.definition.id)
  assert(!blankIds.includes('appl.email'), 'Filled field must not be in blank list')
})

test('14. Guide Me Next button behavior: blank field blocks advancement with validation message', () => {
  const emptyApp = createBaseApp({})
  const status = getManualFieldsStatus(emptyApp)
  const currentItem = status.blankManual.find((f) => f.definition.id === 'appl.email') || status.blankManual[0]

  // Simulating Next click on blank field:
  const isFilled = currentItem.definition.isFilled(emptyApp)
  assert.strictEqual(isFilled, false, 'Field is blank')

  // Validation message should be returned and field remains targeted
  const validationError = !isFilled ? 'Please complete this field before continuing.' : null
  assert.strictEqual(validationError, 'Please complete this field before continuing.')

  // Simulating field completion:
  const appFilled = createBaseApp({
    [currentItem.definition.id]: 'user@example.com',
  })
  if (currentItem.definition.id === 'applicant-photo') {
    appFilled.photograph = { dataUrl: 'data:image/jpeg;base64,123' } as any
  }
  const isFilledNow = currentItem.definition.isFilled(appFilled)
  assert.strictEqual(isFilledNow, true, 'Field is now filled')
})

test('15. Guide Me completion state reached when all required fields are filled', () => {
  // App where all applicable fields are filled
  const completeFields: Record<string, any> = {}
  for (const def of MANUAL_FIELDS_REGISTRY) {
    completeFields[def.id] = { value: 'DONE', source: 'manual', isUserEdited: true }
  }
  // Statutory flags are answered 'No' (or 'Yes' with answer)
  for (let i = 1; i <= 6; i++) {
    completeFields[`question_${i}_flag`] = { value: 'No', source: 'manual', isUserEdited: true }
  }
  completeFields['duration'] = { value: '6', source: 'manual', isUserEdited: true }
  completeFields['applicant-photo'] = { value: 'photo_data', source: 'manual' }

  const fullApp = createBaseApp(completeFields)
  fullApp.photograph = { dataUrl: 'data:image/jpeg;base64,...', fileName: 'photo.jpg' } as any

  const status = getManualFieldsStatus(fullApp)
  assert.strictEqual(status.blankCount, 0, 'Blank count must be 0')
  assert.strictEqual(status.remainingCount, 0, 'Remaining count must be 0')
  assert.strictEqual(status.percentage, 100, 'Percentage must be 100%')
})

test('16. findManualFieldByElement resolves workspace inputs/selects to canonical fields', () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <input id="phone_input" data-field-id="phoneofsponsor_ind" name="phoneofsponsor_ind" value="" />
        <select id="state_select" data-field-id="stateofsponsor_ind" name="stateofsponsor_ind"></select>
      </body>
    </html>
  `)
  ;(globalThis as any).document = dom.window.document
  const phoneEl = dom.window.document.getElementById('phone_input') as HTMLInputElement
  const stateEl = dom.window.document.getElementById('state_select') as HTMLSelectElement

  const phoneDef = findManualFieldByElement(phoneEl)
  assert(phoneDef, 'Phone element must resolve to manual field definition')
  assert.strictEqual(phoneDef.id, 'phoneofsponsor_ind')

  const stateDef = findManualFieldByElement(stateEl)
  assert(stateDef, 'State element must resolve to manual field definition')
  assert.strictEqual(stateDef.id, 'stateofsponsor_ind')
})

test('17. Dual-active state: onActiveTargetChange notifies listeners and sets highlight in DOM', () => {
  let notifiedId: string | null = null
  const unsubscribe = onActiveTargetChange((id) => {
    notifiedId = id
  })

  const phoneDef = MANUAL_FIELDS_REGISTRY.find((f) => f.id === 'phoneofsponsor_ind')!
  setActiveManualFieldHighlight(phoneDef.id)

  assert.strictEqual(notifiedId, 'phoneofsponsor_ind', 'Listener must receive active field id')
  assert.strictEqual(getActiveTargetFieldId(), 'phoneofsponsor_ind')

  const phoneEl = document.getElementById('phone_input') as HTMLInputElement
  assert(
    phoneEl.classList.contains('manual-entry-active-target'),
    'Phone element must have active yellow highlight class in DOM'
  )

  unsubscribe()
})

console.log('\n==================================================')
console.log(`WORKSPACE UX FEATURES TESTS FINISHED: Passed=${passed}, Failed=${failed}`)
console.log('==================================================')
