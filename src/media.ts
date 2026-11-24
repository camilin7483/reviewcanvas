import type { Brand, Layer, Project } from './model'

export const assetReference = /^asset:([a-f0-9]{64})$/
export const assetDigest = (value: string) => assetReference.exec(value)?.[1]
type Convert = (value: string) => Promise<string>

async function mapLayer(layer: Layer, convert: Convert): Promise<Layer> {
  if (layer.kind === 'image') return { ...layer, source: await convert(layer.source) }
  if (layer.kind === 'qr' && layer.style.logo) return { ...layer, style: { ...layer.style, logo: await convert(layer.style.logo) } }
  if (layer.kind === 'group') return { ...layer, children: await mapLayers(layer.children, convert) }
  return layer
}

async function mapLayers(layers: Layer[], convert: Convert) {
  const output: Layer[] = []
  for (const layer of layers) output.push(await mapLayer(layer, convert))
  return output
}

export async function mapProjectMedia(project: Project, convert: Convert): Promise<Project> {
  return { ...project, layers: await mapLayers(project.layers, convert) }
}

export async function mapBrandMedia(brand: Brand, convert: Convert): Promise<Brand> {
  const images: string[] = []
  for (const image of brand.images) images.push(await convert(image))
  return { ...brand, images, logo: brand.logo ? await convert(brand.logo) : undefined }
}

export function hasProjectAssetReferences(layers: Layer[]): boolean {
  return layers.some((layer) => (layer.kind === 'image' && assetReference.test(layer.source))
    || (layer.kind === 'qr' && assetReference.test(layer.style.logo ?? ''))
    || (layer.kind === 'group' && hasProjectAssetReferences(layer.children)))
}
