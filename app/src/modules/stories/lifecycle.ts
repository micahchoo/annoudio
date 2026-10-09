// The one story lifecycle (design/ia.md §2.1). Every surface derives its state here:
// the admin cells and badges, the Annotate page, the mails and the counts.
//
// Writing and Removed have no row: the Annotate form is Writing, and a removed story is
// gone (M5 is its record). So this function knows the four stored states, and the state
// of a change to a published story.

import type { Lifecycle, LifecycleRow } from './types'

/** The UI state of one story or reply, from its stored data. */
export function lifecycle(row: LifecycleRow): Lifecycle {
  const newest = draftState(row)
  if (row.reviewState === 'published') {
    return { state: 'published', change: null, automatic: false }
  }
  // The newest version is a draft. A published version under it is "Published · change waiting".
  if (row.pendingRevision)
    return { state: 'published', change: newest.state, automatic: newest.automatic }
  return { state: newest.state, change: null, automatic: newest.automatic }
}

function draftState(row: LifecycleRow): {
  state: 'processing' | 'waiting' | 'returned'
  automatic: boolean
} {
  if (row.rejection) return { state: 'returned', automatic: row.rejection.automatic }
  // A failed file is a system return, also before the consumer has written the rejection.
  if (row.mediaState === 'failed') return { state: 'returned', automatic: true }
  if (row.mediaState === 'processing') return { state: 'processing', automatic: false }
  return { state: 'waiting', automatic: false }
}
