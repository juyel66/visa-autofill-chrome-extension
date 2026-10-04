import React, { useEffect, useState, useCallback, useRef } from 'react'
import type { ApplicantProfile } from '../../core/applicant'
import type {
  AutofillResponsePayload,
  UndoResponsePayload,
  VisaPageResponsePayload,
} from '../../core/messaging'
import { sendToBackground } from '../../core/messaging'
import type { CountryPageDetectionResult } from '../../countries/india/types'
import type { SavedApplication, BackendApplicationSummary } from '../../core/application/types'
import {
  getApplications,
  getApplicationById,
  deleteApplication,
  downloadApplicationPdf,
} from '../../core/application/applicationApi'
import type { AuthUser } from '../../core/auth'
import { executePassportExtractionWorkflow, executeOgdExtractionWorkflow } from '../../core/workflow'

export interface DashboardProps {
  selectedApplicant?: ApplicantProfile | null
  applicantCount?: number
  onNavigate?: (page: 'dashboard' | 'applicants' | 'applicant-form' | 'documents' | 'settings') => void
  onAddApplicant?: () => void
  user?: AuthUser | null
  onLogout?: () => void
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  user,
  onLogout,
}) => {
  // Page Detection
  const [detection, setDetection] = useState<CountryPageDetectionResult | null>(null)

  // Applications from Node Backend
  const [applications, setApplications] = useState<BackendApplicationSummary[]>([])
  const [isApplicationsLoading, setIsApplicationsLoading] = useState<boolean>(true)
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null)
  const [selectedApplication, setSelectedApplication] = useState<SavedApplication | null>(null)

  // Extraction State
  const [uploadTab, setUploadTab] = useState<'passport' | 'ogd'>('passport')
  const [isExtracting, setIsExtracting] = useState<boolean>(false)
  const isExtractingRef = useRef<boolean>(false)
  const [extractingStatus, setExtractingStatus] = useState<string>('Extracting...')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Autofill & Undo State
  const [isAutofilling, setIsAutofilling] = useState<boolean>(false)
  const [isUndoing, setIsUndoing] = useState<boolean>(false)
  const [canUndo, setCanUndo] = useState<boolean>(false)
  const [autofillSummary, setAutofillSummary] = useState<{
    page: string
    items: { label: string; status: 'filled' | 'skipped' | 'manual' | 'failed'; reason?: string }[]
  } | null>(null)

  // Action States
  const [deletingConfirmId, setDeletingConfirmId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<string | null>(null)

  // Toast & Error Messages
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const showToast = useCallback((msg: string, _type?: 'success' | 'error' | 'info') => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 4500)
  }, [])

  // 1. Detect current active visa portal tab
  useEffect(() => {
    let isMounted = true

    async function checkCurrentTab() {
      try {
        const pageRes = await sendToBackground<VisaPageResponsePayload>({ type: 'GET_CURRENT_VISA_PAGE' })
        if (isMounted && pageRes.status === 'success' && pageRes.data?.detection) {
          setDetection(pageRes.data.detection as CountryPageDetectionResult)
        }
      } catch {
        if (isMounted) setDetection(null)
      }
    }

    checkCurrentTab()
    return () => {
      isMounted = false
    }
  }, [])

  // 2. Load Applications from Backend
  const loadApplications = useCallback(async () => {
    if (!user) return
    setIsApplicationsLoading(true)
    try {
      const list = await getApplications()
      setApplications(list)
      setErrorMessage(null)

      // Restore previously selected application or select the first application
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['visa_autofill_selected_application_id'], async (res: { [key: string]: any }) => {
          const storedId = typeof res.visa_autofill_selected_application_id === 'string' ? res.visa_autofill_selected_application_id : null
          const targetId: string | null = storedId && list.some((a) => a.id === storedId) ? storedId : list[0]?.id || null

          if (targetId) {
            setSelectedApplicationId(targetId)
            try {
              const detail = await getApplicationById(targetId)
              setSelectedApplication(detail.applicationData)
              chrome.storage.local.set({
                visa_autofill_selected_application_id: targetId,
                visa_autofill_saved_applications: [detail.applicationData],
              })
            } catch {
              // detail load failed
            }
          } else {
            setSelectedApplicationId(null)
            setSelectedApplication(null)
          }
        })
      } else if (list.length > 0) {
        setSelectedApplicationId(list[0].id)
      }
    } catch (err: any) {
      console.error('Failed to load applications from backend:', err)
      setErrorMessage(err.message || 'Unable to connect to backend server. Make sure http://localhost:8000 is running.')
    } finally {
      setIsApplicationsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadApplications()
  }, [loadApplications])

  // 3. Select an Application
  const handleSelectApplication = async (appId: string) => {
    if (!appId) {
      setSelectedApplicationId(null)
      setSelectedApplication(null)
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.remove([
          'visa_autofill_selected_application_id',
          'visa_autofill_saved_applications',
        ])
      }
      return
    }

    setSelectedApplicationId(appId)
    setErrorMessage(null)
    try {
      const detail = await getApplicationById(appId)
      if (detail && detail.applicationData) {
        setSelectedApplication(detail.applicationData)
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({
            visa_autofill_selected_application_id: appId,
            visa_autofill_saved_applications: [detail.applicationData],
          })
        }
        showToast('✓ Application selected for autofill.')
      }
    } catch (err: any) {
      console.error('Error selecting application:', err)
      showToast(err.message || 'Failed to select application.', 'error')
    }
  }

  // 4. Trigger PDF extraction (Opens File Dialog)
  const handleTriggerExtraction = () => {
    if (isExtracting || isExtractingRef.current) return
    if (!user) {
      showToast('⚠️ Please sign in with Google to start document extraction.')
      return
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  // 5. PDF Upload & Extraction Handler
  // Strictly ordered async workflow:
  // PDF selected -> Validate PDF -> Start extraction -> Wait for OCR to resolve ->
  // Validate extraction result -> Build/normalize application data ->
  // Persist SavedApplication draft -> ONLY THEN navigate/open Workspace.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      if (e.target) e.target.value = ''
      return
    }

    if (isExtractingRef.current) {
      if (e.target) e.target.value = ''
      return
    }
    isExtractingRef.current = true

    const isOgd = uploadTab === 'ogd'
    setErrorMessage(null)
    setIsExtracting(true)
    setExtractingStatus(isOgd ? 'Reading OGD application PDF...' : 'Reading passport PDF...')

    try {
      if (isOgd) {
        await executeOgdExtractionWorkflow({
          file,
          user: user || null,
          existingApp: selectedApplication,
          onProgress: (status) => setExtractingStatus(status),
          navigateWorkspace: (draftId) => {
            const workspaceUrl = chrome?.runtime?.getURL
              ? chrome.runtime.getURL(`application.html?draftId=${encodeURIComponent(draftId)}`)
              : `application.html?draftId=${encodeURIComponent(draftId)}`

            if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
              chrome.tabs.create({ url: workspaceUrl })
            } else {
              window.open(workspaceUrl, '_blank')
            }
          },
        })

        showToast('✓ OGD extracted! Opening Workspace tab...')
      } else {
        await executePassportExtractionWorkflow({
          file,
          user: user || null,
          onProgress: (status) => setExtractingStatus(status),
          navigateWorkspace: (draftId) => {
            const workspaceUrl = chrome?.runtime?.getURL
              ? chrome.runtime.getURL(`application.html?draftId=${encodeURIComponent(draftId)}`)
              : `application.html?draftId=${encodeURIComponent(draftId)}`

            if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
              chrome.tabs.create({ url: workspaceUrl })
            } else {
              window.open(workspaceUrl, '_blank')
            }
          },
        })

        showToast('✓ Passport extracted! Opening Workspace tab...')
      }
    } catch (err: unknown) {
      console.error('File upload/extraction error:', err)
      const errObj = err as { message?: string }
      const userMsg = errObj?.message || (isOgd ? 'Failed to extract OGD document.' : 'Failed to extract passport document.')
      setErrorMessage(userMsg)
      showToast(`⚠️ ${userMsg}`)
    } finally {
      setIsExtracting(false)
      isExtractingRef.current = false
      if (e.target) e.target.value = ''
    }
  }

  // 6. Open Existing Saved Application in Workspace
  const handleOpenWorkspace = (appId?: string) => {
    const targetId = appId || selectedApplicationId
    if (!targetId) {
      showToast('⚠️ Please select or click an application to open.')
      return
    }

    const workspaceUrl = chrome?.runtime?.getURL
      ? chrome.runtime.getURL(`application.html?applicationId=${encodeURIComponent(targetId)}`)
      : `application.html?applicationId=${encodeURIComponent(targetId)}`

    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: workspaceUrl })
    } else {
      window.open(workspaceUrl, '_blank')
    }
  }

  // 7. Delete Application
  const handleDeleteApplication = async (appId: string) => {
    setIsDeleting(appId)
    setErrorMessage(null)
    try {
      await deleteApplication(appId)
      showToast('✓ Application deleted successfully.')
      setDeletingConfirmId(null)

      if (selectedApplicationId === appId) {
        setSelectedApplicationId(null)
        setSelectedApplication(null)
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.remove([
            'visa_autofill_selected_application_id',
            'visa_autofill_saved_applications',
          ])
        }
      }

      await loadApplications()
    } catch (err: any) {
      showToast(err.message || 'Failed to delete application.', 'error')
    } finally {
      setIsDeleting(null)
    }
  }

  // 8. Download Original PDF
  const handleDownloadPdf = async (appId: string) => {
    setIsDownloadingPdf(appId)
    try {
      const { blob, fileName } = await downloadApplicationPdf(appId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('✓ Original PDF downloaded.')
    } catch (err: any) {
      showToast(err.message || 'Failed to download original PDF.', 'error')
    } finally {
      setIsDownloadingPdf(null)
    }
  }

  // 9. Execute Autofill on Current Page using Selected Application
  const handleAutofillCurrentPage = async () => {
    if (!selectedApplicationId) {
      const err = 'Please select an application first.'
      setErrorMessage(err)
      showToast(`⚠️ ${err}`)
      return
    }

    setIsAutofilling(true)
    setErrorMessage(null)

    try {
      let currentApp = selectedApplication
      if (!currentApp) {
        const detail = await getApplicationById(selectedApplicationId)
        currentApp = detail.applicationData
        setSelectedApplication(currentApp)
      }

      if (!currentApp || !currentApp.fields) {
        throw new Error('Selected application has no field data.')
      }

      const surname = String(currentApp.fields['appl.surname']?.value || '')
      const givenName = String(
        currentApp.fields['appl.applname']?.value || currentApp.fields['appl.name']?.value || ''
      )
      const passNo = String(currentApp.fields['appl.passno']?.value || '')

      const getVal = (k: string) => {
        const f = currentApp?.fields?.[k]
        if (!f) return undefined
        const v = typeof f === 'object' && f !== null ? (f as any).value : f
        return v !== undefined && v !== null && String(v).trim() !== '' ? String(v).trim() : undefined
      }

      const applicantToAutofill: ApplicantProfile = {
        applicantId: currentApp.applicantId || currentApp.applicationId || selectedApplicationId,
        createdAt: currentApp.createdAt,
        updatedAt: currentApp.updatedAt,
        personalInfo: {
          surname,
          givenNames: givenName,
          passportNumber: passNo,
        } as any,
        travel: {
          businessCompanyName: getVal('comp_name') || getVal('appl.comp_name'),
          businessCompanyAddress: getVal('comp_address') || getVal('appl.comp_address'),
          businessCompanyPhone: getVal('comp_phone') || getVal('appl.comp_phone'),
          businessCompanyEmail: getVal('comp_email') || getVal('appl.comp_email'),
        },
      }
      ;(applicantToAutofill as any).fields = currentApp.fields

      const response = await sendToBackground<AutofillResponsePayload>({
        type: 'EXECUTE_AUTOFILL',
        applicant: applicantToAutofill,
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
          bd_reg_visiting_purpose: 'Visiting India for',
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
        const err = response?.status === 'error' ? response.error : 'Autofill could not be completed on this page.'
        setErrorMessage(err || 'Autofill could not be completed on this page.')
      }
    } catch (err) {
      console.error('Autofill error:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Autofill request failed.')
    } finally {
      setIsAutofilling(false)
    }
  }

  // 10. Undo Autofill
  const handleUndoAutofill = async () => {
    setIsUndoing(true)
    setErrorMessage(null)
    try {
      const response = await sendToBackground<UndoResponsePayload>({
        type: 'EXECUTE_UNDO',
      })
      if (response && response.status === 'success') {
        showToast('✓ Autofill changes undone.')
        setCanUndo(false)
      } else {
        setErrorMessage(response?.error || 'Unable to undo autofill.')
      }
    } catch (err) {
      console.error('Undo error:', err)
      setErrorMessage('Undo operation failed.')
    } finally {
      setIsUndoing(false)
    }
  }

  const selectedSummary = applications.find((a) => a.id === selectedApplicationId) || null

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 font-sans text-sm">
      {/* Top Header */}
      <header className="px-4 py-3 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center font-bold text-white shadow">
            ✈️
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 leading-tight">Visa Autofill</h1>
            <p className="text-[11px] text-slate-400">Application Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onNavigate && (
            <button
              onClick={() => onNavigate('settings')}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors cursor-pointer"
              title="Settings"
            >
              ⚙️
            </button>
          )}
        </div>
      </header>

      {/* Authenticated Google Account Info */}
      {user && (
        <div className="px-4 py-2.5 bg-slate-800/60 border-b border-slate-700/60 flex items-center justify-between text-xs flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-blue-400/50 object-cover flex-shrink-0 shadow-sm"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0 shadow">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div className="min-w-0 truncate">
              <div className="font-semibold text-slate-100 truncate text-xs leading-tight">{user.name}</div>
              <div className="text-[11px] text-slate-400 truncate leading-tight">{user.email}</div>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="text-[11px] font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 px-2 py-1 rounded transition-colors flex-shrink-0 border border-transparent hover:border-rose-800/50 cursor-pointer"
              title="Sign out of Visa Autofill"
            >
              Logout
            </button>
          )}
        </div>
      )}

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* Toast / Error alerts */}
        {toastMessage && (
          <div className="p-2.5 bg-emerald-950/80 border border-emerald-700/80 rounded-lg text-emerald-200 text-xs flex items-center gap-2 animate-fade-in shadow-md">
            <span>{toastMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-2.5 bg-rose-950/80 border border-rose-700/80 rounded-lg text-rose-200 text-xs flex items-center justify-between shadow-md">
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 text-xs font-bold px-1.5 py-0.5 ml-2 cursor-pointer rounded hover:bg-rose-900/50"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Document Type Selector & Upload Action */}
        <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-2.5 shadow-sm space-y-2.5">
          {/* Tab Selection: Passport (default) vs OGD */}
          <div className="flex bg-slate-900/90 p-1 rounded-lg border border-slate-700/80">
            <button
              type="button"
              onClick={() => setUploadTab('passport')}
              disabled={isExtracting}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                uploadTab === 'passport'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>📘</span>
              <span>Passport</span>
            </button>
            <button
              type="button"
              onClick={() => setUploadTab('ogd')}
              disabled={isExtracting}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                uploadTab === 'ogd'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>📄</span>
              <span>OGD File</span>
            </button>
          </div>

          {/* Primary Action Button */}
          <div>
            <button
              onClick={handleTriggerExtraction}
              disabled={isExtracting}
              className={`w-full disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                uploadTab === 'passport'
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
              }`}
            >
              {isExtracting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white inline-block" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="truncate">{extractingStatus}</span>
                </>
              ) : (
                <>
                  <span className="text-base">{uploadTab === 'passport' ? '📘' : '📄'}</span>
                  <span>{uploadTab === 'passport' ? '+ NEW PASSPORT EXTRACTION' : '+ NEW OGD EXTRACTION'}</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isExtracting}
            />
          </div>
        </div>

        {/* Saved Applications Section */}
        <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-3.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Saved Applications ({applications.length})
            </span>
            <button
              onClick={loadApplications}
              disabled={isApplicationsLoading}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Refresh applications list"
            >
              {isApplicationsLoading ? '↻ Refreshing...' : '↻ Refresh'}
            </button>
          </div>

          {/* Application Selector Dropdown */}
          {applications.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Select Applicant
              </label>
              <select
                value={selectedApplicationId || ''}
                onChange={(e) => handleSelectApplication(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">-- Choose an application --</option>
                {applications.map((app, idx) => {
                  const serial = String(idx + 1).padStart(2, '0')
                  const name = app.applicantName || 'Unnamed Applicant'
                  const pass = app.passportNumber || 'No Passport'
                  return (
                    <option key={app.id} value={app.id}>
                      {serial} — {name} — {pass}
                    </option>
                  )
                })}
              </select>
            </div>
          )}

          {/* Applications Cards List */}
          {isApplicationsLoading ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-2">
              <div className="animate-spin text-xl text-blue-500">✦</div>
              <p className="text-xs text-slate-400 font-medium">Loading applications from server...</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="bg-slate-900/60 rounded-lg p-4 border border-dashed border-slate-700 text-center space-y-1.5">
              <p className="text-xs text-slate-300 font-semibold">No saved applications yet</p>
              <p className="text-[11px] text-slate-400">
                Click "+ NEW PDF EXTRACTION" above to extract a passport PDF and save your first application.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
              {applications.map((app, idx) => {
                const serial = String(idx + 1).padStart(2, '0')
                const isSelected = app.id === selectedApplicationId
                const updatedDate = new Date(app.updatedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })

                return (
                  <div
                    key={app.id}
                    onClick={() => handleSelectApplication(app.id)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500/80 shadow-sm shadow-blue-500/10'
                        : 'bg-slate-900/70 border-slate-700/70 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold text-blue-400 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-800/60">
                            {serial}
                          </span>
                          <span className="text-xs font-bold text-slate-100 truncate">
                            {app.applicantName || 'Unnamed Applicant'}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                          <span>
                            Passport: <strong className="text-slate-300">{app.passportNumber || 'N/A'}</strong>
                          </span>
                          <span>•</span>
                          <span>{updatedDate}</span>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-1.5 py-0.5 rounded uppercase">
                          Active
                        </span>
                      )}
                    </div>

                    {/* Actions for this Application */}
                    <div
                      className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenWorkspace(app.id)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition-colors cursor-pointer"
                          title="Open this application in Workspace tab"
                        >
                          🖥️ Open
                        </button>
                        {app.hasOriginalPdf && (
                          <button
                            onClick={() => handleDownloadPdf(app.id)}
                            disabled={isDownloadingPdf === app.id}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                            title="Download original uploaded passport PDF"
                          >
                            {isDownloadingPdf === app.id ? '...' : '📥 PDF'}
                          </button>
                        )}
                      </div>

                      {deletingConfirmId === app.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-rose-400 font-semibold">Delete?</span>
                          <button
                            onClick={() => handleDeleteApplication(app.id)}
                            disabled={isDeleting === app.id}
                            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] cursor-pointer"
                          >
                            {isDeleting === app.id ? '...' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setDeletingConfirmId(null)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-slate-200 text-[10px] cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingConfirmId(app.id)}
                          className="text-slate-400 hover:text-rose-400 px-1.5 py-1 rounded transition-colors cursor-pointer"
                          title="Delete application"
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Current Application & Autofill Card */}
        <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-3.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 uppercase tracking-wider">Current Application</span>
            {detection?.matched ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {detection.page}
              </span>
            ) : (
              <span className="text-slate-500 italic">Portal not detected</span>
            )}
          </div>

          {selectedSummary ? (
            <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-700/70 text-xs">
              <div className="font-bold text-slate-100">
                {selectedSummary.applicantName || 'Unnamed Applicant'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Passport: <span className="text-slate-200 font-semibold">{selectedSummary.passportNumber || 'N/A'}</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/60 rounded-lg p-2.5 border border-dashed border-slate-700 text-xs text-slate-400 text-center">
              No application selected. Select one above to enable autofill.
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleAutofillCurrentPage}
              disabled={isAutofilling || !selectedApplicationId}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 px-3 rounded-lg text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isAutofilling ? 'Autofilling Page...' : '⚡ Autofill Current Page'}
            </button>

            {canUndo && (
              <button
                onClick={handleUndoAutofill}
                disabled={isUndoing}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-1.5 px-3 rounded-lg text-xs border border-slate-700 transition-colors cursor-pointer"
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
