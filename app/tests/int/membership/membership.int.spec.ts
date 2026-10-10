// The `membership` module through its interface, on the test database.

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { memoryMailer, type Mailer, type MemoryMailer } from '@/modules/mail'
import { createMembership, type Membership, type SessionCookie } from '@/modules/membership'
import config from '@/payload.config'

const ORIGIN = 'https://org.example'
const EMAIL = 'leela@example.org'
const T0 = Date.parse('2026-10-09T10:00:00.000Z')

let payload: Payload
let mailer: MemoryMailer
let clock: { now: () => Date; advance: (seconds: number) => void }
let membership: Membership

function manualClock() {
  let time = T0
  return {
    now: () => new Date(time),
    advance: (seconds: number) => {
      time += seconds * 1000
    },
  }
}

function make(options: { mailer?: Mailer; codesPerHour?: number } = {}): Membership {
  return createMembership({
    payload,
    origin: ORIGIN,
    secret: 'test-secret',
    mailer: options.mailer ?? mailer,
    codesPerHour: options.codesPerHour,
    now: clock.now,
  })
}

const emails = (count: number) => Array.from({ length: count }, (_, i) => `m${i}@example.org`)

/** The code of the newest mail to the email. */
function codeFor(email: string): string {
  const text = mailer.lastTo(email)?.text ?? ''
  const match = /\b(\d{6})\b/.exec(text)
  if (!match) throw new Error(`No login code in mail to ${email}`)
  return match[1]
}

/** A request that carries the cookie, as the browser sends it. */
function requestWith(cookie: SessionCookie): Request {
  return new Request(`${ORIGIN}/annotate`, {
    headers: { cookie: `${cookie.name}=${cookie.value}` },
  })
}

/** Sign in a new member. Returns the session cookie. */
async function signIn(email = EMAIL, nickname = 'Leela'): Promise<SessionCookie> {
  await membership.requestCode(email)
  const result = await membership.verifyCode(email, codeFor(email), nickname)
  if (!result.ok) throw new Error(`verifyCode failed: ${result.error}`)
  return result.cookie
}

beforeAll(async () => {
  payload = await getPayload({ config })
})

beforeEach(async () => {
  const db = payload.db as unknown as PostgresAdapter
  await db.drizzle.execute(
    sql`truncate members, member_sessions, login_codes restart identity cascade`,
  )
  mailer = memoryMailer()
  clock = manualClock()
  membership = make()
})

describe('requestCode', () => {
  it('sends a 6-digit login code to the normalised email', async () => {
    expect(await membership.requestCode('  Leela@Example.ORG ')).toEqual({ ok: true })
    expect(mailer.messages).toHaveLength(1)
    expect(mailer.messages[0].to).toBe(EMAIL)
    expect(codeFor(EMAIL)).toMatch(/^\d{6}$/)
  })

  it('refuses a value that is not an email and sends nothing', async () => {
    expect(await membership.requestCode('leela')).toEqual({ ok: false, error: 'invalid-email' })
    expect(mailer.messages).toHaveLength(0)
  })

  it('allows 5 requests per email per hour, then gives rate-limited', async () => {
    for (let i = 0; i < 5; i++) expect(await membership.requestCode(EMAIL)).toEqual({ ok: true })
    expect(await membership.requestCode(EMAIL)).toEqual({ ok: false, error: 'rate-limited' })
    expect(mailer.messages).toHaveLength(5)
    // Another email has its own limit.
    expect(await membership.requestCode('ravi@example.org')).toEqual({ ok: true })
    clock.advance(60 * 60 + 1)
    expect(await membership.requestCode(EMAIL)).toEqual({ ok: true })
  })

  it('counts parallel requests in one step: 10 at the same time give exactly 5 codes', async () => {
    const results = await Promise.all(emails(10).map(() => membership.requestCode(EMAIL)))
    expect(results.filter((result) => result.ok)).toHaveLength(5)
    expect(results.filter((result) => !result.ok)).toEqual(
      Array(5).fill({ ok: false, error: 'rate-limited' }),
    )
    expect(mailer.messages).toHaveLength(5)
  })

  it('allows 20 requests per IP address per hour; another address has its own limit', async () => {
    const ip = '203.0.113.7'
    for (const email of emails(20)) {
      expect(await membership.requestCode(email, { ip })).toEqual({ ok: true })
    }
    expect(await membership.requestCode('late@example.org', { ip })).toEqual({
      ok: false,
      error: 'rate-limited',
    })
    expect(await membership.requestCode('late@example.org', { ip: '203.0.113.8' })).toEqual({
      ok: true,
    })
    expect(await membership.requestCode('none@example.org')).toEqual({ ok: true })
    clock.advance(60 * 60 + 1)
    expect(await membership.requestCode('later@example.org', { ip })).toEqual({ ok: true })
  })

  it('allows codesPerHour codes per stack, for all emails and addresses together', async () => {
    const small = make({ codesPerHour: 3 })
    const results = await Promise.all(
      emails(6).map((email, i) => small.requestCode(email, { ip: `198.51.100.${i}` })),
    )
    expect(results.filter((result) => result.ok)).toHaveLength(3)
    expect(mailer.messages).toHaveLength(3)
    clock.advance(60 * 60 + 1)
    expect(await small.requestCode('next@example.org')).toEqual({ ok: true })
  })

  it('gives send-failed when the mailer throws, and the failure does not count', async () => {
    const broken = make({
      mailer: {
        send: async () => {
          throw new Error('SMTP down')
        },
      },
    })
    for (let i = 0; i < 5; i++) {
      expect(await broken.requestCode(EMAIL)).toEqual({ ok: false, error: 'send-failed' })
    }
    expect(await membership.requestCode(EMAIL)).toEqual({ ok: true })
  })
})

describe('verifyCode', () => {
  it('on first sign-in asks for a nickname, keeps the code usable, then makes the member', async () => {
    await membership.requestCode(EMAIL)
    const code = codeFor(EMAIL)
    expect(await membership.verifyCode(EMAIL, code)).toEqual({
      ok: false,
      error: 'nickname-required',
    })
    const result = await membership.verifyCode(EMAIL, code, '  Leela  ')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.session).toEqual({ memberId: expect.any(String), nickname: 'Leela' })

    // A known member signs in without a nickname, and keeps the same id and nickname.
    await membership.requestCode(EMAIL)
    const again = await membership.verifyCode(EMAIL, codeFor(EMAIL), 'Other')
    expect(again.ok && again.session).toEqual(result.session)
  })

  it('a sign-in with an operator session makes a test member; an existing member stays real', async () => {
    await membership.requestCode(EMAIL)
    const made = await membership.verifyCode(EMAIL, codeFor(EMAIL), 'Operator test', { test: true })
    expect(made.ok).toBe(true)
    await signIn('real@example.org', 'Asha')
    const tests = await membership.testMembers()
    expect(tests).toEqual([made.ok ? made.session.memberId : ''])
    // The real member signs in later from an operator browser: still a real member.
    await membership.requestCode('real@example.org')
    await membership.verifyCode('real@example.org', codeFor('real@example.org'), undefined, { test: true })
    expect(await membership.testMembers()).toEqual(tests)
  })

  it('refuses a nickname that is empty, too long or has an @', async () => {
    await membership.requestCode(EMAIL)
    const code = codeFor(EMAIL)
    for (const nickname of ['  ', 'x'.repeat(41), EMAIL]) {
      expect(await membership.verifyCode(EMAIL, code, nickname)).toEqual({
        ok: false,
        error: 'invalid-nickname',
      })
    }
    expect((await membership.verifyCode(EMAIL, code, 'Leela')).ok).toBe(true)
  })

  it('gives wrong-code for a wrong code, and too-many-attempts after 5 wrong tries', async () => {
    await membership.requestCode(EMAIL)
    const code = codeFor(EMAIL)
    const wrong = code === '000000' ? '000001' : '000000'
    for (let i = 0; i < 4; i++) {
      expect(await membership.verifyCode(EMAIL, wrong, 'Leela')).toEqual({
        ok: false,
        error: 'wrong-code',
      })
    }
    expect(await membership.verifyCode(EMAIL, wrong, 'Leela')).toEqual({
      ok: false,
      error: 'too-many-attempts',
    })
    // The correct code is dead now too.
    expect(await membership.verifyCode(EMAIL, code, 'Leela')).toEqual({
      ok: false,
      error: 'too-many-attempts',
    })
  })

  it('gives no-code for an expired code', async () => {
    await membership.requestCode(EMAIL)
    clock.advance(10 * 60)
    expect(await membership.verifyCode(EMAIL, codeFor(EMAIL), 'Leela')).toEqual({
      ok: false,
      error: 'no-code',
    })
  })

  it('accepts a code just before it expires', async () => {
    await membership.requestCode(EMAIL)
    clock.advance(10 * 60 - 1)
    expect((await membership.verifyCode(EMAIL, codeFor(EMAIL), 'Leela')).ok).toBe(true)
  })

  it('gives no-code for a code that was used', async () => {
    await membership.requestCode(EMAIL)
    const code = codeFor(EMAIL)
    expect((await membership.verifyCode(EMAIL, code, 'Leela')).ok).toBe(true)
    expect(await membership.verifyCode(EMAIL, code, 'Leela')).toEqual({
      ok: false,
      error: 'no-code',
    })
  })

  it('lets only one of two parallel uses of one code succeed', async () => {
    await membership.requestCode(EMAIL)
    const code = codeFor(EMAIL)
    const results = await Promise.all([
      membership.verifyCode(EMAIL, code, 'Leela'),
      membership.verifyCode(EMAIL, code, 'Leela'),
    ])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
  })

  it('refuses an older code after a newer request', async () => {
    await membership.requestCode(EMAIL)
    const old = codeFor(EMAIL)
    await membership.requestCode(EMAIL)
    const fresh = codeFor(EMAIL)
    if (old !== fresh) {
      expect(await membership.verifyCode(EMAIL, old, 'Leela')).toEqual({
        ok: false,
        error: 'wrong-code',
      })
    }
    expect((await membership.verifyCode(EMAIL, fresh, 'Leela')).ok).toBe(true)
  })

  it('gives no-code when no code was requested', async () => {
    expect(await membership.verifyCode(EMAIL, '123456', 'Leela')).toEqual({
      ok: false,
      error: 'no-code',
    })
  })

  it('does not accept the code of another email', async () => {
    await membership.requestCode(EMAIL)
    await membership.requestCode('ravi@example.org')
    const result = await membership.verifyCode('ravi@example.org', codeFor(EMAIL), 'Ravi')
    if (codeFor(EMAIL) !== codeFor('ravi@example.org')) {
      expect(result).toEqual({ ok: false, error: 'wrong-code' })
    }
  })
})

describe('sessions', () => {
  it('gives an httpOnly, Lax, Secure cookie that a request carries back to the session', async () => {
    await membership.requestCode(EMAIL)
    const result = await membership.verifyCode(EMAIL, codeFor(EMAIL), 'Leela')
    if (!result.ok) throw new Error(result.error)
    expect(result.cookie).toMatchObject({
      name: 'annoudio-member',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })
    expect(await membership.sessionFromRequest(requestWith(result.cookie))).toEqual(result.session)
  })

  it('gives null without a cookie, with an unknown token and with a malformed cookie', async () => {
    await signIn()
    expect(await membership.sessionFromRequest(new Request(ORIGIN))).toBeNull()
    const unknown = { name: 'annoudio-member', value: 'A'.repeat(43) } as SessionCookie
    expect(await membership.sessionFromRequest(requestWith(unknown))).toBeNull()
    const malformed = { name: 'annoudio-member', value: "x' or 1=1" } as SessionCookie
    expect(await membership.sessionFromRequest(requestWith(malformed))).toBeNull()
  })

  it('makes a cookie that is not Secure for an http origin', async () => {
    const local = createMembership({
      payload,
      origin: 'http://localhost:3000',
      secret: 's',
      mailer,
    })
    await local.requestCode(EMAIL)
    const result = await local.verifyCode(EMAIL, codeFor(EMAIL), 'Leela')
    expect(result.ok && result.cookie.secure).toBe(false)
  })

  it('ends after 30 days', async () => {
    const cookie = await signIn()
    clock.advance(30 * 24 * 60 * 60 - 1)
    expect(await membership.sessionFromRequest(requestWith(cookie))).not.toBeNull()
    clock.advance(1)
    expect(await membership.sessionFromRequest(requestWith(cookie))).toBeNull()
  })

  it('signOut ends the session and gives an expired cookie; other sessions stay', async () => {
    const first = await signIn()
    const second = await signIn()
    const expired = await membership.signOut(requestWith(first))
    expect(expired).toMatchObject({ name: 'annoudio-member', value: '', maxAge: 0 })
    expect(await membership.sessionFromRequest(requestWith(first))).toBeNull()
    expect(await membership.sessionFromRequest(requestWith(second))).not.toBeNull()
  })

  it('a blocked member has no session and gets no mail; unblocked, the member signs in again', async () => {
    const cookie = await signIn()
    const { docs } = await payload.find({
      collection: 'members',
      where: { email: { equals: EMAIL } },
    })
    await payload.update({ collection: 'members', id: docs[0].id, data: { status: 'blocked' } })
    expect(await membership.sessionFromRequest(requestWith(cookie))).toBeNull()

    const before = mailer.messages.length
    expect(await membership.requestCode(EMAIL)).toEqual({ ok: true })
    expect(mailer.messages).toHaveLength(before)
    // The requests of a blocked member count like any other, so the rate limit does
    // not show that the member is blocked. One code went to the sign-in above.
    for (let i = 0; i < 3; i++) expect(await membership.requestCode(EMAIL)).toEqual({ ok: true })
    expect(await membership.requestCode(EMAIL)).toEqual({ ok: false, error: 'rate-limited' })
    clock.advance(60 * 60 + 1)

    await payload.update({ collection: 'members', id: docs[0].id, data: { status: 'active' } })
    expect(await membership.sessionFromRequest(requestWith(cookie))).not.toBeNull()
  })
})

describe('members collection', () => {
  it('refuses a nickname with an @ from the admin path too', async () => {
    await signIn()
    const { docs } = await payload.find({ collection: 'members' })
    await expect(
      payload.update({ collection: 'members', id: docs[0].id, data: { nickname: EMAIL } }),
    ).rejects.toThrow()
  })

  it('is closed to anonymous REST reads', async () => {
    await signIn()
    await expect(payload.find({ collection: 'members', overrideAccess: false })).rejects.toThrow()
  })
})

describe('account, updateAccount and contact (Phase 5c)', () => {
  async function session() {
    const result = await membership.sessionFromRequest(requestWith(await signIn()))
    return result!
  }

  it('gives the email, the name and the mail choice; mail is on for a new member', async () => {
    expect(await membership.account(await session())).toEqual({
      email: EMAIL,
      nickname: 'Leela',
      mailNotices: true,
      emailVerified: true,
    })
  })

  it('changes the name and the mail choice; the next session has the new name', async () => {
    const me = await session()
    const result = await membership.updateAccount(me, {
      nickname: '  Leela K ',
      mailNotices: false,
    })
    expect(result).toEqual({
      ok: true,
      account: { email: EMAIL, nickname: 'Leela K', mailNotices: false, emailVerified: true },
    })
    expect(await membership.contact(me.memberId)).toMatchObject({ mailNotices: false })
    const cookie = await signIn()
    expect((await membership.sessionFromRequest(requestWith(cookie)))?.nickname).toBe('Leela K')
  })

  it('refuses a name with @ or of more than 40 characters, and changes nothing', async () => {
    const me = await session()
    for (const nickname of ['', 'a@b', 'x'.repeat(41)]) {
      expect(await membership.updateAccount(me, { nickname })).toEqual({
        ok: false,
        error: 'invalid-nickname',
      })
    }
    expect((await membership.account(me))?.nickname).toBe('Leela')
  })

  it('a blocked member has no contact and cannot change the account', async () => {
    const me = await session()
    await payload.update({
      collection: 'members',
      where: { email: { equals: EMAIL } },
      data: { status: 'blocked' },
    })
    expect(await membership.contact(me.memberId)).toBeNull()
    expect(await membership.updateAccount(me, { mailNotices: false })).toEqual({
      ok: false,
      error: 'gone',
    })
  })
})
