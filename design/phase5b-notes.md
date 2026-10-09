# Phase 5b notes: reply threads

Date: 2026-10-09. Scope: ROADMAP Phase 5b in `app/` and `embed/`. Read `CONTEXT.md` first. This file uses its words. A **reply** is a story that answers one published story of the same instance. It has no time range. `worker/`, `deploy/` and `plugins/` did not change.

## Result

| Check | Result |
|---|---|
| `app`: `pnpm test:int` | 174 pass (14 files). Phase 5: 157. New: `stories/replies.int.spec.ts` (17). |
| `app`: `pnpm test:e2e` | 26 pass (Chromium, muted). New: `replies.e2e.spec.ts` (1). In the first full run, `review.e2e` "returns a story to the member" timed out once at 30 s. It passed alone and in the next full run (see Hazards). |
| `embed`: `pnpm test` | 269 pass, 4 skipped (Chromium, Firefox, WebKit). Phase 5: 254. New: 5 tests in contract 16.9, run in 3 browsers. |
| `worker`: `pnpm test`, `tsc` | 80 pass, clean (no change). |
| `tsc`, `lint` | Clean in `app` and `embed`. `app` lint keeps the 5 warnings of the Payload template files. |
| `app`: `pnpm build` | Passes. |
| `embed`: `pnpm build` | Bundle `6b4bd18c8a1a`, 31 876 B gzip (limit 81 920). Loader 756 B gzip. The folder keeps `2abd9368ad56` and `482bfd5f80e9`. The build deleted `0a45a8367040`, the third bundle before the current one (`.claude/rules/embed-build-output.md`). |
| Schema | No change. `migrate:create phase5b_replies --skip-empty` made no file. The two migrations run clean on a new empty database (`NODE_ENV=production pnpm migrate`, then `migrate:status`). |

## The stored reply

```json
{
  "@context": "http://www.w3.org/ns/anno.jsonld",
  "id": "https://ORG/stories/river-voices/1/<reply id>",
  "type": "Annotation",
  "motivation": "replying",
  "created": "…", "modified": "…",
  "creator": { "id": "https://ORG/members/m-200", "type": "Person", "nickname": "Ravi" },
  "rights": "…",
  "body": [{ "type": "TextualBody", "value": "My uncle steered that ferry.", "format": "text/plain", "language": "ml" }],
  "target": "https://ORG/stories/river-voices/1/<story id>"
}
```

## The served page

```json
{
  "@context": ["http://www.w3.org/ns/anno.jsonld", { "annoudio:replies": { "@reverse": "oa:hasTarget" } }],
  "id": "https://ORG/stories/river-voices/1/?page=0",
  "type": "AnnotationPage",
  "items": [
    { "id": "…/<story id>", "type": "Annotation", "motivation": "commenting", "…": "…",
      "annoudio:replies": [ { "id": "…/<reply id>", "motivation": "replying", "target": "…/<story id>", "…": "…" } ] }
  ]
}
```

The container with an embedded first page has `["…/anno.jsonld", "…/ldp.jsonld", { "annoudio:replies": … }]`.

## Decisions

1. **The target of a reply is a plain IRI: the story IRI.** The Web Annotation Vocabulary §2.3.12 (`oa:replying`) gives this example: `oa:hasTarget <http://example.com/anno1>; oa:motivatedBy oa:replying`. The Model §4.6 says that `scope` is a relationship of a Specific Resource, and that it records "the context in which [the annotation] was made". The story IRI already names the project and the recording, and the story keeps its `scope`. A plain IRI also lets any client find the thread with `reply.target === story.id`. So a reply has no `scope`. This changes one fixed decision of `CONTEXT.md` ("`scope` = project IRI") for replies only.

2. **The sidecar: `annoudio:replies`, a reverse `oa:hasTarget`.** The page context gets one extra object, `{ "annoudio:replies": { "@reverse": "oa:hasTarget" } }`. The reasoning, checked against the specifications and a JSON-LD processor:
   - The Model §3.1: an annotation "MUST have 1 or more `@context` values and `http://www.w3.org/ns/anno.jsonld` MUST be one of them". More than one value is an array. So `[anno.jsonld, {…}]` is valid. A page or a container is not an annotation, but the same rule holds for it.
   - The Vocabulary §4 (Extensions): "Extension contexts MUST NOT redefine existing JSON-LD keys from the Web Annotation context. Implementations MUST ignore unfamiliar properties". `annoudio:replies` is not a key of `anno.jsonld` (checked against the context file) or of `ldp.jsonld`.
   - The term is a reverse property of `oa:hasTarget`. So each value is "an annotation whose target is this item". Each reply says that already in its own `target`. The key adds no new statement, no new predicate and no namespace IRI that someone must keep for years.
   - Test with jsonld.js 8.3.3 (a scratch script, not in the repository; both remote contexts served from local copies of the W3C files): (a) the expansion of a page without the key is the same with and without the extra context: the standard terms keep their meaning; (b) the URDNA2015 canonical N-Quads of a page with two replies in `annoudio:replies` are equal to those of the plain page plus the two replies as separate annotations; (c) the same holds for the container with the LDP context; (d) compaction with the same context gives the key back.
   - A client without the extra context reads `annoudio:replies` as an IRI with the scheme `annoudio:`. A plain JSON client ignores the key. Neither one loses a story.
   - Rejected: `as:replies`. The Vocabulary §4 RECOMMENDS a CURIE of an ontology that the context already has, and `anno.jsonld` has `as:`. But the range of `as:replies` is `as:Collection` (Activity Streams Vocabulary). A reply in the list would then be a Collection for an RDFS reasoner. A wrapper Collection per story adds weight for no reader. Rejected: a new namespace term such as `{origin}/ns#replies`: each stack would give the term a different IRI. Rejected: replies as more page items: `total`, the timeline order and paging then mix two kinds, and the v1 player skips an item without a time range (CONTRACT 6, rule 9) with a warning.
   - The extra context is only on a page (and a container) whose items have replies. Other pages keep the bytes and the ETags of Phase 5.

3. **A thread has one level.** `replyTo` must be a story; a reply to a reply gives `reply-depth`. Reasons: the player shows one thread under the open story, and the Reply link is on the story; one level gives one sidecar key per item, with no recursion in the rebuild, the page or the player; a member who wants to answer a reply answers the story, and the thread order (oldest first) keeps the talk readable. A deeper tree can come later without a break: a reply would then target a reply.

4. **A reply has no tags** (`reply-and-tags`). Tags classify a time range of the recording: the vocabulary counts and the concept relabel read them. A reply is about a story, not about the recording. The reply form shows no topics.

5. **The input.** `DraftInput.start`, `end` and `tags` are optional; `replyTo` is new. A story has `start` and `end`; a reply has `replyTo` only. New `SaveError` codes: `reply-and-range`, `reply-and-tags`, `unknown-parent` (not a published story of this instance: unknown, a draft, or a different instance), `reply-depth`. A save that changes the parent, or turns a story into a reply or back, gives `instance-changed`. The collection hook refuses the same change from the admin path. A reply needs a text body (`no-body`, `media-needs-text`); media bodies are allowed.

6. **No schema change.** The ROADMAP asked for none. The stored WADM holds the parent; `start` and `end` stay null for a reply. The admin column **Reply to** is a virtual field. The rebuild reads the instance, which holds the story and its replies (a reply IRI has the project and the recording of its story), so no index on a parent column is needed.

7. **What the read side serves.** A published reply is inside the item of its story, oldest first (`created`, then `id`), and at its own IRI as a complete annotation. The story at its own IRI has no `annoudio:replies`. `total` counts the stories. The `?iris=1` variants list story IRIs only. `modified` of the container includes the replies. A reply whose story is not published (unpublished, returned or deleted) is served nowhere, also not at its own IRI. It keeps its review state, and it shows again when the story is published again.

8. **Review state.** Each reply has its own review state, the same rules and the same hooks. The project rule `publish-at-once` applies. The review queue, `counts` and the Dashboard count replies as stories.

9. **A new interface method: `publishedStory(instance, id)`.** The Annotate page must show the story above the reply form. The only other read of a published story is `handleRead`, which gives WADM; the page would then parse WADM outside `stories`. The method gives `{ id, nickname, start, end, texts }`, or null for a reply, a draft or a different instance. It is anonymous: visitors see the same data.

10. **`StoryReview` and `OwnDraft`** have optional `start` and `end`, and a reply has `replyTo` (`OwnDraft`: the story id; `StoryReview`: the id, the excerpt and the nickname). `ownDrafts` gives the stories in timeline order, then the replies in id order (UUIDv7: time order).

11. **The player.** Each story item holds a thread: the `replies` part (when the story has replies) and the `reply-link`. The thread shows only under the open story. The story's open button has `aria-expanded` when the thread has content, and "2 replies" in its name and text. Reply text uses `textContent`; a reply's media body is a `story-media` part, as in a story. The Reply link exists only with `annotate="link"`, and only for a story whose IRI is `{container IRI}{id}`. `annoudio:annotate` has a new `story` field: the IRI for a Reply link, `null` for the Annotate link. The fragment key `annoudio-reply` opens that story (seek and `annoudio:story-open`) before the scroll and the focus of CONTRACT 7.2.

12. **The Annotate page.** `replyTo` is part of the link and of the hidden fields, so it survives the login code steps. The page shows the story (nickname, range, text) to signed-in and signed-out members. `ReplyForm` has the text and the media field, no player, no range and no topics. An unknown or hidden story gives "We cannot find this story" and a link to write a story. The own list shows "Reply to the story by …" with a **Change** link.

## Deviations from the brief

1. `publishedStory` is a new `Stories` method (decision 9).
2. `annoudio:annotate` has the new `story` field, and `annoudio:story-open` also fires when the fragment opens a story (CONTRACT 4.1, additive).
3. A media body of a reply uses the `story-media` part, not a new part ("render like story media").
4. Two existing tests changed for the new tab stop: contract 16.8 (keyboard) now passes the Reply link of the open story, and the name of Asha's story ends with ", 2 replies". `player.spec.ts` "target size" now opens Asha's story and measures only controls that render a box (a control in a closed thread has none).
5. Shared fixture changed: `embed/tests/fixture/data.mjs`, `rec-0042`: Asha's story has two replies (one with a voice note, one with HTML-like text). All consumers ran green: `contract.spec.ts`, `player.spec.ts`, `hosts.spec.ts`, in 3 browsers.
6. The e2e operator publishes through `stories.publish`, as the brief says. The same test also checks the admin list (**Reply to** column) and the panel in the browser.
7. The reply form has no player. The story text, nickname and range are enough to answer; a player adds a bundle load to a text form.

## Not verified

- A Web Annotation client (for example Mirador or Hypothesis) that reads `annoudio:replies`. Only jsonld.js was tested; pyld was not.
- The Annotate reply page in Firefox and WebKit (app e2e is Chromium only). The player side runs in all three.
- An edit of a saved reply before hydration: the React textarea reset of `design/phase3b-notes.md` applies to the reply form too.
- The Dashboard and the catalogue **Stories** column count replies as stories. Not checked in the browser; the words "stories wait for review" include replies.
- A reply with a media body end to end (the int tests check the rules; the player renders a fixture voice note in a reply).

## Hazards found

- `review.e2e` "an operator returns a story" timed out once at 30 s in the first full run (cold `next dev` compile after a schema-free code change). It passed alone (8 of 8) and in the next full run (26 of 26). Watch it.
- The dev Postgres has an idle session on `annoudio_fresh_test` since 09:31 UTC, from an earlier phase. `drop database` fails while it holds the database. This check used `annoudio_fresh5b_test` and dropped it after. The leftover database now has both migrations applied.
- A test run of `embed` rebuilds the bundle into `app/public/embed/`, and the build deletes the third bundle before it. An iteration build with changed source can push out a real release folder. Back up the folder before work, and restore the release folders before the final build.

## For the owner of `CONTEXT.md`

`CONTEXT.md` is outside this task. Proposed changes: add **Reply** ("A story that answers one published story of the same instance. No time range, no tags. WADM `motivation: replying`.") and change the fixed decision "`scope` = project IRI" to "for stories; a reply targets the story IRI".
