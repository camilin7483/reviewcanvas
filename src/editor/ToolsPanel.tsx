import { useEffect, useState } from 'react'
import { isReviewsSectionLink } from '../googleReviews'
import { Check, ExternalLink, FileImage, Plus, QrCode, Upload } from 'lucide-react'
import { accountHint } from '../api'
import { readBrands } from '../storage'
import { fonts, type Brand, type Project, type QrStyle } from '../model'
import type { Template } from '../library/templates'
import type { ElementItem } from '../library/vectors'
import { FileField } from '../components/ui'
import { ElementGallery, TemplateGallery } from '../components/Galleries'
import { QrControls } from './Inspector'
import type { Verification } from './output'

export type Tab = 'templates' | 'elements' | 'text' | 'qr' | 'uploads' | 'brand'
export const tabNames: Record<Tab, string> = {
  templates: 'Plantillas', elements: 'Elementos', text: 'Texto', qr: 'Código QR', uploads: 'Archivos', brand: 'Mi marca',
}

type Props = {
  tab: Tab; project: Project; activeTemplate: string; verification: Verification; qr: QrStyle | undefined;
  choose: (template: Template) => void; addElement: (element: ElementItem) => void; addText: (style: string) => void;
  addQr: () => void; review: () => void; updateQr: (values: Partial<QrStyle>) => void;
  upload: (file: File) => void; uploadFont: (file: File) => void; applyBrand: (brand: Brand) => void;
  onError: (message: string) => void
}

export function ToolsPanel(props: Props) {
  const [brands, setBrands] = useState<Brand[]>([])
  useEffect(() => {
    if (props.tab === 'brand') void readBrands(accountHint()?.id).then(setBrands).catch(() => {})
  }, [props.tab])
  return <aside className="tools-panel" aria-label="Herramientas y recursos">
    <div className="panel-heading tool-title"><h2>{tabNames[props.tab]}</h2></div>
    {props.tab === 'templates' && <TemplateGallery onChoose={props.choose} selected={props.activeTemplate} />}
    {props.tab === 'elements' && <ElementGallery onChoose={props.addElement} />}
    {props.tab === 'text' && <div className="field-stack">
      <button type="button" className="button button-primary" onClick={() => props.addText('body')}><Plus size={17} /> Añadir texto</button>
      <button type="button" className="text-preset preset-title" onClick={() => props.addText('title')}>Título editorial</button>
      <button type="button" className="text-preset preset-summary" onClick={() => props.addText('subtitle')}>Subtítulo</button>
      <button type="button" className="text-preset preset-label" onClick={() => props.addText('label')}>Etiqueta</button>
      <FileField label="Importar tipografía" accept=".woff2,.woff,.ttf,.otf" change={props.uploadFont} />
      {props.project.importedFonts.map((font) => <span className="helper" key={font.name}>{font.name}</span>)}
    </div>}
    {props.tab === 'qr' && <div className="field-stack">
      <button type="button" className="button button-primary" onClick={props.review}><QrCode size={17} />{props.project.url ? 'Editar enlace de reseñas' : 'Vincular Google Maps'}</button>
      <div className={`verification ${props.verification.ok ? 'verified' : ''}`}>
        {props.verification.ok && <Check size={16} />}<span>{props.verification.message}</span>
      </div>
      {props.project.url && <a className="button button-outline" href={props.project.url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> {isReviewsSectionLink(props.project.url) ? 'Abrir sección de reseñas' : 'Abrir formulario de reseñas'}</a>}
      {props.verification.warnings.map((message) => <p className="warning" key={message}>{message}</p>)}
      <button type="button" className="button button-outline" onClick={props.addQr}><Plus size={17} /> Añadir QR</button>
      {props.qr && <QrControls style={props.qr} update={props.updateQr} onError={props.onError} />}
    </div>}
    {props.tab === 'uploads' && <div className="field-stack">
      <div className="upload-note"><FileImage size={25} /><p>Añade el logotipo o las imágenes de tu negocio.</p></div>
      <FileField label="Importar imagen o SVG" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" change={props.upload} />
      <FileField label="Importar tipografía" accept=".woff2,.woff,.ttf,.otf" change={props.uploadFont} />
    </div>}
    {props.tab === 'brand' && <div className="field-stack">
      <a className="button button-outline" href="/proyectos?seccion=marca"><Upload size={16} /> Administrar marcas</a>
      {brands.length ? brands.map((brand) => <button type="button" className="brand-preset" key={brand.id} onClick={() => props.applyBrand(brand)}>
        <span className="brand-preset-swatches"><i style={{ background: brand.primary }} /><i style={{ background: brand.secondary }} /></span>
        <span>{brand.name}<small>{brand.font || fonts[0]}</small></span>
      </button>) : <p className="helper">Guarda el nombre, la paleta y el logotipo de tu negocio para aplicar su identidad a cualquier diseño.</p>}
    </div>}
  </aside>
}
