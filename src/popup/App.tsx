import { useCallback, useEffect, useState } from 'react'
import type { ApplicantProfile } from '../core/applicant'
import { getDocuments } from '../core/document'
import {
  deleteApplicant,
  getApplicants,
  getSelectedApplicantId,
  saveApplicant,
  setSelectedApplicantId,
} from '../core/storage'
import { ApplicantFormPage, ApplicantsPage, Dashboard, DocumentsPage, SettingsPage } from './pages'

export type PopupPage = 'dashboard' | 'applicants' | 'applicant-form' | 'documents' | 'settings'

export default function App() {
  const [activePage, setActivePage] = useState<PopupPage>('dashboard')
  const [applicants, setApplicants] = useState<ApplicantProfile[]>([])
  const [selectedApplicantId, setSelectedApplicantIdState] = useState<string | null>(null)
  const [editingApplicant, setEditingApplicant] = useState<ApplicantProfile | null>(null)
  const [documentCount, setDocumentCount] = useState<number>(0)

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  const loadData = useCallback(async () => {
    try {
      const [list, selectedId, docs] = await Promise.all([
        getApplicants(),
        getSelectedApplicantId(),
        getDocuments(),
      ])
      setApplicants(list)
      setSelectedApplicantIdState(selectedId)
      setDocumentCount(docs.length)
    } catch (err) {
      console.error('Failed to load storage data:', err)
      setErrorMessage('Unable to load saved applicants. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    Promise.all([getApplicants(), getSelectedApplicantId(), getDocuments()])
      .then(([list, selectedId, docs]) => {
        if (isMounted) {
          setApplicants(list)
          setSelectedApplicantIdState(selectedId)
          setDocumentCount(docs.length)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load storage data on mount:', err)
        if (isMounted) {
          setErrorMessage('Unable to load saved applicants. Please try again.')
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleSaveApplicant = async (applicant: ApplicantProfile) => {
    setErrorMessage(null)
    try {
      await saveApplicant(applicant)
      await loadData()
      showToast(
        editingApplicant
          ? 'Applicant profile updated successfully!'
          : 'New applicant profile saved successfully!'
      )
      setEditingApplicant(null)
    } catch (err) {
      console.error('Failed to save applicant:', err)
      setErrorMessage('Unable to save applicant. Please try again.')
    }
  }

  const handleDuplicateApplicant = async (applicant: ApplicantProfile) => {
    setErrorMessage(null)
    try {
      const now = new Date().toISOString()
      const duplicated: ApplicantProfile = {
        ...JSON.parse(JSON.stringify(applicant)),
        applicantId: `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      }
      await saveApplicant(duplicated)
      await loadData()
      showToast('Applicant profile duplicated successfully!')
    } catch (err) {
      console.error('Failed to duplicate applicant:', err)
      setErrorMessage('Unable to duplicate applicant. Please try again.')
    }
  }

  const handleDeleteApplicant = async (id: string) => {
    setErrorMessage(null)
    try {
      await deleteApplicant(id)
      await loadData()
      showToast('Applicant profile deleted.')
    } catch (err) {
      console.error('Failed to delete applicant:', err)
      setErrorMessage('Unable to delete applicant. Please try again.')
    }
  }

  const handleSelectApplicant = async (id: string) => {
    setErrorMessage(null)
    try {
      await setSelectedApplicantId(id)
      setSelectedApplicantIdState(id)
      showToast('Applicant selected for active application.')
    } catch (err) {
      console.error('Failed to select applicant:', err)
      setErrorMessage('Unable to select applicant. Please try again.')
    }
  }

  const handleStartCreate = () => {
    setEditingApplicant(null)
    setActivePage('applicant-form')
  }

  const handleStartEdit = (applicant: ApplicantProfile) => {
    setEditingApplicant(applicant)
    setActivePage('applicant-form')
  }

  const selectedApplicant =
    applicants.find((a) => a.applicantId === selectedApplicantId) || null

  return (
    <div
      className="w-80 p-5 font-sans min-h-[460px] transition-colors duration-300 relative"
      style={{
        background:
          'linear-gradient(135deg, var(--color-bg-start), var(--color-bg-middle), var(--color-bg-end))',
        color: 'var(--color-text)',
      }}
    >
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-2 left-5 right-5 z-50 p-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold text-center shadow-lg animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMessage && (
        <div className="mb-3 p-2 rounded-lg bg-red-600 text-white text-xs font-semibold text-center shadow-lg">
          {errorMessage}
        </div>
      )}

      {/* Loading Indicator State */}
      {isLoading ? (
        <div
          className="rounded-xl p-8 shadow-lg text-center space-y-3"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
        >
          <div className="animate-spin text-2xl inline-block">⏳</div>
          <div className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
            Loading extension...
          </div>
        </div>
      ) : (
        <>
          {/* Dashboard View */}
          {activePage === 'dashboard' && (
            <Dashboard
              selectedApplicant={selectedApplicant}
              applicantCount={applicants.length}
              onNavigate={setActivePage}
              onAddApplicant={handleStartCreate}
            />
          )}

          {/* Applicants List View */}
          {activePage === 'applicants' && (
            <ApplicantsPage
              applicants={applicants}
              selectedApplicantId={selectedApplicantId}
              onBack={() => setActivePage('dashboard')}
              onAddApplicant={handleStartCreate}
              onEditApplicant={handleStartEdit}
              onSelectApplicant={handleSelectApplicant}
              onDuplicateApplicant={handleDuplicateApplicant}
              onDeleteApplicant={handleDeleteApplicant}
            />
          )}

          {/* Applicant Form View (Create / Edit) */}
          {activePage === 'applicant-form' && (
            <ApplicantFormPage
              initialApplicant={editingApplicant}
              onSave={async (applicant) => {
                await handleSaveApplicant(applicant)
                setActivePage('applicants')
              }}
              onCancel={() => {
                setEditingApplicant(null)
                setActivePage(applicants.length > 0 ? 'applicants' : 'dashboard')
              }}
            />
          )}

          {/* Documents View */}
          {activePage === 'documents' && (
            <DocumentsPage
              applicants={applicants}
              selectedApplicantId={selectedApplicantId}
              onBack={() => setActivePage('dashboard')}
              onAddApplicant={handleStartCreate}
              onUpdateApplicant={handleSaveApplicant}
            />
          )}

          {/* Settings & Privacy Center View */}
          {activePage === 'settings' && (
            <SettingsPage
              onBack={() => setActivePage('dashboard')}
              applicantCount={applicants.length}
              documentCount={documentCount}
              onDataWiped={async () => {
                await loadData()
                setActivePage('dashboard')
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
