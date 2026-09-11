import { extractFromPdfText } from '../src/core/extraction/data/applicantDataExtractor'
import { populateApplicationFromDocuments } from '../src/core/application/applicationMerger'
import type { DocumentRecord } from '../src/core/document/types'

const sample = `
--- PAGE 1 ---
PERSONAL DATA AND EMERGENCY CONTACT
Name: SHREA JOTIMOY RAY
Father's Name: SHREE KHIDAR MOHAN
Mother's Name: PANCHAMI RANI
Legal Guardian's Name:
Permanent Address: KASHIPUR, RANISANKAIL, MUZAHIDABAD COLONI - 5120, THAKURGAON
Emergency Contact:
Name: JASHODA RANI
Relationship: SPOUSE
Address: KASHIPUR, RANISANKAIL, MUZAHIDABAD COLONI - 5120, THAKURGAON
Telephone No: +8801744777846

--- PAGE 2 ---
গণপ্রজাতন্ত্রী বাংলাদেশ PEOPLE'S REPUBLIC OF BANGLADESH
শ্রেণি / Type: P
দেশ কোড / Country Code: BGD
পাসপোর্ট নং / Passport Number: A21496961
বংশগত নাম / Surname: RAY
প্রদত্ত নাম / Given Name: SHREE JOTIMOY
জাতীয়তা / Nationality: BANGLADESHI
ব্যক্তিগত নং / Personal No.: 8235626051
জন্ম তারিখ / Date of Birth: 18 SEP 1993
পূর্ববর্তী পাসপোর্ট নং / Previous Passport No.: BK0965579
লিঙ্গ / Sex: M
জন্মস্থান / Place of Birth: THAKURGAON
National ID / other: 983640
প্রদানের তারিখ / Date of Issue: 20 JAN 2026
প্রদানকারী কর্তৃপক্ষ / Issuing Authority: DIP/DHAKA
মেয়াদোত্তীর্ণের তারিখ / Date of Expiry: 19 JAN 2031
স্বাক্ষর / Holder's Signature: জ্যোতির্ময় রায়
P<BGDRAY<<SHREE<JOTIMOY<<<<<<<<<<<<<<<<<<<
A214969610BGD9309186M31011938235626051<<<<48
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

const personalKeys = ['appl.surname', 'appl.applname', 'appl.passport_number', 'appl.birthdate', 'appl.nationality', 'appl.nationality_by', 'appl.country_of_birth', 'appl.placbrth', 'appl.nic_no', 'appl.visual_mark']
console.log('--- PERSONAL DETAILS ---')
for (const k of personalKeys) {
  console.log(k, ':', app.fields[k])
}

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
