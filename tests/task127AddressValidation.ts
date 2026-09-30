/**
 * TASK 127 — Real Address Extraction & Workspace Field Mapping Validation
 * Tests complete chain: PDF -> Python -> TypeScript client -> applicationMerger -> SavedApplication -> Workspace fields
 */

import * as fs from 'fs'
import * as path from 'path'
import './setup.ts'
import {
  extractPassportWithPython,
  mapPythonResultToExtractedApplicant,
} from '../src/core/extraction/local/pythonExtractorClient'
import {
  populateApplicationFromDocuments,
} from '../src/core/application/applicationMerger'
import { DocumentRecord } from '../src/types/application'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`)
    throw new Error(`Assertion failed: ${msg}`)
  }
  console.log(`  ✓ ${msg}`)
}

async function runTask127Tests() {
  console.log('=================================================================')
  console.log('TASK 127: FINAL ADDRESS EXTRACTION + WORKSPACE MAPPING VALIDATION')
  console.log('=================================================================\n')

  const fixturesDir = path.resolve('tests/fixtures')

  // --------------------------------------------------------------------------
  // TEST 1: Josoda passport.pdf (Scanned Passport)
  // --------------------------------------------------------------------------
  console.log('>>> TEST 1: Josoda passport.pdf (Scanned Passport with single address block)')
  const josodaPath = path.join(fixturesDir, 'Josoda passport.pdf')
  const josodaBuffer = fs.readFileSync(josodaPath)
  const josodaBlob = new Blob([josodaBuffer], { type: 'application/pdf' })
  const josodaPyResult = await extractPassportWithPython(josodaBlob, 'Josoda passport.pdf')
  assert(Boolean(josodaPyResult), 'Python service returned result for Josoda')
  console.log('  Raw Python Present Address:', josodaPyResult.presentAddress)
  console.log('  Raw Python Permanent Address:', josodaPyResult.permanentAddress)

  const josodaExtracted = mapPythonResultToExtractedApplicant(josodaPyResult)
  assert(Boolean(josodaExtracted), 'Mapped Python result to ExtractedApplicantData')

  const josodaDoc: DocumentRecord = {
    documentId: 'doc_josoda',
    applicantId: 'appl_josoda',
    documentType: 'passport',
    fileName: 'Josoda passport.pdf',
    mimeType: 'application/pdf',
    fileSize: josodaBuffer.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: josodaExtracted,
    extractedDataConfirmed: true,
  }

  const josodaApp = populateApplicationFromDocuments({
    applicantId: 'appl_josoda',
    passportDoc: josodaDoc,
  })

  console.log('\n  --- Workspace Fields for Josoda ---')
  console.log('  pres_addr1:             ', josodaApp.fields['pres_addr1']?.value, `(${josodaApp.fields['pres_addr1']?.source})`)
  console.log('  village_town_city:      ', josodaApp.fields['village_town_city']?.value, `(${josodaApp.fields['village_town_city']?.source})`)
  console.log('  state_province:         ', josodaApp.fields['state_province']?.value, `(${josodaApp.fields['state_province']?.source})`)
  console.log('  district:               ', josodaApp.fields['district']?.value, `(${josodaApp.fields['district']?.source})`)
  console.log('  pincode:                ', josodaApp.fields['pincode']?.value, `(${josodaApp.fields['pincode']?.source})`)
  console.log('  present_country:        ', josodaApp.fields['present_country']?.value, `(${josodaApp.fields['present_country']?.source})`)
  console.log('  pres_phone:             ', josodaApp.fields['pres_phone']?.value)
  console.log('  isd_code:               ', josodaApp.fields['isd_code']?.value)
  console.log('  mobile:                 ', josodaApp.fields['mobile']?.value)
  console.log('  perm_add1:              ', josodaApp.fields['perm_add1']?.value, `(${josodaApp.fields['perm_add1']?.source})`)
  console.log('  perm_village_town_city: ', josodaApp.fields['permanent_village_town_city']?.value, `(${josodaApp.fields['permanent_village_town_city']?.source})`)
  console.log('  perm_state_province:    ', josodaApp.fields['permanent_state_province']?.value, `(${josodaApp.fields['permanent_state_province']?.source})`)
  console.log('  perm_postal_code:       ', josodaApp.fields['permanent_postal_code']?.value, `(${josodaApp.fields['permanent_postal_code']?.source})`)
  console.log('  perm_country:           ', josodaApp.fields['permanent_country']?.value, `(${josodaApp.fields['permanent_country']?.source})`)

  // 1. Present Address assertions
  assert(josodaApp.fields['pres_addr1']?.value === 'KASHIPUR', 'House No./Street is KASHIPUR')
  assert(josodaApp.fields['village_town_city']?.value.startsWith('RANISANKAIL'), 'Town/Village/City starts with RANISANKAIL')
  assert(josodaApp.fields['state_province']?.value === 'THAKURGAON', 'State/Province/District is THAKURGAON')
  assert(josodaApp.fields['district']?.value === 'THAKURGAON', 'District is THAKURGAON')
  assert(josodaApp.fields['pincode']?.value === '5120', 'ZIP / Postal Code is 5120')
  assert(josodaApp.fields['present_country']?.value === 'BANGLADESH', 'Country is BANGLADESH')

  // 2. Phone assertions
  assert(josodaApp.fields['isd_code']?.value === '880', 'ISD is 880')
  assert(Boolean(josodaApp.fields['mobile']?.value), 'Mobile is populated')

  // 3. Permanent Address copy assertions (since passport only has one address block)
  assert(josodaApp.fields['perm_add1']?.value === 'KASHIPUR', 'Permanent Address Line 1 is copied from Present Address')
  assert(josodaApp.fields['perm_add1']?.source === 'derived', 'Permanent Address Line 1 source is derived')
  assert(josodaApp.fields['permanent_village_town_city']?.value.startsWith('RANISANKAIL'), 'Permanent Village/Town/City starts with RANISANKAIL')
  assert(josodaApp.fields['permanent_village_town_city']?.source === 'derived', 'Permanent Village/Town/City source is derived')
  assert(josodaApp.fields['permanent_state_province']?.value === 'THAKURGAON', 'Permanent State/Province/District is copied')
  assert(josodaApp.fields['permanent_postal_code']?.value === '5120', 'Permanent Postal Code is copied')
  assert(josodaApp.fields['permanent_postal_code']?.source === 'derived', 'Permanent Postal Code source is derived')
  assert(josodaApp.fields['permanent_country']?.value === 'BANGLADESH', 'Permanent Country is copied')

  // 4. Core field regression protection
  assert((josodaApp.fields['appl.surname']?.value || josodaApp.fields['surname']?.value) === 'RAY', 'Surname RAY intact')
  assert((josodaApp.fields['appl.applname']?.value || josodaApp.fields['given_name']?.value) === 'SHREE JOTIMOY', 'Given name SHREE JOTIMOY intact')
  assert((josodaApp.fields['appl.passport_number']?.value || josodaApp.fields['passport_number']?.value) === 'A21496961', 'Passport number A21496961 intact')
  assert((josodaApp.fields['appl.nationality']?.value || josodaApp.fields['nationality']?.value) === 'BANGLADESH', 'Nationality BANGLADESH intact')
  assert(josodaApp.fields['spouse_name']?.value === 'JASHODA RANI', 'Spouse JASHODA RANI intact')

  // --------------------------------------------------------------------------
  // TEST 2: Khokon WEB 27.pdf (Dual Address Document)
  // --------------------------------------------------------------------------
  console.log('\n>>> TEST 2: Khokon WEB 27.pdf (Explicit Separate Present & Permanent Addresses)')
  const khokonPath = path.join(fixturesDir, 'Khokon WEB 27.pdf')
  const khokonBuffer = fs.readFileSync(khokonPath)
  const khokonBlob = new Blob([khokonBuffer], { type: 'application/pdf' })

  const khokonPyResult = await extractPassportWithPython(khokonBlob, 'Khokon WEB 27.pdf')
  assert(Boolean(khokonPyResult), 'Python service returned result for Khokon')
  console.log('  Raw Python Present Address:', khokonPyResult.presentAddress)
  console.log('  Raw Python Permanent Address:', khokonPyResult.permanentAddress)

  const khokonExtracted = mapPythonResultToExtractedApplicant(khokonPyResult)
  const khokonDoc: DocumentRecord = {
    documentId: 'doc_khokon',
    applicantId: 'appl_khokon',
    documentType: 'passport',
    fileName: 'Khokon WEB 27.pdf',
    mimeType: 'application/pdf',
    fileSize: khokonBuffer.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: khokonExtracted,
    extractedDataConfirmed: true,
  }

  const khokonApp = populateApplicationFromDocuments({
    applicantId: 'appl_khokon',
    passportDoc: khokonDoc,
  })

  console.log('\n  --- Workspace Fields for Khokon ---')
  console.log('  pres_addr1:             ', khokonApp.fields['pres_addr1']?.value, `(${khokonApp.fields['pres_addr1']?.source})`)
  console.log('  village_town_city:      ', khokonApp.fields['village_town_city']?.value, `(${khokonApp.fields['village_town_city']?.source})`)
  console.log('  state_province:         ', khokonApp.fields['state_province']?.value, `(${khokonApp.fields['state_province']?.source})`)
  console.log('  district:               ', khokonApp.fields['district']?.value, `(${khokonApp.fields['district']?.source})`)
  console.log('  pincode:                ', khokonApp.fields['pincode']?.value, `(${khokonApp.fields['pincode']?.source})`)
  console.log('  present_country:        ', khokonApp.fields['present_country']?.value, `(${khokonApp.fields['present_country']?.source})`)
  console.log('  perm_add1:              ', khokonApp.fields['perm_add1']?.value, `(${khokonApp.fields['perm_add1']?.source})`)
  console.log('  perm_village_town_city: ', khokonApp.fields['permanent_village_town_city']?.value, `(${khokonApp.fields['permanent_village_town_city']?.source})`)
  console.log('  perm_state_province:    ', khokonApp.fields['permanent_state_province']?.value, `(${khokonApp.fields['permanent_state_province']?.source})`)
  console.log('  perm_postal_code:       ', khokonApp.fields['permanent_postal_code']?.value, `(${khokonApp.fields['permanent_postal_code']?.source})`)
  console.log('  perm_country:           ', khokonApp.fields['permanent_country']?.value, `(${khokonApp.fields['permanent_country']?.source})`)

  // 1. Khokon Present Address assertions
  assert(khokonApp.fields['pres_addr1']?.value === 'DANDAPAL MAREA', 'Present Line 1 is DANDAPAL MAREA')
  assert(khokonApp.fields['village_town_city']?.value === 'KAMALAPUKHURI, DANDAPAL DEBIGANJ', 'Present Town/Village/City is KAMALAPUKHURI, DANDAPAL DEBIGANJ')
  assert(khokonApp.fields['state_province']?.value === 'PANCHAGARH', 'Present State/Province/District is PANCHAGARH')
  assert(khokonApp.fields['pincode']?.value === '5020', 'Present ZIP is 5020')
  assert(khokonApp.fields['present_country']?.value === 'BANGLADESH', 'Present Country is BANGLADESH (not UK)')

  // 2. Khokon Explicit Permanent Address assertions (source must be passport, not derived)
  assert(khokonApp.fields['perm_add1']?.value === 'SONDHANI PARA', 'Permanent Line 1 is SONDHANI PARA')
  assert(khokonApp.fields['perm_add1']?.source === 'passport', 'Permanent Line 1 source is passport (not derived)')
  assert(khokonApp.fields['permanent_village_town_city']?.value === 'BENGHARI, 04, DEBIGANJ, KALIGANJ', 'Permanent Town/Village/City is BENGHARI, 04, DEBIGANJ, KALIGANJ')
  assert(khokonApp.fields['permanent_village_town_city']?.source === 'passport', 'Permanent Town/Village/City source is passport')
  assert(khokonApp.fields['permanent_state_province']?.value === 'PANCHAGARH', 'Permanent State/Province/District is PANCHAGARH')
  assert(khokonApp.fields['permanent_postal_code']?.value === '5020', 'Permanent ZIP is 5020')
  assert(khokonApp.fields['permanent_postal_code']?.source === 'passport', 'Permanent ZIP source is passport')
  assert(khokonApp.fields['permanent_country']?.value === 'BANGLADESH', 'Permanent Country is BANGLADESH')

  // --------------------------------------------------------------------------
  // TEST 3: Manual Edit Precedence Protection
  // --------------------------------------------------------------------------
  console.log('\n>>> TEST 3: Manual User Edit Precedence Protection')
  const baseApp = populateApplicationFromDocuments({
    applicantId: 'appl_manual',
    passportDoc: josodaDoc,
  })

  // User manually edits address fields in Workspace
  baseApp.fields['pres_addr1'] = { value: 'HOUSE 99, ROAD 10 (USER EDITED)', source: 'manual', isUserEdited: true }
  baseApp.manualEdits['pres_addr1'] = true

  baseApp.fields['village_town_city'] = { value: 'CUSTOM TOWN (USER EDITED)', source: 'manual', isUserEdited: true }
  baseApp.manualEdits['village_town_city'] = true

  baseApp.fields['state_province'] = { value: 'CUSTOM STATE (USER EDITED)', source: 'manual', isUserEdited: true }
  baseApp.manualEdits['state_province'] = true

  baseApp.fields['pincode'] = { value: '9999', source: 'manual', isUserEdited: true }
  baseApp.manualEdits['pincode'] = true

  baseApp.fields['perm_add1'] = { value: 'PERM HOUSE 77 (USER EDITED)', source: 'manual', isUserEdited: true }
  baseApp.manualEdits['perm_add1'] = true

  // Re-process / merge with document again
  const reloadedApp = populateApplicationFromDocuments({
    applicantId: 'appl_manual',
    passportDoc: josodaDoc,
    existingApp: baseApp,
  })

  assert(reloadedApp.fields['pres_addr1']?.value === 'HOUSE 99, ROAD 10 (USER EDITED)', 'Manual pres_addr1 preserved')
  assert(reloadedApp.fields['pres_addr1']?.source === 'manual', 'pres_addr1 source is manual')
  assert(reloadedApp.fields['village_town_city']?.value === 'CUSTOM TOWN (USER EDITED)', 'Manual village_town_city preserved')
  assert(reloadedApp.fields['village_town_city']?.source === 'manual', 'village_town_city source is manual')
  assert(reloadedApp.fields['state_province']?.value === 'CUSTOM STATE (USER EDITED)', 'Manual state_province preserved')
  assert(reloadedApp.fields['state_province']?.source === 'manual', 'state_province source is manual')
  assert(reloadedApp.fields['pincode']?.value === '9999', 'Manual pincode preserved')
  assert(reloadedApp.fields['pincode']?.source === 'manual', 'pincode source is manual')
  assert(reloadedApp.fields['perm_add1']?.value === 'PERM HOUSE 77 (USER EDITED)', 'Manual perm_add1 preserved')
  assert(reloadedApp.fields['perm_add1']?.source === 'manual', 'perm_add1 source is manual')

  // --------------------------------------------------------------------------
  // TEST 4: Pure Address Segmentation & Workspace Mapping Test Cases
  // --------------------------------------------------------------------------
  console.log('\n>>> TEST 4: Pure Address Segmentation & Workspace Mapping Test Cases')
  const testCases = [
    {
      raw: 'KASHIPUR, RANISANKAIL, THAKURGAON',
      expectedLine1: 'KASHIPUR',
      expectedCity: 'RANISANKAIL',
      expectedState: 'THAKURGAON'
    },
    {
      raw: 'A, B, C, D',
      expectedLine1: 'A',
      expectedCity: 'B, C',
      expectedState: 'D'
    },
    {
      raw: 'A, B, C, D, E',
      expectedLine1: 'A',
      expectedCity: 'B, C, D',
      expectedState: 'E'
    },
    {
      raw: 'A, B',
      expectedLine1: 'A',
      expectedCity: '',
      expectedState: 'B'
    },
    {
      raw: 'A',
      expectedLine1: 'A',
      expectedCity: '',
      expectedState: ''
    }
  ]

  for (const tc of testCases) {
    const mockApp = populateApplicationFromDocuments({
      applicantId: 'appl_pure',
      passportDoc: {
        documentId: 'doc_pure',
        applicantId: 'appl_pure',
        documentType: 'passport',
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        fileSize: 1000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'processed',
        source: 'user-upload',
        extractedData: {
          presentAddress: {
            addressLine1: { value: tc.expectedLine1, source: 'passport', confidence: 1.0 },
            villageTownCity: tc.expectedCity ? { value: tc.expectedCity, source: 'passport', confidence: 1.0 } : undefined,
            stateProvince: tc.expectedState ? { value: tc.expectedState, source: 'passport', confidence: 1.0 } : undefined,
            district: tc.expectedState ? { value: tc.expectedState, source: 'passport', confidence: 1.0 } : undefined,
          }
        },
        extractedDataConfirmed: true
      }
    })

    assert((mockApp.fields['pres_addr1']?.value || '') === tc.expectedLine1, `Pure segmentation "${tc.raw}" -> pres_addr1 === "${tc.expectedLine1}"`)
    assert((mockApp.fields['village_town_city']?.value || '') === tc.expectedCity, `Pure segmentation "${tc.raw}" -> village_town_city === "${tc.expectedCity}"`)
    assert((mockApp.fields['state_province']?.value || '') === tc.expectedState, `Pure segmentation "${tc.raw}" -> state_province === "${tc.expectedState}"`)
    assert((mockApp.fields['perm_add1']?.value || '') === tc.expectedLine1, `Permanent copy "${tc.raw}" -> perm_add1 === "${tc.expectedLine1}"`)
    assert((mockApp.fields['permanent_village_town_city']?.value || '') === tc.expectedCity, `Permanent copy "${tc.raw}" -> permanent_village_town_city === "${tc.expectedCity}"`)
    assert((mockApp.fields['permanent_state_province']?.value || '') === tc.expectedState, `Permanent copy "${tc.raw}" -> permanent_state_province === "${tc.expectedState}"`)
  }

  console.log('\n=================================================================')
  console.log('✅ ALL TASK 127 ADDRESS AND WORKSPACE VALIDATION TESTS PASSED!')
  console.log('=================================================================\n')
}

runTask127Tests().catch((err) => {
  console.error('Fatal error running Task 127 validation:', err)
  process.exit(1)
})
