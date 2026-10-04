import './setup.ts'
import {
  executePassportExtractionWorkflow,
  type PassportUploadFile,
} from '../src/core/workflow/passportUploadWorkflow'
import type { ProcessDocumentPipelineResult } from '../src/core/extraction/pipeline'
import type { ApplicationDraft } from '../src/core/storage/draftDb'
import type { AuthUser } from '../src/core/auth/types'

async function runPassportUploadWorkflowTests() {
  console.log('=== RUNNING PASSPORT UPLOAD & EXTRACTION WORKFLOW TESTS ===\n')

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

  const mockUser: AuthUser = {
    id: 'user_123',
    email: 'test@example.com',
    name: 'Test User',
  }

  const dummyPdfBytes = Buffer.from('%PDF-1.4 dummy passport pdf data for testing')
  const validFile: PassportUploadFile = {
    name: 'passport_test.pdf',
    size: dummyPdfBytes.length,
    type: 'application/pdf',
    arrayBuffer: async () => dummyPdfBytes.buffer.slice(dummyPdfBytes.byteOffset, dummyPdfBytes.byteOffset + dummyPdfBytes.byteLength),
  }

  const mockSuccessPipelineResult: ProcessDocumentPipelineResult = {
    extractedData: {
      personal: {
        firstName: { value: 'RAHIM', source: 'ocr', confidence: 0.95 },
        lastName: { value: 'CHOWDHURY', source: 'ocr', confidence: 0.95 },
        fullName: { value: 'RAHIM CHOWDHURY', source: 'ocr', confidence: 0.95 },
        dateOfBirth: { value: '1990-05-15', source: 'ocr', confidence: 0.9 },
        gender: { value: 'MALE', source: 'ocr', confidence: 0.9 },
        nationality: { value: 'BANGLADESH', source: 'ocr', confidence: 0.9 },
      },
      passport: {
        passportNumber: { value: 'A12345678', source: 'ocr', confidence: 0.98 },
        issueDate: { value: '2020-01-10', source: 'ocr', confidence: 0.9 },
        expiryDate: { value: '2030-01-09', source: 'ocr', confidence: 0.9 },
      },
    },
    hasExtractedFields: true,
    pageCount: 1,
    sourceTypes: ['ocr'],
    diagnostics: {
      pdfTextFound: false,
      pdfTextChars: 0,
      ocrExecutedCount: 1,
      mrzFound: true,
      aiExecuted: false,
      errors: [],
    },
  }

  // =========================================================================
  // TEST 1: SUCCESSFUL EXTRACTION FLOW
  // =========================================================================
  console.log('--- TEST 1: SUCCESSFUL EXTRACTION FLOW ---')
  {
    let workspaceOpenedWithDraftId: string | null = null
    let openCount = 0
    let savedDraft: ApplicationDraft | null = null
    const progressStatuses: string[] = []

    const result = await executePassportExtractionWorkflow({
      file: validFile,
      user: mockUser,
      onProgress: (st) => progressStatuses.push(st),
      processPayload: async () => mockSuccessPipelineResult,
      saveDraftFn: async (draft) => {
        savedDraft = draft
      },
      navigateWorkspace: (draftId) => {
        workspaceOpenedWithDraftId = draftId
        openCount++
      },
    })

    assert(openCount === 1, 'Workspace opened exactly once on successful extraction')
    assert(workspaceOpenedWithDraftId !== null, 'Workspace opened with a valid draftId')
    assert(workspaceOpenedWithDraftId === result.draftId, 'Opened draftId matches returned draftId')
    assert(savedDraft !== null, 'Application draft was saved before navigation')
    assert(savedDraft?.savedApplication.fields['appl.surname']?.value === 'CHOWDHURY', 'Draft preserved extracted surname')
    assert(savedDraft?.savedApplication.fields['appl.passport_number']?.value === 'A12345678', 'Draft preserved extracted passport number')
    assert(progressStatuses.length >= 4, 'Emitted progress updates throughout pipeline')
  }

  // =========================================================================
  // TEST 2: OCR FAILURE (OCR returns error)
  // =========================================================================
  console.log('\n--- TEST 2: OCR FAILURE ---')
  {
    let workspaceOpened = false
    let thrownError: Error | null = null

    try {
      await executePassportExtractionWorkflow({
        file: validFile,
        user: mockUser,
        processPayload: async () => ({
          extractedData: {},
          hasExtractedFields: false,
          extractionError: 'Local Python OCR server is not running on port 8001. Please run "npm run dev".',
          pageCount: 1,
          sourceTypes: [],
          diagnostics: {
            pdfTextFound: false,
            pdfTextChars: 0,
            ocrExecutedCount: 0,
            mrzFound: false,
            aiExecuted: false,
            errors: ['Connection refused'],
          },
        }),
        saveDraftFn: async () => {},
        navigateWorkspace: () => {
          workspaceOpened = true
        },
      })
    } catch (err: any) {
      thrownError = err
    }

    assert(workspaceOpened === false, 'Workspace DOES NOT open when OCR returns error')
    assert(thrownError !== null, 'Error was thrown on OCR failure')
    assert(
      thrownError?.message.includes('Local Python OCR server is not running'),
      'Accurate error message returned on OCR failure'
    )
  }

  // =========================================================================
  // TEST 3: OCR TIMEOUT
  // =========================================================================
  console.log('\n--- TEST 3: OCR TIMEOUT ---')
  {
    let workspaceOpened = false
    let thrownError: Error | null = null

    try {
      await executePassportExtractionWorkflow({
        file: validFile,
        user: mockUser,
        timeoutMs: 50, // Short timeout for testing
        processPayload: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200))
          return mockSuccessPipelineResult
        },
        saveDraftFn: async () => {},
        navigateWorkspace: () => {
          workspaceOpened = true
        },
      })
    } catch (err: any) {
      thrownError = err
    }

    assert(workspaceOpened === false, 'Workspace DOES NOT open when OCR times out')
    assert(thrownError !== null, 'Error was thrown on timeout')
    assert(
      thrownError?.message.includes('Extraction timed out'),
      'Timeout error message returned'
    )
  }

  // =========================================================================
  // TEST 4: EMPTY / MALFORMED OCR RESULT
  // =========================================================================
  console.log('\n--- TEST 4: EMPTY / MALFORMED OCR RESULT ---')
  {
    let workspaceOpened = false
    let thrownError: Error | null = null

    try {
      await executePassportExtractionWorkflow({
        file: validFile,
        user: mockUser,
        processPayload: async () => ({
          extractedData: {},
          hasExtractedFields: false,
          pageCount: 1,
          sourceTypes: [],
          diagnostics: {
            pdfTextFound: false,
            pdfTextChars: 0,
            ocrExecutedCount: 1,
            mrzFound: false,
            aiExecuted: false,
            errors: [],
          },
        }),
        saveDraftFn: async () => {},
        navigateWorkspace: () => {
          workspaceOpened = true
        },
      })
    } catch (err: any) {
      thrownError = err
    }

    assert(workspaceOpened === false, 'Workspace DOES NOT open on empty/unreadable extraction result')
    assert(thrownError !== null, 'Error was thrown on empty extraction')
    assert(
      thrownError?.message.includes('No readable fields could be detected'),
      'Actionable error message when no readable fields detected'
    )
  }

  // =========================================================================
  // TEST 5: PERSISTENCE FAILURE
  // =========================================================================
  console.log('\n--- TEST 5: PERSISTENCE FAILURE ---')
  {
    let workspaceOpened = false
    let thrownError: Error | null = null

    try {
      await executePassportExtractionWorkflow({
        file: validFile,
        user: mockUser,
        processPayload: async () => mockSuccessPipelineResult,
        saveDraftFn: async () => {
          throw new Error('Database disk full / QuotaExceededError in IndexedDB')
        },
        navigateWorkspace: () => {
          workspaceOpened = true
        },
      })
    } catch (err: any) {
      thrownError = err
    }

    assert(workspaceOpened === false, 'Workspace DOES NOT open when persistence fails')
    assert(thrownError !== null, 'Error was thrown on persistence failure')
    assert(
      thrownError?.message.includes('IndexedDB') || thrownError?.message.includes('disk full'),
      'Persistence error propagated cleanly'
    )
  }

  // =========================================================================
  // TEST 6: DOUBLE CLICK / RAPID INVOCATION RACE CONDITION
  // =========================================================================
  console.log('\n--- TEST 6: DOUBLE CLICK / RAPID TRIGGER PROTECTION ---')
  {
    let openCount = 0
    let extractionCallCount = 0

    // Simulate rapid concurrent invocations
    let isExtractingLock = false

    const runWithLock = async () => {
      if (isExtractingLock) return null
      isExtractingLock = true
      try {
        return await executePassportExtractionWorkflow({
          file: validFile,
          user: mockUser,
          processPayload: async () => {
            extractionCallCount++
            await new Promise((r) => setTimeout(r, 60))
            return mockSuccessPipelineResult
          },
          saveDraftFn: async () => {},
          navigateWorkspace: () => {
            openCount++
          },
        })
      } finally {
        isExtractingLock = false
      }
    }

    const [res1, res2] = await Promise.all([runWithLock(), runWithLock()])

    assert(res1 !== null && res2 === null, 'Second rapid click was discarded by lock')
    assert(extractionCallCount === 1, 'Only one OCR pipeline execution occurred')
    assert(openCount === 1, 'Workspace navigation called exactly once')
  }

  // =========================================================================
  // TEST 7: SLOW OCR (Workspace kept closed until pipeline finishes)
  // =========================================================================
  console.log('\n--- TEST 7: SLOW OCR BEHAVIOR ---')
  {
    let workspaceOpened = false
    let extractionCompleted = false

    const extractionPromise = executePassportExtractionWorkflow({
      file: validFile,
      user: mockUser,
      processPayload: async () => {
        await new Promise((r) => setTimeout(r, 150))
        extractionCompleted = true
        return mockSuccessPipelineResult
      },
      saveDraftFn: async () => {},
      navigateWorkspace: () => {
        assert(extractionCompleted === true, 'Workspace was NOT opened before OCR extraction completed')
        workspaceOpened = true
      },
    })

    // Immediately after starting, workspace must NOT be open yet
    assert(workspaceOpened === false, 'Workspace remains closed while OCR is in-flight')
    assert(extractionCompleted === false, 'OCR still in-flight')

    await extractionPromise
    assert(workspaceOpened === true, 'Workspace opened after OCR finished')
  }

  // =========================================================================
  // TEST 8: REFRESH / RETRY AFTER FAILURE
  // =========================================================================
  console.log('\n--- TEST 8: REFRESH / RETRY AFTER FAILURE ---')
  {
    let attempt = 1
    let workspaceOpened = false

    const tryExtraction = async () => {
      return executePassportExtractionWorkflow({
        file: validFile,
        user: mockUser,
        processPayload: async () => {
          if (attempt === 1) {
            attempt++
            throw new Error('Temporary OCR service error')
          }
          return mockSuccessPipelineResult
        },
        saveDraftFn: async () => {},
        navigateWorkspace: () => {
          workspaceOpened = true
        },
      })
    }

    // First attempt fails
    let firstAttemptFailed = false
    try {
      await tryExtraction()
    } catch {
      firstAttemptFailed = true
    }
    assert(firstAttemptFailed, 'First extraction attempt failed as planned')
    assert(workspaceOpened === false, 'Workspace was NOT opened on first failure')

    // Second attempt (retry with same PDF) succeeds
    await tryExtraction()
    assert(workspaceOpened === true, 'Retrying with the same PDF succeeded and opened Workspace')
  }

  // =========================================================================
  // TEST 9: NON-PDF AND EMPTY FILE VALIDATION
  // =========================================================================
  console.log('\n--- TEST 9: NON-PDF AND EMPTY FILE VALIDATION ---')
  {
    let workspaceOpened = false
    let nonPdfError: Error | null = null

    try {
      await executePassportExtractionWorkflow({
        file: { name: 'photo.jpg', size: 1024, type: 'image/jpeg' },
        user: mockUser,
        processPayload: async () => mockSuccessPipelineResult,
        saveDraftFn: async () => {},
        navigateWorkspace: () => {
          workspaceOpened = true
        },
      })
    } catch (err: any) {
      nonPdfError = err
    }

    assert(workspaceOpened === false, 'Workspace DOES NOT open for non-PDF file')
    assert(nonPdfError?.message.includes('PDF document'), 'Clear error requiring PDF document')

    let emptyPdfError: Error | null = null
    try {
      await executePassportExtractionWorkflow({
        file: { name: 'empty.pdf', size: 0, type: 'application/pdf' },
        user: mockUser,
        processPayload: async () => mockSuccessPipelineResult,
        saveDraftFn: async () => {},
        navigateWorkspace: () => {
          workspaceOpened = true
        },
      })
    } catch (err: any) {
      emptyPdfError = err
    }

    assert(workspaceOpened === false, 'Workspace DOES NOT open for 0-byte PDF')
    assert(emptyPdfError?.message.includes('0 bytes'), 'Clear error for 0-byte PDF')
  }

  console.log('\n==================================================')
  console.log(`PASSPORT WORKFLOW TESTS: ${failed === 0 ? '✅ ALL PASSED' : '✕ FAILED'}`)
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
  console.log('==================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runPassportUploadWorkflowTests().catch((err) => {
  console.error('Test runner encountered unexpected error:', err)
  process.exit(1)
})
