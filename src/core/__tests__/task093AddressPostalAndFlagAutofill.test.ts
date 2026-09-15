import { describe, it } from 'node:test'
import assert from 'node:assert'
import { JSDOM } from 'jsdom'
import {
  populateApplicationFromDocuments,
  convertSavedApplicationToApplicantProfile,
} from '../application/applicationMerger'
import { executeAutofill } from '../autofill/autofillEngine'
import { getIndiaVisaMappings } from '../../countries/india/mappingService'
import { BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML } from '../../countries/india/__tests__/fixtures'
import type { DocumentRecord } from '../document/types'

describe('TASK 093: Permanent Address Postal Code Formatting & Grandparent / Military Autofill Tests', () => {
  const azizPassportDoc: DocumentRecord = {
    documentId: 'doc_aziz_001',
    applicantId: 'aziz_2323',
    documentType: 'passport',
    fileName: 'aziz_passport.pdf',
    fileSize: 12000,
    mimeType: 'application/pdf',
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z',
    extractedData: {
      personal: {
        firstName: { value: 'MD ABDUL', source: 'pdf-text', confidence: 95 },
        lastName: { value: 'AZIZ', source: 'pdf-text', confidence: 95 },
        nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 95 },
        dateOfBirth: { value: '1985-05-12', source: 'pdf-text', confidence: 95 },
        townCityOfBirth: { value: 'THAKURGAON', source: 'pdf-text', confidence: 95 },
        gender: { value: 'male', source: 'pdf-text', confidence: 95 },
      },
      passport: {
        passportNumber: { value: 'A03291823', source: 'pdf-text', confidence: 95 },
      },
      presentAddress: {
        addressLine1: { value: 'CHONDARIA', source: 'pdf-text', confidence: 90 },
        addressLine2: { value: 'PIRGANJ, KARNAI', source: 'pdf-text', confidence: 90 },
        villageTownCity: { value: 'PIRGANJ, KARNAI', source: 'pdf-text', confidence: 90 },
        district: { value: 'THAKURGAON', source: 'pdf-text', confidence: 90 },
        stateProvince: { value: 'THAKURGAON', source: 'pdf-text', confidence: 90 },
        country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 90 },
        postalCode: { value: '5110', source: 'pdf-text', confidence: 90 },
      },
      permanentAddress: {
        addressLine1: { value: 'CHONDARIA', source: 'pdf-text', confidence: 90 },
        addressLine2: { value: 'PIRGANJ, KARNAI', source: 'pdf-text', confidence: 90 },
        villageTownCity: { value: 'PIRGANJ, KARNAI', source: 'pdf-text', confidence: 90 },
        district: { value: 'THAKURGAON', source: 'pdf-text', confidence: 90 },
        stateProvince: { value: 'THAKURGAON', source: 'pdf-text', confidence: 90 },
        country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 90 },
        postalCode: { value: '5110', source: 'pdf-text', confidence: 90 },
      },
      contact: {
        phone: { value: '+8801767319068', source: 'pdf-text', confidence: 90 },
        mobile: { value: '1767319068', source: 'pdf-text', confidence: 90 },
        isdCode: { value: '880', source: 'pdf-text', confidence: 90 },
      },
      family: {
        father: {
          name: { value: 'MD ABDUR ROUF', source: 'pdf-text', confidence: 90 },
        },
        mother: {
          name: { value: 'BOYJUN NAHAR', source: 'pdf-text', confidence: 90 },
        },
        spouse: {
          name: { value: 'MST KHAIRUN NEHER', source: 'pdf-text', confidence: 90 },
        },
      },
    },
  }

  it('Test 1: populateApplicationFromDocuments sets perm_add2 to present villageTownCity and defaults flags to No', () => {
    const app = populateApplicationFromDocuments({
      applicantId: 'aziz_2323',
      passportDoc: azizPassportDoc,
    })

    // 1. Permanent Address Village/Town/City matches Present Address
    assert.strictEqual(
      app.fields['perm_add2']?.value,
      'PIRGANJ, KARNAI',
      'Permanent address perm_add2 must match present villageTownCity'
    )
    assert.strictEqual(
      app.fields['permanent_village_town_city']?.value,
      'PIRGANJ, KARNAI',
      'Permanent address permanent_village_town_city must match present villageTownCity'
    )

    // 2. Grandparent and Military flags default to No
    assert.strictEqual(
      app.fields['grandparent_flag']?.value,
      'No',
      'Grandparent flag must default to No in workspace'
    )
    assert.strictEqual(
      app.fields['prev_org']?.value,
      'No',
      'Military/Security prev_org flag must default to No in workspace'
    )
  })

  it('Test 2: Executes portal autofill on /visa/FamilyDetails DOM fixture with default No flags and villageTownCity', async () => {
    const app = populateApplicationFromDocuments({
      applicantId: 'aziz_2323',
      passportDoc: azizPassportDoc,
    })
    const profile = convertSavedApplicationToApplicantProfile(app)

    const dom = new JSDOM(BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML, {
      url: 'https://indianvisa-bangladesh.nic.in/visa/FamilyDetails',
      runScripts: 'dangerously',
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

    const mappings = getIndiaVisaMappings('regular', 'FAMILY_DETAILS')

    const autofillResult = await executeAutofill({
      mappings,
      applicant: profile,
      options: { policy: 'overwrite' },
    })

    assert(autofillResult.filledFields > 0, `Autofill filled fields (got ${autofillResult.filledFields})`)

    const doc = dom.window.document

    // Permanent address Village/Town/City
    const permAdd2Input = doc.querySelector<HTMLInputElement>('#perm_address2')
    assert.strictEqual(
      permAdd2Input?.value,
      'PIRGANJ, KARNAI',
      `Portal permanent address #perm_address2 should be PIRGANJ, KARNAI (got "${permAdd2Input?.value}")`
    )

    // Mobile ISD Code Select dropdown
    const isdSelect = doc.querySelector<HTMLSelectElement>('#mobile_isd')
    assert.strictEqual(
      isdSelect?.value,
      '880',
      `Portal ISD code #mobile_isd should select 880 (got "${isdSelect?.value}")`
    )

    // Grandparent Pakistan Flag: No radio (#grandparent_flag2) checked
    const gpYes = doc.querySelector<HTMLInputElement>('#grandparent_flag1')
    const gpNo = doc.querySelector<HTMLInputElement>('#grandparent_flag2')
    assert.strictEqual(gpYes?.checked, false, 'Grandparent Yes radio must NOT be checked')
    assert.strictEqual(gpNo?.checked, true, 'Grandparent No radio (#grandparent_flag2) MUST be checked')

    // Military/Security Org Flag: No radio (#prev_org2) checked
    const milYes = doc.querySelector<HTMLInputElement>('#prev_org1')
    const milNo = doc.querySelector<HTMLInputElement>('#prev_org2')
    assert.strictEqual(milYes?.checked, false, 'Military Yes radio must NOT be checked')
    assert.strictEqual(milNo?.checked, true, 'Military No radio (#prev_org2) MUST be checked')
  })

  it('Test 3: Autofill selects Yes and fills subfields when workspace has Yes for grandparent and military', async () => {
    const app = populateApplicationFromDocuments({
      applicantId: 'aziz_2323',
      passportDoc: azizPassportDoc,
    })
    
    // User sets Yes in workspace
    app.fields['grandparent_flag'] = { value: 'Yes', source: 'manual', isUserEdited: true }
    app.fields['grandparent_details'] = { value: 'BORN IN LAHORE 1940', source: 'manual', isUserEdited: true }
    app.fields['prev_org'] = { value: 'Yes', source: 'manual', isUserEdited: true }
    app.fields['previous_organization'] = { value: 'BANGLADESH ARMY', source: 'manual', isUserEdited: true }
    app.fields['previous_designation'] = { value: 'CAPTAIN', source: 'manual', isUserEdited: true }
    app.fields['previous_rank'] = { value: 'OFFICER', source: 'manual', isUserEdited: true }
    app.fields['previous_posting'] = { value: 'DHAKA CANTONMENT', source: 'manual', isUserEdited: true }

    const profile = convertSavedApplicationToApplicantProfile(app)

    const dom = new JSDOM(BANGLADESH_FAMILY_DETAILS_FIXTURE_HTML, {
      url: 'https://indianvisa-bangladesh.nic.in/visa/FamilyDetails',
      runScripts: 'dangerously',
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

    const mappings = getIndiaVisaMappings('regular', 'FAMILY_DETAILS')

    const autofillResult = await executeAutofill({
      mappings,
      applicant: profile,
      options: { policy: 'overwrite' },
    })

    assert(autofillResult.filledFields > 0, `Autofill filled fields (got ${autofillResult.filledFields})`)

    const doc = dom.window.document

    // Grandparent Flag: Yes radio (#grandparent_flag1) checked and details filled
    const gpYes = doc.querySelector<HTMLInputElement>('#grandparent_flag1')
    const gpNo = doc.querySelector<HTMLInputElement>('#grandparent_flag2')
    const gpDetails = doc.querySelector<HTMLTextAreaElement>('#grandparent_details')
    assert.strictEqual(gpYes?.checked, true, 'Grandparent Yes radio (#grandparent_flag1) MUST be checked')
    assert.strictEqual(gpNo?.checked, false, 'Grandparent No radio must NOT be checked')
    assert.strictEqual(gpDetails?.value, 'BORN IN LAHORE 1940', 'Grandparent details must be filled')

    // Military Flag: Yes radio (#prev_org1) checked and sub-fields filled
    const milYes = doc.querySelector<HTMLInputElement>('#prev_org1')
    const milNo = doc.querySelector<HTMLInputElement>('#prev_org2')
    const org = doc.querySelector<HTMLInputElement>('#previous_organization')
    const desig = doc.querySelector<HTMLInputElement>('#previous_designation')
    const rank = doc.querySelector<HTMLInputElement>('#previous_rank')
    const post = doc.querySelector<HTMLInputElement>('#previous_posting')

    assert.strictEqual(milYes?.checked, true, 'Military Yes radio (#prev_org1) MUST be checked')
    assert.strictEqual(milNo?.checked, false, 'Military No radio must NOT be checked')
    assert.strictEqual(org?.value, 'BANGLADESH ARMY', 'Organization must be filled')
    assert.strictEqual(desig?.value, 'CAPTAIN', 'Designation must be filled')
    assert.strictEqual(rank?.value, 'OFFICER', 'Rank must be filled')
    assert.strictEqual(post?.value, 'DHAKA CANTONMENT', 'Posting must be filled')
  })

  it('Test 4: Dynamic applicant isolation and postal code formatting for different applicants', () => {
    const rahimDoc: DocumentRecord = {
      documentId: 'doc_rahim_002',
      applicantId: 'rahim_4455',
      documentType: 'passport',
      fileName: 'rahim_passport.pdf',
      fileSize: 12000,
      mimeType: 'application/pdf',
      status: 'processed',
      source: 'user-upload',
      extractedDataConfirmed: true,
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      extractedData: {
        personal: {
          firstName: { value: 'RAHIM', source: 'pdf-text', confidence: 95 },
          lastName: { value: 'UDDIN', source: 'pdf-text', confidence: 95 },
        },
        presentAddress: {
          addressLine1: { value: 'HOUSE 10, ROAD 5', source: 'pdf-text', confidence: 90 },
          villageTownCity: { value: 'SECTOR 4, UTTARA', source: 'pdf-text', confidence: 90 },
          district: { value: 'DHAKA', source: 'pdf-text', confidence: 90 },
          postalCode: { value: '1230', source: 'pdf-text', confidence: 90 },
        },
        permanentAddress: {
          addressLine1: { value: 'HOUSE 10, ROAD 5', source: 'pdf-text', confidence: 90 },
          villageTownCity: { value: 'SECTOR 4, UTTARA', source: 'pdf-text', confidence: 90 },
          district: { value: 'DHAKA', source: 'pdf-text', confidence: 90 },
          postalCode: { value: '1230', source: 'pdf-text', confidence: 90 },
        },
      },
    }

    const appRahim = populateApplicationFromDocuments({
      applicantId: 'rahim_4455',
      passportDoc: rahimDoc,
    })
    assert.strictEqual(
      appRahim.fields['perm_add2']?.value,
      'SECTOR 4, UTTARA',
      'Rahim permanent address should be SECTOR 4, UTTARA'
    )
  })
})
