import fs from 'fs'
import path from 'path'
import { populateApplicationFromDocuments } from '../application/applicationMerger'
import type { ExtractedApplicantData } from '../extraction/data/types'
import type { DocumentRecord } from '../document/types'
import type { SavedApplication } from '../application/types'

function mapMockOutputToApplicantData(raw: Record<string, any>): ExtractedApplicantData {
  const result: ExtractedApplicantData = {
    personal: {},
    passport: {},
    contact: {},
    presentAddress: {},
    permanentAddress: {},
    family: {},
    employment: {},
    travel: {},
    previousVisa: {},
    sponsorIndia: {},
    sponsorMission: {},
  }
  const source = 'ai' as const
  const p = (raw.personal || {})
  if (p.surname) result.personal!.lastName = { value: String(p.surname).trim().toUpperCase(), source }
  if (p.givenNames) result.personal!.firstName = { value: String(p.givenNames).trim().toUpperCase(), source }
  if (p.fullName) result.personal!.fullName = { value: String(p.fullName).trim().toUpperCase(), source }
  if (p.dateOfBirth) result.personal!.dateOfBirth = { value: String(p.dateOfBirth), source }
  if (p.sex) result.personal!.gender = { value: String(p.sex).toLowerCase().includes('f') ? 'female' : 'male', source }
  if (p.townCityOfBirth) result.personal!.townCityOfBirth = { value: String(p.townCityOfBirth).trim().toUpperCase(), source }
  if (p.countryOfBirth) result.personal!.countryOfBirth = { value: String(p.countryOfBirth).trim().toUpperCase(), source }
  if (p.nationality) result.personal!.nationality = { value: String(p.nationality).trim().toUpperCase(), source }
  if (p.religion) result.personal!.religion = { value: String(p.religion).trim().toUpperCase(), source }
  if (p.educationalQualification) result.personal!.educationalQualification = { value: String(p.educationalQualification).trim().toUpperCase(), source }

  const ppt = (raw.passport || {})
  if (ppt.passportNumber) result.passport!.passportNumber = { value: String(ppt.passportNumber).trim().toUpperCase(), source }
  if (ppt.passportType) result.passport!.passportType = { value: String(ppt.passportType).trim().toUpperCase(), source }
  if (ppt.issuingCountry) result.passport!.issuingCountry = { value: String(ppt.issuingCountry).trim().toUpperCase(), source }
  if (ppt.placeOfIssue) result.passport!.placeOfIssue = { value: String(ppt.placeOfIssue).trim().toUpperCase(), source }
  if (ppt.issueDate) result.passport!.issueDate = { value: String(ppt.issueDate), source }
  if (ppt.expiryDate) result.passport!.expiryDate = { value: String(ppt.expiryDate), source }
  if (ppt.holdsOtherPassport !== undefined) {
    result.passport!.holdsOtherPassport = { value: Boolean(ppt.holdsOtherPassport), source }
  }
  if (ppt.otherPassportNumber || ppt.otherPassportPlaceOfIssue || ppt.otherPassportCountryOfIssue) {
    result.passport!.otherPassportDetails = {
      passportNumber: ppt.otherPassportNumber ? { value: String(ppt.otherPassportNumber), source } : undefined,
      placeOfIssue: ppt.otherPassportPlaceOfIssue ? { value: String(ppt.otherPassportPlaceOfIssue), source } : undefined,
      countryOfIssue: ppt.otherPassportCountryOfIssue ? { value: String(ppt.otherPassportCountryOfIssue), source } : undefined,
    }
  }

  const c = (raw.contact || {})
  if (c.phone) result.contact!.phone = { value: String(c.phone), source }
  if (c.mobile) result.contact!.mobile = { value: String(c.mobile), source }
  if (c.isdCode) result.contact!.isdCode = { value: String(c.isdCode), source }
  if (c.email) result.contact!.email = { value: String(c.email), source }

  const pra = (raw.presentAddress || {})
  if (pra.addressLine1) result.presentAddress!.addressLine1 = { value: String(pra.addressLine1), source }
  if (pra.district) result.presentAddress!.district = { value: String(pra.district), source }
  if (pra.country) result.presentAddress!.country = { value: String(pra.country), source }

  const pma = (raw.permanentAddress || {})
  if (pma.addressLine1) result.permanentAddress!.addressLine1 = { value: String(pma.addressLine1), source }
  if (pma.district) result.permanentAddress!.district = { value: String(pma.district), source }
  if (pma.country) result.permanentAddress!.country = { value: String(pma.country), source }

  const fam = (raw.family || {})
  if (fam.fatherName) result.family!.father = { name: { value: String(fam.fatherName), source } }
  if (fam.motherName) result.family!.mother = { name: { value: String(fam.motherName), source } }

  return result
}

export interface Task079TestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

const FORBIDDEN_SAMPLE_LITERALS = [
  'A21496961',
  '8235626051',
  'BK0965579',
  '+8801744777846',
  '1744777846',
  '8801744777846',
  'SHREE JOTIMOY',
  'JASHODA RANI',
  'SHREE KHIDAR MOHAN',
  'PANCHAMI RANI',
  'KASHIPUR',
  'RANISANKAIL',
  'MUZAHIDABAD COLONI',
]

/**
 * Recursively scans production files in src/ (excluding test folders)
 */
function scanDirectoryForHardcodes(dir: string, failures: string[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (
        entry.name === '__tests__' ||
        entry.name === 'tests' ||
        entry.name === 'node_modules' ||
        entry.name === 'dist'
      ) {
        continue
      }
      scanDirectoryForHardcodes(fullPath, failures)
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) {
        continue
      }
      const content = fs.readFileSync(fullPath, 'utf8')
      for (const literal of FORBIDDEN_SAMPLE_LITERALS) {
        if (content.includes(literal)) {
          failures.push(`Static hardcode violation in ${fullPath}: found literal "${literal}"`)
        }
      }
    }
  }
}

export async function runTask079DynamicExtractionTests(): Promise<Task079TestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  const assert = (condition: boolean, testName: string, detail?: string) => {
    totalSubtests++
    if (!condition) {
      const msg = `FAIL: [Task079] ${testName}${detail ? ` - ${detail}` : ''}`
      console.error(msg)
      failures.push(msg)
    }
  }

  console.log('🔍 [TASK 079] 1. Static Production Code Hardcode Audit across src/**')
  const srcRoot = path.resolve(process.cwd(), 'src')
  const staticFailures: string[] = []
  scanDirectoryForHardcodes(srcRoot, staticFailures)
  for (const f of staticFailures) {
    failures.push(f)
  }
  assert(
    staticFailures.length === 0,
    'Static Audit: Zero applicant-specific hardcoded literals in production source code',
    staticFailures.join('; ')
  )

  // =========================================================================
  // 2. Structured Extraction Schema & Mapping (Strict extraction, no fake confidence)
  // =========================================================================
  console.log('🔍 [TASK 079] 2. Structured Output Mapping & No Fake Confidence Test')
  const mockSampleOutput = {
    personal: {
      surname: 'KARIM',
      givenNames: 'RAHIM',
      fullName: 'RAHIM KARIM',
      sex: 'male',
      dateOfBirth: '1990-01-01',
      townCityOfBirth: 'DHAKA',
      countryOfBirth: 'BANGLADESH',
      nationality: 'BANGLADESHI',
      religion: null, // Missing in doc
      educationalQualification: null, // Missing in doc
    },
    passport: {
      passportNumber: 'Z99999999',
      passportType: 'P',
      issuingCountry: 'BANGLADESH',
      placeOfIssue: 'DHAKA',
      issueDate: '2020-01-01',
      expiryDate: '2030-01-01',
      holdsOtherPassport: true,
      otherPassportNumber: 'Y88888888',
      otherPassportPlaceOfIssue: null, // Missing in doc
      otherPassportCountryOfIssue: null, // Missing in doc
    },
    contact: {
      phone: '+8801812345678',
      mobile: '1812345678',
      isdCode: '880',
      email: null, // Missing in doc
    },
    presentAddress: {
      addressLine1: '123 BANANI ROAD 11',
      district: 'DHAKA',
      country: 'BANGLADESH',
    },
    permanentAddress: {
      addressLine1: '123 BANANI ROAD 11',
      district: 'DHAKA',
      country: 'BANGLADESH',
    },
    family: {
      fatherName: 'ABDUL KARIM',
      fatherNationality: null, // Generic derivation will handle
      motherName: 'FATEMA BEGUM',
    },
  }

  const mappedMock = mapMockOutputToApplicantData(mockSampleOutput)
  assert(mappedMock.personal?.lastName?.value === 'KARIM', 'Extraction mapping: lastName is KARIM')
  assert(mappedMock.personal?.firstName?.value === 'RAHIM', 'Extraction mapping: firstName is RAHIM')
  assert(mappedMock.passport?.passportNumber?.value === 'Z99999999', 'Extraction mapping: passportNumber is Z99999999')
  assert(mappedMock.personal?.religion === undefined, 'Extraction mapping: missing religion is undefined')
  assert(mappedMock.contact?.email === undefined, 'Extraction mapping: missing email is undefined')
  assert(mappedMock.passport?.otherPassportDetails?.placeOfIssue === undefined, 'Extraction mapping: missing previous passport place of issue is undefined (not defaulted)')
  assert(
    mappedMock.personal?.lastName?.confidence === undefined,
    'Extraction mapping: confidence is NOT fabricated to 99'
  )

  // =========================================================================
  // 3. Synthetic Applicant A (RAHIM KARIM, Z99999999)
  // =========================================================================
  console.log('🔍 [TASK 079] 3. Synthetic Applicant A Workspace Integration')
  const docRecordA: DocumentRecord = {
    documentId: 'doc_appl_a_task079',
    applicantId: 'APPL_A_079',
    documentType: 'passport',
    fileName: 'passport_rahim.pdf',
    fileSize: 150000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: mappedMock,
  }

  const appA = populateApplicationFromDocuments({
    applicantId: 'APPL_A_079',
    passportDoc: docRecordA,
    existingApp: null,
  })

  assert(appA.fields['appl.surname']?.value === 'KARIM', 'Applicant A: surname is KARIM')
  assert(appA.fields['appl.applname']?.value === 'RAHIM', 'Applicant A: given name is RAHIM')
  assert(appA.fields['appl.passport_number']?.value === 'Z99999999', 'Applicant A: passport is Z99999999')
  assert(appA.fields['appl.passport_number']?.source === 'passport', 'Applicant A: passport source is passport')
  assert(appA.fields['pres_phone']?.value === '+8801812345678', 'Applicant A: phone is +8801812345678')
  assert(appA.fields['isd_code']?.value === '880', 'Applicant A: ISD code is 880')
  assert(appA.fields['mobile']?.value === '1812345678', 'Applicant A: mobile is 1812345678')
  assert(appA.fields['fthrname']?.value === 'ABDUL KARIM', 'Applicant A: father is ABDUL KARIM')
  assert(appA.fields['father_nationality']?.value === 'BANGLADESH', 'Applicant A: father nationality derived')
  assert(appA.fields['father_nationality']?.source === 'derived', 'Applicant A: father nationality source is derived')
  assert(appA.fields['appl.email']?.value === '', 'Applicant A: missing email is blank')
  assert(appA.fields['appl.email']?.source === 'missing', 'Applicant A: missing email source is missing')
  assert(appA.fields['appl.religion']?.value === '', 'Applicant A: missing religion is blank')
  assert(appA.fields['appl.oth_ppt_issue_place']?.value === '', 'Applicant A: missing previous passport issue place is blank (not DHAKA)')

  // =========================================================================
  // 4. Synthetic Applicant B (TEST PERSON, X12345678)
  // =========================================================================
  console.log('🔍 [TASK 079] 4. Synthetic Applicant B Workspace Integration')
  const mockSampleOutputB = {
    personal: {
      surname: 'PERSON',
      givenNames: 'TEST',
      fullName: 'TEST PERSON',
      sex: 'female',
      dateOfBirth: '1995-05-15',
      townCityOfBirth: 'CHITTAGONG',
      countryOfBirth: 'BANGLADESH',
      nationality: 'BANGLADESHI',
    },
    passport: {
      passportNumber: 'X12345678',
      passportType: 'P',
      issuingCountry: 'BANGLADESH',
      placeOfIssue: 'CHITTAGONG',
      issueDate: '2021-06-01',
      expiryDate: '2031-06-01',
      holdsOtherPassport: false,
    },
    contact: {
      phone: '+8801912345678',
      mobile: '1912345678',
      isdCode: '880',
    },
    presentAddress: {
      addressLine1: 'TEST ROAD 5, AGRABAD',
      district: 'CHITTAGONG',
      country: 'BANGLADESH',
    },
    permanentAddress: {
      addressLine1: 'TEST ROAD 5, AGRABAD',
      district: 'CHITTAGONG',
      country: 'BANGLADESH',
    },
    family: {
      fatherName: 'FATHER PERSON',
      motherName: 'MOTHER PERSON',
    },
  }

  const docRecordB: DocumentRecord = {
    documentId: 'doc_appl_b_task079',
    applicantId: 'APPL_B_079',
    documentType: 'passport',
    fileName: 'passport_test_person.pdf',
    fileSize: 150000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: mapMockOutputToApplicantData(mockSampleOutputB),
  }

  const appB = populateApplicationFromDocuments({
    applicantId: 'APPL_B_079',
    passportDoc: docRecordB,
    existingApp: null,
  })

  assert(appB.fields['appl.surname']?.value === 'PERSON', 'Applicant B: surname is PERSON')
  assert(appB.fields['appl.applname']?.value === 'TEST', 'Applicant B: given name is TEST')
  assert(appB.fields['appl.passport_number']?.value === 'X12345678', 'Applicant B: passport is X12345678')
  assert(appB.fields['pres_phone']?.value === '+8801912345678', 'Applicant B: phone is +8801912345678')
  assert(appB.fields['mobile']?.value === '1912345678', 'Applicant B: mobile is 1912345678')

  // =========================================================================
  // 5. Sequential Upload & Re-Import Isolation Tests
  // =========================================================================
  console.log('🔍 [TASK 079] 5. Sequential Upload & Re-Import Isolation')
  // Cross contamination check: B loaded with stale app A
  const appBWithStaleA = populateApplicationFromDocuments({
    applicantId: 'APPL_B_079',
    passportDoc: docRecordB,
    existingApp: appA,
  })

  assert(appBWithStaleA.fields['appl.surname']?.value === 'PERSON', 'Isolation: App B ignores A surname')
  assert(appBWithStaleA.fields['appl.passport_number']?.value === 'X12345678', 'Isolation: App B ignores A passport')
  assert(appBWithStaleA.fields['pres_phone']?.value === '+8801912345678', 'Isolation: App B ignores A phone')

  // Re-import A
  const reImportedA = populateApplicationFromDocuments({
    applicantId: 'APPL_A_079',
    passportDoc: docRecordA,
    existingApp: appB,
  })
  assert(reImportedA.fields['appl.surname']?.value === 'KARIM', 'Re-import A: restores surname KARIM')
  assert(reImportedA.fields['appl.passport_number']?.value === 'Z99999999', 'Re-import A: restores passport Z99999999')
  assert(reImportedA.fields['pres_phone']?.value === '+8801812345678', 'Re-import A: restores phone +8801812345678')

  // =========================================================================
  // 6. Generic Address Copying & Derivation Provenance
  // =========================================================================
  console.log('🔍 [TASK 079] 6. Generic Address Copying & Provenance')
  const docRecordOnlyPermanent: DocumentRecord = {
    ...docRecordA,
    documentId: 'doc_only_perm',
    extractedData: {
      personal: mappedMock.personal,
      passport: mappedMock.passport,
      contact: mappedMock.contact,
      permanentAddress: {
        addressLine1: { value: 'HOUSE 10, VILLAGE ROAD', source: 'ai' },
        district: { value: 'DINAJPUR', source: 'ai' },
        country: { value: 'BANGLADESH', source: 'ai' },
      },
    },
  }

  const appOnlyPerm = populateApplicationFromDocuments({
    applicantId: 'APPL_DERIVED_ADDR',
    passportDoc: docRecordOnlyPermanent,
    existingApp: null,
  })

  assert(
    appOnlyPerm.fields['perm_add1']?.value === 'HOUSE 10, VILLAGE ROAD' &&
      appOnlyPerm.fields['perm_add1']?.source === 'passport',
    'Address: Permanent address line 1 has source passport'
  )
  assert(
    appOnlyPerm.fields['pres_addr1']?.value === 'HOUSE 10, VILLAGE ROAD' &&
      appOnlyPerm.fields['pres_addr1']?.source === 'derived',
    'Address: Present address copied from permanent has source derived'
  )

  // =========================================================================
  // 7. Manual Edits Preservation on Matching Applicant
  // =========================================================================
  console.log('🔍 [TASK 079] 7. Manual Edits Preservation')
  const appWithManual: SavedApplication = {
    ...appA,
    fields: {
      ...appA.fields,
      'appl.email': { value: 'manual.rahim@example.com', source: 'manual', isUserEdited: true },
    },
    manualEdits: {
      'appl.email': true,
    },
  }

  const appAReSynced = populateApplicationFromDocuments({
    applicantId: 'APPL_A_079',
    passportDoc: docRecordA,
    existingApp: appWithManual,
  })

  assert(
    appAReSynced.fields['appl.email']?.value === 'manual.rahim@example.com' &&
      appAReSynced.fields['appl.email']?.source === 'manual',
    'Manual: user edit on matching applicant is preserved with source manual'
  )

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
