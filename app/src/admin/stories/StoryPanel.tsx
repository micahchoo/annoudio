// The review screen of one story (O5), in place of the WADM record. Read-only: operators
// never change a story; they publish it, return it, or remove it (Controls.tsx). The help
// line says what the story is in audio annotation; the chips link the story to its
// member, project and recording.

import { stories, vocabulary } from '@payload-config'
import type { UIFieldServerProps } from 'payload'

import { clockRange } from '@/clock'
import { withWidgetFragment } from '@/fragment'
import { bySlug } from '@/modules/projects'
import { lifecycle, type StoryReview } from '@/modules/stories'

import { LocalDate } from '../LocalDate'
import { operatorOf } from '../operator'
import { PATHS, memberPath, previewPath, projectPath, recordingPath } from '../paths'
import { strings } from '../strings'
import { Chip } from '../ui/Chip'
import { storiesIn } from '../ui/counts'
import { Icon } from '../ui/Icon'

import { AddItem } from './AddItem'
import { AddWebsite } from './AddWebsite'
import { badgeOf } from './badge'

const s = strings.review

export async function StoryPanel({ id, user, payload }: UIFieldServerProps) {
  const operator = operatorOf(user)
  const story = operator && id !== undefined ? await stories.review(operator, String(id)) : null
  if (!story) return <p className="ao">{s.notFound}</p>
  const badge = badgeOf(lifecycle(story))
  const origin = process.env.ANNOUDIO_ORIGIN || ''
  const [project, byMember] = await Promise.all([
    bySlug({ payload, origin }, story.project.slug),
    stories.counts({ member: story.member.id }),
  ])
  const title = story.recording.title ?? story.recording.id
  const range = story.start === undefined ? null : clockRange(story.start, story.end)

  return (
    <div className="ao annoudio-story">
      <p className="ao-header__help">
        {range ? s.storyHelp(range, title) : s.replyHelp(title)}
      </p>
      {story.replyTo && <ParentStory story={story} />}
      <section className="ao-card" aria-labelledby="annoudio-story-heading">
        {/* The badge of the state is in the bar above (Controls.tsx#Status). */}
        <div className="ao-card__head">
          <h2 id="annoudio-story-heading">{s.panel}</h2>
          <p className="annoudio-story__state">{badge.meaning}</p>
        </div>
        {story.rejection && (
          <p className="annoudio-story__returned">
            <strong>{s.reason}:</strong> {story.rejection.reason}
          </p>
        )}
        <dl className="ao-facts">
          <dt>{s.by}</dt>
          <dd>
            <Chip
              kind="member"
              label={story.member.nickname}
              count={s.memberStories(storiesIn(byMember))}
              href={memberPath(story.member.id)}
            />
          </dd>
          <dt>{s.project}</dt>
          <dd>
            <Chip
              kind="project"
              label={story.project.name ?? story.project.slug}
              href={project ? projectPath(project.id) : undefined}
            />
          </dd>
          <dt>{s.recording}</dt>
          <dd>
            <Chip kind="recording" label={title} href={recordingPath(story.recording.id)} />
          </dd>
          {range && (
            <>
              <dt>{s.range}</dt>
              <dd className="ao-num">{range}</dd>
            </>
          )}
          <dt>{s.created}</dt>
          <dd>
            <LocalDate iso={story.created} />
          </dd>
          <dt>{s.toldOn}</dt>
          <dd>
            <ToldOn story={story} origin={origin} />
          </dd>
        </dl>
        {!story.replyTo && <RangeAudio story={story} />}
        <h3>{s.text}</h3>
        {story.texts.map((text, i) => (
          <p key={i} lang={text.language} className="annoudio-story__text">
            {text.value}
          </p>
        ))}
        {!story.replyTo && <Answers story={story} />}
        {story.media.length > 0 && (
          <>
            <h3>{s.media}</h3>
            <ul className="annoudio-story__media">
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
    </div>
  )
}

/** For a reply: the story that it answers, read-only, above it. */
function ParentStory({ story }: { story: StoryReview }) {
  const parent = story.replyTo!
  return (
    <section className="ao-card ao-card--sunken" aria-labelledby="annoudio-parent-heading">
      <div className="ao-card__head">
        <h2 id="annoudio-parent-heading">{s.replyHeading}</h2>
        {parent.nickname && <p>{s.replyBy(parent.nickname)}</p>}
      </div>
      <blockquote className="annoudio-story__text">{parent.excerpt ?? s.replyTo(null)}</blockquote>
      <p className="ao-field__help">{s.replyIntro}</p>
    </section>
  )
}

/**
 * The page where the member told the story. A listed website: its address and **Open on
 * the site**. The admin preview: a link to it. An unlisted website: the address, the
 * reason that the member did not come back, and **Add this website** (workflow-audit 7).
 */
function ToldOn({ story, origin }: { story: StoryReview; origin: string }) {
  const at = { project: story.project.slug, recording: story.recording.id }
  if (story.toldOn) {
    const page = new URL(story.toldOn)
    const open = withWidgetFragment(story.toldOn, {
      ...at,
      t: story.start ?? 0,
      story: story.replyTo?.id ?? story.id,
    })
    return (
      <>
        <Chip kind="site" label={`${page.host}${page.pathname === '/' ? '' : page.pathname}`} />
        <a className="ao-btn ao-btn--quiet" href={open} target="_blank" rel="noreferrer">
          {s.openOnSite}
          <Icon name="open" />
        </a>
      </>
    )
  }
  const unlisted = story.toldOnUnlisted ? new URL(story.toldOnUnlisted) : null
  if (unlisted && unlisted.origin === origin && unlisted.pathname.startsWith(`${PATHS.preview}/`)) {
    return (
      <>
        <span>{s.previewPage}</span>
        <a href={previewPath(at.project, at.recording)}>{s.openPreview}</a>
      </>
    )
  }
  if (unlisted) {
    return (
      <div className="annoudio-unlisted">
        <p>
          <Icon name="alert" /> <strong>{s.notListed(unlisted.host)}</strong>
        </p>
        <p className="ao-field__help">{s.notListedHint}</p>
        <AddWebsite project={story.project.slug} page={story.toldOnUnlisted!} />
      </div>
    )
  }
  return <>{s.notOnSite}</>
}

/**
 * The answers of the story in field order, as "Label: value" (O5). Read only. An own
 * answer shows "(new)" and **Add "Ravi" to People**. A value of no field shows last.
 */
async function Answers({ story }: { story: StoryReview }) {
  const profile = await vocabulary.profile(story.project.slug)
  const fields = profile?.fields ?? []
  const rows = fields
    .map((field) => ({ field, values: story.values.filter((v) => v.property === field.property) }))
    .filter((row) => row.values.length > 0)
  const known = new Set(fields.map((f) => f.property))
  const rest = story.values.filter((v) => !known.has(v.property))
  const lists = fields.filter((f) => f.list && !f.hidden)
  return (
    <>
      <h3>{s.tags}</h3>
      {story.values.length === 0 ? (
        <p>{s.noTags}</p>
      ) : (
        <dl className="ao-facts annoudio-story__answers">
          {rows.map(({ field, values }) => (
            <div key={field.property} className="annoudio-story__answer">
              <dt>{field.label}</dt>
              <dd>
                {values.map((value, i) => (
                  <span key={i} lang={value.language}>
                    {'own' in value.object ? (
                      <>
                        {s.ownAnswer(value.text)}
                        {field.list && (
                          <AddItem
                            project={story.project.slug}
                            listKey={field.list.key}
                            listLabel={field.list.label}
                            text={value.text}
                          />
                        )}
                      </>
                    ) : field.list ? (
                      <Chip kind="concept" label={value.text} />
                    ) : (
                      value.text
                    )}
                  </span>
                ))}
              </dd>
            </div>
          ))}
          {rest.map((value, i) => (
            <div key={`rest-${i}`} className="annoudio-story__answer">
              <dt>{s.noLabel}</dt>
              <dd lang={value.language}>{value.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {lists.length > 0 && (
        <p className="ao-field__help">
          {s.noTopicFits}{' '}
          {lists.map((field, i) => (
            <span key={field.property}>
              {i > 0 && ' · '}
              <a
                href={`${PATHS.concepts}/${encodeURIComponent(story.project.slug)}?list=${encodeURIComponent(field.list!.key)}`}
              >
                {s.addConcept(field.list!.label)}
              </a>
            </span>
          ))}
        </p>
      )}
    </>
  )
}

// A plain <audio> with a Media Fragment plays only the time range of the story, and it
// works for a draft. The widget (<annoudio-player>) shows the published stories of the
// instance, not this draft.
function RangeAudio({ story }: { story: StoryReview }) {
  const url = story.recording.url
  if (!url) return <p>{s.noAudio}</p>
  return (
    <figure className="annoudio-story__range">
      <figcaption>{s.play}</figcaption>
      <audio controls preload="metadata" src={`${url}#t=${story.start},${story.end}`} />
    </figure>
  )
}

// An image has the first text of its story as `alt`, as in the widget (CONTRACT §6, 11).
function MediaBody(props: { kind: 'sound' | 'image' | 'video'; url: string; alt: string }) {
  const { kind, url } = props
  if (kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element -- a member's photo from /media, any size
    return <img src={url} alt={props.alt} className="annoudio-story__image" />
  }
  if (kind === 'video') return <video controls preload="metadata" src={url} />
  return <audio controls preload="metadata" src={url} />
}
