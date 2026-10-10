// How many stories use a concept, on the concept page (walkthrough 26).

import { stories } from '@payload-config'
import type { UIFieldServerProps } from 'payload'

import { byId } from '@/modules/projects'

import { strings } from '../strings'

const s = strings.concept

export async function ConceptUsage({ data, payload }: UIFieldServerProps) {
  const projectId = typeof data?.project === 'object' ? data.project?.id : data?.project
  const project = data?.iri && projectId ? await byId({ payload }, projectId) : null
  const uses = project ? ((await stories.valueCounts(project.slug)).get(data.iri) ?? 0) : null
  return (
    <div className="field-type annoudio-usage">
      <p className="field-label">{s.usage}</p>
      <p>{uses === null ? s.unsaved : s.uses(uses)}</p>
    </div>
  )
}
