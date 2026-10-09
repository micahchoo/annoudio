// The schedule of the daily review mail, against Postgres (database annoudio_worker_test).

import pg from 'pg'
import { PgBoss } from 'pg-boss'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DIGEST, DIGEST_CRON, scheduleDigest, workDigest } from '../src/index.ts'

const databaseUrl = process.env.TEST_DATABASE_URL!
let boss: PgBoss

beforeEach(async () => {
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  await client.query('DROP SCHEMA IF EXISTS pgboss CASCADE')
  await client.end()
  boss = new PgBoss({ connectionString: databaseUrl, supervise: false, schedule: false })
  boss.on('error', (error) => console.error(error))
  await boss.start()
})

afterEach(async () => {
  await boss.stop()
})

describe('mail.digest', () => {
  it('is on the schedule every day at 08:00 in the time zone of the stack', async () => {
    await scheduleDigest(boss, 'Asia/Kolkata')
    const [schedule] = await boss.getSchedules(DIGEST)
    expect(schedule).toMatchObject({ name: DIGEST, cron: '0 8 * * *', timezone: 'Asia/Kolkata' })
    // From 07:59 stack time, the next occurrence is 08:00 stack time (02:30 UTC).
    const [next] = boss.previewSchedule(DIGEST_CRON, {
      tz: 'Asia/Kolkata',
      from: new Date('2026-10-10T02:29:00Z'),
    })
    expect(next?.toISOString()).toBe('2026-10-10T02:30:00.000Z')
  })

  it('a second call replaces the schedule: one schedule, the new time zone', async () => {
    await scheduleDigest(boss, 'UTC')
    await scheduleDigest(boss, 'Europe/Berlin')
    const schedules = await boss.getSchedules(DIGEST)
    expect(schedules).toHaveLength(1)
    expect(schedules[0]?.timezone).toBe('Europe/Berlin')
  })

  it('the app handler runs once for each digest job', async () => {
    const handler = vi.fn(async () => {})
    await workDigest(boss, handler)
    await boss.send(DIGEST, {})
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1), { timeout: 10_000, interval: 100 })
  })
})
