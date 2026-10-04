import {
  createApplication,
  updateApplication,
  getApplications,
  getApplicationById,
  deleteApplication,
  downloadApplicationPdf,
  ApplicationApiError,
} from '../src/core/application/applicationApi'
import { saveDraft, getDraft, deleteDraft } from '../src/core/storage/draftDb'
import type { SavedApplication } from '../src/core/application/types'
import { createBlankApplicationWithDefaults } from '../src/core/application/applicationMerger'

async function runApplicationIntegrationTests() {
  console.log('=== STARTING APPLICATION INTEGRATION TESTS ===\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`)
      passed++
    } else {
      console.error(`  ✕ FAIL: ${desc}`)
      failed++
    }
  }

  // PART 1: Draft Storage in IndexedDB / Memory
  console.log('--- PART 1: DRAFT STORAGE (OFFLINE/IN-MEMORY) ---')
  const testDraftId = 'test_draft_' + Date.now()
  const blankApp = createBlankApplicationWithDefaults({ applicantId: 'TEST_APP_001' })
  blankApp.fields['appl.surname'] = { value: 'CHOWDHURY', source: 'passport', isUserEdited: false }
  blankApp.fields['appl.applname'] = { value: 'RAHIM', source: 'passport', isUserEdited: false }
  blankApp.fields['appl.passno'] = { value: 'B12345678', source: 'passport', isUserEdited: false }

  const dummyPdf = new Blob(['%PDF-1.4 test dummy pdf bytes'], { type: 'application/pdf' })

  await saveDraft({
    draftId: testDraftId,
    savedApplication: blankApp,
    pdfBlob: dummyPdf,
    pdfFileName: 'rahim_passport.pdf',
    createdAt: Date.now(),
  })

  const retrievedDraft = await getDraft(testDraftId)
  assert(retrievedDraft !== null, 'Retrieved saved draft from draftDb')
  assert(retrievedDraft?.savedApplication.fields['appl.surname']?.value === 'CHOWDHURY', 'Draft preserved appl.surname')
  assert(retrievedDraft?.savedApplication.fields['appl.passno']?.value === 'B12345678', 'Draft preserved passport number')
  assert(retrievedDraft?.pdfFileName === 'rahim_passport.pdf', 'Draft preserved PDF filename')

  await deleteDraft(testDraftId)
  const afterDelete = await getDraft(testDraftId)
  assert(afterDelete === null, 'Draft successfully deleted after save/cleanup')

  // PART 2: Field Preservation on Complete SavedApplication
  console.log('\n--- PART 2: COMPLETE SAVEDAPPLICATION PRESERVATION ---')
  const complexApp: SavedApplication = {
    applicationId: 'app_test_full',
    applicantId: 'TEST_APPLICANT_FULL',
    backendApplicationId: 'backend_uuid_123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'ready_for_autofill',
    fields: {
      'appl.surname': { value: 'ISLAM', source: 'passport', confidence: 0.99, isUserEdited: false },
      'appl.applname': { value: 'MOHAMMED', source: 'passport', confidence: 0.98, isUserEdited: false },
      'appl.passno': { value: 'A99887766', source: 'passport', confidence: 0.99, isUserEdited: false },
      'pres_addr1': { value: 'ROAD 12, BANANI, DHAKA', source: 'manual', isUserEdited: true },
      'perm_add1': { value: 'VILLAGE KASHEMPUR', source: 'manual', isUserEdited: true },
      'comp_name': { value: 'INFOSYS INDIA', source: 'manual', isUserEdited: true },
      'comp_address': { value: 'ELECTRONICS CITY, BANGALORE', source: 'manual', isUserEdited: true },
      'appl.religion': { value: 'ISLAM', source: 'manual', isUserEdited: true },
    },
    provenance: {
      passportDocumentId: 'doc_passport_123',
      lastSavedAt: new Date().toISOString(),
    },
    sourceDocuments: {},
    manualEdits: {
      'pres_addr1': true,
      'perm_add1': true,
      'comp_name': true,
      'comp_address': true,
      'appl.religion': true,
    },
    religionMetadata: {
      religion: 'ISLAM',
      religionSource: 'manual',
      religionConfidence: 'high',
      religionConflict: false,
    },
  }

  const serialized = JSON.stringify(complexApp)
  const deserialized: SavedApplication = JSON.parse(serialized)

  assert(deserialized.backendApplicationId === 'backend_uuid_123', 'Preserved backendApplicationId')
  assert(deserialized.fields['pres_addr1']?.isUserEdited === true, 'Preserved isUserEdited on pres_addr1')
  assert(deserialized.fields['comp_name']?.value === 'INFOSYS INDIA', 'Preserved comp_name value')
  assert(deserialized.manualEdits['appl.religion'] === true, 'Preserved manualEdits mapping')
  assert(deserialized.religionMetadata?.religion === 'ISLAM', 'Preserved religionMetadata')

  // PART 3: API Client Structure & Mock HTTP Handlers
  console.log('\n--- PART 3: APPLICATION API CLIENT INTEGRATION ---')

  const originalFetch = globalThis.fetch
  let lastFetchUrl = ''
  let lastFetchOptions: any = null

  // Mock fetch to test API client payloads and HTTP methods
  globalThis.fetch = async (url: any, options: any) => {
    lastFetchUrl = String(url)
    lastFetchOptions = options

    if (lastFetchUrl.endsWith('/api/applications') && (!options?.method || options?.method === 'GET')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: 'app-uuid-1',
              applicantName: 'ISLAM MOHAMMED',
              passportNumber: 'A99887766',
              status: 'ready_for_autofill',
              hasOriginalPdf: true,
              createdAt: '2026-10-02T20:00:00.000Z',
              updatedAt: '2026-10-02T21:00:00.000Z',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (lastFetchUrl.includes('/api/applications/app-uuid-1') && !lastFetchUrl.includes('/pdf') && (!options?.method || options?.method === 'GET')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: 'app-uuid-1',
            userId: 'user-uuid-1',
            applicantName: 'ISLAM MOHAMMED',
            passportNumber: 'A99887766',
            status: 'ready_for_autofill',
            applicationData: complexApp,
            hasOriginalPdf: true,
            createdAt: '2026-10-02T20:00:00.000Z',
            updatedAt: '2026-10-02T21:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (lastFetchUrl.endsWith('/api/applications') && options?.method === 'POST') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Application saved successfully',
          data: {
            id: 'created-uuid-new',
            applicantName: 'ISLAM MOHAMMED',
            passportNumber: 'A99887766',
            status: 'draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (lastFetchUrl.includes('/api/applications/app-uuid-1') && (options?.method === 'PUT' || options?.method === 'PATCH')) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Application updated successfully',
          data: {
            id: 'app-uuid-1',
            applicantName: 'ISLAM MOHAMMED',
            passportNumber: 'A99887766',
            status: 'ready_for_autofill',
            updatedAt: new Date().toISOString(),
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (lastFetchUrl.includes('/api/applications/app-uuid-1') && options?.method === 'DELETE') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Application deleted successfully',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (lastFetchUrl.includes('/api/applications/app-uuid-1/pdf')) {
      return new Response(new Blob(['%PDF-1.4 mock pdf content']), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="passport_app-uuid-1.pdf"',
        },
      })
    }

    return new Response('Not Found', { status: 404 })
  }

  try {
    // 1. Test getApplications()
    const appList = await getApplications()
    assert(appList.length === 1, 'getApplications() returned 1 application')
    assert(appList[0].applicantName === 'ISLAM MOHAMMED', 'getApplications() has applicantName')
    assert(appList[0].passportNumber === 'A99887766', 'getApplications() has passportNumber')
    assert(lastFetchUrl.endsWith('/api/applications'), 'getApplications() calls GET /api/applications')

    // 2. Test getApplicationById()
    const appDetail = await getApplicationById('app-uuid-1')
    assert(appDetail.id === 'app-uuid-1', 'getApplicationById() returned matching id')
    assert(appDetail.applicationData.fields['appl.surname']?.value === 'ISLAM', 'Full applicationData restored')
    assert(lastFetchUrl.includes('/api/applications/app-uuid-1'), 'getApplicationById() calls GET /api/applications/:id')

    // 3. Test createApplication()
    const createResult = await createApplication(complexApp, dummyPdf, 'passport.pdf')
    assert(createResult.id === 'created-uuid-new', 'createApplication() returned created application ID')
    assert(lastFetchOptions.method === 'POST', 'createApplication() uses POST')
    assert(lastFetchOptions.body instanceof FormData, 'createApplication() sends multipart FormData with PDF')

    // 4. Test updateApplication()
    const updateResult = await updateApplication('app-uuid-1', complexApp)
    assert(updateResult.id === 'app-uuid-1', 'updateApplication() returned updated ID')
    assert(lastFetchOptions.method === 'PUT', 'updateApplication() uses PUT')
    assert(lastFetchUrl.includes('/api/applications/app-uuid-1'), 'updateApplication() calls PUT /api/applications/:id')

    // 5. Test downloadApplicationPdf()
    const { blob, fileName } = await downloadApplicationPdf('app-uuid-1')
    assert(blob.size > 0, 'downloadApplicationPdf() returned binary blob')
    assert(fileName === 'passport_app-uuid-1.pdf', 'downloadApplicationPdf() extracted Content-Disposition filename')
    assert(lastFetchUrl.includes('/api/applications/app-uuid-1/pdf'), 'downloadApplicationPdf() calls GET /api/applications/:id/pdf')

    // 6. Test deleteApplication()
    await deleteApplication('app-uuid-1')
    assert(lastFetchOptions.method === 'DELETE', 'deleteApplication() uses DELETE')
    assert(lastFetchUrl.includes('/api/applications/app-uuid-1'), 'deleteApplication() calls DELETE /api/applications/:id')

    // 7. Test Error Handling
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ message: 'The uploaded PDF is too large.' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let caught413 = false
    try {
      await createApplication(complexApp, dummyPdf)
    } catch (err: any) {
      caught413 = true
      assert(err instanceof ApplicationApiError, 'Threw ApplicationApiError on 413')
      assert(err.status === 413, 'ApplicationApiError has status 413')
      assert(err.message.includes('too large'), 'ApplicationApiError formatted 413 message correctly')
    }
    assert(caught413, 'Successfully caught 413 error from API client')
  } finally {
    globalThis.fetch = originalFetch
  }

  console.log(`\n==================================================`)
  console.log(`APPLICATION INTEGRATION TESTS RESULT: ${failed === 0 ? '✅ ALL PASSED' : '❌ SOME FAILED'}`)
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
  console.log(`==================================================\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

runApplicationIntegrationTests().catch((err) => {
  console.error('Unhandled error in application integration test:', err)
  process.exit(1)
})
