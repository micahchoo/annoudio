'use server'

import { membership } from '@payload-config'

import type { Invite } from '@/modules/membership'
import {
  exportSkos,
  importSkos,
  type ImportResult,
  type SkosFile,
  type SkosFormat,
} from '@/modules/vocabulary'

import { requestOperator } from '../operator'

const origin = () => process.env.ANNOUDIO_ORIGIN || ''

/** The project vocabulary as a SKOS file, for the "Download as SKOS" buttons. */
export async function downloadSkos(
  project: string,
  format: SkosFormat,
  list?: string,
): Promise<SkosFile | { error: 'forbidden' | 'unknown-project' }> {
  const session = await requestOperator()
  if (!session) return { error: 'forbidden' }
  const file = await exportSkos(
    { payload: session.payload, origin: origin() },
    project,
    format,
    list,
  )
  return file ?? { error: 'unknown-project' }
}

/** The preview (`apply: false`) or the import (`apply: true`) of a SKOS file. */
export async function uploadSkos(
  project: string,
  text: string,
  apply: boolean,
  list?: string,
): Promise<ImportResult | { ok: false; error: 'forbidden' }> {
  const session = await requestOperator()
  if (!session) return { ok: false, error: 'forbidden' }
  return importSkos({ payload: session.payload, origin: origin() }, project, text, {
    apply,
    ...(list ? { list } : {}),
  })
}

export type InviteError =
  'invalid-count' | 'invalid-uses' | 'invalid-expiry' | 'unknown-project' | 'forbidden' | 'unknown'

/**
 * Make invite codes for a project (design/invite-codes.md). `expiresAt`: an ISO time from
 * the browser (the end of the chosen day there), or empty. The answer is the only time
 * the codes are visible.
 */
export async function makeInviteCodes(
  project: string,
  input: { count: number; uses: number; label: string; expiresAt: string },
): Promise<{ ok: true; codes: string[]; list: Invite[] } | { ok: false; error: InviteError }> {
  if (!(await requestOperator())) return { ok: false, error: 'forbidden' }
  let expiresAt: Date | null = null
  if (input.expiresAt) {
    expiresAt = new Date(input.expiresAt)
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return { ok: false, error: 'invalid-expiry' }
    }
  }
  const result = await membership.invites.create(project, {
    count: input.count,
    uses: input.uses,
    label: input.label,
    expiresAt,
  })
  if (!result.ok) return result
  return { ok: true, codes: result.codes, list: await membership.invites.list(project) }
}

/** Revoke one invite code. Gives the new list of the project. */
export async function revokeInviteCode(
  project: string,
  id: string,
): Promise<{ ok: true; list: Invite[] } | { ok: false; error: InviteError }> {
  if (!(await requestOperator())) return { ok: false, error: 'forbidden' }
  const own = (await membership.invites.list(project)).some((invite) => invite.id === id)
  if (!own || !(await membership.invites.revoke(id))) return { ok: false, error: 'unknown' }
  return { ok: true, list: await membership.invites.list(project) }
}
