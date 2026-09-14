import React, { useMemo, useState } from 'react'
import type { SavedApplication } from '../../core/application/types'
import {
  PORTAL_COUNTRY_OPTIONS,
  PORTAL_NATIONALITY_OPTIONS,
  PORTAL_PURPOSE_OF_VISIT_OPTIONS,
  getMissionOptionsForCountry,
  type PortalSelectOption,
} from '../../countries/india/options/registrationOptions'

interface RegistrationSectionProps {
  application: SavedApplication | null
  onFieldChange: (key: string, value: string) => void
  onResetField: (key: string) => void
  renderSourceBadge: (fieldKey: string) => React.ReactNode
}

interface SearchableSelectProps {
  id: string
  name: string
  value: string
  options: PortalSelectOption[]
  placeholder?: string
  onChange: (value: string) => void
  className?: string
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  name,
  value,
  options,
  placeholder = 'Select...',
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [filterText, setFilterText] = useState('')

  const selectedOption = useMemo(() => {
    if (!value) return null
    const norm = value.trim().toUpperCase()
    return (
      options.find(
        (o) =>
          o.value.toUpperCase() === norm ||
          o.label.toUpperCase() === norm
      ) || { value, label: value }
    )
  }, [value, options])

  const filteredOptions = useMemo(() => {
    if (!filterText.trim()) return options
    const q = filterText.trim().toLowerCase()
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q)
    )
  }, [options, filterText])

  return (
    <div className={`relative w-full ${className}`}>
      {/* Primary Select Trigger */}
      <div
        id={`${id}_trigger`}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full bg-slate-900/90 text-slate-100 border border-slate-700 hover:border-slate-500 rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium flex items-center justify-between cursor-pointer shadow-inner transition-colors"
      >
        <span className={selectedOption ? 'text-slate-100 font-semibold' : 'text-slate-400 font-normal'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="text-[10px] text-slate-400 ml-2">▼</span>
      </div>

      {/* Hidden native select for accessibility & form testing */}
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Dropdown Popover */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false)
              setFilterText('')
            }}
          />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-h-60 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-2 border-b border-slate-800 bg-slate-950/80">
              <input
                type="text"
                autoFocus
                placeholder="Search option..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="overflow-y-auto flex-1 p-1 divide-y divide-slate-800/40">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const isSelected = selectedOption?.value === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value)
                        setIsOpen(false)
                        setFilterText('')
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600/30 text-blue-300 font-bold'
                          : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <span className="text-blue-400 text-xs ml-2">✓</span>}
                    </button>
                  )
                })
              ) : (
                <div className="px-3 py-2 text-xs text-slate-400 text-center italic">
                  No matching options
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export const RegistrationSection: React.FC<RegistrationSectionProps> = ({
  application,
  onFieldChange,
  onResetField,
  renderSourceBadge,
}) => {
  // Extract canonical field values
  const countryVal = String(application?.fields['appl.countryname']?.value || application?.fields['present_country']?.value || '')
  const missionVal = String(application?.fields['appl.missioncode']?.value || '')
  const nationalityVal = String(application?.fields['appl.nationality']?.value || '')
  const dobVal = String(application?.fields['appl.birthdate']?.value || '')
  const emailVal = String(application?.fields['appl.email']?.value || '')
  const emailReVal = String(application?.fields['appl.email_re']?.value || application?.fields['appl.email']?.value || '')
  const journeyVal = String(application?.fields['appl.journeydate']?.value || application?.fields['journeydate']?.value || '')
  const purposeVal = String(application?.fields['purpose']?.value || application?.fields['appl.purpose']?.value || '')

  // Mission options prioritized for selected country
  const missionOptions = useMemo(() => {
    return getMissionOptionsForCountry(countryVal || 'BANGLADESH')
  }, [countryVal])

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden scroll-mt-28">
      {/* 1. Official Indian Visa Portal Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-100 via-slate-50 to-emerald-100 border-b border-slate-300 text-slate-900 py-3.5 px-4 sm:px-6 shadow-sm">
        {/* Background Tricolor & Emblem subtle elements */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400 via-transparent to-emerald-500" />
        
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          {/* Left: Watermark & Identity text */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-slate-800/80 bg-white flex items-center justify-center p-1 shadow">
              {/* Ashoka Chakra vector representation */}
              <svg viewBox="0 0 100 100" className="w-full h-full text-blue-900 animate-spin-slow">
                <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="4" fill="none" />
                <circle cx="50" cy="50" r="10" fill="currentColor" />
                {Array.from({ length: 24 }).map((_, i) => (
                  <line
                    key={i}
                    x1="50"
                    y1="50"
                    x2={50 + 44 * Math.cos((i * 15 * Math.PI) / 180)}
                    y2={50 + 44 * Math.sin((i * 15 * Math.PI) / 180)}
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                ))}
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-slate-700 leading-tight">
                भारत गणराज्य &bull; REPUBLIC OF INDIA
              </div>
              <div className="text-base sm:text-lg font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                <span>INDIAN VISA</span>
                <span className="text-emerald-700">ONLINE</span>
              </div>
              <div className="text-[10px] font-semibold text-slate-600">
                Government of India &bull; Ministry of Home Affairs
              </div>
            </div>
          </div>

          {/* Right: Portal Context Badge */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="px-2.5 py-1 rounded bg-slate-900/90 text-amber-300 border border-slate-700 text-[11px] font-bold shadow-sm">
              🇮🇳 Official Portal Registration Form
            </span>
            <span className="text-[10px] text-slate-600 font-medium mt-0.5">
              Workspace Review & Autofill Synchronizer
            </span>
          </div>
        </div>
      </div>

      {/* 2. Top Pink Header Bar */}
      <div className="bg-[#d49ebf] text-[#3b1233] px-4 sm:px-6 py-2 border-b border-[#bd83a8] flex items-center justify-between shadow-sm">
        <h2 className="text-sm sm:text-base font-extrabold tracking-wide uppercase">
          Online Visa Application
        </h2>
        <span className="text-sm font-bold bg-[#3b1233] text-white w-6 h-6 rounded flex items-center justify-center shadow-sm" title="Registration Page Home">
          🏠
        </span>
      </div>

      {/* 3. Main Form Card Layout */}
      <div className="p-4 sm:p-7 space-y-4 sm:space-y-5 bg-slate-950/60">
        <div className="max-w-4xl mx-auto divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-900/80 shadow-md">
          
          {/* Row 1: Country/Region you are applying visa from */}
          <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-4 items-center hover:bg-slate-850/40 transition-colors">
            <div className="md:col-span-5 flex items-center justify-between md:justify-end gap-2">
              <label htmlFor="countryname_id" className="text-xs sm:text-sm font-semibold text-slate-200 text-left md:text-right">
                Country/Region you are applying visa from <span className="text-rose-500 font-bold">*</span>
              </label>
            </div>
            <div className="md:col-span-7 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  id="countryname_id"
                  name="appl.countryname"
                  value={countryVal}
                  options={PORTAL_COUNTRY_OPTIONS}
                  placeholder="Select Country/Region"
                  onChange={(val) => onFieldChange('appl.countryname', val)}
                />
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {renderSourceBadge('appl.countryname')}
                {application?.fields['appl.countryname']?.isUserEdited && (
                  <button
                    title="Reset to original extracted value"
                    onClick={() => onResetField('appl.countryname')}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                  >
                    ↺
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Indian Mission/Office */}
          <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-4 items-center hover:bg-slate-850/40 transition-colors">
            <div className="md:col-span-5 flex items-center justify-between md:justify-end gap-2">
              <label htmlFor="missioncode_id" className="text-xs sm:text-sm font-semibold text-slate-200 text-left md:text-right">
                Indian Mission/Office <span className="text-rose-500 font-bold">*</span>
              </label>
            </div>
            <div className="md:col-span-7 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  id="missioncode_id"
                  name="appl.missioncode"
                  value={missionVal}
                  options={missionOptions}
                  placeholder="Select Indian Mission"
                  onChange={(val) => onFieldChange('appl.missioncode', val)}
                />
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {renderSourceBadge('appl.missioncode')}
                {application?.fields['appl.missioncode']?.isUserEdited && (
                  <button
                    title="Reset to original extracted value"
                    onClick={() => onResetField('appl.missioncode')}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                  >
                    ↺
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Nationality/Region */}
          <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-4 items-center hover:bg-slate-850/40 transition-colors">
            <div className="md:col-span-5 flex items-center justify-between md:justify-end gap-2">
              <label htmlFor="nationality_id" className="text-xs sm:text-sm font-semibold text-slate-200 text-left md:text-right">
                Nationality/Region <span className="text-rose-500 font-bold">*</span>
              </label>
            </div>
            <div className="md:col-span-7 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  id="nationality_id"
                  name="appl.nationality"
                  value={nationalityVal}
                  options={PORTAL_NATIONALITY_OPTIONS}
                  placeholder="Select Nationality"
                  onChange={(val) => onFieldChange('appl.nationality', val)}
                />
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {renderSourceBadge('appl.nationality')}
                {application?.fields['appl.nationality']?.isUserEdited && (
                  <button
                    title="Reset to original extracted value"
                    onClick={() => onResetField('appl.nationality')}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                  >
                    ↺
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Row 4: Date of Birth */}
          <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-4 items-center hover:bg-slate-850/40 transition-colors">
            <div className="md:col-span-5 flex items-center justify-between md:justify-end gap-2">
              <label htmlFor="dob_id" className="text-xs sm:text-sm font-semibold text-slate-200 text-left md:text-right">
                Date of Birth <span className="text-rose-500 font-bold">*</span>
              </label>
            </div>
            <div className="md:col-span-7 flex items-center gap-2">
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <input
                  type="text"
                  id="dob_id"
                  name="appl.birthdate"
                  value={dobVal}
                  placeholder="DD/MM/YYYY"
                  onChange={(e) => onFieldChange('appl.birthdate', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs sm:text-sm text-slate-100 font-medium focus:outline-none focus:border-blue-500 placeholder:text-slate-500 shadow-inner"
                />
                <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap hidden sm:inline">
                  (DD/MM/YYYY)
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {renderSourceBadge('appl.birthdate')}
                {application?.fields['appl.birthdate']?.isUserEdited && (
                  <button
                    title="Reset to original extracted value"
                    onClick={() => onResetField('appl.birthdate')}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                  >
                    ↺
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Row 5: Email ID */}
          <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-4 items-center hover:bg-slate-850/40 transition-colors">
            <div className="md:col-span-5 flex items-center justify-between md:justify-end gap-2">
              <label htmlFor="email_id" className="text-xs sm:text-sm font-semibold text-slate-200 text-left md:text-right">
                Email ID <span className="text-rose-500 font-bold">*</span>
              </label>
            </div>
            <div className="md:col-span-7 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  id="email_id"
                  name="appl.email"
                  value={emailVal}
                  placeholder="applicant@example.com"
                  onChange={(e) => onFieldChange('appl.email', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs sm:text-sm text-slate-100 font-medium focus:outline-none focus:border-blue-500 placeholder:text-slate-500 shadow-inner"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {renderSourceBadge('appl.email')}
                {application?.fields['appl.email']?.isUserEdited && (
                  <button
                    title="Reset to original extracted value"
                    onClick={() => onResetField('appl.email')}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                  >
                    ↺
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Row 6: Re-enter Email ID */}
          <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-4 items-center hover:bg-slate-850/40 transition-colors">
            <div className="md:col-span-5 flex items-center justify-between md:justify-end gap-2">
              <label htmlFor="email_re_id" className="text-xs sm:text-sm font-semibold text-slate-200 text-left md:text-right">
                Re-enter Email ID <span className="text-rose-500 font-bold">*</span>
              </label>
            </div>
            <div className="md:col-span-7 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  id="email_re_id"
                  name="appl.email_re"
                  value={emailReVal}
                  placeholder="applicant@example.com"
                  onChange={(e) => onFieldChange('appl.email_re', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs sm:text-sm text-slate-100 font-medium focus:outline-none focus:border-blue-500 placeholder:text-slate-500 shadow-inner"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {renderSourceBadge('appl.email_re')}
                {application?.fields['appl.email_re']?.isUserEdited && (
                  <button
                    title="Reset to original extracted value"
                    onClick={() => onResetField('appl.email_re')}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                  >
                    ↺
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Row 7: Expected Date of Arrival */}
          <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-4 items-center hover:bg-slate-850/40 transition-colors">
            <div className="md:col-span-5 flex items-center justify-between md:justify-end gap-2">
              <label htmlFor="jouryney_id" className="text-xs sm:text-sm font-semibold text-slate-200 text-left md:text-right">
                Expected Date of Arrival <span className="text-rose-500 font-bold">*</span>
              </label>
            </div>
            <div className="md:col-span-7 flex items-center gap-2">
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <input
                  type="text"
                  id="jouryney_id"
                  name="appl.journeydate"
                  value={journeyVal}
                  placeholder="DD/MM/YYYY"
                  onChange={(e) => onFieldChange('appl.journeydate', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs sm:text-sm text-slate-100 font-medium focus:outline-none focus:border-blue-500 placeholder:text-slate-500 shadow-inner"
                />
                <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap hidden sm:inline">
                  (DD/MM/YYYY)
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {renderSourceBadge('appl.journeydate')}
                {application?.fields['appl.journeydate']?.isUserEdited && (
                  <button
                    title="Reset to original extracted value"
                    onClick={() => onResetField('appl.journeydate')}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                  >
                    ↺
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Row 8: Visiting India for */}
          <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-4 items-center hover:bg-slate-850/40 transition-colors">
            <div className="md:col-span-5 flex items-center justify-between md:justify-end gap-2">
              <label htmlFor="purpose_id" className="text-xs sm:text-sm font-semibold text-slate-200 text-left md:text-right">
                Visiting India for <span className="text-rose-500 font-bold">*</span>
              </label>
            </div>
            <div className="md:col-span-7 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  id="purpose_id"
                  name="appl.purpose"
                  value={purposeVal}
                  options={PORTAL_PURPOSE_OF_VISIT_OPTIONS}
                  placeholder="Select Purpose of Visit"
                  onChange={(val) => onFieldChange('purpose', val)}
                />
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {renderSourceBadge('purpose')}
                {application?.fields['purpose']?.isUserEdited && (
                  <button
                    title="Reset to original extracted value"
                    onClick={() => onResetField('purpose')}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                  >
                    ↺
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 4. Bottom Pink Footer Bar */}
      <div className="bg-[#d49ebf] text-[#3b1233] px-4 sm:px-6 py-2 border-t border-[#bd83a8] text-center shadow-inner">
        <span className="text-xs sm:text-sm font-extrabold tracking-wide uppercase">
          Online Visa Application
        </span>
      </div>
    </div>
  )
}
