// "← Back to Places" on the item form: the way back to the page of its list. After "Add an
// item" and Save, the operator returns to the list in one step (recordings audit, 04). The
// list comes from the form (a new item has it from `?list=`) or from the saved item.

import type { UIFieldServerProps } from 'payload'

import { byId } from '@/modules/projects'

import { PATHS } from '../paths'
import { strings } from '../strings'

const idOf = (value: unknown): number | string | null =>
  typeof value === 'number' || typeof value === 'string'
    ? value
    : typeof value === 'object' && value !== null && 'id' in value
      ? (value as { id: number | string }).id
      : null

export async function ConceptBack({ data, formState, payload }: UIFieldServerProps) {
  const listId = idOf(formState?.list?.value) ?? idOf(data?.list)
  if (listId === null || listId === '') return null
  const list = await payload.findByID({
    collection: 'vocab-lists',
    id: listId,
    depth: 0,
    disableErrors: true,
  })
  const project = list ? await byId({ payload }, idOf(list.project) ?? '') : null
  if (!list || !project) return null
  const href = `${PATHS.concepts}/${project.slug}?list=${encodeURIComponent(list.key)}`
  return (
    <p className="ao annoudio-back">
      <a href={href}>
        <span aria-hidden="true">← </span>
        {strings.lists.backTo(list.label)}
      </a>
    </p>
  )
}
