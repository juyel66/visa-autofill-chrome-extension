import type { ApplicantProfile } from '../applicant/types'

/**
 * Safely resolves nested string values from ApplicantProfile without using eval().
 */
export function resolveApplicantValue(
  applicant: ApplicantProfile,
  path?: string
): string | undefined {
  if (!applicant || !path) return undefined

  const parts = path.split('.')
  let current: unknown = applicant

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  if (current === null || current === undefined) {
    return undefined
  }

  const strVal = String(current).trim()
  return strVal !== '' ? strVal : undefined
}
