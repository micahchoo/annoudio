// The widgets of a project (design/rework-notes.md, decision 1): the recordings that an
// operator put on a site of the project, and the website list that "Add this website"
// grows. All through the `projects` interface.

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { register } from '@/modules/catalogue'
import { addRecording, addSiteOrigin, allProjects, bySlug, projectsOfRecording } from '@/modules/projects'
import config from '@/payload.config'

let payload: Payload
const site = () => ({ payload, origin: 'https://org.example' })
let ferry: string
let harvest: string

beforeAll(async () => {
  payload = await getPayload({ config })
})

beforeEach(async () => {
  const db = payload.db as unknown as PostgresAdapter
  await db.drizzle.execute(
    sql`truncate projects, recordings, recordings_other_urls restart identity cascade`,
  )
  await payload.create({
    collection: 'projects',
    data: { name: 'River Voices', slug: 'river-voices', siteOrigins: [{ origin: 'https://river.example' }] },
  })
  await payload.create({ collection: 'projects', data: { name: 'Hill Songs', slug: 'hill-songs' } })
  const made = await Promise.all(
    ['Ferry crossing, 1962', 'Harvest song'].map((title, i) =>
      register(site(), { title, url: `https://media.example/${i}.m4a`, length: 30 }),
    ),
  )
  ;[ferry, harvest] = made.map((r) => ('id' in r ? r.id : ''))
})

describe('the widgets of a project', () => {
  it('addRecording adds a recording once; projectsOfRecording finds the projects', async () => {
    expect(await addRecording(site(), 'river-voices', ferry)).toBe(true)
    expect(await addRecording(site(), 'river-voices', ferry)).toBe(true)
    expect(await addRecording(site(), 'hill-songs', ferry)).toBe(true)
    expect(await addRecording(site(), 'river-voices', harvest)).toBe(true)

    expect((await projectsOfRecording(site(), ferry)).map((p) => p.slug)).toEqual([
      'hill-songs',
      'river-voices',
    ])
    expect((await projectsOfRecording(site(), harvest)).map((p) => p.slug)).toEqual([
      'river-voices',
    ])
    const river = (await allProjects({ payload })).find((p) => p.slug === 'river-voices')!
    expect(river.recordings).toEqual([ferry, harvest])
  })

  it('refuses an unknown project or recording and changes nothing', async () => {
    expect(await addRecording(site(), 'no-such-project', ferry)).toBe(false)
    expect(await addRecording(site(), 'river-voices', '999')).toBe(false)
    expect(await projectsOfRecording(site(), ferry)).toEqual([])
  })

  it('a deleted recording leaves the list of its projects', async () => {
    await addRecording(site(), 'river-voices', ferry)
    await payload.delete({ collection: 'recordings', id: ferry })
    expect((await allProjects({ payload })).find((p) => p.slug === 'river-voices')!.recordings).toEqual(
      [],
    )
  })
})

describe('addSiteOrigin', () => {
  it('adds the origin of a page once, and keeps the other websites', async () => {
    expect(await addSiteOrigin(site(), 'river-voices', 'http://localhost:8091/?pagename=demo')).toEqual({
      ok: true,
      origin: 'http://localhost:8091',
    })
    await addSiteOrigin(site(), 'river-voices', 'http://localhost:8091/other')
    expect((await bySlug(site(), 'river-voices'))!.siteOrigins).toEqual([
      'https://river.example',
      'http://localhost:8091',
    ])
  })

  it('refuses a value that is not a web page, and an unknown project', async () => {
    expect(await addSiteOrigin(site(), 'river-voices', 'javascript:alert(1)')).toEqual({ ok: false })
    expect(await addSiteOrigin(site(), 'no-such-project', 'https://x.example')).toEqual({ ok: false })
    expect((await bySlug(site(), 'river-voices'))!.siteOrigins).toEqual(['https://river.example'])
  })
})
