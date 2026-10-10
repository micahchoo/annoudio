// The questions of a project as a SHACL shape, both ways (design/vocab.md §6). One
// `sh:NodeShape` with no target; one `sh:property` per field: `sh:path` → property,
// `sh:name` → label, `sh:description` → help, `sh:order`, `sh:minCount 1` → required,
// `sh:maxCount` → max, the value type from `sh:datatype`, `sh:nodeKind sh:IRI` (a link)
// or `sh:class` (a list: `skos:Concept`; an entity list: its class), and the list from
// `sh:node [ sh:property [ sh:path skos:inScheme ; sh:hasValue <list> ] ]`.

import { DataFactory, type Quad, type Quad_Object, type Quad_Subject } from 'n3'

import type { Iri, ValueType } from './catalogue'
import type { Triple } from './rdf'
import { NS } from './terms'
import type { Field } from './types'

const SH = NS.sh
const XSD = NS.xsd
const SKOS_CONCEPT = `${NS.skos}Concept`
const DATES = [`${XSD}gYear`, `${XSD}gYearMonth`, `${XSD}date`]

/** One question of a form file, before the import makes it a field. */
export interface FormField {
  property: Iri
  label: string
  help?: string
  valueType: ValueType
  required: boolean
  max: number
  order: number
  /** The IRI of the list of a list or entity question. */
  listIri?: Iri
}

export interface FormSpec {
  label: string
  fields: FormField[]
}

/** The shape of the fields, in field order. */
export function shaclQuads(
  shape: Iri,
  label: string,
  language: string,
  fields: Field[],
  ownTerms: { iri: Iri; label: string; comment?: string }[],
): Quad[] {
  const { namedNode, literal, blankNode, quad } = DataFactory
  const out: Quad[] = []
  const add = (s: Quad_Subject, p: string, o: Quad_Object) => out.push(quad(s, namedNode(p), o))
  const type = `${NS.rdf}type`
  const node = namedNode(shape)
  add(node, type, namedNode(`${SH}NodeShape`))
  add(node, `${NS.rdfs}label`, literal(label, language))
  for (const [i, field] of fields.entries()) {
    const p = blankNode()
    add(node, `${SH}property`, p)
    add(p, `${SH}path`, namedNode(field.property))
    add(p, `${SH}name`, literal(field.label, language))
    if (field.help) add(p, `${SH}description`, literal(field.help, language))
    add(p, `${SH}order`, literal(String(i + 1), namedNode(`${XSD}integer`)))
    if (field.required) add(p, `${SH}minCount`, literal('1', namedNode(`${XSD}integer`)))
    add(p, `${SH}maxCount`, literal(String(field.max), namedNode(`${XSD}integer`)))
    switch (field.valueType) {
      case 'text':
        add(p, `${SH}datatype`, namedNode(`${NS.rdf}langString`))
        break
      case 'number':
        add(p, `${SH}datatype`, namedNode(`${XSD}decimal`))
        break
      case 'date': {
        // sh:or ( [ sh:datatype xsd:gYear ] [ sh:datatype xsd:gYearMonth ] [ sh:datatype xsd:date ] )
        let rest: Quad_Object = namedNode(`${NS.rdf}nil`)
        for (const datatype of [...DATES].reverse()) {
          const item = blankNode()
          add(item, `${SH}datatype`, namedNode(datatype))
          const cell = blankNode()
          add(cell, `${NS.rdf}first`, item)
          add(cell, `${NS.rdf}rest`, rest)
          rest = cell
        }
        add(p, `${SH}or`, rest)
        break
      }
      case 'link':
        add(p, `${SH}nodeKind`, namedNode(`${SH}IRI`))
        break
      case 'list':
      case 'entity': {
        add(p, `${SH}class`, namedNode(field.list?.class ?? SKOS_CONCEPT))
        if (field.list) {
          const inner = blankNode()
          const scheme = blankNode()
          add(p, `${SH}node`, inner)
          add(inner, `${SH}property`, scheme)
          add(scheme, `${SH}path`, namedNode(`${NS.skos}inScheme`))
          add(scheme, `${SH}hasValue`, namedNode(field.list.iri))
        }
        break
      }
    }
  }
  for (const term of ownTerms) {
    add(namedNode(term.iri), type, namedNode(`${NS.rdf}Property`))
    add(namedNode(term.iri), `${NS.rdfs}label`, literal(term.label, language))
    if (term.comment) add(namedNode(term.iri), `${NS.rdfs}comment`, literal(term.comment, language))
  }
  return out
}

/** The first `sh:NodeShape` of a file as a form, or null when the file has none. */
export function formFromShacl(triples: Triple[]): FormSpec | null {
  const key = (t: Triple['subject']) => (t.termType === 'BlankNode' ? `_:${t.value}` : t.value)
  const by = new Map<string, Triple[]>()
  for (const t of triples) by.set(key(t.subject), [...(by.get(key(t.subject)) ?? []), t])
  const objects = (s: string, p: string) =>
    (by.get(s) ?? []).filter((t) => t.predicate.value === p).map((t) => t.object)
  const one = (s: string, p: string) => objects(s, p)[0]
  const ref = (o: Triple['object']) => (o.termType === 'BlankNode' ? `_:${o.value}` : o.value)
  const shape = triples.find(
    (t) => t.predicate.value === `${NS.rdf}type` && t.object.value === `${SH}NodeShape`,
  )
  if (!shape) return null
  const s = key(shape.subject)
  const fields: FormField[] = []
  for (const [i, prop] of objects(s, `${SH}property`).entries()) {
    const p = ref(prop)
    const path = one(p, `${SH}path`)
    const name = one(p, `${SH}name`)
    if (!path || path.termType !== 'NamedNode') continue
    const datatype = one(p, `${SH}datatype`)?.value
    const cls = one(p, `${SH}class`)?.value
    const kind = one(p, `${SH}nodeKind`)?.value
    let valueType: ValueType = 'text'
    if (cls) valueType = cls === SKOS_CONCEPT ? 'list' : 'entity'
    else if (kind === `${SH}IRI`) valueType = 'link'
    else if (datatype === `${XSD}decimal` || datatype === `${XSD}integer`) valueType = 'number'
    else if (datatype && DATES.includes(datatype)) valueType = 'date'
    else if (one(p, `${SH}or`)) valueType = 'date'
    let listIri: string | undefined
    const inner = one(p, `${SH}node`)
    if (inner) {
      for (const scheme of objects(ref(inner), `${SH}property`)) {
        if (one(ref(scheme), `${SH}path`)?.value === `${NS.skos}inScheme`) {
          listIri = one(ref(scheme), `${SH}hasValue`)?.value
        }
      }
    }
    const max = Number(one(p, `${SH}maxCount`)?.value ?? 1)
    const order = Number(one(p, `${SH}order`)?.value ?? i + 1)
    fields.push({
      property: path.value,
      label: name?.value ?? path.value.replace(/^.*[#/]/, ''),
      ...(one(p, `${SH}description`) ? { help: one(p, `${SH}description`)!.value } : {}),
      valueType,
      required: Number(one(p, `${SH}minCount`)?.value ?? 0) >= 1,
      max: Number.isInteger(max) && max >= 1 ? Math.min(max, 10) : 1,
      order: Number.isFinite(order) ? order : i + 1,
      ...(listIri ? { listIri } : {}),
    })
  }
  const label = one(s, `${NS.rdfs}label`)?.value ?? 'Questions'
  return { label, fields: fields.sort((a, b) => a.order - b.order) }
}
