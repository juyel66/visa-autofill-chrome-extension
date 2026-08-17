export type OcrStatus =
  | 'success'
  | 'no-text'
  | 'processing-failed'
  | 'unsupported-input'
  | 'cancelled'

export type OcrLanguage = 'eng' | string

export interface OcrTextBlock {
  text: string
  confidence: number
  x: number
  y: number
  width: number
  height: number
}

export interface OcrOptions {
  language?: OcrLanguage
  onProgress?: (progress: number, statusText?: string) => void
  maxDimension?: number
}

export interface OcrResult {
  success: boolean
  text: string
  status: OcrStatus
  language: string
  confidence?: number
  processingTimeMs?: number
  blocks?: OcrTextBlock[]
  error?: string
}
