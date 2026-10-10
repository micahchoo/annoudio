'use client'

import { Button, toast } from '@payloadcms/ui'
import { useId, useState, useTransition, type KeyboardEvent } from 'react'

import type { Invite } from '@/modules/membership'

import { strings } from '../strings'

import { makeInviteCodes, revokeInviteCode, type InviteError } from './actions'

const s = strings.invites

// These inputs sit inside the project form of Payload. They have no `name`, so the
// project form does not save them, and Enter must not save the project.
const noSubmit = (event: KeyboardEvent) => {
  if (event.key === 'Enter') event.preventDefault()
}

export function InviteTools(props: {
  project: string
  projectName: string
  site: string
  initial: Invite[]
}) {
  const id = useId()
  const [pending, startTransition] = useTransition()
  const [list, setList] = useState(props.initial)
  const [made, setMade] = useState<string[] | null>(null)
  const [error, setError] = useState<InviteError | null>(null)
  const [count, setCount] = useState('10')
  const [uses, setUses] = useState('1')
  const [label, setLabel] = useState('')
  const [lastDay, setLastDay] = useState('')

  const make = () =>
    startTransition(async () => {
      setError(null)
      const result = await makeInviteCodes(props.project, {
        count: Number(count),
        uses: Number(uses),
        label,
        // The end of the chosen day, in the time zone of this browser.
        expiresAt: lastDay ? new Date(`${lastDay}T23:59:59.999`).toISOString() : '',
      })
      if (!result.ok) return setError(result.error)
      setMade(result.codes)
      setList(result.list)
    })

  const revoke = (invite: Invite) =>
    startTransition(async () => {
      const result = await revokeInviteCode(props.project, invite.id)
      if (!result.ok) return setError(result.error)
      setList(result.list)
      toast.success(s.revoked)
    })

  const copy = async (codes: string[]) => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      toast.success(s.copied)
    } catch {
      // No clipboard: the codes stay on the screen to copy by hand.
    }
  }

  const print = (codes: string[]) => {
    const page = window.open('', '_blank')
    if (!page) return
    const doc = page.document
    doc.title = `${s.printTitle}: ${props.projectName}`
    const style = doc.createElement('style')
    style.textContent =
      'body{font:16px system-ui,sans-serif;margin:2rem}li{break-inside:avoid;border:1px dashed #999;padding:1rem;margin:0 0 1rem;list-style:none}code{font-size:1.6rem;letter-spacing:.1em}'
    doc.head.append(style)
    const list = doc.createElement('ul')
    for (const code of codes) {
      const item = doc.createElement('li')
      const strong = doc.createElement('strong')
      strong.textContent = props.projectName
      const value = doc.createElement('code')
      value.textContent = code
      const how = doc.createElement('p')
      how.textContent = s.printHow(props.site)
      item.append(strong, doc.createElement('br'), value, how)
      list.append(item)
    }
    doc.body.append(list)
    page.print()
  }

  const field = (key: string) => `${id}-${key}`
  const errorText = error ? s.errors[error] : null

  return (
    <div className="annoudio-invites">
      {made ? (
        <div role="status" className="annoudio-invites__made">
          <h3>{s.madeHeading(made.length)}</h3>
          <p>{s.madeHint}</p>
          <ul className="annoudio-invites__codes" aria-label={s.madeHeading(made.length)}>
            {made.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
          <p className="annoudio-skos__buttons">
            <Button buttonStyle="primary" size="medium" onClick={() => copy(made)}>
              {s.copy}
            </Button>
            <Button buttonStyle="secondary" size="medium" onClick={() => print(made)}>
              {s.print}
            </Button>
            <Button buttonStyle="subtle" size="medium" onClick={() => setMade(null)}>
              {s.done}
            </Button>
          </p>
        </div>
      ) : (
        <div className="annoudio-invites__form">
          <h3>{s.make}</h3>
          <div className="annoudio-invites__fields">
            <p className="ao-field">
              <label htmlFor={field('count')}>{s.count}</label>
              <input
                id={field('count')}
                type="number"
                className="ao-input"
                min={1}
                max={100}
                value={count}
                onChange={(event) => setCount(event.target.value)}
                onKeyDown={noSubmit}
              />
            </p>
            <p className="ao-field">
              <label htmlFor={field('uses')}>{s.uses}</label>
              <input
                id={field('uses')}
                type="number"
                className="ao-input"
                min={1}
                max={1000}
                value={uses}
                aria-describedby={field('uses-hint')}
                onChange={(event) => setUses(event.target.value)}
                onKeyDown={noSubmit}
              />
              <span id={field('uses-hint')} className="ao-field__help annoudio-invites__hint">
                {s.usesHint}
              </span>
            </p>
            <p className="ao-field">
              <label htmlFor={field('label')}>{s.label}</label>
              <input
                id={field('label')}
                type="text"
                className="ao-input"
                maxLength={80}
                value={label}
                aria-describedby={field('label-hint')}
                onChange={(event) => setLabel(event.target.value)}
                onKeyDown={noSubmit}
              />
              <span id={field('label-hint')} className="ao-field__help annoudio-invites__hint">
                {s.labelHint}
              </span>
            </p>
            <p className="ao-field">
              <label htmlFor={field('last-day')}>{s.expires}</label>
              <input
                id={field('last-day')}
                type="date"
                className="ao-input"
                value={lastDay}
                aria-describedby={field('last-day-hint')}
                onChange={(event) => setLastDay(event.target.value)}
                onKeyDown={noSubmit}
              />
              <span id={field('last-day-hint')} className="ao-field__help annoudio-invites__hint">
                {s.expiresHint}
              </span>
            </p>
          </div>
          {errorText && (
            <p role="alert" className="ao-field__error">
              {errorText}
            </p>
          )}
          <Button buttonStyle="primary" size="medium" disabled={pending} onClick={make}>
            {pending ? s.making : s.make}
          </Button>
        </div>
      )}

      {list.length === 0 ? (
        <div className="ao-empty">
          <p>{s.none}</p>
        </div>
      ) : (
        <table className="annoudio-invites__list">
          <thead>
            <tr>
              <th scope="col">{s.columns.code}</th>
              <th scope="col">{s.columns.label}</th>
              <th scope="col">{s.columns.used}</th>
              <th scope="col">{s.columns.lastDay}</th>
              <th scope="col">{s.columns.state}</th>
              <td />
            </tr>
          </thead>
          <tbody>
            {list.map((invite) => (
              <tr key={invite.id} data-state={invite.state}>
                <td>
                  <code>{s.starts(invite.hint)}</code>
                </td>
                <td>{invite.label ?? ''}</td>
                <td>{s.usedOf(invite.used, invite.uses)}</td>
                <td>
                  {invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : s.noLastDay}
                </td>
                <td>
                  <span
                    className={`ao-badge ao-badge--${invite.state === 'active' ? 'published' : 'processing'}`}
                  >
                    {s.states[invite.state]}
                  </span>
                </td>
                <td>
                  {invite.state !== 'revoked' && (
                    <Button
                      buttonStyle="subtle"
                      size="small"
                      disabled={pending}
                      aria-label={s.revokeLabel(invite.hint)}
                      onClick={() => revoke(invite)}
                    >
                      {s.revoke}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
