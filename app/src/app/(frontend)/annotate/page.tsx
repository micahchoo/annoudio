// The Annotate page: the first-party page where a member writes a story or a reply.
// URL: /annotate?project&recording&t&return (CONTRACT.md §7); the widget's Reply link adds
// `replyTo` (§7.3). Extra keys that only this stack sets: `story` (show and change an own
// story or reply: Your story, P6) and `saved=1` (just after a save with no return).

import config, { media, membership, stories, vocabulary } from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { clock, clockRange } from '@/clock'
import { withWidgetFragment } from '@/fragment'
import { recording as findRecording } from '@/modules/catalogue'
import { PICKER_TYPES, UPLOAD_LIMITS } from '@/modules/media'
import { bySlug, returnTarget, theme, type Project } from '@/modules/projects'
import {
  lifecycle,
  type MemberSession,
  type OwnDraft,
  type PublishedStory,
} from '@/modules/stories'
import type { Profile } from '@/modules/vocabulary'

import { Frame } from './Frame'
import { annotatePath, readLink, uuidv7, type AnnotateLink } from './link'
import type { Attachment } from './MediaField'
import { ReplyForm } from './ReplyForm'
import { SignInForm } from './SignInForm'
import { answersOf } from './answers'
import type { FormQuestion, KeptAnswer } from './FieldControls'
import { StateBadges } from './StateBadges'
import { StoryForm, type StoryDraft } from './StoryForm'
import { stateKey, stateLabel, stateSentence, strings } from './strings'
import './annotate.css'
import './questions.css'

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
  // The link keeps `return` as given: the forms send it on, and `stories` keeps a page whose
  // website is not on the list for the operator ("Add this website"). The way back uses only
  // the checked target (open-redirect rule); the admin preview page of a widget is the one
  // page of this stack that it accepts.
  const link: AnnotateLink = given
  const target = returnTarget(project, given.return, { self: site.origin })
  const justSaved = query.saved === '1' && given.story !== null
  const notListed = given.return !== null && target === null
  const [session, parent] = await Promise.all([
    membership.sessionFromRequest({ headers: await headers() }),
    link.replyTo ? stories.publishedStory(link, link.replyTo) : null,
  ])
  const own = session
    ? await stories.ownDrafts(session, { project: link.project, recording: link.recording })
    : []
  // `story` opens an own story in the story form, and an own reply to `replyTo` in the reply form.
  const editing = own.find(
    (story) => story.id === link.story && (story.replyTo ?? null) === link.replyTo,
  )
  const back = target
    ? {
        href: withWidgetFragment(target, {
          project: link.project,
          recording: link.recording,
          t: link.t,
        }),
        label: strings.back,
      }
    : {
        href: '/annotate/mine',
        label: strings.menu.stories,
        // After a save, the done screen says it (workflow-audit 12, 19).
        note: notListed && !justSaved ? strings.notListed : undefined,
      }

  return (
    <Frame
      title={
        justSaved
          ? link.replyTo
            ? strings.story.replyHeading
            : strings.story.heading
          : link.replyTo
            ? strings.replyTitle
            : editing
              ? strings.changeTitle
              : strings.title
      }
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
              own={own}
              editing={editing}
              justSaved={justSaved}
              back={target ? back.href : null}
              notListed={notListed}
              origin={site.origin}
              audio={recording.urls[0]}
              duration={recording.duration}
              project={project}
              profile={await vocabulary.profile(project.slug)}
            />
          ) : (
            <SignInForm
              link={link}
              mode={project.signIn}
              moment={
                parent
                  ? strings.signIn.replyMoment(parent.nickname)
                  : strings.signIn.moment(clock(link.t), recording.title)
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
  /** The own stories and replies on this recording. */
  own: OwnDraft[]
  /** The own story or reply that `story` names, if any. */
  editing: OwnDraft | undefined
  justSaved: boolean
  /** The checked way back to the site, or null. */
  back: string | null
  /** A `return` was given, but its website is not on the list of the project. */
  notListed: boolean
  origin: string
  audio: string
  /** The length of the recording in seconds, when the catalogue knows it. */
  duration?: number
  project: Project
  profile: Profile | null
}) {
  const { link, project, own, editing } = props
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
    if (editing && props.justSaved) {
      return <Done story={editing} link={link} back={props.back} notListed={props.notListed} />
    }
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
        answers: answersOf(await vocabulary.inputsOf(link.project, editing.values)),
        media,
      }
    : newStory(link.t, props.duration)
  const { questions, kept } = await questionsOf(props.profile, editing?.values ?? [])
  if (editing && props.justSaved) {
    return <Done story={editing} link={link} back={props.back} notListed={props.notListed} />
  }
  // A returned story goes back with "Send again" (recordings audit, 12).
  const returned = editing !== undefined && stateKey(lifecycle(editing)) === 'returned'

  return (
    <>
      {editing && <StoryStatus story={editing} link={link} justSaved={props.justSaved} />}
      <StoryForm
        key={story.id}
        link={link}
        origin={props.origin}
        audio={props.audio}
        story={story}
        questions={questions}
        kept={kept}
        submit={atOnce ? strings.form.publish : returned ? strings.form.sendAgain : strings.form.send}
        next={
          atOnce
            ? strings.form.sendsTo.publish
            : returned
              ? strings.form.sendsTo.again
              : strings.form.sendsTo.review
        }
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
 * A new story at `t`: ten seconds long, inside the recording (workflow-audit 15). Near the
 * end, the range ends at the end and starts up to ten seconds before.
 */
function newStory(t: number, duration?: number): StoryDraft {
  const length = duration !== undefined && duration > 0 ? duration : Infinity
  const end = Math.min(t + 10, length)
  const start = Math.max(0, Math.min(t, end - 1))
  return { id: uuidv7(), start, end, text: '', answers: [], media: [] }
}

/**
 * The done screen (P5, workflow-audit 19): after a save that had no way back to the site.
 * The state of the story, and the next moves: back to the site, another story, Your
 * stories. When the site is not on the website list, it says so (workflow-audit 12).
 */
function Done(props: {
  story: OwnDraft
  link: AnnotateLink
  back: string | null
  notListed: boolean
}) {
  const { story, link } = props
  const s = strings.done
  const state = lifecycle(story)
  const published = state.state === 'published' && state.change === null
  const heading = story.replyTo
    ? published
      ? s.replyPublished
      : s.replySent
    : published
      ? s.published
      : s.sent
  return (
    <section aria-labelledby="done-heading" className="done" data-state={stateKey(state)} role="status">
      <h2 id="done-heading">
        {heading} <span className="badge">{stateLabel(state)}</span>
      </h2>
      <p>{stateSentence(state)}</p>
      {props.notListed && (
        <p className="done__note">{published ? s.notListedPublished : s.notListed}</p>
      )}
      <p className="done__links">
        {props.back && (
          <a className="button-link button-link--primary" href={props.back}>
            {s.back}
          </a>
        )}
        <a className={`button-link${props.back ? '' : ' button-link--primary'}`} href={annotatePath({ ...link, story: null, replyTo: null })}>
          {s.another}
        </a>
        <a className="button-link" href={annotatePath({ ...link, story: story.id })}>
          {story.replyTo ? strings.story.changeReply : strings.story.change}
        </a>
        <a href="/annotate/mine">{s.yours}</a>
      </p>
    </section>
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
      ? withWidgetFragment(story.toldOn, {
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
      data-state={stateKey(state)}
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
                <span className="when">{where}</span> <StateBadges story={story} />
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

/**
 * The questions for the form: the fields that are not hidden, each list with its items
 * (a hidden item is not offered, unless this story has it). A hidden field with an answer
 * in this story shows that answer, read only.
 */
async function questionsOf(
  profile: Profile | null,
  values: OwnDraft['values'],
): Promise<{ questions: FormQuestion[]; kept: KeptAnswer[] }> {
  if (!profile) return { questions: [], kept: [] }
  const questions = await Promise.all(
    profile.fields
      .filter((field) => !field.hidden)
      .map(async (field): Promise<FormQuestion> => {
        const choices = field.list
          ? (await vocabulary.choices(profile.project, field.list.key)).map(
              ({ iri, label, depth }) => ({ iri, label, depth }),
            )
          : undefined
        for (const value of values) {
          const object = value.object
          if (value.property !== field.property || !('iri' in object) || !choices) continue
          if (!choices.some((c) => c.iri === object.iri)) {
            choices.push({ iri: object.iri, label: value.text, depth: 0 })
          }
        }
        return {
          property: field.property,
          label: field.label,
          ...(field.help ? { help: field.help } : {}),
          valueType: field.valueType,
          required: field.required,
          max: field.max,
          allowOwn: field.allowOwn,
          ...(choices ? { choices } : {}),
        }
      }),
  )
  const hidden = new Map(profile.fields.filter((f) => f.hidden).map((f) => [f.property, f.label]))
  const kept = values.flatMap((value) =>
    hidden.has(value.property) ? [{ label: hidden.get(value.property)!, text: value.text }] : [],
  )
  return { questions, kept }
}
