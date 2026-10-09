// The one time format of every surface (design/ia.md §7; walkthrough 13, 34).

import { describe, expect, it } from 'vitest'

import { clock, clockExact, clockRange, parseClock } from '@/clock'

describe('clock', () => {
  it('gives m:ss, and h:mm:ss from one hour; seconds round down', () => {
    expect(clock(0)).toBe('0:00')
    expect(clock(62.9)).toBe('1:02')
    expect(clock(1834)).toBe('30:34')
    expect(clock(3600)).toBe('1:00:00')
    expect(clock(3725.5)).toBe('1:02:05')
  })

  it('gives nothing for a value that is not a time', () => {
    expect(clock(null)).toBe('')
    expect(clock(-1)).toBe('')
    expect(clock(Number.NaN)).toBe('')
  })

  it('gives a range with an en dash', () => {
    expect(clockRange(62, 95)).toBe('1:02–1:35')
    expect(clockRange(62, undefined)).toBe('1:02')
  })
})

describe('clockExact and parseClock: the times of the Annotate form', () => {
  it('shows a stored time exactly', () => {
    expect(clockExact(62)).toBe('1:02')
    expect(clockExact(62.5)).toBe('1:02.5')
    expect(clockExact(62.125)).toBe('1:02.125')
    expect(clockExact(3725)).toBe('1:02:05')
  })

  it('reads m:ss, h:mm:ss and seconds; NaN for anything else', () => {
    expect(parseClock('1:02')).toBe(62)
    expect(parseClock(' 1:02.5 ')).toBe(62.5)
    expect(parseClock('1:02:05')).toBe(3725)
    expect(parseClock('62')).toBe(62)
    expect(parseClock('62.25')).toBe(62.25)
    for (const bad of ['', '1:2', '1:60', 'one', '-3', '1:02:60', '1:60:00']) {
      expect(parseClock(bad)).toBeNaN()
    }
  })

  it('a shown time reads back as the same time', () => {
    for (const t of [0, 1.5, 62, 62.125, 3599.999, 3725.5]) expect(parseClock(clockExact(t))).toBe(t)
  })
})
