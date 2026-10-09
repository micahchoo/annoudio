// Counts of stories and replies in words (design/ia.md §0, 10): "2 stories and 1 reply".
// The admin and the mails use the same words.

/** "2 stories and 1 reply", "1 story", "3 replies". "no stories" for 0 and 0. */
export function countWords(stories: number, replies: number): string {
  const parts = [
    ...(stories > 0 ? [stories === 1 ? '1 story' : `${stories} stories`] : []),
    ...(replies > 0 ? [replies === 1 ? '1 reply' : `${replies} replies`] : []),
  ]
  return parts.length === 0 ? 'no stories' : parts.join(' and ')
}

/** The verb for a count: "1 story waits", "2 stories wait", "1 story and 1 reply wait". */
export function verbFor(stories: number, replies: number, one: string, many: string): string {
  return stories + replies === 1 ? one : many
}

/** "2 stories and 1 reply wait for review". */
export function waitLine(stories: number, replies: number): string {
  return `${countWords(stories, replies)} ${verbFor(stories, replies, 'waits', 'wait')} for review`
}

/**
 * The refusal of a delete: "This project has 2 stories and 1 reply. Remove its 2 stories
 * first." A removed story takes its replies with it, so the line names the stories.
 */
export function removeFirstLine(thing: string, stories: number, replies: number): string {
  const first = stories > 0 ? countWords(stories, 0) : countWords(0, replies)
  return `This ${thing} has ${countWords(stories, replies)}. Remove its ${first} first.`
}
