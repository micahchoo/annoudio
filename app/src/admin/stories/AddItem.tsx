'use client'

// **Add "Ravi" to People** (O5, design/vocab.md §8): an own answer of a member becomes an
// item of the list of its question. The story keeps its own answer (open question 1).

import { toast } from '@payloadcms/ui'
import { useState, useTransition } from 'react'

import { addListItem } from '../vocabulary/actions'
import { strings } from '../strings'

const s = strings.review

export function AddItem(props: {
  project: string
  listKey: string
  listLabel: string
  text: string
}) {
  const [pending, start] = useTransition()
  const [done, setDone] = useState(false)
  if (done) return <span role="status">{s.addedOwn(props.text, props.listLabel)}</span>
  return (
    <button
      type="button"
      className="ao-btn ao-btn--quiet"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await addListItem(props.project, props.listKey, props.text)
          if (!result.ok) return void toast.error(result.error)
          toast.success(s.addedOwn(props.text, props.listLabel))
          setDone(true)
        })
      }
    >
      {s.addOwn(props.text, props.listLabel)}
    </button>
  )
}
