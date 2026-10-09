import { testMailbox } from '@payload-config'

// Test only. Gives the newest mail to `?to=<email>` as JSON, or null. It answers 404
// unless the test mailbox is on (see `testMailbox` in payload.config.ts).
export async function GET(request: Request): Promise<Response> {
  if (!testMailbox) return new Response('Not Found', { status: 404 })
  const to = new URL(request.url).searchParams.get('to') ?? ''
  return Response.json(testMailbox.lastTo(to) ?? null, { headers: { 'Cache-Control': 'no-store' } })
}
