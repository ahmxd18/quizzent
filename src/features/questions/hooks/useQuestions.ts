import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../../lib/http'
import { sessionKey } from '../../auth/hooks/useSession'
import { createQuestion, listQuestions, removeQuestion, updateQuestion, type QuestionInput } from '../api/questions'

export function useQuestions(competitionId: string, enabled: boolean) {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['questions', competitionId], queryFn: () => listQuestions(competitionId), retry: false, enabled })
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) client.setQueryData(sessionKey, null)
  }, [query.error, client])
  return query
}

export function useQuestionActions(competitionId: string, questionId?: string) {
  const client = useQueryClient()
  async function refresh() {
    await client.cancelQueries({ queryKey: ['questions', competitionId] })
    await Promise.all([
      client.invalidateQueries({ queryKey: ['questions', competitionId] }),
      client.invalidateQueries({ queryKey: ['competitions'] }),
    ])
  }
  function onError(error: Error) {
    if (error instanceof ApiError && error.status === 401) client.setQueryData(sessionKey, null)
    // A different tab may have published this draft. Refresh its read-only state.
    if (error instanceof ApiError && error.status === 409) void client.invalidateQueries({ queryKey: ['competitions'] })
  }
  return {
    save: useMutation({ mutationFn: (input: QuestionInput) => questionId ? updateQuestion(competitionId, questionId, input) : createQuestion(competitionId, input), retry: false, onSuccess: refresh, onError }),
    remove: useMutation({ mutationFn: (id: string) => removeQuestion(competitionId, id), retry: false, onSuccess: refresh, onError }),
  }
}
