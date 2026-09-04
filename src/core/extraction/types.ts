export type PdfExtractionStatus =
  | 'success'
  | 'no-text'
  | 'invalid-pdf'
  | 'extraction-failed'

export interface PdfPageText {
  pageNumber: number
  text: string
}

export interface PdfExtractionResult {
  success: boolean
  pageCount: number
  pages: PdfPageText[]
  fullText: string
  extractedCharacterCount: number
  status: PdfExtractionStatus
  error?: string
}

export interface DocumentExtractionResult {
  documentId: string
  extractionType: 'pdf-text' | 'ocr' | 'mrz'
  status: PdfExtractionStatus
  extractedAt: string // ISO 8601 string.
  result: PdfExtractionResult
}
