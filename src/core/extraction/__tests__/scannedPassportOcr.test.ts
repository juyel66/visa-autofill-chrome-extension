import fs from 'fs'
import path from 'path'
import {
  extractEmbeddedJpegFromPdf,
  renderPdfPageToImage,
} from '../pdf/pdfTextExtractor'
import { parsePassportMrz } from '../mrz/mrzParser'
import { extractFromOcrText } from '../data/applicantDataExtractor'
import { populateApplicationFromDocuments } from '../../application/applicationMerger'
import { recognizeText } from '../ocr/ocrEngine'
import type { DocumentRecord } from '../../document/types'
import type { OcrResult } from '../ocr/types'

export const JOSODA_OCR_RAW_TEXT = `
—
U0 PERSONAL DATA AND EMERGENCY.CONTACT © = | #1" :
2 ame: MOHAMMAD ARIF HOSSAIN ZZ
ITD pathers Name: MOHAMMAD KHURSHED ALAM 7 = Some
ehh Mother's Name: PARVIN BEGUM 5 IN

|. Legal Guardian's Name: cl A
2.5.5 Permanent Address: HOUSE 12, ROAD 5, BLOCK B - 1216, DHAKA = aa]
ety - 3
NE sea 3 A m—
He . Emergency Contact: S Se
THU ame: JANNATUL FERDOUS
LT Relationship: SPOUSE ) _ =-
VE Address: HOUSE 12, ROAD 5, BLOCK B - 1216, DHAKA
fesiineciie: SUR HARORGAN Pos IS
UES SF 7 RA
aon Telephone No: +8801711111111 Ee EE
bes eis EA
FT SNS INS ms Ge ve We SRE RE RE
STS isISIISIISI RSE EE a
- a — Ter we ae AE
oie. PEOPLE'S REPUBLIC OF BANGLADESH
PASSPORT
Surname: HOSSAIN
Given Name: MOHAMMAD ARIF
Nationality: BANGLADESHI
Personal No.: 1990123456
Date of Birth: 01 JAN 1990
Previous Passport No.: BK1234567
Sex: M
Place of Birth: DHAKA
Date of Issue: 10 JAN 2020
Issuing Authority: DIP/DHAKA
Date of Expiry: 09 JAN 2030

P<BGDHOSSAIN<<MOHAMMAD<ARIF<<<<<<<<<<<<<<<<<<
p  A012345678BGD9001011M30010971990123456<<<<84
`

export async function runScannedPassportOcrTests(): Promise<{
  passed: boolean
  totalSubtests: number
  failures: string[]
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

  console.log('=== STARTING SCANNED PASSPORT OCR & WORKSPACE AUDIT (TASK 058) ===')

  // 1. Test Physical Fixture Loading & Scanned PDF Detection
  const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/Josoda passport.pdf')
  assert(fs.existsSync(fixturePath), `Physical fixture exists at ${fixturePath}`)

  const fileBytes = fs.readFileSync(fixturePath)
  const uint8Data = new Uint8Array(fileBytes)

  // 2. Test Scanned PDF embedded image extraction
  const embeddedJpeg = extractEmbeddedJpegFromPdf(uint8Data)
  assert(embeddedJpeg !== null, 'Embedded JPEG extracted from Josoda passport.pdf')
  if (embeddedJpeg) {
    assert(embeddedJpeg[0] === 0xff && embeddedJpeg[1] === 0xd8 && embeddedJpeg[2] === 0xff, 'JPEG SOI marker valid (0xFFD8FF)')
    const lastIdx = embeddedJpeg.length - 1
    assert(embeddedJpeg[lastIdx - 1] === 0xff && embeddedJpeg[lastIdx] === 0xd9, 'JPEG EOI marker valid (0xFFD9)')
  }

  // 3. Test renderPdfPageToImage
  const imgDataUrl = await renderPdfPageToImage(uint8Data, 1)
  assert(typeof imgDataUrl === 'string' && imgDataUrl.startsWith('data:image/'), 'renderPdfPageToImage returns valid image data URL')

  // 4. Test MRZ Parser with noisy OCR lines
  const mrzRes = parsePassportMrz(JOSODA_OCR_RAW_TEXT)
  assert(mrzRes.success === true, 'MRZ parsing succeeded on noisy OCR text')
  assert(mrzRes.data?.surname === 'HOSSAIN', `MRZ surname is HOSSAIN (got "${mrzRes.data?.surname}")`)
  assert(mrzRes.data?.givenNames === 'MOHAMMAD ARIF', `MRZ givenNames is MOHAMMAD ARIF (got "${mrzRes.data?.givenNames}")`)
  assert(mrzRes.data?.passportNumber === 'A01234567', `MRZ passportNumber is A01234567 (got "${mrzRes.data?.passportNumber}")`)
  assert(mrzRes.data?.nationality === 'BGD', `MRZ nationality is BGD (got "${mrzRes.data?.nationality}")`)
  assert(mrzRes.data?.dateOfBirth === '1990-01-01', `MRZ DOB is 1990-01-01 (got "${mrzRes.data?.dateOfBirth}")`)
  assert(mrzRes.data?.sex === 'male', `MRZ sex is male (got "${mrzRes.data?.sex}")`)
  assert(mrzRes.data?.passportExpiryDate === '2030-01-09', `MRZ expiry date is 2030-01-09 (got "${mrzRes.data?.passportExpiryDate}")`)
  assert(mrzRes.data?.personalNumber === '1990123456', `MRZ personal number is 1990123456 (got "${mrzRes.data?.personalNumber}")`)

  // 5. Test Visual & Candidate Extraction from OCR Result
  const mockOcrResult: OcrResult = {
    success: true,
    text: JOSODA_OCR_RAW_TEXT,
    status: 'success',
    language: 'eng',
    confidence: 78,
    processingTimeMs: 1200,
  }

  const extracted = extractFromOcrText(mockOcrResult)
  assert(Boolean(extracted.personal), 'Extracted personal data is populated')
  assert(extracted.personal?.lastName?.value === 'HOSSAIN', `Extracted surname is HOSSAIN (got "${extracted.personal?.lastName?.value}")`)
  assert(extracted.personal?.firstName?.value === 'MOHAMMAD ARIF', `Extracted firstName is MOHAMMAD ARIF (got "${extracted.personal?.firstName?.value}")`)
  assert(extracted.personal?.nationality?.value === 'BANGLADESH', `Extracted nationality is BANGLADESH (got "${extracted.personal?.nationality?.value}")`)
  assert(extracted.personal?.nationalIdNumber?.value === '1990123456', `Extracted NID is 1990123456 (got "${extracted.personal?.nationalIdNumber?.value}")`)
  assert(extracted.personal?.townCityOfBirth?.value === 'DHAKA', `Extracted townCityOfBirth is DHAKA (got "${extracted.personal?.townCityOfBirth?.value}")`)
  assert(extracted.passport?.passportNumber?.value === 'A01234567', `Extracted passportNumber is A01234567 (got "${extracted.passport?.passportNumber?.value}")`)
  assert(extracted.passport?.issueDate?.value === '2020-01-10', `Extracted passport issueDate is 2020-01-10 (got "${extracted.passport?.issueDate?.value}")`)
  assert(extracted.passport?.expiryDate?.value === '2030-01-09', `Extracted passport expiryDate is 2030-01-09 (got "${extracted.passport?.expiryDate?.value}")`)
  assert(extracted.passport?.placeOfIssue?.value === 'DIP/DHAKA', `Extracted passport placeOfIssue is DIP/DHAKA (got "${extracted.passport?.placeOfIssue?.value}")`)
  assert(extracted.passport?.holdsOtherPassport?.value === true, 'Extracted holdsOtherPassport is true')
  assert(extracted.passport?.otherPassportDetails?.passportNumber?.value === 'BK1234567', `Extracted previous passport number is BK1234567 (got "${extracted.passport?.otherPassportDetails?.passportNumber?.value}")`)
  assert(extracted.family?.father?.name?.value === 'MOHAMMAD KHURSHED ALAM', `Extracted father name is MOHAMMAD KHURSHED ALAM (got "${extracted.family?.father?.name?.value}")`)
  assert(extracted.family?.mother?.name?.value === 'PARVIN BEGUM', `Extracted mother name is PARVIN BEGUM (got "${extracted.family?.mother?.name?.value}")`)
  assert(extracted.family?.spouse?.name?.value === 'JANNATUL FERDOUS', `Extracted spouse name is JANNATUL FERDOUS (got "${extracted.family?.spouse?.name?.value}")`)
  assert(extracted.permanentAddress?.postalCode?.value === '1216', `Extracted permanent postalCode is 1216 (got "${extracted.permanentAddress?.postalCode?.value}")`)
  assert(extracted.permanentAddress?.district?.value === 'DHAKA', `Extracted permanent district is DHAKA (got "${extracted.permanentAddress?.district?.value}")`)

  // 6. Test Zero Cross-Field Contamination:
  // Visible Identification Marks must NOT contain nationality
  assert(
    !extracted.personal?.visibleIdentificationMarks?.value ||
    !extracted.personal.visibleIdentificationMarks.value.includes('BANGLADESH'),
    'Visible identification mark does NOT contain nationality text'
  )
  // TASK 074: Passport emergency contact telephone falls back into applicant contact phone/isd/mobile
  assert(
    extracted.contact?.phone?.value === '+8801711111111' &&
      extracted.contact?.isdCode?.value === '880' &&
      extracted.contact?.mobile?.value === '1711111111',
    'TASK 074: Passport telephone +8801711111111 extracted and normalized into contact phone, isdCode, and mobile'
  )

  // 7. Test SavedApplication Population (End-to-End Workspace Fields)
  const passportDoc: DocumentRecord = {
    documentId: 'doc_josoda_passport_001',
    applicantId: 'app_josoda_001',
    documentType: 'passport',
    fileName: 'Josoda passport.pdf',
    mimeType: 'application/pdf',
    fileSize: fileBytes.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    fileDataUrl: imgDataUrl || '',
    extractedData: extracted,
    extractedDataConfirmed: true,
  }

  const savedApp = populateApplicationFromDocuments({
    applicantId: 'app_josoda_001',
    passportDoc,
  })

  // Mandatory passport-derived fields table
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

  console.log('\n--- PASSPORT EXTRACTION AUDIT MATRIX ---')
  console.log(
    `${'Field'.padEnd(35)} ${'Expected'.padEnd(30)} ${'Workspace Value'.padEnd(30)} Status`
  )
  console.log('-'.repeat(105))

  for (const [key, expectedObj] of Object.entries(expectedPassportFields)) {
    const actualVal = String(savedApp.fields[key]?.value || '')
    const isMatch = actualVal.toUpperCase() === expectedObj.value.toUpperCase()
    console.log(
      `${key.padEnd(35)} ${expectedObj.value.padEnd(30)} ${actualVal.padEnd(30)} ${isMatch ? 'PASS' : 'FAIL'}`
    )
    assert(isMatch, `Field ${key} matches expected workspace value "${expectedObj.value}" (got "${actualVal}")`)
    assert(savedApp.fields[key]?.source === expectedObj.source, `Field ${key} source is ${expectedObj.source} (got "${savedApp.fields[key]?.source}")`)
  }

  // 8. Test Genuinely Missing Fields Remain Cleanly Blank
  const expectedBlankFields = [
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

  for (const blankKey of expectedBlankFields) {
    const val = String(savedApp.fields[blankKey]?.value || '')
    assert(val === '', `Genuinely empty PDF field ${blankKey} remains empty string (got "${val}")`)
    assert(savedApp.fields[blankKey]?.source === 'missing', `Genuinely empty PDF field ${blankKey} source is missing`)
  }

  // 9. Multi-Document Precedence Test: Passport overrides OGD for current identity
  const ogdDocRecord: DocumentRecord = {
    documentId: 'doc_ogd_002',
    applicantId: 'app_josoda_001',
    documentType: 'ogd',
    fileName: 'Khokon WEB 27.pdf',
    mimeType: 'application/pdf',
    fileSize: 1000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: {
      personal: {
        lastName: { value: 'OLD_SURNAME_OGD', source: 'pdf-text', confidence: 95 },
        firstName: { value: 'OLD_GIVEN_OGD', source: 'pdf-text', confidence: 95 },
      },
      employment: {
        presentOccupation: { value: 'FARMER', source: 'pdf-text', confidence: 95 },
      },
      travel: {
        duration: { value: '12 Month', source: 'pdf-text', confidence: 95 },
      },
      sponsorIndia: {
        name: { value: 'VICEROY BOUTIQUE HOTEL', source: 'pdf-text', confidence: 95 },
      },
    },
    extractedDataConfirmed: true,
  }

  const dualMergedApp = populateApplicationFromDocuments({
    applicantId: 'app_josoda_001',
    passportDoc,
    ogdDoc: ogdDocRecord,
  })

  // Passport must win for identity
  assert(dualMergedApp.fields['appl.surname']?.value === 'HOSSAIN', 'Precedence: Passport surname overrides OGD')
  assert(dualMergedApp.fields['appl.applname']?.value === 'MOHAMMAD ARIF', 'Precedence: Passport given name overrides OGD')
  assert(dualMergedApp.fields['appl.surname']?.source === 'passport', 'Source provenance is passport for identity')

  // OGD supplies non-passport details
  assert(dualMergedApp.fields['occupation']?.value === 'FARMER', 'Precedence: OGD supplies occupation')
  assert(dualMergedApp.fields['occupation']?.source === 'ogd', 'Source provenance is ogd for occupation')
  assert(dualMergedApp.fields['nameofsponsor_ind']?.value === 'VICEROY BOUTIQUE HOTEL', 'Precedence: OGD supplies India sponsor')
  assert(dualMergedApp.fields['appl.surname']?.source === 'passport', 'Source provenance is passport for identity')

  // OGD supplies non-passport details
  assert(dualMergedApp.fields['occupation']?.value === 'FARMER', 'Precedence: OGD supplies occupation')
  assert(dualMergedApp.fields['occupation']?.source === 'ogd', 'Source provenance is ogd for occupation')
  assert(dualMergedApp.fields['nameofsponsor_ind']?.value === 'VICEROY BOUTIQUE HOTEL', 'Precedence: OGD supplies India sponsor')
  // 10. Real Runtime OCR Adapter Execution Test (Node runtime)
  try {
    if (embeddedJpeg) {
      const realOcr = await recognizeText(embeddedJpeg, { language: 'eng' })
      if (realOcr.success && realOcr.text) {
        const realExtracted = extractFromOcrText(realOcr)
        assert(Boolean(realExtracted.personal?.lastName?.value), 'Real OCR extracted surname is populated')
        assert(Boolean(realExtracted.personal?.firstName?.value), 'Real OCR extracted givenNames is populated')
        assert(Boolean(realExtracted.passport?.passportNumber?.value), 'Real OCR extracted passport number is populated')
      } else {
        console.log('  ℹ Note: Real OCR worker executed with result status:', realOcr.status)
      }
    }
  } catch (ocrRunErr) {
    console.warn('Real OCR run in test environment notice:', ocrRunErr)
  }

  console.log(`=== SCANNED PASSPORT OCR TESTS FINISHED: Passed=${failures.length === 0}, Subtests=${totalSubtests}, Failures=${failures.length} ===\n`)

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
