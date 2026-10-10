// The Lists tab and entities (O10l, design/vocab.md §5, §8): the member sentence first,
// Add a list of people, an entity with "Same as", the entity page with its rows, SKOS
// folded. Chromium, muted.

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'

let page: Page
let river: number | string

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  await seedTestUser()
  const app = await import('../../src/payload.config')
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
  page = await (await browser.newContext()).newPage()
  await login({ page, user: testUser })
})

test('the Lists tab leads with the member sentence; SKOS is folded', async () => {
  await page.goto(`/admin/collections/projects/${river}`)
  await page.getByRole('button', { name: 'Lists', exact: true }).click()
  const panel = page
    .locator('.annoudio-questions')
    .filter({ hasText: 'Members pick from these lists' })
  await expect(panel.locator('.ao-header__help')).toHaveText(
    'Members pick from these lists when they answer a question.',
  )
  await expect(panel.locator('details > summary')).toHaveText(
    'For other systems: download a list as SKOS, upload a SKOS file',
  )
  await expect(panel.getByLabel('Vocabulary file', { exact: true })).toBeHidden()
})

test('Add a list of people; an entity with Same as shows in its row', async () => {
  await page.goto('/admin/concepts/river-voices')
  await page.getByRole('textbox', { name: 'Name of the list' }).fill('People')
  await page.getByRole('combobox', { name: 'Kind of list' }).selectOption({ label: 'People, places or things' })
  await expect(page.getByRole('combobox', { name: 'What the entries are' })).toHaveValue(
    'http://xmlns.com/foaf/0.1/Person',
  )
  await page.locator('.annoudio-add-list').getByRole('button', { name: 'Add a list' }).click()
  await expect(page.locator('[data-list="People"]')).toContainText('0 entries')

  // A second list with the same name is refused, with the way to the first one.
  await page.getByRole('textbox', { name: 'Name of the list' }).fill(' people ')
  await page.locator('.annoudio-add-list').getByRole('button', { name: 'Add a list' }).click()
  await expect(page.locator('.annoudio-add-list').getByRole('alert')).toContainText('People exists.')
  await expect(page.locator('[data-list="People"]')).toHaveCount(1)
  await page.getByRole('textbox', { name: 'Name of the list' }).fill('')

  await page.getByRole('link', { name: 'Open People' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'People' })).toBeVisible()
  await expect(
    page.getByText('People is empty. Members can choose nothing from it yet.'),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Add an item' }).click()
  await page.locator('#field-label').fill('K. Joseph')
  await page.locator('#field-sameAs').fill('http://www.wikidata.org/entity/Q1')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('#field-iri')).toHaveValue(/\/vocab\/river-voices\/c\/k-joseph$/)

  // The item form has the way back to its list.
  await page.getByRole('link', { name: 'Back to People' }).click()
  await expect(page).toHaveURL(/\/admin\/concepts\/river-voices\?list=people$/)
  const row = page.locator('[data-concept="K. Joseph"]')
  await expect(row).toContainText('http://www.wikidata.org/entity/Q1')
  await expect(row).toContainText('0 stories')
  const scan = await new AxeBuilder({ page }).include('.annoudio-concepts').analyze()
  expect(scan.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  )
})
