'use server'

// The two choices of the Today checklist. Each one changes the signed-in operator only.

import { redirect } from 'next/navigation'

import { requestOperator } from './operator'

async function setOwn(data: { snippetPasted?: boolean; checklistHidden?: boolean }) {
  const session = await requestOperator()
  if (!session) redirect('/admin/login')
  await session.payload.update({
    collection: 'users',
    id: session.operator.operatorId,
    data,
    depth: 0,
  })
  redirect('/admin')
}

/** Step 3: "I pasted it". */
export async function markSnippetPasted(): Promise<void> {
  await setOwn({ snippetPasted: true })
}

/** "Hide the list". */
export async function hideChecklist(): Promise<void> {
  await setOwn({ checklistHidden: true })
}
