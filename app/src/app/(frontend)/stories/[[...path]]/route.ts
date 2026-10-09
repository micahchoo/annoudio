import { stories } from '@payload-config'

// The Web Annotation Protocol read routes. `handleRead` answers every method:
// GET, HEAD and OPTIONS are the protocol; other methods get 405 with the CORS headers.
const handle = (request: Request) => stories.handleRead(request)

export const GET = handle
export const HEAD = handle
export const OPTIONS = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
