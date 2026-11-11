import { createDatabasePool } from './database.js'

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL in server/.env, then run npm run db:check again.')
  process.exitCode = 1
} else {
  const pool = createDatabasePool()

  try {
    // SELECT 1 checks the connection without creating or changing any data.
    await pool.query('SELECT 1')
    console.log('PostgreSQL connection successful.')
  } catch {
    // Avoid printing a connection string that could contain a password.
    console.error('Cannot connect to PostgreSQL. Check that it is running and DATABASE_URL is correct.')
    process.exitCode = 1
  } finally {
    // Release the connections so this one-off command can exit.
    await pool.end()
  }
}
