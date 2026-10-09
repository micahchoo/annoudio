import { media } from '@payload-config'

// The derived file of a ready media body (`media.handleFile`). Any origin can read it.
const handle = (request: Request) => media.handleFile(request)

export const GET = handle
export const HEAD = handle
