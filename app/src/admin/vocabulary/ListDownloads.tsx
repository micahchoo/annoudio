'use client'

// One SKOS download per list (Turtle), for "For other systems" of the Lists tab.

import { useTransition } from 'react'

import { downloadSkos } from '../projects/actions'
import { strings } from '../strings'

export function ListDownloads(props: { project: string; lists: { key: string; label: string }[] }) {
  const [pending, start] = useTransition()
  const download = (key: string) =>
    start(async () => {
      const result = await downloadSkos(props.project, 'turtle', key)
      if ('error' in result) return
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([result.body], { type: result.contentType }))
      link.download = result.filename
      link.click()
      URL.revokeObjectURL(link.href)
    })
  return (
    <p className="ao-actions">
      {props.lists.map((list) => (
        <button
          key={list.key}
          type="button"
          className="ao-btn"
          disabled={pending}
          onClick={() => download(list.key)}
        >
          {strings.lists.download(list.label)}
        </button>
      ))}
    </p>
  )
}
