import { roundSeconds } from './shape'
import type { DraftInput, SaveError } from './types'

export interface Limits {
  bodies: number
  tags: number
  text: number
}

/**
 * Check the parts of a draft that need no lookup: the range or the reply, the counts and
 * the text. `duration` is the recording duration in seconds, if the catalogue knows it.
 * An empty text body counts as no body. A story with media bodies needs a text body too.
 */
export function checkDraft(
  input: DraftInput,
  duration: number | undefined,
  limits: Limits,
): SaveError | null {
  if (input.replyTo !== undefined) {
    if (input.start !== undefined || input.end !== undefined) return { code: 'reply-and-range' }
    // Tags classify a time range of the recording. A reply is about a story.
    if ((input.tags ?? []).length > 0) return { code: 'reply-and-tags' }
  } else {
    const start = Number.isFinite(input.start) ? roundSeconds(input.start!) : NaN
    const end = Number.isFinite(input.end) ? roundSeconds(input.end!) : NaN
    if (!(start >= 0)) return { code: 'invalid-range', field: 'start' }
    if (!(end > start) || (duration !== undefined && end > duration)) {
      return { code: 'invalid-range', field: 'end' }
    }
  }
  if (input.bodies.length === 0) return { code: 'no-body' }
  if (input.bodies.some((body) => body.kind === 'text' && body.value.trim() === '')) {
    return { code: 'no-body' }
  }
  // CONTEXT.md, fixed decisions: a required short text with every media body.
  if (!input.bodies.some((body) => body.kind === 'text')) return { code: 'media-needs-text' }
  if (input.bodies.length > limits.bodies) return { code: 'too-many-bodies' }
  if ((input.tags ?? []).length > limits.tags) return { code: 'too-many-tags' }
  const long = input.bodies.findIndex(
    (body) => body.kind === 'text' && [...body.value].length > limits.text,
  )
  if (long !== -1) return { code: 'text-too-long', index: long }
  return null
}
