import React from 'react'
import type { SavedApplication, ApplicationFieldValue } from '../../core/application/types'
import {
  PORTAL_PURPOSE_OF_VISIT_OPTIONS,
  PORTAL_PORT_OF_ENTRY_EXIT_OPTIONS,
  PORTAL_VISA_TYPE_OPTIONS,
  PORTAL_INDIAN_STATES_OPTIONS,
  getDistrictsForIndianState,
  getStateForIndianDistrict,
  ALL_INDIAN_DISTRICTS_OPTIONS,
} from '../../countries/india/options/registrationOptions'

export interface VisaDetailsSectionProps {
  application: SavedApplication | null
  onFieldChange: (fieldKey: string, value: string | boolean) => void
  onResetField?: (fieldKey: string) => void
  renderSourceBadge?: (fieldValue?: ApplicationFieldValue) => React.ReactNode
  onUploadPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemovePhoto: () => void
  onSaveAndContinue?: () => void
  onSaveTemporarily?: () => void
  onPreviousPage?: () => void
}

export const VisaDetailsSection: React.FC<VisaDetailsSectionProps> = ({
  application,
  onFieldChange,
  renderSourceBadge,
  onUploadPhoto,
  onRemovePhoto,
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
    : '32XAAA2XFBGQENP'

  // Default flags to 'No' unless explicitly 'Yes'
  const oldVisaFlagVal = getVal('old_visa_flag')
  const hasVisitedIndiaBefore = oldVisaFlagVal.toLowerCase() === 'yes'

  const refuseFlagVal = getVal('refuse_flag')
  const hasPermissionRefused = refuseFlagVal.toLowerCase() === 'yes'

  const saarcFlagVal = getVal('saarc_flag')
  const hasVisitedSaarc = saarcFlagVal.toLowerCase() === 'yes'

  const visaType = getVal('visa_type') || 'BUSINESS VISA'

  const currentStateVal = getVal('stateofsponsor_ind')
  const currentDistrictVal = getVal('districtofsponsor_ind')

  const currentDistrictOptions = React.useMemo(() => {
    if (!currentStateVal) {
      return ALL_INDIAN_DISTRICTS_OPTIONS
    }
    const stateList = getDistrictsForIndianState(currentStateVal)
    return stateList.length > 0 ? stateList : ALL_INDIAN_DISTRICTS_OPTIONS
  }, [currentStateVal])

  const hasCurrentDistrictInOptions = React.useMemo(() => {
    if (!currentDistrictVal) return true
    return currentDistrictOptions.some(
      (d) => d.value.toUpperCase() === currentDistrictVal.trim().toUpperCase()
    )
  }, [currentDistrictOptions, currentDistrictVal])

  const handleStateChange = (newState: string) => {
    onFieldChange('stateofsponsor_ind', newState)
    if (newState && currentDistrictVal) {
      const newDistricts = getDistrictsForIndianState(newState)
      if (
        newDistricts.length > 0 &&
        !newDistricts.some((d) => d.value.toUpperCase() === currentDistrictVal.trim().toUpperCase())
      ) {
        onFieldChange('districtofsponsor_ind', '')
      }
    }
  }

  const handleDistrictChange = (newDistrict: string) => {
    const upper = newDistrict.toUpperCase()
    onFieldChange('districtofsponsor_ind', upper)
    if (!currentStateVal && upper) {
      const detectedState = getStateForIndianDistrict(upper)
      if (detectedState) {
        onFieldChange('stateofsponsor_ind', detectedState)
      }
    }
  }

  const renderBadge = (fieldVal?: ApplicationFieldValue) => {
    if (!renderSourceBadge) return null
    return renderSourceBadge(fieldVal)
  }

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

      {/* 2. Top Title Bar (Exact match to Screenshot 2) */}
      <div className="bg-[#b388b3] text-white px-4 py-1.5 flex items-center justify-between shadow-xs font-semibold text-sm">
        <span className="font-bold tracking-wide">Visa Details Form</span>
        <span className="text-xs cursor-pointer hover:underline" title="Portal Page 4 of 4">🏠</span>
      </div>

      {/* 3. Top Info Bar (Exact match to Screenshot 2) */}
      <div className="bg-[#f0e6f0] border-b border-[#d8c0d8] px-4 py-2 text-xs text-[#333333] space-y-1">
        <div className="text-[11px] font-semibold text-[#2b542c]">
          Please note down the Temporary Application ID :{' '}
          <strong className="text-[#b91c1c] tracking-wider">{tempAppId}</strong>
        </div>
        <p className="text-[10.5px] text-slate-600">
          Your Information will be saved if you click save button or continue to next page. If you exit without doing either of that, your information will be lost.
        </p>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* ========================================================================= */}
        {/* SECTION 1: Details of Visa Sought (Exact match to Screenshot 2) */}
        {/* ========================================================================= */}
        <div id="sec-visaDetails" className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs scroll-mt-28">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            Details of Visa Sought
          </div>

          <div className="p-4 space-y-3.5 text-xs">
            {/* Type of Visa */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Type of Visa <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  id="visa_type"
                  data-field-id="visa_type"
                  value={visaType}
                  onChange={(e) => onFieldChange('visa_type', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="">Select visa type</option>
                  {PORTAL_VISA_TYPE_OPTIONS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
                {renderBadge(fields['visa_type'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">visa type you are applying for</div>
            </div>

            {/* Name of Company in India / Street */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Name of the Company in India/Street <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  id="comp_name"
                  data-field-id="comp_name"
                  type="text"
                  value={getVal('comp_name')}
                  onChange={(e) => onFieldChange('comp_name', e.target.value.toUpperCase())}
                  placeholder="NAME OF THE COMPANY IN INDIA / STREET"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['comp_name'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-red-600 font-medium pl-1">Details required</div>
            </div>

            {/* Company Address */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Address <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  id="comp_address"
                  data-field-id="comp_address"
                  type="text"
                  value={getVal('comp_address')}
                  onChange={(e) => onFieldChange('comp_address', e.target.value.toUpperCase())}
                  placeholder="COMPANY ADDRESS IN INDIA"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['comp_address'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Address</div>
            </div>

            {/* Company Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Phone <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  id="comp_phone"
                  data-field-id="comp_phone"
                  type="text"
                  value={getVal('comp_phone')}
                  onChange={(e) => onFieldChange('comp_phone', e.target.value)}
                  placeholder="COMPANY PHONE NUMBER"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['comp_phone'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Phone</div>
            </div>

            {/* Company Email */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Email <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  id="comp_email"
                  data-field-id="comp_email"
                  type="email"
                  value={getVal('comp_email')}
                  onChange={(e) => onFieldChange('comp_email', e.target.value)}
                  placeholder="COMPANY EMAIL ADDRESS"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['comp_email'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Email</div>
            </div>

            {/* Duration of Visa (In Month ) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Duration of Visa (In Month ) <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  id="duration"
                  data-field-id="duration"
                  value={getVal('duration') !== '' ? getVal('duration') : '0'}
                  onChange={(e) => onFieldChange('duration', e.target.value)}
                  placeholder="0"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['duration'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Duration of Visa (In Month )</div>
            </div>

            {/* No. of Entries */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                No. of Entries <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  id="visa_entry_id"
                  data-field-id="visa_entry_id"
                  value={getVal('visa_entry_id') || 'SINGLE'}
                  onChange={(e) => onFieldChange('visa_entry_id', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="SINGLE">SINGLE</option>
                  <option value="DOUBLE">DOUBLE</option>
                  <option value="TRIPLE">TRIPLE</option>
                  <option value="MULTIPLE">MULTIPLE</option>
                </select>
                {renderBadge(fields['visa_entry_id'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">No of Entries</div>
            </div>

            {/* Purpose of Visit */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Purpose of Visit <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  id="purpose"
                  data-field-id="purpose"
                  value={
                    getVal('purpose') ||
                    'FOR ALL BUSINESS ACTIVITIES [OTHER THAN THOSE COVERED BY B-2, B-3 AND B-4 VISAS'
                  }
                  onChange={(e) => onFieldChange('purpose', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="">Select Purpose</option>
                  {PORTAL_PURPOSE_OF_VISIT_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {renderBadge(fields['purpose'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Purpose of visit</div>
            </div>

            {/* Expected Date of journey */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Expected Date of journey <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  id="journeydate"
                  data-field-id="journeydate"
                  type="text"
                  value={getVal('journeydate') || getVal('appl.journeydate') || '20/02/2027'}
                  onChange={(e) => {
                    onFieldChange('journeydate', e.target.value)
                    onFieldChange('appl.journeydate', e.target.value)
                  }}
                  placeholder="DD/MM/YYYY"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['journeydate'] || fields['appl.journeydate'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">(Visa validity will start from the Visa Issue Date)</div>
            </div>

            {/* Port of Arrival in India */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Port of Arrival in India <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  id="entrypoint"
                  data-field-id="entrypoint"
                  value={(() => {
                    const raw = getVal('entrypoint') || 'HARIDASPUR'
                    const opt = PORTAL_PORT_OF_ENTRY_EXIT_OPTIONS.find(
                      (p) => p.value === raw || p.value.toUpperCase() === raw.toUpperCase() || p.label.toUpperCase() === raw.toUpperCase()
                    )
                    return opt ? opt.value : raw
                  })()}
                  onChange={(e) => {
                    const val = e.target.value
                    const prevVal = getVal('entrypoint')
                    onFieldChange('entrypoint', val)
                    onFieldChange('appl.entrypoint', val)
                    if (!getVal('exitpoint') || getVal('exitpoint') === prevVal) {
                      onFieldChange('exitpoint', val)
                      onFieldChange('appl.exitpoint', val)
                    }
                  }}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="">Select entry point</option>
                  {PORTAL_PORT_OF_ENTRY_EXIT_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {renderBadge(fields['entrypoint'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Port of arrival in India</div>
            </div>

            {/* Expected Port of Exit from India */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Expected Port of Exit from India <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  id="exitpoint"
                  data-field-id="exitpoint"
                  value={(() => {
                    const raw = getVal('exitpoint') || getVal('entrypoint') || 'HARIDASPUR'
                    const opt = PORTAL_PORT_OF_ENTRY_EXIT_OPTIONS.find(
                      (p) => p.value === raw || p.value.toUpperCase() === raw.toUpperCase() || p.label.toUpperCase() === raw.toUpperCase()
                    )
                    return opt ? opt.value : raw
                  })()}
                  onChange={(e) => {
                    onFieldChange('exitpoint', e.target.value)
                    onFieldChange('appl.exitpoint', e.target.value)
                  }}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="">Select exit point</option>
                  {PORTAL_PORT_OF_ENTRY_EXIT_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {renderBadge(fields['exitpoint'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Expected Port of Exit from India</div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: Previous Visa/Currently valid Visa Details (Exact match to Screenshot 3) */}
        {/* ========================================================================= */}
        <div id="sec-previousVisitVisa" className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs scroll-mt-28">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            Previous Visa/Currently valid Visa Details
          </div>

          <div className="p-4 space-y-3.5 text-xs">
            {/* Have you ever visited India before? (Default No) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#faf5fa] py-2 rounded" data-field-id="old_visa_flag">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Have you ever visited India before? <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-4">
                <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="old_visa_flag"
                    checked={hasVisitedIndiaBefore}
                    onChange={() => onFieldChange('old_visa_flag', 'Yes')}
                    className="text-purple-600"
                  />
                  Yes
                </label>
                <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="old_visa_flag"
                    checked={!hasVisitedIndiaBefore}
                    onChange={() => onFieldChange('old_visa_flag', 'No')}
                    className="text-purple-600"
                  />
                  / No
                </label>
                {renderBadge(fields['old_visa_flag'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">If yes,give details</div>
            </div>

            {/* Conditionally expanded Previous Visit Fields (When Yes) */}
            {hasVisitedIndiaBefore && (
              <div className="bg-[#f9f2f9] border border-[#d8c0d8] rounded p-3.5 space-y-3">
                {/* Address (3 Lines) */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2 pt-1">
                    Address <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="sm:col-span-5 space-y-1.5">
                    <input
                      id="prv_visit_add1"
                      data-field-id="prv_visit_add1"
                      type="text"
                      value={getVal('prv_visit_add1')}
                      onChange={(e) => onFieldChange('prv_visit_add1', e.target.value.toUpperCase())}
                      placeholder="ENTER ADDRESS LINE 1 OF STAY"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                    <input
                      id="prv_visit_add2"
                      data-field-id="prv_visit_add2"
                      type="text"
                      value={getVal('prv_visit_add2')}
                      onChange={(e) => onFieldChange('prv_visit_add2', e.target.value.toUpperCase())}
                      placeholder="ENTER ADDRESS LINE 2 OF STAY"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                    <input
                      id="prv_visit_add3"
                      data-field-id="prv_visit_add3"
                      type="text"
                      value={getVal('prv_visit_add3')}
                      onChange={(e) => onFieldChange('prv_visit_add3', e.target.value.toUpperCase())}
                      placeholder="ENTER ADDRESS LINE 3 OF STAY"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1 pt-1">
                    Enter the address of stay during your last visit
                  </div>
                </div>

                {/* Cities previously visited in India */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2 pt-1">
                    Cities previously visited in India <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="sm:col-span-5">
                    <textarea
                      rows={2}
                      id="cities_visited"
                      data-field-id="cities_visited"
                      value={getVal('cities_visited')}
                      onChange={(e) => onFieldChange('cities_visited', e.target.value.toUpperCase())}
                      placeholder="KOLKATA, DELHI, CHENNAI"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1 pt-1">
                    Cities in India visited (comma separated)
                  </div>
                </div>

                {/* Last Indian Visa No */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                    Last Indian Visa No/Currently valid Indian Visa No. <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      id="old_visa_no"
                      data-field-id="old_visa_no"
                      value={getVal('old_visa_no')}
                      onChange={(e) => onFieldChange('old_visa_no', e.target.value.toUpperCase())}
                      placeholder="VISA NUMBER"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs font-semibold"
                    />
                  </div>
                  <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">
                    Last Indian Visa no / Currently valid Visa no
                  </div>
                </div>

                {/* Type of Visa */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                    Type of Visa <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="sm:col-span-5">
                    <select
                      id="old_visa_type_id"
                      data-field-id="old_visa_type_id"
                      value={getVal('old_visa_type_id')}
                      onChange={(e) => onFieldChange('old_visa_type_id', e.target.value)}
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    >
                      <option value="">Select visa type</option>
                      {PORTAL_VISA_TYPE_OPTIONS.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Type of Visa</div>
                </div>

                {/* Place of Issue */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                    Place of Issue <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="sm:col-span-5">
                    <input
                      id="oldvisaissueplace"
                      data-field-id="oldvisaissueplace"
                      type="text"
                      value={getVal('oldvisaissueplace')}
                      onChange={(e) => onFieldChange('oldvisaissueplace', e.target.value.toUpperCase())}
                      placeholder="DHAKA / RAJSHAHI"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Place of Issue</div>
                </div>

                {/* Date of Issue */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                    Date of Issue <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="sm:col-span-5">
                    <input
                      id="oldvisaissuedate"
                      data-field-id="oldvisaissuedate"
                      type="text"
                      value={getVal('oldvisaissuedate')}
                      onChange={(e) => onFieldChange('oldvisaissuedate', e.target.value)}
                      placeholder="DD/MM/YYYY"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Date of Issue in (DD/MM/YYYY) format</div>
                </div>
              </div>
            )}

            {/* Has permission to visit or to extend stay in India previously been refused? (Default No) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#faf5fa] py-2 rounded" data-field-id="refuse_flag">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Has permission to visit or to extend stay in India previously been refused?
              </label>
              <div className="sm:col-span-5 flex items-center gap-4">
                <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="refuse_flag"
                    checked={hasPermissionRefused}
                    onChange={() => {
                      onFieldChange('refuse_flag', 'Yes')
                      onFieldChange('appl.refuse_flag', 'Yes')
                    }}
                    className="text-purple-600"
                  />
                  Yes
                </label>
                <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="refuse_flag"
                    checked={!hasPermissionRefused}
                    onChange={() => {
                      onFieldChange('refuse_flag', 'No')
                      onFieldChange('appl.refuse_flag', 'No')
                    }}
                    className="text-purple-600"
                  />
                  / No
                </label>
                {renderBadge(fields['refuse_flag'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Refuse Details Yes /No</div>
            </div>

            {/* Conditionally expanded refusal details */}
            {hasPermissionRefused && (
              <div className="bg-[#fdf2f2] border border-[#fca5a5] rounded p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2 pt-1">
                    If so, when and by whom (Mention Control No. and date also) <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="sm:col-span-5">
                    <textarea
                      rows={2}
                      id="refuse_details"
                      data-field-id="refuse_details"
                      value={getVal('refuse_details')}
                      onChange={(e) => onFieldChange('refuse_details', e.target.value.toUpperCase())}
                      placeholder="DETAILS OF REFUSAL, CONTROL NO AND DATE"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1 pt-1">
                    If so, when and by whom (mention Control no and date)
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: Other Information (Exact match to Screenshot 4) */}
        {/* ========================================================================= */}
        <div className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            Other Information
          </div>

          <div className="p-4 space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2 pt-1">
                Countries Visited in Last 10 years
              </label>
              <div className="sm:col-span-5 flex items-start gap-1.5">
                <textarea
                  id="country_visited"
                  data-field-id="country_visited"
                  rows={2}
                  value={getVal('country_visited') || 'NA'}
                  onChange={(e) => onFieldChange('country_visited', e.target.value.toUpperCase())}
                  placeholder="NA or comma separated countries"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['country_visited'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1 pt-1">Countries Visited in Last 10 years</div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 4: SAARC Country Visit Details (Exact match to Screenshot 4) */}
        {/* ========================================================================= */}
        <div className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            SAARC Country Visit Details
          </div>

          <div className="p-4 space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#faf5fa] py-2 rounded" data-field-id="saarc_flag">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2 text-[11px]">
                Have you visited SAARC countries (except your own country) during last 3 years?
              </label>
              <div className="sm:col-span-5 flex items-center gap-4">
                <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="saarc_flag"
                    checked={hasVisitedSaarc}
                    onChange={() => onFieldChange('saarc_flag', 'Yes')}
                    className="text-purple-600"
                  />
                  Yes
                </label>
                <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="saarc_flag"
                    checked={!hasVisitedSaarc}
                    onChange={() => onFieldChange('saarc_flag', 'No')}
                    className="text-purple-600"
                  />
                  / No
                </label>
                {renderBadge(fields['saarc_flag'])}
              </div>
              <div className="sm:col-span-3 text-[10px] text-slate-500 pl-1 leading-tight">
                Have you visited "South Asian Association for Regional Cooperation" (SAARC) countries (except your own country) during last 3 years? Yes /No
              </div>
            </div>

            {hasVisitedSaarc && (
              <div className="bg-[#f9f2f9] border border-[#d8c0d8] rounded p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2 pt-1">
                    Details of SAARC Countries Visited <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="sm:col-span-5">
                    <textarea
                      rows={2}
                      id="saarc_details"
                      data-field-id="saarc_details"
                      value={getVal('saarc_details')}
                      onChange={(e) => onFieldChange('saarc_details', e.target.value.toUpperCase())}
                      placeholder="NAME OF SAARC COUNTRY, YEAR, NO OF VISITS"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1 pt-1">
                    Country, year, and visits details
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 5: Reference (Exact match to Screenshot 4) */}
        {/* ========================================================================= */}
        <div className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            Reference
          </div>

          <div className="p-4 space-y-4 text-xs">
            {/* Reference Name in India */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Reference Name in India <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  id="nameofsponsor_ind"
                  data-field-id="nameofsponsor_ind"
                  type="text"
                  value={getVal('nameofsponsor_ind')}
                  onChange={(e) => onFieldChange('nameofsponsor_ind', e.target.value.toUpperCase())}
                  placeholder="REFERENCE NAME IN INDIA"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['nameofsponsor_ind'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Reference Name in India</div>
            </div>

            {/* Address in India */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Address <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  id="add1ofsponsor_ind"
                  data-field-id="add1ofsponsor_ind"
                  type="text"
                  value={getVal('add1ofsponsor_ind')}
                  onChange={(e) => onFieldChange('add1ofsponsor_ind', e.target.value.toUpperCase())}
                  placeholder="ADDRESS IN INDIA"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['add1ofsponsor_ind'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Address</div>
            </div>

            {/* State in India */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                State <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  id="stateofsponsor_ind"
                  data-field-id="stateofsponsor_ind"
                  value={currentStateVal}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="">Select state</option>
                  {PORTAL_INDIAN_STATES_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {renderBadge(fields['stateofsponsor_ind'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Select state</div>
            </div>

            {/* District in India */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                District <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  id="districtofsponsor_ind"
                  data-field-id="districtofsponsor_ind"
                  value={currentDistrictVal}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="">Select District</option>
                  {currentDistrictVal && !hasCurrentDistrictInOptions && (
                    <option value={currentDistrictVal}>{currentDistrictVal}</option>
                  )}
                  {currentDistrictOptions.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                {renderBadge(fields['districtofsponsor_ind'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Select District</div>
            </div>

            {/* Phone in India */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Phone <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  id="phoneofsponsor_ind"
                  data-field-id="phoneofsponsor_ind"
                  type="text"
                  value={getVal('phoneofsponsor_ind')}
                  onChange={(e) => onFieldChange('phoneofsponsor_ind', e.target.value)}
                  placeholder="+915214587424"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['phoneofsponsor_ind'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Phone no</div>
            </div>

            {/* Reference Name in BANGLADESH */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center pt-2 border-t border-slate-200">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Reference Name in BANGLADESH <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  id="nameofsponsor_msn"
                  data-field-id="nameofsponsor_msn"
                  type="text"
                  value={getVal('nameofsponsor_msn')}
                  onChange={(e) => onFieldChange('nameofsponsor_msn', e.target.value.toUpperCase())}
                  placeholder="REFERENCE NAME IN BANGLADESH"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['nameofsponsor_msn'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Reference Name in BANGLADESH</div>
            </div>

            {/* Address in BANGLADESH */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Address <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  id="add1ofsponsor_msn"
                  data-field-id="add1ofsponsor_msn"
                  type="text"
                  value={getVal('add1ofsponsor_msn')}
                  onChange={(e) => onFieldChange('add1ofsponsor_msn', e.target.value.toUpperCase())}
                  placeholder="ADDRESS IN BANGLADESH"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['add1ofsponsor_msn'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Address</div>
            </div>

            {/* Phone in BANGLADESH */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                Phone <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  id="phoneofsponsor_msn"
                  data-field-id="phoneofsponsor_msn"
                  type="text"
                  value={getVal('phoneofsponsor_msn')}
                  onChange={(e) => onFieldChange('phoneofsponsor_msn', e.target.value)}
                  placeholder="01747498166"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['phoneofsponsor_msn'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Phone no</div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 6: Photograph Upload & Preview */}
        {/* ========================================================================= */}
        <div id="sec-photoUpload" data-field-id="applicant-photo" className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs scroll-mt-28">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            Applicant Photograph Management
          </div>

          <div className="p-4 space-y-4 text-xs">
            <p className="text-slate-600 text-xs">
              Attach the applicant photograph for workspace preview and validation. Portal file chooser interaction remains manual on the Indian Visa website.
            </p>

            {application?.photograph?.dataUrl ? (
              <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 p-4 rounded-lg border border-slate-300">
                <img
                  src={application.photograph.dataUrl}
                  alt="Applicant"
                  className="w-32 h-32 object-cover rounded-lg border-2 border-blue-500 shadow-md"
                />
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div><strong>File:</strong> {application.photograph.fileName || 'photo.jpg'}</div>
                  <div className="text-emerald-700 font-semibold">✓ 1:1 Square Photograph attached to Workspace</div>
                  <div className="flex items-center gap-3 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className="text-blue-600 hover:text-blue-800 text-xs font-semibold underline cursor-pointer"
                    >
                      🎯 Adjust in Left Photo Editor
                    </button>
                    <button
                      type="button"
                      onClick={onRemovePhoto}
                      className="text-rose-600 hover:text-rose-800 text-xs font-semibold underline cursor-pointer"
                    >
                      🗑️ Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center bg-slate-50">
                <input
                  type="file"
                  id="photo-upload-input"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onUploadPhoto}
                  className="hidden"
                />
                <label
                  htmlFor="photo-upload-input"
                  className="cursor-pointer inline-flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-4 py-2 rounded-md font-semibold text-xs transition-colors shadow-xs"
                >
                  📷 Choose Applicant Photo (JPEG / PNG)
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-[11px] text-slate-500 font-semibold italic">
          * Mandatory Fields
        </div>

        {/* Bottom Action Buttons (Exact match to Screenshots 3 & 4) */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onPreviousPage && (
            <button
              type="button"
              onClick={onPreviousPage}
              className="bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2 rounded shadow-xs transition-colors cursor-pointer"
            >
              ← Back to Family Details
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
