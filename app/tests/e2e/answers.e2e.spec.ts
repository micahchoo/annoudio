// The questions from end to end (design/vocab.md §7, §8): an operator adds "Place" from the
// catalogue and two items to its list Places; a member answers Place, Topics and an own
// answer on the Annotate page; the operator sees the answers on the review screen, adds
// "Ravi" to People, publishes; the widget on a host page shows "Place: North landing".
// Chromium, muted.

import { createServer, type Server } from 'node:http'

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'

import { E2E_ORIGIN } from './env'
import { signIn } from './member'
import { toneResponse } from './tone'

const HOST = 'http://127.0.0.1:3194'
const PROJECT = 'river-voices'

let operatorPage: Page
let recording: string
let host: Server
let storyId: string

/** The host site: one page with the snippet of the recording, and the audio. */
function startHost(): Promise<Server> {
  const server = createServer((request, response) => {
    if (request.url === '/ferry.html') {
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

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  host = await startHost()
  await seedTestUser()
  const app = await import('../../src/payload.config')
  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  const payload = await getPayload({ config: app.default })
  const db = payload.db as unknown as { drizzle: { execute: (query: unknown) => Promise<unknown> } }
  await db.drizzle.execute(
    sql`truncate stories, _stories_v, story_representations, concepts, projects, projects_site_origins,
        recordings, recordings_other_urls, members, member_sessions, login_codes restart identity cascade`,
  )
  const project = await payload.create({
    collection: 'projects',
    data: { name: 'River Voices', slug: PROJECT, language: 'en', siteOrigins: [{ origin: HOST }] },
  })
  // An item in Topics: the project asks Topics.
  await payload.create({
    collection: 'concepts',
    data: { project: project.id, label: 'Ferry', iri: `${E2E_ORIGIN}/vocab/${PROJECT}/c/ferry` },
  })
  recording = String(
    (
      await payload.create({
        collection: 'recordings',
        data: { title: 'Ferry crossing, 1962', url: `${HOST}/ferry.m4a`, duration: 10 },
      })
    ).id,
  )
  operatorPage = await (await browser.newContext()).newPage()
  await login({ page: operatorPage, user: testUser })
})

test.afterAll(async () => {
  await new Promise((resolve) => host?.close(resolve))
})

test('the operator adds Place from the catalogue and two items to the list Places', async () => {
  const page = operatorPage
  await page.goto('/admin/vocabulary')
  for (const question of ['Place', 'Who is speaking']) {
    await page.getByRole('button', { name: 'Add a question' }).click()
    await page
      .getByRole('dialog', { name: 'Add a question' })
      .getByRole('button', { name: question, exact: true })
      .click()
    await expect(page.locator(`[data-question="${question}"]`)).toBeVisible()
  }
  await page.goto(`/admin/concepts/${PROJECT}`)
  await expect(page.locator('[data-list="Places"]')).toContainText('asked by: Place')
  // "New item" + Add on the page of the list: the operator stays on the list (audit, 04).
  await page.goto(`/admin/concepts/${PROJECT}?list=places`)
  for (const label of ['North landing', 'South landing']) {
    await page.getByRole('textbox', { name: 'New item' }).fill(label)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator(`[data-concept="${label}"]`)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/admin/concepts/${PROJECT}\\?list=places$`))
  }
  await page.goto(`/admin/concepts/${PROJECT}`)
  await expect(page.locator('[data-list="Places"]')).toContainText('2 items')
})

test('a member answers Place, Topics and Who is speaking (an own answer)', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await page.goto(`/annotate?${new URLSearchParams({ project: PROJECT, recording, t: '2' })}`)
  await signIn(page, 'asha@example.org', 'Asha')
  await page.waitForLoadState('networkidle')
  await page.getByRole('textbox', { name: 'Start', exact: true }).fill('2')
  await page.getByRole('textbox', { name: 'End', exact: true }).fill('4')
  await page.getByRole('textbox', { name: 'Story', exact: true }).fill('My father ran this ferry.')
  const questions = page.locator('section.questions')
  await questions
    .getByRole('group', { name: 'Place (optional)' })
    .getByRole('checkbox', { name: 'North landing' })
    .check()
  await questions
    .getByRole('group', { name: 'Topics (optional)' })
    .getByRole('checkbox', { name: 'Ferry' })
    .check()
  await questions
    .getByRole('group', { name: 'Who is speaking (optional)' })
    .getByRole('textbox', { name: 'Not in the list? Type your own answer' })
    .fill('Ravi')
  storyId = await page.locator('input[name="id"]').inputValue()
  await page.getByRole('button', { name: 'Send for review' }).click()
  await page.waitForURL((url) => url.searchParams.get('saved') === '1')
  await page.context().close()
})

test('the operator sees the answers, adds "Ravi" to People, and publishes', async () => {
  const page = operatorPage
  await page.goto(`/admin/collections/stories/${storyId}`)
  const answers = page.locator('.annoudio-story__answers')
  await expect(answers.locator('.annoudio-story__answer')).toHaveText([
    'TopicsFerry',
    'PlaceNorth landing',
    /^Who is speakingRavi \(new\)/,
  ])
  await answers.getByRole('button', { name: 'Add "Ravi" to People' }).click()
  await expect(answers).toContainText('"Ravi" is in People now. This story keeps its own answer.')
  await expect(page.getByRole('link', { name: 'Add an item to Places' })).toBeVisible()
  const scan = await new AxeBuilder({ page }).include('.annoudio-story').analyze()
  expect(scan.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Publish this story?' })
    .getByRole('button', { name: 'Publish the story' })
    .click()
  await expect(page.getByText('Published. Visitors see it within one minute.')).toBeVisible()
})

test('the widget shows "Place: North landing", Topics as a tag, and the own answer', async ({
  browser,
}: {
  browser: Browser
}) => {
  const page = await (await browser.newContext()).newPage()
  await page.goto(`${HOST}/ferry.html`)
  const widget = page.locator('annoudio-player')
  const story = widget.locator('[part~="story"]').first()
  await expect(story.locator('[part~="story-text"]')).toHaveText('My father ran this ferry.')
  const field = (label: string) =>
    story
      .locator('[part~="field"]')
      .filter({ has: page.locator(`[part~="field-label"]:text-is("${label}")`) })
  await expect(field('Place').locator('[part~="field-value"]')).toHaveText('North landing')
  await expect(field('Who is speaking').locator('[part~="field-value"]')).toHaveText('Ravi')
  await expect(story.locator('li[part~="tag"]')).toHaveText(['Ferry'])
  const text = await story.locator('[part~="fields"]').innerText()
  expect(text.replace(/\s+/g, ' ')).toContain('Place North landing')
})
