import { z } from 'zod'
import { createDatabasePool } from './database.js'
import { AdminError } from './features/admin/admin.error.js'
import { bootstrapSuperadmin } from './features/admin/admin.service.js'

const email = z.email().safeParse(process.argv[2]?.trim())
if (!email.success || process.argv.length !== 3) {
  console.error('Usage: npm run admin:bootstrap -- organiser@example.com')
  process.exitCode = 1
} else {
  const database = createDatabasePool()
  try {
    const account = await bootstrapSuperadmin(database, email.data)
    console.log(`Superadmin assigned to ${account}. Log in again to open the admin page.`)
  } catch (error) {
    process.exitCode = 1
    console.error(error instanceof AdminError ? error.message : 'Could not set up the superadmin. Check PostgreSQL and the migrations.')
  } finally {
    await database.end()
  }
}
