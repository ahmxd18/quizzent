import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import type { Pool } from 'pg'
import { startTimeoutWorker } from '../src/features/attempts/timeout-worker.js'

test('timeout worker stays idle until woken, drains work and returns to idle', async () => {
  let queries = 0
  let active = false
  const database = { async query(sql: string) {
    queries++
    return { rows: sql.startsWith('SELECT EXISTS') ? [{ active }] : [] }
  } } as unknown as Pool
  const worker = startTimeoutWorker(database)
  try {
    await delay(600)
    assert.equal(queries, 0)
    active = true
    worker.wake()
    const deadline = Date.now() + 3_000
    while (queries < 3) { assert.ok(Date.now() < deadline); await delay(10) }
    active = false
    await delay(1_100)
    const drained = queries
    assert.ok(drained >= 6)
    await delay(600)
    assert.equal(queries, drained, 'No repeated idle database queries')
    worker.wake()
    while (queries === drained) { assert.ok(Date.now() < deadline + 2_000); await delay(10) }
    await worker.stop()
    const stopped = queries
    worker.wake()
    await delay(100)
    assert.equal(queries, stopped)
  } finally { await worker.stop() }
})
