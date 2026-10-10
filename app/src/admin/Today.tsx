// Today (O3, design/ia.md §4.1): the operator home. What Annoudio does, in audio
// annotation words; on an empty stack, the setup checklist; then the work that waits, as
// stats that open their lists. It reads module interfaces only.

import { canMail, stories } from '@payload-config'
import type { AdminViewServerProps } from 'payload'

import { ago } from '@/clock'
import { firstRecording } from '@/modules/catalogue'
import { allProjects } from '@/modules/projects'
import type { RecentCounts, StoryCounts } from '@/modules/stories'

import { PATHS, reviewTabPath } from './paths'
import { strings } from './strings'
import { hideChecklist, markSnippetPasted } from './todayActions'
import { Icon } from './ui/Icon'

const s = strings.today
const WEEK = 7 * 24 * 60 * 60 * 1000

type Step = keyof typeof s.steps
const NEXT: Record<Step, string> = {
  project: PATHS.newProject,
  recording: PATHS.addWidget,
  snippet: PATHS.addWidget,
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
  const setup = !Object.values(done).every(Boolean)
  const showChecklist = setup && user?.checklistHidden !== true

  return (
    <div className="ao annoudio-today gutter--left gutter--right">
      <header className="ao-header">
        <div>
          <h1 className="ao-header__title annoudio-today__title">{s.title}</h1>
          <p className="ao-header__help annoudio-today__help">{s.help}</p>
        </div>
      </header>
      {/* Open until the checklist is complete, then closed under its heading (concept-map §1.1). */}
      <details className="ao-card ao-card--sunken annoudio-today__about" open={setup}>
        {/* The chevron says that it opens: `display: flex` hides the browser's marker. */}
        <summary>
          <Icon name="chevron" className="annoudio-today__chevron" />
          {s.aboutHeading}
        </summary>
        <p>{s.about}</p>
      </details>
      {!canMail && (
        <section className="ao-card annoudio-today__mail" aria-label={s.noMail}>
          <p>
            <strong>{s.noMail}</strong> {s.noMailHint}
          </p>
        </section>
      )}
      {showChecklist && <Checklist done={done} />}
      {work ? (
        <Work counts={work[0]} recent={work[1]} now={now} />
      ) : (
        <p role="alert" className="ao-field__error annoudio-today__error">
          <Icon name="alert" />
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
    <section className="ao-card annoudio-checklist" aria-labelledby="annoudio-setup">
      <div className="ao-card__head">
        <h2 id="annoudio-setup">{s.setup}</h2>
      </div>
      <ol className="annoudio-checklist__steps">
        {steps.map((step, i) => (
          <li
            key={step}
            data-step={step}
            data-done={done[step]}
            aria-current={step === next ? 'step' : undefined}
            className="annoudio-checklist__step"
          >
            <span className="annoudio-checklist__mark" aria-hidden="true">
              {done[step] ? '✓' : i + 1}
            </span>
            <span className="annoudio-checklist__label">
              {s.steps[step]}
              <span className="ao-sr">: {done[step] ? s.done : s.notDone}</span>
            </span>
            {step === next && (
              <span className="annoudio-checklist__action">
                <a className="ao-btn ao-btn--primary" href={NEXT[step]}>
                  {s.next[step]}
                  <Icon name="go" />
                </a>
              </span>
            )}
            {step === 'snippet' && !done.snippet && (
              <div className="annoudio-checklist__more">
                <p className="annoudio-checklist__hint">{s.snippetHint}</p>
                <form action={markSnippetPasted}>
                  <button type="submit" className="ao-btn">
                    {s.pasted}
                  </button>
                </form>
              </div>
            )}
            {step === 'story' && !done.story && step === next && (
              <p className="annoudio-checklist__hint annoudio-checklist__more">{s.storyHint}</p>
            )}
          </li>
        ))}
      </ol>
      <p className="ao-field__help">
        {s.optional} <a href={PATHS.vocabulary}>{s.addConcepts}</a>
      </p>
      <form action={hideChecklist}>
        <button type="submit" className="ao-btn ao-btn--quiet">
          {s.hide}
        </button>
      </form>
    </section>
  )
}

async function Work(props: { counts: StoryCounts; recent: RecentCounts; now: Date }) {
  const { counts, recent, now } = props
  const { waiting, processing, returned } = counts
  const next = waiting.stories + waiting.replies > 0 ? await stories.nextWaiting() : null
  const stats = [
    { key: 'waiting', n: waiting.stories + waiting.replies, href: PATHS.review },
    { key: 'processing', n: processing.stories + processing.replies, href: reviewTabPath('processing') },
    { key: 'returned', n: returned.stories + returned.replies, href: reviewTabPath('returned') },
  ] as const
  return (
    <section className="ao-card annoudio-work" aria-labelledby="annoudio-work">
      <div className="ao-card__head">
        <h2 id="annoudio-work">{s.work}</h2>
      </div>
      {next ? (
        <div className="annoudio-work__waiting">
          <p className="annoudio-work__lead" data-waiting={waiting.stories + waiting.replies}>
            {s.waiting(waiting.stories, waiting.replies)}{' '}
            {counts.oldestWaiting && s.oldest(ago(counts.oldestWaiting, now))}
          </p>
          <a className="ao-btn ao-btn--primary" href={`${PATHS.review}/${next}`}>
            {s.start}
            <Icon name="go" />
          </a>
        </div>
      ) : (
        <p className="annoudio-work__lead" data-waiting={0}>
          {s.noneWaiting} {counts.newest && s.lastStory(ago(counts.newest, now))}
        </p>
      )}
      <ul className="ao-stats">
        {stats.map((stat) => (
          <li key={stat.key} className={`ao-stat ao-stat--${stat.key}`}>
            <a className="ao-stat__link" href={stat.href}>
              <span className="ao-stat__n">{stat.n}</span>
              <span className="ao-stat__label">{s.stats[stat.key]}</span>
              <span className="ao-stat__note">{s.statNote[stat.key]}</span>
            </a>
          </li>
        ))}
      </ul>
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
      <p className="ao-actions annoudio-work__jobs">
        <a className="ao-btn" href={PATHS.addWidget}>
          <Icon name="widget" />
          {strings.nav.addWidget}
        </a>
        <a className="ao-btn" href={PATHS.vocabulary}>
          <Icon name="questions" />
          {strings.nav.vocabulary}
        </a>
        <a className="ao-btn" href={PATHS.members}>
          <Icon name="member" />
          {strings.nav.members}
        </a>
      </p>
      <p className="ao-field__help annoudio-work__recent">{s.recent(recent)}</p>
    </section>
  )
}
