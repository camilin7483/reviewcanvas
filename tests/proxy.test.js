import { afterEach, expect, it, vi } from 'vitest'
import { onRequest } from '../functions/proxy.js'

afterEach(() => vi.unstubAllGlobals())

it('conserva la cookie del mismo origen y la redirección sin usar caché', async () => {
  const origin = 'https://reviewcanvas-api.onrender.com'
  const upstream = vi.fn(async () => new Response(null, {
    status: 302,
    headers: { Location: 'https://g.page/r/ReviewCanvasDemo/review', 'Set-Cookie': 'rc_session=test; HttpOnly; Secure; SameSite=Lax' },
  }))
  vi.stubGlobal('fetch', upstream)
  const result = await onRequest({
    request: new Request('https://reviewcanvas.pages.dev/r/demo', { headers: {
      cookie: 'rc_session=current', 'cf-connecting-ip': '192.0.2.42', 'x-reviewcanvas-proxy-key': 'supplied-by-visitor',
    } }),
    env: { API_ORIGIN: origin, API_PROXY_SECRET: 'secret-from-environment' },
  })
  const [url, options] = upstream.mock.calls[0]
  expect(url.href).toBe(origin + '/r/demo')
  expect(options.redirect).toBe('manual')
  expect(options.headers.get('cookie')).toBe('rc_session=current')
  expect(options.headers.get('x-reviewcanvas-proxy-key')).toBe('secret-from-environment')
  expect(options.headers.get('x-reviewcanvas-client-ip')).toBe('192.0.2.42')
  expect(result.status).toBe(302)
  expect(result.headers.get('cache-control')).toBe('no-store')
  expect(result.headers.get('set-cookie')).toContain('Secure')
})
