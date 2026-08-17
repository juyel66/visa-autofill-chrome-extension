import React from 'react'
import type { ApplicantProfile, Gender, NationalityAcquiredBy } from '../../core/applicant/types'

export interface PersonalInformationSectionProps {
  data: ApplicantProfile
  onChange: (updated: ApplicantProfile) => void
  getFieldError: (fieldKey: string) => string | undefined
}

export const PersonalInformationSection: React.FC<PersonalInformationSectionProps> = ({
  data,
  onChange,
  getFieldError,
}) => {
  const p = data.personalInfo

  const update = (fields: Partial<typeof p>) => {
    onChange({
      ...data,
      personalInfo: { ...p, ...fields },
    })
  }

  return (
    <div className="space-y-2">
      <h3 className="font-bold text-xs uppercase text-slate-500">A. Personal Information</h3>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Surname / Family Name</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={p.surname}
            onChange={(e) => update({ surname: e.target.value })}
            placeholder="e.g. Smith"
          />
          {getFieldError('personalInfo.surname') && (
            <p className="text-[10px] text-red-600 mt-0.5">{getFieldError('personalInfo.surname')}</p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Given Name(s)</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={p.givenNames}
            onChange={(e) => update({ givenNames: e.target.value })}
            placeholder="e.g. John David"
          />
          {getFieldError('personalInfo.givenNames') && (
            <p className="text-[10px] text-red-600 mt-0.5">{getFieldError('personalInfo.givenNames')}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Previous / Alias Name</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={p.previousName || ''}
            onChange={(e) => update({ previousName: e.target.value })}
            placeholder="e.g. Maiden name"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Date of Birth</label>
          <input
            type="date"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={p.dateOfBirth}
            onChange={(e) => update({ dateOfBirth: e.target.value })}
          />
          {getFieldError('personalInfo.dateOfBirth') && (
            <p className="text-[10px] text-red-600 mt-0.5">{getFieldError('personalInfo.dateOfBirth')}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Town/City of Birth</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={p.townCityOfBirth}
            onChange={(e) => update({ townCityOfBirth: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Country of Birth</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={p.countryOfBirth}
            onChange={(e) => update({ countryOfBirth: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Gender</label>
          <select
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={p.gender}
            onChange={(e) => update({ gender: e.target.value as Gender })}
          >
            <option value="unspecified">Unspecified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Nationality</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={p.nationality}
            onChange={(e) => update({ nationality: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Nationality Acquired By</label>
          <select
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={p.nationalityAcquiredBy}
            onChange={(e) => update({ nationalityAcquiredBy: e.target.value as NationalityAcquiredBy })}
          >
            <option value="unspecified">Unspecified</option>
            <option value="birth">By Birth</option>
            <option value="naturalization">By Naturalization</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Previous Nationality</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={p.previousNationality || ''}
            onChange={(e) => update({ previousNationality: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">National ID Number</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={p.nationalIdNumber || ''}
            onChange={(e) => update({ nationalIdNumber: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Religion</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={p.religion || ''}
            onChange={(e) => update({ religion: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-semibold mb-0.5">Visible Identification Marks</label>
        <input
          type="text"
          className="w-full p-1.5 rounded border text-xs bg-white"
          value={p.visibleIdentificationMarks || ''}
          onChange={(e) => update({ visibleIdentificationMarks: e.target.value })}
          placeholder="e.g. Mole on left cheek or None"
        />
      </div>
    </div>
  )
}
