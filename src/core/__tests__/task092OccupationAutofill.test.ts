import { describe, it } from 'node:test'
import assert from 'node:assert'
import { JSDOM } from 'jsdom'
import { populateApplicationFromDocuments, convertSavedApplicationToApplicantProfile } from '../application/applicationMerger'
import { executeAutofill } from '../autofill/autofillEngine'
import { getIndiaVisaMappings } from '../../countries/india/mappingService'
import { BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML } from '../../countries/india/__tests__/fixtures'
import type { DocumentRecord } from '../document/types'

describe('TASK 092: Dynamic Occupation Details & Autofill Tests', () => {
  const sampleDocA: DocumentRecord = {
    documentId: 'doc_aziz_001',
    applicantId: 'appl_aziz_001',
    documentType: 'passport',
    fileName: 'aziz_passport.pdf',
    fileSize: 12000,
    mimeType: 'application/pdf',
    status: 'processed',
    source: 'user-upload',
    extractedData: {
      personal: {
        firstName: { value: 'MD ABDUL', source: 'pdf-text', confidence: 95 },
        lastName: { value: 'AZIZ', source: 'pdf-text', confidence: 95 },
        nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 95 },
      },
      passport: {
        passportNumber: { value: 'A00698127', source: 'pdf-text', confidence: 95 },
      },
      permanentAddress: {
        addressLine1: { value: 'CHONDARIA', source: 'pdf-text', confidence: 90 },
        villageTownCity: { value: 'PIRGANJ, KARNAI', source: 'pdf-text', confidence: 90 },
        addressLine2: { value: 'PIRGANJ, KARNAI', source: 'pdf-text', confidence: 90 },
        district: { value: 'THAKURGAON', source: 'pdf-text', confidence: 90 },
        postalCode: { value: '5110', source: 'pdf-text', confidence: 90 },
        country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 90 },
      },
      contact: {
        phone: { value: '+8801767319068', source: 'pdf-text', confidence: 90 },
        mobile: { value: '1767319068', source: 'pdf-text', confidence: 90 },
        isdCode: { value: '880', source: 'pdf-text', confidence: 90 },
      },
    },
    extractedDataConfirmed: true,
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z',
  }

  it('Test 1: Automatically populates occupation defaults from passport document in SavedApplication', () => {
    const savedApp = populateApplicationFromDocuments({
      applicantId: 'appl_aziz_001',
      passportDoc: sampleDocA,
    })

    // Present Occupation defaults to WORKER
    assert.strictEqual(savedApp.fields['occupation']?.value, 'WORKER')

    // Employer name defaults to candidate full name (MD ABDUL AZIZ)
    assert.strictEqual(savedApp.fields['empname']?.value, 'MD ABDUL AZIZ')

    // Designation defaults to WORKER
    assert.strictEqual(savedApp.fields['empdesignation']?.value, 'WORKER')

    // Address defaults to passport address without the district
    assert.strictEqual(savedApp.fields['empaddress']?.value, 'CHONDARIA, PIRGANJ, KARNAI')

    // Phone defaults to candidate phone formatted with +88 prefix
    assert.strictEqual(savedApp.fields['empphone']?.value, '+8801767319068')

    // Past Occupation defaults to PRIVATE SERVICE
    assert.strictEqual(savedApp.fields['previous_occupation']?.value, 'PRIVATE SERVICE')

    // Military flag defaults to No
    assert.strictEqual(savedApp.fields['prev_org']?.value, 'No')
  })

  it('Test 2: Executes portal autofill for all occupation fields on /visa/FamilyDetails DOM fixture', async () => {
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

    const savedApp = populateApplicationFromDocuments({
      applicantId: 'appl_aziz_001',
      passportDoc: sampleDocA,
    })

    const profile = convertSavedApplicationToApplicantProfile(savedApp)
    const mappings = getIndiaVisaMappings('regular', 'FAMILY_DETAILS')

    const autofillResult = await executeAutofill({
      mappings,
      applicant: profile,
      options: { policy: 'overwrite' },
    })

    assert(autofillResult.filledFields > 0, `Autofill filled fields (got ${autofillResult.filledFields})`)

    const doc = dom.window.document
    const occSelect = doc.querySelector<HTMLSelectElement>('#occupation')
    assert.strictEqual(occSelect?.value, 'WORKER', `DOM #occupation is WORKER (got "${occSelect?.value}")`)

    const empNameInput = doc.querySelector<HTMLInputElement>('#empname')
    assert.strictEqual(empNameInput?.value, 'MD ABDUL AZIZ', `DOM #empname is MD ABDUL AZIZ (got "${empNameInput?.value}")`)

    const empDesigInput = doc.querySelector<HTMLInputElement>('#empdesignation')
    assert.strictEqual(empDesigInput?.value, 'WORKER', `DOM #empdesignation is WORKER (got "${empDesigInput?.value}")`)

    const empAddrInput = doc.querySelector<HTMLInputElement>('#empaddress')
    assert.strictEqual(empAddrInput?.value, 'CHONDARIA, PIRGANJ, KARNAI', `DOM #empaddress is CHONDARIA, PIRGANJ, KARNAI (got "${empAddrInput?.value}")`)

    const empPhoneInput = doc.querySelector<HTMLInputElement>('#empphone')
    assert.strictEqual(empPhoneInput?.value, '+8801767319068', `DOM #empphone is +8801767319068 (got "${empPhoneInput?.value}")`)

    const prevOccSelect = doc.querySelector<HTMLSelectElement>('#previous_occupation')
    assert.strictEqual(prevOccSelect?.value, 'PRIVATE SERVICE', `DOM #previous_occupation is PRIVATE SERVICE (got "${prevOccSelect?.value}")`)
  })

  it('Test 3: Dynamically derives occupation fields for different sequential applicants (No static hardcoding)', () => {
    const docB: DocumentRecord = {
      documentId: 'doc_rahim_002',
      applicantId: 'appl_rahim_002',
      documentType: 'passport',
      fileName: 'rahim_passport.pdf',
      fileSize: 10000,
      mimeType: 'application/pdf',
      status: 'processed',
      source: 'user-upload',
      extractedData: {
        personal: {
          firstName: { value: 'RAHIM', source: 'pdf-text', confidence: 95 },
          lastName: { value: 'UDDIN', source: 'pdf-text', confidence: 95 },
          nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 95 },
        },
        passport: {
          passportNumber: { value: 'B99887766', source: 'pdf-text', confidence: 95 },
        },
        permanentAddress: {
          addressLine1: { value: 'HOUSE 10, ROAD 5', source: 'pdf-text', confidence: 90 },
          villageTownCity: { value: 'SECTOR 4, UTTARA', source: 'pdf-text', confidence: 90 },
          district: { value: 'DHAKA', source: 'pdf-text', confidence: 90 },
          postalCode: { value: '1230', source: 'pdf-text', confidence: 90 },
        },
        contact: {
          phone: { value: '01812345678', source: 'pdf-text', confidence: 90 },
        },
      },
      extractedDataConfirmed: true,
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
    }

    const appB = populateApplicationFromDocuments({
      applicantId: 'appl_rahim_002',
      passportDoc: docB,
    })

    assert.strictEqual(appB.fields['occupation']?.value, 'WORKER')
    assert.strictEqual(appB.fields['empname']?.value, 'RAHIM UDDIN')
    assert.strictEqual(appB.fields['empdesignation']?.value, 'WORKER')
    assert.strictEqual(appB.fields['empaddress']?.value, 'HOUSE 10, ROAD 5, SECTOR 4, UTTARA')
    assert.strictEqual(appB.fields['empphone']?.value, '+8801812345678')
    assert.strictEqual(appB.fields['previous_occupation']?.value, 'PRIVATE SERVICE')
  })
})
