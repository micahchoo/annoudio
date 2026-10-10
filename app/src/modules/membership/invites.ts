// Invite codes: sign in without a mail server (design/invite-codes.md). Internal to
// `membership`; `create.ts` gives the shared parts (hash key, lock, session).

import { randomInt } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

import type { LockedDb } from './create'
import { INVITE_TRIES, INVITE_USES, INVITES, MEMBERS } from './collections'
import { checkNickname, normaliseEmail } from './rules'
import type {
  Invite,
  Invites,
  MakeInvites,
  MemberSession,
  RedeemInviteError,
  RedeemInviteOptions,
  RedeemInviteResult,
  SessionCookie,
  SignInMode,
} from './types'

/** No 0, O, 1, I or L: a code on paper reads one way only. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const LENGTH = 8
const HOUR = 60 * 60 * 1000
const MAX_COUNT = 100
const MAX_USES = 1000

type MemberRow = {
  id: number | string
  nickname: string
  status?: string | null
  emailVerified?: boolean | null
}

export interface InviteContext {
  payload: () => Promise<Payload>
  now: () => Date
  keyed: (value: string) => Buffer
  /** Failed tries in one rolling hour. */
  limits: { perEmail: number; perIp: number; perStack: number }
  signInOf: (project: string) => Promise<SignInMode | null>
  findMember: (db: Payload, email: string, req?: PayloadRequest) => Promise<MemberRow | null>
  withLock: <T>(
    db: Payload,
    key: string,
    work: (tx: LockedDb, req: PayloadRequest) => Promise<T>,
  ) => Promise<T>
  startSession: (
    db: Payload,
    member: { id: number | string; nickname: string },
    time: Date,
  ) => Promise<{ ok: true; session: MemberSession; cookie: SessionCookie }>
}

/** The stored form of a typed code: upper case, no spaces, no hyphens. */
function normaliseCode(value: string): string {
  return value.toUpperCase().replace(/[\s-]+/g, '')
}

function newCode(): string {
  return Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
}

const shown = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`

const allows = (mode: SignInMode | null) => mode === 'invite-code' || mode === 'both'

const isWhole = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max

export function makeInvites(ctx: InviteContext): {
  redeemInvite: (
    email: string,
    code: string,
    nickname?: string,
    options?: RedeemInviteOptions,
  ) => Promise<RedeemInviteResult>
  invites: Invites
} {
  const hashOf = (code: string) => ctx.keyed(`invite:${code}`).toString('hex')

  async function redeemInvite(
    rawEmail: string,
    rawCode: string,
    rawNickname?: string,
    options: RedeemInviteOptions = {},
  ): Promise<RedeemInviteResult> {
    const email = normaliseEmail(rawEmail)
    if (!email) return { ok: false, error: 'invalid-email' }
    const code = normaliseCode(rawCode)
    const db = await ctx.payload()
    const time = ctx.now()
    const hourAgo = new Date(time.getTime() - HOUR).toISOString()
    const ipHash = options.ip ? ctx.keyed(`ip:${options.ip}`).toString('hex') : null

    const outcome = await ctx.withLock(
      db,
      'annoudio.invites',
      async (tx, req): Promise<{ error: RedeemInviteError } | { member: MemberRow }> => {
        await tx.execute(sql`delete from invite_tries where tried_at < ${hourAgo}`)
        const counts = await tx.execute<{ email: number; ip: number; total: number }>(
          sql`select count(*) filter (where email = ${email})::int as email,
                     count(*) filter (where ip_hash = ${ipHash})::int as ip,
                     count(*)::int as total
              from invite_tries where tried_at >= ${hourAgo}`,
        )
        const count = counts.rows[0]
        if (
          !count ||
          count.email >= ctx.limits.perEmail ||
          count.ip >= ctx.limits.perIp ||
          count.total >= ctx.limits.perStack
        ) {
          return { error: 'rate-limited' }
        }
        // A failed try counts toward the limits. A correct, live code does not.
        const fail = async (error: RedeemInviteError) => {
          await db.create({
            collection: INVITE_TRIES,
            data: { email, ipHash, triedAt: time.toISOString() },
            depth: 0,
            req,
          })
          return { error }
        }

        const { docs } =
          code.length === LENGTH
            ? await db.find({
                collection: INVITES,
                where: { codeHash: { equals: hashOf(code) } },
                limit: 1,
                pagination: false,
                depth: 0,
                req,
              })
            : { docs: [] }
        const invite = docs[0]
        if (!invite || (options.project && invite.project !== options.project)) {
          return fail('wrong-code')
        }
        if (
          invite.revokedAt ||
          (invite.expiresAt && Date.parse(invite.expiresAt) <= time.getTime())
        ) {
          return fail('expired')
        }
        if (!allows(await ctx.signInOf(invite.project))) return { error: 'not-allowed' }

        const known = await ctx.findMember(db, email, req)
        if (known?.status === 'blocked') return fail('wrong-code')
        // Trust model: an invite code proves no email, so it never opens a verified one.
        if (known?.emailVerified) return { error: 'email-verified' }
        const usedBefore =
          known !== null &&
          (
            await db.count({
              collection: INVITE_USES,
              where: { and: [{ invite: { equals: invite.id } }, { member: { equals: known.id } }] },
              req,
            })
          ).totalDocs > 0
        if (!usedBefore) {
          const { totalDocs } = await db.count({
            collection: INVITE_USES,
            where: { invite: { equals: invite.id } },
            req,
          })
          if (totalDocs >= invite.uses) return fail('used-up')
        }

        const nickname = known
          ? known.nickname
          : rawNickname === undefined
            ? null
            : checkNickname(rawNickname)
        if (!nickname) {
          return { error: rawNickname === undefined ? 'nickname-required' : 'invalid-nickname' }
        }
        const member =
          known ??
          (await db.create({
            collection: MEMBERS,
            data: { email, nickname, status: 'active', emailVerified: false, test: options.test === true },
            depth: 0,
            req,
          }))
        if (!usedBefore) {
          await db.create({
            collection: INVITE_USES,
            data: { invite: invite.id, member: Number(member.id) },
            depth: 0,
            req,
          })
        }
        return { member }
      },
    )
    if ('error' in outcome) return { ok: false, error: outcome.error }
    return ctx.startSession(db, outcome.member, time)
  }

  const invites: Invites = {
    async create(project: string, options: MakeInvites) {
      const uses = options.uses ?? 1
      if (!isWhole(options.count, 1, MAX_COUNT)) return { ok: false, error: 'invalid-count' }
      if (!isWhole(uses, 1, MAX_USES)) return { ok: false, error: 'invalid-uses' }
      if ((await ctx.signInOf(project)) === null) return { ok: false, error: 'unknown-project' }
      const db = await ctx.payload()
      const label = options.label?.trim() || null
      const codes = new Set<string>()
      while (codes.size < options.count) codes.add(newCode())
      for (const code of codes) {
        await db.create({
          collection: INVITES,
          data: {
            project,
            codeHash: hashOf(code),
            hint: code.slice(0, 2),
            label,
            uses,
            expiresAt: options.expiresAt ? options.expiresAt.toISOString() : null,
          },
          depth: 0,
        })
      }
      return { ok: true, codes: [...codes].map(shown) }
    },

    async list(project: string): Promise<Invite[]> {
      const db = await ctx.payload()
      const { docs } = await db.find({
        collection: INVITES,
        where: { project: { equals: project } },
        sort: ['-createdAt', '-id'],
        pagination: false,
        depth: 0,
      })
      if (docs.length === 0) return []
      const ids = docs.map((doc) => Number(doc.id))
      const sqlDb = (db.db as unknown as { drizzle: LockedDb }).drizzle
      const used = await sqlDb.execute<{ id: number; used: number }>(
        sql`select invite_id as id, count(*)::int as used from invite_uses
            where invite_id in (${sql.join(ids, sql`, `)}) group by invite_id`,
      )
      const usedOf = new Map(used.rows.map((row) => [Number(row.id), row.used]))
      const time = ctx.now().getTime()
      return docs.map((doc) => {
        const count = usedOf.get(Number(doc.id)) ?? 0
        const expiresAt = doc.expiresAt ?? null
        return {
          id: String(doc.id),
          hint: doc.hint,
          label: doc.label ?? null,
          createdAt: doc.createdAt,
          expiresAt,
          uses: doc.uses,
          used: count,
          state: doc.revokedAt
            ? 'revoked'
            : expiresAt && Date.parse(expiresAt) <= time
              ? 'expired'
              : count >= doc.uses
                ? 'used-up'
                : 'active',
        }
      })
    },

    async ofMember(memberId: string) {
      if (!/^[1-9][0-9]*$/.test(memberId)) return []
      const db = await ctx.payload()
      const { docs } = await db.find({
        collection: INVITE_USES,
        where: { member: { equals: Number(memberId) } },
        sort: 'createdAt',
        pagination: false,
        depth: 1,
      })
      return docs.flatMap((use) =>
        typeof use.invite === 'object' && use.invite
          ? [{ hint: use.invite.hint, label: use.invite.label ?? null, project: use.invite.project }]
          : [],
      )
    },

    async revoke(id: string): Promise<boolean> {
      if (!/^[1-9][0-9]*$/.test(id)) return false
      const db = await ctx.payload()
      const found = await db.findByID({
        collection: INVITES,
        id: Number(id),
        depth: 0,
        disableErrors: true,
      })
      if (!found) return false
      if (!found.revokedAt) {
        await db.update({
          collection: INVITES,
          id: found.id,
          data: { revokedAt: ctx.now().toISOString() },
          depth: 0,
        })
      }
      return true
    },
  }

  return { redeemInvite, invites }
}
