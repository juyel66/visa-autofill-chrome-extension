import type { IndiaCompatibilitySummary, IndiaPageRegistryItem } from './types'
import { INDIA_FIELD_COVERAGE_REGISTRY } from './fieldCoverage'

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
    supportedFieldsCount: 6,
    manualFieldsCount: 1,
    notes: 'Contains CAPTCHA boundary.',
  },
  {
    pageId: 'personal-details',
    title: 'Applicant Personal & Passport Form',
    flow: 'regular',
    status: 'needs-verification',
    supportedFieldsCount: 11,
    manualFieldsCount: 0,
    notes: 'Personal details and passport details.',
  },
  {
    pageId: 'address-details',
    title: 'Present & Permanent Address Details Form',
    flow: 'regular',
    status: 'needs-verification',
    supportedFieldsCount: 15,
    manualFieldsCount: 0,
    notes: 'Contains present address, permanent address, and contact details.',
  },
  {
    pageId: 'family-details',
    title: 'Family Details Form',
    flow: 'regular',
    status: 'needs-verification',
    supportedFieldsCount: 10,
    manualFieldsCount: 0,
    notes: 'Contains Father, Mother, Spouse, and Pakistan relation details.',
  },
  {
    pageId: 'occupation-details',
    title: 'Occupation & Profession Details Form',
    flow: 'regular',
    status: 'needs-verification',
    supportedFieldsCount: 5,
    manualFieldsCount: 0,
    notes: 'Contains present/past occupation and employer details.',
  },
  {
    pageId: 'travel-details',
    title: 'Visa & Travel details Form',
    flow: 'regular',
    status: 'needs-verification',
    supportedFieldsCount: 3,
    manualFieldsCount: 0,
    notes: 'Contains purpose of visit, entry details, ports of arrival.',
  },
  {
    pageId: 'reference-details',
    title: 'References & Accommodations Details Form',
    flow: 'regular',
    status: 'needs-verification',
    supportedFieldsCount: 8,
    manualFieldsCount: 1,
    notes: 'Contains reference contacts in India/home and hotel stays.',
  },
  {
    pageId: 'document-reupload',
    title: 'Document Attachment & Upload Page',
    flow: 'regular',
    status: 'needs-verification',
    supportedFieldsCount: 0,
    manualFieldsCount: 0,
    notes: 'Passport & photo upload.',
  },
]

export function calculateIndiaCoverageSummary(): IndiaCompatibilitySummary {
  const fields = INDIA_FIELD_COVERAGE_REGISTRY

  const verified = fields.filter((f) => f.status === 'verified').length
  const needsVerification = fields.filter((f) => f.status === 'needs-verification' || f.status === 'partially-verified' || f.status === 'fixture-tested').length
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
