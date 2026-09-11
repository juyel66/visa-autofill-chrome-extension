import fs from 'fs'
import path from 'path'
import { populateApplicationFromDocuments } from '../application/applicationMerger'
import {
  extractFromPdfText,
  parseApplicantContact,
} from '../extraction/data/applicantDataExtractor'
import type { DocumentRecord } from '../document/types'
import type { SavedApplication } from '../application/types'

export interface Task077TestResult {
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
  'SHREE JOTIMOY',
  'SHREE KHIDAR MOHAN',
  'PANCHAMI RANI',
  'JASHODA RANI',
  'KASHIPUR',
  'RANISANKAIL',
  'MUZAHIDABAD',
]

/**
 * Recursively scans production files in src/ (excluding test folders)
 */
function scanDirectoryForHardcodes(dir: string, failures: string[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'tests' || entry.name === 'node_modules' || entry.name === 'dist') {
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

export async function runTask077HardcodeAuditTests(): Promise<Task077TestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  const assert = (condition: boolean, testName: string, detail?: string) => {
    totalSubtests++
    if (!condition) {
      const msg = `FAIL: [Task077Audit] ${testName}${detail ? ` - ${detail}` : ''}`
      console.error(msg)
      failures.push(msg)
    }
  }

  // =========================================================================
  // 1. Static Production Code Hardcode Audit
  // =========================================================================
  console.log('🔍 [TASK 077] Executing Static Production Hardcode Audit across src/**')
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
  // 2. TEST 1: Applicant A Passport (All A values)
  // =========================================================================
  const docRecordA: DocumentRecord = {
    documentId: 'doc_appl_a_001',
    applicantId: 'APPL_A',
    documentType: 'passport',
    fileName: 'passport_a.pdf',
    fileSize: 150000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: {
      personal: {
        lastName: { value: 'AHMED', source: 'mrz', confidence: 95 },
        firstName: { value: 'KAMAL', source: 'mrz', confidence: 95 },
        nationality: { value: 'BANGLADESH', source: 'mrz', confidence: 95 },
      },
      passport: {
        passportNumber: { value: 'PPA111111', source: 'mrz', confidence: 95 },
      },
      presentAddress: {
        addressLine1: { value: 'HOUSE 10, ROAD 2', source: 'pdf-text', confidence: 90 },
        district: { value: 'DHAKA', source: 'pdf-text', confidence: 90 },
        country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 95 },
        phone: { value: '+8801711111111', source: 'pdf-text', confidence: 90 },
        isdCode: { value: '880', source: 'pdf-text', confidence: 90 },
        mobile: { value: '1711111111', source: 'pdf-text', confidence: 90 },
      },
      permanentAddress: {
        addressLine1: { value: 'HOUSE 10, ROAD 2', source: 'pdf-text', confidence: 90 },
        district: { value: 'DHAKA', source: 'pdf-text', confidence: 90 },
        country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 95 },
      },
    },
  }

  const appA = populateApplicationFromDocuments({
    applicantId: 'APPL_A',
    passportDoc: docRecordA,
    existingApp: null,
  })

  assert(appA.fields['appl.surname']?.value === 'AHMED', 'TEST 1: Applicant A surname is AHMED')
  assert(appA.fields['appl.applname']?.value === 'KAMAL', 'TEST 1: Applicant A given name is KAMAL')
  assert(appA.fields['appl.passport_number']?.value === 'PPA111111', 'TEST 1: Applicant A passport is PPA111111')
  assert(appA.fields['pres_phone']?.value === '+8801711111111', 'TEST 1: Applicant A phone is +8801711111111')
  assert(appA.fields['isd_code']?.value === '880', 'TEST 1: Applicant A ISD code is 880')
  assert(appA.fields['mobile']?.value === '1711111111', 'TEST 1: Applicant A mobile is 1711111111')
  assert(appA.fields['pres_addr1']?.value === 'HOUSE 10, ROAD 2', 'TEST 1: Applicant A address is HOUSE 10, ROAD 2')

  // =========================================================================
  // 3. TEST 2: Applicant B Passport (All B values)
  // =========================================================================
  const docRecordB: DocumentRecord = {
    documentId: 'doc_appl_b_001',
    applicantId: 'APPL_B',
    documentType: 'passport',
    fileName: 'passport_b.pdf',
    fileSize: 150000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: {
      personal: {
        lastName: { value: 'CHOWDHURY', source: 'mrz', confidence: 95 },
        firstName: { value: 'TARIQ', source: 'mrz', confidence: 95 },
        nationality: { value: 'BANGLADESH', source: 'mrz', confidence: 95 },
      },
      passport: {
        passportNumber: { value: 'PPB222222', source: 'mrz', confidence: 95 },
      },
      presentAddress: {
        addressLine1: { value: '45 AGRABAD C/A', source: 'pdf-text', confidence: 90 },
        district: { value: 'CHITTAGONG', source: 'pdf-text', confidence: 90 },
        country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 95 },
        phone: { value: '+8801812345678', source: 'pdf-text', confidence: 90 },
        isdCode: { value: '880', source: 'pdf-text', confidence: 90 },
        mobile: { value: '1812345678', source: 'pdf-text', confidence: 90 },
      },
      permanentAddress: {
        addressLine1: { value: '45 AGRABAD C/A', source: 'pdf-text', confidence: 90 },
        district: { value: 'CHITTAGONG', source: 'pdf-text', confidence: 90 },
        country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 95 },
      },
    },
  }

  const appB = populateApplicationFromDocuments({
    applicantId: 'APPL_B',
    passportDoc: docRecordB,
    existingApp: null,
  })

  assert(appB.fields['appl.surname']?.value === 'CHOWDHURY', 'TEST 2: Applicant B surname is CHOWDHURY')
  assert(appB.fields['appl.applname']?.value === 'TARIQ', 'TEST 2: Applicant B given name is TARIQ')
  assert(appB.fields['appl.passport_number']?.value === 'PPB222222', 'TEST 2: Applicant B passport is PPB222222')
  assert(appB.fields['pres_phone']?.value === '+8801812345678', 'TEST 2: Applicant B phone is +8801812345678')
  assert(appB.fields['isd_code']?.value === '880', 'TEST 2: Applicant B ISD code is 880')
  assert(appB.fields['mobile']?.value === '1812345678', 'TEST 2: Applicant B mobile is 1812345678')
  assert(appB.fields['pres_addr1']?.value === '45 AGRABAD C/A', 'TEST 2: Applicant B address is 45 AGRABAD C/A')

  // =========================================================================
  // 4. TEST 3: Applicant B Missing Phone -> Phone & Mobile Blank
  // =========================================================================
  const docRecordBMissingPhone: DocumentRecord = {
    ...docRecordB,
    documentId: 'doc_appl_b_no_phone',
    extractedData: {
      ...docRecordB.extractedData,
      presentAddress: {
        addressLine1: { value: '45 AGRABAD C/A', source: 'pdf-text', confidence: 90 },
        district: { value: 'CHITTAGONG', source: 'pdf-text', confidence: 90 },
        country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 95 },
      },
      contact: undefined,
    },
  }

  const appBNoPhone = populateApplicationFromDocuments({
    applicantId: 'APPL_B',
    passportDoc: docRecordBMissingPhone,
    existingApp: null,
  })

  assert(
    appBNoPhone.fields['pres_phone']?.value === '' &&
      appBNoPhone.fields['mobile']?.value === '' &&
      appBNoPhone.fields['pres_phone']?.source === 'missing',
    'TEST 3: Missing phone leaves pres_phone and mobile blank (never previous applicant phone)'
  )

  // =========================================================================
  // 5. TEST 4: Applicant B Missing Passport Number -> Passport Number Blank
  // =========================================================================
  const docRecordBMissingPpt: DocumentRecord = {
    ...docRecordB,
    documentId: 'doc_appl_b_no_ppt',
    extractedData: {
      ...docRecordB.extractedData,
      passport: undefined,
    },
  }

  const appBNoPpt = populateApplicationFromDocuments({
    applicantId: 'APPL_B',
    passportDoc: docRecordBMissingPpt,
    existingApp: null,
  })

  assert(
    appBNoPpt.fields['appl.passport_number']?.value === '' &&
      appBNoPpt.fields['appl.passport_number']?.source === 'missing',
    'TEST 4: Missing passport number leaves passport_number blank (never sample fallback)'
  )

  // =========================================================================
  // 6. TEST 5: Applicant B Missing Address -> Address Blank
  // =========================================================================
  const docRecordBMissingAddr: DocumentRecord = {
    ...docRecordB,
    documentId: 'doc_appl_b_no_addr',
    extractedData: {
      ...docRecordB.extractedData,
      presentAddress: undefined,
      permanentAddress: undefined,
    },
  }

  const appBNoAddr = populateApplicationFromDocuments({
    applicantId: 'APPL_B',
    passportDoc: docRecordBMissingAddr,
    existingApp: null,
  })

  assert(
    appBNoAddr.fields['pres_addr1']?.value === '' &&
      appBNoAddr.fields['perm_add1']?.value === '' &&
      appBNoAddr.fields['district']?.value === '',
    'TEST 5: Missing address leaves address fields blank (never sample address)'
  )

  // =========================================================================
  // 7. TEST 6 & 7: Sequential Uploads & Re-Sync Isolation
  // =========================================================================
  assert(
    appA.fields['appl.passport_number']?.value !== appB.fields['appl.passport_number']?.value,
    'TEST 6: Complete isolation between Applicant A and Applicant B passport numbers'
  )
  assert(
    appA.fields['pres_phone']?.value !== appB.fields['pres_phone']?.value,
    'TEST 6: Complete isolation between Applicant A and Applicant B phone numbers'
  )

  // Re-sync Applicant B using Applicant A existingApp (cross-contamination test)
  const appBResyncAgainstA = populateApplicationFromDocuments({
    applicantId: 'APPL_B',
    passportDoc: docRecordB,
    existingApp: appA, // Simulated stale application belonging to Applicant A
  })

  assert(
    appBResyncAgainstA.fields['appl.surname']?.value === 'CHOWDHURY',
    'TEST 7: Re-sync Applicant B ignores Applicant A surname'
  )
  assert(
    appBResyncAgainstA.fields['appl.passport_number']?.value === 'PPB222222',
    'TEST 7: Re-sync Applicant B uses Applicant B passport number (no data from A)'
  )
  assert(
    appBResyncAgainstA.fields['pres_phone']?.value === '+8801812345678',
    'TEST 7: Re-sync Applicant B uses Applicant B phone (no phone from A)'
  )

  // =========================================================================
  // 8. TEST 8: Manual Non-Empty Edit Survives Re-Sync
  // =========================================================================
  const existingWithManual: SavedApplication = {
    ...appA,
    fields: {
      ...appA.fields,
      'appl.email': { value: 'custom.manual@example.com', source: 'manual', isUserEdited: true },
    },
    manualEdits: {
      'appl.email': true,
    },
  }

  const reSyncedAppA = populateApplicationFromDocuments({
    applicantId: 'APPL_A',
    passportDoc: docRecordA,
    existingApp: existingWithManual,
  })

  assert(
    reSyncedAppA.fields['appl.email']?.value === 'custom.manual@example.com' &&
      reSyncedAppA.fields['appl.email']?.source === 'manual',
    'TEST 8: Manual non-empty user edit survives re-sync on same applicant'
  )

  // =========================================================================
  // 9. TEST 9: Empty Stale Manual Field Does Not Block Valid Document Extraction
  // =========================================================================
  const existingWithEmptyManual: SavedApplication = {
    ...appA,
    fields: {
      ...appA.fields,
      'appl.passport_number': { value: '', source: 'manual', isUserEdited: true },
    },
    manualEdits: {
      'appl.passport_number': true,
    },
  }

  const appAWithDocumentRecovery = populateApplicationFromDocuments({
    applicantId: 'APPL_A',
    passportDoc: docRecordA,
    existingApp: existingWithEmptyManual,
  })

  assert(
    appAWithDocumentRecovery.fields['appl.passport_number']?.value === 'PPA111111' &&
      appAWithDocumentRecovery.fields['appl.passport_number']?.source === 'passport',
    'TEST 9: Empty stale manual field does not block valid current passport document extraction'
  )

  // =========================================================================
  // 10. TEST 10: Dynamic Phone Normalization Across Multiple Formats
  // =========================================================================
  const phoneNumbers = [
    { raw: '+8801711111111', expectedPhone: '+8801711111111', expectedIsd: '880', expectedMob: '1711111111' },
    { raw: '+8801812345678', expectedPhone: '+8801812345678', expectedIsd: '880', expectedMob: '1812345678' },
    { raw: '+8801912345678', expectedPhone: '+8801912345678', expectedIsd: '880', expectedMob: '1912345678' },
    { raw: '01799999999', expectedPhone: '01799999999', expectedIsd: '880', expectedMob: '1799999999' },
  ]

  for (const p of phoneNumbers) {
    const textSample = `
      PEOPLE'S REPUBLIC OF BANGLADESH
      PASSPORT NO: E12345678
      Surname: ISLAM
      Given Name: RASHID
      Mobile: ${p.raw}
    `
    const parsedContact = parseApplicantContact(textSample)
    assert(
      Boolean(parsedContact.mobile?.includes(p.expectedMob) || parsedContact.phone?.includes(p.expectedMob)),
      `TEST 10: Dynamic extraction for phone ${p.raw}`,
      `got phone=${parsedContact.phone}, mobile=${parsedContact.mobile}`
    )
  }

  // =========================================================================
  // 11. TEST 11: Synthetic Different Applicant (Rahim Karim, Z99999999)
  // =========================================================================
  const syntheticDocText = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT NO: Z99999999
    Surname: KARIM
    Given Name: RAHIM
    Sex: M
    Date of Birth: 01/01/1990
    Present Address: 123 BANANI ROAD 11, DHAKA
    Phone: +8801812345678
  `
  const syntheticExtract = extractFromPdfText(syntheticDocText)
  assert(syntheticExtract.passport?.passportNumber?.value === 'Z99999999', 'TEST 11: Synthetic applicant passport number is Z99999999')
  assert(syntheticExtract.personal?.lastName?.value === 'KARIM', 'TEST 11: Synthetic applicant surname is KARIM')
  assert(syntheticExtract.personal?.firstName?.value === 'RAHIM', 'TEST 11: Synthetic applicant given name is RAHIM')
  assert(syntheticExtract.contact?.phone?.value === '+8801812345678', 'TEST 11: Synthetic applicant phone is +8801812345678')

  // =========================================================================
  // 12. TEST 12: Dual-Page Scanned Passport (Top Emergency Page + Bottom Bio Page)
  // =========================================================================
  const dualPageSample = `
--- PAGE 1 ---
PERSONAL DATA AND EMERGENCY CONTACT
Name: MOHAMMAD ARIF HOSSAIN
Father's Name: MOHAMMAD KHURSHED ALAM
Mother's Name: PARVIN BEGUM
Permanent Address: HOUSE 12, ROAD 5, BLOCK B, MIRPUR - 1216, DHAKA
Emergency Contact:
Name: JANNATUL FERDOUS
Relationship: SPOUSE
Address: HOUSE 12, ROAD 5, BLOCK B, MIRPUR - 1216, DHAKA
Telephone No: +8801744777866

--- PAGE 2 ---
PEOPLE'S REPUBLIC OF BANGLADESH
PASSPORT
Type: P
Country Code: BGD
Passport Number: A12345678
Surname: HOSSAIN
Given Name: MOHAMMAD ARIF
Nationality: BANGLADESHI
Personal No: 8235626051
Previous Passport No: BK0965579
Date of Birth: 18 SEP 1993
Sex: M
Place of Birth: DHAKA
Date of Issue: 20 JAN 2026
Date of Expiry: 19 JAN 2031
P<BGDHOSSAIN<<MOHAMMAD<ARIF<<<<<<<<<<<<<<<<<
A123456780BGD9309186M31011938235626051<<<<48
  `

  const dualExtracted = extractFromPdfText(dualPageSample)
  assert(dualExtracted.passport?.passportNumber?.value === 'A12345678', 'TEST 12: Passport number extracted from page 2')
  assert(dualExtracted.family?.father?.name?.value === 'MOHAMMAD KHURSHED ALAM', 'TEST 12: Father name extracted from page 1')
  assert(dualExtracted.family?.mother?.name?.value === 'PARVIN BEGUM', 'TEST 12: Mother name extracted from page 1')
  assert(dualExtracted.family?.spouse?.name?.value === 'JANNATUL FERDOUS', 'TEST 12: Spouse name extracted from page 1 emergency contact')
  assert(dualExtracted.contact?.phone?.value === '+8801744777866', 'TEST 12: Contact phone +8801744777866 extracted from page 1')
  assert(dualExtracted.contact?.isdCode?.value === '880', 'TEST 12: ISD code 880 normalized from phone')
  assert(dualExtracted.contact?.mobile?.value === '1744777866', 'TEST 12: Mobile 1744777866 extracted without leading 0/880')
  assert(Boolean(dualExtracted.permanentAddress?.addressLine1?.value), 'TEST 12: Permanent address line 1 extracted')
  assert(dualExtracted.permanentAddress?.postalCode?.value === '1216', 'TEST 12: Permanent postal code 1216 extracted')
  assert(dualExtracted.permanentAddress?.district?.value === 'DHAKA', 'TEST 12: Permanent district DHAKA extracted')

  const dualDocRecord: DocumentRecord = {
    documentId: 'doc_dual_001',
    applicantId: 'APPL_DUAL',
    documentType: 'passport',
    fileName: 'sample_passport.pdf',
    fileSize: 250000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: dualExtracted,
    extractedDataConfirmed: true,
  }

  const dualApp = populateApplicationFromDocuments({
    applicantId: 'APPL_DUAL',
    passportDoc: dualDocRecord,
  })

  assert(dualApp.fields['appl.passport_number']?.value === 'A12345678', 'TEST 12: Application field appl.passport_number is A12345678')
  assert(dualApp.fields['fthrname']?.value === 'MOHAMMAD KHURSHED ALAM', 'TEST 12: Application field fthrname is MOHAMMAD KHURSHED ALAM')
  assert(dualApp.fields['mother_name']?.value === 'PARVIN BEGUM', 'TEST 12: Application field mother_name is PARVIN BEGUM')
  assert(dualApp.fields['spouse_name']?.value === 'JANNATUL FERDOUS', 'TEST 12: Application field spouse_name is JANNATUL FERDOUS')
  assert(dualApp.fields['marital_status']?.value === 'Married', 'TEST 12: Application field marital_status is Married')
  assert(dualApp.fields['pres_phone']?.value === '+8801744777866', 'TEST 12: Application field pres_phone is +8801744777866')
  assert(dualApp.fields['isd_code']?.value === '880', 'TEST 12: Application field isd_code is 880')
  assert(dualApp.fields['mobile']?.value === '1744777866', 'TEST 12: Application field mobile is 1744777866')
  assert(Boolean(dualApp.fields['perm_add1']?.value), 'TEST 12: Application field perm_add1 is populated from document')
  assert(dualApp.fields['permanent_postal_code']?.value === '1216', 'TEST 12: Application field permanent_postal_code is 1216')
  assert(dualApp.fields['permanent_district']?.value === 'DHAKA', 'TEST 12: Application field permanent_district is DHAKA')
  assert(dualApp.fields['permanent_country']?.value === 'BANGLADESH', 'TEST 12: Application field permanent_country is BANGLADESH')

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}

