import { createHash } from 'node:crypto'

export const hashSecret = (token: string) => createHash('sha256').update(token).digest('hex')
