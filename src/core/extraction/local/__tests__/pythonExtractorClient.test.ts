import assert from 'node:assert'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  mapPythonResultToExtractedApplicant,
  normalizeExtractedNationality,
  normalizeExtractedCountry,
  normalizeExtractedDate,
  normalizeExtractedGivenName,
  normalizeExtractedGender,
  extractPassportWithPython,
  PythonExtractorError,
  LOCAL_EXTRACTOR_URL,
  type PythonPassportExtractionResult,
} from '../pythonExtractorClient'
import { populateApplicationFromDocuments } from '../../../application/applicationMerger'
import type { DocumentRecord } from '../../../document/types'
import type { SavedApplication } from '../../../application/types'

// Mock fixture representing Python service response for Josoda passport.pdf
const MOCK_JOSODA_PYTHON_RESULT: PythonPassportExtractionResult = {
  personal: {
    surname: 'RAY',
    givenName: 'SHREEJOTIMOY',
    dateOfBirth: '1993-09-18',
    gender: 'male',
    nationality: 'BANGLADESHI',
    placeOfBirth: 'THAKURGAON',
    countryOfBirth: '',
    nid: '8235626051',
  },
  passport: {
    number: 'A21496961',
    issueDate: '2026-01-20',
    expiryDate: '2031-01-19',
    issuePlace: 'DIP/DHAKA',
    issuingCountry: 'BGD',
  },
  address: {
    line1: 'KASHIPUR',
    line2: 'RANISANKAIEMUZAHIDABAD COLONI 5120',
    city: 'THAKURGAON',
    district: 'THAKURGAON',
    postalCode: '5120',
    country: '',
  },
  mrz: {
    detected: true,
    valid: true,
    rawLines: [
      'PBGDRAYSHREE<JOTIMOY<<<',
      'A214969610BGD9309186M3101193823562605148',
    ],
    confidence: 0.95235,
  },
  fieldSources: {
    'personal.surname': { source: 'ocr', confidence: 0.9955, rawValue: 'RAY' },
    'personal.givenName': { source: 'ocr', confidence: 0.9957, rawValue: 'SHREEJOTIMOY' },
    'personal.dateOfBirth': { source: 'mrz', confidence: 0.95235, rawValue: '1993-09-18' },
    'personal.gender': { source: 'mrz', confidence: 0.95235, rawValue: 'male' },
    'personal.nationality': { source: 'ocr', confidence: 0.9971, rawValue: 'BANGLADESHI' },
    'personal.placeOfBirth': { source: 'ocr', confidence: 0.997, rawValue: 'THAKURGAON' },
    'personal.nid': { source: 'mrz', confidence: 0.95235, rawValue: '8235626051' },
    'passport.number': { source: 'mrz', confidence: 0.95235, rawValue: 'A21496961' },
    'passport.issueDate': { source: 'ocr', confidence: 0.9935, rawValue: '2026-01-20' },
    'passport.expiryDate': { source: 'mrz', confidence: 0.95235, rawValue: '2031-01-19' },
    'passport.issuePlace': { source: 'ocr', confidence: 0.9922, rawValue: 'DIP/DHAKA' },
    'passport.issuingCountry': { source: 'mrz', confidence: 0.95235, rawValue: 'BGD' },
    address: { source: 'ocr', confidence: 0.96085, rawValue: 'KASHIPUR.THAKURGAON' },
  },
  processingTimeMs: 51200,
}

export async function runPythonExtractorClientTests(): Promise<{ passed: boolean; count: number; failures: string[] }> {
  const failures: string[] = []
  let count = 0

  function test(desc: string, fn: () => void | Promise<void>) {
    count++
    try {
      fn()
      console.log(`  ✓ PASS: ${desc}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ FAIL: ${desc} -> ${msg}`)
      failures.push(`${desc}: ${msg}`)
    }
  }

  async function testAsync(desc: string, fn: () => Promise<void>) {
    count++
    try {
      await fn()
      console.log(`  ✓ PASS: ${desc}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ FAIL: ${desc} -> ${msg}`)
      failures.push(`${desc}: ${msg}`)
    }
  }

  console.log('\n--- TASK 115: Python Local OCR Extractor Client & Mapper Tests ---')

  // 1. Python response -> ExtractedApplicantData mapping
  test('1. Python response -> ExtractedApplicantData maps core fields accurately', () => {
    const extracted = mapPythonResultToExtractedApplicant(MOCK_JOSODA_PYTHON_RESULT)
    assert(extracted.personal?.lastName?.value === 'RAY', 'Surname mapped to lastName')
    assert(extracted.personal?.lastName?.source === 'ocr', 'Surname source is ocr')
    assert(extracted.personal?.firstName?.value === 'SHREE JOTIMOY', 'Given name normalized to SHREE JOTIMOY')
    assert(extracted.personal?.fullName?.value === 'SHREE JOTIMOY RAY', 'FullName synthesized accurately')
    assert(extracted.personal?.dateOfBirth?.value === '1993-09-18', 'DOB mapped')
    assert(extracted.personal?.gender?.value === 'male', 'Gender mapped')
    assert(extracted.personal?.nationality?.value === 'BANGLADESH', 'Nationality normalized to BANGLADESH')
    assert(extracted.personal?.townCityOfBirth?.value === 'THAKURGAON', 'Place of birth mapped')
    assert(extracted.personal?.nationalIdNumber?.value === '8235626051', 'NID mapped')
    assert(extracted.passport?.passportNumber?.value === 'A21496961', 'Passport number mapped')
    assert(extracted.passport?.issueDate?.value === '2026-01-20', 'Issue date mapped')
    assert(extracted.passport?.expiryDate?.value === '2031-01-19', 'Expiry date mapped')
    assert(extracted.passport?.placeOfIssue?.value === 'DIP/DHAKA', 'Place of issue mapped')
    assert(extracted.passport?.issuingCountry?.value === 'BANGLADESH', 'Issuing country mapped')
  })

  // 2. Nationality & Country normalization
  test('2. Nationality normalization: BANGLADESHI/BGD -> BANGLADESH without arbitrary alteration', () => {
    assert(LOCAL_EXTRACTOR_URL === 'http://127.0.0.1:8001', 'LOCAL_EXTRACTOR_URL is configured to 8001')
    assert(normalizeExtractedNationality('BANGLADESHI') === 'BANGLADESH', 'BANGLADESHI -> BANGLADESH')
    assert(normalizeExtractedNationality('bangladeshi') === 'BANGLADESH', 'bangladeshi (lowercase) -> BANGLADESH')
    assert(normalizeExtractedNationality('BGD') === 'BANGLADESH', 'BGD -> BANGLADESH')
    assert(normalizeExtractedNationality('BANGLADESH') === 'BANGLADESH', 'BANGLADESH -> BANGLADESH')
    assert(normalizeExtractedNationality('INDIAN') === 'INDIA', 'INDIAN -> INDIA')
    assert(normalizeExtractedNationality('IND') === 'INDIA', 'IND -> INDIA')
    assert(normalizeExtractedNationality('AMERICAN') === 'AMERICAN', 'AMERICAN preserved as-is')
    assert(normalizeExtractedNationality('JAPAN') === 'JAPAN', 'JAPAN preserved as-is')
    assert(normalizeExtractedNationality('') === '', 'Empty string returns empty')
    assert(normalizeExtractedNationality(undefined) === '', 'Undefined returns empty')

    assert(normalizeExtractedCountry('BANGLADESHI') === 'BANGLADESH', 'Country BANGLADESHI -> BANGLADESH')
    assert(normalizeExtractedCountry('IND') === 'INDIA', 'Country IND -> INDIA')
    assert(normalizeExtractedCountry('USA') === 'USA', 'Country USA preserved')

    assert(normalizeExtractedGender('M') === 'male', 'Gender M -> male')
    assert(normalizeExtractedGender('F') === 'female', 'Gender F -> female')
    assert(normalizeExtractedGender('other') === 'other', 'Gender other -> other')
  })

  // 3. Date normalization
  test('3. Date normalization converts multiple source formats into standard ISO YYYY-MM-DD', () => {
    assert(normalizeExtractedDate('1993-09-18') === '1993-09-18', 'ISO format preserved')
    assert(normalizeExtractedDate('18 SEP 1993') === '1993-09-18', 'Alpha month day-first')
    assert(normalizeExtractedDate('20/01/2026') === '2026-01-20', 'Slash DMY format')
    assert(normalizeExtractedDate('19-01-2031') === '2031-01-19', 'Hyphen DMY format')
    assert(normalizeExtractedDate('invalid-date') === '', 'Invalid date returns empty string')
    assert(normalizeExtractedDate('') === '', 'Empty date returns empty string')
  })

  // 4. Given name normalization (SHREEJOTIMOY -> SHREE JOTIMOY)
  test('4. Given name normalization resolves missing prefix space using dictionary / MRZ', () => {
    const rawLines = ['PBGDRAYSHREE<JOTIMOY<<<', 'A214969610BGD9309186M3101193823562605148']
    assert(
      normalizeExtractedGivenName('SHREEJOTIMOY', rawLines) === 'SHREE JOTIMOY',
      'MRZ line 1 separator used for SHREEJOTIMOY'
    )
    assert(
      normalizeExtractedGivenName('SHREEJOTIMOY') === 'SHREE JOTIMOY',
      'Prefix dictionary used when MRZ line unavailable'
    )
    assert(
      normalizeExtractedGivenName('MDRAHIM') === 'MD RAHIM',
      'MD prefix separated cleanly'
    )
    assert(
      normalizeExtractedGivenName('JOHN') === 'JOHN',
      'Non-prefix name left unmutated'
    )
    assert(
      normalizeExtractedGivenName('SHREE JOTIMOY') === 'SHREE JOTIMOY',
      'Already separated name preserved'
    )
  })

  // 5. Birthplace remains blank when Python returns blank (Strict Rule A)
  test('5. Place of birth remains blank when Python returns blank (Never derived from address/issue place)', () => {
    const input: PythonPassportExtractionResult = {
      ...MOCK_JOSODA_PYTHON_RESULT,
      personal: {
        ...MOCK_JOSODA_PYTHON_RESULT.personal,
        placeOfBirth: '', // Blank
      },
      passport: {
        ...MOCK_JOSODA_PYTHON_RESULT.passport,
        issuePlace: 'DIP/DHAKA',
      },
      address: {
        ...MOCK_JOSODA_PYTHON_RESULT.address,
        district: 'THAKURGAON',
        city: 'THAKURGAON',
      },
    }
    const extracted = mapPythonResultToExtractedApplicant(input)
    assert(
      extracted.personal?.townCityOfBirth === undefined || extracted.personal?.townCityOfBirth?.value === '',
      'townCityOfBirth is not populated when placeOfBirth is blank'
    )
  })

  // 6. Country of birth remains blank when Python returns blank (Strict Rule B)
  test('6. Country of birth remains blank when Python returns blank (Never automatically assumed Bangladesh)', () => {
    const input: PythonPassportExtractionResult = {
      ...MOCK_JOSODA_PYTHON_RESULT,
      personal: {
        ...MOCK_JOSODA_PYTHON_RESULT.personal,
        countryOfBirth: '', // Blank
        nationality: 'BANGLADESHI',
      },
    }
    const extracted = mapPythonResultToExtractedApplicant(input)
    assert(
      extracted.personal?.countryOfBirth === undefined || extracted.personal?.countryOfBirth?.value === '',
      'countryOfBirth is not populated when Python countryOfBirth is blank'
    )
  })

  // 7. Family fields are not fabricated (Strict Rule D)
  test('7. Family fields are not fabricated and remain completely undefined', () => {
    const extracted = mapPythonResultToExtractedApplicant(MOCK_JOSODA_PYTHON_RESULT)
    assert(extracted.family === undefined, 'Family field is completely undefined')
  })

  // 8. Valid passport expiry is preserved (Strict Rule E)
  test('8. Valid passport expiry is preserved from MRZ and never copied from issue date', () => {
    const extracted = mapPythonResultToExtractedApplicant(MOCK_JOSODA_PYTHON_RESULT)
    assert(extracted.passport?.issueDate?.value === '2026-01-20', 'Issue date is 2026-01-20')
    assert(extracted.passport?.expiryDate?.value === '2031-01-19', 'Expiry date is 2031-01-19')
    assert(String(extracted.passport?.issueDate?.value) !== String(extracted.passport?.expiryDate?.value), 'Expiry != Issue')
  })

  // 9. Python timeout handling
  await testAsync('9. Python timeout handling raises PythonExtractorError with code TIMEOUT', async () => {
    const originalFetch = globalThis.fetch
    try {
      globalThis.fetch = async () => {
        const err = new Error('The operation was aborted')
        err.name = 'AbortError'
        throw err
      }
      const fakePdfDataUrl = 'data:application/pdf;base64,JVBERi0xLjQK'
      await extractPassportWithPython(fakePdfDataUrl, 'test.pdf', { timeoutMs: 50 })
      assert.fail('Should have thrown timeout error')
    } catch (err: unknown) {
      assert(err instanceof PythonExtractorError, 'Error is instance of PythonExtractorError')
      assert((err as PythonExtractorError).code === 'TIMEOUT', 'Error code is TIMEOUT')
      assert(
        (err as PythonExtractorError).message.includes('timed out'),
        'Message mentions timed out'
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  // 10. Python unavailable handling
  await testAsync('10. Python unavailable handling raises PythonExtractorError with code UNAVAILABLE', async () => {
    const originalFetch = globalThis.fetch
    try {
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch')
      }
      const fakePdfDataUrl = 'data:application/pdf;base64,JVBERi0xLjQK'
      await extractPassportWithPython(fakePdfDataUrl, 'test.pdf')
      assert.fail('Should have thrown unavailable error')
    } catch (err: unknown) {
      assert(err instanceof PythonExtractorError, 'Error is instance of PythonExtractorError')
      assert((err as PythonExtractorError).code === 'UNAVAILABLE', 'Error code is UNAVAILABLE')
      assert(
        (err as PythonExtractorError).message.includes('Local Python extractor is not running'),
        'Message instructs user to start Python extraction service on port 8001'
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  // 11. Manual/user-edited values retain precedence in populateApplicationFromDocuments
  test('11. Manual/user-edited values retain precedence during application population', () => {
    const extractedData = mapPythonResultToExtractedApplicant(MOCK_JOSODA_PYTHON_RESULT)
    const passportDoc: DocumentRecord = {
      documentId: 'doc_josoda_test',
      applicantId: 'appl_josoda_1',
      documentType: 'passport',
      fileName: 'Josoda passport.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      extractedData,
      extractedDataConfirmed: true,
    }

    // Existing application with manual user edit on surname and place of birth
    const existingApp: SavedApplication = {
      applicationId: 'app_josoda_1',
      applicantId: 'appl_josoda_1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      provenance: { lastSavedAt: new Date().toISOString() },
      sourceDocuments: {},
      fields: {
        'appl.surname': {
          value: 'ROY (MANUAL)',
          source: 'manual',
          isUserEdited: true,
        },
        'appl.placbrth': {
          value: 'DHAKA (MANUAL)',
          source: 'manual',
          isUserEdited: true,
        },
        'appl.passport_number': {
          value: 'A21496961',
          source: 'passport',
          isUserEdited: false,
        },
      },
      manualEdits: {
        'appl.surname': true,
        'appl.placbrth': true,
      },
    }

    const populatedApp = populateApplicationFromDocuments({
      applicantId: 'appl_josoda_1',
      passportDoc,
      existingApp,
    })

    // Manual edits must remain preserved
    assert(
      populatedApp.fields['appl.surname']?.value === 'ROY (MANUAL)',
      'Manual edit on surname is strictly preserved'
    )
    assert(
      populatedApp.fields['appl.surname']?.source === 'manual',
      'Manual edit source remains manual'
    )
    assert(
      populatedApp.fields['appl.placbrth']?.value === 'DHAKA (MANUAL)',
      'Manual edit on birthplace is strictly preserved'
    )

    // Unedited fields come from passport document (formatted as DD/MM/YYYY in SavedApplication)
    assert(
      populatedApp.fields['appl.birthdate']?.value === '18/09/1993' ||
      populatedApp.fields['appl.birthdate']?.value === '1993-09-18',
      'Birthdate populated from passport document'
    )
    assert(
      populatedApp.fields['appl.passport_number']?.value === 'A21496961' ||
      populatedApp.fields['appl.pptno']?.value === 'A21496961',
      'Passport number populated from passport document'
    )
    const pptField = populatedApp.fields['appl.passport_number'] || populatedApp.fields['appl.pptno']
    assert(
      pptField?.source === 'passport',
      'Passport number source is passport'
    )
    assert(
      pptField?.documentId === 'doc_josoda_test',
      'Document ID correctly tracked in application fields'
    )
  })

  // 12. Successful Python extraction reaches existing application population flow
  test('12. Successful Python extraction feeds directly into populateApplicationFromDocuments without parallel models', () => {
    const extractedData = mapPythonResultToExtractedApplicant(MOCK_JOSODA_PYTHON_RESULT)
    const passportDoc: DocumentRecord = {
      documentId: 'doc_python_flow',
      applicantId: 'appl_test_flow',
      documentType: 'passport',
      fileName: 'passport.pdf',
      mimeType: 'application/pdf',
      fileSize: 2048,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      extractedData,
      extractedDataConfirmed: true,
    }

    const savedApp = populateApplicationFromDocuments({
      applicantId: 'appl_test_flow',
      passportDoc,
    })

    assert(savedApp.applicantId === 'appl_test_flow', 'Application applicantId matches')
    assert(savedApp.fields['appl.surname']?.value === 'RAY', 'Surname populated into savedApp')
    assert(savedApp.fields['appl.applname']?.value === 'SHREE JOTIMOY', 'Given name populated into savedApp')
    assert(
      savedApp.fields['appl.birthdate']?.value === '18/09/1993' ||
      savedApp.fields['appl.birthdate']?.value === '1993-09-18',
      'DOB populated into savedApp'
    )
    assert(
      savedApp.fields['appl.applsex']?.value === 'MALE' ||
      savedApp.fields['appl.applsex']?.value === 'male',
      'Sex populated into savedApp'
    )
    assert(savedApp.fields['appl.nationality']?.value === 'BANGLADESH', 'Nationality BANGLADESH populated')
    assert(savedApp.fields['appl.placbrth']?.value === 'THAKURGAON', 'Place of birth populated')
    assert(savedApp.fields['appl.nic_no']?.value === '8235626051', 'NID populated')
    assert(
      savedApp.fields['appl.passport_number']?.value === 'A21496961' ||
      savedApp.fields['appl.pptno']?.value === 'A21496961',
      'Passport number populated'
    )
    assert(
      savedApp.fields['appl.passport_issue_date']?.value === '20/01/2026' ||
      savedApp.fields['appl.issuedate']?.value === '20/01/2026' ||
      savedApp.fields['appl.passport_issue_date']?.value === '2026-01-20',
      'Issue date populated'
    )
    assert(
      savedApp.fields['appl.passport_expiry_date']?.value === '19/01/2031' ||
      savedApp.fields['appl.expdate']?.value === '19/01/2031' ||
      savedApp.fields['appl.passport_expiry_date']?.value === '2031-01-19',
      'Expiry date populated'
    )
  })

  // 13. Real passport fixture expectations verification (Section 14)
  test('13. Real fixture expectations verification: Josoda passport mapped data contains all required fields', () => {
    const extracted = mapPythonResultToExtractedApplicant(MOCK_JOSODA_PYTHON_RESULT)

    // Verification expectations per prompt section 14:
    assert(extracted.personal?.lastName?.value === 'RAY', 'surname: RAY')
    assert(
      extracted.personal?.firstName?.value === 'SHREE JOTIMOY',
      'given name: SHREE JOTIMOY'
    )
    assert(extracted.personal?.dateOfBirth?.value === '1993-09-18', 'DOB: 1993-09-18')
    assert(extracted.personal?.gender?.value === 'male', 'gender: male')
    assert(extracted.personal?.nationality?.value === 'BANGLADESH', 'nationality: BANGLADESH')
    assert(extracted.personal?.townCityOfBirth?.value === 'THAKURGAON', 'place of birth: THAKURGAON')
    assert(extracted.personal?.nationalIdNumber?.value === '8235626051', 'NID: 8235626051')
    assert(extracted.passport?.passportNumber?.value === 'A21496961', 'passport: A21496961')
    assert(extracted.passport?.issueDate?.value === '2026-01-20', 'issue date: 2026-01-20')
    assert(extracted.passport?.expiryDate?.value === '2031-01-19', 'expiry date: 2031-01-19')
    assert(extracted.passport?.placeOfIssue?.value === 'DIP/DHAKA', 'issue place: DIP/DHAKA')
  })

  console.log(`\n==================================================`)
  console.log(`TASK 115 TESTS RESULT: ${failures.length === 0 ? '✅ ALL PASSED' : '❌ SOME FAILED'}`)
  console.log(`Total tests: ${count}`)
  console.log(`Passed: ${count - failures.length}`)
  console.log(`Failed: ${failures.length}`)
  console.log(`==================================================\n`)

  return {
    passed: failures.length === 0,
    count,
    failures,
  }
}

// Auto-run if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runPythonExtractorClientTests().then((res) => {
    process.exit(res.passed ? 0 : 1)
  })
}
