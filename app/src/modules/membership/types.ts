import type { Payload } from 'payload'

import type { Contact, Mailer } from '@/modules/mail'
import type { SignInMode } from '@/modules/projects'
import type { MemberSession } from '@/modules/stories'

export type { Contact, MemberSession, SignInMode }

export interface MembershipConfig {
  /** The Payload instance, or a function that gives it on first use. */
  payload: Payload | (() => Promise<Payload>)
  /** ANNOUDIO_ORIGIN. With `https:`, the session cookie is `Secure`. */
  origin: string
  /** The key of the code hash. Use PAYLOAD_SECRET. */
  secret: string
  /** The port of the `mail` module. M1 (the login code) is the only mail of this module. */
  mailer: Mailer
  /** The most login codes that the stack sends in one rolling hour. Default 100. */
  codesPerHour?: number
  /** Default: the system clock. Tests give a manual clock. */
  now?: () => Date
  /**
   * The sign-in mode of a project by its slug, or null for an unknown project. Given by
   * `payload.config.ts` from `projects.bySlug`. Without it, no project takes invite codes.
   */
  signInOf?: (project: string) => Promise<SignInMode | null>
}

/** The shape that Next `cookies().set()` takes. Set it on the response as it is. */
export interface SessionCookie {
  name: string
  value: string
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: '/'
  /** Seconds. 0 deletes the cookie. */
  maxAge: number
}

export interface RequestCodeOptions {
  /**
   * The IP address of the request, for the limit of 20 codes per address per hour.
   * Without it, only the per-email and the per-stack limits apply.
   */
  ip?: string
  /** The project name of the Annotate page: the sender name and the subject of M1. */
  site?: string
}

export type RequestCodeResult =
  { ok: true } | { ok: false; error: 'invalid-email' | 'rate-limited' | 'send-failed' }

export type VerifyCodeError =
  | 'invalid-email'
  | 'wrong-code'
  | 'no-code'
  | 'too-many-attempts'
  | 'nickname-required'
  | 'invalid-nickname'

export type VerifyCodeResult =
  | { ok: true; session: MemberSession; cookie: SessionCookie }
  | { ok: false; error: VerifyCodeError }

export type RedeemInviteError =
  | 'invalid-email'
  | 'wrong-code'
  | 'expired'
  | 'used-up'
  | 'not-allowed'
  | 'email-verified'
  | 'rate-limited'
  | 'nickname-required'
  | 'invalid-nickname'

export type RedeemInviteResult =
  | { ok: true; session: MemberSession; cookie: SessionCookie }
  | { ok: false; error: RedeemInviteError }

export interface RedeemInviteOptions {
  /** The IP address of the request, for the limit of 20 failed tries per address per hour. */
  ip?: string
  /** The project of the Annotate page. A code of another project gives `wrong-code`. */
  project?: string
  /** A new member is a test member (`SignInOptions.test`). */
  test?: boolean
}

export interface SignInOptions {
  /**
   * True when the browser also has an operator session: an operator tries the member
   * steps. A member made by this sign-in is a test member; an existing member stays as it is.
   */
  test?: boolean
}

/** The account of a member, for Your account. */
export interface Account extends Contact {
  /** True after a login code. An invite code proves no email: such a member gets no mail. */
  emailVerified: boolean
}

export interface MakeInvites {
  /** 1 to 100 codes. */
  count: number
  /** For the operator only, for example "Workshop 12 Oct". */
  label?: string
  /** After this time the codes sign nobody in. Null or absent: no expiry. */
  expiresAt?: Date | null
  /** How many members can use each code: 1 to 1000. Default 1. */
  uses?: number
}

/** One invite code as the operator sees it. The code itself shows only once, at `create`. */
export interface Invite {
  id: string
  /** The first 2 characters of the code, so the operator can tell the codes apart. */
  hint: string
  label: string | null
  createdAt: string
  expiresAt: string | null
  uses: number
  /** The members who used the code. */
  used: number
  state: 'active' | 'expired' | 'used-up' | 'revoked'
}

export interface Invites {
  /** Make codes for a project. The answer holds the codes; the store keeps only hashes. */
  create(
    project: string,
    options: MakeInvites,
  ): Promise<
    | { ok: true; codes: string[] }
    | { ok: false; error: 'unknown-project' | 'invalid-count' | 'invalid-uses' }
  >
  /** The codes of a project, newest first. */
  list(project: string): Promise<Invite[]>
  /** Stop a code. Members who used it keep their sessions. False for an unknown id. */
  revoke(id: string): Promise<boolean>
  /** The codes that a member signed in with, oldest first: the member page shows them. */
  ofMember(memberId: string): Promise<{ hint: string; label: string | null; project: string }[]>
}

/** Anything with request headers: a `Request`, or `{ headers: await headers() }` in Next. */
export interface HasHeaders {
  headers: Headers
}

export interface Membership {
  /**
   * Send a login code to the email. The answer is the same for a new, a known and a
   * blocked email. A blocked member gets no mail. Limits, each in one rolling hour:
   * 5 requests per email, 20 per IP address, `codesPerHour` per stack. A request over
   * a limit gives `rate-limited`, sends nothing and does not count.
   */
  requestCode(email: string, options?: RequestCodeOptions): Promise<RequestCodeResult>
  /**
   * Check the newest code of the email. On success, set `cookie` on the response.
   * A new email needs `nickname`: without it, a correct code gives `nickname-required`
   * and stays usable.
   */
  verifyCode(
    email: string,
    code: string,
    nickname?: string,
    options?: SignInOptions,
  ): Promise<VerifyCodeResult>
  /**
   * Sign in with an invite code of a project (design/invite-codes.md). The email names the
   * member but is not checked: a new member has `emailVerified: false`. A verified email
   * gives `email-verified` (it signs in with a login code). A new email needs `nickname`,
   * as in `verifyCode`. Limits, each in one rolling hour: 5 failed tries per email, 20 per
   * IP address, `codesPerHour` per stack; a correct code does not count.
   */
  redeemInvite(
    email: string,
    code: string,
    nickname?: string,
    options?: RedeemInviteOptions,
  ): Promise<RedeemInviteResult>
  /** The invite codes of the projects, for operators. The caller checks the operator. */
  invites: Invites
  /** The ids of the test members (made by an operator), as `MemberSession.memberId`. Counts leave them out. */
  testMembers(): Promise<string[]>
  /** The member of the session cookie, or null. Null also for a blocked member. Never throws for bad input. */
  sessionFromRequest(request: HasHeaders): Promise<MemberSession | null>
  /** End the session of the cookie. Set the returned (expired) cookie on the response. */
  signOut(request: HasHeaders): Promise<SessionCookie>
  /**
   * The email, name and mail choice of a member, for the mails. Null for an unknown or a
   * blocked member, and for a member with an unverified email (design/invite-codes.md).
   */
  contact(memberId: string): Promise<Contact | null>
  /** The account of the signed-in member, for Your account. Null when the member is gone. */
  account(session: MemberSession): Promise<Account | null>
  /**
   * Change the name or the mail choice of the signed-in member. A new name shows on the
   * stories that the member sends after the change.
   */
  updateAccount(
    session: MemberSession,
    change: { nickname?: string; mailNotices?: boolean },
  ): Promise<{ ok: true; account: Account } | { ok: false; error: 'invalid-nickname' | 'gone' }>
}
