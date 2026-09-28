import { populateApplicationFromDocuments } from '../applicationMerger'
import type { DocumentRecord } from '../../document/types'
import type { ExtractedApplicantData, ExtractedField, ExtractionSource } from '../../extraction/data/types'
import {
  mapPythonResultToExtractedApplicant,
  type PythonPassportExtractionResult,
} from '../../extraction/local/pythonExtractorClient'

function ef<T>(value: T, source: ExtractionSource = 'ocr'): ExtractedField<T> {
  return { value, source, confidence: 95 }
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

export async function runTask120Tests(): Promise<{ passed: boolean; failures: string[] }> {
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

  console.log('=== RUNNING TASK 120: ADDRESS EXTRACTION & WORKSPACE MAPPING TESTS ===\n')

  // -------------------------------------------------------------------------
  // CASE A: Structured Labeled Address
  // -------------------------------------------------------------------------
  console.log('--- CASE A: Structured Labeled Address ---')
  {
    const pyResult: PythonPassportExtractionResult = {
      personal: { surname: 'RAY', givenName: 'JOTIMOY', dateOfBirth: '1993-09-18', gender: 'male', nationality: 'BANGLADESHI', placeOfBirth: 'THAKURGAON', countryOfBirth: '', nid: '' },
      passport: { number: 'A12345678', issueDate: '2020-01-01', expiryDate: '2030-01-01', issuePlace: 'DHAKA', issuingCountry: 'BGD' },
      presentAddress: {
        line1: 'VILL: KASHIPUR',
        line2: 'PO: RANISANKAIL',
        city: 'THAKURGAON',
        district: 'THAKURGAON',
        stateProvince: 'THAKURGAON',
        postalCode: '5120',
        country: 'BANGLADESH',
      },
      mrz: { detected: false, valid: false, rawLines: [], confidence: 0 },
      fieldSources: {
        presentAddress: { source: 'ocr', confidence: 0.95 },
      },
    }

    const extracted = mapPythonResultToExtractedApplicant(pyResult)
    testAssert(extracted.presentAddress?.addressLine1?.value === 'VILL: KASHIPUR', 'Case A.1: Present Address Line 1 mapped')
    testAssert(extracted.presentAddress?.addressLine2?.value === 'PO: RANISANKAIL', 'Case A.2: Present Address Line 2 mapped')
    testAssert(extracted.presentAddress?.villageTownCity?.value === 'THAKURGAON', 'Case A.3: City mapped')
    testAssert(extracted.presentAddress?.district?.value === 'THAKURGAON', 'Case A.4: District mapped')
    testAssert(extracted.presentAddress?.postalCode?.value === '5120', 'Case A.5: Postal Code mapped')
    testAssert(extracted.presentAddress?.country?.value === 'BANGLADESH', 'Case A.6: Country mapped')
  }

  // -------------------------------------------------------------------------
  // CASE B: Address Split Across Multiple OCR Boxes Reconstructed
  // -------------------------------------------------------------------------
  console.log('\n--- CASE B: Address Split Across Multiple OCR Boxes Reconstructed ---')
  {
    const pyResult: PythonPassportExtractionResult = {
      personal: { surname: 'RAY', givenName: 'JOTIMOY', dateOfBirth: '1993-09-18', gender: 'male', nationality: 'BANGLADESHI', placeOfBirth: 'THAKURGAON', countryOfBirth: '', nid: '' },
      passport: { number: 'A12345678', issueDate: '2020-01-01', expiryDate: '2030-01-01', issuePlace: 'DHAKA', issuingCountry: 'BGD' },
      presentAddress: {
        line1: 'KASHIPUR',
        line2: 'RANISANKAIL, MUZAHIDABAD COLONI',
        city: 'THAKURGAON',
        district: 'THAKURGAON',
        postalCode: '5120',
        country: '',
      },
      mrz: { detected: false, valid: false, rawLines: [], confidence: 0 },
      fieldSources: { presentAddress: { source: 'ocr', confidence: 0.95 } },
    }

    const extracted = mapPythonResultToExtractedApplicant(pyResult)
    testAssert(extracted.presentAddress?.addressLine1?.value === 'KASHIPUR', 'Case B.1: First box became Line 1')
    testAssert(extracted.presentAddress?.addressLine2?.value === 'RANISANKAIL, MUZAHIDABAD COLONI', 'Case B.2: Intermediate boxes preserved in Line 2')
    testAssert(extracted.presentAddress?.villageTownCity?.value === 'THAKURGAON', 'Case B.3: City extracted')
    testAssert(extracted.presentAddress?.district?.value === 'THAKURGAON', 'Case B.4: District extracted')
    testAssert(extracted.presentAddress?.postalCode?.value === '5120', 'Case B.5: Postal code preserved')
  }

  // -------------------------------------------------------------------------
  // CASE C: Address With ZIP Code
  // -------------------------------------------------------------------------
  console.log('\n--- CASE C: Address With ZIP Code ---')
  {
    const pyResult: PythonPassportExtractionResult = {
      personal: { surname: 'AHMED', givenName: 'RAHIM', dateOfBirth: '1990-01-01', gender: 'male', nationality: 'BGD', placeOfBirth: 'DHAKA', countryOfBirth: '', nid: '' },
      passport: { number: 'A99887766', issueDate: '2020-01-01', expiryDate: '2030-01-01', issuePlace: 'DHAKA', issuingCountry: 'BGD' },
      presentAddress: {
        line1: 'HOUSE 10, ROAD 4',
        line2: 'DHANMONDI',
        city: 'DHAKA',
        district: 'DHAKA',
        postalCode: '1205',
        country: 'BANGLADESH',
      },
      mrz: { detected: false, valid: false, rawLines: [], confidence: 0 },
      fieldSources: { presentAddress: { source: 'ocr', confidence: 0.98 } },
    }

    const doc = createDoc('case_c', mapPythonResultToExtractedApplicant(pyResult))
    const app = populateApplicationFromDocuments({ applicantId: 'app_c', passportDoc: doc })

    testAssert(app.fields['pincode']?.value === '1205', 'Case C.1: pincode is 1205')
    testAssert(app.fields['pincode']?.source === 'passport', 'Case C.2: pincode source is passport')
    testAssert(app.fields['permanent_postal_code']?.value === '1205', 'Case C.3: permanent_postal_code is copied')
    testAssert(app.fields['permanent_postal_code']?.source === 'derived', 'Case C.4: permanent_postal_code source is derived')
  }

  // -------------------------------------------------------------------------
  // CASE D: Address With Phone +880
  // -------------------------------------------------------------------------
  console.log('\n--- CASE D: Address With Phone +880 ---')
  {
    const pyResult: PythonPassportExtractionResult = {
      personal: { surname: 'RAY', givenName: 'JOTIMOY', dateOfBirth: '1993-09-18', gender: 'male', nationality: 'BANGLADESHI', placeOfBirth: 'THAKURGAON', countryOfBirth: '', nid: '' },
      passport: { number: 'A12345678', issueDate: '2020-01-01', expiryDate: '2030-01-01', issuePlace: 'DHAKA', issuingCountry: 'BGD' },
      presentAddress: {
        line1: 'KASHIPUR',
        line2: 'RANISANKAIL',
        city: 'THAKURGAON',
        district: 'THAKURGAON',
        postalCode: '5120',
        country: '',
        phone: '+8801744777846',
      },
      mrz: { detected: false, valid: false, rawLines: [], confidence: 0 },
      fieldSources: { presentAddress: { source: 'ocr', confidence: 0.95 } },
    }

    const doc = createDoc('case_d', mapPythonResultToExtractedApplicant(pyResult))
    const app = populateApplicationFromDocuments({ applicantId: 'app_d', passportDoc: doc })

    testAssert(app.fields['pres_phone']?.value === '+8801744777846', 'Case D.1: pres_phone is +8801744777846')
    testAssert(app.fields['isd_code']?.value === '880', 'Case D.2: isd_code is 880')
    testAssert(app.fields['mobile']?.value === '1744777846', 'Case D.3: mobile is 1744777846')
    // Ensure phone did not contaminate address line 1 or line 2
    testAssert(!String(app.fields['pres_addr1']?.value || '').includes('+880'), 'Case D.4: Address Line 1 does not contain phone')
    testAssert(!String(app.fields['pres_addr2']?.value || '').includes('+880'), 'Case D.5: Address Line 2 does not contain phone')
  }

  // -------------------------------------------------------------------------
  // CASE E: No Explicit Permanent Address -> Permanent = Complete Present Address
  // -------------------------------------------------------------------------
  console.log('\n--- CASE E: No Explicit Permanent Address -> Copied with Derived Badge ---')
  {
    const pyResult: PythonPassportExtractionResult = {
      personal: { surname: 'RAY', givenName: 'JOTIMOY', dateOfBirth: '1993-09-18', gender: 'male', nationality: 'BANGLADESHI', placeOfBirth: 'THAKURGAON', countryOfBirth: '', nid: '' },
      passport: { number: 'A12345678', issueDate: '2020-01-01', expiryDate: '2030-01-01', issuePlace: 'DHAKA', issuingCountry: 'BGD' },
      presentAddress: {
        line1: 'KASHIPUR',
        line2: 'RANISANKAIL, MUZAHIDABAD COLONI',
        city: 'THAKURGAON',
        district: 'THAKURGAON',
        stateProvince: 'THAKURGAON',
        postalCode: '5120',
        country: '',
      },
      // Note: permanentAddress is NOT provided
      mrz: { detected: false, valid: false, rawLines: [], confidence: 0 },
      fieldSources: { presentAddress: { source: 'ocr', confidence: 0.95 } },
    }

    const extracted = mapPythonResultToExtractedApplicant(pyResult)
    testAssert(extracted.permanentAddress !== undefined, 'Case E.1: permanentAddress is populated in ExtractedApplicantData')
    testAssert(extracted.permanentAddress?.sameAsPresentAddress?.value === true, 'Case E.2: sameAsPresentAddress is true')
    testAssert(extracted.permanentAddress?.sameAsPresentAddress?.source === 'derived', 'Case E.3: sameAsPresentAddress source is derived')
    testAssert(extracted.permanentAddress?.addressLine1?.source === 'derived', 'Case E.4: Permanent address line 1 source is derived')

    const doc = createDoc('case_e', extracted)
    const app = populateApplicationFromDocuments({ applicantId: 'app_e', passportDoc: doc })

    testAssert(app.fields['perm_add1']?.value === 'KASHIPUR', 'Case E.5: perm_add1 copied from pres_addr1')
    testAssert(app.fields['perm_add1']?.source === 'derived', 'Case E.6: perm_add1 source is derived')
    testAssert(app.fields['perm_add2']?.value === 'RANISANKAIL, MUZAHIDABAD COLONI', 'Case E.7: perm_add2 copied')
    testAssert(app.fields['perm_add2']?.source === 'derived', 'Case E.8: perm_add2 source is derived')
    testAssert(app.fields['permanent_village_town_city']?.value === 'THAKURGAON', 'Case E.9: perm city copied')
    testAssert(app.fields['permanent_district']?.value === 'THAKURGAON', 'Case E.10: perm district copied')
    testAssert(app.fields['permanent_postal_code']?.value === '5120', 'Case E.11: perm postal code copied')
    testAssert(app.fields['permanent_postal_code']?.source === 'derived', 'Case E.12: perm postal code source is derived')
  }

  // -------------------------------------------------------------------------
  // CASE F: Explicit Separate Permanent Address
  // -------------------------------------------------------------------------
  console.log('\n--- CASE F: Explicit Separate Permanent Address ---')
  {
    const pyResult: PythonPassportExtractionResult = {
      personal: { surname: 'ISLAM', givenName: 'KHOKON', dateOfBirth: '1985-05-15', gender: 'male', nationality: 'BANGLADESHI', placeOfBirth: 'PANCHAGARH', countryOfBirth: '', nid: '' },
      passport: { number: 'A55443322', issueDate: '2021-01-01', expiryDate: '2031-01-01', issuePlace: 'DHAKA', issuingCountry: 'BGD' },
      presentAddress: {
        line1: 'DANDAPAL MAREA',
        line2: 'KAMALAPUKHURI, DANDAPAL DEBIGANJ',
        city: 'PANCHAGARH',
        district: 'PANCHAGARH',
        postalCode: '5020',
        country: 'BANGLADESH',
      },
      permanentAddress: {
        line1: 'SONDHANI PARA, BENGHARI, 04',
        line2: 'DEBIGANJ, KALIGANJ',
        city: 'PANCHAGARH',
        district: 'PANCHAGARH',
        postalCode: '5020',
        country: 'BANGLADESH',
      },
      mrz: { detected: false, valid: false, rawLines: [], confidence: 0 },
      fieldSources: {
        presentAddress: { source: 'pdf_text', confidence: 0.99 },
        permanentAddress: { source: 'pdf_text', confidence: 0.99 },
      },
    }

    const extracted = mapPythonResultToExtractedApplicant(pyResult)
    testAssert(extracted.permanentAddress?.sameAsPresentAddress?.value === false, 'Case F.1: sameAsPresentAddress is false')
    testAssert(extracted.permanentAddress?.addressLine1?.source === 'pdf-text', 'Case F.2: Permanent address line 1 source is pdf-text (not derived)')

    const doc = createDoc('case_f', extracted)
    const app = populateApplicationFromDocuments({ applicantId: 'app_f', passportDoc: doc })

    testAssert(app.fields['pres_addr1']?.value === 'DANDAPAL MAREA', 'Case F.3: pres_addr1 is DANDAPAL MAREA')
    testAssert(app.fields['perm_add1']?.value === 'SONDHANI PARA, BENGHARI, 04', 'Case F.4: perm_add1 is SONDHANI PARA')
    testAssert(app.fields['perm_add1']?.source === 'passport', 'Case F.5: perm_add1 source is passport (not derived)')
    testAssert(app.fields['perm_add2']?.value === 'DEBIGANJ, KALIGANJ', 'Case F.6: perm_add2 is DEBIGANJ, KALIGANJ')
  }

  // -------------------------------------------------------------------------
  // CASE G: No Postal Code In Document -> Remains Missing, Not Fabricated
  // -------------------------------------------------------------------------
  console.log('\n--- CASE G: No Postal Code In Document -> Stays Blank ---')
  {
    const docNoZip = createDoc('case_g', {
      presentAddress: {
        addressLine1: ef('VILLAGE ROAD'),
        district: ef('DINAJPUR'),
      },
    })

    const app = populateApplicationFromDocuments({ applicantId: 'app_g', passportDoc: docNoZip })
    testAssert(app.fields['pincode']?.value === '' || app.fields['pincode']?.value === undefined, 'Case G.1: Present pincode is empty')
    testAssert(app.fields['permanent_postal_code']?.value === '' || app.fields['permanent_postal_code']?.value === undefined, 'Case G.2: Permanent pincode is empty')
  }

  // -------------------------------------------------------------------------
  // CASE H: Foreign Address
  // -------------------------------------------------------------------------
  console.log('\n--- CASE H: Foreign Address -> Country Remains Foreign ---')
  {
    const pyResult: PythonPassportExtractionResult = {
      personal: { surname: 'SMITH', givenName: 'JOHN', dateOfBirth: '1980-01-01', gender: 'male', nationality: 'AMERICAN', placeOfBirth: 'NEW YORK', countryOfBirth: 'USA', nid: '' },
      passport: { number: 'USA12345678', issueDate: '2020-01-01', expiryDate: '2030-01-01', issuePlace: 'WASHINGTON', issuingCountry: 'USA' },
      presentAddress: {
        line1: '450 5TH AVE',
        city: 'NEW YORK',
        district: 'NEW YORK',
        stateProvince: 'NY',
        postalCode: '10018',
        country: 'USA',
      },
      mrz: { detected: false, valid: false, rawLines: [], confidence: 0 },
      fieldSources: { presentAddress: { source: 'ocr', confidence: 0.98 } },
    }

    const doc = createDoc('case_h', mapPythonResultToExtractedApplicant(pyResult))
    const app = populateApplicationFromDocuments({ applicantId: 'app_h', passportDoc: doc })

    testAssert(app.fields['present_country']?.value === 'USA', 'Case H.1: Present Country is USA')
    testAssert(app.fields['present_country']?.value !== 'BANGLADESH', 'Case H.2: Country is not forced to Bangladesh')
  }

  // -------------------------------------------------------------------------
  // CASE I: Unrelated 4-Digit Number In Document -> Not Postal Code
  // -------------------------------------------------------------------------
  console.log('\n--- CASE I: Unrelated 4-Digit Numbers -> Not Made Into Postal Code ---')
  {
    const docWithYear = createDoc('case_i', {
      personal: {
        dateOfBirth: ef('1993-09-18'),
      },
      passport: {
        issueDate: ef('2026-01-20'),
      },
      presentAddress: {
        addressLine1: ef('KASHIPUR'),
        district: ef('THAKURGAON'),
      },
    })

    const app = populateApplicationFromDocuments({ applicantId: 'app_i', passportDoc: docWithYear })
    testAssert(app.fields['pincode']?.value !== '1993', 'Case I.1: Birth year 1993 did not become pincode')
    testAssert(app.fields['pincode']?.value !== '2026', 'Case I.2: Issue year 2026 did not become pincode')
  }

  // -------------------------------------------------------------------------
  // CASE J: Manual Present & Permanent Address Edits Precedence
  // -------------------------------------------------------------------------
  console.log('\n--- CASE J: Manual Present & Permanent Address Edits Precedence ---')
  {
    const pyResult: PythonPassportExtractionResult = {
      personal: { surname: 'RAY', givenName: 'JOTIMOY', dateOfBirth: '1993-09-18', gender: 'male', nationality: 'BANGLADESHI', placeOfBirth: 'THAKURGAON', countryOfBirth: '', nid: '' },
      passport: { number: 'A12345678', issueDate: '2020-01-01', expiryDate: '2030-01-01', issuePlace: 'DHAKA', issuingCountry: 'BGD' },
      presentAddress: {
        line1: 'KASHIPUR',
        line2: 'RANISANKAIL',
        city: 'THAKURGAON',
        district: 'THAKURGAON',
        postalCode: '5120',
        country: 'BANGLADESH',
      },
      mrz: { detected: false, valid: false, rawLines: [], confidence: 0 },
      fieldSources: { presentAddress: { source: 'ocr', confidence: 0.95 } },
    }

    const doc = createDoc('case_j', mapPythonResultToExtractedApplicant(pyResult))
    const baseApp = populateApplicationFromDocuments({ applicantId: 'app_j', passportDoc: doc })

    // Simulate user editing Present Address Line 1 and ZIP
    baseApp.fields['pres_addr1'] = { value: 'HOUSE 99, ROAD 10 (USER EDITED)', source: 'manual', isUserEdited: true }
    baseApp.manualEdits['pres_addr1'] = true
    baseApp.fields['pincode'] = { value: '9999', source: 'manual', isUserEdited: true }
    baseApp.manualEdits['pincode'] = true

    // Simulate user editing Permanent Address Line 1
    baseApp.fields['perm_add1'] = { value: 'PERMANENT VILLAGE (USER EDITED)', source: 'manual', isUserEdited: true }
    baseApp.manualEdits['perm_add1'] = true

    // Re-populate from document (simulate refresh/resync)
    const reloadedApp = populateApplicationFromDocuments({
      applicantId: 'app_j',
      passportDoc: doc,
      existingApp: baseApp,
    })

    testAssert(reloadedApp.fields['pres_addr1']?.value === 'HOUSE 99, ROAD 10 (USER EDITED)', 'Case J.1: Manual pres_addr1 preserved')
    testAssert(reloadedApp.fields['pres_addr1']?.source === 'manual', 'Case J.2: pres_addr1 source is manual')
    testAssert(reloadedApp.fields['pincode']?.value === '9999', 'Case J.3: Manual pincode preserved')
    testAssert(reloadedApp.fields['pincode']?.source === 'manual', 'Case J.4: pincode source is manual')
    testAssert(reloadedApp.fields['perm_add1']?.value === 'PERMANENT VILLAGE (USER EDITED)', 'Case J.5: Manual perm_add1 preserved')
    testAssert(reloadedApp.fields['perm_add1']?.source === 'manual', 'Case J.6: perm_add1 source is manual')

    // Unedited fields come from passport document
    testAssert(reloadedApp.fields['district']?.value === 'THAKURGAON', 'Case J.7: Unedited district still comes from document')
    testAssert(reloadedApp.fields['district']?.source === 'passport', 'Case J.8: Unedited district source is passport')
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n==================================================')
  if (failures.length === 0) {
    console.log('TASK 120 TESTS RESULT: ✅ ALL PASSED')
  } else {
    console.log('TASK 120 TESTS RESULT: ❌ FAILED')
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
    failures,
  }
}

if (process.argv[1] && process.argv[1].includes('task120AddressHandling.test.ts')) {
  runTask120Tests().then((res) => {
    process.exit(res.passed ? 0 : 1)
  })
}
