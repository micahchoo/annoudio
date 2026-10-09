import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload, type Payload, type TypedUser } from 'payload'

import type { OperatorSession } from '@/modules/stories'

/** The operator session of a Payload user, or null for anybody else. */
export function operatorOf(user: TypedUser | null | undefined): OperatorSession | null {
  if (user?.collection !== 'users') return null
  const name = typeof user.name === 'string' && user.name.trim() ? user.name.trim() : user.email
  return { operatorId: String(user.id), name }
}

/**
 * The signed-in operator of this request, for a Server Action. A Server Action is a
 * public POST endpoint: each one calls this first.
 */
export async function requestOperator(): Promise<{
  payload: Payload
  operator: OperatorSession
} | null> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  const operator = operatorOf(user)
  return operator ? { payload, operator } : null
}
