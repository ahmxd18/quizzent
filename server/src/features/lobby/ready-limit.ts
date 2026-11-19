export function createReadyLimit(limit = 20, windowMs = 10_000) {
  const budgets = new Map<string, { count: number; expiresAt: number }>()
  return {
    allow(participantId: string, now = Date.now()) {
      let budget = budgets.get(participantId)
      if (!budget || now >= budget.expiresAt) {
        budget = { count: 0, expiresAt: now + windowMs }
        budgets.set(participantId, budget)
      }
      if (budget.count >= limit) return false
      budget.count++
      return true
    },
    prune(now = Date.now()) {
      for (const [id, budget] of budgets) if (now >= budget.expiresAt) budgets.delete(id)
    },
    clear() { budgets.clear() },
  }
}
