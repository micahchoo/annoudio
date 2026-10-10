'use server'

// The Server Actions of the Vocabulary tab and page. Each one checks the operator first:
// a Server Action is a public POST endpoint. They call the `vocabulary` interface only.

import { vocabulary } from '@payload-config'

import type {
  FieldPatch,
  FieldResult,
  FieldSpec,
  Iri,
  ListKind,
  ProfileFormat,
  Term,
} from '@/modules/vocabulary'

import { requestOperator } from '../operator'

type Forbidden = { ok: false; error: 'forbidden' }
const FORBIDDEN: Forbidden = { ok: false, error: 'forbidden' }

export async function addQuestion(
  project: string,
  spec: FieldSpec,
): Promise<FieldResult | Forbidden> {
  const session = await requestOperator()
  if (!session) return FORBIDDEN
  return vocabulary.addField(session.operator, project, spec)
}

export async function updateQuestion(
  project: string,
  property: Iri,
  patch: FieldPatch,
): Promise<FieldResult | Forbidden> {
  const session = await requestOperator()
  if (!session) return FORBIDDEN
  return vocabulary.updateField(session.operator, project, property, patch)
}

export async function moveQuestion(
  project: string,
  property: Iri,
  to: number,
): Promise<FieldResult | Forbidden> {
  const session = await requestOperator()
  if (!session) return FORBIDDEN
  return vocabulary.moveField(session.operator, project, property, to)
}

export async function removeQuestion(
  project: string,
  property: Iri,
): Promise<FieldResult | Forbidden> {
  const session = await requestOperator()
  if (!session) return FORBIDDEN
  return vocabulary.removeField(session.operator, project, property)
}

/** Properties of the loaded ontologies for "Advanced: from an ontology". */
export async function searchProperties(
  project: string,
  text: string,
  ontology: string,
): Promise<Term[]> {
  const session = await requestOperator()
  if (!session || text.trim().length < 2) return []
  return vocabulary.searchTerms({
    kind: 'property',
    text,
    ...(ontology ? { ontology } : {}),
    limit: 20,
  })
}

/** A new list for a question: Topics, Places, People… */
export async function addQuestionList(
  project: string,
  spec: { label: string; kind: ListKind; class?: Iri },
): Promise<
  | { ok: true; key: string }
  | { ok: false; error: 'too-many' | 'bad-class' | 'forbidden' }
  | { ok: false; error: 'exists'; key: string; label: string }
> {
  const session = await requestOperator()
  if (!session) return { ok: false, error: 'forbidden' }
  return vocabulary.addList(session.operator, project, spec)
}

/** The questions as a file for other systems: SHACL (Turtle, JSON-LD) or an Omeka template. */
export async function downloadQuestions(
  project: string,
  format: ProfileFormat,
): Promise<{ filename: string; contentType: string; body: string } | null> {
  const session = await requestOperator()
  if (!session) return null
  return vocabulary.exportFile(project, { kind: 'profile', format })
}

/** Add an own answer of a member to a list (the review panel). The story keeps its own answer. */
export async function addListItem(
  project: string,
  listKey: string,
  label: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requestOperator()
  if (!session) return { ok: false, error: 'forbidden' }
  const result = await vocabulary.addItem(session.operator, project, listKey, { label })
  return result.ok ? { ok: true } : result
}
