import { SaxesParser } from 'saxes'
import { assetReference } from '../src/media'
import { type Layer, type Project, type Brand } from '../src/model'

const tags = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs',
  'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern', 'title', 'desc',
])

export function safeSvg(markup: string) {
  const parser = new SaxesParser({ xmlns: true })
  let valid = true
  let root = true
  let count = 0
  parser.on('doctype', () => { valid = false })
  parser.on('error', () => { valid = false })
  parser.on('opentag', (node) => {
    if ((root && node.local !== 'svg') || node.uri !== 'http://www.w3.org/2000/svg'
      || !tags.has(node.local) || ++count > 1000) valid = false
    root = false
    for (const attribute of Object.values(node.attributes)) {
      if (/^on/i.test(attribute.local) || ['style', 'href', 'src'].includes(attribute.local)
        || (/url\(/i.test(attribute.value) && !/^url\(#[\w-]+\)$/.test(attribute.value))) valid = false
    }
  })
  try { parser.write(markup).close() } catch { return false }
  return valid && !root
}

export function validRaster(value?: string) {
  if (!value) return true
  const separator = value.indexOf(',')
  const type = value.slice(0, separator)
  const bytes = Buffer.from(value.slice(separator + 1, separator + 25), 'base64')
  if (type.startsWith('data:image/png')) return bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
  if (type.startsWith('data:image/jpeg')) return bytes.subarray(0, 3).toString('hex') === 'ffd8ff'
  if (type.startsWith('data:image/webp')) return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
  return false
}

function validMedia(value?: string) {
  return assetReference.test(value ?? '') || validRaster(value)
}

export function validBrand(brand: Brand) {
  return validMedia(brand.logo) && brand.images.every(validMedia)
}

export function validProjectAssets(project: Project) {
  function validLayer(layer: Layer): boolean {
    if (layer.kind === 'vector') return safeSvg(layer.svg)
    if (layer.kind === 'image') return validMedia(layer.source)
    if (layer.kind === 'qr') return validMedia(layer.style.logo)
    if (layer.kind === 'group') return layer.children.every(validLayer)
    return true
  }
  return project.layers.every(validLayer) && project.importedFonts.every(({ data }) => {
    const prefix = Buffer.from(data.slice(data.indexOf(',') + 1, data.indexOf(',') + 9), 'base64').subarray(0, 4)
    return ['wOF2', 'wOFF', 'OTTO', 'true'].includes(prefix.toString()) || prefix.toString('hex') === '00010000'
  })
}
