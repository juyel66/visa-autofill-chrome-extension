import { resolveCandidateData } from '../candidateResolver'
import { executeAutofill } from '../autofillEngine'
import { resolveElement } from '../selectorResolver'
import { isFormReady } from '../../workflow'
import { DEFAULT_SETTINGS } from '../../settings/defaults'
import type { DocumentRecord } from '../../document/types'
import type { ApplicantProfile } from '../../applicant/types'
import { BANGLADESH_REGISTRATION_MAPPINGS } from '../../../countries/india/mappings/bangladesh/registration'
import { getIndiaVisaMappings } from '../../../countries/india/mappingService'

export interface RuntimeRegressionTestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runRuntimeAutofillRegressionTests(): Promise<RuntimeRegressionTestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  // 1. Manifest Storage Permission Audit
  totalSubtests++
  try {
    const isNode = typeof globalThis !== 'undefined' && 'process' in globalThis
    if (isNode) {
      interface NodeFsModule {
        readFileSync: (p: string, enc: string) => string
      }
      interface NodePathModule {
        resolve: (...paths: string[]) => string
      }
      const dynamicImport = new Function('m', 'return import(m)') as (
        m: string
      ) => Promise<{ default: unknown }>
      const fsMod = (await dynamicImport('fs')).default as NodeFsModule
      const pathMod = (await dynamicImport('path')).default as NodePathModule

      const manifestPath = pathMod.resolve('.', 'public/manifest.json')
      const manifestContent = JSON.parse(fsMod.readFileSync(manifestPath, 'utf8'))
      const permissions = (manifestContent.permissions || []) as string[]
      if (!permissions.includes('storage')) {
        failures.push('Test 1 Failed: public/manifest.json is missing "storage" in permissions array.')
      }
      if (!permissions.includes('activeTab')) {
        failures.push('Test 1 Failed: public/manifest.json is missing "activeTab" in permissions array.')
      }
    }
  } catch (err) {
    failures.push(`Test 1 Failed: Could not read manifest.json: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Sample valid confirmed passport doc
  const samplePassportDoc: DocumentRecord = {
    documentId: 'doc_pass_reg_01',
    applicantId: 'app_user_01',
    documentType: 'passport',
    fileName: 'passport.pdf',
    mimeType: 'application/pdf',
    fileSize: 500000,
    status: 'processed',
    source: 'user-upload',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    extractedDataConfirmed: true,
    extractedData: {
      personal: {
        firstName: { value: 'MD JUYEL', confidence: 0.99, source: 'pdf-text' },
        lastName: { value: 'RANA', confidence: 0.99, source: 'pdf-text' },
        dateOfBirth: { value: '1995-08-12', confidence: 0.99, source: 'pdf-text' },
        nationality: { value: 'BANGLADESH', confidence: 0.99, source: 'pdf-text' },
      },
      passport: {
        passportNumber: { value: 'EF1234567', confidence: 0.99, source: 'pdf-text' },
        issuingCountry: { value: 'BANGLADESH', confidence: 0.99, source: 'pdf-text' },
      },
      contact: {
        email: { value: 'juyel@example.com', confidence: 0.99, source: 'pdf-text' },
      },
      travel: {
        journeyDate: { value: '2026-10-01', confidence: 0.99, source: 'pdf-text' },
      },
      presentAddress: {
        country: { value: 'BANGLADESH', confidence: 0.99, source: 'pdf-text' },
      },
    },
  }

  // Sample valid confirmed other doc (e.g. ID card / travel confirmation)
  const sampleOtherConfirmedDoc: DocumentRecord = {
    documentId: 'doc_id_reg_02',
    applicantId: 'app_user_01',
    documentType: 'identity-document',
    fileName: 'national_id.pdf',
    mimeType: 'application/pdf',
    fileSize: 300000,
    status: 'processed',
    source: 'user-upload',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    extractedDataConfirmed: true,
    extractedData: {
      personal: {
        firstName: { value: 'MD JUYEL', confidence: 0.99, source: 'pdf-text' },
        lastName: { value: 'RANA', confidence: 0.99, source: 'pdf-text' },
        dateOfBirth: { value: '1995-08-12', confidence: 0.99, source: 'pdf-text' },
        nationality: { value: 'BANGLADESH', confidence: 0.99, source: 'pdf-text' },
      },
      contact: {
        email: { value: 'juyel@example.com', confidence: 0.99, source: 'pdf-text' },
      },
      travel: {
        journeyDate: { value: '2026-10-01', confidence: 0.99, source: 'pdf-text' },
      },
      presentAddress: {
        country: { value: 'BANGLADESH', confidence: 0.99, source: 'pdf-text' },
      },
    },
  }

  // 2. Confirmed Passport Document Resolves Candidate Data
  totalSubtests++
  const candPassRes = resolveCandidateData({
    profileId: 'app_user_01',
    documents: [samplePassportDoc],
  })
  if (candPassRes.status !== 'READY' || !candPassRes.applicant) {
    failures.push(`Test 2 Failed: Confirmed passport doc should resolve READY, got ${candPassRes.status}: ${candPassRes.reason}`)
  } else {
    if (candPassRes.applicant.personalInfo?.surname !== 'RANA') {
      failures.push(`Test 2 Failed: Expected surname RANA, got ${candPassRes.applicant.personalInfo?.surname}`)
    }
    if (candPassRes.applicant.passport?.passportNumber !== 'EF1234567') {
      failures.push(`Test 2 Failed: Expected passport number EF1234567, got ${candPassRes.applicant.passport?.passportNumber}`)
    }
  }

  // 3. Confirmed Non-Passport Document Resolves Candidate Data when no passport exists
  totalSubtests++
  const candOtherRes = resolveCandidateData({
    profileId: 'app_user_01',
    documents: [sampleOtherConfirmedDoc],
  })
  if (candOtherRes.status !== 'READY' || !candOtherRes.applicant) {
    failures.push(`Test 3 Failed: Confirmed identity-document should resolve READY, got ${candOtherRes.status}: ${candOtherRes.reason}`)
  } else {
    if (candOtherRes.applicant.personalInfo?.dateOfBirth !== '1995-08-12') {
      failures.push(`Test 3 Failed: Expected DOB 1995-08-12, got ${candOtherRes.applicant.personalInfo?.dateOfBirth}`)
    }
    if (candOtherRes.applicant.contact?.email !== 'juyel@example.com') {
      failures.push(`Test 3 Failed: Expected email juyel@example.com, got ${candOtherRes.applicant.contact?.email}`)
    }
  }

  // 4. Missing Confirmed Document Blocks Candidate Data Resolution
  totalSubtests++
  const unconfirmedDoc: DocumentRecord = {
    ...samplePassportDoc,
    documentId: 'doc_unconfirmed_01',
    extractedDataConfirmed: false,
  }
  const candUnconfRes = resolveCandidateData({
    profileId: 'app_user_01',
    documents: [unconfirmedDoc],
  })
  if (candUnconfRes.status !== 'REVIEW_REQUIRED' || candUnconfRes.applicant !== undefined) {
    failures.push(`Test 4 Failed: Unconfirmed document must return REVIEW_REQUIRED without applicant data, got ${candUnconfRes.status}`)
  }

  // 5. Cross-Profile Document Isolation (Profile B cannot access Profile A documents)
  totalSubtests++
  const candCrossRes = resolveCandidateData({
    profileId: 'app_user_02',
    documents: [samplePassportDoc], // Belongs to app_user_01
  })
  if (candCrossRes.status === 'READY' || candCrossRes.applicant !== undefined) {
    failures.push('Test 5 Failed: Document from another profile was resolved across profile boundaries.')
  }

  // 6. Bangladesh Registration Mappings are Non-Empty and Verified
  totalSubtests++
  const regMappings = getIndiaVisaMappings('regular', 'REGISTRATION', 'indianvisa-bangladesh.nic.in')
  if (!regMappings || regMappings.length === 0) {
    failures.push('Test 6 Failed: Bangladesh Registration mappings returned empty array.')
  } else {
    const verifiedMappings = regMappings.filter((m) => m.status === 'verified')
    if (verifiedMappings.length < 6) {
      failures.push(`Test 6 Failed: Expected at least 6 verified mappings for Registration, got ${verifiedMappings.length}`)
    }
    const captchaMap = regMappings.find((m) => m.targetField === 'captcha')
    if (!captchaMap || captchaMap.status !== 'manual-required') {
      failures.push('Test 6 Failed: CAPTCHA mapping must be manual-required.')
    }
  }

  // DOM tests
  if (typeof document !== 'undefined') {
    // 7. Registration Selectors Resolve in Real DOM
    totalSubtests++
    const testDomContainer = document.createElement('div')
    testDomContainer.id = 'bd_test_container'
    testDomContainer.innerHTML = `
      <form id="reg_form">
        <select id="countryname_id" name="appl.countryname">
          <option value="">Select Country</option>
          <option value="BANGLADESH">BANGLADESH</option>
        </select>
        <select id="missioncode_id" name="appl.missioncode">
          <option value="">Select Mission</option>
          <option value="DHAKA">DHAKA</option>
        </select>
        <select id="nationality_id" name="appl.nationality">
          <option value="">Select Nationality</option>
          <option value="BANGLADESH">BANGLADESH</option>
        </select>
        <input type="text" id="dob_id" name="appl.birthdate" value="" />
        <input type="text" id="email_id" name="appl.email" value="" />
        <input type="text" id="email_re_id" name="appl.email_re" value="" />
        <input type="text" id="jouryney_id" name="appl.journeydate" value="" />
        <input type="text" id="captcha" name="captcha" value="" />
      </form>
    `
    document.body.appendChild(testDomContainer)

    const expectedSelectorIds = [
      'countryname_id',
      'missioncode_id',
      'nationality_id',
      'dob_id',
      'email_id',
      'email_re_id',
      'jouryney_id',
    ]

    for (const id of expectedSelectorIds) {
      const el = resolveElement({ strategy: 'id', value: id })
      if (!el) {
        failures.push(`Test 7 Failed: Selector for ID #${id} could not be resolved in DOM.`)
      }
    }

    // 8. Missing source data leaves DOM completely untouched
    totalSubtests++
    const dobInput = document.getElementById('dob_id') as HTMLInputElement
    dobInput.value = '15/05/1990' // Pre-existing value
    const emptySourceProfile: ApplicantProfile = {
      applicantId: 'app_empty',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // personalInfo missing
    }

    const dobMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_dob')!
    await executeAutofill({
      applicant: emptySourceProfile,
      mappings: [dobMapping],
      options: { policy: 'fill-empty' },
    })

    if (dobInput.value !== '15/05/1990') {
      failures.push(`Test 8 Failed: Missing source data modified existing DOM value. Expected '15/05/1990', got '${dobInput.value}'`)
    }

    // 9. Fill-Empty policy fills empty fields
    totalSubtests++
    const emailInput = document.getElementById('email_id') as HTMLInputElement
    emailInput.value = '' // empty
    const emailConfirmInput = document.getElementById('email_re_id') as HTMLInputElement
    emailConfirmInput.value = '' // empty

    const filledProfile: ApplicantProfile = {
      applicantId: 'app_filled',
      contact: { email: 'applicant@test.com' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const emailMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_email')!
    const emailConfirmMapping = BANGLADESH_REGISTRATION_MAPPINGS.find((m) => m.id === 'bd_reg_email_confirm')!

    const fillEmptyResult = await executeAutofill({
      applicant: filledProfile,
      mappings: [emailMapping, emailConfirmMapping],
      options: { policy: 'fill-empty' },
    })

    if (fillEmptyResult.filledFields !== 2) {
      failures.push(`Test 9 Failed: Expected 2 filled fields, got ${fillEmptyResult.filledFields}`)
    }
    if (emailInput.value !== 'applicant@test.com') {
      failures.push(`Test 9 Failed: Email input was not filled. Got '${emailInput.value}'`)
    }
    if (emailConfirmInput.value !== 'applicant@test.com') {
      failures.push(`Test 9 Failed: Email confirm input was not filled. Got '${emailConfirmInput.value}'`)
    }

    // 10. Fill-Empty policy does NOT overwrite pre-filled fields
    totalSubtests++
    emailInput.value = 'existing@domain.com'
    const overwriteAttemptResult = await executeAutofill({
      applicant: filledProfile,
      mappings: [emailMapping],
      options: { policy: 'fill-empty' },
    })

    if (overwriteAttemptResult.filledFields !== 0) {
      failures.push(`Test 10 Failed: Fill-empty policy should have skipped pre-filled field, but reported ${overwriteAttemptResult.filledFields} filled.`)
    }
    if (emailInput.value !== 'existing@domain.com') {
      failures.push(`Test 10 Failed: Fill-empty policy overwrote existing value. Expected 'existing@domain.com', got '${emailInput.value}'`)
    }

    // 11. Dynamic Page Readiness Detection
    totalSubtests++
    const fakeMappings = [
      {
        id: 'fake_field',
        section: 'fake',
        targetField: 'fake',
        sourceType: 'confirmed-document',
        selector: { strategy: 'id', value: 'non_existent_elem_12345' },
        inputType: 'text',
        status: 'verified',
      },
    ] as const

    const notReady = isFormReady([...fakeMappings])
    if (notReady) {
      failures.push('Test 11 Failed: isFormReady returned true for non-existent DOM elements.')
    }

    const isReady = isFormReady(regMappings)
    if (!isReady) {
      failures.push('Test 11 Failed: isFormReady returned false when valid registration form elements were in DOM.')
    }

    // Cleanup test container
    testDomContainer.remove()
  }

  // 12. Settings Audit: requirePageConfirmation defaults to true
  totalSubtests++
  if (typeof DEFAULT_SETTINGS.autofill.requirePageConfirmation !== 'boolean' || DEFAULT_SETTINGS.autofill.requirePageConfirmation !== true) {
    failures.push('Test 12 Failed: DEFAULT_SETTINGS.autofill.requirePageConfirmation must default to true.')
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
