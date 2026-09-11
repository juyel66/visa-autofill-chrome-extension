import * as pdfjsLib from 'pdfjs-dist'
import type { PdfExtractionResult, PdfPageText } from './pdf.types'

// Configure workerSrc for Vite, Chrome extension MV3, and browser environments
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdfjs/pdf.worker.min.mjs')
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = ''
    }
  } else {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = ''
    }
  }
}

/**
 * Converts input (File, ArrayBuffer, or Data URL string) into Uint8Array.
 */
export async function toUint8Array(input: File | ArrayBuffer | Uint8Array | string): Promise<Uint8Array> {
  if (input instanceof Uint8Array) {
    return input
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input)
  }
  if (typeof File !== 'undefined' && input instanceof File) {
    const buffer = await input.arrayBuffer()
    return new Uint8Array(buffer)
  }
  if (typeof input === 'string') {
    const base64Index = input.indexOf(';base64,')
    const base64Str = base64Index >= 0 ? input.slice(base64Index + 8) : input
    const binaryStr = atob(base64Str)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }
    return bytes
  }
  throw new Error('Unsupported PDF input format.')
}

/**
 * Clean raw text from PDF page:
 * - Normalizes CRLF to LF
 * - Trims leading and trailing whitespace
 * - Collapses excessive blank lines (> 2 newlines to 2 newlines)
 */
function cleanRawPageText(text: string): string {
  if (!text) return ''
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').map((line) => line.trim())
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Converts Uint8Array to base64 data URL using 32KB chunks for high performance.
 */
export function uint8ArrayToDataUrl(bytes: Uint8Array, mimeType = 'image/jpeg'): string {
  if (typeof Buffer !== 'undefined') {
    return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`
  }
  const chunks: string[] = []
  const chunkSize = 0x8000 // 32KB chunking
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    chunks.push(String.fromCharCode.apply(null, Array.from(chunk)))
  }
  return `data:${mimeType};base64,${btoa(chunks.join(''))}`
}

/**
 * Extracts raw embedded JPEG image stream from PDF binary data.
 */
export function extractEmbeddedJpegFromPdf(bytes: Uint8Array): Uint8Array | null {
  for (let i = 0; i < bytes.length - 100; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      let hasValidSof = false
      const checkLimit = Math.min(bytes.length - 2, i + 10000)
      for (let k = i + 2; k < checkLimit; k++) {
        if (bytes[k] === 0xff && (bytes[k + 1] === 0xc0 || bytes[k + 1] === 0xc2)) {
          hasValidSof = true
          break
        }
      }

      if (hasValidSof) {
        for (let j = bytes.length - 2; j > i + 1000; j--) {
          if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
            const candidate = bytes.subarray(i, j + 2)
            if (candidate.byteLength > 2048) {
              return candidate
            }
          }
        }
      }
    }
  }
  return null
}

/**
 * Renders or extracts an image representation of a PDF page for OCR.
 * Prioritizes high-resolution canvas rendering so edited PDFs, overlays, and stamps are rendered accurately.
 */
export async function renderPdfPageToImage(
  input: File | ArrayBuffer | Uint8Array | string,
  pageNumber = 1,
  scale = 2.5
): Promise<string | null> {
  try {
    const bytes = await toUint8Array(input)

    // 1. Try high-resolution DOM Canvas rendering first via pdfjsLib
    if (typeof document !== 'undefined' && document.createElement) {
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: bytes.slice(),
          useSystemFonts: true,
        })
        const pdfDoc = await loadingTask.promise
        if (pageNumber <= pdfDoc.numPages) {
          const page = await pdfDoc.getPage(pageNumber)
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (ctx) {
            await page.render({ canvasContext: ctx, canvas, viewport }).promise
            const dataUrl = canvas.toDataURL('image/png')
            if (dataUrl && dataUrl.length > 500) {
              return dataUrl
            }
          }
        }
      } catch (canvasErr) {
        console.warn('PDF canvas render warning (falling back to embedded stream):', canvasErr)
      }
    }

    // 2. Fallback: extract embedded JPEG stream directly from raw PDF bytes (useful in headless Node environments)
    const embeddedJpeg = extractEmbeddedJpegFromPdf(bytes)
    if (embeddedJpeg && embeddedJpeg.byteLength > 2048) {
      return uint8ArrayToDataUrl(embeddedJpeg, 'image/jpeg')
    }
  } catch (err) {
    console.warn('PDF image extraction/rendering warning:', err)
  }
  return null
}

/**
 * Renders all pages of a PDF into high-resolution image data URLs for OCR.
 */
export async function renderAllPdfPagesToImages(
  input: File | ArrayBuffer | Uint8Array | string,
  maxPages = 5,
  scale = 2.5
): Promise<string[]> {
  const results: string[] = []
  try {
    const bytes = await toUint8Array(input)
    if (typeof document !== 'undefined' && document.createElement) {
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: bytes.slice(),
          useSystemFonts: true,
        })
        const pdfDoc = await loadingTask.promise
        const pageCount = Math.min(pdfDoc.numPages, maxPages)
        for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
          const page = await pdfDoc.getPage(pageNum)
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (ctx) {
            await page.render({ canvasContext: ctx, canvas, viewport }).promise
            const dataUrl = canvas.toDataURL('image/png')
            if (dataUrl && dataUrl.length > 500) {
              results.push(dataUrl)
            }
          }
        }
      } catch (canvasErr) {
        console.warn('renderAllPdfPagesToImages canvas error:', canvasErr)
      }
    }

    if (results.length === 0) {
      const single = await renderPdfPageToImage(input, 1, scale)
      if (single) results.push(single)
    }
  } catch (err) {
    console.warn('renderAllPdfPagesToImages error:', err)
  }
  return results
}

/**
 * Extracts machine-readable text page-by-page from a PDF document.
 * 
 * Supports text-based PDFs and handles scanned/image-only PDFs gracefully (status: 'no-text').
 * If no selectable text is found, extracts or renders the first page image payload for OCR.
 */
export async function extractPdfText(
  input: File | ArrayBuffer | Uint8Array | string
): Promise<PdfExtractionResult> {
  try {
    const bytes = await toUint8Array(input)

    if (!bytes || bytes.length === 0) {
      return {
        success: false,
        pageCount: 0,
        pages: [],
        fullText: '',
        extractedCharacterCount: 0,
        status: 'invalid-pdf',
        error: 'PDF file data is empty or invalid.',
      }
    }

    const loadingTask = pdfjsLib.getDocument({
      data: bytes,
      useSystemFonts: true,
    })

    const pdfDoc = await loadingTask.promise
    const pageCount = pdfDoc.numPages
    const pages: PdfPageText[] = []

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfDoc.getPage(pageNum)
      const textContent = await page.getTextContent()

      const pageTextItems: string[] = []
      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string') {
          pageTextItems.push(item.str)
        }
      }

      const rawPageText = pageTextItems.join(' ')
      const cleanedPageText = cleanRawPageText(rawPageText)

      pages.push({
        pageNumber: pageNum,
        text: cleanedPageText,
      })
    }

    const totalCharacters = pages.reduce((sum, p) => sum + p.text.length, 0)

    // Build combined full text with clear page boundary markers
    const fullTextParts: string[] = []
    for (const p of pages) {
      if (p.text.length > 0) {
        fullTextParts.push(`--- PAGE ${p.pageNumber} ---\n${p.text}`)
      }
    }
    const fullText = fullTextParts.join('\n\n')

    // Handle scanned/image-only PDFs where no text items exist
    if (totalCharacters === 0) {
      const imagePayload = await renderPdfPageToImage(bytes, 1)
      return {
        success: true,
        pageCount,
        pages,
        fullText: '',
        extractedCharacterCount: 0,
        imagePayload: imagePayload || undefined,
        status: 'no-text',
      }
    }

    return {
      success: true,
      pageCount,
      pages,
      fullText,
      extractedCharacterCount: totalCharacters,
      status: 'success',
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Failed to parse PDF.'
    console.error('PDF text extraction error:', error)
    return {
      success: false,
      pageCount: 0,
      pages: [],
      fullText: '',
      extractedCharacterCount: 0,
      status: 'invalid-pdf',
      error: `Invalid or unreadable PDF: ${errMessage}`,
    }
  }
}
