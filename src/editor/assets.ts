import DOMPurify from 'dompurify'
import { rasterData, type Project } from '../model'

export function safeVector(svg: string, tint?: string) {
  const cleaned = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: false },
    FORBID_TAGS: ['image', 'use', 'style', 'a', 'foreignObject', 'animate', 'set'],
    FORBID_ATTR: ['href', 'xlink:href', 'style'],
  })
  const node = new DOMParser().parseFromString(cleaned, 'image/svg+xml').documentElement
  if (node.localName !== 'svg' || node.querySelector('parsererror') || !node.children.length) {
    throw new Error('El archivo SVG no contiene elementos vectoriales compatibles.')
  }
  for (const element of [node, ...Array.from(node.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      if (/url\(/i.test(attribute.value) && !/^url\(#[\w-]+\)$/.test(attribute.value)) element.removeAttribute(attribute.name)
    }
    if (tint) for (const key of ['fill', 'stroke']) {
      const value = element.getAttribute(key)
      if (value && !['none', 'transparent'].includes(value.toLowerCase())) element.setAttribute(key, tint)
    }
  }
  return new XMLSerializer().serializeToString(node)
}

function dataUrl(file: File, mime: string) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;/, `data:${mime};`))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(file)
  })
}

export async function readRaster(file: File) {
  if (file.size > 1_900_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Elige PNG, JPG o WebP de menos de 1,9 MB.')
  }
  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = bitmap
    if (width * height > 16_000_000) throw new Error('La imagen debe tener menos de 16 megapíxeles.')
    const ratio = Math.min(1, 1600 / Math.max(width, height))
    if (ratio === 1 && file.size <= 160_000) return { value: rasterData.parse(await dataUrl(file, file.type)), width, height }

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * ratio))
    canvas.height = Math.max(1, Math.round(height * ratio))
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const optimized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', .85))
    const useOriginal = !optimized || (ratio === 1 && optimized.size >= file.size)
    const image = useOriginal ? file : new File([optimized], 'imagen.webp', { type: optimized.type })
    return { value: rasterData.parse(await dataUrl(image, image.type)), width: useOriginal ? width : canvas.width,
      height: useOriginal ? height : canvas.height }
  } finally { bitmap.close() }
}

export async function readCustomFont(file: File) {
  const ext = file.name.split('.').at(-1)?.toLowerCase() ?? ''
  if (!['woff2', 'woff', 'ttf', 'otf'].includes(ext) || file.size > 1_900_000) {
    throw new Error('Elige una fuente WOFF2, WOFF, TTF u OTF de menos de 1,9 MB.')
  }
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 52) || 'Fuente importada'
  const data = await dataUrl(file, `font/${ext}`)
  return { name, data }
}

const fontsLoaded = new Map<string, string>()
export async function prepareFonts(project: Project) {
  await Promise.all([
    document.fonts.load('500 24px "Lora Variable"'),
    document.fonts.load('italic 500 24px "Lora Variable"'),
    document.fonts.load('600 24px "DM Sans Variable"'),
    document.fonts.load('700 24px "Barlow Condensed"'),
    ...project.importedFonts.map(async ({ name, data }) => {
      if (fontsLoaded.get(name) === data) return
      const existing = Array.from(document.fonts).find((font) => font.family === name)
      const font = await new FontFace(name, `url(${data})`).load()
      if (existing) document.fonts.delete(existing)
      document.fonts.add(font)
      fontsLoaded.set(name, data)
    }),
  ])
}
