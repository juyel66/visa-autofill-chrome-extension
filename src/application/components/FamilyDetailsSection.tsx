import React from 'react'
import type { SavedApplication, ApplicationFieldValue } from '../../core/application/types'
import {
  PORTAL_COUNTRY_OPTIONS,
  PORTAL_NATIONALITY_OPTIONS,
  PORTAL_MARITAL_STATUS_OPTIONS,
  PORTAL_OCCUPATION_OPTIONS,
} from '../../countries/india/options/registrationOptions'

export interface FamilyDetailsSectionProps {
  application: SavedApplication | null
  onFieldChange: (fieldKey: string, value: string | boolean) => void
  onResetField: (fieldKey: string) => void
  renderSourceBadge: (fieldValue?: ApplicationFieldValue) => React.ReactNode
  onCopyPresentToPermanent: () => void
  onSaveAndContinue?: () => void
  onSaveTemporarily?: () => void
  onPreviousPage?: () => void
}

export const FamilyDetailsSection: React.FC<FamilyDetailsSectionProps> = ({
  application,
  onFieldChange,
  onResetField,
  renderSourceBadge,
  onCopyPresentToPermanent,
  onSaveAndContinue,
  onSaveTemporarily,
  onPreviousPage,
}) => {
  const fields = application?.fields || {}

  const getVal = (key: string): string => {
    const val = fields[key]?.value
    if (typeof val === 'string') return val
    if (typeof val === 'boolean') return val ? 'true' : 'false'
    return ''
  }

  const tempAppId = application?.applicantId
    ? `APPL-${application.applicantId.substring(0, 8).toUpperCase()}`
    : '4XA4AXX5YTV4RFB'

  const maritalStatus = getVal('marital_status')
  const isMarried = maritalStatus.toLowerCase() === 'married'
  const hasPakistanAncestry = getVal('grandparent_flag').toLowerCase() === 'yes'
  const hasMilitaryService = getVal('prev_org').toLowerCase() === 'yes'

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
        <span className="font-bold tracking-wide">Family Details Form</span>
        <span className="text-xs cursor-pointer hover:underline" title="Portal Page 3 of 4">🏠</span>
      </div>

      {/* 3. Top Info Bar */}
      <div className="bg-[#f0e6f0] border-b border-[#d8c0d8] px-4 py-2 text-xs text-[#333333] space-y-1">
        <div className="text-[11px] font-semibold text-[#2b542c]">
          Please note down the Temporary Application ID :{' '}
          <span className="font-bold text-[#b91c1c] tracking-wider">{tempAppId}</span>
        </div>
        <p className="text-[10.5px] text-slate-600">
          Your Information will be saved if you click save button or continue to next page.
        </p>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* ========================================================================= */}
        {/* SUBSECTION 1: Applicant's Address Details */}
        {/* ========================================================================= */}
        <div id="sec-presentAddress" className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs scroll-mt-28">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            Applicant's Address Details
          </div>

          <div className="p-4 space-y-4 text-xs">
            {/* Present Address Header */}
            <div className="font-bold text-[#c2410c] text-xs border-b border-slate-200 pb-1 flex items-center justify-between">
              <span>Present Address</span>
              <button
                type="button"
                onClick={onCopyPresentToPermanent}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-blue-700 px-2 py-0.5 rounded border border-slate-300 font-normal cursor-pointer"
                title="Copy Present Address to Permanent Address"
              >
                📋 Copy to Permanent Address
              </button>
            </div>

            {/* House No / Street */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                House No./Street <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('pres_addr1')}
                  onChange={(e) => onFieldChange('pres_addr1', e.target.value.toUpperCase())}
                  placeholder="HOUSE / STREET ADDRESS"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['pres_addr1'])}
                {fields['pres_addr1']?.isUserEdited && (
                  <button onClick={() => onResetField('pres_addr1')} className="text-slate-400 hover:text-blue-600 px-1">↺</button>
                )}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">
                Applicant's Present Address Maximum 35 characters (Each Line)
              </div>
            </div>

            {/* Village / Town / City */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Village/Town/City <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('village_town_city')}
                  onChange={(e) => onFieldChange('village_town_city', e.target.value.toUpperCase())}
                  placeholder="VILLAGE / TOWN / CITY"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['village_town_city'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Village/Town/City</div>
            </div>

            {/* Country */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Country <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('present_country')}
                  onChange={(e) => onFieldChange('present_country', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="">Select Country</option>
                  {PORTAL_COUNTRY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['present_country'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Country</div>
            </div>

            {/* State / Province / District */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                State/Province/District <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('district') || getVal('state_province')}
                  onChange={(e) => {
                    onFieldChange('district', e.target.value.toUpperCase())
                    onFieldChange('state_province', e.target.value.toUpperCase())
                  }}
                  placeholder="DISTRICT / PROVINCE"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['district'] || fields['state_province'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">State/Province/District</div>
            </div>

            {/* Postal / Zip Code */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Postal/Zip Code <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('pincode')}
                  onChange={(e) => onFieldChange('pincode', e.target.value)}
                  placeholder="POSTAL CODE"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['pincode'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Postal/Zip Code</div>
            </div>

            {/* Phone No */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Phone No <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('pres_phone')}
                  onChange={(e) => onFieldChange('pres_phone', e.target.value)}
                  placeholder="PHONE NUMBER"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['pres_phone'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">One Contact No is Mandatory</div>
            </div>

            {/* Mobile No */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Mobile No
              </label>
              <div className="sm:col-span-5 flex items-center gap-2">
                <input
                  type="text"
                  value={getVal('isd_code') || '880'}
                  onChange={(e) => onFieldChange('isd_code', e.target.value)}
                  placeholder="ISD"
                  className="w-20 bg-white border border-[#a0aec0] rounded px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                <input
                  type="text"
                  value={getVal('mobile')}
                  onChange={(e) => onFieldChange('mobile', e.target.value)}
                  placeholder="MOBILE NUMBER"
                  className="flex-1 bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['mobile'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Mobile number.</div>
            </div>

            {/* Email Address */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Email Address
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="email"
                  value={getVal('appl.email')}
                  onChange={(e) => {
                    onFieldChange('appl.email', e.target.value)
                    onFieldChange('appl.email_re', e.target.value)
                  }}
                  placeholder="applicant@example.com"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['appl.email'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Email Address</div>
            </div>

            {/* Permanent Address Header */}
            <div id="sec-permanentAddress" className="font-bold text-[#c2410c] text-xs border-b border-slate-200 pb-1 pt-3 scroll-mt-28">
              Permanent Address
            </div>

            {/* Permanent House No / Street */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                House No./Street <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('perm_add1')}
                  onChange={(e) => onFieldChange('perm_add1', e.target.value.toUpperCase())}
                  placeholder="PERMANENT ADDRESS"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['perm_add1'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">
                Applicant's Permanent Address(with Postal/Zip Code)
              </div>
            </div>

            {/* Permanent Village / Town / City */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Village/Town/City <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('permanent_village_town_city')}
                  onChange={(e) => onFieldChange('permanent_village_town_city', e.target.value.toUpperCase())}
                  placeholder="VILLAGE / TOWN / CITY"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['permanent_village_town_city'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Village/Town/City</div>
            </div>

            {/* Permanent State / Province / District */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                State/Province/District <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('permanent_district') || getVal('permanent_state_province')}
                  onChange={(e) => {
                    onFieldChange('permanent_district', e.target.value.toUpperCase())
                    onFieldChange('permanent_state_province', e.target.value.toUpperCase())
                  }}
                  placeholder="DISTRICT / PROVINCE"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['permanent_district'] || fields['permanent_state_province'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">State/Province/District</div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUBSECTION 2: Family Details */}
        {/* ========================================================================= */}
        <div id="sec-familyDetails" className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs scroll-mt-28">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            Family Details
          </div>

          <div className="p-4 space-y-4 text-xs">
            {/* Father's Details */}
            <div className="font-bold text-[#c2410c] text-xs border-b border-slate-200 pb-1">
              Father's Details
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Name <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('fthrname')}
                  onChange={(e) => onFieldChange('fthrname', e.target.value.toUpperCase())}
                  placeholder="FATHER'S FULL NAME"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['fthrname'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Applicant's Father Name</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Nationality/Region <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('father_nationality') || 'BANGLADESH'}
                  onChange={(e) => onFieldChange('father_nationality', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                >
                  <option value="">Select Nationality</option>
                  {PORTAL_NATIONALITY_OPTIONS.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['father_nationality'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Nationality/Region of Father</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Previous Nationality/Region
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('father_prev_nationality') || 'BANGLADESH'}
                  onChange={(e) => onFieldChange('father_prev_nationality', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                >
                  <option value="">Select Nationality</option>
                  {PORTAL_NATIONALITY_OPTIONS.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['father_prev_nationality'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Previous Nationality of Father</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Place of birth
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('father_place_of_birth') || getVal('appl.placbrth')}
                  onChange={(e) => onFieldChange('father_place_of_birth', e.target.value.toUpperCase())}
                  placeholder="PLACE OF BIRTH"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                />
                {renderSourceBadge(fields['father_place_of_birth'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Place of birth</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Country/Region of birth <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('father_country_of_birth') || 'BANGLADESH'}
                  onChange={(e) => onFieldChange('father_country_of_birth', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                >
                  <option value="">Select Country</option>
                  {PORTAL_COUNTRY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['father_country_of_birth'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Country/Region of birth</div>
            </div>

            {/* Mother's Details */}
            <div className="font-bold text-[#c2410c] text-xs border-b border-slate-200 pb-1 pt-3">
              Mother's Details
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Name <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('mother_name')}
                  onChange={(e) => onFieldChange('mother_name', e.target.value.toUpperCase())}
                  placeholder="MOTHER'S FULL NAME"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['mother_name'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Applicant's Mother Name</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Nationality/Region <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('mother_nationality') || 'BANGLADESH'}
                  onChange={(e) => onFieldChange('mother_nationality', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                >
                  <option value="">Select Nationality</option>
                  {PORTAL_NATIONALITY_OPTIONS.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['mother_nationality'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Nationality/Region of Mother</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Previous Nationality/Region
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('mother_prev_nationality') || 'BANGLADESH'}
                  onChange={(e) => onFieldChange('mother_prev_nationality', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                >
                  <option value="">Select Nationality</option>
                  {PORTAL_NATIONALITY_OPTIONS.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['mother_prev_nationality'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Previous Nationality of Mother</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Place of birth
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('mother_place_of_birth') || getVal('appl.placbrth')}
                  onChange={(e) => onFieldChange('mother_place_of_birth', e.target.value.toUpperCase())}
                  placeholder="PLACE OF BIRTH"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                />
                {renderSourceBadge(fields['mother_place_of_birth'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Place of birth</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Country/Region of birth <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('mother_country_of_birth') || 'BANGLADESH'}
                  onChange={(e) => onFieldChange('mother_country_of_birth', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                >
                  <option value="">Select Country</option>
                  {PORTAL_COUNTRY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['mother_country_of_birth'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Country/Region of birth</div>
            </div>

            {/* Marital Status */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center pt-2">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Applicant's Marital Status <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('marital_status')}
                  onChange={(e) => onFieldChange('marital_status', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                >
                  <option value="">Select Marital Status</option>
                  {PORTAL_MARITAL_STATUS_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['marital_status'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Applicant's Marital Status</div>
            </div>

            {/* Spouse Conditional Fields */}
            {isMarried && (
              <div className="bg-[#faf5fa] border border-[#d8c0d8] rounded p-3 space-y-3">
                <div className="font-bold text-[#4a154b] text-[11px] uppercase">Spouse Details</div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">Spouse Name *</label>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={getVal('spouse_name')}
                      onChange={(e) => onFieldChange('spouse_name', e.target.value.toUpperCase())}
                      placeholder="SPOUSE NAME"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">Spouse Nationality *</label>
                  <div className="sm:col-span-5">
                    <select
                      value={getVal('spouse_nationality') || 'BANGLADESH'}
                      onChange={(e) => onFieldChange('spouse_nationality', e.target.value)}
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    >
                      <option value="">Select Nationality</option>
                      {PORTAL_NATIONALITY_OPTIONS.map((n) => (
                        <option key={n.value} value={n.value}>{n.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">Spouse Place of Birth</label>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={getVal('spouse_place_of_birth') || getVal('appl.placbrth')}
                      onChange={(e) => onFieldChange('spouse_place_of_birth', e.target.value.toUpperCase())}
                      placeholder="PLACE OF BIRTH"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">Spouse Country of Birth</label>
                  <div className="sm:col-span-5">
                    <select
                      value={getVal('spouse_country_of_birth') || 'BANGLADESH'}
                      onChange={(e) => onFieldChange('spouse_country_of_birth', e.target.value)}
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    >
                      <option value="">Select Country</option>
                      {PORTAL_COUNTRY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Pakistan Grandparent Ancestry */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#faf5fa] py-2 rounded">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2 text-[11px] leading-tight">
                Were your Grandfather/ Grandmother (paternal/maternal) Pakistan Nationals or Belong to Pakistan held area?
              </label>
              <div className="sm:col-span-5 flex items-center gap-4">
                <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="grandparent_radio"
                    checked={hasPakistanAncestry}
                    onChange={() => onFieldChange('grandparent_flag', 'Yes')}
                    className="text-purple-600"
                  />
                  Yes
                </label>
                <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="grandparent_radio"
                    checked={!hasPakistanAncestry}
                    onChange={() => onFieldChange('grandparent_flag', 'No')}
                    className="text-purple-600"
                  />
                  No
                </label>
                {renderSourceBadge(fields['grandparent_flag'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">If Yes, give details</div>
            </div>

            {hasPakistanAncestry && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">If Yes, give details *</label>
                <div className="sm:col-span-5">
                  <textarea
                    value={getVal('grandparent_details')}
                    onChange={(e) => onFieldChange('grandparent_details', e.target.value)}
                    rows={2}
                    placeholder="Provide details..."
                    className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUBSECTION 3: Profession / Occupation Details of Applicant */}
        {/* ========================================================================= */}
        <div id="sec-professionEmployment" className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs scroll-mt-28">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            Profession / Occupation Details of Applicant
          </div>

          <div className="p-4 space-y-3.5 text-xs">
            {/* Present Occupation */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Present Occupation <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('occupation')}
                  onChange={(e) => onFieldChange('occupation', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="">Select Occupation</option>
                  {PORTAL_OCCUPATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {renderSourceBadge(fields['occupation'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">If Others, please specify</div>
            </div>

            {/* Employer Name */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Employer Name/business <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('empname')}
                  onChange={(e) => onFieldChange('empname', e.target.value.toUpperCase())}
                  placeholder="EMPLOYER NAME / BUSINESS"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['empname'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Employer Name / Business</div>
            </div>

            {/* Designation */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Designation <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('empdesignation')}
                  onChange={(e) => onFieldChange('empdesignation', e.target.value.toUpperCase())}
                  placeholder="DESIGNATION"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['empdesignation'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Designation</div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Address <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('empaddress')}
                  onChange={(e) => onFieldChange('empaddress', e.target.value.toUpperCase())}
                  placeholder="OFFICE / BUSINESS ADDRESS"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['empaddress'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Address</div>
            </div>

            {/* Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Phone
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('empphone')}
                  onChange={(e) => onFieldChange('empphone', e.target.value)}
                  placeholder="PHONE NO"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderSourceBadge(fields['empphone'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Phone no</div>
            </div>

            {/* Past Occupation */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Past Occupation, if any
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('previous_occupation')}
                  onChange={(e) => onFieldChange('previous_occupation', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                >
                  <option value="">Select Occupation</option>
                  {PORTAL_OCCUPATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {renderSourceBadge(fields['previous_occupation'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Past Occupation, if any</div>
            </div>

            {/* Military/Security Service */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#faf5fa] py-2 rounded">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2 text-[11px]">
                Are/were you in a Military/Semi-Military/Police/Security Organization?
              </label>
              <div className="sm:col-span-5 flex items-center gap-4">
                <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="military_radio"
                    checked={hasMilitaryService}
                    onChange={() => onFieldChange('prev_org', 'Yes')}
                    className="text-purple-600"
                  />
                  Yes
                </label>
                <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="military_radio"
                    checked={!hasMilitaryService}
                    onChange={() => onFieldChange('prev_org', 'No')}
                    className="text-purple-600"
                  />
                  No
                </label>
                {renderSourceBadge(fields['prev_org'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">If yes, give details</div>
            </div>

            {/* Military Sub-fields */}
            {hasMilitaryService && (
              <div className="bg-[#f3e8f3] border border-[#d8c0d8] rounded p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">Organization *</label>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={getVal('previous_organization')}
                      onChange={(e) => onFieldChange('previous_organization', e.target.value.toUpperCase())}
                      placeholder="ORGANIZATION NAME"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">Designation *</label>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={getVal('previous_designation')}
                      onChange={(e) => onFieldChange('previous_designation', e.target.value.toUpperCase())}
                      placeholder="DESIGNATION"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">Rank *</label>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={getVal('previous_rank')}
                      onChange={(e) => onFieldChange('previous_rank', e.target.value.toUpperCase())}
                      placeholder="RANK"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">Place of Posting *</label>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={getVal('previous_posting')}
                      onChange={(e) => onFieldChange('previous_posting', e.target.value.toUpperCase())}
                      placeholder="PLACE OF POSTING"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
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

        {/* Bottom Action Buttons (Images 3 & 4 faithful) */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onPreviousPage && (
            <button
              type="button"
              onClick={onPreviousPage}
              className="bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2 rounded shadow-xs transition-colors cursor-pointer"
            >
              ← Back to Basic Details
            </button>
          )}

          <button
            type="button"
            onClick={onSaveAndContinue}
            className="bg-[#e06743] hover:bg-[#d45632] text-white font-semibold text-xs px-6 py-2 rounded shadow-xs transition-colors cursor-pointer"
          >
            Save and Continue
          </button>

          <button
            type="button"
            onClick={onSaveTemporarily}
            className="bg-[#e06743] hover:bg-[#d45632] text-white font-semibold text-xs px-5 py-2 rounded shadow-xs transition-colors cursor-pointer"
          >
            Save and Temporarily Exit
          </button>
        </div>
      </div>
    </div>
  )
}
