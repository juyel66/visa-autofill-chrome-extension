import type { IndiaVisaFlow, IndiaVisaPage } from '../types'

export type IndiaCompatibilityStatus =
  | 'verified'
  | 'fixture-tested'
  | 'partially-verified'
  | 'needs-verification'
  | 'unsupported'
  | 'manual-only'

export type ControlType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'file'

export interface IndiaFieldCoverageItem {
  fieldId: string
  fieldLabel: string
  profileSourcePath: string
  flow: IndiaVisaFlow
  page: IndiaVisaPage
  controlType: ControlType
  primarySelector: string
  fallbackSelector?: string
  status: IndiaCompatibilityStatus
  notes?: string
}

export interface IndiaPageRegistryItem {
  pageId: IndiaVisaPage | string
  title: string
  flow: IndiaVisaFlow
  status: IndiaCompatibilityStatus
  supportedFieldsCount: number
  manualFieldsCount: number
  notes?: string
}

export interface IndiaCompatibilitySummary {
  compatibilityVersion: string
  totalPages: number
  totalFields: number
  verifiedFields: number
  needsVerificationFields: number
  manualOnlyFields: number
  unsupportedFields: number
}
