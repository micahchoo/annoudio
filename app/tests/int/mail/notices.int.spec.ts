// @vitest-environment node
// The mails of design/ia.md §2.3 through the real modules: `stories` emits after the
// commit, `mail.createNotices` sends M2 to M5 to the members of `membership` and M6 to the
// operators, and Payload sends M7. All mails land in a memory mailer.

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { PgBoss } from 'pg-boss'

import { DIGEST, workDigest } from 'annoudio-worker'

import { operatorsByReviewMail } from '@/collections/Users'
import { recording } from '@/modules/catalogue'
import {
  createNotices,
  memoryMailer,
  type Mailer,
  type MemoryMailer,
  type Notices,
} from '@/modules/mail'
import { createMembership, type Membership } from '@/modules/membership'
import { allProjects, bySlug } from '@/modules/projects'
import type { MemberSession, Stories } from '@/modules/stories'

import { DATABASE_URL, resetQueues } from '../media/world'
import {
  ORIGIN,
  PROJECT,
  draft,
  makeStories,
  operator,
  seed,
  startPayload,
  storyId,
} from '../stories/world'

let payload: Payload
let stories: Stories
let membership: Membership
let mailer: MemoryMailer
let asha: MemberSession
let ravi: MemberSession
let notices: Notices
const HOST = 'https://rivervoices.example.org/ferry'
/** 08:00, about two days after the stories of the fixed clock (T0). */
const EIGHT = new Date('2026-10-11T08:00:00.000Z')

/** The notices as payload.config.ts makes them, with this mailer and a fixed clock. */
function noticesWith(mail: Mailer): Notices {
  const site = { payload, origin: ORIGIN }
  return createNotices({
    mailer: mail,
    origin: ORIGIN,
    now: () => EIGHT,
    contact: (id) => membership.contact(id),
    projectName: async (slug) => (await bySlug(site, slug))?.label ?? null,
    recordingTitle: async (id) => (await recording(site, id))?.title ?? null,
    operators: (choice) => operatorsByReviewMail(payload, choice),
    waiting: async () => {
      const projects = await allProjects({ payload })
      const [total, ...each] = await Promise.all([
        stories.counts(),
        ...projects.map((project) => stories.counts({ project: project.slug })),
      ])
      return {
        total: total.waiting,
        projects: projects
          .map((project, i) => ({ name: project.label, ...each[i].waiting }))
          .filter((project) => project.stories + project.replies > 0),
        oldestWaiting: total.oldestWaiting,
      }
    },
  })
}

async function member(email: string, nickname: string): Promise<MemberSession> {
  await membership.requestCode(email, { site: 'River Voices' })
  const code = /\b(\d{6})\b/.exec(mailer.lastTo(email)!.text)![1]
  const result = await membership.verifyCode(email, code, nickname)
  if (!result.ok) throw new Error(result.error)
  return result.session
}

beforeAll(async () => {
  payload = await startPayload()
})

beforeEach(async () => {
  await seed(payload)
  const db = payload.db as unknown as PostgresAdapter
  await db.drizzle.execute(
    sql`truncate members, member_sessions, login_codes, media, users cascade`,
  )
  const { docs } = await payload.find({
    collection: 'projects',
    where: { slug: { equals: PROJECT } },
  })
  await payload.update({
    collection: 'projects',
    id: docs[0].id,
    data: { siteOrigins: [{ origin: 'https://rivervoices.example.org' }] },
  })
  mailer = memoryMailer()
  membership = createMembership({ payload, origin: ORIGIN, secret: 'test-secret', mailer })
  notices = noticesWith(mailer)
  stories = makeStories(payload, { notify: (event) => notices.storyEvent(event) })
  asha = await member('asha@example.org', 'Asha')
  ravi = await member('ravi@example.org', 'Ravi')
})

const ofKind = (kind: string, since = 0) =>
  mailer.messages.slice(since).filter((mail) => mail.kind === kind)

async function saved(input = draft(), session = asha) {
  const result = await stories.saveDraft(session, { toldOn: HOST, ...input })
  if (!result.ok) throw new Error(JSON.stringify(result.error))
}

const reply = (n: number) => ({
  id: storyId(n),
  project: PROJECT,
  recording: '1',
  replyTo: storyId(1),
  bodies: [{ kind: 'text' as const, value: 'My uncle steered that ferry. '.repeat(10) }],
})

async function setNotices(email: string, on: boolean) {
  await payload.update({
    collection: 'members',
    where: { email: { equals: email } },
    data: { mailNotices: on },
  })
}

describe('M1 login code', () => {
  it('names the project in the subject and as the sender', () => {
    const [mail] = ofKind('login-code')
    expect(mail).toMatchObject({
      subject: 'Your login code for River Voices',
      fromName: 'River Voices',
    })
    expect(mail.text).toContain('It works one time, for 10 minutes.')
    expect(mail.text).toContain('Your account works on all sites of this organisation.')
  })
})

describe('M2 returned', () => {
  it('goes after a return, with the reason, the range and one link to change the story', async () => {
    await saved()
    await stories.reject(operator, storyId(1), 'Please remove the full name.')
    const [mail] = ofKind('returned')
    expect(mail).toMatchObject({
      to: 'asha@example.org',
      subject: 'Your story needs a change',
      fromName: 'River Voices',
    })
    expect(mail.text).toContain('“Ferry crossing, 1962”, 0:42–0:51')
    expect(mail.text).toContain('Reason: Please remove the full name.')
    expect(mail.text).toContain('Visitors do not see the story until it is published.')
    expect(mail.text).not.toContain(operator.operatorId)
    const query = new URLSearchParams({
      project: PROJECT,
      recording: '1',
      t: '42',
      story: storyId(1),
      return: HOST,
    })
    expect(mail.text).toContain(`Change your story: ${ORIGIN}/annotate?${query}`)
    expect(mail.html).toContain(
      `<a href="${ORIGIN}/annotate?${query.toString().replaceAll('&', '&amp;')}">`,
    )
  })
})

describe('M3 published', () => {
  it('goes after a publish, with the host page at the story', async () => {
    await saved()
    await stories.publish(operator, storyId(1))
    const [mail] = ofKind('published')
    expect(mail).toMatchObject({ to: 'asha@example.org', subject: 'Your story is published' })
    expect(mail.text).toContain(
      `Listen on the site: ${HOST}#annoudio-t=42&annoudio-project=river-voices&annoudio-recording=1&annoudio-story=${storyId(1)}`,
    )
  })

  it('gives Your stories when the story has no host page', async () => {
    await saved({ ...draft(), toldOn: null })
    await stories.publish(operator, storyId(1))
    expect(ofKind('published')[0].text).toContain(`Listen on the site: ${ORIGIN}/annotate/mine`)
  })

  it('a publish that is refused sends nothing', async () => {
    await payload.create({
      collection: 'media',
      data: {
        id: '0192f3a4-aa01-7000-8000-00000000f001',
        member: asha.memberId,
        kind: 'image',
        state: 'uploaded',
        size: 1,
        raw: 'raw/x.jpg',
        format: 'image/jpeg',
      },
    })
    await saved(
      draft({
        bodies: [
          { kind: 'text', value: 'The ferry at dawn.' },
          { kind: 'image', media: '0192f3a4-aa01-7000-8000-00000000f001' },
        ],
      }),
    )
    await expect(stories.publish(operator, storyId(1))).rejects.toMatchObject({
      code: 'media-not-ready',
    })
    expect(ofKind('published')).toEqual([])
  })

  it('does not go when the member turned mail off; M2 still goes', async () => {
    await setNotices('asha@example.org', false)
    await saved()
    await stories.publish(operator, storyId(1))
    expect(ofKind('published')).toEqual([])
    await saved({
      ...draft({ start: 40 }),
      ifMatch: (await stories.ownDrafts(asha, { project: PROJECT, recording: '1' }))[0].etag,
    })
    await stories.reject(operator, storyId(1), 'Keep the old range.')
    expect(ofKind('returned')).toHaveLength(1)
  })

  it('a save that publish-at-once publishes sends no M3', async () => {
    const { docs } = await payload.find({
      collection: 'projects',
      where: { slug: { equals: PROJECT } },
    })
    await payload.update({
      collection: 'projects',
      id: docs[0].id,
      data: { reviewRule: 'publish-at-once' },
    })
    await saved()
    expect(ofKind('published')).toEqual([])
  })
})

describe('M4 replied', () => {
  it('goes to the member of the story, with the first 200 characters, and opens the story', async () => {
    await saved()
    await stories.publish(operator, storyId(1))
    await saved(reply(2), ravi)
    await stories.publish(operator, storyId(2))
    const [mail] = ofKind('replied')
    expect(mail).toMatchObject({ to: 'asha@example.org', subject: 'Someone replied to your story' })
    expect(mail.text).toContain(
      'Ravi replied to your story about “Ferry crossing, 1962”, 0:42–0:51:',
    )
    expect(mail.text).toContain(`“${'My uncle steered that ferry. '.repeat(10).slice(0, 200)}…”`)
    expect(mail.text).toContain(`annoudio-story=${storyId(1)}`)
    // The replier gets M3 for the reply, at the story that it answers.
    const published = ofKind('published').find((m) => m.to === 'ravi@example.org')!
    expect(published.subject).toBe('Your reply is published')
    expect(published.text).toContain(`annoudio-t=42&`)
  })

  it('does not go to a member who answers their own story, or who turned mail off', async () => {
    await saved()
    await stories.publish(operator, storyId(1))
    await saved(reply(2), asha)
    await stories.publish(operator, storyId(2))
    expect(ofKind('replied')).toEqual([])
    await setNotices('asha@example.org', false)
    await saved(reply(3), ravi)
    await stories.publish(operator, storyId(3))
    expect(ofKind('replied')).toEqual([])
  })
})

describe('M5 removed', () => {
  it('goes to the member of the story, with the reason, and once to each member of a reply', async () => {
    await saved()
    await stories.publish(operator, storyId(1))
    await saved(reply(2), ravi)
    await saved(reply(3), ravi)
    await stories.remove(operator, storyId(1), 'A visitor asked us to.')
    const mails = ofKind('removed')
    expect(mails.map((m) => m.to)).toEqual(['asha@example.org', 'ravi@example.org'])
    expect(mails[0]).toMatchObject({ subject: 'Your story is removed' })
    expect(mails[0].text).toContain('Reason: A visitor asked us to.')
    expect(mails[1]).toMatchObject({ subject: 'Your reply is removed' })
    expect(mails[1].text).toContain('The story that you replied to is removed.')
    expect(mails[1].text).not.toContain('A visitor asked us to.')
    expect(mails[1].text).toContain(`Your stories: ${ORIGIN}/annotate/mine`)
  })
})

describe('a failed send', () => {
  it('goes to the log and does not undo the change', async () => {
    const broken = noticesWith({ send: () => Promise.reject(new Error('SMTP down')) })
    stories = makeStories(payload, { notify: (event) => broken.storyEvent(event) })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await saved()
    await stories.publish(operator, storyId(1))
    expect((await stories.review(operator, storyId(1)))?.reviewState).toBe('published')
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})

describe('M7 password reset', () => {
  it('Payload sends it through the mailer of the app, with a link to this admin', async () => {
    await payload.create({
      collection: 'users',
      data: { email: 'ravi.operator@example.org', password: 'a long password 1' },
    })
    // With no SMTP_URL, the config keeps one memory mailer per process (payload.config.ts).
    const appMailer = (globalThis as { annoudioMailer?: MemoryMailer }).annoudioMailer!
    await payload.forgotPassword({
      collection: 'users',
      data: { email: 'ravi.operator@example.org' },
    })
    const mail = appMailer.lastTo('ravi.operator@example.org')!
    expect(mail).toMatchObject({
      kind: 'password-reset',
      subject: 'Reset your Annoudio password',
      fromName: 'Annoudio',
    })
    expect(mail.html).toMatch(new RegExp(`href="${ORIGIN}/admin/reset/[0-9a-f]+"`))
    expect(mail.text).toContain('It works for 1 hour.')
  })
})

describe('M6 review mail', () => {
  async function operators() {
    for (const [email, reviewMail] of [
      ['daily1@example.org', 'daily'],
      ['daily2@example.org', 'daily'],
      ['each@example.org', 'each'],
      ['never@example.org', 'never'],
    ] as const) {
      await payload.create({
        collection: 'users',
        data: { email, password: 'a long password 1', reviewMail },
      })
    }
  }

  it('at 08:00 with 3 waiting: one mail to each operator with "once a day"', async () => {
    await saved(draft({ id: storyId(1) }))
    await saved(draft({ id: storyId(2), start: 1, end: 2 }))
    await stories.publish(operator, storyId(1))
    await saved(reply(3), ravi)
    await saved(draft({ id: storyId(4), recording: '2', start: 1, end: 2 }))
    await operators()
    const since = mailer.messages.length

    expect(await notices.digest()).toBe(2)
    const mails = ofKind('review', since)
    expect(mails.map((m) => m.to).sort()).toEqual(['daily1@example.org', 'daily2@example.org'])
    expect(mails[0]).toMatchObject({
      subject: '2 stories and 1 reply wait for review',
      fromName: 'Annoudio',
    })
    expect(mails[0].text).toContain('River Voices: 2 stories and 1 reply')
    expect(mails[0].text).toMatch(/The oldest came in \d+ (day|hour|minute)s? ago\./)
    expect(mails[0].text).toContain(`Review the stories: ${ORIGIN}/admin/collections/stories`)
  })

  it('at 08:00 with nothing waiting: no mail', async () => {
    await operators()
    await saved()
    await stories.publish(operator, storyId(1))
    const since = mailer.messages.length
    expect(await notices.digest()).toBe(0)
    expect(ofKind('review', since)).toEqual([])
  })

  it('"for each story" mails when a member sends a story for review; not with publish-at-once', async () => {
    await operators()
    await saved()
    expect(ofKind('review').map((m) => m.to)).toEqual(['each@example.org'])
    expect(ofKind('review')[0].subject).toBe('1 story waits for review')

    const { docs } = await payload.find({
      collection: 'projects',
      where: { slug: { equals: PROJECT } },
    })
    await payload.update({
      collection: 'projects',
      id: docs[0].id,
      data: { reviewRule: 'publish-at-once' },
    })
    await saved(draft({ id: storyId(2), start: 1, end: 2 }))
    expect(ofKind('review')).toHaveLength(1)
  })

  it('the mail.digest job that the worker schedules makes the app send the digest', async () => {
    await operators()
    await saved()
    const since = mailer.messages.length
    await resetQueues(payload)
    const boss = new PgBoss({ connectionString: DATABASE_URL, supervise: false, schedule: false })
    boss.on('error', (error) => console.error(error))
    await boss.start()
    try {
      await workDigest(boss, async () => void (await notices.digest()))
      await boss.send(DIGEST, {})
      await vi.waitFor(() => expect(ofKind('review', since)).toHaveLength(2), {
        timeout: 10_000,
        interval: 100,
      })
    } finally {
      await boss.stop({ graceful: true, timeout: 5_000 })
    }
  })
})
