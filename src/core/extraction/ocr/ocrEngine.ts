import { createWorker } from 'tesseract.js'
import { DEFAULT_OCR_LANGUAGE } from './ocrConstants'
import type { OcrDiagnosticsInfo, OcrOptions, OcrResult, OcrTextBlock } from './types'

/**
 * Recognizes text from a document image (JPG, JPEG, PNG, Blob, Data URL) 100% locally in-browser.
 * Uses packaged Tesseract.js web worker, WASM core, and language traineddata without remote CDN requests.
 */
export async function recognizeText(
  input: File | Blob | HTMLImageElement | ImageBitmap | ArrayBuffer | Uint8Array | string,
  options?: OcrOptions
): Promise<OcrResult> {
  const startTime = Date.now()
  const language = options?.language || DEFAULT_OCR_LANGUAGE

  let worker: Awaited<ReturnType<typeof createWorker>> | null = null
  let workerInitialized = false
  let languageLoaded = false
  let ocrExecuted = false

  let workerUrl = 'default'
  let coreUrl = 'default'
  let langUrl = 'default'
  let inputMime = 'unknown'
  let inputBytes = 0

  try {
    // 1. Inspect input and convert to Blob if needed
    type WorkerRecognizeInput = Parameters<Awaited<ReturnType<typeof createWorker>>['recognize']>[0]
    let processedInput: WorkerRecognizeInput

    if (typeof input === 'string') {
      if (input.startsWith('data:')) {
        const commaIdx = input.indexOf(',')
        if (commaIdx !== -1) {
          const header = input.substring(0, commaIdx)
          const base64Str = input.substring(commaIdx + 1).replace(/\s/g, '')
          const mimeMatch = header.match(/data:([^;]+)/)
          inputMime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
          const binaryStr = atob(base64Str)
          inputBytes = binaryStr.length
          const bytes = new Uint8Array(binaryStr.length)
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i)
          }
          processedInput = new Blob([bytes], { type: inputMime }) as WorkerRecognizeInput
        } else {
          processedInput = input as unknown as WorkerRecognizeInput
        }
      } else {
        processedInput = input as unknown as WorkerRecognizeInput
      }
    } else if (input instanceof Uint8Array) {
      inputMime = 'image/jpeg'
      inputBytes = input.byteLength
      const arrayBuf = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer
      processedInput = new Blob([arrayBuf], { type: 'image/jpeg' }) as WorkerRecognizeInput
    } else if (input instanceof ArrayBuffer) {
      inputMime = 'image/jpeg'
      inputBytes = input.byteLength
      processedInput = new Blob([input], { type: 'image/jpeg' }) as WorkerRecognizeInput
    } else if (typeof Blob !== 'undefined' && input instanceof Blob) {
      inputMime = input.type || 'image/jpeg'
      inputBytes = input.size
      processedInput = input as WorkerRecognizeInput
    } else {
      processedInput = input as WorkerRecognizeInput
    }

    if (options?.onProgress) {
      options.onProgress(0.1, 'Initializing OCR worker...')
    }

    // 2. Configure local packaged assets for Chrome Extension MV3 context
    const workerOptions: Record<string, unknown> = {
      logger: (m: { progress?: number; status?: string }) => {
        if (m.status === 'loading language traineddata' || m.status === 'initializing api') {
          languageLoaded = true
        }
        if (options?.onProgress && typeof m.progress === 'number') {
          const p = 0.1 + m.progress * 0.85
          options.onProgress(Math.min(p, 0.95), m.status || 'Recognizing text...')
        }
      },
      errorHandler: (err: unknown) => {
        console.error('Tesseract Worker Internal Error:', err)
      },
    }

    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      const tesseractBaseUrl = chrome.runtime.getURL('tesseract')
      workerUrl = `${tesseractBaseUrl}/worker.min.js`
      coreUrl = tesseractBaseUrl
      langUrl = tesseractBaseUrl

      workerOptions.workerPath = workerUrl
      workerOptions.corePath = coreUrl
      workerOptions.langPath = langUrl
      workerOptions.workerBlobURL = false
      workerOptions.gzip = false
      workerOptions.cacheMethod = 'none'
    } else if (typeof window !== 'undefined') {
      const baseUrl = window.location.origin + '/tesseract'
      workerUrl = `${baseUrl}/worker.min.js`
      coreUrl = baseUrl
      langUrl = baseUrl

      workerOptions.workerPath = workerUrl
      workerOptions.corePath = coreUrl
      workerOptions.langPath = langUrl
      workerOptions.workerBlobURL = false
      workerOptions.gzip = false
      workerOptions.cacheMethod = 'none'
    }

    // 3. Initialize Tesseract Worker
    worker = await createWorker(language, 1, workerOptions)
    workerInitialized = true
    languageLoaded = true

    if (options?.onProgress) {
      options.onProgress(0.3, 'Reading document image...')
    }

    // 4. Perform OCR Recognition
    const { data } = await worker.recognize(processedInput)
    ocrExecuted = true

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

    const diagInfo: OcrDiagnosticsInfo = {
      workerUrl,
      coreUrl,
      langUrl,
      workerInitialized,
      languageLoaded,
      ocrExecuted,
      inputMime,
      inputBytes,
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
        diagnostics: diagInfo,
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
      diagnostics: diagInfo,
    }
  } catch (error) {
    let errMessage = 'OCR processing failed.'
    let errStack = ''
    let errName = 'Error'

    if (error instanceof Error) {
      errName = error.name || 'Error'
      errMessage = error.message || 'Unknown error'
      errStack = error.stack || ''
    } else if (typeof error === 'string') {
      errMessage = error
    } else if (error && typeof error === 'object') {
      try {
        errMessage = JSON.stringify(error)
      } catch {
        errMessage = String(error)
      }
    }

    console.error('Local OCR Engine Error:', {
      name: errName,
      message: errMessage,
      stack: errStack,
      workerUrl,
      coreUrl,
      langUrl,
      workerInitialized,
      languageLoaded,
      ocrExecuted,
      rawError: error,
    })

    const diagInfo: OcrDiagnosticsInfo = {
      workerUrl,
      coreUrl,
      langUrl,
      workerInitialized,
      languageLoaded,
      ocrExecuted,
      errorName: errName,
      errorMessage: errMessage,
      errorStack: errStack,
      inputMime,
      inputBytes,
    }

    return {
      success: false,
      text: '',
      status: 'processing-failed',
      language,
      processingTimeMs: Date.now() - startTime,
      error: `[${errName}] ${errMessage}`,
      diagnostics: diagInfo,
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

