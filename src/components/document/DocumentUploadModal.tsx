import React, { useRef, useState } from 'react'
import {
  DOCUMENT_CATEGORY_LABELS,
  MAX_DOCUMENT_FILE_SIZE,
  SUPPORTED_MIME_TYPES,
} from '../../core/document'
import type { DocumentRecord, GenericDocumentCategory } from '../../core/document'
import { Button } from '../ui'

export interface DocumentUploadModalProps {
  applicantId: string
  onSave: (doc: DocumentRecord) => Promise<void>
  onClose: () => void
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  applicantId,
  onSave,
  onClose,
}) => {
  const [category, setCategory] = useState<GenericDocumentCategory>('passport')
  const [description, setDescription] = useState<string>('')
  const [expiryDate, setExpiryDate] = useState<string>('')

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setErrorMessage(null)

    if (file.size > MAX_DOCUMENT_FILE_SIZE) {
      setErrorMessage('File is too large. Maximum allowed size is 5 MB.')
      setSelectedFile(null)
      return
    }

    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      setErrorMessage('Unsupported file type. Please upload a PDF, JPG, or PNG document.')
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedFile) {
      setErrorMessage('Please select a file to upload.')
      return
    }

    setIsUploading(true)
    setErrorMessage(null)

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read file payload.'))
        reader.readAsDataURL(selectedFile)
      })

      const now = new Date().toISOString()
      const newDoc: DocumentRecord = {
        documentId: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        applicantId,
        documentType: category,
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
        fileSize: selectedFile.size,
        createdAt: now,
        updatedAt: now,
        status: 'uploaded',
        source: 'user-upload',
        description: description.trim() || undefined,
        expiryDate: expiryDate || undefined,
        fileDataUrl: dataUrl,
      }

      await onSave(newDoc)
      onClose()
    } catch (err) {
      console.error('Failed to save document:', err)
      setErrorMessage('Unable to save document.')
    } finally {
      setIsUploading(false)
    }
  }

  const categories: { id: GenericDocumentCategory; label: string }[] = Object.keys(
    DOCUMENT_CATEGORY_LABELS
  ).map((catKey) => ({
    id: catKey as GenericDocumentCategory,
    label: DOCUMENT_CATEGORY_LABELS[catKey as GenericDocumentCategory],
  }))

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl p-4 max-w-sm w-full space-y-3 text-left shadow-xl"
      >
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="font-bold text-sm text-slate-900">Add Applicant Document</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-400 hover:text-slate-700 px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="p-2 rounded bg-red-100 border border-red-300 text-red-700 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {/* Category Selection */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
            Document Category
          </label>
          <select
            className="w-full p-1.5 rounded border text-xs bg-white font-medium cursor-pointer"
            value={category}
            onChange={(e) => setCategory(e.target.value as GenericDocumentCategory)}
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* File Picker */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
            Select File (PDF, JPG, PNG - Max 5 MB)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf, .jpg, .jpeg, .png"
            onChange={handleFileChange}
            disabled={isUploading}
            className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
        </div>

        {/* Optional Description */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
            Description (Optional)
          </label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            placeholder="e.g. Passport Bio Page Scan"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Optional Expiry Date */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
            Expiry Date (Optional)
          </label>
          <input
            type="date"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2 border-t">
          <Button variant="ghost" size="sm" fullWidth type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" fullWidth type="submit" disabled={isUploading || !selectedFile}>
            {isUploading ? 'Saving...' : 'Save Document'}
          </Button>
        </div>
      </form>
    </div>
  )
}
