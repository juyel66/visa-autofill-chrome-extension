import * as pdfjsLib from 'pdfjs-dist'
import type { PdfExtractionResult, PdfPageText } from './pdf.types'

// Configure workerSrc for Vite and browser environments
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
  } catch {
    // Fallback if import.meta.url URL resolution fails in specific bundler setups
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'
  }
}

/**
 * Converts input (File, ArrayBuffer, or Data URL string) into Uint8Array.
 */
async function toUint8Array(input: File | ArrayBuffer | string): Promise<Uint8Array> {
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
 * Extracts machine-readable text page-by-page from a PDF document.
 * 
 * Supports text-based PDFs and handles scanned/image-only PDFs gracefully (status: 'no-text').
 * Does NOT perform OCR, MRZ parsing, or auto-populate ApplicantProfile.
 */
export async function extractPdfText(
  input: File | ArrayBuffer | string
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
      return {
        success: true,
        pageCount,
        pages,
        fullText: '',
        extractedCharacterCount: 0,
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
