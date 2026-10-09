'use server'

// The form actions of the Annotate page. Each one reads the session again: a
// Server Action is a public POST endpoint.

import config, { media, membership, stories } from '@payload-config'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { parseClock } from '@/clock'
import type { MediaState } from '@/modules/media'
import type { BodyInput, SaveError } from '@/modules/stories'
import { bySlug, returnTarget } from '@/modules/projects'

import { UUID_V7, annotatePath, readLink, returnWithFragment, type AnnotateLink } from './link'
import { requestIp } from './request-ip'
import type { SaveState, SignInState } from './state'

/** A path of the member pages, or null: the only places where a sign-in goes. */
function memberPath(value: FormDataEntryValue | null): string | null {
  const path = typeof value === 'string' ? value : ''
  return /^\/annotate\/(mine|account)$/.test(path) ? path : null
}

export async function signIn(previous: SignInState, form: FormData): Promise<SignInState> {
  const link = readLink(form)
  const next = link ? annotatePath(link) : memberPath(form.get('next'))
  if (!next) return previous
  const intent = form.get('intent')
  const email = String(form.get('email') ?? '')
  const code = String(form.get('code') ?? '')

  if (intent === 'other-email') return { step: 'email', email: '' }
  if (intent === 'send') {
    const ip = requestIp(await headers(), Number(process.env.TRUST_PROXY ?? 0))
    const site = link ? (await projectOf(link))?.label : undefined
    const result = await membership.requestCode(email, { ip, site })
    return result.ok
      ? { step: 'code', email }
      : { step: previous.step === 'code' ? 'code' : 'email', email, error: result.error }
  }

  const nickname = intent === 'nickname' ? String(form.get('nickname') ?? '') : undefined
  const result = await membership.verifyCode(email, code, nickname)
  if (!result.ok) {
    if (result.error === 'nickname-required' && nickname === undefined) {
      return { step: 'nickname', email, code }
    }
    if (result.error === 'invalid-nickname' || result.error === 'nickname-required') {
      return { step: 'nickname', email, code, error: result.error }
    }
    return { step: 'code', email, error: result.error }
  }
  ;(await cookies()).set(result.cookie)
  redirect(next)
}

/** End the session. `after` is a path of the member pages: the page shows its sign-in. */
export async function signOut(form: FormData): Promise<void> {
  ;(await cookies()).set(await membership.signOut({ headers: await headers() }))
  const after = String(form.get('after') ?? '')
  redirect(/^\/annotate(\/|\?|$)/.test(after) ? after : '/annotate/mine')
}

export async function saveStory(_previous: SaveState, form: FormData): Promise<SaveState> {
  const values = {
    start: String(form.get('start') ?? ''),
    end: String(form.get('end') ?? ''),
    text: String(form.get('text') ?? ''),
    tags: form.getAll('tags').map(String),
    media: form.getAll('media').map(String),
  }
  const session = await membership.sessionFromRequest({ headers: await headers() })
  if (!session) return { values, error: { field: 'form', code: 'signed-out' } }
  const link = readLink(form)
  const id = String(form.get('id') ?? '')
  if (!link || !UUID_V7.test(id)) {
    return { values, error: { field: 'form', code: 'unknown-instance' } }
  }

  // A reply has no time range and no topics; the player opens its story at `t`.
  const place = link.replyTo
    ? { replyTo: link.replyTo }
    : { start: parseClock(values.start), end: parseClock(values.end), tags: values.tags }
  const result = await stories.saveDraft(session, {
    id,
    project: link.project,
    recording: link.recording,
    ...place,
    bodies: [{ kind: 'text', value: values.text }, ...values.media.flatMap(mediaInput)],
    ifMatch: (form.get('ifMatch') as string | null) || undefined,
    // `stories` keeps it only on a site of the project.
    toldOn: link.return,
  })
  if (!result.ok) return { values, error: fieldOf(result.error) }
  redirect(await afterSave(link, id, place.start ?? link.t, result.reviewState))
}

async function projectOf(link: AnnotateLink) {
  const payload = await getPayload({ config })
  return bySlug({ payload, origin: process.env.ANNOUDIO_ORIGIN || '' }, link.project)
}

/** Back to the checked `return` URL with the player fragment, else to the story (P5, P6). */
async function afterSave(
  link: AnnotateLink,
  id: string,
  start: number,
  reviewState: 'draft' | 'published',
): Promise<string> {
  const project = await projectOf(link)
  const target = project ? returnTarget(project, link.return) : null
  return target
    ? returnWithFragment(target, link, start, reviewState)
    : annotatePath({ ...link, t: Math.floor(start), return: null, story: id }, { saved: '1' })
}

/**
 * The state of a media body that the signed-in member uploaded, or null. The media
 * field of the form calls it every 3 s until the body is ready or failed.
 */
export async function mediaState(id: string): Promise<MediaState | null> {
  const session = await membership.sessionFromRequest({ headers: await headers() })
  if (!session) return null
  return (await media.body(id, session.memberId))?.state ?? null
}

/** One hidden `media` field: `<kind>:<MediaId>`. `saveDraft` checks the id and the owner. */
function mediaInput(value: string): BodyInput[] {
  const [kind, id] = value.split(':')
  return (kind === 'sound' || kind === 'image' || kind === 'video') && id
    ? [{ kind, media: id }]
    : []
}

function fieldOf(error: SaveError): NonNullable<SaveState['error']> {
  switch (error.code) {
    case 'invalid-range':
      return { field: error.field, code: error.field }
    case 'no-body':
    case 'text-too-long':
    case 'media-needs-text':
      return { field: 'text', code: error.code }
    case 'too-many-bodies':
    case 'unknown-media':
    case 'media-failed':
      return { field: 'media', code: error.code }
    case 'too-many-tags':
    case 'unknown-concept':
      return { field: 'tags', code: error.code }
    default:
      return { field: 'form', code: error.code }
  }
}

export type AccountState = {
  saved?: boolean
  error?: 'invalid-nickname' | 'gone'
  values?: { nickname: string; mailNotices: boolean }
}

/** Your account: the name and the mail choice of the signed-in member. */
export async function saveAccount(_previous: AccountState, form: FormData): Promise<AccountState> {
  const values = {
    nickname: String(form.get('nickname') ?? ''),
    mailNotices: form.get('mailNotices') === 'on',
  }
  const session = await membership.sessionFromRequest({ headers: await headers() })
  if (!session) return { values, error: 'gone' }
  const result = await membership.updateAccount(session, values)
  if (!result.ok) return { values, error: result.error }
  return {
    saved: true,
    values: { nickname: result.account.nickname, mailNotices: result.account.mailNotices },
  }
}
