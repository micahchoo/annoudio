// Makes the first operator of a new stack from two environment variables.
// Use it only where nobody can open the first-user screen in time: a staging stack
// that a script deploys, or a test. On a normal stack, use the first-user screen
// (deploy/seed/README.md).
//
//   docker compose -p <stack> exec \
//     -e ANNOUDIO_FIRST_OPERATOR_EMAIL=ops@example.org \
//     -e ANNOUDIO_FIRST_OPERATOR_PASSWORD=... \
//     app node node_modules/payload/bin.js run deploy/first-operator.ts
//
// It does nothing when an operator exists already. So you can run it again safely.
// The app image has this file at /app/deploy/first-operator.ts (deploy/app.Dockerfile).

import config from '@payload-config'
import { getPayload } from 'payload'

const email = process.env.ANNOUDIO_FIRST_OPERATOR_EMAIL
const password = process.env.ANNOUDIO_FIRST_OPERATOR_PASSWORD
if (!email || !password) {
  console.error('[seed] set ANNOUDIO_FIRST_OPERATOR_EMAIL and ANNOUDIO_FIRST_OPERATOR_PASSWORD')
  process.exit(2)
}
if (password.length < 12) {
  console.error('[seed] use a password with 12 or more characters')
  process.exit(2)
}

const payload = await getPayload({ config })
const { totalDocs } = await payload.count({ collection: 'users' })
if (totalDocs > 0) {
  console.log(`[seed] ${totalDocs} operator(s) exist already. Nothing done.`)
} else {
  await payload.create({ collection: 'users', data: { email, password } })
  console.log(`[seed] made the first operator: ${email}`)
}
process.exit(0)
