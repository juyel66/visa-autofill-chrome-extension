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
  let workerCreated = false
  let workerInitialized = false
  let languageFetchStarted = false
  let languageFetchCompleted = false
  let languageLoaded = false
  let languageInitCompleted = false
  let ocrStarted = false
  let ocrExecuted = false

  let workerUrl = 'default'
  let coreUrl = 'default'
  let langUrl = 'default'
  let inputMime = 'unknown'
  let inputBytes = 0

  try {
    // 1. Configure logger and error handlers
    let workerInitReject: ((err: Error) => void) | null = null

    const workerOptions: Record<string, unknown> = {
      logger: (m: { progress?: number; status?: string }) => {
        if (m.status === 'loading tesseract core') {
          workerCreated = true
        }
        if (m.status === 'initializing tesseract' && m.progress === 1) {
          workerCreated = true
          workerInitialized = true
        }
        if (m.status === 'loading language traineddata') {
          workerCreated = true
          workerInitialized = true
          languageFetchStarted = true
          if (m.progress === 1) {
            languageFetchCompleted = true
          }
        }
        if (m.status === 'initializing api') {
          workerCreated = true
          workerInitialized = true
          languageFetchStarted = true
          languageFetchCompleted = true
          if (m.progress === 1) {
            languageLoaded = true
            languageInitCompleted = true
          }
        }
        if (m.status === 'recognizing text') {
          ocrStarted = true
        }
        if (options?.onProgress && typeof m.progress === 'number') {
          const p = 0.1 + m.progress * 0.85
          options.onProgress(Math.min(p, 0.95), m.status || 'Recognizing text...')
        }
      },
      errorHandler: (err: unknown) => {
        const errorObj = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err))
        console.error('Tesseract Worker Internal Error:', errorObj)
        if (workerInitReject) {
          workerInitReject(errorObj)
        }
      },
    }

    // 2. Configure local packaged assets for Chrome Extension MV3 context vs Node vs Web
    const isChromeExtension = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.getURL)
    const isNodeEnv = typeof process !== 'undefined' && Boolean(process.versions?.node) && !isChromeExtension

    let prevDoc: unknown = undefined
    if (isNodeEnv) {
      if (typeof global !== 'undefined' && (global as Record<string, unknown>).document) {
        prevDoc = (global as Record<string, unknown>).document
        delete (global as Record<string, unknown>).document
      }
      if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).document) {
        if (!prevDoc) prevDoc = (globalThis as Record<string, unknown>).document
        delete (globalThis as Record<string, unknown>).document
      }
    }

    const restoreDocument = () => {
      if (prevDoc) {
        if (typeof global !== 'undefined') (global as Record<string, unknown>).document = prevDoc
        if (typeof globalThis !== 'undefined') (globalThis as Record<string, unknown>).document = prevDoc
      }
    }

    if (isChromeExtension) {
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
    } else if (isNodeEnv) {
      workerUrl = 'node-native'
      coreUrl = 'node-native'
      const nodeLangPath = typeof process !== 'undefined' && process.cwd ? `${process.cwd().replace(/\\/g, '/')}/public/tesseract` : './public/tesseract'
      langUrl = nodeLangPath

      workerOptions.langPath = nodeLangPath
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

    if (options?.onProgress) {
      options.onProgress(0.1, 'Initializing OCR worker...')
    }

    // 3. Inspect and normalize input based on environment
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

          if (inputMime === 'application/pdf') {
            const { renderPdfPageToImage } = await import('../pdf/pdfTextExtractor')
            const rendered = await renderPdfPageToImage(input, 1, 2.5)
            if (rendered) {
              return recognizeText(rendered, options)
            } else {
              return {
                success: false,
                text: '',
                language,
                status: 'processing-failed',
                error: 'Cannot perform OCR on raw PDF: Rendering PDF page to image failed.',
                processingTimeMs: Date.now() - startTime,
                diagnostics: {
                  workerInitialized,
                  languageLoaded,
                  ocrExecuted: false,
                  workerUrl,
                  coreUrl,
                  langUrl,
                },
              }
            }
          }

          const binaryStr = typeof atob === 'function' ? atob(base64Str) : Buffer.from(base64Str, 'base64').toString('binary')
          inputBytes = binaryStr.length
          const bytes = new Uint8Array(binaryStr.length)
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i)
          }
          if (isNodeEnv) {
            processedInput = Buffer.from(bytes) as unknown as WorkerRecognizeInput
          } else if (typeof Blob !== 'undefined') {
            processedInput = new Blob([bytes], { type: inputMime }) as WorkerRecognizeInput
          } else {
            processedInput = input as unknown as WorkerRecognizeInput
          }
        } else {
          processedInput = input as unknown as WorkerRecognizeInput
        }
      } else {
        processedInput = input as unknown as WorkerRecognizeInput
      }
    } else if (input instanceof Uint8Array) {
      if (input.length >= 4 && input[0] === 0x25 && input[1] === 0x50 && input[2] === 0x44 && input[3] === 0x46) {
        // Raw PDF binary
        const { renderPdfPageToImage } = await import('../pdf/pdfTextExtractor')
        const rendered = await renderPdfPageToImage(input, 1, 2.5)
        if (rendered) {
          return recognizeText(rendered, options)
        } else {
          return {
            success: false,
            text: '',
            language,
            status: 'processing-failed',
            error: 'Cannot perform OCR on raw PDF binary: Rendering PDF page to image failed.',
            processingTimeMs: Date.now() - startTime,
            diagnostics: {
              workerInitialized,
              languageLoaded,
              ocrExecuted: false,
              workerUrl,
              coreUrl,
              langUrl,
            },
          }
        }
      }
      inputMime = 'image/jpeg'
      inputBytes = input.byteLength
      if (isNodeEnv) {
        processedInput = Buffer.from(input.buffer, input.byteOffset, input.byteLength) as unknown as WorkerRecognizeInput
      } else if (typeof Blob !== 'undefined') {
        const arrayBuf = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer
        processedInput = new Blob([arrayBuf], { type: 'image/jpeg' }) as WorkerRecognizeInput
      } else {
        processedInput = input as unknown as WorkerRecognizeInput
      }
    } else if (input instanceof ArrayBuffer) {
      inputMime = 'image/jpeg'
      inputBytes = input.byteLength
      if (isNodeEnv) {
        processedInput = Buffer.from(input) as unknown as WorkerRecognizeInput
      } else if (typeof Blob !== 'undefined') {
        processedInput = new Blob([input], { type: 'image/jpeg' }) as WorkerRecognizeInput
      } else {
        processedInput = input as unknown as WorkerRecognizeInput
      }
    } else if (typeof Blob !== 'undefined' && input instanceof Blob) {
      inputMime = input.type || 'image/jpeg'
      inputBytes = input.size
      processedInput = input as WorkerRecognizeInput
    } else {
      processedInput = input as WorkerRecognizeInput
    }

    // 4. Initialize Tesseract Worker (with 60s timeout protection & error interception)
    const workerInitPromise = new Promise<Awaited<ReturnType<typeof createWorker>>>((resolve, reject) => {
      workerInitReject = (err) => {
        restoreDocument()
        reject(err)
      }
      createWorker(language, 1, workerOptions)
        .then((w) => {
          restoreDocument()
          resolve(w)
        })
        .catch((err) => {
          restoreDocument()
          reject(err)
        })
    })

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        restoreDocument()
        reject(new Error('Tesseract worker initialization timeout (exceeded 60s)'))
      }, 60000)
    })

    worker = await Promise.race([workerInitPromise, timeoutPromise])
    workerCreated = true
    workerInitialized = true
    languageFetchStarted = true
    languageFetchCompleted = true
    languageLoaded = true
    languageInitCompleted = true

    if (options?.onProgress) {
      options.onProgress(0.3, 'Reading document image...')
    }

    // 5. Perform OCR Recognition
    ocrStarted = true
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
      workerCreated,
      workerInitialized,
      languageFetchStarted,
      languageFetchCompleted,
      languageLoaded,
      languageInitCompleted,
      ocrStarted,
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
      workerCreated,
      workerInitialized,
      languageFetchStarted,
      languageFetchCompleted,
      languageLoaded,
      languageInitCompleted,
      ocrStarted,
      ocrExecuted,
      rawError: error,
    })

    const diagInfo: OcrDiagnosticsInfo = {
      workerUrl,
      coreUrl,
      langUrl,
      workerCreated,
      workerInitialized,
      languageFetchStarted,
      languageFetchCompleted,
      languageLoaded,
      languageInitCompleted,
      ocrStarted,
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

