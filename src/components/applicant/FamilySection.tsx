import React from 'react'
import type { ApplicantProfile, FamilyMember } from '../../core/applicant/types'

export interface FamilySectionProps {
  data: ApplicantProfile
  onChange: (updated: ApplicantProfile) => void
}

export const FamilySection: React.FC<FamilySectionProps> = ({ data, onChange }) => {
  const family = data.family

  const updateMember = (relation: 'father' | 'mother' | 'spouse', fields: Partial<FamilyMember>) => {
    const currentMember = family[relation] || {}
    onChange({
      ...data,
      family: {
        ...family,
        [relation]: { ...currentMember, ...fields },
      },
    })
  }

  return (
    <div className="space-y-3 text-left">
      <h3 className="font-bold text-xs uppercase text-slate-500">F. Family Information</h3>

      {/* Father */}
      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
        <span className="font-bold text-[11px] text-slate-700 block">Father's Information</span>
        <div>
          <label className="block text-[9px] font-semibold mb-0.5">Full Name</label>
          <input
            type="text"
            className="w-full p-1 rounded border text-xs bg-white"
            value={family.father?.name || ''}
            onChange={(e) => updateMember('father', { name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="block text-[9px] font-semibold mb-0.5">Nationality</label>
            <input
              type="text"
              className="w-full p-1 rounded border text-xs bg-white"
              value={family.father?.nationality || ''}
              onChange={(e) => updateMember('father', { nationality: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[9px] font-semibold mb-0.5">Country of Birth</label>
            <input
              type="text"
              className="w-full p-1 rounded border text-xs bg-white"
              value={family.father?.countryOfBirth || ''}
              onChange={(e) => updateMember('father', { countryOfBirth: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Mother */}
      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
        <span className="font-bold text-[11px] text-slate-700 block">Mother's Information</span>
        <div>
          <label className="block text-[9px] font-semibold mb-0.5">Full Name</label>
          <input
            type="text"
            className="w-full p-1 rounded border text-xs bg-white"
            value={family.mother?.name || ''}
            onChange={(e) => updateMember('mother', { name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="block text-[9px] font-semibold mb-0.5">Nationality</label>
            <input
              type="text"
              className="w-full p-1 rounded border text-xs bg-white"
              value={family.mother?.nationality || ''}
              onChange={(e) => updateMember('mother', { nationality: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[9px] font-semibold mb-0.5">Country of Birth</label>
            <input
              type="text"
              className="w-full p-1 rounded border text-xs bg-white"
              value={family.mother?.countryOfBirth || ''}
              onChange={(e) => updateMember('mother', { countryOfBirth: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Spouse */}
      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
        <span className="font-bold text-[11px] text-slate-700 block">Spouse's Information (If Applicable)</span>
        <div>
          <label className="block text-[9px] font-semibold mb-0.5">Full Name</label>
          <input
            type="text"
            className="w-full p-1 rounded border text-xs bg-white"
            value={family.spouse?.name || ''}
            onChange={(e) => updateMember('spouse', { name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="block text-[9px] font-semibold mb-0.5">Nationality</label>
            <input
              type="text"
              className="w-full p-1 rounded border text-xs bg-white"
              value={family.spouse?.nationality || ''}
              onChange={(e) => updateMember('spouse', { nationality: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[9px] font-semibold mb-0.5">Country of Birth</label>
            <input
              type="text"
              className="w-full p-1 rounded border text-xs bg-white"
              value={family.spouse?.countryOfBirth || ''}
              onChange={(e) => updateMember('spouse', { countryOfBirth: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
