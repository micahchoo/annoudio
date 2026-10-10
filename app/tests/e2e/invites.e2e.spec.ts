// Invite codes (design/invite-codes.md): the operator makes codes on the project page, a
// member signs in with one and tells a story; a project in `email-code` mode shows no
// invite form. Chromium, muted.

import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'

const HOST = 'https://host.example'
const BOTH = 'river-voices'
const MAIL_ONLY = 'hill-songs'

let page: Page
let recording: string
let riverId: number | string
let codes: string[] = []
let interfaces: Awaited<typeof import('../../src/payload.config')>

test.describe.configure({ mode: 'serial' })

const annotateUrl = (project: string) =>
  `/annotate?${new URLSearchParams({ project, recording, t: '5' })}`

test.beforeAll(async ({ browser }) => {
  await seedTestUser()
  interfaces = await import('../../src/payload.config')
  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  const payload = await getPayload({ config: interfaces.default })
  const db = payload.db as unknown as { drizzle: { execute: (query: unknown) => Promise<unknown> } }
  await db.drizzle.execute(
    sql`truncate stories, _stories_v, story_representations, concepts, projects, projects_site_origins,
        recordings, recordings_other_urls, members, member_sessions, login_codes, invite_codes,
        invite_uses, invite_tries restart identity cascade`,
  )
  const river = await payload.create({
    collection: 'projects',
    data: { name: 'River Voices', slug: BOTH, siteOrigins: [{ origin: HOST }], signIn: 'both' },
  })
  riverId = river.id
  await payload.create({
    collection: 'projects',
    data: { name: 'Hill Songs', slug: MAIL_ONLY, signIn: 'email-code' },
  })
  const created = await payload.create({
    collection: 'recordings',
    data: { title: 'Ferry crossing, 1962', url: `${HOST}/ferry.m4a`, duration: 30 },
  })
  recording = String(created.id)
  page = await browser.newPage()
})

test.afterAll(async () => {
  await page.close()
})

test('the operator makes three invite codes on the project page and sees them once', async () => {
  await login({ page, user: testUser })
  await page.goto(`/admin/collections/projects/${riverId}`)
  await page.getByRole('button', { name: 'Sign-in', exact: true }).click()
  // A dropdown: one choice of a known set (design-system §1, "Pick, do not type").
  await expect(page.getByRole('combobox', { name: 'How members sign in' })).toHaveValue('both')
  await page.getByRole('spinbutton', { name: 'How many codes' }).fill('3')
  await page.getByRole('textbox', { name: 'Label (optional)' }).fill('Workshop 12 Oct')
  await page.getByRole('button', { name: 'Make invite codes' }).click()

  const made = page.getByRole('list', { name: 'Your 3 new codes' })
  await expect(made.locator('code')).toHaveCount(3)
  codes = await made.locator('code').allTextContents()
  for (const code of codes) expect(code).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/)

  const rows = page.locator('.annoudio-invites__list tbody tr')
  await expect(rows).toHaveCount(3)
  await expect(rows.first()).toContainText('Workshop 12 Oct')
  await expect(rows.first()).toContainText('0 of 1')
  await expect(rows.first()).toContainText('Works')

  // After "I saved them", the codes are gone from the page; a reload does not show them.
  await page.getByRole('button', { name: 'I saved them' }).click()
  await expect(page.locator('.annoudio-invites__codes')).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Sign-in', exact: true }).click()
  await expect(page.locator('.annoudio-invites__list tbody tr')).toHaveCount(3)
  for (const code of codes) await expect(page.getByText(code)).toHaveCount(0)
})

test('a member signs in with an invite code and tells a story', async ({ browser }) => {
  const member = await browser.newPage()
  await member.goto(annotateUrl(BOTH))
  await expect(member.getByRole('heading', { name: 'Sign in to tell a story' })).toBeVisible()
  await member.getByRole('button', { name: 'Have an invite code?' }).click()
  await expect(member.getByRole('heading', { name: 'Sign in with an invite code' })).toBeVisible()

  // A wrong code gives a plain error; the right one in lower case works.
  await member.getByRole('textbox', { name: 'Email' }).fill('asha@example.org')
  await member.getByRole('textbox', { name: 'Invite code' }).fill('2222-2222')
  await member.getByRole('button', { name: 'Sign in' }).click()
  await expect(member.locator('#sign-in-error')).toHaveText(
    'This invite code is not correct. Look at the code again.',
  )
  await member.getByRole('textbox', { name: 'Email' }).fill('asha@example.org')
  await member.getByRole('textbox', { name: 'Invite code' }).fill(codes[0].toLowerCase())
  await member.getByRole('button', { name: 'Sign in' }).click()
  await expect(member.getByRole('heading', { name: 'Choose your name' })).toBeVisible()
  await member.getByRole('textbox', { name: 'Name' }).fill('Asha')
  await member.getByRole('button', { name: 'Continue' }).click()
  await expect(member.locator('.member-menu summary')).toContainText('Asha')

  await member.waitForLoadState('networkidle')
  await member.getByRole('textbox', { name: 'Start', exact: true }).fill('5')
  await member.getByRole('textbox', { name: 'End', exact: true }).fill('9')
  await member.getByRole('textbox', { name: 'Story', exact: true }).fill('We sang on the ferry.')
  await member.getByRole('button', { name: 'Send for review' }).click()
  await expect(member.getByRole('heading', { name: /Your story is sent/ })).toBeVisible()

  // The email is not checked: Your stories says that no mail comes.
  await member.goto('/annotate/mine')
  await expect(member.locator('.no-mail')).toContainText('We do not send you mail')
  await expect(member.getByText('We sang on the ferry.')).toBeVisible()
  await member.close()

  // The operator sees the use.
  await page.reload()
  await page.getByRole('button', { name: 'Sign-in', exact: true }).click()
  await expect(page.locator('.annoudio-invites__list tbody tr', { hasText: '1 of 1' })).toHaveCount(
    1,
  )
})

test('a project in email-code mode shows no invite form; invite-code mode shows only it', async ({
  browser,
}) => {
  const member = await browser.newPage()
  await member.goto(annotateUrl(MAIL_ONLY))
  await expect(member.getByRole('heading', { name: 'Sign in to tell a story' })).toBeVisible()
  await expect(member.getByRole('button', { name: 'Send the code' })).toBeVisible()
  await expect(member.getByRole('button', { name: 'Have an invite code?' })).toHaveCount(0)
  await expect(member.getByRole('textbox', { name: 'Invite code' })).toHaveCount(0)

  const { getPayload } = await import('payload')
  const payload = await getPayload({ config: interfaces.default })
  await payload.update({
    collection: 'projects',
    where: { slug: { equals: MAIL_ONLY } },
    data: { signIn: 'invite-code' },
  })
  await member.goto(annotateUrl(MAIL_ONLY))
  await expect(member.getByRole('heading', { name: 'Sign in with an invite code' })).toBeVisible()
  await expect(member.getByRole('button', { name: 'Send the code' })).toHaveCount(0)
  await expect(
    member.getByRole('button', { name: 'Get a login code by email instead' }),
  ).toHaveCount(0)
  // A code of River Voices does not open Hill Songs.
  await member.getByRole('textbox', { name: 'Email' }).fill('noor@example.org')
  await member.getByRole('textbox', { name: 'Invite code' }).fill(codes[1])
  await member.getByRole('button', { name: 'Sign in' }).click()
  await expect(member.locator('#sign-in-error')).toHaveText(
    'This invite code is not correct. Look at the code again.',
  )
  await member.close()
})
