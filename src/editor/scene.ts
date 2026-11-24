import {
  Canvas, FabricImage, FabricObject, Group, IText, Path, Rect, Shadow, StaticCanvas, Textbox,
  loadSVGFromString, util, type TMat2D,
} from 'fabric'
import { dimensions, reviewLink, type Layer, type Project } from '../model'
import { vectorUrl } from '../library/vectors'
import { safeVector, prepareFonts } from './assets'
import { makeQr } from './qr'

type ObjectData = { layer: Layer; width: number; height: number; qrMarkup?: string }
export const objectData = new WeakMap<FabricObject, ObjectData>()

export function setControls(object: FabricObject, layer: Layer) {
  return object.set({
    opacity: layer.opacity, visible: !layer.hidden, angle: layer.angle, flipX: layer.flipX, flipY: layer.flipY,
    lockMovementX: layer.locked, lockMovementY: layer.locked, lockRotation: layer.locked,
    lockScalingX: layer.locked, lockScalingY: layer.locked, evented: !layer.locked,
    hasControls: !layer.locked, selectable: !layer.locked, borderColor: '#397dd2',
    cornerColor: '#ffffff', cornerStrokeColor: '#397dd2', transparentCorners: false, cornerSize: 9,
    touchCornerSize: 24, padding: 0, snapAngle: 0,
  })
}

export async function createObject(layer: Layer, link: string): Promise<FabricObject> {
  let object: FabricObject
  let qrMarkup: string | undefined
  switch (layer.kind) {
    case 'rect':
      object = new Rect({
        fill: layer.fill, width: layer.w, height: layer.h, rx: layer.radius ?? 0, ry: layer.radius ?? 0,
        stroke: layer.stroke, strokeWidth: layer.strokeWidth ?? 0, strokeUniform: true,
      })
      break
    case 'text': {
      const properties = {
        width: layer.w, fontSize: layer.size, fontFamily: layer.font, fontWeight: layer.weight,
        fontStyle: layer.italic ? 'italic' as const : 'normal' as const, underline: layer.underline, textAlign: layer.align,
        charSpacing: layer.tracking, lineHeight: layer.leading, fill: layer.fill, strokeWidth: layer.outlineWidth ?? 0,
        stroke: layer.outline, paintFirst: 'stroke' as const, splitByGrapheme: true,
        shadow: layer.shadow ? new Shadow({ color: '#00000055', offsetX: 2, offsetY: 4, blur: 5 }) : null,
      }
      if (layer.curve) {
        const rise = layer.curve * 1.8
        const path = new Path(`M 0 ${Math.max(0, rise)} Q ${layer.w / 2} ${-Math.min(0, rise)} ${layer.w} ${Math.max(0, rise)}`, { visible: false })
        object = new IText(layer.text.replaceAll('\n', ' '), { ...properties, path, pathAlign: 'center' })
      } else object = new Textbox(layer.text, properties)
      break
    }
    case 'vector': {
      const parsed = await loadSVGFromString(safeVector(layer.svg, layer.tint))
      const objects = parsed.objects.filter((entry): entry is FabricObject => Boolean(entry))
      if (!objects.length) throw new Error('No se reconoce la decoración vectorial.')
      const options = { width: parsed.options.width || layer.w, height: parsed.options.height || layer.h }
      // Se conserva el espacio del viewBox en el que se diseñó la decoración.
      const bounds = new Rect({ width: options.width, height: options.height, left: 0, top: 0,
        originX: 'left', originY: 'top', strokeWidth: 0, fill: 'transparent' })
      object = new Group([bounds, ...objects])
      break
    }
    case 'qr':
      qrMarkup = await makeQr(layer.style, link)
      object = await FabricImage.fromURL(vectorUrl(qrMarkup))
      object.set({ imageSmoothing: false, lockUniScaling: true })
      break
    case 'image':
      object = await FabricImage.fromURL(layer.source)
      break
    case 'group': {
      const children = await Promise.all(layer.children.map((child) => createObject(child, link)))
      object = new Group(children, { subTargetCheck: false })
      children.forEach((child, index) => child.set({ left: layer.children[index].x, top: layer.children[index].y }))
      object.set({ width: layer.w, height: layer.h })
      break
    }
  }
  const width = Math.max(1, object.width), height = Math.max(1, object.height)
  const useOwnDimensions = layer.kind === 'text' || layer.kind === 'group' || layer.kind === 'rect'
  object.set({
    originX: 'center', originY: 'center', left: layer.x, top: layer.y,
    scaleX: useOwnDimensions ? 1 : layer.w / width, scaleY: useOwnDimensions ? 1 : layer.h / height,
  })
  setControls(object, layer)
  object.setCoords()
  objectData.set(object, { layer, width, height, qrMarkup })
  return object
}

export function serializeObject(object: FabricObject, matrix?: TMat2D): Layer {
  const data = objectData.get(object)!
  const { layer } = data
  const transform = matrix ? util.qrDecompose(matrix) : undefined
  const scaleX = Math.abs(transform?.scaleX ?? object.scaleX)
  const scaleY = Math.abs(transform?.scaleY ?? object.scaleY)
  const fields = {
    ...layer, x: transform?.translateX ?? object.left, y: transform?.translateY ?? object.top,
    angle: (transform?.angle ?? object.angle) % 360, opacity: object.opacity,
    flipX: transform ? transform.scaleX < 0 : object.flipX, flipY: transform ? transform.scaleY < 0 : object.flipY,
    hidden: !object.visible,
    w: Math.max(1, (layer.kind === 'text' ? object.width : data.width) * scaleX),
    h: Math.max(1, (layer.kind === 'text' ? object.height : data.height) * scaleY),
  }
  if (layer.kind === 'text' && object instanceof IText) {
    return { ...layer, ...fields, kind: 'text', text: object.text.slice(0, 2000), size: Math.max(4, Math.min(460, object.fontSize * scaleY)) }
  }
  if (layer.kind === 'group' && object instanceof Group) {
    const children = object.getObjects().map((child) => {
      const local = child.calcOwnMatrix()
      const resized: TMat2D = [local[0] * scaleX, local[1] * scaleY, local[2] * scaleX, local[3] * scaleY, local[4] * scaleX, local[5] * scaleY]
      return serializeObject(child, scaleX === 1 && scaleY === 1 ? undefined : resized)
    })
    return { ...layer, ...fields, kind: 'group', children }
  }
  return { ...layer, ...fields } as Layer
}

export function flattenGroup(object: Group) {
  return object.getObjects().map((child) => serializeObject(child, child.calcTransformMatrix()))
}

export async function renderProject(project: Project) {
  await prepareFonts(project)
  const canvas = new StaticCanvas(document.createElement('canvas'), { ...dimensions(project.format), renderOnAddRemove: false, enableRetinaScaling: false })
  try {
    canvas.add(...await Promise.all(project.layers.map((layer) => createObject(layer, reviewLink(project.url)))))
    canvas.renderAll()
    return canvas
  } catch (error) {
    void canvas.dispose()
    throw error
  }
}

export function activeIds(scene: Canvas) {
  return scene.getActiveObjects().map((object) => objectData.get(object)?.layer.id).filter((id): id is string => Boolean(id))
}
