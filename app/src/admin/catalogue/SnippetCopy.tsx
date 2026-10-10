'use client'

// The copy field of a snippet (design/design-system.md §5, Copy field): the two lines in a
// read-only box, Copy the snippet, and one status line. With more than one project, a
// dropdown chooses the project of the snippet.

import { useId, useRef, useState } from 'react'

import { strings } from '../strings'
import { Icon } from '../ui/Icon'

const s = strings.recording

export function SnippetCopy(props: {
  recordingId: string
  snippets: { project: string; label: string; text: string }[]
}) {
  const [project, setProject] = useState(props.snippets[0].project)
  const [copied, setCopied] = useState<'no' | 'yes' | 'refused'>('no')
  const ids = { select: useId(), code: useId() }
  const box = useRef<HTMLTextAreaElement>(null)
  const current = props.snippets.find((item) => item.project === project) ?? props.snippets[0]

  // A browser can refuse the clipboard (no permission, no secure context). Then select the
  // text, so the operator copies it with the keyboard.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.text)
      setCopied('yes')
    } catch {
      box.current?.focus()
      box.current?.select()
      setCopied('refused')
    }
  }

  return (
    <div className="ao-copy annoudio-snippet">
      {props.snippets.length > 1 && (
        <div className="ao-field">
          <label htmlFor={ids.select}>{s.project}</label>
          <span className="ao-select">
            <select
              id={ids.select}
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
            <Icon name="chevron" />
          </span>
        </div>
      )}
      <label htmlFor={ids.code} className="ao-label">
        {s.snippetFor(current.label)}
      </label>
      <textarea
        id={ids.code}
        ref={box}
        readOnly
        rows={4}
        spellCheck={false}
        value={current.text}
        className="annoudio-snippet__code"
      />
      <div className="ao-actions">
        <button type="button" className="ao-btn ao-btn--primary" onClick={copy}>
          <Icon name="copy" />
          {s.copy}
        </button>
        <span role="status" className="ao-copy__status">
          {copied === 'yes' && (
            <>
              <Icon name="published" />
              {s.copied}
            </>
          )}
          {copied === 'refused' && s.copyRefused}
        </span>
      </div>
      <p className="ao-field__help annoudio-snippet__id">{s.id(props.recordingId)}</p>
    </div>
  )
}
