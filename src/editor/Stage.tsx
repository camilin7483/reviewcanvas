import { useEffect, useImperativeHandle, useRef, useState, type DragEvent, type Ref } from 'react'
import { ActiveSelection, Canvas, Ellipse, Group, IText, Point, Rect } from 'fabric'
import { dimensions, type Layer, type Project } from '../model'
import { prepareFonts } from './assets'
import { activeIds, createObject, flattenGroup, objectData, serializeObject } from './scene'

export type StageSettings = { grid: boolean; gridSize: number; rulers: boolean; guides: boolean; snap: boolean; safe: boolean }
export type StageHandle = { fit: () => void; arrange: (direction: string) => void; ungroup: () => Layer[] | null }
type Props = {
  project: Project; ids: string[]; zoom: number; tool: 'select' | 'pan'; view: StageSettings;
  onSelect: (ids: string[]) => void; onCommit: (layers: Layer[]) => void; onZoom: (zoom: number) => void;
  onDropAsset: (id: string, x: number, y: number) => void; onError: (message: string) => void; ref: Ref<StageHandle>
}
type Box = { left: number; top: number; width: number; height: number }
const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id))

export function Stage(props: Props) {
  const host = useRef<HTMLDivElement>(null)
  const stage = useRef<Canvas | null>(null)
  const element = useRef<HTMLCanvasElement>(null)
  const settings = useRef(props)
  settings.current = props
  const cached = useRef<{ layers: Layer[]; link: string; fonts: Project['importedFonts'] } | null>(null)
  const pan = useRef({ x: 0, y: 0 })
  const frame = useRef({ width: 1, height: 1 })
  const animation = useRef(0)
  const suppress = useRef(false)
  const [paper, setPaper] = useState<Box>()
  const [guides, setGuides] = useState<{ x?: number; y?: number; distance?: number }>({})
  const [loaded, setLoaded] = useState(false)
  const dims = dimensions(props.project.format)

  function viewBox(scale = settings.current.zoom) {
    const canvas = stage.current
    if (!canvas) return
    const { width, height } = dimensions(settings.current.project.format)
    const left = (frame.current.width - width * scale) / 2 + pan.current.x
    const top = (frame.current.height - height * scale) / 2 + pan.current.y
    canvas.setViewportTransform([scale, 0, 0, scale, left, top])
    canvas.requestRenderAll()
    setPaper({ left, top, width: width * scale, height: height * scale })
  }

  function fit() {
    const { width, height } = dimensions(settings.current.project.format)
    const { width: viewportWidth, height: viewportHeight } = frame.current
    pan.current = { x: 0, y: 0 }
    const scale = Math.max(.1, Math.min(1.25, (viewportWidth - 64) / width, (viewportHeight - 78) / height))
    settings.current.onZoom(scale)
    viewBox(scale)
  }

  function emit() {
    const canvas = stage.current
    if (!canvas) return
    const ids = activeIds(canvas)
    suppress.current = true
    if (ids.length > 1) canvas.discardActiveObject()
    const layers = canvas.getObjects().map((object) => serializeObject(object))
    cached.current = { layers, link: settings.current.project.url, fonts: settings.current.project.importedFonts }
    settings.current.onCommit(layers)
    if (ids.length > 1) select(ids)
    suppress.current = false
  }

  function select(ids: string[]) {
    const canvas = stage.current
    if (!canvas || sameIds(activeIds(canvas), ids)) return
    const before = suppress.current
    suppress.current = true
    canvas.discardActiveObject()
    const objects = canvas.getObjects().filter((object) => object.visible && ids.includes(objectData.get(object)?.layer.id ?? ''))
    if (objects.length === 1) canvas.setActiveObject(objects[0])
    if (objects.length > 1) canvas.setActiveObject(new ActiveSelection(objects.filter((object) => !object.lockMovementX), { canvas }))
    canvas.requestRenderAll()
    suppress.current = before
  }

  useImperativeHandle(props.ref, () => ({
    fit,
    arrange(direction) {
      const canvas = stage.current
      if (!canvas) return
      const arrangementIds = activeIds(canvas)
      suppress.current = true
      canvas.discardActiveObject()
      const objects = canvas.getObjects().filter((object) => arrangementIds.includes(objectData.get(object)!.layer.id) && !object.lockMovementX)
      if (!objects.length) { suppress.current = false; return }
      const bounds = objects.map((object) => object.getBoundingRect())
      const page = dimensions(settings.current.project.format)
      const x = { left: Math.min(...bounds.map((box) => box.left)), right: Math.max(...bounds.map((box) => box.left + box.width)) }
      const y = { top: Math.min(...bounds.map((box) => box.top)), bottom: Math.max(...bounds.map((box) => box.top + box.height)) }
      const only = objects.length === 1
      const distribute = direction.startsWith('spread')
      const side = direction === 'spreadX' ? 'left' : 'top'
      const sort = bounds.map((box, index) => ({ box, index })).sort((first, second) => first.box[side] - second.box[side])
      const first = sort[0].box[side], last = sort.at(-1)!.box[side]
      for (const [index, object] of objects.entries()) {
        const box = bounds[index]
        if (distribute) {
          const rank = sort.findIndex((entry) => entry.index === index)
          object[side] += first + (last - first) * rank / Math.max(1, objects.length - 1) - box[side]
        }
        if (direction === 'left') object.left += (only ? 0 : x.left) - box.left
        if (direction === 'center') object.left += (only ? page.width / 2 : (x.left + x.right) / 2) - (box.left + box.width / 2)
        if (direction === 'right') object.left += (only ? page.width : x.right) - (box.left + box.width)
        if (direction === 'top') object.top += (only ? 0 : y.top) - box.top
        if (direction === 'middle') object.top += (only ? page.height / 2 : (y.top + y.bottom) / 2) - (box.top + box.height / 2)
        if (direction === 'bottom') object.top += (only ? page.height : y.bottom) - (box.top + box.height)
        object.setCoords()
      }
      select(arrangementIds)
      suppress.current = false
      canvas.requestRenderAll()
      emit()
    },
    ungroup() {
      const canvas = stage.current
      const active = canvas?.getActiveObject()
      if (!(active instanceof Group) || active instanceof ActiveSelection) return null
      if (objectData.get(active)?.layer.kind !== 'group') return null
      return flattenGroup(active)
    },
  }))

  useEffect(() => {
    const canvas = new Canvas(element.current!, {
      preserveObjectStacking: true, renderOnAddRemove: false, selectionColor: '#397dd21a',
      selectionBorderColor: '#397dd2', stopContextMenu: true, enableRetinaScaling: true,
      allowTouchScrolling: false,
    })
    stage.current = canvas
    let previous: Point | null = null
    let space = false
    const setMode = () => {
      canvas.skipTargetFind = space || settings.current.tool === 'pan'
      canvas.selection = !canvas.skipTargetFind
      canvas.defaultCursor = canvas.skipTargetFind ? 'grab' : 'default'
      canvas.setCursor(canvas.defaultCursor)
    }
    const resized = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (!width || !height) return
      frame.current = { width, height }
      canvas.setDimensions({ width: Math.floor(width), height: Math.floor(height) })
      if (!loadedRef.current) { loadedRef.current = true; fit() } else viewBox()
    })
    resized.observe(host.current!)
    const selectionChanged = () => { if (!suppress.current) settings.current.onSelect(activeIds(canvas)) }
    canvas.on('selection:created', selectionChanged)
    canvas.on('selection:updated', selectionChanged)
    canvas.on('selection:cleared', selectionChanged)
    canvas.on('object:modified', emit)
    canvas.on('mouse:down', ({ e, viewportPoint }) => {
      if (space || settings.current.tool === 'pan' || ('button' in e && e.button === 1)) {
        previous = viewportPoint
        canvas.setCursor('grabbing')
        e.preventDefault()
      }
    })
    canvas.on('mouse:move', ({ viewportPoint }) => {
      if (!previous) return
      pan.current.x += viewportPoint.x - previous.x
      pan.current.y += viewportPoint.y - previous.y
      previous = viewportPoint
      viewBox()
    })
    canvas.on('mouse:up', () => {
      previous = null
      setMode()
      setGuides({})
    })
    canvas.on('mouse:wheel', ({ e, viewportPoint }) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const current = settings.current.zoom
        const next = Math.min(5, Math.max(.1, current * .998 ** e.deltaY))
        const { width, height } = frame.current
        pan.current.x = viewportPoint.x - width / 2 - (viewportPoint.x - width / 2 - pan.current.x) * next / current
        pan.current.y = viewportPoint.y - height / 2 - (viewportPoint.y - height / 2 - pan.current.y) * next / current
        settings.current.onZoom(next)
        viewBox(next)
      } else {
        pan.current.x -= e.deltaX
        pan.current.y -= e.deltaY
        viewBox()
      }
    })
    canvas.on('object:moving', ({ target, e }) => {
      const { view, zoom, project } = settings.current
      if (!view.guides && !view.snap) return
      const { width, height } = dimensions(project.format)
      const candidatesX = [width / 2, 0, width], candidatesY = [height / 2, 0, height]
      for (const object of canvas.getObjects()) {
        if (object === target || !object.visible || object.group === target) continue
        const { left, top, width, height } = object.getBoundingRect()
        candidatesX.push(left, left + width / 2, left + width)
        candidatesY.push(top, top + height / 2, top + height)
      }
      const box = target.getBoundingRect()
      const tolerance = 5 / zoom
      function nearest(points: number[], candidates: number[]) {
        let best: { at: number; move: number } | undefined
        for (const point of points) for (const at of candidates) {
          const move = at - point
          if (Math.abs(move) < tolerance && (!best || Math.abs(move) < Math.abs(best.move))) best = { at, move }
        }
        return best
      }
      if (view.grid) {
        candidatesX.push(Math.round(target.left / view.gridSize) * view.gridSize)
        candidatesY.push(Math.round(target.top / view.gridSize) * view.gridSize)
      }
      const x = nearest([box.left, box.left + box.width / 2, box.left + box.width], candidatesX)
      const y = nearest([box.top, box.top + box.height / 2, box.top + box.height], candidatesY)
      if (view.snap && !e.altKey) {
        if (x) target.left += x.move
        if (y) target.top += y.move
        target.setCoords()
      }
      if (view.guides) setGuides({ x: x?.at, y: y?.at, distance: Math.round(Math.max(0, box.left)) })
    })
    const press = (event: KeyboardEvent) => {
      const active = canvas.getActiveObject()
      if (event.code !== 'Space' || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
        || event.target instanceof HTMLButtonElement || event.target instanceof HTMLSelectElement
        || (active instanceof IText && active.isEditing)) return
      event.preventDefault()
      space = true
      setMode()
    }
    const release = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      space = false
      previous = null
      setMode()
    }
    const blur = () => { space = false; previous = null; setMode(); setGuides({}) }
    window.addEventListener('keydown', press)
    window.addEventListener('keyup', release)
    window.addEventListener('blur', blur)
    return () => {
      stage.current = null
      cached.current = null
      animation.current++
      resized.disconnect()
      window.removeEventListener('keydown', press)
      window.removeEventListener('keyup', release)
      window.removeEventListener('blur', blur)
      void canvas.dispose()
    }
  // Se utiliza la configuración actual desde una referencia durante los eventos del lienzo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const loadedRef = useRef(false)

  useEffect(() => {
    const canvas = stage.current
    if (!canvas) return
    const active = props.tool === 'pan'
    canvas.skipTargetFind = active
    canvas.selection = !active
    canvas.defaultCursor = active ? 'grab' : 'default'
    canvas.setCursor(canvas.defaultCursor)
  }, [props.tool])

  useEffect(() => {
    const canvas = stage.current
    if (!canvas) return
    const options = { left: 0, top: 0, originX: 'left' as const, originY: 'top' as const, strokeWidth: 0 }
    canvas.clipPath = props.project.format.circle
      ? new Ellipse({ ...options, rx: dims.width / 2, ry: dims.height / 2 })
      : new Rect({ ...options, width: dims.width, height: dims.height })
    viewBox()
  }, [props.project.format.circle, dims.width, dims.height])
  useEffect(() => { viewBox() }, [props.zoom])
  useEffect(() => { fit() }, [dims.width, dims.height])
  useEffect(() => { select(props.ids) }, [props.ids])

  useEffect(() => {
    const canvas = stage.current
    if (!canvas) return
    const { layers, url, importedFonts } = props.project
    const last = cached.current
    if (last?.layers === layers && last.link === url && last.fonts === importedFonts) return
    const rendering = ++animation.current
    const sameLink = last?.link === url
    const sameFonts = last?.fonts === importedFonts
    const ready = new Map(canvas.getObjects().map((object) => [objectData.get(object)?.layer, object]))
    void (async () => {
      await prepareFonts(props.project)
      const stack = await Promise.all(layers.map((layer) =>
        sameLink && sameFonts && ready.get(layer) || createObject(layer, url)))
      if (rendering !== animation.current || stage.current !== canvas) return
      suppress.current = true
      canvas.discardActiveObject()
      canvas.remove(...canvas.getObjects())
      canvas.add(...stack)
      cached.current = { layers, link: url, fonts: importedFonts }
      select(settings.current.ids)
      suppress.current = false
      canvas.requestRenderAll()
      setLoaded(true)
    })().catch((error: unknown) => {
      if (rendering === animation.current) settings.current.onError(error instanceof Error ? error.message : 'No se pudo abrir el diseño.')
    })
    return () => { animation.current++ }
  }, [props.project.layers, props.project.url, props.project.importedFonts])

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const id = event.dataTransfer.getData('application/reviewcanvas-element')
    const box = host.current?.getBoundingClientRect()
    if (id && box && paper) props.onDropAsset(id, (event.clientX - box.left - paper.left) / props.zoom, (event.clientY - box.top - paper.top) / props.zoom)
  }

  const grid = props.view.gridSize * props.zoom
  const margin = 23 * props.zoom
  return <div className={`stage ${props.tool === 'pan' ? 'stage-pan' : ''}`} ref={host} onDragOver={(event) => event.preventDefault()} onDrop={drop}>
    {paper && <div className={`paper-edge ${props.project.format.circle ? 'paper-round' : ''}`} style={paper} />}
    <div className="fabric-host"><canvas ref={element} aria-label="Lienzo de diseño" /></div>
    {paper && props.view.grid && <div className="page-grid" style={{ ...paper, backgroundSize: `${grid}px ${grid}px` }} />}
    {paper && props.view.safe && <div className="safe-guides" style={{
      left: paper.left + margin, top: paper.top + margin,
      width: Math.max(1, paper.width - 2 * margin), height: Math.max(1, paper.height - 2 * margin),
      borderRadius: props.project.format.circle ? '50%' : 0,
    }} />}
    {paper && props.view.rulers && <>
      <div className="ruler ruler-x">{Array.from({ length: 21 }, (_, i) => {
        const value = i * 50
        return <span key={value} style={{ left: paper.left + value * props.zoom }}>{value}</span>
      })}</div>
      <div className="ruler ruler-y">{Array.from({ length: 41 }, (_, i) => {
        const value = i * 50
        return <span key={value} style={{ top: paper.top + value * props.zoom }}>{value}</span>
      })}</div>
    </>}
    {paper && guides.x !== undefined && <div className="guide guide-x" style={{ left: paper.left + guides.x * props.zoom }} />}
    {paper && guides.y !== undefined && <div className="guide guide-y" style={{ top: paper.top + guides.y * props.zoom }} />}
    {guides.distance !== undefined && <div className="distance">{guides.distance} px</div>}
    {!loaded && <div className="stage-loading" role="status">Preparando el lienzo…</div>}
  </div>
}
