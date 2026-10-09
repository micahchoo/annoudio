// The report to the app, end to end against Postgres (database annoudio_worker_test):
// the worker with the fake adapters and `settledReporter`, and the app side `workSettled`.

import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { PgBoss } from 'pg-boss'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  enqueueTranscode,
  fakeProber,
  fakeTranscoder,
  SETTLED,
  settledReporter,
  startWorker,
  workSettled,
  type Kind,
  type Settled,
  type Worker,
} from '../src/index.ts'
import { fixture } from './helpers.ts'

const databaseUrl = process.env.TEST_DATABASE_URL!

let mediaDir: string
let app: PgBoss
let reporter: PgBoss
let worker: Worker | undefined

beforeEach(async () => {
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  await client.query('DROP SCHEMA IF EXISTS pgboss CASCADE')
  await client.end()

  mediaDir = mkdtempSync(join(tmpdir(), 'annoudio-media-'))
  mkdirSync(join(mediaDir, 'raw'))
  app = new PgBoss(databaseUrl)
  reporter = new PgBoss({ connectionString: databaseUrl, supervise: false, schedule: false })
  for (const boss of [app, reporter]) boss.on('error', (error) => console.error(error))
  await app.start()
  await reporter.start()
  worker = await startWorker({
    databaseUrl,
    mediaDir,
    transcoder: fakeTranscoder(),
    prober: fakeProber(),
    retryDelaySeconds: 1,
    ...settledReporter(reporter),
  })
})

afterEach(async () => {
  await worker?.stop()
  await reporter.stop()
  await app.stop()
})

async function upload(mediaId: string, name: string, kind: Kind): Promise<void> {
  const raw = `raw/${mediaId}.${name.split('.').pop()}`
  copyFileSync(fixture(name), join(mediaDir, raw))
  await enqueueTranscode(app, { mediaId, raw, kind })
}

const settle = { timeout: 20_000, interval: 100 }

describe('media.settled', () => {
  it('reports a derived upload as ready, with the derived file', async () => {
    const got: Settled[] = []
    await workSettled(app, async (message) => void got.push(message))
    await upload('s1', 'photo.jpg', 'image')
    await vi.waitFor(() => expect(got).toHaveLength(1), settle)
    expect(got[0]).toEqual({
      mediaId: 's1',
      outcome: 'ready',
      derived: { path: 'derived/s1.jpg', kind: 'image', format: 'image/jpeg', width: 320, height: 240 },
    })
  })

  it('reports a permanent error as failed, with its code', async () => {
    const got: Settled[] = []
    await workSettled(app, async (message) => void got.push(message))
    await upload('s2', 'photo.jpg', 'sound')
    await vi.waitFor(() => expect(got).toHaveLength(1), settle)
    expect(got[0]).toMatchObject({ mediaId: 's2', outcome: 'failed', error: { code: 'kind-mismatch' } })
  })

  it('gives a report again when the app handler throws', async () => {
    let calls = 0
    const got: Settled[] = []
    await workSettled(app, async (message) => {
      calls += 1
      if (calls === 1) throw new Error('database busy')
      got.push(message)
    })
    await upload('s3', 'chrome.webm', 'sound')
    await vi.waitFor(() => expect(got).toHaveLength(1), settle)
    expect(calls).toBe(2)
    expect(got[0]).toMatchObject({ mediaId: 's3', outcome: 'ready' })
  })

  it('gives a queue of an older release the 60 s expiry when the app starts to work it', async () => {
    // An older release made the queue with the pg-boss default: 900 s.
    await app.createQueue(SETTLED, { retryLimit: 10, retryBackoff: true, retryDelay: 5 })
    expect((await app.getQueue(SETTLED))?.expireInSeconds).toBe(900)
    await workSettled(app, async () => {})
    expect((await app.getQueue(SETTLED))?.expireInSeconds).toBe(60)
  })
})
