// The questions of a project as an Omeka S resource template (JSON), both ways
// (design/vocab.md §6; design/vocab-B-schemes.md §8). The keys are the ones that Omeka's
// template import reads: `o:label`, `o:resource_template_property[]` with
// `vocabulary_namespace_uri`, `vocabulary_label`, `local_name`, `label`,
// `o:alternate_label`, `o:alternate_comment`, `o:is_required`, `o:is_private` and
// `data_types[{ name, label }]`. Data types: text `literal`, date `numeric:timestamp`,
// number `numeric:integer`, link `uri`, a list or an entity list `customvocab:{list}`
// (Omeka's Custom Vocab), an entity with no list `resource`.

import type { Iri, ValueType } from './catalogue'
import type { FormSpec } from './shacl'
import type { Field } from './types'

interface OmekaProperty {
  vocabulary_namespace_uri: string
  vocabulary_label: string
  local_name: string
  label: string
  'o:alternate_label': string | null
  'o:alternate_comment': string | null
  'o:is_required': boolean
  'o:is_private': boolean
  data_types: { name: string; label: string }[]
}

export interface OmekaTemplate {
  'o:label': string
  'o:resource_template_property': OmekaProperty[]
}

const DATA_TYPES: Record<Exclude<ValueType, 'list'>, { name: string; label: string }> = {
  text: { name: 'literal', label: 'Text' },
  date: { name: 'numeric:timestamp', label: 'Timestamp' },
  number: { name: 'numeric:integer', label: 'Integer' },
  link: { name: 'uri', label: 'URI' },
  entity: { name: 'resource', label: 'Omeka resource' },
}

/** The namespace and the local name of an IRI: the part after the last `#` or `/`. */
function split(iri: Iri): { namespace: string; local: string } {
  const at = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/')) + 1
  return { namespace: iri.slice(0, at), local: iri.slice(at) }
}

export function toOmeka(
  label: string,
  fields: Field[],
  ontologies: { namespace: string; label: string }[],
): OmekaTemplate {
  return {
    'o:label': label,
    'o:resource_template_property': fields.map((field) => {
      const { namespace, local } = split(field.property)
      return {
        vocabulary_namespace_uri: namespace,
        vocabulary_label: ontologies.find((o) => o.namespace === namespace)?.label ?? namespace,
        local_name: local,
        label: field.label,
        'o:alternate_label': field.label,
        'o:alternate_comment': field.help ?? null,
        'o:is_required': field.required,
        'o:is_private': false,
        data_types: [
          // A list, and an entity list too: Omeka's Custom Vocab names the list.
          field.list
            ? { name: `customvocab:${field.list.label}`, label: field.list.label }
            : DATA_TYPES[field.valueType as Exclude<ValueType, 'list'>],
        ],
      }
    }),
  }
}

/** True when a parsed JSON value has the shape of a resource template. */
export function isOmeka(value: unknown): value is OmekaTemplate {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>)['o:resource_template_property'])
  )
}

/**
 * The form of a template. `listIriOf` finds the list of a `customvocab:{label}` data type
 * by its label in the project (its kind gives list or entity); an unknown list leaves the
 * IRI out (the import then reports the question).
 */
export function formFromOmeka(
  template: OmekaTemplate,
  listOf: (label: string) => { iri: Iri; kind: 'items' | 'entities' } | undefined,
): FormSpec {
  const fields = template['o:resource_template_property'].flatMap((p, i) => {
    if (typeof p?.vocabulary_namespace_uri !== 'string' || typeof p.local_name !== 'string')
      return []
    const type = p.data_types?.[0]?.name ?? 'literal'
    let valueType: ValueType = 'text'
    let listIri: Iri | undefined
    if (type.startsWith('customvocab:')) {
      const list = listOf(type.slice('customvocab:'.length))
      valueType = list?.kind === 'entities' ? 'entity' : 'list'
      listIri = list?.iri
    } else if (type === 'numeric:timestamp') valueType = 'date'
    else if (type === 'numeric:integer') valueType = 'number'
    else if (type === 'uri') valueType = 'link'
    else if (type === 'resource' || type.startsWith('resource:')) valueType = 'entity'
    const label = p['o:alternate_label'] || p.label || p.local_name
    return [
      {
        property: `${p.vocabulary_namespace_uri}${p.local_name}`,
        label,
        ...(p['o:alternate_comment'] ? { help: p['o:alternate_comment'] } : {}),
        valueType,
        required: p['o:is_required'] === true,
        max: valueType === 'list' || valueType === 'entity' ? 3 : 1,
        order: i + 1,
        ...(listIri ? { listIri } : {}),
      },
    ]
  })
  return {
    label: typeof template['o:label'] === 'string' ? template['o:label'] : 'Template',
    fields,
  }
}
