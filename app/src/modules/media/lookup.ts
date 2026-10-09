import type { Payload, PayloadRequest } from 'payload'

import type { Kind } from 'annoudio-worker'

import { MEDIA } from './collection'
import { MEDIA_ID } from './paths'

/** The UUID that the upload makes for each media body. */
export type MediaId = string

/** `uploaded` → `ready` | `failed`. No other move. A new upload is a new id. */
export type MediaState = 'uploaded' | 'ready' | 'failed'

export interface MediaBody {
  /** `{origin}/media/{id}`. The same URL before and after the transcode. */
  url: string
  /** The MIME type of the derived file. Until the body is ready: the expected type. */
  format: string
  kind: Kind
  /** True when the derived file is in place, so the URL serves it. */
  ready: boolean
  state: MediaState
}

export interface MediaContext {
  payload: Payload
  origin: string
  req?: PayloadRequest
}

/** The body URL of a media id. */
export function mediaUrl(origin: string, id: MediaId): string {
  return `${origin}/media/${id}`
}

/** The media id in a body URL of this origin, or null for any other URL. */
export function mediaIdOf(origin: string, url: string): MediaId | null {
  const prefix = `${origin}/media/`
  if (!url.startsWith(prefix)) return null
  const id = url.slice(prefix.length)
  return MEDIA_ID.test(id) ? id : null
}

/**
 * Find a media body that the member uploaded. Null when the id is unknown or another
 * member uploaded it (design/media-interface.md, invariant 5).
 */
export async function body(
  context: MediaContext,
  id: MediaId,
  memberId: string,
): Promise<MediaBody | null> {
  if (!MEDIA_ID.test(id)) return null
  const doc = await context.payload.findByID({
    collection: MEDIA,
    id,
    depth: 0,
    disableErrors: true,
    req: context.req,
  })
  if (!doc || doc.member !== memberId) return null
  return {
    url: mediaUrl(context.origin, id),
    format: doc.format,
    kind: doc.kind,
    ready: doc.state === 'ready',
    state: doc.state,
  }
}

/**
 * Delete a media body: the row, the derived file and the raw file (the delete hook of the
 * collection). For a take-down: `stories.remove` calls it for the bodies of a removed
 * story that no other story uses. An unknown id does nothing.
 */
export async function removeBody(context: MediaContext, id: MediaId): Promise<void> {
  if (!MEDIA_ID.test(id)) return
  await context.payload.delete({
    collection: MEDIA,
    where: { id: { equals: id } },
    depth: 0,
    req: context.req,
  })
}
