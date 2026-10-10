// The contrast readout of the colour picker (design/design-system.md §6.1) and the widget
// defaults that CONTRACT.md §3.1 rule 6 promises.

import { describe, expect, it } from 'vitest'

import { contrast, parseHex, readout } from '@/admin/ui/contrast'
import { THEME_TOKENS } from '@/modules/projects'

const round = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10)
const fallback = (field: string) => THEME_TOKENS.find((t) => t.field === field)!.placeholder

describe('contrast', () => {
  it('gives the WCAG 2.2 ratio of two hex colours', () => {
    expect(round(contrast('#000000', '#ffffff'))).toBe(21)
    expect(round(contrast('#0b6e99', '#ffffff'))).toBe(5.7)
    expect(round(contrast('#fff', '#0b6e99'))).toBe(5.7)
  })

  it('reads 3, 6 and 8 digit hex, and refuses a colour that it cannot measure', () => {
    expect(parseHex('#abc')).toEqual([0xaa, 0xbb, 0xcc])
    expect(parseHex('#0B6E99')).toEqual([0x0b, 0x6e, 0x99])
    expect(parseHex('#0b6e99ff')).toEqual([0x0b, 0x6e, 0x99])
    expect(parseHex('#0b6e9980')).toBeNull()
    expect(parseHex('red')).toBeNull()
    expect(contrast('rgb(0 0 0)', '#fff')).toBeNull()
  })

  it('says pass or fail with the need', () => {
    expect(readout(contrast('#0b6e99', '#ffffff'), 4.5)).toEqual({ ratio: '5.7:1', pass: true })
    expect(readout(contrast('#8c8c8c', '#ffffff'), 4.5)).toEqual({ ratio: '3.4:1', pass: false })
    expect(readout(4.47, 4.5)).toEqual({ ratio: '4.47:1', pass: false })
    expect(readout(null, 3)).toBeNull()
  })
})

describe('the widget defaults (CONTRACT.md §3.1, rule 6)', () => {
  it('pass the contrast that each token needs', () => {
    for (const token of THEME_TOKENS) {
      if (!token.contrast) continue
      for (const under of token.contrast.against) {
        const ratio = contrast(token.placeholder, fallback(under))
        expect(ratio, `${token.field} on ${under}`).not.toBeNull()
        expect(ratio!, `${token.field} on ${under}`).toBeGreaterThanOrEqual(token.contrast.need)
      }
    }
  })

  it('are the refreshed values of design/design-system.md §7', () => {
    expect(round(contrast(fallback('colorAccent'), fallback('colorSurface')))).toBe(5.7)
    expect(round(contrast(fallback('colorWave'), fallback('colorSurface')))).toBe(3.7)
    expect(round(contrast(fallback('colorWave'), fallback('colorRegion')))).toBe(3)
    expect(round(contrast(fallback('colorText'), fallback('colorSurface')))).toBe(16.5)
  })
})
