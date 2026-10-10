'use server'

// The actions of "Add a widget to a site". They call the same `catalogue` and
// `projects` functions as the collections; each checks the operator first.

import { recording, register, snippet } from '@/modules/catalogue'
import { addRecording as addWidgetRecording, create } from '@/modules/projects'

import { requestOperator } from '../operator'

const origin = () => process.env.ANNOUDIO_ORIGIN || ''

type Failure = { ok: false; field?: string; message: string }

/** Step 1, a new recording. `length` is the probe of the operator's browser, if it played. */
export async function addRecording(input: {
  title: string
  url: string
  length: number | null
}): Promise<{ ok: true; recording: { id: string; title: string; url: string } } | Failure> {
  const session = await requestOperator()
  if (!session) return { ok: false, message: 'Sign in again.' }
  const result = await register({ payload: session.payload, origin: origin() }, input)
  if ('error' in result) return { ok: false, field: result.error, message: result.message }
  return { ok: true, recording: { id: result.id, title: result.title, url: result.urls[0] } }
}

/** Step 2, with a new project for the site. */
export async function addProject(input: {
  name: string
  website: string
}): Promise<
  { ok: true; project: { slug: string; label: string; siteOrigins: string[] } } | Failure
> {
  const session = await requestOperator()
  if (!session) return { ok: false, message: 'Sign in again.' }
  const result = await create({ payload: session.payload, origin: origin() }, input)
  if ('error' in result) return { ok: false, field: result.error, message: result.message }
  return {
    ok: true,
    project: { slug: result.slug, label: result.label, siteOrigins: result.siteOrigins },
  }
}

/**
 * Step 3: the recording becomes a widget of the project (`projects.recordings`), and the
 * two lines of CONTRACT.md §1 for it.
 */
export async function snippetFor(project: string, recordingId: string): Promise<string | null> {
  const session = await requestOperator()
  if (!session) return null
  const site = { payload: session.payload, origin: origin() }
  const found = await recording(site, recordingId)
  if (!found || !(await addWidgetRecording(site, project, found.id))) return null
  return snippet(origin(), { project, recording: found.id, src: found.urls[0] })
}
