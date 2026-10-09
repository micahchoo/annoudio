// The read side of the Web Annotation Protocol. A read is one row lookup:
// the bytes and the ETag are already stored. This file never reads a story.

import type { Payload } from 'payload'

import { etagOf } from './etag'
import { representations, variantOf, type ReadKey } from './paginate'
import { REPRESENTATIONS, instanceInfo, instanceKey, type Instance } from './rebuild'

const CONTENT_TYPE = 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"'
const ALLOW = 'GET, HEAD, OPTIONS'
const PREFER_MINIMAL = 'http://www.w3.org/ns/ldp#PreferMinimalContainer'
const PREFER_IRIS = 'http://www.w3.org/ns/oa#PreferContainedIRIs'
const PREFER_DESCRIPTIONS = 'http://www.w3.org/ns/oa#PreferContainedDescriptions'
const LINK_CONSTRAINED =
  '<http://www.w3.org/TR/annotation-protocol/>; rel="http://www.w3.org/ns/ldp#constrainedBy"'
const LINK_CONTAINER = '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"'
const LINK_RESOURCE = '<http://www.w3.org/ns/ldp#Resource>; rel="type"'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'ETag, Link, Allow, Vary',
}
const NOT_FOUND = JSON.stringify({ type: 'about:blank', title: 'Not Found', status: 404 })

export interface ReadSettings {
  payload: () => Promise<Payload>
  origin: string
  pageSize: number
  maxAge: number
}

interface Read extends Instance {
  key: ReadKey
}

export async function handleRead(request: Request, settings: ReadSettings): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS,
        Allow: ALLOW,
        'Access-Control-Allow-Methods': ALLOW,
        'Access-Control-Allow-Headers': 'Accept, Prefer, If-None-Match',
        'Access-Control-Max-Age': '86400',
      },
    })
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { ...CORS, Allow: ALLOW } })
  }
  const head = request.method === 'HEAD'
  const notFound = () =>
    new Response(head ? null : NOT_FOUND, {
      status: 404,
      headers: {
        ...CORS,
        'Content-Type': 'application/problem+json',
        'Cache-Control': `public, max-age=${settings.maxAge}`,
      },
    })

  const read = parseRead(request)
  if (!read) return notFound()
  const payload = await settings.payload()
  const stored = await findRow(payload, read)
  const row = stored ?? (await emptyContainer(payload, settings, read))
  if (!row) return notFound()

  const headers: Record<string, string> = {
    ...CORS,
    ETag: row.etag,
    'Cache-Control': `public, max-age=${settings.maxAge}, stale-while-revalidate=86400`,
    ...(read.key.kind === 'story' ? {} : { Vary: 'Prefer' }),
  }
  if (matches(request.headers.get('If-None-Match'), row.etag)) {
    return new Response(null, { status: 304, headers })
  }
  return new Response(head ? null : row.body, {
    status: 200,
    headers: {
      ...headers,
      'Content-Type': CONTENT_TYPE,
      Allow: ALLOW,
      Link: links(read.key),
    },
  })
}

function parseRead(request: Request): Read | null {
  const url = new URL(request.url)
  const parts = url.pathname.split('/')
  if (parts[1] !== 'stories' || parts.length < 4 || parts.length > 5) return null
  let segments: string[]
  try {
    segments = parts.slice(2).map(decodeURIComponent)
  } catch {
    return null
  }
  const [project, recording, story = ''] = segments
  if (!project || !recording) return null
  if (story) return { project, recording, key: { kind: 'story', id: story } }

  const query = url.searchParams
  const pageParam = query.get('page')
  if (pageParam !== null) {
    // The handler ignores Prefer on a page: a client should not send it there.
    if (!/^(0|[1-9][0-9]{0,8})$/.test(pageParam)) return null
    return {
      project,
      recording,
      key: { kind: 'page', iris: query.get('iris') === '1', page: Number(pageParam) },
    }
  }
  // The query parameter wins over Prefer, because the query is part of every cache key.
  const prefer = parsePrefer(request.headers.get('Prefer'))
  const iris = query.has('iris') ? query.get('iris') === '1' : prefer.iris
  return { project, recording, key: { kind: 'container', iris, minimal: prefer.minimal } }
}

function parsePrefer(header: string | null): { iris: boolean; minimal: boolean } {
  const include = header ? /include\s*=\s*"([^"]*)"/.exec(header)?.[1] : undefined
  const prefs = include ? include.trim().split(/\s+/) : []
  return {
    iris: prefs.includes(PREFER_IRIS) && !prefs.includes(PREFER_DESCRIPTIONS),
    minimal: prefs.includes(PREFER_MINIMAL),
  }
}

async function findRow(payload: Payload, read: Read) {
  const { docs } = await payload.find({
    collection: REPRESENTATIONS,
    where: { key: { equals: `${instanceKey(read)}/${variantOf(read.key)}` } },
    limit: 1,
    pagination: false,
    depth: 0,
    select: { body: true, etag: true },
  })
  return docs[0] ?? null
}

// A known instance with no published story has no row. Its container is the
// same bytes on every request, so its ETag is stable.
async function emptyContainer(payload: Payload, settings: ReadSettings, read: Read) {
  if (read.key.kind !== 'container') return null
  const info = await instanceInfo({ payload, origin: settings.origin }, read)
  if (!info) return null
  const body = representations(info, [], settings.pageSize).get(variantOf(read.key))
  return body === undefined ? null : { body, etag: etagOf(body) }
}

function matches(header: string | null, etag: string): boolean {
  if (!header) return false
  return header.split(',').some((tag) => {
    const value = tag.trim()
    return value === '*' || value.replace(/^W\//, '') === etag
  })
}

function links(key: ReadKey): string {
  if (key.kind === 'story') return LINK_RESOURCE
  if (key.kind === 'container') return `${LINK_CONTAINER}, ${LINK_CONSTRAINED}`
  return LINK_CONSTRAINED
}
