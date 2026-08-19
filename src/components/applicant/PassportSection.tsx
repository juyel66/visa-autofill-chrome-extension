import React from 'react'
import type { ApplicantProfile } from '../../core/applicant/types'

export interface PassportSectionProps {
  data: ApplicantProfile
  onChange: (updated: ApplicantProfile) => void
  getFieldError: (fieldKey: string) => string | undefined
}

export const PassportSection: React.FC<PassportSectionProps> = ({
  data,
  onChange,
  getFieldError,
}) => {
  const pass = data.passport || {}

  const update = (fields: Partial<NonNullable<ApplicantProfile['passport']>>) => {
    onChange({
      ...data,
      passport: { ...pass, ...fields },
    })
  }

  return (
    <div className="space-y-2">
      <h3 className="font-bold text-xs uppercase text-slate-500">B. Passport Information</h3>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Passport Number</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={pass.passportNumber}
            onChange={(e) => update({ passportNumber: e.target.value })}
            placeholder="e.g. A12345678"
          />
          {getFieldError('passport.passportNumber') && (
            <p className="text-[10px] text-red-600 mt-0.5">{getFieldError('passport.passportNumber')}</p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Passport Type</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={pass.passportType}
            onChange={(e) => update({ passportType: e.target.value })}
            placeholder="Ordinary / Official / Diplomatic"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Issuing Country</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={pass.issuingCountry}
            onChange={(e) => update({ issuingCountry: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Place of Issue</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={pass.placeOfIssue}
            onChange={(e) => update({ placeOfIssue: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Issue Date</label>
          <input
            type="date"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={pass.issueDate}
            onChange={(e) => update({ issueDate: e.target.value })}
          />
          {getFieldError('passport.issueDate') && (
            <p className="text-[10px] text-red-600 mt-0.5">{getFieldError('passport.issueDate')}</p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Expiry Date</label>
          <input
            type="date"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={pass.expiryDate}
            onChange={(e) => update({ expiryDate: e.target.value })}
          />
          {getFieldError('passport.expiryDate') && (
            <p className="text-[10px] text-red-600 mt-0.5">{getFieldError('passport.expiryDate')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
