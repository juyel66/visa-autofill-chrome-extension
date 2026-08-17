import React from 'react'
import type { ApplicantProfile } from '../../core/applicant/types'

export interface ContactSectionProps {
  data: ApplicantProfile
  onChange: (updated: ApplicantProfile) => void
  getFieldError: (fieldKey: string) => string | undefined
}

export const ContactSection: React.FC<ContactSectionProps> = ({
  data,
  onChange,
  getFieldError,
}) => {
  const contact = data.contact

  const update = (fields: Partial<typeof contact>) => {
    onChange({
      ...data,
      contact: { ...contact, ...fields },
    })
  }

  return (
    <div className="space-y-2 text-left">
      <h3 className="font-bold text-xs uppercase text-slate-500">E. Contact Information</h3>
      
      <div>
        <label className="block text-[10px] font-semibold mb-0.5">Email Address</label>
        <input
          type="email"
          className="w-full p-1.5 rounded border text-xs bg-white"
          value={contact.email}
          onChange={(e) => update({ email: e.target.value })}
          placeholder="name@example.com"
        />
        {getFieldError('contact.email') && (
          <p className="text-[10px] text-red-600 mt-0.5">{getFieldError('contact.email')}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Mobile Phone</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={contact.mobile}
            onChange={(e) => update({ mobile: e.target.value })}
            placeholder="+1 555-0199"
          />
          {getFieldError('contact.mobile') && (
            <p className="text-[10px] text-red-600 mt-0.5">{getFieldError('contact.mobile')}</p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Landline / Alternate Phone</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={contact.phone || ''}
            onChange={(e) => update({ phone: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
