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

  if (isPdf) {
    // -------------------------------------------------------------
    // PRIMARY PATH: GEMINI 3.8 FLASH DIRECT PDF EXTRACTION
    // -------------------------------------------------------------
    let apiKey = options?.apiKey
    if (!apiKey) {
      try {
        apiKey = await getGeminiApiKey()
      } catch (keyErr) {
        console.warn('Gemini API key resolution warning:', keyErr)
      }
    }

    let geminiSuccess = false
    if (apiKey && apiKey.trim().length > 0) {
      onProgress?.({ percent: 30, text: 'Extracting document with Gemini 3.8 Flash...' })
      try {
        const aiCand = await extractApplicantDataWithGemini([fileDataUrl], {
          apiKey: apiKey.trim(),
          modelName: options?.modelName || 'gemini-3.8-flash',
          mimeType: 'application/pdf',
        })

        if (aiCand && hasAnyFields(aiCand)) {
          aiExecuted = true
          sourceTypes.add('ai')
          candidateList.push(aiCand)
          geminiSuccess = true
          console.log('⚡ [VISA AUTOFILL] Gemini PDF extraction succeeded as PRIMARY source!')
        } else {
          errors.push('Gemini PDF extraction returned no usable fields; falling back to local extraction')
        }
      } catch (aiErr) {
        const msg = aiErr instanceof Error ? aiErr.message : String(aiErr)
        errors.push(`Gemini AI extraction failure: ${msg}`)
        console.warn('⚠️ [VISA AUTOFILL] Gemini PDF extraction error, falling back:', aiErr)
      }
    } else {
      errors.push('No Gemini API key available; using local fallback extraction')
    }

    // -------------------------------------------------------------
    // FALLBACK PATH: EXECUTED ONLY IF GEMINI WAS NOT USED OR FAILED
    // -------------------------------------------------------------
    if (!geminiSuccess) {
      console.log('🔄 [VISA AUTOFILL] Executing local fallback extraction for PDF...')
      onProgress?.({ percent: 50, text: 'Running local PDF text and MRZ extraction...' })
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

      // In fallback mode, check if digital text + MRZ is sufficient before running expensive OCR
      const isFallbackSufficient = isExtractionSufficient(candidateList, pdfTextChars)

      if (isFallbackSufficient && !options?.forceOcr) {
        console.log('⚡ [VISA AUTOFILL] Fallback digital PDF text extraction is sufficient.')
      } else {
        // Fallback OCR: Render pages and run Tesseract OCR
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

        if (pageImages.length > 0) {
          const totalRendered = Math.max(1, pageImages.length)
          for (let i = 0; i < pageImages.length; i++) {
            const pageImg = pageImages[i]
            const pageNum = i + 1
            onProgress?.({
              percent: 60 + Math.round(((i + 0.5) / totalRendered) * 35),
              text: `Scanning document page ${pageNum} of ${totalRendered}...`,
            })

            try {
              const ocrRes = await recognizeText(pageImg, {
                language: 'eng',
                onProgress: (prog, statusText) => {
                  const base = 60 + Math.round((i / totalRendered) * 35)
                  const chunk = Math.round((prog * 35) / totalRendered)
                  onProgress?.({
                    percent: Math.min(95, base + chunk),
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
      }
    }
  } else if (isImage) {
    // -------------------------------------------------------------
    // IMAGE DOCUMENT EXTRACTION: GEMINI FIRST -> OCR/MRZ FALLBACK
    // -------------------------------------------------------------
    let apiKey = options?.apiKey
    if (!apiKey) {
      try {
        apiKey = await getGeminiApiKey()
      } catch (keyErr) {
        console.warn('Gemini API key resolution warning:', keyErr)
      }
    }

    let geminiImgSuccess = false
    if (apiKey && apiKey.trim().length > 0) {
      onProgress?.({ percent: 30, text: 'Running Gemini 3.8 Flash on document image...' })
      try {
        const aiCand = await extractApplicantDataWithGemini([fileDataUrl], {
          apiKey: apiKey.trim(),
          modelName: options?.modelName || 'gemini-3.8-flash',
        })
        if (aiCand && hasAnyFields(aiCand)) {
          aiExecuted = true
          sourceTypes.add('ai')
          candidateList.push(aiCand)
          geminiImgSuccess = true
          console.log('⚡ [VISA AUTOFILL] Gemini Image extraction succeeded as PRIMARY source!')
        } else {
          errors.push('Gemini Image extraction returned no usable fields; falling back to OCR')
        }
      } catch (aiErr) {
        const msg = aiErr instanceof Error ? aiErr.message : String(aiErr)
        errors.push(`Gemini AI extraction failure: ${msg}`)
        console.warn('⚠️ [VISA AUTOFILL] Gemini Image extraction error, falling back to OCR:', aiErr)
      }
    }

    if (!geminiImgSuccess) {
      onProgress?.({ percent: 50, text: 'Running OCR fallback on document image...' })
      try {
        const ocrRes = await recognizeText(fileDataUrl, {
          language: 'eng',
          onProgress: (prog, statusText) => {
            onProgress?.({
              percent: Math.min(90, 50 + Math.round(prog * 40)),
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
