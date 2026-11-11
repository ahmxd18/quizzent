import { DatabaseError, type Pool } from 'pg'
import { hashPassword } from './password.js'
import type { SignupInput } from './signup.schema.js'

export class EmailInUseError extends Error {}

export async function createOrganiser(database: Pool, input: SignupInput) {
  const passwordHash = await hashPassword(input.password)

  try {
    // The role is fixed here. Public signup never accepts a privileged role.
    const { rows: [user] } = await database.query<{
      id: string; displayName: string; email: string; role: 'organiser'
    }>(
      `INSERT INTO users (display_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'organiser')
       RETURNING id, display_name AS "displayName", email, role`,
      [input.displayName, input.email, passwordHash],
    )
    return user
  } catch (error) {
    // Let the unique index settle duplicate signups, including simultaneous ones.
    if (error instanceof DatabaseError && error.code === '23505' && error.constraint === 'users_email_unique') {
      throw new EmailInUseError()
    }
    throw error
  }
}
