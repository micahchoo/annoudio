import config from '@payload-config'
import { getPayload } from 'payload'

import { handleRecording } from '@/modules/catalogue'

// The recording JSON: GET /embed/v1/recordings/{project}/{id}.json (CONTRACT.md §5.2).
async function handle(
  request: Request,
  context: { params: Promise<{ project: string; file: string }> },
) {
  const { project, file } = await context.params
  const payload = await getPayload({ config })
  return handleRecording(
    { payload, origin: process.env.ANNOUDIO_ORIGIN || '' },
    request,
    project,
    file,
  )
}

export const GET = handle
export const HEAD = handle
