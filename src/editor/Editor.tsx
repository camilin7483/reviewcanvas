import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, Check, ChevronDown, CircleHelp, CloudCheck, Download, Expand, Eye, FilePlus2, Grid2X2, Hand, History,
  ImagePlus, Layers3, LayoutTemplate, Link2, Minus, MousePointer2, Plus, QrCode, Redo2, Scaling,
  Shapes, SlidersHorizontal, SwatchBook, Type, Undo2, X,
} from 'lucide-react'
import { colors, defaultQr, dimensions, eachLayer, findQr, layerBase, normalizeReviewTarget, reviewLink, type Brand, type Format, type Layer, type Project, type QrStyle } from '../model'
import { getVersions } from '../storage'
import type { Template } from '../library/templates'
import { elementLayer, elements, type ElementItem } from '../library/vectors'
import { BrandLogo, Dialog, IconButton } from '../components/ui'
import { readCustomFont, readRaster, safeVector } from './assets'
import { ReviewDialog, ExportDialog, FormatDialog, PreviewDialog } from './dialogs'
import { Inspector } from './Inspector'
import { ToolsPanel, tabNames, type Tab } from './ToolsPanel'
import { Stage, type StageHandle, type StageSettings } from './Stage'
import { verifyProject, type Verification } from './output'
import { useDocument } from './useDocument'

const tools = [
  ['templates', LayoutTemplate], ['elements', Shapes], ['text', Type], ['qr', QrCode], ['uploads', ImagePlus], ['brand', SwatchBook],
] as const
const initialVerification = { ok: false, message: 'Vincula el enlace directo de reseñas para verificar el QR.', warnings: [] }
const viewOptions = [
  ['rulers', 'Reglas'], ['grid', 'Cuadrícula'], ['guides', 'Guías inteligentes'], ['snap', 'Ajuste magnético'], ['safe', 'Márgenes de seguridad'],
] as const
type Modal = 'review' | 'export' | 'format' | 'mockup' | 'print' | 'present' | 'history' | 'help'

function cloneLayer(layer: Layer, nudge = 18): Layer {
  const next = { ...layer, id: crypto.randomUUID(), x: layer.x + nudge, y: layer.y + nudge }
  return layer.kind === 'group' ? { ...layer, ...next, kind: 'group', children: layer.children.map((child) => cloneLayer(child, 0)) } : next
}

export default function Editor({ id }: { id?: string }) {
  const doc = useDocument(id)
  const project = doc.project
  const [tab, setTab] = useState<Tab>('templates')
  const [activeTemplate, setActiveTemplate] = useState('')
  const [modal, setModal] = useState<Modal | undefined>(() => new URLSearchParams(location.search).has('vincular') ? 'review' : undefined)
  const [mobile, setMobile] = useState<'assets' | 'properties'>()
  const [view, setView] = useState<StageSettings>({ grid: false, gridSize: 24, rulers: false, guides: true, snap: true, safe: false })
  const [zoom, setZoom] = useState(.65)
  const [tool, setTool] = useState<'select' | 'pan'>('select')
  const [ids, select] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [verification, setVerification] = useState<Verification>(initialVerification)
  const [versions, setVersions] = useState<Awaited<ReturnType<typeof getVersions>>>([])
  const stage = useRef<StageHandle>(null)
  const clipboard = useRef<Layer[]>([])
  const first = useRef(false)
  const choosing = useRef(0)
  const projectId = project?.id

  useEffect(() => {
    if (!project || first.current) return
    first.current = true
    setActiveTemplate(doc.initialTemplate)
    const qr = findQr(project.layers)[0]
    if (qr) select([qr.id])
  }, [project, doc.initialTemplate])

  useEffect(() => {
    if (!status) return
    const timeout = window.setTimeout(() => setStatus(''), 5000)
    return () => clearTimeout(timeout)
  }, [status])

  useEffect(() => {
    if (!project) return
    if (!project.url) { setVerification(initialVerification); return }
    let current = true
    setVerification({ ok: false, message: 'Verificando el QR…', warnings: [] })
    const timeout = window.setTimeout(() => {
      void verifyProject(project).then((result) => { if (current) setVerification(result) })
        .catch(() => { if (current) setVerification({ ok: false, message: 'No se pudo verificar el QR.', warnings: [] }) })
    }, 400)
    return () => { current = false; window.clearTimeout(timeout) }
  }, [project?.layers, project?.url, project?.format])

  useEffect(() => {
    if (modal === 'history' && projectId) void getVersions(projectId).then(setVersions).catch((error: Error) => setStatus(error.message))
  }, [modal, projectId])

  const currentQr = (project?.layers.find((layer) => layer.id === ids[0] && layer.kind === 'qr') ?? findQr(project?.layers ?? [])[0]) as Extract<Layer, { kind: 'qr' }> | undefined

  function change(id: string, update: (layer: Layer) => Layer) {
    doc.edit((before) => {
      let business = before.business
      const layers = eachLayer(before.layers, (layer) => {
        if (layer.id !== id) return layer
        const revised = update(layer)
        if (revised.kind === 'text' && revised.role === 'business' && layer.kind === 'text' && revised.text !== layer.text) {
          business = revised.text.trim().slice(0, 100)
        }
        return revised
      })
      return { ...before, layers, business }
    })
  }
  function replaceLayers(layers: Layer[]) {
    doc.edit((before) => {
      const renamed = layers.find((layer) => layer.kind === 'text' && layer.role === 'business')
      return { ...before, layers, business: renamed?.kind === 'text' ? renamed.text.trim().slice(0, 100) : before.business }
    })
  }
  function addLayer(layer: Layer) {
    doc.edit((before) => ({ ...before, layers: [...before.layers, layer] }))
    select([layer.id])
    setMobile(undefined)
  }
  function changeBusiness(name: string, url: string) {
    const current = doc.active.current
    if (!current) return
    const business = name || current.business
    const { width, height } = dimensions(current.format)
    const size = Math.round(Math.min(width, height) * .45)
    const generated: Layer = {
      ...layerBase('Código QR', width / 2, height / 2, size, size), kind: 'qr', style: { ...defaultQr },
    }
    const visibleQr = findQr(current.layers)[0]
    doc.edit((before) => {
      const layers = eachLayer(before.layers, (layer) => layer.kind === 'text' && layer.role === 'business' && business
        ? { ...layer, text: business } : layer)
      return { ...before, business, url,
        title: business && (before.title === 'Diseño sin título' || before.title === before.business) ? business : before.title,
        layers: visibleQr ? layers : [...layers, generated],
      }
    })
    select([visibleQr?.id ?? generated.id])
    setTab('qr')
    setMobile(undefined)
  }
  async function choose(template: Template) {
    const order = ++choosing.current
    try {
      const layers = await template.build()
      if (order !== choosing.current) return
      doc.edit((before) => {
        const business = before.url && before.business ? before.business : template.business
        const updatedLayers = eachLayer(layers, (layer) => layer.kind === 'text' && layer.role === 'business' ? { ...layer, text: business } : layer)
        return { ...before, layers: updatedLayers, format: template.format, business, title: before.title === 'Diseño sin título' || before.title === before.business ? business : before.title }
      })
      setActiveTemplate(template.id)
      const selected = findQr(layers)[0]
      select(selected ? [selected.id] : [])
      setMobile(undefined)
    } catch (error) { setStatus((error as Error).message) }
  }
  function addAsset(element: ElementItem, x?: number, y?: number) {
    const before = doc.active.current
    if (!before) return
    const { width, height } = dimensions(before.format)
    const background = element.category === 'Fondos'
    void elementLayer(element, x ?? width / 2, y ?? height / 2, background ? width : 120,
      background ? height : 120).then((layer) => {
      if (background) {
        doc.edit((project) => ({ ...project, layers: [layer, ...project.layers.filter((item) => !item.locked || !item.name.startsWith('Fondo'))] }))
        select([layer.id]); setMobile(undefined)
      } else addLayer(layer)
    }).catch((error: Error) => setStatus(error.message))
  }
  function addText(preset: string) {
    const before = doc.active.current
    if (!before) return
    const { width, height } = dimensions(before.format)
    const styles: Record<string, [string, string, number, number]> = {
      title: ['Título editorial', 'Lora Variable', 64, 600], subtitle: ['Subtítulo', 'Lora Variable', 39, 500],
      label: ['ETIQUETA', 'DM Sans Variable', 23, 700], body: ['Añade tu texto', 'DM Sans Variable', 33, 500],
    }
    const [text, font, size, weight] = styles[preset]
    addLayer({ ...layerBase('Texto', width / 2, height / 2, width * .68, size * 1.4), kind: 'text', text, font, size, weight,
      italic: false, underline: false, leading: 1.1, tracking: preset === 'label' ? 160 : 0, align: 'center', fill: colors.forest })
  }
  function addQr() {
    const before = doc.active.current
    if (!before) return
    const { width, height } = dimensions(before.format)
    const size = Math.min(width, height) * .4
    addLayer({ ...layerBase('Código QR', width / 2, height / 2, size, size), kind: 'qr', style: { ...defaultQr } })
  }
  function updateQr(values: Partial<QrStyle>) {
    if (currentQr) change(currentQr.id, (layer) => layer.kind === 'qr' ? { ...layer, style: { ...layer.style, ...values } } : layer)
  }
  async function upload(file: File) {
    try {
      const before = doc.active.current
      if (!before) return
      const { width, height } = dimensions(before.format)
      if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        if (file.size > 64_000) throw new Error('Usa un archivo SVG de menos de 64 KB.')
        const markup = safeVector(await file.text())
        addLayer({ ...layerBase(file.name.slice(0, 100), width / 2, height / 2, 145, 145), kind: 'vector', svg: markup })
      } else {
        const image = await readRaster(file)
        const ratio = Math.min(1, width * .5 / image.width, height * .5 / image.height)
        addLayer({ ...layerBase(file.name.slice(0, 100), width / 2, height / 2, image.width * ratio, image.height * ratio), kind: 'image', source: image.value })
      }
    } catch (error) { setStatus((error as Error).message) }
  }
  async function uploadFont(file: File) {
    try {
      const font = await readCustomFont(file)
      await new FontFace(font.name, `url(${font.data})`).load()
      doc.edit((before) => ({
        ...before, importedFonts: [...before.importedFonts.filter((item) => item.name !== font.name).slice(-4), font],
        layers: eachLayer(before.layers, (layer) => layer.kind === 'text' && ids.includes(layer.id) ? { ...layer, font: font.name } : layer),
      }))
      setStatus(`Fuente importada: ${font.name}`)
    } catch (error) { setStatus((error as Error).message || 'No se pudo cargar la tipografía.') }
  }
  function applyBrand(brand: Brand) {
    doc.edit((before) => {
      const layers = eachLayer(before.layers, (layer) => {
        if (layer.kind === 'text') return { ...layer,
          text: layer.role === 'business' ? brand.name : layer.role === 'slogan' && brand.slogan ? brand.slogan : layer.text,
          font: brand.font || layer.font, fill: layer.fill.toLowerCase() === '#ffffff' ? layer.fill : brand.primary,
        }
        if (layer.kind === 'vector') return { ...layer, tint: brand.secondary }
        if (layer.kind === 'qr') return { ...layer, style: { ...layer.style, ink: brand.primary, logo: brand.logo ?? layer.style.logo } }
        return layer
      })
      const { width, height } = dimensions(before.format)
      if (brand.logo && !findQr(layers).length) layers.push({ ...layerBase('Logotipo del negocio', width * .82, height * .11, 80, 80), kind: 'image', source: brand.logo })
      return { ...before, business: brand.name, url: reviewLink(brand.url) || before.url, layers }
    })
    setStatus(`Marca aplicada: ${brand.name}`)
  }
  function changeFormat(format: Format, bleed: number) {
    doc.edit((before) => {
      const from = dimensions(before.format), to = dimensions(format)
      const ratio = Math.min(to.width / from.width, to.height / from.height)
      const fullPage = (item: Layer) => item.locked && item.kind === 'rect' && item.w === from.width && item.h === from.height
      const sizeLayer = (item: Layer, nested = false): Layer => {
        if (!nested && fullPage(item)) return { ...item, x: to.width / 2, y: to.height / 2, w: to.width, h: to.height }
        const scale = { x: item.x * ratio + (nested ? 0 : (to.width - from.width * ratio) / 2),
          y: item.y * ratio + (nested ? 0 : (to.height - from.height * ratio) / 2), w: item.w * ratio, h: item.h * ratio }
        if (item.kind === 'text') return { ...item, ...scale, size: Math.max(4, Math.min(460, item.size * ratio)) }
        if (item.kind === 'group') return { ...item, ...scale, children: item.children.map((child) => sizeLayer(child, true)) }
        return { ...item, ...scale }
      }
      return { ...before, format, bleed, layers: before.layers.map((item) => sizeLayer(item)) }
    })
  }
  function reorder(source: string, target: string) {
    if (source === target) return
    doc.edit((before) => {
      const layers = [...before.layers]
      const from = layers.findIndex((layer) => layer.id === source)
      const to = layers.findIndex((layer) => layer.id === target)
      if (from < 0 || to < 0) return before
      const [item] = layers.splice(from, 1)
      layers.splice(to, 0, item)
      return { ...before, layers }
    })
  }
  function action(key: string) {
    const before = doc.active.current
    if (!before || !ids.length) return
    if (['left', 'center', 'right', 'top', 'middle', 'bottom', 'spreadX', 'spreadY'].includes(key)) { stage.current?.arrange(key); return }
    const selected = before.layers.filter((layer) => ids.includes(layer.id))
    const moved = selected.filter((layer) => !layer.locked)
    if (key === 'copy') { clipboard.current = selected; setStatus('Selección copiada.'); return }
    if (key === 'duplicate') {
      const copies = selected.map((layer) => cloneLayer(layer))
      replaceLayers([...before.layers, ...copies]); select(copies.map((item) => item.id)); return
    }
    if (key === 'delete') {
      replaceLayers(before.layers.filter((layer) => !moved.includes(layer))); select([]); return
    }
    if (key === 'front' || key === 'back') {
      const rest = before.layers.filter((layer) => !selected.includes(layer))
      replaceLayers(key === 'front' ? [...rest, ...selected] : [...selected, ...rest]); return
    }
    if (key === 'up' || key === 'down') {
      const source = ids[0]
      const index = before.layers.findIndex((layer) => layer.id === source)
      const target = before.layers[index + (key === 'up' ? 1 : -1)]
      if (target) reorder(source, target.id)
      return
    }
    if (key === 'flipX' || key === 'flipY') {
      replaceLayers(before.layers.map((layer) => moved.includes(layer) ? { ...layer, [key]: !layer[key] } : layer)); return
    }
    if (key === 'group' && moved.length > 1) {
      const left = Math.min(...moved.map((item) => item.x - item.w / 2)), right = Math.max(...moved.map((item) => item.x + item.w / 2))
      const top = Math.min(...moved.map((item) => item.y - item.h / 2)), bottom = Math.max(...moved.map((item) => item.y + item.h / 2))
      const x = (left + right) / 2, y = (top + bottom) / 2
      const group: Layer = { ...layerBase('Grupo', x, y, right - left, bottom - top), kind: 'group',
        children: moved.map((item) => ({ ...item, x: item.x - x, y: item.y - y })) }
      const index = before.layers.lastIndexOf(moved.at(-1)!)
      const layers = before.layers.flatMap((item, at) => at === index ? [group] : moved.includes(item) ? [] : [item])
      replaceLayers(layers); select([group.id]); return
    }
    if (key === 'ungroup') {
      const layers = stage.current?.ungroup()
      if (layers) { replaceLayers(before.layers.flatMap((item) => item.id === ids[0] ? layers : [item])); select(layers.map((item) => item.id)) }
    }
  }
  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (modal || target?.closest('input,textarea,[contenteditable],select')) return
      const before = doc.active.current
      const control = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (!before) return
      if (control && key === 'z') { event.preventDefault(); event.shiftKey ? doc.redo() : doc.undo(); return }
      if (control && key === 'y') { event.preventDefault(); doc.redo(); return }
      if (control && key === 'c' && ids.length) { action('copy'); event.preventDefault(); return }
      if (control && key === 'd' && ids.length) { action('duplicate'); event.preventDefault(); return }
      if (control && key === 'v' && clipboard.current.length) {
        const copies = clipboard.current.map((layer) => cloneLayer(layer))
        replaceLayers([...before.layers, ...copies]); select(copies.map((item) => item.id)); event.preventDefault(); return
      }
      if (control || event.altKey) return
      if (key === 'escape') select([])
      if (key === 'delete' || key === 'backspace') { action('delete'); event.preventDefault() }
      if (ids.length && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        if (target?.closest('button,a,summary')) target.blur()
        const distance = event.shiftKey ? 10 : 1
        const dx = key === 'arrowright' ? distance : key === 'arrowleft' ? -distance : 0
        const dy = key === 'arrowdown' ? distance : key === 'arrowup' ? -distance : 0
        replaceLayers(before.layers.map((layer) => ids.includes(layer.id) && !layer.locked ? { ...layer, x: layer.x + dx, y: layer.y + dy } : layer))
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', shortcuts)
    return () => window.removeEventListener('keydown', shortcuts)
  })

  if (!project) return <main className="app-loading"><BrandLogo /><p role="status">{doc.error || 'Abriendo tu espacio de trabajo…'}</p>
    {doc.error && <a className="button button-primary" href="/proyectos">Ver mis proyectos</a>}</main>

  const onClose = () => setModal(undefined)
  const zoomChange = (value: number) => setZoom(Math.max(.1, Math.min(5, value)))
  const dim = dimensions(project.format)
  return <div className={`editor ${mobile ? `mobile-${mobile}` : ''}`}>
    <header className="editor-header">
      <div className="editor-header-start"><BrandLogo light /><a href="/proyectos" className="back-project" aria-label="Mis proyectos" title="Mis proyectos"><ArrowLeft size={17} /></a></div>
      <div className="project-title">
        <input aria-label="Nombre del proyecto" value={project.title} maxLength={100} onChange={(event) => {
          const title = event.target.value
          doc.edit((before) => ({ ...before, title }))
        }} onBlur={() => { if (!doc.active.current?.title.trim()) doc.edit((before) => ({ ...before, title: 'Diseño sin título' })) }} />
        <span title={{ saving: 'Guardando', saved: 'Guardado en este dispositivo', cloud: 'Sincronizado', error: 'No se pudo guardar en este dispositivo' }[doc.sync]}>
          {doc.sync === 'cloud' ? <CloudCheck size={16} /> : doc.sync === 'saved' ? <Check size={15} /> : doc.sync === 'saving' ? <span className="saving-dot" /> : '!'}</span>
      </div>
      <div className="editor-header-end">
        <a className="button editor-new" href="/editor?nuevo" title="Crear desde cero" aria-label="Crear desde cero"><FilePlus2 size={16} /><span>Desde cero</span></a>
        <div className="undo-buttons">
          <IconButton label="Deshacer" disabled={!doc.canUndo} onClick={doc.undo}><Undo2 size={19} /></IconButton>
          <IconButton label="Rehacer" disabled={!doc.canRedo} onClick={doc.redo}><Redo2 size={19} /></IconButton>
          <IconButton label="Historial de cambios" onClick={() => setModal('history')}><History size={17} /></IconButton>
        </div>
        <button className="button editor-preview" type="button" aria-label="Vista previa" onClick={() => setModal('mockup')}><Eye size={17} /><span>Vista previa</span></button>
        <button className="button editor-export" type="button" onClick={() => setModal('export')}><Download size={16} /><span>Exportar</span></button>
      </div>
    </header>
    <main className="editor-main">
      <nav className="tool-rail" aria-label="Biblioteca de diseño">
        {tools.map(([entry, Icon]) => <button type="button" key={entry} aria-pressed={tab === entry} title={tabNames[entry]} onClick={() => {
          setTab(entry); setMobile(mobile === 'assets' && tab === entry ? undefined : 'assets')
        }}><Icon size={21} /><span>{tabNames[entry]}</span></button>)}
        <div className="tool-spacer" />
        <IconButton label="Atajos de teclado" onClick={() => setModal('help')}><CircleHelp size={19} /></IconButton>
      </nav>
      <div className="tools-wrapper">
        <ToolsPanel tab={tab} project={project} activeTemplate={activeTemplate} verification={verification} qr={currentQr?.style}
          choose={(template) => void choose(template)} addElement={addAsset} addText={addText} review={() => setModal('review')}
          addQr={addQr} updateQr={updateQr} upload={(file) => void upload(file)} uploadFont={(file) => void uploadFont(file)}
          applyBrand={applyBrand} onError={setStatus} />
        <IconButton label="Cerrar herramientas" className="mobile-panel-close" onClick={() => setMobile(undefined)}><X size={20} /></IconButton>
      </div>
      <section className="editor-workspace" aria-label="Área de trabajo">
        <div className="workspace-heading">
          <button type="button" className="workspace-format" onClick={() => setModal('format')}><Scaling size={16} /><span>{project.format.name}</span><ChevronDown size={14} /></button>
          <button className={`workspace-link ${project.url && verification.ok ? 'is-linked' : ''}`} type="button" onClick={() => setModal('review')}>
            {project.url && verification.ok ? <Check size={16} /> : <Link2 size={16} />}<span>{project.url ? verification.ok ? 'QR verificado' : 'Negocio vinculado' : 'Vincular negocio'}</span>
          </button>
        </div>
        {doc.needsReviewLink && !project.url && <div className="review-notice" role="status">
          Este diseño necesita un enlace directo de reseñas. <button type="button" className="text-button" onClick={() => setModal('review')}>Vincular enlace</button>
        </div>}
        <div className="stage-shell">
          <Stage ref={stage} project={project} ids={ids} zoom={zoom} tool={tool} view={view} onSelect={select} onCommit={replaceLayers} onZoom={setZoom}
            onDropAsset={(id, x, y) => { const found = elements.find((item) => item.id === id); if (found) addAsset(found, x, y) }} onError={setStatus} />
          {!project.layers.length && <div className="blank-canvas">
            <div className="blank-icon"><QrCode size={28} /></div>
            <h2>Tu lienzo en blanco</h2>
            <p>Pega tu enlace directo de reseñas para generar el código.</p>
            <button type="button" className="button button-primary" onClick={() => setModal('review')}><Plus size={16} /> Generar desde un enlace</button>
            <button type="button" className="text-button" onClick={() => { setTab('text'); setMobile('assets') }}>Añadir texto primero</button>
          </div>}
        </div>
        <footer className="workspace-footer">
          <div className="footer-tools">
            <IconButton label="Seleccionar" aria-pressed={tool === 'select'} onClick={() => setTool('select')}><MousePointer2 size={17} /></IconButton>
            <IconButton label="Desplazar lienzo" aria-pressed={tool === 'pan'} onClick={() => setTool('pan')}><Hand size={17} /></IconButton>
            <details className="view-options"><summary aria-label="Opciones de lienzo" title="Opciones de lienzo"><Grid2X2 size={16} /><ChevronDown size={12} /></summary>
              <div className="view-menu">
                {viewOptions.map(([key, label]) => <label key={key}><input type="checkbox" checked={view[key]} onChange={(event) => setView({ ...view, [key]: event.target.checked })} />{label}</label>)}
                <label>Tamaño de cuadrícula<input type="number" min="8" max="200" value={view.gridSize} onChange={(event) => setView({ ...view, gridSize: Math.max(8, Math.min(200, Number(event.target.value))) })} /></label>
                <button type="button" onClick={() => setModal('print')}>Vista de impresión</button>
                <button type="button" onClick={() => setModal('present')}>Modo presentación</button>
              </div>
            </details>
          </div>
          <div className="zoom">
            <IconButton label="Alejar" onClick={() => zoomChange(zoom - .1)} disabled={zoom <= .1}><Minus size={17} /></IconButton>
            <input type="range" aria-label="Zoom" min=".1" max="5" step=".01" value={zoom} onChange={(event) => zoomChange(Number(event.target.value))} />
            <button type="button" className="zoom-fit" onClick={() => stage.current?.fit()} title="Ajustar a la pantalla">{Math.round(zoom * 100)}%</button>
            <IconButton label="Acercar" onClick={() => zoomChange(zoom + .1)} disabled={zoom >= 5}><Plus size={17} /></IconButton>
          </div>
          <div className="footer-size"><span>{dim.width} × {dim.height}</span><IconButton label="Ajustar a la pantalla" onClick={() => stage.current?.fit()}><Expand size={16} /></IconButton></div>
          <IconButton label="Propiedades y capas" className="mobile-props" onClick={() => setMobile(mobile === 'properties' ? undefined : 'properties')}><SlidersHorizontal size={19} /></IconButton>
        </footer>
        {status && <div className="toast" role="status"><span>{status}</span><IconButton label="Cerrar aviso" onClick={() => setStatus('')}><X size={16} /></IconButton></div>}
      </section>
      <div className="inspector-wrapper">
        <Inspector project={project} ids={ids} select={select} change={change} action={action} reorder={reorder}
          verification={verification} onReview={() => setModal('review')} onError={setStatus} />
        <IconButton label="Cerrar propiedades" className="mobile-panel-close" onClick={() => setMobile(undefined)}><X size={20} /></IconButton>
      </div>
    </main>
    {modal === 'review' && <ReviewDialog project={project} save={changeBusiness} close={onClose} />}
    {modal === 'export' && <ExportDialog project={project} ids={ids} verification={verification} close={onClose} />}
    {modal === 'format' && <FormatDialog project={project} update={changeFormat} close={onClose} />}
    {(modal === 'mockup' || modal === 'print' || modal === 'present') && <PreviewDialog project={project} initial={modal} close={onClose} />}
    {modal === 'history' && <Dialog title="Historial de cambios" onClose={onClose}>
      <div className="dialog-body field-stack">
        <div className="dialog-actions"><button type="button" className="button button-outline" disabled={!doc.canUndo} onClick={doc.undo}><Undo2 size={16} /> Deshacer</button>
          <button type="button" className="button button-outline" disabled={!doc.canRedo} onClick={doc.redo}><Redo2 size={16} /> Rehacer</button></div>
        <h3>Versiones guardadas</h3>
        {versions.map((version) => <button type="button" className="version-row" key={version.id} onClick={() => {
          doc.edit(() => normalizeReviewTarget(version.project)); select([]); onClose(); setStatus('Versión recuperada.')
        }}><History size={16} /><span>{new Date(version.savedAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</span><span>Restaurar</span></button>)}
      </div>
    </Dialog>}
    {modal === 'help' && <Dialog title="Atajos del editor" onClose={onClose}>
      <div className="dialog-body shortcut-list">
        {[['Deshacer / rehacer', 'Ctrl/⌘ Z / Mayús Z'], ['Copiar / pegar', 'Ctrl/⌘ C / V'], ['Duplicar', 'Ctrl/⌘ D'],
          ['Mover selección', 'Flechas'], ['Mover en pasos de 10 px', 'Mayús + flechas'], ['Eliminar', 'Supr'],
          ['Desplazar lienzo', 'Espacio + arrastrar'], ['Selección múltiple', 'Mayús + clic'], ['Zoom', 'Ctrl/⌘ + rueda']].map(([label, keys]) =>
          <div key={label}><span>{label}</span><kbd>{keys}</kbd></div>)}
      </div>
    </Dialog>}
  </div>
}
