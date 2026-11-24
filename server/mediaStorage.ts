import { createHash } from 'node:crypto'
import type { PrismaClient } from './generated/prisma/client'
import { assetDigest } from '../src/media'
import { rasterData } from '../src/model'
import { validRaster } from './validation'

const maxImage = 2_000_000
const ownerLimit = 24 * 1024 * 1024
const storageLimit = 700 * 1024 * 1024

export class MediaError extends Error {
  constructor(public statusCode: number, message: string) { super(message) }
}

export type StorageOptions = { url: string; key: string; bucket: string }

export function createMediaStorage(db: PrismaClient, config?: StorageOptions, fetcher = fetch) {
  const base = config ? new URL(config.url) : null
  if (base && (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash
    || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(config!.bucket))) throw new Error('Configuración de Supabase Storage inválida.')

  async function lookup(ownerId: string, digest: string) {
    return db.mediaObject.findUnique({ where: { ownerId_digest: { ownerId, digest } } })
  }

  function objectUrl(ownerId: string, digest: string, reading: boolean) {
    return new URL(`/storage/v1/object/${reading ? 'authenticated/' : ''}${config!.bucket}/${ownerId}/${digest}`, base!)
  }

  const auth = (): Record<string, string> => config!.key.startsWith('sb_secret_')
    ? { apikey: config!.key } : { apikey: config!.key, Authorization: `Bearer ${config!.key}` }

  async function put(ownerId: string, source: string) {
    if (!config) throw new MediaError(503, 'El almacenamiento remoto de imágenes no está disponible.')
    if (!rasterData.safeParse(source).success || !validRaster(source)) throw new MediaError(400, 'La imagen debe ser PNG, JPG o WebP.')
    const split = source.indexOf(',')
    const mime = source.substring(5, source.indexOf(';'))
    const bytes = Buffer.from(source.slice(split + 1), 'base64')
    if (!bytes.length || bytes.length > maxImage) throw new MediaError(413, 'La imagen supera el límite de 2 MB.')
    const digest = createHash('sha256').update(bytes).digest('hex')
    const existing = await lookup(ownerId, digest)
    if (existing?.uploadedAt) return `asset:${digest}`
    await db.$transaction(async (tx) => {
      // Reserva la cuota antes de cargar el objeto y serializa solo las altas de metadatos.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(472021340)`
      if (await tx.mediaObject.findUnique({ where: { ownerId_digest: { ownerId, digest } } })) return
      const ownerBytes = await tx.mediaObject.aggregate({ where: { ownerId }, _sum: { bytes: true } })
      const globalBytes = await tx.mediaObject.aggregate({ _sum: { bytes: true } })
      if ((ownerBytes._sum.bytes ?? 0) + bytes.length > ownerLimit || (globalBytes._sum.bytes ?? 0) + bytes.length > storageLimit) {
        throw new MediaError(409, 'Se alcanzó la cuota de imágenes en la nube. Tu diseño sigue guardado en este navegador.')
      }
      await tx.mediaObject.create({ data: { ownerId, digest, mime, bytes: bytes.length } })
    })
    const upload = await fetcher(objectUrl(ownerId, digest, false), {
      method: 'POST', headers: { ...auth(), 'Content-Type': mime, 'x-upsert': 'true' },
      body: new Uint8Array(bytes), redirect: 'error', signal: AbortSignal.timeout(20_000),
    })
    if (upload.body) await upload.body.cancel()
    if (!upload.ok) throw new MediaError(502, 'Supabase no pudo guardar la imagen.')
    await db.mediaObject.update({ where: { ownerId_digest: { ownerId, digest } }, data: { uploadedAt: new Date() } })
    return `asset:${digest}`
  }

  async function verify(ownerId: string, values: Iterable<string>) {
    const ids = [...new Set([...values].map(assetDigest).filter((value): value is string => Boolean(value)))]
    if (!ids.length) return
    if (!config) throw new MediaError(503, 'El almacenamiento remoto de imágenes no está disponible.')
    const count = await db.mediaObject.count({ where: { ownerId, digest: { in: ids }, uploadedAt: { not: null } } })
    if (count !== ids.length) throw new MediaError(400, 'El diseño contiene una imagen que no pertenece a tu cuenta.')
  }

  async function get(ownerId: string, digest: string) {
    if (!config) throw new MediaError(404, 'Imagen no encontrada.')
    const entry = await lookup(ownerId, digest)
    if (!entry?.uploadedAt) throw new MediaError(404, 'Imagen no encontrada.')
    const response = await fetcher(objectUrl(ownerId, digest, true), {
      headers: auth(), redirect: 'error', signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok || !response.body) {
      if (response.body) await response.body.cancel()
      throw new MediaError(502, 'No se pudo recuperar la imagen desde Supabase.')
    }
    return { mime: entry.mime, stream: response.body }
  }

  return { enabled: Boolean(config), put, verify, get }
}
