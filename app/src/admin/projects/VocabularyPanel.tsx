// The Vocabulary tab of a project: its concept tree (vocabulary/ConceptTree.tsx).

import type { UIFieldServerProps } from 'payload'

import { byId } from '@/modules/projects'

import { strings } from '../strings'
import { ConceptTree } from '../vocabulary/ConceptTree'

const s = strings.vocabulary

export async function VocabularyPanel({ id, payload }: UIFieldServerProps) {
  const project = id === undefined ? null : await byId({ payload }, id)
  if (!project) return <p>{s.unsaved}</p>
  return (
    <section className="annoudio-panel" aria-labelledby="annoudio-vocabulary-heading">
      <h2 id="annoudio-vocabulary-heading" className="annoudio-panel__heading">
        {s.heading}
      </h2>
      <p>{s.intro}</p>
      <ConceptTree payload={payload} project={project} />
    </section>
  )
}
