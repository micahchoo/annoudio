// A public JSON answer for host pages and CMS plugins on other sites (CONTRACT.md §5.1):
// CORS `*`, a strong ETag with 304, HEAD, 60 s for a 404. The recording route
// (`catalogue`) is 300 s in caches. The theme route (`projects`) is `no-cache`: a browser
// keeps the file but asks again on each page load, and a 304 answers while it is the same,
// so a saved theme shows on the next page load (recordings audit, 19).

import { createHash } from 'node:crypto'

const COMMON = {
  'Access-Control-Allow-Origin': '*',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'X-Content-Type-Options': 'nosniff',
}
const NOT_FOUND = JSON.stringify({ type: 'about:blank', title: 'Not Found', status: 404 })

const CACHE = {
  /** Cached for 5 minutes, then used for a day while the cache asks again. */
  minutes: 'public, max-age=300, stale-while-revalidate=86400',
  /** Kept, but checked with the ETag before each use. */
  revalidate: 'public, no-cache',
} as const

/** `json` as the answer to `request`, or a 404 when it is null. */
export function publicJson(
  request: Request,
  json: unknown,
  cache: keyof typeof CACHE = 'minutes',
): Response {
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
    'Cache-Control': CACHE[cache],
    ETag: etag,
  }
  const asked = request.headers.get('If-None-Match')
  const tags = asked?.split(',').map((tag) => tag.trim().replace(/^W\//, '')) ?? []
  if (tags.some((tag) => tag === etag || tag === '*')) {
    return new Response(null, { status: 304, headers })
  }
  return new Response(head ? null : body, { status: 200, headers })
}
