import { mergeExtractedCandidateData } from './data/applicantDataExtractor'
import {
  extractApplicantDataWithGemini,
  getGeminiApiKey,
  GeminiExtractionError,
} from './ai/geminiExtractor'
import type { ExtractedApplicantData } from './data/types'

export interface ProcessDocumentPipelineOptions {
  onProgress?: (progress: { percent: number; text: string }) => void
  maxPdfPages?: number
  ocrScale?: number
  apiKey?: string
  modelName?: string
  forceAi?: boolean
  forceOcr?: boolean
  mode?: 'auto' | 'fast' | 'ai'
}

export interface ProcessDocumentPipelineResult {
  extractedData: ExtractedApplicantData
  hasExtractedFields: boolean
  pageCount: number
  sourceTypes: Array<'ai' | 'pdf-text' | 'ocr' | 'mrz'>
  geminiError?: string
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

  if (hasCoreIdentity && (textChars >= 80 || merged.passport?.passportNumber?.source === 'ai')) {
    return true
  }

  return false
}

/**
 * Authoritative end-to-end extraction pipeline using SOLELY Gemini Vision AI.
 * 
 * Local text / OCR fallback extraction has been removed per requirement:
 * "sudhu matro gemini er extraction ta rakhe local ta remove kore felo,
 * ebong joidi gemini er quata ses ba gemni kono erro dey tokhn workspace e
 * ekta message dekhiye diba error er r workspace ta open hoye jabe manually
 * korar jnno r kono pblm na hoilo auto filup hobe gemini diye"
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

  let aiExecuted = false
  let geminiError: string | undefined
  let isQuotaExceeded = false
  const pageCount = 1

  const onProgress = options?.onProgress

  // 1. Resolve Gemini API Key
  let apiKey = options?.apiKey
  if (!apiKey) {
    try {
      apiKey = await getGeminiApiKey()
    } catch (keyErr) {
      console.warn('Gemini API key resolution warning:', keyErr)
    }
  }

  if (!apiKey || apiKey.trim().length === 0) {
    geminiError = 'Gemini API key is missing or not configured. Please configure your Gemini API key in Settings.'
    errors.push(geminiError)
    console.warn('⚠️ [VISA AUTOFILL] Gemini extraction skipped: No API key available.')
  } else {
    onProgress?.({ percent: 30, text: 'Extracting document with Gemini AI (Vision Engine)...' })
    try {
      const targetMime = isPdf ? 'application/pdf' : (mimeType || 'image/jpeg')
      const aiCand = await extractApplicantDataWithGemini([fileDataUrl], {
        apiKey: apiKey.trim(),
        modelName: options?.modelName,
        mimeType: targetMime,
      })

      if (aiCand && hasAnyFields(aiCand)) {
        aiExecuted = true
        sourceTypes.add('ai')
        candidateList.push(aiCand)
        console.log('⚡ [VISA AUTOFILL] Gemini extraction succeeded as sole extraction engine!')
      } else {
        geminiError = 'Gemini AI returned response but no usable applicant fields were detected in this document.'
        errors.push(geminiError)
      }
    } catch (aiErr) {
      if (aiErr instanceof GeminiExtractionError) {
        geminiError = aiErr.message
        isQuotaExceeded = aiErr.isQuotaExceeded
      } else {
        const msg = aiErr instanceof Error ? aiErr.message : String(aiErr)
        geminiError = msg
        isQuotaExceeded = /quota|429|resource_exhausted|rate limit/i.test(msg)
      }
      errors.push(`Gemini AI extraction failure: ${geminiError}`)
      console.warn('⚠️ [VISA AUTOFILL] Gemini extraction error:', aiErr)
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
  console.log('Gemini Error:', geminiError)
  console.log('Quota Exceeded:', isQuotaExceeded)
  console.log('Source Types:', Array.from(sourceTypes))
  console.log('Merged Extracted Data:', finalMerged)
  console.groupEnd()

  return {
    extractedData: finalMerged,
    hasExtractedFields,
    pageCount,
    sourceTypes: Array.from(sourceTypes),
    geminiError,
    isQuotaExceeded,
    diagnostics: {
      pdfTextFound: false,
      pdfTextChars: 0,
      ocrExecutedCount: 0,
      mrzFound: false,
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
