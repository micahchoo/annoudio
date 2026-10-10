// The theme JSON of a project (CONTRACT.md §3.2, §5.1), through `theme` and `handleTheme`,
// and the recording JSON (§5.2) through `catalogue.handleRecording`.

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { handleRecording } from '@/modules/catalogue'
import { handleTheme, theme } from '@/modules/projects'
import config from '@/payload.config'

let payload: Payload
let projectId: number | string

const get = (file: string, headers: Record<string, string> = {}, method = 'GET') =>
  handleTheme(
    { payload },
    new Request(`https://org.example/embed/v1/themes/${file}`, { method, headers }),
    file,
  )

beforeAll(async () => {
  payload = await getPayload({ config })
})

beforeEach(async () => {
  const db = payload.db as unknown as PostgresAdapter
  await db.drizzle.execute(
    sql`truncate projects, recordings, recordings_other_urls restart identity cascade`,
  )
  const project = await payload.create({
    collection: 'projects',
    data: {
      name: 'River Voices',
      slug: 'river-voices',
      rights: 'cc-by-4.0',
      themeTokens: {
        radius: ' 0px ',
        colorAccent: '#8a1c2b',
        colorText: '',
        fontFamily: '"Noto Sans Malayalam", sans-serif',
      },
    },
  })
  projectId = project.id
  await payload.create({ collection: 'projects', data: { name: 'Hill Songs', slug: 'hill-songs' } })
})

describe('theme', () => {
  it('has the field labels of the project when the route gives them, in field order', async () => {
    const fields = [
      {
        property: 'http://purl.org/dc/terms/title',
        label: 'Short title',
        showAs: 'line' as const,
        valueType: 'text',
      },
      {
        property: 'http://purl.org/dc/terms/subject',
        label: 'Topics',
        showAs: 'tags' as const,
        valueType: 'list',
      },
    ]
    let labels = fields
    const withLabels = (file: string) =>
      handleTheme(
        { payload, labels: async () => labels },
        new Request(`https://org.example/embed/v1/themes/${file}`),
        file,
      )
    const first = await withLabels('river-voices.json')
    expect((await first.json()).fields).toEqual(fields)
    // A relabel changes the JSON and its ETag: hosts get it within the cache time.
    labels = [{ ...fields[0], label: 'Title' }, fields[1]]
    const second = await withLabels('river-voices.json')
    expect((await second.json()).fields[0].label).toBe('Title')
    expect(second.headers.get('ETag')).not.toBe(first.headers.get('ETag'))
    // No fields: no key.
    labels = []
    expect(await (await withLabels('river-voices.json')).json()).not.toHaveProperty('fields')
  })

  it('gives only the set tokens, trimmed, in the order of CONTRACT table 3.1', async () => {
    const json = await theme({ payload }, 'river-voices')
    expect(json).toEqual({
      tokens: {
        'color-accent': '#8a1c2b',
        'font-family': '"Noto Sans Malayalam", sans-serif',
        radius: '0px',
      },
      name: 'River Voices',
      rightsLine: 'Stories on this page are shared under CC BY 4.0.',
      rightsIri: 'https://creativecommons.org/licenses/by/4.0/',
    })
    expect(Object.keys(json!.tokens)).toEqual(['color-accent', 'font-family', 'radius'])
  })

  it('gives empty tokens for a project with no theme, and null for an unknown project', async () => {
    expect(await theme({ payload }, 'hill-songs')).toEqual({ tokens: {}, name: 'Hill Songs' })
    expect(await theme({ payload }, 'nope')).toBeNull()
  })

  it.each([
    ['colorAccent', 'red; background: url(x)'],
    ['colorAccent', '</style>'],
    ['radius', '10%'],
    ['radius', 'big'],
    ['fontFamily', 'serif; color: red'],
  ])('refuses %s = %s from the admin', async (field, value) => {
    await expect(
      payload.update({
        collection: 'projects',
        id: projectId,
        data: { themeTokens: { [field]: value } },
      }),
    ).rejects.toThrow()
  })

  it.each([
    ['colorAccent', 'oklch(60% 0.1 30)'],
    ['colorAccent', 'rebeccapurple'],
    ['colorRegion', '#d5e3f380'],
    ['timelineHeight', '4.5rem'],
    ['space', '0'],
  ])('accepts %s = %s', async (field, value) => {
    await payload.update({
      collection: 'projects',
      id: projectId,
      data: { themeTokens: { [field]: value } },
    })
    const json = await theme({ payload }, 'river-voices')
    expect(Object.values(json!.tokens)).toContain(value)
  })
})

describe('handleTheme', () => {
  it('answers 200 with the JSON, CORS, the cache rule and an ETag', async () => {
    const response = await get('river-voices.json')
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(
      JSON.stringify({
        tokens: {
          'color-accent': '#8a1c2b',
          'font-family': '"Noto Sans Malayalam", sans-serif',
          radius: '0px',
        },
        name: 'River Voices',
        rightsLine: 'Stories on this page are shared under CC BY 4.0.',
        rightsIri: 'https://creativecommons.org/licenses/by/4.0/',
      }),
    )
    expect(Object.fromEntries(response.headers)).toMatchObject({
      'access-control-allow-origin': '*',
      'cross-origin-resource-policy': 'cross-origin',
      'x-content-type-options': 'nosniff',
      'content-type': 'application/json',
      // Kept, but checked on each page load: a saved theme shows at the next load.
      'cache-control': 'public, no-cache',
      etag: expect.stringMatching(/^"[A-Za-z0-9_-]{43}"$/),
    })
  })

  it('gives 304 for the current ETag, and a new ETag after a change', async () => {
    const etag = (await get('river-voices.json')).headers.get('etag')!
    const again = await get('river-voices.json', { 'If-None-Match': etag })
    expect(again.status).toBe(304)
    expect(await again.text()).toBe('')

    await payload.update({
      collection: 'projects',
      id: projectId,
      data: { themeTokens: { colorAccent: '#004d40' } },
    })
    const changed = await get('river-voices.json', { 'If-None-Match': etag })
    expect(changed.status).toBe(200)
    expect(changed.headers.get('etag')).not.toBe(etag)
  })

  it.each([['nope.json'], ['river-voices'], ['River-Voices.json'], ['river-voices.css']])(
    'gives 404 with a 60 s cache rule for %s',
    async (file) => {
      const response = await get(file)
      expect(response.status).toBe(404)
      expect(response.headers.get('cache-control')).toBe('public, max-age=60')
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    },
  )

  it('answers HEAD with the headers and no body', async () => {
    const response = await get('river-voices.json', {}, 'HEAD')
    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBeTruthy()
    expect(await response.text()).toBe('')
  })
})

describe('handleRecording: GET /embed/v1/recordings/{project}/{id}.json', () => {
  const recordingJson = (project: string, file: string, headers: Record<string, string> = {}) =>
    handleRecording(
      { payload, origin: 'https://org.example' },
      new Request(`https://org.example/embed/v1/recordings/${project}/${file}`, { headers }),
      project,
      file,
    )

  beforeEach(async () => {
    await payload.create({
      collection: 'recordings',
      data: {
        title: 'Ferry crossing, 1962',
        url: 'https://media.example/ferry.m4a',
        duration: 1834,
      },
    })
    await payload.create({
      collection: 'recordings',
      data: { title: 'Harvest song', url: 'https://media.example/harvest.mp3' },
    })
  })

  it('answers 200 with id, title, url and duration, CORS and the cache rule of the theme', async () => {
    const response = await recordingJson('river-voices', '1.json')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      id: '1',
      title: 'Ferry crossing, 1962',
      url: 'https://media.example/ferry.m4a',
      duration: 1834,
    })
    expect(Object.fromEntries(response.headers)).toMatchObject({
      'access-control-allow-origin': '*',
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300, stale-while-revalidate=86400',
      etag: expect.stringMatching(/^"[A-Za-z0-9_-]{43}"$/),
    })
    const etag = response.headers.get('etag')!
    expect((await recordingJson('river-voices', '1.json', { 'If-None-Match': etag })).status).toBe(
      304,
    )
  })

  it('gives null for an unknown duration; any project of the stack serves any recording', async () => {
    expect(await (await recordingJson('hill-songs', '2.json')).json()).toMatchObject({
      id: '2',
      duration: null,
    })
  })

  it.each([
    ['nope', '1.json'],
    ['river-voices', '9.json'],
    ['river-voices', '1'],
    ['river-voices', '01.json'],
  ])('gives 404 with CORS and a 60 s cache rule for %s/%s', async (project, file) => {
    const response = await recordingJson(project, file)
    expect(response.status).toBe(404)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('cache-control')).toBe('public, max-age=60')
  })
})
