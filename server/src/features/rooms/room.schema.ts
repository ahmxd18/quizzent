import { z } from 'zod'

export const createRoomSchema = z.strictObject({
  competitionId: z.uuid(),
  admissionMode: z.enum(['open', 'invitation']),
  lobbySeconds: z.number().int().min(0).max(3600).default(60),
  minReady: z.number().int().min(1).max(50).default(2),
})
const isPlainText = (value: string) => !/\p{Cc}/u.test(value)
export const invitationSchema = z.strictObject({ reference: z.string().trim().min(1, 'Enter an organiser reference.').max(100, 'Use 100 characters or fewer.').refine(isPlainText, 'Use plain text for the reference.') })
export const joinRoomSchema = z.strictObject({
  nickname: z.string().transform(value => value.normalize('NFKC').trim().replace(/\s+/gu, ' ')).pipe(z.string().min(1, 'Choose a nickname.').max(32, 'Use 32 characters or fewer.').refine(isPlainText, 'Use plain text for the nickname.')),
  invitationToken: z.string().regex(/^[0-9a-f]{64}$/, 'This invitation link is invalid.').optional(),
})
export const roomCodeSchema = z.string().transform(value => value.replace(/[\s-]/g, '').toUpperCase()).pipe(z.string().regex(/^[A-Z2-9]{8}$/, 'Enter an eight-character room code.'))
