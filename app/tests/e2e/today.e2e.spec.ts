// Today and the sidebar (O3, design/ia.md §4.1): on an empty stack, the setup checklist,
// each step ticked by data; the Review stories badge equals the Waiting for review count.
// Chromium, muted.

import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'

const PROJECT = 'river-voices'
const story = (n: number) => `0192f3a4-7c1e-7b10-9d55-0000000000c${n}`

let page: Page
let app: Awaited<typeof import('../../src/payload.config')>
let payload: import('payload').Payload

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  await seedTestUser()
  app = await import('../../src/payload.config')
  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  payload = await getPayload({ config: app.default })
  const db = payload.db as unknown as { drizzle: { execute: (query: unknown) => Promise<unknown> } }
  await db.drizzle.execute(
    sql`truncate stories, _stories_v, story_representations, concepts, projects, projects_site_origins,
        recordings, recordings_other_urls, members restart identity cascade`,
  )
  page = await (await browser.newContext()).newPage()
  await login({ page, user: testUser })
})

const step = (name: string) => page.locator(`[data-step="${name}"]`)

test('an empty stack shows the 4-step checklist, and each step ticks from data', async () => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Put your first widget on a site' })).toBeVisible()
  for (const name of ['project', 'recording', 'snippet', 'story']) {
    await expect(step(name)).toHaveAttribute('data-done', 'false')
  }
  await expect(step('project').getByRole('link', { name: 'Make a project' })).toBeVisible()
  await expect(page.getByText('No stories wait for review.')).toBeVisible()

  await payload.create({ collection: 'projects', data: { name: 'River Voices', slug: PROJECT } })
  await page.reload()
  await expect(step('project')).toHaveAttribute('data-done', 'true')
  await expect(step('recording').getByRole('link', { name: 'Add a recording' })).toBeVisible()

  await payload.create({
    collection: 'recordings',
    data: { title: 'Ferry crossing, 1962', url: 'http://127.0.0.1:3197/ferry.m4a', duration: 60 },
  })
  await page.reload()
  await expect(step('recording')).toHaveAttribute('data-done', 'true')

  await page.getByRole('button', { name: 'I pasted it' }).click()
  await expect(step('snippet')).toHaveAttribute('data-done', 'true')
  await expect(step('story')).toHaveAttribute('data-done', 'false')

  await app.stories.saveDraft(
    { memberId: 'm-asha', nickname: 'Asha' },
    {
      id: story(1),
      project: PROJECT,
      recording: '1',
      start: 1,
      end: 5,
      bodies: [{ kind: 'text', value: 'The horn of the ferry.' }],
    },
  )
  await app.stories.publish({ operatorId: 'op-test' }, story(1))
  await page.reload()
  // All four tick: the list goes.
  await expect(page.getByRole('heading', { name: 'Put your first widget on a site' })).toHaveCount(
    0,
  )
})

test('the badge on Review stories equals the Waiting for review count', async () => {
  const write = (n: number, start: number) =>
    app.stories.saveDraft(
      { memberId: 'm-ravi', nickname: 'Ravi' },
      {
        id: story(n),
        project: PROJECT,
        recording: '1',
        start,
        end: start + 2,
        bodies: [{ kind: 'text', value: `Story ${n}.` }],
      },
    )
  await write(2, 10)
  await write(3, 20)
  await app.stories.saveDraft(
    { memberId: 'm-ravi', nickname: 'Ravi' },
    {
      id: story(4),
      project: PROJECT,
      recording: '1',
      replyTo: story(1),
      bodies: [{ kind: 'text', value: 'A reply.' }],
    },
  )
  await page.goto('/admin')
  await expect(page.getByText('2 stories and 1 reply wait for review.')).toBeVisible()
  const review = page.locator('.annoudio-nav').getByRole('link', { name: /^Review stories/ })
  // The sidebar counts at most once in 30 s.
  await expect(async () => {
    await page.reload()
    await expect(review).toHaveAccessibleName('Review stories (3 wait for review)', {
      timeout: 1_000,
    })
  }).toPass({ timeout: 45_000, intervals: [2_000] })
  await expect(review.locator('.annoudio-nav__badge')).toContainText('3')

  await page.getByRole('link', { name: 'Start reviewing' }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/collections/stories/${story(2)}$`))
  await expect(review).toHaveAttribute('aria-current', 'page')
})

test('the sidebar names the jobs, then Settings', async () => {
  await page.goto('/admin')
  const nav = page.locator('nav.nav__wrap, aside.nav').first()
  for (const name of [
    'Today',
    'Add a widget',
    'Vocabulary',
    'Members',
    'Projects',
    'Recordings',
    'Operators',
    'Your account',
  ]) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible()
  }
  await expect(nav.getByText('Settings')).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Media bodies' })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Stories', exact: true })).toHaveCount(0)
})
