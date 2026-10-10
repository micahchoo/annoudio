// Invite codes of the `membership` module through its interface (design/invite-codes.md).

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { memoryMailer, type MemoryMailer } from '@/modules/mail'
import {
  createMembership,
  type Membership,
  type SessionCookie,
  type SignInMode,
} from '@/modules/membership'
import config from '@/payload.config'

const ORIGIN = 'https://org.example'
const EMAIL = 'asha@example.org'
const T0 = Date.parse('2026-10-09T10:00:00.000Z')
const HOUR = 60 * 60

let payload: Payload
let mailer: MemoryMailer
let clock: { now: () => Date; advance: (seconds: number) => void }
let modes: Record<string, SignInMode>
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

function make(options: { codesPerHour?: number } = {}): Membership {
  return createMembership({
    payload,
    origin: ORIGIN,
    secret: 'test-secret',
    mailer,
    codesPerHour: options.codesPerHour,
    now: clock.now,
    signInOf: async (slug) => modes[slug] ?? null,
  })
}

function requestWith(cookie: SessionCookie): Request {
  return new Request(`${ORIGIN}/annotate`, {
    headers: { cookie: `${cookie.name}=${cookie.value}` },
  })
}

/** Make invite codes for a project. Fails the test if the module refuses. */
async function codes(
  project = 'river-voices',
  options: { count?: number; uses?: number; label?: string; expiresAt?: Date } = {},
): Promise<string[]> {
  const result = await membership.invites.create(project, { count: 1, ...options })
  if (!result.ok) throw new Error(`invites.create failed: ${result.error}`)
  return result.codes
}

/** Redeem as a new member with a name. */
async function redeem(code: string, email = EMAIL, nickname = 'Asha') {
  return membership.redeemInvite(email, code, nickname)
}

beforeAll(async () => {
  payload = await getPayload({ config })
})

beforeEach(async () => {
  const db = payload.db as unknown as PostgresAdapter
  await db.drizzle.execute(
    sql`truncate members, member_sessions, login_codes, invite_codes, invite_uses, invite_tries
        restart identity cascade`,
  )
  mailer = memoryMailer()
  clock = manualClock()
  modes = { 'river-voices': 'both', 'hill-songs': 'invite-code', 'mail-only': 'email-code' }
  membership = make()
})

describe('invites.create and invites.list', () => {
  it('makes N codes of 8 characters from the unambiguous alphabet, in the form ABCD-EFGH', async () => {
    const made = await codes('river-voices', { count: 5, label: 'Workshop 12 Oct' })
    expect(made).toHaveLength(5)
    expect(new Set(made).size).toBe(5)
    for (const code of made) expect(code).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/)
    const list = await membership.invites.list('river-voices')
    expect(list).toHaveLength(5)
    expect(list[0]).toMatchObject({
      label: 'Workshop 12 Oct',
      uses: 1,
      used: 0,
      expiresAt: null,
      state: 'active',
    })
    expect(made.map((code) => code.slice(0, 2)).sort()).toEqual(list.map((row) => row.hint).sort())
  })

  it('stores a keyed hash, never the code', async () => {
    const [code] = await codes()
    const db = payload.db as unknown as PostgresAdapter
    const rows = await db.drizzle.execute(sql`select * from invite_codes`)
    const stored = JSON.stringify(rows.rows)
    expect(stored).not.toContain(code)
    expect(stored).not.toContain(code.replace('-', ''))
  })

  it('refuses an unknown project, a count outside 1 to 100 and uses outside 1 to 1000', async () => {
    expect(await membership.invites.create('nowhere', { count: 1 })).toEqual({
      ok: false,
      error: 'unknown-project',
    })
    for (const count of [0, 101, 1.5]) {
      expect(await membership.invites.create('river-voices', { count })).toEqual({
        ok: false,
        error: 'invalid-count',
      })
    }
    for (const uses of [0, 1001]) {
      expect(await membership.invites.create('river-voices', { count: 1, uses })).toEqual({
        ok: false,
        error: 'invalid-uses',
      })
    }
    expect(await membership.invites.list('river-voices')).toEqual([])
  })

  it('lists only the codes of the project', async () => {
    await codes('river-voices', { count: 2 })
    await codes('hill-songs', { count: 3 })
    expect(await membership.invites.list('river-voices')).toHaveLength(2)
    expect(await membership.invites.list('hill-songs')).toHaveLength(3)
  })
})

describe('redeemInvite', () => {
  it('on first sign-in asks for a name, then makes an unverified member with a session', async () => {
    const [code] = await codes()
    expect(await membership.redeemInvite(EMAIL, code)).toEqual({
      ok: false,
      error: 'nickname-required',
    })
    expect(await membership.redeemInvite(EMAIL, code, 'a@b')).toEqual({
      ok: false,
      error: 'invalid-nickname',
    })
    const result = await membership.redeemInvite(' Asha@Example.ORG ', code, 'Asha')
    expect(result).toMatchObject({ ok: true, session: { nickname: 'Asha' } })
    if (!result.ok) return
    const session = await membership.sessionFromRequest(requestWith(result.cookie))
    expect(session).toEqual(result.session)
    expect(await membership.account(session!)).toEqual({
      email: EMAIL,
      nickname: 'Asha',
      mailNotices: true,
      emailVerified: false,
    })
    expect((await membership.invites.list('river-voices'))[0].used).toBe(1)
    // The member page shows the code and its project (design/rework-notes.md, slice B).
    expect(await membership.invites.ofMember(session!.memberId)).toEqual([
      { hint: code.slice(0, 2), label: null, project: 'river-voices' },
    ])
    expect(await membership.invites.ofMember('999999')).toEqual([])
  })

  it('takes the code in lower case, without the hyphen and with spaces', async () => {
    const [code] = await codes()
    const typed = ` ${code.toLowerCase().replace('-', ' ')} `
    expect(await redeem(typed)).toMatchObject({ ok: true })
  })

  it('gives wrong-code for an unknown code', async () => {
    await codes()
    expect(await redeem('2222-2222')).toEqual({ ok: false, error: 'wrong-code' })
  })

  it('a code with 1 use signs in one member; the same member can use it again', async () => {
    const [code] = await codes()
    expect(await redeem(code)).toMatchObject({ ok: true })
    expect(await redeem(code)).toMatchObject({ ok: true })
    expect(await redeem(code, 'ravi@example.org', 'Ravi')).toEqual({
      ok: false,
      error: 'used-up',
    })
    const [row] = await membership.invites.list('river-voices')
    expect(row).toMatchObject({ used: 1, state: 'used-up' })
  })

  it('a code with 3 uses signs in 3 members, also in parallel, and no more', async () => {
    const [code] = await codes('river-voices', { uses: 3 })
    const results = await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((name) => redeem(code, `${name}@example.org`, name)),
    )
    expect(results.filter((result) => result.ok)).toHaveLength(3)
    expect(results.filter((result) => !result.ok)).toEqual(
      Array(2).fill({ ok: false, error: 'used-up' }),
    )
    expect((await membership.invites.list('river-voices'))[0].used).toBe(3)
  })

  it('gives expired after the expiry and before it signs in', async () => {
    const [code] = await codes('river-voices', {
      expiresAt: new Date(T0 + 2 * HOUR * 1000),
    })
    clock.advance(2 * HOUR - 1)
    expect(await redeem(code)).toMatchObject({ ok: true })
    clock.advance(1)
    expect(await redeem(code, 'ravi@example.org', 'Ravi')).toEqual({
      ok: false,
      error: 'expired',
    })
    expect((await membership.invites.list('river-voices'))[0].state).toBe('expired')
  })

  it('gives expired after a revoke, also for a member who used the code before', async () => {
    const [code] = await codes('river-voices', { uses: 5 })
    expect(await redeem(code)).toMatchObject({ ok: true })
    const [row] = await membership.invites.list('river-voices')
    expect(await membership.invites.revoke(row.id)).toBe(true)
    expect(await redeem(code)).toEqual({ ok: false, error: 'expired' })
    expect((await membership.invites.list('river-voices'))[0].state).toBe('revoked')
    expect(await membership.invites.revoke('999999')).toBe(false)
  })

  it('gives not-allowed for a code of a project in email-code mode', async () => {
    const [code] = await codes('mail-only')
    expect(await redeem(code)).toEqual({ ok: false, error: 'not-allowed' })
    modes['mail-only'] = 'both'
    expect(await redeem(code)).toMatchObject({ ok: true })
  })

  it('with a project, gives wrong-code for a code of another project', async () => {
    const [code] = await codes('hill-songs')
    expect(await membership.redeemInvite(EMAIL, code, 'Asha', { project: 'river-voices' })).toEqual(
      { ok: false, error: 'wrong-code' },
    )
    expect(
      await membership.redeemInvite(EMAIL, code, 'Asha', { project: 'hill-songs' }),
    ).toMatchObject({ ok: true })
  })

  it('never opens the account of a verified email', async () => {
    await membership.requestCode(EMAIL)
    const login = /\b(\d{6})\b/.exec(mailer.lastTo(EMAIL)!.text)![1]
    expect(await membership.verifyCode(EMAIL, login, 'Asha')).toMatchObject({ ok: true })
    const [code] = await codes()
    expect(await redeem(code)).toEqual({ ok: false, error: 'email-verified' })
    expect((await membership.invites.list('river-voices'))[0].used).toBe(0)
  })

  it('a blocked member gets wrong-code', async () => {
    const [code] = await codes('river-voices', { uses: 2 })
    expect(await redeem(code)).toMatchObject({ ok: true })
    await payload.update({
      collection: 'members',
      where: { email: { equals: EMAIL } },
      data: { status: 'blocked' },
    })
    expect(await redeem(code)).toEqual({ ok: false, error: 'wrong-code' })
  })
})

describe('the rate limit of invite tries', () => {
  it('allows 5 failed tries per email per hour; then even a correct code gives rate-limited', async () => {
    const [code] = await codes()
    for (let i = 0; i < 5; i++) {
      expect(await redeem('2222-2222')).toEqual({ ok: false, error: 'wrong-code' })
    }
    expect(await redeem(code)).toEqual({ ok: false, error: 'rate-limited' })
    // Another email has its own limit.
    expect(await redeem(code, 'ravi@example.org', 'Ravi')).toMatchObject({ ok: true })
    clock.advance(HOUR + 1)
    const [next] = await codes()
    expect(await redeem(next)).toMatchObject({ ok: true })
  })

  it('does not count a correct code, and not the name step', async () => {
    const [code] = await codes('river-voices', { uses: 10 })
    for (let i = 0; i < 4; i++) await redeem('2222-2222')
    expect(await membership.redeemInvite(EMAIL, code)).toEqual({
      ok: false,
      error: 'nickname-required',
    })
    expect(await redeem(code)).toMatchObject({ ok: true })
    expect(await redeem(code)).toMatchObject({ ok: true })
    expect(await redeem('2222-2222')).toEqual({ ok: false, error: 'wrong-code' })
    expect(await redeem(code)).toEqual({ ok: false, error: 'rate-limited' })
  })

  it('counts parallel failed tries in one step: 10 at the same time, then rate-limited', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => redeem('2222-2222')))
    expect(results.filter((result) => !result.ok && result.error === 'wrong-code')).toHaveLength(5)
    expect(results.filter((result) => !result.ok && result.error === 'rate-limited')).toHaveLength(
      5,
    )
  })

  it('allows 20 failed tries per IP address per hour', async () => {
    const ip = '203.0.113.7'
    for (let i = 0; i < 20; i++) {
      expect(await membership.redeemInvite(`m${i}@example.org`, '2222-2222', 'M', { ip })).toEqual({
        ok: false,
        error: 'wrong-code',
      })
    }
    const [code] = await codes()
    expect(await membership.redeemInvite('late@example.org', code, 'Late', { ip })).toEqual({
      ok: false,
      error: 'rate-limited',
    })
    expect(
      await membership.redeemInvite('late@example.org', code, 'Late', { ip: '203.0.113.8' }),
    ).toMatchObject({ ok: true })
  })

  it('allows codesPerHour failed tries per stack', async () => {
    const small = make({ codesPerHour: 3 })
    for (let i = 0; i < 3; i++) {
      expect(await small.redeemInvite(`m${i}@example.org`, '2222-2222', 'M')).toEqual({
        ok: false,
        error: 'wrong-code',
      })
    }
    const [code] = await codes()
    expect(await small.redeemInvite('late@example.org', code, 'Late')).toEqual({
      ok: false,
      error: 'rate-limited',
    })
  })
})

describe('emailVerified and the mails', () => {
  it('an invite member has no contact for mails; a later login code verifies the email', async () => {
    const [code] = await codes()
    const result = await redeem(code)
    if (!result.ok) throw new Error(result.error)
    expect(await membership.contact(result.session.memberId)).toBeNull()

    await membership.requestCode(EMAIL)
    const login = /\b(\d{6})\b/.exec(mailer.lastTo(EMAIL)!.text)![1]
    // A known member: no name needed, and the same member signs in.
    const verified = await membership.verifyCode(EMAIL, login)
    expect(verified).toMatchObject({ ok: true, session: { memberId: result.session.memberId } })
    expect(await membership.contact(result.session.memberId)).toEqual({
      email: EMAIL,
      nickname: 'Asha',
      mailNotices: true,
    })
    expect(await membership.account(result.session)).toMatchObject({ emailVerified: true })
  })
})
