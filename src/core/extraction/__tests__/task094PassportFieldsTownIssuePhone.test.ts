import { extractFromPdfText, parseApplicantContact } from '../data/applicantDataExtractor'
import { populateApplicationFromDocuments } from '../../application/applicationMerger'
import type { DocumentRecord } from '../../document/types'

let totalTests = 0
let failedTests = 0

function assert(condition: boolean, message: string) {
  totalTests++
  if (condition) {
    console.log(`  ✓ PASS: ${message}`)
  } else {
    failedTests++
    console.error(`  ✗ FAIL: ${message}`)
  }
}

console.log('\n=== RUNNING TASK 094 TEST SUITE: TOWN/CITY OF BIRTH, ISSUE DATE & PHONE ===\n')

// 1. Place of birth with French/English bilingual header
console.log('--- 1. Testing Town/City of Birth Extraction ---')
const passportWithBilingualPob = `
PEOPLE'S REPUBLIC OF BANGLADESH
PASSPORT
Surname / Nom: ISLAM
Given Name / Prénoms: MD SADEKUL
Nationality / Nationalité: BANGLADESHI
Personal No. / N° personnel: 6482921878
Date of birth / Date de naissance: 05 JUL / JUIL 1990
Sex / Sexe: M
Place of birth / Lieu de naissance: DINAJPUR
Date of issue / Date de délivrance: 09 AUG / AOÛT 2026
Date of expiry / Date d'expiration: 08 AUG / AOÛT 2036
Issuing Authority / Autorité: DIP/DHAKA
`
const ext1 = extractFromPdfText(passportWithBilingualPob)
assert(ext1.personal?.townCityOfBirth?.value === 'DINAJPUR', 'Place of Birth extracted as DINAJPUR (got: ' + ext1.personal?.townCityOfBirth?.value + ')')

// 2. Multiline Place of Birth
const passportWithMultilinePob = `
PASSPORT / PASSEPORT
Surname: ISLAM
Given Name: MD SADEKUL
Place of birth / Lieu de naissance
THAKURGAON
Date of expiry: 08/08/2036
`
const ext2 = extractFromPdfText(passportWithMultilinePob)
assert(ext2.personal?.townCityOfBirth?.value === 'THAKURGAON', 'Multiline Place of Birth extracted as THAKURGAON')

// 3. Fallback to District when Place of Birth label is completely missing
const passportWithDistrictOnly = `
PASSPORT
Surname: ISLAM
Given Name: MD SADEKUL
Permanent Address: VILLAGE PIRGANJ, DISTRICT: THAKURGAON - 5110
`
const ext3 = extractFromPdfText(passportWithDistrictOnly)
assert(ext3.personal?.townCityOfBirth?.value === 'THAKURGAON', 'Place of Birth falls back to address district THAKURGAON')

// 4. Date of Issue Extraction
console.log('\n--- 2. Testing Date of Issue Extraction & Expiry Derivation ---')
const passportWithBilingualIssueDate = `
PASSPORT
Date of issue / Date de délivrance: 09 AUG 2026
Date of expiry / Date d'expiration: 08 AUG 2036
`
const ext4 = extractFromPdfText(passportWithBilingualIssueDate)
assert(ext4.passport?.issueDate?.value === '2026-08-09', 'Date of Issue extracted as 2026-08-09 (got: ' + ext4.passport?.issueDate?.value + ')')
assert(ext4.passport?.expiryDate?.value === '2036-08-08', 'Date of Expiry extracted as 2036-08-08')

// 5. Date of Issue Derivation from Expiry Date when missing
const passportWithExpiryOnly = `
PASSPORT
Passport No: A23234622
Date of Expiry: 08/08/2036
`
const ext5 = extractFromPdfText(passportWithExpiryOnly)
assert(ext5.passport?.issueDate?.value === '2026-08-08' || ext5.passport?.issueDate?.value === '2026-08-09', 'Missing Issue Date derived from Expiry Date (got: ' + ext5.passport?.issueDate?.value + ')')

// 6. Phone Number Parsing from Emergency Contact
console.log('\n--- 3. Testing Phone Number Extraction from Passport ---')
const passportWithBilingualEmergency = `
PEOPLE'S REPUBLIC OF BANGLADESH
Emergency Contact / Contact en cas d'urgence
Name / Nom: MOST NILUFA EASMIN
Relationship / Lien de parenté: SPOUSE
Address / Adresse: PIRGANJ, THAKURGAON
Telephone No. / Téléphone n°: +8801767319068
`
const contact1 = parseApplicantContact(passportWithBilingualEmergency)
assert(contact1.phone === '+8801767319068', 'Emergency Contact Telephone +8801767319068 parsed')
assert(contact1.mobile === '1767319068', 'Mobile parsed as 1767319068')
assert(contact1.isdCode === '880', 'ISD Code parsed as 880')

const passportWithLocalEmergency = `
Emergency Contact:
Name: MD KASHEM
Telephone No: 01711111111
`
const contact2 = parseApplicantContact(passportWithLocalEmergency)
assert(contact2.phone === '+8801711111111', 'Local 01711111111 normalized to +8801711111111')
assert(contact2.mobile === '1711111111', 'Mobile normalized to 1711111111')

// 7. Full Application Merge & Autofill Workspace Verification
console.log('\n--- 4. Testing Application Merge & Workspace Population ---')
const sampleDoc: DocumentRecord = {
  documentId: 'doc_sadukul_passport',
  applicantId: 'APPL_234234',
  documentType: 'passport',
  fileName: 'Sadukul passport.pdf',
  fileSize: 100000,
  mimeType: 'application/pdf',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'processed',
  source: 'user-upload',
  extractedDataConfirmed: true,
  extractedData: {
    personal: {
      lastName: { value: 'ISLAM', source: 'mrz', confidence: 95 },
      firstName: { value: 'MD SADEKUL', source: 'mrz', confidence: 95 },
      dateOfBirth: { value: '1990-07-05', source: 'mrz', confidence: 95 },
      gender: { value: 'male', source: 'mrz', confidence: 95 },
      nationality: { value: 'BANGLADESH', source: 'mrz', confidence: 95 },
      nationalIdNumber: { value: '6482921878', source: 'mrz', confidence: 95 },
      townCityOfBirth: { value: 'DINAJPUR', source: 'ocr', confidence: 90 },
    },
    passport: {
      passportNumber: { value: 'A23234622', source: 'mrz', confidence: 98 },
      expiryDate: { value: '2036-08-08', source: 'mrz', confidence: 98 },
      issueDate: { value: '2026-08-09', source: 'ocr', confidence: 90 },
      placeOfIssue: { value: 'DHAKA', source: 'ocr', confidence: 90 },
      issuingCountry: { value: 'BANGLADESH', source: 'mrz', confidence: 95 },
    },
    presentAddress: {
      addressLine1: { value: 'DANAJPUR', source: 'ocr', confidence: 90 },
      villageTownCity: { value: 'WARD-3, PIRGANJ, RANSHIA', source: 'ocr', confidence: 90 },
      district: { value: 'THAKURGAON', source: 'ocr', confidence: 90 },
      stateProvince: { value: 'THAKURGAON', source: 'ocr', confidence: 90 },
      postalCode: { value: '5110', source: 'ocr', confidence: 90 },
      country: { value: 'BANGLADESH', source: 'ocr', confidence: 90 },
      phone: { value: '+8801767319068', source: 'ocr', confidence: 90 },
      mobile: { value: '1767319068', source: 'ocr', confidence: 90 },
      isdCode: { value: '880', source: 'ocr', confidence: 90 },
    },
    contact: {
      phone: { value: '+8801767319068', source: 'ocr', confidence: 90 },
      mobile: { value: '1767319068', source: 'ocr', confidence: 90 },
      isdCode: { value: '880', source: 'ocr', confidence: 90 },
    },
  },
}

const mergedApp = populateApplicationFromDocuments({
  applicantId: 'APPL_234234',
  passportDoc: sampleDoc,
  ogdDoc: null,
  existingApp: null,
})

assert(mergedApp.fields['appl.placbrth']?.value === 'DINAJPUR', 'appl.placbrth populated as DINAJPUR')
assert(mergedApp.fields['appl.passport_issue_date']?.value === '09/08/2026', 'appl.passport_issue_date populated as 09/08/2026')
assert(mergedApp.fields['appl.passport_expiry_date']?.value === '08/08/2036', 'appl.passport_expiry_date populated as 08/08/2036')
assert(mergedApp.fields['pres_phone']?.value === '+8801767319068', 'pres_phone populated as +8801767319068')
assert(mergedApp.fields['mobile']?.value === '1767319068', 'mobile populated as 1767319068')
assert(mergedApp.fields['isd_code']?.value === '880', 'isd_code populated as 880')

console.log(`\n=== TASK 094 TEST AUDIT COMPLETE: ${totalTests - failedTests}/${totalTests} PASSED ===\n`)
if (failedTests > 0) {
  process.exit(1)
}
