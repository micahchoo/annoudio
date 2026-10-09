'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { clockExact } from '@/clock'

import { saveStory } from './actions'
import { keepText, takeKeptText } from './keptText'
import { annotatePath, type AnnotateLink } from './link'
import { MediaField, type Attachment, type MediaKind } from './MediaField'
import { ErrorText, LinkFields } from './SignInForm'
import type { SaveState } from './state'
import { strings } from './strings'

const s = strings.form

export interface TopicNode {
  iri: string
  label: string
  children: TopicNode[]
}

export interface StoryDraft {
  id: string
  /** The ETag of the saved story. Absent for a new story. */
  etag?: string
  start: number
  end: number
  text: string
  tags: string[]
  media: Attachment[]
}

/** The part of the `<annoudio-player>` interface that this form uses (CONTRACT.md §4). */
type PlayerElement = HTMLElement & { currentTime?: number; seek?: (seconds: number) => void }

declare module 'react' {
  // React declares its JSX types in a namespace. An augmentation must use the same form.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'annoudio-player': React.DetailedHTMLProps<
        React.HTMLAttributes<PlayerElement>,
        PlayerElement
      > & {
        project: string
        recording: string
        src: string
        origin: string
        annotate: 'link' | 'none'
      }
    }
  }
}

interface Props {
  link: AnnotateLink
  /** ANNOUDIO_ORIGIN: where the player reads the published stories. */
  origin: string
  audio: string
  story: StoryDraft
  topics: TopicNode[]
  /** "Send for review", or "Publish the story" when the project publishes at once. */
  submit: string
  /** The largest upload of each kind, in bytes. */
  limits: Record<MediaKind, number>
  pickerTypes: string[]
}

/**
 * The player, the time range, the text and the topics of one story. The fields are
 * uncontrolled. After an error, React resets the form to the default values, which
 * are then the values that the member sent.
 */
export function StoryForm(props: Props) {
  const { link, origin, audio, story, topics } = props
  const [state, action, pending] = useActionState<SaveState, FormData>(saveStory, {})
  const [uploading, setUploading] = useState(false)
  const player = useRef<PlayerElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
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
    tags: story.tags,
    media: story.media.map((a) => `${a.kind}:${a.id}`),
  }
  // Without JavaScript, a refused save renders the form again: keep the bodies it sent.
  const attached = story.media.filter((a) => values.media.includes(`${a.kind}:${a.id}`))
  const checked = new Set(values.tags)

  const errorOf = (field: NonNullable<SaveState['error']>['field']) =>
    state.error?.field === field ? strings.saveErrors[state.error.code] : null
  // `currentTime` is NaN until the player is ready, and absent if its bundle did not load.
  const fromPlayer = (input: HTMLInputElement | null) => {
    const time = player.current?.currentTime
    if (input && typeof time === 'number' && Number.isFinite(time)) {
      input.value = clockExact(Math.round(time * 1000) / 1000)
    }
  }

  // Start the player at `t`. A seek before the duration is known waits for it (CONTRACT.md §4.2).
  useEffect(() => {
    let live = true
    customElements.whenDefined('annoudio-player').then(() => {
      const element = player.current
      if (live && typeof element?.seek === 'function') element.seek(link.t)
    })
    return () => {
      live = false
    }
  }, [link.t])

  return (
    <>
      <figure className="player">
        <figcaption>{strings.player}</figcaption>
        {/* The snippet of CONTRACT.md §1, with the loader of this stack. The link shows
            until the loader runs, and without JavaScript. */}
        <script async src="/embed/v1.js" />
        <annoudio-player
          ref={player}
          project={link.project}
          recording={link.recording}
          src={audio}
          origin={origin}
          annotate="none"
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

        <p id="time-hint" className="hint">
          {s.timeHint}
        </p>
        <div className="range">
          <TimeField
            name="start"
            label={s.start}
            value={values.start}
            fromPlayer={fromPlayer}
            error={errorOf('start')}
          />
          <TimeField
            name="end"
            label={s.end}
            value={values.end}
            fromPlayer={fromPlayer}
            error={errorOf('end')}
          />
        </div>

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

        <fieldset aria-describedby={errorOf('tags') ? 'tags-error' : undefined}>
          <legend>{s.tags}</legend>
          {topics.length === 0 ? <p>{s.noTags}</p> : <Topics nodes={topics} checked={checked} />}
          <ErrorText id="tags-error" text={errorOf('tags')} />
        </fieldset>

        <MediaField
          initial={attached}
          limits={props.limits}
          pickerTypes={props.pickerTypes}
          error={errorOf('media')}
          onBusyChange={setUploading}
        />

        <button type="submit" disabled={pending || uploading}>
          {pending ? s.saving : props.submit}
        </button>
        {uploading && <p className="hint">{s.waitForUpload}</p>}
      </form>
    </>
  )
}

function TimeField(props: {
  name: 'start' | 'end'
  label: string
  value: string
  fromPlayer: (input: HTMLInputElement | null) => void
  error: string | null
}) {
  const input = useRef<HTMLInputElement>(null)
  const errorId = `${props.name}-error`
  return (
    <div className="time">
      <label htmlFor={props.name}>{props.label}</label>
      <input
        ref={input}
        id={props.name}
        name={props.name}
        type="text"
        autoComplete="off"
        spellCheck={false}
        defaultValue={props.value}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? `time-hint ${errorId}` : 'time-hint'}
      />
      <button
        type="button"
        onClick={() => props.fromPlayer(input.current)}
        aria-label={`${props.label}: ${s.setFromPlayer}`}
      >
        {s.setFromPlayer}
      </button>
      <ErrorText id={errorId} text={props.error} />
    </div>
  )
}

function Topics(props: { nodes: TopicNode[]; checked: Set<string> }) {
  return (
    <ul className="topics">
      {props.nodes.map((node) => (
        <li key={node.iri}>
          <label>
            <input
              type="checkbox"
              name="tags"
              value={node.iri}
              defaultChecked={props.checked.has(node.iri)}
            />
            {node.label}
          </label>
          {node.children.length > 0 && <Topics {...props} nodes={node.children} />}
        </li>
      ))}
    </ul>
  )
}
