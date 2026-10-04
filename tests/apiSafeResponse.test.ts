import {
  getApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  deleteApplication,
  downloadApplicationPdf,
  ApplicationApiError,
  createApplicationApiError,
} from '../src/core/application/applicationApi'
import {
  fetchWithAuth,
  refreshAccessToken,
  getCurrentUser,
} from '../src/core/auth/authClient'
import {
  setStoredAuth,
  getStoredAuth,
  clearStoredAuth,
} from '../src/core/auth/authStorage'
import {
  extractPassportWithPython,
  PythonExtractorError,
} from '../src/core/extraction/local/pythonExtractorClient'
import { executePassportExtractionWorkflow } from '../src/core/workflow/passportUploadWorkflow'
import type { SavedApplication } from '../src/core/application/types'
import { createBlankApplicationWithDefaults } from '../src/core/application/applicationMerger'

async function runApiSafeResponseTests() {
  console.log('==================================================')
  console.log('STARTING SAFE API RESPONSE HANDLING & EXTRACTION TESTS')
  console.log('==================================================\n')

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

  const originalFetch = globalThis.fetch

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Backend running (localhost:8000)
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: BACKEND RUNNING (Port 8000) ---')
    {
      globalThis.fetch = async (url: any) => {
        const u = String(url)
        if (u.includes('/api/applications')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: [
                {
                  id: 'app-uuid-1',
                  applicantName: 'JUYEL RANA',
                  passportNumber: 'A12345678',
                  status: 'ready_for_autofill',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response('Not Found', { status: 404 })
      }

      const list = await getApplications()
      assert(list.length === 1, 'Extension can call localhost:8000 when backend is running')
      assert(list[0].applicantName === 'JUYEL RANA', 'Backend data parsed cleanly')
      assert(!list.some((a) => (a as any).message?.includes('Unable to connect')), 'No false-positive "Unable to connect" error')
    }

    // -------------------------------------------------------------------------
    // TEST 2: OCR Running (Port 8001) - Single response body read
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: OCR RUNNING & RESPONSE BODY SINGLE CONSUMPTION ---')
    {
      let textCallCount = 0
      let jsonCallCount = 0

      // Spy on Response prototype to guarantee body is never consumed twice
      const origText = Response.prototype.text
      const origJson = Response.prototype.json

      Response.prototype.text = function () {
        textCallCount++
        return origText.call(this)
      }
      Response.prototype.json = function () {
        jsonCallCount++
        return origJson.call(this)
      }

      try {
        globalThis.fetch = async (url: any) => {
          const u = String(url)
          if (u.includes('/health')) {
            return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
          }
          if (u.includes('/extract-passport')) {
            return new Response(
              JSON.stringify({
                personal: {
                  given_names: 'JUYEL',
                  surname: 'RANA',
                  dob: '1995-05-15',
                  gender: 'M',
                  nationality: 'BGD',
                },
                passport: {
                  passport_number: 'A12345678',
                  expiry_date: '2030-05-15',
                },
                mrz: { detected: true },
                diagnostics: { pdfTextFound: true, ocrExecuted: false },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }
          return new Response('Not Found', { status: 404 })
        }

        const dummyPdf = new Blob(['%PDF-1.4 mock passport content'], { type: 'application/pdf' })
        const dummyDataUrl = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 mock').toString('base64')

        const result = await extractPassportWithPython(dummyDataUrl, 'passport.pdf', {
          skipHealthCheck: true,
        })

        assert(result !== null, 'Passport extracted with Python OCR')
        assert(result.personal.given_names === 'JUYEL', 'Extracted fields match')
        // In pythonExtractorClient, response.text() was called once, response.json() was not called directly on response stream
        assert(textCallCount === 1, `Response.text() called exactly once (was: ${textCallCount})`)
        assert(jsonCallCount === 0, `Response.json() was NOT called on response stream (was: ${jsonCallCount})`)
      } finally {
        Response.prototype.text = origText
        Response.prototype.json = origJson
      }
    }

    // -------------------------------------------------------------------------
    // TEST 3: Successful Extraction Workflow - Workspace opens only after success
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: SUCCESSFUL EXTRACTION WORKFLOW ---')
    {
      let workspaceOpened = false
      let openedDraftId = ''
      const dummyPdf = new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' })

      const workflowResult = await executePassportExtractionWorkflow({
        file: dummyPdf,
        user: { id: 'u1', email: 'test@example.com', name: 'Test User' },
        processPayload: async () => ({
          extractedData: {
            personal: {
              firstName: { value: 'JUYEL', source: 'ocr', confidence: 0.95 },
              lastName: { value: 'RANA', source: 'ocr', confidence: 0.95 },
              fullName: { value: 'JUYEL RANA', source: 'ocr', confidence: 0.95 },
            },
            passport: {
              passportNumber: { value: 'A12345678', source: 'ocr', confidence: 0.98 },
            },
          },
          hasExtractedFields: true,
          pageCount: 1,
          sourceTypes: ['ocr'],
          diagnostics: {
            pdfTextFound: true,
            pdfTextChars: 100,
            ocrExecutedCount: 1,
            mrzFound: true,
            aiExecuted: false,
            errors: [],
          },
        }),
        saveDraftFn: async () => {},
        navigateWorkspace: (draftId) => {
          workspaceOpened = true
          openedDraftId = draftId
        },
      })

      assert(workspaceOpened === true, 'Workspace opened on successful extraction')
      assert(openedDraftId === workflowResult.draftId, 'Opened draftId matches workflow result')
      assert(
        workflowResult.savedApplication.fields['appl.surname']?.value === 'RANA',
        'Normalized application data prepared before opening Workspace'
      )
    }

    // -------------------------------------------------------------------------
    // TEST 4: OCR Failure - 500 HTML error & Offline Port 8001
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: OCR FAILURE (HTML 500 & Connection Refused) ---')
    {
      // 4A: Python OCR returns HTML 500 Internal Server Error (e.g. uvicorn crash or proxy)
      globalThis.fetch = async (url: any) => {
        const u = String(url)
        if (u.includes('/extract-passport')) {
          // Non-JSON HTML 500 response
          return new Response('<!DOCTYPE html><html><body>500 Internal Server Error</body></html>', {
            status: 500,
            statusText: 'Internal Server Error',
            headers: { 'Content-Type': 'text/html' },
          })
        }
        return new Response('Not Found', { status: 404 })
      }

      let errorCaught: any = null
      try {
        const dummyDataUrl = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4').toString('base64')
        await extractPassportWithPython(dummyDataUrl, 'passport.pdf', { skipHealthCheck: true })
      } catch (err) {
        errorCaught = err
      }

      assert(errorCaught !== null, 'OCR failure threw error')
      assert(errorCaught instanceof PythonExtractorError, 'Error is PythonExtractorError')
      assert(
        !errorCaught.message.includes('body stream already read'),
        'No "body stream already read" error on HTML 500 response'
      )
      assert(
        errorCaught.message.includes('500'),
        'Error message includes HTTP 500 status'
      )

      // 4B: Workspace does NOT open when OCR fails
      let workspaceOpened = false
      let workflowError: any = null
      try {
        await executePassportExtractionWorkflow({
          file: new Blob(['%PDF-1.4 content'], { type: 'application/pdf' }),
          user: { id: 'u1', email: 'test@example.com', name: 'Test User' },
          processPayload: async () => {
            throw new Error('Local Python OCR server is not running on port 8001. Please run "npm run dev".')
          },
          saveDraftFn: async () => {},
          navigateWorkspace: () => {
            workspaceOpened = true
          },
        })
      } catch (err) {
        workflowError = err
      }

      assert(workspaceOpened === false, 'Workspace does NOT open when OCR fails')
      assert(
        workflowError.message.includes('port 8001'),
        'Correct OCR service port 8001 error shown, NOT port 8000'
      )
    }

    // -------------------------------------------------------------------------
    // TEST 5: Backend Failure (Port 8000 Connection Error)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: BACKEND FAILURE (Port 8000 Connection Error) ---')
    {
      globalThis.fetch = async (url: any) => {
        const u = String(url)
        if (u.includes('8000')) {
          throw new TypeError('Failed to fetch')
        }
        return new Response('Not Found', { status: 404 })
      }

      let backendErr: any = null
      try {
        await getApplications()
      } catch (err) {
        backendErr = err
      }

      assert(backendErr !== null, 'Operation requiring backend throws on connection failure')
      assert(backendErr instanceof ApplicationApiError, 'Error is ApplicationApiError')
      assert(
        backendErr.message === 'Unable to connect to backend server. Make sure http://localhost:8000 is running.',
        'Correct exact connection message: "Unable to connect to backend server. Make sure http://localhost:8000 is running."'
      )
      assert(
        !backendErr.message.includes('body stream already read'),
        'No "body stream already read" error'
      )
    }

    // -------------------------------------------------------------------------
    // TEST 6: 401 Authentication Refresh Flow & Retry
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: 401 AUTHENTICATION REFRESH & RETRY ---')
    {
      await setStoredAuth(
        { accessToken: 'expired-access-token', refreshToken: 'valid-refresh-token' },
        { id: 'u1', email: 'test@example.com', name: 'Test User' }
      )

      let refreshAttemptCount = 0
      let apiCallCount = 0

      globalThis.fetch = async (url: any, options: any) => {
        const u = String(url)

        if (u.includes('/api/auth/refresh')) {
          refreshAttemptCount++
          return new Response(
            JSON.stringify({
              success: true,
              data: { accessToken: 'new-valid-token' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }

        if (u.includes('/api/applications')) {
          apiCallCount++
          const headersObj = options?.headers
          let authHeader = ''
          if (headersObj instanceof Headers) {
            authHeader = headersObj.get('Authorization') || headersObj.get('authorization') || ''
          } else if (headersObj && typeof headersObj.get === 'function') {
            authHeader = headersObj.get('Authorization') || headersObj.get('authorization') || ''
          } else if (headersObj) {
            authHeader = (headersObj as any)['Authorization'] || (headersObj as any)['authorization'] || ''
          }

          if (authHeader.includes('expired-access-token')) {
            return new Response(JSON.stringify({ message: 'jwt expired' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          if (authHeader.includes('new-valid-token')) {
            return new Response(
              JSON.stringify({
                success: true,
                data: [{ id: 'app-1', applicantName: 'REFRESHED USER' }],
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }
        }

        return new Response('Not Found', { status: 404 })
      }

      const apps = await getApplications()
      assert(refreshAttemptCount === 1, 'Only one refresh attempt made')
      assert(apiCallCount === 2, 'Original request retried once with new token')
      assert(apps.length === 1 && apps[0].applicantName === 'REFRESHED USER', 'Retried request succeeded')
      const stored = await getStoredAuth()
      assert(stored.accessToken === 'new-valid-token', 'New access token stored')
    }

    // -------------------------------------------------------------------------
    // TEST 7: 403 Permission Error - Session remains active
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: 403 PERMISSION ERROR (No Unnecessary Logout) ---')
    {
      await setStoredAuth(
        { accessToken: 'valid-token', refreshToken: 'valid-refresh' },
        { id: 'u1', email: 'test@example.com', name: 'Test User' }
      )

      globalThis.fetch = async () => {
        return new Response(JSON.stringify({ message: 'Forbidden access' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      let caught403: any = null
      try {
        await getApplicationById('unauthorized-id')
      } catch (err) {
        caught403 = err
      }

      assert(caught403 !== null, '403 error caught')
      assert(caught403.status === 403, 'Error has status 403')
      assert(caught403.message.includes('Permission denied'), 'Shows permission denied error')
      const stored = await getStoredAuth()
      assert(stored.accessToken === 'valid-token', 'Session remains active; not logged out unnecessarily on 403')
      assert(!caught403.message.includes('body stream already read'), 'No body stream error on 403')
    }

    // -------------------------------------------------------------------------
    // TEST 8: 500 Server Error (JSON and HTML)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: 500 SERVER ERROR HANDLING ---')
    {
      // 8A: 500 with JSON message
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({ message: 'Database query timed out.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      let caughtJson500: any = null
      try {
        await getApplications()
      } catch (err) {
        caughtJson500 = err
      }

      assert(caughtJson500.status === 500, 'JSON 500 has status 500')
      assert(caughtJson500.message.includes('Database query timed out'), 'Preserved server error message')

      // 8B: 500 with HTML error page
      globalThis.fetch = async () => {
        return new Response('<html><body><h1>502 Bad Gateway</h1></body></html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        })
      }

      let caughtHtml500: any = null
      try {
        await getApplications()
      } catch (err) {
        caughtHtml500 = err
      }

      assert(caughtHtml500 !== null, 'HTML 502 caught without crash')
      assert(
        !caughtHtml500.message.includes('body stream already read'),
        'No "body stream already read" error on HTML error'
      )
    }

    // -------------------------------------------------------------------------
    // TEST 9: PDF Download - Uses response.blob(), never parses as JSON
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: PDF DOWNLOAD (Binary Blob Handling) ---')
    {
      const rawPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]) // %PDF-1.4

      globalThis.fetch = async (url: any) => {
        const u = String(url)
        if (u.includes('/pdf')) {
          return new Response(new Blob([rawPdfBytes], { type: 'application/pdf' }), {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': 'attachment; filename="passport_test.pdf"',
            },
          })
        }
        return new Response('Not Found', { status: 404 })
      }

      const { blob, fileName } = await downloadApplicationPdf('app-123')
      assert(blob instanceof Blob, 'downloadApplicationPdf() returned binary Blob')
      assert(blob.size === rawPdfBytes.length, 'Blob has exact binary length')
      assert(fileName === 'passport_test.pdf', 'Extracted filename from disposition')
    }

    // -------------------------------------------------------------------------
    // TEST 10: Retry After Failed Extraction
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: RETRY AFTER FAILED EXTRACTION ---')
    {
      let attempt = 0
      let workspaceOpenedCount = 0

      const retryPdf = new Blob(['%PDF-1.4 retry content'], { type: 'application/pdf' })

      const runExtraction = async () => {
        return executePassportExtractionWorkflow({
          file: retryPdf,
          user: { id: 'u1', email: 'test@example.com', name: 'Test User' },
          processPayload: async () => {
            attempt++
            if (attempt === 1) {
              return {
                extractedData: {},
                hasExtractedFields: false,
                extractionError: 'Temporary OCR failure.',
                pageCount: 1,
                sourceTypes: [],
                diagnostics: {
                  pdfTextFound: false,
                  pdfTextChars: 0,
                  ocrExecutedCount: 0,
                  mrzFound: false,
                  aiExecuted: false,
                  errors: ['OCR transient failure'],
                },
              }
            }
            return {
              extractedData: {
                personal: {
                  lastName: { value: 'RETRY_SUCCESS', source: 'ocr', confidence: 0.95 },
                },
                passport: {
                  passportNumber: { value: 'P98765432', source: 'ocr', confidence: 0.95 },
                },
              },
              hasExtractedFields: true,
              pageCount: 1,
              sourceTypes: ['ocr'],
              diagnostics: {
                pdfTextFound: true,
                pdfTextChars: 50,
                ocrExecutedCount: 1,
                mrzFound: true,
                aiExecuted: false,
                errors: [],
              },
            }
          },
          saveDraftFn: async () => {},
          navigateWorkspace: () => {
            workspaceOpenedCount++
          },
        })
      }

      // First attempt fails
      let firstAttemptFailed = false
      try {
        await runExtraction()
      } catch {
        firstAttemptFailed = true
      }

      assert(firstAttemptFailed === true, 'First attempt failed as expected')
      assert(workspaceOpenedCount === 0, 'Workspace did NOT open on failed first attempt')

      // Second attempt (retry) succeeds
      const retryResult = await runExtraction()
      assert(retryResult !== null, 'Retry attempt succeeded')
      assert(workspaceOpenedCount === 1, 'Workspace opened exactly once on retry success')
      assert(
        retryResult.savedApplication.fields['appl.surname']?.value === 'RETRY_SUCCESS',
        'Application fields correctly built on retry'
      )
    }

  } finally {
    globalThis.fetch = originalFetch
  }

  console.log('\n==================================================')
  console.log(`SAFE API RESPONSE TESTS RESULT: ${failed === 0 ? '✅ ALL PASSED' : '❌ SOME FAILED'}`)
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
  console.log('==================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runApiSafeResponseTests().catch((err) => {
  console.error('Unhandled error in safe API response tests:', err)
  process.exit(1)
})
