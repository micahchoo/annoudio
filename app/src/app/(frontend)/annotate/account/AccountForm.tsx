'use client'

// The form of Your account: the name and the mail choice. It works without JavaScript too.

import { useActionState } from 'react'

import { saveAccount, type AccountState } from '../actions'
import { ErrorText } from '../SignInForm'
import { strings } from '../strings'

const s = strings.account

/** `unverified`: the member signed in with an invite code only (design/invite-codes.md). */
export function AccountForm(props: {
  email: string
  nickname: string
  mailNotices: boolean
  unverified?: { canVerify: boolean }
}) {
  const [state, action, pending] = useActionState<AccountState, FormData>(saveAccount, {})
  const values = state.values ?? { nickname: props.nickname, mailNotices: props.mailNotices }
  const error = state.error ? s.errors[state.error] : null
  return (
    <form action={action} aria-labelledby="account-heading" noValidate>
      <h2 id="account-heading" className="visually-hidden">
        {s.title}
      </h2>
      <p className="field">
        <span className="label">{s.email}</span>
        <span className="value">{props.email}</span>
        <span className="hint">{s.emailHint}</span>
      </p>
      <label htmlFor="nickname">{s.name}</label>
      <p id="nickname-hint" className="hint">
        {s.nameHint}
      </p>
      <input
        id="nickname"
        name="nickname"
        autoComplete="nickname"
        maxLength={40}
        defaultValue={values.nickname}
        aria-invalid={state.error === 'invalid-nickname' ? true : undefined}
        aria-describedby={state.error ? 'nickname-hint account-error' : 'nickname-hint'}
      />
      <label className="check">
        <input type="checkbox" name="mailNotices" defaultChecked={values.mailNotices} />
        {s.mail}
      </label>
      {props.unverified && (
        <p className="hint" data-testid="unverified">
          {s.unverified} {props.unverified.canVerify ? s.verify : ''}
        </p>
      )}
      <ErrorText id="account-error" text={error} />
      <button type="submit" disabled={pending}>
        {pending ? s.saving : s.save}
      </button>
      <span role="status" className="saved-note">
        {state.saved ? s.saved : ''}
      </span>
    </form>
  )
}
