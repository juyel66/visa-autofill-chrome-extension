import { fetchWithAuth } from '../auth/authClient'
import type {
  SavedApplication,
  BackendApplicationSummary,
  BackendApplicationDetail,
} from './types'

export const BACKEND_API_BASE_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_API_BASE_URL ||
      import.meta.env?.BACKEND_URL ||
      import.meta.env?.VITE_BACKEND_URL)) ||
  'http://localhost:8000'

export class ApplicationApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApplicationApiError'
    this.status = status
    this.code = code
  }
}

/**
 * Formats HTTP response errors into a clean, human-friendly ApplicationApiError.
 */
export function createApplicationApiError(
  status: number,
  errorBody: any,
  defaultMessage: string,
  _rawText?: string
): ApplicationApiError {
  const backendMessage =
    (typeof errorBody?.message === 'string' && errorBody.message) ||
    (typeof errorBody?.error === 'string' && errorBody.error) ||
    (typeof errorBody?.detail === 'string' && errorBody.detail) ||
    (_rawText && _rawText.length < 200 && !_rawText.includes('<html') ? _rawText.trim() : '') ||
    ''

  let formattedMessage = defaultMessage

  switch (status) {
    case 400:
      formattedMessage = backendMessage || 'Invalid request. Please check the submitted data.'
      break
    case 401:
      formattedMessage = 'Backend session expired. Please sign in again.'
      break
    case 403:
      formattedMessage = 'Permission denied. You do not have access to this application.'
      break
    case 404:
      formattedMessage = 'Application not found or no longer exists.'
      break
    case 409:
      formattedMessage = backendMessage || 'A conflict occurred while saving this application.'
      break
    case 413:
      formattedMessage = 'The uploaded PDF is too large. Maximum supported size is 25MB.'
      break
    case 422:
      formattedMessage = backendMessage || 'Invalid application data provided.'
      break
    case 500:
      formattedMessage = backendMessage || 'Server error occurred while processing application.'
      break
    default:
      if (backendMessage) {
        formattedMessage = backendMessage
      }
      break
  }

  return new ApplicationApiError(formattedMessage, status)
}

/**
 * Safely consumes the response body exactly once as text, parses JSON,
 * and if response is not OK, throws a formatted ApplicationApiError.
 */
async function consumeJsonResponse<T>(response: Response, defaultMessage: string): Promise<T> {
  const rawText = await response.text().catch(() => '')
  let json: any = null
  try {
    json = rawText ? JSON.parse(rawText) : null
  } catch {
    // Non-JSON response (e.g. HTML error page or empty string)
  }

  if (!response.ok) {
    throw createApplicationApiError(response.status, json, defaultMessage, rawText)
  }

  return json as T
}

/**
 * Backwards compatible helper that safely parses response body once and throws ApplicationApiError.
 */
export async function handleApiError(response: Response, defaultMessage: string): Promise<never> {
  const rawText = await response.text().catch(() => '')
  let json: any = null
  try {
    json = rawText ? JSON.parse(rawText) : null
  } catch {}
  throw createApplicationApiError(response.status, json, defaultMessage, rawText)
}

/**
 * Safely executes an API call catching network failures.
 */
async function safeFetch(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    return await fetchWithAuth(url, options)
  } catch (err) {
    if (err instanceof ApplicationApiError) {
      throw err
    }
    const message = err instanceof Error ? err.message : String(err)
    if (/failed to fetch|networkerror|econnrefused|failed to connect/i.test(message)) {
      throw new ApplicationApiError('Unable to connect to backend server. Make sure http://localhost:8000 is running.', 0)
    }
    throw err
  }
}

/**
 * GET /api/applications
 * Returns a lightweight list of the authenticated user's saved applications.
 */
export async function getApplications(): Promise<BackendApplicationSummary[]> {
  const response = await safeFetch(`${BACKEND_API_BASE_URL}/api/applications`)
  const json = await consumeJsonResponse<{
    success: boolean
    data: BackendApplicationSummary[]
  }>(response, 'Failed to retrieve saved applications.')

  return json.data || []
}

/**
 * GET /api/applications/:id
 * Returns the complete SavedApplication object and metadata for a specific application.
 */
export async function getApplicationById(id: string): Promise<BackendApplicationDetail> {
  if (!id) {
    throw new ApplicationApiError('Application ID is required.', 400)
  }

  const response = await safeFetch(`${BACKEND_API_BASE_URL}/api/applications/${encodeURIComponent(id)}`)
  const json = await consumeJsonResponse<{
    success: boolean
    data: BackendApplicationDetail
  }>(response, `Failed to load application ${id}.`)

  return json.data
}

/**
 * POST /api/applications
 * Creates a brand new saved application record with complete SavedApplication JSON and original PDF.
 */
export async function createApplication(
  applicationData: SavedApplication,
  originalPdf?: Blob | File | null,
  fileName?: string
): Promise<{ id: string; applicantName?: string | null; passportNumber?: string | null }> {
  const formData = new FormData()

  // 1. Append the authoritative, complete SavedApplication JSON
  formData.append('applicationData', JSON.stringify(applicationData))

  // 2. Append original PDF File/Blob if available
  if (originalPdf) {
    const resolvedName = fileName || (originalPdf instanceof File ? originalPdf.name : 'passport.pdf')
    formData.append('pdf', originalPdf, resolvedName)
  }

  // NOTE: Do not set Content-Type header manually. Browser/fetch automatically sets multipart boundary!
  const response = await safeFetch(`${BACKEND_API_BASE_URL}/api/applications`, {
    method: 'POST',
    body: formData,
  })

  const json = await consumeJsonResponse<{
    success: boolean
    message?: string
    data: {
      id: string
      applicantName?: string | null
      passportNumber?: string | null
      status?: string | null
      createdAt: string
      updatedAt: string
    }
  }>(response, 'Failed to save application to server.')

  return json.data
}

/**
 * PUT /api/applications/:id
 * Updates an existing application with complete updated SavedApplication JSON.
 */
export async function updateApplication(
  id: string,
  applicationData: SavedApplication,
  originalPdf?: Blob | File | null,
  fileName?: string
): Promise<{ id: string; applicantName?: string | null; passportNumber?: string | null }> {
  if (!id) {
    throw new ApplicationApiError('Application ID is required for update.', 400)
  }

  let response: Response

  if (originalPdf) {
    const formData = new FormData()
    formData.append('applicationData', JSON.stringify(applicationData))
    const resolvedName = fileName || (originalPdf instanceof File ? originalPdf.name : 'passport.pdf')
    formData.append('pdf', originalPdf, resolvedName)

    response = await safeFetch(`${BACKEND_API_BASE_URL}/api/applications/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: formData,
    })
  } else {
    response = await safeFetch(`${BACKEND_API_BASE_URL}/api/applications/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ applicationData }),
    })
  }

  const json = await consumeJsonResponse<{
    success: boolean
    message?: string
    data: {
      id: string
      applicantName?: string | null
      passportNumber?: string | null
      status?: string | null
      updatedAt: string
    }
  }>(response, `Failed to update application ${id}.`)

  return json.data
}

/**
 * DELETE /api/applications/:id
 * Permanently deletes the application record from the backend database.
 */
export async function deleteApplication(id: string): Promise<void> {
  if (!id) {
    throw new ApplicationApiError('Application ID is required for deletion.', 400)
  }

  const response = await safeFetch(`${BACKEND_API_BASE_URL}/api/applications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

  await consumeJsonResponse(response, `Failed to delete application ${id}.`)
}

/**
 * GET /api/applications/:id/pdf
 * Downloads original uploaded passport PDF for a saved application.
 */
export async function downloadApplicationPdf(
  id: string
): Promise<{ blob: Blob; fileName: string }> {
  if (!id) {
    throw new ApplicationApiError('Application ID is required to download PDF.', 400)
  }

  const response = await safeFetch(`${BACKEND_API_BASE_URL}/api/applications/${encodeURIComponent(id)}/pdf`)

  if (!response.ok) {
    const rawText = await response.text().catch(() => '')
    let json: any = null
    try {
      json = rawText ? JSON.parse(rawText) : null
    } catch {}
    throw createApplicationApiError(response.status, json, 'Failed to download original PDF.', rawText)
  }

  // Extract filename from Content-Disposition header if available
  let fileName = `passport_${id}.pdf`
  const disposition = response.headers.get('content-disposition')
  if (disposition) {
    const filenameMatch = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
    if (filenameMatch && filenameMatch[1]) {
      fileName = decodeURIComponent(filenameMatch[1])
    }
  }

  const blob = await response.blob()
  return { blob, fileName }
}
