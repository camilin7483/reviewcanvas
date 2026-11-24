// Las rutas estáticas nunca pasan por esta función.
export async function onRequest({ request, env }) {
  const input = new URL(request.url)
  const offline = () => Response.json({ error: 'La nube está temporalmente fuera de servicio. El editor trabaja con tus datos locales.' }, {
    status: 503, headers: { 'Cache-Control': 'no-store' },
  })
  if (!env.API_ORIGIN || !env.API_PROXY_SECRET) return offline()
  try {
    const upstream = new URL(env.API_ORIGIN)
    if (upstream.protocol !== 'https:' || upstream.username || upstream.password) return offline()
    upstream.pathname = input.pathname
    upstream.search = input.search
    const headers = new Headers()
    for (const name of ['accept', 'content-type', 'cookie', 'origin', 'user-agent', 'purpose']) {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    }
    headers.set('x-reviewcanvas-proxy-key', env.API_PROXY_SECRET)
    const ip = request.headers.get('cf-connecting-ip')
    if (ip) headers.set('x-reviewcanvas-client-ip', ip)
    const response = await fetch(upstream, {
      method: request.method, headers, redirect: 'manual',
      body: /^(GET|HEAD)$/i.test(request.method) ? undefined : request.body,
      cache: 'no-store',
    })
    const outgoing = new Headers(response.headers)
    outgoing.set('Cache-Control', 'no-store')
    return new Response(response.body, { status: response.status, headers: outgoing })
  } catch { return offline() }
}
