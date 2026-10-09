// The player and its files as the app serves them (CONTRACT.md §3.2, §5.1), against
// `next dev` and the test database. The host page is on another origin, as on a real
// host site, so every request to the app is a cross-origin request. The host is a real
// server on 127.0.0.1: Chromium blocks requests to localhost from a page that Playwright
// routing serves (Local Network Access), so a routed host page cannot load the loader.

import { createServer, type Server } from 'node:http'

import { expect, test, type APIResponse } from '@playwright/test'

import { E2E_ORIGIN } from './env'
import { toneResponse } from './tone'

const HOST = 'http://127.0.0.1:3199'
const PROJECT = 'river-voices'
const STORY = '0192f3a4-7c1e-7b10-9d55-000000000001'

let recording: string
let host: Server

/** The host site: one page with the snippet, and the audio. */
function startHost(): Promise<Server> {
  const server = createServer((request, response) => {
    if (request.url === '/player.html') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return response.end(`<!doctype html><html lang="en"><title>Host</title>
        <script async src="${E2E_ORIGIN}/embed/v1.js"></script>
        <annoudio-player project="${PROJECT}" recording="${recording}" src="${HOST}/ferry.m4a"></annoudio-player>`)
    }
    if (request.url === '/ferry.m4a') {
      const tone = toneResponse(request.headers.range)
      response.writeHead(tone.status, { ...tone.headers, 'Content-Length': tone.body.length })
      return response.end(request.method === 'HEAD' ? undefined : tone.body)
    }
    // The browser also asks for /favicon.ico. A 404 would show as a console error.
    response.writeHead(request.url === '/favicon.ico' ? 204 : 404).end()
  })
  return new Promise((resolve) =>
    server.listen(Number(new URL(HOST).port), '127.0.0.1', () => resolve(server)),
  )
}

test.afterAll(async () => {
  await new Promise((resolve) => host?.close(resolve))
})

test.beforeAll(async () => {
  host = await startHost()
  const { default: config, stories } = await import('../../src/payload.config')
  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  const payload = await getPayload({ config })
  const db = payload.db as unknown as { drizzle: { execute: (query: unknown) => Promise<unknown> } }
  await db.drizzle.execute(
    sql`truncate stories, _stories_v, story_representations, concepts, projects, projects_site_origins,
        recordings, recordings_other_urls restart identity cascade`,
  )
  await payload.create({
    collection: 'projects',
    data: {
      name: 'River Voices',
      slug: PROJECT,
      themeTokens: { colorAccent: '#8a1c2b', radius: '0px' },
    },
  })
  const created = await payload.create({
    collection: 'recordings',
    data: { title: 'Ferry crossing, 1962', url: `${HOST}/ferry.m4a`, duration: 10 },
  })
  recording = String(created.id)
  const saved = await stories.saveDraft(
    { memberId: 'm-e2e', nickname: 'Leela' },
    {
      id: STORY,
      project: PROJECT,
      recording,
      start: 2,
      end: 4,
      bodies: [{ kind: 'text', value: 'My grandmother sang this on the ferry.' }],
    },
  )
  if (!saved.ok) throw new Error(`saveDraft failed: ${saved.error.code}`)
  await stories.publish({ operatorId: 'op-e2e' }, STORY)
})

const header = (response: APIResponse, name: string) => response.headers()[name.toLowerCase()]

test.describe('response headers (CONTRACT.md §5.1)', () => {
  test('the loader and the bundle: CORS, CORP, nosniff, JavaScript, and their cache rules', async ({
    request,
  }) => {
    const loader = await request.get('/embed/v1.js')
    expect(loader.status()).toBe(200)
    expect(loader.headers()).toMatchObject({
      'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
      'access-control-allow-origin': '*',
      'cross-origin-resource-policy': 'cross-origin',
      'x-content-type-options': 'nosniff',
      'content-type': 'text/javascript; charset=utf-8',
    })
    expect(header(loader, 'etag')).toBeTruthy()

    const bundle = /\/embed\/v1\/[0-9a-f]{12}\/player\.js/.exec(await loader.text())?.[0]
    expect(bundle).toBeTruthy()
    const response = await request.get(bundle!)
    expect(response.status()).toBe(200)
    expect(response.headers()).toMatchObject({
      'cache-control': 'public, max-age=31536000, immutable',
      'access-control-allow-origin': '*',
      'cross-origin-resource-policy': 'cross-origin',
      'x-content-type-options': 'nosniff',
      'content-type': 'text/javascript; charset=utf-8',
    })
  })

  test('the theme JSON: only the set tokens, CORS, the cache rule and an ETag; 404 for an unknown project', async ({
    request,
  }) => {
    const theme = await request.get(`/embed/v1/themes/${PROJECT}.json`)
    expect(theme.status()).toBe(200)
    expect(await theme.json()).toEqual({
      tokens: { 'color-accent': '#8a1c2b', radius: '0px' },
      name: 'River Voices',
    })
    expect(theme.headers()).toMatchObject({
      'cache-control': 'public, max-age=300, stale-while-revalidate=86400',
      'access-control-allow-origin': '*',
      'cross-origin-resource-policy': 'cross-origin',
      'x-content-type-options': 'nosniff',
    })
    const etag = header(theme, 'etag')
    const again = await request.get(`/embed/v1/themes/${PROJECT}.json`, {
      headers: { 'If-None-Match': etag },
    })
    expect(again.status()).toBe(304)

    const unknown = await request.get('/embed/v1/themes/nope.json')
    expect(unknown.status()).toBe(404)
    expect(header(unknown, 'cache-control')).toBe('public, max-age=60')
    expect(header(unknown, 'access-control-allow-origin')).toBe('*')
  })

  test('the recording JSON (§5.2): id, title, url, duration, CORS and the cache rule; 404', async ({
    request,
  }) => {
    const found = await request.get(`/embed/v1/recordings/${PROJECT}/${recording}.json`)
    expect(found.status()).toBe(200)
    expect(await found.json()).toMatchObject({ id: recording, title: expect.any(String) })
    expect(found.headers()).toMatchObject({
      'cache-control': 'public, max-age=300, stale-while-revalidate=86400',
      'access-control-allow-origin': '*',
      etag: expect.any(String),
    })
    const unknown = await request.get(`/embed/v1/recordings/nope/${recording}.json`)
    expect(unknown.status()).toBe(404)
    expect(header(unknown, 'access-control-allow-origin')).toBe('*')
  })

  test('public routes send no Payload client hints; the admin still does', async ({ request }) => {
    for (const path of [
      '/embed/v1.js',
      `/stories/${PROJECT}/${recording}/`,
      `/embed/v1/themes/${PROJECT}.json`,
    ]) {
      const response = await request.get(path)
      expect(header(response, 'critical-ch'), path).toBeUndefined()
      expect(header(response, 'accept-ch'), path).toBeUndefined()
      expect(header(response, 'vary') ?? '', path).not.toContain('Sec-CH-Prefers-Color-Scheme')
    }
    const admin = await request.get('/admin/login')
    expect(header(admin, 'critical-ch')).toBe('Sec-CH-Prefers-Color-Scheme')
  })
})

test('the snippet on a host page shows the published story from the real routes, with the project theme', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    const w = window as unknown as { ready?: unknown }
    window.addEventListener('annoudio:ready', (event) => {
      w.ready = (event as CustomEvent).detail
    })
  })
  await page.goto(`${HOST}/player.html`)

  await expect
    .poll(() => page.evaluate(() => (window as unknown as { ready?: unknown }).ready))
    .toMatchObject({ project: PROJECT, recording, stories: 1 })
  const player = page.locator('annoudio-player')
  await expect(player.locator('[part~="story-text"]')).toHaveText(
    'My grandmother sang this on the ferry.',
  )
  await expect(player.locator('[part~="story-meta"]')).toContainText('Leela')
  // The project theme from the admin reaches the player.
  await expect(player.locator('[part~="play-button"]')).toHaveCSS(
    'background-color',
    'rgb(138, 28, 43)',
  )
  await expect(player.locator('[part~="annotate-link"]')).toHaveAttribute(
    'href',
    new RegExp(`^${E2E_ORIGIN}/annotate\\?project=${PROJECT}&recording=${recording}&t=0&return=`),
  )
  expect(errors).toEqual([])
})
