import { Pool } from 'pg'

export function createDatabasePool() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('Set DATABASE_URL in server/.env before connecting to PostgreSQL.')
  }

  // Reuse a few connections rather than opening one for every request.
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  })

  pool.on('error', () => {
    console.error('An idle PostgreSQL connection failed.')
  })

  return pool
}
