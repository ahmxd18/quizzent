import axios from 'axios'

const client = axios.create({
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'X-Quizzent-Request': '1' },
  responseType: 'json',
  // Reject malformed JSON rather than passing an unreadable response to a form.
  transitional: { silentJSONParsing: false },
})

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
  return requestJson<T>('post', path, body)
}

export async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>('get', path)
}

export async function putJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>('put', path, body)
}

async function requestJson<T>(method: 'get' | 'post' | 'put', path: string, body?: unknown): Promise<T> {
  try {
    // Axios serialises the object and parses the JSON response for us.
    const response = await client.request<T>({ method, url: path, data: body })
    if (response.data === null || response.data === undefined) {
      throw new Error('The server returned an unreadable response.')
    }
    return response.data
  } catch (error) {
    // Network/timeout errors have no HTTP response; the form shows its connection message.
    if (!axios.isAxiosError(error) || !error.response) throw error

    const payload: unknown = error.response.data
    const details = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
    const fieldErrors: Record<string, string> = {}
    if (details.fieldErrors && typeof details.fieldErrors === 'object') {
      for (const [key, value] of Object.entries(details.fieldErrors)) {
        if (typeof value === 'string') fieldErrors[key] = value
      }
    }
    // Keep UI error handling independent of Axios's response structure.
    throw new ApiError(error.response.status, typeof details.message === 'string' ? details.message : 'Something went wrong. Please try again.', fieldErrors)
  }
}
