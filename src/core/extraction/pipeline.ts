import { mergeExtractedCandidateData } from './data/applicantDataExtractor'
import {
  extractPassportWithPython,
  mapPythonResultToExtractedApplicant,
  PythonExtractorError,
} from './local/pythonExtractorClient'
import type { ExtractedApplicantData } from './data/types'

export interface ProcessDocumentPipelineOptions {
  onProgress?: (progress: { percent: number; text: string }) => void
  maxPdfPages?: number
  ocrScale?: number
  apiKey?: string
  modelName?: string
  forceAi?: boolean
  forceOcr?: boolean
  mode?: 'auto' | 'fast' | 'ai' | 'python'
}

export interface ProcessDocumentPipelineResult {
  extractedData: ExtractedApplicantData
  hasExtractedFields: boolean
  pageCount: number
  sourceTypes: Array<'ai' | 'pdf-text' | 'ocr' | 'mrz'>
  extractionError?: string
  isQuotaExceeded?: boolean
  diagnostics: {
    pdfTextFound: boolean
    pdfTextChars: number
    ocrExecutedCount: number
    mrzFound: boolean
    aiExecuted: boolean
    errors: string[]
  }
}

/**
 * Checks whether candidate data has core identity fields.
 */
export function isExtractionSufficient(
  candidateList: ExtractedApplicantData[],
  textChars: number
): boolean {
  if (!candidateList || candidateList.length === 0) return false

  const { merged } = mergeExtractedCandidateData(candidateList)

  const hasPassportNo = Boolean(merged.passport?.passportNumber?.value?.trim())
  const hasName = Boolean(
    merged.personal?.fullName?.value?.trim() ||
    merged.personal?.lastName?.value?.trim() ||
    merged.personal?.firstName?.value?.trim()
  )
  const hasDob = Boolean(merged.personal?.dateOfBirth?.value?.trim())
  const hasExpiryOrIssue = Boolean(
    merged.passport?.expiryDate?.value?.trim() ||
    merged.passport?.issueDate?.value?.trim()
  )

  const hasCoreIdentity = hasPassportNo && hasName && hasDob && hasExpiryOrIssue

  if (
    hasCoreIdentity &&
    (textChars >= 80 ||
      merged.passport?.passportNumber?.source === 'ocr' ||
      merged.passport?.passportNumber?.source === 'mrz')
  ) {
    return true
  }

  return false
}

/**
 * Authoritative end-to-end extraction pipeline.
 *
 * Exclusively driven by the Python Local OCR service
 * (FastAPI + PaddleOCR + PyMuPDF on port 8001).
 * Fast text layer (<15ms) is used when available, with PaddleOCR for scanned documents.
 */
export async function processUploadedDocumentPayload(
  fileDataUrl: string,
  fileName: string,
  mimeType: string,
  options?: ProcessDocumentPipelineOptions
): Promise<ProcessDocumentPipelineResult> {
  const isPdf =
    mimeType === 'application/pdf' ||
    fileDataUrl.startsWith('data:application/pdf') ||
    fileName.toLowerCase().endsWith('.pdf')

  const candidateList: ExtractedApplicantData[] = []
  const sourceTypes = new Set<'ai' | 'pdf-text' | 'ocr' | 'mrz'>()
  const errors: string[] = []

  const aiExecuted = false
  let extractionError: string | undefined
  const isQuotaExceeded = false
  const pageCount = 1

  const onProgress = options?.onProgress

  let pythonResponse: import('./local/pythonExtractorClient').PythonPassportExtractionResult | undefined

  // Check if uploaded document is PDF
  if (!isPdf) {
    extractionError = 'Only PDF documents are supported for passport extraction. Please upload a PDF file.'
    errors.push(extractionError)
    console.warn('⚠️ [VISA AUTOFILL] Non-PDF file passed to passport extraction:', fileName, mimeType)
  } else {
    // SOLE AUTHORITATIVE PIPELINE: Python Local OCR Sidecar
    onProgress?.({ percent: 20, text: 'Connecting to local Python OCR extractor...' })
    try {
      const pythonRaw = await extractPassportWithPython(fileDataUrl, fileName, {
        onProgress,
      })
      pythonResponse = pythonRaw

      const mappedCand = mapPythonResultToExtractedApplicant(pythonRaw)
      if (mappedCand && hasAnyFields(mappedCand)) {
        if (pythonRaw.mrz?.detected) {
          sourceTypes.add('mrz')
        }
        if (pythonRaw.diagnostics?.ocrExecuted ?? true) {
          sourceTypes.add('ocr')
        }
        if (pythonRaw.diagnostics?.pdfTextFound) {
          sourceTypes.add('pdf-text')
        }
        candidateList.push(mappedCand)
        console.log('⚡ [VISA AUTOFILL] Local Python OCR extraction succeeded as primary engine!')
      } else {
        extractionError = 'Local Python extractor returned response but no usable applicant fields were detected in this document.'
        errors.push(extractionError)
      }
    } catch (pyErr) {
      if (pyErr instanceof PythonExtractorError) {
        extractionError = pyErr.message
      } else {
        const msg = pyErr instanceof Error ? pyErr.message : String(pyErr)
        extractionError = msg
      }
      errors.push(extractionError)
      console.warn('⚠️ [VISA AUTOFILL] Local Python extractor error:', pyErr)
    }
  }

  onProgress?.({ percent: 100, text: 'Finalizing extraction results...' })

  let finalMerged: ExtractedApplicantData = {}
  if (candidateList.length > 0) {
    const { merged } = mergeExtractedCandidateData(candidateList)
    finalMerged = merged
  }

  const hasExtractedFields = hasAnyFields(finalMerged)

  console.group('🎯 [VISA AUTOFILL] PIPELINE EXTRACTION COMPLETE')
  console.log('File Name:', fileName)
  console.log('MIME Type:', mimeType)
  console.log('Extracted Field Count (hasFields):', hasExtractedFields)
  console.log('Extraction Error:', extractionError)
  console.log('Quota Exceeded:', isQuotaExceeded)
  console.log('Source Types:', Array.from(sourceTypes))
  console.log('Merged Extracted Data:', finalMerged)
  console.groupEnd()

  const pyDiag = pythonResponse?.diagnostics
  const effPdfTextFound = pyDiag ? pyDiag.pdfTextFound : false
  const effPdfTextChars = pyDiag ? pyDiag.pdfTextChars : 0
  const effPageCount = pyDiag ? pyDiag.pageCount : pageCount
  const effOcrCount = pyDiag
    ? (pyDiag.ocrExecuted ? (pyDiag.ocrPageCount || 1) : 0)
    : (sourceTypes.has('ocr') ? 1 : 0)

  return {
    extractedData: finalMerged,
    hasExtractedFields,
    pageCount: effPageCount,
    sourceTypes: Array.from(sourceTypes),
    extractionError,
    isQuotaExceeded,
    diagnostics: {
      pdfTextFound: effPdfTextFound,
      pdfTextChars: effPdfTextChars,
      ocrExecutedCount: effOcrCount,
      mrzFound: sourceTypes.has('mrz'),
      aiExecuted,
      errors,
    },
  }
}

/**
 * Checks if candidate data object has at least one valid non-empty extracted field.
 */
function hasAnyFields(cand?: ExtractedApplicantData): boolean {
  if (!cand) return false
  return Boolean(
    cand.personal?.lastName?.value ||
    cand.personal?.firstName?.value ||
    cand.personal?.fullName?.value ||
    cand.personal?.dateOfBirth?.value ||
    cand.personal?.nationalIdNumber?.value ||
    cand.personal?.townCityOfBirth?.value ||
    cand.personal?.religion?.value ||
    cand.passport?.passportNumber?.value ||
    cand.passport?.issueDate?.value ||
    cand.passport?.expiryDate?.value ||
    cand.contact?.phone?.value ||
    cand.contact?.mobile?.value ||
    cand.contact?.email?.value ||
    cand.presentAddress?.phone?.value ||
    cand.presentAddress?.addressLine1?.value ||
    cand.permanentAddress?.addressLine1?.value ||
    cand.family?.father?.name?.value ||
    cand.family?.mother?.name?.value ||
    cand.family?.spouse?.name?.value ||
    cand.employment?.presentOccupation?.value ||
    cand.employment?.employerName?.value ||
    cand.travel?.purposeOfVisit?.value ||
    cand.previousVisa?.visaNumber?.value ||
    cand.sponsorIndia?.name?.value ||
    cand.sponsorMission?.name?.value
  )
}
