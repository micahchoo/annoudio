// The mails that follow a change to a story (design/ia.md §2.3): M2 returned, M3
// published, M4 replied, M5 removed, and M6 to operators (each story, or the daily
// digest). `stories` calls `storyEvent` after the commit (`StoriesConfig.notify`). The
// lookups come in as functions, so this module reads no collection of another module.

import { ago, clockRange } from '@/clock'
import { withWidgetFragment } from '@/fragment'
import type { StoryEvent, StoryRef, Tally } from '@/modules/stories'

import type { Mailer } from './mailer'
import { mails, type Mail, type StoryLine } from './mails'

/** A member as the mails need them. Null for an unknown or a blocked member. */
export interface Contact {
  email: string
  nickname: string
  /** M3 and M4 only. Mails that ask for an action, or say what happened, always go. */
  mailNotices: boolean
}

export interface NoticesConfig {
  mailer: Mailer
  /** ANNOUDIO_ORIGIN: the Annotate page and Your stories are here. */
  origin: string
  contact(memberId: string): Promise<Contact | null>
  projectName(slug: string): Promise<string | null>
  recordingTitle(id: string): Promise<string | null>
  /** The emails of the operators with this review mail choice. */
  operators(choice: 'daily' | 'each'): Promise<string[]>
  /** What waits for review: in all, and per project (only projects where something waits). */
  waiting(): Promise<{
    total: Tally
    projects: ({ name: string } & Tally)[]
    oldestWaiting: string | null
  }>
  /** Default: the system clock. */
  now?: () => Date
}

export interface Notices {
  /** Send the mails of one story event. A failed send goes to the log; the others go. */
  storyEvent(event: StoryEvent): Promise<void>
  /**
   * The daily digest (M6): one mail to each operator with "once a day", when one story or
   * reply or more waits. Gives the number of mails sent. The `mail.digest` job calls it.
   */
  digest(): Promise<number>
}

const EXCERPT = 200

export function createNotices(config: NoticesConfig): Notices {
  const { origin } = config
  const mine = `${origin}/annotate/mine`

  const titleOf = async (story: StoryRef) =>
    (await config.recordingTitle(story.recording)) ?? 'a recording'

  async function lineOf(story: StoryRef): Promise<StoryLine> {
    return {
      title: await titleOf(story),
      range: story.start === undefined ? null : clockRange(story.start, story.end),
      parentNickname: story.parent?.nickname ?? null,
    }
  }

  /**
   * The host page at the story, so the widget opens it (CONTRACT §7.2, `annoudio-story`).
   * A reply opens the story that it answers. With no host page: Your stories.
   */
  function listenLink(story: StoryRef): string {
    if (!story.toldOn) return mine
    const open = story.parent ?? { id: story.id, start: story.start ?? 0 }
    return withWidgetFragment(story.toldOn, {
      project: story.project,
      recording: story.recording,
      t: open.start,
      story: open.id,
    })
  }

  /** The Annotate page with the story open, so the member can change it. */
  function changeLink(story: StoryRef): string {
    const query = new URLSearchParams({
      project: story.project,
      recording: story.recording,
      t: String(Math.floor(story.start ?? story.parent?.start ?? 0)),
      story: story.id,
    })
    if (story.parent) query.set('replyTo', story.parent.id)
    if (story.toldOn) query.set('return', story.toldOn)
    return `${origin}/annotate?${query}`
  }

  async function send(memberId: string, build: (contact: Contact) => Promise<Mail | null>) {
    try {
      const contact = await config.contact(memberId)
      if (!contact) return
      const mail = await build(contact)
      if (mail) await config.mailer.send({ ...mail, to: contact.email })
    } catch (error) {
      console.error(`[mail] A mail to member ${memberId} failed.`, error)
    }
  }

  /** M6 to each of these operators, when something waits. */
  async function review(emails: string[]): Promise<number> {
    if (emails.length === 0) return 0
    const { total, projects, oldestWaiting } = await config.waiting()
    if (total.stories + total.replies === 0 || oldestWaiting === null) return 0
    const mail = mails.review({
      ...total,
      projects,
      oldest: ago(oldestWaiting, (config.now ?? (() => new Date()))()),
      link: `${origin}/admin/collections/stories`,
    })
    let sent = 0
    for (const to of emails) {
      try {
        await config.mailer.send({ ...mail, to })
        sent += 1
      } catch (error) {
        console.error(`[mail] The review mail to ${to} failed.`, error)
      }
    }
    return sent
  }

  async function storyEvent(event: StoryEvent): Promise<void> {
    const { story } = event
    const project = (await config.projectName(story.project)) ?? story.project
    switch (event.kind) {
      case 'returned':
        await send(story.memberId, async () =>
          mails.returned({
            project,
            line: await lineOf(story),
            reason: event.reason,
            link: changeLink(story),
          }),
        )
        return
      case 'published': {
        await send(story.memberId, async (contact) =>
          contact.mailNotices
            ? mails.published({
                project,
                line: await lineOf(story),
                link: listenLink(story),
                onSite: Boolean(story.toldOn),
              })
            : null,
        )
        const parent = story.parent
        if (parent && parent.memberId !== story.memberId) {
          const text = [...story.text]
          await send(parent.memberId, async (contact) =>
            contact.mailNotices
              ? mails.replied({
                  project,
                  line: {
                    title: await titleOf(story),
                    range: clockRange(parent.start, parent.end),
                    parentNickname: null,
                  },
                  replier: story.nickname,
                  excerpt:
                    text.length > EXCERPT ? `${text.slice(0, EXCERPT).join('')}…` : story.text,
                  link: listenLink(story),
                  onSite: Boolean(story.toldOn),
                })
              : null,
          )
        }
        return
      }
      case 'removed': {
        await send(story.memberId, async () =>
          mails.removed({
            project,
            line: await lineOf(story),
            reason: event.reason,
            withStory: false,
            link: mine,
          }),
        )
        // Each reply's member, once. The member of the story already has a mail.
        const told = new Set([story.memberId])
        for (const reply of event.replies) {
          if (told.has(reply.memberId)) continue
          told.add(reply.memberId)
          await send(reply.memberId, async () =>
            mails.removed({
              project,
              line: await lineOf(reply),
              reason: null,
              withStory: true,
              link: mine,
            }),
          )
        }
        return
      }
      case 'waiting':
        await review(await config.operators('each'))
        return
    }
  }

  return { storyEvent, digest: async () => review(await config.operators('daily')) }
}
