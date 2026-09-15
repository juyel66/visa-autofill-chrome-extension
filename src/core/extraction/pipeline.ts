import { extractPdfText, renderAllPdfPagesToImages, renderPdfPageToImage, toUint8Array } from './pdf/pdfTextExtractor'
import { recognizeText } from './ocr/ocrEngine'
import { parsePassportMrz } from './mrz/mrzParser'
import {
  extractFromPdfText,
  extractFromOcrText,
  extractFromMrz,
  mergeExtractedCandidateData,
} from './data/applicantDataExtractor'
import { extractApplicantDataWithGemini, getGeminiApiKey } from './ai/geminiExtractor'
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
 * Evaluates whether current extracted candidate data is sufficiently complete
 * so that expensive canvas rendering, OCR, and AI vision calls can be safely skipped.
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

  // Primary passport identity criteria:
  // Must have: Passport Number, Name, DOB, Expiry/Issue Date
  const hasCoreIdentity = hasPassportNo && hasName && hasDob && hasExpiryOrIssue

  // If core identity is established from clean text (>= 80 chars) or valid MRZ:
  if (hasCoreIdentity && (textChars >= 80 || merged.passport?.passportNumber?.source === 'mrz')) {
    return true
  }

  // Check if it's an OGD Application with rich fields:
  const isOgd = Boolean(
    hasPassportNo &&
    hasName &&
    (merged.family?.father?.name?.value ||
      merged.presentAddress?.addressLine1?.value ||
      merged.employment?.presentOccupation?.value)
  )
  if (isOgd && textChars >= 100) {
    return true
  }

  return false
}

/**
 * Authoritative end-to-end extraction pipeline for ANY uploaded passport or visa document.
 * 
 * Optimized Architecture (Task 089):
 * 1. Fast Path (Local Engine): Digital PDF Text Extraction + MRZ Parsing + Deterministic Field Parsers.
 *    If clean and sufficiently complete, instantly returns in < 200ms without waiting for OCR or AI.
 * 2. Smart OCR Decision: Runs WebAssembly OCR only when text is missing (scanned PDFs), incomplete, or forced.
 * 3. Smart Gemini Decision: Invokes Gemini Flash Multimodal AI when fields are missing/ambiguous and
 *    a valid Gemini API key is available (or explicitly requested), with resilient error handling.
 * 4. Merging: Safely resolves all candidates with deterministic source precedence (Manual > MRZ > PDF-Text > AI > OCR).
 * 
 * ZERO hardcoded applicant data. Only dynamic extraction and generic derivations.
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
  const isImage =
    mimeType.startsWith('image/') ||
    fileDataUrl.startsWith('data:image/') ||
    /\.(jpe?g|png|webp|bmp|tiff?)$/i.test(fileName)

  const candidateList: ExtractedApplicantData[] = []
  const sourceTypes = new Set<'ai' | 'pdf-text' | 'ocr' | 'mrz'>()
  const errors: string[] = []

  let pdfTextFound = false
  let pdfTextChars = 0
  let ocrExecutedCount = 0
  let mrzFound = false
  let aiExecuted = false
  let pageCount = 1

  const onProgress = options?.onProgress
  const maxPdfPages = options?.maxPdfPages || 5
  const ocrScale = options?.ocrScale || 2.5
  const isAutoMode = !options?.forceAi && !options?.forceOcr && options?.mode !== 'ai'

  if (isPdf) {
    // -------------------------------------------------------------
    // TIER 1: FAST LOCAL PDF TEXT & MRZ EXTRACTION
    // -------------------------------------------------------------
    onProgress?.({ percent: 20, text: 'Extracting digital text from PDF...' })
    try {
      const pdfExtract = await extractPdfText(fileDataUrl)
      pageCount = pdfExtract.pageCount || 1

      if (pdfExtract.fullText && pdfExtract.fullText.trim().length > 0) {
        pdfTextFound = true
        pdfTextChars = pdfExtract.fullText.length
        sourceTypes.add('pdf-text')

        const pdfCand = extractFromPdfText(pdfExtract.fullText)
        if (hasAnyFields(pdfCand)) {
          candidateList.push(pdfCand)
        }

        const mrzRes = parsePassportMrz(pdfExtract.fullText)
        if (mrzRes.success && mrzRes.data) {
          mrzFound = true
          sourceTypes.add('mrz')
          candidateList.push(extractFromMrz(mrzRes.data))
        }
      }
    } catch (pdfErr) {
      const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr)
      errors.push(`PDF text extraction error: ${msg}`)
      console.warn('PDF text extraction warning:', pdfErr)
    }

    // Check if Tier 1 Local Extraction is already complete
    const isTier1Complete = isExtractionSufficient(candidateList, pdfTextChars)

    if (isAutoMode && isTier1Complete) {
      // FAST PATH SUCCESS: Skip expensive rendering, OCR, and AI calls!
      onProgress?.({ percent: 100, text: 'Fast local extraction complete!' })
      console.log('⚡ [VISA AUTOFILL] Fast-path local extraction completed successfully!')
    } else {
      // -------------------------------------------------------------
      // TIER 2: RENDER PAGES & RUN SMART OCR (IF NEEDED)
      // -------------------------------------------------------------
      let pageImages: string[] = []
      try {
        const rawBytes = await toUint8Array(fileDataUrl)
        pageImages = await renderAllPdfPagesToImages(rawBytes, maxPdfPages, ocrScale)

        if (pageImages.length === 0) {
          const single = await renderPdfPageToImage(rawBytes, 1, ocrScale)
          if (single) pageImages = [single]
        }
      } catch (renderErr) {
        const msg = renderErr instanceof Error ? renderErr.message : String(renderErr)
        errors.push(`PDF rendering error: ${msg}`)
        console.warn('PDF rendering error:', renderErr)
      }

      // Run OCR only if text extraction was insufficient, or if forced
      const shouldRunOcr = options?.forceOcr || !isTier1Complete
      if (shouldRunOcr && pageImages.length > 0) {
        const totalRendered = Math.max(1, pageImages.length)
        for (let i = 0; i < pageImages.length; i++) {
          const pageImg = pageImages[i]
          const pageNum = i + 1
          onProgress?.({
            percent: 40 + Math.round(((i + 0.5) / totalRendered) * 35),
            text: `Scanning document page ${pageNum} of ${totalRendered}...`,
          })

          try {
            const ocrRes = await recognizeText(pageImg, {
              language: 'eng',
              onProgress: (prog, statusText) => {
                const base = 40 + Math.round((i / totalRendered) * 35)
                const chunk = Math.round((prog * 35) / totalRendered)
                onProgress?.({
                  percent: Math.min(80, base + chunk),
                  text: `Page ${pageNum}: ${statusText || 'Recognizing text...'}`,
                })
              },
            })

            if (ocrRes.text && ocrRes.text.trim().length > 0) {
              ocrExecutedCount++
              sourceTypes.add('ocr')

              const ocrCand = extractFromOcrText(ocrRes)
              if (hasAnyFields(ocrCand)) {
                candidateList.push(ocrCand)
              }

              const mrzRes = parsePassportMrz(ocrRes.text)
              if (mrzRes.success && mrzRes.data) {
                mrzFound = true
                sourceTypes.add('mrz')
                candidateList.push(extractFromMrz(mrzRes.data))
              }
            }
          } catch (pageOcrErr) {
            const msg = pageOcrErr instanceof Error ? pageOcrErr.message : String(pageOcrErr)
            errors.push(`OCR error on page ${pageNum}: ${msg}`)
            console.warn(`OCR error on page ${pageNum}:`, pageOcrErr)
          }
        }
      }

      // -------------------------------------------------------------
      // TIER 3: SMART GEMINI VISION AI FALLBACK / ENHANCEMENT
      // -------------------------------------------------------------
      const isStillIncomplete = !isExtractionSufficient(candidateList, pdfTextChars)
      const shouldRunGemini = options?.forceAi || options?.mode === 'ai' || isStillIncomplete

      if (shouldRunGemini && pageImages.length > 0) {
        let apiKey = options?.apiKey
        if (!apiKey) {
          try {
            apiKey = await getGeminiApiKey()
          } catch (keyErr) {
            console.warn('Gemini API key resolution warning:', keyErr)
          }
        }

        if (apiKey && apiKey.trim().length > 0) {
          onProgress?.({ percent: 85, text: 'Running Gemini Vision AI fallback/enhancement...' })
          try {
            const aiCand = await extractApplicantDataWithGemini(pageImages, {
              apiKey: apiKey.trim(),
              modelName: options?.modelName,
            })
            if (aiCand && hasAnyFields(aiCand)) {
              aiExecuted = true
              sourceTypes.add('ai')
              candidateList.push(aiCand)
            }
          } catch (aiErr) {
            const msg = aiErr instanceof Error ? aiErr.message : String(aiErr)
            errors.push(`Gemini AI extraction warning: ${msg}`)
            console.warn('Gemini AI fallback warning:', aiErr)
          }
        }
      }
    }
  } else if (isImage) {
    // -------------------------------------------------------------
    // IMAGE DOCUMENT EXTRACTION (FAST OCR FIRST -> GEMINI FALLBACK)
    // -------------------------------------------------------------
    onProgress?.({ percent: 30, text: 'Running OCR on document image...' })
    try {
      const ocrRes = await recognizeText(fileDataUrl, {
        language: 'eng',
        onProgress: (prog, statusText) => {
          onProgress?.({
            percent: Math.min(75, 30 + Math.round(prog * 45)),
            text: statusText || 'Recognizing text...',
          })
        },
      })

      if (ocrRes.text && ocrRes.text.trim().length > 0) {
        ocrExecutedCount++
        sourceTypes.add('ocr')

        const ocrCand = extractFromOcrText(ocrRes)
        if (hasAnyFields(ocrCand)) {
          candidateList.push(ocrCand)
        }

        const mrzRes = parsePassportMrz(ocrRes.text)
        if (mrzRes.success && mrzRes.data) {
          mrzFound = true
          sourceTypes.add('mrz')
          candidateList.push(extractFromMrz(mrzRes.data))
        }
      }
    } catch (imgOcrErr) {
      const msg = imgOcrErr instanceof Error ? imgOcrErr.message : String(imgOcrErr)
      errors.push(`Image OCR error: ${msg}`)
      console.warn('Image OCR error:', imgOcrErr)
    }

    // Check if Gemini Vision is needed / available for image
    const isImgIncomplete = !isExtractionSufficient(candidateList, 0)
    const shouldRunGemini = options?.forceAi || options?.mode === 'ai' || isImgIncomplete

    if (shouldRunGemini) {
      let apiKey = options?.apiKey
      if (!apiKey) {
        try {
          apiKey = await getGeminiApiKey()
        } catch (keyErr) {
          console.warn('Gemini API key resolution warning:', keyErr)
        }
      }

      if (apiKey && apiKey.trim().length > 0) {
        onProgress?.({ percent: 80, text: 'Running Gemini Vision AI on document image...' })
        try {
          const aiCand = await extractApplicantDataWithGemini([fileDataUrl], {
            apiKey: apiKey.trim(),
            modelName: options?.modelName,
          })
          if (aiCand && hasAnyFields(aiCand)) {
            aiExecuted = true
            sourceTypes.add('ai')
            candidateList.push(aiCand)
          }
        } catch (aiErr) {
          const msg = aiErr instanceof Error ? aiErr.message : String(aiErr)
          errors.push(`Gemini AI extraction warning: ${msg}`)
          console.warn('Gemini AI image extraction warning:', aiErr)
        }
      }
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
  console.log('Page Count:', pageCount)
  console.log('Extracted Field Count (hasFields):', hasExtractedFields)
  console.log('Source Types:', Array.from(sourceTypes))
  console.log('Merged Extracted Data:', finalMerged)
  console.groupEnd()

  return {
    extractedData: finalMerged,
    hasExtractedFields,
    pageCount,
    sourceTypes: Array.from(sourceTypes),
    diagnostics: {
      pdfTextFound,
      pdfTextChars,
      ocrExecutedCount,
      mrzFound,
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
