// GET /media/<id>: the derived file of a ready media body, for any origin. A derived
// file never changes, so caches can keep it for one year. Safari needs byte ranges to
// play audio and video, so the route answers Range requests.

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'

import type { Payload } from 'payload'

import { MEDIA } from './collection'
import { MEDIA_ID, inMediaDir } from './paths'

export interface FileDeps {
  payload: () => Promise<Payload>
  mediaDir: string
}

const SHARED = {
  'Access-Control-Allow-Origin': '*',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'X-Content-Type-Options': 'nosniff',
}

/** Not there yet, or never: the URL can become ready later, so no cache keeps the 404. */
const notFound = () =>
  new Response('Not Found', { status: 404, headers: { ...SHARED, 'Cache-Control': 'no-store' } })

export function fileHandler(deps: FileDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { ...SHARED, Allow: 'GET, HEAD' } })
    }
    const id = new URL(request.url).pathname.split('/').at(-1) ?? ''
    if (!MEDIA_ID.test(id)) return notFound()
    const payload = await deps.payload()
    const doc = await payload.findByID({ collection: MEDIA, id, depth: 0, disableErrors: true })
    if (!doc || doc.state !== 'ready' || !doc.derived) return notFound()

    const path = inMediaDir(deps.mediaDir, doc.derived)
    const size = await stat(path).then(
      (info) => info.size,
      () => null,
    )
    if (size === null) return notFound()

    const headers: Record<string, string> = {
      ...SHARED,
      'Content-Type': doc.format,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    }
    const range = byteRange(request.headers.get('range'), size)
    if (range === 'unsatisfiable') {
      return new Response(null, {
        status: 416,
        headers: { ...headers, 'Content-Range': `bytes */${size}` },
      })
    }
    const { start, end } = range ?? { start: 0, end: size - 1 }
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`
    headers['Content-Length'] = String(size === 0 ? 0 : end - start + 1)
    const body =
      request.method === 'HEAD' || size === 0
        ? null
        : (Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream<Uint8Array>)
    return new Response(body, { status: range ? 206 : 200, headers })
  }
}

/**
 * One range of `bytes=a-b`, `bytes=a-` or `bytes=-n` (RFC 9110 §14.1.2). A header with
 * several ranges, or one that is not valid, gives null: the whole file (RFC 9110 §14.2
 * lets a server ignore Range).
 */
function byteRange(
  header: string | null,
  size: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null
  if (!match || (match[1] === '' && match[2] === '')) return null
  if (match[1] === '') {
    const suffix = Number(match[2])
    if (suffix === 0 || size === 0) return 'unsatisfiable'
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(match[1])
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
  if (start >= size || end < start) return 'unsatisfiable'
  return { start, end }
}
