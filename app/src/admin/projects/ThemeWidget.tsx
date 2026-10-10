'use client'

// The live preview of the theme: the widget of this stack with the values of the form as
// `--annoudio-*` properties on the element, which win over the saved theme (CONTRACT.md
// §3.1, rule 3). Its links are live: they lead to the Annotate page and back to the
// preview page of the widget.

import { useFormFields } from '@payloadcms/ui'
import type { CSSProperties } from 'react'

import { PreviewWidget } from '../ui/PreviewWidget'

export function ThemeWidget(props: {
  origin: string
  project: string
  recording: string
  src: string
  back: string
  /** The theme tokens and their field names in the `themeTokens` group. */
  tokens: { token: string; field: string }[]
}) {
  // One string, so the widget renders again only when a token value changes.
  const values = useFormFields(([fields]) =>
    JSON.stringify(props.tokens.map(({ field }) => fields[`themeTokens.${field}`]?.value ?? '')),
  )
  const style: Record<string, string> = {}
  ;(JSON.parse(values) as unknown[]).forEach((value, i) => {
    if (typeof value === 'string' && value.trim()) {
      style[`--annoudio-${props.tokens[i].token}`] = value.trim()
    }
  })
  return (
    <div className="annoudio-theme-preview">
      <PreviewWidget
        origin={props.origin}
        project={props.project}
        recording={props.recording}
        src={props.src}
        back={props.back}
        style={style as CSSProperties}
      />
    </div>
  )
}
