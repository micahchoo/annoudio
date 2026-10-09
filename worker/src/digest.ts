// The daily review mail (M6 of design/ia.md §2.3). The worker container keeps the schedule:
// its pg-boss runs the cron. The app works the queue and sends the mail. As with
// `media.settled`, the queue name and the schedule live here, and the app imports them.

import type { PgBoss } from 'pg-boss'

/** The queue of the daily digest. The app works it. */
export const DIGEST = 'mail.digest'

/** Every day at 08:00, in the time zone of the stack. */
export const DIGEST_CRON = '0 8 * * *'

/** The time zone of this process: the TZ of the container, else UTC. */
export function stackTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/**
 * Keep the daily `mail.digest` job on the schedule. `boss` must be started. A second call
 * replaces the schedule, so a new time zone takes effect at the next start. A pg-boss with
 * `schedule: true` (the worker's own) sends the job at the time. A day when the stack was
 * down gets no late mail.
 */
export async function scheduleDigest(boss: PgBoss, tz = stackTimeZone()): Promise<void> {
  await boss.createQueue(DIGEST, { retryLimit: 3, retryDelay: 60, expireInSeconds: 300 })
  await boss.schedule(DIGEST, DIGEST_CRON, null, { tz, missed: 'skip' })
}

/** Work the `mail.digest` queue on the app side. `boss` must be started. */
export async function workDigest(boss: PgBoss, handler: () => Promise<void>): Promise<void> {
  await boss.createQueue(DIGEST, { retryLimit: 3, retryDelay: 60, expireInSeconds: 300 })
  await boss.work(DIGEST, async (jobs) => {
    for (const _job of jobs) await handler()
  })
}
