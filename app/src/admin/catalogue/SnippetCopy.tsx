'use client'

import { Button } from '@payloadcms/ui'
import { useId, useRef, useState } from 'react'

import { strings } from '../strings'

const s = strings.recording

export function SnippetCopy(props: {
  recordingId: string
  snippets: { project: string; label: string; text: string }[]
}) {
  const [project, setProject] = useState(props.snippets[0].project)
  const [copied, setCopied] = useState<'no' | 'yes' | 'refused'>('no')
  const selectId = useId()
  const code = useRef<HTMLElement>(null)
  const current = props.snippets.find((item) => item.project === project) ?? props.snippets[0]

  // A browser can refuse the clipboard (no permission, no secure context). Then select the
  // text, so the operator copies it with the keyboard.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.text)
      setCopied('yes')
    } catch {
      const range = document.createRange()
      if (code.current) range.selectNodeContents(code.current)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
      setCopied('refused')
    }
  }

  return (
    <div className="annoudio-snippet">
      {props.snippets.length > 1 && (
        <p>
          <label htmlFor={selectId}>{s.project} </label>
          <select
            id={selectId}
            value={project}
            onChange={(event) => {
              setProject(event.target.value)
              setCopied('no')
            }}
          >
            {props.snippets.map((item) => (
              <option key={item.project} value={item.project}>
                {item.label}
              </option>
            ))}
          </select>
        </p>
      )}
      <pre className="annoudio-snippet__code">
        <code ref={code}>{current.text}</code>
      </pre>
      <p className="annoudio-snippet__actions">
        <Button buttonStyle="primary" size="medium" onClick={copy}>
          {s.copy}
        </Button>
        <span role="status">
          {copied === 'yes' ? s.copied : copied === 'refused' ? s.copyRefused : ''}
        </span>
      </p>
      <p className="annoudio-snippet__id">{s.id(props.recordingId)}</p>
    </div>
  )
}
