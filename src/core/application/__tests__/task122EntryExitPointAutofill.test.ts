import { populateApplicationFromDocuments, convertSavedApplicationToApplicantProfile } from '../applicationMerger'
import { resolveApplicantValue } from '../../autofill/valueResolver'
import { executeAutofill } from '../../autofill/autofillEngine'
import { BANGLADESH_VISA_DETAILS_MAPPINGS } from '../../../countries/india/mappings/bangladesh/visaDetails'
import { findMatchingSelectOption } from '../../autofill/selectResolver'
import type { SavedApplication } from '../types'
import type { DocumentRecord } from '../../document/types'
import type { ExtractedApplicantData } from '../../extraction/data/types'

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

export async function runTask122Tests(): Promise<{ passed: boolean; failures: string[] }> {
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

  console.log('=== RUNNING TASK 122: ENTRY & EXIT PORT WORKSPACE + AUTOFILL TESTS ===\n')

  // -------------------------------------------------------------------------
  // TEST 1: POPULATE FROM DOCUMENTS & BIDIRECTIONAL SYNC
  // -------------------------------------------------------------------------
  console.log('--- PART 1: POPULATE APPLICATION & BIDIRECTIONAL SYNC ---')
  {
    const passportDoc = createDoc('doc_pass_1', {
      personal: { lastName: { value: 'RAHMAN', source: 'ocr', confidence: 95 } },
      travel: {
        entryPoint: { value: 'BY ROAD HARIDASPUR', source: 'ocr', confidence: 95 },
      },
    })

    const app = populateApplicationFromDocuments({ applicantId: 'appl_1', passportDoc })
    testAssert(app.fields['entrypoint']?.value === 'BY ROAD HARIDASPUR', 'Test 1: entrypoint is populated from document')
    testAssert(app.fields['exitpoint']?.value === 'BY ROAD HARIDASPUR', 'Test 2: exitpoint is automatically synced from entrypoint')
  }

  {
    const passportDoc = createDoc('doc_pass_2', {
      personal: { lastName: { value: 'AHMED', source: 'ocr', confidence: 95 } },
      travel: {
        exitPoint: { value: 'CHENNAI', source: 'ocr', confidence: 95 },
      },
    })

    const app = populateApplicationFromDocuments({ applicantId: 'appl_2', passportDoc })
    testAssert(app.fields['exitpoint']?.value === 'CHENNAI', 'Test 3: exitpoint is populated from document')
    testAssert(app.fields['entrypoint']?.value === 'CHENNAI', 'Test 4: entrypoint is automatically synced from exitpoint')
  }

  // -------------------------------------------------------------------------
  // TEST 2: CONVERT SAVED APPLICATION TO APPLICANT PROFILE
  // -------------------------------------------------------------------------
  console.log('--- PART 2: CONVERT SAVED APPLICATION TO APPLICANT PROFILE ---')
  {
    const savedApp: SavedApplication = {
      applicationId: 'app_test_3',
      applicantId: 'appl_3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ready_for_autofill',
      fields: {
        entrypoint: { value: 'BY ROAD HARIDASPUR', source: 'manual', isUserEdited: true },
        // exitpoint omitted - should fall back to entrypoint
      },
      provenance: {
        lastSavedAt: new Date().toISOString(),
      },
      sourceDocuments: {},
      manualEdits: {},
    }

    const profile = convertSavedApplicationToApplicantProfile(savedApp)
    testAssert(profile.travel?.entryPoint === 'BY ROAD HARIDASPUR', 'Test 5: profile.travel.entryPoint is extracted')
    testAssert(profile.travel?.exitPoint === 'BY ROAD HARIDASPUR', 'Test 6: profile.travel.exitPoint falls back to entryPoint')
  }

  // -------------------------------------------------------------------------
  // TEST 3: VALUE RESOLVER PATHS & FALLBACKS
  // -------------------------------------------------------------------------
  console.log('--- PART 3: VALUE RESOLVER PATHS & FALLBACKS ---')
  {
    const mockProfile = {
      applicantId: 'appl_4',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      travel: {
        entryPoint: 'HARIDASPUR',
        exitPoint: 'BY ROAD PHULBARI',
      },
    }

    testAssert(resolveApplicantValue(mockProfile, 'travel.entryPoint') === 'HARIDASPUR', 'Test 7: resolves travel.entryPoint')
    testAssert(resolveApplicantValue(mockProfile, 'appl.entrypoint') === 'HARIDASPUR', 'Test 8: resolves appl.entrypoint')
    testAssert(resolveApplicantValue(mockProfile, 'entrypoint') === 'HARIDASPUR', 'Test 9: resolves entrypoint')
    testAssert(resolveApplicantValue(mockProfile, 'travel.exitPoint') === 'BY ROAD PHULBARI', 'Test 10: resolves travel.exitPoint')
    testAssert(resolveApplicantValue(mockProfile, 'appl.exitpoint') === 'BY ROAD PHULBARI', 'Test 11: resolves appl.exitpoint')
    testAssert(resolveApplicantValue(mockProfile, 'exitpoint') === 'BY ROAD PHULBARI', 'Test 12: resolves exitpoint')
    testAssert(resolveApplicantValue(mockProfile, 'exitpointprc') === 'BY ROAD PHULBARI', 'Test 13: resolves exitpointprc')
  }

  // Value resolver with missing exitPoint falls back to entryPoint
  {
    const mockProfileOnlyEntry = {
      applicantId: 'appl_5',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      travel: {
        entryPoint: 'CHENNAI',
      },
    }
    testAssert(resolveApplicantValue(mockProfileOnlyEntry, 'travel.exitPoint') === 'CHENNAI', 'Test 14: exitPoint falls back to entryPoint in resolver')
  }

  // -------------------------------------------------------------------------
  // TEST 4: SELECT OPTION MATCHING & DISAMBIGUATION
  // -------------------------------------------------------------------------
  console.log('--- PART 4: SELECT OPTION MATCHING & DISAMBIGUATION ---')
  {
    const select = document.createElement('select')
    select.innerHTML = `
      <option value="">Select entry point</option>
      <option value="BY AIR">BY AIR</option>
      <option value="BY AIR/ HARIDASPUR">BY AIR/ HARIDASPUR</option>
      <option value="BY ROAD HARIDASPUR">BY ROAD HARIDASPUR</option>
      <option value="BY ROAD GEDE">BY ROAD GEDE</option>
      <option value="BY ROAD PHULBARI">BY ROAD PHULBARI</option>
    `

    // Target: "HARIDASPUR" should disambiguate to non-compound "BY ROAD HARIDASPUR"
    const matchHaridaspur = findMatchingSelectOption(select, 'HARIDASPUR')
    testAssert(matchHaridaspur.option?.value === 'BY ROAD HARIDASPUR', 'Test 15: HARIDASPUR disambiguates to BY ROAD HARIDASPUR')
    testAssert(!matchHaridaspur.ambiguous, 'Test 16: HARIDASPUR match is not ambiguous')

    // Target: "BY ROAD HARIDASPUR" exact match
    const matchExact = findMatchingSelectOption(select, 'BY ROAD HARIDASPUR')
    testAssert(matchExact.option?.value === 'BY ROAD HARIDASPUR', 'Test 17: BY ROAD HARIDASPUR matches exactly')

    // Target: "BY AIR" exact match
    const matchAir = findMatchingSelectOption(select, 'BY AIR')
    testAssert(matchAir.option?.value === 'BY AIR', 'Test 18: BY AIR matches exactly')

    // Target: "PHULBARI" matches "BY ROAD PHULBARI"
    const matchPhulbari = findMatchingSelectOption(select, 'PHULBARI')
    testAssert(matchPhulbari.option?.value === 'BY ROAD PHULBARI', 'Test 19: PHULBARI matches BY ROAD PHULBARI')
  }

  // -------------------------------------------------------------------------
  // TEST 5: DOM AUTOFILL EXECUTION ON VISA DETAILS FORM
  // -------------------------------------------------------------------------
  console.log('--- PART 5: DOM AUTOFILL EXECUTION ON VISA DETAILS FORM ---')
  {
    document.body.innerHTML = `
      <form id="visa_details_form" action="/visa/VisaDetails" method="post">
        <input type="text" id="duration" name="appl.duration" value="" />
        <select id="visa_entry_id" name="appl.visa_entry_id">
          <option value="SINGLE">SINGLE</option>
          <option value="MULTIPLE">MULTIPLE</option>
        </select>
        <select id="entrypoint" name="appl.entrypoint">
          <option value="">Select entry point</option>
          <option value="BY AIR">BY AIR</option>
          <option value="BY AIR/ HARIDASPUR">BY AIR/ HARIDASPUR</option>
          <option value="BY ROAD HARIDASPUR">BY ROAD HARIDASPUR</option>
          <option value="BY ROAD GEDE">BY ROAD GEDE</option>
        </select>
        <select id="exitpointprc" name="appl.exitpoint">
          <option value="">Select exit point</option>
          <option value="BY AIR">BY AIR</option>
          <option value="BY AIR/ HARIDASPUR">BY AIR/ HARIDASPUR</option>
          <option value="BY ROAD HARIDASPUR">BY ROAD HARIDASPUR</option>
          <option value="BY ROAD GEDE">BY ROAD GEDE</option>
        </select>
        <input type="radio" id="old_visa_flag1" name="appl.old_visa_flag" value="Y" />
        <input type="radio" id="old_visa_flag2" name="appl.old_visa_flag" value="N" />
        <input type="radio" id="refuse_flag1" name="appl.refuse_flag" value="Y" />
        <input type="radio" id="refuse_flag2" name="appl.refuse_flag" value="N" />
        <input type="radio" id="saarc_flag1" name="appl.saarc_flag" value="Y" />
        <input type="radio" id="saarc_flag2" name="appl.saarc_flag" value="N" />
      </form>
    `

    const mockApplicant = {
      applicantId: 'appl_autofill_ports',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      travel: {
        entryPoint: 'BY ROAD HARIDASPUR',
        exitPoint: 'BY ROAD HARIDASPUR',
      },
    }

    const results = await executeAutofill({
      mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
      applicant: mockApplicant,
    })

    const entrySelect = document.getElementById('entrypoint') as HTMLSelectElement
    const exitSelect = document.getElementById('exitpointprc') as HTMLSelectElement

    testAssert(entrySelect.value === 'BY ROAD HARIDASPUR', 'Test 20: DOM #entrypoint filled with BY ROAD HARIDASPUR')
    testAssert(exitSelect.value === 'BY ROAD HARIDASPUR', 'Test 21: DOM #exitpointprc filled with BY ROAD HARIDASPUR')

    const entryResult = results.results.find((r) => r.fieldId === 'bd_visa_entrypoint')
    const exitResult = results.results.find((r) => r.fieldId === 'bd_visa_exitpoint')
    testAssert(entryResult?.status === 'filled', 'Test 22: bd_visa_entrypoint status is filled')
    testAssert(exitResult?.status === 'filled', 'Test 23: bd_visa_exitpoint status is filled')
  }

  // Test with variant exit point ID (#exitpoint instead of #exitpointprc)
  {
    document.body.innerHTML = `
      <form id="visa_details_form" action="/visa/VisaDetails" method="post">
        <select id="entrypoint" name="appl.entrypoint">
          <option value="">Select entry point</option>
          <option value="CHENNAI">CHENNAI</option>
          <option value="DELHI">DELHI</option>
        </select>
        <select id="exitpoint" name="appl.exitpoint">
          <option value="">Select exit point</option>
          <option value="CHENNAI">CHENNAI</option>
          <option value="DELHI">DELHI</option>
        </select>
      </form>
    `

    const mockApplicant = {
      applicantId: 'appl_autofill_ports_alt',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      travel: {
        entryPoint: 'CHENNAI',
        // exitPoint omitted to test automatic fallback during autofill
      },
    }

    const results = await executeAutofill({
      mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
      applicant: mockApplicant,
    })

    const entrySelect = document.getElementById('entrypoint') as HTMLSelectElement
    const exitSelect = document.getElementById('exitpoint') as HTMLSelectElement

    testAssert(entrySelect.value === 'CHENNAI', 'Test 24: DOM #entrypoint filled with CHENNAI')
    testAssert(exitSelect.value === 'CHENNAI', 'Test 25: DOM #exitpoint (variant ID) filled with CHENNAI via fallback')

    const entryResult = results.results.find((r) => r.fieldId === 'bd_visa_entrypoint')
    const exitResult = results.results.find((r) => r.fieldId === 'bd_visa_exitpoint')
    testAssert(entryResult?.status === 'filled', 'Test 26: bd_visa_entrypoint status is filled')
    testAssert(exitResult?.status === 'filled', 'Test 27: bd_visa_exitpoint status is filled')
  }

  // Test with compound workspace value "BY AIR/ HARIDASPUR" on portal with "HARIDASPUR" / "BY AIR"
  {
    document.body.innerHTML = `
      <form id="visa_details_form" action="/visa/VisaDetails" method="post">
        <select id="entrypoint" name="appl.entrypoint">
          <option value="">Select entry point</option>
          <option value="BY AIR">BY AIR</option>
          <option value="HARIDASPUR">HARIDASPUR</option>
          <option value="DELHI">DELHI</option>
        </select>
        <select id="exitpointprc" name="appl.exitpoint">
          <option value="">Select exit point</option>
          <option value="BY AIR">BY AIR</option>
          <option value="HARIDASPUR">HARIDASPUR</option>
          <option value="DELHI">DELHI</option>
        </select>
      </form>
    `

    const mockApplicant = {
      applicantId: 'appl_compound_ports',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      travel: {
        entryPoint: 'BY AIR/ HARIDASPUR',
        exitPoint: 'BY AIR/ HARIDASPUR',
      },
    }

    const results = await executeAutofill({
      mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
      applicant: mockApplicant,
    })

    const entrySelect = document.getElementById('entrypoint') as HTMLSelectElement
    const exitSelect = document.getElementById('exitpointprc') as HTMLSelectElement

    testAssert(entrySelect.value === 'HARIDASPUR', 'Test 28: Compound "BY AIR/ HARIDASPUR" fills HARIDASPUR option')
    testAssert(exitSelect.value === 'HARIDASPUR', 'Test 29: Compound "BY AIR/ HARIDASPUR" fills HARIDASPUR exit option')

    const entryResult = results.results.find((r) => r.fieldId === 'bd_visa_entrypoint')
    const exitResult = results.results.find((r) => r.fieldId === 'bd_visa_exitpoint')
    testAssert(entryResult?.status === 'filled', 'Test 30: bd_visa_entrypoint filled without ambiguity error')
    testAssert(exitResult?.status === 'filled', 'Test 31: bd_visa_exitpoint filled without ambiguity error')
  }

  // Test with input elements instead of selects (if portal renders text inputs)
  {
    document.body.innerHTML = `
      <form id="visa_details_form" action="/visa/VisaDetails" method="post">
        <input type="text" id="entrypoint" name="appl.entrypoint" value="" />
        <input type="text" id="exitpoint" name="appl.exitpoint" value="" />
      </form>
    `

    const mockApplicant = {
      applicantId: 'appl_input_ports',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      travel: {
        entryPoint: 'BY AIR/ HARIDASPUR',
        exitPoint: 'BY AIR/ HARIDASPUR',
      },
    }

    const results = await executeAutofill({
      mappings: BANGLADESH_VISA_DETAILS_MAPPINGS,
      applicant: mockApplicant,
    })

    const entryInput = document.getElementById('entrypoint') as HTMLInputElement
    const exitInput = document.getElementById('exitpoint') as HTMLInputElement

    testAssert(entryInput.value === 'HARIDASPUR', 'Test 32: Text input #entrypoint filled with HARIDASPUR')
    testAssert(exitInput.value === 'HARIDASPUR', 'Test 33: Text input #exitpoint filled with HARIDASPUR')

    const entryResult = results.results.find((r) => r.fieldId === 'bd_visa_entrypoint')
    const exitResult = results.results.find((r) => r.fieldId === 'bd_visa_exitpoint')
    testAssert(entryResult?.status === 'filled', 'Test 34: text input entrypoint status is filled')
    testAssert(exitResult?.status === 'filled', 'Test 35: text input exitpoint status is filled')
  }

  console.log(`\nTask 122 Tests Completed: ${totalSubtests - failures.length}/${totalSubtests} Passed.`)
  if (failures.length > 0) {
    console.error(`Task 122 Test Failures (${failures.length}):\n${failures.join('\n')}`)
    return { passed: false, failures }
  }

  console.log('All Task 122 Tests Passed successfully!\n')
  return { passed: true, failures: [] }
}

runTask122Tests().then((res) => {
  if (!res.passed) process.exit(1)
})
