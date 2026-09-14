import { JSDOM } from 'jsdom'
import { BANGLADESH_BASIC_DETAILS_FIXTURE_HTML } from '../../countries/india/__tests__/fixtures'
import { getIndiaVisaMappings } from '../../countries/india/mappingService'
import { executeAutofill } from '../autofill/autofillEngine'
import { convertSavedApplicationToApplicantProfile } from '../application/applicationMerger'
import type { SavedApplication } from '../application/types'
import { BANGLADESH_BASIC_DETAILS_SELECTORS } from '../../countries/india/selectors/bangladesh/basicDetails'
import { BANGLADESH_FIELD_REGISTRY } from '../../countries/india/selectors/bangladesh/registry'
import { getAllSchemaFields, WORKSPACE_HIDDEN_FIELDS, WORKSPACE_PAGES, WORKSPACE_SECTIONS } from '../application/fieldSchema'

export interface TestSuiteResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runTask089ChangedNameAutofillTests(): Promise<TestSuiteResult> {
  const failures: string[] = []
  let totalSubtests = 0

  function assert(condition: boolean, message: string) {
    totalSubtests++
    if (!condition) {
      failures.push(message)
    }
  }

  console.log('=== RUNNING TASK 089: CHANGED NAME CHECKBOX & PREVIOUS SURNAME/NAME AUTOFILL TESTS ===')

  // =========================================================================
  // TEST 1: Schema & Registry Definitions for Previous Surname & Previous Name
  // =========================================================================
  {
    const allFields = getAllSchemaFields()
    const prevSurnameDef = allFields.find((f) => f.key === 'appl.prev_surname')
    const prevNameDef = allFields.find((f) => f.key === 'appl.prev_name')
    const changedNameCheckDef = allFields.find((f) => f.key === 'appl.changedSurnameCheck')

    assert(prevSurnameDef !== undefined, 'appl.prev_surname must be registered in application schema')
    assert(prevNameDef !== undefined, 'appl.prev_name must be registered in application schema')
    assert(changedNameCheckDef !== undefined, 'appl.changedSurnameCheck must be registered in application schema')

    assert(prevSurnameDef?.section === 'basicDetails', 'appl.prev_surname must belong to basicDetails section')
    assert(prevNameDef?.section === 'basicDetails', 'appl.prev_name must belong to basicDetails section')

    assert(WORKSPACE_HIDDEN_FIELDS.includes('appl.prev_surname'), 'appl.prev_surname must be in WORKSPACE_HIDDEN_FIELDS')
    assert(WORKSPACE_HIDDEN_FIELDS.includes('appl.prev_name'), 'appl.prev_name must be in WORKSPACE_HIDDEN_FIELDS')
    assert(WORKSPACE_HIDDEN_FIELDS.includes('appl.changedSurnameCheck'), 'appl.changedSurnameCheck must be in WORKSPACE_HIDDEN_FIELDS')

    const basicDetailsPage = WORKSPACE_PAGES.find((p) => p.id === 'basicDetails')
    assert(basicDetailsPage?.fieldKeys.includes('appl.prev_surname') === true, 'basicDetails workspace page must include appl.prev_surname')
    assert(basicDetailsPage?.fieldKeys.includes('appl.prev_name') === true, 'basicDetails workspace page must include appl.prev_name')

    const personalDetailsSection = WORKSPACE_SECTIONS.find((s) => s.id === 'personalDetails')
    assert(personalDetailsSection?.fieldKeys.includes('appl.prev_surname') === true, 'personalDetails workspace card must include appl.prev_surname')
    assert(personalDetailsSection?.fieldKeys.includes('appl.prev_name') === true, 'personalDetails workspace card must include appl.prev_name')

    // Verified selectors exist
    assert(BANGLADESH_BASIC_DETAILS_SELECTORS.previousSurname.length > 0, 'BANGLADESH_BASIC_DETAILS_SELECTORS must define previousSurname')
    assert(BANGLADESH_BASIC_DETAILS_SELECTORS.previousGivenName.length > 0, 'BANGLADESH_BASIC_DETAILS_SELECTORS must define previousGivenName')

    // Verified registry entries exist
    assert(BANGLADESH_FIELD_REGISTRY.some((r) => r.controlId === 'basic_prev_surname'), 'BANGLADESH_FIELD_REGISTRY must contain basic_prev_surname')
    assert(BANGLADESH_FIELD_REGISTRY.some((r) => r.controlId === 'basic_prev_name'), 'BANGLADESH_FIELD_REGISTRY must contain basic_prev_name')
  }

  // =========================================================================
  // TEST 2: Convert SavedApplication with Changed Name to ApplicantProfile
  // =========================================================================
  {
    const appWithChangedName: SavedApplication = {
      applicationId: 'APP-CHANGED-1',
      applicantId: 'TEST-APP-CHANGED-NAME',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      manualEdits: {},
      provenance: {
        lastSavedAt: new Date().toISOString(),
      },
      sourceDocuments: {},
      fields: {
        'appl.surname': { value: 'KHAN', source: 'passport', isUserEdited: false },
        'appl.applname': { value: 'MOHAMMAD', source: 'passport', isUserEdited: false },
        'appl.changedSurnameCheck': { value: 'true', source: 'manual', isUserEdited: true },
        'appl.prev_surname': { value: 'CHOWDHURY', source: 'manual', isUserEdited: true },
        'appl.prev_name': { value: 'JASIM UDDIN', source: 'manual', isUserEdited: true },
        'appl.applsex': { value: 'MALE', source: 'passport', isUserEdited: false },
        'appl.birthdate': { value: '15/08/1985', source: 'passport', isUserEdited: false },
        'appl.placbrth': { value: 'DHAKA', source: 'passport', isUserEdited: false },
        'appl.country_of_birth': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.nationality': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.passport_number': { value: 'A12345678', source: 'passport', isUserEdited: false },
        'appl.passport_issue_place': { value: 'DHAKA', source: 'passport', isUserEdited: false },
        'appl.passport_issue_date': { value: '01/01/2020', source: 'passport', isUserEdited: false },
        'appl.passport_expiry_date': { value: '01/01/2030', source: 'passport', isUserEdited: false },
      },
    }

    const profile = convertSavedApplicationToApplicantProfile(appWithChangedName)

    assert(profile.personalInfo?.surname === 'KHAN', 'Surname must be KHAN')
    assert(profile.personalInfo?.givenNames === 'MOHAMMAD', 'Given names must be MOHAMMAD')
    assert(profile.personalInfo?.hasChangedName === true, 'hasChangedName must be true')
    assert(profile.personalInfo?.previousSurname === 'CHOWDHURY', 'previousSurname must be CHOWDHURY')
    assert(profile.personalInfo?.previousGivenNames === 'JASIM UDDIN', 'previousGivenNames must be JASIM UDDIN')
    assert(profile.personalInfo?.previousName === 'JASIM UDDIN', 'previousName must be JASIM UDDIN')
  }

  // =========================================================================
  // TEST 3: Autofill on Bangladesh Portal (/visa/BasicDetails) with Changed Name
  // =========================================================================
  {
    const dom = new JSDOM(BANGLADESH_BASIC_DETAILS_FIXTURE_HTML, {
      url: 'https://indianvisa-bangladesh.nic.in/visa/BasicDetails',
      runScripts: 'outside-only',
    })
    globalThis.document = dom.window.document as unknown as Document
    globalThis.window = dom.window as unknown as Window & typeof globalThis
    globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement
    globalThis.HTMLInputElement = dom.window.HTMLInputElement as unknown as typeof HTMLInputElement
    globalThis.HTMLSelectElement = dom.window.HTMLSelectElement as unknown as typeof HTMLSelectElement
    globalThis.HTMLButtonElement = dom.window.HTMLButtonElement as unknown as typeof HTMLButtonElement
    globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement as unknown as typeof HTMLTextAreaElement
    globalThis.Event = dom.window.Event as unknown as typeof Event

    const appWithChangedName: SavedApplication = {
      applicationId: 'APP-CHANGED-1',
      applicantId: 'TEST-APP-CHANGED-NAME',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      manualEdits: {},
      provenance: {
        lastSavedAt: new Date().toISOString(),
      },
      sourceDocuments: {},
      fields: {
        'appl.surname': { value: 'KHAN', source: 'passport', isUserEdited: false },
        'appl.applname': { value: 'MOHAMMAD', source: 'passport', isUserEdited: false },
        'appl.changedSurnameCheck': { value: 'true', source: 'manual', isUserEdited: true },
        'appl.prev_surname': { value: 'CHOWDHURY', source: 'manual', isUserEdited: true },
        'appl.prev_name': { value: 'JASIM UDDIN', source: 'manual', isUserEdited: true },
        'appl.applsex': { value: 'MALE', source: 'passport', isUserEdited: false },
        'appl.birthdate': { value: '15/08/1985', source: 'passport', isUserEdited: false },
        'appl.placbrth': { value: 'DHAKA', source: 'passport', isUserEdited: false },
        'appl.country_of_birth': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.nationality': { value: 'BANGLADESH', source: 'passport', isUserEdited: false },
        'appl.passport_number': { value: 'A12345678', source: 'passport', isUserEdited: false },
        'appl.passport_issue_place': { value: 'DHAKA', source: 'passport', isUserEdited: false },
        'appl.passport_issue_date': { value: '01/01/2020', source: 'passport', isUserEdited: false },
        'appl.passport_expiry_date': { value: '01/01/2030', source: 'passport', isUserEdited: false },
      },
    }

    const profile = convertSavedApplicationToApplicantProfile(appWithChangedName)
    const mappings = getIndiaVisaMappings('regular', 'BASIC_DETAILS')

    const prevSurnameMapping = mappings.find((m) => m.targetField === 'appl.prev_surname')
    const prevNameMapping = mappings.find((m) => m.targetField === 'appl.prev_name')
    const checkboxMapping = mappings.find((m) => m.targetField === 'appl.changedSurnameCheck')

    assert(prevSurnameMapping !== undefined, 'Mapping for appl.prev_surname must exist in BASIC_DETAILS')
    assert(prevNameMapping !== undefined, 'Mapping for appl.prev_name must exist in BASIC_DETAILS')
    assert(checkboxMapping !== undefined, 'Mapping for appl.changedSurnameCheck must exist in BASIC_DETAILS')

    const autofillResult = await executeAutofill({
      mappings,
      applicant: profile,
      options: { policy: 'overwrite' },
    })

    assert(autofillResult.success === true, `Autofill on BasicDetails must succeed (got ${autofillResult.success})`)

    const chkEl = document.querySelector('#changedSurnameCheck') as HTMLInputElement
    const prevSurnameEl = document.querySelector('#prev_surname') as HTMLInputElement
    const prevNameEl = document.querySelector('#prev_name') as HTMLInputElement

    assert(chkEl !== null && chkEl.checked === true, 'changedSurnameCheck checkbox in DOM must be checked')
    assert(prevSurnameEl !== null && prevSurnameEl.value === 'CHOWDHURY', `prev_surname in DOM must be CHOWDHURY (got '${prevSurnameEl?.value}')`)
    assert(prevNameEl !== null && prevNameEl.value === 'JASIM UDDIN', `prev_name in DOM must be JASIM UDDIN (got '${prevNameEl?.value}')`)
  }

  // =========================================================================
  // TEST 4: Autofill on Bangladesh Portal when Changed Name is False / Absent
  // =========================================================================
  {
    const dom = new JSDOM(BANGLADESH_BASIC_DETAILS_FIXTURE_HTML, {
      url: 'https://indianvisa-bangladesh.nic.in/visa/BasicDetails',
      runScripts: 'outside-only',
    })
    globalThis.document = dom.window.document as unknown as Document
    globalThis.window = dom.window as unknown as Window & typeof globalThis
    globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement
    globalThis.HTMLInputElement = dom.window.HTMLInputElement as unknown as typeof HTMLInputElement
    globalThis.HTMLSelectElement = dom.window.HTMLSelectElement as unknown as typeof HTMLSelectElement
    globalThis.HTMLButtonElement = dom.window.HTMLButtonElement as unknown as typeof HTMLButtonElement
    globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement as unknown as typeof HTMLTextAreaElement
    globalThis.Event = dom.window.Event as unknown as typeof Event

    const appWithoutChangedName: SavedApplication = {
      applicationId: 'APP-NO-CHANGED-1',
      applicantId: 'TEST-APP-NO-CHANGED-NAME',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      manualEdits: {},
      provenance: {
        lastSavedAt: new Date().toISOString(),
      },
      sourceDocuments: {},
      fields: {
        'appl.surname': { value: 'KHAN', source: 'passport', isUserEdited: false },
        'appl.applname': { value: 'MOHAMMAD', source: 'passport', isUserEdited: false },
        'appl.changedSurnameCheck': { value: 'false', source: 'manual', isUserEdited: false },
        'appl.applsex': { value: 'MALE', source: 'passport', isUserEdited: false },
        'appl.birthdate': { value: '15/08/1985', source: 'passport', isUserEdited: false },
      },
    }

    const profile = convertSavedApplicationToApplicantProfile(appWithoutChangedName)
    const mappings = getIndiaVisaMappings('regular', 'BASIC_DETAILS')

    await executeAutofill({
      mappings,
      applicant: profile,
      options: { policy: 'overwrite' },
    })

    const chkEl = document.querySelector('#changedSurnameCheck') as HTMLInputElement
    const prevSurnameEl = document.querySelector('#prev_surname') as HTMLInputElement
    const prevNameEl = document.querySelector('#prev_name') as HTMLInputElement

    assert(chkEl !== null && chkEl.checked === false, 'changedSurnameCheck checkbox in DOM must remain unchecked')
    assert(prevSurnameEl !== null && prevSurnameEl.value === '', 'prev_surname in DOM must remain empty')
    assert(prevNameEl !== null && prevNameEl.value === '', 'prev_name in DOM must remain empty')
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
