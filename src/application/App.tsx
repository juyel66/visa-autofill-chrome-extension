import React, { useEffect, useState, useMemo, useCallback } from 'react'
import type { ApplicantProfile } from '../core/applicant/types'
import type { DocumentRecord } from '../core/document/types'
import {
  BANGLADESH_APPLICATION_SCHEMA,
  type ApplicationFieldDef,
} from '../core/application/fieldSchema'
import type {
  SavedApplication,
  ApplicationFieldValue,
  ApplicationFieldSource,
} from '../core/application/types'
import {
  getSavedApplicationByApplicantId,
  saveApplication,
} from '../core/application/applicationStorage'
import { populateApplicationFromDocuments } from '../core/application/applicationMerger'

export const App: React.FC = () => {
  const [applicantId, setApplicantId] = useState<string>('')
  const [applicants, setApplicants] = useState<ApplicantProfile[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [application, setApplication] = useState<SavedApplication | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string>('registration')
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')

  const loadApplicationForApplicant = useCallback(
    async (targetId: string, appList: ApplicantProfile[], allDocs: DocumentRecord[]) => {
      const existing = await getSavedApplicationByApplicantId(targetId)
      const profileDocs = allDocs.filter((d) => d.applicantId === targetId)
      const passportDoc =
        profileDocs.find((d) => d.documentType === 'passport' && d.extractedDataConfirmed) ||
        profileDocs.find((d) => d.documentType === 'passport')
      const ogdDoc =
        profileDocs.find((d) => d.documentType === 'ogd' && d.extractedDataConfirmed) ||
        profileDocs.find((d) => d.documentType === 'ogd')
      const activeProf = appList.find((a) => a.applicantId === targetId)

      if (existing) {
        setApplication(existing)
      } else {
        const initialApp = populateApplicationFromDocuments({
          applicantId: targetId,
          passportDoc,
          ogdDoc,
          existingApp: null,
          notes: activeProf?.notes,
        })
        setApplication(initialApp)
      }
    },
    []
  )

  // 1. Initial Load: Parse URL params & fetch storage
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const urlApplicantId = urlParams.get('applicantId')

        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.get(
            ['visa_autofill_applicants', 'visa_autofill_selected_applicant_id', 'visa_autofill_documents'],
            async (res) => {
              const appList = (res.visa_autofill_applicants || []) as ApplicantProfile[]
              const allDocs = (res.visa_autofill_documents || []) as DocumentRecord[]
              const storedSelectedId = typeof res.visa_autofill_selected_applicant_id === 'string' ? res.visa_autofill_selected_applicant_id : ''
              const selectedId: string = urlApplicantId || storedSelectedId || appList[0]?.applicantId || 'PROFILE_001'

              setApplicants(appList)
              setDocuments(allDocs)
              setApplicantId(selectedId)

              await loadApplicationForApplicant(selectedId, appList, allDocs)
              setLoading(false)
            }
          )
        } else {
          // Dev fallback
          const fallbackId = urlApplicantId || 'PROFILE_001'
          setApplicantId(fallbackId)
          await loadApplicationForApplicant(fallbackId, [], [])
          setLoading(false)
        }
      } catch (err) {
        console.error('Error loading application workspace data:', err)
        setLoading(false)
      }
    }

    loadData()
  }, [loadApplicationForApplicant])

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 4000)
  }

  const handleApplicantChange = async (newId: string) => {
    setApplicantId(newId)
    setLoading(true)
    await loadApplicationForApplicant(newId, applicants, documents)
    setLoading(false)
  }

  const handleFieldChange = (key: string, value: string | boolean) => {
    if (!application) return

    const currentField = application.fields[key] || {
      value: '',
      source: 'missing',
    }

    const updatedField: ApplicationFieldValue = {
      ...currentField,
      value,
      source: 'manual',
      isUserEdited: true,
    }

    setApplication({
      ...application,
      fields: {
        ...application.fields,
        [key]: updatedField,
      },
      manualEdits: {
        ...application.manualEdits,
        [key]: true,
      },
      status: 'ready_for_autofill',
    })
  }

  const handleResetToExtracted = (key: string) => {
    if (!application) return
    const currentField = application.fields[key]
    if (!currentField) return

    const originalVal = currentField.originalExtractedValue
    const restoredSource: ApplicationFieldSource = currentField.documentId ? (currentField.source === 'ogd' ? 'ogd' : 'passport') : 'missing'

    const updatedManualEdits = { ...application.manualEdits }
    delete updatedManualEdits[key]

    setApplication({
      ...application,
      fields: {
        ...application.fields,
        [key]: {
          ...currentField,
          value: originalVal !== undefined ? originalVal : '',
          source: restoredSource,
          isUserEdited: false,
        },
      },
      manualEdits: updatedManualEdits,
    })
    showToast(`Restored "${key}" to original extracted value.`, 'info')
  }

  const handleSave = async () => {
    if (!application) return
    setSaving(true)
    try {
      const toSave: SavedApplication = {
        ...application,
        status: 'ready_for_autofill',
        provenance: {
          ...application.provenance,
          lastSavedAt: new Date().toISOString(),
        },
      }
      await saveApplication(toSave)
      setApplication(toSave)
      showToast('✓ Application saved successfully! Ready for portal autofill.', 'success')
    } catch (err) {
      console.error('Save failed:', err)
      showToast('Failed to save application.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleRefreshFromDocuments = () => {
    if (!applicantId) return
    const profileDocs = documents.filter((d) => d.applicantId === applicantId)
    const passportDoc = profileDocs.find((d) => d.documentType === 'passport' && d.extractedDataConfirmed) || profileDocs.find((d) => d.documentType === 'passport')
    const ogdDoc = profileDocs.find((d) => d.documentType === 'ogd' && d.extractedDataConfirmed) || profileDocs.find((d) => d.documentType === 'ogd')
    const activeProf = applicants.find((a) => a.applicantId === applicantId)

    const refreshed = populateApplicationFromDocuments({
      applicantId,
      passportDoc,
      ogdDoc,
      existingApp: application,
      notes: activeProf?.notes,
    })

    setApplication(refreshed)
    showToast('Updated workspace fields from latest confirmed documents.', 'info')
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !application) return

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setApplication({
        ...application,
        photograph: {
          dataUrl,
          fileName: file.name,
          fileSize: file.size,
        },
      })
      showToast(`Attached applicant photograph "${file.name}"`, 'success')
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    if (!application) return
    setApplication({
      ...application,
      photograph: undefined,
    })
    showToast('Removed photograph.', 'info')
  }

  // Calculate field statistics
  const stats = useMemo(() => {
    if (!application) return { total: 0, filled: 0, edited: 0, missing: 0 }
    let total = 0
    let filled = 0
    let edited = 0
    let missing = 0

    BANGLADESH_APPLICATION_SCHEMA.forEach((sec) => {
      sec.fields.forEach((f) => {
        total++
        const val = application.fields[f.key]
        if (val && val.value !== '' && val.value !== undefined && val.value !== null && val.value !== false) {
          filled++
          if (val.isUserEdited) edited++
        } else {
          missing++
        }
      })
    })

    return { total, filled, edited, missing }
  }, [application])

  const profileDocs = useMemo(() => {
    return documents.filter((d) => d.applicantId === applicantId)
  }, [documents, applicantId])

  const passportDoc = profileDocs.find((d) => d.documentType === 'passport')
  const ogdDoc = profileDocs.find((d) => d.documentType === 'ogd')

  const activeSection = useMemo(() => {
    return (
      BANGLADESH_APPLICATION_SCHEMA.find((s) => s.id === activeSectionId) ||
      BANGLADESH_APPLICATION_SCHEMA[0]
    )
  }, [activeSectionId])

  const renderFieldSourceBadge = (fieldKey: string) => {
    if (!application) return null
    const f = application.fields[fieldKey]
    if (!f || f.value === '' || f.value === undefined || f.value === null) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-amber-400/90 border border-slate-700">
          <span>⚠</span> Not found in document &bull; Manual entry
        </span>
      )
    }

    if (f.isUserEdited) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-900/60 text-amber-300 border border-amber-700/50">
          <span>✎</span> Manual Edit
        </span>
      )
    }

    if (f.source === 'passport') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
          <span>✓</span> Passport PDF
        </span>
      )
    }

    if (f.source === 'ogd') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-900/60 text-purple-300 border border-purple-700/50">
          <span>✓</span> OGD History
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-amber-400/90 border border-slate-700">
        <span>⚠</span> Not found in document &bull; Manual entry
      </span>
    )
  }

  const renderFieldInput = (field: ApplicationFieldDef) => {
    if (!application) return null
    const fieldValue = application.fields[field.key]
    const rawVal = fieldValue?.value ?? ''

    if (field.inputType === 'checkbox') {
      const checked = Boolean(rawVal)
      return (
        <label className="flex items-center gap-3 cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => handleFieldChange(field.key, e.target.checked)}
            className="w-5 h-5 rounded bg-slate-800 border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
          />
          <span className="text-sm font-medium text-slate-200">{field.label}</span>
        </label>
      )
    }

    if (field.inputType === 'radio' && field.options) {
      const strVal = String(rawVal)
      return (
        <div className="flex flex-wrap gap-4 mt-1.5">
          {field.options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm text-slate-200">
              <input
                type="radio"
                name={field.key}
                value={opt.value}
                checked={strVal.toLowerCase() === opt.value.toLowerCase()}
                onChange={() => handleFieldChange(field.key, opt.value)}
                className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-600 focus:ring-blue-500"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )
    }

    if (field.inputType === 'select' && field.options) {
      const strVal = String(rawVal)
      return (
        <select
          value={strVal}
          onChange={(e) => handleFieldChange(field.key, e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
        >
          <option value="">-- Select {field.label} --</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    }

    if (field.inputType === 'textarea') {
      const strVal = String(rawVal)
      return (
        <textarea
          rows={2}
          value={strVal}
          onChange={(e) => handleFieldChange(field.key, e.target.value)}
          placeholder={field.placeholder || `Enter ${field.label}...`}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
        />
      )
    }

    // Default text or date input
    const strVal = String(rawVal)
    return (
      <input
        type={field.inputType === 'date' ? 'text' : 'text'}
        value={strVal}
        onChange={(e) => handleFieldChange(field.key, e.target.value)}
        placeholder={field.placeholder || (field.inputType === 'date' ? 'DD/MM/YYYY' : `Enter ${field.label}...`)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder:text-slate-500"
      />
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-300">
        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
        <p className="text-lg font-medium">Loading Application Workspace...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              🇮🇳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                  Bangladesh Indian Visa Application Workspace
                </h1>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/50">
                  Full Page Mode
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authoritative multi-page application editor & portal autofill source
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Profile Selector */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-xs text-slate-400 uppercase font-semibold">Profile:</span>
              <select
                value={applicantId}
                onChange={(e) => handleApplicantChange(e.target.value)}
                className="bg-transparent text-sm font-semibold text-blue-400 focus:outline-none cursor-pointer"
              >
                {applicants.length > 0 ? (
                  applicants.map((a) => (
                    <option key={a.applicantId} value={a.applicantId} className="bg-slate-800 text-slate-100">
                      {a.applicantId}
                    </option>
                  ))
                ) : (
                  <option value={applicantId} className="bg-slate-800 text-slate-100">
                    {applicantId || 'PROFILE 001'}
                  </option>
                )}
              </select>
            </div>

            {/* Application Status Badge */}
            <div
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
                application?.status === 'ready_for_autofill'
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60'
                  : 'bg-amber-950/60 text-amber-400 border-amber-700/60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
              {application?.status === 'ready_for_autofill' ? 'Ready for Autofill' : 'Draft'}
            </div>

            {/* Save Application Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-lg shadow-md hover:shadow-blue-500/20 transition-all flex items-center gap-2 text-sm cursor-pointer"
            >
              {saving ? 'Saving...' : '💾 Save Application'}
            </button>
          </div>
        </div>

        {/* Sub-bar: Document provenance & quick statistics */}
        <div className="bg-slate-900/60 border-t border-slate-800/80 px-6 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-4">
              <span className="text-slate-400">Documents:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-300">Passport:</span>
                {passportDoc ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    ✓ {passportDoc.fileName} ({passportDoc.extractedDataConfirmed ? 'Confirmed' : 'Uploaded'})
                  </span>
                ) : (
                  <span className="text-slate-500 italic">None</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-300">OGD:</span>
                {ogdDoc ? (
                  <span className="text-purple-400 font-medium flex items-center gap-1">
                    ✓ {ogdDoc.fileName} ({ogdDoc.extractedDataConfirmed ? 'Confirmed' : 'Uploaded'})
                  </span>
                ) : (
                  <span className="text-slate-500 italic">None</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <span>
                Total Fields: <strong className="text-slate-200">{stats.total}</strong>
              </span>
              <span>
                Filled: <strong className="text-emerald-400">{stats.filled}</strong>
              </span>
              <span>
                Manually Edited: <strong className="text-amber-400">{stats.edited}</strong>
              </span>
              <span>
                Blank/Missing: <strong className="text-slate-400">{stats.missing}</strong>
              </span>
              <button
                onClick={handleRefreshFromDocuments}
                className="text-blue-400 hover:text-blue-300 underline text-xs cursor-pointer ml-2"
              >
                🔄 Re-sync with Documents
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Toast Banner */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-lg shadow-xl text-sm font-medium border flex items-center gap-3 ${
              toast.type === 'success'
                ? 'bg-emerald-900/90 text-emerald-100 border-emerald-600'
                : toast.type === 'error'
                ? 'bg-rose-900/90 text-rose-100 border-rose-600'
                : 'bg-blue-900/90 text-blue-100 border-blue-600'
            }`}
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 flex flex-col md:flex-row gap-6">
        {/* Left Sidebar: Navigation Tabs */}
        <aside className="w-full md:w-72 flex-shrink-0">
          <div className="sticky top-32 space-y-2">
            <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 shadow-sm mb-4">
              <input
                type="text"
                placeholder="Search application fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <nav className="space-y-1.5 bg-slate-900/80 rounded-xl p-2 border border-slate-800">
              {BANGLADESH_APPLICATION_SCHEMA.map((section) => {
                const isActive = activeSectionId === section.id
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSectionId(section.id)}
                    className={`w-full text-left px-3.5 py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-between cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{section.title}</div>
                      <div className={`text-xs mt-0.5 line-clamp-1 ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                        {section.fields.length > 0 ? `${section.fields.length} fields` : 'Photo upload'}
                      </div>
                    </div>
                    {isActive && <span className="text-white">→</span>}
                  </button>
                )
              })}
            </nav>

            {/* Quick Autofill Instructions Card */}
            <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800 text-xs text-slate-400 space-y-2">
              <div className="font-bold text-slate-300 flex items-center gap-1.5">
                <span>💡</span> How Portal Autofill Works
              </div>
              <p>
                1. Review and edit fields in this workspace.
              </p>
              <p>
                2. Click <strong>Save Application</strong>.
              </p>
              <p>
                3. Open Indian Visa portal tab and click <strong>Autofill</strong> in popup.
              </p>
              <p className="text-amber-400/90 pt-1 font-medium">
                No PDF attachment to the website is required!
              </p>
            </div>
          </div>
        </aside>

        {/* Right Area: Form Section Content */}
        <main className="flex-1 min-w-0 bg-slate-900/80 rounded-2xl border border-slate-800 p-6 shadow-sm flex flex-col">
          {/* Section Header */}
          <div className="border-b border-slate-800 pb-4 mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-100">{activeSection.title}</h2>
              <p className="text-xs text-slate-400 mt-1">{activeSection.subtitle}</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-lg text-sm shadow transition-all cursor-pointer"
            >
              {saving ? 'Saving...' : '💾 Save Changes'}
            </button>
          </div>

          {/* Section Manual Security Notices */}
          {activeSection.manualNotices && activeSection.manualNotices.length > 0 && (
            <div className="space-y-3 mb-6">
              {activeSection.manualNotices.map((notice, idx) => (
                <div
                  key={idx}
                  className="bg-amber-950/40 border border-amber-700/60 rounded-xl p-4 flex items-start gap-3 text-amber-200"
                >
                  <span className="text-xl flex-shrink-0">⚠️</span>
                  <div className="text-xs space-y-0.5">
                    <strong className="font-bold text-amber-100 block">{notice.title}</strong>
                    <p className="text-amber-300/90 leading-relaxed">{notice.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Section 6: Photograph Custom Upload Area */}
          {activeSection.id === 'photoUpload' && (
            <div className="space-y-6">
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-6">
                <h3 className="text-base font-semibold text-slate-200 mb-2">Applicant Photograph</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Manage the applicant photo within your extension workspace for preview and validation.
                </p>

                {application?.photograph?.dataUrl ? (
                  <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                    <img
                      src={application.photograph.dataUrl}
                      alt="Applicant Photograph"
                      className="w-36 h-44 object-cover rounded-lg border-2 border-slate-700 shadow-md"
                    />
                    <div className="space-y-2 text-xs text-slate-300">
                      <div>
                        <strong>File Name:</strong> {application.photograph.fileName || 'applicant_photo.jpg'}
                      </div>
                      <div>
                        <strong>Size:</strong>{' '}
                        {application.photograph.fileSize
                          ? `${(application.photograph.fileSize / 1024).toFixed(1)} KB`
                          : 'Valid'}
                      </div>
                      <div className="text-emerald-400 font-medium">✓ Photograph attached to Application Workspace</div>
                      <div className="pt-2">
                        <button
                          onClick={handleRemovePhoto}
                          className="bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/60 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Remove Photograph
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center bg-slate-900/40">
                    <div className="text-4xl mb-3">📷</div>
                    <p className="text-sm font-medium text-slate-300 mb-1">No photograph attached yet</p>
                    <p className="text-xs text-slate-500 mb-4">Upload a passport size applicant image (JPEG/PNG)</p>
                    <label className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors shadow">
                      Choose Photo
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Regular Field Grid by Subsections */}
          {activeSection.fields.length > 0 && (
            <div className="space-y-8 flex-1">
              {(() => {
                // Group fields by subsection
                const groups: Record<string, ApplicationFieldDef[]> = {}
                activeSection.fields.forEach((f) => {
                  const sub = f.subsection || 'General Fields'
                  if (!groups[sub]) groups[sub] = []
                  groups[sub].push(f)
                })

                return Object.entries(groups).map(([subTitle, fieldsInGroup]) => {
                  const filtered = fieldsInGroup.filter((f) =>
                    searchQuery
                      ? f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        f.key.toLowerCase().includes(searchQuery.toLowerCase())
                      : true
                  )

                  if (filtered.length === 0) return null

                  return (
                    <div key={subTitle} className="space-y-4">
                      {subTitle !== 'General Fields' && (
                        <div className="border-b border-slate-800/80 pb-1.5">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400">{subTitle}</h3>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filtered.map((field) => {
                          const isEdited = application?.fields[field.key]?.isUserEdited
                          return (
                            <div
                              key={field.key}
                              className={`bg-slate-900/60 rounded-xl p-3.5 border transition-all ${
                                field.inputType === 'textarea' || field.inputType === 'checkbox'
                                  ? 'md:col-span-2'
                                  : ''
                              } ${
                                isEdited
                                  ? 'border-amber-700/50 bg-amber-950/10'
                                  : 'border-slate-800/90 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <label className="text-xs font-semibold text-slate-300">
                                  {field.label}
                                  {field.requiredInPortal && <span className="text-rose-400 ml-1">*</span>}
                                </label>
                                <div className="flex items-center gap-1.5">
                                  {renderFieldSourceBadge(field.key)}
                                  {isEdited && (
                                    <button
                                      title="Reset to original extracted value"
                                      onClick={() => handleResetToExtracted(field.key)}
                                      className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                                    >
                                      ↺
                                    </button>
                                  )}
                                </div>
                              </div>

                              {renderFieldInput(field)}

                              {field.description && (
                                <p className="text-xs text-slate-500 mt-1">{field.description}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}

          {/* Bottom Save Action Bar */}
          <div className="border-t border-slate-800 pt-6 mt-8 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {stats.missing > 0 ? (
                <span>
                  💡 <strong>{stats.missing} fields</strong> remain blank. You can save now and fill them later.
                </span>
              ) : (
                <span className="text-emerald-400 font-medium">✓ All fields populated and verified!</span>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-6 py-2 rounded-lg text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              {saving ? 'Saving...' : '💾 SAVE APPLICATION'}
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
