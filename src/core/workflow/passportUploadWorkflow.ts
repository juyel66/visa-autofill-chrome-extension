import type { DocumentRecord } from '../document/types'
import type { SavedApplication } from '../application/types'
import { processUploadedDocumentPayload } from '../extraction/pipeline'
import { populateApplicationFromDocuments } from '../application/applicationMerger'
import { saveDraft } from '../storage/draftDb'
import type { AuthUser } from '../auth/types'

export interface PassportUploadFile {
  name: string
  size: number
  type: string
  arrayBuffer?: () => Promise<ArrayBuffer>
}

export interface ExecutePassportExtractionWorkflowOptions {
  file: File | Blob | PassportUploadFile
  user: AuthUser | null
  onProgress?: (status: string) => void
  navigateWorkspace: (draftId: string) => void
  processPayload?: typeof processUploadedDocumentPayload
  saveDraftFn?: typeof saveDraft
  timeoutMs?: number
}

export interface PassportExtractionWorkflowResult {
  draftId: string
  savedApplication: SavedApplication
  document: DocumentRecord
}

/**
 * Reads a File/Blob payload into a data: URL.
 * Works in both browser DOM (FileReader) and Node.js test environments (Buffer).
 */
export async function readFileAsDataUrl(file: Blob | File | PassportUploadFile): Promise<string> {
  if (typeof FileReader !== 'undefined' && file instanceof Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read uploaded PDF file.'))
      reader.readAsDataURL(file)
    })
  }

  if (typeof (file as any).arrayBuffer === 'function') {
    const buffer = await (file as any).arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mime = file.type || 'application/pdf'
    return `data:${mime};base64,${base64}`
  }

  throw new Error('Unable to read uploaded file into a Data URL.')
}

/**
 * Authoritative single async workflow for passport PDF upload -> extraction ->
 * normalization -> persistence -> Workspace navigation.
 *
 * Enforces the strict rule that Workspace navigation occurs ONLY after:
 * 1. Extraction completed successfully.
 * 2. Valid extracted data exists.
 * 3. Required application data has been built and normalized.
 * 4. SavedApplication/draft persistence succeeded.
 * 5. No extraction error occurred.
 *
 * If ANY failure occurs, Workspace navigation is aborted, error is thrown, and
 * the user remains on the upload screen to retry.
 */
export async function executePassportExtractionWorkflow(
  options: ExecutePassportExtractionWorkflowOptions
): Promise<PassportExtractionWorkflowResult> {
  const {
    file,
    user,
    onProgress,
    navigateWorkspace,
    processPayload = processUploadedDocumentPayload,
    saveDraftFn = saveDraft,
    timeoutMs = 65000,
  } = options

  // 1. Validate User Authentication
  if (!user) {
    throw new Error('Please sign in with Google to start document extraction.')
  }

  // 2. Validate PDF file
  if (!file) {
    throw new Error('No passport file was provided for extraction.')
  }

  const fileName = 'name' in file && typeof file.name === 'string' ? file.name : 'passport.pdf'
  const mimeType = file.type || 'application/pdf'

  const isPdf =
    mimeType === 'application/pdf' ||
    fileName.toLowerCase().endsWith('.pdf')

  if (!isPdf) {
    throw new Error('Passport extraction requires a PDF document. Please upload a PDF file.')
  }

  if (file.size === 0) {
    throw new Error('The selected PDF file is empty (0 bytes). Please upload a valid passport PDF.')
  }

  // 3. Read PDF file payload as Data URL
  onProgress?.('Reading passport PDF...')
  const dataUrl = await readFileAsDataUrl(file)

  // 4. Execute extraction pipeline with timeout
  onProgress?.('Extracting passport data with Python OCR...')
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new Error(
          'Extraction timed out. Local Python OCR service took too long to respond. Please check if Python server is running on port 8001.'
        )
      )
    }, timeoutMs)
  })

  let pipelineResult: Awaited<ReturnType<typeof processUploadedDocumentPayload>>
  try {
    const pipelinePromise = processPayload(dataUrl, fileName, mimeType, {
      onProgress: (p) => {
        if (p.text) {
          onProgress?.(p.text)
        }
      },
    })
    pipelineResult = await Promise.race([pipelinePromise, timeoutPromise])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }

  // 5. Strict Validation of Extraction Result
  if (pipelineResult.extractionError) {
    throw new Error(pipelineResult.extractionError)
  }

  if (!pipelineResult.hasExtractedFields || !pipelineResult.extractedData) {
    throw new Error(
      'Passport extraction failed: No readable fields could be detected from the PDF. Please ensure the document is clear and readable, or check if the Python OCR service is running.'
    )
  }

  const extractedApplicant = pipelineResult.extractedData
  if (
    !extractedApplicant ||
    typeof extractedApplicant !== 'object' ||
    Object.keys(extractedApplicant).length === 0
  ) {
    throw new Error('Passport extraction returned an invalid or empty data structure.')
  }

  // 6. Build and Normalize Application Data
  onProgress?.('Building application data...')
  const applicantId = `APP_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`

  const newDoc: DocumentRecord = {
    documentId: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    applicantId,
    documentType: 'passport',
    fileName,
    fileSize: file.size,
    mimeType,
    fileDataUrl: dataUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'processed',
    source: 'user-upload',
    extractedDataConfirmed: true,
    extractedData: extractedApplicant,
  }

  const mergedApp = populateApplicationFromDocuments({
    applicantId,
    passportDoc: newDoc,
    ogdDoc: null,
    existingApp: null,
  })

  if (!mergedApp || !mergedApp.fields || Object.keys(mergedApp.fields).length === 0) {
    throw new Error('Failed to generate application fields from the extracted passport data.')
  }

  // 7. Persist SavedApplication draft in IndexedDB / Memory
  onProgress?.('Saving application draft...')
  const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  await saveDraftFn({
    draftId,
    savedApplication: mergedApp,
    pdfBlob: (file instanceof Blob ? file : undefined) || null,
    pdfFileName: fileName,
    pdfMimeType: mimeType,
    createdAt: Date.now(),
  })

  // 8. STRICT SUCCESS PATH ONLY: Navigate / open Workspace tab
  onProgress?.('Opening Workspace...')
  navigateWorkspace(draftId)

  return {
    draftId,
    savedApplication: mergedApp,
    document: newDoc,
  }
}
