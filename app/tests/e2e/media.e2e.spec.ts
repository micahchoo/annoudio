// Media bodies on the Annotate page, against `next dev` and the test database. The
// server takes the `media.settled` reports (ANNOUDIO_MEDIA_CONSUMER=1). The test process
// runs the real worker with its fake adapters when a test needs a body to become ready:
// the fake transcoder copies the raw file, as ffmpeg would make the derived file.

import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'

import { expect, test, type Page } from '@playwright/test'

import { E2E_DATABASE_URL, E2E_MEDIA_DIR, E2E_ORIGIN } from './env'
import { toneResponse } from './tone'

const HOST = 'http://127.0.0.1:3198'
const PROJECT = 'river-voices'
const PHOTO = readFileSync(new URL('./fixtures/photo.jpg', import.meta.url))

type World = Awaited<ReturnType<typeof startWorld>>
let world: World
let recording: string
let host: Server

/** Payload in the test process, on the same database and MEDIA_DIR as the server. */
async function startWorld() {
  const { default: config, stories } = await import('../../src/payload.config')
  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  const worker = await import('annoudio-worker')
  const { PgBoss } = await import('pg-boss')
  const payload = await getPayload({ config })
  return {
    payload,
    stories,
    async seed(): Promise<string> {
      const db = payload.db as unknown as {
        drizzle: { execute: (query: unknown) => Promise<unknown> }
      }
      await db.drizzle.execute(
        sql`truncate stories, _stories_v, story_representations, concepts, projects, projects_site_origins,
            recordings, recordings_other_urls, members, member_sessions, login_codes, media restart identity cascade`,
      )
      // Jobs that the integration tests left name raw files in other folders.
      const boss = new PgBoss({
        connectionString: E2E_DATABASE_URL,
        supervise: false,
        schedule: false,
      })
      boss.on('error', (error) => console.error(error))
      await boss.start()
      await boss.deleteAllJobs()
      await boss.stop()
      await payload.create({
        collection: 'projects',
        data: { name: 'River Voices', slug: PROJECT },
      })
      const created = await payload.create({
        collection: 'recordings',
        data: { title: 'Ferry crossing, 1962', url: `${HOST}/ferry.m4a`, duration: 10 },
      })
      return String(created.id)
    },
    /** The real worker with the fake adapters. It reports through `media.settled`. */
    async startWorker() {
      const reporter = new PgBoss({
        connectionString: E2E_DATABASE_URL,
        supervise: false,
        schedule: false,
      })
      reporter.on('error', (error) => console.error(error))
      await reporter.start()
      const running = await worker.startWorker({
        databaseUrl: E2E_DATABASE_URL,
        mediaDir: E2E_MEDIA_DIR,
        transcoder: worker.fakeTranscoder(),
        prober: worker.fakeProber(),
        ...worker.settledReporter(reporter),
      })
      return async () => {
        await running.stop()
        await reporter.stop()
      }
    },
    async mediaRows() {
      return (
        await payload.find({ collection: 'media', depth: 0, pagination: false, sort: 'createdAt' })
      ).docs
    },
  }
}

/** The host site: the snippet page and the recording. */
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
    response.writeHead(request.url === '/favicon.ico' ? 204 : 404).end()
  })
  return new Promise((resolve) =>
    server.listen(Number(new URL(HOST).port), '127.0.0.1', () => resolve(server)),
  )
}

/** Sign in a new member through the forms. The code comes from the test mailbox. */
async function signIn(page: Page, email: string, nickname: string) {
  await page.goto(`/annotate?${new URLSearchParams({ project: PROJECT, recording, t: '2' })}`)
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByRole('button', { name: 'Send the code' }).click()
  await expect(page.getByRole('heading', { name: 'Type your login code' })).toBeVisible()
  const mail = (await (
    await page.request.get(`/test-mailbox?${new URLSearchParams({ to: email })}`)
  ).json()) as {
    text: string
  }
  await page
    .getByRole('textbox', { name: 'Login code' })
    .fill(/\b(\d{6})\b/.exec(mail.text)?.[1] ?? '')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill(nickname)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.member-menu summary')).toContainText(nickname)
  // The media controls need the page to be hydrated.
  await page.waitForLoadState('networkidle')
}

const attachment = (page: Page) => page.locator('.attachments li')

test.beforeAll(async () => {
  world = await startWorld()
  recording = await world.seed()
  host = await startHost()
})

test.afterAll(async () => {
  await new Promise((resolve) => host?.close(resolve))
})

test('a photo story: upload, save while processing, ready, publish, and the player shows the photo', async ({
  page,
}) => {
  await signIn(page, 'photo@example.org', 'Leela')
  await page.getByLabel('Attach a photo or a video').setInputFiles({
    name: 'ferry.jpg',
    mimeType: 'image/jpeg',
    buffer: PHOTO,
  })
  await expect(attachment(page)).toContainText('Processing. You can send the story now.')
  await expect(page.getByText('shows in the player after review and processing')).toBeVisible()
  await page.getByRole('textbox', { name: 'Start', exact: true }).fill('2')
  await page.getByRole('textbox', { name: 'End', exact: true }).fill('4')
  await page.getByRole('textbox', { name: 'Story', exact: true }).fill('The ferry at dawn.')
  await page.getByRole('button', { name: 'Send for review' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Sent.' })).toBeVisible()

  const [row] = await world.mediaRows()
  expect(row).toMatchObject({ kind: 'image', state: 'uploaded', format: 'image/jpeg' })
  const session = { memberId: row.member, nickname: 'Leela' }
  const [story] = await world.stories.ownDrafts(session, { project: PROJECT, recording })
  expect(story.bodies).toEqual([
    { kind: 'text', value: 'The ferry at dawn.' },
    { kind: 'image', media: row.id },
  ])
  await expect(world.stories.publish({ operatorId: 'op-e2e' }, story.id)).rejects.toMatchObject({
    code: 'media-not-ready',
  })

  const stopWorker = await world.startWorker()
  try {
    await expect
      .poll(async () => (await world.mediaRows())[0].state, { timeout: 20_000 })
      .toBe('ready')
  } finally {
    await stopWorker()
  }

  // Change the own story: the form keeps the photo, and a save keeps it in the story.
  await page.getByRole('link', { name: /^Change/ }).click()
  await expect(attachment(page)).toContainText('Ready')
  await page.waitForLoadState('networkidle')
  await page.getByRole('textbox', { name: 'Story', exact: true }).fill('The ferry at dawn, 1962.')
  await page.getByRole('button', { name: 'Send for review' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Sent.' })).toBeVisible()
  const [changed] = await world.stories.ownDrafts(session, { project: PROJECT, recording })
  expect(changed.bodies).toContainEqual({ kind: 'image', media: row.id })

  await world.stories.publish({ operatorId: 'op-e2e' }, story.id)
  await page.goto(`${HOST}/player.html`)
  const photo = page.locator('annoudio-player').locator('img[part~="story-media"]')
  await expect(photo).toHaveAttribute('src', `${E2E_ORIGIN}/media/${row.id}`)
  await expect(photo).toHaveAttribute('alt', 'The ferry at dawn, 1962.')
  await photo.scrollIntoViewIfNeeded()
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(64)
})

test('a voice note: record 1 s from the microphone, attach, upload, then the state turns ready', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['microphone'], { origin: E2E_ORIGIN })
  await signIn(page, 'voice@example.org', 'Ravi')
  const before = (await world.mediaRows()).length
  await page.getByRole('button', { name: 'Record a voice note' }).click()
  await expect(page.getByText(/^Recording: \d+ s$/)).toBeVisible()
  await page.waitForTimeout(1_000)
  await page.getByRole('button', { name: 'Stop the recording' }).click()
  await expect(page.getByText('Your recording')).toBeVisible()
  await page.getByRole('button', { name: 'Attach this voice note' }).click()
  await expect(attachment(page)).toContainText('Processing. You can send the story now.')

  const rows = await world.mediaRows()
  expect(rows).toHaveLength(before + 1)
  expect(rows.at(-1)).toMatchObject({ kind: 'sound', state: 'uploaded', format: 'audio/mp4' })
  expect(rows.at(-1)!.raw).toMatch(/^raw\/[0-9a-f-]{36}\.(webm|ogg|m4a)$/)
  expect(rows.at(-1)!.size).toBeGreaterThan(1000)

  // The page asks for the state every 3 s.
  const stopWorker = await world.startWorker()
  try {
    await expect(attachment(page)).toContainText('Ready', { timeout: 20_000 })
  } finally {
    await stopWorker()
  }
})

test('the tus route takes a 6 MB PATCH through Next as a stream, and refuses visitors', async ({
  page,
}) => {
  await signIn(page, 'large@example.org', 'Asha')
  const size = 6 * 1024 * 1024
  const metadata = `kind ${btoa('sound')},filetype ${btoa('audio/webm')}`
  const anonymous = await page.context().request.fetch('/media/upload', {
    method: 'POST',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(size),
      'Upload-Metadata': metadata,
      Cookie: '',
    },
  })
  expect(anonymous.status()).toBe(401)

  const created = await page.request.post('/media/upload', {
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(size),
      'Upload-Metadata': metadata,
    },
  })
  expect(created.status()).toBe(201)
  const location = created.headers()['location']
  const done = await page.request.patch(location, {
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Offset': '0',
      'Content-Type': 'application/offset+octet-stream',
    },
    data: Buffer.alloc(size, 7),
  })
  expect(done.status()).toBe(204)
  expect(done.headers()['upload-offset']).toBe(String(size))
  const id = location.split('/').at(-1)
  const row = (await world.mediaRows()).find((doc) => doc.id === id)
  expect(row).toMatchObject({ kind: 'sound', state: 'uploaded', size })
})
