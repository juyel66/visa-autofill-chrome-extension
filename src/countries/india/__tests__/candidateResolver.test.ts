import { resolveCandidateData } from '../../../core/autofill/candidateResolver'
import type { DocumentRecord } from '../../../core/document/types'
import { BANGLADESH_VISA_MAPPINGS } from '../mappings/bangladeshVisa'

export interface CandidateResolverTestResult {
  passed: boolean
  totalSubtests: number
  failures: string[]
}

export function runCandidateResolverTests(): CandidateResolverTestResult {
  const failures: string[] = []
  let totalSubtests = 0

  const validPassportDoc: DocumentRecord = {
    documentId: 'doc-pass-001',
    applicantId: 'profile-001',
    documentType: 'passport',
    fileName: 'Passport-John.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024 * 1024,
    status: 'processed',
    source: 'user-upload',
    createdAt: '2026-08-20T00:00:00Z',
    updatedAt: '2026-08-20T00:00:00Z',
    extractedDataConfirmed: true,
    extractedData: {
      personal: {
        firstName: { value: 'JOHN', confidence: 0.99, source: 'pdf-text' },
        lastName: { value: 'DOE', confidence: 0.99, source: 'pdf-text' },
        dateOfBirth: { value: '1992-05-15', confidence: 0.99, source: 'pdf-text' },
        gender: { value: 'male', confidence: 0.99, source: 'pdf-text' },
        nationality: { value: 'BGD', confidence: 0.99, source: 'pdf-text' },
        townCityOfBirth: { value: 'Dhaka', confidence: 0.99, source: 'pdf-text' },
        countryOfBirth: { value: 'Bangladesh', confidence: 0.99, source: 'pdf-text' },
      },
      passport: {
        passportNumber: { value: 'A12345678', confidence: 0.99, source: 'pdf-text' },
        issuingCountry: { value: 'BGD', confidence: 0.99, source: 'pdf-text' },
        issueDate: { value: '2020-01-01', confidence: 0.99, source: 'pdf-text' },
        expiryDate: { value: '2030-01-01', confidence: 0.99, source: 'pdf-text' },
        placeOfIssue: { value: 'DHAKA', confidence: 0.99, source: 'pdf-text' },
      },
    },
  }

  const unconfirmedPassportDoc: DocumentRecord = {
    ...validPassportDoc,
    documentId: 'doc-pass-unconfirmed',
    extractedDataConfirmed: false,
  }

  const photoDoc: DocumentRecord = {
    documentId: 'doc-photo-001',
    applicantId: 'profile-001',
    documentType: 'photograph',
    fileName: 'Photo.jpg',
    mimeType: 'image/jpeg',
    fileSize: 500 * 1024,
    status: 'processed',
    source: 'user-upload',
    createdAt: '2026-08-20T00:00:00Z',
    updatedAt: '2026-08-20T00:00:00Z',
    extractedDataConfirmed: true,
    extractedData: {
      personal: {
        firstName: { value: 'PHOTO_NAME', confidence: 0.1, source: 'ocr' },
      },
    },
  }

  const otherDoc: DocumentRecord = {
    documentId: 'doc-other-001',
    applicantId: 'profile-001',
    documentType: 'other',
    fileName: 'Other.pdf',
    mimeType: 'application/pdf',
    fileSize: 300 * 1024,
    status: 'processed',
    source: 'user-upload',
    createdAt: '2026-08-20T00:00:00Z',
    updatedAt: '2026-08-20T00:00:00Z',
    extractedDataConfirmed: true,
  }

  const otherProfileDoc: DocumentRecord = {
    ...validPassportDoc,
    documentId: 'doc-pass-other',
    applicantId: 'profile-999',
  }

  // Regression Test 1: Confirmed PDF DOB is used
  totalSubtests++
  const res1 = resolveCandidateData({
    profileId: 'profile-001',
    documents: [validPassportDoc],
  })
  if (res1.status !== 'READY' || res1.applicant?.personalInfo?.dateOfBirth !== '1992-05-15') {
    failures.push(`Test 1 Failed: Expected DOB 1992-05-15 from confirmed PDF, got ${res1.applicant?.personalInfo?.dateOfBirth}`)
  }

  // Regression Test 2: Profile DOB is never used as fallback
  totalSubtests++
  const docNoDob: DocumentRecord = {
    ...validPassportDoc,
    documentId: 'doc-no-dob',
    extractedData: {
      ...validPassportDoc.extractedData,
      personal: {
        ...validPassportDoc.extractedData?.personal,
        dateOfBirth: undefined,
      },
    },
  }
  const res2 = resolveCandidateData({
    profileId: 'profile-001',
    requestedDocumentId: 'doc-no-dob',
    documents: [docNoDob],
  })
  if (res2.applicant?.personalInfo?.dateOfBirth !== undefined) {
    failures.push(`Test 2 Failed: Profile DOB should never be used as fallback; expected undefined, got ${res2.applicant?.personalInfo?.dateOfBirth}`)
  }

  // Regression Test 3: Confirmed PDF passport number is used
  totalSubtests++
  if (res1.applicant?.passport?.passportNumber !== 'A12345678') {
    failures.push(`Test 3 Failed: Expected passport number A12345678 from confirmed PDF, got ${res1.applicant?.passport?.passportNumber}`)
  }

  // Regression Test 4: Profile passport number is never used as fallback
  totalSubtests++
  const docNoPassport: DocumentRecord = {
    ...validPassportDoc,
    documentId: 'doc-no-passport',
    extractedData: {
      ...validPassportDoc.extractedData,
      passport: {
        ...validPassportDoc.extractedData?.passport,
        passportNumber: undefined,
      },
    },
  }
  const res4 = resolveCandidateData({
    profileId: 'profile-001',
    requestedDocumentId: 'doc-no-passport',
    documents: [docNoPassport],
  })
  if (res4.applicant?.passport?.passportNumber !== undefined) {
    failures.push(`Test 4 Failed: Profile passport number should never be used as fallback; expected undefined, got ${res4.applicant?.passport?.passportNumber}`)
  }

  // Regression Test 5: Confirmed PDF nationality is used
  totalSubtests++
  if (res1.applicant?.personalInfo?.nationality !== 'BGD') {
    failures.push(`Test 5 Failed: Expected nationality BGD from confirmed PDF, got ${res1.applicant?.personalInfo?.nationality}`)
  }

  // Regression Test 6: Profile nationality is never used as fallback
  totalSubtests++
  const docNoNat: DocumentRecord = {
    ...validPassportDoc,
    documentId: 'doc-no-nat',
    extractedData: {
      ...validPassportDoc.extractedData,
      personal: {
        ...validPassportDoc.extractedData?.personal,
        nationality: undefined,
      },
    },
  }
  const res6 = resolveCandidateData({
    profileId: 'profile-001',
    requestedDocumentId: 'doc-no-nat',
    documents: [docNoNat],
  })
  if (res6.applicant?.personalInfo?.nationality !== undefined) {
    failures.push(`Test 6 Failed: Profile nationality should never be used as fallback; expected undefined, got ${res6.applicant?.personalInfo?.nationality}`)
  }

  // Regression Test 7: Confirmed PDF name is used (givenNames & surname)
  totalSubtests++
  if (res1.applicant?.personalInfo?.givenNames !== 'JOHN' || res1.applicant?.personalInfo?.surname !== 'DOE') {
    failures.push(`Test 7 Failed: Expected name JOHN DOE from confirmed PDF, got ${res1.applicant?.personalInfo?.givenNames} ${res1.applicant?.personalInfo?.surname}`)
  }

  // Regression Test 8: Missing PDF DOB yields undefined (requiring manual input on form)
  totalSubtests++
  if (res2.applicant?.personalInfo?.dateOfBirth !== undefined) {
    failures.push('Test 8 Failed: Missing PDF DOB must be undefined / manual-required.')
  }

  // Regression Test 9: Missing PDF passport number yields undefined (requiring manual input on form)
  totalSubtests++
  if (res4.applicant?.passport?.passportNumber !== undefined) {
    failures.push('Test 9 Failed: Missing PDF passport number must be undefined / manual-required.')
  }

  // Regression Test 10: Unconfirmed extraction blocks autofill data resolution (returns REVIEW_REQUIRED)
  totalSubtests++
  const res10 = resolveCandidateData({
    profileId: 'profile-001',
    documents: [unconfirmedPassportDoc],
  })
  if (res10.status !== 'REVIEW_REQUIRED' || res10.applicant !== undefined) {
    failures.push(`Test 10 Failed: Unconfirmed extraction must return REVIEW_REQUIRED with no applicant data, got ${res10.status}`)
  }

  // Regression Test 11: Confirmed extraction enables autofill data resolution (returns READY)
  totalSubtests++
  const res11 = resolveCandidateData({
    profileId: 'profile-001',
    documents: [validPassportDoc],
  })
  if (res11.status !== 'READY' || !res11.applicant) {
    failures.push(`Test 11 Failed: Confirmed extraction must return READY, got ${res11.status}`)
  }

  // Regression Test 12: Candidate data from another profile is rejected (returns NOT_READY)
  totalSubtests++
  const res12 = resolveCandidateData({
    profileId: 'profile-001',
    requestedDocumentId: 'doc-pass-other',
    documents: [otherProfileDoc],
  })
  if (res12.status !== 'NOT_READY') {
    failures.push(`Test 12 Failed: Candidate data from another profile was not rejected, got status ${res12.status}`)
  }

  // Regression Test 13: Candidate data from another / non-existent document is rejected
  totalSubtests++
  const res13 = resolveCandidateData({
    profileId: 'profile-001',
    requestedDocumentId: 'non-existent-doc',
    documents: [validPassportDoc],
  })
  if (res13.status !== 'NOT_READY') {
    failures.push(`Test 13 Failed: Non-existent documentId should return NOT_READY, got ${res13.status}`)
  }

  // Regression Test 14: Correct passport document is selected among multiple documents (Passport vs Other vs Photo)
  totalSubtests++
  const res14 = resolveCandidateData({
    profileId: 'profile-001',
    documents: [otherDoc, photoDoc, validPassportDoc],
  })
  if (res14.status !== 'READY' || res14.provenance?.documentId !== 'doc-pass-001') {
    failures.push(`Test 14 Failed: Passport document was not selected over photo and other docs. Got ${res14.provenance?.documentId}`)
  }

  // Regression Test 15: Stale / previous candidate data is not reused across profiles/sessions
  totalSubtests++
  const res15 = resolveCandidateData({
    profileId: 'profile-002', // Profile 002 has no documents
    documents: [validPassportDoc],
  })
  if (res15.status === 'READY' || res15.applicant !== undefined) {
    failures.push('Test 15 Failed: Candidate data from previous profile was reused for different profileId.')
  }

  // Regression Test 16: No partial PDF autofill occurs before confirmation
  totalSubtests++
  const res16 = resolveCandidateData({
    profileId: 'profile-001',
    requestedDocumentId: 'doc-pass-unconfirmed',
    documents: [unconfirmedPassportDoc],
  })
  if (res16.status !== 'REVIEW_REQUIRED' || res16.applicant !== undefined) {
    failures.push('Test 16 Failed: Unconfirmed document must never return partial applicant data.')
  }

  // Regression Test 17: Incompatible document category returns COMPATIBLE_DOCUMENT_REQUIRED
  totalSubtests++
  const res17 = resolveCandidateData({
    profileId: 'profile-001',
    requestedDocumentId: 'doc-photo-001',
    preferredDocumentType: 'passport',
    documents: [photoDoc],
  })
  if (res17.status !== 'COMPATIBLE_DOCUMENT_REQUIRED') {
    failures.push(`Test 17 Failed: Incompatible document category should return COMPATIBLE_DOCUMENT_REQUIRED, got ${res17.status}`)
  }

  // Regression Test 18: Provenance metadata contains profileId, documentId, and sourceType 'confirmed-document'
  totalSubtests++
  if (
    !res11.provenance ||
    res11.provenance.profileId !== 'profile-001' ||
    res11.provenance.documentId !== 'doc-pass-001' ||
    res11.provenance.sourceType !== 'confirmed-document'
  ) {
    failures.push('Test 18 Failed: Provenance metadata missing or incorrect.')
  }

  // Regression Test 19: Missing registration-specific fields (email, arrival date) yield undefined without fake data
  totalSubtests++
  if (res11.applicant?.contact?.email !== undefined || res11.applicant?.travel?.intendedArrivalDate !== undefined) {
    failures.push('Test 19 Failed: Missing registration fields should be undefined without fake data.')
  }

  // Regression Test 20: CAPTCHA mapping remains strictly manual
  totalSubtests++
  const captchaMap = BANGLADESH_VISA_MAPPINGS.find((m) => m.targetField === 'captcha')
  if (!captchaMap || captchaMap.sourceType !== 'manual') {
    failures.push('Test 20 Failed: CAPTCHA mapping must remain sourceType: manual.')
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
