// The top of a member page (O14): what a member is, their stories by state (each opens
// Review stories for this member), and the invite codes they signed in with, each with
// its project. It reads `stories.counts` and `membership.invites` only.

import { membership, stories } from '@payload-config'
import type { UIFieldServerProps } from 'payload'

import { bySlug } from '@/modules/projects'

import { projectPath, reviewTabPath, storiesPath } from '../paths'
import { strings } from '../strings'
import { Chip } from '../ui/Chip'

import { TestBadge } from './TestCell'

const s = strings.member
const STATES = ['waiting', 'processing', 'returned', 'published'] as const

export async function MemberPanel({ id, payload, data }: UIFieldServerProps) {
  if (id === undefined) return null
  const member = String(id)
  const origin = process.env.ANNOUDIO_ORIGIN || ''
  const [counts, invites] = await Promise.all([
    stories.counts({ member }),
    membership.invites.ofMember(member),
  ])
  const projects = await Promise.all(invites.map((i) => bySlug({ payload, origin }, i.project)))
  const total = STATES.reduce(
    (n, state) => n + counts[state].stories + counts[state].replies,
    -counts.changes,
  )
  return (
    <div className="ao annoudio-member">
      <p className="ao-header__help">{s.help}</p>
      {data?.status === 'blocked' && <p className="annoudio-member__blocked">{s.blocked}</p>}
      {data?.test === true && (
        <p className="annoudio-member__test">
          <TestBadge /> {s.testLine}
        </p>
      )}
      <section className="ao-card" aria-labelledby="annoudio-member-stories">
        <div className="ao-card__head">
          <h2 id="annoudio-member-stories">{s.stories}</h2>
          {total > 0 && <a href={storiesPath({ member })}>{s.all(total)}</a>}
        </div>
        {total === 0 ? (
          <p>{s.none}</p>
        ) : (
          <div className="ao-chips">
            {STATES.map((state) => {
              const n = counts[state].stories + counts[state].replies
              return n === 0 ? null : (
                <Chip
                  key={state}
                  kind="story"
                  label={strings.review.tab[state]}
                  count={String(n)}
                  href={reviewTabPath(state, { member })}
                />
              )
            })}
          </div>
        )}
      </section>
      {invites.length > 0 && (
        <section className="ao-card ao-card--sunken" aria-labelledby="annoudio-member-invites">
          <h2 id="annoudio-member-invites" className="annoudio-member__subhead">
            {s.invites}
          </h2>
          <ul className="ao-chips annoudio-member__invites">
            {invites.map((invite, i) => (
              <li key={i} className="ao-chips">
                <Chip kind="invite-code" label={s.invite(invite.hint, invite.label)} />
                <Chip
                  kind="project"
                  label={projects[i]?.label ?? invite.project}
                  href={projects[i] ? projectPath(projects[i]!.id) : undefined}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
