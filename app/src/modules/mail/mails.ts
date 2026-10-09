// All mail text: M1 to M7 of design/ia.md §2.3. English only. Each mail has one link.
// A member mail speaks as "the {project} team" and never names an operator.

import { countWords, waitLine } from '@/plural'

import type { MailKind, MailMessage } from './mailer'

/** What a member mail says about one story or reply. */
export interface StoryLine {
  /** The recording title. */
  title: string
  /** "1:02–1:35" for a story. Null for a reply. */
  range: string | null
  /** The name of the member who told the story that a reply answers. Null for a story. */
  parentNickname: string | null
}

/** A mail before it has an address. */
export type Mail = Omit<MailMessage, 'to'>

/** "your story about “Ferry crossing, 1962”, 1:02–1:35" or "your reply to Asha's story …". */
function about(line: StoryLine): string {
  if (line.range === null) {
    const whose = line.parentNickname ? `the story by ${line.parentNickname}` : 'a story'
    return `your reply to ${whose} about “${line.title}”`
  }
  return `your story about “${line.title}”, ${line.range}`
}

const noun = (line: StoryLine) => (line.range === null ? 'reply' : 'story')
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** One mail from paragraphs and one link, as plain text and as simple HTML. */
function compose(
  kind: MailKind,
  fromName: string,
  subject: string,
  paragraphs: string[],
  link: { label: string; url: string } | null,
  signature: string,
): Mail {
  const text = [...paragraphs, ...(link ? [`${link.label}: ${link.url}`] : []), signature].join(
    '\n\n',
  )
  const html = [
    ...paragraphs.map((p) => `<p>${escape(p).replaceAll('\n', '<br>')}</p>`),
    ...(link ? [`<p><a href="${escape(link.url)}">${escape(link.label)}</a></p>`] : []),
    `<p>${escape(signature)}</p>`,
  ].join('\n')
  return { kind, fromName, subject, text, html }
}

function escape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

const team = (project: string) => `The ${project} team`

export const mails = {
  /** M1. `site`: the project name of the Annotate page, else "Annoudio". */
  loginCode(input: { code: string; site: string }): Mail {
    return compose(
      'login-code',
      input.site,
      `Your login code for ${input.site}`,
      [
        `Your login code is ${input.code}.`,
        'Type it on the page where you asked for it. It works one time, for 10 minutes.',
        'Your account works on all sites of this organisation.',
        'If you did not ask for a code, do nothing. Nobody can sign in without the code.',
      ],
      null,
      team(input.site),
    )
  },

  /** M2. The reason is the operator's text, or the text of a system return. */
  returned(input: { project: string; line: StoryLine; reason: string; link: string }): Mail {
    const kind = noun(input.line)
    return compose(
      'returned',
      input.project,
      `Your ${kind} needs a change`,
      [
        `We returned ${about(input.line)} to you.`,
        `Reason: ${input.reason}`,
        `Visitors do not see the ${kind} until it is published. Change it, then send it for review again.`,
      ],
      { label: `Change your ${kind}`, url: input.link },
      team(input.project),
    )
  },

  /** M3. */
  published(input: { project: string; line: StoryLine; link: string }): Mail {
    const kind = noun(input.line)
    return compose(
      'published',
      input.project,
      `Your ${kind} is published`,
      [
        `${capital(about(input.line))} is published. Visitors see it in the player now.`,
        'To stop these mails, change your choice on Your account.',
      ],
      { label: 'Listen on the site', url: input.link },
      team(input.project),
    )
  },

  /** M4. `excerpt`: the first 200 characters of the reply. */
  replied(input: {
    project: string
    line: StoryLine
    replier: string
    excerpt: string
    link: string
  }): Mail {
    return compose(
      'replied',
      input.project,
      'Someone replied to your story',
      [
        `${input.replier} replied to ${about(input.line)}:`,
        `“${input.excerpt}”`,
        'To stop these mails, change your choice on Your account.',
      ],
      { label: 'Read the reply', url: input.link },
      team(input.project),
    )
  },

  /**
   * M5. `withStory`: a reply that went because its story was removed. `reason`: the
   * operator's optional text; a reply member does not get it.
   */
  removed(input: {
    project: string
    line: StoryLine
    reason: string | null
    withStory: boolean
    link: string
  }): Mail {
    const kind = noun(input.line)
    const paragraphs = input.withStory
      ? [`The story that you replied to is removed. So ${about(input.line)} is removed too.`]
      : [
          `We removed ${about(input.line)}. Visitors do not see it now.`,
          ...(input.reason ? [`Reason: ${input.reason}`] : []),
        ]
    return compose(
      'removed',
      input.project,
      `Your ${kind} is removed`,
      paragraphs,
      { label: 'Your stories', url: input.link },
      team(input.project),
    )
  },

  /** M6. `projects`: each project with its waiting stories and replies. */
  review(input: {
    stories: number
    replies: number
    projects: { name: string; stories: number; replies: number }[]
    oldest: string
    link: string
  }): Mail {
    return compose(
      'review',
      'Annoudio',
      waitLine(input.stories, input.replies),
      [
        input.projects.map((p) => `${p.name}: ${countWords(p.stories, p.replies)}`).join('\n'),
        `The oldest came in ${input.oldest}.`,
        'To change how often you get this mail, open Your account in the admin.',
      ],
      { label: 'Review the stories', url: input.link },
      'Annoudio',
    )
  },

  /** M7. Payload sends it as HTML only. */
  passwordReset(input: { link: string; hours: number }): { subject: string; html: string } {
    const mail = compose(
      'password-reset',
      'Annoudio',
      'Reset your Annoudio password',
      [
        'Somebody asked to reset the password of your Annoudio account.',
        `To set a new password, open the link. It works for ${input.hours === 1 ? '1 hour' : `${input.hours} hours`}.`,
        'If you did not ask for it, do nothing. Your password does not change.',
      ],
      { label: 'Set a new password', url: input.link },
      'Annoudio',
    )
    return { subject: mail.subject, html: mail.html }
  },
}
