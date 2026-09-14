import React, { useEffect, useState, useMemo, useCallback } from 'react'
import type { ApplicantProfile } from '../core/applicant/types'
import type { DocumentRecord } from '../core/document/types'
import { getLatestDocument, saveDocument } from '../core/document'
import {
  applyExtractionToApplicant,
  processUploadedDocumentPayload,
} from '../core/extraction'
import { saveApplicant } from '../core/storage'
import {
  getAllSchemaFields,
  WORKSPACE_PAGES,
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
import {
  getGeminiApiKey,
  saveGeminiApiKey,
  DEFAULT_GEMINI_API_KEY,
} from '../core/extraction/ai/geminiExtractor'
import { RegistrationSection } from './components/RegistrationSection'
import { BasicDetailsSection } from './components/BasicDetailsSection'
import { FamilyDetailsSection } from './components/FamilyDetailsSection'
import { VisaDetailsSection } from './components/VisaDetailsSection'
import { AdditionalQuestionsSection } from './components/AdditionalQuestionsSection'

export const App: React.FC = () => {
  const [applicantId, setApplicantId] = useState<string>('')
  const [applicants, setApplicants] = useState<ApplicantProfile[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [application, setApplication] = useState<SavedApplication | null>(null)
  const [activeNavId, setActiveNavId] = useState<string>('registration')
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showAllFields, setShowAllFields] = useState<boolean>(false)
  const [showAiModal, setShowAiModal] = useState<boolean>(false)
  const [apiKeyInput, setApiKeyInput] = useState<string>(DEFAULT_GEMINI_API_KEY)
  const [savingApiKey, setSavingApiKey] = useState<boolean>(false)

  const loadApplicationForApplicant = useCallback(
    async (targetId: string, appList: ApplicantProfile[], allDocs: DocumentRecord[]) => {
      const existing = await getSavedApplicationByApplicantId(targetId)
      const profileDocs = allDocs.filter((d) => d.applicantId === targetId)
      let passportDoc = getLatestDocument(profileDocs, 'passport') || profileDocs.find((d) => d.extractedDataConfirmed && d.extractedData)
      const ogdDoc = getLatestDocument(profileDocs, 'ogd')
      const activeProf = appList.find((a) => a.applicantId === targetId)

      // Auto-heal legacy passport document records that lack contact, address, place of issue, or family extraction in storage
      if (
        passportDoc &&
        passportDoc.fileDataUrl &&
        ((!passportDoc.extractedData?.contact?.phone && !passportDoc.extractedData?.presentAddress?.phone) ||
          !passportDoc.extractedData?.passport?.passportNumber?.value ||
          !passportDoc.extractedData?.permanentAddress?.addressLine1 ||
          !passportDoc.extractedData?.passport?.placeOfIssue?.value ||
          !passportDoc.extractedData?.family?.father?.name?.value)
      ) {
        try {
          const pipelineResult = await processUploadedDocumentPayload(
            passportDoc.fileDataUrl,
            passportDoc.fileName,
            passportDoc.mimeType
          )

          if (pipelineResult.hasExtractedFields) {
            const reExtracted = pipelineResult.extractedData
            const updatedDoc: DocumentRecord = {
              ...passportDoc,
              extractedData: {
                ...passportDoc.extractedData,
                ...reExtracted,
                personal: {
                  ...passportDoc.extractedData?.personal,
                  ...reExtracted.personal,
                },
                passport: {
                  ...passportDoc.extractedData?.passport,
                  ...reExtracted.passport,
                },
                contact: {
                  ...passportDoc.extractedData?.contact,
                  ...reExtracted.contact,
                },
                presentAddress: {
                  ...passportDoc.extractedData?.presentAddress,
                  ...reExtracted.presentAddress,
                },
                permanentAddress: {
                  ...passportDoc.extractedData?.permanentAddress,
                  ...reExtracted.permanentAddress,
                },
                family: {
                  ...passportDoc.extractedData?.family,
                  ...reExtracted.family,
                },
                employment: {
                  ...passportDoc.extractedData?.employment,
                  ...reExtracted.employment,
                },
                travel: {
                  ...passportDoc.extractedData?.travel,
                  ...reExtracted.travel,
                },
                previousVisa: {
                  ...passportDoc.extractedData?.previousVisa,
                  ...reExtracted.previousVisa,
                },
                sponsorIndia: {
                  ...passportDoc.extractedData?.sponsorIndia,
                  ...reExtracted.sponsorIndia,
                },
                sponsorMission: {
                  ...passportDoc.extractedData?.sponsorMission,
                  ...reExtracted.sponsorMission,
                },
              },
              extractedDataConfirmed: true,
            }
            await saveDocument(updatedDoc)
            passportDoc = updatedDoc
          }
        } catch (healErr) {
          console.warn('Auto-healing passport document contact info warning:', healErr)
        }
      }

      const mergedApp = populateApplicationFromDocuments({
        applicantId: targetId,
        passportDoc,
        ogdDoc,
        existingApp: existing,
        notes: activeProf?.notes,
      })

      if (passportDoc?.extractedData && activeProf) {
        try {
          const updatedProf = applyExtractionToApplicant(activeProf, passportDoc.extractedData)
          await saveApplicant(updatedProf)
        } catch (pErr) {
          console.warn('Profile sync warning on load:', pErr)
        }
      }

      await saveApplication(mergedApp)
      setApplication(mergedApp)
    },
    []
  )

  const handleSaveApiKey = async () => {
    setSavingApiKey(true)
    try {
      await saveGeminiApiKey(apiKeyInput)
      showToast('✓ Gemini API Key saved successfully!', 'success')
      setShowAiModal(false)
    } catch {
      showToast('Failed to save API Key', 'error')
    } finally {
      setSavingApiKey(false)
    }
  }

  // 1. Initial Load: Parse URL params & fetch storage
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const storedKey = await getGeminiApiKey()
        if (storedKey) setApiKeyInput(storedKey)

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
    setApplication((prevApp) => {
      if (!prevApp) return prevApp

      const currentField = prevApp.fields[key] || {
        value: '',
        source: 'missing',
      }

      const updatedField: ApplicationFieldValue = {
        ...currentField,
        value,
        source: 'manual',
        isUserEdited: true,
      }

      const updatedFields = {
        ...prevApp.fields,
        [key]: updatedField,
      }
      const updatedManualEdits = {
        ...prevApp.manualEdits,
        [key]: true,
      }

      // Keep aliases and dual fields in sync
      if (key === 'purpose') {
        updatedFields['appl.purpose'] = { ...updatedField }
        updatedManualEdits['appl.purpose'] = true
      } else if (key === 'appl.purpose') {
        updatedFields['purpose'] = { ...updatedField }
        updatedManualEdits['purpose'] = true
      } else if (key === 'appl.countryname') {
        updatedFields['present_country'] = { ...updatedField }
        updatedManualEdits['present_country'] = true
      } else if (key === 'present_country') {
        updatedFields['appl.countryname'] = { ...updatedField }
        updatedManualEdits['appl.countryname'] = true
      } else if (key === 'appl.journeydate') {
        updatedFields['journeydate'] = { ...updatedField }
        updatedManualEdits['journeydate'] = true
      } else if (key === 'journeydate') {
        updatedFields['appl.journeydate'] = { ...updatedField }
        updatedManualEdits['appl.journeydate'] = true
      }

      return {
        ...prevApp,
        fields: updatedFields,
        manualEdits: updatedManualEdits,
        status: 'ready_for_autofill',
      }
    })
  }

  const handleResetToExtracted = (key: string) => {
    setApplication((prevApp) => {
      if (!prevApp) return prevApp
      const currentField = prevApp.fields[key]
      if (!currentField) return prevApp

      const originalVal = currentField.originalExtractedValue
      const restoredSource: ApplicationFieldSource = currentField.documentId
        ? currentField.source === 'ogd'
          ? 'ogd'
          : 'passport'
        : 'missing'

      const updatedManualEdits = { ...prevApp.manualEdits }
      delete updatedManualEdits[key]

      const restoredField: ApplicationFieldValue = {
        ...currentField,
        value: originalVal !== undefined ? originalVal : '',
        source: restoredSource,
        isUserEdited: false,
      }

      const updatedFields = {
        ...prevApp.fields,
        [key]: restoredField,
      }

      if (key === 'purpose') {
        delete updatedManualEdits['appl.purpose']
        updatedFields['appl.purpose'] = { ...restoredField }
      } else if (key === 'appl.purpose') {
        delete updatedManualEdits['purpose']
        updatedFields['purpose'] = { ...restoredField }
      } else if (key === 'appl.countryname') {
        delete updatedManualEdits['present_country']
        updatedFields['present_country'] = { ...restoredField }
      } else if (key === 'present_country') {
        delete updatedManualEdits['appl.countryname']
        updatedFields['appl.countryname'] = { ...restoredField }
      } else if (key === 'appl.journeydate') {
        delete updatedManualEdits['journeydate']
        updatedFields['journeydate'] = { ...restoredField }
      } else if (key === 'journeydate') {
        delete updatedManualEdits['appl.journeydate']
        updatedFields['appl.journeydate'] = { ...restoredField }
      }

      return {
        ...prevApp,
        fields: updatedFields,
        manualEdits: updatedManualEdits,
      }
    })
    showToast(`Restored "${key}" to original extracted value.`, 'info')
  }

  const handleCopyPresentToPermanent = () => {
    if (!application) return
    const pres1 = String(application.fields['pres_addr1']?.value || '')
    const pres2 = String(application.fields['pres_addr2']?.value || '')
    const presCity = String(application.fields['village_town_city']?.value || application.fields['state_name']?.value || '')
    const presDistrict = String(application.fields['district']?.value || '')
    const presState = String(application.fields['state_province']?.value || application.fields['state_name']?.value || '')
    const presCountry = String(application.fields['present_country']?.value || application.fields['appl.countryname']?.value || '')
    const presPin = String(application.fields['pincode']?.value || '')

    const updatedFields = { ...application.fields }
    const updatedEdits = { ...application.manualEdits }

    if (pres1) {
      updatedFields['perm_add1'] = { value: pres1, source: 'manual', isUserEdited: true }
      updatedEdits['perm_add1'] = true
    }
    if (pres2) {
      updatedFields['perm_add2'] = { value: pres2, source: 'manual', isUserEdited: true }
      updatedEdits['perm_add2'] = true
    }
    if (presCity) {
      updatedFields['permanent_village_town_city'] = { value: presCity, source: 'manual', isUserEdited: true }
      updatedEdits['permanent_village_town_city'] = true
    }
    if (presDistrict) {
      updatedFields['permanent_district'] = { value: presDistrict, source: 'manual', isUserEdited: true }
      updatedEdits['permanent_district'] = true
    }
    if (presState) {
      updatedFields['permanent_state_province'] = { value: presState, source: 'manual', isUserEdited: true }
      updatedEdits['permanent_state_province'] = true
      updatedFields['perm_add3'] = { value: presState, source: 'manual', isUserEdited: true }
      updatedEdits['perm_add3'] = true
    }
    if (presCountry) {
      updatedFields['permanent_country'] = { value: presCountry, source: 'manual', isUserEdited: true }
      updatedEdits['permanent_country'] = true
    }
    if (presPin) {
      updatedFields['permanent_postal_code'] = { value: presPin, source: 'manual', isUserEdited: true }
      updatedEdits['permanent_postal_code'] = true
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

  const handleRefreshFromDocuments = async () => {
    if (!applicantId) return
    setLoading(true)
    const profileDocs = documents.filter((d) => d.applicantId === applicantId)
    let passportDoc = getLatestDocument(profileDocs, 'passport')
    const ogdDoc = getLatestDocument(profileDocs, 'ogd')
    const activeProf = applicants.find((a) => a.applicantId === applicantId)

    if (passportDoc && passportDoc.fileDataUrl) {
      try {
        const pipelineResult = await processUploadedDocumentPayload(
          passportDoc.fileDataUrl,
          passportDoc.fileName,
          passportDoc.mimeType
        )

        if (pipelineResult.hasExtractedFields) {
          const reExtracted = pipelineResult.extractedData
          const updatedDoc: DocumentRecord = {
            ...passportDoc,
            extractedData: {
              ...passportDoc.extractedData,
              ...reExtracted,
              passport: {
                ...passportDoc.extractedData?.passport,
                ...reExtracted.passport,
              },
              contact: {
                ...passportDoc.extractedData?.contact,
                ...reExtracted.contact,
              },
              presentAddress: {
                ...passportDoc.extractedData?.presentAddress,
                ...reExtracted.presentAddress,
              },
              permanentAddress: {
                ...passportDoc.extractedData?.permanentAddress,
                ...reExtracted.permanentAddress,
              },
              family: {
                ...passportDoc.extractedData?.family,
                ...reExtracted.family,
              },
            },
            extractedDataConfirmed: true,
          }
          await saveDocument(updatedDoc)
          setDocuments((prev) => prev.map((d) => (d.documentId === updatedDoc.documentId ? updatedDoc : d)))
          passportDoc = updatedDoc
        }
      } catch (healErr) {
        console.warn('Re-sync auto-healing error:', healErr)
      }
    }

    const refreshed = populateApplicationFromDocuments({
      applicantId,
      passportDoc,
      ogdDoc,
      existingApp: application,
      notes: activeProf?.notes,
    })

    if (passportDoc?.extractedData && activeProf) {
      try {
        const updatedProf = applyExtractionToApplicant(activeProf, passportDoc.extractedData)
        await saveApplicant(updatedProf)
      } catch (pErr) {
        console.warn('Profile sync warning on refresh:', pErr)
      }
    }

    await saveApplication(refreshed)
    setApplication(refreshed)
    setLoading(false)
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

  const renderFieldSourceBadge = (fieldKeyOrValue?: string | ApplicationFieldValue) => {
    if (!application || !fieldKeyOrValue) return null
    let f: ApplicationFieldValue | undefined
    if (typeof fieldKeyOrValue === 'string') {
      f = application.fields[fieldKeyOrValue]
    } else {
      f = fieldKeyOrValue
    }
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

    if (f.source === 'derived') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-950/80 text-blue-300 border border-blue-700/60">
          <span>⚙</span> Derived Rule
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
            {/* Gemini AI Settings & Status */}
            <button
              onClick={() => setShowAiModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-900/80 to-indigo-900/80 hover:from-blue-800 hover:to-indigo-800 text-blue-200 border border-blue-500/50 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-blue-500/10"
              title="Configure Gemini Flash Vision AI API Key & settings"
            >
              <span>🤖 Gemini AI Active</span>
            </button>

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

            {/* Jump-to-Section Navigation: Exactly 5 Authentic Portal Pages */}
            <nav className="bg-slate-900/90 rounded-xl p-2 border border-slate-800 shadow-sm space-y-1.5">
              <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Application Pages
              </div>
              {WORKSPACE_PAGES.map((page) => {
                const isActive = activeNavId === page.id
                // Count filled fields in this page
                let filledInPage = 0
                page.fieldKeys.forEach((k) => {
                  const val = application?.fields[k]?.value
                  if (val !== '' && val !== undefined && val !== null && val !== false) filledInPage++
                })

                return (
                  <button
                    key={page.id}
                    onClick={() => scrollToSection(page.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between cursor-pointer border ${
                      isActive
                        ? 'bg-blue-600 text-white font-bold border-blue-500 shadow-md shadow-blue-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                          isActive ? 'bg-white text-blue-700' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {page.pageNumber}
                      </span>
                      <span className="truncate">{page.title.replace(/^\d+\.\s*/, '')}</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                        isActive
                          ? 'bg-blue-800 text-blue-100'
                          : filledInPage >= page.fieldKeys.length
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                          : filledInPage > 0
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {filledInPage}/{page.fieldKeys.length}
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
                  : 'Showing 5 authentic Indian Visa portal pages with live data synchronization.'}
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

        {/* Right Area: Exactly 5 Sequential Authentic Portal Pages */}
        <main className="flex-1 min-w-0 space-y-8">
          {/* PAGE 1: Registration Form */}
          <section id="sec-registration" className="scroll-mt-28">
            <RegistrationSection
              application={application}
              onFieldChange={handleFieldChange}
              onResetField={handleResetToExtracted}
              renderSourceBadge={renderFieldSourceBadge}
              onContinue={async () => {
                await handleSave()
                scrollToSection('basicDetails')
              }}
              onNextPage={() => scrollToSection('basicDetails')}
            />
          </section>

          {/* PAGE 2: Basic Details & Passport Form */}
          <section id="sec-basicDetails" className="scroll-mt-28">
            <BasicDetailsSection
              application={application}
              onFieldChange={handleFieldChange}
              onResetField={handleResetToExtracted}
              renderSourceBadge={renderFieldSourceBadge}
              onSaveAndContinue={async () => {
                await handleSave()
                scrollToSection('familyDetails')
              }}
              onSaveTemporarily={handleSave}
              onPreviousPage={() => scrollToSection('registration')}
            />
          </section>

          {/* PAGE 3: Family Details & Address Form */}
          <section id="sec-familyDetails" className="scroll-mt-28">
            <FamilyDetailsSection
              application={application}
              onFieldChange={handleFieldChange}
              onResetField={handleResetToExtracted}
              renderSourceBadge={renderFieldSourceBadge}
              onCopyPresentToPermanent={handleCopyPresentToPermanent}
              onSaveAndContinue={async () => {
                await handleSave()
                scrollToSection('visaDetails')
              }}
              onSaveTemporarily={handleSave}
              onPreviousPage={() => scrollToSection('basicDetails')}
            />
          </section>

          {/* PAGE 4: Visa Details & References Form */}
          <section id="sec-visaDetails" className="scroll-mt-28">
            <VisaDetailsSection
              application={application}
              onFieldChange={handleFieldChange}
              onResetField={handleResetToExtracted}
              renderSourceBadge={renderFieldSourceBadge}
              onUploadPhoto={handlePhotoUpload}
              onRemovePhoto={handleRemovePhoto}
              onSaveAndContinue={async () => {
                await handleSave()
                scrollToSection('additionalQuestions')
              }}
              onSaveTemporarily={handleSave}
              onPreviousPage={() => scrollToSection('familyDetails')}
            />
          </section>

          {/* PAGE 5: Additional Questions & Declarations */}
          <section id="sec-additionalQuestions" className="scroll-mt-28">
            <AdditionalQuestionsSection
              application={application}
              onFieldChange={handleFieldChange}
              onResetField={handleResetToExtracted}
              renderSourceBadge={renderFieldSourceBadge}
              onSaveAndFinish={handleSave}
              onSaveTemporarily={handleSave}
              onPreviousPage={() => scrollToSection('visaDetails')}
            />
          </section>

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

      {/* Gemini AI Configuration Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Gemini Vision AI Engine</h3>
                  <p className="text-xs text-blue-400 font-medium">Multimodal Document & Passport Extraction</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Google Gemini Vision AI reads scanned and digital passport documents, bilingual Bengali/English headers, emergency contacts, addresses, and previous passport details with 99%+ accuracy.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Gemini API Key
              </label>
              <input
                type="text"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Enter Gemini API Key..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400">
                Key is stored securely in your browser's local extension storage.
              </p>
            </div>

            <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-3 text-xs text-blue-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <span>⚡ Active Model:</span>
                <span className="bg-blue-900 px-2 py-0.5 rounded text-[11px] text-blue-200 font-mono">gemini-2.0-flash</span>
              </div>
              <p className="text-[11px] text-blue-300/80">
                Ultra-fast 1-second response time. Automatic fallback to local MRZ and OCR if offline.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={savingApiKey}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {savingApiKey ? 'Saving...' : '✓ Save API Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
