import React from 'react'
import type { ApplicantProfile, ReferenceDetails } from '../../core/applicant/types'

export interface ReferenceSectionProps {
  data: ApplicantProfile
  onChange: (updated: ApplicantProfile) => void
}

export const ReferenceSection: React.FC<ReferenceSectionProps> = ({ data, onChange }) => {
  const ref = data.reference || {
    name: '',
    address: '',
    phone: '',
    email: '',
  }

  const update = (fields: Partial<ReferenceDetails>) => {
    onChange({
      ...data,
      reference: {
        name: ref.name || '',
        address: typeof ref.address === 'string' ? ref.address : '',
        phone: ref.phone || '',
        email: ref.email || '',
        ...fields,
      },
    })
  }

  const addressStr = typeof ref.address === 'string' ? ref.address : ''

  return (
    <div className="space-y-2 text-left">
      <h3 className="font-bold text-xs uppercase text-slate-500">J. Reference Contact</h3>

      <div>
        <label className="block text-[10px] font-semibold mb-0.5">Reference Name</label>
        <input
          type="text"
          className="w-full p-1.5 rounded border text-xs bg-white"
          value={ref.name || ''}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Contact person or relative in destination country"
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold mb-0.5">Reference Address</label>
        <input
          type="text"
          className="w-full p-1.5 rounded border text-xs bg-white"
          value={addressStr}
          onChange={(e) => update({ address: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Reference Phone</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={ref.phone || ''}
            onChange={(e) => update({ phone: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Reference Email</label>
          <input
            type="email"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={ref.email || ''}
            onChange={(e) => update({ email: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
