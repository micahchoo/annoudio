'use client'

// "Start from": fills the colour fields of the Theme tab with a tested set
// (design/design-system.md §7): the default light set (empty fields) or the dark set.

import { toast, useForm } from '@payloadcms/ui'
import { useId } from 'react'

import { strings } from '../strings'
import { Icon } from '../ui/Icon'

const s = strings.theme

/** `fields`: the colour fields of the group; `dark`: the dark value of each. */
export function ThemePresets(props: { fields: string[]; dark: Record<string, string> }) {
  const { dispatchFields, setModified } = useForm()
  const id = useId()
  const apply = (set: 'light' | 'dark') => {
    for (const field of props.fields) {
      const value = set === 'dark' ? (props.dark[field] ?? '') : ''
      dispatchFields({ type: 'UPDATE', path: `themeTokens.${field}`, value })
    }
    setModified(true)
    toast.success(s.presetApplied)
  }
  return (
    <div className="ao-field">
      <label htmlFor={id}>{s.preset}</label>
      <p id={`${id}-help`} className="ao-field__help">
        {s.presetHelp}
      </p>
      <span className="ao-select">
        <select
          id={id}
          value=""
          aria-describedby={`${id}-help`}
          onChange={(event) => {
            if (event.target.value === 'light' || event.target.value === 'dark') {
              apply(event.target.value)
            }
          }}
        >
          <option value="">{s.presets.choose}</option>
          <option value="light">{s.presets.light}</option>
          <option value="dark">{s.presets.dark}</option>
        </select>
        <Icon name="chevron" />
      </span>
    </div>
  )
}
