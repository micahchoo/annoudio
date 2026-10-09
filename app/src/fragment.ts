// The fragment that the player reads on a host page (CONTRACT.md §7.2). The Annotate page
// adds it to `return`; the mails and the review screen add it to `toldOn`.

export interface PlayerFragment {
  project: string
  recording: string
  /** Seconds: the player seeks there. */
  t: number
  /** `draft` or `published`: the note after a save on the Annotate page. */
  saved?: 'draft' | 'published'
  /** A story that the member answered: the player opens it and says "Your reply …". */
  reply?: string
  /** A story to open, with no note: a link from a mail or the admin. */
  story?: string
}

/** Seconds with at most 3 decimal places, as the fragment and the forms show them. */
export function seconds(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

/** `page` without its fragment, plus the player fragment. */
export function withPlayerFragment(page: string, fragment: PlayerFragment): string {
  const params = new URLSearchParams({
    'annoudio-t': seconds(fragment.t),
    'annoudio-project': fragment.project,
    'annoudio-recording': fragment.recording,
  })
  if (fragment.saved) params.set('annoudio-saved', fragment.saved)
  if (fragment.reply) params.set('annoudio-reply', fragment.reply)
  if (fragment.story) params.set('annoudio-story', fragment.story)
  return `${page.split('#')[0]}#${params}`
}
