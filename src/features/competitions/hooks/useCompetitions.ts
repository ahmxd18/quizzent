import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../../lib/http'
import { sessionKey } from '../../auth/hooks/useSession'
import { createCompetition, getCompetition, listCompetitions, updateCompetition, type CompetitionInput } from '../api/competitions'

const competitionKey = ['competitions'] as const

function useExpiredSession(error: Error | null) {
  const client = useQueryClient()
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) client.setQueryData(sessionKey, null)
  }, [client, error])
}

export function useCompetitions() {
  const query = useQuery({ queryKey: [...competitionKey, 'list'], queryFn: listCompetitions, retry: false, staleTime: 30000 })
  useExpiredSession(query.error)
  return query
}

export function useCompetition(id: string) {
  const query = useQuery({ queryKey: [...competitionKey, 'detail', id], queryFn: () => getCompetition(id), retry: false })
  useExpiredSession(query.error)
  return query
}

export function useSaveCompetition(id?: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: CompetitionInput) => id ? updateCompetition(id, input) : createCompetition(input),
    retry: false,
    onSuccess: async () => {
      // A previous list request must not replace the list after a successful save.
      await client.cancelQueries({ queryKey: competitionKey })
      await client.invalidateQueries({ queryKey: competitionKey, refetchType: 'none' })
    },
    onError: error => {
      if (error instanceof ApiError && error.status === 401) client.setQueryData(sessionKey, null)
    },
  })
}
