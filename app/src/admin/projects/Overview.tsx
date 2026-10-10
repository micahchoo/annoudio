// The Overview tab of a project (O16), first of its tabs: what the project is in audio
// annotation, its stories by state (each opens its list), its widgets (recordings with a
// widget or with stories here, each with its story count, Try it and its preview), its
// lists and its members. It reads module interfaces only.

import { membership, stories } from '@payload-config'
import type { DocumentViewServerProps } from 'payload'

import { recording } from '@/modules/catalogue'
import { allProjects } from '@/modules/projects'
import { conceptsOf } from '@/modules/vocabulary'

import {
  PATHS,
  annotatePath,
  previewPath,
  recordingPath,
  reviewTabPath,
  storiesPath,
} from '../paths'
import { strings } from '../strings'
import { Chip } from '../ui/Chip'
import { storyStates } from '../ui/counts'
import { Icon } from '../ui/Icon'

const s = strings.overview
const STATES = ['waiting', 'processing', 'returned', 'published'] as const

export async function Overview({ initPageResult, payload }: DocumentViewServerProps) {
  const id = initPageResult.docID
  const project =
    id === undefined ? null : (await allProjects({ payload })).find((p) => String(p.id) === String(id))
  if (!project) return <p className="ao gutter--left gutter--right">{s.unsaved}</p>
  const origin = process.env.ANNOUDIO_ORIGIN || ''
  const [counts, reach, concepts] = await Promise.all([
    stories.counts({ project: project.slug }),
    membership.testMembers().then((leaveOut) => stories.projectReach(project.slug, { leaveOut })),
    conceptsOf({ payload }, project.slug),
  ])
  // The widgets: the recordings that an operator added, then the others with stories here.
  // Each chip says what it counts, as the recording page does (audit 3).
  const ids = [...new Set([...project.recordings, ...reach.recordings.map((r) => r.id)])]
  const widgets = (
    await Promise.all(
      ids.map(async (rid) => {
        const [found, of] = await Promise.all([
          recording({ payload, origin }, rid),
          stories.counts({ project: project.slug, recording: rid }),
        ])
        return found ? [{ ...found, counts: of }] : []
      }),
    )
  ).flat()
  const add = `${PATHS.addWidget}?project=${encodeURIComponent(project.slug)}`

  return (
    <div className="ao annoudio-overview gutter--left gutter--right">
      <p className="ao-header__help">{s.help}</p>
      <section className="ao-card" aria-labelledby="annoudio-overview-stories">
        <div className="ao-card__head">
          <h2 id="annoudio-overview-stories">{s.stories}</h2>
          <a href={storiesPath({ project: project.slug })}>{s.allStories}</a>
        </div>
        <ul className="ao-stats annoudio-overview__counts">
          {STATES.map((state) => {
            const n = counts[state].stories + counts[state].replies
            return (
              <li key={state} data-state={state} className={`ao-stat ao-stat--${state}`}>
                <a href={reviewTabPath(state, { project: project.slug })} className="ao-stat__link">
                  <span className="ao-stat__n">{n}</span>
                  <span className="ao-stat__label">{s.states[state]}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </section>
      <section className="ao-card" aria-labelledby="annoudio-overview-recordings">
        <div className="ao-card__head">
          <h2 id="annoudio-overview-recordings">{s.recordings}</h2>
          <a className="ao-btn ao-btn--primary" href={add}>
            <Icon name="add" />
            {s.addWidget}
          </a>
          <p>{s.recordingsHelp}</p>
        </div>
        {widgets.length === 0 ? (
          <div className="ao-empty">
            <Icon name="widget" />
            <p>{s.noRecordings}</p>
          </div>
        ) : (
          <ul className="ao-list annoudio-overview__recordings">
            {widgets.map((r) => {
              const preview = `${origin}${previewPath(project.slug, r.id)}`
              return (
                <li key={r.id} className="ao-row">
                  <a className="ao-row__title" href={recordingPath(r.id)}>
                    {r.title}
                  </a>
                  <span className="ao-row__meta">
                    <Chip
                      kind="story"
                      label={storyStates(r.counts)}
                      href={storiesPath({ project: project.slug, recording: r.id })}
                    />
                  </span>
                  <span className="ao-row__end">
                    <a className="ao-btn" href={annotatePath(origin, project.slug, r.id, preview)}>
                      <Icon name="story" />
                      {strings.recording.tryIt}
                    </a>
                    <a className="ao-btn ao-btn--quiet" href={previewPath(project.slug, r.id)}>
                      {strings.recording.preview}
                    </a>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <section className="ao-card ao-card--sunken" aria-label={strings.lists.title}>
        <div className="ao-chips">
          <Chip
            kind="concept"
            label={strings.lists.title}
            count={s.concepts(concepts.length)}
            href={`${PATHS.concepts}/${project.slug}`}
          />
          <Chip kind="member" label={s.members(reach.members)} href={PATHS.members} />
        </div>
      </section>
    </div>
  )
}
