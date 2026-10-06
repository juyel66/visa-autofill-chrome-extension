import React, { useEffect, useState, useMemo, useCallback } from 'react'
import type { ApplicantProfile } from '../core/applicant/types'
import type { DocumentRecord } from '../core/document/types'
import { getLatestDocument } from '../core/document'
import { applyExtractionToApplicant } from '../core/extraction'
import { saveApplicant } from '../core/storage'
import type {
  SavedApplication,
  ApplicationFieldValue,
  ApplicationFieldSource,
} from '../core/application/types'
import {
  getSavedApplicationByApplicantId,
  saveApplication,
} from '../core/application/applicationStorage'
import {
  populateApplicationFromDocuments,
} from '../core/application/applicationMerger'
import {
  createApplication,
  updateApplication,
  getApplicationById,
  downloadApplicationPdf,
  deleteApplicantPhoto,
} from '../core/application/applicationApi'
import { getDraft, deleteDraft, getLatestDraft } from '../core/storage/draftDb'
import { LOCAL_EXTRACTOR_URL } from '../core/extraction/local/pythonExtractorClient'
import {
  calculateWorkspaceProgress,
  isFieldFilled,
} from '../core/application/workspaceProgress'
import { WorkspaceProgressBar } from './components/WorkspaceProgressBar'
import { RegistrationSection } from './components/RegistrationSection'
import { BasicDetailsSection } from './components/BasicDetailsSection'
import { FamilyDetailsSection } from './components/FamilyDetailsSection'
import { VisaDetailsSection } from './components/VisaDetailsSection'
import { AdditionalQuestionsSection } from './components/AdditionalQuestionsSection'
import { ApplicantPhotoEditor } from './components/ApplicantPhotoEditor'

export const App: React.FC = () => {
  const [applicantId, setApplicantId] = useState<string>('')
  const [applicants, setApplicants] = useState<ApplicantProfile[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [application, setApplication] = useState<SavedApplication | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showAllFields, setShowAllFields] = useState<boolean>(false)
  const [showAiModal, setShowAiModal] = useState<boolean>(false)
  const [testingConnection, setTestingConnection] = useState<boolean>(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isPythonHealthy, setIsPythonHealthy] = useState<boolean | null>(null)
  const [backendApplicationId, setBackendApplicationId] = useState<string | null>(null)
  const [originalPdf, setOriginalPdf] = useState<Blob | File | null>(null)
  const [originalPdfFileName, setOriginalPdfFileName] = useState<string>('passport.pdf')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false)

  // Document Extraction Error & Status
  const [extractionError, setExtractionError] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('extractionError') || urlParams.get('error') || null
    }
    return null
  })

  const loadApplicationForApplicant = useCallback(
    async (targetId: string, appList: ApplicantProfile[], allDocs: DocumentRecord[]) => {
      const existing = await getSavedApplicationByApplicantId(targetId)
      const profileDocs = allDocs.filter((d) => d.applicantId === targetId)
      let passportDoc = getLatestDocument(profileDocs, 'passport') || profileDocs.find((d) => d.extractedDataConfirmed && d.extractedData)
      const ogdDoc = getLatestDocument(profileDocs, 'ogd')
      const activeProf = appList.find((a) => a.applicantId === targetId)

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

  const handleTestConnection = async () => {
    setTestingConnection(true)
    setTestResult(null)
    try {
      const controller = new AbortController()
      const tId = setTimeout(() => controller.abort(), 3000)
      const res = await fetch(`${LOCAL_EXTRACTOR_URL}/health`, { signal: controller.signal })
      clearTimeout(tId)
      if (res.ok) {
        const rawText = await res.text().catch(() => '')
        let data: any = null
        try {
          data = rawText ? JSON.parse(rawText) : null
        } catch {}
        if (data?.status === 'ok') {
          setIsPythonHealthy(true)
          setTestResult({
            success: true,
            message: `✓ Connected to Python Local OCR Extractor at ${LOCAL_EXTRACTOR_URL}! Ready for passport extraction.`,
          })
          return
        }
      }
      setIsPythonHealthy(false)
      setTestResult({
        success: false,
        message: `Extractor responded with status ${res.status}. Expected 'ok'.`,
      })
    } catch (err: unknown) {
      setIsPythonHealthy(false)
      const msg = err instanceof Error ? err.message : String(err)
      setTestResult({
        success: false,
        message: `Connection failed: ${msg}. Start Python extractor with 'npm run dev' or 'python -m uvicorn app.main:app --port 8001'.`,
      })
    } finally {
      setTestingConnection(false)
    }
  }

  // 1. Initial Load: Parse URL params & fetch storage
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        // Check Python extractor health
        fetch(`${LOCAL_EXTRACTOR_URL}/health`)
          .then(async (r) => {
            if (!r.ok) return null
            const text = await r.text().catch(() => '')
            try {
              return text ? JSON.parse(text) : null
            } catch {
              return null
            }
          })
          .then((d) => setIsPythonHealthy(d?.status === 'ok'))
          .catch(() => setIsPythonHealthy(false))

        const urlParams = new URLSearchParams(window.location.search)
        const urlApplicationId = urlParams.get('applicationId') || urlParams.get('id')
        const urlDraftId = urlParams.get('draftId')
        const urlApplicantId = urlParams.get('applicantId')

        // Case A: Load existing saved application from Node backend
        if (urlApplicationId) {
          try {
            const detail = await getApplicationById(urlApplicationId)
            if (detail && detail.applicationData) {
              setApplication(detail.applicationData)
              setBackendApplicationId(detail.id)
              setApplicantId(detail.applicationData.applicantId || detail.applicantName || detail.id)
              if (detail.originalPdfFileName) {
                setOriginalPdfFileName(detail.originalPdfFileName)
              }
              setLoading(false)
              return
            }
          } catch (backendErr: any) {
            console.error('Failed to load application from backend:', backendErr)
            showToast(backendErr.message || 'Failed to load application from server.', 'error')
          }
        }

        // Case B: Load unpersisted draft with original PDF from IndexedDB
        if (urlDraftId) {
          try {
            const draft = await getDraft(urlDraftId)
            if (draft && draft.savedApplication) {
              setDraftId(draft.draftId)
              setApplication(draft.savedApplication)
              setBackendApplicationId(draft.savedApplication.backendApplicationId || null)
              if (draft.pdfBlob) {
                setOriginalPdf(draft.pdfBlob)
                setOriginalPdfFileName(draft.pdfFileName || 'passport.pdf')
              }
              setApplicantId(draft.savedApplication.applicantId || 'APPLICANT_001')
              setLoading(false)
              return
            }
          } catch (draftErr) {
            console.warn('Failed to load draft from IndexedDB:', draftErr)
          }
        }

        // Case C: Check for any recent in-memory/IndexedDB draft
        try {
          const recentDraft = await getLatestDraft()
          if (recentDraft && recentDraft.savedApplication && Date.now() - recentDraft.createdAt < 30 * 60 * 1000) {
            setDraftId(recentDraft.draftId)
            setApplication(recentDraft.savedApplication)
            setBackendApplicationId(recentDraft.savedApplication.backendApplicationId || null)
            if (recentDraft.pdfBlob) {
              setOriginalPdf(recentDraft.pdfBlob)
              setOriginalPdfFileName(recentDraft.pdfFileName || 'passport.pdf')
            }
            setApplicantId(recentDraft.savedApplication.applicantId || 'APPLICANT_001')
            setLoading(false)
            return
          }
        } catch {
          // ignore
        }

        // Case D: Fallback to local storage (legacy compatibility)
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
      } else if (key === 'village_town_city') {
        updatedFields['pres_addr2'] = { ...updatedField }
        updatedManualEdits['pres_addr2'] = true
        updatedFields['permanent_village_town_city'] = { ...updatedField }
        updatedFields['perm_add2'] = { ...updatedField }
        updatedManualEdits['permanent_village_town_city'] = true
        updatedManualEdits['perm_add2'] = true
      } else if (key === 'pres_addr2') {
        updatedFields['village_town_city'] = { ...updatedField }
        updatedManualEdits['village_town_city'] = true
        updatedFields['permanent_village_town_city'] = { ...updatedField }
        updatedFields['perm_add2'] = { ...updatedField }
        updatedManualEdits['permanent_village_town_city'] = true
        updatedManualEdits['perm_add2'] = true
      } else if (key === 'district') {
        updatedFields['state_province'] = { ...updatedField }
        updatedFields['state_name'] = { ...updatedField }
        updatedManualEdits['state_province'] = true
        updatedManualEdits['state_name'] = true
      } else if (key === 'state_province' || key === 'state_name') {
        updatedFields['district'] = { ...updatedField }
        updatedManualEdits['district'] = true
      } else if (key === 'permanent_village_town_city') {
        updatedFields['perm_add2'] = { ...updatedField }
        updatedManualEdits['perm_add2'] = true
      } else if (key === 'perm_add2') {
        updatedFields['permanent_village_town_city'] = { ...updatedField }
        updatedManualEdits['permanent_village_town_city'] = true
      } else if (key === 'permanent_district') {
        updatedFields['permanent_state_province'] = { ...updatedField }
        updatedFields['perm_add3'] = { ...updatedField }
        updatedManualEdits['permanent_state_province'] = true
        updatedManualEdits['perm_add3'] = true
      } else if (key === 'permanent_state_province' || key === 'perm_add3') {
        updatedFields['permanent_district'] = { ...updatedField }
        updatedManualEdits['permanent_district'] = true
      } else if (key === 'entrypoint') {
        updatedFields['appl.entrypoint'] = { ...updatedField }
        updatedManualEdits['appl.entrypoint'] = true
        if (!prevApp.fields['exitpoint']?.value) {
          updatedFields['exitpoint'] = { ...updatedField }
          updatedFields['appl.exitpoint'] = { ...updatedField }
          updatedManualEdits['exitpoint'] = true
          updatedManualEdits['appl.exitpoint'] = true
        }
      } else if (key === 'appl.entrypoint') {
        updatedFields['entrypoint'] = { ...updatedField }
        updatedManualEdits['entrypoint'] = true
      } else if (key === 'exitpoint') {
        updatedFields['appl.exitpoint'] = { ...updatedField }
        updatedManualEdits['appl.exitpoint'] = true
      } else if (key === 'appl.exitpoint') {
        updatedFields['exitpoint'] = { ...updatedField }
        updatedManualEdits['exitpoint'] = true
      } else if (key === 'refuse_flag') {
        updatedFields['appl.refuse_flag'] = { ...updatedField }
        updatedManualEdits['appl.refuse_flag'] = true
      } else if (key === 'appl.refuse_flag') {
        updatedFields['refuse_flag'] = { ...updatedField }
        updatedManualEdits['refuse_flag'] = true
      } else if (key === 'comp_name') {
        updatedFields['appl.comp_name'] = { ...updatedField }
        updatedManualEdits['appl.comp_name'] = true
      } else if (key === 'appl.comp_name') {
        updatedFields['comp_name'] = { ...updatedField }
        updatedManualEdits['comp_name'] = true
      } else if (key === 'comp_address') {
        updatedFields['appl.comp_address'] = { ...updatedField }
        updatedManualEdits['appl.comp_address'] = true
      } else if (key === 'appl.comp_address') {
        updatedFields['comp_address'] = { ...updatedField }
        updatedManualEdits['comp_address'] = true
      } else if (key === 'comp_phone') {
        updatedFields['appl.comp_phone'] = { ...updatedField }
        updatedManualEdits['appl.comp_phone'] = true
      } else if (key === 'appl.comp_phone') {
        updatedFields['comp_phone'] = { ...updatedField }
        updatedManualEdits['comp_phone'] = true
      } else if (key === 'comp_email') {
        updatedFields['appl.comp_email'] = { ...updatedField }
        updatedManualEdits['appl.comp_email'] = true
      } else if (key === 'appl.comp_email') {
        updatedFields['comp_email'] = { ...updatedField }
        updatedManualEdits['comp_email'] = true
      } else if (key === 'religion') {
        updatedFields['appl.religion'] = { ...updatedField }
        updatedManualEdits['appl.religion'] = true
      } else if (key === 'appl.religion') {
        updatedFields['religion'] = { ...updatedField }
        updatedManualEdits['religion'] = true
      } else if (key === 'visa_type') {
        updatedFields['appl.visatype'] = { ...updatedField }
        updatedFields['appl.visa_type'] = { ...updatedField }
        updatedManualEdits['appl.visatype'] = true
        updatedManualEdits['appl.visa_type'] = true
      } else if (key === 'appl.email') {
        updatedFields['appl.email_re'] = { ...updatedField }
        updatedFields['email'] = { ...updatedField }
        updatedManualEdits['appl.email_re'] = true
        updatedManualEdits['email'] = true
      } else if (key === 'appl.email_re') {
        updatedFields['appl.email'] = { ...updatedField }
        updatedFields['email'] = { ...updatedField }
        updatedManualEdits['appl.email'] = true
        updatedManualEdits['email'] = true
      }

      const nextApp: SavedApplication = {
        ...prevApp,
        fields: updatedFields,
        manualEdits: updatedManualEdits,
        status: 'ready_for_autofill',
      }
      saveApplication(nextApp).catch((err) => console.warn('Workspace auto-save error:', err))

      // Keep active ApplicantProfile synchronized with business company fields & email
      const activeProf = applicants.find((a) => a.applicantId === applicantId) || applicants[0]
      if (activeProf) {
        if (!activeProf.travel) activeProf.travel = {}
        const nameVal = String(updatedFields['comp_name']?.value || updatedFields['appl.comp_name']?.value || '')
        const addrVal = String(updatedFields['comp_address']?.value || updatedFields['appl.comp_address']?.value || '')
        const phoneVal = String(updatedFields['comp_phone']?.value || updatedFields['appl.comp_phone']?.value || '')
        const compEmailVal = String(updatedFields['comp_email']?.value || updatedFields['appl.comp_email']?.value || '')
        if (nameVal) activeProf.travel.businessCompanyName = nameVal
        if (addrVal) activeProf.travel.businessCompanyAddress = addrVal
        if (phoneVal) activeProf.travel.businessCompanyPhone = phoneVal
        if (compEmailVal) activeProf.travel.businessCompanyEmail = compEmailVal

        if (key === 'appl.email' || key === 'appl.email_re' || key === 'email') {
          if (!activeProf.contact) activeProf.contact = {}
          activeProf.contact.email = String(value)
        }
        saveApplicant(activeProf).catch(() => {})
      }

      return nextApp
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
      } else if (key === 'village_town_city') {
        delete updatedManualEdits['pres_addr2']
        delete updatedManualEdits['village_town_city']
        delete updatedManualEdits['permanent_village_town_city']
        delete updatedManualEdits['perm_add2']
        updatedFields['pres_addr2'] = { ...restoredField }
        updatedFields['village_town_city'] = { ...restoredField }
        updatedFields['permanent_village_town_city'] = { ...restoredField }
        updatedFields['perm_add2'] = { ...restoredField }
      } else if (key === 'pres_addr2') {
        delete updatedManualEdits['village_town_city']
        delete updatedManualEdits['pres_addr2']
        delete updatedManualEdits['permanent_village_town_city']
        delete updatedManualEdits['perm_add2']
        updatedFields['village_town_city'] = { ...restoredField }
        updatedFields['pres_addr2'] = { ...restoredField }
        updatedFields['permanent_village_town_city'] = { ...restoredField }
        updatedFields['perm_add2'] = { ...restoredField }
      } else if (key === 'district') {
        delete updatedManualEdits['state_province']
        delete updatedManualEdits['state_name']
        updatedFields['state_province'] = { ...restoredField }
        updatedFields['state_name'] = { ...restoredField }
      } else if (key === 'state_province' || key === 'state_name') {
        delete updatedManualEdits['district']
        updatedFields['district'] = { ...restoredField }
      } else if (key === 'permanent_village_town_city') {
        delete updatedManualEdits['perm_add2']
        updatedFields['perm_add2'] = { ...restoredField }
      } else if (key === 'perm_add2') {
        delete updatedManualEdits['permanent_village_town_city']
        updatedFields['permanent_village_town_city'] = { ...restoredField }
      } else if (key === 'permanent_district') {
        delete updatedManualEdits['permanent_state_province']
        delete updatedManualEdits['perm_add3']
        updatedFields['permanent_state_province'] = { ...restoredField }
        updatedFields['perm_add3'] = { ...restoredField }
      } else if (key === 'permanent_state_province' || key === 'perm_add3') {
        delete updatedManualEdits['permanent_district']
        updatedFields['permanent_district'] = { ...restoredField }
      } else if (key === 'appl.email') {
        delete updatedManualEdits['appl.email_re']
        delete updatedManualEdits['email']
        updatedFields['appl.email_re'] = { ...restoredField }
        updatedFields['email'] = { ...restoredField }
      } else if (key === 'appl.email_re') {
        delete updatedManualEdits['appl.email']
        delete updatedManualEdits['email']
        updatedFields['appl.email'] = { ...restoredField }
        updatedFields['email'] = { ...restoredField }
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
    if (presCity || pres2) {
      const cityVal = presCity || pres2
      updatedFields['perm_add2'] = { value: cityVal, source: 'manual', isUserEdited: true }
      updatedEdits['perm_add2'] = true
      updatedFields['permanent_village_town_city'] = { value: cityVal, source: 'manual', isUserEdited: true }
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
        backendApplicationId: backendApplicationId || application.backendApplicationId,
        provenance: {
          ...application.provenance,
          lastSavedAt: new Date().toISOString(),
        },
      }

      let targetBackendId = backendApplicationId || application.backendApplicationId

      if (targetBackendId) {
        // Update existing application on Node backend (PUT /api/applications/:id)
        await updateApplication(targetBackendId, toSave, originalPdf, originalPdfFileName)
        toSave.backendApplicationId = targetBackendId

        setApplication(toSave)
        showToast('✓ Application saved successfully to server!', 'success')
      } else {
        // Create new application on Node backend (POST /api/applications) with complete SavedApplication + original PDF
        const res = await createApplication(toSave, originalPdf, originalPdfFileName)
        targetBackendId = res.id
        setBackendApplicationId(targetBackendId)
        toSave.backendApplicationId = targetBackendId

        setApplication(toSave)

        // Clean up draft in IndexedDB
        if (draftId) {
          await deleteDraft(draftId).catch(() => {})
        }

        showToast('✓ Application saved successfully to server!', 'success')
      }

      // Also persist to local storage cache for immediate autofill availability
      try {
        await saveApplication(toSave)
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({
            visa_autofill_selected_application_id: targetBackendId,
            visa_autofill_saved_applications: [toSave],
          })
        }
      } catch (cacheErr) {
        console.warn('Local cache sync warning:', cacheErr)
      }
    } catch (err: any) {
      console.error('Save failed:', err)
      showToast(err.message || 'Failed to save application to server.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (originalPdf) {
      const url = URL.createObjectURL(originalPdf)
      const a = document.createElement('a')
      a.href = url
      a.download = originalPdfFileName || 'passport.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('✓ Original PDF downloaded.', 'success')
      return
    }

    const targetId = backendApplicationId || application?.backendApplicationId
    if (targetId) {
      setIsDownloadingPdf(true)
      try {
        const { blob, fileName } = await downloadApplicationPdf(targetId)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        showToast('✓ Original PDF downloaded.', 'success')
      } catch (err: any) {
        showToast(err.message || 'Failed to download original PDF.', 'error')
      } finally {
        setIsDownloadingPdf(false)
      }
    } else {
      showToast('No original PDF file available.', 'info')
    }
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
    const updatedApp: SavedApplication = {
      ...application,
      photograph: undefined,
    }
    setApplication(updatedApp)
    saveApplication(updatedApp).catch(() => {})
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({
        visa_autofill_saved_applications: [updatedApp],
      })
    }
    if (backendApplicationId) {
      deleteApplicantPhoto(backendApplicationId).catch(() => {})
    }
    showToast('Removed applicant photograph.', 'info')
  }

  const handlePhotoSavedFromEditor = async (photoData: {
    dataUrl: string
    fileName: string
    fileSize: number
    width: number
    height: number
  }) => {
    if (!application) return

    const updatedApp: SavedApplication = {
      ...application,
      photograph: {
        dataUrl: photoData.dataUrl,
        fileName: photoData.fileName,
        fileSize: photoData.fileSize,
        width: photoData.width,
        height: photoData.height,
        uploadedAt: new Date().toISOString(),
      },
    }

    setApplication(updatedApp)

    try {
      await saveApplication(updatedApp)
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({
          visa_autofill_saved_applications: [updatedApp],
        })
      }
    } catch (saveErr) {
      console.warn('Local draft sync warning:', saveErr)
    }
  }

  const applicantDisplayName = useMemo(() => {
    const given =
      application?.fields?.['appl.applname']?.value ||
      application?.fields?.['appl.name']?.value ||
      ''
    const surname = application?.fields?.['appl.surname']?.value || ''
    return [given, surname].filter(Boolean).join(' ').trim() || applicantId || 'Applicant'
  }, [application, applicantId])

  // Calculate dynamic workspace completion progress across canonical schema fields
  const progress = useMemo(() => {
    return calculateWorkspaceProgress(application, showAllFields)
  }, [application, showAllFields])

  // Calculate statistics across canonical fields based on current applicable form fields
  const stats = useMemo(() => {
    let edited = 0
    if (application) {
      Object.values(application.fields).forEach((val) => {
        if (val?.isUserEdited && isFieldFilled(val)) {
          edited++
        }
      })
    }
    return {
      total: progress.total,
      visible: progress.total,
      hidden: progress.missing,
      filled: progress.filled,
      edited,
      missing: progress.missing,
      percentage: progress.percentage,
      isComplete: progress.isComplete,
    }
  }, [application, progress])

  const profileDocs = useMemo(() => {
    return documents.filter((d) => d.applicantId === applicantId)
  }, [documents, applicantId])

  const passportDoc = getLatestDocument(profileDocs, 'passport')
  const ogdDoc = getLatestDocument(profileDocs, 'ogd')

  // Smooth scroll to section card with dynamic header height offset
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(`sec-${sectionId}`)
    if (element) {
      const headerEl = document.querySelector('header')
      const headerOffset = headerEl ? headerEl.offsetHeight + 16 : 68
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

    if (f?.hasConflict) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-950/90 text-red-300 border border-red-700/80 cursor-help"
          title={f.conflictDetails || 'Invalid data relationship - requires manual review'}
        >
          <span>⚠</span> Invalid / Review
        </span>
      )
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
      {/* Top Sticky Header Bar: Ultra-Slim, Unified & Interactive */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Brand & Compact Document Badges */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm text-sm flex-shrink-0">
              🇮🇳
            </div>
            <div className="hidden lg:block min-w-0">
              <span className="text-xs sm:text-sm font-bold text-slate-100 tracking-tight block truncate">
                Visa Workspace
              </span>
            </div>

            {/* Document Badges */}
            <div className="hidden xl:flex items-center gap-1.5 text-[11px]">
              {passportDoc ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 flex items-center gap-1" title={passportDoc.fileName}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> 🛂 Passport
                </span>
              ) : null}
              {ogdDoc ? (
                <span className="px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-700/60 flex items-center gap-1" title={ogdDoc.fileName}>
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> 📄 OGD
                </span>
              ) : null}
            </div>
          </div>

          {/* Center: Interactive Slim Progress Bar Frame */}
          <div className="flex-1 flex justify-center min-w-0">
            <WorkspaceProgressBar
              percentage={progress.percentage}
              filled={progress.filled}
              total={progress.total}
              isComplete={progress.isComplete}
              loading={loading || !application}
              pageProgress={progress.pageProgress}
              editedCount={stats.edited}
              onSectionClick={scrollToSection}
              passportDoc={passportDoc ? { fileName: passportDoc.fileName, confirmed: Boolean(passportDoc.extractedDataConfirmed) } : null}
              ogdDoc={ogdDoc ? { fileName: ogdDoc.fileName, confirmed: Boolean(ogdDoc.extractedDataConfirmed) } : null}
            />
          </div>

          {/* Right: Actions & Applicant Status */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Applicant Name & Status */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700 text-xs">
              <span
                className="text-blue-400 font-semibold max-w-[120px] truncate"
                title={`${application?.fields?.['appl.applname']?.value || ''} ${application?.fields?.['appl.surname']?.value || ''}`.trim() || applicantId}
              >
                {`${application?.fields?.['appl.applname']?.value || ''} ${application?.fields?.['appl.surname']?.value || ''}`.trim() || applicantId || 'New Applicant'}
              </span>
              {backendApplicationId ? (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-700/60">
                  Saved
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-950 text-amber-400 border border-amber-700/60">
                  Draft
                </span>
              )}
            </div>

            {/* Python Local OCR Status Button */}
            <button
              onClick={() => {
                setShowAiModal(true)
                handleTestConnection()
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/50 flex items-center gap-1 transition-all cursor-pointer shadow-xs"
              title="Local Python OCR Extractor (Port 8001)"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isPythonHealthy ? 'bg-emerald-400' : isPythonHealthy === false ? 'bg-rose-400' : 'bg-amber-400'}`} />
              <span className="hidden sm:inline">Python</span> OCR
            </button>

            {/* View Mode Toggle */}
            <button
              onClick={() => setShowAllFields((prev) => !prev)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-all cursor-pointer shadow-xs ${
                showAllFields
                  ? 'bg-indigo-950/90 border-indigo-500 text-indigo-200'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title={showAllFields ? 'Switch back to curated view' : 'Display all 100 fields'}
            >
              <span>{showAllFields ? '100 Fields' : 'Curated'}</span>
            </button>

            {/* Download Original PDF Button */}
            {(backendApplicationId || originalPdf) && (
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-semibold px-2 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                title="Download original uploaded PDF"
              >
                <span>📥</span>
                <span className="hidden sm:inline">{isDownloadingPdf ? '...' : 'PDF'}</span>
              </button>
            )}

            {/* Primary Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-3 py-1 rounded-lg shadow-sm hover:shadow-blue-500/20 transition-all flex items-center gap-1 text-xs cursor-pointer"
            >
              {saving ? 'Saving...' : '💾 Save'}
            </button>
          </div>
        </div>
      </header>

      {/* Document Extraction Alert Banner */}
      {extractionError && (
        <div className="bg-rose-950/95 border-b border-rose-600 text-rose-100 px-4 sm:px-6 py-3.5 shadow-lg relative z-20">
          <div className="max-w-7xl mx-auto flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-900 border border-rose-500/80 flex items-center justify-center text-base flex-shrink-0 mt-0.5">
                ⚠️
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-rose-200">
                    Document Extraction Notice / নোটিশ
                  </span>
                  <span className="bg-rose-900 border border-rose-500 text-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Manual Mode Active / ম্যানুয়ালি এন্ট্রি করুন
                  </span>
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed font-mono bg-rose-900/40 px-2.5 py-1.5 rounded border border-rose-800/80">
                  {extractionError}
                </p>
                <p className="text-xs text-rose-300 font-medium">
                  Workspace has been opened for manual entry. Please review and fill in your application fields below manually, then click <strong>💾 Save Application</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  setShowAiModal(true)
                  handleTestConnection()
                }}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                ⚡ Extractor Status
              </button>
              <button
                onClick={() => setExtractionError(null)}
                className="text-rose-300 hover:text-white text-xs bg-rose-900/60 hover:bg-rose-800 border border-rose-700/60 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Main Single Full-Page Layout: Left = Applicant Photo, Right = Form Fields */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Area: Dedicated Applicant Photo Management */}
        <aside className="w-full lg:w-80 xl:w-88 flex-shrink-0">
          <div className="sticky top-[72px]">
            <ApplicantPhotoEditor
              applicationId={backendApplicationId}
              backendApplicationId={backendApplicationId}
              applicantId={applicantId}
              applicantName={applicantDisplayName}
              application={application}
              onPhotoSaved={handlePhotoSavedFromEditor}
              onPhotoRemoved={handleRemovePhoto}
              onToast={showToast}
            />
          </div>
        </aside>

        {/* Right Area: Sequential Authentic Portal Pages & Fields */}
        <main className="flex-1 min-w-0 space-y-8 w-full">
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

      {/* Python Local OCR Status Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚡</span>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Local Python OCR Extractor</h3>
                  <p className="text-xs text-emerald-400 font-medium">FastAPI + PaddleOCR + PyMuPDF (Port 8001)</p>
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
              Extraction is powered 100% locally by Python. No cloud AI quotas, no external network calls, and no API keys required. Digital PDFs extract in under 20ms, and scanned documents use local PaddleOCR PP-OCRv4.
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Extractor Endpoint:</span>
                <span className="font-mono text-emerald-300 font-semibold">{LOCAL_EXTRACTOR_URL}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status:</span>
                <span className={`font-semibold ${isPythonHealthy ? 'text-emerald-400' : isPythonHealthy === false ? 'text-rose-400' : 'text-amber-400'}`}>
                  {isPythonHealthy ? '● ONLINE (Ready)' : isPythonHealthy === false ? '● OFFLINE' : 'Checking...'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Privacy & Limits:</span>
                <span className="text-slate-200">100% Offline, Unlimited Extractions</span>
              </div>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-700/60 text-rose-300'
                }`}
              >
                <span>{testResult.message}</span>
                {testResult.success && <span className="font-bold text-emerald-400">ONLINE</span>}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {testingConnection ? 'Testing...' : '⚡ Test Connection'}
              </button>

              <button
                onClick={() => setShowAiModal(false)}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
