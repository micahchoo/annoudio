'use client'

import { useFormFields } from '@payloadcms/ui'
import type { CSSProperties } from 'react'

export function ThemePlayer(props: {
  origin: string
  project: string
  recording: string
  src: string
  /** The theme tokens and their field names in the `themeTokens` group. */
  tokens: { token: string; field: string }[]
}) {
  // One string, so the player renders again only when a token value changes.
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
      <script async src={`${props.origin}/embed/v1.js`} />
      <annoudio-player
        project={props.project}
        recording={props.recording}
        src={props.src}
        origin={props.origin}
        annotate="none"
        style={style as CSSProperties}
      />
    </div>
  )
}
