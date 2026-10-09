// Put a recording on a site (O7, design/ia.md §4.1): Today → 1 Recording → 2 Site →
// 3 Snippet, with the inline project form on a stack with no project, and with a project.
// Chromium, muted.

import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'

import { E2E_ORIGIN } from './env'
import { serveTone } from './tone'

const HOST = 'http://127.0.0.1:3197'

let page: Page
let payload: import('payload').Payload

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  await seedTestUser()
  const app = await import('../../src/payload.config')
  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  payload = await getPayload({ config: app.default })
  const db = payload.db as unknown as { drizzle: { execute: (query: unknown) => Promise<unknown> } }
  await db.drizzle.execute(
    sql`truncate stories, _stories_v, story_representations, concepts, projects, projects_site_origins,
        recordings, recordings_other_urls, members restart identity cascade`,
  )
  const context = await browser.newContext()
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: E2E_ORIGIN })
  page = await context.newPage()
  await serveTone(page, `${HOST}/*.m4a`)
  await login({ page, user: testUser })
})

test('with no project: Today → new recording → inline project → the snippet', async () => {
  await page.goto('/admin')
  await page.getByRole('link', { name: 'Add a player' }).first().click()
  await expect(page).toHaveURL(/\/admin\/add-player$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Put a recording on a site' }),
  ).toBeVisible()

  // Step 1: the catalogue is empty, so only "New recording".
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('.annoudio-wizard').getByRole('alert')).toHaveText('Type a title.')
  await page.getByLabel('Title').fill('Ferry crossing, 1962')
  await page.getByLabel('Audio address').fill('ftp://example.org/ferry.m4a')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('.annoudio-wizard').getByRole('alert')).toContainText(
    'Use a full https address',
  )
  await page.getByLabel('Audio address').fill(`${HOST}/ferry.m4a`)
  await expect(page.getByText('The audio plays in this browser. Length: 0:10.')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 2: no project yet, so the inline form.
  const site = page.getByRole('heading', { name: '2 Site' })
  await expect(site).toBeFocused()
  await page.getByLabel('Name').fill('River Voices')
  await page.getByLabel('Website address').fill('rivervoices')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('.annoudio-wizard').getByRole('alert')).toContainText(
    'Type the website address',
  )
  await page.getByLabel('Website address').fill('https://rivervoices.example.org')
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 3: the snippet holds the project, the recording and the audio address.
  await expect(page.getByRole('heading', { name: '3 Snippet' })).toBeFocused()
  const expected =
    `<script async src="${E2E_ORIGIN}/embed/v1.js"></script>\n` +
    `<annoudio-player project="river-voices" recording="1" src="${HOST}/ferry.m4a"></annoudio-player>`
  await expect(page.locator('.annoudio-snippet__code')).toHaveText(expected)
  await page.getByRole('button', { name: 'Copy the snippet' }).click()
  await expect(page.getByText('Copied.')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected)
  await expect(page.getByText('Members come back only to rivervoices.example.org.')).toBeVisible()
  await expect(
    page.getByText('WordPress or Omeka S: type the recording number 1 in the block.'),
  ).toBeVisible()
  await expect(page.locator('annoudio-player')).toHaveAttribute('project', 'river-voices')

  const recording = await payload.findByID({ collection: 'recordings', id: 1 })
  expect(recording).toMatchObject({ title: 'Ferry crossing, 1962', duration: 10 })

  await page.getByRole('link', { name: 'Done' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.locator('[data-step="project"]')).toHaveAttribute('data-done', 'true')
  await expect(page.locator('[data-step="recording"]')).toHaveAttribute('data-done', 'true')
})

test('with one project: choose a recording, the site is set, the snippet', async () => {
  await payload.create({
    collection: 'recordings',
    data: { title: 'Harvest song', url: `${HOST}/harvest.m4a`, duration: 10 },
  })
  await page.goto('/admin/add-player')
  await page.getByLabel('Search the recordings').fill('harv')
  await expect(page.getByRole('radio', { name: 'Ferry crossing, 1962' })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Harvest song' }).check()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('.annoudio-wizard__done').last()).toContainText('Site: River Voices')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('.annoudio-snippet__code')).toContainText(
    `<annoudio-player project="river-voices" recording="2" src="${HOST}/harvest.m4a">`,
  )
  // A step that is done can change.
  await page.getByRole('button', { name: 'Change' }).first().click()
  await expect(page.getByRole('heading', { name: '1 Recording' })).toBeFocused()
})
