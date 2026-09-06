import React, { useEffect, useState, useCallback } from 'react'
import { Button } from '../../components/ui'
import type { ApplicantProfile } from '../../core/applicant'
import {
  getDocumentsByApplicantId,
  saveDocument,
} from '../../core/document'
import type { DocumentRecord } from '../../core/document'
import type {
  AutofillResponsePayload,
  UndoResponsePayload,
  VisaPageResponsePayload,
} from '../../core/messaging'
import { sendToBackground } from '../../core/messaging'
import type { CountryPageDetectionResult } from '../../countries/india/types'
import {
  extractFromPdfText,
  extractPdfText,
  type ExtractedApplicantData,
  type ExtractedFieldConflict,
} from '../../core/extraction'
import { ExtractionReviewModal } from './ExtractionReviewModal'
import {
  getSavedApplicationByApplicantId,
  saveApplication,
} from '../../core/application/applicationStorage'
import { populateApplicationFromDocuments } from '../../core/application/applicationMerger'
import type { SavedApplication } from '../../core/application/types'

export interface DashboardProps {
  selectedApplicant: ApplicantProfile | null
  applicantCount: number
  onNavigate: (page: 'dashboard' | 'applicants' | 'applicant-form' | 'documents' | 'settings') => void
  onAddApplicant: () => void
}

export const Dashboard: React.FC<DashboardProps> = ({
  selectedApplicant,
  applicantCount,
  onNavigate,
  onAddApplicant,
}) => {
  const [detection, setDetection] = useState<CountryPageDetectionResult | null>(null)
  const [applicantDocs, setApplicantDocs] = useState<DocumentRecord[]>([])
  const [savedApplication, setSavedApplication] = useState<SavedApplication | null>(null)
  const [activeTab, setActiveTab] = useState<'passport' | 'ogd'>('passport')

  const [isExtracting, setIsExtracting] = useState<boolean>(false)
  const [isAutofilling, setIsAutofilling] = useState<boolean>(false)
  const [isUndoing, setIsUndoing] = useState<boolean>(false)
  const [canUndo, setCanUndo] = useState<boolean>(false)

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Extraction Review Modal State
  const [reviewState, setReviewState] = useState<{
    candidateData: ExtractedApplicantData
    conflicts: ExtractedFieldConflict<unknown>[]
  } | null>(null)
  const [reviewDoc, setReviewDoc] = useState<DocumentRecord | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }, [])

  // 1. Check current active browser page
  useEffect(() => {
    let isMounted = true

    async function checkCurrentTab() {
      try {
        const pageRes = await sendToBackground<VisaPageResponsePayload>({ type: 'GET_CURRENT_VISA_PAGE' })

        if (isMounted && pageRes.status === 'success' && pageRes.data?.detection) {
          const det = pageRes.data.detection as CountryPageDetectionResult
          setDetection(det)
        }
      } catch {
        if (isMounted) {
          setDetection(null)
        }
      }
    }

    checkCurrentTab()
    return () => {
      isMounted = false
    }
  }, [])

  // 2. Load Documents & SavedApplication for selected applicant
  const refreshApplicantData = useCallback(async () => {
    if (!selectedApplicant) {
      setApplicantDocs([])
      setSavedApplication(null)
      return
    }

    try {
      const [docs, app] = await Promise.all([
        getDocumentsByApplicantId(selectedApplicant.applicantId),
        getSavedApplicationByApplicantId(selectedApplicant.applicantId),
      ])
      setApplicantDocs(docs)
      setSavedApplication(app)
    } catch (err) {
      console.error('Error loading applicant data in Dashboard:', err)
    }
  }, [selectedApplicant])

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      if (selectedApplicant) {
        try {
          const [docs, app] = await Promise.all([
            getDocumentsByApplicantId(selectedApplicant.applicantId),
            getSavedApplicationByApplicantId(selectedApplicant.applicantId),
          ])
          if (isMounted) {
            setApplicantDocs(docs)
            setSavedApplication(app)
          }
        } catch (err) {
          console.error('Error loading applicant data in Dashboard:', err)
        }
      } else {
        if (isMounted) {
          setApplicantDocs([])
          setSavedApplication(null)
        }
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [selectedApplicant])

  const passportDoc = applicantDocs.find((d) => d.documentType === 'passport')
  const ogdDoc = applicantDocs.find((d) => d.documentType === 'ogd')
  const currentTabDoc = activeTab === 'passport' ? passportDoc : ogdDoc

  // 3. Document Upload & Extraction Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetType: string) => {
    const file = e.target.files?.[0]
    if (!file || !selectedApplicant) return

    setErrorMessage(null)
    setIsExtracting(true)

    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = reader.result as string
        const newDoc: DocumentRecord = {
          documentId: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          applicantId: selectedApplicant.applicantId,
          documentType: targetType,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/pdf',
          fileDataUrl: dataUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'processed',
          source: 'user-upload',
          extractedDataConfirmed: false,
        }

        // Run PDF extraction if PDF
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          try {
            const pdfExtract = await extractPdfText(dataUrl)
            if (pdfExtract.fullText) {
              const extractedApplicant = extractFromPdfText(pdfExtract.fullText)
              if (extractedApplicant) {
                newDoc.extractedData = extractedApplicant
                newDoc.extractedDataConfirmed = true
              }
            }
          } catch (extErr) {
            console.warn('PDF extraction warning:', extErr)
          }
        }

        await saveDocument(newDoc)

        // Populate or update SavedApplication directly
        const docs = await getDocumentsByApplicantId(selectedApplicant.applicantId)
        const pDoc =
          docs.find((d) => d.documentType === 'passport' && d.extractedDataConfirmed) ||
          docs.find((d) => d.documentType === 'passport')
        const oDoc =
          docs.find((d) => d.documentType === 'ogd' && d.extractedDataConfirmed) ||
          docs.find((d) => d.documentType === 'ogd')
        const existingApp = await getSavedApplicationByApplicantId(selectedApplicant.applicantId)
        const mergedApp = populateApplicationFromDocuments({
          applicantId: selectedApplicant.applicantId,
          passportDoc: pDoc,
          ogdDoc: oDoc,
          existingApp,
          notes: selectedApplicant.notes,
        })

        await saveApplication(mergedApp)
        setSavedApplication(mergedApp)
        await refreshApplicantData()
        setIsExtracting(false)

        // AUTOMATICALLY OPEN WORKSPACE IN A NEW TAB
        const workspaceUrl = chrome?.runtime?.getURL
          ? chrome.runtime.getURL(
              `application.html?applicantId=${encodeURIComponent(
                selectedApplicant.applicantId
              )}&documentType=${encodeURIComponent(targetType)}`
            )
          : `application.html?applicantId=${encodeURIComponent(
              selectedApplicant.applicantId
            )}&documentType=${encodeURIComponent(targetType)}`

        if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
          chrome.tabs.create({ url: workspaceUrl })
        } else {
          window.open(workspaceUrl, '_blank')
        }

        showToast(`Document uploaded & workspace opened.`)
      }

      reader.readAsDataURL(file)
    } catch (err) {
      console.error('File upload error:', err)
      setErrorMessage('Failed to upload document.')
      setIsExtracting(false)
    }
  }

  // 4. Extraction Confirmation Handler
  const handleConfirmExtraction = async (confirmedData: ExtractedApplicantData) => {
    if (!selectedApplicant || !reviewDoc) return

    try {
      const updatedDoc: DocumentRecord = {
        ...reviewDoc,
        extractedData: confirmedData,
        extractedDataConfirmed: true,
        updatedAt: new Date().toISOString(),
      }
      await saveDocument(updatedDoc)

      // Refresh docs list
      const docs = await getDocumentsByApplicantId(selectedApplicant.applicantId)
      const pDoc = docs.find((d) => d.documentType === 'passport' && d.extractedDataConfirmed) || docs.find((d) => d.documentType === 'passport')
      const oDoc = docs.find((d) => d.documentType === 'ogd' && d.extractedDataConfirmed) || docs.find((d) => d.documentType === 'ogd')

      // Populate or update SavedApplication
      const existingApp = await getSavedApplicationByApplicantId(selectedApplicant.applicantId)
      const mergedApp = populateApplicationFromDocuments({
        applicantId: selectedApplicant.applicantId,
        passportDoc: pDoc,
        ogdDoc: oDoc,
        existingApp,
        notes: selectedApplicant.notes,
      })

      await saveApplication(mergedApp)
      setSavedApplication(mergedApp)
      setReviewState(null)
      setReviewDoc(null)
      await refreshApplicantData()

      showToast('✓ Document data confirmed! Ready for Application Workspace.')
    } catch (err) {
      console.error('Error confirming extraction:', err)
      setErrorMessage('Failed to confirm document data.')
    }
  }

  // 5. Open Full-Page Application Workspace
  const handleOpenApplicationWorkspace = () => {
    if (!selectedApplicant) return
    const workspaceUrl = chrome?.runtime?.getURL
      ? chrome.runtime.getURL(`application.html?applicantId=${encodeURIComponent(selectedApplicant.applicantId)}`)
      : `application.html?applicantId=${encodeURIComponent(selectedApplicant.applicantId)}`

    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: workspaceUrl })
    } else {
      window.open(workspaceUrl, '_blank')
    }
  }

  // 6. Execute Autofill on Current Page
  const handleAutofillCurrentPage = async () => {
    if (!selectedApplicant) {
      setErrorMessage('Please select an applicant profile first.')
      return
    }

    setIsAutofilling(true)
    setErrorMessage(null)

    try {
      const response = await sendToBackground<AutofillResponsePayload>({
        type: 'EXECUTE_AUTOFILL',
        applicant: selectedApplicant,
      })

      if (response.status === 'success' && response.data?.result) {
        const res = response.data.result
        showToast(`✓ Autofilled ${res.filledFields} fields (${res.skippedFields} skipped).`)
        setCanUndo(true)
      } else {
        const err = response.status === 'error' ? response.error : 'Autofill could not be completed on this page.'
        setErrorMessage(err || 'Autofill could not be completed on this page.')
      }
    } catch (err) {
      console.error('Autofill error:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Autofill request failed.')
    } finally {
      setIsAutofilling(false)
    }
  }

  // 7. Undo Autofill
  const handleUndoAutofill = async () => {
    setIsUndoing(true)
    setErrorMessage(null)
    try {
      const response = await sendToBackground<UndoResponsePayload>({
        type: 'EXECUTE_UNDO',
      })
      if (response.status === 'success') {
        showToast('✓ Autofill changes undone.')
        setCanUndo(false)
      } else {
        setErrorMessage(response.error || 'Unable to undo autofill.')
      }
    } catch (err) {
      console.error('Undo error:', err)
      setErrorMessage('Undo operation failed.')
    } finally {
      setIsUndoing(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 font-sans text-sm">
      {/* Top Header */}
      <header className="px-4 py-3 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center font-bold text-white shadow">
            🇮🇳
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 leading-tight">Visa Autofill</h1>
            <p className="text-[11px] text-slate-400">Application Workspace Mode</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onNavigate('applicants')}
            className="px-2.5 py-1 text-xs rounded bg-slate-700/80 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors"
          >
            Profiles ({applicantCount})
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Main Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Toast / Error alerts */}
        {toastMessage && (
          <div className="p-2.5 bg-emerald-950/80 border border-emerald-700/80 rounded-lg text-emerald-200 text-xs flex items-center gap-2">
            <span>{toastMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-2.5 bg-rose-950/80 border border-rose-700/80 rounded-lg text-rose-200 text-xs flex items-center gap-2">
            <span>⚠️ {errorMessage}</span>
          </div>
        )}

        {/* Profile Container Card */}
        {selectedApplicant ? (
          <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-3.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700/70 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Profile:</span>
                <span className="text-sm font-bold text-blue-400">{selectedApplicant.applicantId}</span>
              </div>
              <button
                onClick={() => onNavigate('applicants')}
                className="text-xs text-slate-400 hover:text-slate-200 underline"
              >
                Switch
              </button>
            </div>

            {/* Document Workflow Tabs: PASSPORT / OGD */}
            <div>
              <div className="flex rounded-lg bg-slate-900/80 p-1 border border-slate-700/60 mb-3">
                <button
                  onClick={() => setActiveTab('passport')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                    activeTab === 'passport'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  PASSPORT {passportDoc?.extractedDataConfirmed && '✓'}
                </button>
                <button
                  onClick={() => setActiveTab('ogd')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                    activeTab === 'ogd'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  OGD {ogdDoc?.extractedDataConfirmed && '✓'}
                </button>
              </div>

              {/* Tab Content */}
              <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    {activeTab === 'passport' ? 'Passport Document' : 'OGD Document (Previous India History)'}
                  </span>
                  {currentTabDoc ? (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        currentTabDoc.extractedDataConfirmed
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-700/60'
                          : 'bg-amber-950 text-amber-400 border-amber-700/60'
                      }`}
                    >
                      {currentTabDoc.extractedDataConfirmed ? 'Confirmed' : 'Review required'}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">No document</span>
                  )}
                </div>

                {currentTabDoc ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="font-medium truncate max-w-[180px]">{currentTabDoc.fileName}</span>
                      <span className="text-slate-500">
                        {currentTabDoc.fileSize ? `${(currentTabDoc.fileSize / 1024).toFixed(0)} KB` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {!currentTabDoc.extractedDataConfirmed && currentTabDoc.extractedData && (
                        <button
                          onClick={() => {
                            setReviewDoc(currentTabDoc)
                            setReviewState({
                              candidateData: currentTabDoc.extractedData!,
                              conflicts: [],
                            })
                          }}
                          className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-1.5 px-3 rounded text-xs transition-colors"
                        >
                          Review Extracted Data
                        </button>
                      )}

                      <label className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 font-medium py-1.5 px-3 rounded text-xs cursor-pointer text-center transition-colors">
                        Replace
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={(e) => handleFileUpload(e, activeTab)}
                          className="hidden"
                          disabled={isExtracting}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {activeTab === 'passport'
                        ? 'Upload primary passport PDF to extract personal identity data.'
                        : 'Upload previous India visa/visit/history document (optional).'}
                    </p>
                    <label className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-3 rounded-md text-xs text-center cursor-pointer transition-colors shadow">
                      {isExtracting ? 'Extracting...' : '📄 Upload Document'}
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => handleFileUpload(e, activeTab)}
                        className="hidden"
                        disabled={isExtracting}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/60 rounded-xl border border-dashed border-slate-700 p-6 text-center space-y-3">
            <p className="text-xs text-slate-400">No applicant profile selected.</p>
            <Button size="sm" onClick={onAddApplicant}>
              + Create Profile
            </Button>
          </div>
        )}

        {/* Application Workspace Status Card */}
        {selectedApplicant && (
          <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-3.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Application Data</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  savedApplication?.status === 'ready_for_autofill'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-700/60'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {savedApplication?.status === 'ready_for_autofill' ? '✓ Ready for Autofill' : 'Draft / Not Saved'}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Open the full-page workspace to review, edit, and save all Bangladesh application fields across 6 pages.
            </p>

            <button
              onClick={handleOpenApplicationWorkspace}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-2 border border-slate-600 shadow transition-colors cursor-pointer"
            >
              <span>🖥️</span> Open Application Workspace (New Tab)
            </button>
          </div>
        )}

        {/* Portal Detection & Autofill Card */}
        <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-3.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 uppercase tracking-wider">Portal Detection</span>
            {detection?.matched ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {detection.page}
              </span>
            ) : (
              <span className="text-slate-500 italic">Indian Visa Portal not detected</span>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleAutofillCurrentPage}
              disabled={isAutofilling || !selectedApplicant}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 px-3 rounded-lg text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isAutofilling ? 'Autofilling Page...' : '⚡ Autofill Current Page'}
            </button>

            {canUndo && (
              <button
                onClick={handleUndoAutofill}
                disabled={isUndoing}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-1.5 px-3 rounded-lg text-xs border border-slate-700 transition-colors"
              >
                {isUndoing ? 'Undoing...' : '↩ Undo Last Autofill'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Extraction Review Modal */}
      {reviewState && selectedApplicant && reviewDoc && (
        <ExtractionReviewModal
          targetApplicant={selectedApplicant}
          initialData={reviewState.candidateData}
          conflicts={reviewState.conflicts}
          onConfirm={handleConfirmExtraction}
          onClose={() => {
            setReviewState(null)
            setReviewDoc(null)
          }}
        />
      )}
    </div>
  )
}

export default Dashboard
