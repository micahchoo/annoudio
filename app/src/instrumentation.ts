// Next calls `register` once when the server starts, before it takes requests. It does not
// run in `next build`, in `payload run` (deploy/migrate.ts) or in the tests. So the job
// consumers start here, in the server process only, and at once: not on the first request.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.ANNOUDIO_MEDIA_CONSUMER !== '1') return
  const { startConsumers } = await import('./payload.config')
  // A failure stops the server start. The container restarts, and the log has the cause.
  await startConsumers()
  console.info('[jobs] The media.settled and mail.digest consumers are started.')
}
