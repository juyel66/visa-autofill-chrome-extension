import React from 'react'
import type { ApplicantProfile, TravelDetails } from '../../core/applicant/types'

export interface TravelSectionProps {
  data: ApplicantProfile
  onChange: (updated: ApplicantProfile) => void
}

export const TravelSection: React.FC<TravelSectionProps> = ({ data, onChange }) => {
  const travel = data.travel || {
    purposeOfVisit: '',
    intendedArrivalDate: '',
    intendedDepartureDate: '',
  }

  const update = (fields: Partial<TravelDetails>) => {
    onChange({
      ...data,
      travel: {
        purposeOfVisit: travel.purposeOfVisit || '',
        intendedArrivalDate: travel.intendedArrivalDate || '',
        intendedDepartureDate: travel.intendedDepartureDate || '',
        ...fields,
      },
    })
  }

  return (
    <div className="space-y-2 text-left">
      <h3 className="font-bold text-xs uppercase text-slate-500">H. Travel Information</h3>

      <div>
        <label className="block text-[10px] font-semibold mb-0.5">Purpose of Visit</label>
        <input
          type="text"
          className="w-full p-1.5 rounded border text-xs bg-white"
          value={travel.purposeOfVisit || ''}
          onChange={(e) => update({ purposeOfVisit: e.target.value })}
          placeholder="e.g. Tourism / Business / Medical"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Intended Arrival Date</label>
          <input
            type="date"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={travel.intendedArrivalDate || ''}
            onChange={(e) => update({ intendedArrivalDate: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Intended Departure Date</label>
          <input
            type="date"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={travel.intendedDepartureDate || ''}
            onChange={(e) => update({ intendedDepartureDate: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
