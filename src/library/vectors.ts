import { colors, layerBase, type Layer } from '../model'

export type ElementItem = { id: string; name: string; category: string; svg?: string; url?: string }

export const svg = (body: string, width = 128, height = width) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`

const providedNames: Record<string, [name: string, category: string]> = {
  ramita: ['Rama botánica', 'Botánica'], hoja: ['Hoja', 'Botánica'], 'forma-organica': ['Volumen orgánico', 'Formas'],
  estrella: ['Estrella sólida', 'Estrellas'], 'estrella-contorno': ['Estrella lineal', 'Estrellas'],
  destello: ['Destello', 'Estrellas'], arco: ['Arco', 'Formas'], circulo: ['Círculo', 'Formas'],
  semicirculo: ['Semicírculo', 'Formas'], corazon: ['Corazón', 'Formas'],
  'flecha-simple': ['Flecha recta', 'Flechas'], 'flecha-curva': ['Flecha curva', 'Flechas'],
  'marco-escaneo': ['Marco de escaneo', 'Marcos'], 'marco-redondeado': ['Marco redondeado', 'Marcos'],
  subrayado: ['Subrayado', 'Líneas'], ondas: ['Ondas suaves', 'Ondas'],
  taza: ['Taza con vapor', 'Cafetería'], bolsa: ['Bolsa de compras', 'Comercio'],
  burbuja: ['Burbuja de diálogo', 'Comercio'], ubicacion: ['Marcador', 'Comercio'],
}

const provided = Object.entries(providedNames)
  .map(([id, [name, category]]) => ({ id, name, category, url: `/05-decoraciones/${id}.svg` }))
const backgrounds = [
  ['crema', 'Crema'], ['carbon', 'Carbón'], ['terracota', 'Terracota'], ['blanco', 'Blanco'],
  ['salvia', 'Salvia'], ['arena', 'Arena'], ['curvas-crema', 'Curvas cremosas'], ['lineas-arena', 'Líneas de arena'],
  ['puntos-salvia', 'Puntos salvia'], ['marco-editorial', 'Marco editorial'],
].map(([id, name]) => ({ id, name, category: 'Fondos', url: `/06-fondos/${id}.svg` }))

const line = (d: string, weight: number) =>
  `<path d="${d}" fill="none" stroke="${colors.forest}" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round"/>`
const shape = (d: string) => `<path d="${d}" fill="${colors.forest}"/>`
const circle = (cx: number, cy: number, r: number, solid = true) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${solid ? colors.forest : 'none'}" stroke="${colors.forest}" stroke-width="2"/>`
const times = (length: number, draw: (index: number) => string) => Array.from({ length }, (_, index) => draw(index)).join('')
const point = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`
const polar = (radius: number, angle: number) => point(64 + radius * Math.sin(angle), 64 - radius * Math.cos(angle))

const icons: Record<string, string[]> = {
  Cafetería: [
    'M26 49h56v24a28 28 0 0 1-56 0ZM82 54h8a11 11 0 0 1 0 22h-8M20 102h74M45 36q-10-6 0-14M61 36q-10-6 0-14',
    'M23 57h82l-8 40H31ZM32 57l13-31h38l13 31M46 72h36',
    'M64 14q26 27 26 48a26 26 0 0 1-52 0q0-21 26-48ZM64 31q-15 19-15 33',
    'M28 35h72M35 35l12 61h34l12-61M45 58h38M51 77h26M51 27h26',
    'M30 47q34-60 68 0-5 42-34 53-29-11-34-53ZM42 65l44-27',
  ],
  Gastronomía: [
    'M16 86h96M25 82a39 39 0 0 1 78 0M64 42v-8M55 34h18',
    'M34 25v28q0 13 12 13t12-13V25M46 25v75M92 25q-19 5-19 35h19v40',
    'M25 76h78l-5 14H30ZM30 76a34 34 0 0 1 68 0M64 39v-7',
    'M24 71q40-35 80 0-40 35-80 0ZM24 71l-12-12v24ZM85 66h.1',
    'M34 82q-17-27 9-40 10-25 27-7 28-8 28 18 16 28-12 33H44Z',
  ],
  Barbería: [
    'M30 29a13 13 0 1 0 0 26 13 13 0 0 0 0-26ZM30 73a13 13 0 1 0 0 26 13 13 0 0 0 0-26ZM41 50l55 40M41 78l55-40',
    'M42 27h44v74H42ZM37 27h54M37 101h54M43 45l42-14M43 64l42-14M43 83l42-14M50 100l35-12',
    'M19 42h90v15H19ZM31 57v21M43 57v16M55 57v21M67 57v16M79 57v21M91 57v16M103 57v21',
    'M33 41h62v18H33ZM40 59l7 25h34l7-25M56 84v20h16V84',
    'M23 62q21-21 41 0 20-21 41 0-10 20-41 6-31 14-41-6Z',
  ],
  Hotelería: [
    'M20 89V48M20 74h88v19M28 72V57h24v15M56 72V55h40q12 0 12 12v5',
    'M48 51a18 18 0 1 1 13 18L36 94H23V82l24-24ZM70 46h.1',
    'M15 92h98M27 92V50l37-25 37 25v42M53 92V69h22v23M38 54h12M78 54h12',
    'M24 73h80l-7 16H31ZM31 73a33 33 0 0 1 66 0M64 39v-7',
    'M36 83l28-49 28 49ZM64 51l10 32M56 83l8-13',
  ],
  Comercio: [
    'M27 44h74l6 60H21ZM47 55V36a17 17 0 0 1 34 0v19',
    'M21 44l42-22 42 22v45l-42 22-42-22ZM21 44l42 23 42-23M63 66v44',
    'M17 58h94L98 35H30ZM24 60v42h80V60M51 101V75h25v26',
    'M22 58h84l-8 36H31ZM44 57l12-23M84 57L72 34M49 77h30',
    'M40 28h35l26 35-33 33-38-35V39ZM54 43h.1',
  ],
  Tecnología: [
    'M43 36h42v56H43ZM34 47h9M34 64h9M34 81h9M85 47h9M85 64h9M85 81h9M54 53h20v22H54Z',
    'M25 35h78v50H25ZM54 85v12M74 85v12M42 98h44',
    'M31 55l-15 9 15 9M97 55l15 9-15 9M75 43L53 85',
    'M62 14L27 69h32l-4 45 46-61H68l5-39Z',
    'M27 61a37 37 0 0 1 74 0M39 73a25 25 0 0 1 50 0M53 82a11 11 0 0 1 22 0M64 96h.1',
  ],
}

const families: { category: string; label: string; render: (index: number) => string }[] = [
  { category: 'Botánica', label: 'Rama', render: (i) => line(
    'M28 113Q52 75 98 15' + times(3 + i % 6, (j) => {
      const x = 43 + j * (5 + i % 3), y = 98 - j * (10 + i % 2), spread = 18 + i
      return `M${x} ${y}q-${spread} -4 -${spread} -${18 + j}q${spread} 0 ${spread} ${18 + j}q${spread} -12 ${spread + 10} -8q-7 17 -${spread + 10} 8`
    }), 2) },
  { category: 'Flores', label: 'Flor', render: (i) => circle(64, 64, 6 + i % 5, false) + times(4 + i % 9, (j) =>
    `<g transform="rotate(${j * 360 / (4 + i % 9)} 64 64)">${line(`M64 55Q${34 + i} ${34 - i % 8} 64 ${9 + i % 8}Q${94 - i} 34 64 55Z`, 2)}</g>`) },
  { category: 'Estrellas', label: 'Estrella', render: (i) => {
    const tips = 4 + i % 10
    const path = `M${Array.from({ length: tips * 2 }, (_, j) => polar(j % 2 ? 13 + i * 1.42 : 53, j * Math.PI / tips)).join('L')}Z`
    return i % 3 === 0 ? shape(path) : line(path, 2 + i % 4)
  } },
  { category: 'Marcos', label: 'Marco', render: (i) =>
    `<rect x="${8 + i % 5}" y="${8 + i % 7}" width="${112 - (i % 5) * 2}" height="${112 - (i % 7) * 2}" rx="${i * 1.8}" fill="none" stroke="${colors.forest}" stroke-width="${2 + i % 3}"${i % 2 ? ' stroke-dasharray="5 4"' : ''}/>` +
      (i % 3 === 0 ? line('M35 18H93M35 110H93M18 35V93M110 35V93', 1) : '') },
  { category: 'Flechas', label: 'Flecha', render: (i) =>
    line(`M16 ${35 + (i * 13 % 59)}Q58 ${18 + (i * 17 % 87)} 106 64m-${16 + i % 9} -${10 + i % 11} ${16 + i % 9} ${10 + i % 11}-${16 + i % 9} ${10 + i % 11}`, 2 + i % 5) },
  { category: 'Líneas', label: 'Separador', render: (i) => line(`M8 64H${46 - i}M${82 + i} 64h${38 - i}M64 ${53 - i}L${75 + i} 64 64 ${75 + i} ${53 - i} 64Z`, 2 + i % 3) },
  { category: 'Formas', label: 'Polígono', render: (i) => {
    const sides = 3 + i % 13
    const path = `M${Array.from({ length: sides }, (_, j) => polar(50 - (i % 3) * 5, (i + j * 360 / sides) * Math.PI / 180)).join('L')}Z`
    return i % 2 ? shape(path) : line(path, 2 + i % 3)
  } },
  { category: 'Ondas', label: 'Onda', render: (i) => times(2 + i % 6, (j) =>
    line(`M8 ${19 + j * 14}q28 -${7 + i % 18} 56 0t56 0`, 2 + i % 3)) },
  { category: 'Patrones', label: 'Trama', render: (i) => times(4 + i % 4, (y) => times(4 + i % 4, (x) =>
    circle(16 + x * (15 + i % 4) + y % 2 * (i % 7), 16 + y * (15 + i % 4), 2 + i % 4, (x + y + i) % 3 !== 0))) },
  ...Object.entries(icons).map(([category, paths]) => ({ category, label: 'Emblema', render: (i: number) =>
    line(paths[i % paths.length], 2.8 + i % 3) + [
      '', circle(64, 64, 60, false), line('M20 12h88M20 116h88', 1.5),
      line('M12 38V12h26m52 0h26v26m0 52v26H90m-52 0H12V90', 1.5),
    ][Math.floor(i / paths.length)] })),
  { category: 'Sellos', label: 'Sello', render: (i) => circle(64, 64, 32 + i % 10, false) + times(12 + i, (j) => {
    const angle = j * Math.PI * 2 / (12 + i)
    return circle(64 + Math.sin(angle) * 49, 64 + Math.cos(angle) * 49, 1 + i % 4 / 2)
  }) },
  { category: 'Cintas', label: 'Cinta', render: (i) => line(`M13 ${37 + i}h102l-${9 + i % 10} 20 ${9 + i % 10} 20H13l${9 + i % 10}-20ZM32 ${45 + i}h64M32 ${68 + i}h64`, 2) },
  { category: 'Bordes', label: 'Borde ornamental', render: (i) => times(4, (j) =>
    `<g transform="rotate(${j * 90} 64 64)">${line(`M${12 + i} 42V${12 + i}H42M${19 + i / 2} 33V${19 + i / 2}H33M13 13q${24 + i} 2 ${15 + i} ${15 + i}`, 2)}</g>`) },
  { category: 'Texturas', label: 'Fibra', render: (i) => times(22, (j) => {
    const x = 5 + (j * 53 + i * 17) % 110, y = 5 + (j * 37 + i * 31) % 108
    return line(`M${x} ${y}q${2 + i % 8} -${j % 6} ${3 + j % 8} ${i % 5}`, 1)
  }) },
]

export const elements: ElementItem[] = [...provided, ...backgrounds, ...families.flatMap(({ category, label, render }) =>
  Array.from({ length: 20 }, (_, i) => ({
    id: `${category.toLowerCase()}-${i + 1}`, name: `${label} ${i + 1}`, category, svg: svg(render(i)),
  })))]

const loaded = new Map<string, Promise<string>>()
export function loadVector(url: string) {
  if (!loaded.has(url)) {
    const task = fetch(url).then((response) => {
      if (!response.ok) throw new Error('El recurso no está disponible.')
      return response.text()
    }).catch((error: unknown) => { loaded.delete(url); throw error })
    loaded.set(url, task)
  }
  return loaded.get(url)!
}

export const vectorUrl = (markup: string) => `data:image/svg+xml,${encodeURIComponent(markup)}`

export async function elementLayer(element: ElementItem, x: number, y: number, w = 100, h = w): Promise<Layer> {
  return { ...layerBase(element.name, x, y, w, h), kind: 'vector', svg: element.svg ?? await loadVector(element.url!) }
}
