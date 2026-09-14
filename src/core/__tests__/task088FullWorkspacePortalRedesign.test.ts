import { JSDOM } from 'jsdom'
import { WORKSPACE_SECTIONS } from '../application/fieldSchema'
import {
  PORTAL_COUNTRY_OPTIONS,
  PORTAL_NATIONALITY_OPTIONS,
  PORTAL_GENDER_OPTIONS,
  PORTAL_RELIGION_OPTIONS,
  PORTAL_EDUCATION_OPTIONS,
  PORTAL_MARITAL_STATUS_OPTIONS,
  PORTAL_OCCUPATION_OPTIONS,
} from '../../countries/india/options/registrationOptions'
import type { SavedApplication } from '../application/types'
import { populateApplicationFromDocuments } from '../application/applicationMerger'
import { resolveCandidateData } from '../autofill/candidateResolver'
import { executeAutofill } from '../autofill/autofillEngine'
import { getIndiaVisaMappings } from '../../countries/india/mappingService'
import type { DocumentRecord } from '../document/types'

export interface TestSuiteResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runTask088FullWorkspacePortalRedesignTests(): Promise<TestSuiteResult> {
  const failures: string[] = []
  let totalSubtests = 0

  function assert(condition: boolean, message: string) {
    totalSubtests++
    if (!condition) {
      failures.push(message)
    }
  }

  console.log('=== RUNNING TASK 088: ALL 4 PORTAL PAGES WORKSPACE REDESIGN TESTS ===')

  // =========================================================================
  // TEST 1: ALL 4 PORTAL FORMS COVER ALL 11 WORKSPACE SECTIONS
  // =========================================================================
  {
    assert(WORKSPACE_SECTIONS.length === 11, `Workspace must have 11 sections (got ${WORKSPACE_SECTIONS.length})`)

    const sectionIds = WORKSPACE_SECTIONS.map((s) => s.id)
    const expectedSectionIds = [
      'registration',
      'personalDetails',
      'passportDetails',
      'presentAddress',
      'permanentAddress',
      'familyDetails',
      'professionEmployment',
      'visaDetails',
      'previousVisitVisa',
      'additionalQuestions',
      'photoUpload',
    ]

    assert(
      JSON.stringify(sectionIds) === JSON.stringify(expectedSectionIds),
      `All 11 workspace sections must follow exact portal sequence: ${expectedSectionIds.join(', ')}`
    )

    const allSectionFieldKeys = WORKSPACE_SECTIONS.flatMap((s) => s.fieldKeys)
    assert(
      allSectionFieldKeys.length === 121,
      `All 11 sections must map to 121 canonical field keys (got ${allSectionFieldKeys.length})`
    )
  }

  // =========================================================================
  // TEST 2: VERIFIED PORTAL OPTIONS DATASETS INTEGRITY
  // =========================================================================
  {
    assert(PORTAL_COUNTRY_OPTIONS.length >= 190, `Countries count >= 190 (got ${PORTAL_COUNTRY_OPTIONS.length})`)
    assert(PORTAL_COUNTRY_OPTIONS.some((c) => c.value === 'INDIA'), 'Country options must include INDIA')
    assert(PORTAL_COUNTRY_OPTIONS.some((c) => c.value === 'BANGLADESH'), 'Country options must include BANGLADESH')

    assert(PORTAL_NATIONALITY_OPTIONS.length >= 190, `Nationalities count >= 190 (got ${PORTAL_NATIONALITY_OPTIONS.length})`)
    assert(PORTAL_NATIONALITY_OPTIONS.some((n) => n.value === 'BANGLADESH'), 'Nationality options must include BANGLADESH')
    assert(PORTAL_NATIONALITY_OPTIONS.some((n) => n.value === 'INDIA'), 'Nationality options must include INDIA')

    assert(PORTAL_GENDER_OPTIONS.some((g) => g.value === 'MALE'), 'Gender options include MALE')
    assert(PORTAL_GENDER_OPTIONS.some((g) => g.value === 'FEMALE'), 'Gender options include FEMALE')

    assert(PORTAL_RELIGION_OPTIONS.some((r) => r.value === 'ISLAM'), 'Religion options include ISLAM')
    assert(PORTAL_RELIGION_OPTIONS.some((r) => r.value === 'HINDUISM'), 'Religion options include HINDUISM')

    assert(PORTAL_EDUCATION_OPTIONS.some((e) => e.value === 'GRADUATE'), 'Education options include GRADUATE')
    assert(PORTAL_EDUCATION_OPTIONS.some((e) => e.value === 'MATRICULATION'), 'Education options include MATRICULATION')

    assert(PORTAL_MARITAL_STATUS_OPTIONS.some((m) => m.value === 'Married'), 'Marital status options include Married')
    assert(PORTAL_MARITAL_STATUS_OPTIONS.some((m) => m.value === 'Single'), 'Marital status options include Single')

    assert(PORTAL_OCCUPATION_OPTIONS.some((o) => o.value === 'BUSINESS PERSON'), 'Occupation options include BUSINESS PERSON')
    assert(PORTAL_OCCUPATION_OPTIONS.some((o) => o.value === 'PRIVATE SERVICE'), 'Occupation options include PRIVATE SERVICE')
  }

  // =========================================================================
  // TEST 3: EXTRACTED PASSPORT DATA POPULATION ACROSS ALL 4 PORTAL PAGES
  // =========================================================================
  {
    const passportDoc: DocumentRecord = {
      documentId: 'doc_portal_088_test',
      applicantId: 'APPLICANT_PORTAL_088',
      documentType: 'passport',
      fileName: 'applicant_passport.pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'processed',
      source: 'user-upload',
      extractedDataConfirmed: true,
      extractedData: {
        personal: {
          lastName: { value: 'HOSSAIN', source: 'pdf-text', confidence: 0.99 },
          firstName: { value: 'MOHAMMAD SHARIF', source: 'pdf-text', confidence: 0.99 },
          gender: { value: 'male', source: 'pdf-text', confidence: 0.99 },
          dateOfBirth: { value: '1988-08-12', source: 'pdf-text', confidence: 0.99 },
          townCityOfBirth: { value: 'RAJSHAHI', source: 'pdf-text', confidence: 0.95 },
          countryOfBirth: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.99 },
          nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.99 },
          nationalIdNumber: { value: '19881234567890', source: 'pdf-text', confidence: 0.95 },
          religion: { value: 'ISLAM', source: 'pdf-text', confidence: 0.95 },
          educationalQualification: { value: 'GRADUATE', source: 'pdf-text', confidence: 0.95 },
          maritalStatus: { value: 'Married', source: 'pdf-text', confidence: 0.95 },
        },
        passport: {
          passportNumber: { value: 'B00123456', source: 'pdf-text', confidence: 0.99 },
          placeOfIssue: { value: 'RAJSHAHI', source: 'pdf-text', confidence: 0.95 },
          issueDate: { value: '2021-06-15', source: 'pdf-text', confidence: 0.99 },
          expiryDate: { value: '2031-06-14', source: 'pdf-text', confidence: 0.99 },
          issuingCountry: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.99 },
        },
        presentAddress: {
          addressLine1: { value: 'HOUSE 45, ROAD 2, KAZIHATA', source: 'pdf-text', confidence: 0.95 },
          villageTownCity: { value: 'RAJSHAHI', source: 'pdf-text', confidence: 0.95 },
          stateProvince: { value: 'RAJSHAHI', source: 'pdf-text', confidence: 0.95 },
          postalCode: { value: '6000', source: 'pdf-text', confidence: 0.95 },
          country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.99 },
          phone: { value: '+880721770000', source: 'pdf-text', confidence: 0.9 },
        },
        contact: {
          email: { value: 'sharif.hossain@example.com', source: 'pdf-text', confidence: 0.95 },
          mobile: { value: '01712345678', source: 'pdf-text', confidence: 0.95 },
        },
        family: {
          father: {
            name: { value: 'ANWAR HOSSAIN', source: 'pdf-text', confidence: 0.95 },
            nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.95 },
            countryOfBirth: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.95 },
          },
          mother: {
            name: { value: 'ROKEYA BEGUM', source: 'pdf-text', confidence: 0.95 },
            nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.95 },
            countryOfBirth: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.95 },
          },
          spouse: {
            name: { value: 'NASRIN AKTER', source: 'pdf-text', confidence: 0.95 },
            nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.95 },
          },
        },
        employment: {
          presentOccupation: { value: 'BUSINESS PERSON', source: 'pdf-text', confidence: 0.95 },
          employerName: { value: 'SHARIF ENTERPRISE', source: 'pdf-text', confidence: 0.95 },
          designationRank: { value: 'PROPRIETOR', source: 'pdf-text', confidence: 0.95 },
          employerAddress: { value: 'STATION ROAD, RAJSHAHI', source: 'pdf-text', confidence: 0.95 },
        },
        travel: {
          intendedArrivalDate: { value: '2026-12-01', source: 'pdf-text', confidence: 0.95 },
          purposeOfVisit: { value: 'TOURISM', source: 'pdf-text', confidence: 0.95 },
          duration: { value: '12', source: 'pdf-text', confidence: 0.95 },
          entryPoint: { value: 'HARIDASPUR', source: 'pdf-text', confidence: 0.95 },
        },
      },
    }

    const app = populateApplicationFromDocuments({
      applicantId: 'APPLICANT_PORTAL_088',
      passportDoc,
    })

    // Page 1: Registration
    assert(app.fields['appl.countryname']?.value === 'BANGLADESH', 'Page 1: Country is BANGLADESH')
    assert(app.fields['appl.missioncode']?.value === 'BANGLADESH-RAJSHAHI', 'Page 1: Mission is default BANGLADESH-RAJSHAHI')
    assert(app.fields['appl.nationality']?.value === 'BANGLADESH', 'Page 1: Nationality is BANGLADESH')
    assert(app.fields['appl.birthdate']?.value === '12/08/1988', 'Page 1: DOB is 12/08/1988')
    assert(app.fields['appl.email']?.value === 'sharif.hossain@example.com', 'Page 1: Email is sharif.hossain@example.com')

    // Page 2: Applicant & Passport Details
    assert(app.fields['appl.surname']?.value === 'HOSSAIN', 'Page 2: Surname is HOSSAIN')
    assert(app.fields['appl.applname']?.value === 'MOHAMMAD SHARIF', 'Page 2: Given Names is MOHAMMAD SHARIF')
    assert(app.fields['appl.applsex']?.value === 'MALE', 'Page 2: Gender is MALE')
    assert(app.fields['appl.passport_number']?.value === 'B00123456', 'Page 2: Passport Number is B00123456')
    assert(app.fields['appl.passport_issue_place']?.value === 'RAJSHAHI', 'Page 2: Place of Issue is RAJSHAHI')
    assert(app.fields['appl.passport_issue_date']?.value === '15/06/2021', 'Page 2: Issue date is 15/06/2021')
    assert(app.fields['appl.passport_expiry_date']?.value === '14/06/2031', 'Page 2: Expiry date is 14/06/2031')

    // Page 3: Address & Family & Profession
    assert(app.fields['pres_addr1']?.value === 'HOUSE 45, ROAD 2, KAZIHATA', 'Page 3: Present Address Line 1 populated')
    assert(app.fields['village_town_city']?.value === 'RAJSHAHI', 'Page 3: Present City populated')
    assert(app.fields['fthrname']?.value === 'ANWAR HOSSAIN', 'Page 3: Father name is ANWAR HOSSAIN')
    assert(app.fields['mother_name']?.value === 'ROKEYA BEGUM', 'Page 3: Mother name is ROKEYA BEGUM')
    assert(app.fields['marital_status']?.value === 'Married', 'Page 3: Marital status is Married')
    assert(app.fields['spouse_name']?.value === 'NASRIN AKTER', 'Page 3: Spouse name is NASRIN AKTER')
    assert(app.fields['occupation']?.value === 'BUSINESS PERSON', 'Page 3: Occupation is BUSINESS PERSON')
    assert(app.fields['empname']?.value === 'SHARIF ENTERPRISE', 'Page 3: Employer name is SHARIF ENTERPRISE')

    // Page 4: Visa Details & Travel
    assert(app.fields['purpose']?.value === 'TOURISM', 'Page 4: Purpose is TOURISM')
    assert(app.fields['entrypoint']?.value === 'HARIDASPUR', 'Page 4: Port of arrival is HARIDASPUR')
  }

  // =========================================================================
  // TEST 4: CANDIDATE RESOLVER & DOM AUTOFILL EXECUTION ACROSS ALL PORTAL PAGES
  // =========================================================================
  {
    const savedApp: SavedApplication = {
      applicationId: 'app_dom_088',
      applicantId: 'APPL_DOM_088',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ready_for_autofill',
      manualEdits: {},
      provenance: { lastSavedAt: new Date().toISOString() },
      sourceDocuments: {},
      fields: {
        'appl.countryname': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.missioncode': { value: 'BANGLADESH-RAJSHAHI', source: 'passport', isUserEdited: false },
        'appl.nationality': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.birthdate': { value: '12/08/1988', source: 'passport', isUserEdited: false },
        'appl.email': { value: 'sharif@example.com', source: 'passport', isUserEdited: false },
        'appl.email_re': { value: 'sharif@example.com', source: 'passport', isUserEdited: false },
        'appl.journeydate': { value: '01/12/2026', source: 'passport', isUserEdited: false },
        purpose: { value: 'TOURISM', source: 'passport', isUserEdited: false },
        'appl.surname': { value: 'HOSSAIN', source: 'passport', isUserEdited: false },
        'appl.applname': { value: 'MOHAMMAD SHARIF', source: 'passport', isUserEdited: false },
        'appl.applsex': { value: 'MALE', source: 'passport', isUserEdited: false },
        'appl.passport_number': { value: 'B00123456', source: 'passport', isUserEdited: false },
        'appl.passport_issue_place': { value: 'RAJSHAHI', source: 'passport', isUserEdited: false },
        'appl.passport_issue_date': { value: '15/06/2021', source: 'passport', isUserEdited: false },
        'appl.passport_expiry_date': { value: '14/06/2031', source: 'passport', isUserEdited: false },
        pres_addr1: { value: 'HOUSE 45, ROAD 2', source: 'passport', isUserEdited: false },
        village_town_city: { value: 'RAJSHAHI', source: 'passport', isUserEdited: false },
        present_country: { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        fthrname: { value: 'ANWAR HOSSAIN', source: 'passport', isUserEdited: false },
        mother_name: { value: 'ROKEYA BEGUM', source: 'passport', isUserEdited: false },
      },
    }

    const cand = resolveCandidateData({
      profileId: 'APPL_DOM_088',
      documents: [],
      savedApplication: savedApp,
    })

    assert(cand.status === 'READY', 'Candidate resolution is READY from SavedApplication')

    // Mock DOM for Page 1 & Page 2
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <!-- Page 1: Registration -->
          <select id="countryname_id"><option value="">Select</option><option value="BANGLADESH">BANGLADESH</option></select>
          <select id="missioncode_id"><option value="">Select</option><option value="BANGLADESH-RAJSHAHI">BANGLADESH - RAJSHAHI</option></select>
          <select id="nationality_id"><option value="">Select</option><option value="BANGLADESH">BANGLADESH</option></select>
          <input id="dob_id" type="text" value="" />
          <input id="email_id" type="text" value="" />
          <input id="email_re_id" type="text" value="" />

          <!-- Page 2: Basic Details -->
          <input id="surname" type="text" value="" />
          <input id="givenName" type="text" value="" />
          <select id="gender"><option value="">Select</option><option value="MALE">MALE</option></select>
          <input id="passport_no" type="text" value="" />
          <input id="passport_issue_place" type="text" value="" />
        </body>
      </html>
    `)

    Object.assign(globalThis, {
      document: dom.window.document,
      window: dom.window,
      HTMLElement: dom.window.HTMLElement,
      HTMLInputElement: dom.window.HTMLInputElement,
      HTMLSelectElement: dom.window.HTMLSelectElement,
      HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
      HTMLButtonElement: dom.window.HTMLButtonElement,
      HTMLAnchorElement: dom.window.HTMLAnchorElement,
      Element: dom.window.Element,
      Node: dom.window.Node,
      Event: dom.window.Event,
    })

    const regMappings = getIndiaVisaMappings(null, 'REGISTRATION', 'indianvisa-bangladesh.nic.in')
    const regResult = await executeAutofill({
      mappings: regMappings,
      applicant: cand.applicant!,
      options: { policy: 'fill-empty' },
    })
    assert(regResult.filledFields >= 4, `Registration autofill filled ${regResult.filledFields} fields (>= 4)`)

    const basicMappings = getIndiaVisaMappings(null, 'BASIC_DETAILS', 'indianvisa-bangladesh.nic.in')
    const basicResult = await executeAutofill({
      mappings: basicMappings,
      applicant: cand.applicant!,
      options: { policy: 'fill-empty' },
    })
    assert(basicResult.filledFields >= 3, `Basic Details autofill filled ${basicResult.filledFields} fields (>= 3)`)

    const surnameEl = dom.window.document.getElementById('surname') as HTMLInputElement
    const passportEl = dom.window.document.getElementById('passport_no') as HTMLInputElement
    assert(surnameEl.value === 'HOSSAIN', 'DOM surname matches SavedApplication value')
    assert(passportEl.value === 'B00123456', 'DOM passport number matches SavedApplication value')
  }

  console.log(`Task 088 Test Results: total=${totalSubtests}, failures=${failures.length}`)
  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
