/**
 * Safe date normalization utility for form controls.
 * Converts confirmed source dates into control-compatible formats without guessing.
 */

export interface ParsedDate {
  year: number
  month: number
  day: number
}

/**
 * Validates whether a day/month/year combination represents a real calendar date.
 */
function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  const daysInMonth = [
    31,
    (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]

  return day <= daysInMonth[month - 1]
}

/**
 * Parses various date formats into a structured ParsedDate object.
 * Supported: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD
 */
export function parseDateString(dateStr: string): ParsedDate | null {
  if (!dateStr || typeof dateStr !== 'string') return null
  const trimmed = dateStr.trim()
  if (!trimmed) return null

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10)
    const day = parseInt(isoMatch[3], 10)
    if (isValidCalendarDate(year, month, day)) {
      return { year, month, day }
    }
    return null
  }

  // 2. Day-first format: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10)
    const month = parseInt(dmyMatch[2], 10)
    const year = parseInt(dmyMatch[3], 10)
    if (isValidCalendarDate(year, month, day)) {
      return { year, month, day }
    }
    return null
  }

  return null
}

/**
 * Formats a ParsedDate into ISO 'YYYY-MM-DD' string.
 */
export function formatToIsoDate(parsed: ParsedDate): string {
  const y = String(parsed.year).padStart(4, '0')
  const m = String(parsed.month).padStart(2, '0')
  const d = String(parsed.day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Formats a ParsedDate into 'DD/MM/YYYY' string.
 */
export function formatToDdMmYyyy(parsed: ParsedDate): string {
  const y = String(parsed.year).padStart(4, '0')
  const m = String(parsed.month).padStart(2, '0')
  const d = String(parsed.day).padStart(2, '0')
  return `${d}/${m}/${y}`
}

/**
 * Normalizes a source date string into the format expected by the target control.
 * For <input type="date">, the DOM requires 'YYYY-MM-DD'.
 * For text date inputs, applies transformation (e.g. 'isoDateToDdMmYyyy') or preserves valid date.
 */
export function normalizeDateForControl(
  dateStr: string,
  targetControlType: 'date' | 'text' = 'date',
  transform?: string
): string | null {
  const parsed = parseDateString(dateStr)
  if (!parsed) return null

  if (targetControlType === 'date') {
    return formatToIsoDate(parsed)
  }

  if (transform === 'isoDateToDdMmYyyy') {
    return formatToDdMmYyyy(parsed)
  }

  if (transform === 'isoDateToYyyyMmDd') {
    return formatToIsoDate(parsed)
  }

  // Default for text inputs if no transform specified: format as DD/MM/YYYY
  return formatToDdMmYyyy(parsed)
}
