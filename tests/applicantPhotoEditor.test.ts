import {
  uploadApplicantPhoto,
  getApplicantPhoto,
  deleteApplicantPhoto,
  dataUrlToBlob,
  createApplication,
  updateApplication,
  ApplicationApiError,
} from '../src/core/application/applicationApi'
import type { SavedApplication } from '../src/core/application/types'
import { createBlankApplicationWithDefaults } from '../src/core/application/applicationMerger'

async function runApplicantPhotoTests() {
  console.log('=== STARTING APPLICANT PHOTO EDITOR & API TESTS ===\n')

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

  // ---------------------------------------------------------------------------
  // TEST 1: dataUrlToBlob Utility
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: DATAURL TO BLOB CONVERSION ---')
  {
    const sampleBase64 =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
    const blob = dataUrlToBlob(sampleBase64)
    assert(blob instanceof Blob, 'dataUrlToBlob returns valid Blob instance')
    assert(blob.type === 'image/jpeg', 'Blob has image/jpeg MIME type')
    assert(blob.size > 0, `Blob has positive byte size (${blob.size} bytes)`)
  }

  // ---------------------------------------------------------------------------
  // TEST 2: uploadApplicantPhoto() with Application ID (POST /api/applications/:id/photo)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: uploadApplicantPhoto() APPLICATION-SCOPED (POST /api/applications/:id/photo) ---')
  {
    const originalFetch = globalThis.fetch
    let capturedUrl = ''
    let capturedOptions: any = null

    try {
      globalThis.fetch = async (url: any, options: any) => {
        capturedUrl = String(url)
        capturedOptions = options
        return new Response(
          JSON.stringify({
            success: true,
            status: 'ok',
            message: 'Applicant photo uploaded successfully.',
            photoUrl: '/api/applications/app-1001/photo',
            filename: 'applicant_photo.jpg',
            isSquare: true,
            width: 600,
            height: 600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const dummyPhoto = new Blob(['mock-jpeg-bytes-600x600'], { type: 'image/jpeg' })
      const res = await uploadApplicantPhoto(dummyPhoto, 'applicant_photo.jpg', 'app-1001')

      assert(res.success === true, 'uploadApplicantPhoto returns success true')
      assert(capturedUrl.endsWith('/api/applications/app-1001/photo'), 'Calls POST /api/applications/:id/photo')
      assert(!capturedUrl.includes('/api/applicant_photo'), 'Does NOT call /api/applicant_photo')
      assert(capturedOptions.method === 'POST', 'HTTP method is POST')
      assert(capturedOptions.body instanceof FormData, 'Sends FormData multipart body')

      const fd = capturedOptions.body as FormData
      assert(fd.has('applicant_photo'), 'FormData contains "applicant_photo" field')
      assert(fd.has('photo'), 'FormData contains "photo" fallback field')
      assert(fd.has('file'), 'FormData contains "file" fallback field')
    } finally {
      globalThis.fetch = originalFetch
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 3: uploadApplicantPhoto() Missing Application ID Guard
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: MISSING APPLICATION ID GUARD ---')
  {
    let caughtNoId = false
    try {
      const dummyPhoto = new Blob(['mock-photo-bytes'], { type: 'image/jpeg' })
      await uploadApplicantPhoto(dummyPhoto, 'test_photo.jpg', '')
    } catch (err: any) {
      caughtNoId = true
      assert(err instanceof ApplicationApiError, 'Threw ApplicationApiError on missing applicationId')
      assert(err.message.includes('not ready for photo upload'), 'Correct error message: Application is not ready for photo upload')
    }
    assert(caughtNoId, 'Rejected upload without valid persisted application ID')
  }

  // ---------------------------------------------------------------------------
  // TEST 4: uploadApplicantPhoto() Validation on Empty File
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: EMPTY PHOTO VALIDATION ---')
  {
    let caughtEmpty = false
    try {
      const emptyBlob = new Blob([], { type: 'image/jpeg' })
      await uploadApplicantPhoto(emptyBlob, 'photo.jpg', 'app-1001')
    } catch (err: any) {
      caughtEmpty = true
      assert(err instanceof ApplicationApiError, 'Threw ApplicationApiError on empty photo')
      assert(err.message.includes('empty'), 'Clear error message indicating empty photo')
    }
    assert(caughtEmpty, 'Successfully rejected 0-byte photo')
  }

  // ---------------------------------------------------------------------------
  // TEST 5: getApplicantPhoto() GET /api/applications/:id/photo
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: getApplicantPhoto() RETRIEVAL & 404 HANDLING ---')
  {
    const originalFetch = globalThis.fetch
    try {
      // 5A: Successful retrieval of photo binary bytes
      globalThis.fetch = async (url: any) => {
        const u = String(url)
        if (u.endsWith('/api/applications/app-photo-exist/photo')) {
          return new Response(new Blob(['fake-jpg-binary-bytes'], { type: 'image/jpeg' }), {
            status: 200,
            headers: { 'Content-Type': 'image/jpeg' },
          })
        }
        if (u.endsWith('/api/applications/app-no-photo/photo')) {
          return new Response(JSON.stringify({ success: false, message: 'Applicant photo not found.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response('Not Found', { status: 404 })
      }

      const resFound = await getApplicantPhoto('app-photo-exist')
      assert(resFound !== null, 'getApplicantPhoto returned photo object')
      assert(resFound?.blob instanceof Blob, 'Returned Blob instance')
      assert(resFound?.mimeType === 'image/jpeg', 'Content-Type is image/jpeg')

      // 5B: 404 handling without throwing
      const resNotFound = await getApplicantPhoto('app-no-photo')
      assert(resNotFound === null, 'Gracefully returned null on 404 without throwing error')

      // 5C: Empty ID check
      const resNoId = await getApplicantPhoto('')
      assert(resNoId === null, 'Returned null immediately when applicationId is empty')
    } finally {
      globalThis.fetch = originalFetch
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 6: deleteApplicantPhoto() DELETE /api/applications/:id/photo
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: deleteApplicantPhoto() API CALL ---')
  {
    const originalFetch = globalThis.fetch
    let capturedUrl = ''
    let capturedMethod = ''

    try {
      globalThis.fetch = async (url: any, options: any) => {
        capturedUrl = String(url)
        capturedMethod = options?.method || 'GET'
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Applicant photo removed successfully.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const res = await deleteApplicantPhoto('app-1002')

      assert(res.success === true, 'deleteApplicantPhoto returns success true')
      assert(capturedUrl.endsWith('/api/applications/app-1002/photo'), 'Calls DELETE /api/applications/:id/photo')
      assert(!capturedUrl.includes('/api/applicant_photo'), 'Does NOT call /api/applicant_photo')
      assert(capturedMethod === 'DELETE', 'HTTP method is DELETE')

      // Case when applicationId is omitted
      const resNoId = await deleteApplicantPhoto()
      assert(resNoId.success === true, 'deleteApplicantPhoto without id returns success true safely')
    } finally {
      globalThis.fetch = originalFetch
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Full Application Save Form Compatibility
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: APPLICATION SAVE COMPATIBILITY ---')
  {
    const originalFetch = globalThis.fetch
    let createFormData: FormData | null = null
    let updateFormData: FormData | null = null

    try {
      globalThis.fetch = async (url: any, options: any) => {
        const u = String(url)
        if (u.endsWith('/api/applications') && options?.method === 'POST') {
          createFormData = options.body
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                id: 'new-app-uuid',
                applicantName: 'JUYEL RANA',
                status: 'ready_for_autofill',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          )
        }
        if (u.includes('/api/applications/app-update-uuid') && options?.method === 'PUT') {
          updateFormData = options.body
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                id: 'app-update-uuid',
                applicantName: 'JUYEL RANA',
                status: 'ready_for_autofill',
                updatedAt: new Date().toISOString(),
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response('Not Found', { status: 404 })
      }

      const sampleDataUrl =
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='

      const appWithPhoto: SavedApplication = {
        ...createBlankApplicationWithDefaults({ applicantId: 'APPL_TEST_PHOTO' }),
        photograph: {
          dataUrl: sampleDataUrl,
          fileName: 'passport_photo_square.jpg',
          fileSize: 1250,
          width: 600,
          height: 600,
          backendSynced: true,
          uploadedAt: new Date().toISOString(),
        },
      }

      // Test createApplication
      const dummyPdf = new Blob(['%PDF dummy'], { type: 'application/pdf' })
      await createApplication(appWithPhoto, dummyPdf, 'passport.pdf')

      assert(createFormData !== null, 'createApplication generated FormData')
      assert(createFormData?.has('applicant_photo') === true, 'createApplication FormData attached applicant_photo')
      assert(createFormData?.has('pdf') === true, 'createApplication FormData attached pdf')

      // Test updateApplication
      await updateApplication('app-update-uuid', appWithPhoto, dummyPdf, 'passport.pdf')
      assert(updateFormData !== null, 'updateApplication generated FormData')
      assert(updateFormData?.has('applicant_photo') === true, 'updateApplication FormData attached applicant_photo')
    } finally {
      globalThis.fetch = originalFetch
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 8: SavedApplication Photograph Schema Integrity
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 8: SAVEDAPPLICATION PHOTOGRAPH SCHEMA INTEGRITY ---')
  {
    const app: SavedApplication = {
      ...createBlankApplicationWithDefaults({ applicantId: 'APPL_SQUARE' }),
      photograph: {
        dataUrl: 'data:image/jpeg;base64,abc123mock',
        fileName: 'my_photo_600x600.jpg',
        fileSize: 45000,
        width: 600,
        height: 600,
        uploadedAt: '2026-10-05T12:00:00.000Z',
        backendSynced: true,
        backendPhotoUrl: '/api/applications/app-123/photo',
      },
    }

    const serialized = JSON.stringify(app)
    const restored: SavedApplication = JSON.parse(serialized)

    assert(restored.photograph?.fileName === 'my_photo_600x600.jpg', 'Photograph fileName preserved')
    assert(restored.photograph?.width === 600, 'Photograph square width preserved (600px)')
    assert(restored.photograph?.height === 600, 'Photograph square height preserved (600px)')
    assert(restored.photograph?.backendSynced === true, 'Photograph backendSynced preserved')
    assert(restored.photograph?.backendPhotoUrl === '/api/applications/app-123/photo', 'Photograph backendPhotoUrl preserved')
  }

  console.log(`\n==================================================`)
  console.log(`APPLICANT PHOTO TESTS RESULT: ${failed === 0 ? '✅ ALL PASSED' : '❌ SOME FAILED'}`)
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
  console.log(`==================================================\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

runApplicantPhotoTests().catch((err) => {
  console.error('Unhandled error in applicant photo tests:', err)
  process.exit(1)
})
