import { extractFromPdfText } from '../data/applicantDataExtractor'
import { applyExtractionToApplicant } from '../data/extractionMapper'
import { populateApplicationFromDocuments } from '../../application/applicationMerger'
import type { DocumentRecord } from '../../document/types'
import type { ApplicantProfile } from '../../applicant/types'

export const KHOKON_OGD_PDF_TEXT = `
Online Indian Visa Application
Government of India
Web File No: BGDV00123456

Personal Particulars
Surname (as shown in passport) : CHANDRA ROY
Given Name (as shown in passport) : KHOKON
Have you ever changed your name? If yes, click the box and give details : Not Applicable
Sex : MALE
Date of Birth : 15-MAY-1989
Place of Birth : PANCHAGARH
Country of Birth : BANGLADESH
Citizenship/National Id No : 7782648203
Religion : HINDU
Educational Qualification : BELOW MATRICULATION
Current Nationality : BANGLADESH
Did you acquire Nationality by birth or by naturalization? : BY BIRTH
Prev. Nationality : Not Applicable
Visible Identification Marks : NA
Applicant's Marital Status : MARRIED

Passport Details
Passport Number : A07350151
Place of Issue : DHAKA
Date of Issue : 27-MAR-2023
Date of Expiry : 26-MAR-2033
Any other Passport/Identity Certificate(IC) held : NO

Applicant's Contact Details / Address Details
Present Address:
DANDAPAL MAREA
KAMALAPUKHURI
DANDAPAL DEBIGANJ
PANCHAGARH, BANGLADESH 5020
Phone No : 01740572545
Mobile No : 8801740572545
Email : KHOKONROY866@GMAIL.COM

Permanent Address:
SONDHANI PARA, BENGHARI, 04
DEBIGANJ, KALIGANJ- 5020
PANCHAGARH

Family Details
Father's Details:
Name : POBETRA KUMER
Nationality : BANGLADESH
Previous Nationality : BANGLADESH
Place of Birth : PANCHAGARH
Country of Birth : BANGLADESH

Mother's Details:
Name : SOMILA RANI
Nationality : BANGLADESH
Previous Nationality : BANGLADESH
Place of Birth : PANCHAGARH
Country of Birth : BANGLADESH

Spouse's Details:
Name : LIPA ROY
Nationality : BANGLADESH
Previous Nationality : BANGLADESH
Place of Birth : PANCHAGARH
Country of Birth : BANGLADESH

Were your Grandfather/ Grandmother (Paternal/Maternal) Pakistan Nationals or belong to Pakistan held area? : NO

Profession / Occupation Details
Present Occupation : FARMER
Designation/Rank : FARMER
Employer Name/Business : KHOKON CHANDRA ROY
Address : PANCHAGARH
Phone : 01740572545
Past Occupation (if any) :
Military/Police/Security Organization : NO

Details of Visa Sought
Type of Visa : TOURIST VISA
Duration of Visa (in Months) : 12 Month
No. of Entries : MULTIPLE
Purpose of Visit : TOURIST VISA
Expected Date of Journey : 16-SEP-2026
Port of Arrival in India : BY ROAD PHULBARI
Expected Port of Exit from India : BY ROAD PHULBARI
Places likely to be visited : KOLKATA, WEST BENGAL

Previous Visa Details / Previous Visit Details
Have you visited India previously? : NO
Have you ever been refused visa or deported? : NO

Hotel/Place of Stay
Name : VICEROY BOUTIQUE HOTEL
Address : CHINAR PARK, ATGHARA, TEGHARIA, RAJARHAT
State/City : KOLKATA / WEST BENGAL
Phone : 919831079293

Reference Details
Reference Name in India : VICEROY BOUTIQUE HOTEL
Address : CHINAR PARK, ATGHARA, TEGHARIA, RAJARHAT KOLKATA WEST BENGAL
Phone : 919831079293

Reference Name in Bangladesh : LIPA ROY
Address : SOHDHANI PARA, BENGHARI, 04 DEBIGANJ, KALIGANJ, PANCHAGARH
Phone : 01786703170
`

export interface AuditRow {
  field: string
  pdfValue: string
  extractedValue: string
  normalizedValue: string
  finalWorkspaceValue: string
  status: 'PASS' | 'MISSING' | 'MISMATCH' | 'UNSUPPORTED'
}

export async function runOgdFullFieldExtractionTests(): Promise<{
  passed: boolean
  totalSubtests: number
  failures: string[]
  auditTable: AuditRow[]
}> {
  const failures: string[] = []
  let totalSubtests = 0

  function assert(condition: boolean, msg: string) {
    totalSubtests++
    if (!condition) {
      failures.push(msg)
      console.error(`  ❌ FAIL: ${msg}`)
    } else {
      console.log(`  ✓ PASS: ${msg}`)
    }
  }

  console.log('--- RUNNING OGD FULL-FIELD EXTRACTION & ZERO-MISSING MAPPING TESTS (TASK 057) ---')

  // 1. Extraction Test
  const extracted = extractFromPdfText(KHOKON_OGD_PDF_TEXT)

  assert(Boolean(extracted), 'Extracted applicant data from OGD PDF text')
  assert(extracted.personal?.lastName?.value === 'CHANDRA ROY', 'Personal Surname: CHANDRA ROY')
  assert(extracted.personal?.firstName?.value === 'KHOKON', 'Personal Given Name: KHOKON')
  assert(extracted.personal?.gender?.value === 'male', 'Personal Gender: male')
  assert(extracted.personal?.dateOfBirth?.value === '1989-05-15', 'Personal DOB: 1989-05-15')
  assert(extracted.personal?.religion?.value === 'HINDU', 'Personal Religion: HINDU')
  assert(extracted.personal?.townCityOfBirth?.value === 'PANCHAGARH', 'Personal Place of Birth: PANCHAGARH')
  assert(extracted.personal?.countryOfBirth?.value === 'BANGLADESH', 'Personal Country of Birth: BANGLADESH')
  assert(extracted.personal?.nationalIdNumber?.value === '7782648203', 'Personal National ID: 7782648203')
  assert(extracted.personal?.educationalQualification?.value === 'BELOW MATRICULATION', 'Personal Education: BELOW MATRICULATION')
  assert(extracted.personal?.visibleIdentificationMarks?.value === 'NA', 'Personal Visible Marks: strictly NA without contamination')
  assert(extracted.personal?.nationality?.value === 'BANGLADESH', 'Personal Nationality: BANGLADESH')
  assert(extracted.personal?.maritalStatus?.value === 'Married', 'Personal Marital Status: Married')

  // Passport
  assert(extracted.passport?.passportNumber?.value === 'A07350151', 'Passport Number: A07350151')
  assert(extracted.passport?.issueDate?.value === '2023-03-27', 'Passport Issue Date: 2023-03-27')
  assert(extracted.passport?.expiryDate?.value === '2033-03-26', 'Passport Expiry Date: 2033-03-26')
  assert(extracted.passport?.placeOfIssue?.value === 'DHAKA', 'Passport Issue Place: DHAKA')
  assert(extracted.passport?.holdsOtherPassport?.value === false, 'Holds Other Passport: false')

  // Present Address & Contact
  assert(extracted.presentAddress?.addressLine1?.value === 'DANDAPAL MAREA', 'Present Address Line 1: DANDAPAL MAREA')
  assert(extracted.presentAddress?.addressLine2?.value === 'KAMALAPUKHURI', 'Present Address Line 2: KAMALAPUKHURI')
  assert(extracted.presentAddress?.postalCode?.value === '5020', 'Present Postal Code: 5020')
  assert(extracted.contact?.phone?.value === '01740572545', 'Contact Phone: 01740572545')
  assert(extracted.contact?.mobile?.value === '8801740572545', 'Contact Mobile: 8801740572545')
  assert(extracted.contact?.email?.value === 'KHOKONROY866@GMAIL.COM', 'Contact Email: KHOKONROY866@GMAIL.COM')

  // Permanent Address
  assert(extracted.permanentAddress?.addressLine1?.value === 'SONDHANI PARA, BENGHARI, 04', 'Permanent Address Line 1')
  assert(extracted.permanentAddress?.addressLine2?.value === 'DEBIGANJ, KALIGANJ- 5020', 'Permanent Address Line 2')
  assert(extracted.permanentAddress?.villageTownCity?.value === 'PANCHAGARH', 'Permanent Address City')

  // Family
  assert(extracted.family?.father?.name?.value === 'POBETRA KUMER', 'Father Name: POBETRA KUMER')
  assert(extracted.family?.father?.nationality?.value === 'BANGLADESH', 'Father Nationality: BANGLADESH')
  assert(extracted.family?.father?.previousNationality?.value === 'BANGLADESH', 'Father Prev Nationality: BANGLADESH')
  assert(extracted.family?.father?.placeOfBirth?.value === 'PANCHAGARH', 'Father Place of Birth: PANCHAGARH')
  assert(extracted.family?.father?.countryOfBirth?.value === 'BANGLADESH', 'Father Country of Birth: BANGLADESH')

  assert(extracted.family?.mother?.name?.value === 'SOMILA RANI', 'Mother Name: SOMILA RANI')
  assert(extracted.family?.mother?.nationality?.value === 'BANGLADESH', 'Mother Nationality: BANGLADESH')
  assert(extracted.family?.mother?.previousNationality?.value === 'BANGLADESH', 'Mother Prev Nationality: BANGLADESH')
  assert(extracted.family?.mother?.placeOfBirth?.value === 'PANCHAGARH', 'Mother Place of Birth: PANCHAGARH')
  assert(extracted.family?.mother?.countryOfBirth?.value === 'BANGLADESH', 'Mother Country of Birth: BANGLADESH')

  assert(extracted.family?.spouse?.name?.value === 'LIPA ROY', 'Spouse Name: LIPA ROY')
  assert(extracted.family?.spouse?.nationality?.value === 'BANGLADESH', 'Spouse Nationality: BANGLADESH')
  assert(extracted.family?.spouse?.previousNationality?.value === 'BANGLADESH', 'Spouse Prev Nationality: BANGLADESH')
  assert(extracted.family?.spouse?.placeOfBirth?.value === 'PANCHAGARH', 'Spouse Place of Birth: PANCHAGARH')
  assert(extracted.family?.spouse?.countryOfBirth?.value === 'BANGLADESH', 'Spouse Country of Birth: BANGLADESH')
  assert(extracted.family?.hasPakistanRelation?.value === false, 'Pakistan Relation: false')

  // Employment
  assert(extracted.employment?.presentOccupation?.value === 'FARMER', 'Occupation: FARMER')
  assert(extracted.employment?.designationRank?.value === 'FARMER', 'Designation: FARMER')
  assert(extracted.employment?.employerName?.value === 'KHOKON CHANDRA ROY', 'Employer: KHOKON CHANDRA ROY')
  assert(extracted.employment?.employerAddress?.value === 'PANCHAGARH', 'Employer Address: PANCHAGARH')
  assert(extracted.employment?.employerPhone?.value === '01740572545', 'Employer Phone: 01740572545')
  assert(extracted.employment?.hasMilitaryService?.value === false, 'Military Service: false')

  // Visa & Travel
  assert(extracted.travel?.duration?.value === '12', 'Duration: 12')
  assert(extracted.travel?.visaEntryType?.value === 'Multiple', 'Entries: Multiple')
  assert(extracted.travel?.intendedArrivalDate?.value === '2026-09-16', 'Journey Date: 2026-09-16')
  assert(extracted.travel?.entryPoint?.value === 'BY ROAD PHULBARI', 'Port of Entry: BY ROAD PHULBARI')
  assert(extracted.travel?.exitPoint?.value === 'BY ROAD PHULBARI', 'Port of Exit: BY ROAD PHULBARI')
  assert(extracted.previousVisa?.hasPreviousVisa?.value === false, 'Previous Visa: false')
  assert(extracted.previousVisa?.hasRefusal?.value === false, 'Refusal: false')

  // References
  assert(extracted.sponsorIndia?.name?.value === 'VICEROY BOUTIQUE HOTEL', 'India Ref Name: VICEROY BOUTIQUE HOTEL')
  assert(extracted.sponsorIndia?.addressLine1?.value === 'CHINAR PARK, ATGHARA, TEGHARIA, RAJARHAT', 'India Ref Address Line 1')
  assert(extracted.sponsorIndia?.phone?.value === '919831079293', 'India Ref Phone: 919831079293')

  assert(extracted.sponsorMission?.name?.value === 'LIPA ROY', 'Bangladesh Ref Name: LIPA ROY')
  assert(extracted.sponsorMission?.addressLine1?.value === 'SOHDHANI PARA, BENGHARI, 04', 'Bangladesh Ref Address Line 1')
  assert(extracted.sponsorMission?.phone?.value === '01786703170', 'Bangladesh Ref Phone: 01786703170')

  // 2. Document & SavedApplication Auto-Population Test
  const ogdDoc: DocumentRecord = {
    documentId: 'doc_ogd_khokon_001',
    applicantId: 'KHOKON_APP_001',
    documentType: 'ogd',
    fileName: 'Khokon WEB 27.pdf',
    fileSize: 245000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: extracted,
    extractedDataConfirmed: true,
  }

  const baseApp: ApplicantProfile = {
    applicantId: 'KHOKON_APP_001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const normalizedProfile = applyExtractionToApplicant(baseApp, extracted)
  assert(Boolean(normalizedProfile.personalInfo?.surname), 'Normalized profile personal surname present')

  const savedApp = populateApplicationFromDocuments({
    applicantId: 'KHOKON_APP_001',
    passportDoc: null,
    ogdDoc,
    existingApp: null,
  })

  // 3. Construct Field-by-Field Audit Table
  const auditExpectations: Array<{
    field: string
    pdfVal: string
    extractedVal: string
    normalizedVal: string
    expectedWorkspaceVal: string
  }> = [
    { field: 'appl.surname', pdfVal: 'CHANDRA ROY', extractedVal: 'CHANDRA ROY', normalizedVal: 'CHANDRA ROY', expectedWorkspaceVal: 'CHANDRA ROY' },
    { field: 'appl.applname', pdfVal: 'KHOKON', extractedVal: 'KHOKON', normalizedVal: 'KHOKON', expectedWorkspaceVal: 'KHOKON' },
    { field: 'appl.changedSurnameCheck', pdfVal: 'Not Applicable', extractedVal: 'false', normalizedVal: 'false', expectedWorkspaceVal: 'false' },
    { field: 'appl.applsex', pdfVal: 'MALE', extractedVal: 'male', normalizedVal: 'male', expectedWorkspaceVal: 'MALE' },
    { field: 'appl.birthdate', pdfVal: '15-MAY-1989', extractedVal: '1989-05-15', normalizedVal: '1989-05-15', expectedWorkspaceVal: '15/05/1989' },
    { field: 'appl.placbrth', pdfVal: 'PANCHAGARH', extractedVal: 'PANCHAGARH', normalizedVal: 'PANCHAGARH', expectedWorkspaceVal: 'PANCHAGARH' },
    { field: 'appl.country_of_birth', pdfVal: 'BANGLADESH', extractedVal: 'BANGLADESH', normalizedVal: 'BANGLADESH', expectedWorkspaceVal: 'BANGLADESH' },
    { field: 'appl.countryname', pdfVal: 'BANGLADESH', extractedVal: 'BANGLADESH', normalizedVal: 'BANGLADESH', expectedWorkspaceVal: 'BANGLADESH' },
    { field: 'appl.nationality', pdfVal: 'BANGLADESH', extractedVal: 'BANGLADESH', normalizedVal: 'BANGLADESH', expectedWorkspaceVal: 'BANGLADESH' },
    { field: 'appl.nic_no', pdfVal: '7782648203', extractedVal: '7782648203', normalizedVal: '7782648203', expectedWorkspaceVal: '7782648203' },
    { field: 'appl.religion', pdfVal: 'HINDU', extractedVal: 'HINDU', normalizedVal: 'HINDU', expectedWorkspaceVal: 'HINDU' },
    { field: 'appl.edu_id', pdfVal: 'BELOW MATRICULATION', extractedVal: 'BELOW MATRICULATION', normalizedVal: 'BELOW MATRICULATION', expectedWorkspaceVal: 'BELOW MATRICULATION' },
    { field: 'appl.visual_mark', pdfVal: 'NA', extractedVal: 'NA', normalizedVal: 'NA', expectedWorkspaceVal: 'NA' },
    { field: 'appl.nationality_by', pdfVal: 'BY BIRTH', extractedVal: 'BANGLADESH', normalizedVal: 'birth', expectedWorkspaceVal: 'Birth' },
    { field: 'appl.passport_number', pdfVal: 'A07350151', extractedVal: 'A07350151', normalizedVal: 'A07350151', expectedWorkspaceVal: 'A07350151' },
    { field: 'appl.passport_issue_place', pdfVal: 'DHAKA', extractedVal: 'DHAKA', normalizedVal: 'DHAKA', expectedWorkspaceVal: 'DHAKA' },
    { field: 'appl.passport_issue_date', pdfVal: '27-MAR-2023', extractedVal: '2023-03-27', normalizedVal: '2023-03-27', expectedWorkspaceVal: '27/03/2023' },
    { field: 'appl.passport_expiry_date', pdfVal: '26-MAR-2033', extractedVal: '2033-03-26', normalizedVal: '2033-03-26', expectedWorkspaceVal: '26/03/2033' },
    { field: 'appl.oth_ppt', pdfVal: 'NO', extractedVal: 'false', normalizedVal: 'false', expectedWorkspaceVal: 'No' },
    { field: 'pres_addr1', pdfVal: 'DANDAPAL MAREA', extractedVal: 'DANDAPAL MAREA', normalizedVal: 'DANDAPAL MAREA', expectedWorkspaceVal: 'DANDAPAL MAREA' },
    { field: 'pres_addr2', pdfVal: 'KAMALAPUKHURI', extractedVal: 'KAMALAPUKHURI', normalizedVal: 'KAMALAPUKHURI', expectedWorkspaceVal: 'KAMALAPUKHURI' },
    { field: 'state_name', pdfVal: 'PANCHAGARH', extractedVal: 'PANCHAGARH', normalizedVal: 'PANCHAGARH', expectedWorkspaceVal: 'PANCHAGARH' },
    { field: 'pincode', pdfVal: '5020', extractedVal: '5020', normalizedVal: '5020', expectedWorkspaceVal: '5020' },
    { field: 'pres_phone', pdfVal: '01740572545', extractedVal: '01740572545', normalizedVal: '01740572545', expectedWorkspaceVal: '01740572545' },
    { field: 'mobile', pdfVal: '8801740572545', extractedVal: '8801740572545', normalizedVal: '8801740572545', expectedWorkspaceVal: '8801740572545' },
    { field: 'appl.email', pdfVal: 'KHOKONROY866@GMAIL.COM', extractedVal: 'KHOKONROY866@GMAIL.COM', normalizedVal: 'khokonroy866@gmail.com', expectedWorkspaceVal: 'KHOKONROY866@GMAIL.COM' },
    { field: 'appl.email_re', pdfVal: 'KHOKONROY866@GMAIL.COM', extractedVal: 'KHOKONROY866@GMAIL.COM', normalizedVal: 'khokonroy866@gmail.com', expectedWorkspaceVal: 'KHOKONROY866@GMAIL.COM' },
    { field: 'perm_add1', pdfVal: 'SONDHANI PARA, BENGHARI, 04', extractedVal: 'SONDHANI PARA, BENGHARI, 04', normalizedVal: 'SONDHANI PARA, BENGHARI, 04', expectedWorkspaceVal: 'SONDHANI PARA, BENGHARI, 04' },
    { field: 'perm_add2', pdfVal: 'DEBIGANJ, KALIGANJ- 5020', extractedVal: 'DEBIGANJ, KALIGANJ- 5020', normalizedVal: 'DEBIGANJ, KALIGANJ- 5020', expectedWorkspaceVal: 'DEBIGANJ, KALIGANJ- 5020' },
    { field: 'perm_add3', pdfVal: 'PANCHAGARH', extractedVal: 'PANCHAGARH', normalizedVal: 'PANCHAGARH', expectedWorkspaceVal: 'PANCHAGARH' },
    { field: 'fthrname', pdfVal: 'POBETRA KUMER', extractedVal: 'POBETRA KUMER', normalizedVal: 'POBETRA KUMER', expectedWorkspaceVal: 'POBETRA KUMER' },
    { field: 'father_nationality', pdfVal: 'BANGLADESH', extractedVal: 'BANGLADESH', normalizedVal: 'BANGLADESH', expectedWorkspaceVal: 'BANGLADESH' },
    { field: 'father_prev_nationality', pdfVal: 'BANGLADESH', extractedVal: 'BANGLADESH', normalizedVal: 'BANGLADESH', expectedWorkspaceVal: 'BANGLADESH' },
    { field: 'father_place_of_birth', pdfVal: 'PANCHAGARH', extractedVal: 'PANCHAGARH', normalizedVal: 'PANCHAGARH', expectedWorkspaceVal: 'PANCHAGARH' },
    { field: 'father_country_of_birth', pdfVal: 'BANGLADESH', extractedVal: 'BANGLADESH', normalizedVal: 'BANGLADESH', expectedWorkspaceVal: 'BANGLADESH' },
    { field: 'mother_name', pdfVal: 'SOMILA RANI', extractedVal: 'SOMILA RANI', normalizedVal: 'SOMILA RANI', expectedWorkspaceVal: 'SOMILA RANI' },
    { field: 'mother_nationality', pdfVal: 'BANGLADESH', extractedVal: 'BANGLADESH', normalizedVal: 'BANGLADESH', expectedWorkspaceVal: 'BANGLADESH' },
    { field: 'mother_prev_nationality', pdfVal: 'BANGLADESH', extractedVal: 'BANGLADESH', normalizedVal: 'BANGLADESH', expectedWorkspaceVal: 'BANGLADESH' },
    { field: 'mother_place_of_birth', pdfVal: 'PANCHAGARH', extractedVal: 'PANCHAGARH', normalizedVal: 'PANCHAGARH', expectedWorkspaceVal: 'PANCHAGARH' },
    { field: 'mother_country_of_birth', pdfVal: 'BANGLADESH', extractedVal: 'BANGLADESH', normalizedVal: 'BANGLADESH', expectedWorkspaceVal: 'BANGLADESH' },
    { field: 'marital_status', pdfVal: 'MARRIED', extractedVal: 'Married', normalizedVal: 'Married', expectedWorkspaceVal: 'Married' },
    { field: 'spouse_name', pdfVal: 'LIPA ROY', extractedVal: 'LIPA ROY', normalizedVal: 'LIPA ROY', expectedWorkspaceVal: 'LIPA ROY' },
    { field: 'spouse_nationality', pdfVal: 'BANGLADESH', extractedVal: 'BANGLADESH', normalizedVal: 'BANGLADESH', expectedWorkspaceVal: 'BANGLADESH' },
    { field: 'spouse_prev_nationality', pdfVal: 'BANGLADESH', extractedVal: 'BANGLADESH', normalizedVal: 'BANGLADESH', expectedWorkspaceVal: 'BANGLADESH' },
    { field: 'spouse_place_of_birth', pdfVal: 'PANCHAGARH', extractedVal: 'PANCHAGARH', normalizedVal: 'PANCHAGARH', expectedWorkspaceVal: 'PANCHAGARH' },
    { field: 'spouse_country_of_birth', pdfVal: 'BANGLADESH', extractedVal: 'BANGLADESH', normalizedVal: 'BANGLADESH', expectedWorkspaceVal: 'BANGLADESH' },
    { field: 'grandparent_flag', pdfVal: 'NO', extractedVal: 'false', normalizedVal: 'false', expectedWorkspaceVal: 'No' },
    { field: 'occupation', pdfVal: 'FARMER', extractedVal: 'FARMER', normalizedVal: 'FARMER', expectedWorkspaceVal: 'FARMER' },
    { field: 'empname', pdfVal: 'KHOKON CHANDRA ROY', extractedVal: 'KHOKON CHANDRA ROY', normalizedVal: 'KHOKON CHANDRA ROY', expectedWorkspaceVal: 'KHOKON CHANDRA ROY' },
    { field: 'empdesignation', pdfVal: 'FARMER', extractedVal: 'FARMER', normalizedVal: 'FARMER', expectedWorkspaceVal: 'FARMER' },
    { field: 'empaddress', pdfVal: 'PANCHAGARH', extractedVal: 'PANCHAGARH', normalizedVal: 'PANCHAGARH', expectedWorkspaceVal: 'PANCHAGARH' },
    { field: 'empphone', pdfVal: '01740572545', extractedVal: '01740572545', normalizedVal: '01740572545', expectedWorkspaceVal: '01740572545' },
    { field: 'prev_org', pdfVal: 'NO', extractedVal: 'false', normalizedVal: 'false', expectedWorkspaceVal: 'No' },
    { field: 'duration', pdfVal: '12 Month', extractedVal: '12', normalizedVal: '12', expectedWorkspaceVal: '12' },
    { field: 'visa_entry_id', pdfVal: 'MULTIPLE', extractedVal: 'Multiple', normalizedVal: 'Multiple', expectedWorkspaceVal: 'Multiple' },
    { field: 'journeydate', pdfVal: '16-SEP-2026', extractedVal: '2026-09-16', normalizedVal: '2026-09-16', expectedWorkspaceVal: '16/09/2026' },
    { field: 'appl.journeydate', pdfVal: '16-SEP-2026', extractedVal: '2026-09-16', normalizedVal: '2026-09-16', expectedWorkspaceVal: '16/09/2026' },
    { field: 'entrypoint', pdfVal: 'BY ROAD PHULBARI', extractedVal: 'BY ROAD PHULBARI', normalizedVal: 'BY ROAD PHULBARI', expectedWorkspaceVal: 'BY ROAD PHULBARI' },
    { field: 'exitpoint', pdfVal: 'BY ROAD PHULBARI', extractedVal: 'BY ROAD PHULBARI', normalizedVal: 'BY ROAD PHULBARI', expectedWorkspaceVal: 'BY ROAD PHULBARI' },
    { field: 'old_visa_flag', pdfVal: 'NO', extractedVal: 'false', normalizedVal: 'false', expectedWorkspaceVal: 'No' },
    { field: 'nameofsponsor_ind', pdfVal: 'VICEROY BOUTIQUE HOTEL', extractedVal: 'VICEROY BOUTIQUE HOTEL', normalizedVal: 'VICEROY BOUTIQUE HOTEL', expectedWorkspaceVal: 'VICEROY BOUTIQUE HOTEL' },
    { field: 'add1ofsponsor_ind', pdfVal: 'CHINAR PARK, ATGHARA, TEGHARIA, RAJARHAT', extractedVal: 'CHINAR PARK, ATGHARA, TEGHARIA, RAJARHAT', normalizedVal: 'CHINAR PARK, ATGHARA, TEGHARIA, RAJARHAT', expectedWorkspaceVal: 'CHINAR PARK, ATGHARA, TEGHARIA, RAJARHAT' },
    { field: 'phoneofsponsor_ind', pdfVal: '919831079293', extractedVal: '919831079293', normalizedVal: '919831079293', expectedWorkspaceVal: '919831079293' },
    { field: 'nameofsponsor_msn', pdfVal: 'LIPA ROY', extractedVal: 'LIPA ROY', normalizedVal: 'LIPA ROY', expectedWorkspaceVal: 'LIPA ROY' },
    { field: 'add1ofsponsor_msn', pdfVal: 'SOHDHANI PARA, BENGHARI, 04', extractedVal: 'SOHDHANI PARA, BENGHARI, 04', normalizedVal: 'SOHDHANI PARA, BENGHARI, 04', expectedWorkspaceVal: 'SOHDHANI PARA, BENGHARI, 04' },
    { field: 'phoneofsponsor_msn', pdfVal: '01786703170', extractedVal: '01786703170', normalizedVal: '01786703170', expectedWorkspaceVal: '01786703170' },
    { field: 'question_2_flag', pdfVal: 'NO', extractedVal: 'false', normalizedVal: 'false', expectedWorkspaceVal: 'No' },
  ]

  const auditTable: AuditRow[] = []

  console.log('\n--- FIELD-BY-FIELD EXTRACTION AUDIT (Khokon WEB 27.pdf) ---')
  console.log('FIELD'.padEnd(28) + 'PDF VALUE'.padEnd(30) + 'WORKSPACE VALUE'.padEnd(30) + 'STATUS')
  console.log('-'.repeat(95))

  for (const exp of auditExpectations) {
    const actualWorkspaceVal = String(savedApp.fields[exp.field]?.value ?? '')
    const isPass = actualWorkspaceVal.toUpperCase() === exp.expectedWorkspaceVal.toUpperCase() ||
      (exp.expectedWorkspaceVal === 'false' && (actualWorkspaceVal === 'false' || actualWorkspaceVal === 'false')) ||
      (exp.expectedWorkspaceVal === 'No' && actualWorkspaceVal === 'No')

    const status: 'PASS' | 'MISSING' | 'MISMATCH' = isPass
      ? 'PASS'
      : actualWorkspaceVal === ''
      ? 'MISSING'
      : 'MISMATCH'

    auditTable.push({
      field: exp.field,
      pdfValue: exp.pdfVal,
      extractedValue: exp.extractedVal,
      normalizedValue: exp.normalizedVal,
      finalWorkspaceValue: actualWorkspaceVal,
      status,
    })

    console.log(
      exp.field.padEnd(28) +
      exp.pdfVal.substring(0, 28).padEnd(30) +
      actualWorkspaceVal.substring(0, 28).padEnd(30) +
      status
    )

    assert(status === 'PASS', `Field ${exp.field} matches expected workspace value "${exp.expectedWorkspaceVal}" (got "${actualWorkspaceVal}")`)
  }

  // 4. Assert genuinely empty fields remain blank
  const genuinelyBlankFields = [
    'appl.oth_pptno',
    'appl.oth_ppt_issue_place',
    'appl.prev_passport_country_issue',
    'appl.other_ppt_nationality',
    'previous_occupation',
    'previous_organization',
    'previous_designation',
    'previous_rank',
    'previous_posting',
    'old_visa_no',
    'old_visa_type_id',
    'oldvisaissueplace',
    'oldvisaissuedate',
    'prv_visit_add1',
    'prv_visit_add2',
    'prv_visit_add3',
    'grandparent_details',
  ]

  for (const blankField of genuinelyBlankFields) {
    const val = String(savedApp.fields[blankField]?.value ?? '')
    assert(val === '', `Genuinely empty PDF field ${blankField} remains empty string (got "${val}")`)
  }

  // 5. Precedence Test: Passport Document Authority Over OGD for Current Identity
  const passportDoc: DocumentRecord = {
    documentId: 'doc_passport_khokon_primary',
    applicantId: 'KHOKON_APP_001',
    documentType: 'passport',
    fileName: 'Passport_Khokon_New.pdf',
    fileSize: 180000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedData: {
      personal: {
        lastName: { value: 'ROY', source: 'mrz', confidence: 98 },
        firstName: { value: 'KHOKON CHANDRA', source: 'mrz', confidence: 98 },
        dateOfBirth: { value: '1989-05-15', source: 'mrz', confidence: 98 },
        nationality: { value: 'BANGLADESH', source: 'mrz', confidence: 98 },
      },
      passport: {
        passportNumber: { value: 'B99887766', source: 'mrz', confidence: 98 },
        placeOfIssue: { value: 'DHAKA DIP', source: 'pdf-text', confidence: 95 },
        issueDate: { value: '2024-01-01', source: 'pdf-text', confidence: 95 },
        expiryDate: { value: '2034-01-01', source: 'pdf-text', confidence: 95 },
      },
    },
    extractedDataConfirmed: true,
  }

  const dualDocApp = populateApplicationFromDocuments({
    applicantId: 'KHOKON_APP_001',
    passportDoc,
    ogdDoc,
    existingApp: null,
  })

  // Identity should come from Passport document
  assert(dualDocApp.fields['appl.surname']?.value === 'ROY', 'Precedence: Passport document surname overrides OGD')
  assert(dualDocApp.fields['appl.applname']?.value === 'KHOKON CHANDRA', 'Precedence: Passport document given name overrides OGD')
  assert(dualDocApp.fields['appl.passport_number']?.value === 'B99887766', 'Precedence: Passport document number overrides OGD')
  assert(dualDocApp.fields['appl.passport_number']?.source === 'passport', 'Source provenance is passport for identity')

  // Historical / Non-identity fields must still be supplied by OGD
  assert(dualDocApp.fields['fthrname']?.value === 'POBETRA KUMER', 'Precedence: OGD still supplies father name')
  assert(dualDocApp.fields['fthrname']?.source === 'ogd', 'Source provenance is ogd for family')
  assert(dualDocApp.fields['occupation']?.value === 'FARMER', 'Precedence: OGD still supplies occupation')
  assert(dualDocApp.fields['nameofsponsor_ind']?.value === 'VICEROY BOUTIQUE HOTEL', 'Precedence: OGD still supplies India reference')

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
    auditTable,
  }
}
