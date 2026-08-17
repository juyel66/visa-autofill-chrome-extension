import React from 'react'
import type { AccommodationDetails, ApplicantProfile } from '../../core/applicant/types'

export interface AccommodationSectionProps {
  data: ApplicantProfile
  onChange: (updated: ApplicantProfile) => void
}

export const AccommodationSection: React.FC<AccommodationSectionProps> = ({ data, onChange }) => {
  const acc = data.accommodation || {
    placeHotelName: '',
    address: '',
    state: '',
    phone: '',
  }

  const update = (fields: Partial<AccommodationDetails>) => {
    onChange({
      ...data,
      accommodation: {
        placeHotelName: acc.placeHotelName || '',
        address: typeof acc.address === 'string' ? acc.address : '',
        state: acc.state || '',
        phone: acc.phone || '',
        ...fields,
      },
    })
  }

  const addressString = typeof acc.address === 'string' ? acc.address : ''

  return (
    <div className="space-y-2 text-left">
      <h3 className="font-bold text-xs uppercase text-slate-500">I. Accommodation Details</h3>

      <div>
        <label className="block text-[10px] font-semibold mb-0.5">Hotel / Place Name</label>
        <input
          type="text"
          className="w-full p-1.5 rounded border text-xs bg-white"
          value={acc.placeHotelName || ''}
          onChange={(e) => update({ placeHotelName: e.target.value })}
          placeholder="e.g. Grand Hotel"
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold mb-0.5">Hotel Address</label>
        <input
          type="text"
          className="w-full p-1.5 rounded border text-xs bg-white"
          value={addressString}
          onChange={(e) => update({ address: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">State / Province</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={acc.state || ''}
            onChange={(e) => update({ state: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Hotel Phone</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={acc.phone || ''}
            onChange={(e) => update({ phone: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
