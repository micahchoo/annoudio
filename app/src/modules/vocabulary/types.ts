// The types of the `vocabulary` interface (design/vocab.md §9.2). `index.ts` exports them.

import type { Payload, PayloadRequest } from 'payload'

import type { Iri, ListKind, ShowAs, ValueType } from './catalogue'

export type ProjectSlug = string

/** A signed-in operator. The same shape as the `OperatorSession` of `stories`. */
export interface OperatorSession {
  operatorId: string
  name?: string
}

/** What the vocabulary asks of `stories`. A getter: `stories` is made after the config. */
export interface VocabularyStories {
  /** Item or entity IRI → stories with a value that points at it. */
  valueCounts(project: ProjectSlug): Promise<Map<Iri, number>>
  /** Property IRI → stories with a value for it. */
  fieldUsage(project: ProjectSlug): Promise<Map<Iri, number>>
  conceptChanged(iri: Iri, options?: { req?: PayloadRequest }): Promise<void>
}

export interface VocabularyConfig {
  /** The Payload instance, or a function that gives it on first use. */
  payload: Payload | (() => Promise<Payload>)
  /** ANNOUDIO_ORIGIN: the base of every minted IRI. */
  origin: string
  /** Without it, every field has usage 0 and no item is in use. */
  stories?: () => VocabularyStories
  limits?: Partial<VocabularyLimits>
}

export const VOCABULARY_LIMITS = {
  fileBytes: 5_000_000,
  fileTerms: 20_000,
  fields: 20,
  lists: 20,
  itemsPerList: 5000,
  valuesPerStory: 30,
  maxPerField: 10,
  textChars: 500,
} as const
export type VocabularyLimits = { [K in keyof typeof VOCABULARY_LIMITS]: number }

export interface FieldList {
  key: string
  iri: Iri
  label: string
  kind: ListKind
  /** The class of an entity list. Absent for a list of items. */
  class?: Iri
  /** Items in the list, hidden ones too. */
  size: number
}

export interface Field {
  property: Iri
  curie: string
  label: string
  help?: string
  valueType: ValueType
  list?: FieldList
  required: boolean
  max: number
  showAs: ShowAs
  allowOwn: boolean
  hidden: boolean
  /** Stories with a value for this field (any version). More than 0: the field is locked. */
  usage: number
}

export interface Profile {
  project: ProjectSlug
  /** The language of the stories of the project, for text values. */
  language: string
  fields: Field[]
}

export interface Choice {
  iri: Iri
  label: string
  language?: string
  parent?: Iri
  depth: number
}

export interface ListSummary extends FieldList {
  hidden: boolean
  /** The labels of the fields that take their choices from this list. */
  askedBy: string[]
}

export type ValueInput =
  | { property: Iri; item: Iri }
  | { property: Iri; text: string }
  | { property: Iri; date: { year: number; month?: number; day?: number } }
  | { property: Iri; link: { href: string; label?: string } }

export type ResolvedObject =
  | { iri: Iri }
  | { literal: string; datatype?: Iri; language?: string }
  | { own: { label: string; language?: string; class: Iri } }

/** One statement without its subject: the seam between `vocabulary` and `stories`. */
export interface ResolvedValue {
  property: Iri
  purpose: 'tagging' | 'describing'
  text: string
  language?: string
  object: ResolvedObject
}

export type ValueErrorCode =
  | 'required'
  | 'too-many'
  | 'unknown-field'
  | 'hidden-field'
  | 'unknown-item'
  | 'hidden-item'
  | 'own-not-allowed'
  | 'bad-date'
  | 'bad-number'
  | 'bad-link'
  | 'too-long'

export type ResolveResult =
  | { ok: true; values: ResolvedValue[] }
  | { ok: false; errors: { property: Iri; code: ValueErrorCode }[] }

export type FieldResult =
  | { ok: true; field: Field }
  | {
      ok: false
      error:
        | 'unknown-project'
        | 'unknown-term'
        | 'property-taken'
        | 'field-in-use'
        | 'too-many'
        | 'bad-list'
        | 'not-a-property'
    }

export type FieldSpec =
  | { from: 'catalogue'; key: string }
  | {
      from: 'term'
      property: Iri
      label: string
      help?: string
      valueType: ValueType
      list?: string
    }
  | { from: 'own'; label: string; help?: string; valueType: ValueType; list?: string }

export type FieldPatch = Partial<
  Pick<
    Field,
    'label' | 'help' | 'required' | 'max' | 'showAs' | 'allowOwn' | 'hidden' | 'valueType'
  > & {
    list: string
  }
>

export type ItemError =
  'unknown-project' | 'unknown-list' | 'no-label' | 'too-many' | 'bad-parent' | 'bad-same-as'
