'use client'

// The three steps of "Put a recording on a site": 1 Recording, 2 Site, 3 Snippet. A done
// step shows its choice with Change. The heading of a new step takes the focus.

import { Button } from '@payloadcms/ui'
import { useEffect, useId, useRef, useState, useTransition } from 'react'

import { ProbeText } from '../catalogue/DurationField'
import { SnippetCopy } from '../catalogue/SnippetCopy'
import { useAudioProbe } from '../catalogue/useAudioProbe'
import { PATHS } from '../paths'
import { strings } from '../strings'

import { addProject, addRecording, snippetFor } from './actions'

const s = strings.addPlayer

interface Recording {
  id: string
  title: string
  url: string
}
interface Project {
  slug: string
  label: string
  siteOrigins: string[]
}

type Step = 1 | 2 | 3

export function Wizard(props: { origin: string; recordings: Recording[]; projects: Project[] }) {
  const [step, setStep] = useState<Step>(1)
  const [recording, setRecording] = useState<Recording | null>(null)
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
      <span className="annoudio-wizard__number">{n}</span> {label}
    </h2>
  )

  return (
    <>
      <ol className="annoudio-wizard__steps" aria-label={s.stepsLabel}>
        {([1, 2, 3] as Step[]).map((n) => (
          <li key={n} aria-current={step === n ? 'step' : undefined} data-done={step > n}>
            {n} {[s.steps.recording, s.steps.site, s.steps.snippet][n - 1]}
          </li>
        ))}
      </ol>

      <section className="annoudio-panel annoudio-wizard__step" aria-label={s.steps.recording}>
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
        <section className="annoudio-panel annoudio-wizard__step" aria-label={s.steps.site}>
          {heading(2, s.steps.site)}
          {step > 2 && project ? (
            <Done text={s.site.chosen(project.label)} onChange={() => setStep(2)} />
          ) : (
            <SiteStep
              projects={props.projects}
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
        <section className="annoudio-panel annoudio-wizard__step" aria-label={s.steps.snippet}>
          {heading(3, s.steps.snippet)}
          <p>{s.snippet.intro}</p>
          <SnippetCopy
            recordingId={recording.id}
            snippets={[{ project: project.slug, label: project.label, text: snippet }]}
          />
          <p>
            {project.siteOrigins.length > 0
              ? s.snippet.comeBack(project.siteOrigins.map((o) => new URL(o).host).join(', '))
              : s.snippet.noSites}
          </p>
          <p>{s.snippet.plugins(recording.id)}</p>
          <figure className="annoudio-wizard__preview">
            <figcaption>{s.snippet.preview}</figcaption>
            <script async src={`${props.origin}/embed/v1.js`} />
            <annoudio-player
              project={project.slug}
              recording={recording.id}
              src={recording.url}
              origin={props.origin}
              annotate="none"
            />
          </figure>
          <Button el="link" url={PATHS.today} buttonStyle="primary" size="medium">
            {s.snippet.done}
          </Button>
        </section>
      )}
    </>
  )
}

function Done({ text, onChange }: { text: string; onChange: () => void }) {
  return (
    <p className="annoudio-wizard__done">
      {text}{' '}
      <Button buttonStyle="subtle" size="small" onClick={onChange}>
        {s.change}
      </Button>
    </p>
  )
}

function RecordingStep(props: { recordings: Recording[]; onDone: (recording: Recording) => void }) {
  const [mode, setMode] = useState<'choose' | 'new'>(props.recordings.length > 0 ? 'choose' : 'new')
  const [search, setSearch] = useState('')
  const [chosen, setChosen] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [errors, setErrors] = useState<{ field: string; message: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const probe = useAudioProbe(url)
  const ids = { title: useId(), url: useId(), search: useId(), error: useId() }
  const shown = props.recordings.filter((r) =>
    r.title.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const next = () => {
    setErrors(null)
    if (mode === 'choose') {
      const found = props.recordings.find((r) => r.id === chosen)
      if (found) props.onDone(found)
      else setErrors({ field: 'choose', message: s.recording.pick })
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
  const errorFor = (field: string) =>
    errors?.field === field ? (
      <p id={ids.error} role="alert" className="annoudio-field-error">
        {errors.message}
      </p>
    ) : null

  return (
    <>
      <fieldset className="annoudio-choice">
        <legend className="visually-hidden">{s.steps.recording}</legend>
        {props.recordings.length > 0 && (
          <label className="annoudio-choice__option">
            <input
              type="radio"
              name="recording-mode"
              checked={mode === 'choose'}
              onChange={() => setMode('choose')}
            />
            {s.recording.choose}
          </label>
        )}
        {mode === 'choose' && (
          <div className="annoudio-choice__body">
            <label htmlFor={ids.search}>{s.recording.search}</label>
            <input
              id={ids.search}
              type="search"
              className="annoudio-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div
              role="radiogroup"
              aria-label={s.recording.choose}
              className="annoudio-choice__list"
            >
              {shown.length === 0 && <p>{s.recording.noMatch}</p>}
              {shown.map((r) => (
                <label key={r.id} className="annoudio-choice__option">
                  <input
                    type="radio"
                    name="recording"
                    value={r.id}
                    checked={chosen === r.id}
                    onChange={() => setChosen(r.id)}
                  />
                  {r.title}
                </label>
              ))}
            </div>
            {errorFor('choose')}
          </div>
        )}
        <label className="annoudio-choice__option">
          <input
            type="radio"
            name="recording-mode"
            checked={mode === 'new'}
            onChange={() => setMode('new')}
          />
          {s.recording.new}
        </label>
        {mode === 'new' && (
          <div className="annoudio-choice__body">
            <label htmlFor={ids.title}>{s.recording.title}</label>
            <input
              id={ids.title}
              className="annoudio-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={errors?.field === 'title' ? true : undefined}
              aria-describedby={errors?.field === 'title' ? ids.error : undefined}
            />
            {errorFor('title')}
            <label htmlFor={ids.url}>{s.recording.url}</label>
            <input
              id={ids.url}
              type="url"
              inputMode="url"
              className="annoudio-input"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://"
              aria-invalid={errors?.field === 'url' ? true : undefined}
              aria-describedby={`${ids.url}-hint${errors?.field === 'url' ? ` ${ids.error}` : ''}`}
            />
            <p id={`${ids.url}-hint`} className="annoudio-hint">
              {s.recording.urlHint}
            </p>
            {errorFor('url')}
            <ProbeText probe={probe} />
          </div>
        )}
      </fieldset>
      {errorFor('form')}
      <Button buttonStyle="primary" size="medium" disabled={pending} onClick={next}>
        {s.next}
      </Button>
    </>
  )
}

function SiteStep(props: { projects: Project[]; onDone: (project: Project) => Promise<boolean> }) {
  const { projects } = props
  const [mode, setMode] = useState<'choose' | 'new'>(projects.length > 0 ? 'choose' : 'new')
  const [chosen, setChosen] = useState<string | null>(
    projects.length === 1 ? projects[0].slug : null,
  )
  // With one project, the step shows one line; Change shows the choices.
  const [open, setOpen] = useState(projects.length !== 1)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('https://')
  const [errors, setErrors] = useState<{ field: string; message: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const ids = { name: useId(), website: useId(), error: useId() }

  const next = () => {
    setErrors(null)
    startTransition(async () => {
      if (mode === 'choose') {
        const found = projects.find((p) => p.slug === chosen)
        if (!found) return setErrors({ field: 'choose', message: s.site.pick })
        if (!(await props.onDone(found))) setErrors({ field: 'form', message: s.failed })
        return
      }
      const result = await addProject({ name, website })
      if (!result.ok) return setErrors({ field: result.field ?? 'form', message: result.message })
      if (!(await props.onDone(result.project))) setErrors({ field: 'form', message: s.failed })
    })
  }
  const errorFor = (field: string) =>
    errors?.field === field ? (
      <p id={ids.error} role="alert" className="annoudio-field-error">
        {errors.message}
      </p>
    ) : null

  return (
    <>
      {!open ? (
        <p className="annoudio-wizard__done">
          {s.site.one(projects[0].label)}{' '}
          <Button buttonStyle="subtle" size="small" onClick={() => setOpen(true)}>
            {s.change}
          </Button>
        </p>
      ) : (
        <fieldset className="annoudio-choice">
          <legend>{s.site.question}</legend>
          {projects.map((p) => (
            <label key={p.slug} className="annoudio-choice__option">
              <input
                type="radio"
                name="project"
                checked={mode === 'choose' && chosen === p.slug}
                onChange={() => {
                  setMode('choose')
                  setChosen(p.slug)
                }}
              />
              {p.label}{' '}
              <span className="annoudio-hint">
                {p.siteOrigins.map((o) => new URL(o).host).join(', ') || s.site.noWebsite}
              </span>
            </label>
          ))}
          {errorFor('choose')}
          <label className="annoudio-choice__option">
            <input
              type="radio"
              name="project"
              checked={mode === 'new'}
              onChange={() => setMode('new')}
            />
            {s.site.new}
          </label>
          {mode === 'new' && (
            <div className="annoudio-choice__body">
              <p className="annoudio-hint">{s.site.newHint}</p>
              <label htmlFor={ids.name}>{s.site.name}</label>
              <input
                id={ids.name}
                className="annoudio-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={errors?.field === 'name' ? true : undefined}
                aria-describedby={errors?.field === 'name' ? ids.error : undefined}
              />
              {errorFor('name')}
              <label htmlFor={ids.website}>{s.site.website}</label>
              <input
                id={ids.website}
                type="url"
                inputMode="url"
                className="annoudio-input"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                aria-invalid={errors?.field === 'website' ? true : undefined}
                aria-describedby={`${ids.website}-hint${errors?.field === 'website' ? ` ${ids.error}` : ''}`}
              />
              <p id={`${ids.website}-hint`} className="annoudio-hint">
                {s.site.websiteHint}
              </p>
              {errorFor('website')}
            </div>
          )}
        </fieldset>
      )}
      {errorFor('form')}
      <Button buttonStyle="primary" size="medium" disabled={pending} onClick={next}>
        {s.next}
      </Button>
    </>
  )
}
