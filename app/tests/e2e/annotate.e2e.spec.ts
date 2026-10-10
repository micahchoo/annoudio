// The Annotate page against `next dev` and the test database (see playwright.config.ts).

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { E2E_ORIGIN } from './env'
import { signIn } from './member'
import { serveTone } from './tone'

const HOST = 'https://host.example'
const HOST_PAGE = `${HOST}/stories/ferry.html`
const PROJECT = 'river-voices'

type World = Awaited<ReturnType<typeof startWorld>>
let world: World

/** Payload in the test process, on the same database as the server. */
async function startWorld() {
  const { default: config, stories, vocabulary } = await import('../../src/payload.config')
  const { getPayload } = await import('payload')
  const { sql } = await import('@payloadcms/db-postgres')
  const payload = await getPayload({ config })
  return {
    stories,
    vocabulary,
    payload,
    async seed() {
      const db = payload.db as unknown as {
        drizzle: { execute: (query: unknown) => Promise<unknown> }
      }
      await db.drizzle.execute(
        sql`truncate stories, _stories_v, story_representations, concepts, projects, projects_site_origins,
            recordings, recordings_other_urls, members, member_sessions, login_codes restart identity cascade`,
      )
      const project = await payload.create({
        collection: 'projects',
        data: {
          name: 'River Voices',
          slug: PROJECT,
          siteOrigins: [{ origin: HOST }],
          rightsLine: 'Your story is shared under CC BY-NC 4.0.',
        },
      })
      const recording = await payload.create({
        collection: 'recordings',
        data: {
          title: 'Ferry crossing, 1962',
          url: `${HOST}/ferry.mp3`,
          duration: 120,
        },
      })
      const ferry = await payload.create({
        collection: 'concepts',
        data: {
          project: project.id,
          iri: `${E2E_ORIGIN}/vocab/${PROJECT}/c/ferry`,
          label: 'Ferry',
        },
      })
      await payload.create({
        collection: 'concepts',
        data: {
          project: project.id,
          iri: `${E2E_ORIGIN}/vocab/${PROJECT}/c/boat`,
          label: 'Boat',
          parent: ferry.id,
        },
      })
      return { recording: String(recording.id), ferry: ferry.iri, project: project.id }
    },
  }
}

function annotateUrl(recording: string, extra: Record<string, string> = {}): string {
  return `/annotate?${new URLSearchParams({ project: PROJECT, recording, t: '42', ...extra })}`
}

/** Serve a plain host page for every URL on the host site. */
async function serveHost(page: Page) {
  await page.route(`${HOST}/**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Host</title><p>Host page</p>',
    }),
  )
}

async function writeStory(page: Page, start: string, end: string, text: string) {
  await page.getByRole('textbox', { name: 'Start', exact: true }).fill(start)
  await page.getByRole('textbox', { name: 'End', exact: true }).fill(end)
  await page.getByRole('textbox', { name: 'Story', exact: true }).fill(text)
}

let ids: Awaited<ReturnType<World['seed']>>

test.beforeAll(async () => {
  world = await startWorld()
})

test.beforeEach(async () => {
  ids = await world.seed()
})

test('an unknown project gives a plain-language page with status 404', async ({ page }) => {
  const response = await page.goto(`/annotate?project=nope&recording=${ids.recording}&t=0`)
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'We cannot find this recording' })).toBeVisible()
})

test('a return URL with an unlisted origin is never followed: the member is told, and the done screen shows', async ({
  page,
}) => {
  let leftForEvil = false
  await page.route('https://evil.example/**', (route) => {
    leftForEvil = true
    return route.abort()
  })
  await page.goto(annotateUrl(ids.recording, { return: 'https://evil.example/phish' }))
  // The page keeps the value for the operator ("Add this website"), and never sends the member there.
  await expect(page.getByText('We cannot send you back to the page that you came from')).toBeVisible()
  await signIn(page, 'ravi@example.org', 'Ravi')

  await writeStory(page, '10', '20', 'The horn of the ferry.')
  await page.getByRole('button', { name: 'Send for review' }).click()
  // The done screen (workflow-audit 19): the state and the reason that it did not send the member back.
  await expect(page.getByRole('heading', { name: /Your story is sent/ })).toBeVisible()
  await expect(page.getByText('Waiting for review. We send you a mail when it is published.')).toBeVisible()
  await expect(page.getByText('This page could not send you back')).toBeVisible()
  expect(new URL(page.url()).origin).toBe(E2E_ORIGIN)
  expect(leftForEvil).toBe(false)
})

test('a member signs in, writes a story, returns to the host page, and sees it after publish', async ({
  page,
}) => {
  await serveHost(page)
  await page.goto(annotateUrl(ids.recording, { return: `${HOST_PAGE}?a=1#old` }))
  await signIn(page, 'Leela@Example.org', 'Leela')
  // The query survives the sign-in.
  expect(new URL(page.url()).searchParams.get('return')).toBe(`${HOST_PAGE}?a=1#old`)
  await expect(page.getByRole('textbox', { name: 'Start', exact: true })).toHaveValue('0:42')
  await expect(page.locator('.annotate footer.rights')).toHaveText(
    'Your story is shared under CC BY-NC 4.0.',
  )

  // A field error shows next to its field, and the member can fix it.
  await writeStory(page, '42', '30', 'My grandmother sang this on the ferry.')
  await page.getByRole('button', { name: 'Send for review' }).click()
  await expect(page.getByRole('textbox', { name: 'End', exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(page.locator('#end-error')).toHaveText(
    'The end must be after the start and inside the recording.',
  )

  const id = await page.locator('input[name="id"]').inputValue()
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/)
  await page.getByRole('textbox', { name: 'End', exact: true }).fill('51')
  await page.getByRole('checkbox', { name: 'Ferry' }).check()
  await page.getByRole('button', { name: 'Send for review' }).click()

  await page.waitForURL((url) => url.origin === HOST)
  expect(page.url()).toBe(
    `${HOST_PAGE}?a=1#annoudio-t=42&annoudio-project=${PROJECT}&annoudio-recording=${ids.recording}&annoudio-saved=draft`,
  )

  // Not public before review.
  const container = `${E2E_ORIGIN}/stories/${PROJECT}/${ids.recording}/`
  expect(await (await page.request.get(container)).text()).not.toContain('grandmother')

  await world.stories.publish({ operatorId: 'op-e2e' }, id)
  const body = await (await page.request.get(container)).json()
  const item = body.first.items[0]
  expect(item.id).toBe(`${container}${id}`)
  expect(item.target.selector.value).toBe('t=42,51')
  expect(item.creator.nickname).toBe('Leela')
  expect(JSON.stringify(item.body)).toContain('My grandmother sang this on the ferry.')
  expect(JSON.stringify(item.body)).toContain(ids.ferry)
  expect(JSON.stringify(body)).not.toContain('leela@example.org')

  // The own story is listed and can be changed. The change keeps the story id.
  await page.goto(annotateUrl(ids.recording, { return: HOST_PAGE }))
  const own = page.locator(`li[data-story="${id}"]`)
  await expect(own).toContainText('0:42–0:51')
  await expect(own).toContainText('Published')
  await own.getByRole('link', { name: /Change/ }).click()
  await expect(page.getByRole('heading', { name: 'Change your story' })).toBeVisible()
  // The link loads a new document. Type only after React hydrates the form: for a
  // textarea with a default text, React 19.2 hydration sets the value back to that text
  // (react-dom `initTextarea`), so an edit made before hydration is lost
  // (design/phase3b-notes.md).
  await page.waitForLoadState('networkidle')
  await expect(page.locator('input[name="id"]')).toHaveValue(id)
  await expect(page.getByRole('textbox', { name: 'Story', exact: true })).toHaveValue(
    'My grandmother sang this on the ferry.',
  )
  await expect(page.getByRole('checkbox', { name: 'Ferry' })).toBeChecked()
  await page
    .getByRole('textbox', { name: 'Story', exact: true })
    .fill('She sang it on the morning ferry.')
  await page.getByRole('button', { name: 'Send for review' }).click()
  await page.waitForURL((url) => url.origin === HOST)

  await page.goto(annotateUrl(ids.recording))
  await expect(page.locator(`li[data-story="${id}"]`)).toContainText(
    'Published · change waiting',
  )
  await expect(page.locator(`li[data-story="${id}"] p`)).toHaveText(
    'She sang it on the morning ferry.',
  )
  await expect(page.locator('li[data-story]')).toHaveCount(1)
  // Visitors still see the published version.
  expect(await (await page.request.get(container)).text()).toContain('grandmother')
})

test('the widget starts at t, and "Use current time (0:03)" writes its time into the range in m:ss', async ({
  page,
}) => {
  await serveTone(page, `${HOST}/ferry.mp3`)
  await page.goto(annotateUrl(ids.recording, { t: '4' }))
  await signIn(page, 'asha@example.org', 'Asha')

  const player = page.locator('annoudio-player')
  const time = () =>
    player.evaluate((element) => (element as HTMLElement & { currentTime: number }).currentTime)
  const seek = (seconds: number) =>
    player.evaluate(
      (element, s) => (element as HTMLElement & { seek(s: number): void }).seek(s),
      seconds,
    )
  await expect(player).toHaveAttribute('annotate', 'none')
  await expect.poll(time).toBe(4)

  await seek(3)
  await page.getByRole('button', { name: 'Start: use the current time, 0:03' }).click()
  await expect(page.getByRole('textbox', { name: 'Start', exact: true })).toHaveValue('0:03')
  // Whole seconds (workflow-audit 17); the button names the time (audit 18).
  await seek(6.25)
  await page.getByRole('button', { name: 'End: use the current time, 0:06' }).click()
  await expect(page.getByRole('textbox', { name: 'End', exact: true })).toHaveValue('0:06')
  // The range shows on the waveform and in the moment line.
  await expect.poll(() => player.locator('[part~="range"]').count()).toBe(1)
  await expect(page.locator('.moment')).toHaveText('Your story is about 0:03–0:06.')
})

test('text typed into a new story before hydration stays, and the form saves without JavaScript', async ({
  page,
}) => {
  await page.goto(annotateUrl(ids.recording))
  await signIn(page, 'noor@example.org', 'Noor')

  // Hold the JavaScript of the next page load, so React cannot hydrate yet.
  let release = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/_next/static/**/*.js', async (route) => {
    await held
    await route.continue()
  })
  await page.goto(annotateUrl(ids.recording), { waitUntil: 'domcontentloaded' })
  await writeStory(page, '10', '20', 'Typed before the page woke up.')
  release()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('textbox', { name: 'Story', exact: true })).toHaveValue(
    'Typed before the page woke up.',
  )
  await expect(page.getByRole('textbox', { name: 'Start', exact: true })).toHaveValue('10')
  await page.unroute('**/_next/static/**/*.js')

  // Save with the JavaScript still held: the browser posts the form itself.
  await page.route('**/_next/static/**/*.js', (route) => route.abort())
  await page.goto(annotateUrl(ids.recording), { waitUntil: 'domcontentloaded' })
  await writeStory(page, '30', '40', 'Saved without JavaScript.')
  await page.getByRole('button', { name: 'Send for review' }).click()
  // With no way back to a site, the done screen shows (workflow-audit 19).
  await expect(page.getByRole('heading', { name: /Your story is sent/ })).toBeVisible()
  await page.getByRole('link', { name: 'Change the story' }).click()
  await expect(page.getByRole('textbox', { name: 'Story', exact: true })).toHaveValue(
    'Saved without JavaScript.',
  )
})

test('sign out ends the session', async ({ page }) => {
  await page.goto(annotateUrl(ids.recording))
  await signIn(page, 'mira@example.org', 'Mira')
  await page.locator('.member-menu summary').click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to tell a story' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sign in to tell a story' })).toBeVisible()
})

test('the page wears the project frame: name, theme, rights line, the moment, Back to the site', async ({
  page,
}) => {
  await world.payload.update({
    collection: 'projects',
    id: ids.project,
    data: { themeTokens: { colorAccent: '#8a1c2b' } },
  })
  await page.goto(annotateUrl(ids.recording, { return: HOST_PAGE }))
  await expect(page.locator('.top__project')).toHaveText('River Voices')
  await expect(page.getByRole('heading', { level: 1, name: 'Tell a story' })).toBeVisible()
  await expect(page.locator('.instance')).toHaveText('Ferry crossing, 1962')
  await expect(page.getByText('You tell a story about 0:42 of "Ferry crossing, 1962".')).toBeVisible()
  await expect(page.locator('.annotate')).toHaveAttribute(
    'style',
    /--annoudio-color-accent:\s*#8a1c2b/,
  )
  await expect(page.getByRole('link', { name: 'Back to the site' })).toHaveAttribute(
    'href',
    `${HOST_PAGE}#annoudio-t=42&annoudio-project=${PROJECT}&annoudio-recording=${ids.recording}`,
  )
  await signIn(page, 'tara@example.org', 'Tara')
  await page.locator('.member-menu summary').click()
  await expect(page.getByRole('link', { name: 'Your stories' })).toHaveAttribute(
    'href',
    '/annotate/mine',
  )
  await expect(page.getByRole('link', { name: 'Your account' })).toHaveAttribute(
    'href',
    '/annotate/account',
  )
})

test('with publish-at-once the button says Publish the story; with no return, Your story opens', async ({
  page,
}) => {
  await world.payload.update({
    collection: 'projects',
    id: ids.project,
    data: { reviewRule: 'publish-at-once' },
  })
  await page.goto(annotateUrl(ids.recording))
  await signIn(page, 'omar@example.org', 'Omar')
  await writeStory(page, '1:02', '1:35', 'The bell of the ferry.')
  await expect(page.getByRole('button', { name: 'Send for review' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Publish the story' }).click()
  // The done screen (workflow-audit 19): published, and the next moves.
  await expect(page.getByRole('heading', { level: 2, name: /Your story is published/ })).toBeVisible()
  await expect(page.getByText('Published. Visitors see it in the widget on the site.')).toBeVisible()
  expect(new URL(page.url()).searchParams.get('story')).toMatch(/^[0-9a-f-]{36}$/)
  await page.getByRole('link', { name: 'Tell another story' }).click()
  const own = page.locator('li[data-story]')
  await expect(own).toContainText('1:02–1:35')
})

test('the text of a story survives a session end: sign in again, and it is back', async ({
  page,
  context,
}) => {
  await page.goto(annotateUrl(ids.recording))
  await signIn(page, 'lena@example.org', 'Lena')
  await page.waitForLoadState('networkidle')
  await writeStory(page, '10', '20', 'The fog on the river that morning.')
  await context.clearCookies()
  await page.getByRole('button', { name: 'Send for review' }).click()
  await expect(page.locator('#form-error')).toHaveText(
    'Your session ended. Sign in again. Your text stays on this page.',
  )
  await page.getByRole('link', { name: 'Sign in again' }).click()
  await page.getByRole('textbox', { name: 'Email' }).fill('lena@example.org')
  await page.getByRole('button', { name: 'Send the code' }).click()
  await expect(page.getByRole('heading', { name: 'Type your login code' })).toBeVisible()
  const response = await page.request.get('/test-mailbox?to=lena@example.org')
  const code = /\b(\d{6})\b/.exec(((await response.json()) as { text: string }).text)?.[1] ?? ''
  await page.getByRole('textbox', { name: 'Login code' }).fill(code)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('textbox', { name: 'Story', exact: true })).toHaveValue(
    'The fog on the river that morning.',
  )
})

test('the questions of the project at 360 px: required and three shown, a search box, an own answer, errors with the label', async ({
  page,
}) => {
  const op = { operatorId: 'op-e2e' }
  const v = world.vocabulary
  // Field order: Topics (from the seed), Place, When it happened, Who is speaking, Short
  // title, What you hear. Place is required.
  for (const key of ['place', 'when', 'speaker', 'title', 'hear']) {
    expect((await v.addField(op, PROJECT, { from: 'catalogue', key })).ok).toBe(true)
  }
  await v.updateField(op, PROJECT, 'http://purl.org/dc/terms/spatial', { required: true })
  const places = ['North landing', 'South landing', 'Fort Kochi', 'Vypeen', 'Mattancherry']
  for (const label of [...places, 'Bolgatty', 'Willingdon', 'Ernakulam', 'Kadamakkudy']) {
    await v.addItem(op, PROJECT, 'places', { label })
  }
  for (const label of [
    'K. Joseph',
    'Mary',
    'Anil',
    'Fatima',
    'Suresh',
    'Lakshmi',
    'Thomas',
    'Rani',
    'Biju',
  ]) {
    await v.addItem(op, PROJECT, 'people', { label })
  }

  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto(annotateUrl(ids.recording))
  await signIn(page, 'asha@example.org', 'Asha')
  const questions = page.locator('section.questions')
  await expect(questions.getByRole('heading', { name: 'About this part' })).toBeVisible()
  // Required (no mark) + the first three others (marked optional); the rest folded.
  await expect(questions.getByRole('combobox', { name: 'Place', exact: true })).toBeVisible()
  await expect(questions.getByRole('group', { name: 'Topics (optional)' })).toBeVisible()
  await expect(questions.getByRole('group', { name: 'When it happened (optional)' })).toBeVisible()
  await expect(
    questions.getByRole('combobox', { name: 'Who is speaking (optional)' }),
  ).toBeVisible()
  const more = questions.locator('details.questions__more')
  await expect(more.locator('summary')).toHaveText('More questions (2)')
  await expect(more.getByRole('textbox', { name: 'Short title (optional)' })).toBeHidden()

  const scan = await new AxeBuilder({ page }).include('section.questions').analyze()
  expect(scan.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')).toEqual(
    [],
  )

  // A send without the required Place: the error names the label and takes the focus.
  await page.waitForLoadState('networkidle')
  await writeStory(page, '42', '51', 'The horn of the last ferry.')
  await page.getByRole('combobox', { name: 'Who is speaking (optional)' }).fill('Ravi')
  await expect(questions).toContainText('Not in the list. We send "Ravi" as your own answer.')
  await page.getByRole('button', { name: 'Send for review' }).click()
  await expect(questions.locator('.ao-field__error')).toHaveText('Place: give an answer.')
  await expect(questions.getByRole('combobox', { name: 'Place', exact: true })).toBeFocused()
  // The form keeps the text and the own answer.
  await expect(page.getByRole('textbox', { name: 'Story', exact: true })).toHaveValue(
    'The horn of the last ferry.',
  )
  await expect(page.getByRole('combobox', { name: 'Who is speaking (optional)' })).toHaveValue(
    'Ravi',
  )

  // The search box: type, then choose with the keyboard.
  const place = questions.getByRole('combobox', { name: 'Place', exact: true })
  await place.fill('north')
  await expect(questions.getByRole('option', { name: 'North landing' })).toBeVisible()
  await place.press('ArrowDown')
  await place.press('Enter')
  await expect(questions.getByRole('button', { name: 'Remove North landing' })).toBeVisible()
  await questions
    .getByRole('group', { name: 'When it happened (optional)' })
    .getByLabel('Year')
    .fill('1962')
  const id = await page.locator('input[name="id"]').inputValue()
  await page.getByRole('button', { name: 'Send for review' }).click()
  await page.waitForURL((url) => url.searchParams.get('saved') === '1')
  await expect(page.getByRole('heading', { name: /Your story is sent/ })).toBeVisible()

  const stored = await world.payload.findByID({ collection: 'stories', id, draft: true })
  const values = (stored.wadm as { body: Record<string, unknown>[] }).body.filter(
    (b) => 'rdf:object' in b,
  )
  expect(values.map((b) => [b.value, b['rdf:object']])).toEqual([
    ['North landing', { id: `${E2E_ORIGIN}/vocab/${PROJECT}/c/north-landing` }],
    ['1962', { '@value': '1962', type: 'xsd:gYear' }],
    [
      'Ravi',
      {
        type: 'http://xmlns.com/foaf/0.1/Person',
        'rdfs:label': { '@value': 'Ravi', '@language': 'en' },
      },
    ],
  ])
})

test('on a phone, Start and End follow the waveform: the other stories stay in a short box', async ({
  page,
}) => {
  // Eight published stories: the widget's list would push the form far down.
  for (let i = 1; i <= 8; i++) {
    const id = `0192f3a4-7c1e-7b10-9d55-0000000002${String(i).padStart(2, '0')}`
    const saved = await world.stories.saveDraft(
      { memberId: `m-${i}`, nickname: `Member ${i}` },
      {
        id,
        project: PROJECT,
        recording: ids.recording,
        start: i * 5,
        end: i * 5 + 3,
        bodies: [{ kind: 'text', value: `Story ${i}: the ferry, the river, and the people on the landing.` }],
      },
    )
    expect(saved.ok).toBe(true)
    await world.stories.publish({ operatorId: 'op-e2e' }, id)
  }
  await serveTone(page, `${HOST}/ferry.mp3`)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(annotateUrl(ids.recording, { t: '4' }))
  await signIn(page, 'asha@example.org', 'Asha')
  const player = page.locator('annoudio-player')
  await expect(player.locator('[part~="story"]')).toHaveCount(8)
  await page.evaluate(() => window.scrollTo(0, 0))
  // Without a scroll, the End field is on the screen (recordings audit, 10).
  const end = (await page.getByRole('textbox', { name: 'End', exact: true }).boundingBox())!
  expect(end.y + end.height).toBeLessThanOrEqual(844)
  // The list keeps every story: it scrolls in its own box.
  const list = player.locator('[part~="stories"]')
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
})
