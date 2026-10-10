// The badge of a lifecycle state (design/ia.md §2.1, "Badge role"). The list cell and the
// review screen show the same words and colours. The state comes from `stories.lifecycle`.

import type { Lifecycle } from '@/modules/stories'

import { strings } from '../strings'

const s = strings.review

/**
 * The colour of a state is whose move it is (design/design-system.md §3.4): processing
 * (the system), waiting (the operator), returned (the member), published (nobody).
 */
export type Tone = 'processing' | 'waiting' | 'returned' | 'published'

export interface Badge {
  label: string
  tone: Tone
  /** What the state means, in one sentence. */
  meaning: string
}

export function badgeOf(state: Lifecycle): Badge {
  switch (state.change) {
    case 'waiting':
      return { label: s.badge.change, tone: 'waiting', meaning: s.stateLong.change }
    case 'processing':
      return {
        label: s.badge.changeProcessing,
        tone: 'published',
        meaning: s.stateLong.changeProcessing,
      }
    case 'returned':
      return { label: s.badge.changeReturned, tone: 'published', meaning: s.stateLong.changeReturned }
  }
  switch (state.state) {
    case 'processing':
      return { label: s.badge.processing, tone: 'processing', meaning: s.stateLong.processing }
    case 'waiting':
      return { label: s.badge.waiting, tone: 'waiting', meaning: s.stateLong.waiting }
    case 'returned':
      return state.automatic
        ? { label: s.badge.automatic, tone: 'returned', meaning: s.stateLong.automatic }
        : { label: s.badge.returned, tone: 'returned', meaning: s.stateLong.returned }
    case 'published':
      return { label: s.badge.published, tone: 'published', meaning: s.stateLong.published }
  }
}

/**
 * The badges of a row: the state, then "Sent again" when the member changed the story
 * after a return and it waits again (`Lifecycle.again`).
 */
export function badgesOf(state: Lifecycle): Badge[] {
  const main = badgeOf(state)
  return state.again
    ? [main, { label: s.badge.sentAgain, tone: 'waiting', meaning: s.stateLong.sentAgain }]
    : [main]
}
