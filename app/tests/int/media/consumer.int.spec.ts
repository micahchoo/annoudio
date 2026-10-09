// @vitest-environment node
// The `media.settled` consumer as the app image runs it (design/phase5c-notes.md,
// "media.settled stays active"). A process that only loads the config, as
// `payload run deploy/migrate.ts` does, must take no report. The Next server starts the
// consumer with `startConsumers` (src/instrumentation.ts); a report that waits then
// sets the row and completes its job.

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { SettledConsumer } from '@/modules/media'

import { report, resetQueues } from './world'

const MEDIA_ID = 'a0fabef2-9bfc-401e-b546-3a3345193cfa'

let payload: Payload
let startConsumers: () => Promise<void>

beforeAll(async () => {
  // The env of the app image: every process of the image has it, the migrate script too.
  vi.stubEnv('ANNOUDIO_MEDIA_CONSUMER', '1')
  const app = await import('@/payload.config')
  startConsumers = app.startConsumers
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: app.default })
  await resetQueues(payload)
  const db = payload.db as unknown as PostgresAdapter
  await db.drizzle.execute(sql`truncate media cascade`)
  await payload.create({
    collection: 'media',
    data: {
      id: MEDIA_ID,
      member: 'm-1',
      kind: 'image',
      state: 'uploaded',
      size: 1000,
      raw: `raw/${MEDIA_ID}.jpg`,
      format: 'image/jpeg',
    },
  })
})

afterAll(async () => {
  const consumers = globalThis as typeof globalThis & {
    annoudioConsumer?: Promise<SettledConsumer>
  }
  await (await consumers.annoudioConsumer)?.stop()
  vi.unstubAllEnvs()
})

async function jobState(): Promise<string | undefined> {
  const db = payload.db as unknown as PostgresAdapter
  const { rows } = await db.drizzle.execute<{ state: string }>(
    sql`select state from pgboss.job where name = 'media.settled'`,
  )
  return rows[0]?.state
}

const stateOf = async () =>
  (await payload.findByID({ collection: 'media', id: MEDIA_ID, depth: 0 })).state

describe('the media.settled consumer of the app image', () => {
  it('takes no report in a process that only loads the config', async () => {
    await report({
      mediaId: MEDIA_ID,
      derived: { path: `derived/${MEDIA_ID}.jpg`, kind: 'image', format: 'image/jpeg' },
    })
    // Two poll intervals of pg-boss (2 s each).
    await new Promise((resolve) => setTimeout(resolve, 4_500))
    expect(await jobState()).toBe('created')
    expect(await stateOf()).toBe('uploaded')
  })

  it('sets the row and completes the job when the server starts the consumer', async () => {
    const log = vi.spyOn(console, 'info')
    await startConsumers()
    await vi.waitFor(async () => expect(await stateOf()).toBe('ready'), {
      timeout: 8_000,
      interval: 100,
    })
    await vi.waitFor(async () => expect(await jobState()).toBe('completed'), {
      timeout: 8_000,
      interval: 100,
    })
    expect(log).toHaveBeenCalledWith(`[media] media.settled: ${MEDIA_ID} is ready.`)
    log.mockRestore()
  })
})
