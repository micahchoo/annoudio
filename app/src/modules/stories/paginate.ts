// The one place that knows the protocol's containers and pages.
// It turns the published stories of one instance into the text of every representation.

import { asItem } from './shape'
import type { Annotation } from './types'

const ANNO = 'http://www.w3.org/ns/anno.jsonld'
const LDP = 'http://www.w3.org/ns/ldp.jsonld'

/**
 * The replies of a story go into its page item under this key. The extension context
 * below makes it a reverse `oa:hasTarget`: each value is an annotation whose target is the
 * item. So the key adds no new statement, and the RDF of a page with replies equals the
 * RDF of the page plus each reply alone. The context has one term and redefines no term
 * of the Web Annotation context (Web Annotation Vocabulary §4). See design/phase5b-notes.md.
 */
export const REPLIES = 'annoudio:replies'
const EXTENSION = { [REPLIES]: { '@reverse': 'oa:hasTarget' } }

/** What a read asks for. One key is one stored row. */
export type ReadKey =
  | { kind: 'container'; iris: boolean; minimal: boolean }
  | { kind: 'page'; iris: boolean; page: number }
  | { kind: 'story'; id: string }

export interface InstanceInfo {
  containerIri: string
  label: string
}

/** A published reply. */
export interface ServedReply {
  id: string
  annotation: Annotation
}

/** A published story with its published replies, in any order. */
export interface ServedStory extends ServedReply {
  start: number
  replies: ServedReply[]
}

export function variantOf(key: ReadKey): string {
  switch (key.kind) {
    case 'container':
      return `container${key.minimal ? '-minimal' : ''}${key.iris ? '-iris' : ''}`
    case 'page':
      return `page${key.iris ? '-iris' : ''}-${key.page}`
    case 'story':
      return `story-${key.id}`
  }
}

/** Timeline order: `start`, then `created`, then `id`. */
export function timelineOrder(a: ServedStory, b: ServedStory): number {
  return (
    a.start - b.start || compare(a.annotation.created, b.annotation.created) || compare(a.id, b.id)
  )
}

/** Thread order: `created`, then `id`. */
function replyOrder(a: ServedReply, b: ServedReply): number {
  return compare(a.annotation.created, b.annotation.created) || compare(a.id, b.id)
}

/** The page item of a story: the annotation, and its replies when it has some. */
function itemOf(story: ServedStory) {
  if (story.replies.length === 0) return asItem(story.annotation)
  return {
    ...asItem(story.annotation),
    [REPLIES]: story.replies.map((reply) => asItem(reply.annotation)),
  }
}

/** The text of every representation of the instance, by variant. */
export function representations(
  info: InstanceInfo,
  stories: ServedStory[],
  pageSize: number,
): Map<string, string> {
  const sorted = [...stories]
    .sort(timelineOrder)
    .map((story) => ({ ...story, replies: [...story.replies].sort(replyOrder) }))
  const out = new Map<string, string>()
  // `total` counts the stories, the items of the collection. Replies are inside their items.
  const total = sorted.length
  // A new reply changes the container, so `modified` reads the replies too.
  const modified = sorted
    .flatMap((story) => [story, ...story.replies])
    .map((served) => served.annotation)
    .reduce<string | undefined>(
      (latest, annotation) =>
        latest === undefined || annotation.modified > latest ? annotation.modified : latest,
      undefined,
    )
  const pageCount = Math.ceil(total / pageSize)

  for (const iris of [false, true]) {
    const pageIri = (n: number) => `${info.containerIri}?${iris ? 'iris=1&' : ''}page=${n}`
    // An IRI item cannot carry replies: the IRI variants list the stories only.
    const items = sorted.map((story) => (iris ? story.annotation.id : itemOf(story)))
    const pageStories = (n: number) => sorted.slice(n * pageSize, (n + 1) * pageSize)
    const pageItems = (n: number) => items.slice(n * pageSize, (n + 1) * pageSize)
    // The extension context only where a page item has replies: other pages keep the plain shape.
    const extension = (n: number) =>
      !iris && pageStories(n).some((story) => story.replies.length > 0) ? [EXTENSION] : []
    const links = (n: number) => ({
      ...(n > 0 ? { prev: pageIri(n - 1) } : {}),
      ...(n < pageCount - 1 ? { next: pageIri(n + 1) } : {}),
    })

    const container = (first: unknown, embedded: boolean) =>
      JSON.stringify({
        '@context': [ANNO, LDP, ...(embedded ? extension(0) : [])],
        id: info.containerIri,
        type: ['BasicContainer', 'AnnotationCollection'],
        label: info.label,
        total,
        ...(total > 0 ? { modified, first, last: pageIri(pageCount - 1) } : {}),
      })
    const embedded = { id: pageIri(0), type: 'AnnotationPage', startIndex: 0, ...links(0) }
    out.set(
      variantOf({ kind: 'container', iris, minimal: false }),
      container({ ...embedded, items: pageItems(0) }, true),
    )
    out.set(variantOf({ kind: 'container', iris, minimal: true }), container(pageIri(0), false))

    for (let n = 0; n < pageCount; n++) {
      out.set(
        variantOf({ kind: 'page', iris, page: n }),
        JSON.stringify({
          '@context': extension(n).length > 0 ? [ANNO, ...extension(n)] : ANNO,
          id: pageIri(n),
          type: 'AnnotationPage',
          partOf: { id: info.containerIri, total, modified },
          startIndex: n * pageSize,
          ...links(n),
          items: pageItems(n),
        }),
      )
    }
  }

  // Each story and each reply at its own IRI, as a complete annotation.
  for (const story of sorted) {
    out.set(variantOf({ kind: 'story', id: story.id }), JSON.stringify(story.annotation))
    for (const reply of story.replies) {
      out.set(variantOf({ kind: 'story', id: reply.id }), JSON.stringify(reply.annotation))
    }
  }
  return out
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
