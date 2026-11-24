import { openDB, type DBSchema } from 'idb'
import { create } from 'zustand'
import type { Brand, Project } from './model'

type Version = { id: string; projectId: string; savedAt: string; project: Project }

interface ReviewDb extends DBSchema {
  projects: { key: string; value: Project }
  versions: { key: string; value: Version; indexes: { byProject: string } }
  settings: { key: string; value: string[] }
  brands: { key: string; value: Brand }
  owners: { key: string; value: string }
}

let database: ReturnType<typeof openDatabase> | undefined
function openDatabase() {
  return openDB<ReviewDb>('reviewcanvas', 2, {
    upgrade(db, version) {
      if (version < 1) {
        db.createObjectStore('projects', { keyPath: 'id' })
        db.createObjectStore('versions', { keyPath: 'id' }).createIndex('byProject', 'projectId')
        db.createObjectStore('settings')
        db.createObjectStore('brands', { keyPath: 'id' })
      }
      if (version < 2) db.createObjectStore('owners')
    },
    blocking() { void database?.then((connection) => connection.close()); database = undefined },
  })
}
const db = () => database ??= openDatabase()

async function availableTo(storage: Awaited<ReturnType<typeof db>>, key: string, account?: string) {
  const owner = await storage.get('owners', key)
  return !owner || owner === account
}

export async function readProject(id: string, account?: string) {
  const storage = await db()
  if (await availableTo(storage, `project:${id}`, account)) return storage.get('projects', id)
}

export async function readProjects(account?: string) {
  const storage = await db()
  const projects = await storage.getAll('projects')
  const allowed = await Promise.all(projects.map((project) => availableTo(storage, `project:${project.id}`, account)))
  return projects.filter((_, index) => allowed[index])
}
export const getVersions = async (id: string) => (await (await db()).getAllFromIndex('versions', 'byProject', id))
  .sort((a, b) => b.savedAt.localeCompare(a.savedAt))

export async function writeProject(project: Project, account?: string) {
  const tx = (await db()).transaction(['projects', 'versions', 'owners'], 'readwrite')
  if (account) await tx.objectStore('owners').put(account, `project:${project.id}`)
  const current = await tx.objectStore('projects').get(project.id)
  if (!current || current.updatedAt <= project.updatedAt) {
    await tx.objectStore('projects').put(project)
    const versions = await tx.objectStore('versions').index('byProject').getAll(project.id)
    const newest = versions.reduce((latest, version) => Math.max(latest, Date.parse(version.savedAt)), 0)
    if (Date.parse(project.updatedAt) - newest >= 60_000) {
      await tx.objectStore('versions').put({ id: crypto.randomUUID(), projectId: project.id, savedAt: project.updatedAt, project })
      const old = versions.sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(14)
      await Promise.all(old.map((version) => tx.objectStore('versions').delete(version.id)))
    }
  }
  await tx.done
}

export async function deleteProject(id: string) {
  const tx = (await db()).transaction(['projects', 'versions', 'owners'], 'readwrite')
  await tx.objectStore('projects').delete(id)
  await tx.objectStore('owners').delete(`project:${id}`)
  const keys = await tx.objectStore('versions').index('byProject').getAllKeys(id)
  await Promise.all(keys.map((key) => tx.objectStore('versions').delete(key)))
  await tx.done
}

export async function readBrands(account?: string) {
  const storage = await db()
  const brands = await storage.getAll('brands')
  const allowed = await Promise.all(brands.map((brand) => availableTo(storage, `brand:${brand.id}`, account)))
  return brands.filter((_, index) => allowed[index])
}
export async function writeBrand(brand: Brand, account?: string) {
  const tx = (await db()).transaction(['brands', 'owners'], 'readwrite')
  await tx.objectStore('brands').put(brand)
  if (account) await tx.objectStore('owners').put(account, `brand:${brand.id}`)
  await tx.done
}
export async function deleteBrand(id: string) {
  const tx = (await db()).transaction(['brands', 'owners'], 'readwrite')
  await tx.objectStore('brands').delete(id)
  await tx.objectStore('owners').delete(`brand:${id}`)
  await tx.done
}

type LibraryState = {
  favorites: string[]; decorationFavorites: string[]; load: () => Promise<void>;
  favorite: (id: string, decorations?: boolean) => void
}

export const useLibrary = create<LibraryState>((set, get) => ({
  favorites: [], decorationFavorites: [],
  async load() {
    const storage = await db()
    const [favorites, decorationFavorites] = await Promise.all([
      storage.get('settings', 'favorites'), storage.get('settings', 'decorationFavorites'),
    ])
    set({ favorites: favorites ?? [], decorationFavorites: decorationFavorites ?? [] })
  },
  favorite(id, decorations) {
    const key = decorations ? 'decorationFavorites' : 'favorites'
    const current = get()[key]
    const updated = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    set({ [key]: updated })
    void db().then((storage) => storage.put('settings', updated, key)).catch(() => {})
  },
}))
