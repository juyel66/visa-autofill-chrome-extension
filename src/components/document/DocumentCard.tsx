import React from 'react'
import { DOCUMENT_CATEGORY_LABELS } from '../../core/document'
import type { DocumentRecord, GenericDocumentCategory } from '../../core/document'

export interface DocumentCardProps {
  document: DocumentRecord
  onPreview: (doc: DocumentRecord) => void
  onExtractText?: (doc: DocumentRecord) => void
  onRunOcr?: (doc: DocumentRecord) => void
  onDownload: (doc: DocumentRecord) => void
  onDelete: (docId: string) => void
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document: doc,
  onPreview,
  onExtractText,
  onRunOcr,
  onDownload,
  onDelete,
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const categoryLabel =
    DOCUMENT_CATEGORY_LABELS[doc.documentType as GenericDocumentCategory] || doc.documentType

  return (
    <div
      className="p-3 rounded-lg text-left space-y-2 transition-all border"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Category Header */}
      <div className="flex items-center justify-between">
        <span
          className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-xs uppercase tracking-wider"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {categoryLabel}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          {formatFileSize(doc.fileSize)}
        </span>
      </div>

      {/* File Name */}
      <div className="font-bold text-xs truncate" title={doc.fileName} style={{ color: 'var(--color-text)' }}>
        {doc.fileName}
      </div>

      {/* Additional Metadata */}
      <div className="text-[10px] text-slate-500 flex justify-between">
        <span>Type: {doc.mimeType.split('/')[1]?.toUpperCase() || doc.mimeType}</span>
        {doc.expiryDate && <span>Expires: {doc.expiryDate}</span>}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPreview(doc)}
            className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
          >
            View
          </button>

          {doc.mimeType === 'application/pdf' && onExtractText && (
            <button
              type="button"
              onClick={() => onExtractText(doc)}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer border border-emerald-200"
            >
              Extract Text
            </button>
          )}

          {(doc.mimeType === 'image/jpeg' || doc.mimeType === 'image/png' || doc.mimeType === 'image/jpg') &&
            onRunOcr && (
              <button
                type="button"
                onClick={() => onRunOcr(doc)}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer border border-purple-200"
              >
                Run OCR
              </button>
            )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDownload(doc)}
            className="text-[11px] font-medium text-slate-600 hover:underline cursor-pointer"
          >
            Download
          </button>
          <button
            type="button"
            onClick={() => onDelete(doc.documentId)}
            className="text-[11px] font-medium text-red-600 hover:underline cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
