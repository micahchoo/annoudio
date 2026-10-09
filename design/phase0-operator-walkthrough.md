# Phase 0: operator walkthrough of the admin

Status: 2026-10-09. Input to Phase 5 (ROADMAP.md).

## What this is

A developer walked Payload's admin as an operator would. The admin had the three Phase 0 collections (`projects`, `recordings`, `stories`) and Payload's default `users` collection for operators. There was no custom UI. The walk had three tasks:

1. Approve a draft story.
2. Add a concept to the vocabulary of a project.
3. Register a recording.

Each item below is one step that needs a developer's knowledge. The format is: **what the operator sees → what the operator needs instead**. Phase 5 is done when this list is empty.

Setup for the walk: one project ("Oral histories of Kochi"), one recording ("Fish market, 1978", 1834 seconds), one draft story with a text body on `#t=62,95`. Payload 3.90.2, Next.js 16.3.3, headless Chromium screenshots.

## All screens

These items occur on every screen.

1. **The sidebar says "Users".** → It must say "Operators". "User" is a forbidden word in CONTEXT.md, and Phase 3 adds members, so "Users" will become ambiguous.
2. **The sidebar lists collections in code order: Users, Projects, Recordings, Stories.** → The operator needs task order with the daily task first: "Stories to review", then Catalogue, Projects, Operators. Groups can help (Review, Catalogue, Settings).
3. **The dashboard shows only four collection cards with no counts.** → The operator needs a start page that says what needs attention, for example "3 stories wait for review".
4. **Each document has an "API" tab.** → It shows raw JSON and the REST URL. Hide it from operators.
5. **Labels come from field names: "Wadm", "Rights Line", "Urls", "Url", "Updated At".** → Every field needs a written label and a one-line description: "Rights statement shown under each story", "Audio address", "Last change".
6. **Dates show as "October 9th 2026, 12:36 AM" in the server's time zone.** → Show the operator's local time and a short form ("9 Oct 2026, 12:36").
7. **In development, a Next.js "N" badge shows in the lower left corner.** → It is a dev-only tool. Confirm it is absent in the production build (Phase 6).

## Task 1: approve a draft story

Steps the operator takes: Stories → open the row → read → Publish changes.

8. **The list has no filter for "Draft only". The operator must open "Filters", pick the field "Status", pick "equals", pick "draft".** → The operator needs a default view or a tab "Waiting for review" that shows only drafts, oldest first.
9. **The first column of the list is "ID: 1".** → A number does not tell the operator which story it is. The list needs the first words of the text body, the member's name and the time range (for example "1:02–1:35").
10. **The list has no column for the member who told the story.** → No `creator` field exists yet (a Phase 3 item). The list and the edit screen must show the member.
11. **The edit screen shows the story as a JSON code editor labelled "Wadm".** → This is the largest problem. The operator cannot read `"selector": {"type": "FragmentSelector", "value": "t=62,95"}`. The operator needs a read-only story view: the text, a player that plays only the time range, the tags as concept labels, and the media bodies as players.
12. **The JSON editor is editable.** → An operator can break the WADM record with one wrong comma, and the admin saves it (there is no validation yet). The record must be read-only for operators. Phase 1 validation must refuse a bad record.
13. **The time range is a string inside the JSON (`t=62,95`), in seconds.** → Show it as minutes and seconds, and play it.
14. **The keys in the JSON are not in the order written. `@context` moved to the end, and `body` comes first.** → Postgres `jsonb` does not keep key order. Operators will not care, but Phase 1's "read back byte-equal" test will fail on this. Phase 1 must decide: store as `json` text, or compare parsed JSON. This item is for the developer, not for Phase 5.
15. **The buttons are "Save Draft" and "Publish changes".** → The operator needs words from the review task: "Keep as draft" and "Publish". "Publish changes" suggests the story is already public.
16. **"Publish changes" publishes at once, with no confirmation and no preview.** → Show what the visitor will see, then confirm.
17. **There is no "Reject" action. The ⋮ menu offers only "Create New", "Duplicate" and "Delete".** → The operator needs "Reject" with a reason that goes to the member, and not a hard delete. "Delete" removes the story with no record.
18. **"Create New" and "Duplicate" are offered on stories.** → Operators must not write stories in the admin; members write them on the Annotate page. Hide both actions.
19. **The "Versions" tab lists "Version ID 2, Currently Published" and "Version ID 1, Draft".** → The operator needs a plain history: "Published by Asha, 9 Oct" and "Saved as draft by member, 9 Oct". Version IDs are developer data.
20. **The Project and Recording fields are dropdowns with "+" (create new) and "x" (clear) buttons.** → On review, these must be read-only. A "+" button invites the operator to create a project from inside a story.
21. **The status line says "Status: Draft" at the top in small text.** → Review state needs a clear badge, and the words must agree with CONTEXT.md: "Draft" and "Published".
22. **There are no per-project review rules.** → Some projects can publish without review. That is a project setting (Phase 5).

## Task 2: add a concept to the vocabulary of a project

Steps the operator takes: Projects → open the project → look for the vocabulary.

23. **The project screen has three text fields: Name, Site, Rights Line. There is no vocabulary.** → No `concepts` collection exists yet. The operator cannot do this task at all. Phase 5 must add a vocabulary tree on the project: add, rename, move under a parent, and remove a concept.
24. **No place shows a concept IRI.** → The operator must never type an IRI. The app mints it. The operator sees only the label and the position in the tree.
25. **No export or import exists.** → The operator needs "Download as SKOS" and "Upload SKOS file" buttons on the vocabulary, with a preview before the import replaces anything.
26. **A concept cannot be removed safely today because no rule exists.** → When stories use a concept, the admin must say how many stories use it and offer "hide from new stories" in place of delete.
27. **The project has no theme tokens and no snippet.** → The operator needs colour and font fields with a live player preview (Phase 5), and a "Copy snippet" button.
28. **"Site" is free text with no check.** → It needs a URL check and the label "Website address", with the example `https://example.org`.
29. **"Rights Line" has no example and no default.** → The operator needs a list of common licences (CC BY 4.0, CC BY-NC 4.0, "All rights reserved") and a free-text option.

## Task 3: register a recording

Steps the operator takes: Recordings → Create New → type title → Add Url → paste address → Save.

30. **The create screen title is "[Untitled]" and the subtitle is "Creating new Recording".** → Show "New recording".
31. **"Urls" is an array block with "Url 01", "Collapse All", "Show All", a drag handle and a ⋮ menu.** → The operator thinks of one recording with one address. Show one "Audio address" field, and a small "Add another format" link for extra URLs.
32. **The URL field accepts any text.** → Check that it is an `https` URL, and check that the audio plays in the browser before the save.
33. **"Duration" is an empty number field with no unit.** → The operator does not know that the unit is seconds, and must not type it by hand. The `catalogue` module probes it (ffprobe, Phase 5) and shows it as minutes and seconds.
34. **The list shows the duration as "1834".** → Show "30:34".
35. **The recording has no stable `id` that the operator can see. The admin uses a database number (1).** → The snippet needs the recording `id`. The operator needs to see it as part of the snippet, not as a separate field to copy.
36. **After the save, the screen does not show the snippet.** → The operator needs the two snippet lines with a "Copy" button, for each project that uses the recording.
37. **The list has columns Title, Duration, Updated At, and no story count.** → Add "Stories" (count, with drafts in brackets) so that the operator sees which recordings get attention.
38. **No upload exists. The operator must already host the audio somewhere and know its URL.** → Phase 5 must decide: keep "paste an address" only, or add an upload. Record the decision; do not add an upload by default.

## Summary

38 items: 7 on all screens, 15 in Task 1, 7 in Task 2, 9 in Task 3. Task 2 cannot be done at all. Item 14 is a Phase 1 developer issue, not an operator issue.

The three largest gaps:

- The story is shown as raw WADM JSON (items 11–13). Phase 5 needs a read-only story view.
- No vocabulary exists (items 23–26).
- No snippet exists (items 27, 35, 36).
