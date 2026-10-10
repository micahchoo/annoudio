# Project vocabulary: the specification

Status: decision, 2026-10-09. This file replaces `vocab-A-properties.md`, `vocab-B-schemes.md` and `vocab-C-templates.md` as the build source. The owner chose **B's model with C's surface**, plus A's field lock and A's `story_values` table. This file merges them. It does not explore again: for reasons and prior art, read the three source files. Read `CONTEXT.md` first.

The requirement (owner): "each project [owns] an ontology/vocabulary like dcterms foaf etc. importable, and [is] able to add custom labels to their fields and have values in them."

In one paragraph: a project's **vocabulary** is an ordered list of **fields**. Each field puts one RDF **property** on the Annotate form, with a label that members read as a question ("Where did this happen?"). An operator adds fields from a **catalogue** of 14 plain questions, from an **ontology** (Advanced), or as their own question. Choice answers come from **lists** (Topics, Places, People). Each answer of a story is one **value body** in the stored WADM: a `TextualBody` that is also an `rdf:Statement`. Labels reach the widget through the theme JSON, so a relabel rebuilds nothing.

## 1 Words

Decisions, one line of reasoning each:

1. **The project tab is "Vocabulary".** It is the word of the requirement and of today's tab; the sidebar job **Concepts** becomes **Vocabulary** too (≤ 3 words, `ia.md` §4.1).
2. **A row is a "field".** The admin shows its plain label first, and the property beneath in small text (`dcterms:spatial`): the operator reads meaning, the archivist can still check the IRI.
3. **A controlled list is a "list"; one entry is an "item".** "Lists" is the tab; "Topics", "Places", "People" are list names. "Concept" was an operator-only SKOS word that the audit flagged (`workflow-audit.md` #32).
4. **Members see question labels only.** Never "field", "property", "list", "ontology", an IRI or a prefix (C §7 rule 6). "Question" is the member's word and the button **Add a question**; each question becomes one field.
5. **"Concept" and "Topic" retire as UI words.** "Topics" stays only as the default name of the migrated list and its field, because members already know it. Code keeps the collection slug `concepts` (no table rename).
6. **"Ontology"** = an RDF file of properties and classes, loaded once for the organisation. **"Value"** = one answer of one story for one field. **"Entity"** = an item of an entity list (a person, a place, a thing with a class).

Proposed `CONTEXT.md` rows (its owner applies them in slice 1): **Vocabulary** (changed: ordered fields of a project), **Field**, **Property**, **Ontology**, **List**, **Item**, **Entity**, **Value**, **Value body** (new); **Concept** and **Topic** removed. The fixed decision "SKOS tags are two bodies" becomes "each value is one value body (§3)".

## 2 The catalogue

Check: each IRI must be a term of a bundled ontology, because a field's property is a row of `ontology-terms`. B bundles dcterms, dctype, foaf, skos, schema.org. Two C entries fail that check: `rdfs:seeAlso` and the MARC relators.

- **Bundle rdfs** (rdf and rdfs core, under 30 terms): `rdfs:seeAlso` is the standard "more about this" link, and the cost is nil.
- **Bundle MARC relators** (about 270 properties, `http://id.loc.gov/vocabulary/relators/`). Reason: speaker, interviewer, interviewee and performer are the core roles of oral history, LoC declares each one a sub-property of `dcterms:contributor`, and no bundled ontology has them (schema.org `performer` has range Event). The bundle script reads every `relators:*` subject as a property, whatever its `rdf:type`, with the label from `skos:prefLabel` or `madsrdf:authoritativeLabel`. Check the LoC licence line and the typing in slice 1.

Final catalogue (labels and help in the project language; English shown):

| Key | Label | Help | Property | Value type | Default list | Max | Own answers |
|---|---|---|---|---|---|---|---|
| topics | Topics | What is this part about? | `dcterms:subject` | list | Topics (items) | 10 | no |
| place | Place | Where did this happen? | `dcterms:spatial` | list | Places (items) | 3 | yes |
| when | When it happened | A year is enough. | `dcterms:temporal` | date | — | 1 | — |
| speaker | Who is speaking | | `relators:spk` | entity | People (`foaf:Person`) | 3 | yes |
| interviewee | Who is interviewed | | `relators:ive` | entity | People | 3 | yes |
| interviewer | Who asks the questions | | `relators:ivr` | entity | People | 3 | yes |
| performer | Who sings or plays | | `relators:prf` | entity | People | 5 | yes |
| mentions | People mentioned | | `schema:mentions` | entity | People | 10 | yes |
| language | Language spoken | | `dcterms:language` | list | Languages (seed: the project language, `sameAs` its `id.loc.gov/vocabulary/iso639-1/` IRI) | 3 | no |
| kind | Kind of sound | Speech, song, music… | `dcterms:type` | list | Kinds of sound (seed: Speech, Song, Music, Sounds of a place) | 3 | no |
| title | Short title | A name for this part. | `dcterms:title` | text | — | 1 | — |
| hear | What you hear | | `dcterms:description` | text | — | 1 | — |
| link | Link to more | A web address. | `rdfs:seeAlso` | link | — | 3 | — |
| source | Where you know this from | A book, an archive, a person. | `dcterms:source` | text | — | 1 | — |

Changes against C, one reason each: "interviewee" added (the most common oral-history role); C's `language` value type became a list (the owner's model has six value types, and a list gives IRIs); C's "source about the story" now has the segment as subject, as all fields (§3.2 rule 2; open question 3); C's EDTF "about 1962" is out of v1, because B's model stores `xsd:gYear`, `xsd:gYearMonth` or `xsd:date`, which every RDF and SHACL tool reads, and C left the EDTF datatype IRI unchecked. "Keywords" (`schema:keywords`) is dropped: it asks the same thing as Topics, and a free-word field next to a list splits one idea in two. A catalogue question that needs a list makes that list on first use. A second question that names the same list ("People") reuses it.

## 3 Storage

### 3.1 Value types

| Value type | Member control | `rdf:object` | `purpose` |
|---|---|---|---|
| text | text box, grows to 5 lines; ≤ 500 characters | `{ "@value": …, "@language": project language }` | describing |
| date | Year, Month (select), Day | `{ "@value": "1962", "type": "xsd:gYear" }`, `xsd:gYearMonth` or `xsd:date` | describing |
| number | `inputmode="decimal"` | `{ "@value": "25", "type": "xsd:decimal" }` | describing |
| link | `https:` address and an optional label | `{ "id": address }`; `value` = the label, else the address | describing |
| list | chips (≤ 8 items) or a search box (> 8) | `{ "id": item IRI }` | tagging |
| entity | the same controls as a list | `{ "id": entity IRI }` | describing |

**Own answer** (list or entity field with "Members may type their own answer"): `rdf:object` is a blank node with the class of the list, so the stored statement stays one triple pattern and RDF still says "a person named Ravi": `{ "type": "http://xmlns.com/foaf/0.1/Person", "rdfs:label": { "@value": "Ravi", "@language": "en" } }`. For a SKOS list the class is `skos:Concept`. The jsonld.js and `jsonld-streaming-parser` check of this shape is a done-when of slice 3 (B and A tested only IRI and literal objects).

### 3.2 Body rules

1. Each value is one body: `"type": ["TextualBody", "rdf:Statement"]`, `value` (the text a person reads), `purpose`, `rdf:subject`, `rdf:predicate`, `rdf:object`. Body-level `language` = the language of `value`.
2. `rdf:subject` is the **segment IRI** `{recording IRI}#t={start},{end}`. `stories` writes it; a range change rewrites it.
3. `rdf:predicate` and `rdf:object` IRIs are objects with full IRIs (`{ "id": "http://…" }`), never CURIEs and never plain strings. Only `xsd:` in a literal's `type` is a CURIE (`anno.jsonld` defines it).
4. **The `@language` trap.** Inside a literal, write `@language`, never `language`. In `anno.jsonld`, `language` maps to `dc:language`, and jsonld.js refuses `{ "@value", "language" }` (B §3.1).
5. Body order: text, media, then values in field order. Order is display only.
6. A reply has no values (`reply-and-values`).
7. A stored value body without all three `rdf:` keys is refused by `deriveColumns`.

### 3.3 One story with four values

Project `river-voices`, recording 1, range 1:02–1:35. Values: text (Short title), date (When it happened), list (Place), entity (Who is speaking).

```json
{
  "@context": "http://www.w3.org/ns/anno.jsonld",
  "id": "https://org.example/stories/river-voices/1/0192a3b4-7c1d-7e00-8000-000000000001",
  "type": "Annotation",
  "motivation": "commenting",
  "created": "2026-10-09T10:00:00Z",
  "creator": { "id": "https://org.example/members/m-100", "type": "Person", "nickname": "Asha" },
  "rights": "https://creativecommons.org/licenses/by/4.0/",
  "body": [
    { "type": "TextualBody", "value": "My father ran this ferry from Fort Kochi.", "format": "text/plain", "language": "en" },
    { "type": ["TextualBody", "rdf:Statement"], "purpose": "describing", "value": "The last ferry", "language": "en",
      "rdf:subject": { "id": "https://org.example/recordings/1#t=62,95" },
      "rdf:predicate": { "id": "http://purl.org/dc/terms/title" },
      "rdf:object": { "@value": "The last ferry", "@language": "en" } },
    { "type": ["TextualBody", "rdf:Statement"], "purpose": "describing", "value": "1962",
      "rdf:subject": { "id": "https://org.example/recordings/1#t=62,95" },
      "rdf:predicate": { "id": "http://purl.org/dc/terms/temporal" },
      "rdf:object": { "@value": "1962", "type": "xsd:gYear" } },
    { "type": ["TextualBody", "rdf:Statement"], "purpose": "tagging", "value": "Fort Kochi", "language": "en",
      "rdf:subject": { "id": "https://org.example/recordings/1#t=62,95" },
      "rdf:predicate": { "id": "http://purl.org/dc/terms/spatial" },
      "rdf:object": { "id": "https://org.example/vocab/river-voices/c/fort-kochi" } },
    { "type": ["TextualBody", "rdf:Statement"], "purpose": "describing", "value": "K. Joseph",
      "rdf:subject": { "id": "https://org.example/recordings/1#t=62,95" },
      "rdf:predicate": { "id": "http://id.loc.gov/vocabulary/relators/spk" },
      "rdf:object": { "id": "https://org.example/vocab/river-voices/c/k-joseph" } }
  ],
  "target": {
    "type": "SpecificResource",
    "source": "https://org.example/recordings/1",
    "scope": "https://org.example/projects/river-voices",
    "selector": { "type": "FragmentSelector", "conformsTo": "http://www.w3.org/TR/media-frags/", "value": "t=62,95" }
  }
}
```

### 3.4 The same story as TriG

The export has three layers (B §8): 1 stories (the stored WADM), 2 statements (asserted, published stories only), 3 the vocabulary. Turtle puts all three in one graph. TriG puts layers 1 and 3 in the default graph and each story's statements in a named graph whose name is the story IRI, so "who said it" stays with "what was said".

```trig
@prefix oa: <http://www.w3.org/ns/oa#> .        @prefix dcterms: <http://purl.org/dc/terms/> .
@prefix dc: <http://purl.org/dc/elements/1.1/> . @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> . @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .  @prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .  @prefix relators: <http://id.loc.gov/vocabulary/relators/> .
@prefix c: <https://org.example/vocab/river-voices/c/> . @prefix s: <https://org.example/vocab/river-voices/s/> .
@prefix story: <https://org.example/stories/river-voices/1/> .

# Layer 1: the stored WADM as RDF (default graph); B §8 shows it in full. Each value body reads:
#   [ a oa:TextualBody , rdf:Statement ; oa:hasPurpose oa:tagging ; rdf:value "Fort Kochi" ; dc:language "en" ;
#     rdf:subject <https://org.example/recordings/1#t=62,95> ; rdf:predicate dcterms:spatial ; rdf:object c:fort-kochi ]

# Layer 2: the statements, asserted, in the story's own graph.
story:0192a3b4-7c1d-7e00-8000-000000000001 {
  <https://org.example/recordings/1#t=62,95> dcterms:isPartOf <https://org.example/recordings/1> ;
    dcterms:title "The last ferry"@en ;
    dcterms:temporal "1962"^^xsd:gYear ;
    dcterms:spatial c:fort-kochi ;
    relators:spk c:k-joseph .
}

# Layer 3: the vocabulary terms this story uses (default graph).
c:fort-kochi a skos:Concept ; skos:prefLabel "Fort Kochi"@en ; skos:inScheme s:places .
c:k-joseph a foaf:Person ; rdfs:label "K. Joseph" ; skos:inScheme s:people ; owl:sameAs <http://www.wikidata.org/entity/Q00000> .   # example address
```

An own answer exports as `relators:spk [ a foaf:Person ; rdfs:label "Ravi"@en ]`. A Turtle export is the same triples with the layer 2 graph merged into the default graph. The full SHACL profile is in layer 3 (§6).

## 4 Migration of today's concepts and tag pairs

One migration, `vocab_profile`, up and down, tested on rows in the old shape (`.claude/rules/app-migrations.md`):

1. Seed the bundled ontologies when `ontologies` is empty (slice 1 owns the seed).
2. Per project: make the list **Topics**, kind `items`, with IRI `{origin}/vocab/{project}` (today's scheme IRI). Set `list` on every concept of the project. **Concept IRIs do not change** (`{origin}/vocab/{project}/c/{key}`).
3. Per project with ≥ 1 concept: make the field **Topics** → `dcterms:subject`, list Topics, max 10, show as tags, position 1. A project with no concepts gets no field: members see no questions, as they now see no topics.
4. Every story, main and versions tables: each pair (`SpecificResource` `tagging` + label `TextualBody` `tagging`) becomes one value body with `rdf:predicate` `dcterms:subject`, `rdf:object` the concept IRI, `value` and `language` from the label body, `rdf:subject` the segment IRI. `modified` does not change: the member changed nothing.
5. Fill `story-values` from the rewritten stories. Rebuild every precomputed representation. Every ETag changes once; caches refetch once.
6. Down: `dcterms:subject` value bodies become pairs again. Down refuses when any other value body exists.

The new widget bundle ships in the same release: today's `parseBodies` reads pairs. An older bundle of another stack sees a list value as a tag and a literal as one more line of story text: extra text, no lost data (B §3.2; CONTRACT §6 rule 9).

## 5 Entity records

Minimum: **label**, **class** (from the list), **same as** (one optional address: Wikidata, VIAF, an Omeka item). No other fields, no hierarchy. An entity is a row of `concepts` whose list has kind `entities`; its IRI is `{origin}/vocab/{project}/c/{key}`, as an item's.

Where: **per project**, as items are. Reason: the delete guard, the counts and the project delete already work per project, and a shared register needs an owner and an edit policy that nobody asked for. B's "organisation-wide" applies to ontologies only (dcterms is the same for every project; Ravi in River Voices need not be Ravi in Kitchen Songs). **Copy from project** (copy a list with new IRIs and `sameAs` to the source) is a later, additive action.

Items of a SKOS list may also carry "same as"; it exports as `skos:exactMatch` (for an entity: `owl:sameAs`).

## 6 Import and export

| Format | In | Out | Parser or writer |
|---|---|---|---|
| Turtle, N-Triples | ontology, SKOS list, SHACL profile | lists, profile, linked data | `n3` 2.7.12 (have) |
| JSON-LD | the same | lists, profile, linked data | `jsonld-streaming-parser` 5.0.1 (have); no remote `@context` |
| RDF/XML | ontology (FOAF ships as RDF/XML) | — | `rdfxml-streaming-parser`, **new dependency**, a version at least two weeks old |
| TriG | — | linked data (§3.4) | `n3` |
| SHACL (in Turtle or JSON-LD) | the profile: `sh:path` → property, `sh:name` → label, `sh:description` → help, `sh:order`, `sh:minCount ≥ 1` → required, `sh:maxCount` → max, `sh:datatype` → value type, `sh:class` + `skos:inScheme` → list | one `sh:NodeShape` with no target, one `sh:property` per field | own mapping |
| Omeka S resource template JSON | `o:label`, `o:resource_template_property[]` (`vocabulary_namespace_uri`, `local_name`, `o:alternate_label`, `o:alternate_comment`, `o:is_required`, `data_types[{ name }]`); a property of an ontology that is not loaded is listed and left out | the same keys; data types `literal`, `numeric:timestamp`, `numeric:integer`, `uri`, `customvocab:{list}`, `resource` | own mapping |
| SKOS | one file, one preview per `skos:ConceptScheme`; today's rules (merge by IRI, never remove) | one list | today's `skos.ts`, per list |

Rules:
- **One upload path.** **Load a vocabulary file** takes any input row. The preview says what it found: "3 properties (a new ontology), 1 list (40 items), 1 form of 6 fields". The operator ticks what to load. Loaded properties appear under "From an ontology" in **Add a question**; they do not become fields by themselves. A SHACL form or an Omeka template **adds** fields after the existing ones; it never removes a field.
- **Prefix clash** (A §4.4): an ontology whose prefix `anno.jsonld` defines for another namespace, or whose prefix is an `anno.jsonld` term (`body`, `type`…), is refused with "Change the prefix". The prefix is display and export only; stored bodies hold full IRIs.
- **No fetch.** No remote context, no `owl:imports`, no request to any address in a file (`phase5-notes.md` decision 10).
- **Limits.** 5 MB, 20 000 terms, 5000 items per list.
- **The 1 MiB note.** A Next.js Server Action takes 1 MiB by default, and today's SKOS import holds to 1 MB for that reason. All vocabulary uploads move to one Payload collection endpoint, `POST /api/ontologies/import` (a route handler: no Server Action body limit; Payload's `req.user` gives the operator check). The endpoint reads the body as a stream and stops at 5 MB. The bundled files load in the migration and need no upload.
- A file that this stack exports, it can import again with no change.

## 7 The member and the visitor

### 7.1 Annotate form (P4, phone, 360 px)

```
┌ River Voices ───────────────── Asha ▾ ┐
│ Ferry crossing, 1962                  │
│ ▶ 1:02–1:35   [ Use the player time ] │
│ Your story                            │
│ [My father ran this ferry from …    ] │
│ [ Record a voice note ] [ Attach ]    │
│ ── About this part ────────────────── │
│ Place                                 │
│ Where did this happen?                │
│ [ Fort Kochi ✕ ] [ search…         ]  │
│ When it happened (optional)           │
│ A year is enough.                     │
│ Year [1962] Month [    ▾] Day [  ▾]   │
│ Who is speaking (optional)            │
│ [ Ravi                             ]  │
│  Not in the list. We send "Ravi" as   │
│  your own answer.                     │
│ Topics (optional)                     │
│ ( Ferries ✓ ) ( Work ) ( Monsoon )    │
│ More questions (2)                 ▸  │
│ ───────────────────────────────────── │
│ [ Send for review ]                   │
└───────────────────────────────────────┘
```

Rules:
1. Questions follow the story text and the media. A reply form shows none.
2. Show every required field, then the first three others in field order. Fold the rest under **More questions (N)**. A folded field with an error unfolds.
3. A list with ≤ 8 visible items shows chips; a longer list shows a search box (ARIA 1.2 combobox) over labels. With **own answers** on, a text that matches no item is sent as an own answer, and the line under the box says so.
4. Optional fields say "(optional)"; required fields have no mark. Most fields are optional, so the mark goes on the common case (A §7).
5. Errors name the label: "Place: give an answer." "When it happened: the day is not in that month." Focus goes to the first error; the form keeps its text (`ia.md` P9).
6. A hidden field with a value in this story shows that value read-only with "This question is no longer asked". The save keeps it (`keep`, §9.1).
7. Each control has a visible label, help as `aria-describedby`, and targets ≥ 44 px. No IRI, prefix or the word "property".

### 7.2 Widget

```
┌ Asha · 1:02–1:35 ──────────────────────────────┐  story-meta
│ My father ran this ferry from Fort Kochi.      │  story-text
│ Short title       The last ferry               │  fields > field > field-label, field-value
│ When it happened  1962                         │
│ Place             Fort Kochi                   │
│ Who is speaking   K. Joseph                    │
│ [Ferries] [Work]                               │  a field shown as tags: tag parts, no label
└────────────────────────────────────────────────┘
```

New parts (CONTRACT §3.3, additive; slice 6 adds rule 9 there): `fields` (a `<dl>`, absent with no values), `field`, `field-label` (`<dt>`), `field-value` (`<dd>`, one per value). A list value keeps the part `tag` too, so host CSS for `::part(tag)` still works.

Theme JSON (CONTRACT §3.2 rule 6, new key): `"fields": [{ "property": "http://purl.org/dc/terms/title", "label": "Short title", "showAs": "line" }, …]`.

Rules: array order is field order; hidden fields are in it (old stories show their values). The player groups value bodies by `rdf:predicate.id`. `showAs: "none"` hides the value in the widget (it stays in the public WADM; the admin says so). A predicate not in `fields` shows its value after the others with no label. A date shows at its stored precision with `Intl.DateTimeFormat`. A link is a link only for `http:`/`https:`, with `rel="nofollow ugc"`. All text uses `textContent`. A relabel reaches hosts within the theme cache time (300 s).

## 8 Admin screens

Project tabs: Overview · Project · Review and rights · Sign-in · **Vocabulary** · **Lists** · Theme. The sidebar job **Vocabulary** opens the Vocabulary tab (a project picker for > 1 project).

O10v Vocabulary tab:
```
┌ River Voices · Vocabulary ────────────────────────────────────────────────────────┐
│ What we ask about each recording                                                  │
│ Members answer these questions below their story, in this order.                 │
│ ⠿ Place                      From "Places" · up to 3 · own answers  17 stories [Edit]│
│   dcterms:spatial                                                                 │
│ ⠿ When it happened           Date · optional                         9 stories [Edit]│
│   dcterms:temporal                                                                │
│ ⠿ Who is speaking            From "People" · own answers             4 stories [Edit]│
│   relators:spk                                                                    │
│ ⠿ Topics                     From "Topics" · up to 10 · as tags     41 stories [Edit]│
│   dcterms:subject                                                                 │
│ [ + Add a question ]   [ See it on a phone ]                                      │
│ ▸ For other systems                                                               │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Add a question (one dialog, three sections):
```
┌ Add a question ───────────────────────────────────────────┐
│ Common questions: Place · When it happened · Who is       │
│   speaking · Topics ✓ asked · … 14 in all                 │
│ ▸ Advanced: from an ontology  Search [ boat ] [ All ▾ ]   │
│   Ferry route — River Archive (ra)  [ Load a vocabulary file ]
│ Your own question  [ Write a new question ]               │
└───────────────────────────────────────────────────────────┘
```

Edit a field (drawer; also the end step of each section above):
```
┌ Edit: Place ──────────────────────────────────────────┐
│ Question members see [ Place ]  Help [ Where did… ]   │
│ Kind of answer  Text · Date · Number · Link ·         │
│   (•) From a list  ( ) People, places or things       │
│ List [ Places ▾ ] [ New list ]   How many answers [3] │
│ [x] Members may type their own answer                 │
│ [ ] Members must answer                               │
│ Show in the widget (•) Label: value ( ) Tags ( ) No   │
│ 17 stories answer this. Kind and list are fixed.      │
│ Saved as: dcterms:spatial (Dublin Core)               │
│ [ Save ]  [ Hide from new stories ]                   │
└───────────────────────────────────────────────────────┘
```

**Field lock** (A §10.4): when a story (any version) has a value for the field, property, value type and list are fixed, and the field cannot be removed, only hidden. Label, help, max, required, show as, own answers, hidden and position stay free. Required and max apply at the next save only. **Your own question** asks label, help and kind of answer, then mints `{origin}/vocab/{project}/p/{key}` (key rules of `phase5-notes.md` decision 11), shown read-only: "Address: … (never changes)".

O10l Lists tab:
```
┌ River Voices · Lists ─────────────────────────────────────────────┐
│ Members pick from these lists when they answer a question.        │
│ Topics            31 items     asked by: Topics           [Open]  │
│ Places            12 items     asked by: Place            [Open]  │
│ People             8 people    asked by: Who is speaking… [Open]  │
│ [ + Add a list ]  (•) Words and topics  ( ) People… [Person ▾]    │
│ ▸ For other systems: download a list as SKOS, upload a SKOS file  │
└───────────────────────────────────────────────────────────────────┘
```

**Open** shows today's tree page (O10) for that list: tree with story counts, **Add an item**, rename, move, **Hide from new stories**, the delete guard ("12 stories use this item"). An entity list has no tree: rows Label · Same as · stories. The item form (today's O11) gains "Same as". The class choices are the classes of the loaded ontologies (`foaf:Person`, `schema:Place`, …), Person first.

O10x For other systems (folded panel at the end of the Vocabulary tab):
```
│ ▾ For other systems                                                    │
│ Download [ Questions as SHACL ] [ Omeka template ] [ Linked data ▾ ]   │
│ Upload   [ Load a vocabulary file ] Turtle, JSON-LD, RDF/XML, SHACL,   │
│          Omeka template; 5 MB at most                                  │
│   → We found: [x] 3 properties (new ontology "River Archive", ra)       │
│   [x] 1 list "Boat names" (40 items)  [ ] 1 form, 6 questions (added)   │
│     Left out: 2 classes, 1 property with no label   [ Load these ]      │
```

Settings → **Ontologies** (Payload list view, read-only rows): label, prefix, namespace, terms, bundled or uploaded, date. Bundled rows cannot be removed. An uploaded ontology with a property that a field uses cannot be removed. A new version of the same namespace shows added, changed, unchanged, gone; a gone term that a field uses stays, marked "No longer in the file".

O5 Review screen: values show under the story text in field order, with labels: "Place: Fort Kochi · When it happened: 1962". An own answer shows "Who is speaking: Ravi (new)" and **Add "Ravi" to People** (adds the item; the story keeps its own answer; open question 1). "No topic fits? Add a concept…" becomes "No item fits? [ Add an item to Places ▾ ]". Values are read-only for operators. The Today checklist gains the optional line "Add questions, so members tell you place and time."

## 9 Data model and interfaces

### 9.1 Data model

| Collection / field | Module | Kind | Migration |
|---|---|---|---|
| `ontologies`: label, namespace (unique), prefix, source (`bundled`, `uploaded`), licence, fileHash, loadedAt | `vocabulary` | new | yes, plus seed |
| `ontology-terms`: iri (unique), ontology, project (custom properties only), kind (`property`, `class`), label, comment, rangeHint, gone | `vocabulary` | new; index on label | yes |
| `vocab-fields`: project, property (→ term), label, help, valueType, list (→ `vocab-lists`), required, max (1–10), showAs (`line`, `tags`, `none`), allowOwn, hidden, position (integer) | `vocabulary` | new; unique (project, property) | yes |
| `vocab-lists`: project, key, iri, label, kind (`items`, `entities`), class (→ term, entities only), hidden | `vocabulary` | new | yes |
| `concepts` (admin label "List items"): + list (required), + sameAs | `vocabulary` | fields | yes; fill `list` |
| `stories.wadm`: pairs → value bodies | `stories` | data | yes, main and versions |
| `story-values` (admin hidden): story, project, layer (`newest`, `published`), property, objectIri, literal, datatype, language, own | `stories` | new, derived, never edited | yes, plus backfill |
| theme JSON `fields` | `projects` (asks `vocabulary.labels`) | route, additive | no |
| parts `fields`, `field`, `field-label`, `field-value` | `player` | CONTRACT §3.3, additive | no |

`story-values` is written in the `stories` `afterChange` hook with the same `req`, so it commits with the story. It serves counts per field and per item, the delete guards and the field lock, and later admin filters ("Place is Fort Kochi").

Limits: 20 fields, 20 lists, 5000 items per list, 30 values per story (replaces `limits.tags`), 10 values per field, text 500 characters.

### 9.2 `vocabulary` interface

The seam rule (B §12): `vocabulary` knows RDF terms and no WADM; `stories` knows WADM and no ontologies. They meet at `ResolvedValue`: one statement without its subject. Today's free functions (`concept`, `conceptsOf`, `exportSkos`, `importSkos`) fold into the instance; their tests move to `resolve`, `choices` and `importFile`.

```ts
export function createVocabulary(config: VocabularyConfig): Vocabulary
export function vocabularyCollections(deps: VocabularyDeps): CollectionConfig[]
//   ontologies, ontology-terms, vocab-fields, vocab-lists, concepts; the import endpoint is on `ontologies`
export interface VocabularyConfig { payload: Payload; origin: string   // ANNOUDIO_ORIGIN: base of minted IRIs
  stories: () => Pick<Stories, 'valueCounts' | 'fieldUsage' | 'conceptChanged'>   // a getter: made after the config
  limits?: Partial<typeof VOCABULARY_LIMITS> }
export const VOCABULARY_LIMITS = { fileBytes: 5_000_000, fileTerms: 20_000, fields: 20, lists: 20,
  itemsPerList: 5000, valuesPerStory: 30, maxPerField: 10, textChars: 500 } as const
export const CATALOGUE: readonly CatalogueEntry[]   // §2, 14 entries

export type Iri = string; export type ValueType = 'text' | 'date' | 'number' | 'link' | 'list' | 'entity'
export interface CatalogueEntry { key: string; label: string; help?: string; property: Iri
  valueType: ValueType; list?: { name: string; kind: ListKind; class?: Iri; seed?: string[] }
  max: number; allowOwn: boolean; showAs: ShowAs }
export type ListKind = 'items' | 'entities'; export type ShowAs = 'line' | 'tags' | 'none'
export interface Field { property: Iri; curie: string; label: string; help?: string; valueType: ValueType
  list?: { key: string; iri: Iri; label: string; kind: ListKind; class?: Iri; size: number }
  required: boolean; max: number; showAs: ShowAs; allowOwn: boolean; hidden: boolean
  usage: number }                                   // stories with a value; usage > 0 = locked
export interface Profile { project: ProjectSlug; language: string; fields: Field[] }
export interface Choice { iri: Iri; label: string; language?: string; parent?: Iri; depth: number }

export type ValueInput =
  | { property: Iri; item: Iri }                    // list or entity
  | { property: Iri; text: string }                 // text, number, own answer
  | { property: Iri; date: { year: number; month?: number; day?: number } }
  | { property: Iri; link: { href: string; label?: string } }
export type ResolvedObject =
  | { iri: Iri }
  | { literal: string; datatype?: Iri; language?: string }   // a datatype or a language, never both
  | { own: { label: string; language?: string; class: Iri } }
export interface ResolvedValue { property: Iri; purpose: 'tagging' | 'describing'
  text: string; language?: string; object: ResolvedObject }
export type ValueErrorCode = 'required' | 'too-many' | 'unknown-field' | 'hidden-field'
  | 'unknown-item' | 'hidden-item' | 'own-not-allowed' | 'bad-date' | 'bad-number' | 'bad-link' | 'too-long'
export type ResolveResult = { ok: true; values: ResolvedValue[] }
  | { ok: false; errors: { property: Iri; code: ValueErrorCode }[] }

export interface Vocabulary {
  // Annotate page, `stories`, theme JSON
  profile(project: ProjectSlug, options?: { forNewStories?: boolean }): Promise<Profile | null>
  choices(project: ProjectSlug, listKey: string, query?: string): Promise<Choice[]>   // ≤ 200 as a tree, else a search
  resolve(project: ProjectSlug, input: ValueInput[], options?: { keep?: ResolvedValue[]; req?: PayloadRequest }):
    Promise<ResolveResult>                            // `keep`: stored values of hidden fields carry over
  inputsOf(project: ProjectSlug, values: ResolvedValue[]): Promise<ValueInput[]>     // refills the form
  labels(project: ProjectSlug): Promise<{ property: Iri; label: string; showAs: ShowAs }[]>
  item(project: ProjectSlug, iri: Iri): Promise<{ iri: Iri; label: string; language?: string; list: string } | null>

  // operators: fields
  addField(operator: OperatorSession, project: ProjectSlug, spec:
    | { from: 'catalogue'; key: string }
    | { from: 'term'; property: Iri; label: string; help?: string; valueType: ValueType; list?: string }
    | { from: 'own'; label: string; help?: string; valueType: ValueType; list?: string }): Promise<FieldResult>
  updateField(operator: OperatorSession, project: ProjectSlug, property: Iri,
    patch: Partial<Pick<Field, 'label' | 'help' | 'required' | 'max' | 'showAs' | 'allowOwn' | 'hidden'
      | 'valueType'> & { list: string }>): Promise<FieldResult>   // locked keys refused: 'field-in-use'
  moveField(operator: OperatorSession, project: ProjectSlug, property: Iri, to: number): Promise<FieldResult>
  removeField(operator: OperatorSession, project: ProjectSlug, property: Iri): Promise<FieldResult>
  searchTerms(query: { kind: 'property' | 'class'; text: string; ontology?: string; limit?: number }): Promise<Term[]>

  // operators: lists
  lists(project: ProjectSlug): Promise<ListSummary[]>
  addList(operator: OperatorSession, project: ProjectSlug, spec: { label: string; kind: ListKind; class?: Iri }):
    Promise<{ ok: true; key: string } | { ok: false; error: 'too-many' | 'bad-class' }>
  addItem(operator: OperatorSession, project: ProjectSlug, listKey: string,
    spec: { label: string; parent?: Iri; sameAs?: string }): Promise<{ ok: true; iri: Iri } | { ok: false; error: string }>

  // files
  importFile(operator: OperatorSession, file: { name: string; bytes: Uint8Array }, options: { project?: ProjectSlug
    apply: boolean; accept?: ImportChoice; names?: { label: string; prefix: string; namespace: Iri } }):
    Promise<ImportResult>                             // apply: false = preview; same report shape both times
  exportFile(project: ProjectSlug, what: { kind: 'profile'; format: 'shacl-turtle' | 'shacl-jsonld' | 'omeka' }
    | { kind: 'list'; listKey: string; format: 'turtle' | 'jsonld' }): Promise<{ filename: string; contentType: string; body: string } | null>
  describe(project: ProjectSlug): AsyncIterable<Quad>   // layer 3: SHACL, custom properties, lists, entities

  removeVocabulary(projectId: number | string, options?: { req?: PayloadRequest }): Promise<void>   // kept
}
export type FieldResult = { ok: true; field: Field }
  | { ok: false; error: 'unknown-project' | 'unknown-term' | 'property-taken' | 'field-in-use' | 'too-many'
      | 'bad-list' | 'not-a-property' }
```

Why deep: `resolve` hides label lookup, list membership, hidden rules, own-answer classes, three date datatypes, link checks and limits behind one call. `profile` serves the Annotate page, the admin tab and (through `labels`) the theme JSON. `importFile` hides five parsers, format sniffing, the prefix rule, merge rules and the preview. Callers never see `ontology-terms` or `vocab-fields`.

### 9.3 `stories` deltas

```ts
// types.ts
export interface DraftInput { /* … */ values?: ValueInput[] }        // replaces tags; not on a reply
export type SaveError = /* … */
  | { code: 'reply-and-values' }                                     // replaces 'reply-and-tags'
  | { code: 'values-invalid'; errors: { property: Iri; code: ValueErrorCode }[] }
                                                                     // replaces 'too-many-tags', 'unknown-concept'
export interface OwnDraft { /* … */ values: ResolvedValue[] }         // replaces tags
export interface StoryReview { /* … */ values: ResolvedValue[] }      // replaces tags; the admin joins labels
export interface StoriesConfig { /* … */ limits?: { bodies?: number; values?: number; text?: number } }
export interface Stories {
  /* … */
  valueCounts(project: ProjectSlug): Promise<Map<Iri, number>>        // replaces tagCounts; items and entities
  fieldUsage(project: ProjectSlug): Promise<Map<Iri, number>>         // property IRI → stories with a value
  conceptChanged(iri: Iri, options?: { req?: PayloadRequest }): Promise<void>   // kept; rewrites `value`
  exportQuads(operator: OperatorSession, filter?: ExportFilter): AsyncIterable<Quad>
    // layers 1 and 2; layer 2 quads carry the story IRI as graph; published only
}
```

- `saveDraft` calls `vocabulary.resolve(project, input.values, { keep: hidden-field values of the stored story, req })`, then shapes one value body per `ResolvedValue`, with `rdf:subject` = the segment IRI.
- `parseBodies` and `deriveColumns` read value bodies (§3.2 rule 7). The pair form goes with the migration.
- The `afterChange` hook writes `story-values` rows for the newest and the published version.
- `exportStories` stays (WADM JSON-LD). The admin route `GET /admin/export/{project}.{ttl|trig|jsonld}` joins `stories.exportQuads` and `vocabulary.describe` and writes Turtle and TriG with `n3` `StreamWriter`. The JSON-LD writer is decided in slice 10: extend the hand-written writer of `skos.ts`, or add `jsonld` (a new dependency).

## 10 Payload feasibility (3.90.2)

| Screen | Kind | How | Risk |
|---|---|---|---|
| O10v Vocabulary tab | custom `ui` field in the project's tab (as today's `VocabularyPanel`) | server component reads `profile`; Server Actions call `addField`, `moveField`; drag with the keyboard fallback **Move up / Move down**; dialogs are `<dialog>` with buttons, never a nested `<form>` (`phase5-notes.md` decision 13) | Medium. Collection `orderable: true` exists but is marked experimental in 3.90.2 and orders one global sequence; an integer `position` per project is plain and testable. |
| Add a question, Edit a field | custom client components | `searchTerms` over `ontology-terms` (2 000+ rows) by label; server-side search | Low |
| O10l Lists tab | custom `ui` field | list summary; **Open** goes to today's `ConceptsView` with `?list=` | Low: reuse `ConceptTree`, `ConceptUsage` |
| Item form (O11) | default document form | `list` relationship with `filterOptions` (project), `sameAs` text with a URL check; `parent` filtered to the same list | Low |
| O10x upload | collection endpoint `POST /api/ontologies/import` | a route handler: no Server Action 1 MiB limit; streamed read with a 5 MB stop; `req.user` from Payload | Low; test a 4 MB file in e2e |
| Settings → Ontologies; O5 values; field lock | default list view (`access.create: nobody`, delete guard hook); existing story panel; checks inside `updateField` | panel joins `stories.review` with `vocabulary.labels`; the lock reads `stories.fieldUsage` (fields change only through the interface) | Low |
| `story-values` | collection, `admin.hidden: true` | written in the stories `afterChange` with `req` | Medium: raw SQL counts follow `.claude/rules/stories-raw-sql.md` |
| Migration | raw SQL over `jsonb` | main and versions tables | Medium: `.claude/rules/app-migrations.md` hazards |

## 11 Build slices

Each slice: ≤ 5 files (tests count; bundled data files and generated files do not), ends green on `pnpm test:int`, `tsc`, lint. Slices 1 to 4 go in order, and 3, 4 and 6 ship in one release (§4). 5, 6 and 7 need 4; 8 to 11 need 7.

| # | Slice | Files | Done when |
|---|---|---|---|
| 1 | Ontologies | `scripts/bundle-ontologies.ts`, `vocabulary/ontologies.ts`, `vocabulary/collection.ts`, migration, `ontologies.int.spec.ts` | dcterms, dctype, foaf, skos, schema.org (`http:` IRIs), rdfs and relators seed; `searchTerms({ kind: 'property', text: 'place' })` finds `dcterms:spatial`; each §2 IRI resolves to a term; CONTEXT.md words applied |
| 2 | Fields and lists, pure | `vocabulary/profile.ts`, `vocabulary/resolve.ts`, `vocabulary/index.ts`, `vocabulary/catalogue.ts`, `profile.int.spec.ts` | `addField({ from: 'catalogue' })` makes the field and its list; `resolve` gives the §3.3 objects; each `ValueErrorCode` has a test; a second field on one property gives `property-taken` |
| 3 | Store values | `stories/shape.ts`, `stories/validate.ts`, `stories/types.ts`, `stories/create.ts`, `values.int.spec.ts` | `saveDraft` with four values stores §3.3 byte for byte (key order aside); jsonld.js and `jsonld-streaming-parser` give the expected N-Quads for it and for an own answer; a reply with values gives `reply-and-values` |
| 4 | Migration and `story-values` | migration `vocab_profile`, `stories/values.ts` (collection + hook), `stories/index.ts` (`valueCounts`, `fieldUsage`), `vocabulary/collection.ts` (guards), `migration.int.spec.ts` | up on rows with pairs gives value bodies with the same concept IRIs; down gives the pairs back; counts match the old `tagCounts`; a used field refuses `removeField` with `field-in-use` |
| 5 | Annotate form | `annotate/page.tsx`, `annotate/FieldControls.tsx`, `annotate/actions.ts`, `annotate/strings.ts`, `annotate.e2e.spec.ts` | at 360 px: required + 3 shown, rest folded; > 8 items gives a search box; an own answer saves; errors name the label; axe clean |
| 6 | Widget | `embed/src/stories.ts`, `embed/src/render.ts`, `projects/theme.ts`, `CONTRACT.md`, `embed` test | theme JSON has `fields`; parts `fields`/`field`/`field-label`/`field-value` render; `tag` part kept; relabel changes the widget with no story rebuild; CONTRACT §3.2 and §3.3 rules added |
| 7 | Vocabulary tab | `admin/vocabulary/FieldList.tsx`, `admin/vocabulary/AddQuestion.tsx`, `admin/vocabulary/actions.ts`, `admin/strings.ts`, `vocabulary.e2e.spec.ts` | add from the catalogue, own question, move, hide; the lock text shows for a used field; the property line shows under each label |
| 8 | Upload and ontology search | `vocabulary/importFile.ts`, `vocabulary/rdfxml.ts` (+ `package.json`), the endpoint in `vocabulary/collection.ts`, `admin/vocabulary/LoadFile.tsx`, `import.int.spec.ts` | FOAF RDF/XML loads; a 4 MB Turtle file passes and a 6 MB one is refused; a clashing prefix is refused; a SKOS file gives a list; nothing is written with `apply: false` |
| 9 | Lists tab and entities | `admin/vocabulary/ListsPanel.tsx`, `admin/vocabulary/ConceptsView.tsx`, `vocabulary/collection.ts` (`sameAs`, `list`), `admin/strings.ts`, `lists.e2e.spec.ts` | Add a list of kind People; an entity with "Same as" exports `owl:sameAs`; the tree page opens per list; the Lists page leads with the member sentence, SKOS folded |
| 10 | Files for other systems | `vocabulary/shacl.ts`, `vocabulary/omeka.ts`, `app/(payload)/admin/export/[file]/route.ts`, `admin/vocabulary/OtherSystems.tsx`, `export.int.spec.ts` | SHACL and Omeka files round-trip (export, import, no change); TriG of §3.3 has one named graph with five triples; only published stories export |
| 11 | Review screen | `admin/stories/StoryPanel.tsx`, `admin/stories/AddItem.tsx`, `admin/strings.ts`, `design/ia.md`, `review.e2e.spec.ts` | values show as "Label: value" in field order; "Ravi (new)" offers **Add "Ravi" to People**; no "Concept" or "Topic" word in admin text except the list name Topics |

## 12 Open questions (defaults in bold)

1. **Add "Ravi" to People**: does it also link the member's own answer to the new entity (an operator edit of a story, with a History line)? Default: **no in v1; the item is added, the story keeps its own answer**, because operators do not edit stories today.
2. May operators add or correct values during review (a missing Place)? Default: **no; Return to the member** stays the path (`ia.md` F5).
3. Statement subject: always the segment, or a per-field "describes: the part | the story" (for "Where you know this from", "Told by")? Default: **always the segment in v1**; a per-field setting is additive later, because one subject rule keeps layer 2 a generic rewrite.
