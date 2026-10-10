// The admin as an operator uses it (Phase 5, design/phase0-operator-walkthrough.md): the
// dashboard count, the review queue, the read-only story panel, Publish, Return to the
// member, a concept under a parent, the SKOS download, a new recording with its probed
// length, and the snippet. Chromium, muted.

import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'

import { E2E_ORIGIN } from './env'
import { signIn } from './member'
import { serveTone } from './tone'

const HOST = 'http://127.0.0.1:3197'
const PROJECT = 'river-voices'
const FIRST = '0192f3a4-7c1e-7b10-9d55-0000000000a1'
const SECOND = '0192f3a4-7c1e-7b10-9d55-0000000000a2'
const THIRD = '0192f3a4-7c1e-7b10-9d55-0000000000a3'
/** The stories list with no filter in the address: the review queue. */
const QUEUE = /\/admin\/collections\/stories(\?(?!.*where)[^#]*)?$/

let page: Page
let recording: string
let interfaces: Awaited<typeof import('../../src/payload.config')>

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  await seedTestUser()
  interfaces = await import('../../src/payload.config')
  const { default: config, stories } = interfaces
  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  const payload = await getPayload({ config })
  const db = payload.db as unknown as { drizzle: { execute: (query: unknown) => Promise<unknown> } }
  await db.drizzle.execute(
    sql`truncate stories, _stories_v, story_representations, concepts, projects, projects_site_origins,
        recordings, recordings_other_urls, members, media restart identity cascade`,
  )
  const project = await payload.create({
    collection: 'projects',
    data: { name: 'River Voices', slug: PROJECT },
  })
  await payload.create({
    collection: 'concepts',
    data: {
      project: project.id,
      label: 'Transport',
      iri: `${E2E_ORIGIN}/vocab/${PROJECT}/c/transport`,
    },
  })
  const created = await payload.create({
    collection: 'recordings',
    data: { title: 'Ferry crossing, 1962', url: `${HOST}/ferry.m4a`, duration: 10 },
  })
  recording = String(created.id)
  const write = (memberId: string, nickname: string, id: string, text: string, start: number) =>
    stories.saveDraft(
      { memberId, nickname },
      {
        id,
        project: PROJECT,
        recording,
        start,
        end: start + 2,
        bodies: [{ kind: 'text', value: text }],
      },
    )
  await write('m-leela', 'Leela', FIRST, 'My grandmother sang this on the ferry.', 2)
  await write('m-ravi', 'Ravi', SECOND, 'The boat had a red sail.', 5)

  const context = await browser.newContext()
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: E2E_ORIGIN })
  page = await context.newPage()
  await serveTone(page, `${HOST}/*.m4a`)
  await login({ page, user: testUser })
})

test('Today says how many stories wait for review', async () => {
  await page.goto('/admin')
  await expect(page.getByText('2 stories wait for review.')).toBeVisible()
  await page.goto('/admin/collections/stories')
  await expect(page).toHaveURL(QUEUE)
})

test('the review queue shows the drafts in plain words, oldest first', async () => {
  await expect(page.getByRole('link', { name: /^Waiting for review/ })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('heading', { name: 'Review stories' })).toBeVisible()
  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('My grandmother sang this on the ferry.')
  await expect(rows.nth(0)).toContainText('Leela')
  await expect(rows.nth(0)).toContainText('Ferry crossing, 1962')
  await expect(rows.nth(0)).toContainText('River Voices')
  await expect(rows.nth(0)).toContainText('0:02–0:04')
  await expect(rows.nth(0)).toContainText('Waiting for review')
  await expect(rows.nth(1)).toContainText('Ravi')
  // Every row shows its state badge, not only the first (recordings audit, 1).
  for (const row of await rows.all()) {
    await expect(row.locator('.cell-lifecycle .ao-badge')).toHaveText('Waiting for review')
  }
  // Operators never write stories.
  await expect(page.getByRole('link', { name: /Create New/i })).toHaveCount(0)
})

test('Publish shows what visitors see, then the next waiting story opens', async () => {
  await page.getByRole('link', { name: 'My grandmother sang this on the ferry.' }).click()
  const panel = page.locator('.annoudio-story')
  await expect(panel).toContainText('Waiting for review. Visitors do not see it.')
  await expect(page.locator('.annoudio-status')).toContainText('Waiting for review')
  await expect(panel).toContainText('My grandmother sang this on the ferry.')
  await expect(panel).toContainText('Leela')
  await expect(panel).toContainText('0:02–0:04')
  await expect(panel.locator('audio')).toHaveAttribute('src', `${HOST}/ferry.m4a#t=2,4`)
  // No WADM editor, no API tab, no Versions tab, no Save draft.
  await expect(page.locator('.code-editor, .json-field')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'API' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Versions/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /draft/i })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Next story' })).toHaveAttribute(
    'href',
    `/admin/collections/stories/${SECOND}`,
  )

  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Publish this story?' })
  await expect(dialog).toContainText('Visitors see it like this in the widget, within one minute:')
  await expect(dialog).toContainText('Leela · 0:02–0:04')
  await expect(dialog).toContainText('My grandmother sang this on the ferry.')
  await expect(dialog).toContainText('We send no mail to Leela.')
  await dialog.getByRole('button', { name: 'Publish the story' }).click()
  await expect(page.getByText('Published. Visitors see it within one minute.')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/admin/collections/stories/${SECOND}$`))
  await expect(page.getByRole('heading', { name: 'The boat had a red sail.' })).toBeVisible()
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/stories/${PROJECT}/${recording}/`)).json()).total,
    )
    .toBe(1)
})

test('a published story has no Unpublish: Return or Remove take it down', async () => {
  await page.goto(`/admin/collections/stories/${FIRST}`)
  await expect(page.locator('.annoudio-status')).toContainText('Published')
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Return to the member' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible()
  // No document menu: no Unpublish, no Delete, no Create New.
  await expect(page.locator('.doc-controls__dots')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Unpublish/ })).toHaveCount(0)
})

test('History says who published the story, in browser time', async () => {
  await page.goto(`/admin/collections/stories/${FIRST}`)
  await page.getByRole('link', { name: 'History' }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/collections/stories/${FIRST}/versions$`))
  const lines = page.locator('.annoudio-history__lines li')
  await expect(lines.nth(0)).toContainText(`Published by ${testUser.email}`)
  await expect(lines.nth(1)).toContainText('Sent for review by Leela (member)')
  // The browser writes the time, in its own time zone.
  await expect(lines.nth(0).locator('time')).toHaveText(/\d{1,2} \w{3} \d{4}, \d{2}:\d{2}/)
})

test('an operator returns a story to the member with a reason', async () => {
  await page.goto(`/admin/collections/stories/${SECOND}`)
  await page.getByRole('button', { name: 'Return to the member' }).click()
  const dialog = page.getByRole('dialog', { name: 'Return this story to the member' })
  await dialog.getByRole('button', { name: 'Return the story' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Write the reason. The member sees it.')
  await dialog.getByLabel('Reason').fill('Please say where the boat was.')
  // The error goes once a reason is there.
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Return the story' }).click()
  await expect(page.getByText('Returned to the member.')).toBeVisible()
  // No story waits now: the empty Waiting for review tab, with our text only.
  await expect(page).toHaveURL(QUEUE)
  await expect(page.getByText('No stories wait for review.')).toBeVisible()
  await expect(page.locator('.no-results')).toBeHidden()

  const [own] = await interfaces.stories.ownDrafts(
    { memberId: 'm-ravi', nickname: 'Ravi' },
    { project: PROJECT, recording },
  )
  expect(own.rejection?.reason).toBe('Please say where the boat was.')
  await page.getByRole('link', { name: /^Returned/ }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody tr')).toContainText('Returned')
})

test('the member sees the reason on the Annotate page', async ({ browser }) => {
  const member = await (await browser.newContext()).newPage()
  await serveTone(member, `${HOST}/*.m4a`)
  await member.goto(`/annotate?project=${PROJECT}&recording=${recording}&t=6`)
  await signIn(member, 'mina@example.org', 'Mina')
  await member.waitForLoadState('networkidle')
  await member.getByRole('textbox', { name: 'End', exact: true }).fill('8')
  await member.getByRole('textbox', { name: 'Story', exact: true }).fill('Fish came in at six.')
  await member.getByRole('button', { name: 'Send for review' }).click()
  await expect(member.getByRole('heading', { name: /Your story is sent/ })).toBeVisible()

  await page.goto('/admin/collections/stories')
  await page.getByRole('link', { name: 'Fish came in at six.' }).click()
  await page.getByRole('button', { name: 'Return to the member' }).click()
  const dialog = page.getByRole('dialog', { name: 'Return this story to the member' })
  await dialog.getByLabel('Reason').fill('Which market was it?')
  await dialog.getByRole('button', { name: 'Return the story' }).click()
  await expect(page).toHaveURL(QUEUE)

  // From the done screen, "Tell another story" opens the form with the own stories.
  await member.getByRole('link', { name: 'Tell another story' }).click()
  const own = member.locator('.own li', { hasText: 'Fish came in at six.' })
  await expect(own).toContainText('Returned to you')
  await expect(own).toContainText('Reason: Which market was it?')
})

test('the Processing tab shows a story whose file is not ready; Publish is off', async () => {
  const media = '0192f3a4-7c1e-7b10-9d55-0000000000f1'
  const { getPayload } = await import('payload')
  const payload = await getPayload({ config: interfaces.default })
  await payload.delete({ collection: 'media', where: { id: { equals: media } } })
  await payload.create({
    collection: 'media',
    data: {
      id: media,
      member: 'm-leela',
      kind: 'image',
      state: 'uploaded',
      size: 1,
      raw: `raw/${media}.jpg`,
      format: 'image/jpeg',
    },
  })
  await interfaces.stories.saveDraft(
    { memberId: 'm-leela', nickname: 'Leela' },
    {
      id: THIRD,
      project: PROJECT,
      recording,
      start: 6,
      end: 7,
      bodies: [
        { kind: 'text', value: 'A photo of the ferry.' },
        { kind: 'image', media },
      ],
    },
  )
  await page.goto('/admin/collections/stories')
  await page.getByRole('link', { name: /^Processing/ }).click()
  const row = page.locator('tbody tr', { hasText: 'A photo of the ferry.' })
  await expect(row).toContainText('Processing')
  await row.getByRole('link', { name: 'A photo of the ferry.' }).click()
  await expect(
    page.getByRole('button', {
      name: 'Publish. The voice note, photo or video is still processing.',
    }),
  ).toBeDisabled()

  // The worker cannot use the file: a system return, which History names.
  await payload.update({ collection: 'media', id: media, data: { state: 'failed' } })
  await interfaces.stories.mediaSettled(media)
  await page.goto(`/admin/collections/stories/${THIRD}/versions`)
  await expect(page.locator('.annoudio-history__lines li').first()).toContainText(
    'Returned automatically: a file failed.',
  )
})

test('Remove removes the story for ever, after a confirmation', async () => {
  await page.goto(`/admin/collections/stories/${SECOND}`)
  await page.getByRole('button', { name: 'Remove' }).click()
  const dialog = page.getByRole('dialog', { name: 'Remove this story?' })
  await expect(dialog).toContainText('The story goes for ever, and we mail the member.')
  await dialog
    .getByLabel('Reason (optional). The member reads it in the mail.')
    .fill('A complaint.')
  await dialog.getByRole('button', { name: 'Remove the story' }).click()
  await expect(page.getByText('The story is removed.')).toBeVisible()
  expect(await interfaces.stories.review({ operatorId: 'op-test' }, SECOND)).toBeNull()
})

test('an operator adds a concept under a parent; the app makes its IRI', async () => {
  await page.goto('/admin/collections/concepts/create')
  await choose(page, 'project', 'River Voices')
  await page.locator('#field-label').fill('Ferry')
  await choose(page, 'parent', 'Transport')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('#field-iri')).toHaveValue(`${E2E_ORIGIN}/vocab/${PROJECT}/c/ferry`)

  // The tree is on the page of the list Topics (Lists → Open Topics).
  await page.goto(`/admin/concepts/${PROJECT}?list=topics`)
  await expect(
    page.locator('.annoudio-tree li[data-concept="Transport"] li[data-concept="Ferry"]'),
  ).toBeVisible()
})

test('an operator downloads the vocabulary as SKOS', async () => {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Turtle (.ttl)' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe(`${PROJECT}.ttl`)
  const turtle = await readFile((await file.path())!, 'utf8')
  expect(turtle).toContain(`<${E2E_ORIGIN}/vocab/${PROJECT}/c/ferry> a skos:Concept`)
  expect(turtle).toContain(`skos:broader <${E2E_ORIGIN}/vocab/${PROJECT}/c/transport>`)
})

test('the recording page probes the length and copies the snippet; the list has Add a widget', async () => {
  await page.goto('/admin/collections/recordings')
  await expect(page.getByRole('link', { name: 'Add a widget' })).toHaveAttribute(
    'href',
    '/admin/add-widget',
  )
  await expect(page.getByRole('link', { name: /Create New/i })).toHaveCount(0)
  const row = page.locator('tbody tr', { hasText: 'Ferry crossing, 1962' })
  // One published story; the returned one does not wait.
  await expect(row).toContainText('0:10')
  await expect(row.locator('td').filter({ hasText: /^1$/ })).toHaveCount(1)

  await row.getByRole('link', { name: 'Ferry crossing, 1962' }).click()
  await expect(page.getByText('The audio plays in this browser. Length: 0:10.')).toBeVisible()
  const expected =
    `<script async src="${E2E_ORIGIN}/embed/v1.js"></script>\n` +
    `<annoudio-player project="${PROJECT}" recording="${recording}" src="${HOST}/ferry.m4a"><audio controls preload="none" src="${HOST}/ferry.m4a"></audio></annoudio-player>`
  await expect(page.locator('.annoudio-snippet__code')).toHaveValue(expected)
  await page.getByRole('button', { name: 'Copy the snippet' }).click()
  await expect(page.getByText('Copied.')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected)
})

/** Pick an option of a Payload relationship field. */
async function choose(page: Page, field: string, option: string) {
  await page.locator(`#field-${field} .rs__control`).click()
  await page.locator('.rs__option', { hasText: option }).first().click()
}

