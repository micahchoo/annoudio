'use server'

// The actions of the review screen (O5). Each one checks the operator first, acts through
// `stories` (so the mails go after the commit), and gives the next waiting story.

import { stories } from '@payload-config'

import { addSiteOrigin } from '@/modules/projects'

import { requestOperator } from '../operator'

export type ActionResult =
  | { ok: true; next: string | null }
  | { ok: false; error: 'forbidden' | 'not-found' | 'no-reason' | 'media-not-ready' }

type Act = (operator: { operatorId: string; name?: string }) => Promise<void>

async function act(id: string, run: Act): Promise<ActionResult> {
  const session = await requestOperator()
  if (!session) return { ok: false, error: 'forbidden' }
  try {
    await run(session.operator)
  } catch (error) {
    const { name, code } = error as { name?: string; code?: string }
    if (
      name === 'StoriesError' &&
      (code === 'not-found' || code === 'no-reason' || code === 'media-not-ready')
    ) {
      return { ok: false, error: code }
    }
    throw error
  }
  return { ok: true, next: await stories.nextWaiting(id) }
}

/** Publish (O5a): `stories.publish`. */
export async function publishStory(id: string): Promise<ActionResult> {
  return act(id, (operator) => stories.publish(operator, id))
}

/** Return to the member (O5b): `stories.reject` with the reason. */
export async function returnStory(id: string, reason: string): Promise<ActionResult> {
  return act(id, (operator) => stories.reject(operator, id, reason))
}

/** Remove (O5c): `stories.remove`, with its replies. */
export async function removeStory(id: string, reason: string): Promise<ActionResult> {
  return act(id, (operator) => stories.remove(operator, id, reason))
}

/**
 * "Add this website" (workflow-audit 7): the website of the page where a member told a
 * story goes on the website list of its project, so the next member comes back to it.
 */
export async function addWebsite(
  project: string,
  page: string,
): Promise<{ ok: true; host: string } | { ok: false }> {
  const session = await requestOperator()
  if (!session) return { ok: false }
  const result = await addSiteOrigin(
    { payload: session.payload, origin: process.env.ANNOUDIO_ORIGIN || '' },
    project,
    page,
  )
  return result.ok ? { ok: true, host: new URL(result.origin).host } : { ok: false }
}
