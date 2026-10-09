// The IP address of a request, for the per-IP limit of login codes.
//
// Next 16 gives a Server Action no socket address. It copies the socket address into
// `x-forwarded-for` only when the request has no such header. A proxy (Traefik, Caddy,
// nginx) adds the address of its client as the last value. So the trusted value is the
// last value that a proxy of this stack added: `proxies` from the right. The first value
// is never trusted: a client can send its own `x-forwarded-for`, and a proxy that appends
// keeps it in front.
//
// `proxies` is TRUST_PROXY: the number of proxies in front of the app. 0 and 1 both read
// the last value. With 0 (no proxy), a client that sends the header chooses the value;
// the per-stack limit still holds.

const MAX_LENGTH = 64

/** The client IP address, or undefined if the request has none. */
export function requestIp(headers: Headers, proxies: number): string | undefined {
  const values = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '')
  const hops = Number.isInteger(proxies) && proxies > 1 ? proxies : 1
  const value = values[values.length - hops]
  return value && value.length <= MAX_LENGTH ? value : undefined
}
