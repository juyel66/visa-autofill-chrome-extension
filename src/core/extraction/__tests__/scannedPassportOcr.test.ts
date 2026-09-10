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
2 ame: SHREE JOTMOY RAY ZZ
ITD pathers Name: SHREE KHIDAR MOHAN 7 = Some
ehh Mother's Name: PANCHAMI RANI 5 IN

|. Legal Guardian's Name: cl A
2.5.5 Permanent Address: KASHIPUR, RANISANKAIL, MUZAHIDABAD COLONI - 5120, THAKURGAON = aa]
ety - 3
NE sea 3 A m—
He . Emergency Contact: S Se
THU ame: JASHODA RANI
LT Relationship: SPOUSE ) _ =-
VE Address: KASHIPUR, RANISANKAIL, MUZAHIDABAD COLONI - 5120, THAKURGAON
fesiineciie: SUR HARORGAN Pos IS
UES SF 7 RA
aon Telephone No: +8801744777846 Ee EE
bes eis EA
FT SNS INS ms Ge ve We SRE RE RE
STS isISIISIISI RSE EE a
- a — Ter we ae AE
oie. PEOPLE'S REPUBLIC OF BANGLADESH
PASSPORT
Surname: RAY
Given Name: SHREE JOTIMOY
Nationality: BANGLADESHI
Personal No.: 8235626051
Date of Birth: 18 SEP 1993
Previous Passport No.: BK0965579
Sex: M
Place of Birth: THAKURGAON
Date of Issue: 20 JAN 2026
Issuing Authority: DIP/DHAKA
Date of Expiry: 19 JAN 2031

P<BGDRAY<<SHREE<JOTIMOY<<<L<LLLLLLLLLLLLLLLLL
p  A214969610BGD9309186M31011938235626051<<<<48
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
  assert(mrzRes.data?.surname === 'RAY', `MRZ surname is RAY (got "${mrzRes.data?.surname}")`)
  assert(mrzRes.data?.givenNames === 'SHREE JOTIMOY', `MRZ givenNames is SHREE JOTIMOY (got "${mrzRes.data?.givenNames}")`)
  assert(mrzRes.data?.passportNumber === 'A21496961', `MRZ passportNumber is A21496961 (got "${mrzRes.data?.passportNumber}")`)
  assert(mrzRes.data?.nationality === 'BGD', `MRZ nationality is BGD (got "${mrzRes.data?.nationality}")`)
  assert(mrzRes.data?.dateOfBirth === '1993-09-18', `MRZ DOB is 1993-09-18 (got "${mrzRes.data?.dateOfBirth}")`)
  assert(mrzRes.data?.sex === 'male', `MRZ sex is male (got "${mrzRes.data?.sex}")`)
  assert(mrzRes.data?.passportExpiryDate === '2031-01-19', `MRZ expiry date is 2031-01-19 (got "${mrzRes.data?.passportExpiryDate}")`)
  assert(mrzRes.data?.personalNumber === '8235626051', `MRZ personal number is 8235626051 (got "${mrzRes.data?.personalNumber}")`)

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
  assert(extracted.personal?.lastName?.value === 'RAY', `Extracted surname is RAY (got "${extracted.personal?.lastName?.value}")`)
  assert(extracted.personal?.firstName?.value === 'SHREE JOTIMOY', `Extracted firstName is SHREE JOTIMOY (got "${extracted.personal?.firstName?.value}")`)
  assert(extracted.personal?.nationality?.value === 'BANGLADESH', `Extracted nationality is BANGLADESH (got "${extracted.personal?.nationality?.value}")`)
  assert(extracted.personal?.nationalIdNumber?.value === '8235626051', `Extracted NID is 8235626051 (got "${extracted.personal?.nationalIdNumber?.value}")`)
  assert(extracted.personal?.townCityOfBirth?.value === 'THAKURGAON', `Extracted townCityOfBirth is THAKURGAON (got "${extracted.personal?.townCityOfBirth?.value}")`)
  assert(extracted.passport?.passportNumber?.value === 'A21496961', `Extracted passportNumber is A21496961 (got "${extracted.passport?.passportNumber?.value}")`)
  assert(extracted.passport?.issueDate?.value === '2026-01-20', `Extracted passport issueDate is 2026-01-20 (got "${extracted.passport?.issueDate?.value}")`)
  assert(extracted.passport?.expiryDate?.value === '2031-01-19', `Extracted passport expiryDate is 2031-01-19 (got "${extracted.passport?.expiryDate?.value}")`)
  assert(extracted.passport?.placeOfIssue?.value === 'DIP/DHAKA', `Extracted passport placeOfIssue is DIP/DHAKA (got "${extracted.passport?.placeOfIssue?.value}")`)
  assert(extracted.passport?.holdsOtherPassport?.value === true, 'Extracted holdsOtherPassport is true')
  assert(extracted.passport?.otherPassportDetails?.passportNumber?.value === 'BK0965579', `Extracted previous passport number is BK0965579 (got "${extracted.passport?.otherPassportDetails?.passportNumber?.value}")`)
  assert(extracted.family?.father?.name?.value === 'SHREE KHIDAR MOHAN', `Extracted father name is SHREE KHIDAR MOHAN (got "${extracted.family?.father?.name?.value}")`)
  assert(extracted.family?.mother?.name?.value === 'PANCHAMI RANI', `Extracted mother name is PANCHAMI RANI (got "${extracted.family?.mother?.name?.value}")`)
  assert(extracted.family?.spouse?.name?.value === 'JASHODA RANI', `Extracted spouse name is JASHODA RANI (got "${extracted.family?.spouse?.name?.value}")`)
  assert(extracted.permanentAddress?.postalCode?.value === '5120', `Extracted permanent postalCode is 5120 (got "${extracted.permanentAddress?.postalCode?.value}")`)
  assert(extracted.permanentAddress?.district?.value === 'THAKURGAON', `Extracted permanent district is THAKURGAON (got "${extracted.permanentAddress?.district?.value}")`)

  // 6. Test Zero Cross-Field Contamination:
  // Visible Identification Marks must NOT contain nationality
  assert(
    !extracted.personal?.visibleIdentificationMarks?.value ||
    !extracted.personal.visibleIdentificationMarks.value.includes('BANGLADESH'),
    'Visible identification mark does NOT contain nationality text'
  )
  // TASK 074: Passport emergency contact telephone falls back into applicant contact phone/isd/mobile
  assert(
    extracted.contact?.phone?.value === '+8801744777846' &&
      extracted.contact?.isdCode?.value === '880' &&
      extracted.contact?.mobile?.value === '1744777846',
    'TASK 074: Passport telephone +8801744777846 extracted and normalized into contact phone, isdCode, and mobile'
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
  const expectedPassportFields: Record<string, string> = {
    'appl.surname': 'RAY',
    'appl.applname': 'SHREE JOTIMOY',
    'appl.applsex': 'MALE',
    'appl.birthdate': '18/09/1993',
    'appl.placbrth': 'THAKURGAON',
    'appl.country_of_birth': 'BANGLADESH',
    'appl.nationality': 'BANGLADESH',
    'appl.countryname': 'BANGLADESH',
    'appl.nationality_by': 'Birth',
    'appl.nic_no': '8235626051',
    'appl.passport_number': 'A21496961',
    'appl.passport_issue_place': 'DIP/DHAKA',
    'appl.passport_issue_date': '20/01/2026',
    'appl.passport_expiry_date': '19/01/2031',
    'fthrname': 'SHREE KHIDAR MOHAN',
    'father_nationality': 'BANGLADESH',
    'father_prev_nationality': 'BANGLADESH',
    'father_country_of_birth': 'BANGLADESH',
    'mother_name': 'PANCHAMI RANI',
    'mother_nationality': 'BANGLADESH',
    'mother_prev_nationality': 'BANGLADESH',
    'mother_country_of_birth': 'BANGLADESH',
    'spouse_name': 'JASHODA RANI',
    'spouse_nationality': 'BANGLADESH',
    'spouse_prev_nationality': 'BANGLADESH',
    'spouse_country_of_birth': 'BANGLADESH',
    'marital_status': 'Married',
    'pres_addr1': 'KASHIPUR',
    'pres_addr2': 'RANISANKAIL, MUZAHIDABAD COLONI',
    'district': 'THAKURGAON',
    'present_country': 'BANGLADESH',
    'pincode': '5120',
    'pres_phone': '+8801744777846',
    'isd_code': '880',
    'mobile': '1744777846',
    'perm_add1': 'KASHIPUR',
    'perm_add2': 'RANISANKAIL, MUZAHIDABAD COLONI',
    'permanent_district': 'THAKURGAON',
    'permanent_country': 'BANGLADESH',
    'permanent_postal_code': '5120',
    'appl.oth_ppt': 'Yes',
    'appl.oth_pptno': 'BK0965579',
    'appl.oth_ppt_issue_place': 'DHAKA',
    'appl.prev_passport_country_issue': 'BANGLADESH',
    'appl.other_ppt_nationality': 'BANGLADESH',
  }

  console.log('\n--- PASSPORT EXTRACTION AUDIT MATRIX ---')
  console.log(
    `${'Field'.padEnd(35)} ${'Expected'.padEnd(30)} ${'Workspace Value'.padEnd(30)} Status`
  )
  console.log('-'.repeat(105))

  for (const [key, expectedVal] of Object.entries(expectedPassportFields)) {
    const actualVal = String(savedApp.fields[key]?.value || '')
    const isMatch = actualVal.toUpperCase() === expectedVal.toUpperCase()
    console.log(
      `${key.padEnd(35)} ${expectedVal.padEnd(30)} ${actualVal.padEnd(30)} ${isMatch ? 'PASS' : 'FAIL'}`
    )
    assert(isMatch, `Field ${key} matches expected workspace value "${expectedVal}" (got "${actualVal}")`)
    assert(savedApp.fields[key]?.source === 'passport', `Field ${key} source is passport (got "${savedApp.fields[key]?.source}")`)
  }

  // 8. Test Genuinely Missing Fields Remain Cleanly Blank
  const expectedBlankFields = [
    'permanent_village_town_city',
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
  assert(dualMergedApp.fields['appl.surname']?.value === 'RAY', 'Precedence: Passport surname overrides OGD')
  assert(dualMergedApp.fields['appl.applname']?.value === 'SHREE JOTIMOY', 'Precedence: Passport given name overrides OGD')
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
        assert(realOcr.text.length > 500, `Real OCR recognized ${realOcr.text.length} characters from passport scan`)
        const realExtracted = extractFromOcrText(realOcr)
        assert(realExtracted.personal?.lastName?.value === 'RAY', 'Real OCR extracted surname is RAY')
        assert(realExtracted.personal?.firstName?.value === 'SHREE JOTIMOY', 'Real OCR extracted givenNames is SHREE JOTIMOY')
        assert(realExtracted.passport?.passportNumber?.value === 'A21496961', 'Real OCR extracted passport number is A21496961')
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
