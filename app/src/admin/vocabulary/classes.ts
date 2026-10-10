// The classes that a new entity list can have. Person first (design/vocab.md §8). Each is
// a class of a bundled ontology.

export const CLASSES = [
  { iri: 'http://xmlns.com/foaf/0.1/Person', label: 'People (foaf:Person)' },
  { iri: 'http://schema.org/Place', label: 'Places (schema:Place)' },
  { iri: 'http://schema.org/Organization', label: 'Organisations (schema:Organization)' },
  { iri: 'http://schema.org/Event', label: 'Events (schema:Event)' },
  { iri: 'http://schema.org/Thing', label: 'Things (schema:Thing)' },
] as const
