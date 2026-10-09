// The entry point of the worker container. It reads the environment, starts the worker
// with the ffmpeg adapters, and stops it on SIGTERM and SIGINT.
// Each result goes to the app as one `media.settled` job (src/settled.ts).

import { PgBoss } from 'pg-boss'
import { ffmpegTranscoder, ffprobeProber, scheduleDigest, settledReporter, stackTimeZone, startWorker } from './index.ts'

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`[media worker] set the environment variable ${name}`)
    process.exit(2)
  }
  return value
}

const databaseUrl = required('DATABASE_URL')
const mediaDir = required('MEDIA_DIR')

// The reporter only sends. The pg-boss of `startWorker` does the maintenance of the schema.
const reporter = new PgBoss({ connectionString: databaseUrl, supervise: false, schedule: false })
reporter.on('error', (error) => console.error('[media worker] pg-boss (reporter):', error))
await reporter.start()

const worker = await startWorker({
  databaseUrl,
  mediaDir,
  transcoder: ffmpegTranscoder(),
  prober: ffprobeProber(),
  ...settledReporter(reporter),
})
console.log('[media worker] started')

// The daily review mail (M6): this container keeps the schedule; the app sends the mail.
await scheduleDigest(reporter)
console.log(`[media worker] the review mail is on the schedule: 08:00 ${stackTimeZone()}`)

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    // Stop the worker first: its active job can still send a report.
    worker
      .stop()
      .then(() => reporter.stop({ graceful: true, timeout: 5_000 }))
      .then(
        () => process.exit(0),
        (error: unknown) => {
          console.error('[media worker] stop failed:', error)
          process.exit(1)
        },
      )
  })
}
