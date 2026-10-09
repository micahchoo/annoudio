// Reply threads (Phase 5b), end to end: a member follows the player's Reply link on a bare
// host page, signs in and posts a reply on the Annotate page; the operator publishes it
// through the `stories` interface; the player shows the thread. Chromium, muted.

import { createServer, type Server } from 'node:http'

import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'

import { E2E_ORIGIN } from './env'
import { signIn } from './member'
import { toneResponse } from './tone'

const HOST = 'http://127.0.0.1:3196'
const PROJECT = 'river-voices'
const PARENT = '0192f3a4-7c1e-7b10-9d55-0000000000b1'

let recording: string
let host: Server
let interfaces: Awaited<typeof import('../../src/payload.config')>

/** The host site: one page with the snippet, and the audio. */
function startHost(): Promise<Server> {
  const server = createServer((request, response) => {
    if (request.url?.split('?')[0] === '/player.html') {
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

test.beforeAll(async () => {
  await seedTestUser()
  host = await startHost()
  interfaces = await import('../../src/payload.config')
  const { default: config, stories } = interfaces
  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  const payload = await getPayload({ config })
  const db = payload.db as unknown as { drizzle: { execute: (query: unknown) => Promise<unknown> } }
  await db.drizzle.execute(
    sql`truncate stories, _stories_v, story_representations, concepts, projects, projects_site_origins,
        recordings, recordings_other_urls, members, member_sessions, login_codes restart identity cascade`,
  )
  await payload.create({
    collection: 'projects',
    data: { name: 'River Voices', slug: PROJECT, siteOrigins: [{ origin: HOST }] },
  })
  const created = await payload.create({
    collection: 'recordings',
    data: { title: 'Ferry crossing, 1962', url: `${HOST}/ferry.m4a`, duration: 10 },
  })
  recording = String(created.id)
  const saved = await stories.saveDraft(
    { memberId: 'm-leela', nickname: 'Leela' },
    {
      id: PARENT,
      project: PROJECT,
      recording,
      start: 2,
      end: 4,
      bodies: [{ kind: 'text', value: 'My grandmother sang this on the ferry.' }],
    },
  )
  if (!saved.ok) throw new Error(`saveDraft failed: ${saved.error.code}`)
  await stories.publish({ operatorId: 'op-e2e' }, PARENT)
})

test.afterAll(async () => {
  await new Promise((resolve) => host?.close(resolve))
})

test('a member replies from the player, an operator publishes it, and the player shows the thread', async ({
  page,
  browser,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${HOST}/player.html`)
  const player = page.locator('annoudio-player')
  const story = player.locator('[part~="story"]')
  await expect(story).toHaveCount(1)

  // The Reply link of the open story goes to the Annotate page with replyTo.
  await story.getByRole('button').first().click()
  const reply = story.locator('[part~="reply-link"]')
  await expect(reply).toHaveAttribute(
    'href',
    new RegExp(`/annotate\\?.*&replyTo=${PARENT}&return=`),
  )
  await reply.click()
  await expect(page).toHaveURL(new RegExp(`^${E2E_ORIGIN}/annotate\\?`))

  // The form shows the story that the member answers. It has no time range and no topics.
  await expect(page.getByRole('heading', { name: 'Reply to a story' })).toBeVisible()
  await expect(page.getByText('My grandmother sang this on the ferry.')).toBeVisible()
  await expect(page.getByText('By Leela · 0:02–0:04')).toBeVisible()
  await signIn(page, 'ravi@example.org', 'Ravi')
  await expect(page.getByText('My grandmother sang this on the ferry.')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Start', exact: true })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Topics' })).toHaveCount(0)
  // React must own the form before a typed text is safe (design/phase3b-notes.md).
  await page.waitForLoadState('networkidle')
  await page
    .getByRole('textbox', { name: 'Reply', exact: true })
    .fill('My uncle steered that ferry.')
  await page.getByRole('button', { name: 'Send for review' }).click()

  // Back on the host page: the player opens the story and says that the reply waits for review.
  await page.waitForURL((url) => url.origin === HOST)
  const fragment = new URLSearchParams(new URL(page.url()).hash.slice(1))
  expect(Object.fromEntries(fragment)).toMatchObject({
    'annoudio-project': PROJECT,
    'annoudio-recording': recording,
    'annoudio-saved': 'draft',
    'annoudio-reply': PARENT,
  })
  await expect(player.locator('[part~="message"]')).toHaveText(
    'Your reply is sent. It shows here after review.',
  )
  await expect(story).toHaveAttribute('part', /\bactive\b/)
  await expect(player.locator('[part~="reply"]')).toHaveCount(0)

  // The review queue shows the reply with the story that it answers.
  const operator = await browser.newPage()
  await login({ page: operator, user: testUser })
  await operator.goto('/admin/collections/stories')
  const row = operator.locator('tbody tr')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('My uncle steered that ferry.')
  await expect(row).toContainText('Reply to: “My grandmother sang this on the ferry.”')
  await operator.getByRole('link', { name: 'My uncle steered that ferry.' }).click()
  // The story that the reply answers shows above it, read-only.
  const parent = operator.getByRole('region', { name: 'The story that this reply answers' })
  await expect(parent).toContainText('Story by Leela')
  await expect(parent).toContainText('My grandmother sang this on the ferry.')
  const panel = operator.getByRole('region', { name: 'The story', exact: true })
  await expect(panel).toContainText('My uncle steered that ferry.')
  await expect(operator.locator('audio')).toHaveCount(0)
  await operator.close()

  // The operator publishes the reply through the interface.
  const { stories } = interfaces
  const drafts = []
  for await (const annotation of stories.exportStories(
    { operatorId: 'op-e2e' },
    { reviewState: 'draft' },
  )) {
    drafts.push(annotation)
  }
  expect(drafts).toHaveLength(1)
  expect(drafts[0]).toMatchObject({
    motivation: 'replying',
    target: `${E2E_ORIGIN}/stories/${PROJECT}/${recording}/${PARENT}`,
  })
  const replyId = drafts[0].id.split('/').at(-1)!
  await stories.publish({ operatorId: 'op-e2e' }, replyId)

  // A visitor with an empty cache (a browser keeps the container up to 60 s) sees the thread.
  const visitor = await browser.newPage()
  visitor.on('pageerror', (error) => errors.push(error.message))
  await visitor.goto(`${HOST}/player.html`)
  const shown = visitor.locator('annoudio-player')
  await shown.locator('[part~="story"]').getByRole('button').first().click()
  await expect(shown.locator('[part~="reply"]')).toHaveCount(1)
  await expect(shown.locator('[part~="reply-text"]')).toHaveText('My uncle steered that ferry.')
  await expect(shown.locator('[part~="reply-meta"]')).toContainText('Ravi')
  await visitor.close()
  expect(errors).toEqual([])
})
