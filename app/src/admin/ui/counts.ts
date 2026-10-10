// Counts in words for chips and stats. The numbers come from `stories.counts`.

import type { StoryCounts } from '@/modules/stories'

/** All stories (not replies) in the counts, each once: a change to a published story counts once. */
export function storiesIn(c: StoryCounts): number {
  return (
    c.published.stories + c.waiting.stories + c.processing.stories + c.returned.stories - c.changes
  )
}

/**
 * The stories (not replies) of the counts by state, in words that say what they count:
 * "6 published · 5 waiting · 1 returned". Waiting includes Processing (the operator's
 * queue). A state with 0 stories is left out, but Published always shows: it is the number
 * that the widget shows. No story at all: "No stories yet".
 */
export function storyStates(c: StoryCounts): string {
  if (storiesIn(c) === 0) return 'No stories yet'
  const waiting = c.waiting.stories + c.processing.stories
  return [
    `${c.published.stories} published`,
    ...(waiting > 0 ? [`${waiting} waiting`] : []),
    ...(c.returned.stories > 0 ? [`${c.returned.stories} returned`] : []),
  ].join(' · ')
}
