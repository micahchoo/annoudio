// Load .env files. Values that vitest.config.mts sets win.
import 'dotenv/config'

// Payload drops every table at start (PAYLOAD_DROP_DATABASE). Refuse any database
// that is not a test database, so a test run never deletes development data.
const database = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (!database.endsWith('_test')) {
  throw new Error(`Tests need a database whose name ends in _test, not "${database}".`)
}
