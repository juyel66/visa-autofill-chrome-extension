import React from 'react'
import type { SavedApplication, ApplicationFieldValue } from '../../core/application/types'
import {
  PORTAL_COUNTRY_OPTIONS,
  PORTAL_NATIONALITY_OPTIONS,
  PORTAL_GENDER_OPTIONS,
  PORTAL_RELIGION_OPTIONS,
  PORTAL_EDUCATION_OPTIONS,
  PORTAL_NATIONALITY_ACQUIRE_OPTIONS,
} from '../../countries/india/options/registrationOptions'

export interface BasicDetailsSectionProps {
  application: SavedApplication | null
  onFieldChange: (fieldKey: string, value: string | boolean) => void
  onResetField: (fieldKey: string) => void
  renderSourceBadge: (fieldValue?: ApplicationFieldValue) => React.ReactNode
}

export const BasicDetailsSection: React.FC<BasicDetailsSectionProps> = ({
  application,
  onFieldChange,
  onResetField,
  renderSourceBadge,
}) => {
  const fields = application?.fields || {}

  const getVal = (key: string): string => {
    const val = fields[key]?.value
    if (typeof val === 'string') return val
    if (typeof val === 'boolean') return val ? 'true' : 'false'
    return ''
  }

  const getBool = (key: string): boolean => {
    const val = fields[key]?.value
    if (typeof val === 'boolean') return val
    if (typeof val === 'string') return val.toLowerCase() === 'yes' || val.toLowerCase() === 'true'
    return false
  }

  const missionCode = getVal('appl.missioncode') || 'BANGLADESH-RAJSHAHI'
  const tempAppId = application?.applicantId
    ? `APPL-${application.applicantId.substring(0, 8).toUpperCase()}`
    : '4XA4AXX5YTV4RFB'

  const hasChangedName = getBool('appl.changedSurnameCheck')
  const hasOtherPassport = getVal('appl.oth_ppt').toLowerCase() === 'yes'

  return (
    <div className="w-full bg-[#f6f6f6] rounded-xl border border-[#d1d5db] shadow-md overflow-hidden text-[#222222] font-sans">
      {/* 1. Official Portal Header Banner */}
      <div className="relative bg-white border-b border-[#c8ccd0] px-4 py-3 flex items-center justify-between overflow-hidden">
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

      {/* 2. Top Title Bar */}
      <div className="bg-[#b388b3] text-white px-4 py-1.5 flex items-center justify-between shadow-xs font-semibold text-sm">
        <span className="font-bold tracking-wide">Applicant Details Form</span>
        <span className="text-xs cursor-pointer hover:underline" title="Portal Page 2 of 4">🏠</span>
      </div>

      {/* 3. Top Mission & Temp Application ID Bar */}
      <div className="bg-[#f0e6f0] border-b border-[#d8c0d8] px-4 py-2 text-xs text-[#333333] space-y-1">
        <div className="font-bold text-[#4a154b]">
          Indian Mission/Office: <span className="text-[#800000]">{missionCode}</span>
        </div>
        <div className="text-[11px] text-[#2b542c] font-semibold">
          Data saved Successfully. Please note down the Temporary Application ID :{' '}
          <span className="font-bold text-[#b91c1c] tracking-wider">{tempAppId}</span>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* ========================================================================= */}
        {/* SUBSECTION 1: Applicant Details */}
        {/* ========================================================================= */}
        <div className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            Applicant Details
          </div>

          <div className="p-4 space-y-3.5 text-xs">
            {/* 1. Surname */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Surname (as shown in your Passport)
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('appl.surname')}
                  onChange={(e) => onFieldChange('appl.surname', e.target.value.toUpperCase())}
                  placeholder="SURNAME"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['appl.surname'])}
                {fields['appl.surname']?.isUserEdited && (
                  <button
                    onClick={() => onResetField('appl.surname')}
                    className="text-slate-400 hover:text-blue-600 text-xs px-1"
                    title="Reset to extracted value"
                  >
                    ↺
                  </button>
                )}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">
                Surname/Family Name (As in Passport)
              </div>
            </div>

            {/* 2. Given Names */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Given Name(s) (Complete as in Passport) <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('appl.applname')}
                  onChange={(e) => onFieldChange('appl.applname', e.target.value.toUpperCase())}
                  placeholder="GIVEN NAMES"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['appl.applname'])}
                {fields['appl.applname']?.isUserEdited && (
                  <button
                    onClick={() => onResetField('appl.applname')}
                    className="text-slate-400 hover:text-blue-600 text-xs px-1"
                    title="Reset to extracted value"
                  >
                    ↺
                  </button>
                )}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">
                Given Name(s) (exactly as in Passport)
              </div>
            </div>

            {/* 3. Name change checkbox */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#faf5fa] py-1.5 rounded">
              <div className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Have you ever changed your name? If yes, click the box
              </div>
              <div className="sm:col-span-5 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasChangedName}
                  onChange={(e) => onFieldChange('appl.changedSurnameCheck', e.target.checked)}
                  className="rounded border-slate-400 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-[11px] text-slate-600">and give details.</span>
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">
                If You have ever changed your Name Please tell us.
              </div>
            </div>

            {/* 4. Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Gender <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('appl.applsex').toUpperCase()}
                  onChange={(e) => onFieldChange('appl.applsex', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="">Select gender</option>
                  {PORTAL_GENDER_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['appl.applsex'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Gender</div>
            </div>

            {/* 5. Date of Birth */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Date of Birth <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('appl.birthdate')}
                  onChange={(e) => onFieldChange('appl.birthdate', e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['appl.birthdate'])}
                {fields['appl.birthdate']?.isUserEdited && (
                  <button
                    onClick={() => onResetField('appl.birthdate')}
                    className="text-slate-400 hover:text-blue-600 text-xs px-1"
                    title="Reset to extracted value"
                  >
                    ↺
                  </button>
                )}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">
                Date of Birth as in Passport in DD/MM/YYYY format
              </div>
            </div>

            {/* 6. Town/City of birth */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Town/City of birth <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('appl.placbrth')}
                  onChange={(e) => onFieldChange('appl.placbrth', e.target.value.toUpperCase())}
                  placeholder="TOWN / CITY OF BIRTH"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['appl.placbrth'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">
                Province/Town/City of birth
              </div>
            </div>

            {/* 7. Country of birth */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Country/Region of birth <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('appl.country_of_birth')}
                  onChange={(e) => onFieldChange('appl.country_of_birth', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="">Select Country</option>
                  {PORTAL_COUNTRY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['appl.country_of_birth'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Country/Region of birth</div>
            </div>

            {/* 8. National ID / NID */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Citizenship/National Id No. <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('appl.nic_no')}
                  onChange={(e) => onFieldChange('appl.nic_no', e.target.value)}
                  placeholder="NATIONAL ID / NA"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['appl.nic_no'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">
                If not applicable Please Type NA
              </div>
            </div>

            {/* 9. Religion */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Religion <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('appl.religion')}
                  onChange={(e) => onFieldChange('appl.religion', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="">Select Religion</option>
                  {PORTAL_RELIGION_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['appl.religion'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">If Others ,Please specify</div>
            </div>

            {/* 10. Visible identification marks */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Visible identification marks <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('appl.visual_mark')}
                  onChange={(e) => onFieldChange('appl.visual_mark', e.target.value.toUpperCase())}
                  placeholder="NA / MOLE / SCAR"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['appl.visual_mark'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Visible identification marks</div>
            </div>

            {/* 11. Educational Qualification */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Educational Qualification <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('appl.edu_id') || 'BELOW MATRICULATION'}
                  onChange={(e) => onFieldChange('appl.edu_id', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="">Select Education</option>
                  {PORTAL_EDUCATION_OPTIONS.map((ed) => (
                    <option key={ed.value} value={ed.value}>
                      {ed.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['appl.edu_id'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Educational Qualification</div>
            </div>

            {/* 12. Nationality */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Nationality <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('appl.nationality') || 'BANGLADESH'}
                  onChange={(e) => onFieldChange('appl.nationality', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="">Select Nationality</option>
                  {PORTAL_NATIONALITY_OPTIONS.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['appl.nationality'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Nationality</div>
            </div>

            {/* 13. Nationality acquired by */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Did you acquire Nationality by birth or by naturalization? <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('appl.nationality_by')}
                  onChange={(e) => onFieldChange('appl.nationality_by', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="">Select</option>
                  {PORTAL_NATIONALITY_ACQUIRE_OPTIONS.map((ac) => (
                    <option key={ac.value} value={ac.value}>
                      {ac.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['appl.nationality_by'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">
                Did you acquire Nationality by birth or by naturalization?
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUBSECTION 2: Passport Details */}
        {/* ========================================================================= */}
        <div id="sec-passportDetails" className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs scroll-mt-28">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            Passport Details
          </div>

          <div className="p-4 space-y-3.5 text-xs">
            {/* 1. Passport Number */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Passport Number <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('appl.passport_number')}
                  onChange={(e) => onFieldChange('appl.passport_number', e.target.value.toUpperCase())}
                  placeholder="PASSPORT NUMBER"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 font-bold tracking-wider focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['appl.passport_number'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Applicant's Passport Number</div>
            </div>

            {/* 2. Place of Issue */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Place of Issue <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('appl.passport_issue_place') || 'DHAKA'}
                  onChange={(e) => onFieldChange('appl.passport_issue_place', e.target.value.toUpperCase())}
                  placeholder="PLACE OF ISSUE"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['appl.passport_issue_place'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Place of Issue</div>
            </div>

            {/* 3. Date of Issue */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Date of Issue <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('appl.passport_issue_date')}
                  onChange={(e) => onFieldChange('appl.passport_issue_date', e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['appl.passport_issue_date'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">in DD/MM/YYYY format</div>
            </div>

            {/* 4. Date of Expiry */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Date of Expiry <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('appl.passport_expiry_date')}
                  onChange={(e) => onFieldChange('appl.passport_expiry_date', e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['appl.passport_expiry_date'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">
                in DD/MM/YYYY format Minimum Six Month Validity is Required.
              </div>
            </div>

            {/* 5. Any other passport held radio */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#faf5fa] py-2 rounded">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Any other valid Passport/Identity Certificate(IC) held
              </label>
              <div className="sm:col-span-5 flex items-center gap-4">
                <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="oth_ppt_radio"
                    checked={hasOtherPassport}
                    onChange={() => onFieldChange('appl.oth_ppt', 'Yes')}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  Yes
                </label>
                <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="oth_ppt_radio"
                    checked={!hasOtherPassport}
                    onChange={() => onFieldChange('appl.oth_ppt', 'No')}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  No
                </label>
                {renderSourceBadge(fields['appl.oth_ppt'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">If Yes Please give Details</div>
            </div>

            {/* Secondary Passport Conditional Sub-Fields */}
            {hasOtherPassport && (
              <div className="bg-[#f3e8f3] border border-[#d8c0d8] rounded p-3 space-y-3 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                    Country/Region of Issue <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="sm:col-span-5">
                    <select
                      value={getVal('appl.prev_passport_country_issue')}
                      onChange={(e) => onFieldChange('appl.prev_passport_country_issue', e.target.value)}
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    >
                      <option value="">Select Country</option>
                      {PORTAL_COUNTRY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                    Passport/IC No. <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={getVal('appl.oth_pptno')}
                      onChange={(e) => onFieldChange('appl.oth_pptno', e.target.value.toUpperCase())}
                      placeholder="OTHER PASSPORT NO"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                    Date of Issue <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="sm:col-span-5 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={getVal('appl.oth_ppt_issue_date')}
                      onChange={(e) => onFieldChange('appl.oth_ppt_issue_date', e.target.value)}
                      placeholder="DD/MM/YYYY"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                    {renderSourceBadge(fields['appl.oth_ppt_issue_date'])}
                  </div>
                  <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">in DD/MM/YYYY format</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                    Place of Issue <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={getVal('appl.oth_ppt_issue_place')}
                      onChange={(e) => onFieldChange('appl.oth_ppt_issue_place', e.target.value.toUpperCase())}
                      placeholder="PLACE OF ISSUE"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                    Nationality mentioned therein <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="sm:col-span-5">
                    <select
                      value={getVal('appl.other_ppt_nationality')}
                      onChange={(e) => onFieldChange('appl.other_ppt_nationality', e.target.value)}
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    >
                      <option value="">Select Nationality</option>
                      {PORTAL_NATIONALITY_OPTIONS.map((n) => (
                        <option key={n.value} value={n.value}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-[11px] text-slate-500 font-semibold italic">
          * Mandatory Fields
        </div>
      </div>
    </div>
  )
}
