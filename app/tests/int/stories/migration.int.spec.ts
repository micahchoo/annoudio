// The data moves of the migration `vocab_profile` (design/vocab.md §4, slice 4), and the
// `story-values` rows behind `valueCounts`, `fieldUsage` and the field lock. The schema
// part of the migration runs on empty databases (design/vocab-build-notes.md); this test
// runs the data part on rows in both shapes.

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { valuesDown, valuesUp } from '@/migrations/20261009_211922_vocab_profile'
import { etagOf } from '@/modules/stories/etag'
import type { Stories } from '@/modules/stories'
import { createVocabulary, type Vocabulary } from '@/modules/vocabulary'

import {
  BOAT,
  FERRY,
  ORIGIN,
  PROJECT,
  SUBJECT,
  draft,
  leela,
  makeStories,
  operator,
  publishDraft,
  seed,
  startPayload,
  storyId,
  topic,
} from './world'

let payload: Payload
let stories: Stories
let vocabulary: Vocabulary
const instance = { project: PROJECT, recording: '1' }
const drizzle = () => (payload.db as unknown as PostgresAdapter).drizzle
const db = () => drizzle() as unknown as Parameters<typeof valuesUp>[0]

beforeAll(async () => {
  payload = await startPayload()
})

beforeEach(async () => {
  await seed(payload)
  stories = makeStories(payload)
  vocabulary = createVocabulary({ payload, origin: ORIGIN, stories: () => stories })
  // Story 1: published with Ferry and Boat, then a newer draft with Ferry only.
  // Story 2: a draft with Ferry. Story 3: published, no topics.
  await publishDraft(stories, draft({ id: storyId(1), values: [topic(FERRY), topic(BOAT)] }))
  const own = (await stories.ownDrafts(leela, instance)).find((s) => s.id === storyId(1))!
  await stories.saveDraft(leela, {
    ...draft({ id: storyId(1), values: [topic(FERRY)] }),
    ifMatch: own.etag,
  })
  await stories.saveDraft(leela, draft({ id: storyId(2), start: 1, end: 2 }))
  await publishDraft(stories, draft({ id: storyId(3), start: 3, end: 4, values: [] }))
})

/** Every stored record, every served row, in a fixed order. */
async function snapshot() {
  const { rows: main } = await drizzle().execute(sql`select id, wadm from stories order by id`)
  const { rows: versions } = await drizzle().execute(
    sql`select id, version_wadm as wadm from _stories_v order by id`,
  )
  const { rows: served } = await drizzle().execute<{ key: string; body: string; etag: string }>(
    sql`select key, body, etag from story_representations order by key`,
  )
  return { main, versions, served }
}

const bodiesOf = (rows: unknown[]) =>
  (rows as { wadm: { body: { type: unknown }[] } }[]).flatMap((row) => row.wadm.body)

/** The old `tagCounts`: tag pairs in the published and the newest version (Phase 5 SQL). */
async function oldTagCounts() {
  const { rows } = await drizzle().execute<{ tag: string; stories: string }>(sql`
    select tag, count(distinct story) as stories from (
      select s.id as story, b ->> 'source' as tag
        from stories s, jsonb_array_elements(s.wadm -> 'body') b
        where s.project = ${PROJECT} and b ->> 'type' = 'SpecificResource'
      union all
      select v.parent_id, b ->> 'source'
        from _stories_v v, jsonb_array_elements(v.version_wadm -> 'body') b
        where v.latest and v.version_project = ${PROJECT} and b ->> 'type' = 'SpecificResource'
    ) tags group by tag`)
  return Object.fromEntries(rows.map((row) => [row.tag, Number(row.stories)]))
}

/** Back to the state before the migration: tag pairs, no lists, no fields, no values. */
async function oldShape() {
  await valuesDown(db())
  await drizzle().execute(sql`delete from story_values`)
  await drizzle().execute(sql`delete from vocab_fields`)
  await drizzle().execute(sql`update concepts set list_id = null`)
  await drizzle().execute(sql`delete from vocab_lists`)
}

describe('the migration vocab_profile', () => {
  it('down gives tag pairs with the same concept IRIs, in stories and in the served bytes', async () => {
    await valuesDown(db())
    const after = await snapshot()
    const bodies = [...bodiesOf(after.main), ...bodiesOf(after.versions)]
    expect(bodies.some((b) => Array.isArray(b.type))).toBe(false)
    expect(bodies).toContainEqual({ type: 'SpecificResource', source: BOAT, purpose: 'tagging' })
    expect(bodies).toContainEqual({
      type: 'TextualBody',
      value: 'Ferry',
      purpose: 'tagging',
      language: 'en',
    })
    const story1 = after.served.find((row) => row.key.endsWith(`/story-${storyId(1)}`))!
    expect(JSON.parse(story1.body).body.slice(1)).toEqual([
      { type: 'SpecificResource', source: FERRY, purpose: 'tagging' },
      { type: 'TextualBody', value: 'Ferry', purpose: 'tagging', language: 'en' },
      { type: 'SpecificResource', source: BOAT, purpose: 'tagging' },
      { type: 'TextualBody', value: 'Boat', purpose: 'tagging', language: 'en' },
    ])
    for (const row of after.served) expect(row.etag).toBe(etagOf(row.body))
  })

  it('up on rows with tag pairs gives the value bodies, the served bytes and the ETags of this release', async () => {
    const before = await snapshot()
    await oldShape()
    const old = await oldTagCounts()
    expect(old).toEqual({ [FERRY]: 2, [BOAT]: 1 })

    await valuesUp(db())
    const after = await snapshot()
    expect(after.main).toEqual(before.main)
    expect(after.versions).toEqual(before.versions)
    expect(after.served).toEqual(before.served)
    // Counts from `story-values` match the old tag counts.
    expect(Object.fromEntries(await stories.valueCounts(PROJECT))).toEqual(old)
    expect(Object.fromEntries(await stories.fieldUsage(PROJECT))).toEqual({ [SUBJECT]: 2 })
    // The list Topics keeps the old scheme IRI; the field Topics asks for its items.
    const profile = await vocabulary.profile(PROJECT)
    expect(profile?.fields).toEqual([
      expect.objectContaining({
        property: SUBJECT,
        label: 'Topics',
        valueType: 'list',
        max: 10,
        showAs: 'tags',
        usage: 2,
        list: expect.objectContaining({
          key: 'topics',
          iri: `${ORIGIN}/vocab/${PROJECT}`,
          size: 2,
        }),
      }),
    ])
    // A second up changes nothing.
    await valuesUp(db())
    expect(await snapshot()).toEqual(after)
  })

  it('down refuses when a value is not an item of Topics, and changes nothing', async () => {
    await vocabulary.addField(operator, PROJECT, { from: 'catalogue', key: 'title' })
    await stories.saveDraft(
      leela,
      draft({
        id: storyId(4),
        start: 5,
        end: 6,
        values: [{ property: 'http://purl.org/dc/terms/title', text: 'Ferry song' }],
      }),
    )
    const before = await snapshot()
    await expect(valuesDown(db())).rejects.toThrow(/values are not items of Topics/)
    expect(await snapshot()).toEqual(before)
  })
})

describe('story-values', () => {
  it('follow each save, publish and removal; a used field and item refuse removal', async () => {
    expect(Object.fromEntries(await stories.valueCounts(PROJECT))).toEqual({
      [FERRY]: 2,
      [BOAT]: 1,
    })
    expect(await vocabulary.removeField(operator, PROJECT, SUBJECT)).toEqual({
      ok: false,
      error: 'field-in-use',
    })
    expect((await vocabulary.profile(PROJECT))?.fields[0].usage).toBe(2)
    const boat = await payload.find({ collection: 'concepts', where: { iri: { equals: BOAT } } })
    await expect(payload.delete({ collection: 'concepts', id: boat.docs[0].id })).rejects.toThrow(
      /1 story uses/,
    )
    // The published version of story 1 still has Boat; a publish of the newer draft drops it.
    await stories.publish(operator, storyId(1))
    expect(Object.fromEntries(await stories.valueCounts(PROJECT))).toEqual({ [FERRY]: 2 })
    await stories.remove(operator, storyId(2))
    await stories.remove(operator, storyId(1))
    expect((await stories.valueCounts(PROJECT)).size).toBe(0)
    expect((await stories.fieldUsage(PROJECT)).size).toBe(0)
    expect((await vocabulary.removeField(operator, PROJECT, SUBJECT)).ok).toBe(true)
  })
})
