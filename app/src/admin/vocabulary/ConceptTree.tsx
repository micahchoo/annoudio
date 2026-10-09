// The concept tree of one project with story counts, "Add a concept", and the SKOS
// download and upload (walkthrough 23–26). The Concepts page (O10) and the Vocabulary tab
// of a project show it.

import { stories } from '@payload-config'
import { Button } from '@payloadcms/ui'
import Link from 'next/link'
import type { Payload } from 'payload'

import { IMPORT_LIMITS, conceptsOf, type ConceptNode } from '@/modules/vocabulary'

import { SkosTools } from '../projects/SkosTools'
import { PATHS } from '../paths'
import { strings } from '../strings'

const s = strings.vocabulary

interface Node extends ConceptNode {
  children: Node[]
}

export async function ConceptTree(props: {
  payload: Payload
  project: { id: number | string; slug: string }
}) {
  const { payload, project } = props
  const [concepts, uses] = await Promise.all([
    conceptsOf({ payload }, project.slug),
    stories.tagCounts(project.slug),
  ])
  return (
    <>
      {concepts.length === 0 ? (
        <p className="annoudio-empty">{s.none}</p>
      ) : (
        <Tree nodes={tree(concepts)} uses={uses} />
      )}
      <p>
        <Button
          el="link"
          url={`${PATHS.newConcept}?project=${project.id}`}
          buttonStyle="primary"
          size="medium"
        >
          {s.add}
        </Button>
      </p>
      <SkosTools project={project.slug} maxBytes={IMPORT_LIMITS.bytes} />
    </>
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
