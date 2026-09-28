import assert from 'node:assert'
import { pruneExcessDocumentPayloads } from '../documentStorage'
import type { DocumentRecord } from '../types'

console.log('--- RUNNING STORAGE QUOTA RESILIENCE TESTS ---')

// 1. Test pruning of older document payloads
const sampleDocs: DocumentRecord[] = [
  {
    documentId: 'doc_1',
    applicantId: 'app_1',
    documentType: 'passport',
    fileName: 'old_passport.pdf',
    fileSize: 1024000,
    mimeType: 'application/pdf',
    fileDataUrl: 'data:application/pdf;base64,OLD_HEAVY_BASE64_DATA_1',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: {
      passport: {
        passportNumber: { value: 'A12345678', source: 'passport' },
      },
    } as any,
  },
  {
    documentId: 'doc_2',
    applicantId: 'app_1',
    documentType: 'passport',
    fileName: 'new_passport.pdf',
    fileSize: 2048000,
    mimeType: 'application/pdf',
    fileDataUrl: 'data:application/pdf;base64,NEW_HEAVY_BASE64_DATA_2',
    createdAt: '2026-01-02T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: {
      passport: {
        passportNumber: { value: 'B98765432', source: 'passport' },
      },
    } as any,
  },
  {
    documentId: 'doc_3',
    applicantId: 'app_1',
    documentType: 'ogd',
    fileName: 'ogd_doc.pdf',
    fileSize: 512000,
    mimeType: 'application/pdf',
    fileDataUrl: 'data:application/pdf;base64,OGD_BASE64_DATA',
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
  },
]

const pruned = pruneExcessDocumentPayloads(sampleDocs)

// doc_2 is the latest passport -> must keep fileDataUrl
const doc2 = pruned.find((d) => d.documentId === 'doc_2')
assert.strictEqual(doc2?.fileDataUrl, 'data:application/pdf;base64,NEW_HEAVY_BASE64_DATA_2', 'Latest passport must keep fileDataUrl')
assert.strictEqual(doc2?.extractedData?.passport?.passportNumber?.value, 'B98765432', 'Latest passport extracted data must remain intact')

// doc_1 is the older passport -> must have fileDataUrl stripped to prevent quota overflow
const doc1 = pruned.find((d) => d.documentId === 'doc_1')
assert.strictEqual(doc1?.fileDataUrl, undefined, 'Older passport must have fileDataUrl stripped')
assert.strictEqual(doc1?.extractedData?.passport?.passportNumber?.value, 'A12345678', 'Older passport extracted data must still be preserved!')
assert.strictEqual(doc1?.fileName, 'old_passport.pdf', 'Older passport metadata must still be preserved!')

// doc_3 is the latest (and only) ogd -> must keep fileDataUrl
const doc3 = pruned.find((d) => d.documentId === 'doc_3')
assert.strictEqual(doc3?.fileDataUrl, 'data:application/pdf;base64,OGD_BASE64_DATA', 'Only OGD doc must keep fileDataUrl')

console.log('✅ ALL STORAGE QUOTA RESILIENCE TESTS PASSED!')
