// Today (O3, design/ia.md §4.1): the operator home. On an empty stack, the setup
// checklist; then the work that waits. It reads module interfaces only.

import { stories } from '@payload-config'
import { Button } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'

import { ago } from '@/clock'
import { firstRecording } from '@/modules/catalogue'
import { allProjects } from '@/modules/projects'
import type { RecentCounts, StoryCounts } from '@/modules/stories'

import { PATHS } from './paths'
import { strings } from './strings'
import { hideChecklist, markSnippetPasted } from './todayActions'

const s = strings.today
const WEEK = 7 * 24 * 60 * 60 * 1000

type Step = keyof typeof s.steps
const NEXT: Record<Step, string> = {
  project: PATHS.newProject,
  recording: PATHS.addPlayer,
  snippet: PATHS.addPlayer,
  story: PATHS.review,
}

export async function Today({ payload, user }: AdminViewServerProps) {
  const origin = process.env.ANNOUDIO_ORIGIN || ''
  const now = new Date()
  const [projects, recording, work] = await Promise.all([
    allProjects({ payload }),
    firstRecording({ payload, origin }),
    Promise.all([stories.counts(), stories.recent(new Date(now.getTime() - WEEK))]).catch(
      (error: unknown) => {
        console.error('[admin] Today: the counts failed.', error)
        return null
      },
    ),
  ])
  const counts = work?.[0]
  const done: Record<Step, boolean> = {
    project: projects.length > 0,
    recording: recording !== null,
    snippet: user?.snippetPasted === true || (counts?.onSites ?? 0) > 0,
    story: (counts?.published.stories ?? 0) + (counts?.published.replies ?? 0) > 0,
  }
  const showChecklist = !Object.values(done).every(Boolean) && user?.checklistHidden !== true

  return (
    <div className="annoudio-today gutter--left gutter--right">
      <h1 className="annoudio-today__title">{s.title}</h1>
      {showChecklist && <Checklist done={done} />}
      {work ? (
        <Work counts={work[0]} recent={work[1]} now={now} />
      ) : (
        <p role="alert" className="annoudio-today__error">
          {s.countFailed}
        </p>
      )}
    </div>
  )
}

function Checklist({ done }: { done: Record<Step, boolean> }) {
  const steps = Object.keys(s.steps) as Step[]
  const next = steps.find((step) => !done[step])
  return (
    <section className="annoudio-panel annoudio-checklist" aria-labelledby="annoudio-setup">
      <h2 id="annoudio-setup" className="annoudio-panel__heading">
        {s.setup}
      </h2>
      <ol className="annoudio-checklist__steps">
        {steps.map((step) => (
          <li
            key={step}
            data-step={step}
            data-done={done[step]}
            className="annoudio-checklist__step"
          >
            <span className="annoudio-checklist__mark" aria-hidden="true">
              {done[step] ? '✓' : ''}
            </span>
            <span>
              {s.steps[step]}
              <span className="visually-hidden">: {done[step] ? s.done : s.notDone}</span>
            </span>
            {step === next && (
              <span className="annoudio-checklist__action">
                <Button el="link" url={NEXT[step]} buttonStyle="primary" size="medium">
                  {s.next[step]}
                </Button>
              </span>
            )}
            {step === 'snippet' && !done.snippet && (
              <>
                <p className="annoudio-checklist__hint">{s.snippetHint}</p>
                <form action={markSnippetPasted}>
                  <Button type="submit" buttonStyle="secondary" size="medium">
                    {s.pasted}
                  </Button>
                </form>
              </>
            )}
            {step === 'story' && !done.story && step === next && (
              <p className="annoudio-checklist__hint">{s.storyHint}</p>
            )}
          </li>
        ))}
      </ol>
      <p>
        {s.optional} <a href={PATHS.concepts}>{s.addConcepts}</a>
      </p>
      <form action={hideChecklist}>
        <Button type="submit" buttonStyle="subtle" size="small">
          {s.hide}
        </Button>
      </form>
    </section>
  )
}

async function Work(props: { counts: StoryCounts; recent: RecentCounts; now: Date }) {
  const { counts, recent, now } = props
  const { waiting, processing, returned } = counts
  const next = waiting.stories + waiting.replies > 0 ? await stories.nextWaiting() : null
  return (
    <section className="annoudio-panel annoudio-work" aria-labelledby="annoudio-work">
      <h2 id="annoudio-work" className="visually-hidden">
        {s.work}
      </h2>
      {next ? (
        <div className="annoudio-work__waiting">
          <p className="annoudio-work__lead" data-waiting={waiting.stories + waiting.replies}>
            {s.waiting(waiting.stories, waiting.replies)}{' '}
            {counts.oldestWaiting && s.oldest(ago(counts.oldestWaiting, now))}
          </p>
          <Button el="link" url={`${PATHS.review}/${next}`} buttonStyle="primary" size="medium">
            {s.start}
          </Button>
        </div>
      ) : (
        <p className="annoudio-work__lead" data-waiting={0}>
          {s.noneWaiting} {counts.newest && s.lastStory(ago(counts.newest, now))}
        </p>
      )}
      {processing.stories + processing.replies > 0 && (
        <p>{s.processing(processing.stories, processing.replies)}</p>
      )}
      {returned.stories + returned.replies > 0 && (
        <p>
          {s.returned(returned.stories, returned.replies)}{' '}
          {returned.automatic > 0 && s.automatic(returned.automatic)}
        </p>
      )}
      <h3>{s.otherJobs}</h3>
      <p className="annoudio-work__jobs">
        <Button el="link" url={PATHS.addPlayer} buttonStyle="secondary" size="medium">
          {strings.nav.addPlayer}
        </Button>
        <Button el="link" url={PATHS.concepts} buttonStyle="secondary" size="medium">
          {strings.nav.concepts}
        </Button>
        <Button el="link" url={PATHS.members} buttonStyle="secondary" size="medium">
          {strings.nav.members}
        </Button>
      </p>
      <p className="annoudio-work__recent">{s.recent(recent)}</p>
    </section>
  )
}
