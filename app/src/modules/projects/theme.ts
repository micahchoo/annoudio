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
  /** One line under the label (design/concept-map.md §3.2). */
  description: string
  kind: Kind
  /** The widget default, shown as the placeholder of the empty field (CONTRACT.md §3.1). */
  placeholder: string
  /**
   * A colour: the field of the colour that it sits on, and the contrast that it needs
   * (WCAG 2.2: 4.5 for text, 3 for a control edge). The colour picker shows the ratio.
   */
  contrast?: { against: string[]; need: 3 | 4.5 }
}

/** CONTRACT.md table 3.1, in table order. The theme JSON keeps this order. */
export const THEME_TOKENS: readonly Token[] = [
  {
    token: 'color-surface',
    field: 'colorSurface',
    label: 'Background colour',
    description: 'The colour behind the widget.',
    kind: 'color',
    placeholder: '#ffffff',
  },
  {
    token: 'color-text',
    field: 'colorText',
    label: 'Text colour',
    description: 'The colour of the story text.',
    kind: 'color',
    placeholder: '#1f1f1f',
    contrast: { against: ['colorSurface'], need: 4.5 },
  },
  {
    token: 'color-muted',
    field: 'colorMuted',
    label: 'Secondary text colour',
    description: 'The colour of names, times and the rights line.',
    kind: 'color',
    placeholder: '#595959',
    contrast: { against: ['colorSurface'], need: 4.5 },
  },
  {
    token: 'color-accent',
    field: 'colorAccent',
    label: 'Accent colour',
    description: 'The colour of buttons and links, for example "Tell a story".',
    kind: 'color',
    placeholder: '#0b6e99',
    contrast: { against: ['colorSurface'], need: 4.5 },
  },
  {
    token: 'color-on-accent',
    field: 'colorOnAccent',
    label: 'Text on the accent colour',
    description: 'The colour of the words on a button.',
    kind: 'color',
    placeholder: '#ffffff',
    contrast: { against: ['colorAccent'], need: 4.5 },
  },
  {
    token: 'color-border',
    field: 'colorBorder',
    label: 'Border colour',
    description: 'The colour of lines around the widget and the stories.',
    kind: 'color',
    placeholder: '#767676',
    contrast: { against: ['colorSurface'], need: 3 },
  },
  {
    token: 'color-wave',
    field: 'colorWave',
    label: 'Waveform colour',
    description: 'The colour of the drawn sound of the recording.',
    kind: 'color',
    placeholder: '#848484',
    contrast: { against: ['colorSurface', 'colorRegion'], need: 3 },
  },
  {
    token: 'color-region',
    field: 'colorRegion',
    label: 'Time range colour',
    description: 'The colour that marks the time range of each story on the waveform.',
    kind: 'color',
    placeholder: '#d6eaf5',
  },
  {
    token: 'color-focus',
    field: 'colorFocus',
    label: 'Focus ring colour',
    description: 'The ring around the control that the keyboard is on.',
    kind: 'color',
    placeholder: '#0b6e99',
    contrast: { against: ['colorSurface'], need: 3 },
  },
  {
    token: 'font-family',
    field: 'fontFamily',
    label: 'Font',
    description: 'Empty: the widget uses the font of your page.',
    kind: 'font',
    placeholder: 'The font of your page',
  },
  {
    token: 'font-size',
    field: 'fontSize',
    label: 'Text size',
    description: 'Empty: the widget uses the text size of your page.',
    kind: 'length',
    placeholder: 'The text size of your page',
  },
  {
    token: 'radius',
    field: 'radius',
    label: 'Corner radius',
    description: 'How round the corners of the widget and its buttons are.',
    kind: 'length',
    placeholder: '6px',
  },
  {
    token: 'space',
    field: 'space',
    label: 'Space between items',
    description: 'The space between the stories and the controls.',
    kind: 'length',
    placeholder: '0.5em',
  },
  {
    token: 'timeline-height',
    field: 'timelineHeight',
    label: 'Waveform height',
    description: 'The height of the waveform with the time ranges.',
    kind: 'length',
    placeholder: '64px',
  },
]

// A rough syntax check, so an operator sees a typing error at once. The widget checks
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

/** What the colour picker of one token reads: the colours under it, with their defaults. */
function contrastOf(t: Token) {
  if (!t.contrast) return null
  return {
    need: t.contrast.need,
    against: t.contrast.against.map((field) => {
      const under = THEME_TOKENS.find((other) => other.field === field)!
      return { field, label: under.label.toLowerCase(), fallback: under.placeholder }
    }),
  }
}

/** The tested dark set (design/design-system.md §7): "Use the dark set" in the Theme tab. */
export const DARK_SET: Readonly<Record<string, string>> = {
  colorSurface: '#222222',
  colorText: '#ebebeb',
  colorMuted: '#c3c3c3',
  colorAccent: '#41b2ec',
  colorOnAccent: '#141414',
  colorBorder: '#808080',
  colorWave: '#9a9a9a',
  colorRegion: '#1b3a4b',
  colorFocus: '#41b2ec',
}

/** The admin group: one optional text field per token; a colour has the colour picker. */
export const themeTokensField: Field = {
  name: 'themeTokens',
  type: 'group',
  label: 'Theme',
  admin: {
    description:
      'How the widget looks on your sites. An empty field uses the default, in grey. A saved change shows on your sites at the next page load.',
  },
  fields: THEME_TOKENS.map((t) => ({
    name: t.field,
    type: 'text' as const,
    label: t.label,
    admin: {
      placeholder: t.placeholder,
      description: t.description,
      // A colour gets the colour picker with its contrast readout (design-system.md §6.1).
      ...(t.kind === 'color'
        ? {
            components: { Field: '/admin/projects/ColorField#ColorField' },
            custom: { fallback: t.placeholder, contrast: contrastOf(t) },
          }
        : {}),
    },
    validate: validator(t.kind),
  })),
}

export interface ThemeJson {
  /** Only the tokens that the operator set, in CONTRACT.md table 3.1 order. */
  tokens: Record<string, string>
  /** The project name. Added 2026-10-09, additive. */
  name: string
  /** The rights line of the project, one sentence. Added 2026-10-09, additive. */
  rightsLine?: string
  /** The web address of the licence. Added 2026-10-09, additive. */
  rightsIri?: string
  /**
   * The fields of the project in field order, hidden ones too: the widget labels the values
   * of a story with them (CONTRACT §3.2 rule 8). Added 2026-10-09, additive.
   */
  fields?: ThemeField[]
}

/** One field as the widget needs it. */
export interface ThemeField {
  property: string
  label: string
  showAs: 'line' | 'tags' | 'none'
  valueType: string
}

export interface ThemeContext {
  payload: Payload
  req?: PayloadRequest
  /**
   * The labels of the fields of a project (`vocabulary.labels`). `projects` does not import
   * `vocabulary`: the route gives this function. Without it, the JSON has no `fields`.
   */
  labels?: (project: string) => Promise<ThemeField[]>
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
  const fields = context.labels ? await context.labels(slug) : []
  return {
    tokens,
    name: doc.name,
    ...(doc.rightsLine?.trim() ? { rightsLine: doc.rightsLine.trim() } : {}),
    ...(doc.rightsIri?.trim() ? { rightsIri: doc.rightsIri.trim() } : {}),
    ...(fields.length > 0 ? { fields } : {}),
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
  // `no-cache`: a saved theme shows on the next page load (CONTRACT.md §5.1).
  return publicJson(request, slug ? await theme(context, slug) : null, 'revalidate')
}
