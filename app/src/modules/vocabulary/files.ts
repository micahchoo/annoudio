// Files for other systems (design/vocab.md §6, §3.4 layer 3): the questions of a project
// as SHACL or as an Omeka S resource template, and the vocabulary as RDF (`describe`).

import type { Quad } from 'n3'

import { bySlug } from '@/modules/projects'

import { conceptsOf } from './index'
import { ontologies } from './ontologies'
import { lists, profile, type Store } from './profile'
import { writeQuads } from './rdf'
import { shaclQuads } from './shacl'
import { schemeQuads } from './skos'
import { toOmeka } from './omeka'
import type { ProjectSlug } from './types'

export type ProfileFormat = 'shacl-turtle' | 'shacl-jsonld' | 'omeka'

export interface ExportedFile {
  filename: string
  contentType: string
  body: string
}

async function shapeOf(store: Store, slug: ProjectSlug) {
  const project = await bySlug({ payload: store.payload, origin: store.origin }, slug)
  const found = project ? await profile(store, slug) : null
  if (!project || !found) return null
  const own = `${store.origin}/vocab/${slug}/p/`
  const quads = shaclQuads(
    `${store.origin}/vocab/${slug}/profile`,
    `${project.label}: questions`,
    found.language,
    found.fields,
    found.fields
      .filter((field) => field.property.startsWith(own))
      .map((field) => ({
        iri: field.property,
        label: field.label,
        ...(field.help ? { comment: field.help } : {}),
      })),
  )
  return { project, fields: found.fields, quads }
}

export async function exportProfile(
  store: Store,
  slug: ProjectSlug,
  format: ProfileFormat,
): Promise<ExportedFile | null> {
  const shape = await shapeOf(store, slug)
  if (!shape) return null
  if (format === 'omeka') {
    const template = toOmeka(
      `${shape.project.label} stories`,
      shape.fields,
      await ontologies(store.payload),
    )
    return {
      filename: `${slug}-omeka-template.json`,
      contentType: 'application/json',
      body: JSON.stringify(template, null, 2),
    }
  }
  return format === 'shacl-turtle'
    ? {
        filename: `${slug}-questions.ttl`,
        contentType: 'text/turtle; charset=utf-8',
        body: writeQuads(shape.quads, 'turtle'),
      }
    : {
        filename: `${slug}-questions.jsonld`,
        contentType: 'application/ld+json',
        body: writeQuads(shape.quads, 'jsonld'),
      }
}

/** Layer 3 of the linked data export: the SHACL shape, own properties, lists and entities. */
export async function describe(store: Store, slug: ProjectSlug): Promise<Quad[]> {
  const shape = await shapeOf(store, slug)
  if (!shape) return []
  const out = [...shape.quads]
  const all = await conceptsOf({ payload: store.payload }, slug)
  for (const list of await lists(store, slug)) {
    out.push(
      ...schemeQuads({
        iri: list.iri,
        label: list.label,
        ...(list.kind === 'entities' && list.class ? { entities: { class: list.class } } : {}),
        concepts: all
          .filter((c) => c.list === list.key)
          .map(({ iri, label, language, parent, hidden, sameAs }) => ({
            iri,
            label,
            hidden,
            ...(language ? { language } : {}),
            ...(parent ? { parent } : {}),
            ...(sameAs ? { sameAs } : {}),
          })),
      }),
    )
  }
  return out
}
