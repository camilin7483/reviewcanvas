import type { Brand, Project } from './model'
import { assetDigest, mapBrandMedia, mapProjectMedia } from './media'

export type Account = { id: string; email: string }
export type ProjectSummary = Pick<Project, 'id' | 'title' | 'business' | 'folder' | 'favorite' | 'updatedAt'> & { paper?: string | null }
type CloudProject = { project: Project; updatedAt: string }
export type DynamicCode = { id: string; slug: string; label: string; target: string; createdAt: string; scans: number }
export type ScanSummary = { total: number; dates: { date: string; count: number }[]; devices: { device: string; count: number }[] }

const sessionKey = 'rc-last-account'
const mediaCache = new Map<string, Promise<string>>()
const savedMedia = new Map<string, Promise<string>>()

// Se usa para decidir si conviene consultar la nube. La API autentica mediante cookie.
export function accountHint(): Account | null {
  try { return JSON.parse(localStorage.getItem(sessionKey) ?? 'null') as Account | null } catch { return null }
}

function remember(account: Account | null) {
  if (accountHint()?.id !== account?.id) { mediaCache.clear(); savedMedia.clear() }
  try {
    if (account) localStorage.setItem(sessionKey, JSON.stringify(account))
    else localStorage.removeItem(sessionKey)
  } catch { /* La sesión HTTP funciona aunque el almacenamiento esté restringido. */ }
}

async function request<T>(path: string, options?: { method?: string; value?: unknown; signal?: AbortSignal }): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options?.method ?? 'GET', credentials: 'same-origin', signal: options?.signal ?? AbortSignal.timeout(60_000),
    headers: options?.value === undefined ? {} : { 'Content-Type': 'application/json' },
    body: options?.value === undefined ? undefined : JSON.stringify(options.value),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(typeof data?.error === 'string' ? data.error : 'El servicio no está disponible. Los cambios locales se conservan.')
  }
  return (response.status === 204 ? undefined : await response.json()) as T
}

function cached(cache: Map<string, Promise<string>>, key: string, task: () => Promise<string>) {
  const existing = cache.get(key)
  if (existing) return existing
  const result = task().catch((error: unknown) => { cache.delete(key); throw error })
  if (cache.size >= 16) cache.delete(cache.keys().next().value!)
  cache.set(key, result)
  return result
}

async function storeImage(source: string) {
  if (assetDigest(source)) return source
  return cached(savedMedia, source, async () => (await request<{ ref: string }>('/media', { method: 'POST', value: { image: source } })).ref)
}

async function loadImage(source: string) {
  const digest = assetDigest(source)
  if (!digest) return source
  return cached(mediaCache, digest, async () => {
    const response = await fetch(`/api/media/${digest}`, { credentials: 'same-origin', signal: AbortSignal.timeout(35_000) })
    if (!response.ok) throw new Error('No se pudo recuperar una imagen privada del proyecto.')
    const blob = await response.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const data = String(reader.result)
        savedMedia.set(data, Promise.resolve(source))
        if (savedMedia.size > 16) savedMedia.delete(savedMedia.keys().next().value!)
        resolve(data)
      }
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
      reader.readAsDataURL(blob)
    })
  })
}

export const api = {
  async account() {
    const session = await request<{ account: Account | null }>('/auth/me')
    remember(session.account)
    return session
  },
  async session(mode: 'login' | 'register', email: string, password: string) {
    const session = await request<{ account: Account }>(`/auth/${mode}`, { method: 'POST', value: { email, password } })
    remember(session.account)
    return session
  },
  async logout() { await request<void>('/auth/logout', { method: 'POST' }); remember(null) },
  projects: () => request<ProjectSummary[]>('/projects'),
  async project(id: string) {
    const remote = await request<CloudProject>(`/projects/${id}`)
    return { ...remote, project: await mapProjectMedia(remote.project, loadImage) }
  },
  async saveProject(project: Project) {
    return request<{ updatedAt: string }>(`/projects/${project.id}`, { method: 'PUT', value: await mapProjectMedia(project, storeImage) })
  },
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  async brands() {
    const brands = await request<Brand[]>('/brands')
    const hydrated: Brand[] = []
    for (const brand of brands) hydrated.push(await mapBrandMedia(brand, loadImage))
    return hydrated
  },
  async saveBrand(brand: Brand) {
    return request<void>(`/brands/${brand.id}`, { method: 'PUT', value: await mapBrandMedia(brand, storeImage) })
  },
  deleteBrand: (id: string) => request<void>(`/brands/${id}`, { method: 'DELETE' }),
  codes: () => request<DynamicCode[]>('/qr'),
  createCode: (label: string, target: string) => request<DynamicCode>('/qr', { method: 'POST', value: { label, target } }),
  stats: (id: string) => request<ScanSummary>(`/qr/${id}/stats`),
}
