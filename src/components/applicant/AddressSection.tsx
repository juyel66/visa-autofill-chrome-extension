import React from 'react'
import type { ApplicantProfile } from '../../core/applicant/types'

export interface AddressSectionProps {
  data: ApplicantProfile
  onChange: (updated: ApplicantProfile) => void
  isPermanentSection?: boolean
}

export const AddressSection: React.FC<AddressSectionProps> = ({
  data,
  onChange,
  isPermanentSection = false,
}) => {
  const addr = (isPermanentSection ? data.permanentAddress : data.presentAddress) || {}

  const update = (fields: Partial<NonNullable<ApplicantProfile['presentAddress']>>) => {
    if (isPermanentSection) {
      onChange({
        ...data,
        permanentAddress: { ...(data.permanentAddress || {}), ...fields },
      })
    } else {
      const updatedPresent = { ...(data.presentAddress || {}), ...fields }
      const updatedPermanent = (data.permanentAddress || {}).sameAsPresentAddress
        ? { ...updatedPresent, sameAsPresentAddress: true }
        : (data.permanentAddress || {})

      onChange({
        ...data,
        presentAddress: updatedPresent,
        permanentAddress: updatedPermanent,
      })
    }
  }

  const handleCopyPresentToPermanent = () => {
    onChange({
      ...data,
      permanentAddress: {
        ...data.presentAddress,
        sameAsPresentAddress: true,
      },
    })
  }

  return (
    <div className="space-y-2 text-left">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-xs uppercase text-slate-500">
          {isPermanentSection ? 'D. Permanent Address' : 'C. Present Address'}
        </h3>
        {isPermanentSection && (
          <button
            type="button"
            onClick={handleCopyPresentToPermanent}
            className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200"
          >
            📋 Copy Present to Permanent
          </button>
        )}
      </div>

      <div>
        <label className="block text-[10px] font-semibold mb-0.5">Address Line 1</label>
        <input
          type="text"
          className="w-full p-1.5 rounded border text-xs bg-white"
          value={addr.addressLine1}
          onChange={(e) => update({ addressLine1: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold mb-0.5">Address Line 2</label>
        <input
          type="text"
          className="w-full p-1.5 rounded border text-xs bg-white"
          value={addr.addressLine2 || ''}
          onChange={(e) => update({ addressLine2: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Village/Town/City</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={addr.villageTownCity}
            onChange={(e) => update({ villageTownCity: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">State/Province</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={addr.stateProvince}
            onChange={(e) => update({ stateProvince: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Country</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={addr.country}
            onChange={(e) => update({ country: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold mb-0.5">Postal/ZIP Code</label>
          <input
            type="text"
            className="w-full p-1.5 rounded border text-xs bg-white"
            value={addr.postalCode}
            onChange={(e) => update({ postalCode: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
