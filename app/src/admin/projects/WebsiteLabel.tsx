'use client'

// The row label of a website on the project form: its address, so that folded rows stay one
// line each and "Add Website" stays near (recordings audit, 19). An empty row says "New website".

import { useRowLabel } from '@payloadcms/ui'

import { strings } from '../strings'

export function WebsiteLabel() {
  const { data } = useRowLabel<{ origin?: string }>()
  const origin = typeof data?.origin === 'string' ? data.origin.trim() : ''
  return <span>{origin || strings.project.newWebsite}</span>
}
