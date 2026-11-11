import { z } from 'zod'

export const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email({ error: 'Enter a valid email address.' })),
  // Preserve spaces; login must check exactly what was entered at signup.
  password: z.string().min(1, 'Enter your password.').max(128),
})
