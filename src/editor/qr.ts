import QRCodeStyling, { type Options } from 'qr-code-styling'
import { previewQrText, type QrStyle } from '../model'
import { vectorUrl } from '../library/vectors'

const qrCache = new Map<string, Promise<string>>()
const qrPixels = 760
export { qrPixels }

export function makeQr(style: QrStyle, link: string) {
  const key = JSON.stringify([style, link])
  let pending = qrCache.get(key)
  if (pending) return pending
  pending = renderQr(style, link).catch((error: unknown) => { qrCache.delete(key); throw error })
  qrCache.set(key, pending)
  if (qrCache.size > 24) qrCache.delete(qrCache.keys().next().value!)
  return pending
}

async function renderQr(style: QrStyle, link: string) {
  const options: Partial<Options> = {
    width: qrPixels, height: qrPixels, type: 'svg', data: link || previewQrText,
    margin: Math.round(qrPixels * style.margin / 100),
    qrOptions: { errorCorrectionLevel: style.error },
    dotsOptions: {
      type: style.dots, color: style.ink,
      gradient: style.gradient ? { type: 'linear', rotation: Math.PI / 4, colorStops: [
        { offset: 0, color: style.ink }, { offset: 1, color: style.accent },
      ] } : undefined,
    },
    cornersSquareOptions: { type: style.corners, color: style.ink },
    cornersDotOptions: { type: style.corners === 'square' ? 'square' : 'dot', color: style.ink },
    backgroundOptions: { color: style.transparent ? 'transparent' : style.paper },
    image: style.logo,
    imageOptions: { hideBackgroundDots: true, imageSize: .28, margin: 10, saveAsBlob: true },
  }
  const rendered = await new QRCodeStyling(options).getRawData('svg')
  if (!(rendered instanceof Blob)) throw new Error('No se pudo construir el código QR.')
  const markup = await rendered.text()
  const node = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement
  node.setAttribute('viewBox', `0 0 ${qrPixels} ${qrPixels}`)
  if (style.frame) {
    const frame = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    for (const [key, value] of Object.entries({ x: '6', y: '6', width: '748', height: '748', rx: '18',
      fill: 'none', stroke: style.ink, 'stroke-width': '9' })) frame.setAttribute(key, value)
    node.append(frame)
  }
  return new XMLSerializer().serializeToString(node)
}

export async function readQr(canvas: HTMLCanvasElement) {
  const [{ BrowserQRCodeReader }, { DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')])
  const reader = new BrowserQRCodeReader(new Map([[DecodeHintType.TRY_HARDER, true]]))
  const decode = (source: HTMLCanvasElement) => {
    try { return reader.decodeFromCanvas(source).getText() } catch { return '' }
  }
  const decoded = decode(canvas)
  if (decoded) return decoded

  // ZXing puede detectar la misma matriz a otra escala según el tamaño de sus módulos.
  const size = Math.max(canvas.width, canvas.height)
  for (const target of [480, 360]) {
    if (size <= target) continue
    const scan = document.createElement('canvas')
    scan.width = Math.max(1, Math.round(canvas.width * target / size))
    scan.height = Math.max(1, Math.round(canvas.height * target / size))
    scan.getContext('2d')!.drawImage(canvas, 0, 0, scan.width, scan.height)
    const text = decode(scan)
    if (text) return text
  }
  return ''
}

export async function standaloneQr(style: QrStyle, link: string) {
  const markup = await makeQr(style, link)
  const image = new Image()
  image.src = vectorUrl(markup)
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = qrPixels
  const drawing = canvas.getContext('2d')!
  drawing.fillStyle = '#ffffff'
  drawing.fillRect(0, 0, qrPixels, qrPixels)
  drawing.drawImage(image, 0, 0)
  return { markup, image, canvas }
}

export function qrContrast(style: QrStyle) {
  const luminance = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0)
  const background = luminance(style.transparent ? '#ffffff' : style.paper)
  const ink = Math.max(luminance(style.ink), style.gradient ? luminance(style.accent) : 0)
  return (background + .05) / (ink + .05)
}
