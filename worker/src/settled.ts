// The report from the worker to the app. The worker owns no Payload table, so it does not
// write the result. It sends one job `media.settled` for each upload, and the app works that
// queue. Postgres is the only bus between the two containers.

import type { Job, PgBoss } from 'pg-boss'
import type { Derived, Failure, WorkerOptions } from './jobs/index.ts'

/** The queue of the reports. The app works it. */
export const SETTLED = 'media.settled'

/** The data of one `media.settled` job. */
export type Settled =
  | { mediaId: string; outcome: 'ready'; derived: Derived }
  | { mediaId: string; outcome: 'failed'; error: Failure }

/**
 * The app can be down for some time (a deploy, a restart). A job waits in the queue until
 * the app works it. Only a handler that throws uses a retry: 10 retries, from 5 s, each delay
 * about two times longer. A job that a process took and did not finish (the process
 * stopped) is active until it expires. The handler is one row update, so 60 s is enough;
 * the pg-boss default is 900 s.
 */
const SETTLED_POLICY = { retryLimit: 10, retryBackoff: true, retryDelay: 5, expireInSeconds: 60 }

async function prepareQueue(boss: PgBoss): Promise<void> {
  // createQueue does nothing when the queue exists.
  await boss.createQueue(SETTLED, SETTLED_POLICY)
}

/**
 * The `onDone` and `onFailed` callbacks of `startWorker` that send `media.settled`.
 * `boss` must be started. If a send fails, the callback throws, and the worker retries.
 */
export function settledReporter(boss: PgBoss): Pick<WorkerOptions, 'onDone' | 'onFailed'> {
  const send = async (message: Settled) => {
    await prepareQueue(boss)
    const id = await boss.send(SETTLED, message)
    if (!id) throw new Error(`pg-boss did not create the ${SETTLED} job`)
  }
  return {
    onDone: (mediaId, derived) => send({ mediaId, outcome: 'ready', derived }),
    onFailed: (mediaId, error) => send({ mediaId, outcome: 'failed', error }),
  }
}

/**
 * Work the `media.settled` queue on the app side. `boss` must be started. The handler gets
 * each report once; if it throws, the report comes again later. So the handler must accept
 * the same report two times.
 */
export async function workSettled(boss: PgBoss, handler: (message: Settled) => Promise<void>): Promise<void> {
  await prepareQueue(boss)
  // createQueue does not change a queue that exists: give a stack of an older release the policy.
  await boss.updateQueue(SETTLED, SETTLED_POLICY)
  await boss.work(SETTLED, async (jobs: Job<Settled>[]) => {
    for (const job of jobs) await handler(job.data)
  })
}
