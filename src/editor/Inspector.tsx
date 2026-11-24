import { useState } from 'react'
import { AlignCenter, AlignEndHorizontal, AlignEndVertical, AlignLeft, AlignRight, AlignStartHorizontal, AlignStartVertical,
  ArrowDown, ArrowUp, Bold, BringToFront, ChevronDown, Copy, Eye, EyeOff, FlipHorizontal2, FlipVertical2, GripVertical,
  Group, Italic, Layers3, LockKeyhole, LockKeyholeOpen, MoveHorizontal, MoveVertical, QrCode, SendToBack, Shapes,
  Square, Trash2, Type, Underline, Ungroup } from 'lucide-react'
import { colors, fonts, type Layer, type Project, type QrStyle } from '../model'
import { ColorField, FileField, IconButton, NumberField } from '../components/ui'
import { readRaster } from './assets'
import type { Verification } from './output'

type InspectorProps = {
  project: Project; ids: string[]; select: (ids: string[]) => void; change: (id: string, edit: (layer: Layer) => Layer) => void;
  action: (action: string) => void; reorder: (source: string, target: string) => void;
  verification: Verification; onReview: () => void; onError: (message: string) => void;
}

const iconSize = 16
const actionList = [
  ['duplicate', 'Duplicar', Copy], ['delete', 'Eliminar', Trash2], ['front', 'Traer al frente', BringToFront],
  ['back', 'Enviar al fondo', SendToBack], ['up', 'Subir una capa', ArrowUp], ['down', 'Bajar una capa', ArrowDown],
  ['flipX', 'Voltear horizontalmente', FlipHorizontal2], ['flipY', 'Voltear verticalmente', FlipVertical2],
  ['group', 'Agrupar', Group], ['ungroup', 'Desagrupar', Ungroup],
] as const
const alignments = [
  ['left', 'Alinear a la izquierda', AlignLeft], ['center', 'Centrar horizontalmente', AlignCenter], ['right', 'Alinear a la derecha', AlignRight],
  ['top', 'Alinear arriba', AlignStartVertical], ['middle', 'Centrar verticalmente', AlignStartHorizontal], ['bottom', 'Alinear abajo', AlignEndVertical],
  ['spreadX', 'Distribuir horizontalmente', MoveHorizontal], ['spreadY', 'Distribuir verticalmente', MoveVertical],
] as const

export function QrControls({ style, update, onError }: { style: QrStyle; update: (delta: Partial<QrStyle>) => void; onError: (error: string) => void }) {
  return <div className="field-stack">
    <div className="field-columns"><ColorField label="Módulos" value={style.ink} change={(ink) => update({ ink })} />
      <ColorField label="Fondo QR" value={style.paper} change={(paper) => update({ paper })} /></div>
    <div className="field-columns">
      <label>Forma de módulos<select value={style.dots} onChange={(event) => update({ dots: event.target.value as QrStyle['dots'] })}>
        {Object.entries({ square: 'Cuadrados', rounded: 'Redondeados', dots: 'Circulares', classy: 'Combinados',
          'classy-rounded': 'Combinados suaves', 'extra-rounded': 'Muy redondeados' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Esquinas<select value={style.corners} onChange={(event) => update({ corners: event.target.value as QrStyle['corners'] })}>
        <option value="square">Cuadradas</option><option value="dot">Circulares</option><option value="extra-rounded">Redondeadas</option>
      </select></label>
    </div>
    <div className="field-columns">
      <NumberField label="Margen (%)" value={style.margin} min={0} max={28} change={(margin) => update({ margin })} />
      <label>Corrección QR<select value={style.error} onChange={(event) => update({ error: event.target.value as QrStyle['error'] })}>
        <option value="L">L · 7 %</option><option value="M">M · 15 %</option><option value="Q">Q · 25 %</option><option value="H">H · 30 %</option>
      </select></label>
    </div>
    <div className="check-list">
      <label><input type="checkbox" checked={style.transparent} onChange={(event) => update({ transparent: event.target.checked })} /> Fondo transparente</label>
      <label><input type="checkbox" checked={style.frame} onChange={(event) => update({ frame: event.target.checked })} /> Marco exterior</label>
      <label><input type="checkbox" checked={style.gradient} onChange={(event) => update({ gradient: event.target.checked })} /> Degradado</label>
    </div>
    {style.gradient && <ColorField label="Color de acento" value={style.accent} change={(accent) => update({ accent })} />}
    <div className="logo-field"><FileField label="Importar logo del QR" accept="image/png,image/jpeg,image/webp" change={(file) => {
      void readRaster(file).then(({ value }) => update({ logo: value, error: 'H' })).catch((error: Error) => onError(error.message))
    }} />{style.logo && <IconButton label="Quitar logo" onClick={() => update({ logo: undefined })}><Trash2 size={16} /></IconButton>}</div>
  </div>
}

function FileColor({ layer, patch }: { layer: Layer; patch: (values: Partial<Layer>) => void }) {
  if (layer.kind === 'rect' || layer.kind === 'text') return <ColorField label="Color" value={layer.fill} change={(fill) => patch({ fill })} />
  if (layer.kind === 'vector') return <ColorField label="Color de decoración" value={layer.tint ?? colors.forest} change={(tint) => patch({ tint })} />
  return null
}

export function Inspector({ project, ids, select, change, action, reorder, verification, onReview, onError }: InspectorProps) {
  const current = ids.length === 1 ? project.layers.find((layer) => layer.id === ids[0]) : undefined
  const [dragging, setDragging] = useState<string>()
  const patch = (values: Partial<Layer>) => current && change(current.id, (layer) => ({ ...layer, ...values }) as Layer)
  function selectRow(id: string, multi: boolean) {
    select(multi ? ids.includes(id) ? ids.filter((chosen) => chosen !== id) : [...ids, id] : [id])
  }

  return <aside className="inspector" aria-label="Propiedades y capas">
    <section className="inspector-properties">
      <div className="panel-heading"><h2>Propiedades</h2>{ids.length > 1 && <span>{ids.length} seleccionadas</span>}</div>
      {(current || ids.length > 0) && <div className="object-actions">
        {actionList.map(([key, label, Icon]) => <IconButton key={key} label={label} onClick={() => action(key)}
          disabled={key === 'group' ? ids.length < 2 : key === 'ungroup' ? current?.kind !== 'group' : false}><Icon size={iconSize} /></IconButton>)}
      </div>}
      {current ? <>
        <div className="inspector-block">
          <h3>Posición y tamaño</h3>
          <div className="field-columns">
            <NumberField label="X" value={current.x} min={-12000} max={12000} change={(x) => patch({ x })} />
            <NumberField label="Y" value={current.y} min={-12000} max={12000} change={(y) => patch({ y })} />
            <NumberField label="Ancho" value={current.w} min={1} max={10000} change={(w) => patch({ w, ...(current.kind === 'qr' ? { h: w } : {}) })} />
            <NumberField label="Alto" value={current.h} min={1} max={10000} change={(h) => patch({ h, ...(current.kind === 'qr' ? { w: h } : {}) })} />
          </div>
          <div className="field-columns space-mini">
            <NumberField label="Giro" value={current.angle} min={-360} max={360} change={(angle) => patch({ angle })} />
            <FileColor layer={current} patch={patch} />
          </div>
          <label className="range-field"><span>Opacidad <strong>{Math.round(current.opacity * 100)}%</strong></span>
            <input type="range" min="0" max="1" step=".01" value={current.opacity} onChange={(event) => patch({ opacity: Number(event.target.value) })} /></label>
        </div>
        {current.kind === 'qr' && <div className="inspector-block">
          <div className="linked-status"><QrCode size={17} /><span>{project.url ? verification.ok ? 'QR verificado' : 'QR vinculado' : 'QR de muestra'}</span>
            <button type="button" className="text-button" onClick={onReview}>{project.url ? 'Editar enlace' : 'Vincular'}</button></div>
          <details><summary>Personalizar QR <ChevronDown size={15} /></summary>
            <QrControls style={current.style} update={(values) => patch({ style: { ...current.style, ...values } })} onError={onError} />
          </details>
        </div>}
        {current.kind === 'text' && <div className="inspector-block field-stack">
          <h3>Tipografía</h3>
          <label>Contenido<textarea aria-label="Contenido de texto" key={current.id} value={current.text} rows={2} maxLength={2000}
            onChange={(event) => patch({ text: event.target.value })} /></label>
          <label>Fuente<select value={current.font} onChange={(event) => patch({ font: event.target.value })}>
            {[...new Set([current.font, ...fonts, ...project.importedFonts.map((font) => font.name)])].map((font) => <option key={font}>{font}</option>)}
          </select></label>
          <div className="field-columns">
            <NumberField label="Tamaño" value={current.size} min={4} max={460} change={(size) => patch({ size })} />
            <NumberField label="Peso" value={current.weight} min={100} max={900} step={50} change={(weight) => patch({ weight })} />
          </div>
          <div className="object-actions">
            <IconButton label="Negrita" aria-pressed={current.weight >= 700} onClick={() => patch({ weight: current.weight >= 700 ? 400 : 700 })}><Bold size={16} /></IconButton>
            <IconButton label="Cursiva" aria-pressed={current.italic} onClick={() => patch({ italic: !current.italic })}><Italic size={16} /></IconButton>
            <IconButton label="Subrayado" aria-pressed={current.underline} onClick={() => patch({ underline: !current.underline })}><Underline size={16} /></IconButton>
            <IconButton label="Convertir a mayúsculas" onClick={() => patch({ text: current.text.toLocaleUpperCase() })}>AA</IconButton>
            <IconButton label="Convertir a minúsculas" onClick={() => patch({ text: current.text.toLocaleLowerCase() })}>aa</IconButton>
          </div>
          <label>Alineación de texto<select value={current.align} onChange={(event) => patch({ align: event.target.value as typeof current.align })}>
            <option value="left">Izquierda</option><option value="center">Centrada</option><option value="right">Derecha</option><option value="justify">Justificada</option>
          </select></label>
          <details><summary>Ajustes avanzados <ChevronDown size={15} /></summary>
            <div className="field-columns">
              <NumberField label="Interlineado" value={current.leading} min={.5} max={3} step={.05} change={(leading) => patch({ leading })} />
              <NumberField label="Espaciado" value={current.tracking} min={-250} max={1100} change={(tracking) => patch({ tracking })} />
              <NumberField label="Curvatura" value={current.curve ?? 0} min={-100} max={100} change={(curve) => patch({ curve })} />
              <NumberField label="Contorno" value={current.outlineWidth ?? 0} min={0} max={12} change={(outlineWidth) => patch({ outlineWidth, outline: current.outline ?? colors.forest })} />
            </div>
            <ColorField label="Color de contorno" value={current.outline ?? colors.forest} change={(outline) => patch({ outline })} />
            <label className="checkbox"><input type="checkbox" checked={current.shadow ?? false} onChange={(event) => patch({ shadow: event.target.checked })} /> Sombra</label>
          </details>
        </div>}
      </> : !ids.length && <p className="selection-empty">Selecciona un elemento para editar sus propiedades.</p>}
      {ids.length > 0 && <details className="align-controls"><summary>Alinear y distribuir <ChevronDown size={15} /></summary><div className="object-actions">
        {alignments.map(([key, label, Icon]) => <IconButton key={key} label={label} disabled={key.startsWith('spread') && ids.length < 3} onClick={() => action(key)}><Icon size={iconSize} /></IconButton>)}
      </div></details>}
    </section>
    <section className="layers">
      <div className="panel-heading"><h2><Layers3 size={17} /> Capas</h2><span>{project.layers.length}</span></div>
      {[...project.layers].reverse().map((layer) => {
        const Icon = layer.kind === 'text' ? Type : layer.kind === 'qr' ? QrCode : layer.kind === 'group' ? Group : layer.kind === 'rect' ? Square : Shapes
        const visible = !layer.hidden
        return <div key={layer.id} className={`layer-row ${ids.includes(layer.id) ? 'layer-active' : ''} ${visible ? '' : 'layer-hidden'}`}
          draggable onDragStart={(event) => { event.dataTransfer.setData('application/reviewcanvas-layer', layer.id); setDragging(layer.id) }}
          onDragEnd={() => setDragging(undefined)} onDragOver={(event) => { if (dragging) event.preventDefault() }}
          onDrop={(event) => { event.preventDefault(); if (dragging) reorder(dragging, layer.id); setDragging(undefined) }}>
          <GripVertical aria-hidden="true" size={12} className="layer-grip" />
          <button type="button" className="layer-select" aria-pressed={ids.includes(layer.id)} title={layer.name}
            onClick={(event) => selectRow(layer.id, event.shiftKey || event.ctrlKey || event.metaKey)}><Icon size={15} /><span>{layer.name}</span></button>
          <IconButton label={visible ? `Ocultar ${layer.name}` : `Mostrar ${layer.name}`} onClick={() => change(layer.id, (item) => ({ ...item, hidden: visible }))}>
            {visible ? <Eye size={13} /> : <EyeOff size={13} />}
          </IconButton>
          <IconButton label={layer.locked ? `Desbloquear ${layer.name}` : `Bloquear ${layer.name}`} onClick={() => change(layer.id, (item) => ({ ...item, locked: !item.locked }))}>
            {layer.locked ? <LockKeyhole size={13} /> : <LockKeyholeOpen size={13} />}
          </IconButton>
        </div>
      })}
      {!project.layers.length && <p className="selection-empty">Los elementos que añadas aparecerán aquí.</p>}
    </section>
  </aside>
}
