import config, { stories, vocabulary } from '@payload-config'
import type { Quad } from 'n3'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { operatorOf } from '@/admin/operator'
import { writeQuads, type RdfOutput } from '@/modules/vocabulary'

// The linked data of a project (design/vocab.md §3.4, §9.3): GET /admin/export/{project}.ttl,
// .trig or .jsonld. Operators only. Layers 1 and 2 come from `stories.exportQuads`
// (published stories only), layer 3 from `vocabulary.describe`. Turtle merges the named
// graphs into the default graph; TriG keeps one graph per story.

const FILE = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(ttl|trig|jsonld)$/
const FORMATS: Record<string, { format: RdfOutput; type: string }> = {
  ttl: { format: 'turtle', type: 'text/turtle; charset=utf-8' },
  trig: { format: 'trig', type: 'application/trig; charset=utf-8' },
  jsonld: { format: 'jsonld', type: 'application/ld+json' },
}

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  const operator = operatorOf(user)
  if (!operator) return new Response('Sign in as an operator.', { status: 403 })
  const match = FILE.exec(file)
  if (!match) return new Response('Not found.', { status: 404 })
  const [, project, extension] = match
  if (!(await vocabulary.profile(project))) return new Response('Not found.', { status: 404 })
  const quads: Quad[] = []
  for await (const quad of stories.exportQuads(operator, { project })) quads.push(quad)
  quads.push(...(await vocabulary.describe(project)))
  const { format, type } = FORMATS[extension]
  return new Response(writeQuads(quads, format), {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${project}.${extension}"`,
      'Cache-Control': 'no-store',
    },
  })
}
