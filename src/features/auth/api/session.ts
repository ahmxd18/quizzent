import { ApiError, getJson, postJson } from '../../../lib/http'

export type SessionUser = { id: string; displayName: string; email: string; role: 'organiser' | 'superadmin' }
export type LoginInput = { email: string; password: string }

export const login = (input: LoginInput) => postJson<{ user: SessionUser }>('/api/auth/login', input)
export const logout = () => postJson<{ message: string }>('/api/auth/logout', {})

export async function getSession(): Promise<SessionUser | null> {
  try {
    return (await getJson<{ user: SessionUser }>('/api/auth/session')).user
  } catch (error) {
    // An expired/missing session is normal. A server outage is still an error.
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}
