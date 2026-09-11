import { extractFromPdfText } from '../src/core/extraction/data/applicantDataExtractor'
import { populateApplicationFromDocuments } from '../src/core/application/applicationMerger'
import type { DocumentRecord } from '../src/core/document/types'

const sample = `
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
Telephone No: +8801711112233

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

const ext = extractFromPdfText(sample)
console.log('EXTRACTED DATA:', JSON.stringify(ext, null, 2))

const doc: DocumentRecord = {
  documentId: 'doc_1',
  applicantId: '234234',
  documentType: 'passport',
  fileName: 'test.pdf',
  extractedData: ext,
  extractedDataConfirmed: true,
  fileSize: 100,
  mimeType: 'application/pdf',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'processed',
  source: 'user-upload',
}

const app = populateApplicationFromDocuments({
  applicantId: '234234',
  passportDoc: doc,
})

const presentKeys = ['pres_addr1', 'pres_addr2', 'village_town_city', 'district', 'state_province', 'present_country', 'pincode', 'pres_phone', 'isd_code', 'mobile']
console.log('--- PRESENT ADDRESS & CONTACT ---')
for (const k of presentKeys) {
  console.log(k, ':', app.fields[k])
}

const permKeys = ['perm_add1', 'perm_add2', 'permanent_village_town_city', 'permanent_district', 'permanent_state_province', 'permanent_country', 'permanent_postal_code']
console.log('--- PERMANENT ADDRESS ---')
for (const k of permKeys) {
  console.log(k, ':', app.fields[k])
}
