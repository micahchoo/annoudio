// WCAG 2.2 contrast of two colours, for the readout of the colour picker
// (design/design-system.md §6.1). Pure functions: the picker turns other CSS colours into
// hex in the browser first (`toHex` in ColorField.tsx).

/** The red, green and blue of an opaque hex colour (#rgb, #rrggbb, #rrggbbff), or null. */
export function parseHex(value: string): [number, number, number] | null {
  const hex = value.trim().toLowerCase()
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(hex)
  if (short) return [1, 2, 3].map((i) => parseInt(short[i] + short[i], 16)) as [number, number, number]
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(ff)?$/.exec(hex)
  if (long) return [1, 2, 3].map((i) => parseInt(long[i], 16)) as [number, number, number]
  return null
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** The contrast ratio of two hex colours, from 1 to 21, or null if one cannot be read. */
export function contrast(a: string, b: string): number | null {
  const x = parseHex(a)
  const y = parseHex(b)
  if (!x || !y) return null
  const [light, dark] = [luminance(x), luminance(y)].sort((p, q) => q - p)
  return (light + 0.05) / (dark + 0.05)
}

/**
 * "5.7:1" (one decimal) and whether it reaches `need`. A ratio just under the need gets
 * two decimals ("4.47:1"), so a shown "4.5:1" never fails 4.5.
 */
export function readout(
  ratio: number | null,
  need: number,
): { ratio: string; pass: boolean } | null {
  if (ratio === null) return null
  const pass = ratio >= need
  const one = Math.round(ratio * 10) / 10
  const shown = !pass && one >= need ? Math.floor(ratio * 100) / 100 : one
  return { ratio: `${shown}:1`, pass }
}
