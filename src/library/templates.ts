import { colors, defaultQr, formats, layerBase, newProject, type Format, type Layer, type TextLayer } from '../model'
import { elementLayer, elements, loadVector, svg } from './vectors'

const { forest, terracotta, cream } = colors
const serif = 'Lora Variable'
const sans = 'DM Sans Variable'
const condensed = 'Barlow Condensed'
const W = 640
const H = 900
const center = W / 2
export const themes = [
  { title: 'Cafeterías', key: 'cafes', business: 'Café Aurora', word: 'Cafetería', colors: ['#f4ede0', '#203c33', '#b95d3b'], element: 'taza' },
  { title: 'Restaurantes', key: 'restaurantes', business: 'La Parrilla', word: 'Cocina de autor', colors: ['#222420', '#fbefdb', '#cc9d52'], element: 'gastronomía-1' },
  { title: 'Barberías', key: 'barberias', business: 'El Corte', word: 'Barbería', colors: ['#eee7d8', '#243344', '#a63631'], element: 'barbería-1' },
  { title: 'Hoteles', key: 'hoteles', business: 'Hotel Andino', word: 'Hospitalidad', colors: ['#f4ede0', '#594c3e', '#a58757'], element: 'hotelería-3' },
  { title: 'Tiendas', key: 'tiendas', business: 'MiTienda', word: 'Comercio', colors: ['#edf2f7', '#1b2e4e', '#194df2'], element: 'bolsa' },
  { title: 'Tecnología', key: 'tecnologia', business: 'TecnoMain', word: 'Servicios digitales', colors: ['#ecf5f8', '#17365e', '#0a75b5'], element: 'tecnología-1' },
  { title: 'Salones de belleza', key: 'belleza', business: 'Lina Estudio', word: 'Belleza y cuidado', colors: ['#f8e7e4', '#583b4d', '#b7757d'], element: 'flores-5' },
  { title: 'Panaderías y pastelerías', key: 'panaderias', business: 'Miga & Sol', word: 'Pan artesanal', colors: ['#f6ecd9', '#593b29', '#c2764f'], element: 'gastronomía-5' },
  { title: 'Servicios profesionales', key: 'servicios', business: 'Estudio Norte', word: 'Servicios profesionales', colors: ['#ebf0e9', '#203c33', '#6a8066'], element: 'formas-8' },
  { title: 'Universales', key: 'universal', business: 'Tu negocio', word: 'En Google Maps', colors: ['#eaf1ef', '#243a34', '#467f6f'], element: 'destello' },
]

type Theme = (typeof themes)[number]
type Recipe = { title: string; style: string; layout: string; heading: [number, number, number]; prompt: [number, number, number]; qr: [number, number, number]; foot: [number, number, number]; font: string }
const recipes: Recipe[] = [
  { title: 'Esencia', style: 'Editorial', layout: 'cover', heading: [320, 164, 59], prompt: [320, 326, 54], qr: [320, 555, 272], foot: [320, 787, 23], font: serif },
  { title: 'Entrada', style: 'Art déco', layout: 'frame', heading: [320, 173, 58], prompt: [320, 292, 46], qr: [320, 548, 288], foot: [320, 785, 23], font: serif },
  { title: 'Una palabra', style: 'Tipográfico', layout: 'side', heading: [304, 115, 44], prompt: [310, 250, 76], qr: [374, 588, 260], foot: [336, 812, 21], font: condensed },
  { title: 'Herbario', style: 'Botánico', layout: 'branches', heading: [320, 200, 52], prompt: [320, 315, 42], qr: [320, 561, 252], foot: [320, 783, 24], font: serif },
  { title: 'Punto de encuentro', style: 'Suizo', layout: 'split', heading: [317, 127, 50], prompt: [318, 243, 53], qr: [414, 559, 245], foot: [322, 800, 22], font: sans },
  { title: 'Sello de la casa', style: 'Vintage', layout: 'stamp', heading: [320, 178, 54], prompt: [320, 306, 52], qr: [320, 568, 212], foot: [320, 788, 21], font: condensed },
  { title: 'Hecho a mano', style: 'Artesanal', layout: 'ribbon', heading: [320, 145, 50], prompt: [320, 320, 43], qr: [320, 574, 248], foot: [320, 809, 23], font: serif },
  { title: 'Umbral', style: 'Japandi', layout: 'arch', heading: [320, 131, 48], prompt: [320, 260, 40], qr: [320, 531, 252], foot: [320, 783, 22], font: serif },
  { title: 'Buenas señales', style: 'Retro', layout: 'diagonal', heading: [320, 174, 62], prompt: [320, 319, 64], qr: [320, 583, 246], foot: [322, 790, 23], font: condensed },
  { title: 'Línea directa', style: 'Minimalista', layout: 'grid', heading: [318, 504, 54], prompt: [318, 632, 38], qr: [320, 271, 241], foot: [318, 785, 20], font: sans },
]
const specialStyles = ['Mediterráneo', 'Geometría', 'Industrial', 'Corporativo', 'Orgánico', 'Premium']
const messages = ['Cuéntanos tu\nexperiencia', 'Tu experiencia\nnos importa', 'Comparte tu\nexperiencia', 'Queremos conocer\ntu experiencia', '¿Cómo fue\ntu visita?']

export type Template = {
  id: string; title: string; category: string; style: string; business: string; color: string;
  format: Format; thumbnail?: string; premium: boolean;
  preview: () => Layer[]; build: () => Promise<Layer[]>
}

const rect = (name: string, x: number, y: number, w: number, h: number, fill: string,
  options: Partial<Extract<Layer, { kind: 'rect' }>> = {}): Layer =>
  ({ ...layerBase(name, x, y, w, h), kind: 'rect', fill, ...options })

function text(content: string, name: string, x: number, y: number, size: number, fill: string,
  options: Partial<TextLayer> = {}): TextLayer {
  return { ...layerBase(name, x, y, 530, size * 1.4), kind: 'text', text: content, size, fill,
    font: serif, weight: 500, italic: false, underline: false, align: 'center', tracking: 0, leading: 1.05, ...options }
}

const vector = (name: string, x: number, y: number, w: number, h: number, body: string): Layer =>
  ({ ...layerBase(name, x, y, w, h), kind: 'vector', svg: svg(body) })
const path = (d: string, fill: string, stroke?: string, weight = 2) =>
  `<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round"` : ''}/>`
const frame = (ink: string, edge = 26, rounded = 0) =>
  rect('Marco', center, 450, W - edge * 2, H - edge * 2, '#ffffff', { stroke: ink, strokeWidth: 2, radius: rounded, opacity: 1 })
const qr = (x: number, y: number, width: number, ink = forest): Layer =>
  ({ ...layerBase('Código QR', x, y, width, width), kind: 'qr', style: { ...defaultQr, ink } })

const starPath = 'M64 8 76 47 117 47 84 71 96 109 64 86 32 109 44 71 11 47 52 47Z'
function stars(y: number, ink: string, outline = false, width = 31) {
  return Array.from({ length: 5 }, (_, i) => vector(`Estrella ${i + 1}`, center + (i - 2) * (width + 11), y, width, width,
    path(starPath, outline ? 'none' : ink, ink, outline ? 8 : 1)))
}

function corner(layout: string, paper: string, accent: string, ink: string, d: number): Layer[] {
  const emptyFrame = (edge: number, color: string, radius = 0) => {
    const item = frame(color, edge, radius)
    return { ...item, name: 'Marco lineal', kind: 'vector' as const, svg: svg(`<rect x="2" y="2" width="124" height="124" rx="${radius}" fill="none" stroke="${color}" stroke-width="0.8"/>`),
      x: item.x, y: item.y, w: item.w, h: item.h }
  }
  switch (layout) {
    case 'cover': return [
      vector('Forma superior', 104, 107, 208, 214, path('M0 0H128C128 47 86 89 0 128Z', ink)),
      vector('Forma inferior', 520, 813, 240, 174, path('M128 0V128H0C20 49 78 15 128 0Z', accent)),
    ]
    case 'frame': return [emptyFrame(24, accent), emptyFrame(35, accent),
      vector('Remate superior', center, 67, 170, 30, path('M0 64H49L64 8 79 64H128M43 111H85', 'none', accent, 4)),
      vector('Remate inferior', center, 841, 138, 22, path('M0 64H46L64 115 82 64H128', 'none', accent, 4))]
    case 'side': return [
      rect('Banda lateral', 56 + d, 450, 112 + d * 2, 900, accent),
      vector('Bloque de acento', 569, 126, 141, 252, path('M25 0H128V128L0 58Z', ink)),
    ]
    case 'branches': return [
      vector('Medallón', 320, 535, 386, 386, `<circle cx="64" cy="64" r="63" fill="${accent}" opacity=".22"/>`),
      emptyFrame(31, accent, 4),
    ]
    case 'split': return [
      rect('Bloque superior', center, 171, W, 342, ink),
      rect('Módulo lateral', 98 + d, 554, 110 + d * 2, 346, accent),
      rect('Filete inferior', center, 747, 514, 1.8, ink),
    ]
    case 'stamp': return [
      emptyFrame(17, accent, 1),
      vector('Anillo de sello', center, 560, 373, 373, `<circle cx="64" cy="64" r="61" fill="none" stroke="${accent}" stroke-width="1.3" stroke-dasharray="1 2"/><circle cx="64" cy="64" r="57" fill="none" stroke="${ink}" stroke-width=".5"/>`),
      rect('Base', center, 856, 486, 13, accent),
    ]
    case 'ribbon': return [
      vector('Cinta superior', center, 237, 492, 48, path('M0 0H128L121 64 128 128H0L7 64Z', accent)),
      vector('Onda inferior', center, 849, W, 102, path('M0 70Q26 0 64 48T128 30V128H0Z', accent)),
    ]
    case 'arch': return [
      vector('Nicho', center, 478, 496, 555, path('M0 128V55C0 19 28 0 64 0S128 19 128 55V128Z', '#ffffff')),
      vector('Arco lineal', center, 465, 535, 587, path('M1 127V56C1 24 28 1 64 1S127 24 127 56V127', 'none', accent, 1.2)),
    ]
    case 'diagonal': return [
      vector('Franja diagonal', center, 760, W, 280, path('M0 80 128 0V128H0Z', accent)),
      vector('Esquina diagonal', 139, 90, 278, 180, path('M0 0H128L0 128Z', accent)),
    ]
    case 'grid': return [
      rect('Margen superior', center, 39, 515, 2, ink),
      rect('División editorial', center, 428, 515, 2, ink),
      rect('División inferior', center, 729, 515, 2, accent),
      rect('Pestaña superior', 519 - d, 84, 93, 48, accent),
      rect('Marco silencioso', center, 262, 332, 303, paper, { stroke: accent, strokeWidth: 2 }),
    ]
    default: return []
  }
}

function adaptRecipe(layers: Layer[], format: Format) {
  const ratio = format.height / H
  const offset = (format.width - W * ratio) / 2
  return layers.map((layer): Layer => {
    if (layer.kind === 'rect' && layer.locked) {
      return { ...layer, x: format.width / 2, y: format.height / 2, w: format.width, h: format.height }
    }
    const fit = { ...layer, x: offset + layer.x * ratio, y: layer.y * ratio, w: layer.w * ratio, h: layer.h * ratio }
    if (fit.kind === 'text') return { ...fit, size: fit.size * ratio }
    return fit
  })
}

const horizontalFormat = formats[1]
const squareFormat = formats[10]

function variantLayout(theme: Theme, recipe: Recipe, index: number, categoryIndex: number): Layer[] {
  const [paper, ink, accent] = theme.colors
  if (index === 2) {
    const width = horizontalFormat.width, height = horizontalFormat.height
    const qrX = 663 - categoryIndex % 3 * 26
    const divider = qrX - 191
    return [
      rect('Fondo', width / 2, height / 2, width, height, paper, { locked: true }),
      rect('Panel de lectura', (width + divider) / 2, height / 2, width - divider, height, ink),
      rect('Línea de acento', divider - 7, height / 2, 14, height, accent),
      text(theme.business, 'Nombre del negocio', divider / 2, 135, Math.min(49, 590 / theme.business.length), ink,
        { role: 'business', font: recipe.font, weight: 700, w: divider - 74 }),
      text(messages[categoryIndex % messages.length], 'Texto principal', divider / 2, 293, 52, ink,
        { font: recipe.font, weight: 700, w: divider - 80 }),
      text(theme.word, 'Sector', divider / 2, 475, 22, ink, { font: sans, w: divider - 80 }),
      qr(qrX, 300, 240, forest),
      text('Escanea para compartir tu experiencia', 'Instrucciones', qrX, 489, 18, paper, { font: sans, w: 370 }),
    ]
  }
  return adaptRecipe(makeRecipe(theme, recipe, index, categoryIndex), squareFormat)
}

function makeRecipe(theme: Theme, recipe: Recipe, index: number, categoryIndex: number): Layer[] {
  const [paper, ink, accent] = theme.colors
  const [headingX, headingY, headingSize] = recipe.heading
  const verticalRhythm = [0, 8, -4, 14, -11, 5, 18, -8, 11, -16][categoryIndex]
  const [promptX, promptY, promptSize] = recipe.prompt
  const [qrX, qrY, qrSize] = recipe.qr
  const [footX, footY, footSize] = recipe.foot
  const darkTop = recipe.layout === 'split'
  const widthOffset = (categoryIndex % 4) * 8
  const letterSize = Math.min(headingSize, 700 / theme.business.length)
  const hero = messages[(index + categoryIndex) % messages.length]
  const starsY = recipe.layout === 'grid' ? 685 : footY - 67
  return [
    rect('Fondo', center, H / 2, W, H, paper, { locked: true }),
    ...corner(recipe.layout, paper, accent, ink, widthOffset),
    text(theme.business, 'Nombre del negocio', headingX, headingY + verticalRhythm, letterSize, darkTop ? paper : ink,
      { role: 'business', font: recipe.font, weight: recipe.font === condensed ? 700 : 600, w: recipe.layout === 'side' ? 425 : 520 }),
    text(theme.word.toUpperCase(), 'Sector', center, recipe.layout === 'ribbon' ? 237 : recipe.layout === 'grid' ? 561 : headingY + 55 + verticalRhythm,
      17, recipe.layout === 'ribbon' || darkTop ? '#ffffff' : ink, { font: sans, weight: 700, tracking: 200 }),
    text(hero, 'Texto principal', promptX, promptY + verticalRhythm, promptSize - categoryIndex % 3 * 2, darkTop ? paper : ink,
      { font: recipe.font, italic: [0, 1, 3, 7].includes(index), weight: index === 8 ? 700 : 500,
        w: recipe.layout === 'side' ? 418 : 530 }),
    qr(qrX + (['split', 'side'].includes(recipe.layout) ? widthOffset : 0), qrY, qrSize, '#203c33'),
    ...([0, 1, 2, 3, 5, 8].includes(index) ? stars(starsY, accent, index % 2 === 0, 24) : []),
    text('Comparte tu opinión en Google Maps', 'Instrucciones', footX, footY, footSize, recipe.layout === 'diagonal' && categoryIndex < 4 ? '#ffffff' : ink, { font: sans, w: 550 }),
  ]
}

async function motif(id: string, x: number, y: number, size: number, tint?: string, angle = 0): Promise<Layer> {
  const base = await elementLayer(elements.find((element) => element.id === id)!, x, y, size)
  return { ...base, angle, tint } as Layer
}

const premiumStyles = ['Botánico', 'Art déco', 'Vintage', 'Premium', 'Geométrico', 'Corporativo']
function premiumLayers(theme: Theme, index: number): Layer[] {
  const [paper, ink, accent] = theme.colors
  if (index === 0) return [
    rect('Fondo crema', center, H / 2, W, H, '#fff7e7', { locked: true }),
    ...corner('cover', cream, '#c96942', '#245344', 0),
    text('Café Aurora', 'Nombre del negocio', center, 154, 58, forest, { role: 'business', weight: 500 }),
    text('CAFETERÍA', 'Sector', center, 213, 18, '#a95a3d', { font: sans, tracking: 275, weight: 700 }),
    text('Cuéntanos tu', 'Texto principal', center, 292, 49, forest),
    text('experiencia', 'Texto destacado', center, 345, 54, forest, { italic: true }),
    rect('Marco del QR', center, 560, 350, 350, '#f3dfc8', { radius: 11 }),
    qr(center, 560, 324),
    ...stars(758, '#a76a29', true, 36),
    text('Comparte tu opinión en Google Maps', 'Instrucciones', center, 827, 22, forest,
      { font: sans, weight: 500, w: 575 }),
  ]
  const selectedLayout = ['cover', 'frame', 'stamp', 'frame', 'diagonal', 'cover'][index]
  const headerY = [0, 171, 167, 180, 186, 170][index]
  const titleFont = [serif, serif, condensed, serif, sans, sans][index]
  const codeY = [0, 541, 588, 548, 574, 560][index]
  const qSize = [0, 265, 254, 270, 248, 260][index]
  return [
    rect('Fondo', center, H / 2, W, H, paper, { locked: true }),
    ...corner(selectedLayout, paper, accent, ink, 0),
    ...(index === 2 ? [
      rect('Banda del encabezado', center, 229, 311, 41, accent, { radius: 3 }),
      rect('Banda inferior', center, 813, 508, 41, ink, { radius: 3 }),
      vector('Filete de barbería', center, 860, 545, 21, path('M0 64H128', 'none', accent, 8)),
    ] : []),
    ...(index === 3 ? [
      vector('Cordillera inferior', center, 828, 575, 117, path('M0 111 22 66 39 83 64 32 94 92 109 69 128 113V128H0Z', '#d8c6a6')),
    ] : []),
    ...(index >= 4 ? [rect('Píldora de acento', center, 326, 424, 67, accent, { radius: 32 })] : []),
    text(index === 2 ? 'BARBERÍA' : theme.business, index === 2 ? 'Rótulo' : 'Nombre del negocio',
      center, headerY, index === 2 ? 87 : Math.min(63, 760 / theme.business.length), ink,
      { font: titleFont, role: index === 2 ? undefined : 'business', weight: 700 }),
    text(index === 2 ? theme.business.toUpperCase() : theme.word.toUpperCase(), index === 2 ? 'Nombre del negocio' : 'Sector',
      center, index === 2 ? 229 : headerY + 51, index === 2 ? 28 : 17, index === 2 ? '#ffffff' : ink, {
        role: index === 2 ? 'business' : undefined, font: sans, tracking: 140, weight: 700,
      }),
    ...(index >= 4 ? [
      text(index === 4 ? 'Cuéntanos tu' : '¿Qué opinas de', 'Texto principal', center, 267, 52, ink, { font: sans, weight: 750 }),
      text(index === 4 ? 'experiencia' : 'nuestro servicio?', 'Texto destacado', center, 326, 39, '#ffffff', { font: sans, weight: 750 }),
    ] : [text('Cuéntanos tu\nexperiencia', 'Texto principal', center, index === 2 ? 334 : 310, 56, ink,
      { font: titleFont, weight: 600, italic: true, leading: 1 })]),
    rect('Marco del QR', center, codeY, qSize + 16, qSize + 16, accent, { radius: 12 }),
    qr(center, codeY, qSize),
    ...stars(index === 2 ? 745 : 733, accent, false, 26),
    text('Comparte tu opinión en Google Maps', 'Instrucciones', center, index === 2 ? 811 : 787, 21,
      index === 2 || index === 4 ? '#ffffff' : ink, { font: sans, weight: 650 }),
  ]
}

function insertDecorations(layers: Layer[], decorations: Layer[]) {
  return [...layers.slice(0, 1), ...decorations, ...layers.slice(1)]
}

const designs: Template[] = themes.flatMap((theme, categoryIndex) => recipes.map((recipe, index) => {
  const premium = index === 0 && categoryIndex < 6
  const format = index === 2 ? horizontalFormat : index === 9 ? squareFormat : formats[0]
  const preview = () => premium ? premiumLayers(theme, categoryIndex) : index === 2 || index === 9
    ? variantLayout(theme, recipe, index, categoryIndex) : makeRecipe(theme, recipe, index, categoryIndex)
  return {
    id: `${theme.key}-${index + 1}`, title: premium ? theme.business : recipe.title, category: theme.title, business: theme.business,
    style: premium ? premiumStyles[categoryIndex] : categoryIndex > 3 && index === 5 ? specialStyles[categoryIndex - 4] : recipe.style,
    color: theme.colors[0], format, premium, thumbnail: premium ? `/miniaturas/${categoryIndex + 1}.webp` : undefined,
    preview,
    async build() {
      const layers = preview()
      if (premium && categoryIndex === 0) {
        const branch = await motif('ramita', 554, 109, 154, '#687b57', -17)
        branch.name = 'Decoración botánica'
        return [...layers, branch]
      }
      if (premium) {
        const decoration = await motif(theme.element, center, 87, 77, theme.colors[2])
        return [...layers, decoration]
      }
      const layouts: Record<string, [number, number, number, number]> = {
        cover: [548, 115, 112, 13], frame: [320, 107, 66, 0], side: [66, 473, 82, -8],
        branches: [117, 466, 151, -18], split: [102, 523, 77, 0], stamp: [320, 91, 63, 0],
        ribbon: [320, 61, 68, -9], arch: [320, 714, 70, 0], diagonal: [506, 105, 104, 5],
        grid: [521, 83, 37, 0],
      }
      const [x, y, size, angle] = index === 2 ? [70, 62, 58, 0] : layouts[recipe.layout]
      const ratio = index === 9 ? squareFormat.height / H : 1
      const offset = index === 9 ? (squareFormat.width - W * ratio) / 2 : 0
      const decoration = await motif(theme.element, offset + x * ratio + (categoryIndex % 3) * 3,
        y * ratio, size * ratio, theme.colors[1], angle)
      const additional = recipe.layout === 'branches'
        ? [await motif('ramita', 510, 636, 124, theme.colors[2], 160), await motif('botánica-2', 505, 419, 91, theme.colors[2], 20)]
        : []
      const afterBackground = recipe.layout === 'branches'
      return afterBackground ? insertDecorations(layers, [decoration, ...additional]) : [...layers, decoration]
    },
  }
}))

const originals = [
  ['cafeteria', 0, 'Café clásico'], ['restaurante', 1, 'La Mesa'], ['barberia', 2, 'El Corte clásico'],
  ['hotel', 3, 'Hotel clásico'], ['tienda', 4, 'Casa Oliva'], ['tecnologia', 5, 'Nexo Digital'],
  ['floristeria', 6, 'Flor y Rama'], ['panaderia', 7, 'Miga y Sol'], ['premium', 8, 'Estudio clásico'], ['minimalista', 9, 'Diseño esencial'],
] as const

function originalTemplate([file, category, title]: (typeof originals)[number]): Template {
  const theme = themes[category]
  const format = { name: 'Cartel clásico', width: 600, height: 800, unit: 'px' as const }
  return {
    id: `kit-${file}`, title, category: theme.title, business: title.replace(' clásico', ''),
    style: 'Clásico', color: theme.colors[0], format, premium: false, thumbnail: `/miniaturas/${file}.webp`,
    preview: () => [],
    async build() {
      const raw = await loadVector(`/04-plantillas/${file}.svg`)
      const root = new DOMParser().parseFromString(raw, 'image/svg+xml').documentElement
      const host = document.createElement('div')
      host.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:-10000px;top:0'
      const imported = document.importNode(root, true)
      host.append(imported)
      document.body.append(host)
      try {
        const page = imported.getBoundingClientRect()
        return Array.from(imported.children).flatMap((group): Layer[] => {
          if (group.id === 'qr') return [qr(300, 420, 300)]
          const names: Record<string, string> = { fondo: 'Fondo', marco: 'Marco', decoracion: 'Decoración', nombre: 'Nombre del negocio', mensaje: 'Texto principal', instrucciones: 'Instrucciones' }
          const name = names[group.id] ?? 'Elemento'
          if (group.id === 'fondo') return [rect(name, 300, 400, 600, 800, group.firstElementChild?.getAttribute('fill') ?? cream, { locked: true })]
          if (group.querySelector('text')) return Array.from(group.querySelectorAll('text')).slice(0, group.id === 'instrucciones' ? 2 : 1).map((node) => {
            const computed = getComputedStyle(node)
            const bounds = node.getBoundingClientRect()
            return text(node.textContent ?? '', name, bounds.x - page.x + bounds.width / 2, bounds.y - page.y + bounds.height / 2,
              Number(node.getAttribute('font-size') ?? 24), colorToHex(computed.fill), {
                font: sans, weight: Number(computed.fontWeight) || 400, w: 550,
                role: group.id === 'nombre' ? 'business' : undefined,
              })
          })
          const bounds = group.getBoundingClientRect()
          const offset = 5
          const x = bounds.x - page.x - offset, y = bounds.y - page.y - offset
          const w = bounds.width + offset * 2, h = bounds.height + offset * 2
          const markup = new XMLSerializer().serializeToString(group)
          return [{ ...layerBase(name, x + w / 2, y + h / 2, w, h), kind: 'vector',
            svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">${markup}</svg>` }]
        })
      } finally { host.remove() }
    },
  }
}

function colorToHex(css: string) {
  const channels = css.match(/\d+/g)
  return channels?.length === 3 ? `#${channels.map((value) => Number(value).toString(16).padStart(2, '0')).join('')}` : forest
}

export const templates = [...designs.filter((item) => item.premium), ...designs.filter((item) => !item.premium), ...originals.map(originalTemplate)]
export const firstTemplate = templates[0]

export async function fromTemplate(template: Template) {
  const layers = await template.build()
  const business = layers.find((layer): layer is TextLayer => layer.kind === 'text' && layer.role === 'business')?.text || template.business
  return newProject(layers, business, template.format)
}
