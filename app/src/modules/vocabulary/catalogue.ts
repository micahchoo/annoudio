// The catalogue: 14 plain questions that an operator adds with one click
// (design/vocab.md §2). Each property is a term of a bundled ontology.

import { NS } from './terms'

export type Iri = string
export type ValueType = 'text' | 'date' | 'number' | 'link' | 'list' | 'entity'
export type ListKind = 'items' | 'entities'
export type ShowAs = 'line' | 'tags' | 'none'

/** The list that a catalogue question makes on first use, or reuses by its key. */
export interface CatalogueList {
  key: string
  name: string
  kind: ListKind
  /** The class of an entity list. A list of items has `skos:Concept`. */
  class?: Iri
  /** Items of a new list. `project-language`: one item, the language of the project. */
  seed?: readonly string[] | 'project-language'
}

export interface CatalogueEntry {
  key: string
  label: string
  help?: string
  property: Iri
  valueType: ValueType
  list?: CatalogueList
  max: number
  allowOwn: boolean
  showAs: ShowAs
}

const relators = 'http://id.loc.gov/vocabulary/relators/'
const PEOPLE: CatalogueList = {
  key: 'people',
  name: 'People',
  kind: 'entities',
  class: `${NS.foaf}Person`,
}

export const CATALOGUE: readonly CatalogueEntry[] = [
  {
    key: 'topics',
    label: 'Topics',
    help: 'What is this part about?',
    property: `${NS.dcterms}subject`,
    valueType: 'list',
    list: { key: 'topics', name: 'Topics', kind: 'items' },
    max: 10,
    allowOwn: false,
    showAs: 'tags',
  },
  {
    key: 'place',
    label: 'Place',
    help: 'Where did this happen?',
    property: `${NS.dcterms}spatial`,
    valueType: 'list',
    list: { key: 'places', name: 'Places', kind: 'items' },
    max: 3,
    allowOwn: true,
    showAs: 'line',
  },
  {
    key: 'when',
    label: 'When it happened',
    help: 'A year is enough.',
    property: `${NS.dcterms}temporal`,
    valueType: 'date',
    max: 1,
    allowOwn: false,
    showAs: 'line',
  },
  {
    key: 'speaker',
    label: 'Who is speaking',
    property: `${relators}spk`,
    valueType: 'entity',
    list: PEOPLE,
    max: 3,
    allowOwn: true,
    showAs: 'line',
  },
  {
    key: 'interviewee',
    label: 'Who is interviewed',
    property: `${relators}ive`,
    valueType: 'entity',
    list: PEOPLE,
    max: 3,
    allowOwn: true,
    showAs: 'line',
  },
  {
    key: 'interviewer',
    label: 'Who asks the questions',
    property: `${relators}ivr`,
    valueType: 'entity',
    list: PEOPLE,
    max: 3,
    allowOwn: true,
    showAs: 'line',
  },
  {
    key: 'performer',
    label: 'Who sings or plays',
    property: `${relators}prf`,
    valueType: 'entity',
    list: PEOPLE,
    max: 5,
    allowOwn: true,
    showAs: 'line',
  },
  {
    key: 'mentions',
    label: 'People mentioned',
    property: `${NS.schema}mentions`,
    valueType: 'entity',
    list: PEOPLE,
    max: 10,
    allowOwn: true,
    showAs: 'line',
  },
  {
    key: 'language',
    label: 'Language spoken',
    property: `${NS.dcterms}language`,
    valueType: 'list',
    list: { key: 'languages', name: 'Languages', kind: 'items', seed: 'project-language' },
    max: 3,
    allowOwn: false,
    showAs: 'line',
  },
  {
    key: 'kind',
    label: 'Kind of sound',
    help: 'Speech, song, music…',
    property: `${NS.dcterms}type`,
    valueType: 'list',
    list: {
      key: 'kinds-of-sound',
      name: 'Kinds of sound',
      kind: 'items',
      seed: ['Speech', 'Song', 'Music', 'Sounds of a place'],
    },
    max: 3,
    allowOwn: false,
    showAs: 'line',
  },
  {
    key: 'title',
    label: 'Short title',
    help: 'A name for this part.',
    property: `${NS.dcterms}title`,
    valueType: 'text',
    max: 1,
    allowOwn: false,
    showAs: 'line',
  },
  {
    key: 'hear',
    label: 'What you hear',
    property: `${NS.dcterms}description`,
    valueType: 'text',
    max: 1,
    allowOwn: false,
    showAs: 'line',
  },
  {
    key: 'link',
    label: 'Link to more',
    help: 'A web address.',
    property: `${NS.rdfs}seeAlso`,
    valueType: 'link',
    max: 3,
    allowOwn: false,
    showAs: 'line',
  },
  {
    key: 'source',
    label: 'Where you know this from',
    help: 'A book, an archive, a person.',
    property: `${NS.dcterms}source`,
    valueType: 'text',
    max: 1,
    allowOwn: false,
    showAs: 'line',
  },
]
