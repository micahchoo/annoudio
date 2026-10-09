// P9 (design/ia.md §5.2): when the session ended during a save, the text of the form waits
// in sessionStorage for this tab. After the member signs in again, the form takes it back.
// Storage can be missing or refuse (a private window): then the text is lost, as before.

const key = (id: string) => `annoudio-text:${id}`

/** Keep the text of a form for this tab. `id`: a story id, or a key for a new story. */
export function keepText(id: string, text: string): void {
  try {
    sessionStorage.setItem(key(id), text)
  } catch {
    // No storage: nothing to keep.
  }
}

/** The kept text of `id`, once, or null. */
export function takeKeptText(id: string): string | null {
  try {
    const kept = sessionStorage.getItem(key(id))
    if (kept !== null) sessionStorage.removeItem(key(id))
    return kept
  } catch {
    return null
  }
}
