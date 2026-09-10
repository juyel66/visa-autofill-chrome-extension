import React, { useEffect, useState, useMemo, useCallback } from 'react'
import type { ApplicantProfile } from '../core/applicant/types'
import type { DocumentRecord } from '../core/document/types'
import { getLatestDocument } from '../core/document'
import {
  getAllSchemaFields,
  WORKSPACE_SECTIONS,
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
  const [activeNavId, setActiveNavId] = useState<string>('personalDetails')
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showAllFields, setShowAllFields] = useState<boolean>(false)

  // Map of all field definitions indexed by key for quick lookup
  const fieldDefMap = useMemo(() => {
    const all = getAllSchemaFields()
    const map = new Map<string, ApplicationFieldDef>()
    all.forEach((f) => map.set(f.key, f))
    return map
  }, [])

  const loadApplicationForApplicant = useCallback(
    async (targetId: string, appList: ApplicantProfile[], allDocs: DocumentRecord[]) => {
      const existing = await getSavedApplicationByApplicantId(targetId)
      const profileDocs = allDocs.filter((d) => d.applicantId === targetId)
      const passportDoc = getLatestDocument(profileDocs, 'passport')
      const ogdDoc = getLatestDocument(profileDocs, 'ogd')
      const activeProf = appList.find((a) => a.applicantId === targetId)

      const mergedApp = populateApplicationFromDocuments({
        applicantId: targetId,
        passportDoc,
        ogdDoc,
        existingApp: existing,
        notes: activeProf?.notes,
      })
      setApplication(mergedApp)
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
    const restoredSource: ApplicationFieldSource = currentField.documentId
      ? currentField.source === 'ogd'
        ? 'ogd'
        : 'passport'
      : 'missing'

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

  const handleCopyPresentToPermanent = () => {
    if (!application) return
    const pres1 = String(application.fields['pres_addr1']?.value || '')
    const pres2 = String(application.fields['pres_addr2']?.value || '')
    const presCity = String(application.fields['state_name']?.value || '')

    const updatedFields = { ...application.fields }
    const updatedEdits = { ...application.manualEdits }

    if (pres1) {
      updatedFields['perm_add1'] = {
        value: pres1,
        source: 'manual',
        isUserEdited: true,
      }
      updatedEdits['perm_add1'] = true
    }
    if (pres2) {
      updatedFields['perm_add2'] = {
        value: pres2,
        source: 'manual',
        isUserEdited: true,
      }
      updatedEdits['perm_add2'] = true
    }
    if (presCity) {
      updatedFields['perm_add3'] = {
        value: presCity,
        source: 'manual',
        isUserEdited: true,
      }
      updatedEdits['perm_add3'] = true
    }

    setApplication({
      ...application,
      fields: updatedFields,
      manualEdits: updatedEdits,
      status: 'ready_for_autofill',
    })
    showToast('✓ Copied Present Address to Permanent Address fields.', 'success')
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
      showToast('✓ Application saved successfully! All 100 fields ready for portal autofill.', 'success')
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
    const passportDoc = getLatestDocument(profileDocs, 'passport')
    const ogdDoc = getLatestDocument(profileDocs, 'ogd')
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

  // Check if a field should be visible in UI
  const isFieldVisibleInUI = useCallback(
    (field: ApplicationFieldDef): boolean => {
      if (searchQuery.trim()) return true
      if (showAllFields) return true
      if (field.visibleByDefault !== false) return true

      // If hidden by default, reveal if it has a non-empty value (so no data is concealed)
      const val = application?.fields[field.key]?.value
      if (val !== '' && val !== undefined && val !== null && val !== false) {
        return true
      }
      return false
    },
    [searchQuery, showAllFields, application]
  )

  // Calculate statistics across all 100 canonical fields
  const stats = useMemo(() => {
    if (!application) return { total: 0, visible: 0, hidden: 0, filled: 0, edited: 0, missing: 0 }
    let total = 0
    let visible = 0
    let hidden = 0
    let filled = 0
    let edited = 0
    let missing = 0

    const allFields = getAllSchemaFields()
    allFields.forEach((f) => {
      total++
      if (f.visibleByDefault === false) {
        hidden++
      } else {
        visible++
      }
      const val = application.fields[f.key]
      if (val && val.value !== '' && val.value !== undefined && val.value !== null && val.value !== false) {
        filled++
        if (val.isUserEdited) edited++
      } else {
        missing++
      }
    })

    return { total, visible, hidden, filled, edited, missing }
  }, [application])

  const profileDocs = useMemo(() => {
    return documents.filter((d) => d.applicantId === applicantId)
  }, [documents, applicantId])

  const passportDoc = getLatestDocument(profileDocs, 'passport')
  const ogdDoc = getLatestDocument(profileDocs, 'ogd')

  // Smooth scroll to section card
  const scrollToSection = (sectionId: string) => {
    setActiveNavId(sectionId)
    const element = document.getElementById(`sec-${sectionId}`)
    if (element) {
      const headerOffset = 110
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
    }
  }

  const renderFieldSourceBadge = (fieldKey: string) => {
    if (!application) return null
    const f = application.fields[fieldKey]
    if (!f || f.value === '' || f.value === undefined || f.value === null || f.value === false) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800/80 text-amber-400/90 border border-slate-700">
          <span>⚠</span> Manual Entry
        </span>
      )
    }

    if (f.isUserEdited) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/80 text-amber-300 border border-amber-700/60">
          <span>✎</span> Manual Edit
        </span>
      )
    }

    if (f.source === 'passport') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
          <span>✓</span> Passport PDF
        </span>
      )
    }

    if (f.source === 'ogd') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-950/80 text-purple-300 border border-purple-700/60">
          <span>✓</span> OGD History
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800/80 text-amber-400/90 border border-slate-700">
        <span>⚠</span> Manual Entry
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
        <label className="flex items-center gap-3 cursor-pointer mt-1 select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => handleFieldChange(field.key, e.target.checked)}
            className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
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
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm text-slate-200 select-none">
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
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder:text-slate-500"
        />
      )
    }

    // Default text or date input
    const strVal = String(rawVal)
    return (
      <input
        type="text"
        value={strVal}
        onChange={(e) => handleFieldChange(field.key, e.target.value)}
        placeholder={field.placeholder || (field.inputType === 'date' ? 'DD/MM/YYYY' : `Enter ${field.label}...`)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder:text-slate-500"
      />
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-300">
        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
        <p className="text-lg font-medium">Loading Application Workspace...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Sticky Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20 text-lg">
              🇮🇳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                  Indian Visa Smart Application Workspace
                </h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/50 hidden sm:inline-block">
                  One Page Workspace
                </span>
              </div>
              <p className="text-xs text-slate-400">
                All 10 sections on one full page &bull; Instant portal autofill source
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* View Mode Toggle: Curated vs Show All 100 Fields */}
            <button
              onClick={() => setShowAllFields((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                showAllFields
                  ? 'bg-indigo-950/90 border-indigo-500 text-indigo-200 hover:bg-indigo-900'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title={showAllFields ? 'Switch back to curated practical view' : 'Display all 100 canonical fields'}
            >
              <span>{showAllFields ? '👁️ All 100 Fields' : '⚡ Curated View'}</span>
            </button>

            {/* Profile Selector */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
              <span className="text-xs text-slate-400 uppercase font-semibold">Profile:</span>
              <select
                value={applicantId}
                onChange={(e) => handleApplicantChange(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-semibold text-blue-400 focus:outline-none cursor-pointer max-w-[140px] truncate"
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

            {/* Primary Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-lg shadow-md hover:shadow-blue-500/20 transition-all flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer"
            >
              {saving ? 'Saving...' : '💾 Save Application'}
            </button>
          </div>
        </div>

        {/* Sub-bar: Document provenance & quick statistics */}
        <div className="bg-slate-900/60 border-t border-slate-800/80 px-4 sm:px-6 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-4">
              <span className="text-slate-400 font-medium">Uploaded Documents:</span>
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

            <div className="flex items-center gap-3.5 text-slate-400">
              <span>
                Total Fields: <strong className="text-slate-200">{stats.total}</strong>
              </span>
              <span>
                Visible: <strong className="text-blue-400">{showAllFields ? stats.total : stats.visible}</strong>
              </span>
              <span>
                Filled: <strong className="text-emerald-400">{stats.filled}</strong>
              </span>
              <span>
                Edited: <strong className="text-amber-400">{stats.edited}</strong>
              </span>
              <button
                onClick={handleRefreshFromDocuments}
                className="text-blue-400 hover:text-blue-300 underline text-xs cursor-pointer ml-1"
                title="Re-run merger using current documents"
              >
                🔄 Re-sync
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Toast Alert Banner */}
      {toast && (
        <div className="fixed top-24 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-lg shadow-2xl text-sm font-medium border flex items-center gap-3 ${
              toast.type === 'success'
                ? 'bg-emerald-950/95 text-emerald-100 border-emerald-500'
                : toast.type === 'error'
                ? 'bg-rose-950/95 text-rose-100 border-rose-500'
                : 'bg-blue-950/95 text-blue-100 border-blue-500'
            }`}
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Single Full-Page Layout */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 flex flex-col md:flex-row gap-6">
        {/* Sticky Left Sidebar: Section Jump Navigator & Filter */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="sticky top-28 space-y-3">
            {/* Search Filter Box */}
            <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 shadow-sm">
              <input
                type="text"
                placeholder="Search any field..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Jump-to-Section Navigation */}
            <nav className="bg-slate-900/90 rounded-xl p-2 border border-slate-800 shadow-sm space-y-1">
              <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Jump to Section
              </div>
              {WORKSPACE_SECTIONS.map((sec) => {
                const isActive = activeNavId === sec.id
                // Count filled fields in this section
                let filledInSec = 0
                sec.fieldKeys.forEach((k) => {
                  const val = application?.fields[k]?.value
                  if (val !== '' && val !== undefined && val !== null && val !== false) filledInSec++
                })
                const isPhoto = sec.id === 'photoUpload'

                return (
                  <button
                    key={sec.id}
                    onClick={() => scrollToSection(sec.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <span className="truncate">{sec.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-blue-800 text-blue-100'
                          : filledInSec > 0
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isPhoto
                        ? application?.photograph?.dataUrl
                          ? 'Attached'
                          : 'None'
                        : `${filledInSec}/${sec.fieldKeys.length}`}
                    </span>
                  </button>
                )
              })}
            </nav>

            {/* Quick View Mode Box */}
            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">Workspace View</span>
                <span className="text-[11px] text-blue-400 font-semibold">{showAllFields ? 'All 100 Fields' : 'Curated'}</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {showAllFields
                  ? 'Showing all 100 canonical fields including conditional & technical items.'
                  : 'Showing practical Indian Visa fields. Hidden items remain saved & autofillable.'}
              </p>
              <button
                onClick={() => setShowAllFields((prev) => !prev)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-1.5 px-2 rounded-lg font-medium text-xs transition-colors cursor-pointer text-center block"
              >
                {showAllFields ? '⚡ Curated View' : '👁️ Show All 100 Fields'}
              </button>
            </div>
          </div>
        </aside>

        {/* Right Area: Single Scrollable Page with 10 Section Cards */}
        <main className="flex-1 min-w-0 space-y-6">
          {WORKSPACE_SECTIONS.map((sec) => {
            const isPhotoSection = sec.id === 'photoUpload'
            const fieldDefs = sec.fieldKeys
              .map((k) => fieldDefMap.get(k))
              .filter((f): f is ApplicationFieldDef => Boolean(f))

            const visibleFields = fieldDefs.filter(isFieldVisibleInUI)
            const filteredFields = visibleFields.filter((f) =>
              searchQuery
                ? f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  f.key.toLowerCase().includes(searchQuery.toLowerCase())
                : true
            )

            const hiddenCount = fieldDefs.length - visibleFields.length

            if (!isPhotoSection && filteredFields.length === 0 && searchQuery) {
              return null
            }

            return (
              <section
                key={sec.id}
                id={`sec-${sec.id}`}
                className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-sm scroll-mt-28"
              >
                {/* Section Card Header */}
                <div className="border-b border-slate-800 pb-3 mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <span>{sec.title}</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">{sec.subtitle}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Special quick action for Permanent Address: Copy from Present */}
                    {sec.id === 'permanentAddress' && (
                      <button
                        onClick={handleCopyPresentToPermanent}
                        className="bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 font-semibold px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1"
                        title="Copy Address Line 1, 2, and City from Present Address"
                      >
                        📋 Same as Present Address
                      </button>
                    )}

                    {hiddenCount > 0 && !showAllFields && (
                      <button
                        onClick={() => setShowAllFields(true)}
                        className="text-xs text-slate-400 hover:text-blue-400 underline cursor-pointer bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/60"
                      >
                        + {hiddenCount} hidden field{hiddenCount > 1 ? 's' : ''} (Show)
                      </button>
                    )}
                  </div>
                </div>

                {/* Section Manual Security Notices (if any) */}
                {sec.manualNotices && sec.manualNotices.length > 0 && (
                  <div className="space-y-2 mb-5">
                    {sec.manualNotices.map((notice, idx) => (
                      <div
                        key={idx}
                        className="bg-amber-950/40 border border-amber-700/60 rounded-xl p-3.5 flex items-start gap-3 text-amber-200"
                      >
                        <span className="text-lg flex-shrink-0">⚠️</span>
                        <div className="text-xs space-y-0.5">
                          <strong className="font-bold text-amber-100 block">{notice.title}</strong>
                          <p className="text-amber-300/90 leading-relaxed">{notice.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Section 10: Photograph Upload & Preview */}
                {isPhotoSection && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">
                      Attach the applicant photograph for workspace preview and validation. Portal file chooser interaction remains manual.
                    </p>

                    {application?.photograph?.dataUrl ? (
                      <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                        <img
                          src={application.photograph.dataUrl}
                          alt="Applicant Photograph"
                          className="w-32 h-40 object-cover rounded-lg border-2 border-slate-700 shadow-md"
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
                      <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center bg-slate-950/40">
                        <div className="text-3xl mb-2">📷</div>
                        <p className="text-sm font-medium text-slate-300 mb-0.5">No photograph attached yet</p>
                        <p className="text-xs text-slate-500 mb-3">Upload a passport-size applicant photo (JPEG / PNG)</p>
                        <label className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors shadow">
                          Choose Photo
                          <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* Regular 2-Column Field Grid */}
                {!isPhotoSection && filteredFields.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filteredFields.map((field) => {
                      const isEdited = application?.fields[field.key]?.isUserEdited
                      const isHiddenByDefault = field.visibleByDefault === false
                      const isFullSpan =
                        field.inputType === 'textarea' ||
                        field.inputType === 'checkbox' ||
                        field.key.includes('flag') ||
                        field.key.includes('oth_ppt')

                      return (
                        <div
                          key={field.key}
                          className={`bg-slate-950/70 rounded-xl p-3.5 border transition-all ${
                            isFullSpan ? 'md:col-span-2' : ''
                          } ${
                            isEdited
                              ? 'border-amber-700/60 bg-amber-950/10'
                              : isHiddenByDefault
                              ? 'border-indigo-900/60 bg-indigo-950/15'
                              : 'border-slate-800/90 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 flex-wrap">
                              <span>{field.label}</span>
                              {field.requiredInPortal && <span className="text-rose-400">*</span>}
                              {isHiddenByDefault && (
                                <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/60">
                                  Advanced
                                </span>
                              )}
                            </label>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {renderFieldSourceBadge(field.key)}
                              {isEdited && (
                                <button
                                  title="Reset to original extracted value"
                                  onClick={() => handleResetToExtracted(field.key)}
                                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer p-0.5"
                                >
                                  ↺
                                </button>
                              )}
                            </div>
                          </div>

                          {renderFieldInput(field)}

                          {application?.fields[field.key]?.hasConflict && (
                            <div className="mt-2 p-2 rounded-lg bg-amber-950/60 border border-amber-600/70 text-amber-200 text-xs flex items-start gap-2">
                              <span className="text-amber-400 font-bold text-sm">⚠</span>
                              <div>
                                <strong className="text-amber-100 font-semibold block">Conflict detected</strong>
                                <p className="text-amber-300/90 text-[11px] leading-tight">
                                  {application.fields[field.key]?.conflictDetails || 'Current passport value takes precedence. Please verify manually.'}
                                </p>
                              </div>
                            </div>
                          )}

                          {field.description && (
                            <p className="text-[11px] text-slate-500 mt-1">{field.description}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}

          {/* Bottom Save Action Bar */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-md flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              {stats.missing > 0 ? (
                <span>
                  💡 <strong>{stats.missing} fields</strong> remain blank. You can save now and fill them later or let portal autofill handle the rest.
                </span>
              ) : (
                <span className="text-emerald-400 font-medium">
                  ✓ All schema fields are populated and ready for portal autofill!
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAllFields((prev) => !prev)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium px-3.5 py-2 rounded-lg text-xs transition-colors cursor-pointer"
              >
                {showAllFields ? '⚡ Switch to Curated View' : '👁️ Show All 100 Fields'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                {saving ? 'Saving...' : '💾 Save Application'}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
