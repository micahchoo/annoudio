// The delete of a project or a recording in the admin (closing pass). With stories, the
// admin refuses and tells the operator what to do first. Without, the delete goes through
// and the read routes give 404. Chromium, muted.

import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'

import { E2E_ORIGIN } from './env'

let page: Page
let app: Awaited<typeof import('../../src/payload.config')>
let river: number | string

const story = (n: number) => `0192f3a4-7c1e-7b10-9d55-0000000000d${n}`

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  await seedTestUser()
  app = await import('../../src/payload.config')
  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  const payload = await getPayload({ config: app.default })
  const db = payload.db as unknown as { drizzle: { execute: (query: unknown) => Promise<unknown> } }
  await db.drizzle.execute(
    sql`truncate stories, _stories_v, story_representations, concepts, projects, projects_site_origins,
        recordings, recordings_other_urls, members restart identity cascade`,
  )
  river = (
    await payload.create({
      collection: 'projects',
      data: { name: 'River Voices', slug: 'river-voices' },
    })
  ).id
  for (const title of ['Ferry crossing, 1962', 'Harvest song']) {
    await payload.create({
      collection: 'recordings',
      data: { title, url: 'http://127.0.0.1:3197/f.m4a', duration: 60 },
    })
  }
  const saved = await app.stories.saveDraft(
    { memberId: 'm-a', nickname: 'Asha' },
    {
      id: story(1),
      project: 'river-voices',
      recording: '1',
      start: 1,
      end: 2,
      bodies: [{ kind: 'text', value: 'Story 1.' }],
    },
  )
  if (!saved.ok) throw new Error(JSON.stringify(saved.error))
  await app.stories.publish({ operatorId: 'op' }, story(1))
  page = await (await browser.newContext()).newPage()
  await login({ page, user: testUser })
})

/** Delete the open document with the Delete item of its menu. */
async function deleteOpenDocument() {
  await page.locator('.doc-controls__dots').click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
}

test('a project with stories is not deleted; the admin says what to do first', async ({
  request,
}) => {
  await page.goto(`/admin/collections/projects/${river}`)
  await deleteOpenDocument()
  await expect(page.getByText('This project has 1 story. Remove its 1 story first.')).toBeVisible()
  const read = await request.get(`${E2E_ORIGIN}/stories/river-voices/1/${story(1)}`)
  expect(read.status()).toBe(200)
})

test('a recording with stories is not deleted; the admin says what to do first', async () => {
  await page.goto('/admin/collections/recordings/1')
  await deleteOpenDocument()
  await expect(
    page.getByText('This recording has 1 story. Remove its 1 story first.'),
  ).toBeVisible()
})

test('a recording with no stories is deleted, and its container gives 404', async ({ request }) => {
  const container = `${E2E_ORIGIN}/stories/river-voices/2/`
  expect((await request.get(container)).status()).toBe(200)
  await page.goto('/admin/collections/recordings/2')
  await deleteOpenDocument()
  await expect(page).toHaveURL(/\/admin\/collections\/recordings(\?|$)/)
  expect((await request.get(container)).status()).toBe(404)
})
