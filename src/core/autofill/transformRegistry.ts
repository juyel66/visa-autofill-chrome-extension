/**
 * Converts ISO date format (YYYY-MM-DD) to DD/MM/YYYY.
 */
function isoDateToDdMmYyyy(val: string): string {
  if (!val) return val
  const parts = val.split('-')
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts
    return `${day}/${month}/${year}`
  }
  return val
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
