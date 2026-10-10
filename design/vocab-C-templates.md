# Project vocabulary, design C: template first

Status: design, 2026-10-09. One of three designs (A, B, C) for the project vocabulary. Read `CONTEXT.md` first; this file uses its words, and section 13 proposes new ones.

## 1 The problem

The owner rejected the Phase 5 vocabulary: "Concepts right now is just tags." The requirement, verbatim: "I wanted each project to own an ontology/vocabulary like dcterms foaf etc. importable, and be able to add custom labels to their fields and have values in them."

So a project owns a **vocabulary**: a set of **properties** (`dcterms:spatial`, `dcterms:temporal`, a custom one). Each property has a label that the member sees, help text, a value type and, for a choice, a **list** of allowed values. A story carries **answers**: values for those properties. Answers round-trip as W3C Web Annotation JSON-LD and export as linked data.

Design C starts from the people who use it least technically: the operator who sets it up, and the member on a phone. The operator never chooses an ontology. The operator writes a form, **"What we ask about each recording"**: an ordered list of **questions**. Each question is a property with a project label. The operator picks questions from a short **catalogue** ("Place", "When it happened", "Who is speaking") or writes their own. Underneath, each question is a real property IRI. A vocabulary file is for people who have one, behind **Advanced**.

## 2 Prior art

| Tool | What it has | What we take |
|---|---|---|
| Omeka S resource templates (omeka.org/s/docs/user-manual/content/resource-template/) | Per property: alternate label, alternate comment, required, data types. Custom Vocab gives a dropdown list (terms, items or URIs with labels). Value Suggest looks up authorities. dcterms, foaf and bibo load by default. A template gives one label per property (1:1). | The whole model: a template row = property + local label + help + required + type. The 1:1 label rule. Omeka also integrates with this project (Phase 7a). |
| Omeka S default experience | The operator sees all 55 dcterms properties in a picker. | The pain we avoid: our picker shows 14 plain questions; the full file is behind Advanced. |
| Hypothesis | Free tags only, no fields. CIViC writes fields as prefixed tags ("EID1234") by convention. | Evidence that people need fields, and that tag conventions lose meaning. |
| Recogito (2 and Studio) | Entity kinds (place, person, event); a place links to a gazetteer IRI; a project tag list for autocomplete. Not verified against current docs. | A choice answer = a label plus an IRI. A tag list is one list among many. |
| Annotorious | Tags are `TextualBody` with `purpose: tagging`. No form schema in the core. | Generic clients read `TextualBody` values. Our answers must be `TextualBody`. |
| SHACL (W3C) | `sh:path`, `sh:name` (label in the context of the shape), `sh:description`, `sh:order`, `sh:minCount`, `sh:in`. | The export format of a template. `sh:name` is a local label that asserts nothing about the global IRI. |

## 3 Decisions

1. **One template per project in v1.** The interface already takes the instance (`form({ project, recording })`), so a later "this recording asks other questions" changes no caller. Reasons: one form to look after; answers line up across recordings for counts and export; the widget needs one label map per project.
2. **A label belongs to the pair (project, property).** One property has one label in a project, as in Omeka. Two "place" questions need two properties: the second is a custom property "Place of birth", which is a kind of Place (`rdfs:subPropertyOf dcterms:spatial`).
3. **One answer = one WADM body**: a `TextualBody` whose `value` is the text a person reads, with the CURIE keys `rdf:predicate` (the property) and, when the answer has a machine value, `rdf:object` (a list IRI or a typed literal). No extension context. Section 4 gives the reasons.
4. **Labels are not in the stored story.** The widget gets them from the theme JSON. A label change rebuilds nothing.
5. **Today's concept tree becomes the list "Topics"**, bound to the question "Topic" (`dcterms:subject`). Concept IRIs do not change.
6. **A reply has no answers** (as it had no tags, `phase5b-notes.md` decision 4).
7. **Every answer is public** after review. No team-only questions in v1.

## 4 WADM storage

Three options were checked against the Web Annotation Data Model (W3C Recommendation, 2017) and its Vocabulary, and tested with jsonld.js 8.3.3 against a local copy of `anno.jsonld` (a scratch script; not in the repository).

| Option | Valid WADM | Generic client shows it | Triples survive RDF |
|---|---|---|---|
| A: one structured body (a JSON object or a `schema:PropertyValue` list) | Yes (extension) | No: Mirador and Annotorious show `TextualBody` values only | Yes |
| B: today's pair per value (`SpecificResource` + `TextualBody` label), with the property on each | Yes | Yes (the label) | **No.** `body` is a set, not a list, in `anno.jsonld`. The pair is joined only by array order, and RDF loses the order. |
| C: one `TextualBody` per answer with `rdf:predicate` and `rdf:object` | Yes | Yes (the value) | Yes |

Choice: **C**. The reasons, from the specifications:

- Model §3.3.5: a `TextualBody` MAY have 0 or more `purpose`s. A choice answer has `purpose: "tagging"` (so an older v1 player and Annotorious show it as a tag). Every other answer has `purpose: "describing"`.
- Vocabulary §4: "If there is a property in one of the ontologies that are already included in the context, then it is RECOMMENDED to use a CURIE ... as the JSON-LD key rather than creating a new context." `anno.jsonld` has the prefixes `rdf`, `rdfs`, `dcterms`, `dc`, `foaf`, `skos`, `schema`, `as`, `owl`, `xsd`. So `rdf:predicate` and `rdf:object` need no new context, and no namespace IRI that someone must keep for years (the reason of `phase5b-notes.md` decision 2).
- Vocabulary §4: implementations "MUST ignore unfamiliar properties". A client that does not know `rdf:predicate` still shows the value.
- The test: an extension term `"annoudio:property": { "@id": "rdf:predicate" }` **fails** in jsonld.js ("term in form of IRI must expand to definition", invalid IRI mapping). A term with a colon must expand to itself. The `@reverse` term of Phase 5b passed only because the check does not apply to it. The CURIE keys expand to the right N-Quads, and compaction with the plain `anno.jsonld` gives the same JSON back.
- In RDF, a body with `rdf:predicate` is an `rdf:Statement` (RDFS domain). That is true: the body states "the moment has this property with this value". The subject is the target, by the meaning of an annotation. For an answer about the story, not the moment (only "Where you know this from"), the body adds `"rdf:subject": { "id": "<story IRI>" }`.
- `value` is always human text. A machine value goes in `rdf:object`: `{ "id": IRI }` for a list value or a link, `{ "@value": "1962~", "@type": EDTF }` for a date. So Mirador shows "about 1962", not "1962~".

### 4.1 One full story

```json
{
  "@context": "http://www.w3.org/ns/anno.jsonld",
  "id": "https://ORG/stories/river-voices/1/0192a3b4-…",
  "type": "Annotation",
  "motivation": "commenting",
  "created": "2026-10-09T10:12:00Z",
  "creator": { "id": "https://ORG/members/m-104", "type": "Person", "nickname": "Asha" },
  "rights": "https://creativecommons.org/licenses/by/4.0/",
  "body": [
    { "type": "TextualBody", "value": "My father worked the ferry. The horn meant…",
      "format": "text/plain", "language": "en" },
    { "type": "TextualBody", "value": "North landing", "format": "text/plain", "language": "en",
      "purpose": "tagging",
      "rdf:predicate": { "id": "dcterms:spatial" },
      "rdf:object": { "id": "https://ORG/vocab/river-voices/c/north-landing" } },
    { "type": "TextualBody", "value": "about 1962", "format": "text/plain", "language": "en",
      "purpose": "describing",
      "rdf:predicate": { "id": "dcterms:temporal" },
      "rdf:object": { "@value": "1962~", "@type": "http://id.loc.gov/datatypes/edtf/EDTF" } },
    { "type": "TextualBody", "value": "Ravi", "format": "text/plain", "language": "en",
      "purpose": "describing",
      "rdf:predicate": { "id": "http://id.loc.gov/vocabulary/relators/spk" } },
    { "type": "TextualBody", "value": "Ferry", "format": "text/plain", "language": "en",
      "purpose": "tagging", "rdf:predicate": { "id": "dcterms:subject" },
      "rdf:object": { "id": "https://ORG/vocab/river-voices/c/ferry" } },
    { "type": "TextualBody", "value": "My family", "format": "text/plain", "language": "en",
      "purpose": "tagging", "rdf:predicate": { "id": "https://ORG/vocab/river-voices/p/connection" },
      "rdf:object": { "id": "https://ORG/vocab/river-voices/c/my-family" } },
    { "type": "TextualBody", "value": "My grandmother told me", "format": "text/plain", "language": "en",
      "purpose": "describing", "rdf:predicate": { "id": "dcterms:source" },
      "rdf:subject": { "id": "https://ORG/stories/river-voices/1/0192a3b4-…" } }
  ],
  "target": {
    "type": "SpecificResource", "source": "https://ORG/recordings/1",
    "scope": "https://ORG/projects/river-voices",
    "selector": { "type": "FragmentSelector", "conformsTo": "http://www.w3.org/TR/media-frags/", "value": "t=62,95" }
  }
}
```

Body order: the text body, media bodies, then answers in template order. Order is display only; meaning does not depend on it. "Ravi" has no `rdf:object`: the member typed a name that is not in the list (section 7).

## 5 The catalogue

Fourteen common questions. The default label and help are in the project language (English shown). The operator can change both. "Export of a typed answer" is section 10.

| Key | Default label | Default help | Property | Value type | Export of a typed answer (no list IRI) |
|---|---|---|---|---|---|
| topic | Topic | What is this moment about? | `dcterms:subject` | choice, many, list "Topics" | `[ a skos:Concept; skos:prefLabel "…" ]` |
| place | Place | Where did this happen? | `dcterms:spatial` | choice + other | `[ a dcterms:Location; rdfs:label "…" ]` |
| when | When it happened | A year is enough. | `dcterms:temporal` | date | `"1962~"^^edtf:EDTF` |
| speaker | Who is speaking | | `marcrel:spk` (Speaker) | choice + other | `[ a foaf:Person; foaf:name "…" ]` |
| performer | Who is singing or playing | | `marcrel:prf` (Performer) | choice + other | as speaker |
| interviewer | Who asks the questions | | `marcrel:ivr` (Interviewer) | choice + other | as speaker |
| mentions | People mentioned | | `schema:mentions` | choice + other, many | as speaker |
| language | Language spoken | | `dcterms:language` | language, many | `"ml"^^dcterms:RFC5646` |
| kind | Kind of sound | Speech, song, music … | `dcterms:type` | choice, list "Kinds" (seeded, editable) | as topic |
| title | Short title | A name for this moment. | `dcterms:title` | text | literal |
| hear | What you hear | | `dcterms:description` | text, several lines | literal |
| keywords | Keywords | | `schema:keywords` | text, many | literal |
| link | Link to more | A web address. | `rdfs:seeAlso` | link | IRI |
| source | Where you know this from | A book, an archive, a person. | `dcterms:source`, about the story | text or link | on the story IRI |

`marcrel:` is `http://id.loc.gov/vocabulary/relators/`; the Library of Congress declares each relator a sub-property of `dcterms:contributor`. Note on `foaf:name`, which the owner named: it names a person. It never goes on the moment (`<moment> foaf:name "Ravi"` says the moment is called Ravi). It goes inside the person node on export.

**Value types** (six): `text` (one line ≤ 200 characters, or several lines ≤ 2000), `choice` (from one list; one or many; "Members can add their own answer"), `date` (year, year and month, or full date; "about"; stored as EDTF), `number` (decimal), `link` (https only), `language` (a built-in list of BCP 47 tags; the project language first).

**Your own question** mints a property `{origin}/vocab/{project}/p/{key}` (key rules as for concepts, `phase5-notes.md` decision 11). The operator gives a label, help, a type and, optionally, "Is this a kind of …?" (a catalogue question) → `rdfs:subPropertyOf`. The IRI never changes, also when the label changes.

## 6 Admin

Sidebar: **Concepts** becomes **Questions** (ia.md §4.1 rule 2; ≤ 3 words). It opens the template of the project (a project picker for more than one project, as the Concepts page now).

```
┌ Questions · River Voices ─────────────────────────────────────── [River Voices ▾] ┐
│ What we ask about each recording                                                 │
│ Members see these questions below their story, in this order.                    │
│ ≡ 1 Place             Choice from "Places" (24), or their own   Must answer [Edit]│
│ ≡ 2 When it happened  Date                                       Optional  [Edit]│
│ ≡ 3 Who is speaking   Choice from "Speakers" (6), or their own   Optional  [Edit]│
│ ≡ 4 Topic             Choice from "Topics" (31), more than one   Optional  [Edit]│
│ [ + Add a question ]   [ See it on a phone ]                                     │
│ Lists: Places · Speakers · Topics · Kinds       [ + New list ]                   │
│ ▸ Advanced: load a vocabulary file · download as linked data                     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

```
┌ Add a question ─────────────────────────────┐   ┌ Edit: Place ──────────────────────────────────┐
│ Common questions                            │   │ Question  [Place                       ]      │
│  Place · When it happened · Who is speaking │   │ Help      [Where did this happen?      ]      │
│  Who is singing or playing · Topic ✓ asked  │   │ Answer    ( ) Text  (•) Choice  ( ) Date      │
│  … 14 in all                                │   │           ( ) Number ( ) Link ( ) Language    │
│ From your files (Advanced)                  │   │ Choices from [Places ▾] [Edit the list]       │
│  River Archive schema: Ferry route …        │   │ [x] Members can add their own answer          │
│ Your own question                           │   │ [ ] More than one answer                      │
│  [ Write a new question ]                   │   │ [x] Must answer                               │
└─────────────────────────────────────────────┘   │ 12 stories answer this question.              │
                                                  │ Saved as: dcterms:spatial (Dublin Core)       │
                                                  │ [ Save ]  [ Remove from the form ]            │
                                                  └───────────────────────────────────────────────┘
```

Rules:
1. Drag (≡) or the keyboard (Move up, Move down) sets the order.
2. With answers in stories, **Answer** is locked: "12 stories answer this question. To ask in a new way, add a new question." The label, help, list, "Must answer" stay free.
3. **Remove from the form** stops new answers. Old answers stay in their stories and keep their label in the widget.
4. A list page is today's concept tree (O10, O11, O12 of ia.md), one list among many: add, rename, move, hide, the delete guard ("12 stories use this").
5. Review screen (O5): answers show as "Place: North landing". An answer that a member typed shows "Ravi (new)" and **Add "Ravi" to Speakers**. The button adds the concept; the story keeps its text answer (v1; section 12, item 3).
6. Today checklist, optional line: "Add questions, so members tell you place and time."

Advanced: load a vocabulary file.

```
┌ Load a vocabulary file ─────────────────────────────────────────────┐
│ For people who have an ontology, a schema or a SKOS file.           │
│ File: river-archive.ttl (Turtle, JSON-LD or RDF/XML; 1 MB at most)  │
│ We found:                                                           │
│  [x] 3 properties    Ferry route, Boat name, Crew role              │
│  [x] 1 list          Boat names (40 values) → a new list            │
│  [ ] 1 form (SHACL)  "Oral history form", 6 questions → replaces    │
│                      the questions of River Voices                  │
│ Left out: 2 classes (not used here), 1 property with no label       │
│ [ Load these ]  [ Cancel ]                                          │
└─────────────────────────────────────────────────────────────────────┘
```

Loaded properties appear under "From your files" in **Add a question**. They do not become questions by themselves. Import rules: section 9.

## 7 The Annotate page (P4, phone, 360 px)

```
┌ River Voices ───────────────── Asha ▾ ┐
│ Ferry crossing, 1962                  │
│ ▶ 1:02–1:35   [ Use the player time ] │
│ Your story                            │
│ [My father worked the ferry. The …  ] │
│ [ Record a voice note ] [ Attach ]    │
│ ── About this moment ──────────────── │
│ Place *                               │
│ Where did this happen?                │
│ [ North landing ✕ ] [ search…      ]  │
│ When it happened                      │
│ A year is enough.                     │
│ Year [1962] Month [   ▾] Day [  ]     │
│ [x] About this time                   │
│ Who is speaking                       │
│ [ Ravi                             ]  │
│  Not in the list. We send "Ravi" as   │
│  your own answer.                     │
│ More questions (2)                 ▸  │
│ ───────────────────────────────────── │
│ [ Send for review ]                   │
│ * You must answer this.               │
└───────────────────────────────────────┘
```

Rules:
1. Questions come after the story text and media. The story comes first; the questions help the team find it.
2. Show every "Must answer" question and the first three others. Put the rest under **More questions (N)**.
3. A choice with ≤ 8 values shows chips. A longer list shows a search field (combobox, ARIA 1.2 pattern) that searches labels and alternative labels. With "Members can add their own answer", a text that matches no value is sent as text.
4. Error text names the question: "Answer 'Place' to send your story." Focus goes to the first error. The text of the form stays (ia.md P9).
5. Each control has a visible label and its help as `aria-describedby`. Targets are ≥ 44 px.
6. The page never shows an IRI, a prefix or the word "property".

## 8 The widget

```
┌ Asha · 1:02–1:35 ──────────────────────────────┐   ← story-meta
│ My father worked the ferry. The horn meant…    │   ← story-text
│ Place             North landing                │   ← answers > answer > answer-label, answer-value
│ When it happened  about 1962                   │
│ Who is speaking   Ravi                         │
│ Topic             [Ferry] [Horn]               │   ← each list value is also a tag part
└────────────────────────────────────────────────┘
```

New parts (CONTRACT §3.3, additive): `answers` (a `<dl>`, absent with no answers), `answer` (one property), `answer-label` (`<dt>`), `answer-value` (`<dd>`, one per value). A value from a list keeps the part `tag` too, so host CSS for `tag` still works.

Theme JSON (CONTRACT §3.2, rule 6, additive key):

```json
"questions": [
  { "property": "http://purl.org/dc/terms/spatial", "label": "Place" },
  { "property": "http://purl.org/dc/terms/temporal", "label": "When it happened" }
]
```

Rules: array order is the template order; removed questions with answers follow. The player groups answer bodies by `rdf:predicate` and shows them in that order. An answer whose property is not in `questions` shows its value with no label, after the others. Older v1 players and other stacks' players show `tagging` answers as tags and `describing` answers as text paragraphs: a degrade, not a break (CONTRACT §6 rule 9).

## 9 Import and export

**Import** (Advanced; Turtle and JSON-LD with the parsers of Phase 5; RDF/XML needs `rdfxml-streaming-parser`, a new dependency, because FOAF ships as RDF/XML). No remote contexts, no fetch of any IRI in the file (`phase5-notes.md` decision 10).

| In the file | Becomes |
|---|---|
| `rdf:Property`, `owl:DatatypeProperty`, `owl:ObjectProperty`, `owl:AnnotationProperty` | A property in the vocabulary. Label: `rdfs:label` in the project language, else English, else the local name. Help: `rdfs:comment`. |
| `rdfs:range` | A value type guess: `xsd:date`/`gYear` → date; `xsd:decimal`/`integer` → number; `rdfs:Literal`/`xsd:string` → text; `skos:Concept` → choice; another class → choice + other. The operator can change it before the first answer. |
| `skos:ConceptScheme` + concepts | A list (the Phase 5 SKOS rules: merge by IRI, never remove). |
| `sh:NodeShape` with `sh:property` | A form: `sh:path` → property, `sh:name` → label, `sh:description` → help, `sh:order` → order, `sh:minCount ≥ 1` → must answer, `sh:in` or `sh:class` + scheme → list, `sh:datatype` → type. Other SHACL is left out and listed. |

Limits: 1 MB, 5000 concepts, 200 properties per file.

**Export** (admin, **download as linked data**):

1. **Stories as WADM**: `exportStories` as now; answers are in the bodies.
2. **Statements as TriG**: one named graph per published story; the graph name is the story IRI, so who said it stays with what was said. The subject is the moment IRI `https://ORG/recordings/1#t=62,95` (or the story IRI for an answer about the story). With `rdf:object`: `<moment> P <object>`. Without it, the property's range kind decides: a literal (`dcterms:title "…"`), or a labelled blank node (table in section 5). Each moment also gets `dcterms:isPartOf <recording>`.
3. **The vocabulary as Turtle**: the template as a SHACL `sh:NodeShape` with no target (SHACL allows it: the shape describes the form, and a user can add a target to validate the TriG), custom properties as `rdf:Property` with `rdfs:label`, `rdfs:comment`, `rdfs:subPropertyOf`, lists as SKOS. A file that this stack exports, it can import again with no change.

```turtle
<https://ORG/vocab/river-voices/t/default> a sh:NodeShape ;
  sh:property [ sh:path dcterms:spatial ; sh:name "Place"@en ; sh:description "Where did this happen?"@en ;
                sh:order 1 ; sh:minCount 1 ; sh:class skos:Concept ] .
```

## 10 Limits

| Limit | Value | Why |
|---|---|---|
| Questions per form | 12 | A phone form; more questions, fewer stories |
| Properties per project | 200 | the import limit |
| Values per question | 10 (as tags today) | |
| Answers per story | 40 | body count and page size |
| Text answer | 200 or 2000 characters | |
| One property per form | yes | one label per (project, property) |
| Answer type change after answers | refused | stored values keep one meaning |
| Lists per project | 50; 5000 concepts in all | Phase 5 import limit |
| Label languages | one, the project language | section 12, item 5 |

## 11 Interfaces

### 11.1 `vocabulary` (deep)

```ts
export function createVocabulary(config: VocabularyConfig): Vocabulary
export interface VocabularyConfig {
  payload: Payload
  origin: string                                  // ANNOUDIO_ORIGIN, base of every minted IRI
  stories: () => { answerCounts(project: ProjectSlug): Promise<Map<PropertyIri, Map<string, number>>>
                   conceptChanged(iri: ConceptIri, o?: { req?: PayloadRequest }): Promise<void> }
}
export interface Vocabulary {
  collections: CollectionConfig[]                 // properties, lists, concepts, templates
  CATALOGUE: readonly CatalogueEntry[]            // the 14 questions of section 5
  LIMITS: typeof FORM_LIMITS & typeof IMPORT_LIMITS

  // Annotate page: the questions to ask in this instance, with labels, help, type, choices (≤ 50 inline)
  form(instance: Instance): Promise<Form>
  choices(project: ProjectSlug, list: ListIri, query: string): Promise<Choice[]>   // the combobox
  // stories.saveDraft: check member input; return meaning, never JSON
  resolve(instance: Instance, input: AnswerInput[]): Promise<
    { ok: true; answers: ResolvedAnswer[] } | { ok: false; errors: AnswerError[] }>
  // theme JSON and the admin panel
  labels(project: ProjectSlug): Promise<{ property: PropertyIri; label: string }[]>
  // linked data
  statements(project: ProjectSlug, story: { iri: string; moment: string; answers: ResolvedAnswer[] }): Quad[]
  exportVocabulary(project: ProjectSlug, format: 'turtle' | 'jsonld'): Promise<{ name: string; body: string }>
  importVocabulary(operator: OperatorSession, project: ProjectSlug, file: File,
                   accept?: ImportChoice): Promise<ImportPreview | ImportReport>
  removeVocabulary(project: ProjectSlug, o?: { req?: PayloadRequest }): Promise<void>
}
export type AnswerInput = { property: PropertyIri; values: string[] }   // concept IRIs or text, as the form sends
export interface ResolvedAnswer {
  property: PropertyIri
  about: 'moment' | 'story'
  display: string; language: string               // the human text: "about 1962"
  object?: { iri: string } | { literal: string; datatype: string }
  purpose: 'tagging' | 'describing'
}
export type AnswerError = { property: PropertyIri; code: 'required' | 'not-in-list' | 'bad-date'
  | 'bad-number' | 'bad-link' | 'too-long' | 'too-many' | 'unknown-question' }
```

It hides: IRI minting, the catalogue, EDTF parse and display per language, list lookup, the range kind and its projection to triples, SHACL/RDFS/SKOS parse and write, import merge rules, the delete guards (a property or concept in use stays). `resolve` is the one write-side seam: `stories` gets meaning and shapes the JSON. The WADM shape stays inside `stories` (CONTEXT seam rule).

### 11.2 `stories` changes

| Now | After |
|---|---|
| `DraftInput.tags: ConceptIri[]` | `DraftInput.answers: AnswerInput[]`; `saveDraft` calls `vocabulary.resolve`, then shapes one body per value |
| `SaveError` `reply-and-tags` | `reply-and-answers`; new `answers` code with `AnswerError[]` |
| `OwnDraft.tags`, `StoryReview` tags | `answers: { property, label, values: { display, iri? }[] }[]` |
| `tagCounts(project)` | `answerCounts(project)` (feeds the delete guards and the list counts) |
| `conceptChanged(iri)` | unchanged: a concept label change rebuilds `display` |
| `parseBodies` reads tag pairs | reads answer bodies; the pair form goes after the migration |
| `exportStories(operator, filter)` | adds `format: 'wadm' | 'trig'`; TriG calls `vocabulary.statements` |

### 11.3 Data model

| Collection | Fields | Notes |
|---|---|---|
| `properties` (new) | project, iri (read-only), origin (`catalogue` \| `custom` \| `imported`), catalogueKey?, label, help, valueType, lines (1 \| 5), list?, allowOther, many, about, rangeKind, rangeClass?, subPropertyOf?, hidden | unique (project, iri) |
| `lists` (new) | project, iri, label, hidden | Topics keeps `{origin}/vocab/{project}` (the Phase 5 scheme IRI); new lists `…/l/{key}` |
| `concepts` | + `list` (required) | IRIs unchanged; keys stay unique per project |
| `templates` (new) | project (unique in v1), iri `…/t/default`, questions: array of { property, required } | array order = question order |
| `stories` | no column change | `wadm` bodies change shape |

## 12 Payload feasibility

- An `array` field gives drag order and row add or remove in the admin with no code. The **Questions** page is still a custom view (`views.questions`, as `views.concepts`): the catalogue picker and the plain row summary need it. Server components call `vocabulary` only.
- `relationship` with `filterOptions` limits a row's property and a property's list to the project.
- The lock of rule 2 (section 6) is a `beforeValidate` hook with `answerCounts`, as the concept delete guard.
- Import goes through a Server Action (1 MiB default: the 1 MB limit holds).
- `unique: true` on `templates.project` keeps one form per project; a later per-recording form drops it and adds `recordings`.

## 13 Migration of today's concepts

One migration, `up` and `down`, tested on rows written in the old shape (`.claude/rules/app-migrations.md`):

1. Per project: a list "Topics" with the scheme IRI `{origin}/vocab/{project}`; every concept gets `list` = Topics.
2. Per project: a property `dcterms:subject`, label "Topic" (in the project language), choice, many, list Topics; and a template with that one optional question. A project with no concepts gets an empty template: members see no questions, as they now see no topics.
3. Each stored story, main and versions tables: each pair (`SpecificResource` + `TextualBody`, `purpose: tagging`) becomes one answer body with `rdf:predicate dcterms:subject` and `rdf:object` the concept IRI. `modified` does not change: the member changed nothing.
4. Rebuild every precomputed representation. ETags change once.
5. `down` makes the pairs again from `rdf:object` and `value`, for `dcterms:subject` answers only; other answers cannot exist before `up`.

Proposed `CONTEXT.md` changes (outside this task): **Vocabulary** = "the properties of a project, each with a project label"; new **Property**, **Question** (operator and member word for a property in the form), **Form** ("What we ask about each recording"; `templates` in code), **List** (a SKOS concept scheme; today's tree is the list Topics), **Answer** (a value of a property in a story; one WADM body). **Topic** becomes the default label of the `dcterms:subject` question. The fixed decision "SKOS tags are two bodies" becomes "one answer body".

## 14 Trade-offs

Simple where it matters for the operator and the member:

1. Fourteen questions in plain words cover community audio. A dcterms file has 55 properties; FOAF has more. The operator never sees them unless they choose Advanced.
2. Six value types, no nested answers ("a person with a role and a birth year"), no repeated groups, no questions that show only after another answer. Each of these doubles the form code and the phone layout.
3. A member's own answer ("Ravi") stays text. **Add to the list** does not link old answers to the new concept in v1: that is an operator edit of a member's story, which the review rules do not have yet.
4. One form per project. A music recording and an interview in the same project get the same questions. Hidden-by-default questions under **More questions** soften this.
5. One label language. A bilingual site (Malayalam and English) shows one label. Labels as language maps are a later, additive change of the theme JSON.

What a linked-data expert would miss, and our answer:

| They would say | Our position |
|---|---|
| "Reification is old; use RDF 1.2 triple terms (`<<( s p o )>>`)." | WADM JSON-LD and generic clients do not read triple terms. The body-as-statement is valid now and exports to plain triples. |
| "Your text answers become blank nodes. They do not link across exports." | True. Stable IRIs need lists (or reconciliation). A list can hold external IRIs (GeoNames, Wikidata) by SKOS import. A lookup service, as Omeka Value Suggest, is later. |
| "DCMI ranges: `dcterms:spatial` wants a `dcterms:Location`, not a literal." | The export gives a typed node, never a bare literal, for resource ranges (section 5). |
| "The label is not in the annotation. A story read alone does not say 'Place'." | The property IRI says what it is; the SHACL export gives `sh:name`. Custom property IRIs should dereference to their label; that route is a later step, as for concept IRIs. |
| "No SHACL validation, no OWL reasoning." | We read a subset of SHACL to build a form. `resolve` checks values. A full validator is weight with no member gain. |
| "`schema:mentions`, MARC relators and Dublin Core in one shape: mixed ontologies." | That is normal Linked Data practice (Europeana EDM mixes them). The catalogue picks the most used property for each question. |
| "The moment IRI `…/1#t=62,95` of two stories is the same subject." | Correct: the same moment. TriG keeps who said what per story graph. |

## 15 Open questions

1. Per-recording forms: which job asks first, music or interviews? The interface is ready; the admin is not.
2. Should **Add to the list** also link the member's text answer to the new concept (an operator edit with a History line)?
3. Is the EDTF datatype IRI `http://id.loc.gov/datatypes/edtf/EDTF` the one the Library of Congress serves? Not checked.
4. Recogito Studio's tag vocabulary features: from memory, not checked against current documents.

Sources: W3C Web Annotation Data Model §3.3.5, §4.1 (https://www.w3.org/TR/annotation-model/); Web Annotation Vocabulary §4 Extensions (https://www.w3.org/TR/annotation-vocab/); `anno.jsonld` (http://www.w3.org/ns/anno.jsonld); Omeka S resource templates (https://omeka.org/s/docs/user-manual/content/resource-template/), Custom Vocab (https://omeka.org/s/docs/user-manual/modules/customvocab/), Value Suggest (https://omeka.org/s/docs/user-manual/modules/valuesuggest/); CIViC Hypothesis tag convention (https://bcgsc.ca/downloads/civic-nli/tags/); W3C public-annotation list on semantic tags (https://lists.w3.org/Archives/Public/public-annotation/2015Jun/0112.html).
