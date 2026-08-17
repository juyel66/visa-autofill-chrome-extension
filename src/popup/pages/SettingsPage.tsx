import React, { useEffect, useState } from 'react'
import { Button } from '../../components/ui'
import type { AppSettings, FillPolicy } from '../../core/settings'
import {
  clearAllLocalExtensionData,
  getSettings,
  resetSettings,
  saveSettings,
} from '../../core/settings'

export interface SettingsPageProps {
  onBack: () => void
  applicantCount: number
  documentCount: number
  onDataWiped: () => Promise<void>
}

type SettingsTab = 'autofill' | 'privacy' | 'permissions' | 'data'

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onBack,
  applicantCount,
  documentCount,
  onDataWiped,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('autofill')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Confirmation Overlays
  const [confirmModal, setConfirmModal] = useState<
    'reset-settings' | 'delete-applicants' | 'delete-documents' | 'clear-all' | null
  >(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  useEffect(() => {
    let isMounted = true
    getSettings()
      .then((s) => {
        if (isMounted) {
          setSettings(s)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load settings:', err)
        if (isMounted) {
          setErrorMessage('Unable to load settings.')
          setIsLoading(false)
        }
      })
    return () => {
      isMounted = false
    }
  }, [])

  const handleUpdateAutofillPolicy = async (policy: FillPolicy) => {
    if (!settings) return
    const updated: AppSettings = {
      ...settings,
      autofill: { ...settings.autofill, defaultFillPolicy: policy },
    }
    setSettings(updated)
    await persistSettings(updated)
  }

  const handleToggleConfirmation = async (checked: boolean) => {
    if (!settings) return
    const updated: AppSettings = {
      ...settings,
      autofill: { ...settings.autofill, requirePageConfirmation: checked },
    }
    setSettings(updated)
    await persistSettings(updated)
  }

  const persistSettings = async (newSettings: AppSettings) => {
    setIsSaving(true)
    setErrorMessage(null)
    try {
      await saveSettings(newSettings)
      showToast('Settings saved.')
    } catch (err) {
      console.error('Failed to save settings:', err)
      setErrorMessage('Failed to save settings.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetPreferences = async () => {
    setIsSaving(true)
    setErrorMessage(null)
    try {
      const restored = await resetSettings()
      setSettings(restored)
      setConfirmModal(null)
      showToast('Settings reset to defaults. Applicants and documents preserved.')
    } catch (err) {
      console.error('Failed to reset settings:', err)
      setErrorMessage('Failed to reset settings.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmAction = async () => {
    if (!confirmModal) return
    setIsSaving(true)
    setErrorMessage(null)

    try {
      if (confirmModal === 'reset-settings') {
        await handleResetPreferences()
      } else if (confirmModal === 'clear-all') {
        await clearAllLocalExtensionData()
        await onDataWiped()
        setConfirmModal(null)
        showToast('All local data wiped cleanly.')
      }
    } catch (err) {
      console.error('Action failed:', err)
      setErrorMessage('Operation failed.')
    } finally {
      setIsSaving(false)
    }
  }

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

      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold hover:underline cursor-pointer"
          style={{ color: 'var(--color-accent)' }}
        >
          ← Back
        </button>
        <h2 className="text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>
          Settings & Privacy Center
        </h2>
        <span className="text-[10px] text-slate-400 font-mono">v1.0.0</span>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-2 rounded bg-red-100 border border-red-300 text-red-700 text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      {/* Modal Confirmation Overlays */}
      {confirmModal && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-left space-y-2 z-50">
          <div className="text-xs font-bold text-red-800">
            {confirmModal === 'reset-settings'
              ? 'Reset all settings to defaults?'
              : 'Clear all local extension data?'}
          </div>
          <div className="text-[11px] text-red-600">
            {confirmModal === 'reset-settings'
              ? 'Your preferences will be restored to default values. Saved applicants and documents will not be affected.'
              : 'This action will permanently delete all local applicants, stored documents, and settings. This cannot be undone.'}
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmModal(null)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <button
              type="button"
              onClick={handleConfirmAction}
              disabled={isSaving}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Processing...' : 'Confirm Action'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-none text-[11px] border-b" style={{ borderColor: 'var(--color-border)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('autofill')}
          className={`px-2 py-1 rounded font-medium whitespace-nowrap cursor-pointer transition ${
            activeTab === 'autofill' ? 'bg-blue-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Autofill
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('privacy')}
          className={`px-2 py-1 rounded font-medium whitespace-nowrap cursor-pointer transition ${
            activeTab === 'privacy' ? 'bg-blue-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Privacy Center
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('permissions')}
          className={`px-2 py-1 rounded font-medium whitespace-nowrap cursor-pointer transition ${
            activeTab === 'permissions' ? 'bg-blue-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Permissions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('data')}
          className={`px-2 py-1 rounded font-medium whitespace-nowrap cursor-pointer transition ${
            activeTab === 'data' ? 'bg-blue-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Local Data
        </button>
      </div>

      {/* Tab Content Container */}
      <div className="flex-1 overflow-y-auto max-h-[300px] text-xs space-y-3 pr-1">
        {isLoading || !settings ? (
          <div className="text-xs text-slate-500 py-6 text-center">Loading settings...</div>
        ) : (
          <>
            {/* Tab A: Autofill Preferences */}
            {activeTab === 'autofill' && (
              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase text-slate-500">Autofill Safety Preferences</h3>

                <div className="p-3 rounded-lg border bg-slate-50 space-y-2">
                  <span className="font-bold text-xs block text-slate-800">Default Fill Policy</span>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="fillPolicy"
                        checked={settings.autofill.defaultFillPolicy === 'fill-empty'}
                        onChange={() => handleUpdateAutofillPolicy('fill-empty')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-semibold text-xs text-slate-800">Fill empty fields only (Recommended)</span>
                        <p className="text-[10px] text-slate-500">Does not overwrite values already typed into website fields.</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="fillPolicy"
                        checked={settings.autofill.defaultFillPolicy === 'overwrite'}
                        onChange={() => handleUpdateAutofillPolicy('overwrite')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-semibold text-xs text-slate-800">Overwrite existing values</span>
                        <p className="text-[10px] text-amber-700">⚠️ Existing values on website forms will be replaced during fill.</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="p-3 rounded-lg border bg-slate-50 space-y-2">
                  <span className="font-bold text-xs block text-slate-800">Page Navigation Guard</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autofill.requirePageConfirmation}
                      onChange={(e) => handleToggleConfirmation(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-xs text-slate-800">
                      Require manual user click before filling new pages
                    </span>
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Extension waits for your explicit click on [ Autofill Page ] before executing.
                  </p>
                </div>
              </div>
            )}

            {/* Tab B: Privacy & Security Center */}
            {activeTab === 'privacy' && (
              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase text-slate-500">Privacy & Security Status</h3>

                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 space-y-1.5">
                  <div className="font-bold text-xs flex items-center gap-1">
                    <span>🛡️</span>
                    <span>100% In-Browser Local Processing</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Your applicant profile and document scans are processed entirely on your computer inside Chrome storage.
                  </p>
                </div>

                <div className="p-3 rounded-lg border bg-slate-50 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between border-b pb-1">
                    <span className="text-slate-600 font-medium">External Applicant Data Sharing</span>
                    <span className="font-bold text-emerald-700">None (0 Network Calls)</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-1">
                    <span className="text-slate-600 font-medium">Analytics & Tracking</span>
                    <span className="font-bold text-emerald-700">Disabled</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-1">
                    <span className="text-slate-600 font-medium">Document Storage</span>
                    <span className="font-bold text-slate-800">Local Storage (`chrome.storage.local`)</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border bg-amber-50 border-amber-200 text-amber-900 space-y-1 text-[11px]">
                  <div className="font-bold flex items-center gap-1">
                    <span>🔒</span>
                    <span>Manual Security Boundaries</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                    <li>CAPTCHA solving: Manual user entry required.</li>
                    <li>Portal Login & Passwords: Manual user entry required.</li>
                    <li>OTP & 2FA: Manual user entry required.</li>
                    <li>Payment processing: Manual user action required.</li>
                    <li>Final Submit button: Manual user click required.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Tab C: Permissions Audit */}
            {activeTab === 'permissions' && (
              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase text-slate-500">Chrome Manifest V3 Permissions</h3>

                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg border bg-slate-50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs font-mono text-slate-800">storage</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">Required</span>
                    </div>
                    <p className="text-[10px] text-slate-600">
                      Stores applicant profiles, document metadata, and preferences locally in browser memory.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg border bg-slate-50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs font-mono text-slate-800">activeTab</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">Required</span>
                    </div>
                    <p className="text-[10px] text-slate-600">
                      Allows context interaction with active visa application web pages when triggered.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg border bg-slate-50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs font-mono text-slate-800">scripting</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">Required</span>
                    </div>
                    <p className="text-[10px] text-slate-600">
                      Executes DOM field matching and safe autofill insertion scripts on targeted visa forms.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg border bg-slate-50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs font-mono text-slate-800">Host: indianvisaonline.gov.in</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">Host Permission</span>
                    </div>
                    <p className="text-[10px] text-slate-600">
                      Restricts extension content scripts strictly to official Indian Visa portal pages.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab D: Local Data & Danger Zone */}
            {activeTab === 'data' && (
              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase text-slate-500">Local Data Summary & Danger Zone</h3>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border bg-slate-50 text-center">
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-400">Stored Applicants</div>
                    <div className="text-base font-extrabold text-slate-800">{applicantCount}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-400">Stored Documents</div>
                    <div className="text-base font-extrabold text-slate-800">{documentCount}</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-red-200 bg-red-50 space-y-2">
                  <span className="font-bold text-xs text-red-900 block">Danger Zone Actions</span>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setConfirmModal('reset-settings')}
                      className="w-full p-2 text-xs font-bold rounded border bg-white border-amber-300 text-amber-900 hover:bg-amber-100 transition cursor-pointer text-left flex items-center justify-between"
                    >
                      <span>🔄 Reset Preferences to Defaults</span>
                      <span className="text-[10px] text-amber-700">Restores defaults</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmModal('clear-all')}
                      className="w-full p-2 text-xs font-bold rounded border bg-red-600 text-white hover:bg-red-700 transition cursor-pointer text-left flex items-center justify-between"
                    >
                      <span>💥 Clear All Local Extension Data</span>
                      <span className="text-[10px] text-red-200">Wipes all data</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
