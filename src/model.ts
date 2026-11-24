import { z } from 'zod'
import { assetReference, hasProjectAssetReferences } from './media'
import { isGoogleMapsLink, reviewLink } from './googleReviews'

export { isGoogleMapsLink, reviewLink } from './googleReviews'

export const colors = { forest: '#203c33', terracotta: '#b95d3b', cream: '#f5f1e8', charcoal: '#202923' }
export const fonts = ['Lora Variable', 'DM Sans Variable', 'Barlow Condensed', 'Georgia', 'Arial', 'Courier New']
export const formats = [
  { name: 'Cartel vertical', width: 640, height: 900, unit: 'px' },
  { name: 'Cartel horizontal', width: 900, height: 640, unit: 'px' },
  { name: 'A4', width: 210, height: 297, unit: 'mm' },
  { name: 'A5', width: 148, height: 210, unit: 'mm' },
  { name: 'A6', width: 105, height: 148, unit: 'mm' },
  { name: 'Tarjeta comercial', width: 85, height: 55, unit: 'mm' },
  { name: 'Adhesivo circular', width: 65, height: 65, unit: 'mm', circle: true },
  { name: 'Adhesivo cuadrado', width: 65, height: 65, unit: 'mm' },
  { name: 'Exhibidor de mesa', width: 100, height: 150, unit: 'mm' },
  { name: 'Historia', width: 1080, height: 1920, unit: 'px' },
  { name: 'Publicación cuadrada', width: 1080, height: 1080, unit: 'px' },
] as const

const color = z.string().regex(/^#[\da-f]{6}$/i)
const size = z.number().positive().max(12000)
const position = z.number().finite().min(-36000).max(36000)
export const formatSchema = z.object({
  name: z.string().max(60), width: size, height: size, unit: z.enum(['px', 'mm', 'cm', 'in']),
  circle: z.boolean().optional(),
})
export type Format = z.infer<typeof formatSchema>
export const scales: Record<Format['unit'], number> = { px: 1, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 }

export function dimensions(format: Format, dpi = 96) {
  const ratio = scales[format.unit] * dpi / 96
  return { width: Math.round(format.width * ratio), height: Math.round(format.height * ratio) }
}

export const rasterData = z.string().max(2_800_000).regex(/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i)
const mediaSource = z.union([rasterData, z.string().regex(assetReference)])
const fontData = z.string().max(2_800_000).regex(/^data:font\/(woff2|woff|ttf|otf);base64,[a-z\d+/=]+$/i)
export const qrSchema = z.object({
  ink: color, paper: color, accent: color, gradient: z.boolean(), transparent: z.boolean(),
  dots: z.enum(['square', 'rounded', 'dots', 'classy', 'classy-rounded', 'extra-rounded']),
  corners: z.enum(['square', 'dot', 'extra-rounded']),
  error: z.enum(['L', 'M', 'Q', 'H']), margin: z.number().min(0).max(28),
  frame: z.boolean(), logo: mediaSource.optional(),
})
export type QrStyle = z.infer<typeof qrSchema>
export const defaultQr: QrStyle = {
  ink: colors.forest, paper: '#ffffff', accent: colors.terracotta, gradient: false, transparent: false,
  dots: 'square', corners: 'square', error: 'H', margin: 12, frame: false,
}
export const previewQrText = 'ReviewCanvas · Vincula tu enlace de reseñas'

const baseLayer = {
  id: z.string().max(80), name: z.string().max(120), x: position, y: position, w: size, h: size,
  angle: z.number().min(-360).max(360), opacity: z.number().min(0).max(1),
  hidden: z.boolean(), locked: z.boolean(), flipX: z.boolean(), flipY: z.boolean(),
}
const basicLayer = z.discriminatedUnion('kind', [
  z.object({ ...baseLayer, kind: z.literal('rect'), fill: color, stroke: color.optional(), strokeWidth: z.number().min(0).max(64).optional(), radius: z.number().min(0).max(1200).optional() }),
  z.object({ ...baseLayer, kind: z.literal('vector'), svg: z.string().max(64_000), tint: color.optional() }),
  z.object({ ...baseLayer, kind: z.literal('image'), source: mediaSource }),
  z.object({ ...baseLayer, kind: z.literal('qr'), style: qrSchema }),
  z.object({ ...baseLayer, kind: z.literal('text'), text: z.string().max(2000), font: z.string().regex(/^[\p{L}\p{N} _-]{1,80}$/u),
    size: z.number().min(4).max(460), weight: z.number().min(100).max(900), italic: z.boolean(),
    underline: z.boolean(), align: z.enum(['left', 'center', 'right', 'justify']), fill: color,
    tracking: z.number().min(-250).max(1100), leading: z.number().min(.5).max(3),
    outline: color.optional(), outlineWidth: z.number().min(0).max(12).optional(),
    shadow: z.boolean().optional(), curve: z.number().min(-100).max(100).optional(),
    role: z.enum(['business', 'slogan']).optional(),
  }),
])

export type BasicLayer = z.infer<typeof basicLayer>
export type Layer = BasicLayer | (z.infer<ReturnType<typeof z.object<typeof baseLayer>>> & {
  kind: 'group'; children: Layer[]
})
export type TextLayer = Extract<Layer, { kind: 'text' }>
export type QrLayer = Extract<Layer, { kind: 'qr' }>
type LayerBase = Pick<Layer, keyof typeof baseLayer>

const layerSchema: z.ZodType<Layer> = z.lazy(() => z.union([
  basicLayer, z.object({ ...baseLayer, kind: z.literal('group'), children: z.array(layerSchema).min(1).max(200) }),
]))

export const projectSchema = z.object({
  version: z.literal(1), id: z.string().uuid(), title: z.string().trim().min(1).max(100),
  business: z.string().max(100), url: z.string().max(1200), format: formatSchema,
  layers: z.array(layerSchema).max(200), updatedAt: z.string().datetime(),
  folder: z.string().max(70), favorite: z.boolean(), bleed: z.number().min(0).max(30),
  importedFonts: z.array(z.object({ name: z.string().regex(/^[\p{L}\p{N} _-]{1,52}$/u), data: fontData })).max(5),
})
export type Project = z.infer<typeof projectSchema>

export const brandSchema = z.object({
  id: z.string().uuid(), name: z.string().min(1).max(100), slogan: z.string().max(150),
  primary: color, secondary: color, font: z.string().regex(/^[\p{L}\p{N} _-]{1,80}$/u), url: z.string().max(1200),
  notes: z.string().max(500), logo: mediaSource.optional(), images: z.array(mediaSource).max(6).default([]),
  decorations: z.array(z.string().max(80)).max(200).default([]),
})
export type Brand = z.infer<typeof brandSchema>

export function layerBase(name: string, x: number, y: number, w: number, h: number): LayerBase {
  return { id: crypto.randomUUID(), name, x, y, w, h, angle: 0, opacity: 1,
    hidden: false, locked: false, flipX: false, flipY: false }
}

export function newProject(layers: Layer[] = [], business = '', format: Format = formats[0]): Project {
  return { version: 1, id: crypto.randomUUID(), title: business || 'Diseño sin título', business,
    url: '', format, layers, updatedAt: new Date().toISOString(), folder: '', favorite: false, bleed: 3, importedFonts: [] }
}

export function normalizeReviewTarget(project: Project): Project {
  const direct = reviewLink(project.url)
  return direct === project.url ? project : { ...project, url: direct }
}

export function eachLayer(layers: Layer[], visit: (layer: Layer) => Layer): Layer[] {
  return layers.map((layer) => visit(layer.kind === 'group' ? { ...layer, children: eachLayer(layer.children, visit) } : layer))
}

export function findQr(layers: Layer[]): QrLayer[] {
  return layers.flatMap((layer) => layer.hidden ? [] : layer.kind === 'qr' ? [layer] : layer.kind === 'group' ? findQr(layer.children) : [])
}

export function validateProject(value: unknown, recoverLegacyLink = false, allowCloudAssets = false) {
  // Se comprueba la profundidad antes de invocar el esquema recursivo.
  let remaining = 600
  const withinLimits = (layers: unknown, depth = 0): boolean => Array.isArray(layers)
    && depth < 8 && layers.every((layer) => --remaining >= 0 && layer && typeof layer === 'object'
      && (layer.kind !== 'group' || withinLimits(layer.children, depth + 1)))
  if (!value || typeof value !== 'object' || !('layers' in value) || !withinLimits(value.layers)) return null
  const parsed = projectSchema.safeParse(value)
  if (!parsed.success
    || (!allowCloudAssets && hasProjectAssetReferences(parsed.data.layers))
    || (parsed.data.url && !reviewLink(parsed.data.url) && !(recoverLegacyLink && isGoogleMapsLink(parsed.data.url)))
    || Object.values(dimensions(parsed.data.format)).some((value) => value < 32 || value > 5000)) return null
  return normalizeReviewTarget(parsed.data)
}
