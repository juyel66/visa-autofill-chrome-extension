import {
  normalizeReligion,
  extractReligionFromExplicitDocumentText,
  resolveApplicantReligion,
} from '../data/religionExtractor'
import { extractFromPdfText } from '../data/applicantDataExtractor'
import { populateApplicationFromDocuments } from '../../application/applicationMerger'
import type { DocumentRecord } from '../../document/types'
import type { ExtractedApplicantData } from '../data/types'

export interface TestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runHighConfidenceReligionTests(): Promise<TestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  const assert = (condition: boolean, testName: string, detail?: string) => {
    totalSubtests++
    if (!condition) {
      const msg = `FAIL: [ReligionExtraction] ${testName}${detail ? ` - ${detail}` : ''}`
      console.error(msg)
      failures.push(msg)
    }
  }

  // ==========================================
  // 1. NORMALIZATION TESTS
  // ==========================================
  assert(normalizeReligion('Islam') === 'ISLAM', 'Normalize: Islam -> ISLAM')
  assert(normalizeReligion('Muslim') === 'ISLAM', 'Normalize: Muslim -> ISLAM')
  assert(normalizeReligion('Muslimism') === 'ISLAM', 'Normalize: Muslimism -> ISLAM')
  assert(normalizeReligion('Islamic') === 'ISLAM', 'Normalize: Islamic -> ISLAM')
  assert(normalizeReligion('Musalman') === 'ISLAM', 'Normalize: Musalman -> ISLAM')

  assert(normalizeReligion('Hindu') === 'HINDU', 'Normalize: Hindu -> HINDU')
  assert(normalizeReligion('Hinduism') === 'HINDU', 'Normalize: Hinduism -> HINDU')
  assert(normalizeReligion('Sanatan') === 'HINDU', 'Normalize: Sanatan -> HINDU')

  assert(normalizeReligion('Christian') === 'CHRISTIAN', 'Normalize: Christian -> CHRISTIAN')
  assert(normalizeReligion('Christianity') === 'CHRISTIAN', 'Normalize: Christianity -> CHRISTIAN')
  assert(normalizeReligion('Catholic') === 'CHRISTIAN', 'Normalize: Catholic -> CHRISTIAN')

  assert(normalizeReligion('Buddhist') === 'BUDDHISM', 'Normalize: Buddhist -> BUDDHISM')
  assert(normalizeReligion('Buddhism') === 'BUDDHISM', 'Normalize: Buddhism -> BUDDHISM')

  assert(normalizeReligion('Sikh') === 'SIKH', 'Normalize: Sikh -> SIKH')
  assert(normalizeReligion('Sikhism') === 'SIKH', 'Normalize: Sikhism -> SIKH')

  assert(normalizeReligion('Jainism') === 'OTHERS', 'Normalize: Jainism -> OTHERS')
  assert(normalizeReligion('Parsi') === 'OTHERS', 'Normalize: Parsi -> OTHERS')
  assert(normalizeReligion('Jewish') === 'OTHERS', 'Normalize: Jewish -> OTHERS')
  assert(normalizeReligion('Unknown') === undefined, 'Normalize: Unknown -> undefined (leave blank)')

  // ==========================================
  // 2. OCR LABEL VARIATION TESTS
  // ==========================================
  const text1 = 'NATIONALITY: BANGLADESHI\nRELIGION: ISLAM\nPASSPORT NO: A12345678'
  const ext1 = extractReligionFromExplicitDocumentText(text1, 'passport')
  assert(ext1?.value === 'ISLAM' && ext1?.confidence === 'high', 'OCR: Standard RELIGION: ISLAM')

  const textOcrNoise1 = 'NATIONALITY: BANGLADESHI\nRELIGlON: HINDU\nDATE: 01/01/1990'
  const extNoise1 = extractReligionFromExplicitDocumentText(textOcrNoise1, 'passport')
  assert(extNoise1?.value === 'HINDU', 'OCR Noise: RELIGlON (with l) -> HINDU')

  const textOcrNoise2 = 'RELIG1ON: CHRISTIAN\nNAME: JOHN'
  const extNoise2 = extractReligionFromExplicitDocumentText(textOcrNoise2, 'passport')
  assert(extNoise2?.value === 'CHRISTIAN', 'OCR Noise: RELIG1ON (with 1) -> CHRISTIAN')

  const textCommunity = 'RELIGION/COMMUNITY: BUDDHIST\nNATIONALITY: BANGLADESH'
  const extComm = extractReligionFromExplicitDocumentText(textCommunity, 'passport')
  assert(extComm?.value === 'BUDDHISM', 'OCR Label: RELIGION/COMMUNITY -> BUDDHISM')

  // ==========================================
  // 3. MANDATORY USER TEST CASES 1 - 8
  // ==========================================

  // TEST 1: Passport explicitly says: Religion = ISLAM
  const res1 = resolveApplicantReligion({
    passportExtractedValue: 'ISLAM',
    ogdExtractedValue: null,
  })
  assert(
    res1.value === 'ISLAM' && res1.source === 'passport' && res1.confidence === 'high' && !res1.conflict,
    'TEST 1: Passport explicitly says ISLAM -> ISLAM (high confidence, source passport)'
  )

  // TEST 2: Passport has no religion, OGD explicitly says: Religion = HINDU
  const res2 = resolveApplicantReligion({
    passportExtractedValue: null,
    ogdExtractedValue: 'HINDU',
  })
  assert(
    res2.value === 'HINDU' && res2.source === 'ogd' && res2.confidence === 'medium' && !res2.conflict,
    'TEST 2: Passport blank, OGD says HINDU -> HINDU (medium confidence, source ogd)'
  )

  // TEST 3: Passport says ISLAM, OGD says HINDU (Conflict)
  const res3 = resolveApplicantReligion({
    passportExtractedValue: 'ISLAM',
    ogdExtractedValue: 'HINDU',
  })
  assert(
    res3.value === 'ISLAM' &&
      res3.source === 'passport' &&
      res3.confidence === 'high' &&
      res3.conflict === true &&
      Boolean(res3.conflictDetails?.includes('conflict detected')),
    'TEST 3: Passport ISLAM + OGD HINDU -> ISLAM (passport priority with conflict flag)'
  )

  // TEST 4: Name: Md XXXXX, No religion field anywhere -> BLANK
  const pdfTextMd = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT
    Surname: ISLAM
    Given Name: MD TARIQUL
    Nationality: BANGLADESHI
    Date of Birth: 12 JAN 1992
    Passport No: A01234567
  `
  const extMd = extractFromPdfText(pdfTextMd)
  assert(
    extMd.personal?.religion?.value === undefined,
    'TEST 4: Name "Md Tariqul Islam" with no religion field must produce blank religion'
  )

  // TEST 5: Name: SRI ANUP KUMAR, No religion field anywhere -> BLANK
  const pdfTextSri = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT
    Surname: KUMAR
    Given Name: SRI ANUP
    Nationality: BANGLADESHI
    Date of Birth: 20 AUG 1988
    Passport No: B09876543
  `
  const extSri = extractFromPdfText(pdfTextSri)
  assert(
    extSri.personal?.religion?.value === undefined,
    'TEST 5: Name "Sri Anup Kumar" with no religion field must produce blank religion'
  )

  // TEST 6: Name: XXXXX GOMES, No religion field anywhere -> BLANK
  const pdfTextGomes = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT
    Surname: GOMES
    Given Name: PATRICK
    Nationality: BANGLADESHI
    Date of Birth: 05 MAR 1995
    Passport No: C11223344
  `
  const extGomes = extractFromPdfText(pdfTextGomes)
  assert(
    extGomes.personal?.religion?.value === undefined,
    'TEST 6: Name "Patrick Gomes" with no religion field must produce blank religion'
  )

  // Extra Name Tests (Begum, Khatun, Roy, Das, D'Costa, Rozario)
  const pdfTextNames = `
    Surname: ROZARIO
    Given Name: MST REHANA AKTER BEGUM
    Father Name: LATE NIRANJAN ROY
    Mother Name: RITA DAS
  `
  const extNames = extractFromPdfText(pdfTextNames)
  assert(
    extNames.personal?.religion?.value === undefined,
    'TEST 6b: Surnames/Suffixes (Begum, Akter, Roy, Das, Rozario) never derive religion'
  )

  // TEST 7: Passport explicitly says: Religion = CHRISTIAN
  const res7 = resolveApplicantReligion({
    passportExtractedValue: 'CHRISTIAN',
    ogdExtractedValue: null,
  })
  assert(
    res7.value === 'CHRISTIAN' && res7.source === 'passport' && res7.confidence === 'high',
    'TEST 7: Passport explicitly says CHRISTIAN -> CHRISTIAN (high confidence)'
  )

  // TEST 8: User manually changes: Religion = BUDDHIST -> overrides document
  const res8 = resolveApplicantReligion({
    passportExtractedValue: 'ISLAM',
    ogdExtractedValue: 'ISLAM',
    existingManualValue: 'BUDDHIST',
    isUserEdited: true,
  })
  assert(
    res8.value === 'BUDDHISM' && res8.source === 'manual' && !res8.conflict,
    'TEST 8: User manual edit to BUDDHIST overrides passport/OGD with source manual'
  )

  // ==========================================
  // 4. FAMILY MEMBER INDEPENDENCE TEST
  // ==========================================
  const docWithParentReligionText = `
    INDIAN VISA APPLICATION
    Applicant Name: JOSODA RANI
    Father's Name: DILIP ROY
    Father's Religion: HINDU
    Mother's Name: GOURI ROY
    Mother's Religion: HINDU
  `
  const extFamilyOnly = extractFromPdfText(docWithParentReligionText)
  // Applicant has no explicit "Religion: ..." for applicant self
  assert(
    extFamilyOnly.personal?.religion?.value === undefined,
    'TEST 9: Parent religion (Father/Mother) is NEVER copied to Applicant religion'
  )

  // ==========================================
  // 5. APPLICATION MERGER INTEGRATION TEST
  // ==========================================
  const passportExtData1: ExtractedApplicantData = {
    personal: {
      lastName: { value: 'RAHMAN', source: 'pdf-text', confidence: 99 },
      firstName: { value: 'ANISUR', source: 'pdf-text', confidence: 99 },
      religion: { value: 'ISLAM', source: 'pdf-text', confidence: 95 },
    },
    passport: {
      passportNumber: { value: 'A12345678', source: 'pdf-text', confidence: 99 },
    },
  }

  const ogdExtData1: ExtractedApplicantData = {
    personal: {
      religion: { value: 'HINDU', source: 'pdf-text', confidence: 95 },
    },
  }

  const passDocRecord: DocumentRecord = {
    documentId: 'doc_pass_rel_1',
    applicantId: 'APPL_REL_01',
    documentType: 'passport',
    fileName: 'Passport.pdf',
    fileSize: 100000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: passportExtData1,
    extractedDataConfirmed: true,
  }

  const ogdDocRecord: DocumentRecord = {
    documentId: 'doc_ogd_rel_1',
    applicantId: 'APPL_REL_01',
    documentType: 'ogd',
    fileName: 'OGD.pdf',
    fileSize: 100000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: ogdExtData1,
    extractedDataConfirmed: true,
  }

  const mergedApp = populateApplicationFromDocuments({
    applicantId: 'APPL_REL_01',
    passportDoc: passDocRecord,
    ogdDoc: ogdDocRecord,
    existingApp: null,
  })

  assert(
    mergedApp.fields['appl.religion']?.value === 'ISLAM' &&
      mergedApp.fields['appl.religion']?.source === 'passport' &&
      mergedApp.fields['appl.religion']?.hasConflict === true &&
      mergedApp.religionMetadata?.religionConflict === true,
    'TEST 10: populateApplicationFromDocuments detects conflict and sets passport value with conflict metadata'
  )

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
