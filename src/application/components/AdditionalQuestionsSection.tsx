import React from 'react'
import type { SavedApplication, ApplicationFieldValue } from '../../core/application/types'

export interface AdditionalQuestionsSectionProps {
  application: SavedApplication | null
  onFieldChange: (fieldKey: string, value: string | boolean) => void
  onResetField?: (fieldKey: string) => void
  renderSourceBadge?: (fieldValue?: ApplicationFieldValue) => React.ReactNode
  onSaveAndFinish?: () => void
  onSaveTemporarily?: () => void
  onPreviousPage?: () => void
}

export const AdditionalQuestionsSection: React.FC<AdditionalQuestionsSectionProps> = ({
  application,
  onFieldChange,
  renderSourceBadge,
  onSaveAndFinish,
  onSaveTemporarily,
  onPreviousPage,
}) => {
  const fields = application?.fields || {}

  const getVal = (key: string): string => {
    const val = fields[key]?.value
    if (typeof val === 'string') return val
    if (typeof val === 'boolean') return val ? 'true' : 'false'
    return ''
  }

  const tempAppId = application?.applicantId
    ? `APPL-${application.applicantId.substring(0, 8).toUpperCase()}`
    : '49A4A5365U5FX4B'

  const questions = [
    {
      num: 1,
      flagKey: 'question_1_flag',
      ansKey: 'answer_1',
      title: 'Have you ever been arrested/ prosecuted/ convicted by Court of Law of any country?',
    },
    {
      num: 2,
      flagKey: 'question_2_flag',
      ansKey: 'answer_2',
      title: 'Have you ever been refused entry / deported by any country including India?',
    },
    {
      num: 3,
      flagKey: 'question_3_flag',
      ansKey: 'answer_3',
      title: 'Have you ever been engaged in Human trafficking/ Drug trafficking/ Financial fraud?',
    },
    {
      num: 4,
      flagKey: 'question_4_flag',
      ansKey: 'answer_4',
      title: 'Have you ever been engaged in Cyber crime/ Terrorist activities/ Sabotage?',
    },
    {
      num: 5,
      flagKey: 'question_5_flag',
      ansKey: 'answer_5',
      title: 'Have you ever expressed views that justify or glorify terrorist violence?',
    },
    {
      num: 6,
      flagKey: 'question_6_flag',
      ansKey: 'answer_6',
      title: 'Have you sought asylum or refugee status in any country?',
    },
  ]

  const [declarationAccepted, setDeclarationAccepted] = React.useState<boolean>(true)

  return (
    <div className="w-full bg-[#f6f6f6] rounded-xl border border-[#d1d5db] shadow-md overflow-hidden text-[#222222] font-sans">
      {/* 1. Official Portal Header Banner */}
      <div className="relative bg-white border-b border-[#c8ccd0] px-4 py-3 flex items-center justify-between overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none bg-repeat"
          style={{
            backgroundImage: `radial-gradient(#1e3a8a 1.5px, transparent 1.5px)`,
            backgroundSize: '16px 16px',
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-[#1e3a8a] flex items-center justify-center bg-white shadow-sm flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-10 h-10 text-[#1e3a8a]">
              <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="4" fill="none" />
              <circle cx="50" cy="50" r="8" fill="currentColor" />
              {[...Array(24)].map((_, i) => (
                <line
                  key={i}
                  x1="50"
                  y1="50"
                  x2={50 + 42 * Math.cos((i * 15 * Math.PI) / 180)}
                  y2={50 + 42 * Math.sin((i * 15 * Math.PI) / 180)}
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-widest text-[#d97706] uppercase">भारत गणराज्य</span>
              <span className="text-xs font-semibold text-slate-500">|</span>
              <span className="text-xs font-bold tracking-wider text-[#1e3a8a] uppercase">REPUBLIC OF INDIA</span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#1e3a8a]">
              INDIAN VISA ONLINE
            </h1>
            <p className="text-[11px] font-semibold text-[#059669] -mt-0.5">Government of India</p>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end relative z-10">
          <div className="h-2 w-28 rounded-full bg-gradient-to-r from-[#ff9933] via-white to-[#138808] border border-slate-300 shadow-xs mb-1" />
          <span className="text-[10px] font-bold text-slate-600 tracking-wide uppercase">
            Official Portal Interface
          </span>
        </div>
      </div>

      {/* 2. Top Title Bar */}
      <div className="bg-[#b388b3] text-white px-4 py-1.5 flex items-center justify-between shadow-xs font-semibold text-sm">
        <span className="font-bold tracking-wide">Additional Questions Form</span>
        <span className="text-xs cursor-pointer hover:underline" title="Portal Page 5 of 5">🏠</span>
      </div>

      {/* 3. Top Info Bar */}
      <div className="bg-[#f0e6f0] border-b border-[#d8c0d8] px-4 py-2 text-xs text-[#333333]">
        <span className="text-[11px] font-semibold text-[#2b542c]">
          Temporary Application ID : <strong className="text-[#b91c1c] tracking-wider">{tempAppId}</strong>
        </span>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* ========================================================================= */}
        {/* SUBSECTION 1: Additional Questions (Security Questionnaire) */}
        {/* ========================================================================= */}
        <div id="sec-additionalQuestions" className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs scroll-mt-28">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            Additional Questions (Statutory Legal & Security Declarations)
          </div>

          <div className="p-4 space-y-3.5 text-xs">
            {questions.map((q) => {
              const flagVal = getVal(q.flagKey).toLowerCase()
              const isYes = flagVal === 'yes'
              return (
                <div key={q.num} className="border-b border-slate-100 pb-3 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">
                      {q.num}. {q.title}
                    </span>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                        <input
                          type="radio"
                          name={`q_${q.num}_radio`}
                          checked={isYes}
                          onChange={() => onFieldChange(q.flagKey, 'Yes')}
                          className="text-purple-600"
                        />
                        Yes
                      </label>
                      <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
                        <input
                          type="radio"
                          name={`q_${q.num}_radio`}
                          checked={!isYes}
                          onChange={() => onFieldChange(q.flagKey, 'No')}
                          className="text-purple-600"
                        />
                        No
                      </label>
                      {renderSourceBadge && renderSourceBadge(fields[q.flagKey])}
                    </div>
                  </div>

                  {isYes && (
                    <div className="pl-4">
                      <textarea
                        value={getVal(q.ansKey)}
                        onChange={(e) => onFieldChange(q.ansKey, e.target.value)}
                        rows={2}
                        placeholder={`Details for Question ${q.num}...`}
                        className="w-full bg-white border border-[#a0aec0] rounded px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#7c3aed]"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUBSECTION 2: Applicant Legal Declaration */}
        {/* ========================================================================= */}
        <div className="border border-[#c5a0c5] rounded-md overflow-hidden bg-white shadow-xs">
          <div className="bg-[#c5a0c5] text-white font-bold text-xs px-3 py-1.5 uppercase tracking-wide">
            Applicant Declaration
          </div>

          <div className="p-4 space-y-3 text-xs">
            <div className="bg-[#faf5fa] p-3 rounded border border-[#e8d5e8] text-slate-700 leading-relaxed text-[11px]">
              <p className="mb-2">
                I hereby declare that all the statements and particulars made in this application are true, correct and complete to the best of my knowledge and belief. I realize that should any statement be found false or incorrect, my visa will be liable to cancellation or I may be refused entry into India.
              </p>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900 pt-1 select-none">
                <input
                  type="checkbox"
                  checked={declarationAccepted}
                  onChange={(e) => setDeclarationAccepted(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                <span>I have read the declaration and I agree &bull; Information verified</span>
              </label>
            </div>
          </div>
        </div>

        {/* Mandatory Footnote */}
        <div className="text-[11px] text-slate-500 font-semibold italic">
          * Mandatory Fields
        </div>

        {/* Bottom Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onPreviousPage && (
            <button
              type="button"
              onClick={onPreviousPage}
              className="bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2 rounded shadow-xs transition-colors cursor-pointer"
            >
              ← Back to Visa Details
            </button>
          )}

          <button
            type="button"
            onClick={onSaveAndFinish}
            className="bg-[#e06743] hover:bg-[#d45632] text-white font-semibold text-xs px-6 py-2 rounded shadow-xs transition-colors cursor-pointer"
          >
            Save Application & Complete
          </button>

          <button
            type="button"
            onClick={onSaveTemporarily}
            className="bg-[#e06743] hover:bg-[#d45632] text-white font-semibold text-xs px-5 py-2 rounded shadow-xs transition-colors cursor-pointer"
          >
            Save and Temporarily Exit
          </button>
        </div>
      </div>
    </div>
  )
}
