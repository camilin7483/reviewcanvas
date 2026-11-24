import { dimensions, findQr, reviewLink, scales, type Project } from '../model'
import { objectData, renderProject } from './scene'
import { qrContrast, readQr, standaloneQr } from './qr'
import { vectorUrl } from '../library/vectors'
import { Group, type FabricObject } from 'fabric'

export type Verification = { ok: boolean; message: string; warnings: string[] }
export type OutputType = 'PNG' | 'JPG' | 'SVG' | 'PDF' | 'JSON'
export type OutputOptions = { type: OutputType; dpi: number; quality: number; bleed: boolean; transparent: boolean; scope: 'design' | 'qr' | 'selected' }

function expand(objects: FabricObject[]): FabricObject[] {
  return objects.flatMap((obj) => obj.visible
    ? objectData.get(obj)?.layer.kind === 'group' && obj instanceof Group ? expand(obj.getObjects()) : [obj]
    : [])
}

export async function verifyProject(project: Project, resolution = 1): Promise<Verification> {
  const codes = findQr(project.layers)
  if (!codes.length) return { ok: false, message: 'Añade un código QR al diseño.', warnings: [] }
  const direct = reviewLink(project.url)
  if (!direct) return { ok: false, message: 'Vincula el enlace directo de reseñas para verificar el QR.', warnings: [] }
  const canvas = await renderProject(project)
  const warnings = new Set<string>()
  const objects = expand(canvas.getObjects())
  let count = 0
  try {
    for (const [index, obj] of objects.entries()) {
      const layer = objectData.get(obj)?.layer
      if (layer?.kind !== 'qr') continue
      const { left, top, width, height } = obj.getBoundingRect()
      const x = Math.max(0, left), y = Math.max(0, top)
      const w = Math.min(canvas.width, left + width) - x, h = Math.min(canvas.height, top + height) - y
      if (left < -1 || top < -1 || left + width > canvas.width + 1 || top + height > canvas.height + 1) {
        warnings.add('Coloca el código completo dentro del cartel.')
      }
      if (project.format.circle && obj.getCoords().some((point) =>
        ((point.x - canvas.width / 2) / (canvas.width / 2)) ** 2 + ((point.y - canvas.height / 2) / (canvas.height / 2)) ** 2 > 1)) {
        warnings.add('El recorte circular invade la zona de silencio del código.')
      }
      if (qrContrast(layer.style) < 3) warnings.add('Aumenta el contraste entre los módulos y el fondo.')
      if (layer.style.margin < 8 || (layer.style.frame && layer.style.margin < 12)) warnings.add('Amplía el margen del código para proteger su zona de silencio.')
      if (obj.opacity < .85) warnings.add('Sube la opacidad del código para mejorar la lectura.')
      if (objects.slice(index + 1).some((other) => other.intersectsWithObject(obj))) warnings.add('Una capa superior invade la zona del QR. Muévela o envíala detrás.')
      if (w < 24 || h < 24) continue
      const crop = canvas.toCanvasElement(Math.min(resolution * 2, 1100 / Math.max(w, h)), { left: x, top: y, width: w, height: h })
      // La misma comprobación se ejecuta sobre el resultado de composición.
      if (await readQr(crop) === direct) count++
    }
    return { ok: count === codes.length,
      message: count === codes.length ? (codes.length === 1 ? 'QR verificado con ZXing.' : `${count} códigos verificados con ZXing.`)
        : 'No se pudo leer el QR del diseño. Revisa el contraste, el tamaño y las capas.',
      warnings: [...warnings],
    }
  } finally { await canvas.dispose() }
}

export async function selectedProject(project: Project, ids: string[]): Promise<Project> {
  const canvas = await renderProject(project)
  try {
    const objects = canvas.getObjects().filter((object) => ids.includes(objectData.get(object)?.layer.id ?? ''))
    if (!objects.length) throw new Error('Selecciona uno o varios elementos en el lienzo.')
    const bounds = objects.map((object) => object.getBoundingRect())
    const left = Math.floor(Math.min(...bounds.map((box) => box.left)))
    const top = Math.floor(Math.min(...bounds.map((box) => box.top)))
    const width = Math.ceil(Math.max(...bounds.map((box) => box.left + box.width))) - left
    const height = Math.ceil(Math.max(...bounds.map((box) => box.top + box.height))) - top
    return {
      ...project, format: { name: 'Selección', width, height, unit: 'px' as const },
      layers: project.layers.filter((layer) => ids.includes(layer.id)).map((layer) => ({ ...layer, x: layer.x - left, y: layer.y - top })),
    }
  } finally { await canvas.dispose() }
}

export async function previewImage(project: Project, maxSize = 900) {
  const scene = await renderProject(project)
  try {
    const ratio = Math.min(1, maxSize / Math.max(scene.width, scene.height))
    return scene.toCanvasElement(ratio).toDataURL('image/png')
  } finally { await scene.dispose() }
}

const outputLimits = (width: number, height: number) => {
  if (width < 1 || height < 1 || width > 16000 || height > 16000 || width * height > 32_000_000) {
    throw new Error('Reduce las dimensiones o la resolución para exportar hasta 32 megapíxeles.')
  }
}

function imageBlob(canvas: HTMLCanvasElement, mime: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) =>
    blob ? resolve(blob) : reject(new Error('El navegador no pudo codificar esta imagen.')), mime, quality))
}

export async function makeDownload(project: Project, options: OutputOptions, ids: string[]) {
  const { type, dpi, quality, transparent, scope } = options
  if (scope === 'qr') {
    const all = findQr(project.layers)
    const code = all.find((item) => ids.includes(item.id)) ?? all[0]
    if (!code) throw new Error('Añade un código QR al diseño.')
    const direct = reviewLink(project.url)
    if (!direct) throw new Error('Vincula el enlace directo de reseñas antes de exportar.')
    if (type === 'JSON') return new Blob([JSON.stringify({ ...project, format: { name: 'Código QR', width: code.w, height: code.h, unit: 'px' }, layers: [{ ...code, x: code.w / 2, y: code.h / 2, angle: 0 }] }, null, 2)], { type: 'application/json' })
    const { markup, image, canvas } = await standaloneQr(code.style, direct)
    if (await readQr(canvas) !== direct) throw new Error('El QR no se puede verificar. Corrige sus colores y márgenes.')
    if (type === 'SVG') return new Blob([markup], { type: 'image/svg+xml' })
    const width = Math.round(code.w * dpi / 96), height = Math.round(code.h * dpi / 96)
    outputLimits(width, height)
    const raster = window.document.createElement('canvas')
    raster.width = width
    raster.height = height
    const context = raster.getContext('2d')!
    if (!transparent || type === 'JPG' || type === 'PDF') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
    }
    context.drawImage(image, 0, 0, width, height)
    if (await readQr(raster) !== direct) throw new Error('El QR no se puede leer a esta resolución. Aumenta las dimensiones.')
    return encodeRaster(raster, options)
  }

  const document = scope === 'selected' ? await selectedProject(project, ids) : project
  if (type === 'JSON') return new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
  if (findQr(document.layers).length) {
    const check = await verifyProject(document, dpi / 96)
    if (!check.ok) throw new Error(check.message)
  }
  const scene = await renderProject(document)
  try {
    const bleed = options.bleed ? document.bleed * scales.mm : 0
    const bbox = { left: -bleed, top: -bleed, width: scene.width + 2 * bleed, height: scene.height + 2 * bleed }
    if (type === 'SVG') return new Blob([digitalSvg(scene, document, bbox, transparent)], { type: 'image/svg+xml' })
    const native = dimensions(document.format, dpi)
    const width = Math.round(native.width + 2 * bleed * dpi / 96)
    const height = Math.round(native.height + 2 * bleed * dpi / 96)
    outputLimits(width, height)
    const scaled = scene.toCanvasElement(dpi / 96, bbox)
    const raster = window.document.createElement('canvas')
    raster.width = width
    raster.height = height
    const context = raster.getContext('2d')!
    if (!transparent || type === 'JPG' || type === 'PDF') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
    }
    if (document.format.circle) {
      context.beginPath()
      context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
      context.clip()
    }
    context.drawImage(scaled, 0, 0, width, height)
    return encodeRaster(raster, { ...options, quality })
  } finally { await scene.dispose() }
}

function digitalSvg(scene: Awaited<ReturnType<typeof renderProject>>, project: Project,
  bbox: { left: number; top: number; width: number; height: number }, transparent: boolean) {
  const source = scene.toSVG({ suppressPreamble: true, viewBox: { x: bbox.left, y: bbox.top, width: bbox.width, height: bbox.height } })
  const root = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement
  const visible = expand(scene.getObjects())
  const qrImages = new Map(visible.flatMap((object) => {
    const markup = objectData.get(object)?.qrMarkup
    return markup ? [[vectorUrl(markup), markup] as const] : []
  }))
  for (const [index, image] of Array.from(root.querySelectorAll('image')).entries()) {
    const path = image.getAttribute('xlink:href') ?? image.getAttribute('href')
    const markup = path ? qrImages.get(path) : undefined
    if (!markup) continue
    const qr = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement
    for (const element of Array.from(qr.querySelectorAll('[id]'))) {
      const name = element.id
      element.id = `rc-qr-${index}-${name}`
      for (const node of Array.from(qr.querySelectorAll('*'))) for (const attribute of Array.from(node.attributes)) {
        if (attribute.value === `url(#${name})`) node.setAttribute(attribute.name, `url(#${element.id})`)
      }
    }
    for (const key of ['x', 'y', 'width', 'height']) qr.setAttribute(key, image.getAttribute(key) ?? '0')
    qr.setAttribute('preserveAspectRatio', 'none')
    image.replaceWith(qr)
  }
  const ns = 'http://www.w3.org/2000/svg'
  if (!transparent) {
    const back = root.ownerDocument.createElementNS(ns, 'rect')
    back.setAttribute('x', String(bbox.left))
    back.setAttribute('y', String(bbox.top))
    back.setAttribute('width', String(bbox.width))
    back.setAttribute('height', String(bbox.height))
    back.setAttribute('fill', '#ffffff')
    root.prepend(back)
  }
  if (project.format.circle) {
    const group = root.ownerDocument.createElementNS(ns, 'g')
    const clip = root.ownerDocument.createElementNS(ns, 'clipPath')
    const ellipse = root.ownerDocument.createElementNS(ns, 'ellipse')
    clip.setAttribute('id', 'reviewcanvas-print-circle')
    ellipse.setAttribute('cx', String(scene.width / 2))
    ellipse.setAttribute('cy', String(scene.height / 2))
    ellipse.setAttribute('rx', String(bbox.width / 2))
    ellipse.setAttribute('ry', String(bbox.height / 2))
    clip.append(ellipse)
    group.setAttribute('clip-path', 'url(#reviewcanvas-print-circle)')
    group.append(...Array.from(root.children))
    root.append(clip, group)
  }
  return new XMLSerializer().serializeToString(root)
}

async function encodeRaster(canvas: HTMLCanvasElement, options: OutputOptions) {
  const { type, dpi, quality } = options
  if (type === 'PDF') {
    const { jsPDF } = await import('jspdf')
    const width = canvas.width * 25.4 / dpi, height = canvas.height * 25.4 / dpi
    const pdf = new jsPDF({ unit: 'mm', format: [width, height], orientation: width > height ? 'landscape' : 'portrait', compress: true })
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height, undefined, 'FAST')
    return pdf.output('blob')
  }
  const mime = type === 'JPG' ? 'image/jpeg' : 'image/png'
  const blob = await imageBlob(canvas, mime, quality / 100)
  return includeDpi(blob, dpi)
}

function checksum(bytes: Uint8Array) {
  let crc = -1
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ -1) >>> 0
}

async function includeDpi(blob: Blob, dpi: number) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (blob.type === 'image/jpeg' && String.fromCharCode(...bytes.slice(6, 10)) === 'JFIF') {
    const view = new DataView(bytes.buffer)
    bytes[13] = 1
    view.setUint16(14, dpi)
    view.setUint16(16, dpi)
    return new Blob([bytes], { type: blob.type })
  }
  if (blob.type !== 'image/png') return blob
  const block = new Uint8Array(21)
  const view = new DataView(block.buffer)
  view.setUint32(0, 9)
  block.set(new TextEncoder().encode('pHYs'), 4)
  const density = Math.round(dpi / .0254)
  view.setUint32(8, density)
  view.setUint32(12, density)
  block[16] = 1
  view.setUint32(17, checksum(block.slice(4, 17)))
  const input = new DataView(bytes.buffer)
  const signatureAndHeader = 33
  const remaining: Uint8Array<ArrayBuffer>[] = []
  for (let offset = signatureAndHeader; offset + 12 <= bytes.length;) {
    const length = input.getUint32(offset) + 12
    if (String.fromCharCode(...bytes.slice(offset + 4, offset + 8)) !== 'pHYs') remaining.push(bytes.slice(offset, offset + length))
    offset += length
  }
  return new Blob([bytes.slice(0, signatureAndHeader), block, ...remaining], { type: blob.type })
}

export function download(blob: Blob, title: string, extension: string) {
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = `${title.trim().replace(/[^\p{L}\p{N} _-]+/gu, '').replace(/ +/g, '-').slice(0, 80) || 'ReviewCanvas'}.${extension.toLowerCase()}`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(href), 30_000)
}
