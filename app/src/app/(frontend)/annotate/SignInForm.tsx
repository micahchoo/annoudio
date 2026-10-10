'use client'

import { useActionState } from 'react'

import type { SignInMode } from '@/modules/projects'

import { signIn } from './actions'
import type { AnnotateLink } from './link'
import type { SignInState } from './state'
import { strings } from './strings'

const s = strings.signIn

/**
 * Email, then login code, then (first sign-in only) a nickname. Or, with an invite code
 * (design/invite-codes.md): email and invite code, then the nickname. `mode` chooses the
 * forms: the project's `signIn` on the Annotate page. `moment` says what the member is
 * about to do: "You tell a story about 1:02 of the recording." On the Annotate page the
 * form keeps the link; on Your stories and Your account, `next` is that page.
 */
export function SignInForm(props: {
  link: AnnotateLink | null
  moment: string
  mode: SignInMode
  next?: string
  heading?: string
}) {
  const { link, moment, mode } = props
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {
    step: mode === 'invite-code' ? 'invite' : 'email',
    email: '',
  })
  const error = state.error ? strings.signInErrors[state.error] : null
  const errorId = 'sign-in-error'
  const describedBy = error ? errorId : undefined

  return (
    <section aria-labelledby="sign-in-heading">
      <form action={action} key={state.step}>
        {link ? <LinkFields link={link} /> : <input type="hidden" name="next" value={props.next} />}
        {state.step !== 'email' && state.step !== 'invite' && (
          <input type="hidden" name="email" value={state.email} />
        )}
        {state.code && <input type="hidden" name="code" value={state.code} />}
        {state.via && <input type="hidden" name="via" value={state.via} />}

        {state.step === 'email' && (
          <>
            <h2 id="sign-in-heading">
              {props.heading ?? (link?.replyTo ? s.replyHeading : s.heading)}
            </h2>
            <p className="moment">{moment}</p>
            <p>{s.intro}</p>
            <label htmlFor="email">{s.email}</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state.email}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              autoFocus
            />
            <ErrorText id={errorId} text={error} />
            <button type="submit" name="intent" value="send" disabled={pending}>
              {s.sendCode}
            </button>
            {mode === 'both' && (
              <button
                type="submit"
                name="intent"
                value="use-invite"
                formNoValidate
                disabled={pending}
                className="link-button"
              >
                {s.haveInvite}
              </button>
            )}
          </>
        )}

        {state.step === 'invite' && (
          <>
            <h2 id="sign-in-heading">{props.heading ?? s.inviteHeading}</h2>
            <p className="moment">{moment}</p>
            <p>{s.inviteIntro}</p>
            <label htmlFor="email">{s.email}</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state.email}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              autoFocus
            />
            <label htmlFor="invite">{s.invite}</label>
            <input
              id="invite"
              name="invite"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={20}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={['invite-hint', describedBy].filter(Boolean).join(' ')}
            />
            <p id="invite-hint" className="hint">
              {s.inviteHint}
            </p>
            <ErrorText id={errorId} text={error} />
            <button type="submit" name="intent" value="redeem" disabled={pending}>
              {s.redeem}
            </button>
            {mode !== 'invite-code' && (
              <button
                type="submit"
                name="intent"
                value="use-email"
                formNoValidate
                disabled={pending}
                className="link-button"
              >
                {s.useEmail}
              </button>
            )}
          </>
        )}

        {state.step === 'code' && (
          <>
            <h2 id="sign-in-heading">{s.codeHeading}</h2>
            <p className="moment">{moment}</p>
            <p>{s.codeSent(state.email)}</p>
            <label htmlFor="code">{s.code}</label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              autoFocus
            />
            <ErrorText id={errorId} text={error} />
            <button type="submit" name="intent" value="verify" disabled={pending}>
              {s.checkCode}
            </button>
            <button type="submit" name="intent" value="send" formNoValidate disabled={pending}>
              {s.newCode}
            </button>
            <button
              type="submit"
              name="intent"
              value="other-email"
              formNoValidate
              disabled={pending}
            >
              {s.otherEmail}
            </button>
          </>
        )}

        {state.step === 'nickname' && (
          <>
            <h2 id="sign-in-heading">{s.nicknameHeading}</h2>
            <p className="moment">{moment}</p>
            <p>{s.nicknameIntro}</p>
            <label htmlFor="nickname">{s.nickname}</label>
            <input
              id="nickname"
              name="nickname"
              autoComplete="nickname"
              maxLength={40}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              autoFocus
            />
            <ErrorText id={errorId} text={error} />
            <button type="submit" name="intent" value="nickname" disabled={pending}>
              {s.finish}
            </button>
          </>
        )}
      </form>
    </section>
  )
}

/** The Annotate link, kept through every form, so the member comes back to the same page. */
export function LinkFields({ link }: { link: AnnotateLink }) {
  return (
    <>
      <input type="hidden" name="project" value={link.project} />
      <input type="hidden" name="recording" value={link.recording} />
      <input type="hidden" name="t" value={link.t} />
      {link.return && <input type="hidden" name="return" value={link.return} />}
      {link.replyTo && <input type="hidden" name="replyTo" value={link.replyTo} />}
      {link.story && <input type="hidden" name="story" value={link.story} />}
    </>
  )
}

export function ErrorText({ id, text }: { id: string; text: string | null }) {
  if (!text) return null
  return (
    <p id={id} className="error" role="alert">
      {text}
    </p>
  )
}
