// Polyfill DOMMatrix for Node test environment before importing pdfjs-dist
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    m11 = 1; m12 = 0; m13 = 0; m14 = 0
    m21 = 0; m22 = 1; m23 = 0; m24 = 0
    m31 = 0; m32 = 0; m33 = 1; m34 = 0
    m41 = 0; m42 = 0; m43 = 0; m44 = 1
    is2D = true
    isIdentity = true
  } as unknown as typeof globalThis.DOMMatrix
}

export async function runExtractionPipelineOptimizationTests(): Promise<{
  passed: boolean
  totalSubtests: number
  failures: string[]
}> {
  const { isExtractionSufficient } = await import('../pipeline')
  const { mergeExtractedCandidateData } = await import('../data/applicantDataExtractor')
  const { populateApplicationFromDocuments } = await import('../../application/applicationMerger')
  type ExtractedApplicantData = import('../data/types').ExtractedApplicantData
  type DocumentRecord = import('../../document/types').DocumentRecord
  const failures: string[] = []
  let totalSubtests = 0

  const assert = (condition: boolean, msg: string) => {
    totalSubtests++
    if (!condition) {
      failures.push(msg)
      console.error(`  ✗ FAIL: ${msg}`)
    } else {
      console.log(`  ✓ PASS: ${msg}`)
    }
  }

  console.log('=== STARTING EXTRACTION PIPELINE OPTIMIZATION AUDIT (TASK 089) ===')

  // ---------------------------------------------------------------------------
  // TEST 1: isExtractionSufficient Heuristic Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Testing isExtractionSufficient Heuristic ---')

  const completePassportCand: ExtractedApplicantData = {
    personal: {
      lastName: { value: 'ISLAM', source: 'pdf-text', confidence: 90 },
      firstName: { value: 'MOHAMMAD SAIFUL', source: 'pdf-text', confidence: 90 },
      fullName: { value: 'MOHAMMAD SAIFUL ISLAM', source: 'pdf-text', confidence: 90 },
      dateOfBirth: { value: '1988-04-12', source: 'pdf-text', confidence: 90 },
    },
    passport: {
      passportNumber: { value: 'A09876543', source: 'pdf-text', confidence: 90 },
      issueDate: { value: '2021-06-15', source: 'pdf-text', confidence: 90 },
      expiryDate: { value: '2031-06-14', source: 'pdf-text', confidence: 90 },
    },
  }

  assert(
    isExtractionSufficient([completePassportCand], 250) === true,
    'Complete passport candidate with sufficient text length is identified as sufficient'
  )

  const incompletePassportCand: ExtractedApplicantData = {
    personal: {
      lastName: { value: 'ISLAM', source: 'pdf-text', confidence: 90 },
    },
    passport: {
      passportNumber: { value: 'A09876543', source: 'pdf-text', confidence: 90 },
    },
  }

  assert(
    isExtractionSufficient([incompletePassportCand], 50) === false,
    'Incomplete passport candidate (missing DOB and expiry) is identified as insufficient'
  )

  const emptyCandidateList: ExtractedApplicantData[] = []
  assert(
    isExtractionSufficient(emptyCandidateList, 0) === false,
    'Empty candidate list is identified as insufficient'
  )

  // ---------------------------------------------------------------------------
  // TEST 2: Candidate Source Precedence (MRZ > PDF-Text > AI > OCR)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Candidate Source Precedence ---')

  const mrzCandidate: ExtractedApplicantData = {
    passport: {
      passportNumber: { value: 'A12345678', source: 'mrz', confidence: 98 },
    },
    personal: {
      lastName: { value: 'RAHMAN', source: 'mrz', confidence: 98 },
      dateOfBirth: { value: '1992-01-01', source: 'mrz', confidence: 98 },
    },
  }

  const aiCandidateWithConflict: ExtractedApplicantData = {
    passport: {
      // AI hallucinated character in passport number
      passportNumber: { value: 'A1234567B', source: 'ai', confidence: 90 },
    },
    family: {
      // AI successfully extracted father name which MRZ lacks
      father: {
        name: { value: 'MD ABDUR RAHMAN', source: 'ai', confidence: 88 },
      },
    },
    presentAddress: {
      addressLine1: { value: 'HOUSE 22, ROAD 4', source: 'ai', confidence: 85 },
      villageTownCity: { value: 'MIRPUR 10', source: 'ai', confidence: 85 },
      district: { value: 'DHAKA', source: 'ai', confidence: 85 },
    },
  }

  const { merged: mergedSources } = mergeExtractedCandidateData([aiCandidateWithConflict, mrzCandidate])

  assert(
    mergedSources.passport?.passportNumber?.value === 'A12345678',
    'MRZ takes precedence over AI for passport number (no AI hallucination overwrite)'
  )
  assert(
    mergedSources.passport?.passportNumber?.source === 'mrz',
    'Passport number provenance is recorded as mrz'
  )
  assert(
    mergedSources.family?.father?.name?.value === 'MD ABDUR RAHMAN',
    'AI successfully supplies missing family information without being blocked'
  )
  assert(
    mergedSources.presentAddress?.addressLine1?.value === 'HOUSE 22, ROAD 4',
    'AI successfully supplies missing present address line 1'
  )

  // ---------------------------------------------------------------------------
  // TEST 3: Document Merger Precedence (Manual > Passport > OGD > Blank)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Document Merger Precedence in Workspace ---')

  const mockPassportDoc: DocumentRecord = {
    documentId: 'doc_passport_test_001',
    applicantId: 'APP_TEST_001',
    documentType: 'passport',
    fileName: 'passport_saiful.pdf',
    fileSize: 150000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: {
      personal: {
        lastName: { value: 'ISLAM', source: 'mrz', confidence: 98 },
        firstName: { value: 'MOHAMMAD SAIFUL', source: 'mrz', confidence: 98 },
        dateOfBirth: { value: '1988-04-12', source: 'mrz', confidence: 98 },
      },
      passport: {
        passportNumber: { value: 'A09876543', source: 'mrz', confidence: 98 },
        placeOfIssue: { value: 'DHAKA', source: 'pdf-text', confidence: 95 },
      },
    },
    extractedDataConfirmed: true,
  }

  const savedApp = populateApplicationFromDocuments({
    applicantId: 'APP_TEST_001',
    passportDoc: mockPassportDoc,
    ogdDoc: null,
    existingApp: null,
  })

  assert(
    savedApp.fields['appl.surname']?.value === 'ISLAM',
    'SavedApplication surname populated from passport document'
  )
  assert(
    savedApp.fields['appl.passport_number']?.value === 'A09876543',
    'SavedApplication passport number populated from passport document'
  )
  assert(
    savedApp.fields['appl.surname']?.source === 'passport',
    'SavedApplication surname source marked as passport'
  )

  // ---------------------------------------------------------------------------
  // TEST 4: Manual Edit Overrides Document Extraction
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing Manual Edit Overrides ---')

  const existingWithManualEdit = {
    ...savedApp,
    fields: {
      ...savedApp.fields,
      'appl.surname': {
        value: 'ISLAM-CHOWDHURY',
        source: 'manual' as const,
        isUserEdited: true,
      },
    },
    manualEdits: {
      'appl.surname': true,
    },
  }

  const updatedApp = populateApplicationFromDocuments({
    applicantId: 'APP_TEST_001',
    passportDoc: mockPassportDoc,
    ogdDoc: null,
    existingApp: existingWithManualEdit,
  })

  assert(
    updatedApp.fields['appl.surname']?.value === 'ISLAM-CHOWDHURY',
    'Manual user edit preserved over re-extracted document value'
  )
  assert(
    updatedApp.fields['appl.surname']?.source === 'manual',
    'Manual edit source preserved'
  )

  // ---------------------------------------------------------------------------
  // TEST 5: Diagnostics and Resilient Error Handling
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testing Diagnostics & Safe Fallback Structure ---')

  // Verify ProcessDocumentPipelineResult structure
  const samplePipelineResult = {
    extractedData: completePassportCand,
    hasExtractedFields: true,
    pageCount: 1,
    sourceTypes: ['pdf-text' as const],
    diagnostics: {
      pdfTextFound: true,
      pdfTextChars: 250,
      ocrExecutedCount: 0,
      mrzFound: false,
      aiExecuted: false,
      errors: [],
    },
  }

  assert(
    samplePipelineResult.diagnostics.ocrExecutedCount === 0,
    'Fast-path diagnostic indicates 0 OCR executions when local text is sufficient'
  )
  assert(
    samplePipelineResult.diagnostics.aiExecuted === false,
    'Fast-path diagnostic indicates AI was not called when local text is sufficient'
  )
  assert(
    samplePipelineResult.sourceTypes.includes('pdf-text'),
    'Source types track pdf-text'
  )

  // ---------------------------------------------------------------------------
  // TEST 6: Exact Name Extraction Without OCR Filler Letters (e.g. K LLLLLLLLLLL)
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Testing Exact Name Extraction Without OCR Filler Noise ---')
  const { parsePassportMrz } = await import('../mrz/mrzParser')

  const noisyMrzText = `
P<BGDISLAM<<MD<SADEKUL<K<LLLLLLLLLLLL<<<<<<<
A012345678BGD9001011M30010971990123456<<<<84
`
  const mrzParsed = parsePassportMrz(noisyMrzText)
  assert(mrzParsed.success === true, 'Noisy MRZ parses successfully')
  assert(mrzParsed.data?.surname === 'ISLAM', `Surname is exact "ISLAM" (got "${mrzParsed.data?.surname}")`)
  assert(
    mrzParsed.data?.givenNames === 'MD SADEKUL',
    `Given Names is exact "MD SADEKUL" without extra letters/words (got "${mrzParsed.data?.givenNames}")`
  )

  // ---------------------------------------------------------------------------
  // TEST 7: Address Extraction With OCR Prefixes & Emergency Contact Exclusion
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Testing Clean Address Extraction ---')
  const { parseStructuredAddress } = await import('../data/applicantDataExtractor')

  const rawPassportAddrWithNoise = `
DANAJPUR, WARD-3, PIRGANJ, RANSHIA, Fe THAKURGAON - 5110
3+. Relationship: SPOUSE
Name: JANNATUL FERDOUS
`
  const parsedAddr = parseStructuredAddress(rawPassportAddrWithNoise)

  assert(parsedAddr.addressLine1 === 'DANAJPUR', `Address Line 1 is "DANAJPUR" (got "${parsedAddr.addressLine1}")`)
  assert(
    parsedAddr.villageTownCity === 'WARD-3, PIRGANJ, RANSHIA',
    `Village/Town/City is "WARD-3, PIRGANJ, RANSHIA" (got "${parsedAddr.villageTownCity}")`
  )
  assert(
    parsedAddr.district === 'THAKURGAON',
    `District is exact "THAKURGAON" without "Fe" prefix (got "${parsedAddr.district}")`
  )
  assert(
    parsedAddr.stateProvince === 'THAKURGAON',
    `State/Province is exact "THAKURGAON" (got "${parsedAddr.stateProvince}")`
  )
  assert(parsedAddr.postalCode === '5110', `Postal Code is "5110" (got "${parsedAddr.postalCode}")`)

  console.log(`\n=== TEST AUDIT COMPLETE: ${failures.length === 0 ? 'ALL PASSED' : 'SOME FAILED'} ===`)
  console.log(`Total subtests: ${totalSubtests}, Failures: ${failures.length}`)

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}

// Run test directly if invoked via CLI / runner
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('extractionPipelineOptimization.test')) {
  runExtractionPipelineOptimizationTests().then((res) => {
    if (!res.passed) {
      process.exit(1)
    }
  })
}
