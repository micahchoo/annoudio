'use client'

// **Add a list** (O10l): a name, the kind (words and topics, or people, places or
// things) and, for an entity list, what the entries are. No <form>: inside Payload's form.

import { toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'

import type { ListKind } from '@/modules/vocabulary'

import { PATHS } from '../paths'
import { strings } from '../strings'
import { Icon } from '../ui/Icon'

import { addQuestionList } from './actions'
import { CLASSES } from './classes'

const s = strings.lists

export function AddList({ project }: { project: string }) {
  const router = useRouter()
  const id = useId()
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<ListKind>('items')
  const [cls, setCls] = useState<string>(CLASSES[0].iri)
  const [error, setError] = useState<string | null>(null)
  // A list with the same name: its name and key, so the operator opens it (no duplicate).
  const [existing, setExisting] = useState<{ key: string; label: string } | null>(null)
  const [pending, start] = useTransition()
  const add = () =>
    start(async () => {
      setError(null)
      setExisting(null)
      const result = await addQuestionList(project, {
        label,
        kind,
        ...(kind === 'entities' ? { class: cls } : {}),
      })
      if (!result.ok && result.error === 'exists') {
        return setExisting({ key: result.key, label: result.label })
      }
      if (!result.ok) return setError(s.errors[result.error])
      toast.success(s.added)
      setLabel('')
      router.refresh()
    })
  return (
    <div className="ao-card annoudio-add-list">
      <h3 className="ao-label">{s.add}</h3>
      <div className="ao-field">
        <label htmlFor={`${id}-name`}>{s.name}</label>
        <p id={`${id}-name-help`} className="ao-field__help">
          {s.nameHelp}
        </p>
        <input
          id={`${id}-name`}
          className="ao-input"
          value={label}
          aria-describedby={`${id}-name-help`}
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>
      <div className="ao-field">
        <label htmlFor={`${id}-kind`}>{s.kind}</label>
        <span className="ao-select">
          <select
            id={`${id}-kind`}
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            {(['items', 'entities'] as const).map((one) => (
              <option key={one} value={one}>
                {s.kinds[one]}
              </option>
            ))}
          </select>
          <Icon name="chevron" />
        </span>
      </div>
      {kind === 'entities' && (
        <div className="ao-field">
          <label htmlFor={`${id}-class`}>{s.class}</label>
          <span className="ao-select">
            <select id={`${id}-class`} value={cls} onChange={(event) => setCls(event.target.value)}>
              {CLASSES.map((c) => (
                <option key={c.iri} value={c.iri}>
                  {c.label}
                </option>
              ))}
            </select>
            <Icon name="chevron" />
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="ao-field__error">
          {error}
        </p>
      )}
      {existing && (
        <p role="alert" className="ao-field__error">
          {s.exists(existing.label)}{' '}
          <a href={`${PATHS.concepts}/${project}?list=${encodeURIComponent(existing.key)}`}>
            {s.openExisting}
          </a>
        </p>
      )}
      <p className="ao-actions">
        <button type="button" className="ao-btn" disabled={pending} onClick={add}>
          {s.add}
        </button>
      </p>
    </div>
  )
}
