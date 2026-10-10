'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { saveStory } from './actions'
import { keepText, takeKeptText } from './keptText'
import { annotatePath, type AnnotateLink } from './link'
import { MediaField, type Attachment, type MediaKind } from './MediaField'
import { ErrorText, LinkFields } from './SignInForm'
import type { SaveState } from './state'
import { strings } from './strings'

const s = strings.reply

export interface ReplyDraft {
  id: string
  /** The ETag of the saved reply. Absent for a new reply. */
  etag?: string
  text: string
  media: Attachment[]
}

interface Props {
  /** `link.replyTo` names the story that the reply answers. */
  link: AnnotateLink
  reply: ReplyDraft
  /** "Send for review", or "Publish the reply" when the project publishes at once. */
  submit: string
  /** The largest upload of each kind, in bytes. */
  limits: Record<MediaKind, number>
  pickerTypes: string[]
}

/**
 * The text and the media bodies of one reply. A reply has no time range and no topics.
 * The fields are uncontrolled, as in `StoryForm`.
 */
export function ReplyForm({ link, reply, submit, limits, pickerTypes }: Props) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveStory, {})
  const [uploading, setUploading] = useState(false)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const signedOut = state.error?.code === 'signed-out'
  // P9: keep the text when the session ended; take it back after the next sign-in. A new
  // reply gets a new id on each page load, so it keeps its text under its story.
  const keepKey = reply.etag
    ? reply.id
    : `new-reply:${link.project}/${link.recording}/${link.replyTo}`
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
    start: '',
    end: '',
    text: reply.text,
    tags: [],
    media: reply.media.map((a) => `${a.kind}:${a.id}`),
  }
  const attached = reply.media.filter((a) => values.media.includes(`${a.kind}:${a.id}`))
  const errorOf = (field: NonNullable<SaveState['error']>['field']) =>
    state.error?.field === field ? strings.saveErrors[state.error.code] : null

  return (
    <form action={action} aria-labelledby="reply-heading" noValidate>
      <h2 id="reply-heading">{reply.etag ? s.editHeading : s.newHeading}</h2>
      <p className="intro">{s.intro}</p>
      <LinkFields link={link} />
      <input type="hidden" name="id" value={reply.id} />
      {reply.etag && <input type="hidden" name="ifMatch" value={reply.etag} />}

      <ErrorText id="form-error" text={errorOf('form')} />
      {signedOut && (
        <p>
          <a href={annotatePath(link)}>{strings.signInAgain}</a>
        </p>
      )}

      <label htmlFor="text">{s.text}</label>
      <p id="text-hint" className="hint">
        {s.textHint}
      </p>
      <textarea
        ref={textarea}
        id="text"
        name="text"
        rows={5}
        defaultValue={values.text}
        aria-invalid={errorOf('text') ? true : undefined}
        aria-describedby={errorOf('text') ? 'text-hint text-error' : 'text-hint'}
      />
      <ErrorText id="text-error" text={errorOf('text')} />

      <MediaField
        initial={attached}
        limits={limits}
        pickerTypes={pickerTypes}
        error={errorOf('media')}
        onBusyChange={setUploading}
      />

      <div className="send-bar">
        <button type="submit" disabled={pending || uploading}>
          {pending ? strings.form.saving : submit}
        </button>
        {uploading && <p>{strings.form.waitForUpload}</p>}
      </div>
    </form>
  )
}
