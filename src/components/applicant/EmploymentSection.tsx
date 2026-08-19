import React from 'react'
import type { ApplicantProfile, EmploymentDetails } from '../../core/applicant/types'

export interface EmploymentSectionProps {
  data: ApplicantProfile
  onChange: (updated: ApplicantProfile) => void
}

export const EmploymentSection: React.FC<EmploymentSectionProps> = ({ data, onChange }) => {
  const emp = data.employment || {}

  const update = (fields: Partial<EmploymentDetails>) => {
    onChange({
      ...data,
      employment: { ...emp, ...fields },
    })
  }

  const employerAddressStr = typeof emp.employerAddress === 'string' ? emp.employerAddress : ''

  return (
    <div className="space-y-2 text-left">
      <h3 className="font-bold text-xs uppercase text-slate-500">G. Employment & Occupation</h3>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Present Occupation</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={emp.presentOccupation}
            onChange={(e) => update({ presentOccupation: e.target.value })}
            placeholder="e.g. Software Engineer / Business"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Designation / Rank</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={emp.designationRank || ''}
            onChange={(e) => update({ designationRank: e.target.value })}
            placeholder="e.g. Senior Developer"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-semibold mb-0.5">Employer / Organization Name</label>
        <input
          type="text"
          className="w-full p-1.5 rounded border text-xs bg-white"
          value={emp.employerName || ''}
          onChange={(e) => update({ employerName: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold mb-0.5">Employer Address</label>
        <input
          type="text"
          className="w-full p-1.5 rounded border text-xs bg-white"
          value={employerAddressStr}
          onChange={(e) => update({ employerAddress: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold mb-0.5">Employer Phone</label>
        <input
          type="text"
          className="w-full p-1.5 rounded border text-xs bg-white"
          value={emp.employerPhone || ''}
          onChange={(e) => update({ employerPhone: e.target.value })}
        />
      </div>
    </div>
  )
}
