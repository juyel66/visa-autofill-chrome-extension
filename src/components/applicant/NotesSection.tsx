import React from 'react'
import type { ApplicantProfile } from '../../core/applicant/types'

export interface NotesSectionProps {
  data: ApplicantProfile
  onChange: (updated: ApplicantProfile) => void
}

export const NotesSection: React.FC<NotesSectionProps> = ({ data, onChange }) => {
  return (
    <div className="space-y-2 text-left">
      <h3 className="font-bold text-xs uppercase text-slate-500">K. Internal Profile Notes</h3>

      <div>
        <label className="block text-[10px] font-semibold mb-0.5">Notes / Comments</label>
        <textarea
          rows={5}
          className="w-full p-2 rounded border text-xs bg-white resize-none"
          value={data.notes || ''}
          onChange={(e) => onChange({ ...data, notes: e.target.value })}
          placeholder="Internal notes for this applicant (e.g. Travel dates flexible, passport renewal pending)..."
        />
        <p className="text-[10px] text-slate-400 mt-1 italic">
          Internal notes are kept locally and are never automatically filled into visa forms.
        </p>
      </div>
    </div>
  )
}
