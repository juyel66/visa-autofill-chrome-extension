import React, { useMemo, useState } from 'react'
import type { SavedApplication, ApplicationFieldValue } from '../../core/application/types'
import {
  PORTAL_COUNTRY_OPTIONS,
  PORTAL_NATIONALITY_OPTIONS,
  getMissionOptionsForCountry,
  type PortalSelectOption,
} from '../../countries/india/options/registrationOptions'

export interface RegistrationSectionProps {
  application: SavedApplication | null
  onFieldChange: (key: string, value: string) => void
  onResetField?: (key: string) => void
  renderSourceBadge?: (fieldValue?: ApplicationFieldValue | string) => React.ReactNode
  onContinue?: () => void
  onNextPage?: () => void
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
        className="w-full bg-white text-slate-800 border border-[#a0aec0] hover:border-slate-500 rounded px-2.5 py-1 text-xs font-medium flex items-center justify-between cursor-pointer shadow-xs transition-colors"
      >
        <span className={selectedOption ? 'text-slate-900 font-semibold' : 'text-slate-500 font-normal'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="text-[9px] text-slate-500 ml-2">▼</span>
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
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-[#a0aec0] rounded shadow-xl max-h-56 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-1.5 border-b border-slate-200 bg-slate-50">
              <input
                type="text"
                autoFocus
                placeholder="Search option..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="overflow-y-auto flex-1 p-1 divide-y divide-slate-100">
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
                      className={`w-full text-left px-2.5 py-1 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <span className="text-blue-600 text-xs ml-2">✓</span>}
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
  onContinue,
  onNextPage,
}) => {
  // Extract canonical field values
  const countryVal = String(application?.fields['appl.countryname']?.value || application?.fields['present_country']?.value || 'BANGLADESH')
  const missionVal = String(application?.fields['appl.missioncode']?.value || '')
  const nationalityVal = String(application?.fields['appl.nationality']?.value || 'BANGLADESH')
  const dobVal = String(application?.fields['appl.birthdate']?.value || '')
  const emailVal = String(application?.fields['appl.email']?.value || '')
  const emailReVal = String(application?.fields['appl.email_re']?.value || application?.fields['appl.email']?.value || '')
  const journeyVal = String(application?.fields['appl.journeydate']?.value || application?.fields['journeydate']?.value || '')

  // State for simulated captcha
  const [captchaCode, setCaptchaCode] = useState<string>('e3d5hq')
  const [captchaInput, setCaptchaInput] = useState<string>('')

  const handleRefreshCaptcha = () => {
    const chars = '23456789abcdefghkmnpqrstuvwxyz'
    let newCode = ''
    for (let i = 0; i < 6; i++) {
      newCode += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setCaptchaCode(newCode)
  }

  // Mission options prioritized for selected country
  const missionOptions = useMemo(() => {
    return getMissionOptionsForCountry(countryVal || 'BANGLADESH')
  }, [countryVal])

  const handleContinueClick = () => {
    if (onContinue) {
      onContinue()
    } else if (onNextPage) {
      onNextPage()
    }
  }

  const renderBadge = (key: string) => {
    if (!renderSourceBadge) return null
    return renderSourceBadge(application?.fields[key])
  }

  return (
    <div className="w-full bg-[#f4f4f4] rounded-xl border border-[#d1d5db] shadow-md overflow-hidden text-[#222222] font-sans">
      {/* 1. Official Indian Visa Portal Header Banner */}
      <div className="relative bg-white border-b border-[#c8ccd0] px-4 py-3 flex items-center justify-between overflow-hidden">
        {/* Background Tricolor & subtle flourish */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none bg-repeat"
          style={{
            backgroundImage: `radial-gradient(#1e3a8a 1.5px, transparent 1.5px)`,
            backgroundSize: '16px 16px',
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-[#1e3a8a] flex items-center justify-center bg-white shadow-sm flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-10 h-10 text-[#1e3a8a]">
              <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="4" fill="none" />
              <circle cx="50" cy="50" r="8" fill="currentColor" />
              {[...Array(24)].map((_, i) => (
                <line
                  key={i}
                  x1="50"
                  y1="50"
                  x2={50 + 42 * Math.cos((i * 15 * Math.PI) / 180)}
                  y2={50 + 42 * Math.sin((i * 15 * Math.PI) / 180)}
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-widest text-[#d97706] uppercase">भारत गणराज्य</span>
              <span className="text-xs font-semibold text-slate-500">|</span>
              <span className="text-xs font-bold tracking-wider text-[#1e3a8a] uppercase">REPUBLIC OF INDIA</span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#1e3a8a]">
              INDIAN VISA ONLINE
            </h1>
            <p className="text-[11px] font-semibold text-[#059669] -mt-0.5">Government of India</p>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end relative z-10">
          <div className="h-2 w-28 rounded-full bg-gradient-to-r from-[#ff9933] via-white to-[#138808] border border-slate-300 shadow-xs mb-1" />
          <span className="text-[10px] font-bold text-slate-600 tracking-wide uppercase">
            Official Portal Interface
          </span>
        </div>
      </div>

      {/* 2. Top Pink Header Bar (Image 1 replica) */}
      <div className="bg-[#cf9bbd] text-[#111827] px-4 sm:px-6 py-2 border-b border-[#bd83a8] flex items-center justify-between shadow-xs">
        <h2 className="text-sm sm:text-base font-extrabold tracking-wide text-center flex-1">
          Online Visa Application
        </h2>
        <span className="text-base cursor-pointer hover:opacity-80 flex-shrink-0" title="Registration Page Home">
          🏠
        </span>
      </div>

      {/* 3. Main Form Card Layout (Exact replica of Image 1) */}
      <div className="p-4 sm:p-8 bg-[#f5f5f5] flex justify-center">
        <div className="w-full max-w-2xl bg-white rounded-lg border border-[#c8ccd0] shadow-sm p-5 sm:p-7 space-y-4">
          
          {/* Row 1: Country/Region you are applying visa from* */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <label htmlFor="countryname_id" className="sm:col-span-6 text-left sm:text-right text-xs sm:text-sm font-normal text-[#222222] pr-2">
              Country/Region you are applying visa from<span className="text-red-600 font-bold">*</span>
            </label>
            <div className="sm:col-span-6 flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  id="countryname_id"
                  name="appl.countryname"
                  value={countryVal}
                  options={PORTAL_COUNTRY_OPTIONS}
                  placeholder="Select country"
                  onChange={(val) => onFieldChange('appl.countryname', val)}
                />
              </div>
              {renderBadge('appl.countryname')}
              {application?.fields['appl.countryname']?.isUserEdited && onResetField && (
                <button
                  title="Reset to original extracted value"
                  onClick={() => onResetField('appl.countryname')}
                  className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                >
                  ↺
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Indian Mission/Office* */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <label htmlFor="missioncode_id" className="sm:col-span-6 text-left sm:text-right text-xs sm:text-sm font-normal text-[#222222] pr-2">
              Indian Mission/Office<span className="text-red-600 font-bold">*</span>
            </label>
            <div className="sm:col-span-6 flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  id="missioncode_id"
                  name="appl.missioncode"
                  value={missionVal}
                  options={missionOptions}
                  placeholder="Select Mission"
                  onChange={(val) => onFieldChange('appl.missioncode', val)}
                />
              </div>
              {renderBadge('appl.missioncode')}
              {application?.fields['appl.missioncode']?.isUserEdited && onResetField && (
                <button
                  title="Reset to original extracted value"
                  onClick={() => onResetField('appl.missioncode')}
                  className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                >
                  ↺
                </button>
              )}
            </div>
          </div>

          {/* Row 3: Nationality/Region* */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <label htmlFor="nationality_id" className="sm:col-span-6 text-left sm:text-right text-xs sm:text-sm font-normal text-[#222222] pr-2">
              Nationality/Region<span className="text-red-600 font-bold">*</span>
            </label>
            <div className="sm:col-span-6 flex items-center gap-1.5">
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
              {renderBadge('appl.nationality')}
              {application?.fields['appl.nationality']?.isUserEdited && onResetField && (
                <button
                  title="Reset to original extracted value"
                  onClick={() => onResetField('appl.nationality')}
                  className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                >
                  ↺
                </button>
              )}
            </div>
          </div>

          {/* Row 4: Date of Birth* */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <label htmlFor="dob_id" className="sm:col-span-6 text-left sm:text-right text-xs sm:text-sm font-normal text-[#222222] pr-2">
              Date of Birth<span className="text-red-600 font-bold">*</span>
            </label>
            <div className="sm:col-span-6 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  id="dob_id"
                  name="appl.birthdate"
                  value={dobVal}
                  placeholder=""
                  onChange={(e) => onFieldChange('appl.birthdate', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <span className="text-[11px] text-[#555555] whitespace-nowrap">
                (DD/MM/YYYY)
              </span>
              {renderBadge('appl.birthdate')}
            </div>
          </div>

          {/* Row 5: Email ID* */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <label htmlFor="email_id" className="sm:col-span-6 text-left sm:text-right text-xs sm:text-sm font-normal text-[#222222] pr-2">
              Email ID<span className="text-red-600 font-bold">*</span>
            </label>
            <div className="sm:col-span-6 flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  id="email_id"
                  name="appl.email"
                  value={emailVal}
                  placeholder=""
                  onChange={(e) => onFieldChange('appl.email', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              {renderBadge('appl.email')}
            </div>
          </div>

          {/* Row 6: Re-enter Email ID* */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <label htmlFor="email_re_id" className="sm:col-span-6 text-left sm:text-right text-xs sm:text-sm font-normal text-[#222222] pr-2">
              Re-enter Email ID<span className="text-red-600 font-bold">*</span>
            </label>
            <div className="sm:col-span-6 flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  id="email_re_id"
                  name="appl.email_re"
                  value={emailReVal}
                  placeholder=""
                  onChange={(e) => onFieldChange('appl.email_re', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              {renderBadge('appl.email_re')}
            </div>
          </div>

          {/* Row 7: Expected Date of Arrival* */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <label htmlFor="journey_id" className="sm:col-span-6 text-left sm:text-right text-xs sm:text-sm font-normal text-[#222222] pr-2">
              Expected Date of Arrival<span className="text-red-600 font-bold">*</span>
            </label>
            <div className="sm:col-span-6 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  id="journey_id"
                  name="appl.journeydate"
                  value={journeyVal}
                  placeholder=""
                  onChange={(e) => onFieldChange('appl.journeydate', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <span className="text-[11px] text-[#555555] whitespace-nowrap">
                (DD/MM/YYYY)
              </span>
              {renderBadge('appl.journeydate')}
            </div>
          </div>

          {/* Row 8: Captcha Box (Image 1 faithful reproduction) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center pt-1">
            <div className="sm:col-span-6" />
      
          </div>

          {/* Row 9: Please enter above text* */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <label htmlFor="captcha_input_id" className="sm:col-span-6 text-left sm:text-right text-xs sm:text-sm font-normal text-[#222222] pr-2">
              Please enter above text<span className="text-red-600 font-bold">*</span>
            </label>
            <div className="sm:col-span-6">
              <input
                type="text"
                id="captcha_input_id"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                placeholder=""
                className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Row 10: Continue Button (Image 1 authentic orange button) */}
          <div className="flex justify-center pt-3">
            <button
              type="button"
              onClick={handleContinueClick}
              className="bg-[#e06743] hover:bg-[#d45632] text-white font-semibold text-xs sm:text-sm px-6 py-1.5 rounded shadow-sm transition-colors cursor-pointer"
            >
              Continue
            </button>
          </div>

        </div>
      </div>

      {/* 4. Bottom Pink Footer Bar */}
      <div className="bg-[#cf9bbd] text-[#111827] px-4 sm:px-6 py-2 border-t border-[#bd83a8] text-center shadow-inner">
        <span className="text-sm sm:text-base font-extrabold tracking-wide">
          Online Visa Application
        </span>
      </div>
    </div>
  )
}
