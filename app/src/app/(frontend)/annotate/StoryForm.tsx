'use client'

import { useActionState, useCallback, useEffect, useRef, useState } from 'react'

import { clock, clockExact, clockRange, parseClock } from '@/clock'
import type { WidgetElement } from '@/widget-element'

import { saveStory } from './actions'
import { FieldControls, type FormQuestion, type KeptAnswer } from './FieldControls'
import { keepText, takeKeptText } from './keptText'
import { annotatePath, type AnnotateLink } from './link'
import { MediaField, type Attachment, type MediaKind } from './MediaField'
import { ErrorText, LinkFields } from './SignInForm'
import type { SaveState } from './state'
import { strings } from './strings'

const s = strings.form

export interface StoryDraft {
  id: string
  /** The ETag of the saved story. Absent for a new story. */
  etag?: string
  start: number
  end: number
  text: string
  /** The form entries of the stored answers (`answers.ts`). */
  answers: [string, string][]
  media: Attachment[]
}

interface Props {
  link: AnnotateLink
  /** ANNOUDIO_ORIGIN: where the widget reads the published stories. */
  origin: string
  audio: string
  story: StoryDraft
  /** The questions of the project for new stories, in field order. */
  questions: FormQuestion[]
  /** Answers of hidden questions that this story has. */
  kept: KeptAnswer[]
  /** "Send for review", or "Publish the story" when the project publishes at once. */
  submit: string
  /** What happens after the send, in one line under the button. */
  next: string
  /** The largest upload of each kind, in bytes. */
  limits: Record<MediaKind, number>
  pickerTypes: string[]
}

/** The range of the widget (`range` attribute, CONTRACT.md §2.1), or none for bad times. */
function rangeOf(start: string, end: string): string | undefined {
  const from = parseClock(start)
  const to = parseClock(end)
  return Number.isFinite(from) && Number.isFinite(to) && to > from ? `${from},${to}` : undefined
}

/**
 * The widget with the time range, the times, the text, the media and the questions of one
 * story. The member marks the range by a drag on the waveform (the widget draws it, and
 * `annoudio:range` gives the new times), or types the times; the widget then moves the
 * range. The fields are uncontrolled: without JavaScript the form still works, and after
 * an error React resets them to the values that the member sent.
 */
export function StoryForm(props: Props) {
  const { link, origin, audio, story } = props
  const [state, action, pending] = useActionState<SaveState, FormData>(saveStory, {})
  const [uploading, setUploading] = useState(false)
  const widget = useRef<WidgetElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const startInput = useRef<HTMLInputElement>(null)
  const endInput = useRef<HTMLInputElement>(null)
  const signedOut = state.error?.code === 'signed-out'
  // P9: keep the text when the session ended; take it back after the next sign-in. A new
  // story gets a new id on each page load, so it keeps its text under its instance.
  const keepKey = story.etag ? story.id : `new:${link.project}/${link.recording}`
  useEffect(() => {
    if (signedOut && textarea.current) keepText(keepKey, textarea.current.value)
  }, [signedOut, keepKey])
  useEffect(() => {
    const kept = takeKeptText(keepKey)
    if (kept !== null && textarea.current && textarea.current.value.trim() === '') {
      textarea.current.value = kept
    }
  }, [keepKey])
  const values = state.values ?? {
    start: clockExact(story.start),
    end: clockExact(story.end),
    text: story.text,
    media: story.media.map((a) => `${a.kind}:${a.id}`),
    answers: story.answers,
  }
  // Without JavaScript, a refused save renders the form again: keep the bodies it sent.
  const attached = story.media.filter((a) => values.media.includes(`${a.kind}:${a.id}`))

  // The range that the widget draws, and the time that "Use …" puts in a field.
  const [range, setRange] = useState(() => rangeOf(values.start, values.end))
  const [now, setNow] = useState<number | null>(null)
  const syncRange = useCallback(() => {
    setRange(rangeOf(startInput.current?.value ?? '', endInput.current?.value ?? ''))
  }, [])

  const errorOf = (field: NonNullable<SaveState['error']>['field']) =>
    state.error?.field === field ? strings.saveErrors[state.error.code] : null

  // Start the widget at `t`. A seek before the duration is known waits for it (CONTRACT.md
  // §4.2). Then follow its time for "Use …", and its range for the two fields.
  useEffect(() => {
    let live = true
    const element = widget.current
    const onTime = (event: Event) => {
      const time = (event as CustomEvent<{ currentTime: number }>).detail.currentTime
      if (Number.isFinite(time)) setNow(time)
    }
    const onRange = (event: Event) => {
      const { start, end } = (event as CustomEvent<{ start: number; end: number }>).detail
      // Whole seconds, as the member types them (workflow-audit 17). End stays after Start.
      const from = Math.floor(start)
      const to = Math.max(from + 1, Math.round(end))
      if (startInput.current) startInput.current.value = clock(from)
      if (endInput.current) endInput.current.value = clock(to)
      setRange(`${from},${to}`)
    }
    element?.addEventListener('annoudio:timeupdate', onTime)
    element?.addEventListener('annoudio:range', onRange)
    customElements.whenDefined('annoudio-player').then(() => {
      if (!live || typeof element?.seek !== 'function') return
      element.seek(link.t)
      setNow(link.t)
    })
    return () => {
      live = false
      element?.removeEventListener('annoudio:timeupdate', onTime)
      element?.removeEventListener('annoudio:range', onRange)
    }
  }, [link.t])

  const takeNow = (field: 'start' | 'end') => {
    const input = field === 'start' ? startInput.current : endInput.current
    const time = widget.current?.currentTime
    if (!input || typeof time !== 'number' || !Number.isFinite(time)) return
    input.value = clock(Math.round(time))
    syncRange()
  }
  const [from, to] = range ? range.split(',').map(Number) : [NaN, NaN]

  return (
    <>
      <p className="intro">{s.intro}</p>
      <figure className="widget">
        <figcaption>{strings.recordingLabel}</figcaption>
        {/* The snippet of CONTRACT.md §1, with the loader of this stack. The link shows
            until the loader runs, and without JavaScript. */}
        <script async src="/embed/v1.js" />
        <annoudio-player
          ref={widget}
          project={link.project}
          recording={link.recording}
          src={audio}
          origin={origin}
          annotate="none"
          range={range}
        >
          <a href={audio}>{strings.listen}</a>
        </annoudio-player>
      </figure>

      <form action={action} aria-labelledby="story-heading" noValidate>
        <h2 id="story-heading">{story.etag ? s.editHeading : s.newHeading}</h2>
        <LinkFields link={link} />
        <input type="hidden" name="id" value={story.id} />
        {story.etag && <input type="hidden" name="ifMatch" value={story.etag} />}

        <ErrorText id="form-error" text={errorOf('form')} />
        {signedOut && (
          <p>
            <a href={annotatePath(link)}>{strings.signInAgain}</a>
          </p>
        )}

        <p className="moment" aria-live="polite">
          {range ? s.moment(clockRange(from, to)) : s.timeHint}
        </p>
        <div className="range">
          <TimeField
            name="start"
            label={s.start}
            value={values.start}
            ref={startInput}
            now={now}
            onChange={syncRange}
            onUseNow={takeNow}
            error={errorOf('start')}
          />
          <TimeField
            name="end"
            label={s.end}
            value={values.end}
            ref={endInput}
            now={now}
            onChange={syncRange}
            onUseNow={takeNow}
            error={errorOf('end')}
          />
        </div>
        {/* After the fields: on a phone, Start and End follow the waveform closely. */}
        <p id="time-hint" className="hint">
          {s.timeHint}
        </p>

        <label htmlFor="text">{s.text}</label>
        <p id="text-hint" className="hint">
          {s.textHint}
        </p>
        <textarea
          ref={textarea}
          id="text"
          name="text"
          rows={6}
          defaultValue={values.text}
          aria-invalid={errorOf('text') ? true : undefined}
          aria-describedby={errorOf('text') ? 'text-hint text-error' : 'text-hint'}
        />
        <ErrorText id="text-error" text={errorOf('text')} />

        <MediaField
          initial={attached}
          limits={props.limits}
          pickerTypes={props.pickerTypes}
          error={errorOf('media')}
          onBusyChange={setUploading}
        />

        {/* Questions follow the story text and the media (design/vocab.md §7.1). */}
        <FieldControls
          questions={props.questions}
          answers={values.answers}
          errors={state.valueErrors ?? []}
          kept={props.kept}
        />

        <div className="send-bar">
          <button type="submit" disabled={pending || uploading}>
            {pending ? s.saving : props.submit}
          </button>
          <p>{uploading ? s.waitForUpload : props.next}</p>
        </div>
      </form>
    </>
  )
}

function TimeField({
  ref,
  ...props
}: {
  ref: React.Ref<HTMLInputElement>
  name: 'start' | 'end'
  label: string
  value: string
  /** The time of the widget, for "Use 0:05". Null before it is known. */
  now: number | null
  onChange: () => void
  onUseNow: (field: 'start' | 'end') => void
  error: string | null
}) {
  const errorId = `${props.name}-error`
  const time = props.now === null ? null : clock(Math.round(props.now))
  return (
    <div className="time">
      <label htmlFor={props.name}>{props.label}</label>
      <input
        ref={ref}
        id={props.name}
        name={props.name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        defaultValue={props.value}
        onChange={props.onChange}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? `time-hint ${errorId}` : 'time-hint'}
      />
      {time !== null && (
        <button
          type="button"
          onClick={() => props.onUseNow(props.name)}
          aria-label={s.useTimeLabel(props.label, time)}
        >
          {s.useTime(time)}
        </button>
      )}
      <ErrorText id={errorId} text={props.error} />
    </div>
  )
}
