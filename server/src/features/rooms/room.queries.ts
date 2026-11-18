export type Room = {
  id: string; code: string; competitionId: string; title: string
  admissionMode: 'open' | 'invitation'; status: 'open' | 'closed'
  createdAt: Date; closedAt: Date | null; participantCount: number
  minReady: number; lobbyEndsAt: Date; warningEndsAt: Date | null; startedAt: Date | null
  resultsPublishedAt: Date | null
  cancellationReason: 'organiser' | 'superadmin' | 'server_outage' | null
  cancellationNote: string | null
}
export const roomColumns = `r.id, r.code, r.competition_id AS "competitionId", c.title, r.admission_mode AS "admissionMode",
  r.status, r.created_at AS "createdAt", r.closed_at AS "closedAt",
  r.min_ready AS "minReady", r.lobby_ends_at AS "lobbyEndsAt", r.warning_ends_at AS "warningEndsAt", r.started_at AS "startedAt",
  r.results_published_at AS "resultsPublishedAt",
  r.cancellation_reason AS "cancellationReason", r.cancellation_note AS "cancellationNote",
  (SELECT count(*)::integer FROM room_participants p WHERE p.room_id = r.id) AS "participantCount"`
