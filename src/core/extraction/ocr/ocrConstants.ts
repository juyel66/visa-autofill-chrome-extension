import type { OcrLanguage } from './types'

/**
 * Default OCR language code (English).
 */
export const DEFAULT_OCR_LANGUAGE: OcrLanguage = 'eng'

/**
 * Maximum recommended image dimension in pixels for OCR recognition
 * to prevent browser memory exhaustion.
 */
export const MAX_OCR_IMAGE_DIMENSION = 2400
