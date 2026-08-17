import { INDIA_FIELD_COVERAGE_REGISTRY } from './fieldCoverage'
import type { IndiaCompatibilitySummary, IndiaPageRegistryItem } from './types'

export const INDIA_COMPATIBILITY_VERSION = '2026-08'

export const INDIA_PAGE_REGISTRY: IndiaPageRegistryItem[] = [
  {
    pageId: 'landing',
    title: 'Indian Visa Online Portal Landing Page',
    flow: 'regular',
    status: 'partially-verified',
    supportedFieldsCount: 0,
    manualFieldsCount: 0,
    notes: 'Official portal index page.',
  },
  {
    pageId: 'application-start',
    title: 'Application Registration Page',
    flow: 'regular',
    status: 'needs-verification',
    supportedFieldsCount: 5,
    manualFieldsCount: 1,
    notes: 'Contains CAPTCHA boundary.',
  },
  {
    pageId: 'application-form',
    title: 'Applicant Personal & Passport Form',
    flow: 'regular',
    status: 'needs-verification',
    supportedFieldsCount: 11,
    manualFieldsCount: 0,
    notes: 'Main multi-section form.',
  },
  {
    pageId: 'document-reupload',
    title: 'Document Attachment & Upload Page',
    flow: 'regular',
    status: 'needs-verification',
    supportedFieldsCount: 2,
    manualFieldsCount: 0,
    notes: 'Passport & photo upload.',
  },
  {
    pageId: 'manual-only-payment',
    title: 'Payment Gateway Page',
    flow: 'regular',
    status: 'manual-only',
    supportedFieldsCount: 0,
    manualFieldsCount: 1,
    notes: 'Strictly manual payment boundary.',
  },
]

export function calculateIndiaCoverageSummary(): IndiaCompatibilitySummary {
  const fields = INDIA_FIELD_COVERAGE_REGISTRY

  const verified = fields.filter((f) => f.status === 'verified').length
  const needsVerification = fields.filter((f) => f.status === 'needs-verification' || f.status === 'partially-verified').length
  const manualOnly = fields.filter((f) => f.status === 'manual-only').length
  const unsupported = fields.filter((f) => f.status === 'unsupported').length

  return {
    compatibilityVersion: INDIA_COMPATIBILITY_VERSION,
    totalPages: INDIA_PAGE_REGISTRY.length,
    totalFields: fields.length,
    verifiedFields: verified,
    needsVerificationFields: needsVerification,
    manualOnlyFields: manualOnly,
    unsupportedFields: unsupported,
  }
}
