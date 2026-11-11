import { useMutation } from '@tanstack/react-query'
import { signup } from '../api/signup'

export function useSignup() {
  return useMutation({
    mutationFn: signup,
    // Signup must not retry automatically after an ambiguous network failure.
    retry: false,
    gcTime: 0,
  })
}
