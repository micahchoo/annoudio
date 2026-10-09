// Your stories (P7) and Your account (P8): the member home. Chromium, muted.

import { expect, test, type Page } from '@playwright/test'

import { signIn } from './member'

const PROJECT = 'river-voices'
const HOST = 'https://rivervoices.example.org'
const story = (n: number) => `0192f3a4-7c1e-7b10-9d55-0000000000f${n}`

let app: Awaited<typeof import('../../src/payload.config')>
let payload: import('payload').Payload
let page: Page

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  app = await import('../../src/payload.config')
  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  payload = await getPayload({ config: app.default })
  const db = payload.db as unknown as { drizzle: { execute: (query: unknown) => Promise<unknown> } }
  await db.drizzle.execute(
    sql`truncate stories, _stories_v, story_representations, concepts, projects, projects_site_origins,
        recordings, recordings_other_urls, members, member_sessions, login_codes, media restart identity cascade`,
  )
  await payload.create({
    collection: 'projects',
    data: { name: 'River Voices', slug: PROJECT, siteOrigins: [{ origin: HOST }] },
  })
  await payload.create({
    collection: 'recordings',
    data: { title: 'Ferry crossing, 1962', url: `${HOST}/f.mp3`, duration: 600 },
  })
  page = await (await browser.newContext()).newPage()
})

test('signed out, Your stories asks for a sign-in; then it says there are no stories yet', async () => {
  await page.goto('/annotate/mine')
  await expect(page.getByRole('heading', { name: 'Sign in to see your stories' })).toBeVisible()
  await signIn(page, 'asha@example.org', 'Asha')
  await expect(page).toHaveURL(/\/annotate\/mine$/)
  await expect(
    page.getByText('You have no stories yet. On a site, select "Tell a story".'),
  ).toBeVisible()
})

test('the stories show in groups, in order: Returned, Processing, Waiting, Published, Replies', async () => {
  const [member] = (
    await payload.find({ collection: 'members', where: { email: { equals: 'asha@example.org' } } })
  ).docs
  const asha = { memberId: String(member.id), nickname: 'Asha' }
  const ravi = { memberId: 'm-ravi', nickname: 'Ravi' }
  const operator = { operatorId: 'op', name: 'Ravi' }
  const save = (n: number, start: number, extra: object = {}, who = asha) =>
    app.stories.saveDraft(who, {
      id: story(n),
      project: PROJECT,
      recording: '1',
      start,
      end: start + 33,
      bodies: [{ kind: 'text', value: `Story ${n} of ${who.nickname}.` }],
      toldOn: `${HOST}/ferry`,
      ...extra,
    })
  await save(1, 62)
  await app.stories.reject(operator, story(1), 'Please remove the full name.')
  const media = '0192f3a4-7c1e-7b10-9d55-0000000000ff'
  await payload.create({
    collection: 'media',
    data: {
      id: media,
      member: asha.memberId,
      kind: 'image',
      state: 'uploaded',
      size: 1,
      raw: 'raw/x.jpg',
      format: 'image/jpeg',
    },
  })
  await save(2, 120, {
    bodies: [
      { kind: 'text', value: 'A photo.' },
      { kind: 'image', media },
    ],
  })
  await save(3, 200)
  await save(4, 300)
  await app.stories.publish(operator, story(4))
  await save(5, 400, {}, ravi)
  await app.stories.publish(operator, story(5))
  await app.stories.saveDraft(asha, {
    id: story(6),
    project: PROJECT,
    recording: '1',
    replyTo: story(5),
    bodies: [{ kind: 'text', value: 'My reply to Ravi.' }],
  })

  await page.goto('/annotate/mine')
  const groups = page.locator('section[data-group]')
  await expect(groups).toHaveCount(5)
  expect(await groups.evaluateAll((all) => all.map((g) => g.getAttribute('data-group')))).toEqual([
    'returned',
    'processing',
    'waiting',
    'published',
    'replies',
  ])
  const group = (name: string) => page.locator(`section[data-group="${name}"]`)
  await expect(group('returned').getByRole('heading', { level: 2 })).toHaveText(
    'Returned to you (1)',
  )
  const returned = group('returned').locator('li.card')
  await expect(returned).toContainText('Ferry crossing, 1962 · 1:02–1:35')
  await expect(returned).toContainText('River Voices')
  await expect(returned).toContainText('Reason: Please remove the full name.')
  await expect(returned.getByRole('link', { name: /^Change the story/ })).toHaveAttribute(
    'href',
    new RegExp(`story=${story(1)}`),
  )
  await expect(group('processing').locator('li.card')).toContainText('Processing')
  await expect(group('waiting').locator('li.card')).toContainText('Waits for review')
  const published = group('published').locator('li.card')
  await expect(published).toContainText('Published')
  await expect(published.getByRole('link', { name: /^Listen on the site/ })).toHaveAttribute(
    'href',
    `${HOST}/ferry#annoudio-t=300&annoudio-project=${PROJECT}&annoudio-recording=1&annoudio-story=${story(4)}`,
  )
  await expect(group('replies').locator('li.card')).toContainText('Reply to the story by Ravi')
})

test('Your account saves the name and the mail choice; Sign out ends the session', async () => {
  await page.goto('/annotate/mine')
  await page.locator('.member-menu summary').click()
  await page.getByRole('link', { name: 'Your account' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible()
  await expect(page.getByText('asha@example.org')).toBeVisible()
  const mail = page.getByRole('checkbox', {
    name: 'Mail me when my story is published or gets a reply',
  })
  await expect(mail).toBeChecked()

  await page.getByRole('textbox', { name: 'Name' }).fill('a@b')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('#account-error')).toHaveText('Use 1 to 40 characters. Do not use @.')
  await page.getByRole('textbox', { name: 'Name' }).fill('Asha K')
  await mail.uncheck()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Asha K')
  await expect(mail).not.toBeChecked()
  await expect(page.locator('.member-menu summary')).toContainText('Asha K')

  await page.locator('main').getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to see your account' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sign in to see your account' })).toBeVisible()
})
