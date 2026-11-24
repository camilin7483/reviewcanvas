import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { timingSafeEqual, randomBytes } from 'node:crypto'
import { isIP } from 'node:net'
import { Readable } from 'node:stream'
import Fastify, { LogController, type FastifyReply, type FastifyRequest } from 'fastify'
import cookies from '@fastify/cookie'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import staticFiles from '@fastify/static'
import { Prisma, type PrismaClient } from './generated/prisma/client'
import { connectDatabase } from './database'
import { z } from 'zod'
import { assetDigest, mapBrandMedia, mapProjectMedia } from '../src/media'
import { brandSchema, reviewLink, validateProject } from '../src/model'
import { dummyPasswordHash, hashPassword, makeToken, matchesPassword, sessionDuration, tokenHash } from './security'
import { validBrand, validProjectAssets } from './validation'

import { createMediaStorage, MediaError, type StorageOptions } from './mediaStorage'
import { resolveReviewSection } from './reviewDestination'

const sessionCookie = 'rc_session'
const uuid = z.string().uuid()
const credentials = z.object({
  email: z.email().trim().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
})
const apiError = (reply: FastifyReply, status: number, error: string) => reply.code(status).send({ error })
const publicAccount = (user: { id: string; email: string }) => ({ id: user.id, email: user.email })
const json = (value: unknown) => value as Prisma.InputJsonValue

export function buildServer(options: { prisma?: PrismaClient; logger?: boolean; origin: string; secure?: boolean; serve?: boolean; placesKey?: string; proxySecret?: string; storage?: StorageOptions; storageFetch?: typeof fetch }) {
  const prisma = options.prisma ?? connectDatabase()
  const media = createMediaStorage(prisma, options.storage, options.storageFetch)
  const proxyKey = options.proxySecret && Buffer.from(options.proxySecret)
  function throughProxy(request: FastifyRequest) {
    const supplied = request.headers['x-reviewcanvas-proxy-key']
    if (!proxyKey || typeof supplied !== 'string') return false
    const value = Buffer.from(supplied)
    return value.length === proxyKey.length && timingSafeEqual(value, proxyKey)
  }
  const app = Fastify({
    logger: options.logger && {
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
    },
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 3 * 1024 * 1024,
  })
  const cookieOptions = { httpOnly: true, secure: options.secure ?? false, sameSite: 'lax' as const, path: '/', maxAge: sessionDuration }
  app.register(cookies)
  app.register(rateLimit, { max: 200, timeWindow: '1 minute', keyGenerator: (request) => {
    const ip = request.headers['x-reviewcanvas-client-ip']
    return throughProxy(request) && typeof ip === 'string' && isIP(ip) ? ip : request.ip
  } })
  app.register(helmet, { contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'], fontSrc: ["'self'", 'data:'], connectSrc: ["'self'"],
      objectSrc: ["'none'"], frameAncestors: ["'none'"], workerSrc: ["'self'", 'blob:'],
      upgradeInsecureRequests: options.secure ? [] : null,
    },
  }, hsts: options.secure ?? false })
  app.addHook('onClose', async () => { if (!options.prisma) await prisma.$disconnect() })
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin
    if (request.url.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store')
      reply.header('Vary', 'Origin')
      if (origin && origin !== options.origin) return apiError(reply, 403, 'Origen no permitido.')
      if (origin === options.origin) {
        reply.header('Access-Control-Allow-Origin', origin)
        reply.header('Access-Control-Allow-Credentials', 'true')
      }
      if (request.method === 'OPTIONS') {
        if (!origin || proxyKey && !throughProxy(request)) return apiError(reply, 403, 'Origen no permitido.')
        return reply.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS')
          .header('Access-Control-Allow-Headers', 'Content-Type').header('Access-Control-Max-Age', '600').code(204).send()
      }
      if (proxyKey && !throughProxy(request)) return apiError(reply, 403, 'Abre ReviewCanvas para acceder a la API.')
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && origin !== options.origin) return apiError(reply, 403, 'Confirma el origen de la solicitud.')
    }
  })
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof MediaError) return apiError(reply, error.statusCode, error.message)
    const status = typeof (error as { statusCode?: unknown }).statusCode === 'number' ? (error as { statusCode: number }).statusCode : 500
    if (status >= 500) request.log.error({ message: (error as Error).message, requestId: request.id }, 'Error en la solicitud')
    return apiError(reply, status >= 400 && status < 500 ? status : 500, ({
      413: 'El archivo supera el límite del servidor.', 429: 'Demasiadas solicitudes. Inténtalo más tarde.', 400: 'Solicitud inválida.',
    } as Record<number, string>)[status] ?? 'No se pudo completar la solicitud.')
  })

  async function account(request: FastifyRequest) {
    const secret = request.cookies[sessionCookie]
    if (!secret || !/^[\w-]{43}$/.test(secret)) return null
    const session = await prisma.session.findUnique({ where: { id: tokenHash(secret) }, include: { owner: { select: { id: true, email: true } } } })
    return session && session.expiresAt.getTime() > Date.now() ? session.owner : null
  }
  async function owner(request: FastifyRequest, reply: FastifyReply) {
    const user = await account(request)
    if (!user) apiError(reply, 401, 'Inicia sesión para continuar.')
    return user
  }
  async function newSession(user: { id: string; email: string }, request: FastifyRequest, reply: FastifyReply) {
    const secret = makeToken()
    const prior = request.cookies[sessionCookie]
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { OR: [
        { expiresAt: { lte: new Date() } }, ...(prior ? [{ id: tokenHash(prior) }] : []),
      ] } }),
      prisma.session.create({ data: { id: tokenHash(secret), ownerId: user.id, expiresAt: new Date(Date.now() + sessionDuration * 1000) } }),
    ])
    reply.setCookie(sessionCookie, secret, cookieOptions)
    return { account: publicAccount(user) }
  }

  app.options('/api/*', async (_request, reply) => reply.code(204).send())
  app.get('/healthz', async () => ({ ok: true }))
  app.get('/api/config', async () => ({ places: Boolean(options.placesKey) }))
  app.get('/api/health', async () => { await prisma.$queryRaw`SELECT 1`; return { ok: true } })
  app.get('/api/auth/me', async (request) => ({ account: await account(request) }))
  const authLimit = { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }
  app.post('/api/auth/register', authLimit, async (request, reply) => {
    const parsed = credentials.safeParse(request.body)
    if (!parsed.success) return apiError(reply, 400, 'Usa un correo válido y una contraseña de entre 10 y 128 caracteres.')
    const { email, password } = parsed.data
    const passwordHash = await hashPassword(password)
    try {
      const user = await prisma.user.create({ data: { email, passwordHash } })
      reply.code(201)
      return await newSession(user, request, reply)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return apiError(reply, 409, 'El correo ya está registrado.')
      throw error
    }
  })
  app.post('/api/auth/login', authLimit, async (request, reply) => {
    const parsed = credentials.safeParse(request.body)
    if (!parsed.success) return apiError(reply, 400, 'Introduce tus datos de acceso.')
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    const valid = await matchesPassword(parsed.data.password, user?.passwordHash ?? dummyPasswordHash)
    if (!valid || !user) return apiError(reply, 401, 'El correo o la contraseña no coinciden.')
    return newSession(user, request, reply)
  })
  app.post('/api/auth/logout', async (request, reply) => {
    const secret = request.cookies[sessionCookie]
    if (secret) await prisma.session.deleteMany({ where: { id: tokenHash(secret) } })
    return reply.clearCookie(sessionCookie, { path: '/', secure: options.secure ?? false }).code(204).send()
  })

  app.post('/api/media', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const user = await owner(request, reply)
    if (!user) return
    const upload = z.object({ image: z.string().max(2_800_000) }).safeParse(request.body)
    if (!upload.success) return apiError(reply, 400, 'Imagen inválida.')
    return { ref: await media.put(user.id, upload.data.image) }
  })

  app.get<{ Params: { digest: string } }>('/api/media/:digest', async (request, reply) => {
    const user = await owner(request, reply)
    if (!user) return
    if (!/^[a-f0-9]{64}$/.test(request.params.digest)) return apiError(reply, 404, 'Imagen no encontrada.')
    const image = await media.get(user.id, request.params.digest)
    return reply.type(image.mime).send(Readable.fromWeb(image.stream as never))
  })

  async function storedImages<T>(ownerId: string, document: T, mapper: (value: T, convert: (image: string) => Promise<string>) => Promise<T>) {
    const refs: string[] = []
    const packed = await mapper(document, async (image) => {
      const ref = assetDigest(image) ? image : media.enabled ? await media.put(ownerId, image) : image
      if (assetDigest(ref)) refs.push(ref)
      return ref
    })
    await media.verify(ownerId, refs)
    if (Buffer.byteLength(JSON.stringify(packed)) > 750_000) {
      throw new MediaError(413, 'El diseño supera el límite de sincronización. Tu copia local está disponible.')
    }
    return packed
  }

  app.get('/api/projects', async (request, reply) => {
    const user = await owner(request, reply)
    if (!user) return
    return prisma.$queryRaw`
      SELECT id, "updatedAt", data->>'title' AS title, data->>'business' AS business, data->>'folder' AS folder,
        (data->>'favorite')::boolean AS favorite, data->'layers'->0->>'fill' AS paper
      FROM "Project" WHERE "ownerId" = ${user.id}::uuid
      ORDER BY "updatedAt" DESC LIMIT 100`
  })
  app.get<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const user = await owner(request, reply)
    if (!user) return
    const id = uuid.safeParse(request.params.id)
    if (!id.success) return apiError(reply, 400, 'Identificador inválido.')
    const project = await prisma.project.findUnique({ where: { ownerId_id: { ownerId: user.id, id: id.data } } })
    if (!project) return apiError(reply, 404, 'Proyecto no encontrado.')
    return { project: project.data, updatedAt: project.updatedAt }
  })
  app.put<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const user = await owner(request, reply)
    if (!user) return
    const project = validateProject(request.body, false, true)
    if (!project || project.id !== request.params.id || !validProjectAssets(project)
      || Date.parse(project.updatedAt) > Date.now() + 300_000) return apiError(reply, 400, 'El proyecto contiene datos o archivos inválidos.')
    const packed = await storedImages(user.id, project, mapProjectMedia)
    const updatedAt = new Date(project.updatedAt)
    const current = await prisma.$transaction(async (tx) => {
      const key = { ownerId_id: { ownerId: user.id, id: project.id } }
      const existing = await tx.project.findUnique({ where: key, select: { updatedAt: true } })
      if (!existing) {
        if (await tx.project.count({ where: { ownerId: user.id } }) >= 100) throw new MediaError(409, 'Tu cuenta alcanzó el límite de 100 proyectos.')
        await tx.project.createMany({ data: [{ id: project.id, ownerId: user.id, data: json(packed), updatedAt }], skipDuplicates: true })
      }
      await tx.project.updateMany({ where: { id: project.id, ownerId: user.id, updatedAt: { lt: updatedAt } }, data: { data: json(packed), updatedAt } })
      return tx.project.findUniqueOrThrow({ where: key, select: { updatedAt: true } })
    })
    if (current.updatedAt > updatedAt) return apiError(reply, 409, 'Existe una versión más reciente en la nube.')
    return { updatedAt: current.updatedAt }
  })
  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const user = await owner(request, reply)
    if (!user) return
    const id = uuid.safeParse(request.params.id)
    if (!id.success) return apiError(reply, 400, 'Identificador inválido.')
    const result = await prisma.project.deleteMany({ where: { ownerId: user.id, id: id.data } })
    return result.count ? reply.code(204).send() : apiError(reply, 404, 'Proyecto no encontrado.')
  })

  app.get('/api/brands', async (request, reply) => {
    const user = await owner(request, reply)
    if (!user) return
    return (await prisma.brand.findMany({ where: { ownerId: user.id }, take: 20 })).map((brand) => brand.data)
  })
  app.put<{ Params: { id: string } }>('/api/brands/:id', async (request, reply) => {
    const user = await owner(request, reply)
    if (!user) return
    const brand = brandSchema.safeParse(request.body)
    if (!brand.success || brand.data.id !== request.params.id || !validBrand(brand.data)
      || (brand.data.url && !reviewLink(brand.data.url))) return apiError(reply, 400, 'La marca contiene datos o archivos inválidos.')
    const id = brand.data.id
    const key = { ownerId_id: { ownerId: user.id, id } }
    if (!await prisma.brand.findUnique({ where: key, select: { id: true } }) && await prisma.brand.count({ where: { ownerId: user.id } }) >= 20) {
      return apiError(reply, 409, 'Tu cuenta alcanzó el límite de 20 marcas.')
    }
    const data = json(await storedImages(user.id, brand.data, mapBrandMedia))
    await prisma.brand.upsert({ where: { ownerId_id: { ownerId: user.id, id } }, create: { ownerId: user.id, id, data }, update: { data } })
    return reply.code(204).send()
  })
  app.delete<{ Params: { id: string } }>('/api/brands/:id', async (request, reply) => {
    const user = await owner(request, reply)
    if (!user) return
    const id = uuid.safeParse(request.params.id)
    if (!id.success) return apiError(reply, 400, 'Identificador inválido.')
    const result = await prisma.brand.deleteMany({ where: { ownerId: user.id, id: id.data } })
    return result.count ? reply.code(204).send() : apiError(reply, 404, 'Marca no encontrada.')
  })

  app.get<{ Querystring: { input?: string } }>('/api/places/reviews', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (request, reply) => {
    const input = z.string().trim().min(1).max(1200).safeParse(request.query.input)
    if (!input.success) return apiError(reply, 400, 'Introduce un enlace de Google Maps o un Place ID.')
    const result = await resolveReviewSection(input.data, options.placesKey)
    if (result.status === 'resolved') return { url: result.url }
    if (result.status === 'needs-key') return apiError(reply, 422, 'Para resolver ese Place ID se necesita Google Places. Puedes pegar el enlace largo de Google Maps del negocio.')
    if (result.status === 'upstream') return apiError(reply, 502, 'Google no respondió al consultar el enlace. Pega el enlace largo del negocio o inténtalo de nuevo.')
    return apiError(reply, 422, 'No encontré la sección de reseñas de ese negocio. Abre su ficha en Maps y copia el enlace completo del navegador.')
  })

  app.get<{ Querystring: { q?: string } }>('/api/places', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!options.placesKey) return apiError(reply, 404, 'Google Places no está configurado.')
    const query = z.string().trim().min(3).max(120).safeParse(request.query.q)
    if (!query.success) return apiError(reply, 400, 'Introduce un nombre de establecimiento válido.')
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST', signal: AbortSignal.timeout(6000),
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': options.placesKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress' },
      body: JSON.stringify({ textQuery: query.data, languageCode: 'es', pageSize: 6 }),
    })
    if (!response.ok) return apiError(reply, 502, 'Google Places no pudo completar la búsqueda.')
    const data = await response.json() as { places?: { id: string; displayName: { text: string }; formattedAddress: string }[] }
    return (data.places ?? []).map((place) => ({ id: place.id, name: place.displayName.text, address: place.formattedAddress }))
  })

  app.get('/api/qr', async (request, reply) => {
    const user = await owner(request, reply)
    if (!user) return
    const [codes, counts] = await prisma.$transaction([
      prisma.dynamicCode.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.scanBucket.groupBy({ by: ['codeId'], orderBy: { codeId: 'asc' }, where: { code: { ownerId: user.id } }, _sum: { count: true } }),
    ])
    const totals = new Map(counts.map((item) => [item.codeId, item._sum?.count ?? 0]))
    return codes.map(({ ownerId: _, ...code }) => ({ ...code, scans: totals.get(code.id) ?? 0 }))
  })
  app.post('/api/qr', authLimit, async (request, reply) => {
    const user = await owner(request, reply)
    if (!user) return
    const parsed = z.object({ label: z.string().trim().min(1).max(100), target: z.string().max(1200).transform(reviewLink) }).safeParse(request.body)
    if (!parsed.success || !parsed.data.target) return apiError(reply, 400, 'Introduce un nombre y un destino de reseñas válido.')
    const code = await prisma.dynamicCode.create({ data: { ownerId: user.id, slug: randomBytes(9).toString('base64url'), ...parsed.data } })
    const { ownerId: _, ...publicCode } = code
    return reply.code(201).send({ ...publicCode, scans: 0 })
  })
  app.get<{ Params: { id: string } }>('/api/qr/:id/stats', async (request, reply) => {
    const user = await owner(request, reply)
    if (!user) return
    const id = uuid.safeParse(request.params.id)
    if (!id.success) return apiError(reply, 400, 'Identificador inválido.')
    const code = await prisma.dynamicCode.findFirst({ where: { id: id.data, ownerId: user.id }, select: { id: true } })
    if (!code) return apiError(reply, 404, 'QR no encontrado.')
    const [byDay, byDevice] = await prisma.$transaction([
      prisma.scanBucket.groupBy({ by: ['day'], where: { codeId: code.id }, orderBy: { day: 'asc' }, _sum: { count: true } }),
      prisma.scanBucket.groupBy({ by: ['device'], where: { codeId: code.id }, orderBy: { device: 'asc' }, _sum: { count: true } }),
    ])
    return { total: byDay.reduce((total, item) => total + (item._sum?.count ?? 0), 0),
      dates: byDay.map(({ day, _sum }) => ({ date: day.toISOString().slice(0, 10), count: _sum?.count ?? 0 })),
      devices: byDevice.map(({ device, _sum }) => ({ device, count: _sum?.count ?? 0 })),
    }
  })
  app.get<{ Params: { slug: string } }>('/r/:slug', async (request, reply) => {
    if (proxyKey && !throughProxy(request)) return apiError(reply, 404, 'QR no encontrado.')
    if (!/^[\w-]{12}$/.test(request.params.slug)) return apiError(reply, 404, 'QR no encontrado.')
    const code = await prisma.dynamicCode.findUnique({ where: { slug: request.params.slug } })
    if (!code) return apiError(reply, 404, 'QR no encontrado.')
    const target = reviewLink(code.target)
    if (!target) return apiError(reply, 409, 'Este código requiere un enlace directo de reseñas.')
    const agent = request.headers['user-agent'] ?? ''
    if (request.method === 'GET' && !/bot|crawler|spider|prefetch/i.test(agent) && request.headers.purpose !== 'prefetch') {
      const device = /ipad|tablet/i.test(agent) ? 'Tableta' : /mobile|android|iphone/i.test(agent) ? 'Móvil' : agent ? 'Escritorio' : 'Sin identificar'
      const day = new Date(new Date().toISOString().slice(0, 10))
      const key = { codeId: code.id, device, day }
      try { await prisma.scanBucket.upsert({ where: { codeId_day_device: key }, create: { ...key, count: 1 }, update: { count: { increment: 1 } } }) }
      catch (error) { request.log.warn({ message: (error as Error).message }, 'No se pudo agregar el escaneo') }
    }
    return reply.header('Cache-Control', 'no-store').redirect(target, 302)
  })

  const assets = resolve('dist')
  if (options.serve && existsSync(resolve(assets, 'index.html'))) {
    app.register(staticFiles, { root: assets, index: false, maxAge: '1h' })
    app.get('/', async (_request, reply) => reply.sendFile('index.html', { maxAge: 0 }))
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && /^(?:\/|\/editor(?:\/[\w-]+)?|\/proyectos)(?:\?.*)?$/.test(request.url)) {
        return reply.sendFile('index.html', { maxAge: 0 })
      }
      return apiError(reply, 404, 'Página no encontrada.')
    })
  }
  return app
}
