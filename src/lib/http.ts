export class ApiError extends Error {
  status: number
  fieldErrors: Record<string, string>

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const error = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
    const fieldErrors: Record<string, string> = {}
    if (error.fieldErrors && typeof error.fieldErrors === 'object') {
      for (const [key, value] of Object.entries(error.fieldErrors)) {
        if (typeof value === 'string') fieldErrors[key] = value
      }
    }
    throw new ApiError(response.status, typeof error.message === 'string' ? error.message : 'Something went wrong. Please try again.', fieldErrors)
  }
  if (payload === null) throw new Error('The server returned an unreadable response.')
  return payload as T
}
