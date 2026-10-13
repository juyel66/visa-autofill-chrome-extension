/**
 * Converts ISO date format (YYYY-MM-DD) to DD/MM/YYYY.
 */
function isoDateToDdMmYyyy(val: string): string {
  if (!val) return val
  const trimmed = val.trim()
  // YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split(/[-/]/)
    return `${day}/${month}/${year}`
  }
  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    return trimmed.replace(/-/g, '/')
  }
  return trimmed
}

/**
 * Applies a controlled value transformation from the registry.
 */
export function applyValueTransform(value: string, transformName?: string): string {
  if (!value || !transformName) return value

  switch (transformName) {
    case 'isoDateToDdMmYyyy':
      return isoDateToDdMmYyyy(value)
    case 'uppercase':
      return value.toUpperCase()
    case 'lowercase':
      return value.toLowerCase()
    default:
      return value
  }
}
