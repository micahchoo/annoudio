// A public JSON answer for host pages and CMS plugins on other sites (CONTRACT.md §5.1):
// CORS `*`, a strong ETag with 304, HEAD, 300 s in caches, 60 s for a 404. The theme route
// (`projects`) and the recording route (`catalogue`) answer with it.

import { createHash } from 'node:crypto'

const COMMON = {
  'Access-Control-Allow-Origin': '*',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'X-Content-Type-Options': 'nosniff',
}
const NOT_FOUND = JSON.stringify({ type: 'about:blank', title: 'Not Found', status: 404 })

/** `json` as the answer to `request`, or a 404 when it is null. */
export function publicJson(request: Request, json: unknown): Response {
  const head = request.method === 'HEAD'
  if (json === null) {
    return new Response(head ? null : NOT_FOUND, {
      status: 404,
      headers: {
        ...COMMON,
        'Content-Type': 'application/problem+json',
        'Cache-Control': 'public, max-age=60',
      },
    })
  }
  const body = JSON.stringify(json)
  const etag = `"${createHash('sha256').update(body, 'utf8').digest('base64url')}"`
  const headers = {
    ...COMMON,
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    ETag: etag,
  }
  const asked = request.headers.get('If-None-Match')
  const tags = asked?.split(',').map((tag) => tag.trim().replace(/^W\//, '')) ?? []
  if (tags.some((tag) => tag === etag || tag === '*')) {
    return new Response(null, { status: 304, headers })
  }
  return new Response(head ? null : body, { status: 200, headers })
}
