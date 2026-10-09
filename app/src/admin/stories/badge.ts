// The badge of a lifecycle state (design/ia.md §2.1, "Badge role"). The list cell and the
// review screen show the same words and colours. The state comes from `stories.lifecycle`.

import type { Lifecycle } from '@/modules/stories'

import { strings } from '../strings'

const s = strings.review

/** neutral: Processing; attention: Waiting; warning: Returned; success: Published. */
export type Tone = 'neutral' | 'attention' | 'warning' | 'success'

export interface Badge {
  label: string
  tone: Tone
  /** What the state means, in one sentence. */
  meaning: string
}

export function badgeOf(state: Lifecycle): Badge {
  switch (state.change) {
    case 'waiting':
      return { label: s.badge.change, tone: 'attention', meaning: s.stateLong.change }
    case 'processing':
      return {
        label: s.badge.changeProcessing,
        tone: 'success',
        meaning: s.stateLong.changeProcessing,
      }
    case 'returned':
      return { label: s.badge.changeReturned, tone: 'success', meaning: s.stateLong.changeReturned }
  }
  switch (state.state) {
    case 'processing':
      return { label: s.badge.processing, tone: 'neutral', meaning: s.stateLong.processing }
    case 'waiting':
      return { label: s.badge.waiting, tone: 'attention', meaning: s.stateLong.waiting }
    case 'returned':
      return state.automatic
        ? { label: s.badge.automatic, tone: 'warning', meaning: s.stateLong.automatic }
        : { label: s.badge.returned, tone: 'warning', meaning: s.stateLong.returned }
    case 'published':
      return { label: s.badge.published, tone: 'success', meaning: s.stateLong.published }
  }
}
