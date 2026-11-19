import type { Pool } from 'pg'
import { z } from 'zod'

export const directoryFilters = z.strictObject({
  status: z.enum(['live', 'ended', 'drafted', 'published', 'cancelled']).optional(),
  organiser: z.email().max(254).transform(email => email.toLowerCase()).optional(),
  organisers: z.string().transform(value => value.split(',')).pipe(z.array(z.uuid()).max(100)).optional(),
  search: z.string().trim().max(100).default(''),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  page: z.string().regex(/^[1-9][0-9]{0,4}$/).transform(Number).default(1),
  pageSize: z.string().regex(/^[1-9][0-9]{0,2}$/).transform(Number).pipe(z.number().max(100)).default(10),
}).refine(filters => !filters.startDate || !filters.endDate || filters.startDate <= filters.endDate, {
  message: 'Start date must be on or before end date.',
})

export async function readDirectory(database: Pool, filters: z.infer<typeof directoryFilters>) {
  const size = filters.pageSize
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
    ), filtered AS (
    SELECT records.id, kind, title, code, records.status, records.created_at AS "createdAt",
           u.display_name AS "organiserName", u.email AS "organiserEmail"
    FROM records JOIN users u ON u.id = records.organiser_id
    WHERE ($1::text IS NULL OR records.status = $1)
      AND ($2::text IS NULL OR lower(u.email) = $2)
      AND ($3::date IS NULL OR records.created_at >= ($3::date::timestamp AT TIME ZONE 'UTC'))
      AND ($4::date IS NULL OR records.created_at < (($4::date + 1)::timestamp AT TIME ZONE 'UTC'))
      AND ($5::uuid[] IS NULL OR records.organiser_id = ANY($5))
      AND (position(lower($6) in lower(title)) > 0 OR position(lower($6) in lower(coalesce(code, ''))) > 0
        OR position(lower($6) in lower(u.email)) > 0 OR position(lower($6) in lower(u.display_name)) > 0)
    ), page AS (
      SELECT * FROM filtered ORDER BY "createdAt" DESC, kind, id LIMIT $7 OFFSET $8
    )
    SELECT (SELECT count(*)::integer FROM filtered) AS total,
      coalesce((SELECT json_agg(page ORDER BY "createdAt" DESC, kind, id) FROM page), '[]'::json) AS records`,
    [filters.status ?? null, filters.organiser ?? null, filters.startDate ?? null, filters.endDate ?? null, filters.organisers ?? null, filters.search, size, (filters.page - 1) * size],
  )
  const totalElements = rows[0].total as number
  const totalPages = Math.ceil(totalElements / size)
  return {
    records: rows[0].records,
    pagination: { totalElements, currentPage: filters.page, pageSize: size, totalPages },
  }
}

export async function readOrganiserOptions(database: Pool, search: string, page: number) {
  const { rows } = await database.query<{ value: string; label: string }>(
    `SELECT id AS value, display_name || ' · ' || email AS label FROM users
     WHERE position($1 in lower(display_name)) > 0 OR position($1 in lower(email)) > 0
     ORDER BY lower(display_name), id LIMIT 51 OFFSET $2`, [search.toLowerCase(), (page - 1) * 50],
  )
  return { options: rows.slice(0, 50), hasNextPage: rows.length > 50 }
}
