import { existsSync } from 'node:fs'
import { buildServer } from './app'

if (existsSync('.env')) process.loadEnvFile('.env')
const port = Number(process.env.PORT ?? 4174)
const host = process.env.HOST ?? '127.0.0.1'
const origin = new URL(process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173').origin
const production = process.env.NODE_ENV === 'production'
const storageUrl = process.env.SUPABASE_URL
const storageKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const proxySecret = process.env.API_PROXY_SECRET || undefined
if (proxySecret && !origin.startsWith('https:')) throw new Error('APP_ORIGIN debe usar HTTPS con el proxy de Pages.')
if (production && origin.startsWith('https:') && !process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL.')
if (Boolean(storageUrl) !== Boolean(storageKey)) throw new Error('Configura las dos variables de Supabase Storage.')
if (proxySecret && proxySecret.length < 32) throw new Error('API_PROXY_SECRET debe tener al menos 32 caracteres.')
const server = buildServer({
  origin, logger: true, secure: process.env.COOKIE_SECURE === 'true' || (production && origin.startsWith('https:')),
  serve: process.env.SERVE_FRONTEND === 'true', placesKey: process.env.GOOGLE_PLACES_API_KEY, proxySecret,
  storage: storageUrl && storageKey ? { url: storageUrl, key: storageKey, bucket: process.env.SUPABASE_STORAGE_BUCKET || 'reviewcanvas-private' } : undefined,
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void server.close().then(() => process.exit(0)) })
await server.listen({ port, host })
