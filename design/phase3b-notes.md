# Phase 3b notes: integration of `stories`, `player`, `projects` and `membership`

Date: 2026-10-09. Scope: the gaps that Phase 1, 2 and 3 left between the modules. Read `CONTEXT.md` first. This file uses its words. Nothing in `worker/` changed.

## Result

| Check | Result |
|---|---|
| `app`: `pnpm test:int` | 113 pass (7 files). Phase 3: 87. |
| `app`: `pnpm test:e2e` | 14 pass (Chromium). Phase 3: 8. |
| `embed`: `pnpm test` | 239 pass, 4 skipped, in Chromium, Firefox and WebKit. The 4 skips are the size check (runs once) and forced colours (Chromium only), each in Firefox and WebKit. |
| `tsc`, `lint` | Pass in both packages. `app` lint keeps 5 warnings in the Payload template files (`my-route`, `admin.e2e`, `frontend.e2e`). |
| `app`: `pnpm build` | Passes. First production build of the project. |
| `embed`: `pnpm build` | Loader 757 B gzip (limit 1024). Bundle `482bfd5f80e9`, 30 624 B gzip (limit 81 920). The previous bundle `0a45a8367040` stays. |

## What changed

| Task | Where | What |
|---|---|---|
| Embed headers | `app/next.config.ts` | `headers()` for `/embed/v1.js` and `/embed/v1/:hash([0-9a-f]{12})/:file`: CONTRACT §5.1 cache rules, `Access-Control-Allow-Origin: *`, `Cross-Origin-Resource-Policy: cross-origin`, `X-Content-Type-Options: nosniff`, `Content-Type: text/javascript; charset=utf-8`. |
| Payload client hints | `app/next.config.ts` | Payload's rule (`Accept-CH`, `Critical-CH`, `Vary: Sec-CH-Prefers-Color-Scheme`, `X-Powered-By`) now applies to `/admin/:path*` only. |
| Theme tokens | `app/src/modules/projects/theme.ts` | Group `themeTokens` ("Theme") in `projects`: 14 optional text fields, one per token of CONTRACT table 3.1, the default as placeholder, a syntax check per kind. |
| Theme route | `projects.theme(context, slug)`, `projects.handleTheme(context, request, file)`; route `app/src/app/(frontend)/embed/v1/themes/[file]/route.ts` (thin) | `{ "tokens": { … } }` with only the set tokens, in table order. Headers of CONTRACT §5.1. Strong ETag (SHA-256), 304, HEAD. 404 for an unknown project or a bad file name. |
| `currentTime` | `embed/src/element.ts`, `CONTRACT.md` §4.1, §4.3 | Read-only property and the event `annoudio:timeupdate` (at most 4 per second, trailing edge). Additive. |
| Annotate page | `app/src/app/(frontend)/annotate/StoryForm.tsx` | `<annoudio-player annotate="none" origin={ANNOUDIO_ORIGIN}>` with `<script async src="/embed/v1.js">`. `seek(t)` after `customElements.whenDefined`. The buttons read `currentTime`. |
| Rate limits | `app/src/modules/membership/create.ts` | Check and insert in one transaction under `pg_advisory_xact_lock(hashtext('annoudio.login-codes'))`. New limits: 20 per IP per hour, `codesPerHour` per stack (env `ANNOUDIO_CODES_PER_HOUR`, default 100). `requestCode(email, { ip })`. New column `login_codes.ip_hash`. |
| Client IP | `app/src/app/(frontend)/annotate/request-ip.ts` | Reads `X-Forwarded-For` by `TRUST_PROXY` (see decision 5). |
| `projects.site` | removed | Nothing read it. Fixtures did not set it. `siteOrigins` stays. Types regenerated. |
| Mute | `embed/playwright.config.ts`, `app/playwright.config.ts` | The tone of the tests no longer plays through the speakers (decision 8). |
| Rule | `.claude/rules/embed-build-output.md` | `app/public/embed/` is build output; keep two previous hash folders. |

## Decisions

1. **Theme cache rule from the contract, not from the brief.** The brief said `max-age=300`. CONTRACT §5.1 says `public, max-age=300, stale-while-revalidate=86400`, and `public, max-age=60` on 404. The route follows the contract. The fixture server sends the same.
2. **No colour picker.** Payload 3.90 has no colour field (`payload/dist/fields/config/types.d.ts`, `@payloadcms/ui/dist/fields/`). Each token is a text field. The admin check is a rough syntax check (hex, name, `rgb()`/`oklch()`/… for colours; a number with a CSS unit for lengths; letters, quotes and commas for fonts) and refuses `; { } < > \`. The player checks again with `CSS.supports()` (CONTRACT §3.2, rule 2). A custom colour component needs an import-map entry and gives no "empty" state; not worth it now.
3. **Payload client hints only on `/admin`.** Verified with `curl` on `next dev` and on `next start`. Only the admin reads the hint (`@payloadcms/next/dist/utilities/getRequestTheme.js`, used by the admin root layout). On the public routes, `Vary: Sec-CH-Prefers-Color-Scheme` splits shared cache keys for nothing, and `Critical-CH` can make a browser repeat a navigation. Next's own `Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch` stays on every app route (`next/dist/server/base-server.js` `setVaryHeader`; no config removes it). It does not split keys in practice: the player, `curl` and CDNs never send those request headers, and an absent header is one key.
4. **`currentTime` counts a waiting seek.** The brief said "the media element's current time". Before the duration is known, `seek(4)` waits (CONTRACT §4.2, rule 3) and the media element still says 0. The property gives the position that the player shows, which is 4. Otherwise the Annotate page fills 0 into the range. It is also `NaN` after the element leaves the document, and the `bundle-unavailable` fallback element has neither `seek` nor `currentTime` (contract text added).
5. **Client IP: the right side of `X-Forwarded-For`, not the first value.** The brief said "first value when `TRUST_PROXY=1`, else the socket address". Two facts change that:
   - Next 16 gives a Server Action no socket address. `base-server.js` writes the socket address into `X-Forwarded-For` with `??=`: only when the request has no such header. So the app cannot tell a client value from the socket address.
   - The first value is the one a client controls: a proxy that appends (nginx `proxy_add_x_forwarded_for`) keeps the client's value in front.
   So `TRUST_PROXY` is the number of proxies, and the IP is the `TRUST_PROXY`-th value from the right (0 and 1 both read the last value). With no proxy, a client can still choose its value and escape the per-IP limit; the per-stack limit holds. Production must run behind a proxy with `TRUST_PROXY=1` (Dokploy and Coolify both put Traefik in front). `deploy/` is not changed here: add `TRUST_PROXY=1` to the production compose when it exists.
6. **The store keeps an HMAC of the IP**, not the IP (`HMAC-SHA256(PAYLOAD_SECRET, "ip:" + ip)`). Rows are deleted after about one hour, on the next request.
7. **A blocked member's request now counts.** Before, it stored nothing, so the sixth request of a blocked email was not `rate-limited`: that told an attacker the member is blocked (invariant 3). Now it stores a code that is never sent.
8. **No `<audio>` fallback on the Annotate page.** The player's own `bundle-unavailable` message covers a failed bundle. The child content of the element is a link to the audio file: it shows before the loader runs and without JavaScript (CONTRACT §1, rule 5). The start at `t` uses `seek()`, not the `#annoudio-t=` fragment: the fragment also scrolls and moves focus to the player, which is wrong on a page where the member writes.
9. **Mute in tests.** Chromium: `--mute-audio` and env `PULSE_SERVER=/nonexistent`. WebKit: `PULSE_SERVER=/nonexistent` (it has no mute switch). Both then open no PulseAudio stream, and every test passes. Firefox: `media.volume_scale = "0.0"`. Firefox without PulseAudio stops playback (the `timeupdate` and `currentTime` tests failed), and the ALSA backend with a null device did not help. So Firefox still opens a stream, with silent samples. Checked with `pactl list sink-inputs` every 0.3 s during the full runs: app e2e 0 Playwright streams; embed 0 Chromium, 0 WebKit, 3 silent Firefox streams. (Before: streams from all three.)
10. **The real-routes player test uses a real host server.** The brief said "a bare page served by the e2e server". `tests/e2e/embed.e2e.spec.ts` starts a small HTTP server on `127.0.0.1:3199` with the snippet page and the audio. Reasons: a page from the Next server is same-origin, so it proves no CORS; and Chromium's Local Network Access blocks the loader for a page that Playwright routing serves ("Permission was denied for this request to access the `loopback` address space"), also for a routed `127.0.0.1` URL. The test seeds a project with theme tokens, a recording, and a story through `stories.saveDraft` and `stories.publish`. It checks `annoudio:ready` (1 story), the story text and nickname, the theme accent on `play-button`, the Annotate `href`, and no console errors.
11. **Test audio.** The app e2e tests use the player fixture `embed/tests/fixture/media/tone.m4a` (10 s), through `tests/e2e/tone.ts`, which answers Range requests. Without Range answers, Chromium cannot seek, and `seek(4)` stays at 0.

## Hydration text loss (phase 3 gap)

Cause found: React 19.2 `initTextarea` (react-dom client) runs during hydration. When the server text of a textarea is not empty, it sets `element.value` back to that text. So an edit to a **pre-filled** textarea (changing an own story) made before hydration is lost. A textarea with an empty default (a new story) keeps typed text.

Tested (`annotate.e2e.spec.ts`, "text typed into a new story before hydration stays, and the form saves without JavaScript"): the test holds every `/_next/static/**/*.js` request, types a new story, then releases the scripts; the text stays. With all scripts aborted, the form posts through the browser and the story saves. So the forms work before hydration.

Not fixed: the edit case. A fix needs an inline script that records edits before hydration and puts them back after it. Mutation check: without the `networkidle` wait in the "change own story" step, the e2e test fails 4 times in 4 (the saved text is the old text). The wait stays. A member on a slow device who edits a story before the page is ready can lose the edit.

## Header verification

`next start` (production build), 2026-10-09, bundle `482bfd5f80e9`:

```
/embed/v1.js                         200  ACAO *, CORP cross-origin, nosniff, text/javascript; charset=utf-8,
                                          public, max-age=300, stale-while-revalidate=3600, ETag W/"54e-…"
/embed/v1/482bfd5f80e9/player.js     200  ACAO *, CORP cross-origin, nosniff, text/javascript; charset=utf-8,
                                          public, max-age=31536000, immutable
/embed/v1/themes/river-voices.json   200  ACAO *, CORP cross-origin, nosniff, application/json,
                                          public, max-age=300, stale-while-revalidate=86400, ETag "quMG6g…"
/embed/v1/themes/nope.json           404  ACAO *, CORP cross-origin, nosniff, public, max-age=60
/stories/river-voices/1/             200  no Accept-CH, no Critical-CH, Vary: rsc, … and Vary: Prefer
/admin/login                         200  Accept-CH and Critical-CH: Sec-CH-Prefers-Color-Scheme
```

`next dev` gives the same headers for the two JavaScript files. Without the rules, both dev and start sent `Cache-Control: public, max-age=0`, `application/javascript` and no CORS. `tests/e2e/embed.e2e.spec.ts` asserts all of this.

## Not verified

- A CDN or proxy in front of the app (`TRUST_PROXY`, `Vary`, 304 through a shared cache).
- `X-Forwarded-For` as Traefik in Dokploy writes it. The rule in decision 5 follows MDN and the proxies' documented behaviour.
- The admin form for the theme in a browser. The int tests use the local API, which runs the same field `validate` functions.
- The Annotate page in Firefox and WebKit. The app e2e tests run in Chromium only.
- Real Safari: `currentTime` and `annoudio:timeupdate` are tested in Playwright's WebKit only.

## Hazards found

- **`next dev` stops at a schema question** when a collection changed: "Is theme_tokens_color_surface column in projects table created or renamed from another column?" (`site` was removed in the same change). The dev server then serves no request. Answer **create column** for the development database. For the e2e database, run `pnpm test:int` first: it drops and pushes the schema. `app/README.md` says so.
- **`pnpm build` type-checks the tests** (`tsconfig.json` includes `**/*.ts`). An error in an e2e file breaks the production build.
