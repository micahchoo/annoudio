# Phase 3 notes: `membership` and the Annotate page

Date: 2026-10-09. Scope: ROADMAP Phase 3, text stories only. Read `CONTEXT.md` first. This file uses its words.

## What was built

| Part | Where |
|---|---|
| `membership` module | `app/src/modules/membership/`. `index.ts` is the interface (`design/membership-interface.md`). Internal files: `create.ts`, `collections.ts`, `rules.ts`, `mailer.ts`, `types.ts`. |
| Mailer port | `smtpMailer` (nodemailer 7) and `memoryMailer`. `payload.config.ts` chooses: `SMTP_URL` set → SMTP; else memory, which writes each code to the server log. |
| `projects` | New field `siteOrigins` (array of origins). `bySlug` gives `siteOrigins` and `rightsLine`. New pure function `returnTarget(project, value)`: the open-redirect check. |
| `catalogue` | `recording()` gives `urls`. |
| `vocabulary` | New lookup `conceptsOf(project)`: all concepts with their parent IRI, in label order. |
| Annotate page | `app/src/app/(frontend)/annotate/`: `page.tsx` (server), `actions.ts` (Server Actions), `SignInForm.tsx` and `StoryForm.tsx` (client), `link.ts` (query, fragment, UUIDv7), `state.ts`, `strings.ts` (all text), `not-found.tsx`, `annotate.css`. |
| Test mailbox | `app/src/app/(frontend)/test-mailbox/route.ts`. 404 unless `ANNOUDIO_TEST_MAILBOX=1`, no `SMTP_URL`, and not a production build. |
| Tests | `app/tests/int/membership/membership.int.spec.ts` (22), `app/tests/int/projects/return-target.int.spec.ts` (11), `app/tests/e2e/annotate.e2e.spec.ts` (4). |

## Decisions

1. **Session: our own cookie and a session table, not Payload's JWT.** Payload 3.90 reads one cookie name (`payload-token`) for every auth collection, its JWT strategy needs the local (password) strategy, and a member in that cookie becomes `req.user`. Payload's default access is `Boolean(req.user)`, so a member could then write projects and concepts through REST. A custom auth strategy has the same effect: Payload runs every strategy on every request. Details: `design/membership-interface.md`. The cookie is `annoudio-member`: httpOnly, `SameSite=Lax`, `Secure` when `ANNOUDIO_ORIGIN` is https, 30 days. `Lax` is necessary: the member arrives by a top-level link from the host site, and `Strict` would not send the cookie on that navigation.
2. **Where the code is stored.** Table `login_codes`: email, `HMAC-SHA256(PAYLOAD_SECRET, email:code)`, `requestedAt`, `expiresAt`, `attempts`, `usedAt`. Rows older than one hour are deleted on each request. Session tokens are stored as SHA-256 in `member_sessions`.
3. **6 digits.** With 5 tries per code and 5 codes per hour, a guesser gets 25 guesses per email per hour: a chance of 1 in 40 000 per hour.
4. **First sign-in.** A correct code for a new email gives `nickname-required` and stays usable. The page then asks for the name and sends the code again with it. So no member exists without a nickname, and the interface needs no "pending" state.
5. **The Annotate page plays the recording with a plain `<audio controls>`**, not `<annoudio-player>`. Reasons: the "Use the player time" buttons need the current time, and the v1 player contract (`CONTRACT.md` §4) gives the time only in `play` and `pause` events; and the player is in progress in `embed/`. The page starts the audio at `t` with a Media Fragment in `src` (`…#t=42`), so this works before hydration.
6. **Server Actions** for every form. Next checks `Origin` against `Host` on each action (CSRF). Each action reads the session again. The save action checks `return` again with `returnTarget`; it never trusts the hidden field.
7. **The story id** is a UUIDv7 that the page makes when it renders the form. A failed save keeps the id. A successful save redirects, so the next form gets a new id. A change of an own story (`?story=<id>`) reuses its id and sends its ETag as `ifMatch`.
8. **Uncontrolled form fields.** After an error, the save action gives back the values it got, and the form shows them as default values. React 19 resets a form after its action, so controlled fields are not needed.
9. **After a save** with a valid `return`: a redirect to `return` without its fragment, plus `#annoudio-t=<start>&annoudio-project=…&annoudio-recording=…&annoudio-saved=draft`. Without a valid `return`: a redirect to the Annotate page with `t=<start>&saved=1`, which shows "Your story is saved. It shows in the player after review."
10. **Unknown project or recording** gives `notFound()`: status 404 and the plain-language page in `not-found.tsx`.

## Deviations from the brief

1. **`members` is not a Payload auth collection** (decision 1). It is a normal collection with `email`, `nickname`, `status`. Operators can read and update it; nobody can create or delete through the admin or REST.
2. **Three collection exports**, not one: `membersCollection`, `memberSessionsCollection`, `loginCodesCollection`. Payload makes one table per collection config (same reason as Phase 1 deviation 1). The two extra ones are hidden and closed to REST and GraphQL.
3. **`verifyCode(email, code, nickname?)`** has a third parameter for the first sign-in (decision 4).
4. **`sessionFromRequest` takes `{ headers }`**, so a `Request` and Next `headers()` both fit.
5. **`signOut` returns the expired cookie.** The caller sets it.
6. **The test mailbox switch is `ANNOUDIO_TEST_MAILBOX=1`, not `NODE_ENV=test`.** Next writes `NODE_ENV` into the server bundle at build time (`development` under `next dev`), so a runtime `NODE_ENV=test` is not visible to the route. The switch also needs a build that is not a production build.
7. **`<audio>`, not `<annoudio-player>`** on the Annotate page (decision 5).
8. **`next.config.ts` reads `NEXT_DIST_DIR`** (default `.next`). The Playwright server uses `.next-e2e`, so it runs next to a `pnpm dev` (another agent works in this tree). `.gitignore` and the lint config ignore `.next-e2e`.
9. **The template e2e tests** (`admin`, `frontend`) and `tests/helpers/*` now use the e2e server on port 3100 and the test database. Before, `seedUser` wrote to the development database.
10. **`siteOrigins` is optional.** With no rows, the page drops every `return`. A required field would break the seeds of the Phase 1 tests (shared fixtures).

## How to run

From the repository root:

```sh
docker compose -f deploy/docker-compose.dev.yml up -d --wait
cd app
pnpm tsc --noEmit
pnpm lint
pnpm test:int      # 87 tests
pnpm test:e2e      # 8 tests: 4 Annotate, 4 template
```

Playwright needs its Chromium build once: `pnpm exec playwright install chromium`. On this machine (Ubuntu 26.04), Playwright refuses the platform; use `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 pnpm exec playwright install chromium`.

To sign in during development without SMTP: open the Annotate page, ask for a code, and read it in the terminal that runs `pnpm dev` (`[mail to …] Your login code: …`).

## Test map

| Behaviour | Test |
|---|---|
| requestCode sends a code (memory mailer), normalised email | membership `sends a 6-digit login code…` |
| Rate limit 5 per email per hour; window moves | `allows 5 requests per email per hour…` |
| Mailer failure does not count | `gives send-failed…` |
| First sign-in asks for a nickname, then makes the member | `on first sign-in asks for a nickname…` |
| Wrong code, 5 tries | `gives wrong-code…, and too-many-attempts after 5 wrong tries` |
| Expired (10 minutes, boundary both sides) | `gives no-code for an expired code`, `accepts a code just before it expires` |
| Reused, parallel reuse | `gives no-code for a code that was used`, `lets only one of two parallel uses…` |
| Session round trip through a `Cookie` header | `gives an httpOnly, Lax, Secure cookie…` |
| signOut, session expiry, blocked member | `signOut ends the session…`, `ends after 30 days`, `a blocked member…` |
| `return` check | `return-target.int.spec.ts` (11) |
| Unknown project page | e2e `an unknown project…` |
| Unlisted `return` is dropped | e2e `a return URL with an unlisted origin is dropped…` |
| Full flow: link → email → code → nickname → story 42–51 with a tag → host page with fragment → `stories.publish` → `GET /stories/{project}/{recording}/` shows it; own story listed and changed with the same id | e2e `a member signs in, writes a story…` |
| Sign out | e2e `sign out ends the session` |

Mutation check (one fault at a time; the named test failed each time): no `attempts < 5` guard, no `used_at is null` guard, no expiry check, no blocked check in `requestCode`, no rate limit.

## Known gaps and what is unverified

- **Text typed before hydration can be lost.** In the e2e test, text that Playwright typed into the story textarea before React hydrated was replaced or merged. The test now waits for `networkidle` after a full page load. A member on a slow device can see the same problem. Not fixed.
- **No limit per IP address.** Anybody can make the app send up to 5 mails per hour to each address. Add a per-IP or global limit before a public launch.
- **The rate-limit count is not atomic.** Two parallel requests at the limit can both pass. The try limit and single use are atomic.
- **Real SMTP is not tested.** `smtpMailer` has no test against a server. Payload's own mails (operator password reset) still have no email adapter: Payload logs "No email adapter provided".
- **Cross-site cookie behaviour is not tested in a browser.** The tests open the Annotate page directly. `SameSite=Lax` on a link from another site follows the standard; no test checks it.
- **`pnpm build` was not run** in this phase.
- **The start at `t` and the "Use the player time" buttons are not tested.** The e2e recording URL is not a real audio file.
- **Media bodies.** Changing an own story keeps only its text bodies (Phase 4 must keep media bodies).
- **The `projects.site` field** (Phase 0) and `siteOrigins` overlap. Decide in Phase 5 if `site` can go.
- **No admin "Publish" test.** The e2e test publishes through `stories.publish`. Phase 1 showed that the admin button runs the same hook.
