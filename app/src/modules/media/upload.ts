// The tus endpoint (https://tus.io/protocols/resumable-upload) at /media/upload, with
// `@tus/server` in the app process. `handleWeb` takes a web `Request` and streams its
// body into the FileStore, so a Next route handler can give it the request as it is.

import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { FileStore } from '@tus/file-store'
import { ERRORS, Server, type Upload } from '@tus/server'
import type { Payload } from 'payload'

import { LIMITS, type TranscodeJob } from 'annoudio-worker'

import type { HasHeaders, MemberSession } from '@/modules/membership'

import { MEDIA } from './collection'
import { expectedFormat, isKind, rawExtension } from './formats'
import { inMediaDir } from './paths'

export const UPLOAD_PATH = '/media/upload'

/** An unfinished upload stays this long. The consumer process deletes older ones. */
export const UPLOAD_EXPIRY_MS = 24 * 60 * 60 * 1000

const MAX_BYTES = Math.max(...Object.values(LIMITS).map((limit) => limit.bytes))

export interface UploadDeps {
  payload: () => Promise<Payload>
  origin: string
  mediaDir: string
  sessionFromRequest(request: HasHeaders): Promise<MemberSession | null>
  enqueue(job: TranscodeJob): Promise<void>
}

/** The FileStore of unfinished uploads: MEDIA_DIR/uploads/<id> and <id>.json. */
export function uploadStore(mediaDir: string): FileStore {
  return new FileStore({
    directory: join(mediaDir, 'uploads'),
    expirationPeriodInMilliseconds: UPLOAD_EXPIRY_MS,
  })
}

/** A refusal that `@tus/server` sends as the response. */
const refuse = (status_code: number, body: string) => ({ status_code, body: `${body}\n` })

export function uploadHandler(deps: UploadDeps): (request: Request) => Promise<Response> {
  const store = uploadStore(deps.mediaDir)
  // The hooks get the same Request object that `handleWeb` got.
  const sessions = new WeakMap<Request, MemberSession>()
  const sessionOf = (request: Request) => {
    const session = sessions.get(request)
    if (!session) throw ERRORS.FILE_NOT_FOUND
    return session
  }

  const server = new Server({
    path: UPLOAD_PATH,
    datastore: store,
    relativeLocation: true,
    // Only the Annotate page of this origin uploads.
    allowedOrigins: [deps.origin],
    maxSize: MAX_BYTES,
    namingFunction: () => randomUUID(),
    disableTerminationForFinishedUploads: true,

    // Check the kind, the type and the size before the server stores a byte.
    async onUploadCreate(request, upload) {
      const session = sessionOf(request)
      const kind = upload.metadata?.kind
      const type = upload.metadata?.filetype ?? ''
      if (!isKind(kind)) throw refuse(400, 'Give the metadata "kind": sound, image or video.')
      if (!rawExtension(kind, type)) throw refuse(415, `A ${kind} cannot have the type "${type}".`)
      if (upload.size === undefined) throw refuse(411, 'Give the Upload-Length header.')
      if (upload.size > LIMITS[kind].bytes) {
        throw refuse(
          413,
          `The file is too large. The ${kind} limit is ${LIMITS[kind].bytes} bytes.`,
        )
      }
      // The server sets the member. A value from the client is replaced.
      return { metadata: { ...upload.metadata, member: session.memberId } }
    },

    // Only the member who made an upload can continue, read or stop it.
    async onIncomingRequest(request, id) {
      if (request.method === 'POST') return
      const upload = await store.getUpload(id).catch(() => null)
      if (!upload || upload.metadata?.member !== sessionOf(request).memberId) {
        throw ERRORS.FILE_NOT_FOUND
      }
    },

    async onUploadFinish(_request, upload) {
      await finish(deps, upload)
      return {}
    },
  })

  return async (request) => {
    // A CORS preflight carries no cookie.
    if (request.method !== 'OPTIONS') {
      const session = await deps.sessionFromRequest(request)
      if (!session) {
        return new Response('Sign in to upload.\n', {
          status: 401,
          headers: { 'Tus-Resumable': '1.0.0', 'Cache-Control': 'no-store' },
        })
      }
      sessions.set(request, session)
    }
    return server.handleWeb(request)
  }
}

/**
 * Move the finished upload to raw/<id>.<ext>, make the `media` row and queue the
 * transcode. If the row or the job fails, the member sees an error and uploads again,
 * which makes a new id.
 */
async function finish(deps: UploadDeps, upload: Upload): Promise<void> {
  const metadata = upload.metadata ?? {}
  const kind = metadata.kind
  const type = metadata.filetype ?? ''
  const extension = isKind(kind) ? rawExtension(kind, type) : null
  if (!isKind(kind) || !extension || typeof metadata.member !== 'string') {
    throw refuse(400, 'The upload has no valid metadata.')
  }
  const raw = `raw/${upload.id}.${extension}`
  const uploads = join(deps.mediaDir, 'uploads')
  await mkdir(join(deps.mediaDir, 'raw'), { recursive: true })
  // Both folders are on the MEDIA_DIR volume, so the move is atomic.
  await rename(join(uploads, upload.id), inMediaDir(deps.mediaDir, raw))
  await rm(join(uploads, `${upload.id}.json`), { force: true })

  const payload = await deps.payload()
  await payload.create({
    collection: MEDIA,
    data: {
      id: upload.id,
      member: metadata.member,
      kind,
      state: 'uploaded',
      size: upload.size ?? upload.offset,
      raw,
      format: expectedFormat(kind, type),
    },
    depth: 0,
  })
  try {
    await deps.enqueue({ mediaId: upload.id, raw, kind })
  } catch (error) {
    await payload.delete({ collection: MEDIA, id: upload.id, depth: 0 }).catch(() => undefined)
    throw error
  }
}
