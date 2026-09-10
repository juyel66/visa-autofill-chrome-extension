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

export interface OcrDiagnosticsInfo {
  workerUrl?: string
  coreUrl?: string
  langUrl?: string
  workerCreated?: boolean
  workerInitialized?: boolean
  languageFetchStarted?: boolean
  languageFetchCompleted?: boolean
  languageLoaded?: boolean
  languageInitCompleted?: boolean
  ocrStarted?: boolean
  ocrExecuted?: boolean
  errorName?: string
  errorMessage?: string
  errorStack?: string
  inputMime?: string
  inputBytes?: number
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
  diagnostics?: OcrDiagnosticsInfo
}

