// The environment of the end-to-end tests. Import this before the Payload config:
// it points the test process at the test database.
import 'dotenv/config'

import { fileURLToPath } from 'node:url'

export const E2E_PORT = 3100
export const E2E_ORIGIN = `http://localhost:${E2E_PORT}`
export const E2E_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://annoudio:annoudio@127.0.0.1:5432/annoudio_test'

// The seed deletes rows. Refuse any database that is not a test database.
if (!new URL(E2E_DATABASE_URL).pathname.endsWith('_test')) {
  throw new Error(`End-to-end tests need a database whose name ends in _test: ${E2E_DATABASE_URL}`)
}
/** The media volume of the e2e server. The test process writes into it as the worker does. */
export const E2E_MEDIA_DIR = fileURLToPath(new URL('../../.media-e2e', import.meta.url))

process.env.DATABASE_URL = E2E_DATABASE_URL
process.env.MEDIA_DIR = E2E_MEDIA_DIR
process.env.ANNOUDIO_ORIGIN = E2E_ORIGIN
delete process.env.SMTP_URL
