import { afterAll, describe, expect, it, vi } from 'vitest'
import { connectDatabase } from '../server/database'
import { buildServer } from '../server/app'
import { defaultQr, layerBase, newProject } from '../src/model'

const databaseUrl = process.env.TEST_DATABASE_URL
const origin = 'http://127.0.0.1:5173'
const review = 'https://g.page/r/ReviewCanvasIntegration/review'

describe.skipIf(!databaseUrl)('Fastify con PostgreSQL', () => {
  const prisma = connectDatabase(databaseUrl)
  const server = buildServer({ prisma, origin })
  const address = (label: string) => `reviewcanvas-${crypto.randomUUID()}-${label}@example.com`
  const first = address('owner'), second = address('other'), statsAccount = address('stats')
  const password = 'Testing-only-28-layers'
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [first, second, statsAccount] } } })
    await server.close()
    await prisma.$disconnect()
  })

  function register(email: string) {
    return server.inject({ method: 'POST', url: '/api/auth/register', headers: { origin }, payload: { email, password } })
  }
  function cookie(value: Awaited<ReturnType<typeof register>>) {
    return String(value.headers['set-cookie']).split(';')[0]
  }

  it('registra usuarios, protege el ámbito del dueño y persiste revisiones concurrentes', async () => {
    const [owner, other] = await Promise.all([register(first), register(second)])
    expect(owner.statusCode).toBe(201)
    expect(other.statusCode).toBe(201)
    expect(owner.headers['set-cookie']).toContain('HttpOnly')
    expect(owner.headers['set-cookie']).toContain('SameSite=Lax')
    const ownerCookie = cookie(owner), otherCookie = cookie(other)
    const project = newProject([{ ...layerBase('QR', 320, 450, 220, 220), kind: 'qr', style: defaultQr }], 'Casa Bosque')
    project.url = review
    const path = `/api/projects/${project.id}`
    const saved = await server.inject({ method: 'PUT', url: path, headers: { origin, cookie: ownerCookie }, payload: project })
    expect(saved.statusCode).toBe(200)
    expect(saved.json()).toEqual({ updatedAt: project.updatedAt })
    const listed = (await server.inject({ method: 'GET', url: '/api/projects', headers: { cookie: ownerCookie } })).json()
    expect(listed).toMatchObject([{ title: 'Casa Bosque' }])
    expect(listed[0]).not.toHaveProperty('layers')
    expect((await server.inject({ method: 'GET', url: `${path}/revision`, headers: { cookie: ownerCookie } })).json()).toEqual({ updatedAt: project.updatedAt })
    expect((await server.inject({ method: 'GET', url: `${path}/revision`, headers: { cookie: otherCookie } })).statusCode).toBe(404)
    expect((await server.inject({ method: 'GET', url: path, headers: { cookie: otherCookie } })).statusCode).toBe(404)
    expect((await server.inject({ method: 'GET', url: path })).statusCode).toBe(401)
    expect((await server.inject({ method: 'DELETE', url: path, headers: { origin: 'https://example.com', cookie: ownerCookie } })).statusCode).toBe(403)
    const newer = { ...project, title: 'Casa Bosque Plaza', updatedAt: new Date(Date.parse(project.updatedAt) + 2000).toISOString() }
    const [olderResult, newerResult] = await Promise.all([
      server.inject({ method: 'PUT', url: path, headers: { origin, cookie: ownerCookie }, payload: project }),
      server.inject({ method: 'PUT', url: path, headers: { origin, cookie: ownerCookie }, payload: newer }),
    ])
    expect([200, 409]).toContain(olderResult.statusCode)
    expect(newerResult.statusCode).toBe(200)
    expect((await prisma.project.findFirstOrThrow({ where: { id: project.id } })).data).toMatchObject({ title: newer.title })
    expect((await server.inject({ method: 'DELETE', url: path, headers: { origin, cookie: otherCookie } })).statusCode).toBe(404)
    expect((await server.inject({ method: 'POST', url: '/api/auth/logout', headers: { origin, cookie: ownerCookie } }))).toMatchObject({ statusCode: 204 })
    const login = await server.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { email: first, password } })
    expect(login.statusCode).toBe(200)
    expect((await server.inject({ method: 'GET', url: path, headers: { cookie: cookie(login) } })).json().project.title).toBe(newer.title)
  })

  it('redirige un QR dinámico y registra solo agregados por día y dispositivo', async () => {
    const registered = await register(statsAccount)
    expect(registered.statusCode).toBe(201)
    const headers = { origin, cookie: cookie(registered) }
    const mapOnly = await server.inject({ method: 'POST', url: '/api/qr', headers,
      payload: { label: 'Cartel de prueba', target: 'https://maps.app.goo.gl/AbCd1234' } })
    expect(mapOnly.statusCode).toBe(400)
    const created = await server.inject({ method: 'POST', url: '/api/qr', headers, payload: { label: 'Cartel de prueba', target: review } })
    expect(created.statusCode).toBe(201)
    const { id, slug } = created.json()
    const redirected = await server.inject({ method: 'GET', url: `/r/${slug}`, headers: { 'user-agent': 'Mozilla/5.0 Mobile iPhone' } })
    expect(redirected.statusCode).toBe(302)
    expect(redirected.headers.location).toBe(review)
    await server.inject({ method: 'HEAD', url: `/r/${slug}` })
    const summary = await server.inject({ method: 'GET', url: `/api/qr/${id}/stats`, headers })
    expect(summary.json()).toMatchObject({ total: 1, devices: [{ device: 'Móvil', count: 1 }] })
  })
})

describe('entrada de producción', () => {
  const proxy = 'fixture-for-proxy-guard-000000000000'
  const publicUrl = 'https://reviewcanvas.pages.dev'
  it('limita el proxy y CORS al origen de la aplicación', async () => {
    const server = buildServer({ origin: publicUrl, secure: true, proxySecret: proxy })
    try {
      expect((await server.inject('/healthz')).statusCode).toBe(200)
      expect((await server.inject('/api/config')).statusCode).toBe(403)
      expect((await server.inject({ method: 'GET', url: '/api/config', headers: {
        origin: 'https://example.net', 'x-reviewcanvas-proxy-key': proxy,
      } })).statusCode).toBe(403)
      const allowed = await server.inject({ method: 'OPTIONS', url: '/api/projects/123', headers: {
        origin: publicUrl, 'x-reviewcanvas-proxy-key': proxy, 'access-control-request-method': 'PUT',
      } })
      expect(allowed.statusCode).toBe(204)
      expect(allowed.headers['access-control-allow-origin']).toBe(publicUrl)
      expect(allowed.headers['access-control-allow-credentials']).toBe('true')
    } finally { await server.close() }
  })
})

describe.skipIf(!databaseUrl)('imágenes privadas en Supabase Storage', () => {
  const prisma = connectDatabase(databaseUrl)
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWw0AAAAASUVORK5CYII='
  const ownerEmail = `reviewcanvas-image-${crypto.randomUUID()}@example.com`
  const otherEmail = `reviewcanvas-image-${crypto.randomUUID()}@example.com`
  const supabase = vi.fn<typeof fetch>().mockImplementation(async (_target, init) =>
    init?.method === 'POST' ? new Response(null, { status: 200 }) : new Response(Buffer.from(image.split(',')[1], 'base64')))
  const server = buildServer({ prisma, origin, storageFetch: supabase,
    storage: { url: 'https://test-project.supabase.co', key: 'fixture', bucket: 'reviewcanvas-private' } })
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } })
    await server.close()
    await prisma.$disconnect()
  })
  it('deduplica la imagen, autoriza lecturas y guarda referencias en PostgreSQL', async () => {
    const headersFor = async (email: string) => {
      const login = await server.inject({ method: 'POST', url: '/api/auth/register', headers: { origin },
        payload: { email, password: 'Testing-only-28-layers' } })
      expect(login.statusCode).toBe(201)
      return { origin, cookie: String(login.headers['set-cookie']).split(';')[0] }
    }
    const owner = await headersFor(ownerEmail)
    const other = await headersFor(otherEmail)
    const upload = () => server.inject({ method: 'POST', url: '/api/media', headers: owner, payload: { image } })
    const saved = await upload()
    expect(saved.statusCode).toBe(200)
    const ref = saved.json().ref as string
    expect(ref).toMatch(/^asset:[a-f0-9]{64}$/)
    expect((await upload()).json().ref).toBe(ref)
    expect(supabase).toHaveBeenCalledTimes(1)
    const project = newProject([{ ...layerBase('Foto', 320, 450, 100, 100), kind: 'image', source: ref }], 'Mi proyecto')
    expect((await server.inject({ method: 'PUT', url: `/api/projects/${project.id}`, headers: other, payload: project })).statusCode).toBe(400)
    expect((await server.inject({ method: 'PUT', url: `/api/projects/${project.id}`, headers: owner, payload: project })).statusCode).toBe(200)
    const stored = await prisma.project.findFirstOrThrow({ where: { id: project.id } })
    expect(JSON.stringify(stored.data)).toContain(ref)
    expect(JSON.stringify(stored.data)).not.toContain('base64')
    const url = `/api/media/${ref.slice(6)}`
    expect((await server.inject({ url, headers: other })).statusCode).toBe(404)
    const picture = await server.inject({ url, headers: owner })
    expect(picture.statusCode).toBe(200)
    expect(picture.headers['content-type']).toContain('image/png')
    expect(picture.rawPayload.toString('base64')).toBe(image.split(',')[1])
  })
})
