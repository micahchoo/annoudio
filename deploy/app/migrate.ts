// Runs the Payload migrations of app/src/migrations before the app starts.
// deploy/app/entrypoint.sh calls it with `payload run`. It is part of the app image.
//
// Two app containers can start at the same time (a redeploy, or a second replica).
// Payload takes no lock, so this script takes a Postgres advisory lock first: the
// second container waits, then finds no migration to run.
// A failed migration rolls back (Payload runs each one in a transaction) and exits 1.
// The container then restarts, and the healthcheck stays red.

import config from '@payload-config'
import { getPayload } from 'payload'

// Any fixed number. It names the lock; only this script uses it.
const MIGRATION_LOCK = 7_244_100_601

const payload = await getPayload({ config })
const db = payload.db as unknown as {
  pool: { connect(): Promise<{ query(text: string, values?: unknown[]): Promise<unknown>; release(): void }> }
  migrate(): Promise<void>
}

// An advisory lock belongs to one connection. Hold it on a connection of its own;
// the migrations use the other connections of the pool.
const lock = await db.pool.connect()
try {
  payload.logger.info('[migrate] waiting for the migration lock')
  await lock.query('select pg_advisory_lock($1)', [MIGRATION_LOCK])
  await db.migrate()
  await lock.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK])
} finally {
  lock.release()
}
payload.logger.info('[migrate] done')
process.exit(0)
