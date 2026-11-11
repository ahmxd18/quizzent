import { z } from 'zod'

export const questionSchema = z.strictObject({
  prompt: z.string().trim().min(1, 'Enter your question.').max(1000, 'Use 1,000 characters or fewer.'),
  options: z.array(z.string().trim().min(1, 'Fill in every option.').max(200, 'Use 200 characters or fewer.')).length(4, 'Provide four options.'),
  correctOptionIndex: z.number().int().min(0).max(3),
}).superRefine((input, context) => {
  if (new Set(input.options.map(option => option.toLowerCase())).size !== 4) {
    context.addIssue({ code: 'custom', path: ['options'], message: 'Each option must be different.' })
  }
})

export type QuestionInput = z.infer<typeof questionSchema>
