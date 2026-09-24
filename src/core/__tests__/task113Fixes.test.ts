import { populateApplicationFromDocuments, createBlankApplicationWithDefaults } from '../application/applicationMerger'
import { validatePassportDates } from '../autofill/dateNormalizer'
import type { DocumentRecord } from '../document/types'
import type { ExtractedField, ExtractedApplicantData } from '../extraction/data/types'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface TestSuiteResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

function ef<T>(value: T): ExtractedField<T> {
  return { value, source: 'ai', confidence: 95 }
}

function createTestDoc(id: string, extractedData: ExtractedApplicantData): DocumentRecord {
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

export async function runTask113Tests(): Promise<TestSuiteResult> {
  const failures: string[] = []
  let totalSubtests = 0

  function assert(condition: boolean, message: string) {
    totalSubtests++
    if (!condition) {
      failures.push(message)
      console.error(`  ❌ FAIL: ${message}`)
    } else {
      console.log(`  ✓ PASS: ${message}`)
    }
  }

  console.log('=== RUNNING TASK 113: API SECURITY, DATA INTEGRITY & UNSAFE DEFAULTS TESTS ===\n')

  // =========================================================================
  // TEST A: BIRTHPLACE INTEGRITY
  // =========================================================================
  console.log('--- Test A: Applicant Birthplace Integrity ---')
  {
    // A.1: Extracted birthplace is preserved
    const docWithBirthplace = createTestDoc('doc_bp_1', {
      personal: {
        townCityOfBirth: ef('SYLHET'),
      },
    })
    const appWithBp = populateApplicationFromDocuments({
      applicantId: 'app_1',
      passportDoc: docWithBirthplace,
    })
    assert(
      appWithBp.fields['appl.placbrth']?.value === 'SYLHET',
      'A.1: Extracted birthplace is preserved (SYLHET)'
    )
    assert(
      appWithBp.fields['appl.placbrth']?.source === 'passport',
      'A.1: Extracted birthplace has source "passport"'
    )

    // A.2: Missing birthplace stays blank
    const docWithoutBirthplace = createTestDoc('doc_bp_2', {
      personal: {
        firstName: ef('JOHN'),
      },
    })
    const appWithoutBp = populateApplicationFromDocuments({
      applicantId: 'app_2',
      passportDoc: docWithoutBirthplace,
    })
    assert(
      appWithoutBp.fields['appl.placbrth']?.value === '',
      'A.2: Missing birthplace stays blank'
    )
    assert(
      appWithoutBp.fields['appl.placbrth']?.source === 'missing',
      'A.2: Missing birthplace has source "missing"'
    )

    // A.3: Address district is NEVER used as birthplace
    const docWithDistrictOnly = createTestDoc('doc_bp_3', {
      presentAddress: {
        district: ef('BOGURA'),
      },
      permanentAddress: {
        district: ef('BOGURA'),
      },
    })
    const appWithDist = populateApplicationFromDocuments({
      applicantId: 'app_3',
      passportDoc: docWithDistrictOnly,
    })
    assert(
      appWithDist.fields['appl.placbrth']?.value === '',
      'A.3: Address district is NEVER used as applicant birthplace'
    )
    assert(
      appWithDist.fields['appl.placbrth']?.value !== 'BOGURA',
      'A.3: Applicant birthplace is not set to district BOGURA'
    )

    // A.4: Passport issue place is NEVER used as birthplace
    const docWithIssuePlaceOnly = createTestDoc('doc_bp_4', {
      passport: {
        placeOfIssue: ef('DIP / DHAKA'),
      },
    })
    const appWithIssuePlace = populateApplicationFromDocuments({
      applicantId: 'app_4',
      passportDoc: docWithIssuePlaceOnly,
    })
    assert(
      appWithIssuePlace.fields['appl.placbrth']?.value === '',
      'A.4: Passport place of issue is NEVER used as applicant birthplace'
    )
    assert(
      appWithIssuePlace.fields['appl.placbrth']?.value !== 'DHAKA',
      'A.4: Applicant birthplace is not set to place of issue DHAKA'
    )
  }

  // =========================================================================
  // TEST B: NATIONALITY & NO || TRUE BUG
  // =========================================================================
  console.log('\n--- Test B: Nationality & Bangladeshi Derivation ---')
  {
    // B.1: BANGLADESH nationality handled correctly
    const bdDoc = createTestDoc('doc_nat_bd', {
      personal: {
        nationality: ef('BANGLADESH'),
      },
    })
    const bdApp = populateApplicationFromDocuments({
      applicantId: 'app_bd',
      passportDoc: bdDoc,
    })
    assert(
      bdApp.fields['appl.nationality']?.value === 'BANGLADESH',
      'B.1: BANGLADESH nationality preserved'
    )
    assert(
      bdApp.fields['appl.countryname']?.value === 'BANGLADESH',
      'B.1: BANGLADESH applicant gets derived present_country BANGLADESH'
    )

    // B.2: Foreign nationality (USA) is preserved and NOT treated as Bangladeshi
    const usaDoc = createTestDoc('doc_nat_usa', {
      personal: {
        nationality: ef('USA'),
      },
      passport: {
        issuingCountry: ef('USA'),
      },
    })
    const usaApp = populateApplicationFromDocuments({
      applicantId: 'app_usa',
      passportDoc: usaDoc,
    })
    assert(
      usaApp.fields['appl.nationality']?.value === 'USA',
      'B.2: Foreign nationality USA is preserved'
    )
    assert(
      usaApp.fields['appl.countryname']?.value !== 'BANGLADESH',
      'B.2: USA applicant is NOT forced to countryname BANGLADESH (no || true bug)'
    )

    // B.3: Foreign nationality (INDIA) is preserved and NOT treated as Bangladeshi
    const indDoc = createTestDoc('doc_nat_ind', {
      personal: {
        nationality: ef('INDIA'),
      },
      passport: {
        issuingCountry: ef('INDIA'),
      },
    })
    const indApp = populateApplicationFromDocuments({
      applicantId: 'app_ind',
      passportDoc: indDoc,
    })
    assert(
      indApp.fields['appl.nationality']?.value === 'INDIA',
      'B.3: Foreign nationality INDIA is preserved'
    )
    assert(
      indApp.fields['appl.countryname']?.value !== 'BANGLADESH',
      'B.3: India applicant is NOT treated as Bangladeshi'
    )
  }

  // =========================================================================
  // TEST C: COUNTRY OF BIRTH INTEGRITY
  // =========================================================================
  console.log('\n--- Test C: Country of Birth Integrity ---')
  {
    // C.1: Extracted country of birth is preserved
    const docWithCob = createTestDoc('doc_cob_1', {
      personal: {
        countryOfBirth: ef('BANGLADESH'),
      },
    })
    const appCob1 = populateApplicationFromDocuments({
      applicantId: 'app_cob_1',
      passportDoc: docWithCob,
    })
    assert(
      appCob1.fields['appl.country_of_birth']?.value === 'BANGLADESH',
      'C.1: Extracted country_of_birth is preserved'
    )
    assert(
      appCob1.fields['appl.country_of_birth']?.source === 'passport',
      'C.1: Extracted country_of_birth has source "passport"'
    )

    // C.2: Missing country of birth stays blank (no fake source="passport")
    const docWithoutCob = createTestDoc('doc_cob_2', {
      personal: {
        firstName: ef('TARIQ'),
      },
    })
    const appCob2 = populateApplicationFromDocuments({
      applicantId: 'app_cob_2',
      passportDoc: docWithoutCob,
    })
    assert(
      appCob2.fields['appl.country_of_birth']?.value === '',
      'C.2: Missing country_of_birth stays blank'
    )
    assert(
      appCob2.fields['appl.country_of_birth']?.source === 'missing',
      'C.2: Missing country_of_birth has source "missing"'
    )
    assert(
      appCob2.fields['appl.country_of_birth']?.source !== 'passport',
      'C.2: Missing country_of_birth is NOT falsely marked as source "passport"'
    )

    // C.3: Blank application has blank country of birth
    const blankApp = createBlankApplicationWithDefaults({ applicantId: 'blank_1' })
    assert(
      blankApp.fields['appl.country_of_birth']?.value === '',
      'C.3: Blank application has blank country_of_birth'
    )
  }

  // =========================================================================
  // TEST D: FAMILY DEFAULTS INTEGRITY
  // =========================================================================
  console.log('\n--- Test D: Father / Mother / Spouse Unsafe Defaults ---')
  {
    // D.1: Missing parent nationality stays blank
    const docNoFamily = createTestDoc('doc_fam_1', {
      personal: {
        firstName: ef('RAHIM'),
      },
    })
    const appNoFam = populateApplicationFromDocuments({
      applicantId: 'app_fam_1',
      passportDoc: docNoFamily,
    })
    assert(
      appNoFam.fields['father_nationality']?.value === '',
      'D.1: Missing father nationality stays blank'
    )
    assert(
      appNoFam.fields['mother_nationality']?.value === '',
      'D.1: Missing mother nationality stays blank'
    )
    assert(
      appNoFam.fields['father_place_of_birth']?.value === '',
      'D.1: Missing father place of birth stays blank'
    )
    assert(
      appNoFam.fields['mother_place_of_birth']?.value === '',
      'D.1: Missing mother place of birth stays blank'
    )
    assert(
      appNoFam.fields['father_country_of_birth']?.value === '',
      'D.1: Missing father country of birth stays blank'
    )
    assert(
      appNoFam.fields['mother_country_of_birth']?.value === '',
      'D.1: Missing mother country of birth stays blank'
    )

    // D.2: Spouse fields stay blank when no spouse exists
    assert(
      appNoFam.fields['spouse_nationality']?.value === '',
      'D.2: Spouse nationality stays blank when applicant has no spouse'
    )
    assert(
      appNoFam.fields['spouse_place_of_birth']?.value === '',
      'D.2: Spouse place of birth stays blank when applicant has no spouse'
    )
    assert(
      appNoFam.fields['spouse_country_of_birth']?.value === '',
      'D.2: Spouse country of birth stays blank when applicant has no spouse'
    )

    // D.3: Extracted spouse data is preserved when spouse exists
    const docWithSpouse = createTestDoc('doc_fam_2', {
      family: {
        spouse: {
          name: ef('FATIMA BEGUM'),
          nationality: ef('BANGLADESH'),
          placeOfBirth: ef('RAJSHAHI'),
          countryOfBirth: ef('BANGLADESH'),
        },
      },
    })
    const appWithSpouse = populateApplicationFromDocuments({
      applicantId: 'app_fam_2',
      passportDoc: docWithSpouse,
    })
    assert(
      appWithSpouse.fields['spouse_nationality']?.value === 'BANGLADESH',
      'D.3: Extracted spouse nationality preserved'
    )
    assert(
      appWithSpouse.fields['spouse_place_of_birth']?.value === 'RAJSHAHI',
      'D.3: Extracted spouse place of birth preserved'
    )
    assert(
      appWithSpouse.fields['spouse_country_of_birth']?.value === 'BANGLADESH',
      'D.3: Extracted spouse country of birth preserved'
    )

    // D.4: Blank application has blank family fields
    const blank = createBlankApplicationWithDefaults({ applicantId: 'blank_fam' })
    assert(blank.fields['father_nationality']?.value === '', 'D.4: Blank app has blank father_nationality')
    assert(blank.fields['mother_nationality']?.value === '', 'D.4: Blank app has blank mother_nationality')
    assert(blank.fields['spouse_nationality']?.value === '', 'D.4: Blank app has blank spouse_nationality')
  }

  // =========================================================================
  // TEST E: PASSPORT DATE INTEGRITY VALIDATION
  // =========================================================================
  console.log('\n--- Test E: Passport Date Integrity ---')
  {
    // E.1: valid issue < expiry passes
    const validResult = validatePassportDates('10/01/2020', '09/01/2030')
    assert(validResult.isValid === true, 'E.1: Valid issue < expiry passes (isValid: true)')
    assert(validResult.needsManualReview === false, 'E.1: Valid issue < expiry does not need manual review')

    // E.2: issue == expiry fails
    const equalResult = validatePassportDates('20/01/2026', '20/01/2026')
    assert(equalResult.isValid === false, 'E.2: Equal issue and expiry dates fails (isValid: false)')
    assert(equalResult.needsManualReview === true, 'E.2: Equal issue and expiry dates requires manual review')
    assert(Boolean(equalResult.error), 'E.2: Equal issue and expiry dates populates error message')

    // E.3: expiry < issue fails
    const invertedResult = validatePassportDates('20/01/2026', '19/01/2026')
    assert(invertedResult.isValid === false, 'E.3: Expiry < issue date fails (isValid: false)')
    assert(invertedResult.needsManualReview === true, 'E.3: Expiry < issue date requires manual review')
    assert(
      Boolean(invertedResult.error?.includes('is before Issue date')),
      'E.3: Expiry < issue date error describes before relationship'
    )

    // E.4: missing issue date is handled safely
    const missingIssueResult = validatePassportDates('', '20/01/2030')
    assert(missingIssueResult.isValid === true, 'E.4: Missing issue date handled safely (isValid: true)')
    assert(missingIssueResult.needsManualReview === false, 'E.4: Missing issue date does not flag error')

    // E.5: missing expiry date is handled safely
    const missingExpiryResult = validatePassportDates('10/01/2020', '')
    assert(missingExpiryResult.isValid === true, 'E.5: Missing expiry date handled safely (isValid: true)')
    assert(missingExpiryResult.needsManualReview === false, 'E.5: Missing expiry date does not flag error')

    // E.6: Inverted dates in populateApplicationFromDocuments are flagged and not silently autofilled
    const invalidDoc = createTestDoc('doc_invalid_dates', {
      passport: {
        issueDate: ef('20/01/2026'),
        expiryDate: ef('19/01/2026'),
      },
    })
    const appInvalidDates = populateApplicationFromDocuments({
      applicantId: 'app_inv_dates',
      passportDoc: invalidDoc,
    })
    const issueF = appInvalidDates.fields['appl.passport_issue_date']
    const expF = appInvalidDates.fields['appl.passport_expiry_date']

    assert(issueF?.value === '', 'E.6: Invalid issue date value is cleared (not silently autofilled)')
    assert(expF?.value === '', 'E.6: Invalid expiry date value is cleared (not silently autofilled)')
    assert(issueF?.hasConflict === true, 'E.6: Invalid issue date has hasConflict = true')
    assert(expF?.hasConflict === true, 'E.6: Invalid expiry date has hasConflict = true')
    assert(issueF?.confidence === 0, 'E.6: Invalid issue date has confidence 0')
    assert(expF?.confidence === 0, 'E.6: Invalid expiry date has confidence 0')
    assert(
      issueF?.originalExtractedValue === '20/01/2026',
      'E.6: Issue date preserves originalExtractedValue for user manual review'
    )
    assert(
      expF?.originalExtractedValue === '19/01/2026',
      'E.6: Expiry date preserves originalExtractedValue for user manual review'
    )

    // E.7: Missing issue date does NOT invent a replacement 10-year date
    const docMissingIssue = createTestDoc('doc_no_issue', {
      passport: {
        expiryDate: ef('15/05/2030'),
      },
    })
    const appNoIssue = populateApplicationFromDocuments({
      applicantId: 'app_no_issue',
      passportDoc: docMissingIssue,
    })
    assert(
      appNoIssue.fields['appl.passport_issue_date']?.value === '',
      'E.7: Missing issue date is NOT derived as expiry - 10 years (stays blank)'
    )
  }

  // =========================================================================
  // TEST F: AUTO-HEAL REMOVAL
  // =========================================================================
  console.log('\n--- Test F: Auto-heal Removal ---')
  {
    const appTsx = fs.readFileSync(path.resolve(__dirname, '../../application/App.tsx'), 'utf-8')
    assert(
      !appTsx.includes('Auto-healing passport document contact info'),
      'F.1: App.tsx does not contain legacy auto-heal block'
    )
    assert(
      !appTsx.includes('processUploadedDocumentPayload('),
      'F.2: App.tsx does not call processUploadedDocumentPayload on workspace load'
    )
  }

  // =========================================================================
  // TEST G: BUILD & SECURITY AUDIT
  // =========================================================================
  console.log('\n--- Test G: Build & Security Audit ---')
  {
    const buildJs = fs.readFileSync(path.resolve(__dirname, '../../../build.js'), 'utf-8')
    assert(
      !buildJs.includes('VITE_GEMINI_API_KEY'),
      'G.1: build.js does not inject VITE_GEMINI_API_KEY into frontend bundle'
    )
    assert(
      !buildJs.includes('ensureTesseractAssets'),
      'G.2: build.js does not copy Tesseract assets'
    )
    assert(
      !buildJs.includes('ensurePdfjsAssets'),
      'G.3: build.js does not copy PDF.js assets'
    )

    const manifestJson = fs.readFileSync(path.resolve(__dirname, '../../../public/manifest.json'), 'utf-8')
    assert(
      !manifestJson.includes('tesseract/'),
      'G.4: manifest.json web_accessible_resources does not reference tesseract/'
    )
    assert(
      !manifestJson.includes('pdfjs/'),
      'G.5: manifest.json web_accessible_resources does not reference pdfjs/'
    )
  }

  console.log('\n==================================================')
  if (failures.length === 0) {
    console.log('TASK 113 TESTS RESULT: ✅ ALL PASSED')
  } else {
    console.log('TASK 113 TESTS RESULT: ❌ FAILED')
  }
  console.log(`Total assertions: ${totalSubtests}`)
  console.log(`Passed: ${totalSubtests - failures.length}`)
  console.log(`Failed: ${failures.length}`)
  if (failures.length > 0) {
    console.log('Failures:')
    failures.forEach((f) => console.log(`  - ${f}`))
  }
  console.log('==================================================\n')

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}

// Auto-run if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runTask113Tests().then((res) => {
    process.exit(res.passed ? 0 : 1)
  })
}
