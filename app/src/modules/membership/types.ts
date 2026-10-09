import type { Payload } from 'payload'

import type { Contact, Mailer } from '@/modules/mail'
import type { MemberSession } from '@/modules/stories'

export type { Contact, MemberSession }

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
  verifyCode(email: string, code: string, nickname?: string): Promise<VerifyCodeResult>
  /** The member of the session cookie, or null. Null also for a blocked member. Never throws for bad input. */
  sessionFromRequest(request: HasHeaders): Promise<MemberSession | null>
  /** End the session of the cookie. Set the returned (expired) cookie on the response. */
  signOut(request: HasHeaders): Promise<SessionCookie>
  /** The email, name and mail choice of a member, for the mails. Null for an unknown or a blocked member. */
  contact(memberId: string): Promise<Contact | null>
  /** The account of the signed-in member, for Your account. Null when the member is gone. */
  account(session: MemberSession): Promise<Contact | null>
  /**
   * Change the name or the mail choice of the signed-in member. A new name shows on the
   * stories that the member sends after the change.
   */
  updateAccount(
    session: MemberSession,
    change: { nickname?: string; mailNotices?: boolean },
  ): Promise<{ ok: true; account: Contact } | { ok: false; error: 'invalid-nickname' | 'gone' }>
}
