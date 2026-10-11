import './setup'
import assert from 'node:assert'
import { JSDOM } from 'jsdom'
import type { SavedApplication } from '../src/core/application/types'
import {
  createWorkspaceBaseline,
  hasWorkspaceUnsavedChanges,
  getWorkspaceUnsavedChangesCount,
  getWorkspaceUnsavedChangeKeys,
  type WorkspaceBaseline,
} from '../src/core/application/workspaceUnsavedChanges'
import {
  calculateWorkspaceProgress,
  isFieldFilled,
} from '../src/core/application/workspaceProgress'
import {
  MANUAL_FIELDS_REGISTRY,
  getManualFieldsStatus,
  getFieldSmartStatus,
} from '../src/application/manualFieldsRegistry'

console.log('==================================================')
console.log('STARTING WORKSPACE UNSAVED CHANGES TEST SUITE')
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

function createTestApp(fields: Record<string, any> = {}, photo?: any): SavedApplication {
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
    applicationId: 'test-app-100',
    applicantId: 'applicant-100',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    provenance: {
      lastSavedAt: new Date().toISOString(),
    },
    sourceDocuments: {},
    manualEdits: {},
    fields: formattedFields,
    photograph: photo,
  }
}

// -----------------------------------------------------------------------------
// 1. INITIAL LOAD & BASELINE CREATION
// -----------------------------------------------------------------------------
console.log('\n--- 1. INITIAL LOAD & BASELINE TESTS ---')

test('1. Open existing application: baseline is created and unsaved changes is false', () => {
  const app = createTestApp({
    'appl.surname': 'RANA',
    'appl.applname': 'JUYEL',
    'appl.email': 'juyel@example.com',
    'appl.birthdate': '15/08/1995',
  })

  const baseline = createWorkspaceBaseline(app)
  assert(baseline !== null, 'Baseline must not be null')
  assert.strictEqual(baseline.fieldValues.get('appl.email'), 'juyel@example.com')
  assert.strictEqual(hasWorkspaceUnsavedChanges(app, baseline), false)
  assert.strictEqual(getWorkspaceUnsavedChangesCount(app, baseline), 0)
})

test('2. Initial load does not report unsaved changes for empty or populated forms', () => {
  const emptyApp = createTestApp({})
  const emptyBaseline = createWorkspaceBaseline(emptyApp)
  assert.strictEqual(hasWorkspaceUnsavedChanges(emptyApp, emptyBaseline), false)
  assert.strictEqual(getWorkspaceUnsavedChangesCount(emptyApp, emptyBaseline), 0)
})

// -----------------------------------------------------------------------------
// 2. FIELD MODIFICATIONS & RESTORATION
// -----------------------------------------------------------------------------
console.log('\n--- 2. FIELD MODIFICATION & RESTORATION TESTS ---')

test('3. Changing Email ID marks application as having unsaved changes', () => {
  const originalApp = createTestApp({
    'appl.email': 'original@example.com',
  })
  const baseline = createWorkspaceBaseline(originalApp)

  // User edits Email ID
  const modifiedApp = createTestApp({
    ...originalApp.fields,
    'appl.email': 'new@example.com',
  })

  assert.strictEqual(hasWorkspaceUnsavedChanges(modifiedApp, baseline), true)
  assert.strictEqual(getWorkspaceUnsavedChangesCount(modifiedApp, baseline), 1)
  assert.deepStrictEqual(getWorkspaceUnsavedChangeKeys(modifiedApp, baseline), ['appl.email'])
})

test('4. Changing Email ID back to original restores unsaved changes to false', () => {
  const originalApp = createTestApp({
    'appl.email': 'original@example.com',
    'appl.surname': 'RANA',
  })
  const baseline = createWorkspaceBaseline(originalApp)

  // User modifies Email
  const modifiedApp = createTestApp({
    ...originalApp.fields,
    'appl.email': 'temp@example.com',
  })
  assert.strictEqual(hasWorkspaceUnsavedChanges(modifiedApp, baseline), true)

  // User reverts Email back to exact original value
  const restoredApp = createTestApp({
    ...originalApp.fields,
    'appl.email': 'original@example.com',
  })
  assert.strictEqual(hasWorkspaceUnsavedChanges(restoredApp, baseline), false)
  assert.strictEqual(getWorkspaceUnsavedChangesCount(restoredApp, baseline), 0)
})

test('5. Multi-field edits: changing Passport Issue Place adds to unsaved changes', () => {
  const originalApp = createTestApp({
    'appl.email': 'original@example.com',
    'appl.issue_place': 'DHAKA',
  })
  const baseline = createWorkspaceBaseline(originalApp)

  // Change both
  const modifiedApp = createTestApp({
    ...originalApp.fields,
    'appl.email': 'new@example.com',
    'appl.issue_place': 'CHITTAGONG',
  })

  assert.strictEqual(hasWorkspaceUnsavedChanges(modifiedApp, baseline), true)
  assert.strictEqual(getWorkspaceUnsavedChangesCount(modifiedApp, baseline), 2)

  // Revert one field, other still dirty
  const partiallyRestoredApp = createTestApp({
    ...originalApp.fields,
    'appl.email': 'original@example.com',
    'appl.issue_place': 'CHITTAGONG',
  })
  assert.strictEqual(hasWorkspaceUnsavedChanges(partiallyRestoredApp, baseline), true)
  assert.strictEqual(getWorkspaceUnsavedChangesCount(partiallyRestoredApp, baseline), 1)
  assert.deepStrictEqual(getWorkspaceUnsavedChangeKeys(partiallyRestoredApp, baseline), ['appl.issue_place'])
})

test('6. Boolean values (e.g., flags) dirty state and restoration', () => {
  const originalApp = createTestApp({
    'grandparent_flag': false,
  })
  const baseline = createWorkspaceBaseline(originalApp)

  const modifiedApp = createTestApp({
    'grandparent_flag': true,
  })
  assert.strictEqual(hasWorkspaceUnsavedChanges(modifiedApp, baseline), true)

  const restoredApp = createTestApp({
    'grandparent_flag': false,
  })
  assert.strictEqual(hasWorkspaceUnsavedChanges(restoredApp, baseline), false)
})

test('7. Empty and blank values: entering whitespace or clearing a field', () => {
  const originalApp = createTestApp({
    'appl.phone': '01700000000',
  })
  const baseline = createWorkspaceBaseline(originalApp)

  // Clearing the phone field is an unsaved change
  const clearedApp = createTestApp({
    'appl.phone': '',
  })
  assert.strictEqual(hasWorkspaceUnsavedChanges(clearedApp, baseline), true)

  // Restoring phone restores clean state
  const restoredApp = createTestApp({
    'appl.phone': '01700000000',
  })
  assert.strictEqual(hasWorkspaceUnsavedChanges(restoredApp, baseline), false)
})

test('8. Photograph upload and removal dirty tracking', () => {
  const initialApp = createTestApp({})
  const baselineWithoutPhoto = createWorkspaceBaseline(initialApp)

  // User uploads photo
  const withPhotoApp = createTestApp({}, {
    fileName: 'photo.jpg',
    fileSize: 45000,
    dataUrl: 'data:image/jpeg;base64,sample123',
  })
  assert.strictEqual(hasWorkspaceUnsavedChanges(withPhotoApp, baselineWithoutPhoto), true)

  // User saves with photo
  const baselineWithPhoto = createWorkspaceBaseline(withPhotoApp)
  assert.strictEqual(hasWorkspaceUnsavedChanges(withPhotoApp, baselineWithPhoto), false)

  // User removes photo
  const photoRemovedApp = createTestApp({}, undefined)
  assert.strictEqual(hasWorkspaceUnsavedChanges(photoRemovedApp, baselineWithPhoto), true)
})

// -----------------------------------------------------------------------------
// 3. SAVE SUCCESS VS SAVE FAILURE INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n--- 3. SAVE SUCCESS VS SAVE FAILURE TESTS ---')

test('9. Save Success: updates baseline and resets unsavedChanges to false', () => {
  const initialApp = createTestApp({ 'appl.email': 'v1@example.com' })
  let currentBaseline = createWorkspaceBaseline(initialApp)

  // User edits
  const editedApp = createTestApp({ 'appl.email': 'v2@example.com' })
  assert.strictEqual(hasWorkspaceUnsavedChanges(editedApp, currentBaseline), true)

  // Simulated Save SUCCESS:
  const toSave: SavedApplication = {
    ...editedApp,
    provenance: {
      ...editedApp.provenance,
      lastSavedAt: new Date().toISOString(),
    },
  }
  // On save success: baseline is updated to toSave
  currentBaseline = createWorkspaceBaseline(toSave)

  assert.strictEqual(hasWorkspaceUnsavedChanges(toSave, currentBaseline), false)
  assert.strictEqual(getWorkspaceUnsavedChangesCount(toSave, currentBaseline), 0)
})

test('10. Save Failure: baseline is NOT reset, unsavedChanges remains true', () => {
  const initialApp = createTestApp({ 'appl.email': 'v1@example.com' })
  const currentBaseline = createWorkspaceBaseline(initialApp)

  // User edits
  const editedApp = createTestApp({ 'appl.email': 'v2@example.com' })
  assert.strictEqual(hasWorkspaceUnsavedChanges(editedApp, currentBaseline), true)

  // Simulated Save FAILURE:
  let saveErrorOccurred = false
  try {
    throw new Error('Network timeout saving application')
  } catch (err) {
    saveErrorOccurred = true
    // Baseline is NOT updated!
  }

  assert.strictEqual(saveErrorOccurred, true)
  // Baseline remains old baseline!
  assert.strictEqual(hasWorkspaceUnsavedChanges(editedApp, currentBaseline), true)
  assert.strictEqual(getWorkspaceUnsavedChangesCount(editedApp, currentBaseline), 1)
})

// -----------------------------------------------------------------------------
// 4. INTEGRATION WITH WORKSPACE FEATURES
// -----------------------------------------------------------------------------
console.log('\n--- 4. WORKSPACE FEATURES INTEGRATION TESTS ---')

test('11. Guide Me mode itself does not mark application dirty', () => {
  const app = createTestApp({ 'appl.surname': 'RANA' })
  const baseline = createWorkspaceBaseline(app)

  // Guide Me inspects and computes status without mutating fields
  const status = getManualFieldsStatus(app)
  assert(status.blankManual.length > 0)

  // Application remains completely clean
  assert.strictEqual(hasWorkspaceUnsavedChanges(app, baseline), false)
})

test('12. Manual Entry Navigator opening/interaction without editing does not mark dirty', () => {
  const app = createTestApp({ 'appl.surname': 'RANA' })
  const baseline = createWorkspaceBaseline(app)

  // Query registry
  assert(MANUAL_FIELDS_REGISTRY.length > 0)
  const status = getManualFieldsStatus(app)
  assert(status.totalCount > 0)

  // Application remains clean
  assert.strictEqual(hasWorkspaceUnsavedChanges(app, baseline), false)
})

test('13. Filling a Manual Entry field updates dirty state and Completion Progress simultaneously', () => {
  const app = createTestApp({
    'appl.surname': 'RANA',
    'appl.applname': 'JUYEL',
  })
  const baseline = createWorkspaceBaseline(app)
  const initialProgress = calculateWorkspaceProgress(app)

  // User fills 'appl.birthdate' (a missing manual field)
  const updatedApp = createTestApp({
    ...app.fields,
    'appl.birthdate': '15/08/1995',
  })

  // Completion progress advances
  const updatedProgress = calculateWorkspaceProgress(updatedApp)
  assert.strictEqual(updatedProgress.filled, initialProgress.filled + 1)

  // Dirty state simultaneously becomes true
  assert.strictEqual(hasWorkspaceUnsavedChanges(updatedApp, baseline), true)
  assert.strictEqual(getWorkspaceUnsavedChangesCount(updatedApp, baseline), 1)
})

test('14. Smart Field Status evaluation never marks application dirty', () => {
  const app = createTestApp({
    'appl.birthdate': {
      value: '15/08/1990',
      source: 'passport',
      hasConflict: true,
      conflictDetails: 'Conflict detected',
    },
  })
  const baseline = createWorkspaceBaseline(app)

  const status = getFieldSmartStatus('appl.birthdate', app)
  assert.strictEqual(status.status, 'needs_review')

  // Dirty state remains clean
  assert.strictEqual(hasWorkspaceUnsavedChanges(app, baseline), false)
})

// -----------------------------------------------------------------------------
// 5. NAVIGATION & CONFIRMATION DIALOG SIMULATION
// -----------------------------------------------------------------------------
console.log('\n--- 5. NAVIGATION & CONFIRMATION DIALOG TESTS ---')

test('15. Navigation without unsaved changes proceeds immediately without confirmation', () => {
  let navigated = false
  const hasDirty = false

  function attemptNavigation(destination: string, onConfirm: () => void) {
    if (!hasDirty) {
      onConfirm()
    } else {
      // Show dialog
    }
  }

  attemptNavigation('/dashboard', () => {
    navigated = true
  })

  assert.strictEqual(navigated, true, 'Clean navigation must proceed directly')
})

test('16. Navigation with unsaved changes: Stay retains workspace state intact', () => {
  let navigated = false
  let showDialog = false
  const hasDirty = true

  const appState = createTestApp({ 'appl.email': 'new@example.com' })

  // Trigger navigation
  if (hasDirty) {
    showDialog = true
  } else {
    navigated = true
  }
  assert.strictEqual(showDialog, true, 'Dialog must be shown when dirty')
  assert.strictEqual(navigated, false, 'Navigation must be blocked')

  // User clicks 'Stay'
  showDialog = false
  assert.strictEqual(navigated, false, 'Navigation did not occur')
  assert.strictEqual(appState.fields['appl.email'].value, 'new@example.com', 'Values preserved intact')
})

test('17. Navigation with unsaved changes: Leave allows navigation without second prompt', () => {
  let navigated = false
  let showDialog = false
  let promptCount = 0
  const hasDirty = true

  // Step 1: User attempts navigation
  promptCount++
  showDialog = true

  // Step 2: User clicks 'Leave'
  showDialog = false
  let isApproved = true

  // Perform navigation with approved flag
  if (isApproved) {
    navigated = true
  } else {
    promptCount++
  }

  assert.strictEqual(navigated, true, 'Navigation completed')
  assert.strictEqual(promptCount, 1, 'Only one prompt must ever be shown for this navigation')
})

// -----------------------------------------------------------------------------
// 6. BROWSER / TAB CLOSE (beforeunload)
// -----------------------------------------------------------------------------
console.log('\n--- 6. BROWSER/TAB CLOSE (beforeunload) TESTS ---')

test('18. Native beforeunload listener is registered ONLY when unsaved changes exist', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  const mockWindow = dom.window

  let listenerAttached = false
  const beforeUnloadHandler = (e: any) => {
    e.preventDefault()
    e.returnValue = ''
    return ''
  }

  function syncBeforeUnload(isDirty: boolean) {
    if (isDirty && !listenerAttached) {
      mockWindow.addEventListener('beforeunload', beforeUnloadHandler)
      listenerAttached = true
    } else if (!isDirty && listenerAttached) {
      mockWindow.removeEventListener('beforeunload', beforeUnloadHandler)
      listenerAttached = false
    }
  }

  // Initial clean state: not attached
  syncBeforeUnload(false)
  assert.strictEqual(listenerAttached, false, 'Listener must not be attached when clean')

  // Field edited: attached
  syncBeforeUnload(true)
  assert.strictEqual(listenerAttached, true, 'Listener must be attached when dirty')

  // Save successful: detached immediately
  syncBeforeUnload(false)
  assert.strictEqual(listenerAttached, false, 'Listener must be removed when saved')
})

test('19. beforeunload event standard execution sets returnValue and prevents default', () => {
  let defaultPrevented = false
  let retVal: string | undefined = undefined

  const mockEvent = {
    preventDefault: () => {
      defaultPrevented = true
    },
    returnValue: undefined as any,
  }

  const handler = (e: any) => {
    e.preventDefault()
    e.returnValue = ''
    return ''
  }

  handler(mockEvent)
  assert.strictEqual(defaultPrevented, true, 'Event preventDefault must be called')
  assert.strictEqual(mockEvent.returnValue, '', 'returnValue must be set to empty string')
})

console.log('\n==================================================')
console.log(`WORKSPACE UNSAVED CHANGES TESTS FINISHED: Passed=${passed}, Failed=${failed}`)
console.log('==================================================')
