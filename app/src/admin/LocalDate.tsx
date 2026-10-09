'use client'

import { useSyncExternalStore } from 'react'

import { shortDate } from './format'

const subscribe = () => () => {}

/**
 * A date in the time zone of the operator's browser, for example "9 Oct 2026, 12:36".
 * The server knows no time zone of the operator: it renders an empty element, and the
 * browser fills it after hydration.
 */
export function LocalDate({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => shortDate(iso),
    () => '',
  )
  return <time dateTime={iso}>{text}</time>
}
