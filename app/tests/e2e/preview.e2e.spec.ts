// The annotation process, seen from the admin alone (design/workflow-audit.md fixes 3–5):
// the operator opens a recording, selects "Try it: tell a story", tells a story as a
// member on the Annotate page (the range drawn and dragged on the waveform), comes back to
// the operator preview page of the widget, and reviews and publishes the story. Then a
// member comes from a website that is not on the list: the Annotate page says so, and the
// review screen offers "Add this website". Axe on each screen; screenshots go to
// design/rework-screens/. Chromium, muted.

import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'

import { E2E_ORIGIN } from './env'
import { signIn } from './member'
import { toneResponse } from './tone'

const HOST = 'http://127.0.0.1:3195'
const SCREENS = fileURLToPath(new URL('../../../design/rework-screens/', import.meta.url))
const PROJECT = 'river-voices'

let context: BrowserContext
let page: Page
let payload: import('payload').Payload
let recordingId = ''

test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

/** Axe on the page: no serious or critical violation; then a screenshot. */
async function check(name: string, target: Page = page) {
  await expect.poll(() => target.title()).not.toBe('')
  const result = await new AxeBuilder({ page: target }).analyze()
  const bad = result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(bad, `axe on "${name}"`).toEqual([])
  await target.screenshot({ path: `${SCREENS}${name}.png`, fullPage: true })
}

const widget = (target: Page) => target.locator('annoudio-player')
const part = (target: Page, name: string) => widget(target).locator(`[part~="${name}"]`)

test.beforeAll(async ({ browser }) => {
  mkdirSync(SCREENS, { recursive: true })
  await seedTestUser()
  const app = await import('../../src/payload.config')
  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  const { addRecording } = await import('../../src/modules/projects')
  payload = await getPayload({ config: app.default })
  const db = payload.db as unknown as { drizzle: { execute: (query: unknown) => Promise<unknown> } }
  await db.drizzle.execute(
    sql`truncate stories, _stories_v, story_representations, story_values, concepts, projects,
        projects_site_origins, recordings, recordings_other_urls, members, member_sessions,
        login_codes restart identity cascade`,
  )
  // One operator: the Operators list then shows its empty state ("You are the only operator.").
  await db.drizzle.execute(sql`delete from users where email <> ${testUser.email}`)
  await payload.create({
    collection: 'projects',
    data: {
      name: 'River Voices',
      slug: PROJECT,
      rights: 'cc-by-4.0',
      siteOrigins: [{ origin: 'https://rivervoices.example.org' }],
    },
  })
  const recording = await payload.create({
    collection: 'recordings',
    data: { title: 'Ferry crossing, 1962', url: `${HOST}/ferry.m4a`, duration: 10 },
  })
  recordingId = String(recording.id)
  await addRecording({ payload, origin: E2E_ORIGIN }, PROJECT, recordingId)

  context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.route(`${HOST}/*.m4a`, (route) =>
    route.fulfill(toneResponse(route.request().headers()['range'])),
  )
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: E2E_ORIGIN })
  page = await context.newPage()
  await login({ page, user: testUser })
})

test('the recording page shows its widget, the project with its stories, and Try it', async () => {
  await page.goto(`/admin/collections/recordings/${recordingId}`)
  await expect(page.getByText('Members tell stories about time ranges of this recording.')).toBeVisible()
  const widgets = page.getByRole('region', { name: 'Widgets of this recording' })
  await expect(widgets.getByRole('link', { name: /River Voices.*No stories yet/ })).toBeVisible()
  await expect(widgets.getByRole('link', { name: 'Add to a project' })).toBeVisible()
  await expect(widgets.getByText(`${E2E_ORIGIN}/annotate?project=${PROJECT}`)).toBeVisible()
  await check('01-recording-page')
})

test('Try it: the operator tells a story as a member; the range is drawn and dragged', async () => {
  await page.getByRole('link', { name: 'Try it: tell a story' }).first().click()
  await expect(page).toHaveURL(/\/annotate\?/)
  await expect(page.getByRole('link', { name: 'Back to the site' })).toBeVisible()
  await expect(page.locator('.moment').first()).toHaveText(
    'You tell a story about 0:00 of "Ferry crossing, 1962".',
  )
  await check('02-annotate-sign-in')
  await signIn(page, 'ravi.member@example.org', 'Ravi')

  // The new story starts at t and ends 10 s later, inside the length (workflow-audit 15).
  await expect(page.getByLabel('Start', { exact: true })).toHaveValue('0:00')
  await expect(page.getByLabel('End', { exact: true })).toHaveValue('0:10')
  await expect.poll(() => part(page, 'range').count()).toBe(1)
  await expect(page.locator('.moment')).toHaveText('Your story is about 0:00–0:10.')

  // A drag on the waveform marks a new range; the fields follow in m:ss (workflow-audit 16, 17).
  const wave = part(page, 'waveform')
  await expect(wave).toBeVisible()
  const box = (await wave.boundingBox())!
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width * 0.3, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.45, y, { steps: 6 })
  await page.mouse.move(box.x + box.width * 0.6, y, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByLabel('Start', { exact: true })).toHaveValue('0:03')
  await expect(page.getByLabel('End', { exact: true })).toHaveValue('0:06')
  await expect(page.locator('.moment')).toHaveText('Your story is about 0:03–0:06.')

  // Typed times move the range. "Use current time (0:0x)" names the time it writes.
  await page.getByLabel('End', { exact: true }).fill('0:07')
  await expect(page.locator('.moment')).toHaveText('Your story is about 0:03–0:07.')
  await expect(
    page.getByRole('button', { name: /^Start: use the current time, \d:\d\d$/ }),
  ).toHaveText(/^Use current time \(\d:\d\d\)$/)

  await page.getByRole('textbox', { name: 'Story' }).fill('The horn of the ferry, from the admin preview.')
  await check('03-annotate-form-range')
  await page.getByRole('button', { name: 'Send for review' }).click()

  // Back on the preview page of the widget, which says that the story is sent.
  await expect(page).toHaveURL(new RegExp(`/admin/preview/${PROJECT}/${recordingId}#annoudio-t=3`))
  await expect(part(page, 'message')).toContainText('Your story is sent. It shows here after review.')
  await expect(page.getByRole('heading', { level: 1, name: 'Ferry crossing, 1962 · River Voices' })).toBeVisible()
  await check('04-preview-page-sent')
})

test('the operator reviews the story: Told on is the preview page; Publish', async () => {
  await page.goto('/admin')
  await page.getByRole('link', { name: 'Start reviewing' }).first().click()
  await expect(page.getByText('This story is a note on 0:03–0:07 of "Ferry crossing, 1962".')).toBeVisible()
  await expect(page.getByText('The preview page of the admin (an operator tried the widget)')).toBeVisible()
  await expect(page.getByRole('link', { name: /Ravi.*1 story/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'River Voices' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ferry crossing, 1962' })).toBeVisible()
  await check('05-review-preview-story')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.getByRole('button', { name: 'Publish the story' }).click()
  await expect(page.getByText('Published. Visitors see it within one minute.')).toBeVisible()

  await page.goto(`/admin/preview/${PROJECT}/${recordingId}`)
  await expect(part(page, 'story-text')).toHaveText('The horn of the ferry, from the admin preview.')
  await expect(part(page, 'annotate-link')).toHaveText('Tell a story')
  await check('06-preview-page-published')
})

test('a website that is not on the list: the member is told; the operator adds it', async () => {
  const member = await context.newPage()
  await member.setViewportSize({ width: 390, height: 844 })
  const page2 = `${HOST}/stories/ferry.html`
  await member.goto(
    `/annotate?${new URLSearchParams({ project: PROJECT, recording: recordingId, t: '2', return: page2 })}`,
  )
  await expect(member.getByText('We cannot send you back to the page that you came from')).toBeVisible()
  await expect(member.getByRole('link', { name: 'Your stories' })).toBeVisible()
  await member.getByRole('textbox', { name: 'Story' }).fill('The landing, told from a site that is not listed.')
  await check('07-annotate-phone-not-listed', member)
  await member.getByRole('button', { name: 'Send for review' }).click()

  // The done screen (workflow-audit 19): the state and the next moves.
  await expect(member.getByRole('heading', { name: /Your story is sent/ })).toBeVisible()
  await expect(member.getByText('Your story will show on the site after review.')).toBeVisible()
  await expect(member.getByRole('link', { name: 'Tell another story' })).toBeVisible()
  await expect(member.locator('form')).toHaveCount(1) // only the member menu's Sign out
  await check('08-annotate-done-not-listed', member)

  await page.goto('/admin')
  await page.getByRole('link', { name: 'Start reviewing' }).first().click()
  await expect(page.getByText('127.0.0.1:3195 (not on the website list)')).toBeVisible()
  await check('09-review-not-listed')
  await page.getByRole('button', { name: 'Add this website' }).click()
  await expect(page.getByText('127.0.0.1:3195 is on the website list now.')).toBeVisible()
  const { docs } = await payload.find({ collection: 'projects', where: { slug: { equals: PROJECT } } })
  expect(docs[0].siteOrigins?.map((row) => row.origin)).toEqual([
    'https://rivervoices.example.org',
    HOST,
  ])
})

test('the project Overview lists the widget with its story count; Add a widget is the next move', async () => {
  await page.goto('/admin/collections/projects')
  await page.getByRole('link', { name: 'River Voices' }).click()
  await expect(page).toHaveURL(/\/overview$/)
  const widgets = page.getByRole('region', { name: 'Widgets of this project' })
  await expect(widgets.getByRole('link', { name: 'Ferry crossing, 1962' })).toBeVisible()
  // The count says what it counts, as the widget does (recordings audit, 09).
  await expect(widgets.getByRole('link', { name: '1 published · 1 waiting' })).toBeVisible()
  // Ravi is the operator trying the member steps: a test member, not counted.
  await expect(page.getByRole('link', { name: '0 members told stories here.' })).toBeVisible()
  await expect(widgets.getByRole('link', { name: 'Add a widget' })).toBeVisible()
  await check('10-project-overview')
})

test('the other admin screens: help lines, dropdowns, the colour picker; axe on each', async ({
  browser,
}) => {
  // The project: the Theme tab with the colour picker and the widget beside it.
  const { docs } = await payload.find({ collection: 'projects', where: { slug: { equals: PROJECT } } })
  await page.goto(`/admin/collections/projects/${docs[0].id}`)
  await expect(page.getByRole('combobox', { name: 'Language of the stories' })).toBeVisible()
  await page.getByRole('button', { name: 'Review and rights', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Review' })).toHaveValue('review')
  await expect(page.getByRole('combobox', { name: 'Rights line' })).toHaveValue('cc-by-4.0')
  await page.getByRole('button', { name: 'Theme', exact: true }).click()
  const accent = page.getByRole('textbox', { name: 'Accent colour', exact: true })
  await expect(page.getByText('Empty: the widget uses the default, #0b6e99.').first()).toBeVisible()
  await accent.fill('#8c8c8c')
  await expect(page.locator('#field-themeTokens__colorAccent-contrast')).toContainText(
    '3.4:1 on the background colour · too low for text, needs 4.5:1',
  )
  await accent.fill('#8a1c2b')
  await expect(page.locator('#field-themeTokens__colorAccent-contrast')).toContainText(
    'passes for text',
  )
  await expect(page.locator('.annoudio-theme-panel annoudio-player')).toHaveAttribute('annotate', 'link')
  await check('11-project-theme-colour-picker')
  await page.getByRole('combobox', { name: 'Start from' }).selectOption('dark')
  await expect(page.getByRole('textbox', { name: 'Background colour', exact: true })).toHaveValue('#222222')
  // The toast "…applied" fades in: axe reads a half-transparent title as low contrast.
  // Check the screen once the toast has settled.
  await expect(page.locator('.toast-title')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.getAnimations().every((animation) => animation.playState === 'finished'),
      ),
    )
    .toBe(true)
  await check('12-project-theme-dark-set')

  // Lists with their help and next move; the member page with the member's stories.
  await page.goto('/admin/collections/recordings')
  await expect(page.locator('.cell-projects')).toContainText('River Voices')
  await check('13-recordings-list')
  await page.goto('/admin/collections/members')
  // A member made in a browser with an operator session is a test member.
  await expect(page.locator('tbody tr', { hasText: 'Ravi' }).locator('.cell-test')).toHaveText('Test')
  await page.getByRole('link', { name: 'Ravi' }).click()
  await expect(page.locator('.annoudio-member__test')).toContainText('Test member')
  await expect(page.getByText('These are the stories that this member told about your recordings.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Waiting for review/ })).toBeVisible()
  await check('14-member-page')
  await page.goto('/admin/collections/users')
  await expect(page.getByText('You are the only operator.')).toBeVisible()
  await check('15-operators-empty-state')
  await page.goto('/admin/collections/stories')
  await check('16-review-list')
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  await expect(page.locator('.graphic-icon')).toHaveCount(0)
  await expect(page.locator('.annoudio-brand--icon')).toBeVisible()
  await check('17-today')

  // The sign-in screen: Sign in, Forgot your password? (concept-map W4).
  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto('/admin/login')
  await expect(visitor.getByRole('heading', { level: 1, name: 'Sign in to Annoudio' })).toBeVisible()
  // The stack's name in place of Payload's logo (recordings audit, 01).
  await expect(visitor.locator('.login__brand')).toHaveText('Annoudio')
  await expect(visitor.locator('.login__brand .graphic-logo')).toHaveCount(0)
  await expect(visitor.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await expect(visitor.getByRole('link', { name: 'Forgot your password?' })).toBeVisible()
  await check('18-sign-in', visitor)
})
