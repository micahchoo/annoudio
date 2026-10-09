// The app side of `media.settled`: the worker reports each result, and this sets the
// state of the `media` row. Postgres is the only bus between the two containers.

import type { Payload } from 'payload'

import type { Settled } from 'annoudio-worker'

import { MEDIA } from './collection'

/**
 * Set the result of one upload. A report can come two times, and the row can be gone
 * (an operator deleted it). Only a row in the state `uploaded` changes. Gives the number
 * of rows that changed: 0 or 1.
 */
export async function applySettled(payload: Payload, message: Settled): Promise<number> {
  const data =
    message.outcome === 'ready'
      ? {
          state: 'ready' as const,
          derived: derivedPath(message.mediaId, message.derived.path),
          format: message.derived.format,
          durationSec: message.derived.durationSec ?? null,
          width: message.derived.width ?? null,
          height: message.derived.height ?? null,
        }
      : { state: 'failed' as const, error: `${message.error.code}: ${message.error.message}` }
  const { docs } = await payload.update({
    collection: MEDIA,
    where: { and: [{ id: { equals: message.mediaId } }, { state: { equals: 'uploaded' } }] },
    data,
    depth: 0,
  })
  return docs.length
}

/** The worker writes derived/<id>.<ext>. Refuse any other path. */
function derivedPath(mediaId: string, path: string): string {
  if (!path.startsWith(`derived/${mediaId}.`) || path.includes('/', 'derived/'.length)) {
    throw new Error(`media.settled: ${path} is not a derived file of ${mediaId}`)
  }
  return path
}
