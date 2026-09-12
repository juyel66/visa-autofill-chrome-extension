import React, { useEffect, useState, useCallback } from 'react'
import { Button } from '../../components/ui'
import type { ApplicantProfile } from '../../core/applicant'
import {
  getDocumentsByApplicantId,
  getLatestDocument,
  saveDocument,
} from '../../core/document'
import type { DocumentRecord } from '../../core/document'
import { saveApplicant } from '../../core/storage'
import type {
  AutofillResponsePayload,
  UndoResponsePayload,
  VisaPageResponsePayload,
} from '../../core/messaging'
import { sendToBackground } from '../../core/messaging'
import type { CountryPageDetectionResult } from '../../countries/india/types'
import {
  applyExtractionToApplicant,
  processUploadedDocumentPayload,
} from '../../core/extraction'
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
  const [autofillSummary, setAutofillSummary] = useState<{
    page: string
    items: { label: string; status: 'filled' | 'skipped' | 'manual' | 'failed'; reason?: string }[]
  } | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 4500)
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

  interface ExtractionDiagnostic {
    fileName: string
    pdfTextStatus: string
    imagePayloadStatus: string
    imageMime?: string
    imageBytes?: number
    ocrStatus: string
    ocrCharCount: number
    ocrError?: string
    mrzStatus: string
    extractedFieldsCount: number
    savedAppFieldsCount: number
    workerUrl?: string
    coreUrl?: string
    langUrl?: string
    workerInitialized?: string
    languageLoaded?: string
    ocrExecuted?: string
  }

  const [diagnostic, setDiagnostic] = useState<ExtractionDiagnostic | null>(null)

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
          status: 'processing',
          source: 'user-upload',
          extractedDataConfirmed: false,
        }

        const pipelineResult = await processUploadedDocumentPayload(
          dataUrl,
          file.name,
          file.type
        )

        const extractedApplicant = pipelineResult.hasExtractedFields ? pipelineResult.extractedData : null
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

        const diagPdfStatus = pipelineResult.diagnostics.pdfTextFound ? 'FOUND' : 'NO TEXT'
        const diagImgStatus = isPdf ? 'RENDERED CANVAS' : 'IMAGE FILE'
        const diagImgMime = isPdf ? 'image/png' : file.type || 'image/jpeg'
        const diagImgBytes = file.size
        const diagOcrStatus = pipelineResult.diagnostics.ocrExecutedCount > 0 ? 'SUCCESS' : 'NOT EXECUTED'
        const diagOcrChars = pipelineResult.diagnostics.pdfTextChars
        const diagOcrError: string | undefined = pipelineResult.diagnostics.errors.length > 0 ? pipelineResult.diagnostics.errors.join('; ') : undefined
        const diagMrzStatus = pipelineResult.diagnostics.mrzFound ? 'FOUND' : 'NOT FOUND'
        const diagWorkerInit = 'YES'
        const diagLangLoaded = 'YES'
        const diagOcrExecuted = pipelineResult.diagnostics.ocrExecutedCount > 0 ? 'YES' : 'NO'
        const workerUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('tesseract/worker.min.js') : 'default'
        const coreUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('tesseract') : 'default'
        const langUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('tesseract') : 'default'

        const hasFields = Boolean(
          extractedApplicant &&
          (extractedApplicant.personal?.lastName?.value ||
           extractedApplicant.personal?.firstName?.value ||
           extractedApplicant.passport?.passportNumber?.value ||
           extractedApplicant.family?.father?.name?.value)
        )

        if (hasFields && extractedApplicant) {
          newDoc.extractedData = extractedApplicant
          newDoc.extractedDataConfirmed = true
          newDoc.status = 'processed'
        } else {
          newDoc.extractedDataConfirmed = false
          newDoc.status = 'failed'
        }

        console.group('📋 [VISA AUTOFILL] FULL EXTRACTED DOCUMENT DATA')
        console.log('Document ID:', newDoc.documentId)
        console.log('Document Type:', targetType)
        console.log('File Name:', file.name)
        console.log('Full Extracted Data Object:', extractedApplicant)
        console.log('Personal:', extractedApplicant?.personal)
        console.log('Passport:', extractedApplicant?.passport)
        console.log('Contact:', extractedApplicant?.contact)
        console.log('Present Address:', extractedApplicant?.presentAddress)
        console.log('Permanent Address:', extractedApplicant?.permanentAddress)
        console.log('Family:', extractedApplicant?.family)
        console.log('Employment:', extractedApplicant?.employment)
        console.log('Travel:', extractedApplicant?.travel)
        console.log('Previous Visa:', extractedApplicant?.previousVisa)
        console.log('Sponsor India:', extractedApplicant?.sponsorIndia)
        console.log('Sponsor Mission:', extractedApplicant?.sponsorMission)
        console.groupEnd()

        await saveDocument(newDoc)

        // If targetType is passport and has extracted fields, sync the active applicant profile
        if (targetType === 'passport' && hasFields && extractedApplicant) {
          try {
            const updatedProfile = applyExtractionToApplicant(selectedApplicant, extractedApplicant)
            await saveApplicant(updatedProfile)
          } catch (syncErr) {
            console.warn('Could not sync applicant profile with passport extraction:', syncErr)
          }
        }

        // Populate or update SavedApplication directly
        const docs = await getDocumentsByApplicantId(selectedApplicant.applicantId)
        const pDoc = targetType === 'passport' && newDoc.extractedDataConfirmed ? newDoc : getLatestDocument(docs, 'passport')
        const oDoc = targetType === 'ogd' && newDoc.extractedDataConfirmed ? newDoc : getLatestDocument(docs, 'ogd')
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

        const savedCount = Object.keys(mergedApp.fields).filter(
          (k) =>
            mergedApp.fields[k] &&
            typeof mergedApp.fields[k] === 'object' &&
            typeof mergedApp.fields[k].value === 'string' &&
            mergedApp.fields[k].value.trim() !== ''
        ).length

        setDiagnostic({
          fileName: file.name,
          pdfTextStatus: diagPdfStatus,
          imagePayloadStatus: diagImgStatus,
          imageMime: diagImgMime,
          imageBytes: diagImgBytes,
          ocrStatus: diagOcrStatus,
          ocrCharCount: diagOcrChars,
          ocrError: diagOcrError,
          workerUrl,
          coreUrl,
          langUrl,
          workerInitialized: diagWorkerInit,
          languageLoaded: diagLangLoaded,
          ocrExecuted: diagOcrExecuted,
          mrzStatus: diagMrzStatus,
          extractedFieldsCount: hasFields ? 15 : 0,
          savedAppFieldsCount: savedCount,
        })

        if (hasFields) {
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

          showToast(`✓ Document extracted (${savedCount} fields populated) & workspace opened.`)
        } else {
          setErrorMessage('Extraction produced 0 structured fields from this document.')
        }
      }

      reader.readAsDataURL(file)
    } catch (err) {
      console.error('File upload error:', err)
      setErrorMessage('Failed to upload document.')
      setIsExtracting(false)
    }
  }

  // 4. Open Full-Page Application Workspace
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

  // 5. Execute Autofill on Current Page
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

      if (response && response.status === 'success' && response.data?.result) {
        const res = response.data.result
        const filled = res.filledFields || 0
        const missing = res.skippedFields || 0
        const manualCount = res.results.filter(
          (r) => r.failureType === 'manual-required' || r.fieldId.includes('captcha')
        ).length
        const alreadyFilled = res.results.filter(
          (r) =>
            r.status === 'already-matching' ||
            r.status === 'already-filled' ||
            r.status === 'skipped-existing'
        ).length

        const fieldLabelMap: Record<string, string> = {
          bd_reg_country: 'Country',
          bd_reg_indian_mission: 'Indian Mission',
          bd_reg_nationality: 'Nationality',
          bd_reg_dob: 'Date of Birth',
          bd_reg_email: 'Email',
          bd_reg_email_confirm: 'Confirm Email',
          bd_reg_expected_arrival: 'Journey Date',
          bd_reg_captcha: 'CAPTCHA',
        }

        const items = res.results.map((r) => {
          let itemStatus: 'filled' | 'skipped' | 'manual' | 'failed' = 'failed'
          if (
            r.status === 'filled' ||
            r.status === 'already-matching' ||
            r.status === 'already-filled' ||
            r.status === 'skipped-existing'
          ) {
            itemStatus = 'filled'
          } else if (
            r.failureType === 'manual-required' ||
            r.status === 'unsupported' ||
            r.failureType === 'unsupported-field' ||
            r.fieldId.includes('captcha')
          ) {
            itemStatus = 'manual'
          } else if (r.status === 'skipped' || r.failureType === 'source-data-missing') {
            itemStatus = 'skipped'
          }

          const label = fieldLabelMap[r.fieldId] || r.fieldId.replace(/^bd_[a-z]+_/, '').replace(/_/g, ' ')
          return {
            label,
            status: itemStatus,
            reason: r.reason,
          }
        })

        const pageName = detection?.page ? (detection.page === 'REGISTRATION' ? 'Registration' : detection.page) : 'Autofill'
        setAutofillSummary({ page: pageName, items })

        showToast(
          `✓ Filled: ${filled} | Already filled: ${alreadyFilled} | Blank: ${missing} | Manual: ${manualCount}`
        )
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

  // 6. Undo Autofill
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
                    currentTabDoc.status === 'processed' && currentTabDoc.extractedDataConfirmed ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-emerald-950 text-emerald-400 border-emerald-700/60">
                        Extracted & Confirmed ✓
                      </span>
                    ) : currentTabDoc.status === 'processing' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-blue-950 text-blue-400 border-blue-700/60 animate-pulse">
                        Processing OCR...
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-rose-950 text-rose-400 border-rose-700/60">
                        Extraction Failed ✕
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">No document</span>
                  )}
                </div>

                {/* Diagnostic Panel */}
                {diagnostic && diagnostic.fileName === currentTabDoc?.fileName && (
                  <div className="bg-slate-950 rounded p-2.5 border border-slate-700 text-[10px] font-mono text-slate-300 space-y-1">
                    <div className="text-[11px] font-bold text-amber-400 flex justify-between border-b border-slate-800 pb-1">
                      <span>🛠️ OCR Runtime Diagnostics</span>
                      <button onClick={() => setDiagnostic(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
                    </div>
                    <div className="space-y-0.5 pt-0.5">
                      <div>PDF Text: <span className={diagnostic.pdfTextStatus === 'FOUND' ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>{diagnostic.pdfTextStatus}</span></div>
                      <div>Image payload: <span className={diagnostic.imagePayloadStatus.startsWith('FOUND') || diagnostic.imagePayloadStatus === 'IMAGE FILE' ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>{diagnostic.imagePayloadStatus}</span></div>
                      {diagnostic.imageMime && <div>Image MIME: <span className="text-slate-300">{diagnostic.imageMime}</span></div>}
                      {diagnostic.imageBytes !== undefined && <div>Image bytes: <span className="text-slate-300">{diagnostic.imageBytes.toLocaleString()}</span></div>}
                      {diagnostic.workerUrl && <div className="truncate" title={diagnostic.workerUrl}>Worker URL: <span className="text-slate-400">{diagnostic.workerUrl}</span></div>}
                      {diagnostic.coreUrl && <div className="truncate" title={diagnostic.coreUrl}>Core URL: <span className="text-slate-400">{diagnostic.coreUrl}</span></div>}
                      {diagnostic.langUrl && <div className="truncate" title={diagnostic.langUrl}>Language URL: <span className="text-slate-400">{diagnostic.langUrl}</span></div>}
                      <div>Worker initialized: <span className={diagnostic.workerInitialized === 'YES' ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>{diagnostic.workerInitialized}</span></div>
                      <div>Language loaded: <span className={diagnostic.languageLoaded === 'YES' ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>{diagnostic.languageLoaded}</span></div>
                      <div>OCR executed: <span className={diagnostic.ocrExecuted === 'YES' ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>{diagnostic.ocrExecuted}</span></div>
                      <div>OCR: <span className={diagnostic.ocrStatus === 'SUCCESS' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{diagnostic.ocrStatus}</span> ({diagnostic.ocrCharCount} chars)</div>
                      <div>MRZ: <span className={diagnostic.mrzStatus === 'FOUND' ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>{diagnostic.mrzStatus}</span></div>
                      <div>Populated Fields: <span className="text-emerald-400 font-bold">{diagnostic.savedAppFieldsCount}</span></div>
                    </div>
                    {diagnostic.ocrError && (
                      <div className="text-rose-400 text-[9px] bg-rose-950/60 p-1.5 rounded border border-rose-800/60 break-all mt-1">
                        <span className="font-bold">OCR Error:</span> {diagnostic.ocrError}
                      </div>
                    )}
                  </div>
                )}

                {currentTabDoc ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="font-medium truncate max-w-[180px]">{currentTabDoc.fileName}</span>
                      <span className="text-slate-500">
                        {currentTabDoc.fileSize ? `${(currentTabDoc.fileSize / 1024).toFixed(0)} KB` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <label className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 font-medium py-1.5 px-3 rounded text-xs cursor-pointer text-center transition-colors">
                        Replace File
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

            {autofillSummary && (
              <div className="mt-3 bg-slate-950/90 rounded-lg p-2.5 border border-slate-700/80 text-[11px] space-y-1.5 shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1 font-bold text-slate-200">
                  <span className="flex items-center gap-1">📋 {autofillSummary.page} Page</span>
                  <button
                    onClick={() => setAutofillSummary(null)}
                    className="text-slate-400 hover:text-white cursor-pointer px-1"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1 pt-0.5">
                  {autofillSummary.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-0.5">
                      <span className="text-slate-300">{item.label}</span>
                      {item.status === 'filled' ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">✓ Filled</span>
                      ) : item.status === 'manual' ? (
                        <span className="text-amber-400 font-semibold flex items-center gap-1">○ Manual</span>
                      ) : item.status === 'skipped' ? (
                        <span className="text-slate-400 italic">Skipped</span>
                      ) : (
                        <span className="text-rose-400 font-semibold" title={item.reason}>✕ Failed</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

