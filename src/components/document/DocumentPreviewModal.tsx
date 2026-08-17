import React, { useEffect, useMemo } from 'react'
import type { DocumentRecord } from '../../core/document'

export interface DocumentPreviewModalProps {
  document: DocumentRecord
  onClose: () => void
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  document: doc,
  onClose,
}) => {
  const objectUrl = useMemo(() => {
    if (!doc.fileDataUrl) return null
    try {
      const arr = doc.fileDataUrl.split(',')
      const mime = arr[0]?.match(/:(.*?);/)?.[1] || doc.mimeType
      const bstr = atob(arr[1] || '')
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }
      const blob = new Blob([u8arr], { type: mime })
      return URL.createObjectURL(blob)
    } catch (err) {
      console.error('Failed to create preview object URL:', err)
      return null
    }
  }, [doc.fileDataUrl, doc.mimeType])

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [objectUrl])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const isImage = doc.mimeType.startsWith('image/')
  const isPdf = doc.mimeType === 'application/pdf'

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-xl p-3 max-w-sm w-full space-y-2 text-left max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-1.5">
          <div>
            <h3 className="font-bold text-xs truncate max-w-[220px] text-slate-900">
              {doc.fileName}
            </h3>
            <p className="text-[10px] text-slate-500 font-mono">
              {doc.mimeType} · {formatFileSize(doc.fileSize)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Preview Container */}
        <div className="flex-1 overflow-auto min-h-[200px] flex items-center justify-center bg-slate-100 rounded-lg p-1">
          {isImage && (objectUrl || doc.fileDataUrl) ? (
            <img
              src={objectUrl || doc.fileDataUrl}
              alt={doc.fileName}
              className="max-h-64 object-contain rounded"
            />
          ) : isPdf && objectUrl ? (
            <iframe
              src={objectUrl}
              title={doc.fileName}
              className="w-full h-64 border-0 rounded"
            />
          ) : (
            <div className="p-4 text-center space-y-1 text-slate-500">
              <div className="text-xl">📄</div>
              <div className="text-xs font-semibold">{doc.fileName}</div>
              <div className="text-[10px] italic">
                Preview is not available for this file format.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
