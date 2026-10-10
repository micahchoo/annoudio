# Vocabulary design B: schemes and an application profile (linked data first)

Date: 2026-10-09. Status: design proposal, not built. One of several rival designs. Read `CONTEXT.md` first. This file uses its words, and proposes new ones in §2.

## 0 The problem and the answer

The owner's requirement: "each project [owns] an ontology/vocabulary like dcterms foaf etc. importable, and [is] able to add custom labels to their fields and have values in them." Today a project has one SKOS concept tree, and a story can carry concepts as tags (`phase5-notes.md`). The owner said: "Concepts right now is just tags." A tag says "this story is about X". It does not say *how* X relates: place, topic, person, year.

The answer of this design: a project's **vocabulary** becomes a small **application profile**. It is an ordered list of **fields**. Each field is one RDF **property** (for example `dcterms:spatial`) with a label that members see ("Place"), help text, a **value type**, and rules (required, how many). The value type is a literal (text, date, number, link), a **scheme** (a SKOS concept scheme of the project: today's tree becomes the scheme "Topics", and a project can add "Places", ...), or an **entity list** (a scheme whose items are things of one class, for example `foaf:Person`).

Each value of a story is one WADM body: a `TextualBody` that is also an `rdf:Statement` (§3). Any Web Annotation client shows its text. Any RDF processor reads the property and the value. The export asserts the statements about the story's target segment (§8).

The model copies Omeka S, which the organisation already uses (§1). An operator who knows an Omeka **resource template** knows this screen.

**Principle: linked data first.** We use RDF vocabularies as they are. We do not invent a property where dcterms, foaf or schema.org has one, and we do not wrap RDF in a private model. Properties are IRIs, concepts are `skos:Concept`, entities have a class, literals have an XSD datatype. An operator sees an IRI only under "Details".

## 1 Prior art: Omeka S

Read on 2026-10-09: the Omeka S user manual, "Vocabularies" and "Resource Templates" (`npx -y defuddle parse https://omeka.org/s/docs/user-manual/content/resource-template/ --md`), and `ResourceTemplateController.php` (import keys) in `omeka/omeka-s` `develop`.

| Omeka S | What it does | This design |
|---|---|---|
| **Vocabulary** (installation-wide) | An imported RDF file of classes and properties. Formats: JSON-LD, N-Triples, RDF/XML, Turtle. The operator gives label, namespace IRI and prefix. Preloaded: Dublin Core, DC Type, BIBO, FOAF. | **Ontology**, organisation-wide (§4). Bundled: dcterms, dctype, foaf, schema.org, skos. |
| OWL import | Keeps only properties and classes. "OWL domains and ranges are also not enforced or stored." | The same. A range becomes a *hint* for the value type, never a rule. |
| **Resource template** | A set of properties, with an optional class. Per property: alternate label, alternate comment, data types, required, private, default language. Export and import as JSON. | **Vocabulary** of a project: a list of fields (§5). Export as SHACL and as an Omeka template JSON. |
| **Data types** | Text, URI (link with label), Resource. Modules add Numeric, Value Suggest, Custom Vocab. | Value types: text, date, number, link, scheme, entity (§5.2). |
| **Custom Vocab** module | A closed list of terms for one property. | A **scheme**, but with IRIs, hierarchy and SKOS export. |
| Template edit | "Pre-existing values will not be changed when a resource template is edited." | The same rule (§5.4). |

Two Omeka lessons apply. First: Omeka keeps "vocabulary" (properties) apart from "controlled vocabulary" (terms). The manual warns that people mix them up. This design keeps them apart with two words: **ontology** gives properties; **scheme** gives values. Second: the template is the operator's daily object; the ontology is a once-a-year import. The admin follows that weight (§10).

## 2 Words (proposed changes to `CONTEXT.md`; the owner decides)

| Term | Meaning | Not |
|---|---|---|
| **Vocabulary** (changed) | The ordered list of fields of one project: its application profile. Exportable as SHACL. | ontology, template |
| **Field** (new) | One entry of a vocabulary: a property, a label, help, a value type, rules, a position. | attribute, column |
| **Property** (new) | An RDF property IRI. It comes from an ontology, or the app mints it for one project. | predicate (in UI), key |
| **Ontology** (new) | An RDF file of properties and classes, loaded once for the organisation. | vocabulary |
| **Value** (new) | What a member gives for one field in one story. Stored as one value body. | answer, tag |
| **Value body** (new) | A WADM `TextualBody` that is also an `rdf:Statement` (§3). | |
| **Scheme** (new; admin word "Value list") | A SKOS concept scheme of one project, or an entity list. | taxonomy, tree |
| **Entity** (new) | One item of an entity list: an IRI, a label, a class, an optional "same as" link. | record |
| **Concept** (kept) | One item of a scheme that is not an entity list. | tag |
| **Topic** (changed) | Only the default label of the migrated field `dcterms:subject`. Members now see each field's own label. | |

The fixed decision "SKOS tags are two bodies" changes to "each value is one value body" (§3, §11).

## 3 How a value is stored in WADM

### 3.1 The choice

The Web Annotation Data Model (W3C Recommendation, 2017) says that a body is "about" the target. It gives no place for "the target has property P with value V". The rivals:

| Rival | Shape | Verdict |
|---|---|---|
| **A. One value body per value: `TextualBody` + `rdf:Statement`** | `value` = the text to show; `rdf:subject` = the target segment; `rdf:predicate` = the property; `rdf:object` = the concept IRI or a typed literal. | **Chosen.** |
| B. One `SpecificResource` per value, `source` = concept, property in an extension term `annoudio:property` | Needs a namespace term that someone keeps for years; each stack mints a different one (rejected in `phase5b-notes.md` decision 2). A literal value (a year) cannot be a `source`. A generic client shows nothing without the label body. | Rejected. |
| C. One body per story: a JSON-LD node (`dctypes:Dataset`) with `dcterms:spatial` and so on as keys | The triples are about the body node, not the target. To put them on the target, the body `id` must equal the target IRI: then body and target are one resource, and a WADM client is confused. A generic client shows no text. | Rejected. |
| D. Today's pair (`SpecificResource` + `TextualBody`, both `tagging`) plus a property on each | Two bodies per value that must agree. A carries the label and the link in one node. | Rejected. |

Why A is valid WADM and correct RDF:
1. A `TextualBody` must have a `value`; it has one. WADM lets a body have more than one type. Unfamiliar properties must be ignored by clients (Vocabulary §4).
2. `anno.jsonld` already defines the prefixes `rdf`, `xsd`, `dcterms`, `foaf`, `schema` and `skos` (checked against the context file). So the body needs no extra `@context` and no new namespace.
3. `rdf:Statement` is RDF reification: a description of a triple that does not assert it. That is the honest meaning: a member *says* "this part is about Fort Kochi"; the annotation records the saying. The export (§8) asserts the triple, from published stories only.
4. A scratch test with jsonld.js 8.3.3 (local copy of `anno.jsonld`, script not kept) turned the §3.3 example into N-Quads: each value body gives `rdf:type rdf:Statement`, `rdf:predicate <http://purl.org/dc/terms/spatial>`, `rdf:object <…/c/fort-kochi>`, and `rdf:object "1962"^^xsd:gYear` for the year. The standard terms keep their meaning.

Rules:
- `rdf:predicate` and `rdf:object` hold objects with `id` (`{ "id": "http://…" }`), not strings. A plain string would be a literal. The stack writes full IRIs, never CURIEs, so a plain JSON client compares strings.
- `rdf:subject` is the **target IRI**: `{recording IRI}#t={start},{end}`. Media Fragments makes this the same segment that the `FragmentSelector` selects. The builder in `stories` writes it; a range change rewrites it.
- `purpose`: `tagging` for a scheme value (a concept); `describing` for a literal, a link or an entity value.
- `value`: the label of the concept or entity, or the literal as typed. `language` when the label has one.
- A literal with a language uses `@language`. In `anno.jsonld`, `language` means `dc:language`; jsonld.js refused `{ "@value": …, "language": … }` in the test.
- A reply has no values (as it has no tags today, `phase5b-notes.md` decision 4).

### 3.2 What clients see

| Client | Concept value | Literal or entity value |
|---|---|---|
| New player (this stack) | `tag` part inside a `field` part with its label: "Place: Fort Kochi" | `field-value` inside a `field` part: "Year: 1962" |
| v1 player of another stack, older bundle | a `tag`, as today | one more line of `story-text` (it reads `TextualBody` without `tagging` as text, `embed/src/stories.ts` `parseContent`) |
| Generic WADM client (Mirador, Annotorious) | a tag | a text body, without the field label |
| RDF processor | `rdf:Statement` with property and concept | `rdf:Statement` with property and typed literal |

The older-bundle row is the one cost. The loader of a stack serves that stack's own bundle (CONTRACT §5), so only a host that points a bundle of stack A at the stories of stack B sees it. It is extra text, not lost data.

### 3.3 One full story

Project `river-voices`, recording 1, range 1:02–1:35. Five values: two concepts (Places, Topics), a year, a person entity, and a custom text property.

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
    { "type": ["TextualBody", "rdf:Statement"], "purpose": "tagging", "value": "Fort Kochi", "language": "en",
      "rdf:subject": { "id": "https://org.example/recordings/1#t=62,95" },
      "rdf:predicate": { "id": "http://purl.org/dc/terms/spatial" },
      "rdf:object": { "id": "https://org.example/vocab/river-voices/c/fort-kochi" } },
    { "type": ["TextualBody", "rdf:Statement"], "purpose": "tagging", "value": "Ferries", "language": "en",
      "rdf:subject": { "id": "https://org.example/recordings/1#t=62,95" },
      "rdf:predicate": { "id": "http://purl.org/dc/terms/subject" },
      "rdf:object": { "id": "https://org.example/vocab/river-voices/c/ferries" } },
    { "type": ["TextualBody", "rdf:Statement"], "purpose": "describing", "value": "1962",
      "rdf:subject": { "id": "https://org.example/recordings/1#t=62,95" },
      "rdf:predicate": { "id": "http://purl.org/dc/terms/temporal" },
      "rdf:object": { "@value": "1962", "type": "xsd:gYear" } },
    { "type": ["TextualBody", "rdf:Statement"], "purpose": "describing", "value": "K. Joseph",
      "rdf:subject": { "id": "https://org.example/recordings/1#t=62,95" },
      "rdf:predicate": { "id": "http://schema.org/mentions" },
      "rdf:object": { "id": "https://org.example/vocab/river-voices/c/k-joseph" } },
    { "type": ["TextualBody", "rdf:Statement"], "purpose": "describing", "value": "Kerala Queen", "language": "en",
      "rdf:subject": { "id": "https://org.example/recordings/1#t=62,95" },
      "rdf:predicate": { "id": "https://org.example/vocab/river-voices/p/boat-name" },
      "rdf:object": { "@value": "Kerala Queen", "@language": "en" } }
  ],
  "target": {
    "type": "SpecificResource",
    "source": "https://org.example/recordings/1",
    "scope": "https://org.example/projects/river-voices",
    "selector": { "type": "FragmentSelector", "conformsTo": "http://www.w3.org/TR/media-frags/", "value": "t=62,95" }
  }
}
```

## 4 Ontologies (organisation-wide)

An ontology gives properties and classes. It belongs to the organisation, not a project: dcterms is the same for every project, and Omeka does the same.

**Bundled, offline.** The image ships five ontologies as parsed term lists (`vocabulary/bundled/*.json`, made by a script from the official files and checked in): dcterms (55 properties, 22 classes), dctype (12 classes), foaf, skos, and schema.org (about 1 500 properties, 800 classes; IRIs `http://schema.org/`, the form in `anno.jsonld`). A migration seeds them when the table is empty. They cannot be removed (Omeka also protects DC Terms).

**Upload.** Settings → Ontologies → **Upload an ontology**. Formats: Turtle, N-Triples, RDF/XML (most OWL files), JSON-LD. The app parses the file and shows a preview: label, namespace IRI, prefix (from `vann:preferredNamespacePrefix`, else the most common namespace), the counts "41 properties, 9 classes", and the terms it leaves out. The operator corrects label, namespace and prefix, then clicks **Load this ontology**. A later upload of the same namespace shows "added, changed, unchanged, gone"; a gone term that a field uses stays, marked "No longer in the file".

What the parser keeps (as Omeka): `rdf:Property`, `owl:ObjectProperty`, `owl:DatatypeProperty`, `owl:AnnotationProperty` → property; `rdfs:Class`, `owl:Class` → class. For each: IRI, label (`rdfs:label`, else `skos:prefLabel`; project language, then `en`, then no tag), comment (`rdfs:comment`, else `skos:definition`), and the range hint (`rdfs:range`, else `schema:rangeIncludes`). It ignores all other axioms.

Safety, as the SKOS import (`phase5-notes.md` decision 10): no remote `@context`, no `owl:imports` fetch, no request to any address in the file. 5 MB and 20 000 terms at most.

## 5 The vocabulary of a project (fields)

### 5.1 A field

| Setting | Operator label | Notes |
|---|---|---|
| property | "What it records" | Search over loaded ontologies by label and comment. Or **Make a new property**: the app mints `{origin}/vocab/{project}/p/{key}` with the field label as `rdfs:label`. |
| label | "Label members see" | Required. Default: the property label. |
| help | "Help text" | One line under the control. |
| value type | "Kind of answer" | §5.2. Default from the range hint. |
| scheme | "Value list" | For scheme and entity types only. |
| required | "Members must answer" | Default off. |
| max | "How many answers" | 1 to 10. Default 1; 10 for a scheme. |
| show | "Show in the widget" | Default on. Help: "The value stays in the public data." |
| hidden | "Hide from new stories" | As a hidden concept today. |
| position | drag handle | Order on the Annotate page, the widget and the admin. |

### 5.2 Value types

| Value type | Member control | `rdf:object` | Omeka data type (export) |
|---|---|---|---|
| text | one line, or several when max > 1 | literal with `language` = project language | `literal` |
| date | one text box: `1962`, `1962-05` or `1962-05-04` | `xsd:gYear`, `xsd:gYearMonth` or `xsd:date` | `numeric:timestamp` |
| number | number box | `xsd:decimal` | `numeric:integer` when whole, else `literal` |
| link | address and label | IRI; the label goes into `value` | `uri` |
| scheme | chips with search; tree indent | concept IRI | `customvocab:{label}` |
| entity | search list of the entity list | entity IRI | `resource` |

Range hints: `xsd:date`, `dcterms:Period`, `schema:Date` → date; `rdfs:Literal`, `xsd:string` → text; `xsd:decimal`, `schema:Number` → number; `skos:Concept` → scheme; any other class → entity, with that class proposed for a new entity list. A hint is only a default, never a rule.

### 5.3 A new project

A new project starts with three fields, so most operators never open an ontology:

1. "Topics" → `dcterms:subject`, scheme "Topics", max 10.
2. "Place" → `dcterms:spatial`, scheme "Places", max 3.
3. "When" → `dcterms:temporal`, date, max 1.

All three are optional. The operator relabels, hides or removes them.

### 5.4 Change rules

- A label, help, position, required or max change touches no story. Labels reach the widget through the theme JSON (§7).
- The property, value type or scheme of a field with values cannot change, and the field cannot be removed: "12 stories use this field. Make a new field, or hide this one." This keeps every stored statement true.
- Required is checked at the next save of a story only. Old stories are not invalid (Omeka's rule). Two fields cannot have the same property in one project. Reason: the stored body names the property, not the field; the property is the key back to the field.

## 6 Schemes, concepts and entities

Today's work stays: IRI minting (`phase5-notes.md` decision 11), hierarchy with the cycle check, hidden concepts (`owl:deprecated true` on export), the delete guard, SKOS import with a preview, Turtle and JSON-LD export, `conceptChanged`. What changes:

- A project holds 0 to 20 schemes. A concept belongs to one scheme; its parent is in the same scheme. SKOS import and export work per scheme; one SKOS file with several `skos:ConceptScheme` gives a preview per scheme.
- IRIs: a scheme is `{origin}/vocab/{project}/s/{key}`; the migrated Topics scheme keeps `{origin}/vocab/{project}` (an IRI never changes). Every concept and entity of a project is `{origin}/vocab/{project}/c/{key}`, as today; keys are unique per project.
- **Entity lists (minimal).** A scheme with a class (for example `foaf:Person`, `schema:Place`). An entity has a label, a class, an optional "Same as" link (Wikidata, VIAF, an Omeka item), and an optional note. No other fields. Export: `a foaf:Person ; rdfs:label "K. Joseph" ; skos:inScheme <…/s/people> ; owl:sameAs <…>`. `skos:inScheme` has no stated domain, so an entity can carry it without being a concept. Hierarchy: none.
- Who adds items: operators only, as today. A member who finds no fit writes it in the story text; the operator adds the item and returns the story (flow F5 of `ia.md`). "Members may suggest a new item" is open (§16).

## 7 The member and the visitor

### 7.1 Annotate page (phone first)

After the text and the media, one section "About this part" with one control per field, in field order. Hidden fields and hidden concepts do not show. A reply form shows no fields. Errors name the field: "Boat name: give an answer." "When: write a year like 1962, or a date like 1962-05-04."

```
┌─────────────────────────────────────┐
│ About this part                     │
│ Topics                              │
│ [ Ferries ×] [ Work ×] [+ Add ]     │
│ Place                               │
│ Where did this happen?              │
│ [ Fort Kochi ×]        [+ Add ]     │
│ When (year, or year-month, or date) │
│ [ 1962              ]               │
│ Boat name (required)                │
│ [ Kerala Queen      ]               │
└─────────────────────────────────────┘
```

### 7.2 Widget

New parts (CONTRACT §3.3, additive): `fields` (all values of a story, after the text and media), `field` (one field), `field-label`, `field-value`. A concept value stays a `tag` part inside its `field`, so host styles on `::part(tag)` keep working. Example text: "Place: Fort Kochi · Topics: Ferries, Work · When: 1962".

The theme JSON (CONTRACT §3.2, rule 6 allows new keys) gains `fields`: `[{ "property": "http://purl.org/dc/terms/spatial", "label": "Place", "show": true }, …]` in field order. The player groups value bodies by `rdf:predicate`. A value whose property is not in `fields` shows under the property's last path segment; a value with `show: false` does not show. A label change then needs no story rebuild; it reaches hosts within the theme cache time (300 s).

## 8 Export as linked data

Admin → project → **Download as linked data**. One Turtle file (TriG on request) with three layers:

1. **Stories**: the stored WADM, published stories only.
2. **Statements**: for each value body of a published story, the triple `rdf:subject rdf:predicate rdf:object`, asserted. Plus `<target IRI> dcterms:isPartOf <recording IRI>`. In TriG, each story's statements are in a named graph whose name is the story IRI, so provenance stays.
3. **Vocabulary**: the profile as SHACL, the custom properties as `rdf:Property`, each scheme as SKOS, each entity with its class.

The Turtle export of §3.3:

```turtle
@prefix oa: <http://www.w3.org/ns/oa#> .           @prefix dcterms: <http://purl.org/dc/terms/> .
@prefix dc: <http://purl.org/dc/elements/1.1/> .   @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .   @prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix schema: <http://schema.org/> .             @prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix c: <https://org.example/vocab/river-voices/c/> .  @prefix p: <https://org.example/vocab/river-voices/p/> .
@prefix v: <https://org.example/vocab/river-voices/> .    @prefix seg: <https://org.example/recordings/1#> .

# 1 Stories
<https://org.example/stories/river-voices/1/0192a3b4-7c1d-7e00-8000-000000000001> a oa:Annotation ;
  oa:motivatedBy oa:commenting ;
  dcterms:created "2026-10-09T10:00:00Z"^^xsd:dateTime ;
  dcterms:creator <https://org.example/members/m-100> ;
  dcterms:rights <https://creativecommons.org/licenses/by/4.0/> ;
  oa:hasBody
    [ a oa:TextualBody ; rdf:value "My father ran this ferry from Fort Kochi." ; dc:format "text/plain" ; dc:language "en" ] ,
    [ a oa:TextualBody , rdf:Statement ; oa:hasPurpose oa:tagging ; rdf:value "Fort Kochi" ; dc:language "en" ;
      rdf:subject seg:t\=62\,95 ; rdf:predicate dcterms:spatial ; rdf:object c:fort-kochi ] ,
    [ a oa:TextualBody , rdf:Statement ; oa:hasPurpose oa:tagging ; rdf:value "Ferries" ; dc:language "en" ;
      rdf:subject seg:t\=62\,95 ; rdf:predicate dcterms:subject ; rdf:object c:ferries ] ,
    [ a oa:TextualBody , rdf:Statement ; oa:hasPurpose oa:describing ; rdf:value "1962" ;
      rdf:subject seg:t\=62\,95 ; rdf:predicate dcterms:temporal ; rdf:object "1962"^^xsd:gYear ] ,
    [ a oa:TextualBody , rdf:Statement ; oa:hasPurpose oa:describing ; rdf:value "K. Joseph" ;
      rdf:subject seg:t\=62\,95 ; rdf:predicate schema:mentions ; rdf:object c:k-joseph ] ,
    [ a oa:TextualBody , rdf:Statement ; oa:hasPurpose oa:describing ; rdf:value "Kerala Queen" ; dc:language "en" ;
      rdf:subject seg:t\=62\,95 ; rdf:predicate p:boat-name ; rdf:object "Kerala Queen"@en ] ;
  oa:hasTarget [ a oa:SpecificResource ;
    oa:hasSource <https://org.example/recordings/1> ;
    oa:hasScope <https://org.example/projects/river-voices> ;
    oa:hasSelector [ a oa:FragmentSelector ; dcterms:conformsTo <http://www.w3.org/TR/media-frags/> ; rdf:value "t=62,95" ] ] .

# 2 Statements (asserted; published stories only)
seg:t\=62\,95 dcterms:isPartOf <https://org.example/recordings/1> ;
  dcterms:spatial c:fort-kochi ;
  dcterms:subject c:ferries ;
  dcterms:temporal "1962"^^xsd:gYear ;
  schema:mentions c:k-joseph ;
  p:boat-name "Kerala Queen"@en .

# 3 Vocabulary (only the terms this story uses)
c:fort-kochi a skos:Concept ; skos:prefLabel "Fort Kochi"@en ; skos:inScheme v:s\/places ; skos:broader c:kochi .
c:ferries a skos:Concept ; skos:prefLabel "Ferries"@en ; skos:inScheme <https://org.example/vocab/river-voices> .
c:k-joseph a foaf:Person ; rdfs:label "K. Joseph" ; skos:inScheme v:s\/people .
p:boat-name a rdf:Property ; rdfs:label "Boat name"@en ; rdfs:isDefinedBy v:profile .
v:profile a sh:NodeShape ; rdfs:label "River Voices: story fields"@en ;
  sh:property
    [ sh:path dcterms:subject ; sh:name "Topics"@en ; sh:order 1 ; sh:maxCount 10 ; sh:class skos:Concept ;
      sh:node [ sh:property [ sh:path skos:inScheme ; sh:hasValue <https://org.example/vocab/river-voices> ] ] ] ,
    [ sh:path dcterms:temporal ; sh:name "When"@en ; sh:order 3 ; sh:maxCount 1 ;
      sh:or ( [ sh:datatype xsd:gYear ] [ sh:datatype xsd:gYearMonth ] [ sh:datatype xsd:date ] ) ] ,
    [ sh:path p:boat-name ; sh:name "Boat name"@en ; sh:order 5 ; sh:minCount 1 ; sh:datatype rdf:langString ] .
```

Notes: two shapes are left out here for length; the real export writes one per field. The shape has no `sh:target`; a consumer applies it to the subjects of layer 2. The vocabulary export alone (no stories) is also on the project's Vocabulary tab: **Download fields as SHACL** and **Download as Omeka template**. The Omeka file uses the keys that Omeka's import checks: `o:label`, `o:resource_template_property[]` with `vocabulary_namespace_uri`, `vocabulary_label`, `local_name`, `label`, `o:alternate_label`, `o:alternate_comment`, `o:is_required`, `o:is_private`, `data_types[{ name, label }]`. **Upload an Omeka template** reads the same keys and shows a preview; properties of an ontology that is not loaded are listed and left out.

## 9 Data model

| Change | Module | Kind | Migration |
|---|---|---|---|
| `ontologies`: label, namespace, prefix, source (`bundled` or `uploaded`), file hash, loaded at | `vocabulary` | new collection | yes, plus seed |
| `ontology-terms`: iri (unique), ontology, kind (`property` or `class`), label, comment, rangeHint, gone | `vocabulary` | new collection, index on label | yes |
| `fields`: project, property, label, help, valueType, scheme, required, max, show, hidden, position, usage (virtual). A custom property is a row of `ontology-terms` with `project` set. | `vocabulary` | new collection | yes |
| `schemes`: project, key, iri, label, class (optional term), language | `vocabulary` | new collection | yes |
| `concepts.scheme` (required), `concepts.sameAs`, `concepts.note` | `vocabulary` | fields | yes; fill `scheme` |
| `stories.wadm`: pairs → value bodies | `stories` | data | yes, main and versions tables |
| `DraftInput.tags` → `DraftInput.values` | `stories` | interface | no |
| `tagCounts` → `valueCounts(iris)` (concepts and entities) | `stories` | interface | no |
| theme JSON `fields` | `projects` (asks `vocabulary.profile`) | route, additive | no |
| parts `fields`, `field`, `field-label`, `field-value` | `player` | CONTRACT §3.3, additive | no |

No new story column. Counts query `wadm` with a jsonb path on `rdf:object.id` (`.claude/rules/stories-raw-sql.md` applies).

## 10 Admin wireframes (text)

Sidebar job **Concepts** becomes **Vocabulary**. Settings gains **Ontologies**.

```
O10' Vocabulary — River Voices                         [ project ▾ ]
 Fields    Value lists
 ┌────┬──────────────┬──────────────────┬───────────┬─────────┬────────┐
 │ ⠿  │ Label        │ Records          │ Kind      │ Answers │ In use │
 │ ⠿  │ Topics       │ Subject (DC)     │ Topics    │ 0–10    │ 41     │
 │ ⠿  │ Place        │ Spatial (DC)     │ Places    │ 0–3     │ 17     │
 │ ⠿  │ When         │ Temporal (DC)    │ Date      │ 0–1     │ 9      │
 │ ⠿  │ People named │ mentions (schema)│ People    │ 0–5     │ 4      │
 │ ⠿  │ Boat name    │ new property     │ Text      │ 1       │ 2      │
 └────┴──────────────┴──────────────────┴───────────┴─────────┴────────┘
 [ Add a field ]  [ Download fields as SHACL ]  [ Download as Omeka template ]
 [ Upload an Omeka template ]  [ Download as linked data ]

O13 Add a field (drawer)
 What do members tell you?  [ place                 ]
   Spatial Coverage — Dublin Core: "Spatial characteristics of the resource."
   Location — schema.org: "The location of, for example, where an event…"
   ( Make a new property "place" )
 Label members see [ Place ]   Help text [ Where did this happen? ]
 Kind of answer ( Text | Date | Number | Link | From a value list )
 Value list [ Places ▾ ] [ New value list ]   How many answers [ 3 ]
 [x] Show in the widget   [ ] Members must answer
 ▸ Details: http://purl.org/dc/terms/spatial
 [ Save ]

O10'' Value lists
 Topics (31 concepts) · Places (12) · People (entity list: Person, 8)
 [ Add a value list ] — each opens today's tree page (O10) for that list:
 tree with counts, Add a concept, Download as SKOS, Upload SKOS file, Hide.

O14 Ontologies (Settings)
 Dublin Core Terms dcterms 55 properties bundled · FOAF · schema.org · SKOS · DC Type
 Local history     lh      41 properties uploaded 9 Oct   [ Upload new version ]
 [ Upload an ontology ] → preview (§4) → [ Load this ontology ]
```

The review panel (O5) shows values under the story text, in field order, with field labels: "Place: Fort Kochi · When: 1962". Values are read-only for operators, as all story fields are today (§16).

## 11 Migration of today's concepts

One migration, `vocab_profile`:

1. Seed the bundled ontologies.
2. For each project: make the scheme "Topics" with IRI `{origin}/vocab/{project}`; set `scheme` on all its concepts. Concept IRIs do not change.
3. For each project: make the field "Topics" → `dcterms:subject`, scheme Topics, max 10, position 1. The label is "Topics" because members know that word.
4. Rewrite every story, in the main and the versions tables: each pair (`SpecificResource` + `TextualBody`, both `tagging`) becomes one value body with `rdf:predicate` `dcterms:subject`. Rebuild all representations. ETags change once; caches refetch once.
5. Down: Topics value bodies go back to pairs. The down step refuses when other values exist. Risk: an outside harvester sees the body shape change; the IRIs stay.

## 12 The `vocabulary` module interface (sketch)

One rule: `vocabulary` knows RDF terms and nothing of WADM; `stories` knows WADM and nothing of ontologies. They meet at `ResolvedValue`, which is one RDF statement without its subject.

```ts
export function createVocabulary(config: { payload: Payload; origin: string; stories: () => Stories;
  limits?: Partial<typeof VOCABULARY_LIMITS> }): Vocabulary          // `stories` is a getter: made after the config
export const vocabularyCollections: (deps) => CollectionConfig[]  // ontologies, ontology-terms, fields, schemes, concepts

export type ResolvedValue = {
  property: Iri; purpose: 'tagging' | 'describing'
  object: { iri: Iri } | { literal: string; datatype: XsdIri; language?: string }
  text: string; language?: string                  // what `value` shows: the label or the literal
}
export type ValueInput = { field: FieldId; concept?: Iri; text?: string; link?: { iri: string; label: string } }

export interface Vocabulary {
  // members and stories
  profile(project: ProjectSlug, opts?: { forNewStories?: boolean }): Promise<Profile>   // fields in order; schemes in a picker shape
  resolve(project: ProjectSlug, input: ValueInput[]): Promise<
    { ok: true; values: ResolvedValue[] } | { ok: false; errors: { field: FieldId; code: ValueErrorCode }[] }>
  fieldOf(project: ProjectSlug, property: Iri): Promise<Field | null>   // refills the form from stored bodies
  concept(project: ProjectSlug, iri: Iri): Promise<{ iri; label; language?; scheme } | null>   // kept

  // operators: ontologies
  previewOntology(file: Uint8Array, name: string): Promise<OntologyPreview>             // parse only; no write
  loadOntology(operator: OperatorSession, preview: OntologyPreview, names: { label; namespace; prefix }): Promise<void>
  searchTerms(query: { kind: 'property' | 'class'; text: string; limit?: number }): Promise<Term[]>

  // operators: schemes (today's SKOS work, per scheme) and the profile (SHACL out; Omeka in and out)
  exportScheme(project, scheme: SchemeKey, format: 'turtle' | 'jsonld'): Promise<string>
  previewSchemeImport(project, file): Promise<SchemeImportPreview>
  importScheme(operator, project, preview): Promise<void>
  exportProfile(project, format: 'shacl' | 'omeka'): Promise<string>
  previewProfileImport(project, file): Promise<ProfileImportPreview>
  importProfile(operator, project, preview): Promise<void>
  describe(project): AsyncIterable<Quad>           // layer 3 of the linked-data export

  removeVocabulary(project: ProjectSlug): Promise<void>   // kept: the project delete
}
export const VOCABULARY_LIMITS = {
  ontologyBytes: 5_000_000, ontologyTerms: 20_000, fields: 30, schemes: 20,
  conceptsPerScheme: 5000, valuesPerStory: 30, maxPerField: 10, textChars: 500,
} as const
export type ValueErrorCode =
  'required' | 'too-many' | 'unknown-field' | 'hidden-field' | 'unknown-concept' | 'hidden-concept'
  | 'not-in-scheme' | 'bad-date' | 'bad-number' | 'bad-link' | 'too-long'
```

Why it is deep: `resolve` hides label lookup, scheme membership, hidden rules, date parsing to three XSD types, link checks and limits behind one call. `profile` serves three callers (Annotate page, theme JSON, admin panel). The parsers (`n3`, `jsonld-streaming-parser`, a new RDF/XML parser), IRI minting, the range-hint table, the serialisers (SKOS, SHACL, Omeka) and the guards of §5.4 stay inside. Tests cross these methods only.



## 13 `stories` changes

- `DraftInput.tags` is replaced by `values: ValueInput[]`. `saveDraft` calls `vocabulary.resolve` and then shapes each `ResolvedValue` into a value body, with `rdf:subject` = the target IRI. A reply with values gives `reply-and-values` (replaces `reply-and-tags`). New `SaveError` code `values-invalid` carries the per-field errors. `OwnDraft.tags` becomes `values: ResolvedValue[]`; the Annotate page maps them to fields with `fieldOf`.
- `conceptChanged(iri, { req })` stays; it rewrites `value` in every value body whose `rdf:object.id` is that IRI. It also covers entities.
- `valueCounts(iris)` replaces `tagCounts` for the "in use" counts of concepts and entities. A new `fieldUsage(project, property)` backs "12 stories use this field".
- `exportStories` gains `format: 'jsonld' | 'turtle' | 'trig'`. The admin route joins its layers 1 and 2 with `vocabulary.describe` (layer 3).
- Validation of a stored record (`deriveColumns`): a value body must have `rdf:subject` equal to the target IRI, an `rdf:predicate` IRI, and an `rdf:object` that is an IRI or a literal.

## 14 Payload feasibility

| Need | How in Payload 3 | Risk |
|---|---|---|
| Property picker over 2 000+ terms | `relationship` to `ontology-terms` with `filterOptions` (`kind = property`), search on `useAsTitle` | Low. Payload searches server-side. |
| Field order by drag | `orderable: true` on the `fields` collection | Verify: added in a 3.x minor; check the version in `app/package.json`. Fallback: a `position` number and up/down buttons in the custom panel. |
| Upload of a 5 MB ontology | A route handler, not a Server Action (1 MiB default, `phase5-notes.md` decision 10) | Low. |
| RDF/XML | New dependency `rdfxml-streaming-parser` (same author as `jsonld-streaming-parser`), a version older than one month | Low. |
| Story rewrite in migration | Raw SQL over `jsonb`, main and versions tables | Medium; `.claude/rules/app-migrations.md` hazards apply. |

## 15 Trade-offs

| For | Against |
|---|---|
| Statements are true RDF with standard properties; the export joins other linked data (Wikidata links, Omeka items) with no mapping table. | `rdf:Statement` reification is old and unloved. RDF 1.2 triple terms are the modern form, but JSON-LD 1.1 has no syntax for them yet. A later move is a data migration. |
| Operators who use Omeka see the same three ideas: ontology, template, data type. Omeka template files go both ways. | Three new admin objects (ontologies, fields, value lists) where there was one (concepts). |
| A non-technical operator can stay in the defaults: three fields, relabel, add concepts. IRIs hide under "Details". | Choosing the right property is an expert task. "What do members tell you?" search helps, but an operator can pick `dcterms:coverage` for "Place". Wrong picks are costly: §5.4 forbids a property change once values exist. |
| Generic WADM clients still show every value as text or a tag. | Without the field label, "1962" alone is weak in a generic client. Older bundles of another stack show literal values as story text. |
| One body per value keeps label and link together; a concept relabel rewrites one place. | Each value repeats `rdf:subject`. A story with 30 values grows by about 6 KB. |

The main tension: power for an archivist against load for a volunteer coordinator. The design puts power behind defaults: the operator who never opens Ontologies loses nothing.

## 16 Open questions

1. May operators edit values during review (add a missing Place)? Today no story field is editable. A curator edit needs `changedBy` on the value and a new review rule.
2. May members suggest a new concept or entity ("Add 'Mattancherry'")? It needs a draft item that is published with the story.
3. Private fields (Omeka `o:is_private`)? The served WADM is public. A private value needs a second store outside `wadm`. Out of scope here.
4. Subject of the statements: the target segment (chosen) or the story? A field like "Told by" describes the telling, not the segment. A per-field "describes: the part | the story" setting is possible; this design leaves it out.
