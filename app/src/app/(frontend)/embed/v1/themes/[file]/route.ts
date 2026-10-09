import config from '@payload-config'
import { getPayload } from 'payload'

import { handleTheme } from '@/modules/projects'

// The project theme JSON: GET /embed/v1/themes/{project}.json (CONTRACT.md §3.2, §5.1).
async function handle(request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params
  return handleTheme({ payload: await getPayload({ config }) }, request, file)
}

export const GET = handle
export const HEAD = handle
