import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, BarChart3, Cloud, Copy, Download, FolderOpen, Heart, LayoutGrid, LogOut, Plus, QrCode, Search, SwatchBook, Trash2 } from 'lucide-react'
import { accountHint, api, cloudAccountsEnabled, type ProjectSummary, type Account, type DynamicCode, type ScanSummary } from '../api'
import { brandSchema, defaultQr, validateProject, type Brand, type Project } from '../model'
import { deleteBrand, deleteProject, readBrands, readProjects, writeBrand, writeProject } from '../storage'
import { AccountDialog } from './Account'
import { BrandForm } from './BrandForm'
import { BrandLogo, Dialog, FileField, IconButton } from './ui'

type Panel = 'projects' | 'brand' | 'stats'
const dates = new Intl.DateTimeFormat('es', { dateStyle: 'medium' })
const fresh = () => new Date().toISOString()
const when = (value: string) => dates.format(new Date(value))
type ListedProject = Project | ProjectSummary
const warn = (error: unknown) => error instanceof Error ? error.message : 'No se pudo completar la acción.'

export default function Projects() {
  const [tab, setTab] = useState<Panel>(new URLSearchParams(location.search).get('seccion') === 'marca' ? 'brand' : 'projects')
  const [projects, setProjects] = useState<ListedProject[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [account, setAccount] = useState<Account | null>(null)
  const [auth, setAuth] = useState(false)
  const [createBrand, showBrand] = useState<boolean | Brand>(false)
  const [editing, setEditing] = useState<Project>()
  const [deleting, setDeleting] = useState<ListedProject>()
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState('')
  const [sort, setSort] = useState('recent')
  const [favorites, setFavorites] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cloudIds, setCloudIds] = useState<string[]>([])
  useEffect(() => {
    let mounted = true
    const hint = accountHint()
    void Promise.all([readProjects(hint?.id), readBrands(hint?.id)]).then(([local, savedBrands]) => {
      if (!mounted) return
      setProjects(local); setBrands(savedBrands); setLoading(false)
    }).catch((error) => { if (mounted) { setLoading(false); setStatus(warn(error)) } })
    if (hint) void api.account().then(({ account }) => { if (mounted) setAccount(account) }).catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!account) return
    let mounted = true
    void Promise.all([api.projects(), readProjects(account.id)]).then(([remote, local]) => {
      if (!mounted) return
      const cloud = new Map<string, ListedProject>(remote.map((project) => [project.id, project]))
      const owned = new Set(cloud.keys())
      for (const project of local) {
        const match = cloud.get(project.id)
        if (!match || match.updatedAt <= project.updatedAt) cloud.set(project.id, project)
      }
      const combined = [...cloud.values()]
      if (!mounted) return
      setProjects(combined)
      setCloudIds([...owned])
    }).catch((error) => { if (mounted) setStatus(warn(error)) })
    return () => { mounted = false }
  }, [account])

  useEffect(() => {
    if (!account || tab !== 'brand') return
    let mounted = true
    void Promise.all([api.brands(), readBrands(account.id)]).then(async ([remote, local]) => {
      if (!mounted) return
      const merged = Array.from(new Map([...local, ...remote].map((brand) => [brand.id, brand])).values())
      await Promise.all(remote.map((brand) => writeBrand(brand, account.id)))
      if (mounted) setBrands(merged)
    }).catch((error) => { if (mounted) setStatus(warn(error)) })
    return () => { mounted = false }
  }, [account, tab])

  async function save(project: Project) {
    await writeProject(project)
    setProjects((before) => [...before.filter((item) => item.id !== project.id), project])
    if (account && cloudIds.includes(project.id)) {
      await api.saveProject(project)
      await writeProject(project, account.id)
    }
  }
  async function fullProject(project: ListedProject) {
    return 'layers' in project ? project : (await api.project(project.id)).project
  }
  function updateProject(project: ListedProject, update: (value: Project) => void | Promise<void>) {
    void fullProject(project).then(update).catch((error) => setStatus(warn(error)))
  }

  async function remove() {
    if (!deleting) return
    try {
      if (account && cloudIds.includes(deleting.id)) await api.deleteProject(deleting.id)
      await deleteProject(deleting.id)
      setProjects((before) => before.filter((item) => item.id !== deleting.id))
      setDeleting(undefined)
      setStatus('Proyecto eliminado.')
    } catch (error) { setStatus(warn(error)) }
  }
  async function importProject(file: File) {
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Elige un archivo JSON de menos de 10 MB.')
      const project = validateProject(JSON.parse(await file.text()), true)
      if (!project) throw new Error('El archivo no contiene un proyecto de ReviewCanvas compatible.')
      const imported = { ...project, id: crypto.randomUUID(), updatedAt: fresh() }
      await save(imported)
      location.href = `/editor/${imported.id}`
    } catch (error) { setStatus(warn(error)) }
  }
  async function saveBrand(brand: Brand) {
    await writeBrand(brandSchema.parse(brand))
    setBrands((before) => [...before.filter((item) => item.id !== brand.id), brand])
    if (account) { await api.saveBrand(brand); await writeBrand(brand, account.id) }
  }
  async function removeBrand(brand: Brand) {
    if (!window.confirm(`¿Eliminar la marca ${brand.name}?`)) return
    try {
      if (account) await api.deleteBrand(brand.id).catch((error: Error) => { if (error.message !== 'Marca no encontrada.') throw error })
      await deleteBrand(brand.id)
      setBrands((before) => before.filter((item) => item.id !== brand.id))
    } catch (error) { setStatus(warn(error)) }
  }

  const shown = projects.filter((project) => (!favorites || project.favorite) && (!folder || project.folder === folder)
    && `${project.title} ${project.business} ${project.folder}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()))
    .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt))
  const folders = [...new Set(projects.map((project) => project.folder).filter(Boolean))].sort()
  return <div className="dashboard">
    <header className="dashboard-header"><div className="site-container site-nav"><BrandLogo />
      {cloudAccountsEnabled && <div className="site-nav-end">{account ? <><span className="account-email">{account.email}</span>
        <IconButton label="Cerrar sesión" onClick={() => { void api.logout().then(() => location.reload()).catch((error) => setStatus(warn(error))) }}><LogOut size={18} /></IconButton></>
        : <button type="button" className="button button-outline" onClick={() => setAuth(true)}><Cloud size={17} /> Iniciar sesión</button>}</div>}
    </div></header>
    <main className="site-container dashboard-main">
      <nav className="segmented dashboard-tabs" aria-label="Panel de usuario">
        {([['projects', 'Proyectos', LayoutGrid], ['brand', 'Mi marca', SwatchBook], ['stats', 'QR dinámicos', BarChart3]] as const)
          .filter(([key]) => cloudAccountsEnabled || key !== 'stats').map(([key, label, Icon]) =>
          <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}><Icon size={17} /> {label}</button>)}
      </nav>
      {status && <p className="dashboard-notice" role="status">{status}<button className="text-button" onClick={() => setStatus('')}>Cerrar</button></p>}
      {tab === 'projects' && <>
        <div className="dashboard-title"><div><h1>Mis proyectos</h1><p>Abre un diseño guardado o crea un cartel para tu negocio.</p></div>
          <div><FileField label="Importar JSON" accept=".json,application/json" change={(file) => void importProject(file)} />
            <a href="/editor?nuevo" className="button button-primary"><Plus size={17} /> Nuevo proyecto</a></div></div>
        <div className="dashboard-filters">
          <label className="search"><Search size={17} /><input aria-label="Buscar proyectos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar proyectos…" /></label>
          <select aria-label="Carpeta" value={folder} onChange={(event) => setFolder(event.target.value)}><option value="">Todas las carpetas</option>{folders.map((name) => <option key={name}>{name}</option>)}</select>
          <select aria-label="Ordenar proyectos" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Más recientes</option><option value="title">Por nombre</option></select>
          <button className="button button-outline" type="button" aria-pressed={favorites} onClick={() => setFavorites(!favorites)}><Heart size={16} /> Favoritos</button>
        </div>
        {loading && <p role="status">Cargando proyectos…</p>}
        {!loading && !shown.length && <div className="dashboard-empty"><FolderOpen size={37} /><h2>{projects.length ? 'No hay coincidencias' : 'Aquí se guardarán tus diseños'}</h2>
          {!projects.length && <a href="/editor" className="button button-primary">Elegir una plantilla <ArrowRight size={17} /></a>}</div>}
        <div className="project-list">{shown.map((project) => <article className="project-row" key={project.id}>
          <a href={`/editor/${project.id}`} className="project-identity"><span className="project-icon" style={{ background: ('layers' in project ? project.layers[0]?.kind === 'rect' ? project.layers[0].fill : null : project.paper) ?? '#eee9df' }}><QrCode size={24} /></span>
            <span><b>{project.title}</b><small>{project.folder ? `${project.folder} · ` : ''}{when(project.updatedAt)}{cloudIds.includes(project.id) ? ' · En la nube' : ''}</small></span></a>
          <div className="project-actions">
            <IconButton label={project.favorite ? 'Quitar de favoritos' : 'Marcar favorito'} onClick={() => { updateProject(project, (full) => save({ ...full, favorite: !full.favorite, updatedAt: fresh() })) }}>
              <Heart size={16} fill={project.favorite ? 'currentColor' : 'none'} /></IconButton>
            <button type="button" className="text-button" onClick={() => updateProject(project, setEditing)}>Renombrar o mover</button>
            {account && !cloudIds.includes(project.id) && <IconButton label="Sincronizar proyecto" onClick={() => {
              updateProject(project, async (full) => {
                await api.saveProject(full); await writeProject(full, account.id)
                setCloudIds((ids) => [...ids, full.id])
              })
            }}><Cloud size={16} /></IconButton>}
            <IconButton label="Duplicar proyecto" onClick={() => { updateProject(project, (full) => save({ ...full, id: crypto.randomUUID(), title: `${full.title.slice(0, 90)} (copia)`, updatedAt: fresh() })) }}><Copy size={16} /></IconButton>
            <IconButton label="Eliminar proyecto" onClick={() => setDeleting(project)}><Trash2 size={16} /></IconButton>
          </div>
        </article>)}</div>
        {shown.length > 1 && <button type="button" className="button button-outline batch-download" onClick={() => {
          void (async () => {
            const [{ zipSync, strToU8 }, { download }] = await Promise.all([import('fflate'), import('../editor/output')])
            const files: Record<string, Uint8Array> = {}
            for (const [index, project] of shown.entries()) files[`${index + 1}-${project.id}.json`] = strToU8(JSON.stringify(await fullProject(project), null, 2))
            const bytes = zipSync(files)
            download(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }), 'ReviewCanvas-proyectos', 'ZIP')
          })().catch((error) => setStatus(warn(error)))
        }}><Download size={17} /> Exportar proyectos visibles</button>}
      </>}
      {tab === 'brand' && <>
        <div className="dashboard-title"><div><h1>Mi marca</h1><p>Guarda la identidad de cada negocio para usarla en el editor.</p></div>
          <button className="button button-primary" type="button" onClick={() => showBrand(true)}><Plus size={17} /> Añadir marca</button></div>
        {!brands.length && <div className="dashboard-empty"><SwatchBook size={34} /><h2>Empieza con tu primera marca</h2></div>}
        <div className="project-list">{brands.map((brand) => <article className="project-row" key={brand.id}>
          <div className="project-identity"><span className="brand-preset-swatches"><i style={{ background: brand.primary }} /><i style={{ background: brand.secondary }} /></span>
            <span><b>{brand.name}</b><small>{brand.slogan || brand.font}</small></span></div>
          <div className="project-actions"><button className="text-button" type="button" onClick={() => showBrand(brand)}>Editar marca</button>
            <IconButton label="Eliminar marca" onClick={() => void removeBrand(brand)}><Trash2 size={16} /></IconButton></div>
        </article>)}</div>
      </>}
      {cloudAccountsEnabled && tab === 'stats' && <Statistics account={account} logIn={() => setAuth(true)} />}
    </main>
    {cloudAccountsEnabled && auth && <AccountDialog onAccount={setAccount} close={() => setAuth(false)} />}
    {createBrand && <BrandForm initial={typeof createBrand === 'object' ? createBrand : undefined} save={saveBrand} close={() => showBrand(false)} />}
    {editing && <Dialog title="Organizar proyecto" onClose={() => setEditing(undefined)}>
      <form className="dialog-body field-stack" onSubmit={(event) => {
        event.preventDefault(); void save({ ...editing, title: editing.title.trim() || 'Diseño sin título', folder: editing.folder.trim(), updatedAt: fresh() })
          .then(() => setEditing(undefined)).catch((error) => setStatus(warn(error)))
      }}><label>Nombre del proyecto<input autoFocus required maxLength={100} value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label>
        <label>Carpeta<input maxLength={70} list="folders" value={editing.folder} onChange={(event) => setEditing({ ...editing, folder: event.target.value })} /></label>
        <datalist id="folders">{folders.map((name) => <option key={name} value={name} />)}</datalist>
        <div className="dialog-actions"><button className="button button-primary" type="submit">Guardar</button></div></form>
    </Dialog>}
    {deleting && <Dialog title="Eliminar proyecto" onClose={() => setDeleting(undefined)}>
      <div className="dialog-body field-stack"><p>Se eliminará «{deleting.title}» y su historial local.</p><div className="dialog-actions">
        <button type="button" className="button button-outline" onClick={() => setDeleting(undefined)}>Cancelar</button>
        <button type="button" className="button button-danger" onClick={() => void remove()}>Eliminar</button></div></div>
    </Dialog>}
  </div>
}

function Statistics({ account, logIn }: { account: Account | null; logIn: () => void }) {
  const [codes, setCodes] = useState<DynamicCode[]>([])
  const [create, setCreate] = useState(false)
  const [stats, setStats] = useState<{ code: DynamicCode; result: ScanSummary }>()
  const [error, setError] = useState('')
  useEffect(() => { if (account) void api.codes().then(setCodes).catch((error) => setError(warn(error))); else setCodes([]) }, [account])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void api.createCode(String(form.get('label')), String(form.get('target'))).then((code) => {
      setCodes((before) => [code, ...before]); setCreate(false); setError('')
    }).catch((error) => setError(warn(error)))
  }
  async function qrDownload(code: DynamicCode) {
    try {
      const { standaloneQr, readQr } = await import('../editor/qr')
      const { download } = await import('../editor/output')
      const link = `${location.origin}/r/${code.slug}`
      const { markup, canvas } = await standaloneQr(defaultQr, link)
      if (await readQr(canvas) !== link) throw new Error('El QR no superó la verificación.')
      download(new Blob([markup], { type: 'image/svg+xml' }), code.label, 'SVG')
    } catch (error) { setError(warn(error)) }
  }
  return <><div className="dashboard-title"><div><h1>QR dinámicos</h1><p>Consulta escaneos por fecha y tipo de dispositivo. Un escaneo no equivale a una reseña publicada.</p></div>
    <button className="button button-primary" type="button" onClick={account ? () => setCreate(true) : logIn}>{account ? 'Crear QR dinámico' : 'Iniciar sesión'}</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="project-list">{[...codes].sort((a, b) => b.scans - a.scans).map((code) => <article className="project-row" key={code.id}>
      <div className="project-identity"><span className="project-icon"><QrCode size={23} /></span><span><b>{code.label}</b><small>{code.scans} escaneos</small></span></div>
      <div className="project-actions"><button type="button" className="text-button" onClick={() => {
        void api.stats(code.id).then((result) => setStats({ code, result })).catch((error) => setError(warn(error)))
      }}>Ver estadísticas</button><IconButton label="Descargar QR dinámico" onClick={() => void qrDownload(code)}><Download size={17} /></IconButton></div>
    </article>)}</div>
    {create && <Dialog title="Crear QR dinámico" onClose={() => setCreate(false)}>
      <form className="dialog-body field-stack" onSubmit={submit}><label>Nombre<input name="label" required maxLength={100} /></label>
        <label>Enlace de reseñas o Place ID<input name="target" required maxLength={1200} /></label>{error && <p className="form-error">{error}</p>}
        <div className="dialog-actions"><button type="submit" className="button button-primary">Crear código</button></div></form>
    </Dialog>}
    {stats && <Dialog title={stats.code.label} onClose={() => setStats(undefined)}><div className="dialog-body field-stack">
      <p>{stats.result.total} escaneos</p><h3>Por fecha</h3>{stats.result.dates.map((item) => <div key={item.date} className="stat-row"><span>{item.date}</span><strong>{item.count}</strong></div>)}
      <h3>Por dispositivo</h3>{stats.result.devices.map((item) => <div key={item.device} className="stat-row"><span>{item.device}</span><strong>{item.count}</strong></div>)}
    </div></Dialog>}
  </>
}
