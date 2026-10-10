import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
} from 'payload'

import { mails } from '@/modules/mail'

import { CODES, MEMBERS, SESSIONS } from './collections'
import { makeInvites } from './invites'
import { checkNickname, normaliseEmail } from './rules'
import type {
  Account,
  Contact,
  HasHeaders,
  MemberSession,
  Membership,
  MembershipConfig,
  RequestCodeOptions,
  RequestCodeResult,
  SessionCookie,
  SignInOptions,
  VerifyCodeResult,
} from './types'

const COOKIE = 'annoudio-member'
const CODE_DIGITS = 6
const CODE_LIFETIME = 10 * 60 * 1000
const REQUESTS_PER_EMAIL = 5 // per hour
const REQUESTS_PER_IP = 20 // per hour
const CODES_PER_HOUR = 100 // per stack, the default of `codesPerHour`
const ATTEMPTS_PER_CODE = 5
const HOUR = 60 * 60 * 1000
const SESSION_LIFETIME = 30 * 24 * 60 * 60 // seconds

/** The Drizzle handle of a locked transaction. */
export type LockedDb = PostgresAdapter['drizzle']

export function createMembership(config: MembershipConfig): Membership {
  const now = config.now ?? (() => new Date())
  const secure = config.origin.startsWith('https:')

  let pending: Promise<Payload> | undefined
  const payload = () => {
    pending ??= Promise.resolve(
      typeof config.payload === 'function' ? config.payload() : config.payload,
    ).catch((error: unknown) => {
      pending = undefined
      throw error
    })
    return pending
  }

  const codesPerHour = config.codesPerHour ?? CODES_PER_HOUR

  const keyed = (value: string) => {
    // Checked at use, not at start, so a build without the secret can import the config.
    if (!config.secret) throw new TypeError('membership needs a secret (PAYLOAD_SECRET).')
    return createHmac('sha256', config.secret).update(value).digest()
  }
  const codeHash = (email: string, code: string) => keyed(`${email}:${code}`)

  const cookie = (value: string, maxAge: number): SessionCookie => ({
    name: COOKIE,
    value,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  })

  async function findMember(db: Payload, email: string, req?: PayloadRequest) {
    const { docs } = await db.find({
      collection: MEMBERS,
      where: { email: { equals: email } },
      limit: 1,
      pagination: false,
      depth: 0,
      req,
    })
    return docs[0] ?? null
  }

  /**
   * Run `work` in one transaction under a stack-wide advisory lock. Parallel calls with
   * the same `key` wait for each other, so a count and the insert after it are one step.
   */
  async function withLock<T>(
    db: Payload,
    key: string,
    work: (tx: LockedDb, req: PayloadRequest) => Promise<T>,
  ): Promise<T> {
    const req = await createLocalReq({}, db)
    await initTransaction(req)
    try {
      const adapter = db.db as unknown as PostgresAdapter
      const transactionID = await req.transactionID
      const tx =
        (transactionID !== undefined && adapter.sessions[transactionID]?.db) || adapter.drizzle
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`)
      const result = await work(tx, req)
      await commitTransaction(req)
      return result
    } catch (error) {
      await killTransaction(req)
      throw error
    }
  }

  /** A new session for the member: the row and the cookie. Expired rows of the member go. */
  async function startSession(
    db: Payload,
    member: { id: number | string; nickname: string },
    time: Date,
  ): Promise<{ ok: true; session: MemberSession; cookie: SessionCookie }> {
    const token = randomBytes(32).toString('base64url')
    await db.delete({
      collection: SESSIONS,
      where: {
        and: [{ member: { equals: member.id } }, { expiresAt: { less_than: time.toISOString() } }],
      },
    })
    await db.create({
      collection: SESSIONS,
      data: {
        tokenHash: tokenHash(token),
        member: Number(member.id),
        expiresAt: new Date(time.getTime() + SESSION_LIFETIME * 1000).toISOString(),
      },
      depth: 0,
    })
    return {
      ok: true,
      session: { memberId: String(member.id), nickname: member.nickname },
      cookie: cookie(token, SESSION_LIFETIME),
    }
  }

  async function requestCode(
    raw: string,
    options: RequestCodeOptions = {},
  ): Promise<RequestCodeResult> {
    const email = normaliseEmail(raw)
    if (!email) return { ok: false, error: 'invalid-email' }
    const db = await payload()
    const time = now()
    const code = String(randomInt(0, 10 ** CODE_DIGITS)).padStart(CODE_DIGITS, '0')
    const member = await findMember(db, email)
    const row = await reserveCode(db, {
      email,
      // Keep a keyed hash of the IP address, not the address.
      ipHash: options.ip ? keyed(`ip:${options.ip}`).toString('hex') : null,
      codeHash: codeHash(email, code).toString('hex'),
      time,
    })
    if (!row) return { ok: false, error: 'rate-limited' }
    // A blocked member gets no mail. The row still counts toward the limits, so the
    // answers are the same as for any other email (invariant 3).
    if (member?.status === 'blocked') return { ok: true }

    try {
      await config.mailer.send({
        ...mails.loginCode({ code, site: options.site || 'Annoudio' }),
        to: email,
      })
    } catch (error) {
      await db.delete({ collection: CODES, id: row.id })
      console.error('membership: the mailer did not send the login code.', error)
      return { ok: false, error: 'send-failed' }
    }
    return { ok: true }
  }

  /**
   * Check the three limits and store the new code, as one step. A stack-wide advisory
   * lock makes parallel requests wait for each other, so two requests at a limit cannot
   * both pass. Returns null when a limit stops the request.
   */
  async function reserveCode(
    db: Payload,
    code: { email: string; ipHash: string | null; codeHash: string; time: Date },
  ): Promise<{ id: number | string } | null> {
    const hourAgo = new Date(code.time.getTime() - HOUR).toISOString()
    return withLock(db, 'annoudio.login-codes', async (tx, req) => {
      // Codes older than the rate-limit window count for nothing. Remove them.
      await tx.execute(sql`delete from login_codes where requested_at < ${hourAgo}`)
      const counts = await tx.execute<{ email: number; ip: number; total: number }>(
        sql`select count(*) filter (where email = ${code.email})::int as email,
                   count(*) filter (where ip_hash = ${code.ipHash})::int as ip,
                   count(*)::int as total
            from login_codes where requested_at >= ${hourAgo}`,
      )
      const count = counts.rows[0]
      const limited =
        !count ||
        count.email >= REQUESTS_PER_EMAIL ||
        count.ip >= REQUESTS_PER_IP ||
        count.total >= codesPerHour
      if (limited) return null
      return db.create({
        collection: CODES,
        data: {
          email: code.email,
          codeHash: code.codeHash,
          ipHash: code.ipHash,
          requestedAt: code.time.toISOString(),
          expiresAt: new Date(code.time.getTime() + CODE_LIFETIME).toISOString(),
          attempts: 0,
        },
        depth: 0,
        req,
      })
    })
  }

  async function verifyCode(
    raw: string,
    rawCode: string,
    rawNickname?: string,
    options: SignInOptions = {},
  ): Promise<VerifyCodeResult> {
    const email = normaliseEmail(raw)
    if (!email) return { ok: false, error: 'invalid-email' }
    const db = await payload()
    const sqlDb = (db.db as unknown as PostgresAdapter).drizzle
    const time = now()

    // Only the newest code of the email is live: a new request replaces the older codes.
    const { docs } = await db.find({
      collection: CODES,
      where: { email: { equals: email } },
      sort: '-id',
      limit: 1,
      pagination: false,
      depth: 0,
    })
    const live = docs[0]
    if (!live || live.usedAt || Date.parse(live.expiresAt) <= time.getTime()) {
      return { ok: false, error: 'no-code' }
    }
    // Count the try before the check, in one atomic update. So parallel tries cannot
    // pass the limit, and a correct code among them is one of the 5 tries too.
    const counted = await sqlDb.execute<{ attempts: number }>(
      sql`update login_codes set attempts = attempts + 1
          where id = ${live.id} and attempts < ${ATTEMPTS_PER_CODE} returning attempts`,
    )
    const attempts = counted.rows[0]?.attempts
    if (attempts === undefined) return { ok: false, error: 'too-many-attempts' }
    const expected = Buffer.from(live.codeHash, 'hex')
    const given = codeHash(email, rawCode.trim())
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return {
        ok: false,
        error: attempts >= ATTEMPTS_PER_CODE ? 'too-many-attempts' : 'wrong-code',
      }
    }

    const known = await findMember(db, email)
    if (known?.status === 'blocked') return { ok: false, error: 'no-code' }
    const nickname = known
      ? known.nickname
      : rawNickname === undefined
        ? null
        : checkNickname(rawNickname)
    if (!nickname) {
      // The code was correct: give the try back, so the nickname step costs nothing.
      await sqlDb.execute(sql`update login_codes set attempts = attempts - 1 where id = ${live.id}`)
      return {
        ok: false,
        error: rawNickname === undefined ? 'nickname-required' : 'invalid-nickname',
      }
    }

    // One atomic update, so two parallel requests cannot both use the code.
    const used = await sqlDb.execute(
      sql`update login_codes set used_at = ${time.toISOString()}
          where id = ${live.id} and used_at is null returning id`,
    )
    if (used.rows.length === 0) return { ok: false, error: 'no-code' }
    // A login code proves the email: a member that an invite code made is now verified.
    if (known && !known.emailVerified) {
      await db.update({
        collection: MEMBERS,
        id: known.id,
        data: { emailVerified: true },
        depth: 0,
      })
    }
    const member =
      known ??
      (await db.create({
        collection: MEMBERS,
        data: { email, nickname, status: 'active', emailVerified: true, test: options.test === true },
        depth: 0,
      }))
    return startSession(db, member, time)
  }

  async function sessionFromRequest(request: HasHeaders): Promise<MemberSession | null> {
    const token = tokenOf(request)
    if (!token) return null
    const db = await payload()
    const { docs } = await db.find({
      collection: SESSIONS,
      where: { tokenHash: { equals: tokenHash(token) } },
      limit: 1,
      pagination: false,
      depth: 1,
    })
    const row = docs[0]
    if (!row || Date.parse(row.expiresAt) <= now().getTime()) return null
    const member = row.member
    if (typeof member !== 'object' || member.status !== 'active') return null
    return { memberId: String(member.id), nickname: member.nickname }
  }

  async function signOut(request: HasHeaders): Promise<SessionCookie> {
    const token = tokenOf(request)
    if (token) {
      const db = await payload()
      await db.delete({ collection: SESSIONS, where: { tokenHash: { equals: tokenHash(token) } } })
    }
    return cookie('', 0)
  }

  async function account(memberId: string): Promise<Account | null> {
    if (!/^[1-9][0-9]*$/.test(memberId)) return null
    const db = await payload()
    const member = await db.findByID({
      collection: MEMBERS,
      id: Number(memberId),
      depth: 0,
      disableErrors: true,
    })
    if (!member || member.status !== 'active') return null
    return {
      email: member.email,
      nickname: member.nickname,
      mailNotices: member.mailNotices !== false,
      emailVerified: member.emailVerified === true,
    }
  }

  /** The mail address of a member. Null when the email is not verified: no mail goes. */
  async function contact(memberId: string): Promise<Contact | null> {
    const found = await account(memberId)
    if (!found?.emailVerified) return null
    return { email: found.email, nickname: found.nickname, mailNotices: found.mailNotices }
  }

  async function updateAccount(
    session: MemberSession,
    change: { nickname?: string; mailNotices?: boolean },
  ) {
    const nickname = change.nickname === undefined ? undefined : checkNickname(change.nickname)
    if (nickname === null) return { ok: false as const, error: 'invalid-nickname' as const }
    if (!(await account(session.memberId))) return { ok: false as const, error: 'gone' as const }
    const db = await payload()
    await db.update({
      collection: MEMBERS,
      id: Number(session.memberId),
      data: {
        ...(nickname !== undefined ? { nickname } : {}),
        ...(change.mailNotices !== undefined ? { mailNotices: change.mailNotices } : {}),
      },
      depth: 0,
    })
    return { ok: true as const, account: (await account(session.memberId))! }
  }

  async function testMembers(): Promise<string[]> {
    const db = await payload()
    const { docs } = await db.find({
      collection: MEMBERS,
      where: { test: { equals: true } },
      pagination: false,
      depth: 0,
      select: {},
    })
    return docs.map((doc) => String(doc.id))
  }

  const { redeemInvite, invites } = makeInvites({
    payload,
    now,
    keyed,
    limits: { perEmail: REQUESTS_PER_EMAIL, perIp: REQUESTS_PER_IP, perStack: codesPerHour },
    signInOf: config.signInOf ?? (async () => null),
    findMember,
    withLock,
    startSession,
  })

  return {
    requestCode,
    verifyCode,
    redeemInvite,
    invites,
    sessionFromRequest,
    testMembers,
    signOut,
    contact,
    account: (session) => account(session.memberId),
    updateAccount,
  }
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function tokenOf(request: HasHeaders): string | null {
  const header = request.headers.get('cookie') ?? ''
  for (const pair of header.split(/;\s*/)) {
    const split = pair.indexOf('=')
    if (split !== -1 && pair.slice(0, split) === COOKIE) {
      const value = pair.slice(split + 1)
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null
    }
  }
  return null
}
