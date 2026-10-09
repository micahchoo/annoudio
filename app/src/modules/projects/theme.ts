import type { Field, Payload, PayloadRequest } from 'payload'

import { publicJson } from '@/publicJson'

// The theme tokens of a project (CONTRACT.md §3.1) and the theme JSON route (§3.2, §5.1):
// GET /embed/v1/themes/{project}.json → { "tokens": { "color-accent": "#8a1c2b" } }.

type Kind = 'color' | 'length' | 'font'

interface Token {
  /** The token name without the `--annoudio-` prefix. The key in the theme JSON. */
  token: string
  /** The field name in the `themeTokens` group. */
  field: string
  label: string
  kind: Kind
  /** The player default, shown as the placeholder of the empty field. */
  placeholder: string
}

/** CONTRACT.md table 3.1, in table order. The theme JSON keeps this order. */
export const THEME_TOKENS: readonly Token[] = [
  {
    token: 'color-surface',
    field: 'colorSurface',
    label: 'Background colour',
    kind: 'color',
    placeholder: '#ffffff',
  },
  {
    token: 'color-text',
    field: 'colorText',
    label: 'Text colour',
    kind: 'color',
    placeholder: '#1f1f1f',
  },
  {
    token: 'color-muted',
    field: 'colorMuted',
    label: 'Secondary text colour',
    kind: 'color',
    placeholder: '#595959',
  },
  {
    token: 'color-accent',
    field: 'colorAccent',
    label: 'Accent colour',
    kind: 'color',
    placeholder: '#0b5cad',
  },
  {
    token: 'color-on-accent',
    field: 'colorOnAccent',
    label: 'Text on the accent colour',
    kind: 'color',
    placeholder: '#ffffff',
  },
  {
    token: 'color-border',
    field: 'colorBorder',
    label: 'Border colour',
    kind: 'color',
    placeholder: '#767676',
  },
  {
    token: 'color-wave',
    field: 'colorWave',
    label: 'Waveform colour',
    kind: 'color',
    placeholder: '#8c8c8c',
  },
  {
    token: 'color-region',
    field: 'colorRegion',
    label: 'Story range colour',
    kind: 'color',
    placeholder: '#d5e3f3',
  },
  {
    token: 'color-focus',
    field: 'colorFocus',
    label: 'Focus ring colour',
    kind: 'color',
    placeholder: '#0b5cad',
  },
  {
    token: 'font-family',
    field: 'fontFamily',
    label: 'Font',
    kind: 'font',
    placeholder: 'The font of the host page',
  },
  {
    token: 'font-size',
    field: 'fontSize',
    label: 'Text size',
    kind: 'length',
    placeholder: 'The text size of the host page',
  },
  { token: 'radius', field: 'radius', label: 'Corner radius', kind: 'length', placeholder: '6px' },
  {
    token: 'space',
    field: 'space',
    label: 'Space between items',
    kind: 'length',
    placeholder: '0.5em',
  },
  {
    token: 'timeline-height',
    field: 'timelineHeight',
    label: 'Timeline height',
    kind: 'length',
    placeholder: '64px',
  },
]

// A rough syntax check, so an operator sees a typing error at once. The player checks
// each value again with CSS.supports() and ignores a value that fails (CONTRACT.md §3.2).
const SHAPES: Record<Kind, { test: RegExp; hint: string }> = {
  color: {
    test: /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z]+|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\))$/i,
    hint: 'Use a CSS colour, for example #8a1c2b or rgb(138 28 43).',
  },
  length: {
    test: /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|ch|ex|vw|vh|vmin|vmax|cm|mm|in|pt|pc|q))$/i,
    hint: 'Use a CSS length, for example 6px or 0.5em.',
  },
  font: {
    test: /^[\p{L}\p{N} ,'"_-]+$/u,
    hint: 'Use a list of font names, for example "Noto Sans", sans-serif.',
  },
}

const MAX_LENGTH = 100

function validator(kind: Kind) {
  return (value: unknown) => {
    if (value === null || value === undefined || value === '') return true
    if (typeof value !== 'string') return SHAPES[kind].hint
    const trimmed = value.trim()
    return (trimmed.length <= MAX_LENGTH && SHAPES[kind].test.test(trimmed)) || SHAPES[kind].hint
  }
}

/** The admin group: one optional text field per token. Payload 3.90 has no colour input. */
export const themeTokensField: Field = {
  name: 'themeTokens',
  type: 'group',
  label: 'Theme',
  admin: {
    description:
      'How the player looks on host sites. Leave a field empty to use the default (shown in grey). A host site can change each value in its own CSS. A change shows on host sites within 5 minutes.',
  },
  fields: THEME_TOKENS.map((t) => ({
    name: t.field,
    type: 'text' as const,
    label: t.label,
    admin: { placeholder: t.placeholder },
    validate: validator(t.kind),
  })),
}

export interface ThemeJson {
  /** Only the tokens that the operator set, in CONTRACT.md table 3.1 order. */
  tokens: Record<string, string>
  /** The project name. Added 2026-10-09, additive. */
  name: string
  /** The rights statement of the project, for example "CC BY 4.0". Added 2026-10-09, additive. */
  rightsLine?: string
  /** The web address of the licence. Added 2026-10-09, additive. */
  rightsIri?: string
}

export interface ThemeContext {
  payload: Payload
  req?: PayloadRequest
}

/** The theme JSON of a project. Null if no project has the slug. */
export async function theme(context: ThemeContext, slug: string): Promise<ThemeJson | null> {
  const { docs } = await context.payload.find({
    collection: 'projects',
    where: { slug: { equals: slug } },
    limit: 1,
    pagination: false,
    depth: 0,
    req: context.req,
  })
  const doc = docs[0]
  if (!doc) return null
  const set = (doc.themeTokens ?? {}) as Record<string, string | null | undefined>
  const tokens: Record<string, string> = {}
  for (const t of THEME_TOKENS) {
    const value = set[t.field]?.trim()
    if (value) tokens[t.token] = value
  }
  return {
    tokens,
    name: doc.name,
    ...(doc.rightsLine?.trim() ? { rightsLine: doc.rightsLine.trim() } : {}),
    ...(doc.rightsIri?.trim() ? { rightsIri: doc.rightsIri.trim() } : {}),
  }
}

const FILE = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/

/**
 * The HTTP answer for `GET /embed/v1/themes/{file}`, where `file` is `{project}.json`.
 * Headers: CONTRACT.md §5.1. An If-None-Match with the current ETag gives 304.
 */
export async function handleTheme(
  context: ThemeContext,
  request: Request,
  file: string,
): Promise<Response> {
  const slug = FILE.exec(file)?.[1]
  return publicJson(request, slug ? await theme(context, slug) : null)
}
