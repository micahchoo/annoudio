// Small pure helpers: clock text and Media Fragments time ranges.

/** Seconds as "m:ss", or "h:mm:ss" from one hour. Unknown values show as "0:00". */
export function clock(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** One Media Fragments time value: "42", "42.5", "npt:42", "0:42", "1:02:03.5". */
function npt(value: string): number | null {
  const v = value.trim().replace(/^npt:/, "");
  if (v === "") return null;
  if (/^\d+(?:\.\d+)?$/.test(v)) return Number(v);
  const parts = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(v);
  if (!parts) return null;
  return Number(parts[1] ?? 0) * 3600 + Number(parts[2]) * 60 + Number(parts[3]);
}

/**
 * Reads "t=42,51" (with an optional "npt:" prefix and other fragment keys).
 * Returns null when the value has no readable time range.
 * `end` is null when the fragment has no end ("t=42" means "from 42 to the end").
 */
export function timeRange(fragment: string): { start: number; end: number | null } | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const t = params.get("t");
  if (t === null) return null;
  const [a, b, extra] = t.split(",");
  if (extra !== undefined || a === undefined) return null;
  const start = a.trim() === "" || a.trim() === "npt:" ? 0 : npt(a);
  if (start === null) return null;
  if (b === undefined || b.trim() === "") return { start, end: null };
  const end = npt(b);
  if (end === null || end < start) return null;
  return { start, end };
}
