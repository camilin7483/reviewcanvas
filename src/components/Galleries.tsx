import { useMemo, useState } from 'react'
import { Check, Heart, Search, SlidersHorizontal } from 'lucide-react'
import { templates, themes, type Template } from '../library/templates'
import { elements, vectorUrl, type ElementItem } from '../library/vectors'
import { useLibrary } from '../storage'
import { IconButton } from './ui'

export function TemplateImage({ template }: { template: Template }) {
  if (template.thumbnail) return <img src={template.thumbnail} alt="" loading="lazy" width="280" height="350" />
  const plot = template.preview()
  return <svg viewBox={`0 0 ${template.format.width} ${template.format.height}`} aria-hidden="true" className="template-mini">
    {plot.map((layer) => {
      if (layer.kind === 'rect') return <rect key={layer.id} x={layer.x - layer.w / 2} y={layer.y - layer.h / 2} width={layer.w}
        height={layer.h} rx={layer.radius} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
      if (layer.kind === 'vector') return <image key={layer.id} href={vectorUrl(layer.svg)} x={layer.x - layer.w / 2} y={layer.y - layer.h / 2}
        width={layer.w} height={layer.h} preserveAspectRatio="none" />
      if (layer.kind === 'qr') return <image key={layer.id} href="/miniaturas/qrcode.svg" x={layer.x - layer.w / 2} y={layer.y - layer.h / 2} width={layer.w} height={layer.h} />
      if (layer.kind === 'text') return <text key={layer.id} x={layer.x} y={layer.y - (layer.text.split('\n').length - 1) * layer.size / 2}
        dominantBaseline="middle" textAnchor="middle" fontFamily={layer.font} fontWeight={layer.weight}
        fontSize={layer.size} fontStyle={layer.italic ? 'italic' : 'normal'} fill={layer.fill}>
        {layer.text.split('\n').map((line, index) => <tspan key={index} x={layer.x} dy={index ? layer.size * layer.leading : 0}>{line}</tspan>)}
      </text>
      return null
    })}
  </svg>
}

const match = (input: string) => input.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
function SearchInput({ value, change, label }: { value: string; change: (value: string) => void; label: string }) {
  return <label className="search"><Search size={16} /><input value={value} onChange={(event) => change(event.target.value)} placeholder={label} aria-label={label} /></label>
}

export function TemplateGallery({ onChoose, selected, wide = false }: { onChoose: (template: Template) => void; selected?: string; wide?: boolean }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [style, setStyle] = useState('')
  const [orientation, setOrientation] = useState('')
  const [format, setFormat] = useState('')
  const [color, setColor] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [filters, setFilters] = useState(false)
  const [limit, setLimit] = useState(12)
  const { favorites, favorite } = useLibrary()
  const styles = useMemo(() => [...new Set(templates.map((item) => item.style))].sort(), [])
  const possibleColors = useMemo(() => [...new Set(templates.map((item) => item.color))], [])
  const items = useMemo(() => templates.filter((item) => {
    const direction = item.format.width === item.format.height ? 'Cuadrado' : item.format.width > item.format.height ? 'Horizontal' : 'Vertical'
    return (!query || match(`${item.title} ${item.business} ${item.category} ${item.style}`).includes(match(query.trim())))
      && (!category || item.category === category) && (!style || item.style === style)
      && (!format || item.format.name === format) && (!orientation || direction === orientation)
      && (!color || item.color === color) && (!onlyFavorites || favorites.includes(item.id))
  }), [query, category, style, orientation, format, color, onlyFavorites, favorites])

  return <section className={`template-gallery ${wide ? 'gallery-wide' : ''}`} aria-label="Galería de plantillas">
    <div className="gallery-tools">
      <SearchInput label="Buscar plantillas…" value={query} change={(value) => { setQuery(value); setLimit(12) }} />
      <IconButton label="Filtrar plantillas" aria-pressed={filters} onClick={() => setFilters(!filters)}><SlidersHorizontal size={16} /></IconButton>
    </div>
    {(filters || wide) && <div className="filters">
      <select aria-label="Categoría" value={category} onChange={(event) => { setCategory(event.target.value); setLimit(12) }}>
        <option value="">Categorías</option>{themes.map((theme) => <option key={theme.title}>{theme.title}</option>)}
      </select>
      <select aria-label="Estilo" value={style} onChange={(event) => setStyle(event.target.value)}>
        <option value="">Estilos</option>{styles.map((name) => <option key={name}>{name}</option>)}
      </select>
      <select aria-label="Orientación" value={orientation} onChange={(event) => setOrientation(event.target.value)}>
        <option value="">Orientación</option>{['Vertical', 'Horizontal', 'Cuadrado'].map((name) => <option key={name}>{name}</option>)}
      </select>
      <select aria-label="Formato" value={format} onChange={(event) => setFormat(event.target.value)}>
        <option value="">Formatos</option>{[...new Set(templates.map((item) => item.format.name))].map((name) => <option key={name}>{name}</option>)}
      </select>
      <select aria-label="Color" value={color} onChange={(event) => setColor(event.target.value)}>
        <option value="">Colores</option>{possibleColors.map((value) => <option key={value} value={value} style={{ backgroundColor: value }}>{value.toUpperCase()}</option>)}
      </select>
      <button type="button" className="filter-favorite" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(!onlyFavorites)}><Heart size={14} /> Favoritas</button>
    </div>}
    <div className="template-grid">
      {items.slice(0, limit).map((template) => <article className={`template-tile ${selected === template.id ? 'tile-active' : ''}`} key={template.id}>
        <button type="button" className="template-choose" onClick={() => onChoose(template)} aria-label={`Usar ${template.title}`} title={template.title}>
          <div className="template-art"><TemplateImage template={template} /></div>
          <span className="template-name">{template.title}</span>
          {wide && <small>{template.category} · {template.style}</small>}
          {selected === template.id && <span className="selected-tick"><Check size={13} /></span>}
        </button>
        <IconButton label={favorites.includes(template.id) ? `Quitar ${template.title} de favoritas` : `Guardar ${template.title} como favorita`}
          className={`favorite ${favorites.includes(template.id) ? 'is-favorite' : ''}`} onClick={() => favorite(template.id)}>
          <Heart size={15} fill={favorites.includes(template.id) ? 'currentColor' : 'none'} />
        </IconButton>
      </article>)}
    </div>
    {!items.length && <p className="empty-small">No hay plantillas con estos filtros.</p>}
    {limit < items.length && <button type="button" className="button button-outline gallery-more" onClick={() => setLimit(limit + 18)}>Ver más plantillas</button>}
  </section>
}

export function ElementGallery({ onChoose }: { onChoose: (element: ElementItem) => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [limit, setLimit] = useState(30)
  const { decorationFavorites, favorite } = useLibrary()
  const categories = [...new Set(elements.map((element) => element.category))]
  const filtered = elements.filter((item) => (!query || match(`${item.name} ${item.category}`).includes(match(query.trim())))
    && (!category || category === item.category) && (!favoritesOnly || decorationFavorites.includes(item.id)))
  return <div className="element-gallery">
    <SearchInput label="Buscar elementos…" change={(value) => { setQuery(value); setLimit(30) }} value={query} />
    <div className="gallery-tools"><select aria-label="Categoría de elementos" value={category} onChange={(event) => { setCategory(event.target.value); setLimit(30) }}>
      <option value="">Todas las colecciones</option>{categories.map((name) => <option key={name}>{name}</option>)}
    </select><IconButton label="Elementos favoritos" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}><Heart size={16} /></IconButton></div>
    <div className="element-grid">{filtered.slice(0, limit).map((item) => <div className="element-tile" key={item.id}>
      <button type="button" title={item.name} aria-label={`Añadir ${item.name}`} draggable onDragStart={(event) => {
        event.dataTransfer.setData('application/reviewcanvas-element', item.id)
        event.dataTransfer.effectAllowed = 'copy'
      }} onClick={() => onChoose(item)}>
        <img src={item.url ?? vectorUrl(item.svg!)} alt="" loading="lazy" width="45" height="45" />
      </button>
      <button className="element-favorite" type="button" aria-label={`Favorito: ${item.name}`} aria-pressed={decorationFavorites.includes(item.id)}
        onClick={() => favorite(item.id, true)}><Heart size={12} fill={decorationFavorites.includes(item.id) ? 'currentColor' : 'none'} /></button>
    </div>)}</div>
    {limit < filtered.length && <button className="button button-outline gallery-more" onClick={() => setLimit(limit + 30)}>Ver más elementos</button>}
    {!filtered.length && <p className="empty-small">No hay elementos con estos filtros.</p>}
  </div>
}
