import { createWorker } from 'tesseract.js'
import { DEFAULT_OCR_LANGUAGE } from './ocrConstants'
import type { OcrOptions, OcrResult, OcrTextBlock } from './types'

/**
 * Recognizes text from a document image (JPG, JPEG, PNG, Blob, Data URL) 100% locally in-browser.
 * Uses Tesseract.js web workers without calling external APIs or saving to ApplicantProfile.
 */
export async function recognizeText(
  input: File | Blob | HTMLImageElement | ImageBitmap | ArrayBuffer | string,
  options?: OcrOptions
): Promise<OcrResult> {
  const startTime = Date.now()
  const language = options?.language || DEFAULT_OCR_LANGUAGE

  let worker: Awaited<ReturnType<typeof createWorker>> | null = null

  try {
    if (options?.onProgress) {
      options.onProgress(0.1, 'Initializing OCR worker...')
    }

    // Initialize Tesseract Worker
    worker = await createWorker(language, 1, {
      logger: (m) => {
        if (options?.onProgress && typeof m.progress === 'number') {
          // Normalize progress (0.1 to 0.95 during recognition)
          const p = 0.1 + m.progress * 0.85
          options.onProgress(Math.min(p, 0.95), m.status || 'Recognizing text...')
        }
      },
    })

    if (options?.onProgress) {
      options.onProgress(0.3, 'Reading document image...')
    }

    const { data } = await worker.recognize(input)

    if (options?.onProgress) {
      options.onProgress(1.0, 'OCR Complete')
    }

    const rawText = data.text ? data.text.trim() : ''
    const confidence = typeof data.confidence === 'number' ? Math.round(data.confidence) : undefined
    const processingTimeMs = Date.now() - startTime

    // Map bounding boxes and text blocks if available
    const blocks: OcrTextBlock[] = []
    if (Array.isArray(data.blocks)) {
      for (const b of data.blocks) {
        if (b.text && b.text.trim().length > 0 && b.bbox) {
          blocks.push({
            text: b.text.trim(),
            confidence: Math.round(b.confidence || 0),
            x: b.bbox.x0,
            y: b.bbox.y0,
            width: b.bbox.x1 - b.bbox.x0,
            height: b.bbox.y1 - b.bbox.y0,
          })
        }
      }
    }

    // Return status: no-text if empty
    if (rawText.length === 0) {
      return {
        success: true,
        text: '',
        status: 'no-text',
        language,
        confidence: 0,
        processingTimeMs,
        blocks: [],
      }
    }

    return {
      success: true,
      text: rawText,
      status: 'success',
      language,
      confidence,
      processingTimeMs,
      blocks,
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'OCR processing failed.'
    console.error('Local OCR Engine Error:', error)

    return {
      success: false,
      text: '',
      status: 'processing-failed',
      language,
      processingTimeMs: Date.now() - startTime,
      error: `Unable to process document image: ${errMessage}`,
    }
  } finally {
    // Terminate worker resources safely to prevent memory leaks
    if (worker) {
      try {
        await worker.terminate()
      } catch (termErr) {
        console.error('Failed to terminate OCR worker:', termErr)
      }
    }
  }
}
