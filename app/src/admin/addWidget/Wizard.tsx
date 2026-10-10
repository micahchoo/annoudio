'use client'

// The three steps of "Add a widget to a site": 1 Recording, 2 Site, 3 Snippet. A done step
// shows its choice with Change. The heading of a new step takes the focus. Step 2 makes
// the recording a widget of the project; step 3 shows the snippet and the real widget with
// live links (workflow-audit 1–3).

import Link from 'next/link'
import { useEffect, useId, useRef, useState, useTransition } from 'react'

import { ProbeText } from '../catalogue/DurationField'
import { SnippetCopy } from '../catalogue/SnippetCopy'
import { useAudioProbe } from '../catalogue/useAudioProbe'
import { PATHS, annotatePath, previewPath } from '../paths'
import { strings } from '../strings'
import { Icon } from '../ui/Icon'
import { PreviewWidget } from '../ui/PreviewWidget'

import { addProject, addRecording, snippetFor } from './actions'

const s = strings.addWidget

interface Recording {
  id: string
  title: string
  url: string
}
interface Project {
  slug: string
  label: string
  siteOrigins: string[]
  /** The recordings that have a widget of this project. */
  recordings: string[]
}

type Step = 1 | 2 | 3
const NEW = '__new'

const hosts = (origins: string[]) => origins.map((o) => new URL(o).host).join(', ')

/** The first website and how many more: a dropdown option stays short (recordings audit, 02). */
const firstHost = (origins: string[]) =>
  origins.length === 0
    ? ''
    : origins.length === 1
      ? new URL(origins[0]).host
      : s.site.more(new URL(origins[0]).host, origins.length - 1)

export function Wizard(props: {
  origin: string
  recordings: Recording[]
  projects: Project[]
  /** Chosen before: from a recording page ("Add to a project"). */
  recording?: string
  /** Chosen before: from a project Overview ("Add a widget"). */
  project?: string
}) {
  const given = props.recordings.find((r) => r.id === props.recording) ?? null
  const [step, setStep] = useState<Step>(given ? 2 : 1)
  const [recording, setRecording] = useState<Recording | null>(given)
  const [project, setProject] = useState<Project | null>(null)
  const [snippet, setSnippet] = useState<string | null>(null)
  const headings = useRef<Record<Step, HTMLHeadingElement | null>>({ 1: null, 2: null, 3: null })
  const moved = useRef(false)

  useEffect(() => {
    if (moved.current) headings.current[step]?.focus()
    moved.current = true
  }, [step])

  const heading = (n: Step, label: string) => (
    <h2
      ref={(element) => {
        headings.current[n] = element
      }}
      tabIndex={-1}
      className="annoudio-wizard__heading"
    >
      <span className="annoudio-wizard__number" aria-hidden="true">
        {n}
      </span>{' '}
      {label}
    </h2>
  )
  const labels = [s.steps.recording, s.steps.site, s.steps.snippet]

  return (
    <>
      <ol className="ao-steps annoudio-wizard__steps" aria-label={s.stepsLabel}>
        {([1, 2, 3] as Step[]).map((n) => (
          <li
            key={n}
            aria-current={step === n ? 'step' : undefined}
            data-done={step > n ? '' : undefined}
          >
            {step > n && <span className="ao-sr">{strings.today.done}: </span>}
            {labels[n - 1]}
          </li>
        ))}
      </ol>

      <section className="ao-card annoudio-wizard__step" aria-label={s.steps.recording}>
        {heading(1, s.steps.recording)}
        {step > 1 && recording ? (
          <Done text={s.recording.chosen(recording.title)} onChange={() => setStep(1)} />
        ) : (
          <RecordingStep
            recordings={props.recordings}
            onDone={(chosen) => {
              setRecording(chosen)
              setStep(2)
            }}
          />
        )}
      </section>

      {step >= 2 && recording && (
        <section className="ao-card annoudio-wizard__step" aria-label={s.steps.site}>
          {heading(2, s.steps.site)}
          {step > 2 && project ? (
            <Done text={s.site.chosen(project.label)} onChange={() => setStep(2)} />
          ) : (
            <SiteStep
              projects={props.projects}
              initial={props.project}
              recording={recording.id}
              onDone={async (chosen) => {
                const text = await snippetFor(chosen.slug, recording.id)
                if (!text) return false
                setProject(chosen)
                setSnippet(text)
                setStep(3)
                return true
              }}
            />
          )}
        </section>
      )}

      {step === 3 && recording && project && snippet && (
        <section className="ao-card annoudio-wizard__step" aria-label={s.steps.snippet}>
          {heading(3, s.steps.snippet)}
          <p>{s.snippet.intro(recording.title)}</p>
          <SnippetCopy
            recordingId={recording.id}
            snippets={[{ project: project.slug, label: project.label, text: snippet }]}
          />
          <p className="ao-field__help">
            {project.siteOrigins.length > 0
              ? s.snippet.comeBack(hosts(project.siteOrigins))
              : s.snippet.noSites}{' '}
            {s.snippet.plugins(recording.id)}
          </p>
          <figure className="annoudio-wizard__preview">
            <figcaption>{s.snippet.preview}</figcaption>
            <PreviewWidget
              origin={props.origin}
              project={project.slug}
              recording={recording.id}
              src={recording.url}
              back={`${props.origin}${previewPath(project.slug, recording.id)}`}
            />
          </figure>
          <p className="ao-actions">
            <a
              className="ao-btn"
              href={annotatePath(
                props.origin,
                project.slug,
                recording.id,
                `${props.origin}${previewPath(project.slug, recording.id)}`,
              )}
            >
              <Icon name="story" />
              {strings.recording.tryIt}
            </a>
            <a className="ao-btn ao-btn--quiet" href={previewPath(project.slug, recording.id)}>
              {strings.recording.preview}
            </a>
            <Link className="ao-btn ao-actions__end" href={PATHS.today}>
              {s.snippet.done}
            </Link>
          </p>
          <p className="ao-field__help">{s.snippet.doneHint}</p>
        </section>
      )}
    </>
  )
}

function Done({ text, onChange }: { text: string; onChange: () => void }) {
  return (
    <p className="annoudio-wizard__done">
      <Icon name="published" />
      <span>{text}</span>
      <button type="button" className="ao-btn ao-btn--quiet" onClick={onChange}>
        {s.change}
      </button>
    </p>
  )
}

function ErrorLine({ id, text }: { id: string; text: string | null }) {
  if (!text) return null
  return (
    <p id={id} role="alert" className="ao-field__error">
      <Icon name="alert" />
      {text}
    </p>
  )
}

function RecordingStep(props: { recordings: Recording[]; onDone: (recording: Recording) => void }) {
  const [choice, setChoice] = useState(props.recordings.length > 0 ? '' : NEW)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [errors, setErrors] = useState<{ field: string; message: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const probe = useAudioProbe(url)
  const ids = { choice: useId(), title: useId(), url: useId(), error: useId() }
  const isNew = choice === NEW

  const next = () => {
    setErrors(null)
    if (!isNew) {
      const found = props.recordings.find((r) => r.id === choice)
      if (found) props.onDone(found)
      else setErrors({ field: 'choice', message: s.recording.pick })
      return
    }
    startTransition(async () => {
      const result = await addRecording({
        title,
        url,
        length: probe.state === 'plays' ? probe.seconds : null,
      })
      if (result.ok) props.onDone(result.recording)
      else setErrors({ field: result.field ?? 'form', message: result.message })
    })
  }
  const errorOf = (field: string) => (errors?.field === field ? errors.message : null)
  const described = (field: string, help?: string) =>
    [help, errors?.field === field ? ids.error : undefined].filter(Boolean).join(' ') || undefined

  return (
    <div className="ao-form">
      <p className="ao-field__help">{s.recording.help}</p>
      {props.recordings.length > 0 && (
        <div className="ao-field">
          <label htmlFor={ids.choice}>{s.recording.label}</label>
          <span className="ao-select">
            <select
              id={ids.choice}
              value={choice}
              aria-invalid={errorOf('choice') ? true : undefined}
              aria-describedby={described('choice')}
              onChange={(event) => setChoice(event.target.value)}
            >
              <option value="">{s.recording.placeholder}</option>
              {props.recordings.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
              <option value={NEW}>{s.recording.newOption}</option>
            </select>
            <Icon name="chevron" />
          </span>
          {errorOf('choice') && <ErrorLine id={ids.error} text={errorOf('choice')} />}
        </div>
      )}
      {isNew && (
        <fieldset className="ao-form annoudio-wizard__new">
          <legend className="ao-label">{s.recording.new}</legend>
          <div className="ao-field">
            <label htmlFor={ids.title}>{s.recording.title}</label>
            <input
              id={ids.title}
              className="ao-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={errorOf('title') ? true : undefined}
              aria-describedby={described('title')}
            />
            {errorOf('title') && <ErrorLine id={ids.error} text={errorOf('title')} />}
          </div>
          <div className="ao-field">
            <label htmlFor={ids.url}>{s.recording.url}</label>
            <p id={`${ids.url}-hint`} className="ao-field__help">
              {s.recording.urlHint}
            </p>
            <input
              id={ids.url}
              type="url"
              inputMode="url"
              className="ao-input"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://"
              aria-invalid={errorOf('url') ? true : undefined}
              aria-describedby={described('url', `${ids.url}-hint`)}
            />
            {errorOf('url') && <ErrorLine id={ids.error} text={errorOf('url')} />}
            <ProbeText probe={probe} />
          </div>
        </fieldset>
      )}
      {errorOf('form') && <ErrorLine id={ids.error} text={errorOf('form')} />}
      <p>
        <button type="button" className="ao-btn ao-btn--primary" disabled={pending} onClick={next}>
          {s.next}
          <Icon name="go" />
        </button>
      </p>
    </div>
  )
}

function SiteStep(props: {
  projects: Project[]
  initial?: string
  /** The recording of step 1. */
  recording: string
  onDone: (project: Project) => Promise<boolean>
}) {
  const { projects } = props
  // The site chosen before; else the one project that shows this recording; else the only project.
  const showing = projects.filter((p) => p.recordings.includes(props.recording))
  const preset =
    projects.find((p) => p.slug === props.initial)?.slug ??
    (showing.length === 1 ? showing[0].slug : projects.length === 1 ? projects[0].slug : '')
  const [choice, setChoice] = useState(projects.length > 0 ? preset : NEW)
  // With one choice made before, the step shows one line; Change shows the dropdown.
  const [open, setOpen] = useState(preset === '')
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('https://')
  const [errors, setErrors] = useState<{ field: string; message: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const ids = { choice: useId(), name: useId(), website: useId(), error: useId() }
  const isNew = choice === NEW
  const chosen = projects.find((p) => p.slug === choice)

  const next = () => {
    setErrors(null)
    startTransition(async () => {
      if (!isNew) {
        if (!chosen) return setErrors({ field: 'choice', message: s.site.pick })
        if (!(await props.onDone(chosen))) setErrors({ field: 'form', message: s.failed })
        return
      }
      const result = await addProject({ name, website })
      if (!result.ok) return setErrors({ field: result.field ?? 'form', message: result.message })
      // A new project shows no recording yet.
      if (!(await props.onDone({ ...result.project, recordings: [] }))) {
        setErrors({ field: 'form', message: s.failed })
      }
    })
  }
  const errorOf = (field: string) => (errors?.field === field ? errors.message : null)
  const described = (field: string, help?: string) =>
    [help, errors?.field === field ? ids.error : undefined].filter(Boolean).join(' ') || undefined

  return (
    <div className="ao-form">
      <p className="ao-field__help">{s.site.help}</p>
      {!open && chosen ? (
        <p className="annoudio-wizard__done">
          <span>
            {s.site.one(chosen.label)}
            {chosen.siteOrigins.length > 0 && ` · ${hosts(chosen.siteOrigins)}`}
          </span>
          <button type="button" className="ao-btn ao-btn--quiet" onClick={() => setOpen(true)}>
            {s.change}
          </button>
        </p>
      ) : (
        projects.length > 0 && (
          <div className="ao-field">
            <label htmlFor={ids.choice}>{s.site.question}</label>
            <span className="ao-select">
              <select
                id={ids.choice}
                value={choice}
                aria-invalid={errorOf('choice') ? true : undefined}
                aria-describedby={described('choice')}
                onChange={(event) => setChoice(event.target.value)}
              >
                <option value="">{s.site.placeholder}</option>
                {projects.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {s.site.option(p.label, firstHost(p.siteOrigins))}
                  </option>
                ))}
                <option value={NEW}>{s.site.newOption}</option>
              </select>
              <Icon name="chevron" />
            </span>
            {errorOf('choice') && <ErrorLine id={ids.error} text={errorOf('choice')} />}
          </div>
        )
      )}
      {isNew && (
        <fieldset className="ao-form annoudio-wizard__new">
          <legend className="ao-label">{s.site.new}</legend>
          <p className="ao-field__help">{s.site.newHint}</p>
          <div className="ao-field">
            <label htmlFor={ids.name}>{s.site.name}</label>
            <input
              id={ids.name}
              className="ao-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={errorOf('name') ? true : undefined}
              aria-describedby={described('name')}
            />
            {errorOf('name') && <ErrorLine id={ids.error} text={errorOf('name')} />}
          </div>
          <div className="ao-field">
            <label htmlFor={ids.website}>{s.site.website}</label>
            <p id={`${ids.website}-hint`} className="ao-field__help">
              {s.site.websiteHint}
            </p>
            <input
              id={ids.website}
              type="url"
              inputMode="url"
              className="ao-input"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              aria-invalid={errorOf('website') ? true : undefined}
              aria-describedby={described('website', `${ids.website}-hint`)}
            />
            {errorOf('website') && <ErrorLine id={ids.error} text={errorOf('website')} />}
          </div>
        </fieldset>
      )}
      {errorOf('form') && <ErrorLine id={ids.error} text={errorOf('form')} />}
      <p>
        <button type="button" className="ao-btn ao-btn--primary" disabled={pending} onClick={next}>
          {s.next}
          <Icon name="go" />
        </button>
      </p>
    </div>
  )
}
