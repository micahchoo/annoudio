'use client'

// The controls of the review screen (O5, O5a–c): Publish with the visitor preview, Return
// to the member with a reason, Remove from the menu, and Next story. After an action the
// next waiting story opens (design/ia.md §4.1); at the end, the Waiting for review tab.
// No <form>: the controls are inside Payload's document form. The dialogs are native
// <dialog> elements: the browser keeps the focus inside and gives it back on close.

import { Button, toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState, useTransition, type ReactNode } from 'react'

import { PATHS } from '../paths'
import { strings } from '../strings'

import { publishStory, removeStory, returnStory, type ActionResult } from './actions'

const s = strings.review

/** What visitors see of the story, for the Publish dialog. */
export interface Preview {
  nickname: string
  /** "1:02–1:35", or null for a reply. */
  range: string | null
  reply: boolean
  /** For a reply: the member of the story that it answers, if that story is there. */
  parentNickname: string | null
  texts: { value: string; language?: string }[]
  tags: string[]
  media: string[]
}

function useAfter() {
  const router = useRouter()
  return (result: ActionResult & { ok: true }, message: string) => {
    toast.success(message)
    router.push(result.next ? `${PATHS.review}/${result.next}` : PATHS.review)
    router.refresh()
  }
}

/** A modal dialog with a heading, a body and two buttons. */
function Dialog({
  ref,
  heading,
  children,
  confirm,
  confirmStyle = 'primary',
  pending,
  error,
  onConfirm,
}: {
  ref: React.RefObject<HTMLDialogElement | null>
  heading: string
  children: ReactNode
  confirm: string
  confirmStyle?: 'primary' | 'error'
  pending: boolean
  error: string | null
  onConfirm: () => void
}) {
  const headingId = useId()
  const errorId = useId()
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      aria-describedby={error ? errorId : undefined}
      className="annoudio-dialog"
    >
      <h2 id={headingId}>{heading}</h2>
      {children}
      {error && (
        <p id={errorId} role="alert" className="annoudio-dialog__error">
          {error}
        </p>
      )}
      <div className="annoudio-dialog__buttons">
        <Button buttonStyle={confirmStyle} size="medium" disabled={pending} onClick={onConfirm}>
          {confirm}
        </Button>
        <Button buttonStyle="secondary" size="medium" onClick={() => ref.current?.close()}>
          {s.cancel}
        </Button>
      </div>
    </dialog>
  )
}

export function PublishDialog(props: {
  id: string
  preview: Preview
  /** A sentence when the story cannot be published now (its media is processing). */
  blocked: string | null
  mail: boolean
}) {
  const { preview } = props
  const dialog = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const after = useAfter()
  const { reply } = preview

  const confirm = () =>
    startTransition(async () => {
      const result = await publishStory(props.id)
      if (!result.ok) {
        setError(s.publishErrors[result.error as keyof typeof s.publishErrors] ?? s.failed)
        return
      }
      dialog.current?.close()
      after(result, s.published)
    })

  return (
    <>
      <Button
        buttonStyle="primary"
        size="medium"
        disabled={props.blocked !== null}
        aria-label={props.blocked ? `${s.publish}. ${props.blocked}` : undefined}
        onClick={() => {
          setError(null)
          dialog.current?.showModal()
        }}
      >
        {s.publish}
      </Button>
      {props.blocked && (
        <span className="annoudio-controls__note" aria-hidden="true">
          {props.blocked}
        </span>
      )}
      <Dialog
        ref={dialog}
        heading={reply ? s.publishHeadingReply : s.publishHeading}
        confirm={reply ? s.confirmPublishReply : s.confirmPublish}
        pending={pending}
        error={error}
        onConfirm={confirm}
      >
        <p>{s.publishIntro}</p>
        <figure className="annoudio-preview">
          <figcaption className="annoudio-preview__meta">
            {preview.nickname}
            {preview.range && ` · ${preview.range}`}
            {preview.parentNickname && ` · ${s.replyBy(preview.parentNickname)}`}
          </figcaption>
          {preview.texts.map((text, i) => (
            <p key={i} lang={text.language} className="annoudio-preview__text">
              {text.value}
            </p>
          ))}
          {preview.media.length > 0 && (
            <p className="annoudio-preview__media">{preview.media.join(', ')}</p>
          )}
          {preview.tags.length > 0 && (
            <ul className="annoudio-preview__tags" aria-label={s.tags}>
              {preview.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          )}
        </figure>
        <p>{props.mail ? s.mails(preview.nickname) : s.noMail(preview.nickname)}</p>
      </Dialog>
    </>
  )
}

export function ReturnDialog(props: {
  id: string
  /** What happens to what visitors see. */
  effect: 'stops' | 'keeps' | 'none'
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const after = useAfter()
  const reasonId = useId()

  const confirm = () => {
    if (!reason.trim()) {
      setError(s.noReason)
      return
    }
    startTransition(async () => {
      const result = await returnStory(props.id, reason)
      if (!result.ok) {
        setError(result.error === 'no-reason' ? s.noReason : s.failed)
        return
      }
      dialog.current?.close()
      after(result, s.returned)
    })
  }

  return (
    <>
      <Button
        buttonStyle="secondary"
        size="medium"
        onClick={() => {
          setError(null)
          dialog.current?.showModal()
        }}
      >
        {s.return}
      </Button>
      <Dialog
        ref={dialog}
        heading={s.returnHeading}
        confirm={s.confirmReturn}
        pending={pending}
        error={error}
        onConfirm={confirm}
      >
        <p>{s.returnIntro}</p>
        {props.effect === 'stops' && (
          <p className="annoudio-dialog__warning">{s.returnPublished}</p>
        )}
        {props.effect === 'keeps' && <p>{s.returnChange}</p>}
        <label htmlFor={reasonId}>{s.reason}</label>
        <textarea
          id={reasonId}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          placeholder={s.reasonHint}
          aria-invalid={error === s.noReason ? true : undefined}
        />
      </Dialog>
    </>
  )
}

/** Remove (O5c): a button with the danger colour, after Publish, and a confirmation. */
export function RemoveDialog(props: { id: string; replies: number }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const after = useAfter()
  const reasonId = useId()

  const confirm = () =>
    startTransition(async () => {
      const result = await removeStory(props.id, reason)
      if (!result.ok) {
        setError(s.failed)
        return
      }
      dialog.current?.close()
      after(result, s.removed)
    })

  return (
    <>
      <Button
        buttonStyle="secondary"
        size="medium"
        className="annoudio-remove"
        onClick={() => {
          setError(null)
          dialog.current?.showModal()
        }}
      >
        {s.remove}
      </Button>
      <Dialog
        ref={dialog}
        heading={s.removeHeading}
        confirm={s.confirmRemove}
        confirmStyle="error"
        pending={pending}
        error={error}
        onConfirm={confirm}
      >
        <p>{s.removeIntro}</p>
        {props.replies > 0 && (
          <p className="annoudio-dialog__warning">{s.removeReplies(props.replies)}</p>
        )}
        <label htmlFor={reasonId}>{s.removeReason}</label>
        <textarea
          id={reasonId}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
        />
      </Dialog>
    </>
  )
}

/** In place of "Save draft": an operator changes no story. Opens the next waiting story. */
export function NextStoryButton({ next }: { next: string | null }) {
  return (
    <Button
      el="link"
      url={next ? `${PATHS.review}/${next}` : PATHS.review}
      buttonStyle="secondary"
      size="medium"
    >
      {s.next}
    </Button>
  )
}
