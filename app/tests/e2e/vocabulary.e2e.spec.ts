// The Vocabulary page and tab (O10v, design/vocab.md §8): add from the catalogue, an own
// question, move, hide, the lock of a used question, the property under each label.
// Chromium, muted.

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'

import { E2E_ORIGIN } from './env'

let page: Page
let app: Awaited<typeof import('../../src/payload.config')>
const SUBJECT = 'http://purl.org/dc/terms/subject'

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
  // Uploaded ontologies of an earlier run go; the bundled ones stay.
  await db.drizzle.execute(
    sql`delete from ontology_terms where ontology_id in (select id from ontologies where source = 'uploaded')`,
  )
  await db.drizzle.execute(sql`delete from ontologies where source = 'uploaded'`)
  const river = await payload.create({
    collection: 'projects',
    data: { name: 'River Voices', slug: 'river-voices' },
  })
  // An item in Topics: the project asks Topics (as the migration does).
  await payload.create({
    collection: 'concepts',
    data: { project: river.id, label: 'Ferry', iri: `${E2E_ORIGIN}/vocab/river-voices/c/ferry` },
  })
  await payload.create({
    collection: 'recordings',
    data: { title: 'Ferry crossing, 1962', url: 'http://127.0.0.1:3197/f.m4a', duration: 60 },
  })
  // One story answers Topics: the question is locked.
  await app.stories.saveDraft(
    { memberId: 'm-a', nickname: 'Asha' },
    {
      id: '0192f3a4-7c1e-7b10-9d55-0000000000f1',
      project: 'river-voices',
      recording: '1',
      start: 1,
      end: 2,
      bodies: [{ kind: 'text', value: 'Story 1.' }],
      values: [{ property: SUBJECT, item: `${E2E_ORIGIN}/vocab/river-voices/c/ferry` }],
    },
  )
  page = await (await browser.newContext()).newPage()
  await login({ page, user: testUser })
})

const rows = () => page.locator('.annoudio-questions__list > li')

test('Vocabulary in the sidebar opens the questions; each label has its property beneath', async () => {
  await page.goto('/admin')
  // The nav is a closed drawer at this width: check its link, then open its address.
  await expect(
    page.locator('.annoudio-nav').getByRole('link', { name: 'Vocabulary' }),
  ).toHaveAttribute('href', '/admin/vocabulary')
  await page.goto('/admin/vocabulary')
  await expect(page.getByRole('heading', { level: 1, name: 'Vocabulary' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Questions · River Voices' })).toBeVisible()
  await expect(rows()).toHaveCount(1)
  await expect(rows().first()).toContainText('Topics')
  await expect(rows().first().locator('code')).toHaveText('dcterms:subject')
  await expect(rows().first()).toContainText('From "Topics" · up to 10 · optional · as tags')
  await expect(rows().first()).toContainText('1 story')
})

test('add from the catalogue, then an own question; move and hide', async () => {
  await page.getByRole('button', { name: 'Add a question' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a question' })
  await expect(dialog.getByRole('button', { name: 'Topics ✓ asked' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Place', exact: true }).click()
  await expect(rows()).toHaveCount(2)
  await expect(rows().nth(1)).toContainText('Place')
  await expect(rows().nth(1).locator('code')).toHaveText('dcterms:spatial')
  await expect(rows().nth(1)).toContainText('From "Places" · up to 3 · own answers · optional')

  await page.getByRole('button', { name: 'Add a question' }).click()
  await page.getByRole('button', { name: 'Write a new question' }).click()
  const own = page.getByRole('dialog', { name: 'Your own question' })
  await own.getByRole('textbox', { name: 'Question members see' }).fill('Boat name')
  await own.getByRole('textbox', { name: 'Help', exact: true }).fill('The name on the boat.')
  await expect(own).toContainText('It never changes.')
  await own.getByRole('button', { name: 'Add the question' }).click()
  await expect(rows()).toHaveCount(3)
  await expect(rows().nth(2).locator('code')).toHaveText(
    `${E2E_ORIGIN}/vocab/river-voices/p/boat-name`,
  )

  // Move the own question up, twice: it comes first.
  await page.getByRole('button', { name: 'Move Boat name up' }).click()
  await expect(rows().nth(1)).toContainText('Boat name')
  await page.getByRole('button', { name: 'Move Boat name up' }).click()
  await expect(rows().first()).toContainText('Boat name')

  // Hide it: it stays in the list with a mark.
  await page.getByRole('button', { name: 'Edit: Boat name' }).click()
  await page
    .getByRole('dialog', { name: 'Edit: Boat name' })
    .getByRole('button', { name: 'Hide from new stories' })
    .click()
  await expect(rows().first()).toContainText('Hidden from new stories')
  expect(
    (await app.vocabulary.profile('river-voices', { forNewStories: true }))?.fields.map(
      (f) => f.label,
    ),
  ).toEqual(['Topics', 'Place'])
})

test('a used question shows the lock: kind and list are fixed, no Remove', async () => {
  await page.getByRole('button', { name: 'Edit: Topics' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit: Topics' })
  await expect(edit).toContainText('1 story answers this question. Kind and list are fixed.')
  await expect(edit.getByRole('combobox', { name: 'Kind of answer' })).toBeDisabled()
  await expect(edit.getByRole('combobox', { name: 'Choices from' })).toBeDisabled()
  await expect(edit.getByRole('button', { name: 'Remove from the form' })).toHaveCount(0)
  await expect(edit).toContainText('Saved as: dcterms:subject (Dublin Core)')
  // The label stays free.
  await edit.getByRole('textbox', { name: 'Question members see' }).fill('What it is about')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: 'Edit: What it is about' })).toBeVisible()
  const scan = await new AxeBuilder({ page }).include('.annoudio-questions').analyze()
  expect(scan.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  )
})

test('the Vocabulary tab of the project shows the same questions', async () => {
  await page.goto('/admin/collections/projects/1')
  await page.getByRole('button', { name: 'Vocabulary', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Questions · River Voices' })).toBeVisible()
  await expect(rows()).toHaveCount(3)
})

const ARCHIVE = `@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix vann: <http://purl.org/vocab/vann/> .
<https://archive.example/ns/ra> a owl:Ontology ; rdfs:label "River Archive" ; vann:preferredNamespacePrefix "ra" .
<https://archive.example/ns/ra#ferryRoute> a owl:ObjectProperty ; rdfs:label "Ferry route"@en .
`

test('Load a vocabulary file: the preview, then Load these; its property shows in Advanced', async () => {
  await page.goto('/admin/vocabulary')
  await page.getByText('For other systems').click()
  await page.getByLabel('Vocabulary file', { exact: true }).setInputFiles({
    name: 'river-archive.ttl',
    mimeType: 'text/turtle',
    buffer: Buffer.from(ARCHIVE),
  })
  const preview = page.locator('.annoudio-load__preview')
  await expect(preview).toContainText(
    '1 property and 0 classes (a new ontology "River Archive", ra)',
  )
  await preview.getByRole('button', { name: 'Load these' }).click()
  await expect(preview).toHaveCount(0)
  await page.getByRole('button', { name: 'Add a question' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a question' })
  await dialog.getByText('Advanced: from an ontology').click()
  await dialog.getByRole('searchbox', { name: 'Search' }).fill('ferry route')
  await expect(dialog.getByRole('button', { name: 'Choose Ferry route' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

test('the import route takes a 4 MB file and refuses 6 MB with 413', async () => {
  // A 4 MB body and a 6 MB body through `next dev`: slower than the default 30 s late in a run.
  test.slow()
  const lines = [
    '@prefix big: <https://big.example/ns#> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
  ]
  for (let i = 0; lines.join('\n').length < 4_000_000; i++) {
    lines.push(
      `big:p${i} a rdf:Property ; rdfs:label "Property ${i}" ; rdfs:comment "${'x'.repeat(180)}" .`,
    )
  }
  const four = await page.request.post('/api/ontologies/import?name=big.ttl', {
    data: Buffer.from(lines.join('\n')),
  })
  expect(four.status()).toBe(200)
  expect((await four.json()).report.ontology.prefix).toBe('ns')
  // The server keeps no byte past 5 MB, answers 413, and the connection stays usable.
  const six = await page.request.post('/api/ontologies/import?name=six.ttl', {
    data: Buffer.alloc(6_000_000, 32),
  })
  expect(six.status()).toBe(413)
})

test('For other systems: the linked data route gives TriG to an operator only', async ({
  browser,
}) => {
  // The first request compiles the route in `next dev`; late in a full run that is slow.
  test.slow()
  const trig = await page.request.get('/admin/export/river-voices.trig')
  expect(trig.status()).toBe(200)
  expect(trig.headers()['content-type']).toContain('application/trig')
  expect(await trig.text()).toContain('sh:NodeShape')
  const anonymous = await (
    await browser.newContext()
  ).request.get('/admin/export/river-voices.trig')
  expect(anonymous.status()).toBe(403)
  await page.goto('/admin/vocabulary')
  await page.getByText('For other systems').click()
  await expect(
    page.getByRole('link', { name: 'TriG, one graph per story (.trig)' }),
  ).toHaveAttribute('href', '/admin/export/river-voices.trig')
})
