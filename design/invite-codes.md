# Invite codes: sign in without a mail server

Date: 2026-10-09. Read `CONTEXT.md` first; this file uses its words. New term: **invite code**, an 8-character code that an operator makes for a project and gives to members by hand (on paper, in a chat). It replaces the login code where the stack cannot send mail.

## Why

A login code needs SMTP. A stack without `SMTP_URL` (a workshop laptop, the demo, a small organisation) can not sign members in. Invite codes let it.

## The project setting

`projects.signIn`: `email-code` | `invite-code` | `both`. A new project gets `email-code` when the stack can send mail (`SMTP_URL` set, or the test mailbox), else `invite-code`. Rows made before this field read as `email-code`. Without `SMTP_URL`, Today says: "No mail server: members sign in with invite codes." The Annotate page shows the forms that the mode allows, and its Server Action refuses the other intents. Your stories and Your account (no project) offer invite codes always, and login codes only when the stack can send mail.

## Interface (in `membership`, not a new module)

```ts
membership.redeemInvite(email, code, nickname?, { ip?, project? })  // → like verifyCode, plus 'rate-limited' | 'email-verified' | 'not-allowed' | 'expired' | 'used-up'
membership.invites.create(project, { count, label?, expiresAt?, uses }) // → { ok, codes: string[] } (the only time a code is visible)
membership.invites.list(project)   // → rows: id, hint, label, createdAt, expiresAt, uses, used, revokedAt
membership.invites.revoke(id)
```

`invites` sits in `membership` because a redeem shares everything with a login code: the secret, the keyed hash, the advisory-lock rate limit, the member creation and the session. A separate module would need the members table of `membership`. `membership` learns the mode of a project through `MembershipConfig.signInOf(slug)` (given by `payload.config.ts` from `projects.bySlug`), so it reads no projects collection.

## Behaviour

- **Code.** 8 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no 0 O 1 I L): 31⁸ ≈ 8.5 × 10¹¹. Shown as `ABCD-EFGH`; input is upper-cased and loses spaces and hyphens. The store holds `HMAC-SHA256(secret, "invite:" + code)` and a hint (the first 2 characters), never the code. 1 to 100 codes per batch.
- **Uses.** Each code allows `uses` members (1 to 1000). A use is one member: a member who used a code signs in again with it and uses nothing.
- **Expiry and revoke.** After `expiresAt` or a revoke, the code signs nobody in.
- **Rate limit.** Like login codes, in one rolling hour: 5 failed tries per email, 20 per IP address, `codesPerHour` per stack. The module stores the try before the check (one transaction under an advisory lock) and deletes it when the code is correct. Over a limit: `rate-limited`, and the code is not checked.
- **First sign-in.** As `verifyCode`: `nickname-required`, then a second call with the name. The try is given back.
- **Mode.** A code of a project in `email-code` mode gives `not-allowed`. With `project`, a code of another project gives `wrong-code`.

## Trust model

**An invite code proves that you hold the code, not that you own the email.** So:

1. `members.emailVerified`: true after a login code (`verifyCode`), false for a member that an invite code made. A later login code sets it to true.
2. Member mails (M2–M5) go only to a verified email: `membership.contact` gives null for an unverified member. Your stories shows the changes instead, with the line "We do not send you mail…".
3. An invite code never opens the account of a verified email (`email-verified`: "This email signs in with a login code."). A code holder can still sign in as any unverified member. An operator who sees misuse revokes the code and blocks the member.

## Tests (through the interfaces)

Int: create (count, shown once, hashed), redeem new and returning member, nickname step, expiry, uses (one member, many, the same member again), revoke, wrong project, `email-code` mode, rate limits, `emailVerified` false then true after a login code, `contact` null for unverified. E2E (Chromium, muted): the operator makes codes on the project page, a member signs in with one and tells a story; an `email-code` project shows no invite form.
