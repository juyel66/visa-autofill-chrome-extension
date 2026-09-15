import { JSDOM } from 'jsdom'
import { parseStructuredAddress } from '../extraction/data/applicantDataExtractor'
import { convertSavedApplicationToApplicantProfile, populateApplicationFromDocuments } from '../application/applicationMerger'
import { executeAutofill } from '../autofill/autofillEngine'
import { getIndiaVisaMappings } from '../../countries/india/mappingService'
import { BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML } from '../../countries/india/__tests__/fixtures'
import type { SavedApplication } from '../application/types'
import type { DocumentRecord } from '../document/types'

export interface TestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runTask091AddressAutofillTests(): Promise<TestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  function assert(condition: boolean, msg: string) {
    totalSubtests++
    if (!condition) {
      failures.push(msg)
      console.error(`  ✗ FAIL: ${msg}`)
    } else {
      console.log(`  ✓ PASS: ${msg}`)
    }
  }

  console.log('--- TEST 1: 3-Part Address Splitting (House No/Street, Village/Town/City, District) ---')
  {
    const raw = 'CHONDARIA, PIRGANJ, THAKURGAON'
    const res = parseStructuredAddress(raw)

    assert(res.addressLine1 === 'CHONDARIA', `3-part addressLine1 is CHONDARIA (got "${res.addressLine1}")`)
    assert(res.villageTownCity === 'PIRGANJ', `3-part villageTownCity is PIRGANJ (got "${res.villageTownCity}")`)
    assert(res.district === 'THAKURGAON', `3-part district is THAKURGAON (got "${res.district}")`)
    assert(res.stateProvince === 'THAKURGAON', `3-part stateProvince is THAKURGAON (got "${res.stateProvince}")`)
  }

  console.log('--- TEST 2: 4-Part Address Splitting with Postal Code (1st -> Street, 2 middle -> Village/City, Last -> District, Zip -> Zip) ---')
  {
    const raw = 'CHONDARIA, PIRGANJ, SONDHANI PARA - 5110, THAKURGAON'
    const res = parseStructuredAddress(raw)

    assert(res.addressLine1 === 'CHONDARIA', `4-part addressLine1 is CHONDARIA (got "${res.addressLine1}")`)
    assert(res.villageTownCity === 'PIRGANJ, SONDHANI PARA', `4-part villageTownCity contains 2 middle parts "PIRGANJ, SONDHANI PARA" (got "${res.villageTownCity}")`)
    assert(res.addressLine2 === 'PIRGANJ, SONDHANI PARA', `4-part addressLine2 matches middle parts (got "${res.addressLine2}")`)
    assert(res.district === 'THAKURGAON', `4-part district is THAKURGAON (got "${res.district}")`)
    assert(res.postalCode === '5110', `4-part postalCode is 5110 (got "${res.postalCode}")`)
  }

  console.log('--- TEST 3: Document Upload -> SavedApplication Workspace Field Population ---')
  {
    const doc: DocumentRecord = {
      documentId: 'doc_addr_001',
      applicantId: 'appl_addr_001',
      documentType: 'passport',
      fileName: 'aziz_passport.pdf',
      fileSize: 1000,
      mimeType: 'application/pdf',
      status: 'processed',
      source: 'user-upload',
      extractedData: {
        personal: {
          lastName: { value: 'ISLAM', source: 'mrz', confidence: 95 },
          firstName: { value: 'MD AZIZUL', source: 'mrz', confidence: 95 },
        },
        passport: {
          passportNumber: { value: 'A01234567', source: 'mrz', confidence: 95 },
        },
        permanentAddress: {
          addressLine1: { value: 'CHONDARIA', source: 'ocr', confidence: 90 },
          villageTownCity: { value: 'PIRGANJ, SONDHANI PARA', source: 'ocr', confidence: 90 },
          addressLine2: { value: 'PIRGANJ, SONDHANI PARA', source: 'ocr', confidence: 90 },
          district: { value: 'THAKURGAON', source: 'ocr', confidence: 90 },
          stateProvince: { value: 'THAKURGAON', source: 'ocr', confidence: 90 },
          postalCode: { value: '5110', source: 'ocr', confidence: 90 },
          country: { value: 'BANGLADESH', source: 'ocr', confidence: 90 },
        },
      },
      extractedDataConfirmed: true,
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
    }

    const savedApp = populateApplicationFromDocuments({
      applicantId: 'appl_addr_001',
      passportDoc: doc,
    })

    assert(savedApp.fields['pres_addr1']?.value === 'CHONDARIA', 'pres_addr1 populated with CHONDARIA')
    assert(savedApp.fields['village_town_city']?.value === 'PIRGANJ, SONDHANI PARA', 'village_town_city populated with PIRGANJ, SONDHANI PARA')
    assert(savedApp.fields['district']?.value === 'THAKURGAON', 'district populated with THAKURGAON')
    assert(savedApp.fields['pincode']?.value === '5110', 'pincode populated with 5110')
    assert(savedApp.fields['perm_add1']?.value === 'CHONDARIA', 'perm_add1 populated with CHONDARIA')
    assert(savedApp.fields['permanent_village_town_city']?.value === 'PIRGANJ, SONDHANI PARA', 'permanent_village_town_city populated with PIRGANJ, SONDHANI PARA')
    assert(savedApp.fields['permanent_district']?.value === 'THAKURGAON', 'permanent_district populated with THAKURGAON')
    assert(savedApp.fields['permanent_postal_code']?.value === '5110', 'permanent_postal_code populated with 5110')
  }

  console.log('--- TEST 4: Full Family Details Portal Page Autofill Execution ---')
  {
    const dom = new JSDOM(BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML, {
      url: 'https://indianvisa-bangladesh.nic.in/visa/FamilyDetails',
      runScripts: 'outside-only',
    })
    Object.defineProperty(global, 'window', { value: dom.window, configurable: true, writable: true })
    Object.defineProperty(global, 'document', { value: dom.window.document, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLElement', { value: dom.window.HTMLElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLInputElement', { value: dom.window.HTMLInputElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLSelectElement', { value: dom.window.HTMLSelectElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLOptionElement', { value: dom.window.HTMLOptionElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLTextAreaElement', { value: dom.window.HTMLTextAreaElement, configurable: true, writable: true })
    Object.defineProperty(global, 'HTMLButtonElement', { value: dom.window.HTMLButtonElement, configurable: true, writable: true })
    Object.defineProperty(global, 'Event', { value: dom.window.Event, configurable: true, writable: true })
    Object.defineProperty(global, 'MouseEvent', { value: dom.window.MouseEvent, configurable: true, writable: true })

    const savedApp: SavedApplication = {
      applicationId: 'app_test_address',
      applicantId: 'appl_addr_002',
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      status: 'ready_for_autofill',
      fields: {
        pres_addr1: { value: 'CHONDARIA', source: 'passport', isUserEdited: false },
        pres_addr2: { value: 'PIRGANJ, SONDHANI PARA', source: 'passport', isUserEdited: false },
        village_town_city: { value: 'PIRGANJ, SONDHANI PARA', source: 'passport', isUserEdited: false },
        district: { value: 'THAKURGAON', source: 'passport', isUserEdited: false },
        state_province: { value: 'THAKURGAON', source: 'passport', isUserEdited: false },
        present_country: { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        pincode: { value: '5110', source: 'passport', isUserEdited: false },
        pres_phone: { value: '+8801767319068', source: 'passport', isUserEdited: false },
        mobile: { value: '1767319068', source: 'passport', isUserEdited: false },
        isd_code: { value: '880', source: 'passport', isUserEdited: false },
        'appl.email': { value: 'aziz@gmail.com', source: 'manual', isUserEdited: true },

        perm_add1: { value: 'CHONDARIA', source: 'passport', isUserEdited: false },
        perm_add2: { value: 'PIRGANJ, SONDHANI PARA', source: 'passport', isUserEdited: false },
        permanent_village_town_city: { value: 'PIRGANJ, SONDHANI PARA', source: 'passport', isUserEdited: false },
        permanent_district: { value: 'THAKURGAON', source: 'passport', isUserEdited: false },
        permanent_state_province: { value: 'THAKURGAON', source: 'passport', isUserEdited: false },
        permanent_country: { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        permanent_postal_code: { value: '5110', source: 'passport', isUserEdited: false },

        fthrname: { value: 'ABDUL KARIM', source: 'passport', isUserEdited: false },
        father_place_of_birth: { value: 'THAKURGAON', source: 'derived', isUserEdited: false },
        father_country_of_birth: { value: 'BANGLADESH', source: 'derived', isUserEdited: false },
        father_nationality: { value: 'BANGLADESH', source: 'derived', isUserEdited: false },
        father_prev_nationality: { value: 'BANGLADESH', source: 'derived', isUserEdited: false },
        mother_name: { value: 'FATEMA BEGUM', source: 'passport', isUserEdited: false },
        mother_place_of_birth: { value: 'THAKURGAON', source: 'derived', isUserEdited: false },
        mother_country_of_birth: { value: 'BANGLADESH', source: 'derived', isUserEdited: false },
        mother_nationality: { value: 'BANGLADESH', source: 'derived', isUserEdited: false },
        mother_prev_nationality: { value: 'BANGLADESH', source: 'derived', isUserEdited: false },
        marital_status: { value: 'Single', source: 'manual', isUserEdited: true },
        grandparent_flag: { value: 'No', source: 'manual', isUserEdited: false },
        occupation: { value: 'PRIVATE SERVICE', source: 'manual', isUserEdited: true },
        empname: { value: 'TECH LTD', source: 'manual', isUserEdited: true },
        empdesignation: { value: 'EXECUTIVE', source: 'manual', isUserEdited: true },
        empaddress: { value: 'DHAKA', source: 'manual', isUserEdited: true },
        empphone: { value: '01711111111', source: 'manual', isUserEdited: true },
        prev_org: { value: 'No', source: 'manual', isUserEdited: false },
      },
      sourceDocuments: {},
      provenance: { lastSavedAt: '2026-09-15T00:00:00.000Z' },
      manualEdits: {},
    }

    const profile = convertSavedApplicationToApplicantProfile(savedApp)
    const mappings = getIndiaVisaMappings('regular', 'FAMILY_DETAILS')

    const autofillResult = await executeAutofill({
      mappings,
      applicant: profile,
      options: { policy: 'overwrite' },
    })

    assert(autofillResult.filledFields > 0, `Autofill execution filled fields (filledFields: ${autofillResult.filledFields})`)

    const doc = dom.window.document
    const presAdd1 = doc.querySelector<HTMLInputElement>('#pres_add1')
    assert(presAdd1?.value === 'CHONDARIA', `DOM #pres_add1 is filled with CHONDARIA, actual: "${presAdd1?.value}"`)

    const presAdd2 = doc.querySelector<HTMLInputElement>('#pres_add2')
    assert(presAdd2?.value === 'PIRGANJ, SONDHANI PARA', `DOM #pres_add2 is filled with PIRGANJ, SONDHANI PARA, actual: "${presAdd2?.value}"`)

    const presAdd3 = doc.querySelector<HTMLInputElement>('#pres_add3')
    assert(presAdd3?.value === 'THAKURGAON', `DOM #pres_add3 is filled with THAKURGAON, actual: "${presAdd3?.value}"`)

    const pincode = doc.querySelector<HTMLInputElement>('#pincode')
    assert(pincode?.value === '5110', `DOM #pincode is filled with 5110, actual: "${pincode?.value}"`)

    const permAdd1 = doc.querySelector<HTMLInputElement>('#perm_address1')
    assert(permAdd1?.value === 'CHONDARIA', `DOM #perm_address1 is filled with CHONDARIA, actual: "${permAdd1?.value}"`)

    const permAdd2 = doc.querySelector<HTMLInputElement>('#perm_address2')
    assert(permAdd2?.value === 'PIRGANJ, SONDHANI PARA', `DOM #perm_address2 is filled with PIRGANJ, SONDHANI PARA, actual: "${permAdd2?.value}"`)

    const permAdd3 = doc.querySelector<HTMLInputElement>('#perm_address3')
    assert(permAdd3?.value === 'THAKURGAON', `DOM #perm_address3 is filled with THAKURGAON, actual: "${permAdd3?.value}"`)
  }

  console.log('--- TEST 5: Deduplication of Repeated Segments & Default ISD Code / Country ---')
  {
    // If Gemini or OCR produced duplicated segment string
    const rawDup = 'CHONDARIA, PIRGANJ, KARNAI, PIRGANJ, KARNAI, 5110, THAKURGAON, THAKURGAON'
    const res = parseStructuredAddress(rawDup)

    assert(res.addressLine1 === 'CHONDARIA', `Deduplicated addressLine1 is CHONDARIA (got "${res.addressLine1}")`)
    assert(res.villageTownCity === 'PIRGANJ, KARNAI', `Deduplicated villageTownCity is "PIRGANJ, KARNAI" (got "${res.villageTownCity}")`)
    assert(res.district === 'THAKURGAON', `Deduplicated district is THAKURGAON (got "${res.district}")`)
    assert(res.postalCode === '5110', `Deduplicated postalCode is 5110 (got "${res.postalCode}")`)
    assert(res.country === 'BANGLADESH', `Deduplicated country is BANGLADESH (got "${res.country}")`)
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
