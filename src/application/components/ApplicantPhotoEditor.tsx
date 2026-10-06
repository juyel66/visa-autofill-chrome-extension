import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { SavedApplication } from '../../core/application/types'
import {
  uploadApplicantPhoto,
  getApplicantPhoto,
  deleteApplicantPhoto,
  dataUrlToBlob,
} from '../../core/application/applicationApi'

export interface ApplicantPhotoEditorProps {
  applicationId?: string | null
  backendApplicationId?: string | null
  applicantId?: string
  applicantName?: string
  application?: SavedApplication | null
  onPhotoSaved?: (photoData: {
    dataUrl: string
    fileName: string
    fileSize: number
    width: number
    height: number
  }) => void
  onPhotoRemoved?: () => void
  onPhotoChanged?: (hasPhoto: boolean) => void
  onToast?: (message: string, type?: 'success' | 'error' | 'info') => void
}

type ResolutionPreset = 350 | 600

export const ApplicantPhotoEditor: React.FC<ApplicantPhotoEditorProps> = ({
  applicationId,
  backendApplicationId,
  applicantId,
  applicantName,
  application,
  onPhotoSaved,
  onPhotoRemoved,
  onPhotoChanged,
  onToast,
}) => {
  // Authoritative application ID from workspace state
  const effectiveAppId = (backendApplicationId || applicationId || application?.backendApplicationId || '').trim()

  // Photo URLs and state
  const [savedPhotoBlobUrl, setSavedPhotoBlobUrl] = useState<string | null>(null)
  const [sourceImage, setSourceImage] = useState<string | null>(null)
  const [originalFileName, setOriginalFileName] = useState<string>('applicant_photo.jpg')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFileSize, setPreviewFileSize] = useState<number>(0)

  // Editor modes & network status
  const [isCropping, setIsCropping] = useState<boolean>(false)
  const [isLoadingFromBackend, setIsLoadingFromBackend] = useState<boolean>(false)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [isRemoving, setIsRemoving] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Crop transformations
  const [zoom, setZoom] = useState<number>(1.0)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [rotation, setRotation] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Editor options
  const [showGuide, setShowGuide] = useState<boolean>(true)
  const [targetResolution, setTargetResolution] = useState<ResolutionPreset>(600)
  const [isExpanded, setIsExpanded] = useState<boolean>(false)

  // DOM & object URL tracking refs
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imageElementRef = useRef<HTMLImageElement | null>(null)
  const cropContainerRef = useRef<HTMLDivElement | null>(null)
  const naturalDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })
  const activeObjectUrlRef = useRef<string | null>(null)

  // Helper to safely replace active object URL with memory cleanup
  const updateSavedBlobUrl = useCallback((newUrl: string | null) => {
    if (activeObjectUrlRef.current && activeObjectUrlRef.current !== newUrl) {
      URL.revokeObjectURL(activeObjectUrlRef.current)
    }
    activeObjectUrlRef.current = newUrl
    setSavedPhotoBlobUrl(newUrl)
    setPreviewUrl(newUrl)
  }, [])

  // 1. Initial Load: Fetch existing saved photo from backend (GET /api/applications/:id/photo)
  useEffect(() => {
    let isCancelled = false

    async function fetchSavedPhoto() {
      if (!effectiveAppId) {
        // Fallback to in-memory draft photograph if present
        if (application?.photograph?.dataUrl) {
          setSourceImage(application.photograph.dataUrl)
          setPreviewUrl(application.photograph.dataUrl)
          setPreviewFileSize(application.photograph.fileSize || 0)
        }
        return
      }

      setIsLoadingFromBackend(true)
      setSaveError(null)

      try {
        const photoResult = await getApplicantPhoto(effectiveAppId)
        if (isCancelled) return

        if (photoResult && photoResult.blob) {
          const blobUrl = URL.createObjectURL(photoResult.blob)
          updateSavedBlobUrl(blobUrl)
          setPreviewFileSize(photoResult.blob.size)
          setIsCropping(false)
          onPhotoChanged?.(true)
        } else if (application?.photograph?.dataUrl) {
          // If backend had no photo but local draft has one
          setSourceImage(application.photograph.dataUrl)
          setPreviewUrl(application.photograph.dataUrl)
          setPreviewFileSize(application.photograph.fileSize || 0)
          setIsCropping(false)
        } else {
          updateSavedBlobUrl(null)
          setSourceImage(null)
          setPreviewUrl(null)
          setIsCropping(false)
          onPhotoChanged?.(false)
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('Backend photo retrieval warning:', err)
          if (err?.status === 403) {
            setSaveError('Permission denied: You do not have access to view this applicant photo.')
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingFromBackend(false)
        }
      }
    }

    fetchSavedPhoto()

    return () => {
      isCancelled = true
    }
  }, [effectiveAppId, updateSavedBlobUrl, application?.photograph?.dataUrl, onPhotoChanged])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (activeObjectUrlRef.current) {
        URL.revokeObjectURL(activeObjectUrlRef.current)
        activeObjectUrlRef.current = null
      }
    }
  }, [])

  // Canvas crop rendering
  const renderCroppedCanvas = useCallback(
    (outputSize: number = targetResolution): { dataUrl: string; blob: Blob; size: number } | null => {
      const img = imageElementRef.current
      const container = cropContainerRef.current
      if (!img || !container || !sourceImage) return null

      const canvas = document.createElement('canvas')
      canvas.width = outputSize
      canvas.height = outputSize
      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      // Fill white background (Indian visa requirement: plain white/off-white)
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, outputSize, outputSize)

      // Container viewport box
      const containerRect = container.getBoundingClientRect()
      const boxSize = Math.min(containerRect.width, containerRect.height) || 260
      const scaleMultiplier = outputSize / boxSize

      ctx.save()
      ctx.translate(outputSize / 2, outputSize / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.translate(pan.x * scaleMultiplier, pan.y * scaleMultiplier)

      const naturalW = naturalDimensionsRef.current.width || img.naturalWidth || 400
      const naturalH = naturalDimensionsRef.current.height || img.naturalHeight || 400

      // Calculate base fit (cover square container without distortion)
      const baseScale = Math.max(boxSize / naturalW, boxSize / naturalH)
      const finalWidth = naturalW * baseScale * zoom * scaleMultiplier
      const finalHeight = naturalH * baseScale * zoom * scaleMultiplier

      ctx.drawImage(img, -finalWidth / 2, -finalHeight / 2, finalWidth, finalHeight)
      ctx.restore()

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      const blob = dataUrlToBlob(dataUrl)
      return { dataUrl, blob, size: blob.size }
    },
    [sourceImage, targetResolution, rotation, pan, zoom]
  )

  // Real-time preview update during crop adjustments
  useEffect(() => {
    if (!sourceImage || !isCropping) return
    const timer = setTimeout(() => {
      const cropped = renderCroppedCanvas(350)
      if (cropped) {
        setPreviewUrl(cropped.dataUrl)
        setPreviewFileSize(cropped.size)
      }
    }, 120)
    return () => clearTimeout(timer)
  }, [renderCroppedCanvas, sourceImage, isCropping])

  // Handle file selection (JPG, PNG, WebP)
  const handleFileSelect = (file: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onToast?.('Please select a valid image file (JPG, PNG, or WebP).', 'error')
      return
    }

    setOriginalFileName(file.name)
    setSaveError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (result) {
        setSourceImage(result)
        setPreviewUrl(result)
        setPreviewFileSize(file.size)
        // Reset transformation state for new photo
        setZoom(1.0)
        setPan({ x: 0, y: 0 })
        setRotation(0)
        setIsCropping(true)
      }
    }
    reader.readAsDataURL(file)
  }

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  // Interactive mouse drag handlers for panning
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sourceImage) return
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !sourceImage) return
    e.preventDefault()
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  // Touch handlers for trackpads/mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!sourceImage || e.touches.length === 0) return
    setIsDragging(true)
    const touch = e.touches[0]
    setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y })
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || !sourceImage || e.touches.length === 0) return
    const touch = e.touches[0]
    setPan({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    })
  }

  const handleTouchEnd = () => setIsDragging(false)

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!sourceImage) return
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.08 : -0.08
    setZoom((prev) => Math.min(3.5, Math.max(0.5, parseFloat((prev + delta).toFixed(2)))))
  }

  const handleZoomIn = () => setZoom((prev) => Math.min(3.5, parseFloat((prev + 0.1).toFixed(2))))
  const handleZoomOut = () => setZoom((prev) => Math.max(0.5, parseFloat((prev - 0.1).toFixed(2))))
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360)
  const handleReset = () => {
    setZoom(1.0)
    setPan({ x: 0, y: 0 })
    setRotation(0)
  }

  // SAVE CROP: Crop -> Blob -> POST /api/applications/:id/photo
  const handleSaveCrop = async () => {
    if (!effectiveAppId) {
      const msg = 'Application is not ready for photo upload. Please save the application first.'
      setSaveError(msg)
      onToast?.(msg, 'error')
      return
    }

    const cropped = renderCroppedCanvas(targetResolution)
    if (!cropped) {
      onToast?.('Please upload and position a photo first.', 'error')
      return
    }

    setIsUploading(true)
    setSaveError(null)

    try {
      const cleanFileName = (originalFileName || 'applicant_photo.jpg').replace(/\.[^/.]+$/, '') + '.jpg'
      const res = await uploadApplicantPhoto(cropped.blob, cleanFileName, effectiveAppId)

      // Create new blob URL for the confirmed saved image
      const newBlobUrl = URL.createObjectURL(cropped.blob)
      updateSavedBlobUrl(newBlobUrl)
      setIsCropping(false)
      setIsExpanded(false)

      onPhotoSaved?.({
        dataUrl: cropped.dataUrl,
        fileName: cleanFileName,
        fileSize: cropped.size,
        width: targetResolution,
        height: targetResolution,
      })
      onPhotoChanged?.(true)

      onToast?.(res.message || 'Applicant photo cropped and saved successfully.', 'success')
    } catch (err: any) {
      console.error('Save Crop error:', err)
      const errMsg = err?.message || 'Failed to upload photo to backend.'
      setSaveError(errMsg)
      onToast?.(errMsg, 'error')
      // Note: Edited crop state and preview are preserved so user doesn't lose work!
    } finally {
      setIsUploading(false)
    }
  }

  // REMOVE PHOTO: DELETE /api/applications/:id/photo
  const handleRemovePhoto = async () => {
    setSaveError(null)

    if (effectiveAppId && savedPhotoBlobUrl) {
      setIsRemoving(true)
      try {
        await deleteApplicantPhoto(effectiveAppId)
        updateSavedBlobUrl(null)
        setSourceImage(null)
        setPreviewUrl(null)
        setPreviewFileSize(0)
        setIsCropping(false)
        if (fileInputRef.current) fileInputRef.current.value = ''

        onPhotoRemoved?.()
        onPhotoChanged?.(false)
        onToast?.('Applicant photo removed.', 'info')
      } catch (err: any) {
        console.error('Remove photo error:', err)
        const errMsg = err?.message || 'Failed to remove photo from server.'
        setSaveError(errMsg)
        onToast?.(errMsg, 'error')
      } finally {
        setIsRemoving(false)
      }
    } else {
      // Local removal (no backend photo yet)
      updateSavedBlobUrl(null)
      setSourceImage(null)
      setPreviewUrl(null)
      setPreviewFileSize(0)
      setIsCropping(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onPhotoRemoved?.()
      onPhotoChanged?.(false)
      onToast?.('Applicant photo removed.', 'info')
    }
  }

  // Clean display name
  const displayName =
    applicantName ||
    `${application?.fields?.['appl.applname']?.value || ''} ${application?.fields?.['appl.surname']?.value || ''}`.trim() ||
    applicantId ||
    'Applicant'

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden transition-all">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileSelect(file)
        }}
      />

      {/* Header Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-3.5 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 flex-shrink-0">
            {/* Clean SVG Camera Icon */}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 truncate">
              <span>Applicant Photo</span>
              <span className="text-[10px] bg-blue-950 text-blue-300 font-semibold px-1.5 py-0.2 rounded border border-blue-800/60 uppercase">
                1:1 Square
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 truncate" title={displayName}>
              {displayName}
            </p>
          </div>
        </div>

        {/* Quick Header Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {(sourceImage || savedPhotoBlobUrl) && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-800 transition-colors text-xs cursor-pointer"
              title={isExpanded ? 'Minimize Photo Studio' : 'Expand Studio Mode'}
            >
              {/* Clean SVG Expand/Collapse Icon */}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Photo Content Area */}
      <div className="p-3.5 space-y-3.5">
        {/* Loading Spinner from Backend */}
        {isLoadingFromBackend ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-7 h-7 mx-auto border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Loading saved photo...</p>
          </div>
        ) : !sourceImage && !savedPhotoBlobUrl ? (
          /* Empty / Upload State */
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-slate-750 hover:border-blue-500 rounded-xl p-6 text-center bg-slate-950/40 hover:bg-blue-950/10 transition-all cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 group-hover:bg-blue-600/20 text-slate-400 group-hover:text-blue-400 flex items-center justify-center transition-all mb-2.5 border border-slate-700 group-hover:border-blue-500/40">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 transition-colors">
              Upload Photo
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Drag and drop photo here or click to browse
            </p>
            <p className="text-[9px] text-slate-500 mt-1 font-mono">
              JPG, PNG, WebP • 2" × 2" (350x350 min)
            </p>

            <div className="mt-4 flex items-center justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Choose Photo</span>
              </button>
            </div>
          </div>
        ) : isCropping && sourceImage ? (
          /* Interactive Square Crop Viewport */
          <div className="space-y-3">
            <div className="relative mx-auto w-full aspect-square max-w-[280px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner select-none">
              <div
                ref={cropContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onWheel={handleWheel}
                className={`w-full h-full relative flex items-center justify-center overflow-hidden ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                <img
                  ref={imageElementRef}
                  src={sourceImage}
                  alt="Applicant crop source"
                  onLoad={(e) => {
                    const img = e.currentTarget
                    naturalDimensionsRef.current = {
                      width: img.naturalWidth,
                      height: img.naturalHeight,
                    }
                  }}
                  draggable={false}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.05s ease-out',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    userSelect: 'none',
                  }}
                  className="pointer-events-none select-none"
                />

                {/* Passport Composition Guidelines Overlay */}
                {showGuide && (
                  <div className="absolute inset-0 pointer-events-none z-10">
                    <div className="absolute inset-0 border-2 border-cyan-400/80 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.2)]" />
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <line x1="50" y1="6" x2="50" y2="94" stroke="rgba(6, 182, 212, 0.45)" strokeWidth="0.75" strokeDasharray="2,2" />
                      <ellipse cx="50" cy="43" rx="20" ry="28" fill="none" stroke="rgba(6, 182, 212, 0.75)" strokeWidth="1.2" strokeDasharray="3,2" />
                      <line x1="18" y1="40" x2="82" y2="40" stroke="rgba(52, 211, 153, 0.85)" strokeWidth="1.0" strokeDasharray="2.5,2" />
                      <line x1="30" y1="71" x2="70" y2="71" stroke="rgba(6, 182, 212, 0.6)" strokeWidth="0.8" strokeDasharray="2,2" />
                    </svg>
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-slate-900/85 text-[8px] font-mono text-cyan-300 border border-cyan-500/40">
                      Head: 50-70%
                    </div>
                    <div className="absolute top-[37%] right-2 px-1 py-0.2 rounded bg-emerald-950/85 text-[8px] font-mono text-emerald-300 border border-emerald-500/40">
                      Eye Level
                    </div>
                  </div>
                )}
              </div>

              {/* Guide Toggle */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 z-20">
                <button
                  type="button"
                  onClick={() => setShowGuide((prev) => !prev)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                    showGuide
                      ? 'bg-cyan-950/90 text-cyan-300 border-cyan-600/70 shadow-xs'
                      : 'bg-slate-900/90 text-slate-400 border-slate-700'
                  }`}
                  title="Toggle Passport Composition Guide"
                >
                  Guide {showGuide ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Interactive Control Sliders */}
            <div className="space-y-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-semibold w-10 flex-shrink-0">
                  Zoom
                </span>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer"
                  title="Zoom Out"
                >
                  −
                </button>
                <input
                  type="range"
                  min="0.5"
                  max="3.5"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3.5}
                  className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer"
                  title="Zoom In"
                >
                  +
                </button>
                <span className="text-[10px] font-mono text-blue-400 font-bold w-10 text-right">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              {/* Rotate and Reset */}
              <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/60">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleRotate}
                    className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Rotate 90 degrees"
                  >
                    <span>Rotate</span>
                    <span>{rotation}°</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium border border-slate-700 transition-colors cursor-pointer"
                    title="Reset Zoom & Pan"
                  >
                    Reset
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {([350, 600] as ResolutionPreset[]).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setTargetResolution(res)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border transition-colors cursor-pointer ${
                        targetResolution === res
                          ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {res}px
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error Message with Retry */}
            {saveError && (
              <div className="bg-rose-950/80 border border-rose-600/70 text-rose-200 px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-rose-400 font-bold">!</span>
                  <span className="truncate">{saveError}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSaveCrop}
                  disabled={isUploading}
                  className="text-rose-200 hover:text-white underline font-semibold flex-shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Crop Action Buttons */}
            <div className="space-y-2 pt-1 border-t border-slate-800/80">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2 px-2.5 rounded-xl text-xs border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Change Photo</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={isUploading || isRemoving}
                  className="bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border border-rose-800 font-medium py-2 px-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Remove Photo</span>
                </button>
              </div>

              {/* Single Clear Save Crop Action Button */}
              <button
                type="button"
                onClick={handleSaveCrop}
                disabled={isUploading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-2.5 px-3 rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Photo...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Save Crop</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Saved Photo State (Clean Presentation & Quick Actions) */
          <div className="space-y-3">
            <div className="relative mx-auto w-full aspect-square max-w-[280px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-md">
              <img
                src={previewUrl || savedPhotoBlobUrl || ''}
                alt="Saved applicant photo"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-emerald-950/90 text-emerald-300 border border-emerald-600/70 text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                <span>✓</span>
                <span>Saved Photo</span>
                {previewFileSize > 0 && (
                  <span className="text-[9px] text-emerald-400 font-mono ml-1">
                    ({(previewFileSize / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
            </div>

            {/* Error Message if Remove failed */}
            {saveError && (
              <div className="bg-rose-950/80 border border-rose-600/70 text-rose-200 px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs">
                <span className="truncate">{saveError}</span>
              </div>
            )}

            {/* Action Buttons: Change Photo, Remove Photo, Adjust Crop */}
            <div className="space-y-2 pt-1 border-t border-slate-800/80">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-2.5 rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Change Photo</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={isRemoving}
                  className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold py-2 px-2.5 rounded-xl text-xs shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isRemoving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                  <span>Remove Photo</span>
                </button>
              </div>

              {sourceImage && (
                <button
                  type="button"
                  onClick={() => setIsCropping(true)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-1.5 px-2 rounded-lg text-xs border border-slate-700 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Adjust Crop & Zoom</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expanded Studio Mode Modal (High precision editing) */}
      {isExpanded && (sourceImage || savedPhotoBlobUrl) && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
          <div className="bg-slate-900 border border-slate-750 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-850 border-b border-slate-750 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span>Passport Photo Studio</span>
                    <span className="text-[10px] bg-cyan-950 text-cyan-300 font-mono font-semibold px-2 py-0.5 rounded border border-cyan-800">
                      Indian Visa 2"×2"
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Position face between 50% and 70% and align eyes with the guideline
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="text-slate-400 hover:text-white text-base bg-slate-800 hover:bg-slate-700 w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4 flex flex-col md:flex-row gap-6 items-center">
              <div className="relative w-full max-w-[320px] aspect-square bg-slate-950 rounded-2xl overflow-hidden border-2 border-cyan-500/60 shadow-2xl flex-shrink-0 select-none">
                <div
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onWheel={handleWheel}
                  className={`w-full h-full relative flex items-center justify-center overflow-hidden ${
                    isDragging ? 'cursor-grabbing' : 'cursor-grab'
                  }`}
                >
                  <img
                    src={sourceImage || savedPhotoBlobUrl || ''}
                    alt="Expanded crop source"
                    draggable={false}
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                      transformOrigin: 'center center',
                      transition: isDragging ? 'none' : 'transform 0.05s ease-out',
                      maxWidth: 'none',
                      maxHeight: 'none',
                      userSelect: 'none',
                    }}
                    className="pointer-events-none select-none"
                  />

                  {showGuide && (
                    <div className="absolute inset-0 pointer-events-none z-10">
                      <div className="absolute inset-0 border-2 border-cyan-400 rounded-xl" />
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <line x1="50" y1="4" x2="50" y2="96" stroke="rgba(6, 182, 212, 0.5)" strokeWidth="0.6" strokeDasharray="2,2" />
                        <ellipse cx="50" cy="43" rx="20" ry="28" fill="none" stroke="rgba(6, 182, 212, 0.85)" strokeWidth="1.2" strokeDasharray="3,2" />
                        <line x1="16" y1="40" x2="84" y2="40" stroke="rgba(52, 211, 153, 0.9)" strokeWidth="1.0" strokeDasharray="2.5,2" />
                        <line x1="28" y1="71" x2="72" y2="71" stroke="rgba(6, 182, 212, 0.65)" strokeWidth="0.8" strokeDasharray="2,2" />
                      </svg>
                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-slate-900/90 text-[9px] font-mono text-cyan-300 border border-cyan-500/50">
                        Head: 50% - 70%
                      </div>
                      <div className="absolute top-[38%] right-2.5 px-2 py-0.5 rounded bg-emerald-950/90 text-[9px] font-mono text-emerald-300 border border-emerald-500/50">
                        Eye Level
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Studio Controls */}
              <div className="flex-1 w-full space-y-4">
                <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 space-y-2 text-xs">
                  <h4 className="font-bold text-slate-200">Official Photo Requirements</h4>
                  <ul className="space-y-1 text-[11px] text-slate-300">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>Aspect Ratio: 1:1 Square (2" × 2" / 51mm)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>Head Size: Between 50% and 70%</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>Plain white or light-colored background</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3 bg-slate-950/65 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold">Scale / Zoom</span>
                    <span className="text-blue-400 font-mono font-bold">{Math.round(zoom * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.5"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRotate}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 cursor-pointer"
                      >
                        Rotate ({rotation}°)
                      </button>
                      <button
                        type="button"
                        onClick={handleReset}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 cursor-pointer"
                      >
                        Center
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">Res:</span>
                      {([350, 600] as ResolutionPreset[]).map((res) => (
                        <button
                          key={res}
                          type="button"
                          onClick={() => setTargetResolution(res)}
                          className={`px-2 py-0.8 rounded text-xs font-mono font-bold border transition-colors cursor-pointer ${
                            targetResolution === res
                              ? 'bg-blue-600 text-white border-blue-500'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          {res}p
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {saveError && (
                  <div className="bg-rose-950/80 border border-rose-600/70 text-rose-200 px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs">
                    <span className="truncate">{saveError}</span>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveCrop()
                    }}
                    disabled={isUploading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Save Crop</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ApplicantPhotoEditor
