// The Concepts page (O10) and the project Overview (O16). Chromium, muted.

import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'

import { E2E_ORIGIN } from './env'

let page: Page
let app: Awaited<typeof import('../../src/payload.config')>
let payload: import('payload').Payload
let river: number | string

const story = (n: number) => `0192f3a4-7c1e-7b10-9d55-0000000000e${n}`

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
  river = (
    await payload.create({
      collection: 'projects',
      data: { name: 'River Voices', slug: 'river-voices' },
    })
  ).id
  await payload.create({ collection: 'projects', data: { name: 'Hill Songs', slug: 'hill-songs' } })
  await payload.create({
    collection: 'concepts',
    data: { project: river, label: 'Ferry', iri: `${E2E_ORIGIN}/vocab/river-voices/c/ferry` },
  })
  await payload.create({
    collection: 'recordings',
    data: { title: 'Ferry crossing, 1962', url: 'http://127.0.0.1:3197/f.m4a', duration: 60 },
  })
  const save = (n: number, member: string, extra: object) =>
    app.stories.saveDraft(
      { memberId: member, nickname: member },
      {
        id: story(n),
        project: 'river-voices',
        recording: '1',
        bodies: [{ kind: 'text', value: `Story ${n}.` }],
        ...extra,
      },
    )
  await save(1, 'm-a', { start: 1, end: 2, tags: [`${E2E_ORIGIN}/vocab/river-voices/c/ferry`] })
  await app.stories.publish({ operatorId: 'op' }, story(1))
  await save(2, 'm-b', { start: 3, end: 4 })
  await save(3, 'm-b', { replyTo: story(1) })
  page = await (await browser.newContext()).newPage()
  await login({ page, user: testUser })
})

test('Concepts in the sidebar opens the tree; a picker chooses between two projects', async () => {
  await page.goto('/admin')
  await expect(
    page.locator('.annoudio-nav').getByRole('link', { name: 'Concepts' }),
  ).toHaveAttribute('href', '/admin/concepts')
  await page.goto('/admin/concepts')
  await expect(page).toHaveURL(/\/admin\/concepts$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Concepts' })).toBeVisible()
  await expect(page.getByText('Members see concepts as topics.')).toBeVisible()
  const picker = page.getByRole('navigation', { name: 'Project' })
  // Projects in name order: Hill Songs first.
  await expect(picker.getByRole('link', { name: 'Hill Songs' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByText('No concepts yet. Members see no topics.')).toBeVisible()
  await picker.getByRole('link', { name: 'River Voices' }).click()
  await expect(page).toHaveURL(/\/admin\/concepts\/river-voices$/)
  await expect(page.locator('[data-concept="Ferry"]')).toContainText('1 story')

  await page.getByRole('link', { name: 'Add a concept' }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/collections/concepts/create\\?project=${river}$`))
  await expect(page.locator('#field-project')).toContainText('River Voices')
})

test('the Overview tab of a project comes first; its counts are the counts of stories', async () => {
  await page.goto(`/admin/collections/projects/${river}/overview`)
  const tabs = page.locator('.doc-tabs__tabs')
  await expect(tabs).toHaveText(/^\s*Overview\s*Settings/)
  const counts = await app.stories.counts({ project: 'river-voices' })
  expect(counts.waiting).toEqual({ stories: 1, replies: 1 })
  const state = (name: string) => page.locator(`[data-state="${name}"] dd`)
  await expect(state('waiting')).toHaveText('1 story and 1 reply')
  await expect(state('published')).toHaveText('1 story')
  await expect(state('processing')).toHaveText('no stories')
  await expect(page.getByText('Ferry crossing, 1962')).toBeVisible()
  await expect(page.locator('.annoudio-overview__recordings')).toContainText('2 stories')
  await expect(page.getByText('1 concept')).toBeVisible()
  await expect(page.getByText('2 members told stories here.')).toBeVisible()
  await page.getByRole('link', { name: 'Review the stories of this project' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(2)
})
