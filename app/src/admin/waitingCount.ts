// The Waiting for review count of the sidebar badge. The sidebar shows on every admin
// page: count at most once in 30 s per process. A story event of this process clears it
// (payload.config.ts), so the badge is exact after a publish or a return here.
// This file imports nothing from the config: the config imports it.

const CACHE_MS = 30_000

const cache = globalThis as typeof globalThis & {
  annoudioWaiting?: { at: number; count: Promise<number> }
}

/** The cached count, or a new count from `count`. A failed count gives 0 and is not kept. */
export function waitingCount(count: () => Promise<number>): Promise<number> {
  const now = Date.now()
  if (!cache.annoudioWaiting || now - cache.annoudioWaiting.at > CACHE_MS) {
    const value = count().catch((error: unknown) => {
      console.error('[admin] The sidebar count failed.', error)
      cache.annoudioWaiting = undefined
      return 0
    })
    cache.annoudioWaiting = { at: now, count: value }
  }
  return cache.annoudioWaiting.count
}

/** Count again at the next page. */
export function forgetWaitingCount(): void {
  cache.annoudioWaiting = undefined
}
