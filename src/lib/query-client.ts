import { QueryClient } from '@tanstack/react-query'

// Keep one cache for the app instead of creating a new one on every render.
export const queryClient = new QueryClient()
