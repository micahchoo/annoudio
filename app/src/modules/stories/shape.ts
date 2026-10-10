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
  ResolvedValue,
  StoryId,
  TextualBody,
  ValueBody,
  ValueObject,
} from './types'

const ANNO = 'http://www.w3.org/ns/anno.jsonld'
const MEDIA_FRAGS = 'http://www.w3.org/TR/media-frags/'
const MEDIA_TYPES = { sound: 'Sound', image: 'Image', video: 'Video' } as const
const MEDIA_KINDS = { Sound: 'sound', Image: 'image', Video: 'video' } as const
const SELECTOR = /^t=(\d+(?:\.\d{1,3})?),(\d+(?:\.\d{1,3})?)$/
const SEGMENT = /^[^/?#]+$/
const XSD = 'http://www.w3.org/2001/XMLSchema#'
const VALUE_TYPE = ['TextualBody', 'rdf:Statement'] as const
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
  /** In field order. Always empty for a reply. */
  values: ResolvedValue[]
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
  const contents = parts.bodies.map((item) =>
    item.kind === 'text'
      ? textBody(item.value, item.language)
      : mediaBody(item.url, MEDIA_TYPES[item.kind], item.format),
  )
  const { place } = parts
  if ('parentIri' in place) {
    return annotation(parts.iri, 'replying', parts, contents, place.parentIri)
  }
  const range = `t=${roundSeconds(place.start)},${roundSeconds(place.end)}`
  // The statements are about the segment: the same part that the selector selects.
  const segment = `${place.recordingIri}#${range}`
  const body = [...contents, ...parts.values.map((value) => valueBody(segment, value))]
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
 * shape that `buildAnnotation` makes: content bodies first, then value bodies about the
 * segment of the story (a reply has none).
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
    if (!parent || bodies.some(isValueBody)) return null
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
  const segment = `${t.source as string}#${t.selector.value as string}`
  if (bodies.some((body) => isValueBody(body) && body['rdf:subject'].id !== segment)) return null

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

export function isValueBody(body: Annotation['body'][number]): body is ValueBody {
  return Array.isArray(body.type)
}

/** The values of a story, in order, as statements without their subject. */
export function valuesOf(annotation: Annotation): ResolvedValue[] {
  return annotation.body.filter(isValueBody).map(resolvedOf)
}

/** The item and entity IRIs that the values point at (not links, not own answers). */
export function itemIrisOf(annotation: Annotation): ConceptIri[] {
  return annotation.body.flatMap((body) =>
    isValueBody(body) && 'id' in body['rdf:object'] ? [body['rdf:object'].id] : [],
  )
}

/**
 * Give each value that points at an item its current label. An IRI that is not an item
 * (a link, or an item that no longer exists: null) keeps the stored text.
 */
export function relabel<A extends Annotation>(
  annotation: A,
  labels: Map<ConceptIri, Label | null>,
): A {
  return {
    ...annotation,
    body: annotation.body.map((body) => {
      if (!isValueBody(body) || !('id' in body['rdf:object'])) return body
      const current = labels.get(body['rdf:object'].id)
      if (!current) return body
      return {
        type: body.type,
        purpose: body.purpose,
        value: current.label,
        ...lang(current.language),
        'rdf:subject': body['rdf:subject'],
        'rdf:predicate': body['rdf:predicate'],
        'rdf:object': body['rdf:object'],
      }
    }),
  }
}

/**
 * The input that refills the Annotate form. A media body gives its `MediaId`. A media
 * body whose URL is not a body URL of this origin (only the admin path can store one)
 * has no `MediaId`, so it is not in the input.
 */
export function toInput(
  annotation: Annotation,
  origin: string,
): { bodies: BodyInput[]; values: ResolvedValue[] } {
  const bodies: BodyInput[] = []
  for (const body of annotation.body) {
    if (isValueBody(body)) continue
    if (body.type === 'TextualBody') {
      bodies.push({ kind: 'text', value: body.value, ...lang(body.language) })
    } else {
      const media = mediaIdOf(origin, body.id)
      if (media) bodies.push({ kind: MEDIA_KINDS[body.type], media })
    }
  }
  return { bodies, values: valuesOf(annotation) }
}

/** Give each media body the format that `formatOf` gives for its URL. */
export function withMediaFormats<A extends Annotation>(
  annotation: A,
  formatOf: (url: string) => string,
): A {
  return {
    ...annotation,
    body: annotation.body.map((body) =>
      !isValueBody(body) && 'id' in body ? mediaBody(body.id, body.type, formatOf(body.id)) : body,
    ),
  }
}

/** The text bodies, in order. */
export function textsOf(annotation: Annotation): TextualBody[] {
  return annotation.body.filter((body): body is TextualBody => body.type === 'TextualBody')
}

/** The first 80 characters of the first text body, on one line. */
export function excerptOf(annotation: Annotation): string {
  const text = (textsOf(annotation)[0]?.value ?? '').replace(/\s+/g, ' ').trim()
  const chars = [...text]
  return chars.length > EXCERPT ? `${chars.slice(0, EXCERPT - 1).join('')}…` : text
}

/** The URLs of the sound, image and video bodies. */
export function mediaUrls(annotation: Annotation): string[] {
  return annotation.body.flatMap((body) => (!isValueBody(body) && 'id' in body ? [body.id] : []))
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
  let inValues = false
  for (const body of value as unknown[]) {
    if (!isObject(body)) return null
    if (Array.isArray(body.type)) {
      // A value body (design/vocab.md §3.2): all three `rdf:` keys, or the record is refused.
      const parsed = parseValueBody(body)
      if (!parsed) return null
      out.push(parsed)
      inValues = true
    } else if (inValues) {
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

function parseValueBody(body: Record<string, unknown>): ValueBody | null {
  const type = body.type as unknown[]
  if (type.length !== 2 || type[0] !== VALUE_TYPE[0] || type[1] !== VALUE_TYPE[1]) return null
  if (body.purpose !== 'tagging' && body.purpose !== 'describing') return null
  if (!isText(body.value) || !isOptionalText(body.language)) return null
  const subject = idObject(body['rdf:subject'])
  const predicate = idObject(body['rdf:predicate'])
  const object = valueObject(body['rdf:object'])
  if (!subject || !predicate || !/^https?:\/\//.test(predicate) || !object) return null
  return {
    type: [...VALUE_TYPE],
    purpose: body.purpose,
    value: body.value,
    ...lang(body.language),
    'rdf:subject': { id: subject },
    'rdf:predicate': { id: predicate },
    'rdf:object': object,
  }
}

/** The IRI of `{ "id": … }`, or null. */
function idObject(value: unknown): string | null {
  return isObject(value) && Object.keys(value).length === 1 && isText(value.id) ? value.id : null
}

function literalOf(value: unknown): { '@value': string; '@language'?: string } | null {
  if (!isObject(value) || typeof value['@value'] !== 'string') return null
  const keys = Object.keys(value)
  if (keys.some((key) => key !== '@value' && key !== '@language')) return null
  if (!isOptionalText(value['@language'])) return null
  return { '@value': value['@value'], ...langTag(value['@language']) }
}

function valueObject(value: unknown): ValueObject | null {
  if (!isObject(value)) return null
  const iri = idObject(value)
  if (iri) return { id: iri }
  if (typeof value['@value'] === 'string' && isText(value.type)) {
    if (Object.keys(value).length !== 2) return null
    return { '@value': value['@value'], type: value.type }
  }
  if (typeof value['@value'] === 'string') return literalOf(value)
  // An own answer: a blank node with the class of the list and a label.
  const label = literalOf(value['rdfs:label'])
  if (isText(value.type) && label && Object.keys(value).length === 2) {
    return { type: value.type, 'rdfs:label': label }
  }
  return null
}

/** The value body of one value about `segment`, in the canonical key order. */
function valueBody(segment: string, value: ResolvedValue): ValueBody {
  const { object } = value
  let rdfObject: ValueObject
  if ('iri' in object) rdfObject = { id: object.iri }
  else if ('own' in object) {
    rdfObject = {
      type: object.own.class,
      'rdfs:label': { '@value': object.own.label, ...langTag(object.own.language) },
    }
  } else if (object.datatype) {
    // `anno.jsonld` defines `xsd:`: the only CURIE in a stored body (§3.2 rule 3).
    const type = object.datatype.startsWith(XSD)
      ? `xsd:${object.datatype.slice(XSD.length)}`
      : object.datatype
    rdfObject = { '@value': object.literal, type }
  } else rdfObject = { '@value': object.literal, ...langTag(object.language) }
  return {
    type: [...VALUE_TYPE],
    purpose: value.purpose,
    value: value.text,
    ...lang(value.language),
    'rdf:subject': { id: segment },
    'rdf:predicate': { id: value.property },
    'rdf:object': rdfObject,
  }
}

function resolvedOf(body: ValueBody): ResolvedValue {
  const object = body['rdf:object']
  const base = {
    property: body['rdf:predicate'].id,
    purpose: body.purpose,
    text: body.value,
    ...lang(body.language),
  }
  if ('id' in object) return { ...base, object: { iri: object.id } }
  if ('rdfs:label' in object) {
    const label = object['rdfs:label']
    return {
      ...base,
      object: {
        own: {
          label: label['@value'],
          ...(label['@language'] ? { language: label['@language'] } : {}),
          class: object.type,
        },
      },
    }
  }
  if ('type' in object) {
    const datatype = object.type.startsWith('xsd:') ? `${XSD}${object.type.slice(4)}` : object.type
    return { ...base, object: { literal: object['@value'], datatype } }
  }
  return {
    ...base,
    object: {
      literal: object['@value'],
      ...(object['@language'] ? { language: object['@language'] } : {}),
    },
  }
}

function textBody(value: string, language?: string): TextualBody {
  return { type: 'TextualBody', value, format: 'text/plain', ...lang(language) }
}

function mediaBody(id: string, type: MediaResource['type'], format: string): MediaResource {
  return { id, type, format }
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

function langTag(language: string | undefined): { '@language'?: string } {
  return language ? { '@language': language } : {}
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
