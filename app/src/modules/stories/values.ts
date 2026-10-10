// The values of each story as rows (design/vocab.md §9.1): `story-values`. Derived from
// the stored WADM and never edited. Two layers per story: `newest` (the newest version,
// draft or published) and `published` (what visitors see). The hooks of the stories
// collection write the rows with the `req` of the change, so they commit with the story.
// The counts per item and per field, the delete guards and the field lock read them.
//
// Raw SQL: the table `story_values` and its columns (`.claude/rules/stories-raw-sql.md`).

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { CollectionConfig, Payload, PayloadRequest } from 'payload'

import { dbOf } from './rebuild'
import { parseStory, valuesOf } from './shape'
import type { ProjectSlug } from './types'

export const STORY_VALUES = 'story-values' as const

const nobody = () => false

/** Hidden: nothing outside `stories` reads it, and nobody writes it by hand. */
export const storyValuesCollection: CollectionConfig = {
  slug: STORY_VALUES,
  admin: { hidden: true },
  graphQL: false,
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    // A foreign key: a delete or a truncate of stories takes the rows with it.
    { name: 'story', type: 'relationship', relationTo: 'stories', required: true, index: true },
    { name: 'project', type: 'text', required: true, index: true },
    { name: 'layer', type: 'select', required: true, options: ['newest', 'published'] },
    { name: 'property', type: 'text', required: true, index: true },
    // An item, an entity or a link. Empty for a literal and for an own answer.
    { name: 'objectIri', type: 'text', index: true },
    { name: 'literal', type: 'text' },
    { name: 'datatype', type: 'text' },
    { name: 'language', type: 'text' },
    { name: 'own', type: 'checkbox', defaultValue: false },
  ],
}

/**
 * Write the rows of one story again from its stored versions: the newest version and the
 * published one. With no newest version (the story is gone), the rows go.
 */
export async function writeValues(
  req: PayloadRequest,
  origin: string,
  story: { id: string; newest: unknown; published: unknown | null },
): Promise<void> {
  const db = await dbOf(req.payload, req)
  await db.execute(sql`delete from story_values where story_id = ${story.id}`)
  const rows: unknown[] = []
  for (const [layer, wadm] of [
    ['newest', story.newest],
    ['published', story.published],
  ] as const) {
    const parsed = wadm ? parseStory(wadm, origin) : null
    if (!parsed) continue
    for (const value of valuesOf(parsed.annotation)) {
      const { object } = value
      rows.push({
        layer,
        project: parsed.project,
        property: value.property,
        objectIri: 'iri' in object ? object.iri : null,
        literal: 'literal' in object ? object.literal : 'own' in object ? object.own.label : null,
        datatype: 'literal' in object ? (object.datatype ?? null) : null,
        language:
          'literal' in object
            ? (object.language ?? null)
            : 'own' in object
              ? (object.own.language ?? null)
              : null,
        own: 'own' in object,
      })
    }
  }
  if (rows.length === 0) return
  await db.execute(sql`
    insert into story_values (story_id, project, layer, property, object_iri, literal, datatype, language, own, updated_at, created_at)
      select ${story.id}, r.project, r.layer::enum_story_values_layer, r.property, r."objectIri",
             r.literal, r.datatype, r.language, r.own, now(), now()
        from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
          as r(layer text, project text, property text, "objectIri" text, literal text,
               datatype text, language text, own boolean)`)
}

/** Item or entity IRI → stories whose newest or published version points at it. */
export async function valueCountsOf(
  payload: Payload,
  project: ProjectSlug,
): Promise<Map<string, number>> {
  const db = (payload.db as unknown as PostgresAdapter).drizzle
  const { rows } = await db.execute<{ iri: string; stories: string }>(sql`
    select object_iri as iri, count(distinct story_id) as stories from story_values
      where project = ${project} and object_iri is not null and not own
      group by object_iri`)
  return new Map(rows.map((row) => [row.iri, Number(row.stories)]))
}

/** Property IRI → stories whose newest or published version has a value for it. */
export async function fieldUsageOf(
  payload: Payload,
  project: ProjectSlug,
): Promise<Map<string, number>> {
  const db = (payload.db as unknown as PostgresAdapter).drizzle
  const { rows } = await db.execute<{ property: string; stories: string }>(sql`
    select property, count(distinct story_id) as stories from story_values
      where project = ${project} group by property`)
  return new Map(rows.map((row) => [row.property, Number(row.stories)]))
}
