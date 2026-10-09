import { media } from '@payload-config'

// The tus endpoint of media uploads (`media.handleUpload`). It reads the request body
// as a stream; Next does not parse the body of a route handler.
const handle = (request: Request) => media.handleUpload(request)

export const POST = handle
export const HEAD = handle
export const PATCH = handle
export const DELETE = handle
export const OPTIONS = handle
