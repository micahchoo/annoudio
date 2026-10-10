# Annoudio design system

Date: 2026-10-09. Words: `CONTEXT.md`. Style guide: `design/design-system/index.html` (open the file; no build). Stylesheet: `design/design-system/styles.css`.

This document gives one visual language to three surfaces:

1. The admin: our custom pages inside Payload (Today, the review screen and its panel, Add a widget to a site, the Vocabulary tab, the list views, the Snippet panel, History, invite codes, project Overview and Theme).
2. The member pages: the Annotate page, Your stories, Your account. Phone first.
3. The widget: the default theme tokens of `<annoudio-player>`. The host can override them.

The problem it solves: the screenshots in `design/workflow-audit/` and `design/phase5c-screens/` show black text on white, with bare `<dl>` lists, plain text fields for colours, and links that do not show which project, recording or member they lead to. Each part is correct but nothing has a role, so the screens look like a 2000s web page.

## 1 Principles

1. **Show the next move.** Each screen has one filled button, and it is the next step of the job. The operator never has to look for what comes next.
2. **Show the connection.** A project, a recording, a member or a concept always shows as a chip with a link and a count, so the operator never has to search for what is connected to what.
3. **One state, one look.** A lifecycle state has one word, one icon and one colour on every surface, and the colour says whose move it is: the operator's, the member's or the system's.
4. **Pick, do not type.** When a value comes from a known set (a recording, a parent concept, a colour), the field is a dropdown or a picker that shows the result, and it says at once if the result is bad.
5. **Payload's screens and ours are one product.** Our tokens point at Payload's variables, and the few values we change, we change in Payload's variables too.

## 2 What Payload 3.90 lets us style (verified)

Checked in `app/node_modules` (payload 3.90.2, @payloadcms/ui 3.90.2). Do not assume more than this.

| Fact | Evidence |
|---|---|
| There is **no** `admin.css` key in `buildConfig`. The admin CSS entry is `src/app/(payload)/custom.scss`. Payload's generated `layout.tsx` imports it. | `payload/dist/config/types.d.ts` (the `admin` keys: `autoLogin`, `avatar`, `components`, `custom`, `dateFormat`, `meta`, `theme`, `toast`, `user`…); `src/app/(payload)/layout.tsx:10` |
| All of Payload's CSS is in `@layer payload-default`. A rule in `custom.scss` with no layer wins over it, at any specificity. | `@payloadcms/next/dist/prod/styles.css` |
| Payload sets `data-theme="light"` or `"dark"` on `<html>` at all times, from the user setting or from `prefers-color-scheme`. | `@payloadcms/ui/dist/providers/Theme/index.js:25-83` |
| Variables: `--base` (20px at a 13px root), `--font-body`, `--font-mono`, `--style-radius-s/m/l` (3/4/8px), `--theme-bg`, `--theme-text`, `--theme-input-bg`, `--theme-elevation-0…1000`, `--theme-success-*`, `--theme-warning-*`, `--theme-error-*`, `--accessibility-outline`. In dark mode the `--theme-*` ramps are reversed; the `--color-*` primitives stay fixed. | `ui/dist/scss/app.scss:9-48`, `colors.scss:167-275` |
| The admin root font size is **13px** (12px under the mid break). So `1rem` is 13px in the admin. | `ui/dist/scss/type.scss:96`, `app.scss:93` |
| `--theme-success-*` is **blue** (`#0b6e99` at 600). Payload uses it as its interaction colour: the checkbox and radio focus glow, the success toast, the success pill. | `colors.scss:25-43`; `fields/Checkbox/index.scss:75`; `scss/toasts.scss:117` |
| The Payload primary button reads `--bg-color`, `--hover-bg` and `--color` from its own class. | `elements/Button/index.scss:22-34` |
| Payload's text inputs have a `1px solid var(--theme-elevation-150)` border: 1.36:1 on white and 1.67:1 on dark. That fails WCAG 1.4.11 (3:1 for the edge of a control). | `scss/vars.scss:131-135` |
| A field can have a custom component: `admin.components.Field` (and `Cell`, `Label`, `Description`, `beforeInput`, `afterInput`). A `type: 'ui'` field has only `Field` and `Cell`, and stores nothing. | `payload/dist/fields/config/types.d.ts:175-178, 686-721` |
| Client exports that a custom field uses: `useField`, `useFormFields`, `useDocumentInfo`, `FieldLabel`, `FieldDescription`, `FieldError`, `ReactSelect`, `CopyToClipboard`, `Pill`, `toast`, `useTheme`. | `@payloadcms/ui/dist/exports/client/index.d.ts` |
| Payload has no colour input. The theme tokens are plain `text` fields. | `src/modules/projects/theme.ts:145` |

## 3 Tokens

All tokens are CSS custom properties with the prefix `--ao-`. Components read only `--ao-*` tokens. In the admin each token points at a Payload variable (section 4). The full set is in `design/design-system/styles.css` §2.

### 3.1 Type

Admin sizes are multiples of `--base`, so they scale with Payload's own text. The member pages use `rem` from a 16px root, one step larger, because a phone input under 16px makes iOS zoom.

| Token | Admin | Member pages | Use |
|---|---|---|---|
| `--ao-text-xs` | `calc(var(--base) * 0.6)` = 12px | 0.8125rem = 13px | badge, caption |
| `--ao-text-sm` | 0.65 = 13px | 0.875rem = 14px | meta, help line |
| `--ao-text-md` | 0.7 = 14px | 1rem = 16px | body, field text |
| `--ao-text-lg` | 0.8 = 16px | 1.125rem = 18px | card heading |
| `--ao-text-xl` | 1 = 20px | 1.375rem = 22px | section heading, dialog title |
| `--ao-text-2xl` | 1.3 = 26px | 1.75rem = 28px | page title, stat number |

The family is `--font-body` (Payload's system stack), and code uses `--font-mono`. Line height is 1.2 for headings and 1.5 for body text. Weights are 400 and 600 only. Times, counts and codes use `font-variant-numeric: tabular-nums` (`.ao-num`). Headings use `text-wrap: balance` and help lines use `text-wrap: pretty`. The measure is 65ch at most.

### 3.2 Space, radius, elevation

| Token | Value | Payload equivalent |
|---|---|---|
| `--ao-space-1…7` | 4 · 8 · 12 · 16 · 24 · 32 · 48 px | `calc(var(--base) * 0.2 … 2.4)` |
| `--ao-radius-s` | 4px | `--style-radius-s` (we set it, §4) |
| `--ao-radius-m` | 6px: controls, chips | `--style-radius-m` |
| `--ao-radius-l` | 10px: cards, dialogs, toasts | `--style-radius-l` |
| `--ao-radius-pill` | 999px: badges, topics | |
| `--ao-shadow-card` | light `0 0 0 1px rgb(0 0 0/.08), 0 1px 2px rgb(0 0 0/.06)`; dark `0 0 0 1px rgb(255 255 255/.10)` | |
| `--ao-shadow-overlay` | light `0 0 0 1px rgb(0 0 0/.08), 0 8px 24px rgb(0 0 0/.16)`; dark `… rgb(0 0 0/.5)` | |
| `--ao-hit` | 40px admin, 44px member pages | |

There are three elevation levels: the page (flat), the card (`surface` + card shadow) and the overlay (dialog, toast, dropdown). In dark mode a card is lighter than the page (`#222` on `#141414`). Group items with space first. A line separates only list rows and the tab bar.

### 3.3 Colour roles

The ratios are WCAG 2.2 contrast, computed from the hex values against the background the colour renders on. Text needs 4.5:1. Control edges and icons need 3:1.

| Role | Light | Ratio | Dark | Ratio | Job |
|---|---|---|---|---|---|
| `bg` | `#ffffff` | | `#141414` | | page |
| `surface` | `#ffffff` | | `#222222` | | card, field, dialog |
| `surface-sunken` | `#f5f5f5` | | `#141414` | | snippet, empty state, chip |
| `text` | `#2f2f2f` | 13.4 | `#ebebeb` | 13.4 on surface | body |
| `text-muted` | `#575757` | 7.2 (6.6 on sunken) | `#c3c3c3` | 9.0 on surface | help, meta |
| `border` | `#dddddd` | 1.4 | `#3c3c3c` | 1.7 | structure only, never a control edge |
| `border-control` | `#808080` | 4.0 | `#808080` | 4.0 on surface | field, select, outline button |
| `accent` | `#0b6e99` | 5.7 | `#41b2ec` | 6.7 on surface | the primary button, focus, current step |
| `on-accent` | `#ffffff` | 5.7 (6.8 on hover `#0b6187`) | `#141414` | 7.7 | text on accent |
| `accent-subtle` / `accent-text` | `#edf5f9` / `#0b6187` | 6.2 on subtle, 6.8 on surface | `#132c3a` / `#9cd8fd` | 9.4 on subtle, 10.3 on surface | selected, current, links |
| `danger` / `on-danger` | `#b63636` / `#fff` | 5.9 | `#f66d67` / `#141414` | 5.5 on surface; 6.4 on-danger | Remove, errors |
| `danger-subtle` / `danger-text` | `#fce5e3` / `#7b2927` | 8.0 | `#40201d` / `#fec1bc` | 9.4 | error text, danger outline |
| `focus` | = `accent` | 5.7 | = `accent` | 6.7 | 2px outline, 2px offset |

### 3.4 Lifecycle state colours

The colour says whose move it is. Red is not a state colour: red means "this destroys or failed".

| State (`ia.md` §2.1) | Whose move | Icon | Light bg / text / icon | Ratio text · icon | Dark bg / text / icon | Ratio text · icon |
|---|---|---|---|---|---|---|
| Processing | system | `processing` (clock) | `#ebebeb` / `#2f2f2f` / `#575757` | 11.2 · 6.0 | `#2f2f2f` / `#ebebeb` / `#c3c3c3` | 11.2 · 7.6 |
| Waiting for review | operator | `waiting` (hourglass) | `#f8e8db` / `#5a3713` / `#96570b` | 8.8 · 4.8 | `#382614` / `#f3c8a2` / `#eea662` | 9.3 · 7.0 |
| Returned, Returned (automatic), Returned to you | member | `returned` | `#f3e8f7` / `#5b2a6e` / `#7d3f96` | 8.8 · 5.9 | `#33203d` / `#e6c8f2` / `#e6c8f2` | 9.8 · 9.8 |
| Published | none (done) | `published` (check) | `#e2f2e6` / `#1d5530` / `#2a7a45` | 7.6 · 4.6 | `#16301f` / `#a9dcb7` / `#a9dcb7` | 9.2 · 9.2 |
| Published · change waiting | operator | two badges: Published + "change waiting" | as above | | as above | |

The waiting and processing values come from Payload's `--color-warning-*` and `--theme-elevation-*`. Plum and green are new primitives (`--ao-plum-*`, `--ao-green-*`), because Payload's "success" ramp is blue and is our accent.

### 3.5 Motion

| Token | Value | Use |
|---|---|---|
| `--ao-ease` | `cubic-bezier(0.2, 0, 0, 1)` | all |
| `--ao-dur-fast` | 120ms | hover and colour changes, chip hover |
| `--ao-dur-base` | 200ms | dialog enter (opacity + scale 0.98), toast enter (opacity + 8px rise) |

Rules: all movement is inside `@media (prefers-reduced-motion: no-preference)`, so under `reduce` nothing moves; colour changes stay. A button press scales to `0.96`. Transitions name their properties (never `all`). No step waits for an animation: the next story opens at once, and the toast comes after it.

## 4 Mapping onto Payload

In the admin, delete §1 of `styles.css` (the stand-in for Payload's variables) and put §2–4 into `src/app/(payload)/custom.scss`. The token blocks use `:root, [data-theme="light"]` and `[data-theme="dark"]`. These match Payload's `<html data-theme>`, so both themes work with no script.

| Our token | Light | Dark |
|---|---|---|
| `--ao-bg` | `var(--theme-bg)` | `var(--theme-bg)` |
| `--ao-surface` | `var(--theme-elevation-0)` | `var(--theme-elevation-50)` |
| `--ao-surface-sunken` | `var(--theme-elevation-50)` | `var(--theme-elevation-0)` |
| `--ao-surface-hover` | `var(--theme-elevation-50)` | `var(--theme-elevation-100)` |
| `--ao-text` | `var(--theme-elevation-800)` | `var(--theme-elevation-800)` |
| `--ao-text-muted` | `var(--theme-elevation-650)` | `var(--theme-elevation-650)` |
| `--ao-border` | `var(--theme-elevation-150)` | same |
| `--ao-border-control` | `var(--theme-elevation-500)` | same (500 is not reversed) |
| `--ao-accent` / `-hover` | `var(--color-success-600)` / `-650` | `var(--color-success-350)` / `-300` |
| `--ao-accent-subtle` / `-text` | `var(--color-success-50)` / `-650` | `var(--color-success-900)` / `-200` |
| `--ao-danger` / `-subtle` / `-text` | `var(--color-error-600)` / `-100` / `-750` | `var(--color-error-400)` / `-900` / `-200` |
| `--ao-waiting-*` | `var(--color-warning-100)` / `-800` / `-600` | `-900` / `-200` / `-300` |
| `--ao-space-n`, `--ao-text-*` | `calc(var(--base) * n)` | same |
| `--ao-font`, `--ao-font-mono` | `var(--font-body)`, `var(--font-mono)` | same |

The tokens point at the fixed `--color-*` primitives, not at `--theme-success-*`. The reason: the `--theme-*` ramps reverse in dark mode, so the shade number would mean a different colour in each theme.

To make Payload's own screens match ours, add these overrides to `custom.scss`. They are the only overrides:

```scss
:root {
  --style-radius-s: 4px;  --style-radius-m: 6px;  --style-radius-l: 10px;
  --accessibility-outline: 2px solid var(--ao-focus);   // Payload's focus ring = ours
}
.btn--style-primary:not(.btn--disabled) {               // Payload's Save/Publish = our primary
  --bg-color: var(--ao-accent); --hover-bg: var(--ao-accent-hover); --color: var(--ao-on-accent);
}
.field-type :is(input, textarea), .rs__control {         // WCAG 1.4.11: control edge 3:1
  border-color: var(--ao-border-control);
}
```

The first block sets variables, which is the stable interface. The other two use Payload class names (`btn--style-primary`, `field-type`, `rs__` from `classNamePrefix: "rs"`). After each Payload upgrade, check those class names and look at one Payload edit screen in both themes.

Payload's success toast is blue (our accent). This is correct: a toast confirms an action, and an action is accent. The green badge means only the state Published.

## 5 Components

Every component is in the style guide, in both themes ("Both" puts them side by side). Class names are `ao-*`. In React, each one becomes one component in `app/src/admin/ui/` (admin) or in the Annotate frame. Each takes only words and data.

| Component | Anatomy | States | Used on |
|---|---|---|---|
| **Page header** `.ao-header` | crumb (job / object) · title · one help line (≤ 65ch) · actions at the trailing edge | actions wrap under the title when narrow | every custom page; the help line replaces Payload's long collection description |
| **Section card** `.ao-card` | heading · optional badge at the trailing edge · one muted line · body; `--sunken` variant for secondary content | | review panel, Overview, Snippet panel, invite codes |
| **Facts** `.ao-facts` | label column (muted) · value column; values may hold chips and a quiet button | | review panel ("Member", "Recording", "Project", "Time range", "Told on", "Topics") |
| **Empty state** `.ao-empty` | icon · one-line title · the reason and what to do · one primary button | | empty Waiting tab ("No stories wait for review" → **Add a widget to a site**), no recordings, no invite codes ("No invite codes yet." → **Make invite codes**) |
| **Badge** `.ao-badge--{processing,waiting,returned,published}` | icon + word, pill, xs/600, `nowrap` | the five lifecycle states; "Published · change waiting" = two badges; invite states reuse it (Works = published, Used up / Expired / Revoked = processing) | lists, review header, Your stories, Today |
| **Stat** `.ao-stat` | number (2xl, tabular) · label · one note; a 4px leading edge in the state colour | a link when it opens a filtered list | Today, project Overview |
| **Step indicator** `.ao-steps` | `<ol>`; number in a circle; a line between steps | done (tick + hidden "Done:"), current (`aria-current="step"`, filled accent), to do (outline) | Add a widget to a site (1 Recording · 2 Site · 3 Snippet) |
| **Relationship chip** `.ao-chip` | icon of the kind · label (ellipsis) · count or "go" icon; the whole chip is a link | hover: accent edge and tint; static chip (no link) for topics in a preview | review panel, list rows, Overview ("3 recordings"), Vocabulary ("7 stories"), invite rows |
| **Dropdown** `.ao-select` | the native `<select>` with `appearance: none` and a drawn chevron | focus, disabled, invalid | Review rule, Language, Parent concept (indented "River work › Ferry"), choose a recording. Payload relationship fields keep `ReactSelect`, which the `.rs__control` override aligns |
| **Colour picker field** `.ao-color` | swatch `<input type="color">` · hex text · contrast readout ("5.7:1 on the background · passes for text") · default line | pass; fail (danger text: "2.8:1 … too low for text, needs 4.5:1"); not a hex | Theme tab, all colour tokens (§6) |
| **Copy field** `.ao-copy` | label · read-only monospace textarea (sunken) · **Copy the snippet** (primary) · status line `role="status"` ("Copied.") | copied; clipboard refused → select the text and say "Press Ctrl+C to copy." | Snippet panel, step 3, invite codes (**Copy the codes**) |
| **Form field** `.ao-field` | label (600) · help line (muted, under the label, `aria-describedby`) · control · error (danger text, icon, `aria-invalid`) | default, focus, invalid, disabled | all forms |
| **Buttons** `.ao-btn` | `--primary` (filled accent, one for each view), default (outline, `border-control`), `--danger` (danger outline), `--danger-solid` (only inside the confirm dialog), `--quiet` (text only, for inline actions such as "Change", "Play the time range") | hover, focus, press (scale 0.96), `aria-disabled` + the reason in a line beside it ("The voice note is still processing.") | |
| **Dialog** `.ao-dialog` | native `<dialog>` with `showModal()` · title (xl) · what happens · preview · primary + **Cancel** | Escape closes; focus returns to the trigger; a destructive dialog focuses **Cancel** first | Publish this story?, Return to the member, Remove |
| **Toast** `.ao-toast` | icon · one sentence · optional close | success (`role="status"`, goes after 5s); error (`role="alert"`, stays until closed) | "Published. Visitors see it within one minute." Use Payload's `toast` in the admin; this spec is for the member pages |
| **List row** `.ao-row` | title (the row's link; its `::after` covers the row) · meta line (badge, member, time range, chips) · trailing age or action | hover tint; the chips and buttons inside stay separate links | Review stories tabs, Recordings, invite codes, History, Your stories |
| **Tabs** `.ao-tabs` | links, `aria-current="page"`, optional count | current: 600 + 2px accent underline; scroll sideways when narrow | Story · History; Overview · Settings · Vocabulary · Theme; Waiting for review · Processing · Returned · Published. These are links, not an ARIA tab list, because each one is a URL (Payload document views) |
| **Phone form layout** `.ao-phone` + `.ao-member` | project · title · recording · "← Back to the site" · moment line ("Your story is about 0:03–0:08") · fields in one column (Start/End side by side when there is room) · topics as toggle pills · sticky bar with the primary button and one line of what happens next | safe-area padding at the bottom; 16px field text; 44px targets | Annotate page, reply form, Your account |

## 6 The two custom field components

### 6.1 Colour picker field

For each `THEME_TOKENS` entry of `kind: 'color'` (`src/modules/projects/theme.ts`), add `admin.components.Field: '/admin/projects/ColorField#ColorField'` and `admin.custom: { against, need }`. The stored value stays a text string, so the theme JSON, the validator and CONTRACT §3.2 do not change.

- Value: `useField<string>({ path })` gives `value` and `setValue`. The swatch and the hex text both call `setValue`. An empty value means the default; the swatch then shows the default (the field's `placeholder`), and the line says "Default #0b6e99."
- Contrast: `useFormFields(([fields]) => fields['themeTokens.' + against]?.value)` reads the colour it renders on. If that is empty, the field uses its default. The pairs, from CONTRACT §3.1:

| Field | Against | Needs |
|---|---|---|
| text, secondary text, accent | background | 4.5:1 (text) |
| text on the accent colour | accent | 4.5:1 |
| border, focus ring | background | 3:1 (control edge) |
| waveform | background and story range (shows the lower) | 3:1 |
| story range | (none: a fill; it shows the waveform pair) | |

- The readout updates as the operator types, but it does not block Save. The operator decides; CONTRACT §3.1 rule 6 says the widget does not check host values.
- A value that is a valid CSS colour but not hex (`rgb()`, a name) is valid. The readout converts it with a canvas `fillStyle` read-back. If that fails, it says "We cannot measure this colour."
- Label, help and error come from `FieldLabel`, `FieldDescription` and `FieldError`, so the field lines up with Payload's own fields.

### 6.2 Relationship chip

`RelationChip({ kind, label, href, count })`, where `kind` is one of project, recording, member, concept, site, story or invite-code. It is used in three ways:

- As a `type: 'ui'` field with `admin.components.Field` on the recording, concept, member and project edit views. It shows "Used by" chips. A UI field stores nothing.
- As `admin.components.Cell` in list views. Examples: the Recordings list shows the project chip and "12 stories", and the Concepts list shows "7 stories".
- Directly in our own pages (review panel, Overview, invite rows).

The counts come from the module interfaces that exist now (`stories.counts`, `stories.tagCounts`, `catalogue.list`), never from a direct read of a collection (CONTEXT.md seam rules). The link of a count opens the list filtered to it. For example, "12 stories" opens Review stories filtered to that recording.

## 7 Widget default tokens (refreshed)

The widget shares the accent with the admin. CONTRACT §3.1 lets the defaults change while the contrast still passes. Changed values are in bold. Ratios are on `surface`.

| Token | Old | New | Ratio |
|---|---|---|---|
| `--annoudio-color-surface` | `#ffffff` | `#ffffff` | |
| `--annoudio-color-text` | `#1f1f1f` | `#1f1f1f` | 16.5 |
| `--annoudio-color-muted` | `#595959` | `#595959` | 7.0 |
| `--annoudio-color-accent` | `#0b5cad` | **`#0b6e99`** | 5.7 |
| `--annoudio-color-on-accent` | `#ffffff` | `#ffffff` | 5.7 on accent |
| `--annoudio-color-border` | `#767676` | `#767676` | 4.5 |
| `--annoudio-color-wave` | `#8c8c8c` | **`#848484`** | 3.7; 3.0 on region |
| `--annoudio-color-region` | `#d5e3f3` | **`#d6eaf5`** (accent hue) | text on region 13.3, accent on region 4.6 |
| `--annoudio-color-focus` | `#0b5cad` | **`#0b6e99`** | 5.7 |
| `--annoudio-radius` | `6px` | `6px` (= `--ao-radius-m`) | |
| font, size, space, timeline height | | no change | |

Why the wave changes: the old wave on the old region is **2.58:1**, below the 3:1 that CONTRACT promises for non-text. The new pair is 3.0:1. To do (outside this design scope): update CONTRACT §3.1 rule 6 (accent 5.7, on-accent 5.7, wave 3.7) and the defaults in `embed/src/styles.ts`, `projects/theme.ts` placeholders and `annotate.css`.

The defaults stay light (CONTRACT §3.1 rule 4). A project that wants a dark widget sets this tested set in its Theme tab: surface `#222222`, text `#ebebeb` (13.4), muted `#c3c3c3` (9.0), accent `#41b2ec` (6.7), on-accent `#141414` (7.7), border `#808080` (4.0), wave `#9a9a9a` (5.7; 4.3 on region), region `#1b3a4b`, focus `#41b2ec`. The Theme tab can offer it as **Use the dark set**.

The member pages read the same `--annoudio-*` project tokens (`annotate.css` does this now), so a project's accent colours the Annotate page too. Change `annotate.css` so it uses the `--ao-*` names with the `.ao-member` scale. Its own fallbacks then become the widget defaults above.

## 8 Icons

There is one inline SVG set: a 24×24 grid, 1.5 stroke (2 in badges and buttons, next to 600 text), `currentColor`, round caps, no fill. Each icon is a `<symbol>` used with `<use href="#i-…">`. In React, one `Icon` component holds the paths.

| Name | Means | Name | Means |
|---|---|---|---|
| `story` | a story | `reply` | a reply |
| `recording` | a recording (waveform) | `project` | a project |
| `site` | a website address | `concept` | a concept or topic |
| `member` | a member | `invite-code` | an invite code |
| `processing` | Processing | `waiting` | Waiting for review |
| `returned` | Returned | `published` | Published |
| `copy` | copy | `open` | opens elsewhere (Open on the site) |
| `play` | play a time range | `chevron` | dropdown |
| `go` | go to the linked thing | `add` | make a new thing |
| `remove` | Remove | `close` | close a toast or dialog |
| `alert` | an error | `theme` | the Theme tab |

Rules: an icon always goes with a word, or with an `aria-label` on its button. A decorative icon is `aria-hidden="true"`. Do not use one icon for two meanings. The Payload nav keeps its own icons.

## 9 Accessibility rules

1. Use native elements: `<a href>` to go somewhere, `<button>` to act, `<select>`, `<dialog>`, `<input type="color">`. Use no ARIA where a native element does the job.
2. Focus: `:focus-visible` gets a 2px `--ao-focus` outline with a 2px offset (5.7:1 light, 6.7:1 dark), and Payload's `--accessibility-outline` is the same. Never use `outline: none`. In forced-colours mode the components get system-colour borders.
3. Targets are 40px in the admin and 44px on the member pages, and never less than 24px (WCAG 2.5.8). A list row is one target, and the chips and buttons in it sit above it.
4. Each field has a visible `<label>`. Help text goes under the label and is linked by `aria-describedby`. On an error: `aria-invalid="true"`, the error text under the field, and focus moves to the first invalid field. Submit stays on until the request starts.
5. Colour is never the only cue: a badge has an icon and a word, a step has a tick and hidden text "Done:", and an error has an icon and a sentence.
6. Contrast is ≥ 4.5:1 for text and ≥ 3:1 for control edges, icons and focus, in both themes. The colour picker shows the operator the ratio of what they set.
7. A dialog opens with `showModal()`, so the rest of the page is inert. Escape closes it and focus goes back to the trigger. A Remove dialog focuses **Cancel**.
8. Announcements: toasts and "Copied." use `role="status"`, and errors use `role="alert"`. An error toast stays until it is closed.
9. Structure: one `<h1>` for each page (the page header). Headings go down in order. Tabs are links with `aria-current="page"`.
10. Zoom: the pages reflow at 320px and at 200% zoom with no sideways scroll. Text containers have no fixed height. Use logical properties (`margin-inline-start`) so a right-to-left language mirrors the layout.
11. Phone: field text is 16px, and the main action stays in the sticky bar above the safe area.

## 10 What not to do

- Do not make custom scrollbars, custom checkboxes drawn from divs, or a custom select list where the native `<select>` does the job.
- Do not use an animation that blocks or delays a step, a spinner on a screen that loads in under 300ms, or motion that ignores `prefers-reduced-motion`.
- Do not put more than one filled button in a view. Do not use a filled red button outside the confirm dialog.
- Do not use red, amber, plum or green for anything except their one meaning (§3.4). Do not use the accent on static text.
- Do not hard-code a hex in a component: use a `--ao-*` token. Do not use a primitive (`--ao-plum-600`) in a component.
- Do not override Payload classes beyond the three rules in §4. Do not use `!important` against `payload-default` (it is not needed).
- Do not use a placeholder as a label, an icon with no name, or a tooltip as the only place for the reason that a button is off.
- Do not use `rem` for admin sizes (1rem is 13px there). Use the `--ao-text-*` and `--ao-space-*` tokens.
- Do not use the word "player" in UI text. Use "widget" (CONTEXT.md). The sidebar link becomes **Add a widget**, and the page title becomes **Add a widget to a site**. `ia.md` §7 must then change too.
- Do not use `user-select: none` on text, a fixed height on text, or truncation without a way to see the full text (a cut chip label also goes in the chip's `title` and the chip opens the full record; a cut row title opens the full story).

## 11 Not verified, and open points

- Not verified: the §4 overrides inside a running Payload admin (only the style guide is rendered). Check them on Today, a story, a project edit view and the list views, in both themes, before the build.
- Not verified: the guide with a screen reader. Done: it renders in Chromium at 1280px and 390px, in light, dark and both, with no sideways scroll and no console errors.
- Open: the extra hue (plum) is a new colour in the product. The other choice is that Returned uses `--ao-processing-*` (grey) with the `returned` icon. That has fewer colours, but "member's move" and "system's move" then look the same. Recommendation: keep plum.
- Open: the widget accent change (`#0b5cad` → `#0b6e99`) is visible on every host that does not set a theme. It is additive within v1 (a default, not an interface), but it needs a line in the changelog.
