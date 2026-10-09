# Phase 5 notes: the admin is the operator's tool

Date: 2026-10-09. Scope: ROADMAP Phase 5 in `app/`: the review screens, the vocabulary tree with SKOS, the catalogue with the probe and the snippet, the project settings, and the labels of all screens. Input: `phase0-operator-walkthrough.md` (38 items). Read `CONTEXT.md` first. This file uses its words. `deploy/`, `embed/` and `worker/` did not change.

## Result

| Check | Result |
|---|---|
| `app`: `pnpm test:int` | 157 pass (13 files). Phase 4b: 127. New: `stories/review.int.spec.ts` (11), `vocabulary/vocabulary.int.spec.ts` (11), `catalogue/catalogue.int.spec.ts` (5), `admin/format.int.spec.ts` (3), 1 in `stories/media.int.spec.ts`. One old test removed (see deviation 6). |
| `app`: `pnpm test:e2e` | 25 pass (Chromium, muted). New: `review.e2e.spec.ts` (8). |
| `embed`: `pnpm test` | 254 pass, 4 skipped (no change in `embed/`). |
| `worker`: `pnpm test`, `tsc` | 80 pass, clean (no change in `worker/`). |
| `tsc`, `lint` | Clean. Lint keeps the 5 warnings of the Payload template files. |
| `app`: `pnpm build` | Passes. |
| Migration `20261009_101056_phase5_admin` | Tested on an empty database with rows in the old shape: up moves the data, down moves it back. |

## The 38 walkthrough items

Done in Phase 5: 31. Done in an earlier phase: 3. Decision recorded: 1. Deferred or partly done: 3.

| # | Item | State |
|---|---|---|
| 1 | Sidebar says "Users" | Done. Label **Operators** (slug stays `users`: every access check reads `req.user.collection === 'users'`). |
| 2 | Sidebar in code order | Done. Groups Review (Stories, Media bodies), Catalogue (Recordings), Projects (Projects, Concepts), People (Members, Operators). |
| 3 | Dashboard has no counts | Done. `src/admin/Dashboard.tsx`: "N stories wait for review" with a link, the published and returned counts, and the count of each collection. |
| 4 | API tab | Done. `hideAPIURL` on every collection that operators see. |
| 5 | Labels from field names | Done. Labels and one-line descriptions on every field; Payload's "Created At" and "Updated At" are "Created" and "Last change" (i18n override). |
| 6 | Long dates in server time | Done. `admin.dateFormat` `d MMM yyyy, HH:mm`; Payload's date cells render in the browser. The story panel uses `LocalDate` (browser time zone). |
| 7 | Next.js "N" badge | Already Phase 6. Checked again: `next start` of this build has 0 `nextjs-portal` elements on `/admin/login`. |
| 8 | No "Draft only" view | Done. With no filter in the address, the list is the queue (`baseFilter`), oldest first. Tabs: Waiting for review, Returned to the member, Published, All stories. |
| 9 | First column "ID: 1" | Done. Columns: Story (excerpt, the title), Member, Recording, Project, Time range (`1:02–1:35`), Media, Created, Review state. |
| 10 | No member column | Done. Column and panel show the nickname of the WADM `creator`. |
| 11 | WADM JSON editor | Done. Read-only story panel: text, tags as labels, media bodies as players, range, member, dates, and a player of the range. |
| 12 | JSON is editable | Done. `wadm` is hidden; no story field is editable. Validation of a bad record is Phase 1 (`deriveColumns`). |
| 13 | Range is `t=62,95` in seconds | Done. `1:02–1:35`, and the `<audio>` of the panel plays it. |
| 14 | `jsonb` key order | Already Phase 1 (parsed compare, canonical order). |
| 15 | "Save Draft", "Publish changes" | Done. **Publish** (i18n override) and **Keep as draft** (a button that goes back to the queue and saves nothing). |
| 16 | Publish has no confirmation or preview | Deferred. The panel above the button is the preview of what visitors see. A confirmation adds one click to the daily task, and **Unpublish** undoes a publish at once. |
| 17 | No "Reject" | Done: **Return to the member** with a reason (`stories.reject`). The member sees "Returned: reason" on the Annotate page. Mail to the member: deferred (no member mail path except login codes; the Annotate page shows the reason). |
| 18 | "Create New" and "Duplicate" on stories | Done. `access.create: nobody`, `disableDuplicate`. |
| 19 | Versions tab with version IDs | Partly. The tab is hidden. A plain history ("Published by Asha, 9 Oct") is deferred: it needs a custom versions view and the operator name on each version. |
| 20 | Project and Recording dropdowns | Done. They are text columns since Phase 1; the panel shows them as names, read-only. |
| 21 | Small "Status: Draft" | Done. Badge Draft / Returned / Published in the list and the panel, with a sentence. |
| 22 | No per-project review rule | Done. `reviewRule`: `review` or `publish-at-once`; `saveDraft` publishes at once. |
| 23 | No vocabulary | Done. Project tab **Vocabulary**: the tree with story counts and links. Add, rename, move and remove in the **Concepts** form (parent filtered to the project, cycles refused). |
| 24 | Operator types an IRI | Done. The app mints `{origin}/vocab/{project}/c/{key}`; read-only, never changes. |
| 25 | No SKOS export or import | Done. Download Turtle or JSON-LD; upload Turtle or JSON-LD with a preview (added, changed, unchanged, left out) and then **Import these changes**. |
| 26 | No delete rule | Done. Delete refused with "N stories use this concept"; **Hide from new stories** removes it from the picker. A concept with narrower concepts is refused too. |
| 27 | No theme, no snippet | Done. Theme tokens since 3b; the Theme tab now has a live preview with the real player. The snippet is on the recording page, for each project. |
| 28 | "Site" free text | Already Phase 3b (`site` removed; `siteOrigins` with a URL check). Label now "Website address". |
| 29 | Rights line without choice | Done. CC BY 4.0, CC BY-NC 4.0, All rights reserved, Other (free text). A listed choice fills `rightsLine` and `rightsIri`. |
| 30 | "[Untitled]", "Creating new Recording" | Partly. The subtitle says "New Recording". The heading stays "[Untitled]" until a title is typed (Payload renders it; no option changes it). |
| 31 | "Urls" array | Done. One **Audio address** field, and **Other formats** (collapsed) for more. |
| 32 | URL accepts any text | Done. https only (http for a loopback host). The probe says at once if the audio plays in this browser. It does not block the save. |
| 33 | Duration typed by hand | Done (deviation 1: the browser probes it). Shown as m:ss, not editable. |
| 34 | List shows "1834" | Done. `30:34`. |
| 35 | No visible recording id | Done with deviation 3: the id is the Payload number, shown in the snippet and as "Recording ID". |
| 36 | No snippet after save | Done. The two lines of CONTRACT §1, a project dropdown, **Copy the snippet**. |
| 37 | No story count | Done. Column **Stories**: published, drafts that wait in brackets (`3 (2)`). |
| 38 | Upload or paste | Decision: paste an address only. Reasons: the organisation already hosts its archive; an upload needs storage size rules, a transcode of long files and backup of a new volume class. The member upload path (`media`) stays for bodies only. |

## Decisions

1. **The duration probe runs in the operator's browser**, not with ffprobe. The app image has no ffprobe. A worker round trip (pg-boss request and answer) would add a new job, a wait in the form and a failure mode. The browser's `<audio>` reads the duration from the metadata, before the save, and also answers walkthrough 32 (does it play in a browser?). Cost: the value comes from the client (operators are trusted), and a format that this browser cannot play gives no length; the field stays empty, which `stories` accepts. CONTEXT.md still names a `Prober` port for `catalogue`: update it if this decision holds.
2. **The panel player is a plain `<audio src="url#t=start,end">`**, not `<annoudio-player>`. The player element shows the published stories of the instance; a draft under review is not among them, and the player would show other stories. The Media Fragment plays exactly the range.
3. **The review queue is the list with no filter**: `baseFilter` gives `draft and rejection.at not set` when the address has no `where`. A saved query preset needs the `payload-query-presets` collection, is per operator, and is not selected for a new operator. The tabs are links with a `where` in the address; Payload keeps it while it pages.
4. **`excerpt` and `nickname` are stored columns**, derived from `wadm` by the same hook as `project` and `recording`. `useAsTitle` cannot be a virtual field (Payload 3.90 `validateUseAsTitle`). The migration fills them for existing rows.
5. **Reject**: a published story becomes a draft (as Unpublish) with the rejection. A newer draft of a published story gets the rejection on the draft only; the published version stays visible. A publish and the next changed save of the member clear it.
6. **`publish-at-once`** publishes in `saveDraft` through the same update as the Publish button. A story whose media body still processes stays a draft; the next save after the body is ready publishes it. The redirect to the host page then has no `annoudio-saved=draft` (CONTRACT §7: optional), and the Annotate page says "saved and published".
7. **New `Stories` methods**: `reject`, `review`, `counts`, `tagCounts`; `conceptChanged(iri, { req })` so a label change rebuilds inside the transaction of the change (an `afterChange` hook runs before the commit). `SaveResult.reviewState` and `OwnDraft.rejection` are additive. The design files rejected reviewer notes "with no caller in v1"; the review screen is that caller.
8. **Collections that need `stories` take it as a dependency**: `recordingsCollection({ stories })`, `conceptsCollection({ origin, stories })`, called in `payload.config.ts` with a getter (the `stories` instance is made after the config).
9. **Admin layer `src/admin/`**: server components call module interfaces only. One exception: the dashboard counts rows of the other collections with `payload.count`, as Payload's own list views read them. The review counts go through `stories.counts`.
10. **SKOS**: `n3` 2.7.12 (Turtle parse and write) and `jsonld-streaming-parser` 5.0.1 (JSON-LD), both older than one month. JSON-LD export is written by hand with an inline context. The JSON-LD import loads no remote context (refused with a message): no requests from the server to addresses in an uploaded file. Hidden concepts export as `owl:deprecated true`. Import rules: merge by IRI, never remove a concept, a parent link or a hidden mark; an IRI of another project is left out; a cycle parent is ignored; 1 MB and 5000 concepts at most (a Server Action takes 1 MiB by default).
11. **IRI keys** come from the label (ASCII letters and digits); a label with none (Malayalam, for example) gets 8 random hex digits. `-2`, `-3` for a key in use.
12. **Rights IRIs**: CC BY 4.0 and CC BY-NC 4.0 point at creativecommons.org; "All rights reserved" at `http://rightsstatements.org/vocab/InC/1.0/` (In Copyright).
13. **Buttons inside the document form** never use a `<form>` (the Return dialog is a `<dialog>` with buttons): a nested form would submit Payload's form.

## Deviations from the brief

1. The probe is client-side (decision 1).
2. The button says **Return to the member**, not "Reject": it says what happens, and it matches "Returned:" on the Annotate page.
3. **The recording id stays the Payload number**, not a slug. A slug id changes every story IRI, the container URLs, and the e2e and int fixtures, for no operator gain: the operator copies the snippet, which holds the id. It is stable and read-only.
4. No mail to the member on rejection (optional in the brief).
5. Versions tab hidden, not relabelled (item 19).
6. Test removed: `write.int.spec.ts` "conceptChanged after a concept removal takes the tag out of the stories". The delete guard now refuses that removal; the new vocabulary test checks the refusal.
7. Fixture changes (schema): `recordings.urls` → `url` in `tests/int/stories/world.ts`, `tests/e2e/{annotate,embed,media}.e2e.spec.ts`; truncate lists name `recordings_other_urls`. The template test `admin.e2e.spec.ts` expects "Operators". `signIn` moved from `annotate.e2e.spec.ts` to `tests/e2e/member.ts`.
8. New dependencies in `app/package.json`: `n3`, `jsonld-streaming-parser`, `@types/n3`. The prebuilt images of the demo stack do not have them: rebuild the app image.

## Not verified

- The Annotate page with a hidden concept in a browser (the int test saves a story with a hidden tag through `saveDraft`; the page filter is untested in e2e).
- The theme preview with the operator's real fonts; the dark admin theme (styles use Payload's theme variables).
- The browser probe in Firefox and Safari, and for an address that answers without CORS headers (`<audio>` metadata needs no CORS; not tested).
- JSON-LD files from TemaTres or OpenTheso (tested with this app's export and hand-written Turtle).
- `migrate` of a real Phase 4b database with data (tested on an empty database with rows written by hand).

## Rules added

- `.claude/rules/stories-raw-sql.md`: the raw SQL in `stories` names Payload column names.
- `.claude/rules/app-migrations.md`: three hazards (interactive prompt, no data moves, dev database question).
