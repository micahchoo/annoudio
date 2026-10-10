// The `catalogue` module (Phase 5): the audio address check, the recording lookup, the
// stories column of the admin list, and the snippet of CONTRACT.md §1. Phase 5c: `register`,
// `list` and `projects.create` of "Put a recording on a site", and `stories.projectReach`.

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { list, recording, register as registerRecording, snippet } from '@/modules/catalogue'
import { allProjects, create as createProject } from '@/modules/projects'
import type { Stories } from '@/modules/stories'

import {
  ORIGIN,
  draft,
  makeStories,
  operator,
  publishDraft,
  seed,
  startPayload,
  storyId,
} from '../stories/world'

let payload: Payload
let stories: Stories

beforeAll(async () => {
  payload = await startPayload()
})

beforeEach(async () => {
  await seed(payload)
  stories = makeStories(payload)
})

const register = (url: string, otherUrls: string[] = []) =>
  payload.create({
    collection: 'recordings',
    data: {
      title: 'Fish market, 1978',
      url,
      otherUrls: otherUrls.map((u) => ({ url: u })),
      duration: 1834.2,
    },
  })

describe('recordings', () => {
  it('take an https address, or http on a loopback host only', async () => {
    for (const url of [
      'https://media.example/fish.m4a',
      'http://localhost:3000/fish.m4a',
      'http://127.0.0.1/a.mp3',
    ]) {
      await expect(register(url)).resolves.toMatchObject({ url })
    }
    for (const url of [
      'http://media.example/fish.m4a',
      'ftp://media.example/fish.m4a',
      'fish.m4a',
      'https://u:p@media.example/a.mp3',
    ]) {
      await expect(register(url)).rejects.toMatchObject({
        data: { errors: [expect.objectContaining({ path: 'url' })] },
      })
    }
    await expect(register('https://media.example/a.m4a', ['javascript:alert(1)'])).rejects.toThrow()
  })

  it('give the first address first, then the other formats, and the probed duration', async () => {
    const doc = await register('https://media.example/fish.m4a', ['https://media.example/fish.ogg'])
    expect(await recording({ payload, origin: ORIGIN }, String(doc.id))).toEqual({
      iri: `${ORIGIN}/recordings/${doc.id}`,
      id: String(doc.id),
      title: 'Fish market, 1978',
      urls: ['https://media.example/fish.m4a', 'https://media.example/fish.ogg'],
      duration: 1834.2,
    })
  })

  it('show operators the published stories, with the drafts that wait in brackets', async () => {
    await publishDraft(stories, draft({ id: storyId(1) }))
    await stories.saveDraft(
      { memberId: 'm-200', nickname: 'Ravi' },
      draft({ id: storyId(2), start: 1, end: 2 }),
    )
    const user = { collection: 'users', id: 1 } as never
    const asOperator = await payload.findByID({ collection: 'recordings', id: 1, user })
    expect(asOperator.stories).toBe('1 (1)')
    await stories.publish(operator, storyId(2))
    expect((await payload.findByID({ collection: 'recordings', id: 1, user })).stories).toBe('2')
    // Other readers get no count, so the module's own lookups make no extra query.
    expect((await payload.findByID({ collection: 'recordings', id: 1 })).stories).toBeNull()
  })
})

describe('snippet', () => {
  it('is the two lines of CONTRACT.md §1 with the values of the instance', async () => {
    // The tests run in the app folder.
    const contract = await readFile(path.resolve('..', 'CONTRACT.md'), 'utf8')
    const block = /## 1 The snippet[\s\S]*?```html\n([\s\S]*?)\n```/.exec(contract)![1]
    expect(block.split('\n')).toHaveLength(2)
    const expected = block
      .replace('https://ORG', ORIGIN)
      .replace('project="…"', 'project="river-voices"')
      .replace('recording="…"', 'recording="7"')
      .replaceAll('src="…"', 'src="https://media.example/fish.m4a"')
    expect(
      snippet(ORIGIN, {
        project: 'river-voices',
        recording: '7',
        src: 'https://media.example/fish.m4a',
      }),
    ).toBe(expected)
  })

  it('escapes the attribute values', () => {
    const text = snippet(ORIGIN, {
      project: 'p',
      recording: '1',
      src: 'https://m.example/a.mp3?x=1&y="2"',
    })
    expect(text).toContain('src="https://m.example/a.mp3?x=1&amp;y=&quot;2&quot;"')
  })
})

describe('Put a recording on a site: register, list, projects.create', () => {
  const site = () => ({ payload, origin: ORIGIN })

  it('register keeps the title, the address and the probed length; it refuses a bad address', async () => {
    const made = await registerRecording(site(), {
      title: '  Fish market, 1978 ',
      url: 'https://media.example/fish.m4a',
      length: 1834.4567,
    })
    expect(made).toMatchObject({
      title: 'Fish market, 1978',
      urls: ['https://media.example/fish.m4a'],
      duration: 1834.457,
    })
    expect(await registerRecording(site(), { title: '', url: 'https://x.example/a.m4a' })).toEqual({
      error: 'title',
      message: 'Type a title.',
    })
    expect(
      await registerRecording(site(), { title: 'A', url: 'ftp://x.example/a.m4a' }),
    ).toMatchObject({
      error: 'url',
    })
    // No length: a browser that cannot play the address still saves it.
    expect(
      await registerRecording(site(), { title: 'B', url: 'https://x.example/b.ogg', length: null }),
    ).not.toHaveProperty('duration')
  })

  it('list gives the recordings in title order', async () => {
    expect((await list(site())).map((r) => r.title)).toEqual([
      'Ferry crossing, 1962',
      'Harvest song',
    ])
  })

  it('projects.create makes a unique short name from the name, with the website address', async () => {
    const made = await createProject(site(), {
      name: 'River Voices',
      website: 'https://www.river.example/x',
    })
    expect(made).toMatchObject({
      slug: 'river-voices-2',
      label: 'River Voices',
      siteOrigins: ['https://www.river.example'],
    })
    expect(await createProject(site(), { name: 'Kochi', website: 'kochi' })).toMatchObject({
      error: 'website',
    })
    expect(await createProject(site(), { name: ' ', website: 'https://k.example' })).toMatchObject({
      error: 'name',
    })
    expect((await allProjects({ payload })).map((p) => p.slug).sort()).toEqual([
      'hill-songs',
      'river-voices',
      'river-voices-2',
    ])
  })

  it('stories.projectReach gives the recordings with stories and the members', async () => {
    await publishDraft(stories, draft({ id: storyId(1) }))
    await stories.saveDraft(
      { memberId: 'm-2', nickname: 'Ravi' },
      draft({ id: storyId(2), start: 1, end: 2 }),
    )
    await stories.saveDraft(
      { memberId: 'm-2', nickname: 'Ravi' },
      draft({ id: storyId(3), recording: '2', start: 1, end: 2 }),
    )
    expect(await stories.projectReach('river-voices')).toEqual({
      recordings: [
        { id: '1', stories: 2 },
        { id: '2', stories: 1 },
      ],
      members: 2,
    })
    expect(await stories.projectReach('hill-songs')).toEqual({ recordings: [], members: 0 })
  })
})
