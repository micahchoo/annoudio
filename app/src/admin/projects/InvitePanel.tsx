// The invite codes of a project (design/invite-codes.md), in its tab Sign-in: make codes,
// see how many members used each one, revoke one.

import { membership } from '@payload-config'
import type { UIFieldServerProps } from 'payload'

import { bySlug, byId } from '@/modules/projects'

import { strings } from '../strings'

import { InviteTools } from './InviteTools'

const s = strings.invites

export async function InvitePanel({ id, payload }: UIFieldServerProps) {
  const found = id === undefined ? null : await byId({ payload }, id)
  if (!found) return <p>{s.unsaved}</p>
  const origin = process.env.ANNOUDIO_ORIGIN || ''
  const [project, list] = await Promise.all([
    bySlug({ payload, origin }, found.slug),
    membership.invites.list(found.slug),
  ])
  const site = project?.siteOrigins[0] ?? origin
  return (
    <section className="ao ao-card annoudio-invites-panel" aria-labelledby="annoudio-invites-heading">
      <div className="ao-card__head">
        <h2 id="annoudio-invites-heading">{s.heading}</h2>
        <p>{s.intro}</p>
      </div>
      <p className="ao-field__help">{s.noMail}</p>
      {project?.signIn === 'email-code' && <p className="annoudio-invites__note">{s.notAllowed}</p>}
      <InviteTools project={found.slug} projectName={found.label} site={site} initial={list} />
    </section>
  )
}
