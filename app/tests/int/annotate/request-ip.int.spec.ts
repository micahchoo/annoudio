// The IP address that the Annotate page gives to `membership.requestCode`. Pure; no database.

import { describe, expect, it } from 'vitest'

import { requestIp } from '@/app/(frontend)/annotate/request-ip'

const forwarded = (value: string) => new Headers({ 'x-forwarded-for': value })

describe('requestIp', () => {
  it('reads the address that Next writes when the request has no x-forwarded-for', () => {
    expect(requestIp(forwarded('192.0.2.10'), 0)).toBe('192.0.2.10')
  })

  it('with one proxy, reads the last value: the first one comes from the client', () => {
    expect(requestIp(forwarded('6.6.6.6, 198.51.100.4'), 1)).toBe('198.51.100.4')
  })

  it('with two proxies, reads the second value from the right', () => {
    expect(requestIp(forwarded('6.6.6.6, 198.51.100.4, 10.0.0.2'), 2)).toBe('198.51.100.4')
  })

  it('gives undefined without the header, with too few values, or with a long value', () => {
    expect(requestIp(new Headers(), 1)).toBeUndefined()
    expect(requestIp(forwarded('10.0.0.2'), 2)).toBeUndefined()
    expect(requestIp(forwarded('x'.repeat(65)), 1)).toBeUndefined()
  })
})
