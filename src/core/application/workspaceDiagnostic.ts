/**
 * Diagnostic utility for SavedApplication workspace field completeness and provenance.
 *
 * Implements Task 117 Section 17 & 18:
 * "For every Workspace field, determine why it is:
 *  - populated from document
 *  - populated from official document
 *  - populated by derived rule
 *  - populated by default
 *  - blank/manual
 *  Create a diagnostic utility or test output:
 *  FIELD | VALUE | SOURCE | CONFIDENCE | REASON"
 */

import type { SavedApplication, ApplicationFieldSource, ApplicationFieldValue } from './types'
import { getAllSchemaFields } from './fieldSchema'

export interface FieldDiagnosticRecord {
  fieldKey: string
  label: string
  section: string
  value: string | boolean
  source: ApplicationFieldSource
  confidence?: number | string
  isUserEdited: boolean
  reason: string
}

export interface WorkspaceCompletenessSummary {
  totalFields: number
  populatedFields: number
  documentFields: number
  derivedOrDefaultFields: number
  manualFields: number
  missingFields: number
  completenessPercent: number
  diagnostics: FieldDiagnosticRecord[]
}

/**
 * Explains the reason behind a field's source and value state.
 */
function explainFieldReason(
  _fieldKey: string,
  field?: ApplicationFieldValue
): string {
  if (!field || field.source === 'missing' || field.value === '' || field.value === undefined) {
    return 'Field not present in source document(s); requires manual user entry or remains not applicable'
  }

  if (field.isUserEdited || field.source === 'manual') {
    return 'Explicitly provided or modified by user via manual edit'
  }

  if (field.source === 'passport') {
    return 'Extracted directly from passport document (visual OCR or MRZ)'
  }

  if (field.source === 'official_document' || field.source === 'ogd') {
    return 'Extracted from official supporting government document (OGD)'
  }

  if (field.source === 'derived') {
    return 'Resolved via deterministic rule or approved product default'
  }

  return `Populated via source: ${field.source}`
}

/**
 * Analyzes all workspace schema fields against a SavedApplication and produces
 * a structured field-by-field diagnostic and completeness report.
 */
export function generateWorkspaceFieldDiagnostic(app: SavedApplication): WorkspaceCompletenessSummary {
  const allFields = getAllSchemaFields()
  const diagnostics: FieldDiagnosticRecord[] = []

  let populatedCount = 0
  let docCount = 0
  let derivedCount = 0
  let manualCount = 0
  let missingCount = 0

  for (const def of allFields) {
    const field = app.fields[def.key]
    const val = field?.value ?? ''
    const source: ApplicationFieldSource = field?.source ?? 'missing'
    const isPopulated = val !== '' && val !== undefined && source !== 'missing'

    if (isPopulated) {
      populatedCount++
      if (source === 'passport' || source === 'official_document' || source === 'ogd') {
        docCount++
      } else if (source === 'derived') {
        derivedCount++
      } else if (source === 'manual') {
        manualCount++
      }
    } else {
      missingCount++
    }

    diagnostics.push({
      fieldKey: def.key,
      label: def.label,
      section: def.section,
      value: val,
      source,
      confidence: field?.confidence,
      isUserEdited: Boolean(field?.isUserEdited),
      reason: explainFieldReason(def.key, field),
    })
  }

  return {
    totalFields: allFields.length,
    populatedFields: populatedCount,
    documentFields: docCount,
    derivedOrDefaultFields: derivedCount,
    manualFields: manualCount,
    missingFields: missingCount,
    completenessPercent: Math.round((populatedCount / allFields.length) * 100),
    diagnostics,
  }
}

/**
 * Formats the diagnostics as a readable text table.
 */
export function formatWorkspaceDiagnosticTable(app: SavedApplication): string {
  const summary = generateWorkspaceFieldDiagnostic(app)
  const lines: string[] = [
    `=== WORKSPACE COMPLETENESS DIAGNOSTIC ===`,
    `Total Schema Fields: ${summary.totalFields}`,
    `Populated Fields: ${summary.populatedFields} (${summary.completenessPercent}%)`,
    `  - Document Extracted: ${summary.documentFields}`,
    `  - Derived / Default: ${summary.derivedOrDefaultFields}`,
    `  - Manual User Input: ${summary.manualFields}`,
    `Missing / Unpopulated: ${summary.missingFields}`,
    ``,
    `FIELD KEY | VALUE | SOURCE | CONFIDENCE | REASON`,
    `--------------------------------------------------------------------------------`,
  ]

  for (const d of summary.diagnostics) {
    const valStr = typeof d.value === 'boolean' ? String(d.value) : (d.value ? String(d.value).slice(0, 30) : '<BLANK>')
    const confStr = d.confidence !== undefined ? String(d.confidence) : 'N/A'
    lines.push(`${d.fieldKey.padEnd(25)} | ${valStr.padEnd(20)} | ${d.source.padEnd(10)} | ${confStr.padEnd(6)} | ${d.reason}`)
  }

  return lines.join('\n')
}
