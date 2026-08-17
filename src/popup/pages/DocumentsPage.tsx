import React, { useCallback, useEffect, useState } from 'react'
import {
  DocumentCard,
  DocumentPreviewModal,
  DocumentUploadModal,
} from '../../components/document'
import { Button } from '../../components/ui'
import { createEmptyApplicant } from '../../core/applicant'
import type { ApplicantProfile } from '../../core/applicant'
import {
  deleteDocument,
  getDocumentsByApplicantId,
  saveDocument,
} from '../../core/document'
import type { DocumentRecord } from '../../core/document'
import type {
  ExtractedApplicantData,
  ExtractedFieldConflict,
  MrzParseResult,
  OcrResult,
  PdfExtractionResult,
} from '../../core/extraction'
import {
  applyExtractionToApplicant,
  extractFromMrz,
  extractFromOcrText,
  extractFromPdfText,
  extractPdfText,
  mergeExtractedCandidateData,
  parsePassportMrz,
  recognizeText,
} from '../../core/extraction'
import { validateApplicant } from '../../core/validation'
import { ExtractionReviewModal } from './ExtractionReviewModal'

export interface DocumentsPageProps {
  applicants: ApplicantProfile[]
  selectedApplicantId: string | null
  onBack: () => void
  onAddApplicant: () => void
  onUpdateApplicant?: (updatedApplicant: ApplicantProfile) => Promise<void>
}

const SYNTHETIC_TEST_MRZ = `P<BGDTEST<<JOHN<TEST<<<<<<<<<<<<<<<<<<<<<<\nTEST0000000BGD9001011M3001017<<<<<<<<<<<<<<02`

export const DocumentsPage: React.FC<DocumentsPageProps> = ({
  applicants,
  selectedApplicantId,
  onBack,
  onAddApplicant,
  onUpdateApplicant,
}) => {
  const [currentApplicantId, setCurrentApplicantId] = useState<string>(() => {
    if (selectedApplicantId) return selectedApplicantId
    return applicants[0]?.applicantId || ''
  })

  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isExtracting, setIsExtracting] = useState<boolean>(false)
  const [ocrProgress, setOcrProgress] = useState<{ percent: number; text: string } | null>(null)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [showUploadModal, setShowUploadModal] = useState<boolean>(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null)

  // PDF Text Extraction Result Modal State
  const [extractionModal, setExtractionModal] = useState<{
    doc: DocumentRecord
    result: PdfExtractionResult
  } | null>(null)
  const [selectedExtractionPage, setSelectedExtractionPage] = useState<number>(0)

  // MRZ Parser Modal State
  const [isMrzModalOpen, setIsMrzModalOpen] = useState<boolean>(false)
  const [mrzInputText, setMrzInputText] = useState<string>('')
  const [mrzResult, setMrzResult] = useState<MrzParseResult | null>(null)

  // OCR Modal State
  const [ocrModal, setOcrModal] = useState<{
    doc: DocumentRecord
    result: OcrResult
  } | null>(null)

  // Extraction Review Modal State
  const [reviewState, setReviewState] = useState<{
    candidateData: ExtractedApplicantData
    conflicts: ExtractedFieldConflict<unknown>[]
  } | null>(null)
  const [reviewTargetApplicant, setReviewTargetApplicant] = useState<ApplicantProfile | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  const loadApplicantDocuments = useCallback(async (applicantId: string) => {
    if (!applicantId) {
      setDocuments([])
      return
    }
    setErrorMessage(null)
    try {
      const list = await getDocumentsByApplicantId(applicantId)
      setDocuments(list)
    } catch (err) {
      console.error('Failed to load documents:', err)
      setErrorMessage('Unable to load documents.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    if (currentApplicantId) {
      getDocumentsByApplicantId(currentApplicantId)
        .then((list) => {
          if (isMounted) {
            setDocuments(list)
            setIsLoading(false)
          }
        })
        .catch((err) => {
          console.error('Failed to load documents on mount:', err)
          if (isMounted) {
            setErrorMessage('Unable to load documents.')
            setIsLoading(false)
          }
        })
    }
    return () => {
      isMounted = false
    }
  }, [currentApplicantId])

  const handleSaveDocumentRecord = async (docRecord: DocumentRecord) => {
    await saveDocument(docRecord)
    await loadApplicantDocuments(currentApplicantId)
    showToast('Document saved successfully.')
  }

  const handleDeleteConfirm = async (docId: string) => {
    setErrorMessage(null)
    try {
      await deleteDocument(docId)
      await loadApplicantDocuments(currentApplicantId)
      setDeleteConfirmId(null)
      showToast('Document deleted.')
    } catch (err) {
      console.error('Failed to delete document:', err)
      setErrorMessage('Unable to delete document.')
    }
  }

  const handleDownload = (doc: DocumentRecord) => {
    if (!doc.fileDataUrl) {
      setErrorMessage('Document payload is missing for download.')
      return
    }

    try {
      const link = document.createElement('a')
      link.href = doc.fileDataUrl
      link.download = doc.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast(`Downloading "${doc.fileName}"...`)
    } catch (err) {
      console.error('Download failed:', err)
      setErrorMessage('Unable to download file.')
    }
  }

  const handleExtractText = async (doc: DocumentRecord) => {
    if (!doc.fileDataUrl) {
      setErrorMessage('Document payload is missing for extraction.')
      return
    }

    setIsExtracting(true)
    setErrorMessage(null)

    try {
      const result = await extractPdfText(doc.fileDataUrl)
      setExtractionModal({ doc, result })
      setSelectedExtractionPage(0)
    } catch (err) {
      console.error('Failed to extract PDF text:', err)
      setErrorMessage('Unable to extract text from PDF.')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleRunOcr = async (doc: DocumentRecord) => {
    if (!doc.fileDataUrl) {
      setErrorMessage('Document image payload is missing.')
      return
    }

    setErrorMessage(null)
    setOcrProgress({ percent: 10, text: 'Initializing OCR engine...' })

    try {
      const result = await recognizeText(doc.fileDataUrl, {
        language: 'eng',
        onProgress: (prog, statusText) => {
          setOcrProgress({
            percent: Math.round(prog * 100),
            text: statusText || 'Processing image...',
          })
        },
      })
      setOcrModal({ doc, result })
    } catch (err) {
      console.error('Failed to run OCR:', err)
      setErrorMessage('Unable to run OCR on document.')
    } finally {
      setOcrProgress(null)
    }
  }

  const handleRunMrzParse = () => {
    const res = parsePassportMrz(mrzInputText)
    setMrzResult(res)
  }

  const handleLoadSyntheticMrz = () => {
    setMrzInputText(SYNTHETIC_TEST_MRZ)
    const res = parsePassportMrz(SYNTHETIC_TEST_MRZ)
    setMrzResult(res)
  }

  const handleStartReviewFromExtraction = async (candData: ExtractedApplicantData) => {
    const hasData =
      Boolean(candData.personal && Object.keys(candData.personal).length > 0) ||
      Boolean(candData.passport && Object.keys(candData.passport).length > 0) ||
      Boolean(candData.contact && Object.keys(candData.contact).length > 0)

    if (!hasData) {
      setErrorMessage('No reviewable candidate data could be extracted from this document.')
      return
    }

    let targetApp = applicants.find((a) => a.applicantId === currentApplicantId)
    if (!targetApp && applicants.length > 0) {
      targetApp = applicants[0]
    }

    if (!targetApp) {
      const newApp = createEmptyApplicant()
      if (onUpdateApplicant) {
        await onUpdateApplicant(newApp)
      }
      targetApp = newApp
    }

    setReviewTargetApplicant(targetApp)
    const { merged, conflicts } = mergeExtractedCandidateData([candData])
    setReviewState({ candidateData: merged, conflicts })

    // Dismiss parent modal overlays so review modal displays cleanly
    setExtractionModal(null)
    setOcrModal(null)
    setIsMrzModalOpen(false)
  }

  const handleApplyConfirmedExtraction = async (confirmedData: ExtractedApplicantData) => {
    const currentApplicant = reviewTargetApplicant || applicants.find((a) => a.applicantId === currentApplicantId)
    if (!currentApplicant) {
      setErrorMessage('Select an applicant before applying extracted information.')
      return
    }

    try {
      const mergedApplicant = applyExtractionToApplicant(currentApplicant, confirmedData)
      const validation = validateApplicant(mergedApplicant)

      if (!validation.valid) {
        setErrorMessage(`Validation error: ${validation.errors[0]?.message || 'Invalid data'}`)
        return
      }

      if (onUpdateApplicant) {
        await onUpdateApplicant(mergedApplicant)
      }

      setReviewState(null)
      setReviewTargetApplicant(null)
      setExtractionModal(null)
      setOcrModal(null)
      setIsMrzModalOpen(false)
      showToast('Applicant profile updated with confirmed extraction data.')
    } catch (err) {
      console.error('Failed to apply extraction data:', err)
      setErrorMessage('Unable to apply extracted information.')
    }
  }

  if (applicants.length === 0) {
    return (
      <div
        className="rounded-xl p-5 shadow-lg space-y-4 text-center min-h-[380px] flex flex-col justify-between"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          borderWidth: '1px',
          borderStyle: 'solid',
        }}
      >
        <div className="space-y-3 pt-6">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold hover:underline cursor-pointer flex items-center gap-1"
            style={{ color: 'var(--color-accent)' }}
          >
            ← Back
          </button>
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full text-lg mx-auto"
            style={{ backgroundColor: 'var(--color-bg-start)', color: 'var(--color-primary)' }}
          >
            📂
          </div>
          <h2 className="text-base font-extrabold" style={{ color: 'var(--color-text)' }}>
            Document Management
          </h2>
          <p className="text-xs max-w-xs mx-auto" style={{ color: 'var(--color-muted)' }}>
            No applicant profiles found. Create an applicant profile first to upload and manage application documents.
          </p>
        </div>
        <Button variant="primary" size="md" fullWidth onClick={onAddApplicant}>
          + Create First Applicant
        </Button>
      </div>
    )
  }

  const currentApplicant =
    applicants.find((a) => a.applicantId === currentApplicantId) || applicants[0]

  return (
    <div
      className="rounded-xl p-4 shadow-lg space-y-3 transition-colors duration-300 min-h-[440px] flex flex-col relative text-left"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {/* Toast Banner */}
      {toastMessage && (
        <div className="absolute top-2 left-4 right-4 z-50 p-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold text-center shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between pb-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold hover:underline cursor-pointer flex items-center gap-1"
          style={{ color: 'var(--color-accent)' }}
        >
          ← Back
        </button>
        <h2 className="text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>
          Document Manager
        </h2>
        <button
          type="button"
          onClick={() => setIsMrzModalOpen(true)}
          className="text-[10px] font-bold px-2 py-0.5 rounded border border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 cursor-pointer"
        >
          MRZ Parser
        </button>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-2 rounded bg-red-100 border border-red-300 text-red-700 text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      {/* Applicant Switcher Bar */}
      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="text-xs">👤</span>
          <select
            className="text-xs font-bold bg-transparent text-slate-800 focus:outline-none cursor-pointer truncate"
            value={currentApplicantId}
            onChange={(e) => {
              setCurrentApplicantId(e.target.value)
              loadApplicantDocuments(e.target.value)
            }}
          >
            {applicants.map((app) => (
              <option key={app.applicantId} value={app.applicantId}>
                {app.personalInfo.givenNames} {app.personalInfo.surname}
              </option>
            ))}
          </select>
        </div>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 whitespace-nowrap">
          {documents.length} Docs
        </span>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto max-h-[250px] space-y-2 pr-1">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="py-8 text-center space-y-2 border-2 border-dashed rounded-lg p-4 bg-slate-50">
            <div className="text-2xl text-slate-400">📁</div>
            <div className="text-xs font-bold text-slate-700">No Documents Uploaded</div>
            <p className="text-[10px] text-slate-500 max-w-[200px] mx-auto">
              Upload passport scans or photos to extract information for {currentApplicant?.personalInfo.givenNames}.
            </p>
          </div>
        ) : (
          documents.map((doc) => (
            <DocumentCard
              key={doc.documentId}
              document={doc}
              onPreview={() => setPreviewDoc(doc)}
              onExtractText={() => handleExtractText(doc)}
              onRunOcr={() => handleRunOcr(doc)}
              onDownload={() => handleDownload(doc)}
              onDelete={() => setDeleteConfirmId(doc.documentId)}
            />
          ))
        )}
      </div>

      {/* Upload Action Button */}
      <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <Button
          variant="primary"
          size="sm"
          fullWidth
          onClick={() => setShowUploadModal(true)}
          disabled={isExtracting}
        >
          {isExtracting ? 'Processing Extraction...' : '+ Upload New Document'}
        </Button>
      </div>

      {/* OCR Progress Banner */}
      {ocrProgress && (
        <div className="absolute inset-x-4 bottom-14 p-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-xl flex items-center gap-2 z-50 animate-fade-in">
          <div className="animate-spin text-sm">⏳</div>
          <div className="flex-1">
            <div className="flex justify-between text-[10px] text-slate-300">
              <span>{ocrProgress.text}</span>
              <span>{ocrProgress.percent}%</span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${ocrProgress.percent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-4 max-w-xs w-full space-y-3 text-left">
            <h3 className="font-bold text-sm text-red-900">Delete Document?</h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to delete this document? The stored payload will be permanently removed.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={() => handleDeleteConfirm(deleteConfirmId)}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-red-600 hover:bg-red-700 text-white transition cursor-pointer"
              >
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <DocumentUploadModal
          applicantId={currentApplicantId}
          onSave={handleSaveDocumentRecord}
          onClose={() => setShowUploadModal(false)}
        />
      )}

      {/* Preview Document Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* PDF Text Extraction Modal */}
      {extractionModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl p-4 max-w-sm w-full space-y-3 text-left max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900">PDF Text Extraction</h3>
                <p className="text-[10px] text-slate-500 truncate max-w-[220px]">
                  {extractionModal.doc.fileName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExtractionModal(null)}
                className="text-sm font-bold text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs">
              <div>
                <div className="text-[9px] uppercase font-bold text-slate-400">Status</div>
                <div className="font-bold text-[11px] capitalize">
                  {extractionModal.result.status === 'success' ? (
                    <span className="text-emerald-600">Success</span>
                  ) : extractionModal.result.status === 'no-text' ? (
                    <span className="text-amber-600">No Text</span>
                  ) : (
                    <span className="text-red-600">Failed</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase font-bold text-slate-400">Pages</div>
                <div className="font-bold text-[11px] text-slate-800">
                  {extractionModal.result.pageCount}
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase font-bold text-slate-400">Characters</div>
                <div className="font-bold text-[11px] text-slate-800">
                  {extractionModal.result.extractedCharacterCount}
                </div>
              </div>
            </div>

            {extractionModal.result.status === 'no-text' ? (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs">
                No selectable PDF text was extracted. If this document is a scanned image or photo, please use <strong>Local OCR</strong>.
              </div>
            ) : extractionModal.result.status === 'extraction-failed' ? (
              <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs">
                {extractionModal.result.error || 'Failed to extract text from PDF.'}
              </div>
            ) : (
              <div className="space-y-2 flex-1 flex flex-col overflow-hidden">
                <div className="flex gap-1 overflow-x-auto text-[10px] pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedExtractionPage(0)}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                      selectedExtractionPage === 0
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Full Text
                  </button>
                  {extractionModal.result.pages.map((p) => (
                    <button
                      key={p.pageNumber}
                      type="button"
                      onClick={() => setSelectedExtractionPage(p.pageNumber)}
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                        selectedExtractionPage === p.pageNumber
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Page {p.pageNumber}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto max-h-[160px] border rounded bg-slate-50 p-2">
                  <pre className="whitespace-pre-wrap font-mono text-[10px] text-slate-800 break-words">
                    {selectedExtractionPage === 0
                      ? extractionModal.result.fullText
                      : extractionModal.result.pages.find(
                          (p) => p.pageNumber === selectedExtractionPage
                        )?.text || 'No text on this page.'}
                  </pre>
                </div>
              </div>
            )}

            {extractionModal.result.status === 'success' && (
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => {
                  const extracted = extractFromPdfText(extractionModal.result.fullText)
                  handleStartReviewFromExtraction(extracted)
                }}
              >
                Review Extracted Candidate Data
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => setExtractionModal(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Local OCR Result Modal */}
      {ocrModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl p-4 max-w-sm w-full space-y-3 text-left max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Local OCR Recognition</h3>
                <p className="text-[10px] text-slate-500 truncate max-w-[220px]">
                  {ocrModal.doc.fileName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOcrModal(null)}
                className="text-sm font-bold text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs">
              <div>
                <div className="text-[9px] uppercase font-bold text-slate-400">Status</div>
                <div className="font-bold text-[11px] capitalize">
                  {ocrModal.result.status === 'success' ? (
                    <span className="text-emerald-600">Success</span>
                  ) : ocrModal.result.status === 'no-text' ? (
                    <span className="text-amber-600">No Text</span>
                  ) : (
                    <span className="text-red-600">Failed</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase font-bold text-slate-400">Confidence</div>
                <div className="font-bold text-[11px] text-slate-800">
                  {ocrModal.result.confidence !== undefined
                    ? `${ocrModal.result.confidence}%`
                    : 'N/A'}
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase font-bold text-slate-400">Time</div>
                <div className="font-bold text-[11px] text-slate-800">
                  {ocrModal.result.processingTimeMs
                    ? `${ocrModal.result.processingTimeMs} ms`
                    : 'N/A'}
                </div>
              </div>
            </div>

            {ocrModal.result.status === 'no-text' ? (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs">
                No readable text was recognized in this document image.
              </div>
            ) : ocrModal.result.status === 'processing-failed' ? (
              <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs">
                {ocrModal.result.error || 'OCR processing failed.'}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-[160px] border rounded bg-slate-50 p-2">
                <pre className="whitespace-pre-wrap font-mono text-[10px] text-slate-800 break-words">
                  {ocrModal.result.text}
                </pre>
              </div>
            )}

            {ocrModal.result.status === 'success' && (
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => {
                  const extracted = extractFromOcrText(ocrModal.result)
                  handleStartReviewFromExtraction(extracted)
                }}
              >
                Review Extracted Candidate Data
              </Button>
            )}

            <Button variant="ghost" size="sm" fullWidth onClick={() => setOcrModal(null)}>
              Close
            </Button>
          </div>
        </div>
      )}

      {/* MRZ Parser Modal */}
      {isMrzModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl p-4 max-w-sm w-full space-y-3 text-left max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900">Passport MRZ Parser</h3>
              <button
                type="button"
                onClick={() => setIsMrzModalOpen(false)}
                className="text-sm font-bold text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Raw MRZ Text (2 Lines for TD3 / Passport):
              </label>
              <textarea
                className="w-full p-2 font-mono text-[10px] rounded border bg-slate-50 text-slate-900 h-20 uppercase font-semibold focus:ring-1 focus:ring-purple-500"
                value={mrzInputText}
                onChange={(e) => setMrzInputText(e.target.value)}
                placeholder="P<BGDNAME<<GIVEN<NAME..."
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleLoadSyntheticMrz}
                  className="px-2 py-1 text-[10px] font-semibold rounded bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 cursor-pointer"
                >
                  Load Synthetic MRZ
                </button>
                <Button variant="primary" size="sm" onClick={handleRunMrzParse}>
                  Parse MRZ
                </Button>
              </div>
            </div>

            {mrzResult && (
              <div className="space-y-2 pt-2 border-t flex-1 overflow-y-auto max-h-[200px]">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>MRZ Parse Result</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] uppercase ${
                      mrzResult.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {mrzResult.success ? 'Valid TD3' : 'Parse Errors'}
                  </span>
                </div>

                {mrzResult.success && mrzResult.data ? (
                  <div className="p-2 rounded bg-slate-50 text-[10px] space-y-1">
                    <div>
                      <span className="text-slate-500">Name:</span>{' '}
                      <strong>
                        {mrzResult.data.givenNames} {mrzResult.data.surname}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Passport #:</span>{' '}
                      <strong>{mrzResult.data.passportNumber}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Nationality:</span>{' '}
                      <strong>{mrzResult.data.nationality}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">DOB:</span>{' '}
                      <strong>{mrzResult.data.dateOfBirth}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Expiry:</span>{' '}
                      <strong>{mrzResult.data.passportExpiryDate}</strong>
                    </div>

                    <div className="pt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        onClick={() => {
                          if (mrzResult.data) {
                            const extracted = extractFromMrz(mrzResult.data)
                            handleStartReviewFromExtraction(extracted)
                          }
                        }}
                      >
                        Review MRZ Candidate Data
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded bg-red-50 text-red-700 text-[10px] space-y-1">
                    {mrzResult.errors.map((err, index) => (
                      <div key={index}>• {err.message}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => setIsMrzModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Document Intelligence Review Modal Overlay */}
      {reviewState && reviewTargetApplicant && (
        <ExtractionReviewModal
          targetApplicant={reviewTargetApplicant}
          initialData={reviewState.candidateData}
          conflicts={reviewState.conflicts}
          onConfirm={handleApplyConfirmedExtraction}
          onClose={() => setReviewState(null)}
        />
      )}
    </div>
  )
}
