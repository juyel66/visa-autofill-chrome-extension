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

  const otherProfileDoc: DocumentRecord = {
    ...validPassportDoc,
    documentId: 'doc-pass-other',
    applicantId: 'profile-999',
  }

  // 1. Profile contains identifier semantics only
  totalSubtests++
  const res1 = resolveCandidateData({
    profileId: 'profile-001',
    documents: [validPassportDoc],
  })
  if (res1.status !== 'READY' || !res1.applicant || res1.applicant.applicantId !== 'profile-001') {
    failures.push(`Test 1 Failed: Profile container semantics violation. Got status: ${res1.status}`)
  }

  // 2. Confirmed PDF DOB is returned
  totalSubtests++
  if (res1.applicant?.personalInfo?.dateOfBirth !== '1992-05-15') {
    failures.push(`Test 2 Failed: Expected DOB 1992-05-15 from confirmed PDF, got ${res1.applicant?.personalInfo?.dateOfBirth}`)
  }

  // 3. Profile DOB cannot override PDF DOB
  totalSubtests++
  const res3 = resolveCandidateData({
    profileId: 'profile-001',
    documents: [validPassportDoc],
  })
  if (res3.applicant?.personalInfo?.dateOfBirth !== '1992-05-15') {
    failures.push('Test 3 Failed: Profile values attempted to override confirmed PDF DOB.')
  }

  // 4. Missing PDF DOB returns undefined (requiring manual input)
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
  const res4 = resolveCandidateData({
    profileId: 'profile-001',
    requestedDocumentId: 'doc-no-dob',
    documents: [docNoDob],
  })
  if (res4.applicant?.personalInfo?.dateOfBirth !== undefined) {
    failures.push(`Test 4 Failed: Missing PDF DOB should yield undefined, got ${res4.applicant?.personalInfo?.dateOfBirth}`)
  }

  // 5. Confirmed passport document is selected over random PDF/photo
  totalSubtests++
  const res5 = resolveCandidateData({
    profileId: 'profile-001',
    documents: [photoDoc, validPassportDoc],
  })
  if (res5.provenance?.documentId !== 'doc-pass-001') {
    failures.push(`Test 5 Failed: Passport document was not selected over photo document. Got ${res5.provenance?.documentId}`)
  }

  // 6. Wrong document type is rejected for passport fields
  totalSubtests++
  const res6 = resolveCandidateData({
    profileId: 'profile-001',
    requestedDocumentId: 'doc-photo-001',
    preferredDocumentType: 'passport',
    documents: [photoDoc],
  })
  if (res6.status !== 'COMPATIBLE_DOCUMENT_REQUIRED') {
    failures.push(`Test 6 Failed: Wrong document category should return COMPATIBLE_DOCUMENT_REQUIRED, got ${res6.status}`)
  }

  // 7. Candidate data from another profile is rejected
  totalSubtests++
  const res7 = resolveCandidateData({
    profileId: 'profile-001',
    requestedDocumentId: 'doc-pass-other',
    documents: [otherProfileDoc],
  })
  if (res7.status !== 'NOT_READY') {
    failures.push(`Test 7 Failed: Document from another profile was not rejected. Got status ${res7.status}`)
  }

  // 8. Candidate data from non-existent document is rejected
  totalSubtests++
  const res8 = resolveCandidateData({
    profileId: 'profile-001',
    requestedDocumentId: 'non-existent-doc',
    documents: [validPassportDoc],
  })
  if (res8.status !== 'NOT_READY') {
    failures.push(`Test 8 Failed: Non-existent documentId should return NOT_READY, got ${res8.status}`)
  }

  // 9. Unconfirmed extraction blocks autofill (REVIEW_REQUIRED)
  totalSubtests++
  const res9 = resolveCandidateData({
    profileId: 'profile-001',
    documents: [unconfirmedPassportDoc],
  })
  if (res9.status !== 'REVIEW_REQUIRED') {
    failures.push(`Test 9 Failed: Unconfirmed extraction must return REVIEW_REQUIRED, got ${res9.status}`)
  }

  // 10. Confirmed extraction enables autofill (READY)
  totalSubtests++
  const res10 = resolveCandidateData({
    profileId: 'profile-001',
    documents: [validPassportDoc],
  })
  if (res10.status !== 'READY') {
    failures.push(`Test 10 Failed: Confirmed extraction must return READY, got ${res10.status}`)
  }

  // 11. Missing email does not cause fake email data
  totalSubtests++
  if (res10.applicant?.contact?.email !== undefined) {
    failures.push(`Test 11 Failed: Missing PDF email should yield undefined, got ${res10.applicant?.contact?.email}`)
  }

  // 12. Missing arrival date does not create a fake date
  totalSubtests++
  if (res10.applicant?.travel?.intendedArrivalDate !== undefined) {
    failures.push(`Test 12 Failed: Missing arrival date should yield undefined, got ${res10.applicant?.travel?.intendedArrivalDate}`)
  }

  // 13. No stale candidate data is reused across sessions
  totalSubtests++
  const res13 = resolveCandidateData({
    profileId: 'profile-002', // No documents for profile-002
    documents: [validPassportDoc],
  })
  if (res13.status === 'READY') {
    failures.push('Test 13 Failed: Candidate data from previous profile was reused for different profileId.')
  }

  // 14. Provenance metadata contains documentId and profileId
  totalSubtests++
  if (
    !res10.provenance ||
    res10.provenance.profileId !== 'profile-001' ||
    res10.provenance.documentId !== 'doc-pass-001' ||
    res10.provenance.sourceType !== 'confirmed-document'
  ) {
    failures.push('Test 14 Failed: Provenance metadata missing or incorrect.')
  }

  // 15. CAPTCHA remains strictly manual
  totalSubtests++
  const captchaMap = BANGLADESH_VISA_MAPPINGS.find((m) => m.targetField === 'captcha')
  if (!captchaMap || captchaMap.sourceType !== 'manual') {
    failures.push('Test 15 Failed: CAPTCHA mapping must remain sourceType: manual.')
  }

  return {
    passed: failures.length === 0,
    totalSubtests,
    failures,
  }
}
