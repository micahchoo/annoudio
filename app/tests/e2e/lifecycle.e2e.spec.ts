// The whole story lifecycle (design/ia.md §6, F1–F7), as the people do it, on an empty
// stack: the first operator, the checklist, a recording on a bare host page, a member's
// story with a voice note (Chromium's fake microphone), Processing → Waiting, Publish with
// the preview and the next story, the mails in the memory mailbox, the widget, a reply,
// Return with a reason and a new send, Remove. Axe checks every screen: no serious or
// critical violation. A screenshot of each state goes to design/rework-screens/ (L…).
// Chromium, muted (playwright.config.ts).

import { mkdirSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { fileURLToPath } from 'node:url'

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

import { E2E_DATABASE_URL, E2E_MEDIA_DIR, E2E_ORIGIN } from './env'
import { toneResponse } from './tone'

const HOST = 'http://127.0.0.1:3196'
const HOST_PAGE = `${HOST}/stories/ferry.html`
const SCREENS = fileURLToPath(new URL('../../../design/rework-screens/', import.meta.url))
const SHOTS = new Set([
  'first-operator', 'today-empty-stack', 'add-widget-snippet', 'widget-empty', 'annotate-sign-in',
  'annotate-story-form', 'widget-after-send', 'your-stories-processing', 'today-two-waiting',
  'review-story', 'publish-dialog', 'widget-with-story', 'widget-thread', 'return-dialog',
  'annotate-returned', 'history', 'remove-dialog', 'your-account',
])
const OPERATOR = { email: 'ravi.operator@example.org', password: 'a long password for Ravi' }
const ASHA = 'asha@example.org'
const NOOR = 'noor@example.org'
const PHONE = { width: 390, height: 844 }
const LAPTOP = { width: 1280, height: 800 }

let host: Server
/** The snippet that the operator copied, as the host page shows it. */
let snippet = ''
let app: Awaited<typeof import('../../src/payload.config')>
let payload: import('payload').Payload
let operator: Page
let asha: Page
let shot = 0

test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

/** The host site: one page with the snippet (none before the paste), and the audio. */
function startHost(): Promise<Server> {
  const server = createServer((request, response) => {
    if (request.url?.startsWith('/stories/ferry.html')) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>River Voices: the ferry</title>
        <style>body { font: 18px/1.5 Georgia, serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; color: #222; }</style>
        </head><body><main><h1>The ferry, 1962</h1><p>Listen, and tell your story.</p>
        ${snippet}</main></body></html>`)
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

/** Axe on the page: no serious or critical violation. Then a screenshot of the state. */
async function check(page: Page, name: string, options: { axe?: boolean } = {}) {
  if (options.axe !== false) {
    // Next streams the metadata: the title can come after the content.
    await expect.poll(() => page.title()).not.toBe('')
    const result = await new AxeBuilder({ page }).analyze()
    const bad = result.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    expect(bad, `axe on "${name}"`).toEqual([])
  }
  // A screenshot of the key states only: design/rework-screens/ holds 40 at most.
  if (!SHOTS.has(name)) return
  shot += 1
  await page.screenshot({ path: `${SCREENS}L${String(shot).padStart(2, '0')}-${name}.png` })
}

/** The newest mail to this email, from the memory mailbox of the server. */
async function lastMail(page: Page, to: string) {
  const response = await page.request.get(`/test-mailbox?${new URLSearchParams({ to })}`)
  return (await response.json()) as { kind: string; subject: string; text: string } | null
}

async function memberContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: PHONE })
  await context.grantPermissions(['microphone'], { origin: E2E_ORIGIN })
  return context
}

/** Sign in on the Annotate page with the login code from the mailbox. */
async function signIn(page: Page, email: string, nickname?: string) {
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByRole('button', { name: 'Send the code' }).click()
  await expect(page.getByRole('heading', { name: 'Type your login code' })).toBeVisible()
  const code = /\b(\d{6})\b/.exec((await lastMail(page, email))?.text ?? '')?.[1] ?? ''
  await page.getByRole('textbox', { name: 'Login code' }).fill(code)
  await page.getByRole('button', { name: 'Sign in' }).click()
  if (nickname) {
    await page.getByRole('textbox', { name: 'Name' }).fill(nickname)
    await page.getByRole('button', { name: 'Continue' }).click()
  }
  await expect(page.locator('.member-menu summary')).toBeVisible()
}

/** A visitor with an empty browser cache opens the host page. */
async function visit(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext({ viewport: PHONE })).newPage()
  await page.goto(HOST_PAGE)
  return page
}

const player = (page: Page) => page.locator('annoudio-player')
const part = (page: Page, name: string) => player(page).locator(`[part~="${name}"]`)

test.beforeAll(async ({ browser }) => {
  mkdirSync(SCREENS, { recursive: true })
  host = await startHost()
  app = await import('../../src/payload.config')
  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  const { PgBoss } = await import('pg-boss')
  payload = await getPayload({ config: app.default })
  const db = payload.db as unknown as { drizzle: { execute: (query: unknown) => Promise<unknown> } }
  // An empty stack: no operator, no project, no recording, no story.
  await db.drizzle.execute(
    sql`truncate stories, _stories_v, story_representations, concepts, projects, projects_site_origins,
        recordings, recordings_other_urls, members, member_sessions, login_codes, media,
        users, users_sessions restart identity cascade`,
  )
  const boss = new PgBoss({ connectionString: E2E_DATABASE_URL, supervise: false, schedule: false })
  boss.on('error', (error) => console.error(error))
  await boss.start()
  await boss.deleteAllJobs()
  await boss.stop()

  const context = await browser.newContext({ viewport: LAPTOP })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: E2E_ORIGIN })
  operator = await context.newPage()
  asha = await (await memberContext(browser)).newPage()
})

test.afterAll(async () => {
  await new Promise((resolve) => host?.close(resolve))
})

test('F1: the first operator on an empty stack sees the checklist', async () => {
  await operator.goto('/admin')
  await expect(operator).toHaveURL(/\/admin\/create-first-user$/)
  await expect(operator.getByText('Make the first operator account')).toBeVisible()
  await check(operator, 'first-operator')
  await operator.locator('#field-email').fill(OPERATOR.email)
  await operator.locator('#field-password').fill(OPERATOR.password)
  await operator.locator('#field-confirm-password').fill(OPERATOR.password)
  await operator.getByRole('button', { name: 'Create' }).click()
  await expect(operator.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  await expect(
    operator.getByRole('heading', { name: 'Put your first widget on a site' }),
  ).toBeVisible()
  await check(operator, 'today-empty-stack')
})

test('F2: a recording goes on a site in 3 steps; the snippet goes on the host page', async () => {
  await operator.locator('.annoudio-work').getByRole('link', { name: 'Add a widget' }).click()
  // The steps are a client component: act after it hydrates (the first compile is slow).
  await operator.waitForLoadState('networkidle')
  await operator.getByLabel('Title').fill('Ferry crossing, 1962')
  await operator.getByLabel('Audio address').fill(`${HOST}/ferry.m4a`)
  await expect(operator.getByText('The audio plays in this browser. Length: 0:10.')).toBeVisible()
  await check(operator, 'add-widget-recording')
  await operator.getByRole('button', { name: 'Next', exact: true }).click()
  await operator.getByLabel('Name').fill('River Voices')
  await operator.getByLabel('Website address').fill(HOST)
  await check(operator, 'add-widget-site')
  await operator.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(operator.getByRole('heading', { name: 'Snippet', exact: true })).toBeFocused()
  await operator.getByRole('button', { name: 'Copy the snippet' }).click()
  await expect(operator.getByText('Copied.')).toBeVisible()
  snippet = await operator.evaluate(() => navigator.clipboard.readText())
  expect(snippet).toContain('<annoudio-player project="river-voices" recording="1"')
  await check(operator, 'add-widget-snippet')

  // The project gets a rights statement, so the widget and the Annotate page show it.
  const [project] = (await payload.find({ collection: 'projects' })).docs
  await payload.update({ collection: 'projects', id: project.id, data: { rights: 'cc-by-4.0' } })

  await operator.getByRole('link', { name: 'Done' }).click()
  await expect(operator.locator('[data-step="recording"]')).toHaveAttribute('data-done', 'true')
  await operator.waitForLoadState('networkidle')
  await operator.getByRole('button', { name: 'I pasted it' }).click()
  await expect(operator.locator('[data-step="snippet"]')).toHaveAttribute('data-done', 'true')
  await check(operator, 'today-three-steps-done')
})

test('a visitor sees the empty widget: no stories yet, Tell a story, the rights line', async ({
  browser,
}) => {
  const visitor = await visit(browser)
  await expect(part(visitor, 'message')).toHaveText('No stories yet. Tell the first one.')
  await expect(part(visitor, 'annotate-link')).toHaveText('Tell a story')
  await expect(part(visitor, 'rights')).toHaveText('Stories on this page are shared under CC BY 4.0.')
  await check(visitor, 'widget-empty')
})

test('F3: Asha tells a story with a voice note, then a second story', async () => {
  await asha.goto(HOST_PAGE)
  await part(asha, 'annotate-link').click()
  await expect(asha).toHaveURL(/\/annotate\?/)
  await expect(asha.getByText('You tell a story about 0:00 of "Ferry crossing, 1962".')).toBeVisible()
  await check(asha, 'annotate-sign-in')
  await signIn(asha, ASHA, 'Asha')
  await asha.waitForLoadState('networkidle')
  await check(asha, 'annotate-story-form')

  await asha.getByRole('textbox', { name: 'Start', exact: true }).fill('0:02')
  await asha.getByRole('textbox', { name: 'End', exact: true }).fill('0:05')
  await asha
    .getByRole('textbox', { name: 'Story', exact: true })
    .fill('My father worked the ferry. The horn meant the last boat.')
  await asha.getByRole('button', { name: 'Record a voice note' }).click()
  await asha.waitForTimeout(1_000)
  await asha.getByRole('button', { name: 'Stop the voice note' }).click()
  await asha.getByRole('button', { name: 'Attach this voice note' }).click()
  await expect(asha.locator('.attachments li')).toContainText(
    'Processing. You can send the story now.',
  )
  await check(asha, 'annotate-voice-note-attached')
  await asha.getByRole('button', { name: 'Send for review' }).click()
  await asha.waitForURL((url) => url.origin === HOST)
  await expect(part(asha, 'message')).toHaveText('Your story is sent. It shows here after review.')
  await check(asha, 'widget-after-send')

  // A second story, text only: it waits for review at once.
  await part(asha, 'annotate-link').click()
  await asha.waitForLoadState('networkidle')
  await asha.getByRole('textbox', { name: 'Start', exact: true }).fill('0:06')
  await asha.getByRole('textbox', { name: 'End', exact: true }).fill('0:08')
  await asha
    .getByRole('textbox', { name: 'Story', exact: true })
    .fill('The boat had a red sail, and the river smelled of rain.')
  await asha.getByRole('button', { name: 'Send for review' }).click()
  await asha.waitForURL((url) => url.origin === HOST)

  await asha.goto('/annotate/mine')
  await expect(asha.locator('section[data-group="processing"] li.card')).toHaveCount(1)
  await expect(asha.locator('section[data-group="waiting"] li.card')).toHaveCount(1)
  await check(asha, 'your-stories-processing')
})

test('Processing → Waiting: Today shows both; the worker makes the voice note ready', async () => {
  await operator.goto('/admin')
  await expect(operator.getByText('1 story waits for review.')).toBeVisible()
  await expect(operator.getByText(/1 story is processing/)).toBeVisible()
  await check(operator, 'today-one-processing')

  const worker = await import('annoudio-worker')
  const { PgBoss } = await import('pg-boss')
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
  try {
    await expect
      .poll(async () => (await app.stories.counts()).waiting.stories, { timeout: 30_000 })
      .toBe(2)
  } finally {
    await running.stop()
    await reporter.stop()
  }
})

test('F3: the operator publishes from Today with the preview; the next story opens; M3', async () => {
  await operator.goto('/admin')
  await expect(operator.getByText('2 stories wait for review.')).toBeVisible()
  await check(operator, 'today-two-waiting')
  await operator.getByRole('link', { name: 'Start reviewing' }).click()
  await expect(operator.getByRole('heading', { name: /My father worked the ferry/ })).toBeVisible()
  await expect(operator.locator('.annoudio-status')).toContainText('Waiting for review')
  await expect(operator.locator('.annoudio-story__media')).toContainText('Voice note: Ready')
  await check(operator, 'review-story')

  await operator.getByRole('button', { name: 'Publish', exact: true }).click()
  const dialog = operator.getByRole('dialog', { name: 'Publish this story?' })
  await expect(dialog).toContainText('Asha · 0:02–0:05')
  await expect(dialog).toContainText('We mail Asha that it is published.')
  await check(operator, 'publish-dialog')
  await dialog.getByRole('button', { name: 'Publish the story' }).click()
  await expect(operator.getByText('Published. Visitors see it within one minute.')).toBeVisible()
  await expect(operator.getByRole('heading', { name: /The boat had a red sail/ })).toBeVisible()
  await check(operator, 'next-story-opens')

  const mail = await lastMail(operator, ASHA)
  expect(mail).toMatchObject({ kind: 'published', subject: 'Your story is published' })
  expect(mail?.text).toContain(`Listen on the site: ${HOST_PAGE}#annoudio-t=2&`)
})

test('F3, H8: the widget shows the published story with its voice note', async ({ browser }) => {
  const visitor = await visit(browser)
  await expect(part(visitor, 'story')).toHaveCount(1)
  await expect(part(visitor, 'story-meta')).toContainText('Asha')
  await expect(part(visitor, 'story-media')).toHaveCount(1)
  await check(visitor, 'widget-with-story')
})

test('F6: Noor replies; the operator publishes the reply; M4 to Asha; the thread shows', async ({
  browser,
}) => {
  const noor = await (await memberContext(browser)).newPage()
  await noor.goto(HOST_PAGE)
  await part(noor, 'story').first().getByRole('button').first().click()
  await part(noor, 'reply-link').click()
  await expect(noor.getByText('You reply to the story by Asha.')).toBeVisible()
  await signIn(noor, NOOR, 'Noor')
  await noor.waitForLoadState('networkidle')
  await noor
    .getByRole('textbox', { name: 'Reply', exact: true })
    .fill('My uncle steered that ferry.')
  await check(noor, 'annotate-reply-form')
  await noor.getByRole('button', { name: 'Send for review' }).click()
  await noor.waitForURL((url) => url.origin === HOST)
  await expect(part(noor, 'message')).toHaveText('Your reply is sent. It shows here after review.')

  await operator.goto('/admin/collections/stories')
  await expect(
    operator.locator('tbody tr', { hasText: 'My uncle steered that ferry.' }),
  ).toContainText('Reply to:')
  await check(operator, 'review-list')
  await operator.getByRole('link', { name: 'My uncle steered that ferry.' }).click()
  await expect(
    operator.getByRole('region', { name: 'The story that this reply answers' }),
  ).toContainText('My father worked the ferry.')
  await check(operator, 'review-reply')
  await operator.getByRole('button', { name: 'Publish', exact: true }).click()
  await operator
    .getByRole('dialog', { name: 'Publish this reply?' })
    .getByRole('button', { name: 'Publish the reply' })
    .click()
  await expect(operator.getByText('Published. Visitors see it within one minute.')).toBeVisible()

  expect(await lastMail(operator, ASHA)).toMatchObject({
    kind: 'replied',
    subject: 'Noor replied to your story',
  })
  expect(await lastMail(operator, NOOR)).toMatchObject({
    kind: 'published',
    subject: 'Your reply is published',
  })

  const visitor = await visit(browser)
  await part(visitor, 'story').first().getByRole('button').first().click()
  await expect(part(visitor, 'reply')).toHaveCount(1)
  await expect(part(visitor, 'reply-text')).toHaveText('My uncle steered that ferry.')
  await check(visitor, 'widget-thread')
})

test('F4: Return with a reason; Asha sees Returned and M2; she sends it again', async () => {
  await operator.goto('/admin/collections/stories')
  await operator.getByRole('link', { name: /The boat had a red sail/ }).click()
  await operator.getByRole('button', { name: 'Return to the member' }).click()
  const dialog = operator.getByRole('dialog', { name: 'Return this story to the member' })
  await dialog.getByLabel('Reason').fill('Please say where the boat was.')
  await check(operator, 'return-dialog')
  await dialog.getByRole('button', { name: 'Return the story' }).click()
  await expect(operator.getByText('Returned to the member.')).toBeVisible()

  const mail = await lastMail(operator, ASHA)
  expect(mail).toMatchObject({ kind: 'returned', subject: 'Your story needs a change' })
  expect(mail?.text).toContain('Reason: Please say where the boat was.')
  const link = /Change your story: (\S+)/.exec(mail?.text ?? '')?.[1] ?? ''
  expect(link).toContain(`${E2E_ORIGIN}/annotate?`)

  await asha.goto(link)
  // A returned story: the page says "Change your story", and the button "Send again".
  await expect(asha.getByRole('heading', { level: 1 })).toHaveText('Change your story')
  await expect(asha.getByRole('heading', { name: /Your story/ })).toContainText('Returned to you')
  await expect(asha.locator('.status')).toContainText('Reason: Please say where the boat was.')
  await check(asha, 'annotate-returned')
  await asha.waitForLoadState('networkidle')
  await asha
    .getByRole('textbox', { name: 'Story', exact: true })
    .fill('The boat had a red sail, near the old jetty, and the river smelled of rain.')
  await expect(asha.getByRole('button', { name: 'Send for review' })).toHaveCount(0)
  await asha.getByRole('button', { name: 'Send again' }).click()
  await asha.waitForURL((url) => url.origin === HOST)

  await asha.goto('/annotate/mine')
  const card = asha.locator('section[data-group="waiting"] li.card', { hasText: 'near the old jetty' })
  await expect(card).toContainText('Sent again')
  // Each card has the time of its last save.
  await expect(card.locator('.saved time')).toHaveText(/\d{1,2} \w{3} \d{4}, \d{2}:\d{2}/)
  await check(asha, 'your-stories-sent-again')
  const memberWaiting = await card
    .locator('.state[data-state="waiting"]')
    .first()
    .evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color])

  await operator.goto('/admin/collections/stories')
  const row = operator.locator('tbody tr', { hasText: 'The boat had a red sail' })
  await expect(row).toContainText('Sent again')
  // The member's badge has the colours of the operator's badge (design-system.md §3.4).
  const operatorWaiting = await row
    .locator('.ao-badge--waiting')
    .first()
    .evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color])
  expect(memberWaiting).toEqual(operatorWaiting)
  await operator.getByRole('link', { name: /The boat had a red sail/ }).click()
  await expect(operator.locator('.annoudio-status')).toContainText('Sent again')
  await check(operator, 'review-sent-again')
  await operator.getByRole('link', { name: 'History' }).click()
  await expect(operator.locator('.annoudio-history__lines li').nth(1)).toContainText(
    `Returned by ${OPERATOR.email}: Please say where the boat was.`,
  )
  await check(operator, 'history')
})

test('F7: Remove takes the story away for ever; M5', async ({ browser }) => {
  await operator.goto('/admin/collections/stories')
  await operator.getByRole('link', { name: /The boat had a red sail/ }).click()
  await operator.getByRole('button', { name: 'Remove' }).click()
  const dialog = operator.getByRole('dialog', { name: 'Remove this story?' })
  await dialog
    .getByLabel('Reason (optional). The member reads it in the mail.')
    .fill('Asha asked us to.')
  await check(operator, 'remove-dialog')
  await dialog.getByRole('button', { name: 'Remove the story' }).click()
  await expect(operator.getByText('The story is removed.')).toBeVisible()
  await expect(operator.getByText('No stories wait for review.')).toBeVisible()
  await check(operator, 'review-queue-empty')

  expect(await lastMail(operator, ASHA)).toMatchObject({
    kind: 'removed',
    subject: 'Your story is removed',
  })
  await asha.goto('/annotate/mine')
  await expect(asha.locator('li.card', { hasText: 'red sail' })).toHaveCount(0)
  await check(asha, 'your-stories-after-remove')
  const visitor = await visit(browser)
  await expect(part(visitor, 'story')).toHaveCount(1)
})

test('Your account; Today on a normal day', async () => {
  await asha.goto('/annotate/account')
  await expect(asha.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible()
  await check(asha, 'your-account')

  await operator.goto('/admin')
  await expect(
    operator.getByRole('heading', { name: 'Put your first widget on a site' }),
  ).toHaveCount(0)
  await expect(operator.getByText('No stories wait for review.')).toBeVisible()
  await check(operator, 'today-normal-day')
})
