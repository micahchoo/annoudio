// Dates for operators.

/** "9 Oct 2026, 12:36" in the time zone of the runtime. */
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}
