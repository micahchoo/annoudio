// The Annotate page: the first-party page where a member writes a story or a reply.
// URL: /annotate?project&recording&t&return (CONTRACT.md §7); the player's Reply link adds
// `replyTo` (§7.3). Extra keys that only this stack sets: `story` (show and change an own
// story or reply: Your story, P6) and `saved=1` (just after a save with no return).

import config, { media, membership, stories } from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { clock, clockRange } from '@/clock'
import { withPlayerFragment } from '@/fragment'
import { recording as findRecording } from '@/modules/catalogue'
import { PICKER_TYPES, UPLOAD_LIMITS } from '@/modules/media'
import { bySlug, returnTarget, theme, type Project } from '@/modules/projects'
import {
  lifecycle,
  type MemberSession,
  type OwnDraft,
  type PublishedStory,
} from '@/modules/stories'
import { conceptsOf, type ConceptNode } from '@/modules/vocabulary'

import { Frame } from './Frame'
import { annotatePath, readLink, uuidv7, type AnnotateLink } from './link'
import type { Attachment } from './MediaField'
import { ReplyForm } from './ReplyForm'
import { SignInForm } from './SignInForm'
import { StoryForm, type StoryDraft, type TopicNode } from './StoryForm'
import { stateLabel, stateSentence, strings } from './strings'
import './annotate.css'

export const metadata: Metadata = { title: strings.title, robots: { index: false } }

type Query = Record<string, string | string[] | undefined>

export default async function AnnotatePage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams
  const given = readLink(query)
  if (!given) notFound()
  const payload = await getPayload({ config })
  const site = { payload, origin: process.env.ANNOUDIO_ORIGIN || '' }
  const [project, recording, look] = await Promise.all([
    bySlug(site, given.project),
    findRecording(site, given.recording),
    theme({ payload }, given.project),
  ])
  if (!project || !recording) notFound()

  // Open-redirect rule: keep `return` only if its origin is a site of the project.
  const link: AnnotateLink = { ...given, return: returnTarget(project, given.return) }
  const [session, parent] = await Promise.all([
    membership.sessionFromRequest({ headers: await headers() }),
    link.replyTo ? stories.publishedStory(link, link.replyTo) : null,
  ])
  const back = link.return
    ? {
        href: withPlayerFragment(link.return, {
          project: link.project,
          recording: link.recording,
          t: link.t,
        }),
        label: strings.back,
      }
    : { href: '/annotate/mine', label: strings.menu.stories }

  return (
    <Frame
      title={link.replyTo ? strings.replyTitle : strings.title}
      subtitle={recording.title}
      project={{
        name: project.label,
        tokens: look?.tokens ?? {},
        rightsLine: project.rightsLine,
        rightsIri: project.rightsIri,
      }}
      back={back}
      session={session}
      after={annotatePath(link)}
    >
      {link.replyTo && !parent ? (
        <ParentGone link={link} />
      ) : (
        <>
          {parent && <ParentStory parent={parent} />}
          {session ? (
            <Workspace
              link={link}
              session={session}
              justSaved={query.saved === '1'}
              origin={site.origin}
              audio={recording.urls[0]}
              project={project}
              concepts={await conceptsOf(site, project.slug)}
            />
          ) : (
            <SignInForm
              link={link}
              moment={
                parent
                  ? strings.signIn.replyMoment(parent.nickname)
                  : strings.signIn.moment(clock(link.t))
              }
            />
          )}
        </>
      )}
    </Frame>
  )
}

/** The story that the member answers: text, nickname and time range. */
function ParentStory({ parent }: { parent: PublishedStory }) {
  const s = strings.reply
  return (
    <section aria-labelledby="parent-heading" className="parent">
      <h2 id="parent-heading">{s.parentHeading}</h2>
      <p className="hint">
        {s.by(parent.nickname)} · {clockRange(parent.start, parent.end)}
      </p>
      {parent.texts.map((text, i) => (
        <blockquote key={i} lang={text.language}>
          {text.value}
        </blockquote>
      ))}
    </section>
  )
}

/** `replyTo` names no published story of this instance. */
function ParentGone({ link }: { link: AnnotateLink }) {
  const s = strings.reply.parentGone
  return (
    <section aria-labelledby="parent-gone-heading">
      <h2 id="parent-gone-heading">{s.heading}</h2>
      <p>{s.body}</p>
      <p>
        <a href={annotatePath({ ...link, replyTo: null, story: null })}>{strings.reply.newStory}</a>
      </p>
    </section>
  )
}

async function Workspace(props: {
  link: AnnotateLink
  session: MemberSession
  justSaved: boolean
  origin: string
  audio: string
  project: Project
  concepts: ConceptNode[]
}) {
  const { link, project } = props
  const own = await stories.ownDrafts(props.session, {
    project: link.project,
    recording: link.recording,
  })
  // `story` opens an own story in the story form, and an own reply to `replyTo` in the reply form.
  const editing = own.find(
    (story) => story.id === link.story && (story.replyTo ?? null) === link.replyTo,
  )
  const text = editing?.bodies
    .flatMap((body) => (body.kind === 'text' ? body.value : []))
    .join('\n\n')
  const media = editing ? await attachments(editing, props.session) : []
  const parents = await replyParents(link, own)
  const atOnce = project.reviewRule === 'publish-at-once'
  const fresh = { ...link, story: null }

  if (link.replyTo) {
    // A new reply gets its id now, so a repeated save of this form updates one reply.
    const reply = editing
      ? { id: editing.id, etag: editing.etag, text: text ?? '', media }
      : { id: uuidv7(), text: '', media: [] }
    return (
      <>
        {editing && <StoryStatus story={editing} link={link} justSaved={props.justSaved} />}
        <ReplyForm
          key={reply.id}
          link={link}
          reply={reply}
          submit={atOnce ? strings.reply.publish : strings.form.send}
          limits={UPLOAD_LIMITS}
          pickerTypes={PICKER_TYPES}
        />
        <p>
          <a href={annotatePath({ ...fresh, replyTo: null })}>{strings.reply.newStory}</a>
        </p>
        <OwnStories link={link} own={own} parents={parents} />
      </>
    )
  }

  // A new story gets its id now, so a repeated save of this form updates one story.
  const story: StoryDraft = editing
    ? {
        id: editing.id,
        etag: editing.etag,
        start: editing.start!,
        end: editing.end!,
        text: text ?? '',
        tags: editing.tags,
        media,
      }
    : { id: uuidv7(), start: link.t, end: link.t + 10, text: '', tags: [], media: [] }

  return (
    <>
      {editing && <StoryStatus story={editing} link={link} justSaved={props.justSaved} />}
      <StoryForm
        key={story.id}
        link={link}
        origin={props.origin}
        audio={props.audio}
        story={story}
        topics={tree(
          // A hidden concept is not for new stories. An own story that has it keeps it.
          props.concepts.filter((concept) => !concept.hidden || story.tags.includes(concept.iri)),
        )}
        submit={atOnce ? strings.form.publish : strings.form.send}
        limits={UPLOAD_LIMITS}
        pickerTypes={PICKER_TYPES}
      />
      {editing && (
        <p>
          <a href={annotatePath(fresh)}>{strings.form.newStory}</a>
        </p>
      )}
      <OwnStories link={link} own={own} parents={parents} />
    </>
  )
}

/**
 * Your story (P5, P6): where an own story is in its lifecycle, from `stories.lifecycle`.
 * A returned story shows the reason. Just after a save, it says "Sent." or "Published.".
 */
function StoryStatus(props: { story: OwnDraft; link: AnnotateLink; justSaved: boolean }) {
  const { story } = props
  const s = strings.story
  const state = lifecycle(story)
  const returned = (state.change ?? state.state) === 'returned'
  const listen =
    state.state === 'published' && story.toldOn
      ? withPlayerFragment(story.toldOn, {
          project: props.link.project,
          recording: props.link.recording,
          t: story.start ?? 0,
          story: story.replyTo ?? story.id,
        })
      : null
  return (
    <section
      aria-labelledby="status-heading"
      className={`status status--${returned ? 'returned' : state.state}`}
      role={props.justSaved ? 'status' : undefined}
    >
      <h2 id="status-heading">
        {story.replyTo ? s.replyHeading : s.heading}{' '}
        <span className="badge">{stateLabel(state)}</span>
      </h2>
      {/* A returned story has its reason below; the badge already says "Returned to you". */}
      {(!returned || props.justSaved) && (
        <p>
          {props.justSaved && (state.state === 'published' && !state.change ? s.published : s.sent)}{' '}
          {!returned && stateSentence(state)}
        </p>
      )}
      {returned && story.rejection && (
        <p className="returned">
          <strong>{s.reason}</strong> {story.rejection.reason}
          <br />
          {s.returnedHint}
        </p>
      )}
      {listen && (
        <p>
          <a href={listen}>{s.listen}</a>
        </p>
      )}
    </section>
  )
}

/** The published story that each own reply answers, by id. A hidden one is absent. */
async function replyParents(
  link: AnnotateLink,
  own: OwnDraft[],
): Promise<Map<string, PublishedStory>> {
  const ids = [...new Set(own.flatMap((story) => story.replyTo ?? []))]
  const found = await Promise.all(ids.map((id) => stories.publishedStory(link, id)))
  return new Map(found.flatMap((parent) => (parent ? [[parent.id, parent] as const] : [])))
}

/** The media bodies of an own story, with their state, so the form keeps them. */
async function attachments(story: OwnDraft, session: MemberSession): Promise<Attachment[]> {
  const found = await Promise.all(
    story.bodies.map(async (body) => {
      if (body.kind === 'text') return []
      const current = await media.body(body.media, session.memberId)
      return current
        ? [{ kind: body.kind, id: body.media, state: current.state, url: current.url }]
        : []
    }),
  )
  return found.flat()
}

function OwnStories(props: {
  link: AnnotateLink
  own: OwnDraft[]
  parents: Map<string, PublishedStory>
}) {
  const { link, own, parents } = props
  const s = strings.own
  return (
    <section aria-labelledby="own-heading" className="own">
      <h2 id="own-heading">{s.heading}</h2>
      {own.length === 0 ? (
        <p>{s.none}</p>
      ) : (
        <ul>
          {own.map((story) => {
            const text = story.bodies.find((body) => body.kind === 'text')
            const where = story.replyTo
              ? s.reply(parents.get(story.replyTo)?.nickname ?? null)
              : clockRange(story.start, story.end)
            const change = story.replyTo
              ? annotatePath({ ...link, replyTo: story.replyTo, story: story.id })
              : annotatePath({ ...link, t: story.start!, replyTo: null, story: story.id })
            return (
              <li key={story.id} data-story={story.id}>
                <span className="when">{where}</span>{' '}
                <span className="state">{stateLabel(lifecycle(story))}</span>
                {story.rejection && (
                  <p className="returned">
                    <strong>{strings.story.reason}</strong> {story.rejection.reason}
                  </p>
                )}
                {text?.kind === 'text' && <p>{text.value}</p>}
                <a href={change}>
                  {story.replyTo ? strings.story.changeReply : strings.story.change}
                  <span className="visually-hidden">: {where}</span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** The concepts as a tree. A concept whose parent is not in the list is a root. */
function tree(concepts: ConceptNode[]): TopicNode[] {
  const nodes = new Map(
    concepts.map((concept) => [
      concept.iri,
      { iri: concept.iri, label: concept.label, children: [] as TopicNode[] },
    ]),
  )
  const roots: TopicNode[] = []
  for (const concept of concepts) {
    const node = nodes.get(concept.iri)!
    const parent = concept.parent ? nodes.get(concept.parent) : undefined
    ;(parent ? parent.children : roots).push(node)
  }
  return roots
}
