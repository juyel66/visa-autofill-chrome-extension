import React from 'react'
import type { SavedApplication, ApplicationFieldValue } from '../../core/application/types'
import {
  PORTAL_PURPOSE_OF_VISIT_OPTIONS,
  PORTAL_PORT_OF_ENTRY_EXIT_OPTIONS,
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
    : '4XA4AXX5YTV4RFB'

  const hasVisitedIndiaBefore = getVal('old_visa_flag').toLowerCase() === 'yes'

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

      {/* 2. Top Title Bar */}
      <div className="bg-[#b388b3] text-white px-4 py-1.5 flex items-center justify-between shadow-xs font-semibold text-sm">
        <span className="font-bold tracking-wide">Visa Details & References Form</span>
        <span className="text-xs cursor-pointer hover:underline" title="Portal Page 4 of 4">🏠</span>
      </div>

      {/* 3. Top Info Bar */}
      <div className="bg-[#f0e6f0] border-b border-[#d8c0d8] px-4 py-2 text-xs text-[#333333]">
        <span className="text-[11px] font-semibold text-[#2b542c]">
          Temporary Application ID : <strong className="text-[#b91c1c] tracking-wider">{tempAppId}</strong>
        </span>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* ========================================================================= */}
        {/* SUBSECTION 1: Visa Details & Travel Information */}
        {/* ========================================================================= */}
        <div id="sec-visaDetails" className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs scroll-mt-28">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            Visa Details & Travel Information
          </div>

          <div className="p-4 space-y-3.5 text-xs">
            {/* Visiting India for */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Visiting India for <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('purpose')}
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
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Purpose of Visit</div>
            </div>

            {/* Duration of Visa */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Duration of Visa (in Months) <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('duration') || '12'}
                  onChange={(e) => onFieldChange('duration', e.target.value)}
                  placeholder="DURATION (e.g. 12)"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['duration'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">in Months (e.g. 12)</div>
            </div>

            {/* No of Entries */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                No. of Entries <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('visa_entry_id') || 'Multiple'}
                  onChange={(e) => onFieldChange('visa_entry_id', e.target.value)}
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                >
                  <option value="Single">Single</option>
                  <option value="Double">Double</option>
                  <option value="Triple">Triple</option>
                  <option value="Multiple">Multiple</option>
                </select>
                {renderBadge(fields['visa_entry_id'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">No. of Entries</div>
            </div>

            {/* Expected Date of Journey */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Expected Date of Journey <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('journeydate') || getVal('appl.journeydate')}
                  onChange={(e) => {
                    onFieldChange('journeydate', e.target.value)
                    onFieldChange('appl.journeydate', e.target.value)
                  }}
                  placeholder="DD/MM/YYYY"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['journeydate'] || fields['appl.journeydate'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">in DD/MM/YYYY format</div>
            </div>

            {/* Port of Arrival */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Port of Arrival in India <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('entrypoint') || 'BY AIR/ HARIDASPUR'}
                  onChange={(e) => {
                    const val = e.target.value
                    onFieldChange('entrypoint', val)
                    onFieldChange('exitpoint', val)
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
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Port of Arrival</div>
            </div>

            {/* Port of Exit */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Expected Port of Exit from India <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <select
                  value={getVal('exitpoint') || getVal('entrypoint') || 'BY AIR/ HARIDASPUR'}
                  onChange={(e) => onFieldChange('exitpoint', e.target.value)}
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
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Port of Exit</div>
            </div>

            {/* Countries Visited */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Countries Visited in last 10 years
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('country_visited')}
                  onChange={(e) => onFieldChange('country_visited', e.target.value.toUpperCase())}
                  placeholder="e.g. INDIA, NEPAL, BHUTAN"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['country_visited'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Countries Visited</div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUBSECTION 2: References */}
        {/* ========================================================================= */}
        <div className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            References
          </div>

          <div className="p-4 space-y-4 text-xs">
            {/* Reference in India */}
            <div className="font-bold text-[#c2410c] text-xs border-b border-slate-200 pb-1">
              Reference Name in India
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Reference Name in India <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('nameofsponsor_ind')}
                  onChange={(e) => onFieldChange('nameofsponsor_ind', e.target.value.toUpperCase())}
                  placeholder="NAME OF HOTEL / SPONSOR / PERSON"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['nameofsponsor_ind'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Reference Name</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Address Line 1 <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('add1ofsponsor_ind')}
                  onChange={(e) => onFieldChange('add1ofsponsor_ind', e.target.value.toUpperCase())}
                  placeholder="ADDRESS IN INDIA"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['add1ofsponsor_ind'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Address in India</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Phone <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('phoneofsponsor_ind')}
                  onChange={(e) => onFieldChange('phoneofsponsor_ind', e.target.value)}
                  placeholder="PHONE NO IN INDIA"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['phoneofsponsor_ind'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Phone in India</div>
            </div>

            {/* Reference in Bangladesh / Home Country */}
            <div className="font-bold text-[#c2410c] text-xs border-b border-slate-200 pb-1 pt-3">
              Reference Name in Home Country (Bangladesh)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Reference Name in Home Country <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('nameofsponsor_msn')}
                  onChange={(e) => onFieldChange('nameofsponsor_msn', e.target.value.toUpperCase())}
                  placeholder="REFERENCE NAME IN BANGLADESH"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['nameofsponsor_msn'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Home Country Reference</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Address Line 1 <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('add1ofsponsor_msn')}
                  onChange={(e) => onFieldChange('add1ofsponsor_msn', e.target.value.toUpperCase())}
                  placeholder="ADDRESS IN BANGLADESH"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['add1ofsponsor_msn'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Address in Home Country</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Phone <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="sm:col-span-5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={getVal('phoneofsponsor_msn')}
                  onChange={(e) => onFieldChange('phoneofsponsor_msn', e.target.value)}
                  placeholder="PHONE NO IN BANGLADESH"
                  className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                />
                {renderBadge(fields['phoneofsponsor_msn'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Phone in Home Country</div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUBSECTION 3: Previous Visit / Visa Details */}
        {/* ========================================================================= */}
        <div id="sec-previousVisitVisa" className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs scroll-mt-28">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            Previous Visit / Visa Details
          </div>

          <div className="p-4 space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#faf5fa] py-2 rounded">
              <label className="sm:col-span-4 text-right sm:text-right font-medium text-slate-700 pr-2">
                Have you ever visited India before?
              </label>
              <div className="sm:col-span-5 flex items-center gap-4">
                <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="old_visa_radio"
                    checked={hasVisitedIndiaBefore}
                    onChange={() => onFieldChange('old_visa_flag', 'Yes')}
                    className="text-purple-600"
                  />
                  Yes
                </label>
                <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="old_visa_radio"
                    checked={!hasVisitedIndiaBefore}
                    onChange={() => onFieldChange('old_visa_flag', 'No')}
                    className="text-purple-600"
                  />
                  No
                </label>
                {renderBadge(fields['old_visa_flag'])}
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 pl-1">Prior Visit Disclosure</div>
            </div>

            {hasVisitedIndiaBefore && (
              <div className="bg-[#f3e8f3] border border-[#d8c0d8] rounded p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                    Address where stayed *
                  </label>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={getVal('prv_visit_add1')}
                      onChange={(e) => onFieldChange('prv_visit_add1', e.target.value.toUpperCase())}
                      placeholder="ADDRESS WHERE STAYED"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                    Previous Visa Number *
                  </label>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={getVal('old_visa_no')}
                      onChange={(e) => onFieldChange('old_visa_no', e.target.value.toUpperCase())}
                      placeholder="VISA NUMBER"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                    Type of Visa *
                  </label>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={getVal('old_visa_type_id')}
                      onChange={(e) => onFieldChange('old_visa_type_id', e.target.value.toUpperCase())}
                      placeholder="TOURIST / MEDICAL"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                    Place of Issue *
                  </label>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={getVal('oldvisaissueplace')}
                      onChange={(e) => onFieldChange('oldvisaissueplace', e.target.value.toUpperCase())}
                      placeholder="DHAKA / RAJSHAHI"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <label className="sm:col-span-4 text-right font-medium text-slate-700 pr-2">
                    Date of Issue *
                  </label>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={getVal('oldvisaissuedate')}
                      onChange={(e) => onFieldChange('oldvisaissuedate', e.target.value)}
                      placeholder="DD/MM/YYYY"
                      className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUBSECTION 4: Photograph Upload & Preview */}
        {/* ========================================================================= */}
        <div id="sec-photoUpload" className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs scroll-mt-28">
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
                  className="w-32 h-40 object-cover rounded border-2 border-slate-400 shadow-sm"
                />
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div><strong>File:</strong> {application.photograph.fileName || 'photo.jpg'}</div>
                  <div className="text-emerald-700 font-semibold">✓ Photograph attached to Workspace</div>
                  <button
                    type="button"
                    onClick={onRemovePhoto}
                    className="text-rose-600 hover:text-rose-800 text-xs font-semibold underline cursor-pointer pt-2 block"
                  >
                    🗑️ Remove Photograph
                  </button>
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

        {/* Bottom Action Buttons (Image 5 faithful) */}
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
