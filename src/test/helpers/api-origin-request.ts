/**
 * Construiește un `Request` care trece `validateSameOriginMutation`:
 * URL cu origin + header `Origin` aliniat.
 */
export function createSameOriginRequest(
  pathname: string,
  init: RequestInit & { json?: unknown } = {},
): Request {
  const origin = 'http://localhost:3000'
  const url = `${origin}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
  const { json, body, headers: hdrs, ...rest } = init
  const headers = new Headers(hdrs)
  if (!headers.has('Origin')) {
    headers.set('Origin', origin)
  }
  if (json !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const bodyInit = json !== undefined ? JSON.stringify(json) : body
  return new Request(url, {
    ...rest,
    headers,
    body: bodyInit as BodyInit | null | undefined,
  })
}
