// The job links of the sidebar (design/ia.md §4.1): Today, Review stories (with the
// Waiting for review count), Add a player, Concepts, Members. Payload's groups follow
// (Settings: Projects, Recordings, Operators); `AccountLink` comes after them.

import { stories } from '@payload-config'
import type { ServerProps } from 'payload'

import { JobLinks } from './JobLinks'
import { operatorOf } from './operator'
import { PATHS } from './paths'
import { strings } from './strings'
import { waitingCount } from './waitingCount'

const s = strings.nav

export async function NavLinks({ user }: ServerProps) {
  if (!operatorOf(user)) return null
  const waiting = await waitingCount(async () => {
    const { waiting: tally } = await stories.counts()
    return tally.stories + tally.replies
  })
  return (
    <JobLinks
      links={[
        { href: PATHS.today, label: s.today },
        {
          href: PATHS.review,
          label: s.review,
          badge: { count: waiting, label: s.waiting(waiting) },
        },
        { href: PATHS.addPlayer, label: s.addPlayer },
        { href: PATHS.concepts, label: s.concepts },
        { href: PATHS.members, label: s.members },
      ]}
    />
  )
}

export function AccountLink({ user }: ServerProps) {
  if (!operatorOf(user)) return null
  return <JobLinks links={[{ href: PATHS.account, label: s.account }]} />
}
