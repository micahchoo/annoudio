'use client'

// **Add** on the page of a list: a new item by its label, and the operator stays on the
// list for the next one (recordings audit, 04). "Add an item with all fields" is the full
// item form (same as, broader item). No <form>: the page has none of its own to submit.

import { toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState, useTransition } from 'react'

import { strings } from '../strings'

import { addListItem } from './actions'

const s = strings.lists

export function QuickAddItem(props: { project: string; listKey: string }) {
  const router = useRouter()
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const add = () =>
    start(async () => {
      const text = label.trim()
      if (!text) return setError(strings.lists.errors['bad-class'])
      setError(null)
      const result = await addListItem(props.project, props.listKey, text)
      if (!result.ok) return setError(result.error)
      toast.success(s.quickAdded(text))
      setLabel('')
      router.refresh()
      input.current?.focus()
    })
  return (
    <div className="ao-field annoudio-quick-add">
      <label htmlFor={id}>{s.quickAdd}</label>
      <span className="ao-inline">
        <input
          ref={input}
          id={id}
          className="ao-input"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="ao-btn ao-btn--primary" disabled={pending} onClick={add}>
          {s.quickAddButton}
        </button>
      </span>
      {error && (
        <p role="alert" className="ao-field__error">
          {error}
        </p>
      )}
    </div>
  )
}
