// The delete of a project or a recording (closing pass, bug from design/phase6b-notes.md):
// with stories or replies in any review state, the delete is refused with a plain line;
// with none, the delete also takes away what the read routes serve, so reads give 404.

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { DraftInput, Stories } from '@/modules/stories'

import {
  CONTAINER,
  PROJECT,
  draft,
  leela,
  makeStories,
  operator,
  publishDraft,
  ravi,
  read,
  seed,
  startPayload,
  storyId,
} from '../stories/world'

let payload: Payload
let stories: Stories
let river: number

beforeAll(async () => {
  payload = await startPayload()
})

beforeEach(async () => {
  await seed(payload)
  stories = makeStories(payload)
  const { docs } = await payload.find({
    collection: 'projects',
    where: { slug: { equals: PROJECT } },
    depth: 0,
  })
  river = docs[0].id
})

const reply = (n: number): DraftInput => ({
  id: storyId(n),
  project: PROJECT,
  recording: '1',
  replyTo: storyId(1),
  bodies: [{ kind: 'text', value: `Reply number ${n}.` }],
})

/** A published story and a reply that waits for review, on recording 1 of river-voices. */
async function thread() {
  await publishDraft(stories, draft())
  const saved = await stories.saveDraft(ravi, reply(2))
  if (!saved.ok) throw new Error(JSON.stringify(saved.error))
}

const deleteProject = () => payload.delete({ collection: 'projects', id: river })
const deleteRecording = () => payload.delete({ collection: 'recordings', id: 1 })
const status = async (path: string) => (await read(stories, path)).status

describe('the delete of a project', () => {
  it('is refused while the project has stories or replies, and the stories stay served', async () => {
    await thread()
    await expect(deleteProject()).rejects.toThrow(
      'This project has 1 story and 1 reply. Remove its 1 story first.',
    )
    expect(await payload.count({ collection: 'projects' })).toMatchObject({ totalDocs: 2 })
    expect(await status(`${CONTAINER}${storyId(1)}`)).toBe(200)
  })

  it('counts a story that is only a draft', async () => {
    const saved = await stories.saveDraft(leela, draft())
    expect(saved.ok).toBe(true)
    await expect(deleteProject()).rejects.toThrow(
      'This project has 1 story. Remove its 1 story first.',
    )
  })

  it('goes through after the operator removes the stories; then every read gives 404', async () => {
    await thread()
    await stories.remove(operator, storyId(1))
    await deleteProject()
    expect(await status(CONTAINER)).toBe(404)
    expect(await status(`${CONTAINER}?page=0`)).toBe(404)
    expect(await status(`${CONTAINER}${storyId(1)}`)).toBe(404)
  })

  it('takes away served stories whose rows went outside the app (the Phase 6b case)', async () => {
    await publishDraft(stories, draft())
    const db = payload.db as unknown as PostgresAdapter
    await db.drizzle.execute(sql`truncate stories, _stories_v cascade`)
    // The representations are still there: the read serves the story.
    expect(await status(`${CONTAINER}${storyId(1)}`)).toBe(200)
    await deleteProject()
    expect(await status(`${CONTAINER}${storyId(1)}`)).toBe(404)
    expect(await status(CONTAINER)).toBe(404)
  })

  it('takes its vocabulary with it, also narrower concepts, and leaves the other vocabulary', async () => {
    const transport = await payload.create({
      collection: 'concepts',
      // The hook mints the IRI.
      data: { project: river, label: 'Transport' } as never,
    })
    await payload.create({
      collection: 'concepts',
      data: { project: river, label: 'Raft', parent: transport.id } as never,
    })
    await deleteProject()
    const { docs } = await payload.find({ collection: 'concepts', depth: 0 })
    expect(docs.map((doc) => doc.label)).toEqual(['Goat'])
  })

  it('leaves the stories of the other project served', async () => {
    await publishDraft(stories, draft({ project: 'hill-songs', tags: [] }))
    await deleteProject()
    expect(await status(`/stories/hill-songs/1/${storyId(1)}`)).toBe(200)
  })
})

describe('the delete of a recording', () => {
  it('is refused while the recording has stories or replies', async () => {
    await thread()
    await expect(deleteRecording()).rejects.toThrow(
      'This recording has 1 story and 1 reply. Remove its 1 story first.',
    )
    expect(await status(`${CONTAINER}${storyId(1)}`)).toBe(200)
  })

  it('goes through after the operator removes the stories; then every read gives 404', async () => {
    await thread()
    await stories.remove(operator, storyId(1))
    await deleteRecording()
    expect(await status(CONTAINER)).toBe(404)
    expect(await status(`${CONTAINER}${storyId(1)}`)).toBe(404)
  })

  it('leaves the stories of the other recording served', async () => {
    await publishDraft(stories, draft({ recording: '2' }))
    await deleteRecording()
    expect(await status(`/stories/${PROJECT}/2/${storyId(1)}`)).toBe(200)
  })
})
