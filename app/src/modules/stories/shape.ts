// The one place that knows WADM. Every story that leaves the module passes through
// `parseStory`, which rebuilds the object in one fixed key order. Postgres `jsonb`
// does not keep key order, so the served bytes come from this order, not from storage.

import { mediaIdOf } from '@/modules/media'

import type {
  Annotation,
  BodyInput,
  ConceptIri,
  MediaResource,
  ProjectSlug,
  RecordingId,
  ReplyAnnotation,
  StoryAnnotation,
  StoryId,
  TagLabel,
  TagResource,
  TextualBody,
} from './types'

const ANNO = 'http://www.w3.org/ns/anno.jsonld'
const MEDIA_FRAGS = 'http://www.w3.org/TR/media-frags/'
const MEDIA_TYPES = { sound: 'Sound', image: 'Image', video: 'Video' } as const
const MEDIA_KINDS = { Sound: 'sound', Image: 'image', Video: 'video' } as const
const SELECTOR = /^t=(\d+(?:\.\d{1,3})?),(\d+(?:\.\d{1,3})?)$/
const SEGMENT = /^[^/?#]+$/
const EXCERPT = 80

interface ParsedBase {
  id: StoryId
  project: ProjectSlug
  recording: RecordingId
  memberId: string
}

/**
 * A stored story or reply, parsed. `annotation` has the canonical key order. A reply is in
 * the instance of its parent story: its IRI has the same project and recording.
 */
export type ParsedStory =
  | (ParsedBase & { replyTo: null; start: number; end: number; annotation: StoryAnnotation })
  | (ParsedBase & { replyTo: StoryId; start: null; end: null; annotation: ReplyAnnotation })

export interface Label {
  label: string
  language?: string
}

export type ResolvedBody =
  | { kind: 'text'; value: string; language?: string }
  | { kind: 'sound' | 'image' | 'video'; url: string; format: string }

/** Where a story is: a time range of a recording in a project, or the story that a reply answers. */
export type Place =
  { recordingIri: string; projectIri: string; start: number; end: number } | { parentIri: string }

export interface StoryParts {
  iri: string
  created: string
  modified: string
  creator: { iri: string; nickname: string }
  rights?: string
  bodies: ResolvedBody[]
  /** Always empty for a reply. */
  tags: (Label & { iri: ConceptIri })[]
  place: Place
}

/** Round seconds to milliseconds, the precision of the time range. */
export function roundSeconds(seconds: number): number {
  return Number(seconds.toFixed(3))
}

export function storyIri(origin: string, project: string, recording: string, id: string): string {
  return `${origin}/stories/${project}/${recording}/${id}`
}

export function buildAnnotation(parts: StoryParts): Annotation {
  const body = [
    ...parts.bodies.map((item) =>
      item.kind === 'text'
        ? textBody(item.value, item.language)
        : mediaBody(item.url, MEDIA_TYPES[item.kind], item.format),
    ),
    ...parts.tags.flatMap((tag) => [tagResource(tag.iri), tagLabel(tag.label, tag.language)]),
  ]
  const { place } = parts
  if ('parentIri' in place) {
    return annotation(parts.iri, 'replying', parts, body, place.parentIri)
  }
  const range = `t=${roundSeconds(place.start)},${roundSeconds(place.end)}`
  return annotation(
    parts.iri,
    'commenting',
    parts,
    body,
    target(place.recordingIri, place.projectIri, range),
  )
}

interface Meta {
  created: string
  modified: string
  creator: { iri: string; nickname: string }
  rights?: string
}

/** The canonical key order of every story and reply. */
function annotation(
  id: string,
  motivation: 'replying',
  meta: Meta,
  body: Annotation['body'],
  goal: string,
): ReplyAnnotation
function annotation(
  id: string,
  motivation: 'commenting',
  meta: Meta,
  body: Annotation['body'],
  goal: StoryAnnotation['target'],
): StoryAnnotation
function annotation(
  id: string,
  motivation: Annotation['motivation'],
  meta: Meta,
  body: Annotation['body'],
  goal: StoryAnnotation['target'] | string,
): Annotation {
  return {
    '@context': ANNO,
    id,
    type: 'Annotation',
    motivation,
    created: meta.created,
    modified: meta.modified,
    creator: { id: meta.creator.iri, type: 'Person', nickname: meta.creator.nickname },
    ...(meta.rights ? { rights: meta.rights } : {}),
    body,
    target: goal,
  } as Annotation
}

/**
 * Parse a stored story or reply of this origin. Returns null if the value is not in the
 * shape that `buildAnnotation` makes: content bodies first, then tag pairs (a reply has none).
 */
export function parseStory(value: unknown, origin: string): ParsedStory | null {
  if (!isObject(value)) return null
  const { creator, target: t, body } = value
  if (value['@context'] !== ANNO || value.type !== 'Annotation') return null
  if (!isText(value.id) || !isText(value.created) || !isText(value.modified)) return null
  if (value.rights !== undefined && !isText(value.rights)) return null
  if (!isObject(creator) || creator.type !== 'Person' || !isText(creator.nickname)) return null
  const memberId = suffix(creator.id, `${origin}/members/`)
  if (!memberId) return null
  const bodies = parseBodies(body)
  if (!bodies) return null
  const meta = {
    created: value.created,
    modified: value.modified,
    creator: { iri: creator.id as string, nickname: creator.nickname },
    ...(value.rights !== undefined ? { rights: value.rights as string } : {}),
  }

  if (value.motivation === 'replying') {
    const parent = isText(t) ? parseStoryIri(t, origin) : null
    if (!parent || bodies.some((item) => 'purpose' in item)) return null
    const id = suffix(value.id, `${origin}/stories/${parent.project}/${parent.recording}/`)
    if (!id || id === parent.id) return null
    return {
      id,
      project: parent.project,
      recording: parent.recording,
      memberId,
      replyTo: parent.id,
      start: null,
      end: null,
      annotation: annotation(value.id, 'replying', meta, bodies, t as string),
    }
  }
  if (value.motivation !== 'commenting') return null

  if (!isObject(t) || t.type !== 'SpecificResource' || !isObject(t.selector)) return null
  if (t.selector.type !== 'FragmentSelector' || t.selector.conformsTo !== MEDIA_FRAGS) return null
  const range = isText(t.selector.value) ? SELECTOR.exec(t.selector.value) : null
  const recording = suffix(t.source, `${origin}/recordings/`)
  const project = suffix(t.scope, `${origin}/projects/`)
  if (!range || !recording || !project) return null
  const id = suffix(value.id, `${origin}/stories/${project}/${recording}/`)
  if (!id) return null

  return {
    id,
    project,
    recording,
    memberId,
    replyTo: null,
    start: Number(range[1]),
    end: Number(range[2]),
    annotation: annotation(
      value.id,
      'commenting',
      meta,
      bodies,
      target(t.source as string, t.scope as string, t.selector.value as string),
    ),
  }
}

/** The instance and the id of a story IRI of this origin, or null. */
function parseStoryIri(
  iri: string,
  origin: string,
): { project: ProjectSlug; recording: RecordingId; id: StoryId } | null {
  const path = iri.startsWith(`${origin}/stories/`) ? iri.slice(`${origin}/stories/`.length) : ''
  const [project, recording, id, ...rest] = path.split('/')
  if (rest.length > 0 || ![project, recording, id].every((part) => SEGMENT.test(part ?? ''))) {
    return null
  }
  return { project, recording, id }
}

/** The concept IRIs of the tags, in order. */
export function tagsOf(annotation: Annotation): ConceptIri[] {
  return annotation.body.flatMap((body) => (body.type === 'SpecificResource' ? [body.source] : []))
}

/**
 * Give each tag its current label. A tag whose concept no longer exists
 * (label null) leaves the story.
 */
export function relabel<A extends Annotation>(
  annotation: A,
  labels: Map<ConceptIri, Label | null>,
): A {
  const body: Annotation['body'] = []
  for (let i = 0; i < annotation.body.length; i++) {
    const item = annotation.body[i]
    if (item.type !== 'SpecificResource') {
      body.push(item)
      continue
    }
    const current = labels.get(item.source)
    if (current) body.push(item, tagLabel(current.label, current.language))
    i++ // skip the stored label of this tag
  }
  return { ...annotation, body }
}

/**
 * The input that refills the Annotate form. A media body gives its `MediaId`. A media
 * body whose URL is not a body URL of this origin (only the admin path can store one)
 * has no `MediaId`, so it is not in the input.
 */
export function toInput(
  annotation: Annotation,
  origin: string,
): { bodies: BodyInput[]; tags: ConceptIri[] } {
  const bodies: BodyInput[] = []
  for (const body of annotation.body) {
    if (body.type === 'TextualBody' && !('purpose' in body)) {
      bodies.push({ kind: 'text', value: body.value, ...lang(body.language) })
    } else if ('id' in body) {
      const media = mediaIdOf(origin, body.id)
      if (media) bodies.push({ kind: MEDIA_KINDS[body.type], media })
    }
  }
  return { bodies, tags: tagsOf(annotation) }
}

/** Give each media body the format that `formatOf` gives for its URL. */
export function withMediaFormats<A extends Annotation>(
  annotation: A,
  formatOf: (url: string) => string,
): A {
  return {
    ...annotation,
    body: annotation.body.map((body) =>
      'id' in body ? mediaBody(body.id, body.type, formatOf(body.id)) : body,
    ),
  }
}

/** The text bodies, in order. */
export function textsOf(annotation: Annotation): TextualBody[] {
  return annotation.body.filter(
    (body): body is TextualBody => body.type === 'TextualBody' && !('purpose' in body),
  )
}

/** The first 80 characters of the first text body, on one line. */
export function excerptOf(annotation: Annotation): string {
  const text = (textsOf(annotation)[0]?.value ?? '').replace(/\s+/g, ' ').trim()
  const chars = [...text]
  return chars.length > EXCERPT ? `${chars.slice(0, EXCERPT - 1).join('')}…` : text
}

/** The URLs of the sound, image and video bodies. */
export function mediaUrls(annotation: Annotation): string[] {
  return annotation.body.flatMap((body) => ('id' in body ? [body.id] : []))
}

/** The annotation without `@context`, as an item of a page. */
export function asItem(
  annotation: Annotation,
): Omit<StoryAnnotation, '@context'> | Omit<ReplyAnnotation, '@context'> {
  const { '@context': _context, ...item } = annotation
  return item
}

function parseBodies(value: unknown): Annotation['body'] | null {
  if (!Array.isArray(value)) return null
  const out: Annotation['body'] = []
  let inTags = false
  for (let i = 0; i < value.length; i++) {
    const body: unknown = value[i]
    if (!isObject(body)) return null
    if (body.type === 'SpecificResource') {
      const label: unknown = value[i + 1]
      if (body.purpose !== 'tagging' || !isText(body.source)) return null
      if (!isObject(label) || label.type !== 'TextualBody' || label.purpose !== 'tagging') {
        return null
      }
      if (!isText(label.value) || !isOptionalText(label.language)) return null
      out.push(tagResource(body.source), tagLabel(label.value, label.language))
      inTags = true
      i++
    } else if (inTags) {
      return null
    } else if (body.type === 'TextualBody') {
      if (body.format !== 'text/plain' || body.purpose !== undefined) return null
      if (!isText(body.value) || !isOptionalText(body.language)) return null
      out.push(textBody(body.value, body.language))
    } else if (body.type === 'Sound' || body.type === 'Image' || body.type === 'Video') {
      if (!isText(body.id) || !isText(body.format)) return null
      out.push(mediaBody(body.id, body.type, body.format))
    } else {
      return null
    }
  }
  return out
}

function textBody(value: string, language?: string): TextualBody {
  return { type: 'TextualBody', value, format: 'text/plain', ...lang(language) }
}

function mediaBody(id: string, type: MediaResource['type'], format: string): MediaResource {
  return { id, type, format }
}

function tagResource(source: ConceptIri): TagResource {
  return { type: 'SpecificResource', source, purpose: 'tagging' }
}

function tagLabel(value: string, language?: string): TagLabel {
  return { type: 'TextualBody', value, purpose: 'tagging', ...lang(language) }
}

function target(source: string, scope: string, value: string): StoryAnnotation['target'] {
  return {
    type: 'SpecificResource',
    source,
    scope,
    selector: { type: 'FragmentSelector', conformsTo: MEDIA_FRAGS, value },
  }
}

function lang(language: string | undefined): { language?: string } {
  return language ? { language } : {}
}

function suffix(value: unknown, prefix: string): string | null {
  if (!isText(value) || !value.startsWith(prefix)) return null
  const rest = value.slice(prefix.length)
  return SEGMENT.test(rest) ? rest : null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isOptionalText(value: unknown): value is string | undefined {
  return value === undefined || isText(value)
}
