import { saveDraft } from '../storage/draftDb'
import { populateApplicationFromDocuments } from '../application/applicationMerger'
import type { SavedApplication } from '../application/types'
import type { DocumentRecord } from '../document/types'
import type { AuthUser } from '../auth/types'
import { extractPdfText } from '../extraction/pdf/pdfTextExtractor'
import { extractFromPdfText } from '../extraction/data/applicantDataExtractor'
import { processUploadedDocumentPayload, hasAnyFields } from '../extraction/pipeline'
import { readFileAsDataUrl } from './passportUploadWorkflow'

export interface ExecuteOgdExtractionWorkflowOptions {
  file: File | Blob
  user: AuthUser | null
  existingApp?: SavedApplication | null
  onProgress?: (status: string) => void
  navigateWorkspace: (draftId: string) => void
  timeoutMs?: number
}

export interface OgdExtractionWorkflowResult {
  draftId: string
  savedApplication: SavedApplication
  document: DocumentRecord
}

/**
 * Single async workflow for OGD PDF upload -> extraction ->
 * normalization -> persistence -> Workspace navigation.
 */
export async function executeOgdExtractionWorkflow(
  options: ExecuteOgdExtractionWorkflowOptions
): Promise<OgdExtractionWorkflowResult> {
  const {
    file,
    user,
    existingApp,
    onProgress,
    navigateWorkspace,
    timeoutMs = 65000,
  } = options

  // 1. Validate User Authentication
  if (!user) {
    throw new Error('Please sign in with Google to start document extraction.')
  }

  // 2. Validate PDF file
  if (!file) {
    throw new Error('No OGD file was provided for extraction.')
  }

  const fileName = 'name' in file && typeof file.name === 'string' ? file.name : 'ogd_application.pdf'
  const mimeType = file.type || 'application/pdf'

  const isPdf =
    mimeType === 'application/pdf' ||
    fileName.toLowerCase().endsWith('.pdf')

  if (!isPdf) {
    throw new Error('OGD extraction requires a PDF document. Please upload a PDF file.')
  }

  if (file.size === 0) {
    throw new Error('The selected PDF file is empty (0 bytes). Please upload a valid OGD PDF.')
  }

  // 3. Read PDF file payload as Data URL
  onProgress?.('Reading OGD application PDF...')
  const dataUrl = await readFileAsDataUrl(file)

  // 4. Extract data from OGD
  onProgress?.('Extracting data from OGD application...')

  let extractedApplicant: any = null

  // Fast path: Extract text using PDF.js
  try {
    const pdfTextRes = await extractPdfText(dataUrl)
    if (pdfTextRes.success && pdfTextRes.fullText && pdfTextRes.fullText.trim().length > 30) {
      const parsedData = extractFromPdfText(pdfTextRes.fullText)
      if (hasAnyFields(parsedData)) {
        extractedApplicant = parsedData
        console.log('✅ [OGD WORKFLOW] Extracted OGD data via PDF text!')
      }
    }
  } catch (err) {
    console.warn('⚠️ [OGD WORKFLOW] PDF text extraction error, will attempt pipeline:', err)
  }

  // Fallback: If text extraction didn't yield fields (e.g. scanned image OGD), use pipeline/OCR
  if (!extractedApplicant || !hasAnyFields(extractedApplicant)) {
    onProgress?.('Extracting OGD data via OCR...')
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error('Extraction timed out. OCR service took too long to respond.'))
      }, timeoutMs)
    })

    try {
      const pipelinePromise = processUploadedDocumentPayload(dataUrl, fileName, mimeType, {
        onProgress: (p) => {
          if (p.text) onProgress?.(p.text)
        },
      })
      const pipelineResult = await Promise.race([pipelinePromise, timeoutPromise])
      if (pipelineResult.hasExtractedFields && pipelineResult.extractedData) {
        extractedApplicant = pipelineResult.extractedData
      } else if (pipelineResult.extractionError) {
        throw new Error(pipelineResult.extractionError)
      }
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
    }
  }

  // 5. Strict Validation
  if (!extractedApplicant || !hasAnyFields(extractedApplicant)) {
    throw new Error(
      'OGD extraction failed: No readable fields could be detected from this document. Please ensure it is a valid Indian Visa Online application PDF.'
    )
  }

  // 6. Build and Normalize Application Data
  onProgress?.('Building application data...')
  const applicantId =
    existingApp?.applicantId ||
    `APP_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`

  const ogdDoc: DocumentRecord = {
    documentId: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    applicantId,
    documentType: 'ogd',
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
    passportDoc: null,
    ogdDoc,
    existingApp: existingApp || null,
  })

  if (!mergedApp || !mergedApp.fields || Object.keys(mergedApp.fields).length === 0) {
    throw new Error('Failed to generate application fields from the extracted OGD data.')
  }

  // 7. Persist SavedApplication draft in IndexedDB / Memory
  onProgress?.('Saving application draft...')
  const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  await saveDraft({
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
    document: ogdDoc,
  }
}
