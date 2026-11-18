import type { Pool } from 'pg'
import { z } from 'zod'

export const directoryFilters = z.strictObject({
  status: z.enum(['live', 'ended', 'drafted', 'published', 'cancelled']).optional(),
  organiser: z.email().max(254).transform(email => email.toLowerCase()).optional(),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  page: z.string().regex(/^[1-9][0-9]{0,4}$/).transform(Number).default(1),
}).refine(filters => !filters.startDate || !filters.endDate || filters.startDate <= filters.endDate, {
  message: 'Start date must be on or before end date.',
})

export async function readDirectory(database: Pool, filters: z.infer<typeof directoryFilters>) {
  const size = 25
  // Use the start of the following UTC day as the exclusive end so the selected end date is inclusive.
  const { rows } = await database.query(
    `WITH records AS (
      SELECT c.id, 'competition' AS kind, c.title, NULL::text AS code, c.organiser_id, c.created_at,
        CASE WHEN c.status = 'draft' THEN 'drafted' ELSE 'published' END AS status
      FROM competitions c
      UNION ALL
      SELECT r.id, 'room', c.title, r.code, r.organiser_id, r.created_at,
        CASE WHEN r.cancellation_reason IS NOT NULL THEN 'cancelled' WHEN r.status = 'open' THEN 'live' ELSE 'ended' END
      FROM rooms r JOIN competitions c ON c.id = r.competition_id
    )
    SELECT records.id, kind, title, code, records.status, records.created_at AS "createdAt",
           u.display_name AS "organiserName", u.email AS "organiserEmail"
    FROM records JOIN users u ON u.id = records.organiser_id
    WHERE ($1::text IS NULL OR records.status = $1)
      AND ($2::text IS NULL OR lower(u.email) = $2)
      AND ($3::date IS NULL OR records.created_at >= ($3::date::timestamp AT TIME ZONE 'UTC'))
      AND ($4::date IS NULL OR records.created_at < (($4::date + 1)::timestamp AT TIME ZONE 'UTC'))
    ORDER BY records.created_at DESC, kind, records.id LIMIT $5 OFFSET $6`,
    [filters.status ?? null, filters.organiser ?? null, filters.startDate ?? null, filters.endDate ?? null, size + 1, (filters.page - 1) * size],
  )
  return { records: rows.slice(0, size), hasNextPage: rows.length > size }
}
