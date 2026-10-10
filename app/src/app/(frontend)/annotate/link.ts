// The Annotate link (CONTRACT.md §7): `/annotate?project&recording&t&return`, and the
// Reply link of the widget, which adds `replyTo`.

import { withWidgetFragment } from '@/fragment'

export { seconds } from '@/fragment'

export interface AnnotateLink {
  project: string
  recording: string
  /** Seconds. 0 when the link has no valid `t`. */
  t: number
  /** The `return` value as the link gave it. Check it with `returnTarget` before use. */
  return: string | null
  /** The id of the story that the member answers. Null for a new story. */
  replyTo: string | null
  /** An own story or reply to show and change (a link from Your stories or a mail). */
  story: string | null
}

type Query = Record<string, string | string[] | undefined>

const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : null)

/** Read the link from the page query or from the hidden fields of a form. */
export function readLink(query: Query | FormData): AnnotateLink | null {
  const get = (key: string) =>
    query instanceof FormData ? (query.get(key) as string | null) : one(query[key])
  const project = get('project')
  const recording = get('recording')
  if (!project || !recording) return null
  const t = Number(get('t'))
  return {
    project,
    recording,
    t: Number.isFinite(t) && t >= 0 ? t : 0,
    return: get('return') || null,
    replyTo: get('replyTo') || null,
    story: get('story') || null,
  }
}

/** The relative URL of the Annotate page for this link. Never an absolute URL. */
export function annotatePath(link: AnnotateLink, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams({
    project: link.project,
    recording: link.recording,
    t: String(link.t),
  })
  if (link.return) query.set('return', link.return)
  if (link.replyTo) query.set('replyTo', link.replyTo)
  if (link.story) query.set('story', link.story)
  for (const [key, value] of Object.entries(extra)) query.set(key, value)
  return `/annotate?${query}`
}

/**
 * `return` plus the fragment that the widget reads (CONTRACT.md §7.2): `annoudio-saved`
 * is `draft` (it waits for review) or `published` (the project publishes at once). After a
 * reply, `annoudio-reply` makes the widget open the story that it answers.
 */
export function returnWithFragment(
  target: string,
  link: AnnotateLink,
  start: number,
  reviewState: 'draft' | 'published',
): string {
  return withWidgetFragment(target, {
    project: link.project,
    recording: link.recording,
    t: start,
    saved: reviewState,
    ...(link.replyTo ? { reply: link.replyTo } : {}),
  })
}

/** A new UUIDv7 (RFC 9562): 48 bits of Unix milliseconds, then random bits. */
export function uuidv7(now = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  for (let i = 0; i < 6; i++) bytes[i] = Math.floor(now / 2 ** (8 * (5 - i))) % 256
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
