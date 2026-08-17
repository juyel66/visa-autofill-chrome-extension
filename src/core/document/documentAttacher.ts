import { dispatchFieldEvents } from '../autofill/eventDispatcher'
import type { DocumentAttachmentResult } from './requirement.types'
import type { DocumentRecord } from './types'

/**
 * Converts a base64 Data URL to a native browser File object.
 */
function dataUrlToFile(dataUrl: string, fileName: string, mimeType: string): File {
  const arr = dataUrl.split(',')
  const bstr = atob(arr[1] || '')
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], fileName, { type: mimeType })
}

/**
 * Attaches a stored DocumentRecord to a target DOM <input type="file"> element safely.
 * Dispatches synthetic change & input events.
 */
export async function attachDocumentToField(
  element: HTMLElement,
  doc: DocumentRecord,
  targetFieldId: string,
  dryRun = false
): Promise<DocumentAttachmentResult> {
  const documentId = doc.documentId

  if (!(element instanceof HTMLInputElement) || element.type.toLowerCase() !== 'file') {
    return {
      success: false,
      documentId,
      targetFieldId,
      status: 'invalid',
      reason: 'Target DOM element is not an HTML file input.',
    }
  }

  if (element.disabled || element.readOnly) {
    return {
      success: false,
      documentId,
      targetFieldId,
      status: 'skipped' as unknown as DocumentAttachmentResult['status'],
      reason: 'File input element is disabled or read-only.',
    }
  }

  if (!doc.fileDataUrl) {
    return {
      success: false,
      documentId,
      targetFieldId,
      status: 'invalid',
      reason: 'Stored document is missing data payload.',
    }
  }

  if (dryRun) {
    return {
      success: true,
      documentId,
      targetFieldId,
      status: 'attached',
      reason: '[Dry Run] Document ready for attachment.',
    }
  }

  try {
    const file = dataUrlToFile(doc.fileDataUrl, doc.fileName, doc.mimeType)

    if (typeof DataTransfer !== 'undefined') {
      const dt = new DataTransfer()
      dt.items.add(file)
      element.files = dt.files
      dispatchFieldEvents(element)

      return {
        success: true,
        documentId,
        targetFieldId,
        status: 'attached',
      }
    } else {
      return {
        success: false,
        documentId,
        targetFieldId,
        status: 'unsupported',
        reason: 'Browser security requires manual file selection.',
      }
    }
  } catch (err) {
    console.error(`Failed to attach document ${documentId}:`, err)
    return {
      success: false,
      documentId,
      targetFieldId,
      status: 'failed',
      reason: err instanceof Error ? err.message : 'Attachment failed.',
    }
  }
}
