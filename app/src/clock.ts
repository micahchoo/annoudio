// The one time format of every surface (design/ia.md §7): m:ss, h:mm:ss from one hour,
// and a range with an en dash. 62.4 → "1:02". The admin, the Annotate page and the mails
// use it.

/** "m:ss", or "h:mm:ss" from one hour. Seconds round down. Empty for no number. */
export function clock(seconds: unknown): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return ''
  const whole = Math.floor(seconds)
  const h = Math.floor(whole / 3600)
  const m = Math.floor((whole % 3600) / 60)
  const s = String(whole % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** "1:02–1:35". */
export function clockRange(start: unknown, end: unknown): string {
  const from = clock(start)
  const to = clock(end)
  return from && to ? `${from}–${to}` : from
}

/** "2 days ago", "3 hours ago", "1 minute ago", "less than 1 minute ago". */
export function ago(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000)
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'} ago`
  if (minutes < 1) return 'less than 1 minute ago'
  if (minutes < 60) return unit(minutes, 'minute')
  if (minutes < 48 * 60) return unit(Math.floor(minutes / 60), 'hour')
  return unit(Math.floor(minutes / (24 * 60)), 'day')
}

/** "1:02", or "1:02.5" when the time is not whole: a form shows a stored time exactly. */
export function clockExact(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return ''
  const whole = Math.floor(seconds)
  const rest = Math.round((seconds - whole) * 1000)
  const base = clock(whole)
  return rest === 0 ? base : `${base}.${String(rest).padStart(3, '0').replace(/0+$/, '')}`
}

/**
 * A time that a member typed: "1:02", "1:02.5", "1:02:03" or seconds ("62", "62.5").
 * NaN for anything else.
 */
export function parseClock(text: string): number {
  const value = text.trim()
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value)
  const parts = /^(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)$/.exec(value)
  if (!parts) return NaN
  const [, h, m, s] = parts
  if (Number(s) >= 60 || (h !== undefined && Number(m) >= 60)) return NaN
  return Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s)
}
