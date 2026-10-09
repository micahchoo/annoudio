// The tabs of the review list (O4): Waiting for review · Processing · Returned ·
// Published · All, each with its count and its own empty text. "Waiting for review" has
// no filter in the address: the collection's `baseFilter` gives it (stories/collection.ts).

import { stories } from '@payload-config'
import { Button } from '@payloadcms/ui'
import Link from 'next/link'
import type { ServerProps } from 'payload'

import { ago } from '@/clock'
import type { StoryCounts } from '@/modules/stories'

import { PATHS } from '../paths'
import { strings } from '../strings'

const s = strings.review

type Tab = keyof typeof s.tab

/** The `where` of each tab in the list address. */
const TABS: Record<Tab, Record<string, string>> = {
  waiting: {},
  processing: {
    'where[and][0][_status][equals]': 'draft',
    'where[and][1][processing][equals]': 'true',
    'where[and][2][rejection.at][exists]': 'false',
  },
  returned: {
    'where[and][0][_status][equals]': 'draft',
    'where[and][1][rejection.at][exists]': 'true',
  },
  published: { 'where[_status][equals]': 'published' },
  all: { 'where[_status][exists]': 'true' },
}

/** The tab of a list address, or null for a filter that the operator made. */
function activeTab(searchParams: ServerProps['searchParams']): Tab | null {
  const where = Object.entries(searchParams ?? {}).filter(([key]) => key.startsWith('where'))
  return (
    (Object.keys(TABS) as Tab[]).find((tab) => {
      const wanted = Object.entries(TABS[tab])
      return (
        wanted.length === where.length &&
        wanted.every(([key, value]) => where.some(([k, v]) => k === key && v === value))
      )
    }) ?? null
  )
}

/** The rows that each tab shows. A published story with a change shows as a change. */
function tabCounts(c: StoryCounts): Record<Tab, number> {
  const total = (tally: { stories: number; replies: number }) => tally.stories + tally.replies
  const published = total(c.published) - c.changes
  const drafts = total(c.waiting) + total(c.processing) + total(c.returned)
  return {
    waiting: total(c.waiting),
    processing: total(c.processing),
    returned: total(c.returned),
    published,
    all: published + drafts,
  }
}

export async function ReviewTabs({ searchParams }: ServerProps) {
  const active = activeTab(searchParams)
  const counts = await stories.counts()
  const each = tabCounts(counts)
  const searching = typeof searchParams?.search === 'string' && searchParams.search !== ''
  const next = active === 'waiting' && each.waiting > 0 ? await stories.nextWaiting() : null
  return (
    <>
      <nav aria-label={s.tabs} className="annoudio-tabs">
        {(Object.keys(TABS) as Tab[]).map((tab) => (
          <Link
            key={tab}
            href={`${PATHS.review}${tab === 'waiting' ? '' : `?${new URLSearchParams(TABS[tab])}`}`}
            aria-current={active === tab ? 'page' : undefined}
            className="annoudio-tabs__tab"
          >
            {s.tab[tab]} <span className="annoudio-tabs__count">{each[tab]}</span>
          </Link>
        ))}
      </nav>
      {next && (
        <p className="annoudio-tabs__start">
          <Button el="link" url={`${PATHS.review}/${next}`} buttonStyle="primary" size="medium">
            {s.start}
          </Button>
        </p>
      )}
      {active && each[active] === 0 && !searching && (
        <div className="annoudio-empty" role="status">
          <p>
            {s.empty[active]}{' '}
            {active === 'waiting' && counts.newest && s.lastStory(ago(counts.newest, new Date()))}
          </p>
        </div>
      )}
    </>
  )
}
