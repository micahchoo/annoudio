// The Overview tab of a project (O16), first of its tabs: its stories and replies by
// state, the recordings with stories here, its concepts, and its members. It reads module
// interfaces only; the counts are `stories.counts({ project })`.

import { stories } from '@payload-config'
import Link from 'next/link'
import type { DocumentViewServerProps } from 'payload'

import { recording } from '@/modules/catalogue'
import { byId } from '@/modules/projects'
import { conceptsOf } from '@/modules/vocabulary'
import { countWords } from '@/plural'

import { PATHS } from '../paths'
import { strings } from '../strings'

const s = strings.overview
const STATES = ['waiting', 'processing', 'returned', 'published'] as const

export async function Overview({ initPageResult, payload }: DocumentViewServerProps) {
  const id = initPageResult.docID
  const project = id === undefined ? null : await byId({ payload }, id)
  if (!project) return <p className="gutter--left gutter--right">{s.unsaved}</p>
  const origin = process.env.ANNOUDIO_ORIGIN || ''
  const [counts, reach, concepts] = await Promise.all([
    stories.counts({ project: project.slug }),
    stories.projectReach(project.slug),
    conceptsOf({ payload }, project.slug),
  ])
  const titles = await Promise.all(
    reach.recordings.map(async (r) => (await recording({ payload, origin }, r.id))?.title ?? r.id),
  )
  // What waits in this project: the Waiting for review filter, for one project.
  const review = `${PATHS.review}?${new URLSearchParams({
    'where[and][0][project][equals]': project.slug,
    'where[and][1][_status][equals]': 'draft',
    'where[and][2][rejection.at][exists]': 'false',
    'where[and][3][processing][not_equals]': 'true',
  })}`
  return (
    <div className="annoudio-overview gutter--left gutter--right">
      <section className="annoudio-panel" aria-labelledby="annoudio-overview-stories">
        <h2 id="annoudio-overview-stories" className="annoudio-panel__heading">
          {s.stories}
        </h2>
        <dl className="annoudio-panel__facts annoudio-overview__counts">
          {STATES.map((state) => (
            <div key={state} data-state={state}>
              <dt>{s.states[state]}</dt>
              <dd>{countWords(counts[state].stories, counts[state].replies)}</dd>
            </div>
          ))}
        </dl>
        <p>
          <Link href={review}>{s.review}</Link>
        </p>
      </section>
      <section className="annoudio-panel" aria-labelledby="annoudio-overview-recordings">
        <h2 id="annoudio-overview-recordings" className="annoudio-panel__heading">
          {s.recordings}
        </h2>
        {reach.recordings.length === 0 ? (
          <p>{s.noRecordings}</p>
        ) : (
          <ul className="annoudio-overview__recordings">
            {reach.recordings.map((r, i) => (
              <li key={r.id}>
                <Link href={`/admin/collections/recordings/${r.id}`}>{titles[i]}</Link> ·{' '}
                {s.storyCount(r.stories)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="annoudio-panel" aria-label={strings.concepts.title}>
        <p>
          {s.concepts(concepts.length)} ·{' '}
          <Link href={`${PATHS.concepts}/${project.slug}`}>{s.conceptsLink}</Link>
        </p>
        <p>{s.members(reach.members)}</p>
      </section>
    </div>
  )
}
