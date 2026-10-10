import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import nodemailer from 'nodemailer'
import { buildConfig, getPayload } from 'payload'
import { PgBoss } from 'pg-boss'

import { workDigest } from 'annoudio-worker'
import { fileURLToPath } from 'url'

import { forgetWaitingCount } from './admin/waitingCount'
import { Users, operatorsByReviewMail } from './collections/Users'
import { recording as findRecording, recordingsCollection } from './modules/catalogue'
import {
  addressOf,
  createNotices,
  mailerEmailAdapter,
  memoryMailer,
  smtpMailer,
  type Mailer,
  type MemoryMailer,
} from './modules/mail'
import { createMedia, mediaCollection, type Media, type SettledConsumer } from './modules/media'
import {
  createMembership,
  inviteCodesCollection,
  inviteTriesCollection,
  inviteUsesCollection,
  loginCodesCollection,
  memberSessionsCollection,
  membersCollection,
} from './modules/membership'
import { allProjects, bySlug, projectsCollection } from './modules/projects'
import {
  createStories,
  storiesCollection,
  storyRepresentationsCollection,
  storyValuesCollection,
} from './modules/stories'
import {
  conceptsCollection,
  createVocabulary,
  ontologiesCollection,
  ontologyTermsCollection,
  removeVocabulary,
  vocabFieldsCollection,
  vocabListsCollection,
} from './modules/vocabulary'

const origin = process.env.ANNOUDIO_ORIGIN || ''
const smtpUrl = process.env.SMTP_URL || ''
const emailFrom = process.env.EMAIL_FROM || ''

// The test mailbox: on only with ANNOUDIO_TEST_MAILBOX=1, no SMTP server, and a
// build that is not a production build. Next writes NODE_ENV into the bundle at build
// time, so a production build never has it.
const mailboxOn =
  process.env.NODE_ENV !== 'production' && process.env.ANNOUDIO_TEST_MAILBOX === '1' && !smtpUrl

/**
 * True when members can get a login code by mail: SMTP_URL is set, or the test mailbox
 * is on. Without it, new projects use invite codes and Today says so
 * (design/invite-codes.md).
 */
export const canMail = Boolean(smtpUrl) || mailboxOn

// Next can bundle each route with its own copy of this file. Keep one mailer per
// process on globalThis, so the test mailbox route reads the mails that the app sends.
const mailers = globalThis as typeof globalThis & { annoudioMailer?: Mailer }
const mailer = (mailers.annoudioMailer ??= smtpUrl
  ? smtpMailer({ url: smtpUrl, from: emailFrom })
  : // No SMTP server: write each mail to the server log (development only).
    memoryMailer({ echo: !mailboxOn }))

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const config = buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    // date-fns pattern. The browser shows it in the time zone of the operator.
    dateFormat: 'd MMM yyyy, HH:mm',
    components: {
      // Today replaces Payload's dashboard. The job links come before Payload's groups.
      views: {
        dashboard: { Component: '/admin/Today#Today', meta: { title: 'Today' } },
        addWidget: {
          Component: '/admin/addWidget/View#AddWidget',
          path: '/add-widget',
          meta: { title: 'Add a widget to a site' },
        },
        concepts: {
          Component: '/admin/vocabulary/ConceptsView#ConceptsView',
          path: '/concepts',
          meta: { title: 'Lists' },
        },
        // The operator preview of one widget: /admin/preview/{project}/{recording}.
        preview: {
          Component: '/admin/preview/View#PreviewView',
          path: '/preview',
          meta: { title: 'Preview of a widget' },
        },
        vocabulary: {
          Component: '/admin/vocabulary/VocabularyView#VocabularyView',
          path: '/vocabulary',
          meta: { title: 'Vocabulary' },
        },
      },
      // The stack's name in place of Payload's logo and icon (admin/Brand.tsx).
      graphics: { Logo: '/admin/Brand#Logo', Icon: '/admin/Brand#Icon' },
      beforeNavLinks: ['/admin/NavLinks#NavLinks'],
      // Names for the few Payload buttons that have none (axe button-name).
      providers: ['/admin/ui/AccessibleNames#AccessibleNames'],
      // O1: the heading and the help line of the sign-in screen.
      beforeLogin: ['/admin/LoginIntro#LoginIntro'],
      afterNavLinks: ['/admin/NavLinks#AccountLink'],
    },
    meta: { titleSuffix: ' · Annoudio' },
  },
  // Payload's own words where they disagree with CONTEXT.md and the review task.
  i18n: {
    translations: {
      en: {
        general: {
          // The home of the admin is Today (design/ia.md §4.1).
          dashboard: 'Today',
          welcome: 'Welcome to Annoudio',
          creatingNewLabel: 'New {{label}}',
          createdAt: 'Created',
          updatedAt: 'Last change',
        },
        version: { publishChanges: 'Publish' },
        // O0: the first visit of an empty stack.
        // Sign in and Sign out, never Login or Log out (design/concept-map.md W4). Keys checked
        // in @payloadcms/translations 3.90.2 `en.js`.
        authentication: {
          beginCreateFirstUser:
            'An operator decides which stories about your recordings visitors see. Type your email and a password to make the first operator account.',
          createFirstUser: 'Create the first operator',
          login: 'Sign in',
          loginUser: 'Sign in',
          forgotPasswordQuestion: 'Forgot your password?',
          forgotPassword: 'Reset your password',
          forgotPasswordEmailInstructions:
            'We send a link to the email of your operator account. Open the link to set a new password.',
          backToLogin: 'Back to Sign in',
          logOut: 'Sign out',
          logout: 'Sign out',
          logBackIn: 'Sign in again',
          loggingOut: 'Signing out…',
          loggedOutSuccessfully: 'You are signed out.',
          loggedOutInactivity: 'You were signed out, because you did nothing for a long time.',
          resetPassword: 'Set the password',
          resetYourPassword: 'Reset your password',
        },
      },
    },
  },
  // The sidebar: the job links (admin/NavLinks.tsx), then the group Settings in this
  // order: Projects, Recordings, Operators.
  collections: [
    storiesCollection,
    mediaCollection,
    projectsCollection({ stories: () => stories, removeVocabulary, canMail }),
    recordingsCollection({ stories: () => stories }),
    conceptsCollection({ origin, stories: () => stories }),
    ontologiesCollection({ origin }),
    ontologyTermsCollection,
    vocabListsCollection,
    vocabFieldsCollection,
    membersCollection,
    Users,
    storyRepresentationsCollection,
    storyValuesCollection,
    memberSessionsCollection,
    loginCodesCollection,
    inviteCodesCollection,
    inviteUsesCollection,
    inviteTriesCollection,
  ],
  // Payload's own mail: the password reset of an operator (M7). With SMTP, the nodemailer
  // adapter; without, the memory mailer of the app, so the tests read it.
  email: smtpUrl
    ? nodemailerAdapter({
        defaultFromAddress: addressOf(emailFrom),
        defaultFromName: 'Annoudio',
        transport: nodemailer.createTransport(smtpUrl),
        // A CLI run (migrate) and `next build` load this config too: no SMTP check there.
        skipVerify: true,
      })
    : mailerEmailAdapter(mailer, emailFrom),
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Development pushes the schema. Production changes it only with the migrations in
    // this folder: the image runs `payload migrate` before `next start` (deploy/).
    push: process.env.NODE_ENV !== 'production',
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  plugins: [],
})

export default config

const optionalNumber = (name: string) =>
  process.env[name] === undefined ? undefined : Number(process.env[name])

/** The one `vocabulary` instance of the app (design/vocab.md §9.2). */
export const vocabulary = createVocabulary({
  payload: () => getPayload({ config }),
  origin,
  stories: () => stories,
})

/** The one `stories` instance of the app. Payload starts on its first call. */
export const stories = createStories({
  payload: () => getPayload({ config }),
  origin,
  vocabulary,
  notify: async (event) => {
    forgetWaitingCount()
    await notices.storyEvent(event)
  },
  pageSize: optionalNumber('STORIES_PAGE_SIZE'),
  maxAge: optionalNumber('STORIES_MAX_AGE'),
  limits: {
    bodies: optionalNumber('STORIES_MAX_BODIES'),
    values: optionalNumber('STORIES_MAX_VALUES'),
    text: optionalNumber('STORIES_MAX_TEXT'),
  },
})

/** The memory mailer when the test mailbox is on (see above), else null. */
export const testMailbox: MemoryMailer | null = mailboxOn ? (mailer as MemoryMailer) : null

/** The one `membership` instance of the app. Payload starts on its first call. */
export const membership = createMembership({
  payload: () => getPayload({ config }),
  origin,
  secret: process.env.PAYLOAD_SECRET || '',
  mailer,
  codesPerHour: optionalNumber('ANNOUDIO_CODES_PER_HOUR'),
  signInOf: async (slug) =>
    (await bySlug({ payload: await getPayload({ config }), origin }, slug))?.signIn ?? null,
})

/** The mails M2 to M5 after a change to a story. */
const notices = createNotices({
  mailer,
  origin,
  contact: (memberId) => membership.contact(memberId),
  projectName: async (slug) =>
    (await bySlug({ payload: await getPayload({ config }), origin }, slug))?.label ?? null,
  recordingTitle: async (id) =>
    (await findRecording({ payload: await getPayload({ config }), origin }, id))?.title ?? null,
  operators: async (choice) => operatorsByReviewMail(await getPayload({ config }), choice),
  waiting: async () => {
    const projects = await allProjects({ payload: await getPayload({ config }) })
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

// Next can bundle each route with its own copy of this file. Keep one `media` instance
// per process, so the upload route and the consumer share one pg-boss pool.
const medias = globalThis as typeof globalThis & { annoudioMedia?: Media }

/** The one `media` instance of the app. Payload starts on its first call. */
export const media = (medias.annoudioMedia ??= createMedia({
  payload: () => getPayload({ config }),
  origin,
  // A relative MEDIA_DIR is relative to the folder that runs the app.
  mediaDir: path.resolve(process.env.MEDIA_DIR || 'media'),
  databaseUrl: process.env.DATABASE_URL || '',
  sessionFromRequest: (request) => membership.sessionFromRequest(request),
  onSettled: (mediaId) => stories.mediaSettled(mediaId),
}))

/**
 * Start the job consumers of this process: the `media.settled` reports of the worker, and
 * the daily review mail (`mail.digest`, which the worker schedules). Only the Next server
 * calls it (`src/instrumentation.ts`), with ANNOUDIO_MEDIA_CONSUMER=1.
 * Not Payload `onInit`: every process that loads this config runs `onInit`, also
 * `payload run deploy/migrate.ts`, which then took a job and stopped with it
 * (design/phase5c-notes.md, "media.settled stays active").
 */
export async function startConsumers(): Promise<void> {
  const consumers = globalThis as typeof globalThis & {
    annoudioConsumer?: Promise<SettledConsumer>
  }
  consumers.annoudioConsumer ??= (async () => {
    const payload = await getPayload({ config })
    const settled = await media.startSettledConsumer(payload)
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL || '',
      supervise: false,
      schedule: false,
      max: 2,
    })
    boss.on('error', (error) => console.error('[mail] pg-boss:', error))
    await boss.start()
    await workDigest(boss, async () => {
      const sent = await notices.digest()
      console.info(`[mail] mail.digest: ${sent} review mails sent.`)
    })
    return {
      async stop() {
        await settled.stop()
        await boss.stop({ graceful: true, timeout: 5_000 })
      },
    }
  })()
  await consumers.annoudioConsumer
}
