import { z } from 'zod'

export const signupSchema = z.strictObject({
  displayName: z.string().trim().min(1, 'Enter your name.').max(80, 'Use 80 characters or fewer.'),
  email: z.string().trim().toLowerCase().max(254, 'Email is too long.').pipe(z.email({ error: 'Enter a valid email address.' })),
  // Preserve password spaces; trimming would silently change the user's secret.
  password: z.string().min(15, 'Use at least 15 characters.').max(128, 'Use 128 characters or fewer.'),
})

export type SignupInput = z.infer<typeof signupSchema>
