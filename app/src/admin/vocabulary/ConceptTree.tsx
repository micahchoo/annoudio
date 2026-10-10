// The concept tree of one project with story counts, "Add a concept", and the SKOS
// download and upload (walkthrough 23–26). The Concepts page (O10) and the Vocabulary tab
// of a project show it.

import { stories } from '@payload-config'
import { Button } from '@payloadcms/ui'
import Link from 'next/link'
import type { Payload } from 'payload'

import { IMPORT_LIMITS, conceptsOf, type ConceptNode } from '@/modules/vocabulary'

import { SkosTools } from '../projects/SkosTools'
import { QuickAddItem } from './QuickAddItem'
import { PATHS } from '../paths'
import { strings } from '../strings'

const s = strings.vocabulary

interface Node extends ConceptNode {
  children: Node[]
}

export async function ConceptTree(props: {
  payload: Payload
  project: { id: number | string; slug: string }
  /** One list: its key and admin id. Default: the list Topics. */
  list?: { key: string; id: number | string; kind: 'items' | 'entities'; label: string }
}) {
  const { payload, project } = props
  const key = props.list?.key ?? 'topics'
  const [all, uses] = await Promise.all([
    conceptsOf({ payload }, project.slug),
    stories.valueCounts(project.slug),
  ])
  const concepts = all.filter((c) => c.list === key)
  const addUrl = `${PATHS.newConcept}?project=${project.id}${props.list ? `&list=${props.list.id}` : ''}`
  return (
    <>
      {concepts.length === 0 ? (
        <p className="ao-empty">
          {props.list ? strings.lists.empty(props.list.label) : s.none}
        </p>
      ) : props.list?.kind === 'entities' ? (
        <Entities entities={concepts} uses={uses} />
      ) : (
        <Tree nodes={tree(concepts)} uses={uses} />
      )}
      {props.list ? (
        <>
          <QuickAddItem project={project.slug} listKey={props.list.key} />
          <p>
            <Link href={addUrl}>{strings.lists.allFields}</Link>
          </p>
        </>
      ) : (
        <p>
          <Button el="link" url={addUrl} buttonStyle="primary" size="medium">
            {s.add}
          </Button>
        </p>
      )}
      <SkosTools project={project.slug} maxBytes={IMPORT_LIMITS.bytes} list={props.list?.key} />
    </>
  )
}

/** An entity list has no tree: Label · Same as · stories (design/vocab.md §8). */
function Entities({ entities, uses }: { entities: ConceptNode[]; uses: Map<string, number> }) {
  const c = strings.lists.columns
  return (
    <table className="annoudio-entities">
      <thead>
        <tr>
          <th scope="col">{c.label}</th>
          <th scope="col">{c.sameAs}</th>
          <th scope="col">{c.stories}</th>
        </tr>
      </thead>
      <tbody>
        {entities.map((entity) => (
          <tr key={entity.iri} data-concept={entity.label}>
            <td>
              <Link href={`/admin/collections/concepts/${entity.id}`}>{entity.label}</Link>
              {entity.hidden && <span className="annoudio-tree__hidden"> ({s.hidden})</span>}
            </td>
            <td>
              {entity.sameAs ? (
                <a href={entity.sameAs} rel="noreferrer" target="_blank">
                  {entity.sameAs}
                </a>
              ) : (
                strings.lists.noSameAs
              )}
            </td>
            <td>{s.stories(uses.get(entity.iri) ?? 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Tree({ nodes, uses }: { nodes: Node[]; uses: Map<string, number> }) {
  return (
    <ul className="annoudio-tree">
      {nodes.map((node) => (
        <li key={node.iri} data-concept={node.label}>
          <Link href={`/admin/collections/concepts/${node.id}`}>{node.label}</Link>
          {node.hidden && <span className="annoudio-tree__hidden"> ({s.hidden})</span>}
          <span className="annoudio-tree__uses"> · {s.stories(uses.get(node.iri) ?? 0)}</span>
          {node.children.length > 0 && <Tree nodes={node.children} uses={uses} />}
        </li>
      ))}
    </ul>
  )
}

/** The concepts as a tree, in label order. A concept whose parent is missing is a root. */
function tree(concepts: ConceptNode[]): Node[] {
  const nodes = new Map(concepts.map((c) => [c.iri, { ...c, children: [] as Node[] }]))
  const roots: Node[] = []
  for (const node of nodes.values()) {
    const parent = node.parent ? nodes.get(node.parent) : undefined
    ;(parent ? parent.children : roots).push(node)
  }
  return roots
}
