import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert'
import './setup.ts'
import { processUploadedDocumentPayload } from '../src/core/extraction/pipeline'
import {
  extractPassportWithPython,
  mapPythonResultToExtractedApplicant,
  PythonExtractorError,
  LOCAL_EXTRACTOR_URL,
} from '../src/core/extraction/local/pythonExtractorClient'
import {
  populateApplicationFromDocuments,
  createBlankApplicationWithDefaults,
} from '../src/core/application/applicationMerger'
import {
  saveApplication,
  getSavedApplicationByApplicantId,
  clearMemorySavedApplications,
} from '../src/core/application/applicationStorage'
import type { DocumentRecord } from '../src/core/document/types'
import { getIndiaVisaMappings } from '../src/countries/india/mappingService'
import { resolveCandidateData } from '../src/core/autofill/candidateResolver'
import { runEndToEndWorkflowTests } from '../src/countries/india/__tests__/endToEndWorkflow.test'
import { formatWorkspaceDiagnosticTable } from '../src/core/application/workspaceDiagnostic'

async function runTask116Validation() {
  console.log('=================================================================')
  console.log('TASK 116: REAL END-TO-END VALIDATION OF PYTHON LOCAL OCR INTEGRATION')
  console.log('=================================================================\n')

  const report: Record<string, any> = {
    steps: {},
    timings: {},
    fieldAudit: {},
    failures: [],
  }

  // =========================================================================
  // STEP 1: VERIFY BOTH SYSTEMS & CONNECTIVITY
  // =========================================================================
  console.log('--- 1. VERIFYING PYTHON EXTRACTOR SERVICE & EXTENSION ENVIRONMENT ---')
  const healthRes = await fetch(`${LOCAL_EXTRACTOR_URL}/health`).catch((err) => {
    throw new Error(`Failed to connect to Python service on ${LOCAL_EXTRACTOR_URL}: ${err.message}`)
  })
  assert(healthRes.ok, `Health check returned HTTP ${healthRes.status}`)
  const healthJson = await healthRes.json()
  assert(healthJson.status === 'ok', `Health status is "${healthJson.status}", expected "ok"`)
  console.log(`  ✓ Python Extractor Service is healthy on ${LOCAL_EXTRACTOR_URL} (status: ok)`)
  report.steps['1_service_health'] = 'OK'

  // =========================================================================
  // STEP 2 & 12: REAL PASSPORT E2E TEST & PERFORMANCE MEASUREMENT
  // =========================================================================
  console.log('\n--- 2. REAL PASSPORT E2E TEST (tests/fixtures/Josoda passport.pdf) ---')
  const fixturePath = path.resolve('tests/fixtures/Josoda passport.pdf')
  assert(fs.existsSync(fixturePath), `Fixture missing at ${fixturePath}`)
  const pdfBytes = fs.readFileSync(fixturePath)
  console.log(`  Loaded real fixture: ${fixturePath} (${pdfBytes.length} bytes)`)

  const dataUrl = `data:application/pdf;base64,${pdfBytes.toString('base64')}`

  // Monitor duplicate requests to /extract-passport
  let extractCallCount = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
    if (urlStr.includes('/extract-passport')) {
      extractCallCount++
      console.log(`  [Network Monitor] Intercepted POST /extract-passport (call #${extractCallCount})`)
    }
    return originalFetch(input, init)
  }

  const uploadStart = Date.now()
  let pythonRequestStart = 0
  let pythonResponseReceived = 0

  console.log('  Executing production extraction pipeline: processUploadedDocumentPayload...')
  const pipelineResult = await processUploadedDocumentPayload(
    dataUrl,
    'Josoda passport.pdf',
    'application/pdf',
    {
      onProgress: (p) => {
        if (p.percent === 20 && !pythonRequestStart) {
          pythonRequestStart = Date.now()
        }
        if (p.percent === 85 && !pythonResponseReceived) {
          pythonResponseReceived = Date.now()
        }
        console.log(`    [Progress ${p.percent}%] ${p.text}`)
      },
    }
  )

  const applicationPopulationStart = Date.now()

  // Restore fetch
  globalThis.fetch = originalFetch

  report.timings['upload_start'] = uploadStart
  report.timings['python_request_start'] = pythonRequestStart || uploadStart
  report.timings['python_response_received'] = pythonResponseReceived || Date.now()
  report.timings['python_duration_ms'] = (pythonResponseReceived || Date.now()) - (pythonRequestStart || uploadStart)

  console.log(`  Pipeline result: hasExtractedFields=${pipelineResult.hasExtractedFields}`)
  console.log(`  Source types: ${JSON.stringify(pipelineResult.sourceTypes)}`)
  console.log(`  Extraction error: ${pipelineResult.extractionError || 'None'}`)

  assert(pipelineResult.hasExtractedFields, 'pipelineResult.hasExtractedFields must be true')
  assert(pipelineResult.sourceTypes.includes('ocr'), 'sourceTypes must include "ocr"')
  assert(pipelineResult.sourceTypes.includes('mrz'), 'sourceTypes must include "mrz"')
  assert(!pipelineResult.sourceTypes.includes('ai'), 'Gemini AI must NOT be invoked on success')
  assert(!pipelineResult.extractionError, 'No extraction error should be present')

  const extractedData = pipelineResult.extractedData!
  assert(extractedData, 'extractedData must be populated')

  // =========================================================================
  // STEP 3: VERIFY EVERY IMPORTANT FIELD IN EXTRACTED APPLICANT DATA
  // =========================================================================
  console.log('\n--- 3. FIELD-BY-FIELD EXTRACTION AUDIT ---')

  const surname = extractedData.personal?.lastName?.value
  const givenName = extractedData.personal?.firstName?.value
  const dob = extractedData.personal?.dateOfBirth?.value
  const gender = extractedData.personal?.gender?.value
  const nationality = extractedData.personal?.nationality?.value
  const placeOfBirth = extractedData.personal?.townCityOfBirth?.value
  const countryOfBirth = extractedData.personal?.countryOfBirth?.value || ''
  const nid = extractedData.personal?.nationalIdNumber?.value

  const passportNumber = extractedData.passport?.passportNumber?.value
  const issueDate = extractedData.passport?.issueDate?.value
  const expiryDate = extractedData.passport?.expiryDate?.value
  const issuePlace = extractedData.passport?.placeOfIssue?.value
  const issuingCountry = extractedData.passport?.issuingCountry?.value

  const addressLine1 = extractedData.permanentAddress?.addressLine1?.value
  const addressLine2 = extractedData.permanentAddress?.addressLine2?.value || ''
  const city = extractedData.permanentAddress?.villageTownCity?.value
  const district = extractedData.permanentAddress?.district?.value
  const postalCode = extractedData.permanentAddress?.postalCode?.value
  const country = extractedData.permanentAddress?.country?.value

  console.log('  PERSONAL:')
  console.log(`    - surname: "${surname}" (expected: "RAY")`)
  console.log(`    - given name: "${givenName}" (expected: "SHREE JOTIMOY")`)
  console.log(`    - date of birth: "${dob}" (expected: "1993-09-18")`)
  console.log(`    - gender: "${gender}" (expected: "male")`)
  console.log(`    - nationality: "${nationality}" (expected: "BANGLADESH")`)
  console.log(`    - place of birth: "${placeOfBirth}" (expected: "THAKURGAON")`)
  console.log(`    - country of birth: "${countryOfBirth}" (expected: "" / blank)`)
  console.log(`    - NID: "${nid}" (expected: "8235626051")`)

  console.log('  PASSPORT:')
  console.log(`    - passport number: "${passportNumber}" (expected: "A21496961")`)
  console.log(`    - issue date: "${issueDate}" (expected: "2026-01-20")`)
  console.log(`    - expiry date: "${expiryDate}" (expected: "2031-01-19")`)
  console.log(`    - issue place: "${issuePlace}" (expected: "DIP/DHAKA")`)
  console.log(`    - issuing country: "${issuingCountry}" (expected: "BANGLADESH")`)

  console.log('  ADDRESS:')
  console.log(`    - address line 1: "${addressLine1}" (expected: "KASHIPUR")`)
  console.log(`    - address line 2: "${addressLine2}"`)
  console.log(`    - city: "${city}" (expected: "THAKURGAON")`)
  console.log(`    - district: "${district}" (expected: "THAKURGAON")`)
  console.log(`    - postal code: "${postalCode}" (expected: "5120")`)
  const phone = extractedData.contact?.phone?.value || extractedData.presentAddress?.phone?.value
  console.log(`    - country: "${country}" (expected: "BANGLADESH")`)
  console.log(`    - phone: "${phone}" (expected: "+8801744777846")`)

  assert.strictEqual(surname, 'RAY', 'surname matches RAY')
  assert.strictEqual(givenName, 'SHREE JOTIMOY', 'givenName matches SHREE JOTIMOY')
  assert.strictEqual(phone, '+8801744777846', 'phone matches +8801744777846')
  assert.strictEqual(dob, '1993-09-18', 'DOB matches 1993-09-18')
  assert.strictEqual(gender, 'male', 'gender matches male')
  assert.strictEqual(nationality, 'BANGLADESH', 'nationality matches BANGLADESH')
  assert.strictEqual(placeOfBirth, 'THAKURGAON', 'placeOfBirth matches THAKURGAON')
  assert.strictEqual(countryOfBirth, '', 'countryOfBirth is blank because not in document')
  assert.strictEqual(nid, '8235626051', 'NID matches 8235626051')

  assert.strictEqual(passportNumber, 'A21496961', 'passportNumber matches A21496961')
  assert.strictEqual(issueDate, '2026-01-20', 'issueDate matches 2026-01-20')
  assert.strictEqual(expiryDate, '2031-01-19', 'expiryDate matches 2031-01-19')
  assert.strictEqual(issuePlace, 'DIP/DHAKA', 'issuePlace matches DIP/DHAKA')
  assert.strictEqual(issuingCountry, 'BANGLADESH', 'issuingCountry matches BANGLADESH')

  assert.strictEqual(addressLine1, 'KASHIPUR', 'addressLine1 matches KASHIPUR')
  assert.strictEqual(city, 'THAKURGAON', 'city matches THAKURGAON')
  assert.strictEqual(district, 'THAKURGAON', 'district matches THAKURGAON')
  assert.strictEqual(postalCode, '5120', 'postalCode matches 5120')
  // Address country is not explicitly written in the passport address box; Python strictly leaves it empty
  assert(country === undefined || country === 'BANGLADESH' || country === '', 'extracted address country')

  report.fieldAudit = {
    surname,
    givenName,
    dob,
    gender,
    nationality,
    placeOfBirth,
    countryOfBirth,
    nid,
    passportNumber,
    issueDate,
    expiryDate,
    issuePlace,
    issuingCountry,
    addressLine1,
    addressLine2,
    city,
    district,
    postalCode,
    country,
  }

  // =========================================================================
  // STEP 4: DATA INTEGRITY RULES VERIFICATION
  // =========================================================================
  console.log('\n--- 4. DATA INTEGRITY RULES VERIFICATION ---')

  // Rule A: Place of birth must come ONLY from document extraction.
  // If Python returns blank: place of birth must remain blank. It must NOT become address district, city, issue place.
  const blankPobMock = mapPythonResultToExtractedApplicant({
    personal: { surname: 'TEST', givenName: 'APPLICANT', dateOfBirth: '1990-01-01', gender: 'male', nationality: 'BGD', placeOfBirth: '', countryOfBirth: '', nid: '' },
    passport: { number: 'B12345678', issueDate: '2020-01-01', expiryDate: '2025-01-01', issuePlace: 'DIP/DHAKA', issuingCountry: 'BGD' },
    address: { line1: 'TEST ROAD', line2: '', city: 'CHITTAGONG', district: 'CHITTAGONG', postalCode: '4000', country: 'BANGLADESH' },
    mrz: { detected: false, valid: false, rawLines: [], confidence: 0 },
    fieldSources: {},
  })
  assert.strictEqual(blankPobMock.personal?.townCityOfBirth?.value, undefined, 'Rule A: Blank placeOfBirth must remain undefined/blank')
  console.log('  ✓ Rule A: Blank placeOfBirth remains blank; does not become city, district, or issue place.')

  // Rule B: Country of birth must NOT automatically become Bangladesh if blank.
  assert.strictEqual(blankPobMock.personal?.countryOfBirth?.value, undefined, 'Rule B: Blank countryOfBirth must remain undefined/blank')
  console.log('  ✓ Rule B: Blank countryOfBirth remains blank; not forced to Bangladesh.')

  // Rule C: Nationality must use extracted nationality.
  const indianNatMock = mapPythonResultToExtractedApplicant({
    personal: { surname: 'SHARMA', givenName: 'ROHIT', dateOfBirth: '1987-04-30', gender: 'male', nationality: 'INDIAN', placeOfBirth: 'NAGPUR', countryOfBirth: 'INDIA', nid: '' },
    passport: { number: 'Z98765432', issueDate: '2019-01-01', expiryDate: '2029-01-01', issuePlace: 'MUMBAI', issuingCountry: 'IND' },
    address: { line1: '', line2: '', city: '', district: '', postalCode: '', country: '' },
    mrz: { detected: false, valid: false, rawLines: [], confidence: 0 },
    fieldSources: {},
  })
  assert.strictEqual(indianNatMock.personal?.nationality?.value, 'INDIA', 'Rule C: Nationality uses extracted nationality (INDIA)')
  console.log('  ✓ Rule C: Nationality preserves extracted nationality (e.g. INDIA), never forces Bangladesh.')

  // Rule D: Passport expiry must remain the actual extracted expiry date.
  assert.strictEqual(extractedData.passport?.expiryDate?.value, '2031-01-19', 'Rule D: Expiry date must remain 2031-01-19')
  assert.notStrictEqual(extractedData.passport?.expiryDate?.value, extractedData.passport?.issueDate?.value, 'Rule D: Expiry date must not equal issue date')
  console.log('  ✓ Rule D: Passport expiry (2031-01-19) preserved; never copied from issue date (2026-01-20).')

  // Rule E: Document evidence extraction for father/mother/spouse & no fabrication when absent
  assert.strictEqual(extractedData.family?.father?.name?.value, 'SHREE KHIDAR MOHAN', 'Rule E: Father extracted from document')
  assert.strictEqual(extractedData.family?.mother?.name?.value, 'PANCHAMI RANI', 'Rule E: Mother extracted from document')
  assert.strictEqual(extractedData.family?.spouse?.name?.value, 'JASHODA RANI', 'Rule E: Spouse extracted from document')
  assert.strictEqual(blankPobMock.family, undefined, 'Rule E: No fabricated family fields when absent from document')
  console.log('  ✓ Rule E: Father, mother, and spouse extracted from document evidence; no fabricated family when absent.')

  // Rule F: No fabricated employment data.
  assert.strictEqual(extractedData.employment, undefined, 'Rule F: No fabricated employment fields in ExtractedApplicantData')
  console.log('  ✓ Rule F: No fabricated employment data in extracted applicant payload.')

  // Rule G: Previous passport extracted when present in document
  assert.strictEqual(extractedData.passport?.otherPassportDetails?.passportNumber?.value, 'BK0965579', 'Rule G: Previous passport BK0965579 extracted')
  console.log('  ✓ Rule G: Previous passport extracted from document evidence.')

  // =========================================================================
  // STEP 5 & 6: APPLICATION POPULATION, WORKSPACE PERSISTENCE, & MANUAL EDIT PRECEDENCE
  // =========================================================================
  console.log('\n--- 5 & 6. APPLICATION POPULATION, PERSISTENCE & MANUAL EDIT PRECEDENCE ---')
  clearMemorySavedApplications()

  const applicantId = 'appl_task116_josoda'
  const newDoc: DocumentRecord = {
    documentId: `doc_${Date.now()}`,
    applicantId,
    documentType: 'passport',
    fileName: 'Josoda passport.pdf',
    mimeType: 'application/pdf',
    fileSize: pdfBytes.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData,
    extractedDataConfirmed: true,
  }

  // Populate SavedApplication
  const savedApp = populateApplicationFromDocuments({
    applicantId,
    passportDoc: newDoc,
  })

  const applicationPopulationCompleted = Date.now()
  report.timings['app_population_completed'] = applicationPopulationCompleted
  report.timings['total_pipeline_time_ms'] = applicationPopulationCompleted - uploadStart

  console.log(`  Application populated in ${applicationPopulationCompleted - applicationPopulationStart}ms`)
  console.log(`  SavedApplication fields count: ${Object.keys(savedApp.fields).length}`)

  // Verify fields inside SavedApplication
  assert.strictEqual(savedApp.fields['appl.surname']?.value, 'RAY', 'SavedApp surname is RAY')
  assert.strictEqual(savedApp.fields['appl.applname']?.value, 'SHREE JOTIMOY', 'SavedApp given name is SHREE JOTIMOY')
  assert(savedApp.fields['appl.birthdate']?.value === '18/09/1993' || savedApp.fields['appl.birthdate']?.value === '1993-09-18', 'SavedApp DOB')
  assert(savedApp.fields['appl.applsex']?.value === 'MALE' || savedApp.fields['appl.applsex']?.value === 'male', 'SavedApp sex is MALE')
  assert.strictEqual(savedApp.fields['appl.nationality']?.value, 'BANGLADESH', 'SavedApp nationality is BANGLADESH')
  assert.strictEqual(savedApp.fields['appl.placbrth']?.value, 'THAKURGAON', 'SavedApp place of birth is THAKURGAON')
  assert.strictEqual(savedApp.fields['appl.nic_no']?.value, '8235626051', 'SavedApp NID is 8235626051')

  const appPptNo = savedApp.fields['appl.passport_number']?.value || savedApp.fields['appl.pptno']?.value
  assert.strictEqual(appPptNo, 'A21496961', 'SavedApp passport number is A21496961')

  const appIssueDate = savedApp.fields['appl.passport_issue_date']?.value || savedApp.fields['appl.issuedate']?.value
  assert(appIssueDate === '20/01/2026' || appIssueDate === '2026-01-20', 'SavedApp issue date')

  const appExpDate = savedApp.fields['appl.passport_expiry_date']?.value || savedApp.fields['appl.expdate']?.value
  assert(appExpDate === '19/01/2031' || appExpDate === '2031-01-19', 'SavedApp expiry date is 19/01/2031')

  const appIssuePlace = savedApp.fields['appl.passport_issue_place']?.value || savedApp.fields['appl.issueplace']?.value
  // applicationMerger normalizes "DIP/DHAKA" -> "DHAKA" for Indian visa portal compatibility
  assert(appIssuePlace === 'DHAKA' || appIssuePlace === 'DIP/DHAKA', `SavedApp issue place is normalized (got "${appIssuePlace}")`)

  assert.strictEqual(savedApp.fields['pres_addr1']?.value, 'KASHIPUR', 'SavedApp pres_addr1 is KASHIPUR')
  assert.strictEqual(savedApp.fields['village_town_city']?.value, 'THAKURGAON', 'SavedApp village_town_city is THAKURGAON')
  assert.strictEqual(savedApp.fields['district']?.value, 'THAKURGAON', 'SavedApp district is THAKURGAON')
  assert.strictEqual(savedApp.fields['pincode']?.value, '5120', 'SavedApp pincode is 5120')
  assert.strictEqual(savedApp.fields['pres_phone']?.value, '+8801744777846', 'SavedApp pres_phone is +8801744777846')
  // Verify family fields in SavedApplication
  assert.strictEqual(savedApp.fields['fthrname']?.value, 'SHREE KHIDAR MOHAN', 'SavedApp father name is SHREE KHIDAR MOHAN')
  assert.strictEqual(savedApp.fields['mother_name']?.value, 'PANCHAMI RANI', 'SavedApp mother name is PANCHAMI RANI')
  assert.strictEqual(savedApp.fields['spouse_name']?.value, 'JASHODA RANI', 'SavedApp spouse name is JASHODA RANI')
  assert.strictEqual(savedApp.fields['marital_status']?.value, 'Married', 'SavedApp marital status is Married')
  assert.strictEqual(savedApp.fields['father_nationality']?.value, 'BANGLADESH', 'SavedApp father nationality default is BANGLADESH')
  assert.strictEqual(savedApp.fields['mother_nationality']?.value, 'BANGLADESH', 'SavedApp mother nationality default is BANGLADESH')
  assert.strictEqual(savedApp.fields['spouse_nationality']?.value, 'BANGLADESH', 'SavedApp spouse nationality default is BANGLADESH')
  // Task 119 additions
  assert.strictEqual(savedApp.fields['appl.country_of_birth']?.value, 'BANGLADESH', 'SavedApp country of birth default is BANGLADESH')
  assert.strictEqual(savedApp.fields['appl.country_of_birth']?.source, 'derived', 'SavedApp country of birth source is derived')
  assert.strictEqual(savedApp.fields['father_prev_nationality']?.value, 'BANGLADESH', 'SavedApp father prev nationality is BANGLADESH')
  assert.strictEqual(savedApp.fields['father_prev_nationality']?.source, 'derived', 'SavedApp father prev nationality source is derived')
  assert.strictEqual(savedApp.fields['mother_prev_nationality']?.value, 'BANGLADESH', 'SavedApp mother prev nationality is BANGLADESH')
  assert.strictEqual(savedApp.fields['mother_prev_nationality']?.source, 'derived', 'SavedApp mother prev nationality source is derived')
  assert.strictEqual(savedApp.fields['father_place_of_birth']?.value, 'THAKURGAON', 'SavedApp father birthplace copied from applicant birthplace')
  assert.strictEqual(savedApp.fields['father_place_of_birth']?.source, 'derived', 'SavedApp father birthplace source is derived')
  assert.strictEqual(savedApp.fields['mother_place_of_birth']?.value, 'THAKURGAON', 'SavedApp mother birthplace copied from applicant birthplace')
  assert.strictEqual(savedApp.fields['mother_place_of_birth']?.source, 'derived', 'SavedApp mother birthplace source is derived')
  assert.strictEqual(savedApp.fields['spouse_place_of_birth']?.value, 'BANGLADESH', 'SavedApp spouse birthplace default is BANGLADESH')
  assert.strictEqual(savedApp.fields['spouse_place_of_birth']?.source, 'derived', 'SavedApp spouse birthplace source is derived')
  assert.strictEqual(savedApp.fields['spouse_prev_nationality']?.value, 'BANGLADESH', 'SavedApp spouse prev nationality default is BANGLADESH')
  assert.strictEqual(savedApp.fields['spouse_country_of_birth']?.value, 'BANGLADESH', 'SavedApp spouse country of birth default is BANGLADESH')

  // Verify previous passport in SavedApplication
  assert.strictEqual(savedApp.fields['appl.oth_pptno']?.value, 'BK0965579', 'SavedApp other passport number is BK0965579')
  assert.strictEqual(savedApp.fields['appl.oth_ppt']?.value, 'Yes', 'SavedApp other passport flag is Yes')

  console.log('  ✓ SavedApplication fields match all extracted passport particulars.')
  console.log('\n' + formatWorkspaceDiagnosticTable(savedApp) + '\n')

  // Save to persistent storage
  await saveApplication(savedApp)
  console.log('  ✓ SavedApplication persisted via saveApplication().')

  // Reload from storage (simulate close & reopen)
  const reloadedApp = await getSavedApplicationByApplicantId(applicantId)
  assert(reloadedApp, 'Reloaded application must exist in storage')
  assert.strictEqual(reloadedApp.fields['appl.surname']?.value, 'RAY', 'Reloaded surname is RAY')
  assert.strictEqual(reloadedApp.fields['appl.applname']?.value, 'SHREE JOTIMOY', 'Reloaded given name is SHREE JOTIMOY')
  console.log('  ✓ Storage round-trip confirmed: data persists identically.')

  // Manual Edit Precedence Test
  console.log('\n  Performing Manual Edit Precedence Test on 4 core fields:')
  console.log('    1. surname: RAY -> CHOWDHURY')
  console.log('    2. given name: SHREE JOTIMOY -> JOTIMOY ROY')
  console.log('    3. place of birth: THAKURGAON -> DINAJPUR')
  console.log('    4. passport issue place: DIP/DHAKA -> DIP/RAJSHAHI')

  const editedApp: SavedApplication = {
    ...reloadedApp,
    fields: {
      ...reloadedApp.fields,
      'appl.surname': { value: 'CHOWDHURY', source: 'manual', isUserEdited: true },
      'appl.applname': { value: 'JOTIMOY ROY', source: 'manual', isUserEdited: true },
      'appl.placbrth': { value: 'DINAJPUR', source: 'manual', isUserEdited: true },
      'appl.issueplace': { value: 'DIP/RAJSHAHI', source: 'manual', isUserEdited: true },
      'appl.passport_issue_place': { value: 'DIP/RAJSHAHI', source: 'manual', isUserEdited: true },
    },
    manualEdits: {
      ...reloadedApp.manualEdits,
      'appl.surname': true,
      'appl.applname': true,
      'appl.placbrth': true,
      'appl.issueplace': true,
      'appl.passport_issue_place': true,
    },
  }

  await saveApplication(editedApp)

  // Re-run population from the original document (simulating workspace reload or document re-sync)
  const resyncedApp = populateApplicationFromDocuments({
    applicantId,
    passportDoc: newDoc,
    existingApp: editedApp,
  })

  // Confirm manual values were NOT overwritten
  assert.strictEqual(resyncedApp.fields['appl.surname']?.value, 'CHOWDHURY', 'Manual edit on surname preserved')
  assert.strictEqual(resyncedApp.fields['appl.applname']?.value, 'JOTIMOY ROY', 'Manual edit on given name preserved')
  assert.strictEqual(resyncedApp.fields['appl.placbrth']?.value, 'DINAJPUR', 'Manual edit on place of birth preserved')
  const resyncedIssuePlace = resyncedApp.fields['appl.passport_issue_place']?.value || resyncedApp.fields['appl.issueplace']?.value
  assert.strictEqual(resyncedIssuePlace, 'DIP/RAJSHAHI', 'Manual edit on issue place preserved')

  // Confirm unedited fields still come from document
  const resyncedPpt = resyncedApp.fields['appl.passport_number']?.value || resyncedApp.fields['appl.pptno']?.value
  assert.strictEqual(resyncedPpt, 'A21496961', 'Unedited passport number preserved from document')
  console.log('  ✓ Manual edit precedence verified: manual edits remain intact and are NOT overwritten on document reload!')

  // =========================================================================
  // STEP 7: PYTHON SERVICE FAILURE TEST
  // =========================================================================
  console.log('\n--- 7. PYTHON SERVICE FAILURE TEST (OFFLINE SERVICE) ---')
  try {
    await extractPassportWithPython(dataUrl, 'passport.pdf', {
      baseUrl: 'http://127.0.0.1:8999', // Port with no service running
      timeoutMs: 3000,
    })
    assert.fail('Should have thrown PythonExtractorError')
  } catch (err: unknown) {
    assert(err instanceof PythonExtractorError || (err as { name?: string })?.name === 'PythonExtractorError', 'Must be instance of PythonExtractorError')
    assert.strictEqual((err as { code?: string })?.code, 'UNAVAILABLE', 'Error code must be UNAVAILABLE')
    console.log(`  ✓ Offline error caught properly: [${(err as { code?: string })?.code}] ${(err as Error)?.message}`)
  }

  // Verify createBlankApplicationWithDefaults works for manual entry fallback
  const blankFallback = createBlankApplicationWithDefaults({
    applicantId: 'appl_manual_fallback',
  })
  assert(blankFallback && blankFallback.fields, 'createBlankApplicationWithDefaults generates usable application')
  assert.strictEqual(blankFallback.fields['appl.surname']?.value, '', 'Surname is blank for manual entry')
  console.log('  ✓ Service failure test passed: clear error, no crash, application remains usable for manual entry.')

  // =========================================================================
  // STEP 8: PYTHON SUCCESS TEST
  // =========================================================================
  console.log('\n--- 8. PYTHON SUCCESS TEST ---')
  const liveHealth = await fetch(`${LOCAL_EXTRACTOR_URL}/health`)
  assert(liveHealth.ok, 'Live service is responsive on port 8001')
  assert.strictEqual(pipelineResult.sourceTypes.includes('ocr'), true, 'Python OCR was called and succeeded')
  assert.strictEqual(pipelineResult.sourceTypes.includes('ai'), false, 'Gemini was NOT called')
  assert.strictEqual(savedApp.fields['appl.surname']?.value, 'RAY', 'SavedApplication received the Python result')
  console.log('  ✓ Python is called, extraction succeeds, Gemini is NOT called, SavedApplication receives Python result.')

  // =========================================================================
  // STEP 9: DUPLICATE REQUEST TEST
  // =========================================================================
  console.log('\n--- 9. DUPLICATE REQUEST TEST ---')
  console.log(`  Total POST /extract-passport calls during single upload: ${extractCallCount}`)
  assert.strictEqual(extractCallCount, 1, `Expected exactly 1 extraction request, got ${extractCallCount}`)
  console.log('  ✓ Exactly 1 extraction call made per document upload operation. No duplicate requests!')

  // =========================================================================
  // STEP 10: GEMINI SAFETY CHECK
  // =========================================================================
  console.log('\n--- 10. GEMINI SAFETY CHECK ---')
  const pipelineCode = fs.readFileSync('src/core/extraction/pipeline.ts', 'utf8')
  assert(pipelineCode.includes('extractApplicantDataWithGemini'), 'Gemini code intact in pipeline')
  assert(pipelineCode.includes('extractPassportWithPython'), 'Python client used in pipeline')
  assert(fs.existsSync('src/core/extraction/ai/geminiExtractor.ts'), 'Gemini extractor source file intact')
  console.log('  ✓ Gemini extractor intact in codebase, but NOT called in Python extraction flow.')

  // =========================================================================
  // STEP 11: PORTAL AUTOFILL REGRESSION
  // =========================================================================
  console.log('\n--- 11. PORTAL AUTOFILL REGRESSION ---')

  // Verify candidate data resolution with the real extracted SavedApplication
  const candRes = resolveCandidateData({
    profileId: applicantId,
    documents: [newDoc],
    savedApplication: savedApp,
  })
  assert(candRes.status === 'READY', 'Candidate resolution status must be READY')
  assert(candRes.applicant, 'Candidate applicant data must exist')
  assert.strictEqual(candRes.applicant.personalInfo?.surname, 'RAY', 'Candidate surname is RAY')
  assert.strictEqual(candRes.applicant.personalInfo?.givenNames, 'SHREE JOTIMOY', 'Candidate given name is SHREE JOTIMOY')
  assert.strictEqual(candRes.applicant.passport?.passportNumber, 'A21496961', 'Candidate passport is A21496961')
  assert.strictEqual(candRes.applicant.passport?.placeOfIssue, 'DHAKA', 'Candidate issue place is DHAKA')
  console.log('  ✓ Candidate resolution successful from real SavedApplication.')

  // Verify mappings for all 6 Bangladesh portal pages
  const pagesToTest = [
    { page: 'REGISTRATION', title: 'Registration' },
    { page: 'BASIC_DETAILS', title: 'BasicDetails' },
    { page: 'FAMILY_DETAILS', title: 'FamilyDetails' },
    { page: 'TRAVEL_DETAILS', title: 'VisaDetails' },
    { page: 'ADDITIONAL_QUESTIONS', title: 'AdditionalQuestions' },
    { page: 'DOCUMENT_UPLOAD', title: 'PhotoUpload' },
  ] as const

  for (const { page, title } of pagesToTest) {
    const mappings = getIndiaVisaMappings(null, page as any, 'indianvisa-bangladesh.nic.in')
    assert(mappings.length > 0, `Mappings for ${title} (${page}) must not be empty`)
    // Security and scope check: do not automate CAPTCHA, OTP, payment, final submission, declaration, portal photo file chooser
    for (const m of mappings) {
      const selStrings = Array.isArray(m.selector)
        ? m.selector.map((s) => s.value)
        : m.selector
        ? [m.selector.value]
        : []
      const allStr = [m.targetField, m.id, ...selStrings].join(' ').toLowerCase()
      if (allStr.includes('captcha')) {
        assert.strictEqual(m.status, 'manual-required', 'CAPTCHA must strictly be marked manual-required')
        assert.strictEqual(m.sourceType, 'manual', 'CAPTCHA sourceType must strictly be manual')
      }
      if (allStr.includes('declaration')) {
        assert.strictEqual(m.status, 'manual-required', 'Declaration must strictly be marked manual-required')
        assert.strictEqual(m.sourceType, 'manual', 'Declaration sourceType must strictly be manual')
      }
      if (m.inputType === 'file') {
        assert.strictEqual(m.status, 'manual-required', 'File chooser must strictly be marked manual-required')
        assert.strictEqual(m.sourceType, 'manual', 'File chooser sourceType must strictly be manual')
      }
      assert(!allStr.includes('otp'), `Mapping in ${title} must not target OTP: ${allStr}`)
      assert(!allStr.includes('payment'), `Mapping in ${title} must not target payment: ${allStr}`)
    }
    console.log(`  ✓ ${title} (${page}): ${mappings.length} mappings verified (security boundary rules satisfied)`)
  }

  // Run full existing end-to-end multi-page workflow test
  console.log('  Running end-to-end portal workflow simulation...')
  const e2eResult = await runEndToEndWorkflowTests()
  assert(e2eResult.passed, `E2E workflow failed: ${e2eResult.failures.join(', ')}`)
  console.log(`  ✓ All ${e2eResult.totalSubtests} portal workflow subtests passed without regression!`)

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  const totalExtractionTime = report.timings['total_pipeline_time_ms']
  console.log('\n=================================================================')
  console.log('✅ ALL TASK 116 VALIDATION TESTS COMPLETED SUCCESSFULLY!')
  console.log(`Total Pipeline Execution Time: ${(totalExtractionTime / 1000).toFixed(2)}s`)
  console.log(`Python OCR Execution Time: ${(report.timings['python_duration_ms'] / 1000).toFixed(2)}s`)
  console.log('=================================================================\n')

  return {
    success: true,
    totalExtractionTime,
    report,
  }
}

runTask116Validation()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error('\n❌ TASK 116 VALIDATION FAILED:', err)
    process.exit(1)
  })
