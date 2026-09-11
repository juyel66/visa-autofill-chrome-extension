import {
  extractFromPdfText,
  extractFromOcrText,
  parseStructuredAddress,
  parseApplicantContact,
} from '../data/applicantDataExtractor'
import { JOSODA_OCR_RAW_TEXT } from './scannedPassportOcr.test'
import { applyExtractionToApplicant } from '../data/extractionMapper'
import type { ExtractedApplicantData } from '../data/types'
import type { ApplicantProfile } from '../../applicant/types'
import {
  WORKSPACE_DEFAULT_VISIBLE_FIELDS,
  WORKSPACE_SECTIONS,
} from '../../application/fieldSchema'
import {
  populateApplicationFromDocuments,
  convertSavedApplicationToApplicantProfile,
} from '../../application/applicationMerger'
import type { SavedApplication } from '../../application/types'
import { BANGLADESH_FAMILY_DETAILS_MAPPINGS } from '../../../countries/india/mappings/bangladesh/familyDetails'
import type { DocumentRecord } from '../../document/types'
import type { OcrResult } from '../ocr/types'

export interface AddressContactExtractionTestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export async function runAddressContactExtractionTests(): Promise<AddressContactExtractionTestResult> {
  const failures: string[] = []
  let totalSubtests = 0

  const assert = (condition: boolean, testName: string, detail?: string) => {
    totalSubtests++
    if (!condition) {
      const msg = `FAIL: [AddressContactExtraction] ${testName}${detail ? ` - ${detail}` : ''}`
      console.error(msg)
      failures.push(msg)
    }
  }

  // =========================================================================
  // Test Case A: Single-Line Address Extraction (Real Passport OCR Format)
  // =========================================================================
  const passportSingleLineText = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT NO: A12345678
    Surname: ROY
    Given Name: JOSODA
    Present Address: VILL: KACHUBARI, PO: RUHEA, THAKURGAON - 5120
    Country: BANGLADESH
  `
  const extractedA = extractFromPdfText(passportSingleLineText)
  assert(
    extractedA.presentAddress?.addressLine1?.value === 'VILL: KACHUBARI',
    'Test Case A: Address Line 1 extracted from single-line OCR',
    `got: ${extractedA.presentAddress?.addressLine1?.value}`
  )
  assert(
    extractedA.presentAddress?.addressLine2?.value === 'PO: RUHEA',
    'Test Case A: Address Line 2 extracted from single-line OCR',
    `got: ${extractedA.presentAddress?.addressLine2?.value}`
  )
  assert(
    extractedA.presentAddress?.villageTownCity?.value === 'VILL: KACHUBARI',
    'Test Case A: Village/Town/City extracted from single-line OCR',
    `got: ${extractedA.presentAddress?.villageTownCity?.value}`
  )
  assert(
    extractedA.presentAddress?.district?.value === 'THAKURGAON',
    'Test Case A: District extracted dynamically from single-line OCR',
    `got: ${extractedA.presentAddress?.district?.value}`
  )
  assert(
    extractedA.presentAddress?.stateProvince?.value === undefined || extractedA.presentAddress?.stateProvince?.value === '',
    'Test Case A: State/Province is not blindly copied from District',
    `got: ${extractedA.presentAddress?.stateProvince?.value}`
  )
  assert(
    extractedA.presentAddress?.postalCode?.value === '5120',
    'Test Case A: Postal code extracted from single-line OCR',
    `got: ${extractedA.presentAddress?.postalCode?.value}`
  )
  assert(
    extractedA.presentAddress?.country?.value === 'BANGLADESH',
    'Test Case A: Country extracted from single-line OCR',
    `got: ${extractedA.presentAddress?.country?.value}`
  )

  // =========================================================================
  // Test Case B: Multi-Line Address Extraction (Old Visa Application / OGD Format)
  // =========================================================================
  const ogdMultiLineText = `
    INDIAN VISA APPLICATION
    ONLINE VISA APPLICATION
    GOVERNMENT OF INDIA
    WEB FILE NO: BGD123456789
    PERSONAL PARTICULARS
    Surname: AHMED
    Given Name: KHOKON
    Sex: MALE
    Date of Birth: 15/05/1995
    Place of Birth: DHAKA
    Country of Birth: BANGLADESH
    Citizenship / National Id No: 1995123456789
    Current Nationality: BANGLADESHI
    PASSPORT DETAILS
    Passport Number: A1234567
    Place of Issue: DHAKA
    Date of Issue: 27/01/2021
    Date of Expiry: 26/01/2031
    Present Address:
    House 12, Road 5
    Dhanmondi
    Dhaka
    Phone No: 029876543
    Mobile No: +8801712345678
    Email: khokon@example.com
    Permanent Address:
    Village Baroipara
    P.O. Ghorashal
    Narsingdi
    PROFESSION / OCCUPATION
    Present Occupation: BUSINESS
    Employer Name: ABC TRADERS
    Employer Address: DHAKA
    DETAILS OF VISA SOUGHT
    Type of Visa: TOURIST
    Duration of Visa: 12 MONTHS
    No of Entries: MULTIPLE
    Expected Date of Journey: 15/10/2026
    Port of Arrival: HARIDASPUR
    Port of Exit: HARIDASPUR
    PREVIOUS VISA DETAILS
    Have you ever visited India: NO
    REFERENCE DETAILS
    Reference in India:
    HOTEL TAJ
    PARK STREET, KOLKATA
    Phone: 9876543210
    Reference in Bangladesh:
    MD KASHEM
    HOUSE 1, DHAKA
    Phone: 01700000000
  `
  const extractedB = extractFromPdfText(ogdMultiLineText)
  assert(
    extractedB.presentAddress?.addressLine1?.value === 'House 12, Road 5',
    'Test Case B: OGD Multi-line Address Line 1 extracted',
    `got: ${extractedB.presentAddress?.addressLine1?.value}`
  )
  assert(
    extractedB.presentAddress?.addressLine2?.value === 'Dhanmondi',
    'Test Case B: OGD Multi-line Address Line 2 extracted',
    `got: ${extractedB.presentAddress?.addressLine2?.value}`
  )
  assert(
    extractedB.presentAddress?.villageTownCity?.value === 'Dhaka',
    'Test Case B: OGD Multi-line Village/Town/City extracted',
    `got: ${extractedB.presentAddress?.villageTownCity?.value}`
  )
  assert(
    extractedB.presentAddress?.district?.value === 'Dhaka',
    'Test Case B: OGD Multi-line District extracted',
    `got: ${extractedB.presentAddress?.district?.value}`
  )
  assert(
    extractedB.presentAddress?.stateProvince?.value === undefined || extractedB.presentAddress?.stateProvince?.value === '',
    'Test Case B: OGD Multi-line State/Province not copied from District',
    `got: ${extractedB.presentAddress?.stateProvince?.value}`
  )
  assert(
    extractedB.permanentAddress?.addressLine1?.value === 'Village Baroipara',
    'Test Case B: OGD Permanent Address Line 1 extracted',
    `got: ${extractedB.permanentAddress?.addressLine1?.value}`
  )
  assert(
    extractedB.permanentAddress?.addressLine2?.value === 'P.O. Ghorashal',
    'Test Case B: OGD Permanent Address Line 2 extracted',
    `got: ${extractedB.permanentAddress?.addressLine2?.value}`
  )
  assert(
    extractedB.permanentAddress?.district?.value === 'Narsingdi',
    'Test Case B: OGD Permanent District extracted',
    `got: ${extractedB.permanentAddress?.district?.value}`
  )

  // =========================================================================
  // Test Case C: ISD Code Extraction & Separation
  // =========================================================================
  const textWithIsd = `
    Present Address: House 1, Road 2, Gulshan, Dhaka
    Mobile No: +8801712345678
    Phone No: 029876543
    Email: test@example.com
  `
  const contactWithIsd = parseApplicantContact(textWithIsd)
  assert(
    contactWithIsd.isdCode === '880',
    'Test Case C: ISD Code 880 separated from +880 mobile number',
    `got: ${contactWithIsd.isdCode}`
  )
  assert(
    Boolean(contactWithIsd.mobile?.includes('1712345678')),
    'Test Case C: Applicant mobile number preserved',
    `got: ${contactWithIsd.mobile}`
  )

  const textWithoutIsd = `
    Present Address: House 1, Road 2, Gulshan, Dhaka
    Mobile No: 01712345678
    Email: test@example.com
  `
  const contactWithoutIsd = parseApplicantContact(textWithoutIsd)
  assert(
    contactWithoutIsd.isdCode === undefined,
    'Test Case C: ISD Code remains undefined for domestic number without international prefix',
    `got: ${contactWithoutIsd.isdCode}`
  )
  assert(
    contactWithoutIsd.mobile === '01712345678',
    'Test Case C: Domestic mobile number captured cleanly',
    `got: ${contactWithoutIsd.mobile}`
  )

  // =========================================================================
  // Test Case D: Contact Details Isolation & Exclusions
  // =========================================================================
  const documentWithVariousContacts = `
    Present Address:
    House 10, Road 4, Sector 3, Uttara, Dhaka
    Phone No: 0255554444
    Mobile No: 01711223344
    Email ID: applicant@domain.com

    Emergency Contact:
    Name: MD RASHED
    Relationship: BROTHER
    Mobile No: 01999999999

    Employer Details:
    Company: TECH CORP
    Phone No: 0288888888

    Hotel in India:
    Hotel Name: GRAND PALACE
    Hotel Phone: +919876543210
  `
  const isolatedContact = parseApplicantContact(documentWithVariousContacts)
  assert(
    isolatedContact.mobile === '01711223344',
    'Test Case D: Applicant mobile strictly isolated from emergency/employer/hotel numbers',
    `got: ${isolatedContact.mobile}`
  )
  assert(
    isolatedContact.phone === '0255554444',
    'Test Case D: Applicant landline phone strictly isolated',
    `got: ${isolatedContact.phone}`
  )
  assert(
    isolatedContact.email === 'applicant@domain.com',
    'Test Case D: Applicant email extracted',
    `got: ${isolatedContact.email}`
  )

  // =========================================================================
  // Test Case E: Document Isolation (Permanent Only -> Present Blank)
  // =========================================================================
  const permanentOnlyDoc = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT NO: B99887766
    Surname: BEGUM
    Given Name: FATEMA
    Date of Birth: 12 OCT 1988
    Permanent Address: Vill: Shampur, Post: Pirganj, Rangpur
    Country: BANGLADESH
  `
  const extractedE = extractFromPdfText(permanentOnlyDoc)
  assert(
    Boolean(extractedE.permanentAddress?.addressLine1?.value),
    'Test Case E: Permanent address successfully extracted',
    `got: ${extractedE.permanentAddress?.addressLine1?.value}`
  )
  assert(
    extractedE.presentAddress === undefined || Object.keys(extractedE.presentAddress).length === 0,
    'Test Case E: Present address remains blank when absent from document (No automatic mirroring)',
    `got: ${JSON.stringify(extractedE.presentAddress)}`
  )

  // =========================================================================
  // Test Case F: Workspace Field Schema & Merger Integrity
  // =========================================================================
  // 1. Verify visible fields in Section 3 and Section 4
  const sec3 = WORKSPACE_SECTIONS.find((s) => s.id === 'presentAddress')
  const sec4 = WORKSPACE_SECTIONS.find((s) => s.id === 'permanentAddress')

  assert(
    Boolean(sec3),
    'Test Case F: Section 3 Present Address card exists in WORKSPACE_SECTIONS'
  )
  assert(
    Boolean(sec4),
    'Test Case F: Section 4 Permanent Address card exists in WORKSPACE_SECTIONS'
  )

  const expectedSec3Fields = [
    'pres_addr1',
    'pres_addr2',
    'village_town_city',
    'district',
    'state_province',
    'present_country',
    'pincode',
    'pres_phone',
    'isd_code',
    'mobile',
    'appl.email',
  ]
  for (const f of expectedSec3Fields) {
    assert(
      Boolean(sec3?.fieldKeys.includes(f) && WORKSPACE_DEFAULT_VISIBLE_FIELDS.includes(f)),
      `Test Case F: Section 3 field ${f} is registered and visible by default`
    )
  }

  const expectedSec4Fields = [
    'perm_add1',
    'perm_add2',
    'permanent_village_town_city',
    'permanent_district',
    'permanent_state_province',
    'permanent_country',
    'permanent_postal_code',
  ]
  for (const f of expectedSec4Fields) {
    assert(
      Boolean(sec4?.fieldKeys.includes(f) && WORKSPACE_DEFAULT_VISIBLE_FIELDS.includes(f)),
      `Test Case F: Section 4 field ${f} is registered and visible by default`
    )
  }

  // 2. Verify bd_family_pres_add3 mapping rule
  const presAdd3Mapping = BANGLADESH_FAMILY_DETAILS_MAPPINGS.find(
    (m) => m.id === 'bd_family_pres_add3'
  )
  assert(
    presAdd3Mapping?.sourceField === 'presentAddress.stateProvince',
    'Test Case F: bd_family_pres_add3 strictly maps to presentAddress.stateProvince (never villageTownCity)',
    `got: ${presAdd3Mapping?.sourceField}`
  )

  // 3. Verify SavedApplication -> ApplicantProfile conversion with structured fields
  const mockDoc: DocumentRecord = {
    documentId: 'doc_struct_001',
    applicantId: 'TEST_STRUCT_001',
    documentType: 'passport',
    fileName: 'Passport.pdf',
    fileSize: 120000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: {
      personal: {
        lastName: { value: 'ISLAM', source: 'pdf-text', confidence: 0.95 },
        firstName: { value: 'TARIQUL', source: 'pdf-text', confidence: 0.95 },
        dateOfBirth: { value: '1992-08-20', source: 'pdf-text', confidence: 0.95 },
        nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.95 },
      },
      passport: {
        passportNumber: { value: 'EG1234567', source: 'pdf-text', confidence: 0.95 },
      },
      presentAddress: {
        addressLine1: { value: 'House 5, Road 12', source: 'pdf-text', confidence: 0.9 },
        addressLine2: { value: 'Banani', source: 'pdf-text', confidence: 0.9 },
        villageTownCity: { value: 'Dhaka', source: 'pdf-text', confidence: 0.9 },
        district: { value: 'Dhaka', source: 'pdf-text', confidence: 0.9 },
        stateProvince: { value: 'Dhaka', source: 'pdf-text', confidence: 0.9 },
        country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.95 },
        postalCode: { value: '1213', source: 'pdf-text', confidence: 0.9 },
        phone: { value: '0288881111', source: 'pdf-text', confidence: 0.9 },
        isdCode: { value: '880', source: 'pdf-text', confidence: 0.9 },
        mobile: { value: '01700112233', source: 'pdf-text', confidence: 0.9 },
      },
      contact: {
        email: { value: 'tariqul@test.com', source: 'pdf-text', confidence: 0.95 },
        isdCode: { value: '880', source: 'pdf-text', confidence: 0.9 },
        mobile: { value: '01700112233', source: 'pdf-text', confidence: 0.9 },
      },
    },
    extractedDataConfirmed: true,
  }

  const app = populateApplicationFromDocuments({
    applicantId: 'TEST_STRUCT_001',
    passportDoc: mockDoc,
    ogdDoc: null,
    existingApp: null,
  })

  const profile = convertSavedApplicationToApplicantProfile(app)
  assert(
    profile.presentAddress?.addressLine1 === 'House 5, Road 12' &&
      profile.presentAddress?.addressLine2 === 'Banani' &&
      profile.presentAddress?.villageTownCity === 'Dhaka' &&
      profile.presentAddress?.district === 'Dhaka' &&
      profile.presentAddress?.stateProvince === 'Dhaka' &&
      profile.presentAddress?.postalCode === '1213' &&
      profile.presentAddress?.isdCode === '880' &&
      profile.presentAddress?.mobile === '01700112233' &&
      profile.presentAddress?.phone === '0288881111',
    'Test Case F: convertSavedApplicationToApplicantProfile converts all structured address and contact fields cleanly'
  )

  // =========================================================================
  // Dynamic Multi-District Verification (No Hardcoding)
  // =========================================================================
  const districts = [
    { text: 'VILL: GULSHAN-2, PO: GULSHAN, DHAKA', expectedDist: 'DHAKA', expectedVill: 'VILL: GULSHAN-2' },
    { text: 'VILL: CHANDGAON, PO: CHANDGAON, CHITTAGONG', expectedDist: 'CHITTAGONG', expectedVill: 'VILL: CHANDGAON' },
    { text: 'VILL: AMBARKHANA, PO: SYLHET, SYLHET', expectedDist: 'SYLHET', expectedVill: 'VILL: AMBARKHANA' },
    { text: 'VILL: MOTIHAR, PO: RAJSHAHI UNIVERSITY, RAJSHAHI', expectedDist: 'RAJSHAHI', expectedVill: 'VILL: MOTIHAR' },
    { text: 'VILL: KHALISHPUR, PO: KHALISHPUR, KHULNA', expectedDist: 'KHULNA', expectedVill: 'VILL: KHALISHPUR' },
    { text: 'VILL: SADAR, PO: BARISAL, BARISAL', expectedDist: 'BARISAL', expectedVill: 'VILL: SADAR' },
  ]

  for (const d of districts) {
    const parsed = parseStructuredAddress(d.text)
    assert(
      parsed.district === d.expectedDist,
      `Dynamic District Test: District dynamically resolved for ${d.expectedDist}`,
      `got: ${parsed.district}`
    )
    assert(
      parsed.stateProvince === undefined || parsed.stateProvince === '',
      `Dynamic District Test: StateProvince is not blindly copied for ${d.expectedDist}`,
      `got: ${parsed.stateProvince}`
    )
    assert(
      parsed.villageTownCity === d.expectedVill,
      `Dynamic District Test: Village resolved for ${d.expectedDist}`,
      `got: ${parsed.villageTownCity}`
    )
  }

  // =========================================================================
  // Test Case G: TASK 072 Addendum — Explicit 10-Scenario Contact Autofill & Isolation
  // =========================================================================

  // 1. Applicant Phone explicitly present -> Phone Number automatically populated
  const doc1 = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT NO: A11111111
    Surname: RAHMAN
    Given Name: ARIFUL
    Phone: +880174477846
  `
  const contact1 = parseApplicantContact(doc1)
  assert(
    contact1.phone === '+880174477846',
    'Req 1: Applicant Phone +880174477846 automatically populated',
    `got: ${contact1.phone}`
  )

  // 2. Applicant Mobile explicitly present -> Mobile Number automatically populated
  const doc2a = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    Mobile: 0174477846
  `
  const contact2a = parseApplicantContact(doc2a)
  assert(
    contact2a.mobile === '0174477846',
    'Req 2a: Applicant Mobile 0174477846 automatically populated',
    `got: ${contact2a.mobile}`
  )

  const doc2b = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    Mobile: 01712345678
  `
  const contact2b = parseApplicantContact(doc2b)
  assert(
    contact2b.mobile === '01712345678',
    'Req 2b: Applicant Mobile 01712345678 automatically populated',
    `got: ${contact2b.mobile}`
  )

  // 3. Applicant mobile in +880 format -> ISD + Mobile correctly separated
  const doc3a = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    Mobile: +8801712345678
  `
  const contact3a = parseApplicantContact(doc3a)
  assert(
    contact3a.isdCode === '880' && contact3a.mobile === '1712345678',
    'Req 3a: +8801712345678 separated into ISD=880 and Mobile=1712345678',
    `got: isd=${contact3a.isdCode}, mobile=${contact3a.mobile}`
  )

  const doc3b = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    Mobile: 8801712345678
  `
  const contact3b = parseApplicantContact(doc3b)
  assert(
    contact3b.isdCode === '880' && contact3b.mobile === '1712345678',
    'Req 3b: 8801712345678 separated into ISD=880 and Mobile=1712345678',
    `got: isd=${contact3b.isdCode}, mobile=${contact3b.mobile}`
  )

  // 4. Applicant Email explicitly present -> Email ID automatically populated
  const doc4 = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    Email: applicant@example.com
  `
  const contact4 = parseApplicantContact(doc4)
  assert(
    contact4.email === 'applicant@example.com',
    'Req 4: Email applicant@example.com automatically populated',
    `got: ${contact4.email}`
  )

  // 5. Employer phone only -> Applicant Phone remains blank
  const doc5 = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    Surname: HASAN
    Given Name: MAHMUD
    Employer Details:
    Company Name: ABC TRADING
    Employer Phone: +8801711223344
    Phone: +8801711223344
  `
  const contact5 = parseApplicantContact(doc5)
  assert(
    !contact5.phone && !contact5.mobile,
    'Req 5: Employer phone only leaves applicant phone/mobile blank',
    `got: phone=${contact5.phone}, mobile=${contact5.mobile}`
  )

  // 6. Passport emergency contact telephone -> Applicant Phone fallback
  const doc6 = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT NO: A06941198
    Surname: HOSSAIN
    Given Name: MOHAMMAD ARIF
    Emergency Contact:
    Name: JANNATUL FERDOUS
    Relationship: SPOUSE
    Address: HOUSE 12, ROAD 5, BLOCK B, MIRPUR - 1216, DHAKA
    Telephone No: +880174477846
  `
  const contact6 = parseApplicantContact(doc6)
  assert(
    contact6.phone === '+880174477846' && contact6.isdCode === '880' && contact6.mobile === '174477846',
    'Req 6: Real Passport emergency contact telephone falls back into applicant contact fields',
    `got: phone=${contact6.phone}, isd=${contact6.isdCode}, mobile=${contact6.mobile}`
  )

  // 7. Sponsor email only -> Applicant Email remains blank
  const doc7 = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    Surname: KARIM
    Given Name: REZAUL
    Sponsor in India:
    Name: TAJ HOTEL
    Sponsor Email: info@tajhotel.com
  `
  const contact7 = parseApplicantContact(doc7)
  assert(
    !contact7.email,
    'Req 7: Sponsor email leaves applicant email blank',
    `got: ${contact7.email}`
  )

  // 8. Permanent Address fallback + applicant mobile/email -> Address and contact both appear automatically
  const doc8Record: DocumentRecord = {
    documentId: 'doc_req8',
    applicantId: 'APPL_REQ8',
    documentType: 'passport',
    fileName: 'Passport.pdf',
    fileSize: 100000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: {
      personal: {
        lastName: { value: 'ISLAM', source: 'pdf-text', confidence: 0.95 },
        firstName: { value: 'SAIFUL', source: 'pdf-text', confidence: 0.95 },
        nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.95 },
      },
      permanentAddress: {
        addressLine1: { value: 'HOUSE 12, ROAD 5', source: 'pdf-text', confidence: 0.9 },
        district: { value: 'DHAKA', source: 'pdf-text', confidence: 0.9 },
        country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.95 },
        postalCode: { value: '1216', source: 'pdf-text', confidence: 0.9 },
      },
      contact: {
        mobile: { value: '1712345678', source: 'pdf-text', confidence: 0.9 },
        isdCode: { value: '880', source: 'pdf-text', confidence: 0.9 },
        email: { value: 'saiful@example.com', source: 'pdf-text', confidence: 0.95 },
      },
    },
  }
  const app8 = populateApplicationFromDocuments({
    applicantId: 'APPL_REQ8',
    passportDoc: doc8Record,
    ogdDoc: null,
    existingApp: null,
  })
  assert(
    app8.fields['mobile']?.value === '1712345678' &&
      app8.fields['isd_code']?.value === '880' &&
      app8.fields['appl.email']?.value === 'saiful@example.com' &&
      app8.fields['appl.email_re']?.value === 'saiful@example.com' &&
      app8.fields['perm_add1']?.value === 'HOUSE 12, ROAD 5',
    'Req 8: Permanent Address + contact mobile/email both populate automatically in SavedApplication',
    `got mobile: ${app8.fields['mobile']?.value}, email: ${app8.fields['appl.email']?.value}`
  )

  // 9. User manually edits Phone/Mobile/Email -> manual values survive Save/Re-sync
  const existingAppWithEdits = {
    ...app8,
    fields: {
      ...app8.fields,
      pres_phone: { value: '028889999', source: 'manual' as const, isUserEdited: true },
      mobile: { value: '1899999999', source: 'manual' as const, isUserEdited: true },
      isd_code: { value: '880', source: 'manual' as const, isUserEdited: true },
      'appl.email': { value: 'custom@edited.com', source: 'manual' as const, isUserEdited: true },
    },
    manualEdits: {
      ...app8.manualEdits,
      pres_phone: true,
      mobile: true,
      isd_code: true,
      'appl.email': true,
    },
  }
  const resyncedApp = populateApplicationFromDocuments({
    applicantId: 'APPL_REQ8',
    passportDoc: doc8Record,
    ogdDoc: null,
    existingApp: existingAppWithEdits,
  })
  assert(
    resyncedApp.fields['pres_phone']?.value === '028889999' &&
      resyncedApp.fields['mobile']?.value === '1899999999' &&
      resyncedApp.fields['appl.email']?.value === 'custom@edited.com' &&
      resyncedApp.fields['mobile']?.isUserEdited === true,
    'Req 9: Manual edits on phone, mobile, and email survive document re-sync',
    `got pres_phone: ${resyncedApp.fields['pres_phone']?.value}, mobile: ${resyncedApp.fields['mobile']?.value}, email: ${resyncedApp.fields['appl.email']?.value}`
  )

  // 10. Different applicant -> previous applicant's contact information must never appear
  const diffApplicantOgd: DocumentRecord = {
    documentId: 'doc_diff_ogd',
    applicantId: 'APPL_DIFF',
    documentType: 'ogd',
    fileName: 'OldVisa.pdf',
    fileSize: 80000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: {
      personal: {
        lastName: { value: 'KHAN', source: 'pdf-text', confidence: 0.95 },
        firstName: { value: 'AKBAR', source: 'pdf-text', confidence: 0.95 },
      },
      passport: {
        passportNumber: { value: 'XX9999999', source: 'pdf-text', confidence: 0.95 },
      },
      contact: {
        mobile: { value: '1999999999', source: 'pdf-text', confidence: 0.9 },
        email: { value: 'akbar.khan@example.com', source: 'pdf-text', confidence: 0.9 },
      },
    },
  }
  const appDifferent = populateApplicationFromDocuments({
    applicantId: 'APPL_REQ8',
    passportDoc: doc8Record,
    ogdDoc: diffApplicantOgd,
    existingApp: null,
  })
  assert(
    appDifferent.fields['mobile']?.value === '1712345678' &&
      appDifferent.fields['appl.email']?.value === 'saiful@example.com',
    'Req 10: Different applicant contact information does not leak into target applicant profile',
    `got mobile: ${appDifferent.fields['mobile']?.value}, email: ${appDifferent.fields['appl.email']?.value}`
  )

  // =========================================================================
  // Test Case H: TASK 073 Final — Real Passport -> Workspace Data Pipeline
  // =========================================================================

  // 1. Permanent-only document: permanentAddress exists, presentAddress empty
  // -> presentAddress becomes exact deep clone in ApplicantProfile & SavedApplication
  const permOnlyDocData: ExtractedApplicantData = {
    personal: {
      lastName: { value: 'HOSSAIN', source: 'pdf-text', confidence: 0.95 },
      firstName: { value: 'MOHAMMAD ARIF', source: 'pdf-text', confidence: 0.95 },
      nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.95 },
    },
    permanentAddress: {
      addressLine1: { value: 'HOUSE 12, ROAD 5', source: 'pdf-text', confidence: 0.9 },
      addressLine2: { value: 'BLOCK B, MIRPUR', source: 'pdf-text', confidence: 0.9 },
      district: { value: 'DHAKA', source: 'pdf-text', confidence: 0.9 },
      country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.95 },
      postalCode: { value: '1216', source: 'pdf-text', confidence: 0.9 },
    },
  }

  const baseProfH: ApplicantProfile = {
    applicantId: 'APPL_H001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const profH = applyExtractionToApplicant(baseProfH, permOnlyDocData)
  assert(
    profH.presentAddress?.addressLine1 === 'HOUSE 12, ROAD 5' &&
      profH.presentAddress?.addressLine2 === 'BLOCK B, MIRPUR' &&
      profH.presentAddress?.district === 'DHAKA' &&
      profH.presentAddress?.country === 'BANGLADESH' &&
      profH.presentAddress?.postalCode === '1216',
    'TASK 073 Req 1: ApplicantProfile presentAddress is an exact deep clone of permanentAddress when present address is empty'
  )

  const docHRecord: DocumentRecord = {
    documentId: 'doc_h001',
    applicantId: 'APPL_H001',
    documentType: 'passport',
    fileName: 'Passport.pdf',
    fileSize: 100000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: permOnlyDocData,
  }
  const appH = populateApplicationFromDocuments({
    applicantId: 'APPL_H001',
    passportDoc: docHRecord,
  })
  assert(
    appH.fields['pres_addr1']?.value === 'HOUSE 12, ROAD 5' &&
      appH.fields['pres_addr2']?.value === 'BLOCK B, MIRPUR' &&
      appH.fields['district']?.value === 'DHAKA' &&
      appH.fields['present_country']?.value === 'BANGLADESH' &&
      appH.fields['pincode']?.value === '1216',
    'TASK 073 Req 1: SavedApplication Present Address fields are populated automatically via fallback'
  )

  // 2. Explicit Present + Permanent: explicit Present Address wins
  const dualAddressDocData: ExtractedApplicantData = {
    personal: {
      lastName: { value: 'HOSSAIN', source: 'pdf-text', confidence: 0.95 },
      firstName: { value: 'MOHAMMAD ARIF', source: 'pdf-text', confidence: 0.95 },
      nationality: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.95 },
    },
    presentAddress: {
      addressLine1: { value: 'HOUSE 10, ROAD 4', source: 'pdf-text', confidence: 0.9 },
      addressLine2: { value: 'BANANI', source: 'pdf-text', confidence: 0.9 },
      district: { value: 'DHAKA', source: 'pdf-text', confidence: 0.9 },
      country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.95 },
      postalCode: { value: '1213', source: 'pdf-text', confidence: 0.9 },
    },
    permanentAddress: {
      addressLine1: { value: 'HOUSE 12, ROAD 5', source: 'pdf-text', confidence: 0.9 },
      addressLine2: { value: 'BLOCK B, MIRPUR', source: 'pdf-text', confidence: 0.9 },
      district: { value: 'DHAKA', source: 'pdf-text', confidence: 0.9 },
      country: { value: 'BANGLADESH', source: 'pdf-text', confidence: 0.95 },
      postalCode: { value: '1216', source: 'pdf-text', confidence: 0.9 },
    },
  }
  const profDual = applyExtractionToApplicant(baseProfH, dualAddressDocData)
  assert(
    profDual.presentAddress?.addressLine1 === 'HOUSE 10, ROAD 4' &&
      profDual.presentAddress?.district === 'DHAKA',
    'TASK 073 Req 2: Explicit Present Address wins over Permanent Address'
  )

  // 3. Manual Present edit survives save/reload/re-sync
  const appHManual = {
    ...appH,
    fields: {
      ...appH.fields,
      pres_addr1: { value: 'CUSTOM EDITED PRESENT ADDR 1', source: 'manual' as const, isUserEdited: true },
      district: { value: 'SYLHET', source: 'manual' as const, isUserEdited: true },
    },
    manualEdits: {
      ...appH.manualEdits,
      pres_addr1: true,
      district: true,
    },
  }
  const resyncedAppH = populateApplicationFromDocuments({
    applicantId: 'APPL_H001',
    passportDoc: docHRecord,
    existingApp: appHManual,
  })
  assert(
    resyncedAppH.fields['pres_addr1']?.value === 'CUSTOM EDITED PRESENT ADDR 1' &&
      resyncedAppH.fields['district']?.value === 'SYLHET' &&
      resyncedAppH.fields['pres_addr1']?.isUserEdited === true,
    'TASK 073 Req 3: Manual Present edits survive save/reload/re-sync'
  )

  // 4. Every structured address field survives fallback independently
  const singleFieldPermDoc: ExtractedApplicantData = {
    personal: {
      lastName: { value: 'ALAM', source: 'pdf-text', confidence: 0.95 },
    },
    permanentAddress: {
      addressLine1: { value: 'SOLITARY LINE 1', source: 'pdf-text', confidence: 0.9 },
    },
  }
  const profSingle = applyExtractionToApplicant(baseProfH, singleFieldPermDoc)
  assert(
    profSingle.presentAddress?.addressLine1 === 'SOLITARY LINE 1' &&
      profSingle.presentAddress?.addressLine2 === undefined &&
      profSingle.presentAddress?.district === undefined,
    'TASK 073 Req 4: Structured fields survive fallback independently without dummy data'
  )

  // 5. Attached real passport extraction: Permanent Address parses into structured fields
  const attachedPassportText = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT NO: A21496961
    Surname: HOSSAIN
    Given Name: MOHAMMAD ARIF
    Nationality: BANGLADESHI
    Date of Birth: 18 SEP 1993
    Place of Birth: DHAKA
    Permanent Address: HOUSE 12, ROAD 5, BLOCK B - 1216, DHAKA
    Emergency Contact:
    Name: JANNATUL FERDOUS
    Relationship: SPOUSE
    Telephone No: +8801744777846
  `
  const extractedAttached = extractFromPdfText(attachedPassportText)
  assert(
    extractedAttached.permanentAddress?.addressLine1?.value === 'HOUSE 12' &&
      extractedAttached.permanentAddress?.addressLine2?.value === 'ROAD 5, BLOCK B' &&
      extractedAttached.permanentAddress?.district?.value === 'DHAKA' &&
      extractedAttached.permanentAddress?.postalCode?.value === '1216',
    'TASK 073 Req 5: Attached passport parses into clean structured Permanent Address fields'
  )

  // 6 & 7. Emergency contact isolation & Telephone fallback: JANNATUL FERDOUS never applicant name, telephone falls back to contact
  assert(
    extractedAttached.personal?.lastName?.value === 'HOSSAIN' &&
      extractedAttached.personal?.firstName?.value === 'MOHAMMAD ARIF' &&
      extractedAttached.family?.spouse?.name?.value === 'JANNATUL FERDOUS',
    'TASK 073/074 Req 6: JANNATUL FERDOUS is spouse name, never applicant name'
  )
  const contactAttached = parseApplicantContact(attachedPassportText)
  assert(
    contactAttached.phone === '+8801744777846' &&
      contactAttached.isdCode === '880' &&
      contactAttached.mobile === '1744777846',
    'TASK 074 Req 1 & 2: Emergency contact telephone +8801744777846 normalized into phone, isdCode=880, and mobile=1744777846'
  )

  // 8. Cross-applicant isolation: One applicant's address/contact never leaks into another
  const otherApplicantDoc: DocumentRecord = {
    documentId: 'doc_other_person',
    applicantId: 'APPL_OTHER',
    documentType: 'ogd',
    fileName: 'Other.pdf',
    fileSize: 50000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: {
      personal: {
        lastName: { value: 'CHOWDHURY', source: 'pdf-text', confidence: 0.95 },
        firstName: { value: 'MAHIN', source: 'pdf-text', confidence: 0.95 },
      },
      passport: {
        passportNumber: { value: 'B00000000', source: 'pdf-text', confidence: 0.95 },
      },
      permanentAddress: {
        addressLine1: { value: 'OTHER VILLAGE', source: 'pdf-text', confidence: 0.9 },
        district: { value: 'CHITTAGONG', source: 'pdf-text', confidence: 0.9 },
      },
      contact: {
        mobile: { value: '1888888888', source: 'pdf-text', confidence: 0.9 },
        email: { value: 'other@example.com', source: 'pdf-text', confidence: 0.9 },
      },
    },
  }
  const appIsolated = populateApplicationFromDocuments({
    applicantId: 'APPL_H001',
    passportDoc: docHRecord,
    ogdDoc: otherApplicantDoc,
    existingApp: null,
  })
  assert(
    appIsolated.fields['pres_addr1']?.value === 'HOUSE 12, ROAD 5' &&
      appIsolated.fields['district']?.value === 'DHAKA' &&
      appIsolated.fields['mobile']?.value !== '1888888888' &&
      appIsolated.fields['appl.email']?.value !== 'other@example.com',
    'TASK 073 Req 8: Cross-applicant document does not contaminate target applicant address/contact'
  )

  // 9 & 10. SavedApplication persistence: extraction -> merge -> save -> reload preserves Present Address
  const profileHydrated = convertSavedApplicationToApplicantProfile(appH)
  assert(
    profileHydrated.presentAddress?.addressLine1 === 'HOUSE 12, ROAD 5' &&
      profileHydrated.presentAddress?.addressLine2 === 'BLOCK B, MIRPUR' &&
      profileHydrated.presentAddress?.district === 'DHAKA' &&
      profileHydrated.presentAddress?.postalCode === '1216',
    'TASK 073 Req 9 & 10: SavedApplication persistence & Workspace hydration cleanly preserves fallback Present Address'
  )

  // 11. Re-sync: valid Present Address is never erased by re-syncing
  const resyncedAppH2 = populateApplicationFromDocuments({
    applicantId: 'APPL_H001',
    passportDoc: docHRecord,
    existingApp: appH,
  })
  assert(
    resyncedAppH2.fields['pres_addr1']?.value === 'HOUSE 12, ROAD 5' &&
      resyncedAppH2.fields['district']?.value === 'DHAKA' &&
      resyncedAppH2.fields['pincode']?.value === '1216',
    'TASK 073 Req 11: Re-syncing preserves populated fallback Present Address'
  )

  // 12. No applicant-specific hardcoded fallback constants remain in extractor
  const textWithoutEmergencyContact = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT NO: A21496961
    Surname: RAHMAN
    Given Name: KHALID
    Emergency Contact:
    Relationship: FRIEND
  `
  const extNoEmergName = extractFromPdfText(textWithoutEmergencyContact)
  assert(
    extNoEmergName.family?.spouse?.name?.value === undefined,
    'TASK 073 Req 12: No applicant-specific hardcoded spouse/emergency constants exist'
  )

  // =========================================================================
  // Test Case I: TASK 074 — Force Passport Telephone into Present Phone Fallback
  // =========================================================================

  // 1. Passport containing Telephone No: +8801744777846 produces phone, ISD, mobile
  const task074Text = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT NO: A21496961
    Surname: HOSSAIN
    Given Name: MOHAMMAD ARIF
    Permanent Address: HOUSE 12, ROAD 5, BLOCK B - 1216, DHAKA
    Emergency Contact:
    Name: JANNATUL FERDOUS
    Relationship: SPOUSE
    Telephone No: +8801744777846
  `
  const ext074 = extractFromPdfText(task074Text)
  assert(
    ext074.contact?.phone?.value === '+8801744777846' &&
      ext074.contact?.isdCode?.value === '880' &&
      ext074.contact?.mobile?.value === '1744777846',
    'TASK 074 Req 1: Extractor normalizes +8801744777846 to phone=+8801744777846, ISD=880, mobile=1744777846'
  )

  // 2. SavedApplication population from passport telephone
  const doc074Record: DocumentRecord = {
    documentId: 'doc_task074_001',
    applicantId: 'APPL_TASK074',
    documentType: 'passport',
    fileName: 'Josoda passport.pdf',
    fileSize: 100000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: ext074,
  }
  const app074 = populateApplicationFromDocuments({
    applicantId: 'APPL_TASK074',
    passportDoc: doc074Record,
  })
  assert(
    app074.fields['pres_phone']?.value === '+8801744777846' &&
      app074.fields['pres_phone']?.source === 'passport' &&
      app074.fields['isd_code']?.value === '880' &&
      app074.fields['isd_code']?.source === 'passport' &&
      app074.fields['mobile']?.value === '1744777846' &&
      app074.fields['mobile']?.source === 'passport',
    'TASK 074 Req 2: SavedApplication Present Phone, ISD, and Mobile populated with source=passport'
  )

  // 3. Explicit applicant phone exists -> explicit applicant phone wins over passport telephone
  const docWithExplicitAndPassportTel = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT NO: A21496961
    Surname: HOSSAIN
    Given Name: MOHAMMAD ARIF
    Phone: +8801711122233
    Emergency Contact:
    Name: JANNATUL FERDOUS
    Relationship: SPOUSE
    Telephone No: +8801744777846
  `
  const extExplicitWins = extractFromPdfText(docWithExplicitAndPassportTel)
  assert(
    extExplicitWins.contact?.phone?.value === '+8801711122233' &&
      extExplicitWins.contact?.mobile?.value === '1711122233',
    'TASK 074 Req 3: Explicit applicant phone wins over emergency contact telephone'
  )

  // 4. Save -> reload preserves phone/ISD/mobile in ApplicantProfile conversion
  const hydratedProf074 = convertSavedApplicationToApplicantProfile(app074)
  assert(
    hydratedProf074.presentAddress?.phone === '+8801744777846' &&
      hydratedProf074.presentAddress?.isdCode === '880' &&
      hydratedProf074.presentAddress?.mobile === '1744777846' &&
      hydratedProf074.contact?.phone === '+8801744777846' &&
      hydratedProf074.contact?.mobile === '1744777846',
    'TASK 074 Req 4: Workspace hydration & profile conversion preserves phone/ISD/mobile'
  )

  // 5. Manual edit survives re-sync
  const app074WithManualEdit = {
    ...app074,
    fields: {
      ...app074.fields,
      pres_phone: { value: '+8801999888777', source: 'manual' as const, isUserEdited: true },
      mobile: { value: '1999888777', source: 'manual' as const, isUserEdited: true },
    },
    manualEdits: {
      ...app074.manualEdits,
      pres_phone: true,
      mobile: true,
    },
  }
  const resynced074 = populateApplicationFromDocuments({
    applicantId: 'APPL_TASK074',
    passportDoc: doc074Record,
    existingApp: app074WithManualEdit,
  })
  assert(
    resynced074.fields['pres_phone']?.value === '+8801999888777' &&
      resynced074.fields['mobile']?.value === '1999888777' &&
      resynced074.fields['pres_phone']?.isUserEdited === true,
    'TASK 074 Req 5: Manual edits on phone/mobile survive re-syncing'
  )

  // 6. Emergency contact NAME and relationship remain strictly isolated
  assert(
    ext074.personal?.firstName?.value === 'MOHAMMAD ARIF' &&
      ext074.personal?.lastName?.value === 'HOSSAIN' &&
      ext074.family?.spouse?.name?.value === 'JANNATUL FERDOUS',
    'TASK 074 Req 6: JANNATUL FERDOUS remains isolated to spouse name, never applicant identity'
  )

  // 7. Dynamic extraction test: different passport telephone is parsed dynamically (no hardcoding)
  const dynamicPassportText = `
    PEOPLE'S REPUBLIC OF BANGLADESH
    PASSPORT NO: B99887766
    Surname: AHMED
    Given Name: TANVIR
    Emergency Contact:
    Name: NASRIN SULTANA
    Relationship: WIFE
    Telephone No: +8801812345678
  `
  const extDynamic = extractFromPdfText(dynamicPassportText)
  assert(
    extDynamic.contact?.phone?.value === '+8801812345678' &&
      extDynamic.contact?.isdCode?.value === '880' &&
      extDynamic.contact?.mobile?.value === '1812345678' &&
      extDynamic.family?.spouse?.name?.value === 'NASRIN SULTANA',
    'TASK 074 Req 7: Dynamic telephone number is extracted and normalized without hardcoding'
  )

  // 8. Cross-applicant isolation: Other applicant document does not contaminate phone
  const otherAppDoc074: DocumentRecord = {
    documentId: 'doc_other_74',
    applicantId: 'APPL_OTHER_74',
    documentType: 'ogd',
    fileName: 'Other.pdf',
    fileSize: 50000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: {
      personal: { lastName: { value: 'ISLAM', source: 'pdf-text', confidence: 0.95 } },
      passport: { passportNumber: { value: 'Z00000000', source: 'pdf-text', confidence: 0.95 } },
      contact: {
        phone: { value: '+8801999999999', source: 'pdf-text', confidence: 0.9 },
        mobile: { value: '1999999999', source: 'pdf-text', confidence: 0.9 },
      },
    },
  }
  const appIsolated074 = populateApplicationFromDocuments({
    applicantId: 'APPL_TASK074',
    passportDoc: doc074Record,
    ogdDoc: otherAppDoc074,
    existingApp: null,
  })
  assert(
    appIsolated074.fields['pres_phone']?.value === '+8801744777846' &&
      appIsolated074.fields['mobile']?.value === '1744777846',
    'TASK 074 Req 8: Cross-applicant document does not contaminate target applicant phone/mobile'
  )

  // =========================================================================
  // TEST CASE J (TASK 075): REAL RUNTIME COMPLETE PIPELINE & STALE DATA PROTECTION
  // =========================================================================
  console.log('--- TEST CASE J (TASK 075): Real Runtime Complete Pipeline & Stale Data Protection ---')

  // 1. Complete end-to-end pipeline test from real OCR text to SavedApplication
  const ocrRes075: OcrResult = {
    text: JOSODA_OCR_RAW_TEXT,
    confidence: 90,
    status: 'success',
    success: true,
    language: 'eng',
  }
  const ext075Ocr = extractFromOcrText(ocrRes075)
  assert(
    ext075Ocr.contact?.phone?.value === '+8801744777846' &&
      ext075Ocr.contact?.isdCode?.value === '880' &&
      ext075Ocr.contact?.mobile?.value === '1744777846' &&
      ext075Ocr.presentAddress?.phone?.value === '+8801744777846' &&
      ext075Ocr.presentAddress?.isdCode?.value === '880' &&
      ext075Ocr.presentAddress?.mobile?.value === '1744777846',
    'TASK 075 Req 1: Real OCR text extracts phone, isdCode, and mobile in both contact and presentAddress'
  )

  const doc075Record: DocumentRecord = {
    documentId: 'doc_task075_real',
    applicantId: 'APPL_TASK075_REAL',
    documentType: 'passport',
    fileName: 'Josoda passport.pdf',
    fileSize: 100000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: ext075Ocr,
  }

  // 2. Brand new application generation
  const app075 = populateApplicationFromDocuments({
    applicantId: 'APPL_TASK075_REAL',
    passportDoc: doc075Record,
    existingApp: null,
  })

  assert(
    app075.fields['pres_phone']?.value === '+8801744777846' &&
      app075.fields['pres_phone']?.source === 'passport' &&
      app075.fields['pres_phone']?.isUserEdited === false,
    'TASK 075 Req 2a: pres_phone is +8801744777846 with source=passport'
  )
  assert(
    app075.fields['isd_code']?.value === '880' &&
      app075.fields['isd_code']?.source === 'passport' &&
      app075.fields['isd_code']?.isUserEdited === false,
    'TASK 075 Req 2b: isd_code is 880 with source=passport'
  )
  assert(
    app075.fields['mobile']?.value === '1744777846' &&
      app075.fields['mobile']?.source === 'passport' &&
      app075.fields['mobile']?.isUserEdited === false,
    'TASK 075 Req 2c: mobile is 1744777846 with source=passport'
  )

  // 3. Stale SavedApplication with empty manual edits gets cleanly populated on re-sync
  const staleEmptyApp075: SavedApplication = {
    applicationId: 'app_task075_stale',
    applicantId: 'APPL_TASK075_REAL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'ready_for_autofill',
    provenance: { lastSavedAt: new Date().toISOString() },
    sourceDocuments: {},
    fields: {
      'appl.surname': { value: 'RAY', source: 'passport' },
      'appl.passport_number': { value: 'A21496961', source: 'passport' },
      'pres_phone': { value: '', source: 'manual', isUserEdited: true },
      'isd_code': { value: '', source: 'manual', isUserEdited: true },
      'mobile': { value: '', source: 'manual', isUserEdited: true },
    },
    manualEdits: {
      'pres_phone': true,
      'isd_code': true,
      'mobile': true,
    },
  }

  const resyncedFromStale = populateApplicationFromDocuments({
    applicantId: 'APPL_TASK075_REAL',
    passportDoc: doc075Record,
    existingApp: staleEmptyApp075,
  })

  assert(
    resyncedFromStale.fields['pres_phone']?.value === '+8801744777846' &&
      resyncedFromStale.fields['pres_phone']?.source === 'passport' &&
      resyncedFromStale.fields['isd_code']?.value === '880' &&
      resyncedFromStale.fields['isd_code']?.source === 'passport' &&
      resyncedFromStale.fields['mobile']?.value === '1744777846' &&
      resyncedFromStale.fields['mobile']?.source === 'passport',
    'TASK 075 Req 3: Stale SavedApplication with empty manual fields is cleanly overwritten by passport on re-sync'
  )

  // 4. Non-empty manual edit is preserved on re-sync
  const appWithManualEdit075: SavedApplication = {
    ...app075,
    fields: {
      ...app075.fields,
      pres_phone: { value: '+8801999888777', source: 'manual', isUserEdited: true },
    },
    manualEdits: {
      ...app075.manualEdits,
      pres_phone: true,
    },
  }

  const resyncedManual = populateApplicationFromDocuments({
    applicantId: 'APPL_TASK075_REAL',
    passportDoc: doc075Record,
    existingApp: appWithManualEdit075,
  })

  assert(
    resyncedManual.fields['pres_phone']?.value === '+8801999888777' &&
      resyncedManual.fields['pres_phone']?.source === 'manual' &&
      resyncedManual.fields['pres_phone']?.isUserEdited === true &&
      resyncedManual.fields['isd_code']?.value === '880' &&
      resyncedManual.fields['isd_code']?.source === 'passport' &&
      resyncedManual.fields['mobile']?.value === '1744777846' &&
      resyncedManual.fields['mobile']?.source === 'passport',
    'TASK 075 Req 4: Valid user manual phone edit is preserved while untouched ISD/mobile continue from passport'
  )

  // =========================================================================
  // Test Case K: TASK 076 Multi-Document Dynamic Phone Extraction & Isolation
  // =========================================================================
  // Document A
  const textDocA = `
    Government of the People's Republic of Bangladesh
    Name: MD ALAM HOSSAIN
    Passport No: A11111111
    Permanent Address: 120 MIRPUR ROAD, DHAKA
    Emergency Contact:
    Name: SALMA BEGUM
    Relationship: SPOUSE
    Telephone No: +8801711111111
  `
  const extDocA = extractFromOcrText({
    text: textDocA,
    confidence: 95,
    status: 'success',
    success: true,
    language: 'eng',
  })
  assert(
    extDocA.contact?.phone?.value === '+8801711111111' &&
      extDocA.contact?.isdCode?.value === '880' &&
      extDocA.contact?.mobile?.value === '1711111111' &&
      extDocA.presentAddress?.phone?.value === '+8801711111111' &&
      extDocA.presentAddress?.isdCode?.value === '880' &&
      extDocA.presentAddress?.mobile?.value === '1711111111',
    'TASK 076 Req 14a: Document A extracts dynamic phone +8801711111111, ISD 880, mobile 1711111111'
  )

  // Document B
  const textDocB = `
    Government of the People's Republic of Bangladesh
    Name: ROKEYA KHATUN
    Passport No: A22222222
    Permanent Address: 45 AGRABAD C/A, CHITTAGONG
    Emergency Contact:
    Name: ABDUL KARIM
    Relationship: SPOUSE
    Telephone No: +8801812345678
  `
  const extDocB = extractFromOcrText({
    text: textDocB,
    confidence: 95,
    status: 'success',
    success: true,
    language: 'eng',
  })
  assert(
    extDocB.contact?.phone?.value === '+8801812345678' &&
      extDocB.contact?.isdCode?.value === '880' &&
      extDocB.contact?.mobile?.value === '1812345678' &&
      extDocB.presentAddress?.phone?.value === '+8801812345678' &&
      extDocB.presentAddress?.isdCode?.value === '880' &&
      extDocB.presentAddress?.mobile?.value === '1812345678',
    'TASK 076 Req 14b: Document B extracts dynamic phone +8801812345678, ISD 880, mobile 1812345678'
  )

  // Document C
  const textDocC = `
    Government of the People's Republic of Bangladesh
    Name: TANVIR AHMED
    Passport No: A33333333
    Permanent Address: KAZI NAZRUL ISLAM AVENUE, SYLHET
    Emergency Contact:
    Name: FATEMA ZOHRA
    Relationship: SPOUSE
    Telephone No: +8801912345678
  `
  const extDocC = extractFromOcrText({
    text: textDocC,
    confidence: 95,
    status: 'success',
    success: true,
    language: 'eng',
  })
  assert(
    extDocC.contact?.phone?.value === '+8801912345678' &&
      extDocC.contact?.isdCode?.value === '880' &&
      extDocC.contact?.mobile?.value === '1912345678' &&
      extDocC.presentAddress?.phone?.value === '+8801912345678' &&
      extDocC.presentAddress?.isdCode?.value === '880' &&
      extDocC.presentAddress?.mobile?.value === '1912345678',
    'TASK 076 Req 14c: Document C extracts dynamic phone +8801912345678, ISD 880, mobile 1912345678'
  )

  // Document D: domestic number 01733333333
  const textDocD = `
    Present Address: Sector 4, Uttara, Dhaka
    Mobile: 01733333333
  `
  const extDocD = extractFromOcrText({
    text: textDocD,
    confidence: 95,
    status: 'success',
    success: true,
    language: 'eng',
  })
  assert(
    extDocD.contact?.mobile?.value === '01733333333' &&
      extDocD.contact?.phone?.value === '01733333333',
    'TASK 076 Req 14d: Document D extracts domestic mobile 01733333333'
  )

  // Cross-Applicant Isolation & Pipeline Verification
  const docRecordA: DocumentRecord = {
    documentId: 'doc_appl_a',
    applicantId: 'APPL_A',
    documentType: 'passport',
    fileName: 'passport_a.pdf',
    fileSize: 100000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: extDocA,
  }

  const docRecordB: DocumentRecord = {
    documentId: 'doc_appl_b',
    applicantId: 'APPL_B',
    documentType: 'passport',
    fileName: 'passport_b.pdf',
    fileSize: 100000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: extDocB,
  }

  const appA = populateApplicationFromDocuments({
    applicantId: 'APPL_A',
    passportDoc: docRecordA,
    existingApp: null,
  })

  const appB = populateApplicationFromDocuments({
    applicantId: 'APPL_B',
    passportDoc: docRecordB,
    existingApp: null,
  })

  assert(
    appA.fields['pres_phone']?.value === '+8801711111111' &&
      appA.fields['isd_code']?.value === '880' &&
      appA.fields['mobile']?.value === '1711111111',
    'TASK 076 Req 14e: Applicant A receives phone +8801711111111, ISD 880, mobile 1711111111'
  )

  assert(
    appB.fields['pres_phone']?.value === '+8801812345678' &&
      appB.fields['isd_code']?.value === '880' &&
      appB.fields['mobile']?.value === '1812345678',
    'TASK 076 Req 14f: Applicant B receives phone +8801812345678, ISD 880, mobile 1812345678'
  )

  // Verify no cross-talk: App A has not received App B's info and vice versa
  assert(
    appA.fields['pres_phone']?.value !== appB.fields['pres_phone']?.value &&
      appA.fields['mobile']?.value !== appB.fields['mobile']?.value,
    'TASK 076 Req 14g: Applicant A and Applicant B have distinct phone and mobile values (isolation)'
  )

  // End-to-end hydration verification for Applicant A and B
  const hydratedA = convertSavedApplicationToApplicantProfile(appA)
  const hydratedB = convertSavedApplicationToApplicantProfile(appB)

  assert(
    hydratedA.presentAddress?.phone === '+8801711111111' &&
      hydratedA.presentAddress?.mobile === '1711111111' &&
      hydratedA.contact?.phone === '+8801711111111' &&
      hydratedA.contact?.mobile === '1711111111',
    'TASK 076 Req 14h: Applicant A hydrated profile contains exact dynamic phone and mobile'
  )

  assert(
    hydratedB.presentAddress?.phone === '+8801812345678' &&
      hydratedB.presentAddress?.mobile === '1812345678' &&
      hydratedB.contact?.phone === '+8801812345678' &&
      hydratedB.contact?.mobile === '1812345678',
    'TASK 076 Req 14i: Applicant B hydrated profile contains exact dynamic phone and mobile'
  )

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}

