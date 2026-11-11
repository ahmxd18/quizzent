import { z } from 'zod'

export const competitionSchema = z.strictObject({
  title: z.string().trim().min(1, 'Give your competition a title.').max(100, 'Use 100 characters or fewer.'),
  description: z.string().trim().max(500, 'Use 500 characters or fewer.').default(''),
  questionTimeSeconds: z.number().int('Use a whole number of seconds.').min(5, 'Use at least 5 seconds.').max(120, 'Use 120 seconds or fewer.').default(10),
})

export type CompetitionInput = z.infer<typeof competitionSchema>
