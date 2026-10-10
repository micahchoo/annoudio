// Your stories (P7, design/ia.md §4.2): the member home. Every story and reply of the
// member on all sites, in groups by lifecycle state: Returned to you, Processing,
// Waiting for review, Published, Replies. It has no single project: the default look.

import config, { membership, stories } from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { clockRange } from '@/clock'
import { withWidgetFragment } from '@/fragment'
import { recording as findRecording } from '@/modules/catalogue'
import { bySlug } from '@/modules/projects'
import { lifecycle, type OwnStory } from '@/modules/stories'

import { Frame } from '../Frame'
import { annotatePath } from '../link'
import { SignInForm } from '../SignInForm'
import { StateBadges } from '../StateBadges'
import { memberPagesMode } from '../signInMode'
import { strings } from '../strings'
import '../annotate.css'

export const metadata: Metadata = { title: strings.mine.title, robots: { index: false } }

const s = strings.mine
type Group = keyof typeof s.groups
const GROUPS = Object.keys(s.groups) as Group[]

/** The group of a card. A returned reply asks for an action: it is with the returned stories. */
function groupOf(story: OwnStory): Group {
  const state = lifecycle(story)
  if ((state.change ?? state.state) === 'returned') return 'returned'
  if (story.replyTo) return 'replies'
  return state.state
}

export default async function YourStories() {
  const session = await membership.sessionFromRequest({ headers: await headers() })
  if (!session) {
    return (
      <Frame title={s.title} project={null} back={null} session={null} after="/annotate/mine">
        <SignInForm
          link={null}
          mode={memberPagesMode()}
          next="/annotate/mine"
          heading={s.signIn}
          moment={s.moment}
        />
      </Frame>
    )
  }
  const payload = await getPayload({ config })
  const site = { payload, origin: process.env.ANNOUDIO_ORIGIN || '' }
  const [own, account] = await Promise.all([
    stories.ownStories(session),
    membership.account(session),
  ])
  // The names of the projects and recordings, and the member of each story that a reply answers.
  const unique = <T,>(values: T[]) => [...new Set(values)]
  const [projects, recordings, parents] = await Promise.all([
    Promise.all(
      unique(own.map((o) => o.project)).map(
        async (slug) => [slug, (await bySlug(site, slug))?.label ?? slug] as const,
      ),
    ),
    Promise.all(
      unique(own.map((o) => o.recording)).map(
        async (id) => [id, (await findRecording(site, id))?.title ?? id] as const,
      ),
    ),
    Promise.all(
      own.flatMap((o) =>
        o.replyTo
          ? [
              stories
                .publishedStory(o, o.replyTo)
                .then((p) => [o.replyTo!, p?.nickname ?? null] as const),
            ]
          : [],
      ),
    ),
  ])
  const names = {
    project: new Map(projects),
    recording: new Map(recordings),
    parent: new Map(parents),
  }
  const grouped = new Map<Group, OwnStory[]>(GROUPS.map((group) => [group, []]))
  for (const story of own) grouped.get(groupOf(story))!.push(story)

  return (
    <Frame title={s.title} project={null} back={null} session={session} after="/annotate/mine">
      {account && !account.emailVerified && <p className="hint no-mail">{s.noMail}</p>}
      {own.length === 0 ? (
        <p className="empty">{s.empty}</p>
      ) : (
        GROUPS.map((group) => {
          const cards = grouped.get(group)!
          return (
            <section
              key={group}
              aria-labelledby={`group-${group}`}
              className="group"
              data-group={group}
            >
              <h2 id={`group-${group}`}>
                {s.groups[group]} <span className="count">{s.count(cards.length)}</span>
              </h2>
              {cards.length === 0 ? (
                <p className="hint">{s.none}</p>
              ) : (
                <ul className="cards">
                  {cards.map((story) => (
                    <Card key={story.id} story={story} names={names} />
                  ))}
                </ul>
              )}
            </section>
          )
        })
      )}
    </Frame>
  )
}

function Card(props: {
  story: OwnStory
  names: {
    project: Map<string, string>
    recording: Map<string, string>
    parent: Map<string, string | null>
  }
}) {
  const { story, names } = props
  const state = lifecycle(story)
  const text = story.bodies.find((body) => body.kind === 'text')
  const where = story.replyTo
    ? strings.own.reply(names.parent.get(story.replyTo) ?? null)
    : clockRange(story.start, story.end)
  const change = annotatePath({
    project: story.project,
    recording: story.recording,
    t: Math.floor(story.start ?? 0),
    return: story.toldOn ?? null,
    replyTo: story.replyTo ?? null,
    story: story.id,
  })
  const listen =
    state.state === 'published' && story.toldOn
      ? withWidgetFragment(story.toldOn, {
          project: story.project,
          recording: story.recording,
          t: story.start ?? 0,
          story: story.replyTo ?? story.id,
        })
      : null
  return (
    <li className="card" data-story={story.id}>
      <h3>
        {names.recording.get(story.recording)} · {where}
      </h3>
      <p className="card__meta">
        {names.project.get(story.project)} <StateBadges story={story} />
      </p>
      {story.rejection && (state.change ?? state.state) === 'returned' && (
        <p className="returned">
          <strong>{strings.story.reason}</strong> {story.rejection.reason}
        </p>
      )}
      {text?.kind === 'text' && <p className="card__text">{text.value}</p>}
      <p className="card__links">
        <a href={change}>
          {story.replyTo ? strings.story.changeReply : strings.story.change}
          <span className="visually-hidden">: {where}</span>
        </a>
        {listen && (
          <a href={listen}>
            {strings.story.listen}
            <span className="visually-hidden">: {where}</span>
          </a>
        )}
      </p>
    </li>
  )
}
