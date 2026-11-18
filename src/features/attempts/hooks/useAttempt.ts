import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../../lib/http'
import { getAttempt, postAnswer, type AnswerSubmission, type Attempt } from '../api/attempts'

const attemptKey = (roomId: string) => ['guest', 'attempt', roomId] as const

export function useAttempt(roomId: string) {
  return useQuery({
    queryKey: attemptKey(roomId),
    queryFn: () => getAttempt(roomId),
    retry: false,
    gcTime: 0,
  })
}

export function useSubmitAnswer(roomId: string) {
  const client = useQueryClient()
  const queryKey = attemptKey(roomId)

  return useMutation({
    mutationFn: (answer: AnswerSubmission) => postAnswer(roomId, answer),
    networkMode: 'always',
    retry: false,
    gcTime: 0,
    async onSuccess(saved) {
      await client.cancelQueries({ queryKey })
      // A second tab may have moved the attempt ahead while this response was in flight.
      client.setQueryData<Attempt>(queryKey, current => current && current.answered + current.timedOut > saved.answered + saved.timedOut ? current : saved)
    },
    async onError(error) {
      if (error instanceof ApiError && [401, 403, 409].includes(error.status)) {
        await client.invalidateQueries({ queryKey })
        if (error.status === 409) void client.invalidateQueries({ queryKey: ['guest', 'room', roomId] })
      }
    },
  })
}
