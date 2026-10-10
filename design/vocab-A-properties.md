# Vocabulary design A: property-based

Date: 2026-10-09. Status: proposal (one of several designs). Read `CONTEXT.md` first. This file uses its words, and it proposes new words in §1.

The requirement (owner, verbatim): "I wanted each project to own an ontology/vocabulary like dcterms foaf etc. importable, and be able to add custom labels to their fields and have values in them." The owner rejected the Phase 5 concept tree: "Concepts right now is just tags."

Organizing principle: **a vocabulary is a flat, ordered list of fields. Each field puts one RDF property on the Annotate form.** Today's concept tree survives as the range of one field (`dcterms:subject`, label "Topics").

## 1 Words

| Term | Meaning | Not |
|---|---|---|
| **Vocabulary** | The ordered list of fields of one project. Changes meaning: today it is the concept tree. | ontology, schema, form |
| **Field** | One row of a vocabulary: a property, a label, a help line, a value type, one or many, needed or optional, hidden or not. Has an IRI: `{origin}/vocab/{project}/f/{key}`. | question, column |
| **Property** | An RDF property IRI, for example `http://purl.org/dc/terms/spatial`. Stack-wide. Comes from an ontology or is custom. | attribute, predicate (in UI text) |
| **Ontology** | A standard file that the stack loaded, for example DCMI Terms. A source of properties. Operators pick properties from it. | vocabulary |
| **Custom property** | A property that an operator makes. IRI `{origin}/vocab/p/{key}`. | |
| **List** | The closed set of choices of a choice field. Kinds: concepts, places, people. Today's concept tree becomes the list "Topics". A SKOS concept scheme. | taxonomy, enum |
| **Concept** | One entry of a list. Unchanged: stable IRI, label, optional parent. | |
| **Value** | What one story holds for one field. Stored as one body. | answer, metadata |
| **Topic** | Unchanged: the member's word for a concept in the list "Topics". | |

`CONTEXT.md` is outside this task. If this design holds, its owner must change **Vocabulary**, add the other rows, and change the fixed decision "SKOS tags are two bodies" (§3).

## 2 The field

| Part | Values | Default |
|---|---|---|
| Property | one IRI; one property at most once per project | — |
| Label | text the member and the visitor see; per project | the property's `rdfs:label` |
| Help | one line under the label on the form | the property's `rdfs:comment`, cut to 120 characters |
| Value type | `text`, `long-text`, `number`, `date`, `url`, `choice` | from the property's `rdfs:range` (§4.3) |
| List | for `choice` only: one list of the project | — |
| How many | one or many | one; `choice` many |
| Needed | needed or optional | optional |
| Show as | `line` (label: value) or `tags` (chips) | `line`; Topics `tags` |
| Hidden | hidden from new stories; stories that have a value keep it | no |
| Order | the row position | end of the list |

Place and person are not separate value types. They are `choice` fields whose list has the kind `places` (a concept can hold a latitude and a longitude) or `people` (a concept is also a `foaf:Person` with `foaf:name`). So one picker, one validator and one export rule serve all closed sets. A free-text name ("my aunt") is a `text` field.

Why one property at most once per project: the widget and the export then find the field from the property alone. An operator who needs two lists for one idea makes a custom property with `rdfs:subPropertyOf` (for example "Crafts" ⊂ `dcterms:subject`). That is correct linked data, and a reasoner still finds both as subjects.

## 3 How a value is stored in WADM

### 3.1 The options

| Option | Valid WADM | RDF triples about the target | A generic client shows it |
|---|---|---|---|
| A. One body per value: `TextualBody` with `purpose`, plus `rdf:subject`, `rdf:predicate`, `rdf:object` | Yes. `purpose` is legal on a TextualBody (Model §3.3.5); extensions are legal on any resource (Vocabulary §4); `rdf:` is a prefix of `anno.jsonld` (checked against the file) | Yes, by standard RDF reification: one generic rule gives `?s ?p ?o` | Yes: the `value` as text, or as a tag for `purpose: tagging` |
| B. One body per value: `SpecificResource`, `source` = value IRI, `purpose`, plus a property key | Yes (Model §4.1, semantic tags) | Only for IRI values. Literals (a date, a number) have no `source` | Only clients that read `source.label` |
| C. Today's pair: `SpecificResource` + label `TextualBody`, joined by array order | Yes | No: `body` is an unordered set in RDF, so the pair breaks in any RDF store | Yes, the label |
| D. One `Dataset` body, `format: application/ld+json`, `value` = a JSON-LD string | Yes (Model §3.2.2 has `Dataset`) | No: the inner JSON-LD is one string literal | No: raw JSON |
| E. Properties on the target (`target."dcterms:spatial"`) | Yes, as an extension | Yes, direct, but about a blank node | No: clients ignore unfamiliar target keys |

**Decision: A.** One value, one body. Each value body is complete alone. It holds the display text (`value`), the reason (`purpose`) and the statement (subject, predicate, object).

The rule for `purpose`: `tagging` for a choice field shown as tags; `classifying` for other choice fields from a concepts list; `identifying` for a place or a person; `describing` for text, long text, number, date and URL.

The rule for `rdf:object`: the concept IRI for a choice; a typed literal for number (`xsd:decimal`), date (`xsd:date`, `xsd:gYearMonth` or `xsd:gYear`) and URL (`xsd:anyURI`); a language-tagged literal for text. It is always present, so the reification rule needs no exception.

`rdf:subject` is the segment IRI: the recording IRI plus the Media Fragment, `{origin}/recordings/1#t=62,95`. This is the standard Media Fragments URI of the target's selection.

Why reification is right here, not only legal: a value is a member's claim, not a fact the organisation states. A reified statement records the claim without asserting it. The organisation asserts the triples only when it exports them (§9). A story's text body and its media bodies do not change.

### 3.2 One full story

```json
{
  "@context": "http://www.w3.org/ns/anno.jsonld",
  "id": "https://ORG/stories/river-voices/1/0192f3c4-7a1e-7c3d-9b2a-5e8f0d1a2b3c",
  "type": "Annotation",
  "motivation": "commenting",
  "created": "2026-10-09T10:12:00Z",
  "modified": "2026-10-09T10:12:00Z",
  "creator": { "id": "https://ORG/members/m-104", "type": "Person", "nickname": "Asha" },
  "rights": "https://creativecommons.org/licenses/by/4.0/",
  "body": [
    { "type": "TextualBody", "value": "My grandmother took this ferry to the market.", "format": "text/plain", "language": "en" },
    { "type": "TextualBody", "purpose": "tagging", "value": "Ferries", "format": "text/plain", "language": "en",
      "rdf:subject": { "id": "https://ORG/recordings/1#t=62,95" }, "rdf:predicate": { "id": "http://purl.org/dc/terms/subject" },
      "rdf:object": { "id": "https://ORG/vocab/river-voices/c/ferries" } },
    { "type": "TextualBody", "purpose": "identifying", "value": "Kumbalangi", "format": "text/plain", "language": "en",
      "rdf:subject": { "id": "https://ORG/recordings/1#t=62,95" }, "rdf:predicate": { "id": "http://purl.org/dc/terms/spatial" },
      "rdf:object": { "id": "https://ORG/vocab/river-voices/c/kumbalangi" } },
    { "type": "TextualBody", "purpose": "describing", "value": "1962", "format": "text/plain",
      "rdf:subject": { "id": "https://ORG/recordings/1#t=62,95" }, "rdf:predicate": { "id": "http://purl.org/dc/terms/date" },
      "rdf:object": { "@value": "1962", "@type": "xsd:gYear" } },
    { "type": "TextualBody", "purpose": "identifying", "value": "Mary Joseph", "format": "text/plain",
      "rdf:subject": { "id": "https://ORG/recordings/1#t=62,95" }, "rdf:predicate": { "id": "http://schema.org/mentions" },
      "rdf:object": { "id": "https://ORG/vocab/river-voices/c/mary-joseph" } },
    { "type": "TextualBody", "purpose": "describing", "value": "25", "format": "text/plain",
      "rdf:subject": { "id": "https://ORG/recordings/1#t=62,95" }, "rdf:predicate": { "id": "https://ORG/vocab/p/fare-paise" },
      "rdf:object": { "@value": "25", "@type": "xsd:decimal" } }
  ],
  "target": {
    "type": "SpecificResource",
    "source": "https://ORG/recordings/1",
    "scope": "https://ORG/projects/river-voices",
    "selector": { "type": "FragmentSelector",
      "conformsTo": "http://www.w3.org/TR/media-frags/", "value": "t=62,95" }
  }
}
```

Rules for the stored shape:

1. Property and value IRIs are full IRIs in the stored record. No CURIE depends on a context. Only `xsd:` in `@type` is a CURIE: `anno.jsonld` defines it. So the annotation keeps the single context `anno.jsonld`.
2. Order in the array: the text body, the media bodies, then value bodies in field order. Order is for the widget only; no meaning depends on it.
3. The story text is not a value. A reply has no values (as it has no tags today, `phase5b-notes.md` decision 4).
4. Checked (scratch script, not in the repository): `jsonld-streaming-parser` 5.0.1 with a local copy of `anno.jsonld` turns this example into 63 triples. Each value body gives `rdf:subject`, `rdf:predicate` and `rdf:object` with the right IRI or datatype (`xsd:gYear`, `xsd:decimal`). No key is dropped. jsonld.js and pyld are not yet checked.

## 4 Import

### 4.1 Formats

| Format | Parser | Already a dependency |
|---|---|---|
| Turtle, N-Triples | `n3` 2.7.12 | yes (Phase 5) |
| JSON-LD | `jsonld-streaming-parser` 5.0.1; no remote context (refused with a message, as Phase 5) | yes |
| RDF/XML | `rdfxml-streaming-parser` (same author as the JSON-LD parser); pin a version older than one month | no, new |

The stack never fetches an address from an uploaded file or from the operator. Reason: no server requests to addresses that an outsider can choose (Phase 5 decision 10).

### 4.2 Bundled ontologies (offline)

The app image holds three files under `app/src/modules/vocabulary/ontologies/`, each with its licence line:

| Ontology | File | Licence | Note |
|---|---|---|---|
| DCMI Metadata Terms | `dcterms.ttl` | CC BY 4.0 | about 55 properties |
| FOAF 0.99 | `foaf.rdf` | CC BY 1.0 | about 60 properties |
| schema.org | `schemaorg-current.ttl`, a release older than one month | CC BY-SA 3.0 | about 1500 properties; the picker searches it |

Gotcha: schema.org now names its terms `https://schema.org/`, but `anno.jsonld` maps `schema:` to `http://schema.org/`. The stack loads schema.org with the `http:` IRIs (schema.org says both are the same term), so that CURIEs agree with the Web Annotation context.

An operator can also upload a file (Turtle, RDF/XML, JSON-LD; 1 MB, the Server Action limit). The bundled files are larger and load on the server, so the limit does not apply to them.

### 4.3 Picking properties

The parser reads every subject typed `rdf:Property`, `owl:ObjectProperty`, `owl:DatatypeProperty` or `owl:AnnotationProperty`. For each it keeps the IRI, `rdfs:label`, `rdfs:comment`, `rdfs:range`, and `owl:deprecated`. It does not store the file. It does not reason. The range suggests a value type; the operator can change it.

| `rdfs:range` | Suggested type |
|---|---|
| `xsd:date`, `xsd:dateTime`, `xsd:gYear` | date |
| `xsd:decimal`, `xsd:integer`, `xsd:float` | number |
| `xsd:anyURI`, `foaf:Document` | url |
| `rdfs:Literal`, `xsd:string`, no range | text |
| `foaf:Person`, `foaf:Agent`, `schema:Person` | choice, list kind people |
| `dcterms:Location`, `schema:Place` | choice, list kind places |
| any other class | choice, list kind concepts |

### 4.4 Prefixes

Each ontology record keeps its prefix and namespace from the file (`@prefix`, `xmlns:`). The admin shows `dcterms:spatial`, never the full IRI, and the full IRI on hover. A prefix that `anno.jsonld` already defines with a different namespace is refused: Vocabulary §4 says an extension MUST NOT redefine a key of the Web Annotation context. Custom properties show the prefix `custom:`.

A SKOS file fills a list, not the field list: today's `importSkos` (preview, merge by IRI, never remove) becomes the import of one list.

## 5 Custom properties

The operator gives a label, a help line and a value type. The app mints `{origin}/vocab/p/{key}`. The key comes from the label (ASCII letters and digits; else 8 random hex digits; `-2` for a key in use), as concept keys do today (Phase 5 decision 11). The IRI is read-only and never changes.

A custom property is stack-wide, not per project. Two projects can use one custom property with different labels. An optional "Is a kind of" picks a parent property (`rdfs:subPropertyOf`).

`GET {origin}/vocab/p/{key}` answers with the property in Turtle (`.ttl`), JSON-LD (`.jsonld`) or a plain HTML page (no suffix): label, comment, range, parent. So a custom property is a real linked-data term that dereferences. The cost: `ANNOUDIO_ORIGIN` must never change (true already).

## 6 One property, two labels

The property is stack-wide. The label, help, type and list are per project, on the field.

| Project | Property | Label | Help | Type |
|---|---|---|---|---|
| River Voices | `dcterms:spatial` | Village | Where does this part of the story happen? | choice from "Places" |
| Kitchen Songs | `dcterms:spatial` | Where is this song from? | A town, a district or a state. | text |

Both projects export `dcterms:spatial` triples, so a search across the stack finds both. The SHACL export (§9.2) records each label as `sh:name` of that project's field, never as a new `rdfs:label` of `dcterms:spatial`. A project cannot rename a term that it does not own.

## 7 The member's side: the Annotate page

The page builds the form from `vocabulary.fields(project)`, in field order, below the text and the media buttons. Hidden fields do not show. The help line is under each label. Optional fields say "(optional)" after the label; needed fields say nothing (most fields are optional, so the mark goes on the common case).

```
 Ferry crossing, 1962 · River Voices      [ ▶ 1:02 – 1:35 ]
 Your story  [ My grandmother took this ferry to the…  ]
 [ Record a voice note ]  [ Add a photo ]

 Topics (optional)
 Pick one or more.
 ( Ferries ✓ ) ( Markets ) ( Monsoon ) [ More topics… ]

 Village
 Where does this part of the story happen?
 [ Kumbalangi                    ▾ ]

 When did it happen? (optional)
 Year, or year and month, or a full date.
 [ 1962 ]  [ Month ▾ ]  [ Day ▾ ]

 People in this story (optional)
 [ Search people…                  ]  ( Mary Joseph ✕ )

 [ Save my story ]
```

| Value type | Control | Check on save |
|---|---|---|
| text | one-line input | 1 to 500 characters |
| long text | textarea | 1 to 5000 characters (the text limit of today) |
| number | `inputmode="decimal"` input | a decimal number |
| date | year input, month and day selects | year needed; gives `xsd:gYear`, `gYearMonth` or `date`; a real day |
| url | `type="url"` input | `https:` only (`http:` for a loopback host, as recordings) |
| choice, list ≤ 12 | chips (`tags`) or a select (`line`) | a visible concept of the field's list |
| choice, list > 12 | a search box with results | the same |

The Topics picker of today is the choice field "Topics" with chips. Nothing else in the page changes for it.

A needed field with no value refuses the save: "Add a value for Village." The member's text is kept. A hidden field keeps its value in an old story; the form shows it as read-only text with "This field is no longer used", and a save keeps it.

## 8 The visitor's side: the widget

The widget reads field labels from the theme JSON (request 2, CONTRACT §3.2), so it makes no new request. Additive key: `"fields": [{ "property": "http://purl.org/dc/terms/spatial", "label": "Village", "show": "line" }, …]`, in field order. Hidden fields are in it too, because old stories still show their values.

A story shows, after its text and media:

```
 Asha · 9 Oct 2026 · 1:02–1:35
 My grandmother took this ferry to the market.
 [Ferries]
 Village               Kumbalangi
 When did it happen?   1962
 People in this story  Mary Joseph
 Fare in paise         25
```

New parts (additive under CONTRACT §12): `fields` (the list, a `<dl>`), `field`, `field-label`, `field-value`. A `tags` field keeps the `tag` part, so host CSS of today still applies.

Rules: 1. A value body is a `TextualBody` with `rdf:predicate`. The widget groups value bodies by predicate, in the order of `fields`. 2. The label comes from `fields`. A predicate that is not in `fields` (an old field, or no theme) shows the last segment of the IRI ("spatial"). The value never hides. 3. Text uses `textContent` (stories invariant 7). A url value is a link only for `http:` and `https:`, with `rel="nofollow ugc"`. 4. A date shows in the project language with `Intl.DateTimeFormat`, at the precision stored (year only stays "1962"). 5. A label change reaches every widget within the theme cache time (300 s), with no rebuild of the stories.

A generic Web Annotation client (for example Annotorious or Mirador) shows each value as text, and Topics as tags. It does not show the labels. It loses nothing else.

## 9 Export

### 9.1 Stories

The existing export (`exportStories`, WADM JSON-LD) does not change: the values are in it. New: **Download as linked data (Turtle)**. It holds, for published stories only:

```turtle
# @prefix lines for dcterms, schema, xsd left out
<https://ORG/recordings/1#t=62,95>
    dcterms:isPartOf <https://ORG/recordings/1> ;
    dcterms:subject  <https://ORG/vocab/river-voices/c/ferries> ;
    dcterms:spatial  <https://ORG/vocab/river-voices/c/kumbalangi> ;
    dcterms:date     "1962"^^xsd:gYear ;
    schema:mentions  <https://ORG/vocab/river-voices/c/mary-joseph> ;
    <https://ORG/vocab/p/fare-paise> 25.0 .
```

These are the direct triples. The serialiser makes them from the reified bodies with the one generic rule. It does not read the field list. The Turtle of the full annotations is a second choice in the same menu, for archives that want who said what.

### 9.2 The vocabulary

**Download the vocabulary** gives one Turtle or JSON-LD file per project:

- each field as a SHACL `sh:PropertyShape`: `sh:path` (the property), `sh:name` (the label), `sh:description` (help), `sh:order`, `sh:minCount 1` when needed, `sh:maxCount 1` when one, `sh:datatype` or `sh:class skos:Concept` with the list;
- each custom property as `rdf:Property` with `rdfs:label`, `rdfs:comment`, `rdfs:range`, `rdfs:subPropertyOf`;
- each list as a SKOS concept scheme (today's `exportSkos`), places with `geo:lat`/`geo:long`, people also typed `foaf:Person`.

SHACL is the W3C standard for "these properties, with these labels, counts and types". So the file is an application profile that other tools read. An import of this file restores the field list (§4.4, extended to fields).

## 10 The operator's side: the admin

### 10.1 The Vocabulary tab of a project

```
 River Voices   [ Overview ] [ Settings ] [ Theme ] [ Vocabulary ] [ Lists ]
 Fields that members fill in, in this order. Drag ⠿ to change the order.

 ┌──────────────────────────────────────────────────────────────────────────┐
 │ ⠿ Topics               dcterms:subject   Choice·Topics·many·tags  142  Edit│
 │ ⠿ Village              dcterms:spatial   Choice·Places·needed      98  Edit│
 │ ⠿ When did it happen?  dcterms:date      Date                      40  Edit│
 │ ⠿ People in this story schema:mentions   Choice·People·many        12  Edit│
 │ ⠿ Fare in paise        custom:fare-paise Number·hidden              3  Edit│
 └──────────────────────────────────────────────────────────────────────────┘
   (the number is the count of stories with a value)
 [ + Add from an ontology ]  [ + Add a custom property ]
 [ Preview the form ]  [ Download the vocabulary ▾ ]  [ Import a vocabulary ]  [ Save ]
```

### 10.2 Add from an ontology

```
 Add from an ontology                                              [ ✕ ]
 Ontology  [ DCMI Metadata Terms (dcterms) ▾ ]   or  [ Upload a file ]
 Search    [ place                         ]
 ☐ dcterms:coverage   Coverage   "The spatial or temporal topic of…"
 ☑ dcterms:spatial    Spatial Coverage   "Spatial characteristics of…"
                      Label in this project [ Village                   ]
                      Value type            [ Choice ▾ ]  List [ Places ▾ ]
 ☐ dcterms:temporal   Temporal Coverage  "Temporal characteristics of…"
 · dcterms:subject    Already a field: Topics
 Deprecated terms are not shown.                  [ Add 1 field ]
```

### 10.3 Add a custom property

```
 Add a custom property                                             [ ✕ ]
 Label        [ Fare in paise                    ]
 Help         [ What did the ferry cost?         ]
 Value type   [ Number ▾ ]
 Is a kind of [ (none) ▾ ]          (optional, for example dcterms:subject)
 Address      https://ORG/vocab/p/fare-paise     (never changes)
                                                 [ Add the field ]
```

### 10.4 Edit, lists, review

- **Edit a field.** Label, help, needed, how many, show as, hidden and order change at any time, with no story rebuild: the label lives in the theme JSON and the Annotate form, not in the stories. Property, value type and list are locked when a story has a value: "98 stories use this field. Hide it from new stories, then add a new field." A field with no values can be removed. This is today's concept delete guard, applied to fields.
- **Lists tab.** Today's Concepts screen (tree, counts, rename, move, hide, SKOS import and export), with a list selector and **Add a list** (name, kind). A concept rename still calls `stories.conceptChanged`, because the label is in the stored `value`.
- **Review.** The story panel shows "Label: value" lines under the text, in field order. Operators do not edit values; **Return to the member** stays the path (Phase 5 item 12). A member's change of values is a normal new draft: "Published · change waiting".

## 11 Migration of today's concepts

One migration, per project: 1. Make the list "Topics" (kind concepts). Point each concept of the project at it. Concept IRIs do not change (`/vocab/{project}/c/{key}`). 2. Make the field: property `dcterms:subject`, label "Topics", choice from "Topics", many, optional, show as tags. Order: first. 3. Rewrite each story: each pair (`SpecificResource` tagging + label `TextualBody`) becomes one value body (§3.2, `purpose: tagging`). Drafts and versions too. 4. Rebuild all representations. Every ETag changes once. Down: the reverse. The pair is rebuilt from `rdf:object` and `value`.

The widget bundle with value bodies must ship in the same release: the old bundle reads tags from the pair (`shape.ts` `parseBodies`). A v1 bundle on another site from this stack updates with the loader, so no `v2.js` is needed. A v1 bundle that reads another stack (CONTRACT §2.3) sees value bodies as unknown text; check CONTRACT §6 rule 9 before the build.

The admin word **Concept** stays for list entries. The member word **Topic** becomes the field label "Topics", which the operator can now change.

## 12 Review and search

A derived table `story_values` (one row per value: story, project, property, object IRI, literal, datatype, review state) is filled by the same `beforeChange` hook that derives `project` and `recording`. It serves the counts per field and per concept (`tagCounts` becomes `valueCounts`), the delete guards of fields and concepts, and admin filters ("Village is Kumbalangi", "When did it happen? before 1970"). A visitor search can use it later; not in v1, because the read routes stay precomputed pages.

## 13 Limits

25 fields and 10 lists per project (a phone form stays short). 30 values per story (replaces today's `tags: 10`; one body each). 10 choices in a "many" field (today's tag limit). Text value 500 characters, long text 5000 (today's text limit). Upload 1 MB, 5000 concepts, 3000 properties (the Server Action limit and today's import limits).

## 14 Interface sketch: `vocabulary`

Deep: few entry points, each hides much. `stories` calls one function to validate.

```ts
export function createVocabulary(config: { payload: Payload; origin: string }): Vocabulary
export const vocabularyCollections: (deps: VocabularyDeps) => CollectionConfig[]
// ontologies, properties, lists, concepts. Fields are an array on the project (§16).

export interface Vocabulary {
  /** The visible fields of a project, in order. For the Annotate form, the theme JSON, the admin. */
  fields(project: ProjectSlug, options?: { hidden?: boolean }): Promise<Field[]>
  /** Choices of a choice field: a tree for ≤ 200 concepts, else a search. */
  choices(project: ProjectSlug, field: FieldKey, query?: string): Promise<Choice[]>
  /** The only validation of values. stories calls it in saveDraft. Pure for given fields. */
  check(project: ProjectSlug, input: ValueInput[], keep: CheckedValue[]): Promise<CheckResult>
  /** Parse a file or a bundled ontology. Returns a preview; nothing is saved. */
  read(source: { bundled: 'dcterms' | 'foaf' | 'schema' } | { file: Uint8Array; name: string }): Promise<ReadResult>
  /** Apply the operator's picks from a preview: add fields, properties, lists, concepts. */
  apply(operator: OperatorSession, project: ProjectSlug, picks: Picks): Promise<ApplyReport>
  /** Turtle or JSON-LD: the SHACL profile, custom properties and lists. */
  exportVocabulary(project: ProjectSlug, format: 'turtle' | 'jsonld'): Promise<string>
  /** GET /vocab/p/{key}, /vocab/{project}, /vocab/{project}/c/{key}, /vocab/{project}/f/{key}. */
  handleVocab(request: Request): Promise<Response>
  removeVocabulary(projectId: number | string, req?: PayloadRequest): Promise<void>
}

export interface Field { key: FieldKey; iri: string; property: string; label: string; help?: string
  type: 'text' | 'long-text' | 'number' | 'date' | 'url' | 'choice'
  list?: { key: string; kind: 'concepts' | 'places' | 'people' }
  many: boolean; needed: boolean; show: 'line' | 'tags'; hidden: boolean }
export type ValueInput = { field: FieldKey; value: string | string[]; language?: string }
export type CheckedValue = { property: string; display: string; language?: string
  purpose: 'tagging' | 'classifying' | 'identifying' | 'describing'
  object: { iri: string } | { literal: string; datatype?: string; language?: string } }
export type CheckResult = { ok: true; values: CheckedValue[] }
  | { ok: false; errors: { field: FieldKey; code: 'needed' | 'too-long' | 'not-a-number'
      | 'not-a-date' | 'not-https' | 'unknown-choice' | 'too-many' | 'unknown-field' }[] }
```

Hidden from callers: parsing of four RDF formats, range-to-type rules, prefix rules, IRI minting, SHACL and SKOS serialisation, the delete guards, the bundled files. `check` gets `keep` (the values of the stored story) so a hidden field keeps its old value without a special case in `stories`.

`concept`, `conceptsOf`, `importSkos` and `exportSkos` fold into `choices`, `read`/`apply` and `exportVocabulary`. The existing tests of SKOS import move to `read` + `apply` with a SKOS file.

## 15 Changes to `stories`

1. `DraftInput.tags` becomes `DraftInput.values: ValueInput[]`. During the migration release, `tags` maps to the Topics field, then goes.
2. `saveDraft` calls `vocabulary.check` and builds one body per `CheckedValue`. `stories` knows the body shape; `vocabulary` knows the fields. Neither knows the other's half.
3. New `SaveError` code `value-invalid`, with the `errors` of `check`. A reply with values gives `reply-and-values` (replaces `reply-and-tags`).
4. `OwnDraft.tags` becomes `values` (field key and display), so the form refills.
5. `parseBodies` reads value bodies; the stored-shape check refuses a value body without all three `rdf:` keys.
6. `tagCounts` becomes `valueCounts(project, property?)`; `conceptChanged` stays (labels are stored).
7. New export variant: the direct triples (§9.1).
8. Dependency direction stays: `stories` imports `vocabulary`; `vocabulary` gets `stories.valueCounts` and `stories.conceptChanged` through `deps`.

## 16 Data model

| Collection | Owner | Key fields | Note |
|---|---|---|---|
| `projects.fields` | `projects` (array field), validated by `vocabulary` | key, property (relationship), label, help, type, list, many, needed, show, hidden | array order is field order |
| `ontologies` | `vocabulary` | title, prefix, namespace, source (bundled or upload), licence, property count | no file stored |
| `properties` | `vocabulary` | iri (unique), prefix, label, comment, range, deprecated, custom, parent | stack-wide |
| `lists` | `vocabulary` | project, key, name, kind | today: none |
| `concepts` | `vocabulary` | existing + list (relationship), lat, long | existing collection |
| `stories` | `stories` | unchanged columns; `wadm` holds value bodies | |
| `story_values` | `stories` | story, project, property, object IRI, literal, datatype, review state | derived, never edited |

Ownership question: the field array is on the project form (one tab, one Save), but its rules belong to `vocabulary`. `projectsCollection` takes `vocabulary.fieldsField` (a Payload field config) through `deps`, as it takes `removeVocabulary` today. So `projects` holds the column and `vocabulary` holds the rules.

## 17 Feasibility in Payload 3

| Need | Payload feature | Risk |
|---|---|---|
| Ordered field list with drag | `array` field; rows drag by default | low |
| Row summary "Topics · dcterms:subject · Choice" | `admin.components.RowLabel` | low |
| List picker only for `choice` | `admin.condition` on the row field | low |
| Locked property and type when in use | `beforeChange` hook on the project, with `stories.valueCounts`; read-only UI by a custom field component | medium: the array row id must be stable (Payload gives each row an `id`; the field key is ours, so the lock does not depend on it) |
| "Add from an ontology" dialog | custom client component in the tab; a Server Action calls `read`; the dialog adds rows with the form's `addFieldRow` | medium: verify `useForm().addFieldRow` in Payload 3.90 before the build |
| Story counts per row | server component in `RowLabel` cannot fetch per row cheaply; pass all counts once through a custom `Field` component | medium |
| Admin filter by value | custom list filter that turns a value into `id in (…)` from `story_values` | medium: Payload's list filter UI does not know a derived table |

Blocks instead of an array: rejected, because a value-type change would be a block-type change, which Payload does as remove and add. The Annotate form is our own Next.js page, so it has no Payload constraint.

## 18 Trade-offs

Gains:
- One body per value is valid WADM, is complete alone, survives an RDF store (no array-order pairing), and a generic client still shows it.
- The direct triples come from one generic rule, so the export does not depend on the field list, and an old export stays readable after a field changes.
- Labels live outside the stories, so a relabel costs nothing. SHACL gives the field list a standard file shape.
- Place, person and topic are one mechanism: a choice from a list.

Costs:
- Each value repeats `rdf:subject` (about 80 bytes). A story with 10 values is about 2 KB larger. A range change rewrites all value bodies (it is one save; cheap).
- Reification is unfamiliar. A consumer that wants plain triples must use our Turtle export or apply the rule.
- The semantic-tag pattern of Model §4.1 (`SpecificResource` + `source`) is gone. A client that reads only that pattern loses the concept IRI. It still shows the label.
- "One property once per project" forces sub-properties for a second list on one idea. That is correct, but an operator must understand "Is a kind of".
- Bundled schema.org adds about 1 MB to the image. The migration rewrites every story and changes every ETag once.
- `CONTEXT.md` (Vocabulary, the tag decision) and `CONTRACT.md` (theme JSON `fields`, four parts) change. Both are outside this task. Flagged for their owners.

Rejected:
- Dataset body (D): opaque to RDF and to generic clients.
- Values on the target (E): invisible to generic clients; it also makes the member's claim look like the organisation's statement.
- An `annoudio:property` key: needs a namespace IRI that someone keeps for years; a namespace under each stack origin gives each stack a different key (the Phase 5b reason).
- `dcterms:conformsTo` from each body to its field IRI: useful for a client that wants the project label, but it ties stored stories to a field that can be removed. Open question 3.

## 19 Open questions

1. Per-language labels: a project has one language today. A field label per language needs `label` as a map. Defer until a project asks.
2. Free-text "other" in a choice field (a member's own topic, reviewed into the list): useful, but a second path through review.
3. Should the served page (not the stored record) add `dcterms:conformsTo` field IRIs, so a generic client can find the labels?
4. Check before the build: jsonld.js and pyld on §3.2; `addFieldRow` in Payload 3.90; the v1 bundle on a TextualBody with an unknown `purpose` (CONTRACT §6 rule 9).
