// The review screen of one story (O5), in place of the WADM record. Read-only: operators
// never change a story; they publish it, return it, or remove it (Controls.tsx).

import { stories } from '@payload-config'
import type { UIFieldServerProps } from 'payload'

import { clockRange } from '@/clock'
import { withPlayerFragment } from '@/fragment'
import { lifecycle, type StoryReview } from '@/modules/stories'

import { LocalDate } from '../LocalDate'
import { operatorOf } from '../operator'
import { PATHS } from '../paths'
import { strings } from '../strings'

import { badgeOf } from './badge'

const s = strings.review

export async function StoryPanel({ id, user }: UIFieldServerProps) {
  const operator = operatorOf(user)
  const story = operator && id !== undefined ? await stories.review(operator, String(id)) : null
  if (!story) return <p>{s.notFound}</p>
  const badge = badgeOf(lifecycle(story))

  return (
    <>
      {story.replyTo && <ParentStory story={story} />}
      <section className="annoudio-panel" aria-labelledby="annoudio-story-heading">
        {/* The badge of the state is in the bar above (Controls.tsx#Status). */}
        <h2 id="annoudio-story-heading" className="annoudio-panel__heading">
          {s.panel}
        </h2>
        <p className="annoudio-panel__state">{badge.meaning}</p>
        {story.rejection && (
          <p className="annoudio-panel__returned">
            {s.reason}: {story.rejection.reason}
          </p>
        )}
        <dl className="annoudio-panel__facts">
          <dt>{s.by}</dt>
          <dd>{story.member.nickname}</dd>
          <dt>{s.created}</dt>
          <dd>
            <LocalDate iso={story.created} />
          </dd>
          <dt>{s.project}</dt>
          <dd>{story.project.name ?? story.project.slug}</dd>
          <dt>{s.recording}</dt>
          <dd>{story.recording.title ?? story.recording.id}</dd>
          {!story.replyTo && (
            <>
              <dt>{s.range}</dt>
              <dd>{clockRange(story.start, story.end)}</dd>
            </>
          )}
          <dt>{s.toldOn}</dt>
          <dd>
            <ToldOn story={story} />
          </dd>
        </dl>
        {!story.replyTo && <RangePlayer story={story} />}
        <h3>{s.text}</h3>
        {story.texts.map((text, i) => (
          <p key={i} lang={text.language} className="annoudio-panel__text">
            {text.value}
          </p>
        ))}
        {!story.replyTo && <Topics story={story} />}
        {story.media.length > 0 && (
          <>
            <h3>{s.media}</h3>
            <ul className="annoudio-panel__media">
              {story.media.map((body) => (
                <li key={body.url}>
                  <span>
                    {s.mediaKinds[body.kind]}: {s.mediaStates[body.state]}
                  </span>
                  {body.state === 'ready' && (
                    <MediaBody kind={body.kind} url={body.url} alt={story.texts[0]?.value ?? ''} />
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  )
}

/** For a reply: the story that it answers, read-only, above it. */
function ParentStory({ story }: { story: StoryReview }) {
  const parent = story.replyTo!
  return (
    <section className="annoudio-panel annoudio-parent" aria-labelledby="annoudio-parent-heading">
      <h2 id="annoudio-parent-heading" className="annoudio-panel__heading">
        {s.replyHeading}
      </h2>
      {parent.nickname && <p className="annoudio-parent__by">{s.replyBy(parent.nickname)}</p>}
      <blockquote className="annoudio-panel__text">{parent.excerpt ?? s.replyTo(null)}</blockquote>
      <p>{s.replyIntro}</p>
    </section>
  )
}

/** The host page, and a link that opens the player at the story. */
function ToldOn({ story }: { story: StoryReview }) {
  if (!story.toldOn) return <>{s.notOnSite}</>
  const page = new URL(story.toldOn)
  const open = withPlayerFragment(story.toldOn, {
    project: story.project.slug,
    recording: story.recording.id,
    t: story.start ?? 0,
    story: story.replyTo?.id ?? story.id,
  })
  return (
    <>
      {page.host}
      {page.pathname === '/' ? '' : page.pathname}{' '}
      <a href={open} target="_blank" rel="noreferrer">
        {s.openOnSite}
      </a>
    </>
  )
}

function Topics({ story }: { story: StoryReview }) {
  const project = story.project.name ?? story.project.slug
  return (
    <>
      <h3>{s.tags}</h3>
      {story.tags.length === 0 ? (
        <p>{s.noTags}</p>
      ) : (
        <ul className="annoudio-panel__tags">
          {story.tags.map((tag) => (
            <li key={tag.iri}>{tag.label ?? s.goneTag}</li>
          ))}
        </ul>
      )}
      <p>
        {s.noTopicFits}{' '}
        <a href={`${PATHS.newConcept}?project=${encodeURIComponent(story.project.slug)}`}>
          {s.addConcept(project)}
        </a>
      </p>
    </>
  )
}

// A plain <audio> with a Media Fragment plays only the time range of the story, and it
// works for a draft. The player element (<annoudio-player>) shows the published stories
// of the instance, not this draft.
function RangePlayer({ story }: { story: StoryReview }) {
  const url = story.recording.url
  if (!url) return <p>{s.noAudio}</p>
  return (
    <figure className="annoudio-panel__player">
      <figcaption>{s.play}</figcaption>
      <audio controls preload="metadata" src={`${url}#t=${story.start},${story.end}`} />
    </figure>
  )
}

// An image has the first text of its story as `alt`, as in the player (CONTRACT §6, 11).
function MediaBody(props: { kind: 'sound' | 'image' | 'video'; url: string; alt: string }) {
  const { kind, url } = props
  if (kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element -- a member's photo from /media, any size
    return <img src={url} alt={props.alt} className="annoudio-panel__image" />
  }
  if (kind === 'video') return <video controls preload="metadata" src={url} />
  return <audio controls preload="none" src={url} />
}
