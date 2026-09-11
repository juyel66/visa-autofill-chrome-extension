import fs from 'fs'
import path from 'path'
import {
  extractEmbeddedJpegFromPdf,
  renderPdfPageToImage,
} from '../extraction/pdf/pdfTextExtractor'
import { parsePassportMrz } from '../extraction/mrz/mrzParser'
import { extractFromOcrText } from '../extraction/data/applicantDataExtractor'
import { populateApplicationFromDocuments } from '../application/applicationMerger'
import {
  getSavedApplicationByApplicantId,
  saveApplication,
} from '../application/applicationStorage'
import type { DocumentRecord } from '../document/types'
import type { OcrResult } from '../extraction/ocr/types'
import type { SavedApplication } from '../application/types'
import { JOSODA_OCR_RAW_TEXT } from '../extraction/__tests__/scannedPassportOcr.test'
import { BANGLADESH_APPLICATION_SCHEMA } from '../application/fieldSchema'

export async function runTask062RealPassportUploadWorkspaceTests(): Promise<{
  passed: boolean
  totalSubtests: number
  failures: string[]
  metrics: {
    extractedFieldsCount: number
    savedAppFieldsCount: number
    workspaceFieldsCount: number
    populatedPassportFields: string[]
    genuinelyMissingFields: string[]
  }
}> {
  const failures: string[] = []
  let totalSubtests = 0

  const assert = (condition: boolean, msg: string) => {
    totalSubtests++
    if (!condition) {
      failures.push(msg)
      console.error(`  ✗ FAIL: ${msg}`)
    } else {
      console.log(`  ✓ PASS: ${msg}`)
    }
  }

  console.log('=== STARTING TASK 062: REAL PASSPORT UPLOAD → WORKSPACE VERIFICATION ===')

  // -------------------------------------------------------------
  // 1. Physical Fixture & Real Binary Extraction
  // -------------------------------------------------------------
  const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/Josoda passport.pdf')
  assert(fs.existsSync(fixturePath), `Real physical passport fixture exists at ${fixturePath}`)

  const fileBytes = fs.readFileSync(fixturePath)
  const uint8Data = new Uint8Array(fileBytes)
  assert(uint8Data.length > 50000, `Physical PDF binary loaded (${(uint8Data.length / 1024).toFixed(1)} KB)`)

  const embeddedJpeg = extractEmbeddedJpegFromPdf(uint8Data)
  assert(embeddedJpeg !== null, 'High-resolution embedded JPEG image payload extracted from PDF')
  if (embeddedJpeg) {
    assert(embeddedJpeg[0] === 0xff && embeddedJpeg[1] === 0xd8 && embeddedJpeg[2] === 0xff, 'Valid JPEG SOI marker (0xFFD8FF)')
    const lastIdx = embeddedJpeg.length - 1
    assert(embeddedJpeg[lastIdx - 1] === 0xff && embeddedJpeg[lastIdx] === 0xd9, 'Valid JPEG EOI marker (0xFFD9)')
  }

  const renderedImage = await renderPdfPageToImage(uint8Data, 1)
  assert(typeof renderedImage === 'string' && renderedImage.startsWith('data:image/'), 'Fallback renderPdfPageToImage produces valid data URL')

  // -------------------------------------------------------------
  // 2. OCR & MRZ Parser on Scanned Passport Text
  // -------------------------------------------------------------
  const mrzResult = parsePassportMrz(JOSODA_OCR_RAW_TEXT)
  assert(mrzResult.success === true, 'MRZ parser extracted structured identity from noisy OCR lines')
  assert(mrzResult.data?.surname === 'HOSSAIN', `MRZ surname matches HOSSAIN (got "${mrzResult.data?.surname}")`)
  assert(mrzResult.data?.givenNames === 'MOHAMMAD ARIF', `MRZ given names match MOHAMMAD ARIF (got "${mrzResult.data?.givenNames}")`)
  assert(mrzResult.data?.passportNumber === 'A01234567', `MRZ passport number matches A01234567 (got "${mrzResult.data?.passportNumber}")`)
  assert(mrzResult.data?.nationality === 'BGD', `MRZ nationality matches BGD (got "${mrzResult.data?.nationality}")`)
  assert(mrzResult.data?.dateOfBirth === '1990-01-01', `MRZ date of birth matches 1990-01-01 (got "${mrzResult.data?.dateOfBirth}")`)
  assert(mrzResult.data?.sex === 'male', `MRZ gender matches male (got "${mrzResult.data?.sex}")`)
  assert(mrzResult.data?.passportExpiryDate === '2030-01-09', `MRZ expiry date matches 2030-01-09 (got "${mrzResult.data?.passportExpiryDate}")`)
  assert(mrzResult.data?.personalNumber === '1990123456', `MRZ personal ID matches 1990123456 (got "${mrzResult.data?.personalNumber}")`)

  const mockOcrResult: OcrResult = {
    success: true,
    text: JOSODA_OCR_RAW_TEXT,
    status: 'success',
    language: 'eng',
    confidence: 82,
    processingTimeMs: 1150,
  }

  const extracted = extractFromOcrText(mockOcrResult)
  assert(Boolean(extracted.personal), 'Extracted personal object populated')
  assert(Boolean(extracted.passport), 'Extracted passport object populated')
  assert(Boolean(extracted.family), 'Extracted family object populated')
  assert(Boolean(extracted.permanentAddress), 'Extracted permanentAddress object populated')

  assert(extracted.personal?.lastName?.value === 'HOSSAIN', 'Extracted surname is HOSSAIN')
  assert(extracted.personal?.firstName?.value === 'MOHAMMAD ARIF', 'Extracted firstName is MOHAMMAD ARIF')
  assert(extracted.personal?.nationality?.value === 'BANGLADESH', 'Extracted nationality is BANGLADESH')
  assert(extracted.personal?.nationalIdNumber?.value === '1990123456', 'Extracted National ID is 1990123456')
  assert(extracted.personal?.townCityOfBirth?.value === 'DHAKA', 'Extracted townCityOfBirth is DHAKA')
  assert(extracted.passport?.passportNumber?.value === 'A01234567', 'Extracted passportNumber is A01234567')
  assert(extracted.passport?.issueDate?.value === '2020-01-10', 'Extracted passport issueDate is 2020-01-10')
  assert(extracted.passport?.expiryDate?.value === '2030-01-09', 'Extracted passport expiryDate is 2030-01-09')
  assert(extracted.passport?.placeOfIssue?.value === 'DIP/DHAKA', 'Extracted placeOfIssue is DIP/DHAKA')
  assert(extracted.passport?.holdsOtherPassport?.value === true, 'Extracted holdsOtherPassport is true')
  assert(extracted.passport?.otherPassportDetails?.passportNumber?.value === 'BK1234567', 'Extracted previous passport is BK1234567')
  assert(extracted.family?.father?.name?.value === 'MOHAMMAD KHURSHED ALAM', 'Extracted father name is MOHAMMAD KHURSHED ALAM')
  assert(extracted.family?.mother?.name?.value === 'PARVIN BEGUM', 'Extracted mother name is PARVIN BEGUM')
  assert(extracted.family?.spouse?.name?.value === 'JANNATUL FERDOUS', 'Extracted spouse name is JANNATUL FERDOUS')
  assert(extracted.permanentAddress?.postalCode?.value === '1216', 'Extracted postalCode is 1216')
  assert(extracted.permanentAddress?.district?.value === 'DHAKA', 'Extracted district is DHAKA')

  // -------------------------------------------------------------
  // 3. Zero Wrong-Field Contamination Audits
  // -------------------------------------------------------------
  assert(
    !extracted.personal?.visibleIdentificationMarks?.value ||
      !extracted.personal.visibleIdentificationMarks.value.includes('BANGLADESH'),
    'Zero Contamination: Nationality does not appear in Visible Identification Marks'
  )
  assert(
    extracted.contact?.phone?.value === '+8801711111111' &&
      extracted.contact?.isdCode?.value === '880' &&
      extracted.contact?.mobile?.value === '1711111111',
    'TASK 074: Passport emergency contact telephone falls back into applicant contact phone, isdCode, and mobile'
  )
  assert(
    extracted.family?.father?.name?.value !== extracted.family?.mother?.name?.value,
    'Zero Contamination: Father data does not appear in Mother fields'
  )
  assert(
    extracted.passport?.issueDate?.value !== extracted.passport?.expiryDate?.value,
    'Zero Contamination: Passport issue date does not appear as expiry date'
  )
  assert(
    extracted.personal?.dateOfBirth?.value !== extracted.passport?.issueDate?.value,
    'Zero Contamination: DOB does not appear as issue date'
  )

  // -------------------------------------------------------------
  // 4. Automatic SavedApplication Population & Field Verification
  // -------------------------------------------------------------
  const passportDocRecord: DocumentRecord = {
    documentId: 'doc_josoda_passport_real',
    applicantId: 'applicant_josoda_real',
    documentType: 'passport',
    fileName: 'Josoda passport.pdf',
    fileSize: fileBytes.length,
    mimeType: 'application/pdf',
    fileDataUrl: renderedImage || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: extracted,
    extractedDataConfirmed: true,
  }

  const savedApplication = populateApplicationFromDocuments({
    applicantId: 'applicant_josoda_real',
    passportDoc: passportDocRecord,
  })

  assert(Boolean(savedApplication), 'SavedApplication successfully created')
  assert(savedApplication.applicantId === 'applicant_josoda_real', 'SavedApplication applicantId matches')
  assert(savedApplication.status === 'ready_for_autofill', 'SavedApplication status is ready_for_autofill')

  const expectedPassportFields: Record<string, { value: string; source: 'passport' | 'derived' }> = {
    'appl.surname': { value: 'HOSSAIN', source: 'passport' },
    'appl.applname': { value: 'MOHAMMAD ARIF', source: 'passport' },
    'appl.applsex': { value: 'MALE', source: 'passport' },
    'appl.birthdate': { value: '01/01/1990', source: 'passport' },
    'appl.placbrth': { value: 'DHAKA', source: 'passport' },
    'appl.country_of_birth': { value: 'BANGLADESH', source: 'passport' },
    'appl.nationality': { value: 'BANGLADESH', source: 'passport' },
    'appl.countryname': { value: 'BANGLADESH', source: 'passport' },
    'appl.nationality_by': { value: 'Birth', source: 'passport' },
    'appl.nic_no': { value: '1990123456', source: 'passport' },
    'appl.passport_number': { value: 'A01234567', source: 'passport' },
    'appl.passport_issue_place': { value: 'DIP/DHAKA', source: 'passport' },
    'appl.passport_issue_date': { value: '10/01/2020', source: 'passport' },
    'appl.passport_expiry_date': { value: '09/01/2030', source: 'passport' },
    'fthrname': { value: 'MOHAMMAD KHURSHED ALAM', source: 'passport' },
    'father_nationality': { value: 'BANGLADESH', source: 'derived' },
    'father_prev_nationality': { value: 'BANGLADESH', source: 'derived' },
    'father_country_of_birth': { value: 'BANGLADESH', source: 'derived' },
    'mother_name': { value: 'PARVIN BEGUM', source: 'passport' },
    'mother_nationality': { value: 'BANGLADESH', source: 'derived' },
    'mother_prev_nationality': { value: 'BANGLADESH', source: 'derived' },
    'mother_country_of_birth': { value: 'BANGLADESH', source: 'derived' },
    'spouse_name': { value: 'JANNATUL FERDOUS', source: 'passport' },
    'spouse_nationality': { value: 'BANGLADESH', source: 'derived' },
    'spouse_prev_nationality': { value: 'BANGLADESH', source: 'derived' },
    'spouse_country_of_birth': { value: 'BANGLADESH', source: 'derived' },
    'marital_status': { value: 'Married', source: 'passport' },
    'pres_addr1': { value: 'HOUSE 12', source: 'derived' },
    'pres_addr2': { value: 'ROAD 5, BLOCK B', source: 'derived' },
    'village_town_city': { value: 'DHAKA', source: 'derived' },
    'district': { value: 'DHAKA', source: 'derived' },
    'present_country': { value: 'BANGLADESH', source: 'passport' },
    'pincode': { value: '1216', source: 'derived' },
    'pres_phone': { value: '+8801711111111', source: 'passport' },
    'isd_code': { value: '880', source: 'passport' },
    'mobile': { value: '1711111111', source: 'passport' },
    'perm_add1': { value: 'HOUSE 12', source: 'passport' },
    'perm_add2': { value: 'ROAD 5, BLOCK B', source: 'passport' },
    'permanent_village_town_city': { value: 'DHAKA', source: 'passport' },
    'permanent_district': { value: 'DHAKA', source: 'passport' },
    'permanent_country': { value: 'BANGLADESH', source: 'passport' },
    'permanent_postal_code': { value: '1216', source: 'passport' },
    'appl.oth_ppt': { value: 'Yes', source: 'passport' },
    'appl.oth_pptno': { value: 'BK1234567', source: 'passport' },
  }

  const populatedKeys: string[] = []
  for (const [k, expectedObj] of Object.entries(expectedPassportFields)) {
    const actualVal = String(savedApplication.fields[k]?.value || '')
    const isMatch = actualVal.toUpperCase() === expectedObj.value.toUpperCase()
    assert(isMatch, `Mandatory field "${k}" matches "${expectedObj.value}" (got "${actualVal}")`)
    assert(savedApplication.fields[k]?.source === expectedObj.source, `Field "${k}" source provenance is ${expectedObj.source} (got "${savedApplication.fields[k]?.source}")`)
    if (isMatch) populatedKeys.push(k)
  }

  // Genuinely missing fields
  const expectedGenuinelyMissing = [
    'appl.oth_ppt_issue_place',
    'appl.prev_passport_country_issue',
    'appl.other_ppt_nationality',
    'permanent_state_province',
    'perm_add3',
    'duration',
    'visa_entry_id',
    'appl.journeydate',
    'journeydate',
    'entrypoint',
    'exitpoint',
    'old_visa_no',
    'old_visa_type_id',
    'oldvisaissueplace',
    'oldvisaissuedate',
    'nameofsponsor_ind',
    'add1ofsponsor_ind',
    'phoneofsponsor_ind',
    'nameofsponsor_msn',
    'add1ofsponsor_msn',
    'phoneofsponsor_msn',
  ]

  for (const blankKey of expectedGenuinelyMissing) {
    const val = String(savedApplication.fields[blankKey]?.value || '')
    assert(val === '', `Genuinely missing field "${blankKey}" remains clean blank`)
    assert(savedApplication.fields[blankKey]?.source === 'missing', `Genuinely missing field "${blankKey}" source is missing`)
  }

  // -------------------------------------------------------------
  // 5. Data Integrity: Manual Edit > Passport > OGD > Blank
  // -------------------------------------------------------------
  // Test manual edit preservation
  const userEditedApp = {
    ...savedApplication,
    fields: {
      ...savedApplication.fields,
      'appl.surname': {
        value: 'CUSTOM_USER_SURNAME',
        source: 'manual' as const,
        isUserEdited: true,
      },
    },
    manualEdits: {
      'appl.surname': true,
    },
  }

  // Re-synchronizing from documents must preserve manual edit
  const reSyncedApp = populateApplicationFromDocuments({
    applicantId: 'applicant_josoda_real',
    passportDoc: passportDocRecord,
    existingApp: userEditedApp,
  })

  assert(
    reSyncedApp.fields['appl.surname']?.value === 'CUSTOM_USER_SURNAME',
    'Data Integrity: User manual edit is strictly preserved upon re-sync'
  )
  assert(
    reSyncedApp.fields['appl.surname']?.source === 'manual',
    'Data Integrity: User manual edit provenance is manual'
  )

  // -------------------------------------------------------------
  // 6. Automatic Persistence & Storage Reload
  // -------------------------------------------------------------
  await saveApplication(savedApplication)
  const reloadedFromStorage = await getSavedApplicationByApplicantId('applicant_josoda_real')

  assert(reloadedFromStorage !== null, 'Automatic Persistence: Application reloaded from storage')
  assert(
    reloadedFromStorage?.fields['appl.passport_number']?.value === 'A01234567',
    'Automatic Persistence: Reloaded passport number matches A01234567'
  )
  assert(
    reloadedFromStorage?.fields['appl.surname']?.value === 'HOSSAIN',
    'Automatic Persistence: Reloaded surname matches HOSSAIN'
  )
  assert(
    reloadedFromStorage?.fields['fthrname']?.value === 'MOHAMMAD KHURSHED ALAM',
    'Automatic Persistence: Reloaded father name matches MOHAMMAD KHURSHED ALAM'
  )

  // -------------------------------------------------------------
  // 7. Workspace Schema Field Count Audit
  // -------------------------------------------------------------
  let totalSchemaFields = 0
  BANGLADESH_APPLICATION_SCHEMA.forEach((sec) => {
    totalSchemaFields += sec.fields.length
  })

  const populatedFieldsCount = Object.keys(savedApplication.fields).filter(
    (k) =>
      savedApplication.fields[k] &&
      typeof savedApplication.fields[k].value === 'string' &&
      savedApplication.fields[k].value.trim() !== ''
  ).length

  assert(totalSchemaFields >= 50, `Schema contains ${totalSchemaFields} registered fields across 6 sections`)
  assert(populatedFieldsCount >= 35, `SavedApplication contains ${populatedFieldsCount} populated fields (>= 35)`)

  // -------------------------------------------------------------
  // 8. Task 066: Document Identity Isolation & Stale Data Overwrite
  // -------------------------------------------------------------
  console.log('--- TASK 066: VERIFYING DOCUMENT IDENTITY ISOLATION & STALE RECORD OVERWRITE ---')
  const josodaMrz = parsePassportMrz(
    'P<BGDJOSODA<<RANI<<<<<<<<<<<<<<<<<<<<<<<<<<<\nA130541708BGD8704207F34021285093952514<<<<14'
  )
  assert(josodaMrz.success === true, 'Josoda MRZ parsed successfully')
  assert(josodaMrz.data?.dateOfBirth === '1987-04-20', 'Josoda MRZ DOB is 1987-04-20')
  assert(josodaMrz.data?.surname === 'JOSODA', 'Josoda MRZ surname is JOSODA')
  assert(josodaMrz.data?.givenNames === 'RANI', 'Josoda MRZ givenNames is RANI')
  assert(josodaMrz.data?.passportNumber === 'A13054170', 'Josoda MRZ passport number is A13054170')
  assert(josodaMrz.data?.personalNumber === '5093952514', 'Josoda MRZ national ID is 5093952514')

  const josodaExtracted = extractFromOcrText({
    success: true,
    text: 'PEOPLE\'S REPUBLIC OF BANGLADESH\nPASSPORT\nType: P Country Code: BGD Passport No: A13054170\nSurname: JOSODA\nGiven Name: RANI\nNationality: BANGLADESHI\nDate of Birth: 20 APR 1987\nSex: F\nPersonal No: 5093952514\nSpouse Name: KHOKON CHANDRA ROY\nFather: DIJEN CHANDRA ROY\nMother: SABITRI RANI\nAddress: VILL-UTTAR PRADHAN PARA, PO-BENGHARI-5000, PANCHAGARH\nP<BGDJOSODA<<RANI<<<<<<<<<<<<<<<<<<<<<<<<<<<\nA130541708BGD8704207F34021285093952514<<<<14',
    status: 'success',
    language: 'eng',
    confidence: 90,
  })

  const josodaPassportDoc: DocumentRecord = {
    documentId: 'doc_josoda_new_123',
    applicantId: 'applicant_shared_id',
    documentType: 'passport',
    fileName: 'Josoda passport.pdf',
    fileSize: 396213,
    mimeType: 'application/pdf',
    fileDataUrl: 'data:application/pdf;base64,...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: josodaExtracted,
    extractedDataConfirmed: true,
  }

  // Stale application from previous applicant (Arif Hossain with DOB 01/01/1990)
  const staleOldApplication: SavedApplication = {
    applicationId: 'app_stale_123',
    applicantId: 'applicant_shared_id',
    fields: {
      'appl.surname': { value: 'HOSSAIN', source: 'passport', isUserEdited: true },
      'appl.applname': { value: 'MOHAMMAD ARIF', source: 'passport', isUserEdited: true },
      'appl.birthdate': { value: '01/01/1990', source: 'passport', isUserEdited: true },
      'appl.pptno': { value: 'A01234567', source: 'passport', isUserEdited: true },
      'appl.nic_no': { value: '1990123456', source: 'passport', isUserEdited: true },
      'appl.applsex': { value: 'MALE', source: 'passport' },
    },
    manualEdits: {
      'appl.birthdate': true,
      'appl.surname': true,
      'appl.applname': true,
      'appl.pptno': true,
    },
    provenance: {
      passportDocumentId: 'doc_old_pass_999',
      lastSavedAt: new Date().toISOString(),
    },
    sourceDocuments: {},
    status: 'ready_for_autofill',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // Mismatched OGD from another applicant
  const mismatchedOgdDoc: DocumentRecord = {
    documentId: 'doc_ogd_old_456',
    applicantId: 'applicant_shared_id',
    documentType: 'ogd',
    fileName: 'Previous Visa OGD.pdf',
    fileSize: 150000,
    mimeType: 'application/pdf',
    createdAt: new Date(Date.now() - 100000).toISOString(),
    updatedAt: new Date(Date.now() - 100000).toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: {
      personal: {
        lastName: { value: 'HOSSAIN', source: 'pdf-text', confidence: 95 },
        firstName: { value: 'MOHAMMAD ARIF', source: 'pdf-text', confidence: 95 },
        dateOfBirth: { value: '1990-01-01', source: 'pdf-text', confidence: 95 },
      },
      passport: {
        passportNumber: { value: 'A01234567', source: 'pdf-text', confidence: 95 },
      },
    },
  }

  // Merging with Josoda passport MUST isolate and overwrite stale data
  const isolatedJosodaApp = populateApplicationFromDocuments({
    applicantId: 'applicant_shared_id',
    passportDoc: josodaPassportDoc,
    ogdDoc: mismatchedOgdDoc,
    existingApp: staleOldApplication,
  })

  assert(
    isolatedJosodaApp.fields['appl.birthdate']?.value === '20/04/1987',
    `Isolation: Josoda DOB is 20/04/1987, NOT old 01/01/1990 (got "${isolatedJosodaApp.fields['appl.birthdate']?.value}")`
  )
  assert(
    isolatedJosodaApp.fields['appl.surname']?.value === 'JOSODA',
    `Isolation: Josoda surname is JOSODA, NOT old HOSSAIN (got "${isolatedJosodaApp.fields['appl.surname']?.value}")`
  )
  assert(
    isolatedJosodaApp.fields['appl.applname']?.value === 'RANI',
    `Isolation: Josoda givenName is RANI (got "${isolatedJosodaApp.fields['appl.applname']?.value}")`
  )
  assert(
    isolatedJosodaApp.fields['appl.pptno']?.value === 'A13054170' || isolatedJosodaApp.fields['appl.passport_number']?.value === 'A13054170',
    `Isolation: Josoda passport number is A13054170 (got "${isolatedJosodaApp.fields['appl.pptno']?.value || isolatedJosodaApp.fields['appl.passport_number']?.value}")`
  )
  assert(
    isolatedJosodaApp.fields['appl.nic_no']?.value === '5093952514',
    `Isolation: Josoda NID is 5093952514 (got "${isolatedJosodaApp.fields['appl.nic_no']?.value}")`
  )
  assert(
    isolatedJosodaApp.fields['appl.applsex']?.value === 'FEMALE',
    `Isolation: Josoda gender is FEMALE (got "${isolatedJosodaApp.fields['appl.applsex']?.value}")`
  )
  assert(
    isolatedJosodaApp.fields['spouse_name']?.value === 'KHOKON CHANDRA ROY',
    `Isolation: Josoda spouse is KHOKON CHANDRA ROY (got "${isolatedJosodaApp.fields['spouse_name']?.value}")`
  )

  console.log(`=== TASK 062 & TASK 066 TESTS FINISHED: Passed=${failures.length === 0}, Subtests=${totalSubtests}, Failures=${failures.length} ===\n`)

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
    metrics: {
      extractedFieldsCount: Object.keys(extracted).length,
      savedAppFieldsCount: populatedFieldsCount,
      workspaceFieldsCount: totalSchemaFields,
      populatedPassportFields: populatedKeys,
      genuinelyMissingFields: expectedGenuinelyMissing,
    },
  }
}
