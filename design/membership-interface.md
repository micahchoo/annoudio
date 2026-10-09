# `membership` interface

Date: 2026-10-09. Phase 3. Read `CONTEXT.md` first; this file uses its words.

## Interface

```ts
// app/src/modules/membership/index.ts — the only import path
export const membersCollection, memberSessionsCollection, loginCodesCollection: CollectionConfig
export function createMembership(config: MembershipConfig): Membership
export function smtpMailer(options: { url: string; from: string }): Mailer
export function memoryMailer(options?: { echo?: boolean }): MemoryMailer

interface MembershipConfig {
  payload: Payload | (() => Promise<Payload>)
  origin: string            // ANNOUDIO_ORIGIN; https gives a Secure cookie
  secret: string            // PAYLOAD_SECRET; key of the code hash
  mailer: Mailer
  codesPerHour?: number     // ANNOUDIO_CODES_PER_HOUR; default 100 per stack
  now?: () => Date          // tests give a manual clock
}
interface Membership {
  requestCode(email: string, options?: { ip?: string }): Promise<{ ok: true } | { ok: false; error: 'invalid-email' | 'rate-limited' | 'send-failed' }>
  verifyCode(email: string, code: string, nickname?: string): Promise<
    | { ok: true; session: MemberSession; cookie: SessionCookie }
    | { ok: false; error: 'invalid-email' | 'wrong-code' | 'no-code' | 'too-many-attempts' | 'nickname-required' | 'invalid-nickname' }>
  sessionFromRequest(request: { headers: Headers }): Promise<MemberSession | null>
  signOut(request: { headers: Headers }): Promise<SessionCookie>   // an expired cookie
}
interface Mailer { send(message: { to: string; subject: string; text: string }): Promise<void> }
```

`MemberSession` is the type of `stories` (`{ memberId, nickname }`). `SessionCookie` has the shape that Next `cookies().set()` takes: `name`, `value`, `httpOnly`, `secure`, `sameSite`, `path`, `maxAge`.

## Behaviour

- **Login code.** 6 digits. It expires 10 minutes after the request. A new request replaces the older codes of that email. One correct use consumes it. Five wrong tries kill it. The store holds `HMAC-SHA256(secret, email:code)`, never the code.
- **Rate limits.** In one rolling hour: at most 5 requests per email, 20 per IP address (when the caller gives `ip`), and `codesPerHour` (default 100) per stack. A request over a limit gives `rate-limited`, sends nothing and does not count. The check and the insert of the new code are one step: a stack-wide advisory lock (`pg_advisory_xact_lock`) in one transaction, so parallel requests at a limit cannot both pass (Phase 3b). The store keeps `HMAC-SHA256(secret, "ip:" + ip)`, never the address. A request for a blocked member stores an unsent code, so it counts like any other request (invariant 3).
- **First sign-in.** A correct code for an email without a member gives `nickname-required`. That answer does not consume the code and does not use up a try. The caller asks for a nickname and calls `verifyCode` again with it. Only then the module makes the member. So no member ever exists without a nickname.
- **Session.** A random 32-byte token in the httpOnly cookie `annoudio-member` (`SameSite=Lax`, 30 days). The `member-sessions` table holds its SHA-256. `signOut` deletes the row.
- **Blocked member.** `sessionFromRequest` gives `null` on the next request. `requestCode` answers `ok` but sends no mail. `verifyCode` cannot succeed, because no code exists.

## Invariants

1. Emails are stored trimmed and in lower case. Lookups normalise first.
2. A nickname is 1 to 40 characters after trimming and has no `@`. The UI never shows an email to visitors; the nickname is the only name in a story.
3. The answers of `requestCode` do not tell if a member exists or is blocked.
4. `verifyCode` counts the try before it compares the code, with one atomic SQL update (`attempts < 5`). It marks the code used with a second atomic update (`used_at is null`). So parallel requests cannot check more than 5 guesses, and cannot use one code two times. On `nickname-required` and `invalid-nickname` the code was correct, so the module gives the try back.
5. `members` is not a Payload auth collection, and the member cookie is not `payload-token` (reasons below). A member is never `req.user`, so no Payload access rule ever treats a member as an operator.

## Why a session table, not Payload's JWT

Payload 3.90 reads one cookie, `${cookiePrefix}-token`, for every auth collection (`auth/extractJWT.js`). Its JWT strategy refuses a collection with `disableLocalStrategy` (`auth/strategies/jwt.js`), so a member must also have a password and the `/api/members/login` and forgot-password routes. And a member token in that cookie makes the member `req.user`: Payload's default access (`Boolean(req.user)`) then lets a member write projects, recordings and concepts through REST. A custom strategy on `members` has the same effect: `executeAuthStrategies` runs every strategy for every request, the admin included. One small table and our own cookie avoid all three problems.

## Error modes

- `send-failed`: the mailer threw. The module deletes the new code, so the failed request does not count toward the rate limit.
- `no-code`: no live code for the email. It expired, it was used, a newer code replaced it, or none was requested.
- A missing or unknown cookie, an expired session and a blocked member all give `null` from `sessionFromRequest`. It never throws for bad input.

## Operator view

The admin lists members (email, nickname, status, created). An operator can change `status` to `blocked` and back, and can edit the nickname. Operators cannot create or delete members in the admin; the login flow creates them.

## Not in this module

The Annotate page owns the forms and the strings. `projects` owns the check of the `return` URL.
