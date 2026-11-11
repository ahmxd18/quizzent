import { postJson } from '../../../lib/http'

export type SignupInput = { displayName: string; email: string; password: string }
type SignupResponse = {
  user: { id: string; displayName: string; email: string; role: 'organiser' }
}

export function signup(input: SignupInput) {
  return postJson<SignupResponse>('/api/auth/signup', input)
}
