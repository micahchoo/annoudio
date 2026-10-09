// The test world of the `stories` tests: the real Payload on the test database,
// seeded with two projects, two recordings and three concepts.

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'

import { createStories, type DraftInput, type Stories, type StoriesConfig } from '@/modules/stories'
import config from '@/payload.config'

export const ORIGIN = 'https://org.example'
export const PROJECT = 'river-voices'
export const CONTAINER = '/stories/river-voices/1/'
export const FERRY = `${ORIGIN}/vocab/river-voices/c/ferry`
export const BOAT = `${ORIGIN}/vocab/river-voices/c/boat`
export const GOAT = `${ORIGIN}/vocab/hill-songs/c/goat`
export const T0 = '2026-10-09T10:14:00.000Z'

export const leela = { memberId: 'm-118', nickname: 'Leela' }
export const ravi = { memberId: 'm-200', nickname: 'Ravi' }
export const operator = { operatorId: 'op-1' }

export function startPayload(): Promise<Payload> {
  return getPayload({ config })
}

/**
 * Delete every row, then seed. Recording 1 ("Ferry crossing, 1962") has a duration
 * of 120 seconds; recording 2 has no duration.
 */
export async function seed(payload: Payload): Promise<void> {
  const db = payload.db as unknown as PostgresAdapter
  await db.drizzle.execute(
    sql`truncate stories, _stories_v, story_representations, concepts, projects,
        recordings, recordings_other_urls restart identity cascade`,
  )
  const river = await payload.create({
    collection: 'projects',
    data: {
      name: 'River Voices',
      slug: PROJECT,
      rightsIri: 'https://creativecommons.org/licenses/by-nc/4.0/',
      language: 'ml',
    },
  })
  const hill = await payload.create({
    collection: 'projects',
    data: { name: 'Hill Songs', slug: 'hill-songs' },
  })
  await payload.create({
    collection: 'recordings',
    data: {
      title: 'Ferry crossing, 1962',
      url: 'https://media.example/ferry.mp3',
      duration: 120,
    },
  })
  await payload.create({
    collection: 'recordings',
    data: { title: 'Harvest song', url: 'https://media.example/harvest.mp3' },
  })
  const concepts = [
    { project: river.id, iri: FERRY, label: 'Ferry', language: 'en' },
    { project: river.id, iri: BOAT, label: 'Boat', language: 'en' },
    { project: hill.id, iri: GOAT, label: 'Goat', language: 'en' },
  ]
  for (const data of concepts) await payload.create({ collection: 'concepts', data })
}

/** A `Stories` instance with a fixed clock at T0, unless `options` say otherwise. */
export function makeStories(payload: Payload, options: Partial<StoriesConfig> = {}): Stories {
  return createStories({ payload, origin: ORIGIN, now: () => new Date(T0), ...options })
}

/** A clock that moves only when the test says so. */
export function manualClock(start = T0) {
  let time = Date.parse(start)
  return {
    now: () => new Date(time),
    advance: (seconds: number) => {
      time += seconds * 1000
    },
  }
}

export function read(stories: Stories, path: string, init?: RequestInit): Promise<Response> {
  return stories.handleRead(new Request(`${ORIGIN}${path}`, init))
}

export async function readJson(stories: Stories, path: string, init?: RequestInit) {
  const response = await read(stories, path, init)
  return response.json()
}

export function storyId(n: number): string {
  return `0192f3a4-0000-7000-8000-${String(n).padStart(12, '0')}`
}

export function draft(overrides: Partial<DraftInput> = {}): DraftInput {
  return {
    id: storyId(1),
    project: PROJECT,
    recording: '1',
    start: 42,
    end: 51,
    bodies: [{ kind: 'text', value: 'My grandmother sang this on the ferry.' }],
    tags: [FERRY],
    ...overrides,
  }
}

/** Save a draft and publish it. Fails the test if the save fails. */
export async function publishDraft(
  stories: Stories,
  input: DraftInput,
  session = leela,
): Promise<void> {
  const result = await stories.saveDraft(session, input)
  if (!result.ok) throw new Error(`saveDraft failed: ${JSON.stringify(result.error)}`)
  await stories.publish(operator, input.id)
}

type Pair = [stories: number, replies: number]

/**
 * The tallies of `counts` for `toMatchObject`, as [stories, replies]. A state that the
 * test does not name is [0, 0]. `oldestWaiting` is left out.
 */
export function tallies(given: {
  processing?: Pair
  waiting?: Pair
  returned?: Pair
  automatic?: number
  published?: Pair
}) {
  const tally = ([stories, replies]: Pair = [0, 0]) => ({ stories, replies })
  return {
    processing: tally(given.processing),
    waiting: tally(given.waiting),
    returned: { ...tally(given.returned), automatic: given.automatic ?? 0 },
    published: tally(given.published),
  }
}
