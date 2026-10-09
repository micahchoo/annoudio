import { PgBoss } from 'pg-boss'
import type { Payload } from 'payload'

import { SETTLED, enqueueTranscode, workSettled } from 'annoudio-worker'

import type { HasHeaders, MemberSession } from '@/modules/membership'

import { registerMediaDir } from './collection'
import { fileHandler } from './file'
import { body, type MediaBody, type MediaId } from './lookup'
import { applySettled } from './settled'
import { uploadHandler, uploadStore } from './upload'

export interface MediaConfig {
  /** The Payload instance, or a function that gives it on first use. */
  payload: Payload | (() => Promise<Payload>)
  /** ANNOUDIO_ORIGIN. The base of every body URL. */
  origin: string
  /** The media volume, shared with the worker: uploads/, raw/, work/, derived/. */
  mediaDir: string
  /** The Postgres URL. pg-boss keeps its tables in the schema `pgboss`. */
  databaseUrl: string
  /** The `membership` lookup of the member who uploads. */
  sessionFromRequest(request: HasHeaders): Promise<MemberSession | null>
  /**
   * Called after each `media.settled` report, also a repeated one, after the row has its
   * result. `stories` acts on the stories that use the body (`Stories.mediaSettled`). If it
   * throws, pg-boss gives the report again.
   */
  onSettled?(mediaId: MediaId): Promise<void>
}

export interface SettledConsumer {
  stop(): Promise<void>
}

export interface Media {
  /** The tus protocol at /media/upload: POST, HEAD, PATCH, DELETE and OPTIONS. Members only. */
  handleUpload(request: Request): Promise<Response>
  /** GET and HEAD of /media/<id>: the derived file of a ready body; 404 until then. */
  handleFile(request: Request): Promise<Response>
  /** A body that this member uploaded, or null. */
  body(id: MediaId, memberId: string): Promise<MediaBody | null>
  /**
   * Work the `media.settled` queue: set each result in the `media` collection. Also deletes
   * unfinished uploads older than one day, once per hour. Start it in the Next server
   * process only (`src/instrumentation.ts` with ANNOUDIO_MEDIA_CONSUMER=1).
   */
  startSettledConsumer(payload: Payload): Promise<SettledConsumer>
}

const HOUR_MS = 60 * 60 * 1000

export function createMedia(config: MediaConfig): Media {
  registerMediaDir(config.mediaDir)

  let pendingPayload: Promise<Payload> | undefined
  const payload = () => {
    pendingPayload ??= Promise.resolve(
      typeof config.payload === 'function' ? config.payload() : config.payload,
    ).catch((error: unknown) => {
      pendingPayload = undefined
      throw error
    })
    return pendingPayload
  }

  // One pg-boss pool, started on first use. The app only sends and works jobs; the
  // worker container does the queue maintenance.
  let pendingBoss: Promise<PgBoss> | undefined
  const boss = () => {
    pendingBoss ??= (async () => {
      const instance = new PgBoss({
        connectionString: config.databaseUrl,
        supervise: false,
        schedule: false,
        max: 4,
      })
      // Without a listener, a pg-boss `error` event stops the process.
      instance.on('error', (error) => console.error('[media] pg-boss:', error))
      return instance.start()
    })().catch((error: unknown) => {
      pendingBoss = undefined
      throw error
    })
    return pendingBoss
  }

  const handleUpload = uploadHandler({
    payload,
    origin: config.origin,
    mediaDir: config.mediaDir,
    sessionFromRequest: config.sessionFromRequest,
    enqueue: async (job) => {
      await enqueueTranscode(await boss(), job)
    },
  })

  async function startSettledConsumer(instance: Payload): Promise<SettledConsumer> {
    const started = await boss()
    await workSettled(started, async (message) => {
      // One log line for each report. An error goes to the log and to pg-boss, which
      // gives the report again later (worker/src/settled.ts, the queue policy).
      try {
        const changed = await applySettled(instance, message)
        await config.onSettled?.(message.mediaId)
        console.info(
          changed === 1
            ? `[media] media.settled: ${message.mediaId} is ${message.outcome}.`
            : `[media] media.settled: ${message.mediaId} is ${message.outcome}. No row changed: the row is gone or has its result.`,
        )
      } catch (error) {
        console.error(`[media] media.settled: ${message.mediaId}: the update failed.`, error)
        throw error
      }
    })
    const store = uploadStore(config.mediaDir)
    const sweep = setInterval(() => {
      store.deleteExpired().catch((error: unknown) => console.error('[media] sweep:', error))
    }, HOUR_MS)
    sweep.unref()
    return {
      async stop() {
        clearInterval(sweep)
        await started.offWork(SETTLED, { wait: true })
      },
    }
  }

  return {
    handleUpload,
    handleFile: fileHandler({ payload, mediaDir: config.mediaDir }),
    body: async (id, memberId) =>
      body({ payload: await payload(), origin: config.origin }, id, memberId),
    startSettledConsumer,
  }
}
