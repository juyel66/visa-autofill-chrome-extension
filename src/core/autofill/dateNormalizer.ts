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

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

/**
 * Parses various date formats into a structured ParsedDate object.
 * Supported formats:
 * - ISO: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
 * - Numeric Day-First: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
 * - Alpha Month Day-First: 18 SEP 1993, 18-SEP-1993, 18/SEP/1993, 18 September 1993, 18-Sep-1993
 * - Alpha Month Month-First: SEP 18 1993, SEP 18, 1993, September 18 1993
 * - Alpha Month Year-First: 1993-SEP-18, 1993 SEP 18
 */
export function parseDateString(dateStr: string): ParsedDate | null {
  if (!dateStr || typeof dateStr !== 'string') return null
  const trimmed = dateStr.trim().replace(/,/g, ' ').replace(/\s+/g, ' ')
  if (!trimmed) return null

  // 1. ISO format: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const isoMatch = trimmed.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10)
    const day = parseInt(isoMatch[3], 10)
    if (isValidCalendarDate(year, month, day)) {
      return { year, month, day }
    }
    return null
  }

  // 2. Day-first numeric format: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/)
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10)
    const month = parseInt(dmyMatch[2], 10)
    const year = parseInt(dmyMatch[3], 10)
    if (isValidCalendarDate(year, month, day)) {
      return { year, month, day }
    }
    return null
  }

  // 3. Day-first alpha month format: e.g. "18 SEP 1993", "18-SEP-1993", "18/SEP/1993", "18 September 1993"
  const dmyAlphaMatch = trimmed.match(/^(\d{1,2})[-/. ]([A-Za-z]+)[-/. ](\d{4})$/)
  if (dmyAlphaMatch) {
    const day = parseInt(dmyAlphaMatch[1], 10)
    const monthKey = dmyAlphaMatch[2].toLowerCase()
    const month = MONTH_NAME_MAP[monthKey]
    const year = parseInt(dmyAlphaMatch[3], 10)
    if (month && isValidCalendarDate(year, month, day)) {
      return { year, month, day }
    }
    return null
  }

  // 4. Month-first alpha month format: e.g. "SEP 18 1993", "September 18 1993", "SEP-18-1993"
  const mdyAlphaMatch = trimmed.match(/^([A-Za-z]+)[-/. ](\d{1,2})[-/. ](\d{4})$/)
  if (mdyAlphaMatch) {
    const monthKey = mdyAlphaMatch[1].toLowerCase()
    const month = MONTH_NAME_MAP[monthKey]
    const day = parseInt(mdyAlphaMatch[2], 10)
    const year = parseInt(mdyAlphaMatch[3], 10)
    if (month && isValidCalendarDate(year, month, day)) {
      return { year, month, day }
    }
    return null
  }

  // 5. Year-first alpha month format: e.g. "1993-SEP-18", "1993 SEP 18"
  const ymdAlphaMatch = trimmed.match(/^(\d{4})[-/. ]([A-Za-z]+)[-/. ](\d{1,2})$/)
  if (ymdAlphaMatch) {
    const year = parseInt(ymdAlphaMatch[1], 10)
    const monthKey = ymdAlphaMatch[2].toLowerCase()
    const month = MONTH_NAME_MAP[monthKey]
    const day = parseInt(ymdAlphaMatch[3], 10)
    if (month && isValidCalendarDate(year, month, day)) {
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
