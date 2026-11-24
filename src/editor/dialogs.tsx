import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, Check, ChevronRight, Download, Expand, Link2, MapPin, Printer, QrCode, Search } from 'lucide-react'
import { dimensions, formats, type Format, type Project } from '../model'
import { expandableGoogleLink, googlePlaceId, isGoogleMapsLink, isReviewsSectionLink, reviewsSectionLink, writeReviewLink } from '../googleReviews'
import { Dialog, NumberField } from '../components/ui'
import { makeDownload, download, previewImage, type OutputOptions, type OutputType, type Verification } from './output'
import { homography, mockups } from './mockups'

function ErrorStatus({ message }: { message: string }) {
  return message && <p className="form-error" role="alert"><AlertTriangle size={16} />{message}</p>
}

export function ReviewDialog({ project, save, close }: { project: Project; save: (business: string, url: string) => void; close: () => void }) {
  const [name, setName] = useState(project.business)
  const [url, setUrl] = useState(project.url)
  const [mode, setMode] = useState<'read' | 'write'>(project.url && !isReviewsSectionLink(project.url) ? 'write' : 'read')
  const reading = mode === 'read'
  const destination = reading ? reviewsSectionLink(url) : writeReviewLink(url)
  const [resolving, setResolving] = useState(false)
  const pendingResolution = useRef<AbortController | null>(null)
  useEffect(() => () => pendingResolution.current?.abort(), [])
  const [error, setError] = useState('')
  const [finding, setFinding] = useState(false)
  const searchAvailable = import.meta.env.VITE_ENABLE_PLACES_SEARCH === 'true'
  const [found, setFound] = useState<{ id: string; name: string; address: string }[]>([])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (resolving) return
    setError('')
    if (destination) {
      save(name.trim(), destination)
      close()
      return
    }
    if (!reading) {
      setError(isGoogleMapsLink(url)
        ? 'Este enlace de Maps no identifica el formulario de reseñas. Pega el enlace de Pedir reseñas o el Place ID.'
        : 'Introduce el enlace de reseñas de Google o un Place ID válido.')
      return
    }
    if (!googlePlaceId(url) && !expandableGoogleLink(url)) {
      setError('Pega el enlace completo de la ficha de Google Maps, el enlace directo de sus reseñas o un Place ID.')
      return
    }
    const controller = new AbortController()
    pendingResolution.current = controller
    setResolving(true)
    try {
      const response = await fetch(`/api/places/reviews?input=${encodeURIComponent(url.trim())}`, { signal: controller.signal })
      const result = await response.json().catch(() => null) as { url?: string; error?: string } | null
      if (!response.ok || !result?.url || !isReviewsSectionLink(result.url)) {
        throw new Error(result?.error || 'No pude resolver el enlace. Prueba con la dirección completa de la ficha en Google Maps.')
      }
      if (controller.signal.aborted) return
      save(name.trim(), result.url)
      close()
    } catch (failure) {
      if (!controller.signal.aborted) setError((failure as Error).message)
    } finally {
      if (!controller.signal.aborted) setResolving(false)
    }
  }
  async function findPlaces() {
    if (name.trim().length < 3) { setError('Escribe al menos tres caracteres del nombre del negocio.'); return }
    setFinding(true)
    setError('')
    try {
      const result = await fetch(`/api/places?q=${encodeURIComponent(name.trim())}`)
      if (!result.ok) throw new Error('Google Places no pudo completar la búsqueda.')
      const data = await result.json() as typeof found
      setFound(data)
      if (!data.length) setError('No encontramos establecimientos para ese nombre.')
    } catch (exception) { setError((exception as Error).message) }
    finally { setFinding(false) }
  }
  return <Dialog title="Vincula tu negocio" onClose={close}>
    <form className="dialog-body field-stack" onSubmit={(event) => void submit(event)}>
      <div className="segmented" role="group" aria-label="Destino del QR">
        <button type="button" aria-pressed={reading} disabled={resolving} onClick={() => { setMode('read'); setError('') }}>Ver reseñas</button>
        <button type="button" aria-pressed={!reading} disabled={resolving} onClick={() => { setMode('write'); setError('') }}>Escribir una reseña</button>
      </div>
      <p>{reading ? 'El código abre la sección de reseñas del negocio en Google Maps web.' : 'El código abre el formulario de Google para escribir una reseña.'}</p>
      <label>Enlace de reseñas o Place ID<input autoFocus value={url} disabled={resolving} onChange={(event) => { setUrl(event.target.value); setError('') }}
        placeholder={reading ? 'https://www.google.com/maps/place/…' : 'https://g.page/r/…/review'} maxLength={1200} required /></label>
      {destination && <p className="form-success" role="status"><Check size={16} /> {reading ? 'Sección de reseñas identificada' : 'Enlace directo de reseñas'}
        <a className="text-button" href={destination} target="_blank" rel="noreferrer">{reading ? 'Abrir reseñas' : 'Abrir formulario'}</a>
      </p>}
      <label>Nombre del negocio <span className="helper">(opcional)</span><input value={name} disabled={resolving} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Café Aurora" /></label>
      {searchAvailable && <button className="button button-outline" type="button" onClick={() => void findPlaces()} disabled={finding || resolving}>
        <Search size={16} />{finding ? 'Buscando…' : 'Buscar en Google Places'}
      </button>}
      {found.map((place) => <button className="place-result" type="button" key={place.id} disabled={resolving} onClick={() => {
        setUrl(place.id); setName(place.name); setFound([]); setError('')
      }}>
        <MapPin size={17} /><span><b>{place.name}</b><small>{place.address}</small></span><ChevronRight size={16} />
      </button>)}
      <p className="helper">{reading ? 'Para identificar el negocio, pega la dirección que aparece en el navegador al abrir su ficha en Maps.'
        : 'En tu Perfil de Empresa de Google, abre «Leer reseñas», elige «Pedir reseñas» y copia el enlace.'}</p>
      <ErrorStatus message={error} />
      <div className="dialog-actions"><button className="button button-outline" type="button" onClick={close}>Cancelar</button>
        <button className="button button-primary" type="submit" disabled={resolving || finding}><Link2 size={16} />
          {resolving ? 'Buscando reseñas…' : 'Vincular y generar'}</button></div>
    </form>
  </Dialog>
}

export function FormatDialog({ project, update, close }: { project: Project; update: (format: Format, bleed: number) => void; close: () => void }) {
  const [size, setSize] = useState(project.format)
  const [bleed, setBleed] = useState(project.bleed)
  const [error, setError] = useState('')
  const choose = (key: keyof Format, value: Format[keyof Format]) => setSize((before) => ({ ...before, name: 'Personalizado', [key]: value }))
  return <Dialog title="Dimensiones y sangrado" onClose={close}>
    <div className="dialog-body field-stack">
      <label>Formato<select value={formats.some((format) => format.name === size.name) ? size.name : 'Personalizado'}
        onChange={(event) => setSize(formats.find((format) => format.name === event.target.value) ?? { ...size, name: 'Personalizado' })}>
        <option>Personalizado</option>{formats.map((format) => <option key={format.name}>{format.name}</option>)}
      </select></label>
      <div className="field-columns">
        <NumberField label="Ancho del lienzo" value={size.width} min={1} max={5000} step={.1} change={(value) => choose('width', value)} />
        <NumberField label="Alto del lienzo" value={size.height} min={1} max={5000} step={.1} change={(value) => choose('height', value)} />
      </div>
      <div className="field-columns">
        <label>Unidad<select value={size.unit} onChange={(event) => choose('unit', event.target.value)}><option value="px">Píxeles</option>
          <option value="mm">Milímetros</option><option value="cm">Centímetros</option><option value="in">Pulgadas</option></select></label>
        <NumberField label="Sangrado (mm)" value={bleed} min={0} max={30} step={.1} change={setBleed} />
      </div>
      <label className="checkbox"><input type="checkbox" checked={size.circle ?? false} onChange={(event) => choose('circle', event.target.checked)} /> Recorte circular</label>
      <ErrorStatus message={error} />
      <div className="dialog-actions"><button type="button" className="button button-primary" onClick={() => {
        if (Object.values(dimensions(size)).some((value) => value < 32 || value > 5000)) {
          setError('Usa dimensiones equivalentes a entre 32 y 5000 píxeles por lado.'); return
        }
        update(size, bleed); close()
      }}>Aplicar dimensiones</button></div>
    </div>
  </Dialog>
}

export function ExportDialog({ project, ids, verification, close }: { project: Project; ids: string[]; verification: Verification; close: () => void }) {
  const [options, setOptions] = useState<OutputOptions>({ type: 'PNG', dpi: 300, quality: 94, bleed: false, transparent: false, scope: 'design' })
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const { width, height } = dimensions(project.format, options.dpi)
  const change = (value: Partial<OutputOptions>) => { setOptions((before) => ({ ...before, ...value })); setError(''); setMessage('') }
  async function exportDocument(event: FormEvent) {
    event.preventDefault()
    setError('')
    setWorking(true)
    try {
      const blob = await makeDownload(project, options, ids)
      download(blob, `${project.title}${options.scope === 'qr' ? '-QR' : ''}`, options.type)
      setMessage('Descarga preparada.')
    } catch (exception) { setError((exception as Error).message) }
    finally { setWorking(false) }
  }
  return <Dialog title="Exportar diseño" onClose={close}>
    <form className="dialog-body field-stack" onSubmit={(event) => void exportDocument(event)}>
      <div className="field-columns">
        <label>Tipo de archivo<select value={options.type} onChange={(event) => change({ type: event.target.value as OutputType })}>
          <option>PNG</option><option>JPG</option><option>SVG</option><option>PDF</option><option>JSON</option>
        </select></label>
        <label>Contenido<select value={options.scope} onChange={(event) => change({ scope: event.target.value as OutputOptions['scope'] })}>
          <option value="design">Diseño completo</option><option value="qr">Solo código QR</option>
          <option value="selected" disabled={!ids.length}>Elementos seleccionados</option>
        </select></label>
      </div>
      {['PNG', 'JPG', 'PDF'].includes(options.type) && <div className="field-columns">
        <NumberField label="Resolución (DPI)" value={options.dpi} min={36} max={600} change={(dpi) => change({ dpi: Math.round(dpi) })} />
        {options.type === 'JPG' && <NumberField label="Calidad (%)" value={options.quality} min={1} max={100} change={(quality) => change({ quality })} />}
      </div>}
      {(options.type === 'PNG' || options.type === 'SVG') && <label className="checkbox"><input type="checkbox" checked={options.transparent}
        onChange={(event) => change({ transparent: event.target.checked })} /> Conservar transparencia</label>}
      {options.scope === 'design' && options.type !== 'JSON' && <label className="checkbox"><input type="checkbox" checked={options.bleed}
        onChange={(event) => change({ bleed: event.target.checked })} /> Incluir sangrado de {project.bleed} mm</label>}
      {options.scope === 'design' && ['PNG', 'JPG', 'PDF'].includes(options.type) && <p className="helper">{width} × {height} px {options.bleed ? '+ sangrado' : ''}</p>}
      {options.type !== 'JSON' && project.layers.some((layer) => layer.kind === 'qr') && <div className={`verification ${verification.ok ? 'verified' : ''}`}>
        {verification.ok ? <Check size={17} /> : <QrCode size={17} />}<span>{verification.message}</span>
      </div>}
      <ErrorStatus message={error} />
      {message && <p className="form-success" role="status"><Check size={16} /> {message}</p>}
      <div className="dialog-actions"><button className="button button-outline" type="button" onClick={close}>Cerrar</button>
        <button className="button button-primary" type="submit" disabled={working}><Download size={17} />{working ? 'Verificando…' : 'Descargar'}</button></div>
    </form>
  </Dialog>
}

export function PreviewDialog({ project, initial, close }: { project: Project; initial: 'mockup' | 'print' | 'present'; close: () => void }) {
  const [mode, setMode] = useState(initial)
  const [asset, setAsset] = useState(mockups[0])
  const [src, setSrc] = useState('')
  const [error, setError] = useState('')
  const surface = useRef<HTMLDivElement>(null)
  const print = useRef<HTMLImageElement>(null)
  const [frame, setFrame] = useState({ width: 0, height: 0 })
  useEffect(() => {
    let mounted = true
    void previewImage(project).then((image) => { if (mounted) setSrc(image) })
      .catch((error: Error) => { if (mounted) setError(error.message) })
    return () => { mounted = false }
  }, [project])
  useEffect(() => {
    if (!surface.current) return
    const observer = new ResizeObserver(([entry]) => setFrame({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(surface.current)
    return () => observer.disconnect()
  }, [mode])
  const dims = dimensions(project.format)
  return <Dialog title={mode === 'present' ? 'Presentación' : 'Vista previa'} onClose={close} className={`preview-dialog ${mode === 'present' ? 'presentation' : ''}`}>
    <div className="dialog-body">
      <div className="preview-controls">
        <div className="segmented">{(['mockup', 'print', 'present'] as const).map((item) =>
          <button type="button" key={item} aria-pressed={mode === item} onClick={() => setMode(item)}>
            {{ mockup: 'En un negocio', print: 'Impresión', present: 'Presentación' }[item]}
          </button>)}</div>
        {mode === 'mockup' && <select aria-label="Elegir ambientación" value={asset.id} onChange={(event) => setAsset(mockups.find((mockup) => mockup.id === event.target.value)!)}>
          {mockups.map((mockup) => <option key={mockup.id} value={mockup.id}>{mockup.name}</option>)}
        </select>}
        {mode === 'present' && <button type="button" className="button button-outline" onClick={(event) => {
          void event.currentTarget.closest('dialog')?.requestFullscreen?.().catch(() => {})
        }}><Expand size={16} /> Pantalla completa</button>}
        {mode === 'print' && <button type="button" className="button button-outline" disabled={!src} onClick={() => window.print()}><Printer size={16} /> Imprimir</button>}
      </div>
      {mode === 'mockup' ? <div className="mockup">
        <div className="mockup-surface" ref={surface}>
          <img src={`/03-mockups/${asset.id}.webp`} alt={asset.name} />
          {src && frame.width > 0 && <img className={`mockup-insert ${asset.circle ? 'mockup-circle' : ''}`} src={src} alt="Tu diseño aplicado al mockup"
            style={{ transform: homography(asset.quad, frame.width, frame.height) }} />}
        </div>
      </div> : <div className={`paper-preview ${mode === 'print' ? 'print-preview' : ''}`}>
        {src && <img id="print-design" ref={print} src={src} alt="Diseño actual" style={{ borderRadius: project.format.circle ? '50%' : 0, aspectRatio: `${dims.width} / ${dims.height}` }} />}
        {mode === 'print' && <p className="helper">{project.format.width} × {project.format.height} {project.format.unit} · Sangrado de {project.bleed} mm</p>}
      </div>}
      <ErrorStatus message={error} />
    </div>
  </Dialog>
}
