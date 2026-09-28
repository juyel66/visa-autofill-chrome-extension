import { populateApplicationFromDocuments } from '../applicationMerger'
import type { DocumentRecord } from '../../document/types'
import type { ExtractedApplicantData, ExtractedField, ExtractionSource } from '../../extraction/data/types'
import {
  mapPythonResultToExtractedApplicant,
  type PythonPassportExtractionResult,
} from '../../extraction/local/pythonExtractorClient'

function ef<T>(value: T, source: ExtractionSource = 'ocr', hasConflict?: boolean, conflictDetails?: string): ExtractedField<T> {
  const f: ExtractedField<T> = { value, source, confidence: 95 }
  if (hasConflict) {
    f.hasConflict = true
    f.conflictDetails = conflictDetails
  }
  return f
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

export async function runTask121Tests(): Promise<{ passed: boolean; failures: string[] }> {
  const failures: string[] = []
  let totalSubtests = 0

  function testAssert(condition: boolean, message: string) {
    totalSubtests++
    if (!condition) {
      failures.push(message)
      console.error(`  ❌ FAIL: ${message}`)
    } else {
      console.log(`  ✓ PASS: ${message}`)
    }
  }

  console.log('=== RUNNING TASK 121: DATE OF ISSUE + POSTAL CODE HARDENING TESTS ===\n')

  // -------------------------------------------------------------------------
  // TEST 1-5: DATE OF ISSUE PIPELINE INTEGRATION
  // -------------------------------------------------------------------------
  console.log('--- PART 1: DATE OF ISSUE WORKSPACE MAPPING ---')
  {
    const pyResult: PythonPassportExtractionResult = {
      personal: {
        surname: 'RAY',
        givenName: 'SHREE JOTIMOY',
        dateOfBirth: '1993-09-18',
        gender: 'male',
        nationality: 'BANGLADESHI',
        placeOfBirth: 'THAKURGAON',
        countryOfBirth: 'BANGLADESH',
        nid: '8235626051',
      },
      passport: {
        number: 'A21496961',
        issueDate: '2026-01-20',
        expiryDate: '2031-01-19',
        issuePlace: 'DIP/DHAKA',
        issuingCountry: 'BGD',
      },
      fieldSources: {
        'passport.issueDate': { source: 'ocr_spatial', confidence: 0.98, rawValue: '20/01/2026' },
        'passport.expiryDate': { source: 'mrz', confidence: 0.99, rawValue: '2031-01-19' },
      },
      mrz: { detected: true, valid: true, rawLines: [], confidence: 0.99 },
    }

    const extracted = mapPythonResultToExtractedApplicant(pyResult)
    testAssert(extracted.passport?.issueDate?.value === '2026-01-20', 'Case 1.1: Python issueDate mapped to ExtractedApplicantData')
    testAssert(extracted.passport?.issueDate?.source === 'ocr', 'Case 1.2: Source normalized to ocr')

    const doc = createDoc('doc_issue_1', extracted)
    const app = populateApplicationFromDocuments({ applicantId: 'app_issue_1', passportDoc: doc })

    testAssert(app.fields['appl.passport_issue_date']?.value === '20/01/2026', 'Case 1.3: appl.passport_issue_date formatted to DD/MM/YYYY')
    testAssert(app.fields['appl.passport_expiry_date']?.value === '19/01/2031', 'Case 1.4: appl.passport_expiry_date formatted to DD/MM/YYYY')
  }

  // -------------------------------------------------------------------------
  // TEST 10: CONFLICT REPORTING PROPAGATION
  // -------------------------------------------------------------------------
  console.log('\n--- PART 2: CONFLICT REPORTING ---')
  {
    const pyResultConflict: PythonPassportExtractionResult = {
      personal: {
        surname: 'CHANDRA',
        givenName: 'KHOKAN',
        dateOfBirth: '1989-05-15',
        gender: 'male',
        nationality: 'BANGLADESHI',
        placeOfBirth: 'PANCHAGARH',
        countryOfBirth: 'BANGLADESH',
        nid: '7782648203',
      },
      passport: {
        number: 'A07350151',
        issueDate: '',
        expiryDate: '2033-03-26',
        issuePlace: 'DHAKA',
        issuingCountry: 'BGD',
      },
      fieldSources: {
        'passport.issueDate': {
          source: 'ocr',
          confidence: 0.0,
          hasConflict: true,
          conflictDetails: 'Conflicting issue date candidates: 2023-03-27 vs 2023-07-27',
        },
      },
      mrz: { detected: false, valid: false, rawLines: [], confidence: 0 },
    }

    const extracted = mapPythonResultToExtractedApplicant(pyResultConflict)
    testAssert(extracted.passport?.issueDate === undefined, 'Case 10.1: Conflicting issue date left blank')
  }

  // -------------------------------------------------------------------------
  // TEST 12-16: POSTAL CODE WORKSPACE MAPPING
  // -------------------------------------------------------------------------
  console.log('\n--- PART 3: POSTAL CODE WORKSPACE MAPPING ---')
  {
    const pyResultPostal: PythonPassportExtractionResult = {
      personal: {
        surname: 'RAY',
        givenName: 'SHREE JOTIMOY',
        dateOfBirth: '1993-09-18',
        gender: 'male',
        nationality: 'BANGLADESHI',
        placeOfBirth: 'THAKURGAON',
        countryOfBirth: 'BANGLADESH',
        nid: '8235626051',
      },
      passport: {
        number: 'A21496961',
        issueDate: '2026-01-20',
        expiryDate: '2031-01-19',
        issuePlace: 'DIP/DHAKA',
        issuingCountry: 'BGD',
      },
      presentAddress: {
        line1: 'KASHIPUR, RANISANKAIL',
        city: 'THAKURGAON',
        district: 'THAKURGAON',
        postalCode: '5120',
        country: 'BANGLADESH',
      },
      fieldSources: {
        'presentAddress.postalCode': { source: 'ocr', confidence: 0.98, rawValue: '5120' },
      },
      mrz: { detected: true, valid: true, rawLines: [], confidence: 0.99 },
    }

    const extracted = mapPythonResultToExtractedApplicant(pyResultPostal)
    testAssert(extracted.presentAddress?.postalCode?.value === '5120', 'Case 12.1: presentAddress.postalCode populated')

    const doc = createDoc('doc_postal_1', extracted)
    const app = populateApplicationFromDocuments({ applicantId: 'app_postal_1', passportDoc: doc })

    testAssert(app.fields['pincode']?.value === '5120', 'Case 12.2: pincode populated from presentAddress')
    testAssert(app.fields['permanent_postal_code']?.value === '5120', 'Case 22.1: permanent_postal_code derived when no explicit permanent')
    testAssert(app.fields['permanent_postal_code']?.source === 'derived', 'Case 22.2: permanent_postal_code source is derived')
  }

  // -------------------------------------------------------------------------
  // TEST 23: EXPLICIT DIFFERING PERMANENT POSTAL CODE
  // -------------------------------------------------------------------------
  console.log('\n--- PART 4: DIFFERING PERMANENT POSTAL CODE ---')
  {
    const pyResultDual: PythonPassportExtractionResult = {
      personal: {
        surname: 'ROY',
        givenName: 'KHOKAN CHANDRA',
        dateOfBirth: '1989-05-15',
        gender: 'male',
        nationality: 'BANGLADESHI',
        placeOfBirth: 'PANCHAGARH',
        countryOfBirth: 'BANGLADESH',
        nid: '7782648203',
      },
      passport: {
        number: 'A07350151',
        issueDate: '2023-03-27',
        expiryDate: '2033-03-26',
        issuePlace: 'DHAKA',
        issuingCountry: 'BGD',
      },
      presentAddress: {
        line1: 'DANDAPAL MAREA',
        city: 'PANCHAGARH',
        district: 'PANCHAGARH',
        postalCode: '5020',
        country: 'BANGLADESH',
      },
      permanentAddress: {
        line1: 'SONDHANI PARA',
        city: 'DHAKA',
        district: 'DHAKA',
        postalCode: '1205',
        country: 'BANGLADESH',
      },
      fieldSources: {
        'presentAddress.postalCode': { source: 'ocr', confidence: 0.98, rawValue: '5020' },
        'permanentAddress.postalCode': { source: 'ocr', confidence: 0.98, rawValue: '1205' },
      },
      mrz: { detected: false, valid: false, rawLines: [], confidence: 0 },
    }

    const extracted = mapPythonResultToExtractedApplicant(pyResultDual)
    testAssert(extracted.presentAddress?.postalCode?.value === '5020', 'Case 23.1: Present postal 5020')
    testAssert(extracted.permanentAddress?.postalCode?.value === '1205', 'Case 23.2: Permanent postal 1205')

    const doc = createDoc('doc_postal_dual', extracted)
    const app = populateApplicationFromDocuments({ applicantId: 'app_postal_dual', passportDoc: doc })

    testAssert(app.fields['pincode']?.value === '5020', 'Case 23.3: Workspace pincode is 5020')
    testAssert(app.fields['permanent_postal_code']?.value === '1205', 'Case 23.4: Workspace permanent_postal_code is 1205')
  }

  // -------------------------------------------------------------------------
  // TEST 24 & 25: MANUAL USER EDIT PRECEDENCE
  // -------------------------------------------------------------------------
  console.log('\n--- PART 5: MANUAL USER EDIT PRECEDENCE ---')
  {
    // Initial extraction
    const doc1 = createDoc('doc_orig', {
      personal: {
        lastName: ef('RAY'),
        firstName: ef('SHREE JOTIMOY'),
        dateOfBirth: ef('1993-09-18'),
      },
      passport: {
        passportNumber: ef('A21496961'),
        issueDate: ef('2026-01-20'),
        expiryDate: ef('2031-01-19'),
      },
      presentAddress: {
        addressLine1: ef('KASHIPUR'),
        postalCode: ef('5120'),
        district: ef('THAKURGAON'),
      },
    })

    const initialApp = populateApplicationFromDocuments({ applicantId: 'app_orig', passportDoc: doc1 })
    testAssert(initialApp.fields['appl.passport_issue_date']?.value === '20/01/2026', 'Pre-manual: issue date 20/01/2026')
    testAssert(initialApp.fields['pincode']?.value === '5120', 'Pre-manual: postal code 5120')

    // Simulate user manual edits:
    // 1. User changes Date of Issue to 25/01/2026
    initialApp.fields['appl.passport_issue_date'] = {
      ...initialApp.fields['appl.passport_issue_date'],
      value: '25/01/2026',
      source: 'manual',
      isUserEdited: true,
    }
    initialApp.manualEdits['appl.passport_issue_date'] = true

    // 2. User changes Postal Code to 5199
    initialApp.fields['pincode'] = {
      ...initialApp.fields['pincode'],
      value: '5199',
      source: 'manual',
      isUserEdited: true,
    }
    initialApp.manualEdits['pincode'] = true

    // Re-extract document with original values: 20/01/2026 and 5120
    const reprocessedApp = populateApplicationFromDocuments({
      applicantId: 'app_orig',
      passportDoc: doc1,
      existingApp: initialApp,
    })

    testAssert(
      reprocessedApp.fields['appl.passport_issue_date']?.value === '25/01/2026',
      'Test 25: Manual Date of Issue (25/01/2026) survives reprocessing'
    )
    testAssert(
      reprocessedApp.fields['appl.passport_issue_date']?.source === 'manual',
      'Test 25: Source remains manual'
    )
    testAssert(
      reprocessedApp.fields['pincode']?.value === '5199',
      'Test 24: Manual Postal Code (5199) survives reprocessing'
    )
    testAssert(
      reprocessedApp.fields['pincode']?.source === 'manual',
      'Test 24: Source remains manual'
    )
  }

  console.log(`\nTask 121 Tests Completed: ${totalSubtests - failures.length}/${totalSubtests} Passed.`)
  if (failures.length > 0) {
    console.error(`FAILED ${failures.length} subtests:`, failures)
    return { passed: false, failures }
  }
  return { passed: true, failures: [] }
}

if (process.argv[1]?.endsWith('task121DateOfIssuePostalCode.test.ts')) {
  runTask121Tests().then(({ passed, failures }) => {
    if (!passed) {
      console.error('Task 121 Tests Failed with', failures)
      process.exit(1)
    } else {
      console.log('All Task 121 Tests Passed successfully!')
    }
  })
}
